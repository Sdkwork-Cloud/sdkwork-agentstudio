use std::sync::Arc;

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::{get, post, put},
    Json, Router,
};
use sdkwork_clawstudio_host_core::internal::error::{InternalErrorCategory, InternalErrorResolution};
use sdkwork_clawstudio_host_studio::{
    StudioAbortKernelChatRunInput, StudioOpenClawGatewayInvokePayload, StudioPublicApiProvider,
};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    bootstrap::ServerState,
    http::{
        api_envelope::{api_success, next_trace_id},
        auth::authorize_public_studio_request,
        error_response::categorized_error_response,
    },
};

pub fn api_public_routes() -> Router<ServerState> {
    Router::new()
        .route("/discovery", get(get_public_api_discovery))
        .route(
            "/studio/instances",
            get(list_public_studio_instances).post(create_public_studio_instance),
        )
        .route(
            "/studio/instances/{id}/conversations",
            get(list_public_studio_conversations),
        )
        .route(
            "/studio/instances/{id}/detail",
            get(get_public_studio_instance_detail),
        )
        .route(
            "/studio/instances/{id}/config",
            get(get_public_studio_instance_config).put(put_public_studio_instance_config),
        )
        .route(
            "/studio/instances/{id}/kernel-chat/agent-profiles",
            get(list_public_studio_kernel_chat_agent_profiles),
        )
        .route(
            "/studio/instances/{id}/kernel-chat/sessions",
            get(list_public_studio_kernel_chat_sessions)
                .post(create_public_studio_kernel_chat_session),
        )
        .route(
            "/studio/instances/{id}/kernel-chat/sessions/{sessionIdRoute}",
            get(get_public_studio_kernel_chat_session)
                .patch(patch_public_studio_kernel_chat_session)
                .delete(delete_public_studio_kernel_chat_session)
                .post(post_public_studio_kernel_chat_session_action),
        )
        .route(
            "/studio/instances/{id}/kernel-chat/sessions/{sessionId}/runs",
            get(list_public_studio_kernel_chat_runs),
        )
        .route(
            "/studio/instances/{id}/kernel-chat/sessions/{sessionId}/runs/{runId}",
            get(get_public_studio_kernel_chat_run),
        )
        .route(
            "/studio/instances/{id}/kernel-chat/sessions/{sessionId}/messages",
            get(load_public_studio_kernel_chat_messages),
        )
        .route(
            "/studio/instances/{id}/logs",
            get(get_public_studio_instance_logs),
        )
        .route(
            "/studio/instances/{id}/gateway/invoke",
            post(post_public_studio_instance_openclaw_gateway_invoke),
        )
        .route(
            "/studio/instances/{id}/tasks",
            post(post_public_studio_instance_task),
        )
        .route(
            "/studio/instances/{id}/tasks/{taskIdRoute}",
            put(put_public_studio_instance_task)
                .post(post_public_studio_instance_task_action)
                .delete(delete_public_studio_instance_task),
        )
        .route(
            "/studio/instances/{id}/tasks/{taskId}/executions",
            get(get_public_studio_instance_task_executions),
        )
        .route(
            "/studio/instances/{id}/files/{fileId}",
            put(put_public_studio_instance_file_content),
        )
        .route(
            "/studio/instances/{id}/llm-providers/{providerId}",
            put(put_public_studio_instance_llm_provider_config),
        )
        .route(
            "/studio/conversations/{conversationId}",
            put(put_public_studio_conversation).delete(delete_public_studio_conversation),
        )
        .route(
            "/studio/instances/{id}",
            get(get_public_studio_instance)
                .put(put_public_studio_instance)
                .post(post_public_studio_instance_action)
                .delete(delete_public_studio_instance),
        )
}

