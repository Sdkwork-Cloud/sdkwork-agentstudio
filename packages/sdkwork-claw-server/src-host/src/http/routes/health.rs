use axum::{extract::State, http::StatusCode, routing::get, Router};

use crate::bootstrap::ServerState;

pub fn health_routes() -> Router<ServerState> {
    Router::new()
        .route("/live", get(live))
        .route("/ready", get(ready))
}

async fn live() -> StatusCode {
    StatusCode::OK
}

fn runtime_projection_is_ready(
    lifecycle: &str,
    base_url: Option<&str>,
    websocket_url: Option<&str>,
    active_port: Option<u16>,
) -> bool {
    lifecycle == "ready" && (base_url.is_some() || websocket_url.is_some() || active_port.is_some())
}

fn bundled_server_endpoint_is_ready(state: &ServerState, updated_at: u64) -> bool {
    if state.mode != "server" || state.studio_public_api.is_none() {
        return false;
    }

    state
        .manage_openclaw_provider
        .list_host_endpoints(updated_at)
        .ok()
        .is_some_and(|endpoints| {
            endpoints.iter().any(|endpoint| {
                endpoint.endpoint_id == "claw-manage-http"
                    && (endpoint.base_url.is_some()
                        || endpoint.websocket_url.is_some()
                        || endpoint.active_port.is_some())
            })
        })
}

async fn ready(State(state): State<ServerState>) -> StatusCode {
    let updated_at = state.host_platform_updated_at();
    let bundled_server_ready = bundled_server_endpoint_is_ready(&state, updated_at);
    let runtime_ready = state
        .manage_openclaw_provider
        .get_runtime(updated_at)
        .ok()
        .is_some_and(|projection| {
            runtime_projection_is_ready(
                projection.lifecycle.as_str(),
                projection.base_url.as_deref(),
                projection.websocket_url.as_deref(),
                projection.active_port,
            )
        })
        || bundled_server_ready;
    let gateway_ready = state
        .manage_openclaw_provider
        .get_gateway(updated_at)
        .ok()
        .is_some_and(|projection| {
            runtime_projection_is_ready(
                projection.lifecycle.as_str(),
                projection.base_url.as_deref(),
                projection.websocket_url.as_deref(),
                projection.active_port,
            )
        })
        || bundled_server_ready;

    if runtime_ready && gateway_ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    }
}
