use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostEndpointRecord {
    pub endpoint_id: String,
    pub bind_host: String,
    pub requested_port: u16,
    pub active_port: Option<u16>,
    pub scheme: String,
    pub base_url: Option<String>,
    pub websocket_url: Option<String>,
    pub loopback_only: bool,
    pub dynamic_port: bool,
    pub last_conflict_at: Option<u64>,
    pub last_conflict_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostEndpointRegistration {
    pub endpoint_id: String,
    pub bind_host: String,
    pub requested_port: u16,
    pub active_port: Option<u16>,
    pub scheme: String,
    pub base_path: Option<String>,
    pub websocket_path: Option<String>,
    pub loopback_only: bool,
    pub dynamic_port: bool,
    pub last_conflict_at: Option<u64>,
    pub last_conflict_reason: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct HostEndpointRegistry {
    records: BTreeMap<String, HostEndpointRecord>,
}

impl HostEndpointRegistry {
    pub fn register(&mut self, registration: HostEndpointRegistration) -> HostEndpointRecord {
        let record = HostEndpointRecord {
            endpoint_id: registration.endpoint_id.clone(),
            bind_host: registration.bind_host.clone(),
            requested_port: registration.requested_port,
            active_port: registration.active_port,
            scheme: registration.scheme.clone(),
            base_url: build_endpoint_url(
                registration.scheme.as_str(),
                registration.bind_host.as_str(),
                registration.active_port,
                registration.base_path.as_deref(),
            ),
            websocket_url: build_websocket_url(
                registration.scheme.as_str(),
                registration.bind_host.as_str(),
                registration.active_port,
                registration.websocket_path.as_deref(),
            ),
            loopback_only: registration.loopback_only,
            dynamic_port: registration.dynamic_port,
            last_conflict_at: registration.last_conflict_at,
            last_conflict_reason: registration.last_conflict_reason,
        };

        self.records
            .insert(record.endpoint_id.clone(), record.clone());
        record
    }

    pub fn get(&self, endpoint_id: &str) -> Option<&HostEndpointRecord> {
        self.records.get(endpoint_id)
    }

    pub fn list(&self) -> Vec<HostEndpointRecord> {
        self.records.values().cloned().collect()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OpenClawLifecycle {
    Inactive,
    Starting,
    Ready,
    Degraded,
    Stopping,
    Stopped,
}

impl OpenClawLifecycle {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Inactive => "inactive",
            Self::Starting => "starting",
            Self::Ready => "ready",
            Self::Degraded => "degraded",
            Self::Stopping => "stopping",
            Self::Stopped => "stopped",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawRuntimeProjection {
    pub runtime_kind: String,
    pub lifecycle: String,
    pub endpoint_id: Option<String>,
    pub requested_port: Option<u16>,
    pub active_port: Option<u16>,
    pub base_url: Option<String>,
    pub websocket_url: Option<String>,
    pub managed_by: String,
    pub updated_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawGatewayProjection {
    pub gateway_kind: String,
    pub lifecycle: String,
    pub endpoint_id: Option<String>,
    pub requested_port: Option<u16>,
    pub active_port: Option<u16>,
    pub base_url: Option<String>,
    pub websocket_url: Option<String>,
    pub managed_by: String,
    pub updated_at: u64,
}

pub fn project_openclaw_runtime(
    endpoint: Option<&HostEndpointRecord>,
    lifecycle: OpenClawLifecycle,
    managed_by: impl Into<String>,
    updated_at: u64,
) -> OpenClawRuntimeProjection {
    let projection =
        project_openclaw_projection(endpoint, lifecycle, managed_by.into(), updated_at);

    OpenClawRuntimeProjection {
        runtime_kind: "openclaw".to_string(),
        lifecycle: projection.lifecycle,
        endpoint_id: projection.endpoint_id,
        requested_port: projection.requested_port,
        active_port: projection.active_port,
        base_url: projection.base_url,
        websocket_url: projection.websocket_url,
        managed_by: projection.managed_by,
        updated_at: projection.updated_at,
    }
}

pub fn project_openclaw_gateway(
    endpoint: Option<&HostEndpointRecord>,
    lifecycle: OpenClawLifecycle,
    managed_by: impl Into<String>,
    updated_at: u64,
) -> OpenClawGatewayProjection {
    let projection =
        project_openclaw_projection(endpoint, lifecycle, managed_by.into(), updated_at);

    OpenClawGatewayProjection {
        gateway_kind: "openclawGateway".to_string(),
        lifecycle: projection.lifecycle,
        endpoint_id: projection.endpoint_id,
        requested_port: projection.requested_port,
        active_port: projection.active_port,
        base_url: projection.base_url,
        websocket_url: projection.websocket_url,
        managed_by: projection.managed_by,
        updated_at: projection.updated_at,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct OpenClawProjectionParts {
    lifecycle: String,
    endpoint_id: Option<String>,
    requested_port: Option<u16>,
    active_port: Option<u16>,
    base_url: Option<String>,
    websocket_url: Option<String>,
    managed_by: String,
    updated_at: u64,
}

fn project_openclaw_projection(
    endpoint: Option<&HostEndpointRecord>,
    lifecycle: OpenClawLifecycle,
    managed_by: String,
    updated_at: u64,
) -> OpenClawProjectionParts {
    OpenClawProjectionParts {
        lifecycle: lifecycle.as_str().to_string(),
        endpoint_id: endpoint.map(|record| record.endpoint_id.clone()),
        requested_port: endpoint.map(|record| record.requested_port),
        active_port: endpoint.and_then(|record| record.active_port),
        base_url: endpoint.and_then(|record| record.base_url.clone()),
        websocket_url: endpoint.and_then(|record| record.websocket_url.clone()),
        managed_by,
        updated_at,
    }
}

fn build_endpoint_url(
    scheme: &str,
    bind_host: &str,
    active_port: Option<u16>,
    path: Option<&str>,
) -> Option<String> {
    let active_port = active_port?;
    let normalized_path = normalize_path(path);
    let mut value = format!("{}://{}:{}", scheme.trim(), bind_host.trim(), active_port);
    if let Some(path) = normalized_path {
        value.push_str(path.as_str());
    }
    Some(value)
}

fn build_websocket_url(
    scheme: &str,
    bind_host: &str,
    active_port: Option<u16>,
    path: Option<&str>,
) -> Option<String> {
    let websocket_path = normalize_path(path)?;
    let websocket_scheme = match scheme.trim() {
        "https" => "wss",
        "http" => "ws",
        other => other,
    };

    build_endpoint_url(
        websocket_scheme,
        bind_host,
        active_port,
        Some(websocket_path.as_str()),
    )
}

fn normalize_path(path: Option<&str>) -> Option<String> {
    let value = path?.trim();
    if value.is_empty() {
        None
    } else if value.starts_with('/') {
        Some(value.to_string())
    } else {
        Some(format!("/{value}"))
    }
}