async fn get_public_api_discovery(
    State(state): State<ServerState>,
) -> Response {
    let trace_id = next_trace_id();
    let mut capability_keys = vec!["api.discovery.read".to_string()];
    if state.studio_public_api.is_some() {
        capability_keys.push("api.studio.instances.read".to_string());
        capability_keys.push("api.studio.instances.write".to_string());
        capability_keys.push("api.studio.conversations.read".to_string());
        capability_keys.push("api.studio.conversations.write".to_string());
    }

    api_success(
        PublicApiDiscoveryRecord {
            family: "api".to_string(),
            version: "v1".to_string(),
            base_path: "/claw/api/v1".to_string(),
            host_mode: state.mode.to_string(),
            host_version: state.host_platform_version(),
            openapi_document_url: "/claw/openapi/v1.json".to_string(),
            health_live_url: "/claw/health/live".to_string(),
            health_ready_url: "/claw/health/ready".to_string(),
            capability_keys,
            generated_at: state.resource_projection_updated_at(),
        },
        &trace_id,
    )
}

async fn list_public_studio_instances(
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    run_blocking_studio_public_api_call(&state, "list studio instances", move || {
        provider.list_instances()
    })
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| studio_public_api_projection_error(&state, "list studio instances", error))
}

async fn create_public_studio_instance(
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(input): Json<Value>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    run_blocking_studio_public_api_call(&state, "create the requested studio instance", move || {
        provider.create_instance(input)
    })
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_projection_error(&state, "create the requested studio instance", error)
    })
}

async fn get_public_studio_instance(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(&state, "get studio instance", move || {
        provider.get_instance(instance_id.as_str())
    })
    .await?
    .map(|record| api_success(record.unwrap_or(Value::Null), &trace_id))
    .map_err(|error| studio_public_api_projection_error(&state, "get studio instance", error))
}

async fn put_public_studio_instance(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(input): Json<Value>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(&state, "update the requested studio instance", move || {
        provider.update_instance(instance_id.as_str(), input)
    })
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_projection_error(&state, "update the requested studio instance", error)
    })
}

async fn delete_public_studio_instance(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(&state, "delete the requested studio instance", move || {
        provider.delete_instance(instance_id.as_str())
    })
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_projection_error(&state, "delete the requested studio instance", error)
    })
}

async fn post_public_studio_instance_action(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let (instance_id, action) = if let Some(instance_id) = id.strip_suffix(":start") {
        (instance_id, "start")
    } else if let Some(instance_id) = id.strip_suffix(":stop") {
        (instance_id, "stop")
    } else if let Some(instance_id) = id.strip_suffix(":restart") {
        (instance_id, "restart")
    } else {
        return Err(studio_public_api_unknown_instance_action_response(
            &state,
            id.as_str(),
        ));
    };

    let response = match action {
        "start" => {
            let requested_instance_id = instance_id.to_string();
            run_blocking_studio_public_api_call(
                &state,
                "start the requested studio instance",
                move || provider.start_instance(requested_instance_id.as_str()),
            )
            .await?
            .map_err(|error| {
                studio_public_api_lifecycle_error_response(&state, instance_id, "start", error)
            })?
        }
        "stop" => {
            let requested_instance_id = instance_id.to_string();
            run_blocking_studio_public_api_call(
                &state,
                "stop the requested studio instance",
                move || provider.stop_instance(requested_instance_id.as_str()),
            )
            .await?
            .map_err(|error| {
                studio_public_api_lifecycle_error_response(&state, instance_id, "stop", error)
            })?
        }
        "restart" => {
            let requested_instance_id = instance_id.to_string();
            run_blocking_studio_public_api_call(
                &state,
                "restart the requested studio instance",
                move || provider.restart_instance(requested_instance_id.as_str()),
            )
            .await?
            .map_err(|error| {
                studio_public_api_lifecycle_error_response(&state, instance_id, "restart", error)
            })?
        }
        _ => {
            return Err(studio_public_api_unknown_instance_action_response(
                &state,
                id.as_str(),
            ))
        }
    };

    Ok(api_success(response.unwrap_or(Value::Null), &trace_id))
}

async fn list_public_studio_conversations(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "list studio conversations for the requested instance",
        move || provider.list_conversations(instance_id.as_str()),
    )
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_projection_error(
            &state,
            "list studio conversations for the requested instance",
            error,
        )
    })
}

async fn get_public_studio_instance_detail(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "get the studio instance detail projection",
        move || provider.get_instance_detail(instance_id.as_str()),
    )
    .await?
    .map(|record| api_success(record.unwrap_or(Value::Null), &trace_id))
    .map_err(|error| {
        studio_public_api_projection_error(
            &state,
            "get the studio instance detail projection",
            error,
        )
    })
}

