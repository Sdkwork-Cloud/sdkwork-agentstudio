use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::{get, post},
    Router,
};
use sdkwork_agentstudio_host_core::internal::error::{InternalErrorCategory, InternalErrorResolution};

use crate::{
    bootstrap::ServerState,
    http::{
        api_envelope::{api_success, next_trace_id},
        auth::authorize_manage_request,
        error_response::categorized_error_response,
    },
    service::{execute_server_service_action, ServerServiceLifecycleAction},
};

pub fn manage_service_routes() -> Router<ServerState> {
    Router::new()
        .route("/service", get(get_service_status))
        .route("/service:install", post(install_service))
        .route("/service:start", post(start_service))
        .route("/service:stop", post(stop_service))
        .route("/service:restart", post(restart_service))
}

async fn get_service_status(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    execute_service_action(&state, ServerServiceLifecycleAction::Status, &trace_id)
}

async fn install_service(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    execute_service_action(&state, ServerServiceLifecycleAction::Install, &trace_id)
}

async fn start_service(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    execute_service_action(&state, ServerServiceLifecycleAction::Start, &trace_id)
}

async fn stop_service(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    execute_service_action(&state, ServerServiceLifecycleAction::Stop, &trace_id)
}

async fn restart_service(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    execute_service_action(&state, ServerServiceLifecycleAction::Restart, &trace_id)
}

fn execute_service_action(
    state: &ServerState,
    action: ServerServiceLifecycleAction,
    trace_id: &str,
) -> Result<Response, Response> {
    execute_server_service_action(
        &state.service_control_plane,
        &state.runtime_contract,
        action,
    )
    .map(|data| api_success(data, &trace_id))
    .map_err(|_error| {
        categorized_error_response(
            "service_lifecycle_failed",
            InternalErrorCategory::System,
            "The native service control plane could not complete the requested action.",
            StatusCode::INTERNAL_SERVER_ERROR,
            false,
            InternalErrorResolution::OperatorAction,
            state.host_platform_updated_at(),
        )
    })
}
