use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use sdkwork_claw_host_core::{
    internal::{
        error::{InternalErrorCategory, InternalErrorEnvelope, InternalErrorResolution},
        node_sessions::{
            NodeSessionAckDesiredStateInput, NodeSessionAckDesiredStateResponse,
            NodeSessionAdmitInput, NodeSessionAdmitResponse, NodeSessionCloseInput,
            NodeSessionCloseResponse, NodeSessionHeartbeatInput, NodeSessionHeartbeatResponse,
            NodeSessionHelloInput, NodeSessionHelloResponse, NodeSessionPullDesiredStateInput,
            NodeSessionPullDesiredStateResponse, NodeSessionRecord, NodeSessionRegistryError,
        },
    },
    rollout::control_plane::RolloutControlPlaneError,
};
use serde::{de::DeserializeOwned, Serialize};

use crate::bootstrap::ServerState;
use crate::http::auth::authorize_internal_request;
use crate::http::error_response::{
    categorized_error_response, envelope_error_response, validation_error_response,
};

pub fn internal_node_session_routes() -> Router<ServerState> {
    Router::new()
        .route("/host-platform", get(get_host_platform_status))
        .route("/node-sessions", get(list_node_sessions))
        .route("/node-sessions:hello", post(hello_node_session))
        .route(
            "/node-sessions/{session_action}",
            post(handle_node_session_action),
        )
}

async fn get_host_platform_status(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<HostPlatformStatusRecord>, Response> {
    authorize_internal_request(&headers, &state)?;
    let updated_at = state.resource_projection_updated_at();
    let supported_capability_keys = state.host_platform_supported_capability_keys();
    let available_capability_keys = state.host_platform_available_capability_keys(updated_at);

    Ok(Json(HostPlatformStatusRecord {
        mode: state.mode.to_string(),
        lifecycle: "ready".to_string(),
        distribution_family: state.host_platform_distribution_family().to_string(),
        deployment_family: state.deployment_family.clone(),
        accelerator_profile: state.accelerator_profile.clone(),
        host_id: state.host_platform_id().to_string(),
        display_name: state.host_platform_display_name().to_string(),
        version: state.host_platform_version(),
        desired_state_projection_version: "phase2".to_string(),
        rollout_engine_version: "phase2".to_string(),
        manage_base_path: "/claw/manage/v1".to_string(),
        internal_base_path: "/claw/internal/v1".to_string(),
        state_store_driver: state.state_store_driver.clone(),
        state_store: state.state_store.clone(),
        capability_keys: available_capability_keys.clone(),
        supported_capability_keys,
        available_capability_keys,
        updated_at,
    }))
}

async fn list_node_sessions(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<Vec<NodeSessionRecord>>, Response> {
    authorize_internal_request(&headers, &state)?;
    let active_rollout_id = state
        .rollout_control_plane
        .active_rollout_id()
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))?;
    let projected_sessions = state
        .rollout_control_plane
        .list_projected_node_sessions(
            &active_rollout_id,
            true,
            state.host_platform_id(),
            state.host_platform_updated_at(),
        )
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))?;
    let live_sessions = state
        .node_session_registry
        .list_sessions()
        .map_err(|error| {
            map_node_session_registry_error(error, state.host_platform_updated_at())
        })?;
    let sessions = merge_node_sessions(projected_sessions, live_sessions);

    Ok(Json(sessions))
}

async fn hello_node_session(
    headers: HeaderMap,
    State(state): State<ServerState>,
    request_body: String,
) -> Result<Json<NodeSessionHelloResponse>, Response> {
    authorize_internal_request(&headers, &state)?;
    let request = parse_internal_request_body::<NodeSessionHelloInput>(
        &request_body,
        "The node session hello request body is invalid.",
        state.host_platform_updated_at(),
    )?;
    let claimed_node_id = request
        .node_claim
        .claimed_node_id
        .clone()
        .unwrap_or_default();
    let active_rollout_id = state
        .rollout_control_plane
        .active_rollout_id()
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))?;
    let compatibility_preview = state
        .rollout_control_plane
        .preview_node_session_compatibility(&active_rollout_id, &claimed_node_id)
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))?;
    let response = state
        .node_session_registry
        .hello(
            request,
            compatibility_preview,
            state.host_platform_updated_at(),
        )
        .map_err(|error| {
            map_node_session_registry_error(error, state.host_platform_updated_at())
        })?;

    Ok(Json(response))
}

