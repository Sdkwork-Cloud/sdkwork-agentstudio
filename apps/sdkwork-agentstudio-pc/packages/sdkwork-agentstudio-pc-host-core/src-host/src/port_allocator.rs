use std::net::TcpListener;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PortRange {
    pub start: u16,
    pub end: u16,
}

impl PortRange {
    pub const fn new(start: u16, end: u16) -> Self {
        if end < start {
            Self {
                start: end,
                end: start,
            }
        } else {
            Self { start, end }
        }
    }

    pub fn iter(self) -> impl Iterator<Item = u16> {
        self.start..=self.end
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PortAllocationRequest {
    pub bind_host: String,
    pub requested_port: u16,
    pub fallback_range: Option<PortRange>,
    pub allow_ephemeral_fallback: bool,
}

#[derive(Debug)]
pub struct BoundPortListener {
    pub bind_host: String,
    pub requested_port: u16,
    pub active_port: u16,
    pub dynamic_port: bool,
    pub last_conflict_reason: Option<String>,
    listener: TcpListener,
}

impl BoundPortListener {
    pub fn into_listener(self) -> TcpListener {
        self.listener
    }

    pub fn base_url(&self, scheme: &str) -> String {
        format!(
            "{}://{}:{}",
            scheme.trim(),
            self.bind_host,
            self.active_port
        )
    }
}

pub fn allocate_tcp_listener(request: PortAllocationRequest) -> Result<BoundPortListener, String> {
    let bind_host = request.bind_host.trim();
    if bind_host.is_empty() {
        return Err("bind host must not be empty".to_string());
    }

    if request.requested_port == 0 {
        let listener = TcpListener::bind((bind_host, 0)).map_err(|error| {
            format!("failed to bind ephemeral tcp listener on {bind_host}: {error}")
        })?;
        return build_bound_port_listener(bind_host, 0, None, listener);
    }

    match TcpListener::bind((bind_host, request.requested_port)) {
        Ok(listener) => {
            build_bound_port_listener(bind_host, request.requested_port, None, listener)
        }
        Err(bind_error) => {
            let conflict_reason = format!(
                "requested tcp listener {bind_host}:{} is unavailable: {bind_error}",
                request.requested_port
            );

            if let Some(range) = request.fallback_range {
                for candidate in range.iter() {
                    if candidate == 0 || candidate == request.requested_port {
                        continue;
                    }

                    if let Ok(listener) = TcpListener::bind((bind_host, candidate)) {
                        return build_bound_port_listener(
                            bind_host,
                            request.requested_port,
                            Some(conflict_reason),
                            listener,
                        );
                    }
                }
            }

            if request.allow_ephemeral_fallback {
                let listener = TcpListener::bind((bind_host, 0)).map_err(|fallback_error| {
                    format!(
                        "failed to bind requested tcp listener {bind_host}:{}: {bind_error}; ephemeral fallback failed: {fallback_error}",
                        request.requested_port
                    )
                })?;
                return build_bound_port_listener(
                    bind_host,
                    request.requested_port,
                    Some(conflict_reason),
                    listener,
                );
            }

            Err(format!(
                "failed to bind requested tcp listener {bind_host}:{}: {bind_error}",
                request.requested_port
            ))
        }
    }
}

fn build_bound_port_listener(
    bind_host: &str,
    requested_port: u16,
    last_conflict_reason: Option<String>,
    listener: TcpListener,
) -> Result<BoundPortListener, String> {
    let active_port = listener
        .local_addr()
        .map_err(|error| format!("failed to read bound tcp listener address: {error}"))?
        .port();

    Ok(BoundPortListener {
        bind_host: bind_host.to_string(),
        requested_port,
        active_port,
        dynamic_port: active_port != requested_port,
        last_conflict_reason,
        listener,
    })
}