async fn get_public_studio_instance_config(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "get the studio instance config projection",
        move || provider.get_instance_config(instance_id.as_str()),
    )
    .await?
    .map(|record| api_success(record.unwrap_or(Value::Null), &trace_id))
    .map_err(|error| {
        studio_public_api_projection_error(
            &state,
            "get the studio instance config projection",
            error,
        )
    })
}

async fn put_public_studio_instance_config(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(config): Json<Value>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "update the requested studio instance config projection",
        move || provider.update_instance_config(instance_id.as_str(), config),
    )
    .await?
    .map(|record| api_success(record.unwrap_or(Value::Null), &trace_id))
    .map_err(|error| {
        studio_public_api_projection_error(
            &state,
            "update the requested studio instance config projection",
            error,
        )
    })
}

async fn list_public_studio_kernel_chat_agent_profiles(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(&state, "list kernel chat agent profiles", move || {
        provider.list_kernel_chat_agent_profiles(instance_id.as_str())
    })
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_kernel_chat_error_response(
            &state,
            id.as_str(),
            None,
            "list kernel chat agent profiles",
            error,
        )
    })
}

async fn list_public_studio_kernel_chat_sessions(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(&state, "list kernel chat sessions", move || {
        provider.list_kernel_chat_sessions(instance_id.as_str())
    })
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_kernel_chat_error_response(
            &state,
            id.as_str(),
            None,
            "list kernel chat sessions",
            error,
        )
    })
}

async fn create_public_studio_kernel_chat_session(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(mut input): Json<Value>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    if let Some(object) = input.as_object_mut() {
        object.insert("instanceId".to_string(), Value::String(id.clone()));
    }
    let provider = require_studio_public_api_provider(&state)?;
    run_blocking_studio_public_api_call(&state, "create kernel chat session", move || {
        provider.create_kernel_chat_session(input)
    })
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_kernel_chat_error_response(
            &state,
            id.as_str(),
            None,
            "create kernel chat session",
            error,
        )
    })
}

