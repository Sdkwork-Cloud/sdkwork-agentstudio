use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use sdkwork_clawstudio_host_core::domain::rollout::ManageRolloutTargetPreviewRecord;
use sdkwork_clawstudio_host_core::internal::error::{InternalErrorCategory, InternalErrorResolution};
use sdkwork_clawstudio_host_core::rollout::control_plane::{
    PreviewRolloutInput, RolloutControlPlaneError,
};
use serde::{Deserialize, Serialize};

use crate::bootstrap::ServerState;
use crate::http::api_envelope::{api_success, next_trace_id};
use crate::http::auth::authorize_manage_request;
use crate::http::error_response::{categorized_error_response, validation_error_response};

pub fn manage_rollout_routes() -> Router<ServerState> {
    Router::new().route("/rollouts", get(list_rollouts)).route(
        "/rollouts/{*rollout_path}",
        get(handle_rollout_get).post(handle_rollout_action),
    )
}

async fn list_rollouts(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    state
        .rollout_control_plane
        .list_rollouts()
        .map(|data| api_success(data, &trace_id))
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))
}

async fn get_rollout(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Path(rollout_id): Path<String>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    let rollouts = state
        .rollout_control_plane
        .list_rollouts()
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))?;
    let rollout = rollouts
        .items
        .into_iter()
        .find(|item| item.id == rollout_id)
        .ok_or_else(|| {
            categorized_error_response(
                "rollout_not_found",
                InternalErrorCategory::State,
                "The requested rollout was not found.",
                StatusCode::NOT_FOUND,
                false,
                InternalErrorResolution::FixRequest,
                state.host_platform_updated_at(),
            )
        })?;

    Ok(api_success(rollout, &trace_id))
}

async fn list_rollout_targets(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Path(rollout_id): Path<String>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    let preview = state
        .rollout_control_plane
        .preview_rollout(PreviewRolloutInput {
            rollout_id: rollout_id.clone(),
            force_recompute: false,
            include_targets: true,
        })
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))?;

    Ok(api_success(
        ManageRolloutTargetListResult {
            rollout_id: preview.rollout_id,
            attempt: preview.attempt,
            total: preview.targets.len(),
            items: preview.targets,
        },
        &trace_id,
    ))
}

async fn get_rollout_target(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Path((rollout_id, node_id)): Path<(String, String)>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    let preview = state
        .rollout_control_plane
        .preview_rollout(PreviewRolloutInput {
            rollout_id: rollout_id.clone(),
            force_recompute: false,
            include_targets: true,
        })
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))?;
    let target = preview
        .targets
        .into_iter()
        .find(|item| item.node_id == node_id)
        .ok_or_else(|| {
            categorized_error_response(
                "rollout_not_found",
                InternalErrorCategory::State,
                "The requested rollout target was not found.",
                StatusCode::NOT_FOUND,
                false,
                InternalErrorResolution::FixRequest,
                state.host_platform_updated_at(),
            )
        })?;

    Ok(api_success(target, &trace_id))
}

async fn list_rollout_waves(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Path(rollout_id): Path<String>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    state
        .rollout_control_plane
        .list_rollout_waves(&rollout_id)
        .map(|data| api_success(data, &trace_id))
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))
}

async fn handle_rollout_get(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Path(rollout_path): Path<String>,
) -> impl IntoResponse {
    let trace_id = next_trace_id();
    if let Err(response) = authorize_manage_request(&headers, &state, &trace_id) {
        return response;
    }

    match rollout_path.split('/').collect::<Vec<_>>().as_slice() {
        [rollout_id, "targets", node_id] => get_rollout_target(
            headers,
            State(state),
            Path(((*rollout_id).to_string(), (*node_id).to_string())),
        )
        .await
        .into_response(),
        [rollout_id, "targets"] => {
            list_rollout_targets(headers, State(state), Path(rollout_id.to_string()))
                .await
                .into_response()
        }
        [rollout_id, "waves"] => {
            list_rollout_waves(headers, State(state), Path(rollout_id.to_string()))
                .await
                .into_response()
        }
        [rollout_id] if !rollout_id.contains(':') => {
            get_rollout(headers, State(state), Path((*rollout_id).to_string()))
                .await
                .into_response()
        }
        [_rollout_id, ..] => validation_error_response(
            "invalid_request",
            "The requested rollout route is not supported.",
            StatusCode::NOT_FOUND,
            state.host_platform_updated_at(),
        ),
        [] => validation_error_response(
            "invalid_request",
            "The requested rollout route is not supported.",
            StatusCode::NOT_FOUND,
            state.host_platform_updated_at(),
        ),
    }
}