async fn handle_node_session_action(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Path(session_action): Path<String>,
    request_body: String,
) -> Result<Response, Response> {
    authorize_internal_request(&headers, &state)?;
    let Some((session_id, action)) = session_action.rsplit_once(':') else {
        return Err(validation_error_response(
            "invalid_request",
            "The node session action path is invalid.",
            StatusCode::NOT_FOUND,
            state.host_platform_updated_at(),
        ));
    };

    match action {
        "admit" => {
            let request = parse_internal_request_body::<NodeSessionAdmitInput>(
                &request_body,
                "The node session admit request body is invalid.",
                state.host_platform_updated_at(),
            )?;
            admit_node_session(state, session_id, request)
                .await
                .map(IntoResponse::into_response)
        }
        "heartbeat" => {
            let request = parse_internal_request_body::<NodeSessionHeartbeatInput>(
                &request_body,
                "The node session heartbeat request body is invalid.",
                state.host_platform_updated_at(),
            )?;
            heartbeat_node_session(state, session_id, request)
                .await
                .map(IntoResponse::into_response)
        }
        "pull-desired-state" => {
            let request = parse_internal_request_body::<NodeSessionPullDesiredStateInput>(
                &request_body,
                "The node session desired-state pull request body is invalid.",
                state.host_platform_updated_at(),
            )?;
            pull_desired_state_for_node_session(state, session_id, request)
                .await
                .map(IntoResponse::into_response)
        }
        "ack-desired-state" => {
            let request = parse_internal_request_body::<NodeSessionAckDesiredStateInput>(
                &request_body,
                "The node session desired-state acknowledgement body is invalid.",
                state.host_platform_updated_at(),
            )?;
            ack_desired_state_for_node_session(state, session_id, request)
                .await
                .map(IntoResponse::into_response)
        }
        "close" => {
            let request = parse_internal_request_body::<NodeSessionCloseInput>(
                &request_body,
                "The node session close request body is invalid.",
                state.host_platform_updated_at(),
            )?;
            close_node_session(state, session_id, request)
                .await
                .map(IntoResponse::into_response)
        }
        _ => Err(validation_error_response(
            "invalid_request",
            "The requested node session action is not supported.",
            StatusCode::NOT_FOUND,
            state.host_platform_updated_at(),
        )),
    }
}

async fn admit_node_session(
    state: ServerState,
    session_id: &str,
    request: NodeSessionAdmitInput,
) -> Result<Json<NodeSessionAdmitResponse>, Response> {
    let response = state
        .node_session_registry
        .admit(session_id, request, state.host_platform_updated_at())
        .map_err(|error| {
            map_node_session_registry_error(error, state.host_platform_updated_at())
        })?;

    Ok(Json(response))
}

async fn heartbeat_node_session(
    state: ServerState,
    session_id: &str,
    request: NodeSessionHeartbeatInput,
) -> Result<Json<NodeSessionHeartbeatResponse>, Response> {
    let response = state
        .node_session_registry
        .heartbeat(session_id, request, state.host_platform_updated_at())
        .map_err(|error| {
            map_node_session_registry_error(error, state.host_platform_updated_at())
        })?;

    Ok(Json(response))
}