async fn get_public_studio_kernel_chat_session(
    Path((id, session_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    let requested_session_id = session_id.clone();
    run_blocking_studio_public_api_call(&state, "get kernel chat session", move || {
        provider.get_kernel_chat_session(instance_id.as_str(), requested_session_id.as_str())
    })
    .await?
    .map(|record| api_success(record.unwrap_or(Value::Null), &trace_id))
    .map_err(|error| {
        studio_public_api_kernel_chat_error_response(
            &state,
            id.as_str(),
            Some(session_id.as_str()),
            "get kernel chat session",
            error,
        )
    })
}

async fn patch_public_studio_kernel_chat_session(
    Path((id, session_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(mut input): Json<Value>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    if let Some(object) = input.as_object_mut() {
        object.insert("instanceId".to_string(), Value::String(id.clone()));
        object.insert("sessionId".to_string(), Value::String(session_id.clone()));
    }
    let provider = require_studio_public_api_provider(&state)?;
    run_blocking_studio_public_api_call(&state, "patch kernel chat session", move || {
        provider.patch_kernel_chat_session(input)
    })
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_kernel_chat_error_response(
            &state,
            id.as_str(),
            Some(session_id.as_str()),
            "patch kernel chat session",
            error,
        )
    })
}

async fn delete_public_studio_kernel_chat_session(
    Path((id, session_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    let requested_session_id = session_id.clone();
    run_blocking_studio_public_api_call(&state, "delete kernel chat session", move || {
        provider.delete_kernel_chat_session(instance_id.as_str(), requested_session_id.as_str())
    })
    .await?
    .map(|_| api_success(Value::Null, &trace_id))
    .map_err(|error| {
        studio_public_api_kernel_chat_error_response(
            &state,
            id.as_str(),
            Some(session_id.as_str()),
            "delete kernel chat session",
            error,
        )
    })
}

async fn post_public_studio_kernel_chat_session_action(
    Path((id, session_action)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    body: Bytes,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let Some((session_id, action)) = session_action.rsplit_once(':') else {
        return Err(studio_public_api_unknown_kernel_chat_action_response(
            &state,
            session_action.as_str(),
        ));
    };
    let provider = require_studio_public_api_provider(&state)?;

    match action {
        "run" => {
            let mut input: Value = serde_json::from_slice(&body).map_err(|error| {
                categorized_error_response(
                    "studio_public_api_invalid_kernel_chat_run_body",
                    InternalErrorCategory::Validation,
                    &format!(
                        "The canonical studio public API could not start a kernel chat run because the request body was invalid JSON: {error}"
                    ),
                    StatusCode::BAD_REQUEST,
                    false,
                    InternalErrorResolution::FixRequest,
                    state.host_platform_updated_at(),
                )
            })?;
            if let Some(object) = input.as_object_mut() {
                object.insert("instanceId".to_string(), Value::String(id.clone()));
                object.insert(
                    "sessionId".to_string(),
                    Value::String(session_id.to_string()),
                );
            }
            run_blocking_studio_public_api_call(&state, "start kernel chat run", move || {
                provider.start_kernel_chat_run(input)
            })
            .await?
            .map(|data| api_success(data, &trace_id))
            .map_err(|error| {
                studio_public_api_kernel_chat_error_response(
                    &state,
                    id.as_str(),
                    Some(session_id),
                    "start kernel chat run",
                    error,
                )
            })
        }
        "abort" => {
            let input = if body.is_empty() {
                StudioAbortKernelChatRunInput::default()
            } else {
                serde_json::from_slice::<StudioAbortKernelChatRunInput>(&body).map_err(|error| {
                    categorized_error_response(
                        "studio_public_api_invalid_kernel_chat_abort_body",
                        InternalErrorCategory::Validation,
                        &format!(
                            "The canonical studio public API could not abort a kernel chat run because the request body was invalid JSON: {error}"
                        ),
                        StatusCode::BAD_REQUEST,
                        false,
                        InternalErrorResolution::FixRequest,
                        state.host_platform_updated_at(),
                    )
                })?
            };
            let instance_id = id.clone();
            let requested_session_id = session_id.to_string();
            run_blocking_studio_public_api_call(&state, "abort kernel chat run", move || {
                provider.abort_kernel_chat_run(
                    instance_id.as_str(),
                    requested_session_id.as_str(),
                    input.run_id,
                )
            })
            .await?
            .map(|aborted| api_success(Value::Bool(aborted), &trace_id))
            .map_err(|error| {
                studio_public_api_kernel_chat_error_response(
                    &state,
                    id.as_str(),
                    Some(session_id),
                    "abort kernel chat run",
                    error,
                )
            })
        }
        _ => Err(studio_public_api_unknown_kernel_chat_action_response(
            &state,
            session_action.as_str(),
        )),
    }
}

async fn load_public_studio_kernel_chat_messages(
    Path((id, session_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    let requested_session_id = session_id.clone();
    run_blocking_studio_public_api_call(&state, "load kernel chat messages", move || {
        provider.load_kernel_chat_messages(instance_id.as_str(), requested_session_id.as_str())
    })
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_kernel_chat_error_response(
            &state,
            id.as_str(),
            Some(session_id.as_str()),
            "load kernel chat messages",
            error,
        )
    })
}

async fn list_public_studio_kernel_chat_runs(
    Path((id, session_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    let requested_session_id = session_id.clone();
    run_blocking_studio_public_api_call(&state, "list kernel chat runs", move || {
        provider.list_kernel_chat_runs(instance_id.as_str(), requested_session_id.as_str())
    })
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_kernel_chat_error_response(
            &state,
            id.as_str(),
            Some(session_id.as_str()),
            "list kernel chat runs",
            error,
        )
    })
}

async fn get_public_studio_kernel_chat_run(
    Path((id, session_id, run_id)): Path<(String, String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    let requested_session_id = session_id.clone();
    let requested_run_id = run_id.clone();
    run_blocking_studio_public_api_call(&state, "get kernel chat run", move || {
        provider.get_kernel_chat_run(
            instance_id.as_str(),
            requested_session_id.as_str(),
            requested_run_id.as_str(),
        )
    })
    .await?
    .map(|record| api_success(record.unwrap_or(Value::Null), &trace_id))
    .map_err(|error| {
        studio_public_api_kernel_chat_error_response(
            &state,
            id.as_str(),
            Some(session_id.as_str()),
            "get kernel chat run",
            error,
        )
    })
}

async fn get_public_studio_instance_logs(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "get the studio instance logs projection",
        move || provider.get_instance_logs(instance_id.as_str()),
    )
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_projection_error(&state, "get the studio instance logs projection", error)
    })
}

async fn post_public_studio_instance_openclaw_gateway_invoke(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<StudioOpenClawGatewayInvokePayload>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "invoke the requested OpenClaw gateway",
        move || {
            provider.invoke_openclaw_gateway(instance_id.as_str(), payload.request, payload.options)
        },
    )
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| studio_public_api_openclaw_gateway_error_response(&state, id.as_str(), error))
}

async fn post_public_studio_instance_task(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<Value>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "create the requested studio workbench task",
        move || provider.create_instance_task(instance_id.as_str(), payload),
    )
    .await?
    .map(|_| api_success(Value::Null, &trace_id))
    .map_err(|error| {
        studio_public_api_workbench_error_response(
            &state,
            id.as_str(),
            "create the requested studio workbench task",
            error,
        )
    })
}