async fn handle_rollout_action(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Path(rollout_action): Path<String>,
    request_body: String,
) -> impl IntoResponse {
    let trace_id = next_trace_id();
    if let Err(response) = authorize_manage_request(&headers, &state, &trace_id) {
        return response;
    }

    match rollout_action.rsplit_once(':') {
        Some((rollout_id, "preview")) => preview_rollout(state, rollout_id, request_body)
            .await
            .into_response(),
        Some((rollout_id, "start")) => start_rollout(state, rollout_id).await.into_response(),
        _ => validation_error_response(
            "invalid_request",
            "The requested rollout action is not supported.",
            StatusCode::NOT_FOUND,
            state.host_platform_updated_at(),
        ),
    }
}

async fn preview_rollout(
    state: ServerState,
    rollout_id: &str,
    request_body: String,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    let request =
        parse_preview_request(rollout_id, &request_body, state.host_platform_updated_at())?;

    state
        .rollout_control_plane
        .preview_rollout(request)
        .map(|data| api_success(data, &trace_id))
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))
}

async fn start_rollout(
    state: ServerState,
    rollout_id: &str,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    state
        .rollout_control_plane
        .start_rollout(rollout_id)
        .map(|data| api_success(data, &trace_id))
        .map_err(|error| map_rollout_error(error, state.host_platform_updated_at()))
}

fn parse_preview_request(
    rollout_id: &str,
    request_body: &str,
    now_ms: u64,
) -> Result<PreviewRolloutInput, Response> {
    let request = if request_body.trim().is_empty() {
        PreviewRolloutRouteBody::default()
    } else {
        serde_json::from_str::<PreviewRolloutRouteBody>(request_body).map_err(|_error| {
            validation_error_response(
                "invalid_body",
                "The rollout preview request body is invalid.",
                StatusCode::BAD_REQUEST,
                now_ms,
            )
        })?
    };

    if let Some(body_rollout_id) = request.rollout_id.as_deref() {
        if body_rollout_id != rollout_id {
            return Err(validation_error_response(
                "invalid_request",
                "The rollout preview request rolloutId does not match the route rollout id.",
                StatusCode::BAD_REQUEST,
                now_ms,
            ));
        }
    }

    Ok(PreviewRolloutInput {
        rollout_id: rollout_id.to_string(),
        force_recompute: request.force_recompute.unwrap_or(false),
        include_targets: request.include_targets.unwrap_or(true),
    })
}

fn map_rollout_error(error: RolloutControlPlaneError, now_ms: u64) -> Response {
    match error {
        RolloutControlPlaneError::RolloutNotFound { .. } => categorized_error_response(
            "rollout_not_found",
            InternalErrorCategory::State,
            "The requested rollout was not found.",
            StatusCode::NOT_FOUND,
            false,
            InternalErrorResolution::FixRequest,
            now_ms,
        ),
        RolloutControlPlaneError::PreviewRequired { .. } => categorized_error_response(
            "preview_required",
            InternalErrorCategory::State,
            "A rollout preview is required before this operation.",
            StatusCode::CONFLICT,
            false,
            InternalErrorResolution::FixRequest,
            now_ms,
        ),
        RolloutControlPlaneError::RolloutBlocked { .. } => categorized_error_response(
            "rollout_blocked",
            InternalErrorCategory::Compatibility,
            "The rollout is blocked by preflight policy.",
            StatusCode::CONFLICT,
            false,
            InternalErrorResolution::OperatorAction,
            now_ms,
        ),
        RolloutControlPlaneError::Store(_)
        | RolloutControlPlaneError::CatalogUnavailable { .. } => categorized_error_response(
            "dependency_unavailable",
            InternalErrorCategory::Dependency,
            "The rollout control-plane store is temporarily unavailable.",
            StatusCode::SERVICE_UNAVAILABLE,
            true,
            InternalErrorResolution::WaitAndRetry,
            now_ms,
        ),
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreviewRolloutRouteBody {
    rollout_id: Option<String>,
    force_recompute: Option<bool>,
    include_targets: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManageRolloutTargetListResult {
    rollout_id: String,
    attempt: u64,
    total: usize,
    items: Vec<ManageRolloutTargetPreviewRecord>,
}