async fn pull_desired_state_for_node_session(
    state: ServerState,
    session_id: &str,
    request: NodeSessionPullDesiredStateInput,
) -> Result<Json<NodeSessionPullDesiredStateResponse>, Response> {
    let session = state
        .node_session_registry
        .list_sessions()
        .map_err(|error| map_node_session_registry_error(error, state.host_platform_updated_at()))?
        .into_iter()
        .find(|session| session.session_id == session_id)
        .ok_or_else(|| {
            envelope_error_response(
                InternalErrorEnvelope::new(
                    "session_unknown",
                    InternalErrorCategory::Session,
                    "The requested node session was not found.",
                    StatusCode::NOT_FOUND.as_u16(),
                    true,
                    InternalErrorResolution::RestartSession,
                ),
                StatusCode::NOT_FOUND,
                state.host_platform_updated_at(),
            )
        })?;
    let active_rollout_id = state
        .rollout_control_plane
        .active_rollout_id()
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))?;
    let desired_state = state
        .rollout_control_plane
        .resolve_node_desired_state(&active_rollout_id, &session.node_id)
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))?
        .ok_or_else(|| {
            envelope_error_response(
                InternalErrorEnvelope::new(
                    "dependency_unavailable",
                    InternalErrorCategory::Dependency,
                    "The control plane could not provide the requested desired-state projection.",
                    StatusCode::SERVICE_UNAVAILABLE.as_u16(),
                    true,
                    InternalErrorResolution::WaitAndRetry,
                ),
                StatusCode::SERVICE_UNAVAILABLE,
                state.host_platform_updated_at(),
            )
        })?;
    let response = state
        .node_session_registry
        .pull_desired_state(
            session_id,
            request,
            desired_state,
            state.host_platform_updated_at(),
        )
        .map_err(|error| {
            map_node_session_registry_error(error, state.host_platform_updated_at())
        })?;

    Ok(Json(response))
}

async fn ack_desired_state_for_node_session(
    state: ServerState,
    session_id: &str,
    request: NodeSessionAckDesiredStateInput,
) -> Result<Json<NodeSessionAckDesiredStateResponse>, Response> {
    let response = state
        .node_session_registry
        .ack_desired_state(session_id, request, state.host_platform_updated_at())
        .map_err(|error| {
            map_node_session_registry_error(error, state.host_platform_updated_at())
        })?;

    Ok(Json(response))
}

async fn close_node_session(
    state: ServerState,
    session_id: &str,
    request: NodeSessionCloseInput,
) -> Result<Json<NodeSessionCloseResponse>, Response> {
    let response = state
        .node_session_registry
        .close(session_id, request, state.host_platform_updated_at())
        .map_err(|error| {
            map_node_session_registry_error(error, state.host_platform_updated_at())
        })?;

    Ok(Json(response))
}

fn map_rollout_error(error: RolloutControlPlaneError, now_ms: u64) -> Response {
    match error {
        RolloutControlPlaneError::RolloutNotFound { .. }
        | RolloutControlPlaneError::PreviewRequired { .. } => envelope_error_response(
            InternalErrorEnvelope::new(
                "internal_failure",
                InternalErrorCategory::System,
                "The control plane could not process the requested internal operation.",
                StatusCode::INTERNAL_SERVER_ERROR.as_u16(),
                false,
                InternalErrorResolution::OperatorAction,
            ),
            StatusCode::INTERNAL_SERVER_ERROR,
            now_ms,
        ),
        RolloutControlPlaneError::RolloutBlocked { .. } => envelope_error_response(
            InternalErrorEnvelope::new(
                "compatibility_blocked",
                InternalErrorCategory::Compatibility,
                "The control plane blocked the requested internal operation.",
                StatusCode::CONFLICT.as_u16(),
                false,
                InternalErrorResolution::OperatorAction,
            ),
            StatusCode::CONFLICT,
            now_ms,
        ),
        RolloutControlPlaneError::Store(_) => envelope_error_response(
            InternalErrorEnvelope::new(
                "dependency_unavailable",
                InternalErrorCategory::Dependency,
                "The control plane store is temporarily unavailable.",
                StatusCode::SERVICE_UNAVAILABLE.as_u16(),
                true,
                InternalErrorResolution::WaitAndRetry,
            ),
            StatusCode::SERVICE_UNAVAILABLE,
            now_ms,
        ),
    }
}