async fn put_public_studio_instance_task(
    Path((id, task_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(payload): Json<Value>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    let requested_task_id = task_id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "update the requested studio workbench task",
        move || {
            provider.update_instance_task(instance_id.as_str(), requested_task_id.as_str(), payload)
        },
    )
    .await?
    .map(|_| api_success(Value::Null, &trace_id))
    .map_err(|error| {
        studio_public_api_workbench_error_response(
            &state,
            id.as_str(),
            "update the requested studio workbench task",
            error,
        )
    })
}

async fn delete_public_studio_instance_task(
    Path((id, task_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    let requested_task_id = task_id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "delete the requested studio workbench task",
        move || provider.delete_instance_task(instance_id.as_str(), requested_task_id.as_str()),
    )
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_workbench_error_response(
            &state,
            id.as_str(),
            "delete the requested studio workbench task",
            error,
        )
    })
}

async fn get_public_studio_instance_task_executions(
    Path((id, task_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    let requested_task_id = task_id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "list the requested studio workbench task executions",
        move || {
            provider.list_instance_task_executions(instance_id.as_str(), requested_task_id.as_str())
        },
    )
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_workbench_error_response(
            &state,
            id.as_str(),
            "list the requested studio workbench task executions",
            error,
        )
    })
}

async fn post_public_studio_instance_task_action(
    Path((id, task_id_action)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    body: Bytes,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    if let Some(task_id) = task_id_action.strip_suffix(":clone") {
        let input = if body.is_empty() {
            StudioTaskCloneInput::default()
        } else {
            parse_task_action_body::<StudioTaskCloneInput>(&state, &body, "clone studio task")?
        };
        let instance_id = id.clone();
        let requested_task_id = task_id.to_string();
        return run_blocking_studio_public_api_call(
            &state,
            "clone the requested studio workbench task",
            move || {
                provider.clone_instance_task(
                    instance_id.as_str(),
                    requested_task_id.as_str(),
                    input.name,
                )
            },
        )
        .await?
        .map(|_| api_success(Value::Null, &trace_id))
        .map_err(|error| {
            studio_public_api_workbench_error_response(
                &state,
                id.as_str(),
                "clone the requested studio workbench task",
                error,
            )
        });
    }

    if let Some(task_id) = task_id_action.strip_suffix(":run") {
        let instance_id = id.clone();
        let requested_task_id = task_id.to_string();
        return run_blocking_studio_public_api_call(
            &state,
            "run the requested studio workbench task immediately",
            move || {
                provider.run_instance_task_now(instance_id.as_str(), requested_task_id.as_str())
            },
        )
        .await?
        .map(|data| api_success(data, &trace_id))
        .map_err(|error| {
            studio_public_api_workbench_error_response(
                &state,
                id.as_str(),
                "run the requested studio workbench task immediately",
                error,
            )
        });
    }

    if let Some(task_id) = task_id_action.strip_suffix(":status") {
        let input = parse_task_action_body::<StudioTaskStatusInput>(
            &state,
            &body,
            "update studio task status",
        )?;
        let instance_id = id.clone();
        let requested_task_id = task_id.to_string();
        return run_blocking_studio_public_api_call(
            &state,
            "update the requested studio workbench task status",
            move || {
                provider.update_instance_task_status(
                    instance_id.as_str(),
                    requested_task_id.as_str(),
                    input.status,
                )
            },
        )
        .await?
        .map(|_| api_success(Value::Null, &trace_id))
        .map_err(|error| {
            studio_public_api_workbench_error_response(
                &state,
                id.as_str(),
                "update the requested studio workbench task status",
                error,
            )
        });
    }

    Err(studio_public_api_unknown_task_action_response(
        &state,
        task_id_action.as_str(),
    ))
}

async fn put_public_studio_instance_file_content(
    Path((id, file_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(input): Json<StudioFileContentInput>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    let requested_file_id = file_id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "update the requested studio workbench file content",
        move || {
            provider.update_instance_file_content(
                instance_id.as_str(),
                requested_file_id.as_str(),
                input.content,
            )
        },
    )
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_workbench_error_response(
            &state,
            id.as_str(),
            "update the requested studio workbench file content",
            error,
        )
    })
}

