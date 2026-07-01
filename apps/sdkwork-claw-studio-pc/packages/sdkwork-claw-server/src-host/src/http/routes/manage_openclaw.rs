use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use sdkwork_claw_host_core::openclaw_control_plane::OpenClawGatewayInvokeRequest;
use sdkwork_claw_host_core::internal::error::{InternalErrorCategory, InternalErrorResolution};

use crate::{
    bootstrap::ServerState,
    http::{
        api_envelope::{api_success, next_trace_id},
        auth::authorize_manage_request,
        error_response::categorized_error_response,
    },
};

pub fn manage_openclaw_routes() -> Router<ServerState> {
    Router::new()
        .route("/host-endpoints", get(list_host_endpoints))
        .route("/openclaw/runtime", get(get_openclaw_runtime))
        .route("/openclaw/gateway", get(get_openclaw_gateway))
        .route("/openclaw/gateway/invoke", post(invoke_openclaw_gateway))
}

async fn list_host_endpoints(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    let updated_at = state.host_platform_updated_at();
    state
        .manage_openclaw_provider
        .list_host_endpoints(updated_at)
        .map(|data| api_success(data, &trace_id))
        .map_err(|_error| {
            categorized_error_response(
                "host_endpoints_unavailable",
                InternalErrorCategory::Dependency,
                "The managed host endpoint projection is not available for this host shell.",
                StatusCode::SERVICE_UNAVAILABLE,
                true,
                InternalErrorResolution::WaitAndRetry,
                updated_at,
            )
        })
}

async fn get_openclaw_runtime(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    let updated_at = state.resource_projection_updated_at();
    state
        .manage_openclaw_provider
        .get_runtime(updated_at)
        .map(|data| api_success(data, &trace_id))
        .map_err(|_error| {
            categorized_error_response(
                "openclaw_runtime_unavailable",
                InternalErrorCategory::Dependency,
                "The OpenClaw runtime projection is not available for this host shell.",
                StatusCode::SERVICE_UNAVAILABLE,
                true,
                InternalErrorResolution::WaitAndRetry,
                updated_at,
            )
        })
}

async fn get_openclaw_gateway(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    let updated_at = state.resource_projection_updated_at();
    state
        .manage_openclaw_provider
        .get_gateway(updated_at)
        .map(|data| api_success(data, &trace_id))
        .map_err(|_error| {
            categorized_error_response(
                "openclaw_gateway_projection_unavailable",
                InternalErrorCategory::Dependency,
                "The OpenClaw gateway projection is not available for this host shell.",
                StatusCode::SERVICE_UNAVAILABLE,
                true,
                InternalErrorResolution::WaitAndRetry,
                updated_at,
            )
        })
}

async fn invoke_openclaw_gateway(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(request): Json<OpenClawGatewayInvokeRequest>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    let updated_at = state.host_platform_updated_at();
    state
        .manage_openclaw_provider
        .invoke_gateway(request, updated_at)
        .map(|data| api_success(data, &trace_id))
        .map_err(|_error| {
            categorized_error_response(
                "openclaw_gateway_unavailable",
                InternalErrorCategory::Dependency,
                "The OpenClaw gateway is not available for this host shell.",
                StatusCode::SERVICE_UNAVAILABLE,
                true,
                InternalErrorResolution::WaitAndRetry,
                updated_at,
            )
        })
}
