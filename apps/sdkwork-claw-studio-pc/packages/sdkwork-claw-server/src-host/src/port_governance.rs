use std::net::TcpListener;

use sdkwork_claw_host_core::port_allocator::{allocate_tcp_listener, PortAllocationRequest};

pub struct BoundServerListener {
    pub requested_host: String,
    pub requested_port: u16,
    pub active_port: u16,
    pub dynamic_port: bool,
    pub last_conflict_reason: Option<String>,
    listener: TcpListener,
}

impl BoundServerListener {
    pub fn base_url(&self) -> String {
        format!("http://{}:{}", self.requested_host, self.active_port)
    }

    pub fn into_tokio_listener(self) -> Result<tokio::net::TcpListener, String> {
        self.listener.set_nonblocking(true).map_err(|error| {
            format!("failed to configure server listener as nonblocking: {error}")
        })?;
        tokio::net::TcpListener::from_std(self.listener).map_err(|error| {
            format!("failed to convert server listener into tokio listener: {error}")
        })
    }
}

pub fn bind_server_listener(
    host: &str,
    requested_port: u16,
    allow_dynamic_port_fallback: bool,
) -> Result<BoundServerListener, String> {
    let binding = allocate_tcp_listener(PortAllocationRequest {
        bind_host: host.to_string(),
        requested_port,
        fallback_range: None,
        allow_ephemeral_fallback: allow_dynamic_port_fallback,
    })?;

    Ok(BoundServerListener {
        requested_host: binding.bind_host.clone(),
        requested_port: binding.requested_port,
        active_port: binding.active_port,
        dynamic_port: binding.dynamic_port,
        last_conflict_reason: binding.last_conflict_reason.clone(),
        listener: binding.into_listener(),
    })
}