async fn put_public_studio_instance_llm_provider_config(
    Path((id, provider_id)): Path<(String, String)>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(input): Json<Value>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let instance_id = id.clone();
    let requested_provider_id = provider_id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "update the requested studio llm provider configuration",
        move || {
            provider.update_instance_llm_provider_config(
                instance_id.as_str(),
                requested_provider_id.as_str(),
                input,
            )
        },
    )
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_workbench_error_response(
            &state,
            id.as_str(),
            "update the requested studio llm provider configuration",
            error,
        )
    })
}

async fn put_public_studio_conversation(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
    Json(mut record): Json<Value>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    if let Some(object) = record.as_object_mut() {
        object.insert("id".to_string(), Value::String(id.clone()));
    }

    let conversation_id = id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "upsert the requested studio conversation projection",
        move || provider.put_conversation(conversation_id.as_str(), record),
    )
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_projection_error(
            &state,
            "upsert the requested studio conversation projection",
            error,
        )
    })
}

async fn delete_public_studio_conversation(
    Path(id): Path<String>,
    headers: HeaderMap,
    State(state): State<ServerState>,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_public_studio_request(&headers, &state, &trace_id)?;
    let provider = require_studio_public_api_provider(&state)?;
    let conversation_id = id.clone();
    run_blocking_studio_public_api_call(
        &state,
        "delete the requested studio conversation projection",
        move || provider.delete_conversation(conversation_id.as_str()),
    )
    .await?
    .map(|data| api_success(data, &trace_id))
    .map_err(|error| {
        studio_public_api_projection_error(
            &state,
            "delete the requested studio conversation projection",
            error,
        )
    })
}

fn require_studio_public_api_provider(
    state: &ServerState,
) -> Result<Arc<dyn StudioPublicApiProvider>, Response> {
    state
        .studio_public_api
        .clone()
        .ok_or_else(|| studio_public_api_unavailable_response(state))
}

async fn run_blocking_studio_public_api_call<T, F>(
    state: &ServerState,
    action: &str,
    call: F,
) -> Result<Result<T, String>, Response>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tokio::task::spawn_blocking(call).await.map_err(|error| {
        studio_public_api_projection_error(
            state,
            action,
            format!("blocking studio public api task failed: {error}"),
        )
    })
}

fn studio_public_api_unavailable_response(state: &ServerState) -> Response {
    categorized_error_response(
        "studio_public_api_unavailable",
        InternalErrorCategory::Dependency,
        "The canonical studio public API is not available for the active host shell.",
        StatusCode::SERVICE_UNAVAILABLE,
        true,
        InternalErrorResolution::WaitAndRetry,
        state.host_platform_updated_at(),
    )
}