fn map_node_session_registry_error(error: NodeSessionRegistryError, now_ms: u64) -> Response {
    match error {
        NodeSessionRegistryError::Store(_) => categorized_error_response(
            "internal_failure",
            InternalErrorCategory::System,
            "The node session store is unavailable.",
            StatusCode::INTERNAL_SERVER_ERROR,
            false,
            InternalErrorResolution::OperatorAction,
            now_ms,
        ),
        NodeSessionRegistryError::SessionNotFound { .. } => categorized_error_response(
            "session_unknown",
            InternalErrorCategory::Session,
            "The requested node session was not found.",
            StatusCode::NOT_FOUND,
            true,
            InternalErrorResolution::RestartSession,
            now_ms,
        ),
        NodeSessionRegistryError::HelloTokenInvalid { .. } => categorized_error_response(
            "bootstrap_auth_failed",
            InternalErrorCategory::Auth,
            "The node session bootstrap token is not valid.",
            StatusCode::UNAUTHORIZED,
            false,
            InternalErrorResolution::ReAuthenticate,
            now_ms,
        ),
        NodeSessionRegistryError::LeaseIdInvalid { .. }
        | NodeSessionRegistryError::LeaseExpired { .. } => categorized_error_response(
            "lease_expired",
            InternalErrorCategory::Session,
            "The session lease is no longer valid.",
            StatusCode::CONFLICT,
            true,
            InternalErrorResolution::RestartSession,
            now_ms,
        ),
        NodeSessionRegistryError::SessionReplaced { .. } => categorized_error_response(
            "session_replaced",
            InternalErrorCategory::Session,
            "The session was replaced by a newer runtime session.",
            StatusCode::CONFLICT,
            true,
            InternalErrorResolution::RestartSession,
            now_ms,
        ),
        NodeSessionRegistryError::StaleAck { .. } => categorized_error_response(
            "stale_ack",
            InternalErrorCategory::State,
            "The desired-state acknowledgement is stale.",
            StatusCode::CONFLICT,
            true,
            InternalErrorResolution::FetchLatestProjection,
            now_ms,
        ),
        NodeSessionRegistryError::DesiredStateConflict { .. } => categorized_error_response(
            "desired_state_conflict",
            InternalErrorCategory::State,
            "The desired-state acknowledgement does not match the current target.",
            StatusCode::CONFLICT,
            true,
            InternalErrorResolution::FetchLatestProjection,
            now_ms,
        ),
    }
}

fn parse_internal_request_body<T>(
    request_body: &str,
    message: &str,
    now_ms: u64,
) -> Result<T, Response>
where
    T: DeserializeOwned,
{
    serde_json::from_str::<T>(request_body).map_err(|_| {
        validation_error_response("invalid_body", message, StatusCode::BAD_REQUEST, now_ms)
    })
}

fn merge_node_sessions(
    projected_sessions: Vec<NodeSessionRecord>,
    live_sessions: Vec<NodeSessionRecord>,
) -> Vec<NodeSessionRecord> {
    let mut live_by_node: std::collections::BTreeMap<String, NodeSessionRecord> =
        std::collections::BTreeMap::new();
    for session in live_sessions {
        match live_by_node.get(&session.node_id) {
            Some(existing) if !candidate_session_should_replace(existing, &session) => {}
            _ => {
                live_by_node.insert(session.node_id.clone(), session);
            }
        }
    }

    let mut merged = Vec::with_capacity(projected_sessions.len() + live_by_node.len());
    for session in projected_sessions {
        if let Some(live_session) = live_by_node.remove(&session.node_id) {
            merged.push(live_session);
        } else {
            merged.push(session);
        }
    }

    merged.extend(live_by_node.into_values());
    merged
}

fn candidate_session_should_replace(
    existing: &NodeSessionRecord,
    candidate: &NodeSessionRecord,
) -> bool {
    if existing.successor_session_id.as_deref() == Some(candidate.session_id.as_str()) {
        return true;
    }
    if candidate.successor_session_id.as_deref() == Some(existing.session_id.as_str()) {
        return false;
    }

    candidate.last_seen_at >= existing.last_seen_at
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HostPlatformStatusRecord {
    mode: String,
    lifecycle: String,
    distribution_family: String,
    deployment_family: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    accelerator_profile: Option<String>,
    host_id: String,
    display_name: String,
    version: String,
    desired_state_projection_version: String,
    rollout_engine_version: String,
    manage_base_path: String,
    internal_base_path: String,
    state_store_driver: String,
    state_store: crate::bootstrap::ServerStateStoreSnapshot,
    capability_keys: Vec<String>,
    supported_capability_keys: Vec<String>,
    available_capability_keys: Vec<String>,
    updated_at: u64,
}