fn studio_public_api_unknown_instance_action_response(state: &ServerState, id: &str) -> Response {
    categorized_error_response(
        "studio_public_api_unknown_instance_action",
        InternalErrorCategory::Validation,
        &format!(
            "The canonical studio public API does not support instance action route \"{id}\"."
        ),
        StatusCode::NOT_FOUND,
        false,
        InternalErrorResolution::FixRequest,
        state.host_platform_updated_at(),
    )
}

fn studio_public_api_unknown_task_action_response(
    state: &ServerState,
    task_id_action: &str,
) -> Response {
    categorized_error_response(
        "studio_public_api_unknown_task_action",
        InternalErrorCategory::Validation,
        &format!(
            "The canonical studio public API does not support workbench task action route \"{task_id_action}\"."
        ),
        StatusCode::NOT_FOUND,
        false,
        InternalErrorResolution::FixRequest,
        state.host_platform_updated_at(),
    )
}

fn studio_public_api_unknown_kernel_chat_action_response(
    state: &ServerState,
    session_action: &str,
) -> Response {
    categorized_error_response(
        "studio_public_api_unknown_kernel_chat_action",
        InternalErrorCategory::Validation,
        &format!(
            "The canonical studio public API does not support kernel chat action route \"{session_action}\"."
        ),
        StatusCode::NOT_FOUND,
        false,
        InternalErrorResolution::FixRequest,
        state.host_platform_updated_at(),
    )
}

fn studio_public_api_projection_error(
    state: &ServerState,
    action: &str,
    error: String,
) -> Response {
    categorized_error_response(
        "studio_public_api_projection_failed",
        InternalErrorCategory::System,
        &format!("The canonical studio public API could not {action}: {error}"),
        StatusCode::INTERNAL_SERVER_ERROR,
        false,
        InternalErrorResolution::Retry,
        state.host_platform_updated_at(),
    )
}

fn studio_public_api_kernel_chat_error_response(
    state: &ServerState,
    instance_id: &str,
    session_id: Option<&str>,
    action: &str,
    error: String,
) -> Response {
    let normalized = error.to_ascii_lowercase();

    if normalized.contains("does not exist") {
        return categorized_error_response(
            "studio_public_api_instance_missing",
            InternalErrorCategory::Validation,
            &format!(
                "The canonical studio public API could not {action} because studio instance \"{instance_id}\" was not found."
            ),
            StatusCode::NOT_FOUND,
            false,
            InternalErrorResolution::FixRequest,
            state.host_platform_updated_at(),
        );
    }

    if normalized.contains("does not expose managed hermes kernel chat") {
        return categorized_error_response(
            "studio_public_api_kernel_chat_unavailable",
            InternalErrorCategory::State,
            &format!(
                "The canonical studio public API cannot {action} for studio instance \"{instance_id}\" because managed Hermes kernel chat is not available on the requested projection."
            ),
            StatusCode::CONFLICT,
            false,
            InternalErrorResolution::FetchLatestProjection,
            state.host_platform_updated_at(),
        );
    }

    if normalized.contains("kernel chat session") && normalized.contains('"') {
        return categorized_error_response(
            "studio_public_api_kernel_chat_session_missing",
            InternalErrorCategory::Validation,
            &format!(
                "The canonical studio public API could not {action} because kernel chat session {} was not found for studio instance \"{instance_id}\".",
                session_id
                    .map(|value| format!("\"{value}\""))
                    .unwrap_or_else(|| "\"unknown\"".to_string())
            ),
            StatusCode::NOT_FOUND,
            false,
            InternalErrorResolution::FixRequest,
            state.host_platform_updated_at(),
        );
    }

    studio_public_api_projection_error(state, action, error)
}

fn studio_public_api_workbench_error_response(
    state: &ServerState,
    instance_id: &str,
    action: &str,
    error: String,
) -> Response {
    let normalized = error.to_ascii_lowercase();

    if normalized.contains("does not expose a managed workbench") {
        return categorized_error_response(
            "studio_public_api_workbench_unavailable",
            InternalErrorCategory::State,
            &format!(
                "The canonical studio public API cannot {action} for studio instance \"{instance_id}\" because no live managed workbench authority is attached."
            ),
            StatusCode::CONFLICT,
            false,
            InternalErrorResolution::FetchLatestProjection,
            state.host_platform_updated_at(),
        );
    }

    studio_public_api_projection_error(state, action, error)
}

fn studio_public_api_lifecycle_error_response(
    state: &ServerState,
    instance_id: &str,
    action: &str,
    error: String,
) -> Response {
    let normalized = error.to_ascii_lowercase();
    if normalized.contains("does not exist") {
        return categorized_error_response(
            "studio_public_api_instance_missing",
            InternalErrorCategory::Validation,
            &format!(
                "The canonical studio public API could not find studio instance \"{instance_id}\" for lifecycle action \"{action}\"."
            ),
            StatusCode::NOT_FOUND,
            false,
            InternalErrorResolution::FixRequest,
            state.host_platform_updated_at(),
        );
    }

    if normalized.contains("lifecycle control is unavailable") {
        return categorized_error_response(
            "studio_public_api_lifecycle_unavailable",
            InternalErrorCategory::State,
            &format!(
                "The canonical studio public API cannot {action} studio instance \"{instance_id}\" because lifecycle control is unavailable for this host mode."
            ),
            StatusCode::CONFLICT,
            false,
            InternalErrorResolution::FetchLatestProjection,
            state.host_platform_updated_at(),
        );
    }

    studio_public_api_projection_error(
        state,
        &format!("{action} the requested studio instance"),
        error,
    )
}

fn parse_task_action_body<T>(state: &ServerState, body: &Bytes, action: &str) -> Result<T, Response>
where
    T: DeserializeOwned,
{
    serde_json::from_slice(body).map_err(|error| {
        categorized_error_response(
            "studio_public_api_invalid_task_action_body",
            InternalErrorCategory::Validation,
            &format!(
                "The canonical studio public API could not {action} because the request body was invalid JSON: {error}"
            ),
            StatusCode::BAD_REQUEST,
            false,
            InternalErrorResolution::FixRequest,
            state.host_platform_updated_at(),
        )
    })
}

fn studio_public_api_openclaw_gateway_error_response(
    state: &ServerState,
    instance_id: &str,
    error: String,
) -> Response {
    let normalized = error.to_ascii_lowercase();
    if normalized.contains("does not exist") {
        return categorized_error_response(
            "studio_public_api_openclaw_gateway_instance_missing",
            InternalErrorCategory::Validation,
            &format!(
                "The canonical studio public API could not find studio instance \"{instance_id}\" for OpenClaw gateway invocation."
            ),
            StatusCode::NOT_FOUND,
            false,
            InternalErrorResolution::FixRequest,
            state.host_platform_updated_at(),
        );
    }

    if normalized.contains("does not expose an openclaw gateway")
        || normalized.contains("invalid")
        || normalized.contains("required")
        || normalized.contains("unsupported")
    {
        return categorized_error_response(
            "studio_public_api_openclaw_gateway_invalid_request",
            InternalErrorCategory::Validation,
            &format!(
                "The canonical studio public API rejected the OpenClaw gateway invocation request for studio instance \"{instance_id}\": {error}"
            ),
            StatusCode::BAD_REQUEST,
            false,
            InternalErrorResolution::FixRequest,
            state.host_platform_updated_at(),
        );
    }

    categorized_error_response(
        "studio_public_api_openclaw_gateway_unavailable",
        InternalErrorCategory::Dependency,
        &format!(
            "The canonical studio public API could not reach the OpenClaw gateway for studio instance \"{instance_id}\": {error}"
        ),
        StatusCode::SERVICE_UNAVAILABLE,
        true,
        InternalErrorResolution::WaitAndRetry,
        state.host_platform_updated_at(),
    )
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct StudioTaskCloneInput {
    name: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StudioTaskStatusInput {
    status: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StudioFileContentInput {
    content: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicApiDiscoveryRecord {
    family: String,
    version: String,
    base_path: String,
    host_mode: String,
    host_version: String,
    openapi_document_url: String,
    health_live_url: String,
    health_ready_url: String,
    capability_keys: Vec<String>,
    generated_at: u64,
}
