use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde_json::{json, Value};

use crate::bootstrap::ServerState;
use crate::http::api_surface::{
    build_openapi_discovery, LOCAL_AI_COMPAT_PATHS, OPENCLAW_GATEWAY_PATHS,
};

pub fn openapi_routes() -> Router<ServerState> {
    Router::new()
        .route("/discovery", get(get_openapi_discovery))
        .route("/v1.json", get(get_openapi_v1_document))
        .route(
            "/local-ai-compat-v1.json",
            get(get_openapi_local_ai_compat_document),
        )
        .route(
            "/openclaw-gateway-v1.json",
            get(get_openapi_openclaw_gateway_document),
        )
}

async fn get_openapi_discovery(State(state): State<ServerState>) -> Json<Value> {
    Json(build_openapi_discovery(&state))
}

async fn get_openapi_v1_document(State(state): State<ServerState>) -> Json<Value> {
    Json(build_native_v1_document(&state))
}

async fn get_openapi_local_ai_compat_document(State(state): State<ServerState>) -> Response {
    if state.local_ai_proxy_target().is_none() {
        return StatusCode::NOT_FOUND.into_response();
    }

    Json(build_local_ai_compat_document(&state)).into_response()
}

async fn get_openapi_openclaw_gateway_document(State(state): State<ServerState>) -> Response {
    if state.openclaw_gateway_target().is_none() {
        return StatusCode::NOT_FOUND.into_response();
    }

    Json(build_openclaw_gateway_document(&state)).into_response()
}

pub(crate) fn build_native_v1_document(state: &ServerState) -> Value {
    json!({
        "openapi": "3.1.2",
        "info": {
            "title": "SdkWork Agent Studio Native API",
            "version": "v1",
            "description": "OpenAPI publication for the currently implemented native SdkWork Agent Studio server route families.",
            "x-claw-hostVersion": state.host_platform_version()
        },
        "servers": [
            {
                "url": "/",
                "description": "Same-origin Claw server"
            }
        ],
        "tags": [
            {
                "name": "health",
                "description": "Server liveness and readiness probes."
            },
            {
                "name": "api",
                "description": "Public native product bootstrap APIs."
            },
            {
                "name": "internal",
                "description": "Internal host coordination APIs for node sessions and host status."
            },
            {
                "name": "manage",
                "description": "Operator-oriented rollout control-plane APIs."
            }
        ],
        "paths": build_paths(state),
        "components": {
            "schemas": build_schemas()
        }
    })
}

pub(crate) fn build_local_ai_compat_document(state: &ServerState) -> Value {
    let mut paths = serde_json::Map::new();
    for path in LOCAL_AI_COMPAT_PATHS {
        paths.insert((*path).to_string(), build_local_ai_compat_path_item(path));
    }

    json!({
        "openapi": "3.1.2",
        "info": {
            "title": "Local AI Compatibility API",
            "version": "v1",
            "description": "OpenAPI publication for the root-native local AI compatibility routes owned by the built-in host.",
            "x-claw-hostVersion": state.host_platform_version()
        },
        "servers": [
            {
                "url": "/",
                "description": "Same-origin built-in host"
            }
        ],
        "tags": [
            {
                "name": "local-ai-compat",
                "description": "Provider-compatible root-native routes proxied by the built-in host."
            }
        ],
        "paths": Value::Object(paths),
        "components": {
            "schemas": build_schemas()
        }
    })
}

pub(crate) fn build_openclaw_gateway_document(state: &ServerState) -> Value {
    let mut paths = serde_json::Map::new();
    for path in OPENCLAW_GATEWAY_PATHS {
        paths.insert((*path).to_string(), build_openclaw_gateway_path_item(path));
    }

    json!({
        "openapi": "3.1.2",
        "info": {
            "title": "OpenClaw Gateway Proxy API",
            "version": "v1",
            "description": "OpenAPI publication for the governed OpenClaw gateway routes owned by the built-in host.",
            "x-claw-hostVersion": state.host_platform_version()
        },
        "servers": [
            {
                "url": "/",
                "description": "Same-origin built-in host"
            }
        ],
        "tags": [
            {
                "name": "openclaw-gateway",
                "description": "Governed OpenClaw gateway routes proxied by the built-in host."
            }
        ],
        "paths": Value::Object(paths),
        "components": {
            "schemas": build_schemas()
        }
    })
}

fn build_local_ai_compat_path_item(path: &str) -> Value {
    match path {
        "/health" | "/v1/health" | "/v1/models" | "/v1beta/models" => json!({
            "get": {
                "tags": ["local-ai-compat"],
                "operationId": normalize_openapi_operation_id(path, "get"),
                "summary": format!("Proxy {path} through the built-in local AI compatibility surface"),
                "responses": {
                    "200": compat_json_response("Compatibility response from the proxied upstream route."),
                    "503": internal_error_json_response("The local AI compatibility surface is not active."),
                    "502": internal_error_json_response("The local AI compatibility upstream could not be reached.")
                }
            }
        }),
        _ => json!({
            "post": {
                "tags": ["local-ai-compat"],
                "operationId": normalize_openapi_operation_id(path, "post"),
                "summary": format!("Proxy {path} through the built-in local AI compatibility surface"),
                "requestBody": compat_json_request_body("Opaque provider-compatible request body."),
                "responses": {
                    "200": compat_json_response("Compatibility response from the proxied upstream route."),
                    "503": internal_error_json_response("The local AI compatibility surface is not active."),
                    "502": internal_error_json_response("The local AI compatibility upstream could not be reached.")
                }
            }
        }),
    }
}

fn build_openclaw_gateway_path_item(path: &str) -> Value {
    json!({
        "post": {
            "tags": ["openclaw-gateway"],
            "operationId": normalize_openapi_operation_id(path, "post"),
            "summary": format!("Proxy {path} through the governed OpenClaw gateway surface"),
            "requestBody": compat_json_request_body("Opaque OpenClaw gateway request body."),
            "responses": {
                "200": compat_json_response("OpenClaw gateway response from the proxied upstream route."),
                "503": internal_error_json_response("The OpenClaw gateway proxy surface is not active."),
                "502": internal_error_json_response("The OpenClaw gateway upstream could not be reached.")
            }
        }
    })
}

fn compat_json_request_body(description: &str) -> Value {
    json!({
        "required": false,
        "description": description,
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "additionalProperties": true
                }
            }
        }
    })
}

fn compat_json_response(description: &str) -> Value {
    json!({
        "description": description,
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "additionalProperties": true
                }
            }
        }
    })
}

fn normalize_openapi_operation_id(path: &str, method: &str) -> String {
    let mut normalized = String::with_capacity(path.len() + method.len());
    normalized.push_str(method);
    for ch in path.chars() {
        match ch {
            '/' | '-' => normalized.push('_'),
            '{' | '}' => {}
            ':' => normalized.push('_'),
            _ => normalized.push(ch),
        }
    }
    normalized
}

fn build_paths(state: &ServerState) -> Value {
    let mut paths = json!({
        "/claw/health/live": {
            "get": {
                "tags": ["health"],
                "operationId": "healthLive",
                "summary": "Check server liveness",
                "responses": {
                    "200": {
                        "description": "Liveness probe succeeded."
                    }
                }
            }
        },
        "/claw/health/ready": {
            "get": {
                "tags": ["health"],
                "operationId": "healthReady",
                "summary": "Check server readiness",
                "responses": {
                    "200": {
                        "description": "Readiness probe succeeded."
                    }
                }
            }
        },
        "/claw/api/v1/discovery": {
            "get": {
                "tags": ["api"],
                "operationId": "apiDiscovery",
                "summary": "Read public native API discovery metadata",
                "responses": {
                    "200": json_response(
                        "Public native API discovery metadata.",
                        "#/components/schemas/PublicApiDiscoveryRecord"
                    )
                }
            }
        },
        "/claw/api/v1/studio/instances": {
            "get": {
                "tags": ["api"],
                "operationId": "apiListStudioInstances",
                "summary": "List studio instances projected by the active host shell",
                "responses": {
                    "200": json_array_response(
                        "Current canonical studio instance records.",
                        "#/components/schemas/StudioInstanceRecord"
                    ),
                    "500": internal_error_json_response("The studio instance list could not be projected."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            },
            "post": {
                "tags": ["api"],
                "operationId": "apiCreateStudioInstance",
                "summary": "Create one studio instance through the active host shell",
                "requestBody": json_request_body(
                    "#/components/schemas/StudioCreateInstanceInput",
                    true,
                    "Studio instance creation payload."
                ),
                "responses": {
                    "200": json_response(
                        "Created canonical studio instance record.",
                        "#/components/schemas/StudioInstanceRecord"
                    ),
                    "400": internal_error_json_response("The studio instance creation payload was invalid."),
                    "500": internal_error_json_response("The studio instance could not be created."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}": {
            "get": {
                "tags": ["api"],
                "operationId": "apiGetStudioInstance",
                "summary": "Read one studio instance projected by the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Requested canonical studio instance record or null when the instance does not exist.",
                        "#/components/schemas/StudioInstanceNullableRecord"
                    ),
                    "500": internal_error_json_response("The studio instance record could not be projected."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            },
            "put": {
                "tags": ["api"],
                "operationId": "apiUpdateStudioInstance",
                "summary": "Update one studio instance through the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioUpdateInstanceInput",
                    true,
                    "Studio instance update payload."
                ),
                "responses": {
                    "200": json_response(
                        "Updated canonical studio instance record.",
                        "#/components/schemas/StudioInstanceRecord"
                    ),
                    "400": internal_error_json_response("The studio instance update payload was invalid."),
                    "500": internal_error_json_response("The studio instance could not be updated."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            },
            "delete": {
                "tags": ["api"],
                "operationId": "apiDeleteStudioInstance",
                "summary": "Delete one studio instance through the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Whether the canonical studio instance was deleted.",
                        "#/components/schemas/StudioInstanceDeleteResult"
                    ),
                    "500": internal_error_json_response("The studio instance could not be deleted."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}:start": {
            "post": {
                "tags": ["api"],
                "operationId": "apiStartStudioInstance",
                "summary": "Start one studio instance through the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Updated canonical studio instance record or null when the instance does not exist.",
                        "#/components/schemas/StudioInstanceNullableRecord"
                    ),
                    "500": internal_error_json_response("The studio instance could not be started."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}:stop": {
            "post": {
                "tags": ["api"],
                "operationId": "apiStopStudioInstance",
                "summary": "Stop one studio instance through the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Updated canonical studio instance record or null when the instance does not exist.",
                        "#/components/schemas/StudioInstanceNullableRecord"
                    ),
                    "500": internal_error_json_response("The studio instance could not be stopped."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}:restart": {
            "post": {
                "tags": ["api"],
                "operationId": "apiRestartStudioInstance",
                "summary": "Restart one studio instance through the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Updated canonical studio instance record or null when the instance does not exist.",
                        "#/components/schemas/StudioInstanceNullableRecord"
                    ),
                    "500": internal_error_json_response("The studio instance could not be restarted."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/detail": {
            "get": {
                "tags": ["api"],
                "operationId": "apiGetStudioInstanceDetail",
                "summary": "Read one rich studio instance detail projection surfaced by the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Requested canonical studio instance detail record or null when the instance does not exist.",
                        "#/components/schemas/StudioInstanceDetailNullableRecord"
                    ),
                    "500": internal_error_json_response("The studio instance detail record could not be projected."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/config": {
            "get": {
                "tags": ["api"],
                "operationId": "apiGetStudioInstanceConfig",
                "summary": "Read one studio instance config projection surfaced by the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Requested canonical studio instance config record or null when the instance does not exist.",
                        "#/components/schemas/StudioInstanceConfigNullableRecord"
                    ),
                    "500": internal_error_json_response("The studio instance config record could not be projected."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            },
            "put": {
                "tags": ["api"],
                "operationId": "apiUpdateStudioInstanceConfig",
                "summary": "Update one studio instance config projection through the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioInstanceConfigRecord",
                    true,
                    "Studio instance config payload."
                ),
                "responses": {
                    "200": json_response(
                        "Updated canonical studio instance config record or null when the instance does not exist.",
                        "#/components/schemas/StudioInstanceConfigNullableRecord"
                    ),
                    "400": internal_error_json_response("The studio instance config payload was invalid."),
                    "500": internal_error_json_response("The studio instance config could not be updated."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/kernel-chat/agent-profiles": {
            "get": {
                "tags": ["api"],
                "operationId": "apiListStudioKernelChatAgentProfiles",
                "summary": "List kernel chat agent profiles for one studio instance",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_array_response(
                        "Kernel chat agent profiles projected for the requested studio instance.",
                        "#/components/schemas/KernelChatAgentProfile"
                    ),
                    "500": internal_error_json_response("The kernel chat agent profiles could not be listed."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/kernel-chat/sessions": {
            "get": {
                "tags": ["api"],
                "operationId": "apiListStudioKernelChatSessions",
                "summary": "List kernel chat sessions for one studio instance",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_array_response(
                        "Kernel chat sessions projected for the requested studio instance.",
                        "#/components/schemas/KernelChatSession"
                    ),
                    "500": internal_error_json_response("The kernel chat sessions could not be listed."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            },
            "post": {
                "tags": ["api"],
                "operationId": "apiCreateStudioKernelChatSession",
                "summary": "Create one kernel chat session for one studio instance",
                "parameters": [studio_instance_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioCreateKernelChatSessionInput",
                    true,
                    "Kernel chat session creation payload."
                ),
                "responses": {
                    "200": json_response(
                        "Created kernel chat session.",
                        "#/components/schemas/KernelChatSession"
                    ),
                    "400": internal_error_json_response("The kernel chat session creation payload was invalid."),
                    "500": internal_error_json_response("The kernel chat session could not be created."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/kernel-chat/sessions/{sessionId}": {
            "get": {
                "tags": ["api"],
                "operationId": "apiGetStudioKernelChatSession",
                "summary": "Read one kernel chat session for one studio instance",
                "parameters": [studio_instance_id_parameter(), studio_session_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Requested kernel chat session or null when the session does not exist.",
                        "#/components/schemas/KernelChatSessionNullableRecord"
                    ),
                    "500": internal_error_json_response("The kernel chat session could not be loaded."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            },
            "patch": {
                "tags": ["api"],
                "operationId": "apiPatchStudioKernelChatSession",
                "summary": "Patch one kernel chat session for one studio instance",
                "parameters": [studio_instance_id_parameter(), studio_session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioPatchKernelChatSessionInput",
                    true,
                    "Kernel chat session patch payload."
                ),
                "responses": {
                    "200": json_response(
                        "Updated kernel chat session.",
                        "#/components/schemas/KernelChatSession"
                    ),
                    "400": internal_error_json_response("The kernel chat session patch payload was invalid."),
                    "500": internal_error_json_response("The kernel chat session could not be updated."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            },
            "delete": {
                "tags": ["api"],
                "operationId": "apiDeleteStudioKernelChatSession",
                "summary": "Delete one kernel chat session for one studio instance",
                "parameters": [studio_instance_id_parameter(), studio_session_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Kernel chat session deletion completed.",
                        "#/components/schemas/StudioNullResult"
                    ),
                    "500": internal_error_json_response("The kernel chat session could not be deleted."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/kernel-chat/sessions/{sessionId}:run": {
            "post": {
                "tags": ["api"],
                "operationId": "apiStartStudioKernelChatRun",
                "summary": "Start one kernel chat run for one studio instance session",
                "parameters": [studio_instance_id_parameter(), studio_session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioStartKernelChatRunInput",
                    true,
                    "Kernel chat run start payload."
                ),
                "responses": {
                    "200": json_response(
                        "Started kernel chat run.",
                        "#/components/schemas/KernelChatRun"
                    ),
                    "400": internal_error_json_response("The kernel chat run payload was invalid."),
                    "500": internal_error_json_response("The kernel chat run could not be started."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/kernel-chat/sessions/{sessionId}:abort": {
            "post": {
                "tags": ["api"],
                "operationId": "apiAbortStudioKernelChatRun",
                "summary": "Abort one kernel chat run for one studio instance session",
                "parameters": [studio_instance_id_parameter(), studio_session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioAbortKernelChatRunInput",
                    false,
                    "Optional kernel chat run abort payload."
                ),
                "responses": {
                    "200": json_response(
                        "Whether the kernel chat run was aborted.",
                        "#/components/schemas/StudioWorkbenchMutationResult"
                    ),
                    "400": internal_error_json_response("The kernel chat abort payload was invalid."),
                    "500": internal_error_json_response("The kernel chat run could not be aborted."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/kernel-chat/sessions/{sessionId}/runs": {
            "get": {
                "tags": ["api"],
                "operationId": "apiListStudioKernelChatRuns",
                "summary": "List kernel chat runs for one studio instance session",
                "parameters": [studio_instance_id_parameter(), studio_session_id_parameter()],
                "responses": {
                    "200": json_array_response(
                        "Kernel chat runs projected for the requested studio instance session.",
                        "#/components/schemas/KernelChatRun"
                    ),
                    "500": internal_error_json_response("The kernel chat runs could not be loaded."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/kernel-chat/sessions/{sessionId}/runs/{runId}": {
            "get": {
                "tags": ["api"],
                "operationId": "apiGetStudioKernelChatRun",
                "summary": "Read one kernel chat run for one studio instance session",
                "parameters": [
                    studio_instance_id_parameter(),
                    studio_session_id_parameter(),
                    studio_run_id_parameter()
                ],
                "responses": {
                    "200": json_response(
                        "Requested kernel chat run or null when the run does not exist.",
                        "#/components/schemas/KernelChatRunNullableRecord"
                    ),
                    "500": internal_error_json_response("The kernel chat run could not be loaded."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/kernel-chat/sessions/{sessionId}/messages": {
            "get": {
                "tags": ["api"],
                "operationId": "apiLoadStudioKernelChatMessages",
                "summary": "Load kernel chat messages for one studio instance session",
                "parameters": [studio_instance_id_parameter(), studio_session_id_parameter()],
                "responses": {
                    "200": json_array_response(
                        "Kernel chat messages projected for the requested studio instance session.",
                        "#/components/schemas/KernelChatMessage"
                    ),
                    "500": internal_error_json_response("The kernel chat messages could not be loaded."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/logs": {
            "get": {
                "tags": ["api"],
                "operationId": "apiGetStudioInstanceLogs",
                "summary": "Read one studio instance logs projection surfaced by the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Requested canonical studio instance logs projection.",
                        "#/components/schemas/StudioInstanceLogsRecord"
                    ),
                    "500": internal_error_json_response("The studio instance logs could not be projected."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/gateway/invoke": {
            "post": {
                "tags": ["api"],
                "operationId": "apiInvokeStudioOpenClawGateway",
                "summary": "Invoke one OpenClaw gateway through the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioOpenClawGatewayInvokePayload",
                    true,
                    "OpenClaw gateway invocation payload."
                ),
                "responses": {
                    "200": json_response(
                        "OpenClaw gateway invocation result.",
                        "#/components/schemas/StudioOpenClawGatewayInvokeResult"
                    ),
                    "400": internal_error_json_response("The OpenClaw gateway invocation payload was invalid."),
                    "404": internal_error_json_response("The requested studio instance does not exist."),
                    "503": internal_error_json_response("The OpenClaw gateway is not available for the requested studio instance.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/tasks": {
            "post": {
                "tags": ["api"],
                "operationId": "apiCreateStudioWorkbenchTask",
                "summary": "Create one managed studio workbench task",
                "parameters": [studio_instance_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioTaskMutationInput",
                    true,
                    "Managed studio workbench task payload."
                ),
                "responses": {
                    "200": json_response(
                        "Managed studio workbench task was created.",
                        "#/components/schemas/StudioNullResult"
                    ),
                    "400": internal_error_json_response("The managed studio workbench task payload was invalid."),
                    "500": internal_error_json_response("The managed studio workbench task could not be created."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/tasks/{taskId}": {
            "put": {
                "tags": ["api"],
                "operationId": "apiUpdateStudioWorkbenchTask",
                "summary": "Update one managed studio workbench task",
                "parameters": [studio_instance_id_parameter(), studio_task_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioTaskMutationInput",
                    true,
                    "Managed studio workbench task payload."
                ),
                "responses": {
                    "200": json_response(
                        "Managed studio workbench task was updated.",
                        "#/components/schemas/StudioNullResult"
                    ),
                    "400": internal_error_json_response("The managed studio workbench task payload was invalid."),
                    "500": internal_error_json_response("The managed studio workbench task could not be updated."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            },
            "delete": {
                "tags": ["api"],
                "operationId": "apiDeleteStudioWorkbenchTask",
                "summary": "Delete one managed studio workbench task",
                "parameters": [studio_instance_id_parameter(), studio_task_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Whether the managed studio workbench task was deleted.",
                        "#/components/schemas/StudioWorkbenchMutationResult"
                    ),
                    "500": internal_error_json_response("The managed studio workbench task could not be deleted."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/tasks/{taskId}:clone": {
            "post": {
                "tags": ["api"],
                "operationId": "apiCloneStudioWorkbenchTask",
                "summary": "Clone one managed studio workbench task",
                "parameters": [studio_instance_id_parameter(), studio_task_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioTaskCloneInput",
                    false,
                    "Optional managed studio workbench task clone request."
                ),
                "responses": {
                    "200": json_response(
                        "Managed studio workbench task was cloned.",
                        "#/components/schemas/StudioNullResult"
                    ),
                    "500": internal_error_json_response("The managed studio workbench task could not be cloned."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/tasks/{taskId}:run": {
            "post": {
                "tags": ["api"],
                "operationId": "apiRunStudioWorkbenchTaskNow",
                "summary": "Run one managed studio workbench task immediately",
                "parameters": [studio_instance_id_parameter(), studio_task_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Managed studio workbench task execution record.",
                        "#/components/schemas/StudioWorkbenchTaskExecutionRecord"
                    ),
                    "500": internal_error_json_response("The managed studio workbench task could not be run."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/tasks/{taskId}:status": {
            "post": {
                "tags": ["api"],
                "operationId": "apiUpdateStudioWorkbenchTaskStatus",
                "summary": "Update one managed studio workbench task status",
                "parameters": [studio_instance_id_parameter(), studio_task_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioTaskStatusInput",
                    true,
                    "Managed studio workbench task status update request."
                ),
                "responses": {
                    "200": json_response(
                        "Managed studio workbench task status was updated.",
                        "#/components/schemas/StudioNullResult"
                    ),
                    "400": internal_error_json_response("The managed studio workbench task status payload was invalid."),
                    "500": internal_error_json_response("The managed studio workbench task status could not be updated."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/tasks/{taskId}/executions": {
            "get": {
                "tags": ["api"],
                "operationId": "apiListStudioWorkbenchTaskExecutions",
                "summary": "List managed studio workbench task executions",
                "parameters": [studio_instance_id_parameter(), studio_task_id_parameter()],
                "responses": {
                    "200": json_array_response(
                        "Managed studio workbench task execution records.",
                        "#/components/schemas/StudioWorkbenchTaskExecutionRecord"
                    ),
                    "500": internal_error_json_response("The managed studio workbench task executions could not be listed."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/files/{fileId}": {
            "put": {
                "tags": ["api"],
                "operationId": "apiUpdateStudioWorkbenchFileContent",
                "summary": "Update one managed studio workbench file",
                "parameters": [studio_instance_id_parameter(), studio_file_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioFileContentUpdateInput",
                    true,
                    "Managed studio workbench file content update request."
                ),
                "responses": {
                    "200": json_response(
                        "Whether the managed studio workbench file was updated.",
                        "#/components/schemas/StudioWorkbenchMutationResult"
                    ),
                    "400": internal_error_json_response("The managed studio workbench file payload was invalid."),
                    "500": internal_error_json_response("The managed studio workbench file could not be updated."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/llm-providers/{providerId}": {
            "put": {
                "tags": ["api"],
                "operationId": "apiUpdateStudioWorkbenchLlmProvider",
                "summary": "Update one managed studio workbench LLM provider",
                "parameters": [studio_instance_id_parameter(), studio_provider_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioUpdateInstanceLlmProviderConfigInput",
                    true,
                    "Managed studio workbench LLM provider update request."
                ),
                "responses": {
                    "200": json_response(
                        "Whether the managed studio workbench LLM provider was updated.",
                        "#/components/schemas/StudioWorkbenchMutationResult"
                    ),
                    "400": internal_error_json_response("The managed studio workbench LLM provider payload was invalid."),
                    "500": internal_error_json_response("The managed studio workbench LLM provider could not be updated."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/instances/{id}/conversations": {
            "get": {
                "tags": ["api"],
                "operationId": "apiListStudioConversations",
                "summary": "List studio conversations projected for one instance by the active host shell",
                "parameters": [studio_instance_id_parameter()],
                "responses": {
                    "200": json_array_response(
                        "Current canonical studio conversation records for the requested instance.",
                        "#/components/schemas/StudioConversationRecord"
                    ),
                    "500": internal_error_json_response("The studio conversation list could not be projected."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/api/v1/studio/conversations/{conversationId}": {
            "put": {
                "tags": ["api"],
                "operationId": "apiPutStudioConversation",
                "summary": "Create or replace one studio conversation projected by the active host shell",
                "parameters": [studio_conversation_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/StudioConversationRecord",
                    true,
                    "Studio conversation payload."
                ),
                "responses": {
                    "200": json_response(
                        "Stored canonical studio conversation record.",
                        "#/components/schemas/StudioConversationRecord"
                    ),
                    "400": internal_error_json_response("The studio conversation payload was invalid."),
                    "500": internal_error_json_response("The studio conversation record could not be projected."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            },
            "delete": {
                "tags": ["api"],
                "operationId": "apiDeleteStudioConversation",
                "summary": "Delete one studio conversation projected by the active host shell",
                "parameters": [studio_conversation_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Whether the canonical studio conversation record was deleted.",
                        "#/components/schemas/StudioConversationDeleteResult"
                    ),
                    "500": internal_error_json_response("The studio conversation record could not be deleted."),
                    "503": internal_error_json_response("The canonical studio public API is not available for the active host shell.")
                }
            }
        },
        "/claw/internal/v1/host-platform": {
            "get": {
                "tags": ["internal"],
                "operationId": "internalGetHostPlatformStatus",
                "summary": "Read host platform status",
                "responses": {
                    "200": json_response(
                        "Current host platform status.",
                        "#/components/schemas/HostPlatformStatusRecord"
                    ),
                    "401": internal_error_json_response("Authentication is required for the internal control-plane surface.")
                }
            }
        },
        "/claw/internal/v1/node-sessions": {
            "get": {
                "tags": ["internal"],
                "operationId": "internalListNodeSessions",
                "summary": "List live and projected node sessions",
                "responses": {
                    "200": json_array_response(
                        "Merged live and projected node sessions.",
                        "#/components/schemas/NodeSessionRecord"
                    ),
                    "401": internal_error_json_response("Authentication is required for the internal control-plane surface."),
                    "500": internal_error_json_response("Node session list could not be loaded.")
                }
            }
        },
        "/claw/internal/v1/node-sessions:hello": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionHello",
                "summary": "Register a node session and receive a lease proposal",
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionHelloInput",
                    true,
                    "Node hello request."
                ),
                "responses": {
                    "200": json_response(
                        "Hello response with compatibility preview and lease proposal.",
                        "#/components/schemas/NodeSessionHelloResponse"
                    ),
                    "401": internal_error_json_response("Authentication is required for the internal control-plane surface."),
                    "400": internal_error_json_response("The node hello request body was invalid."),
                    "409": internal_error_json_response("The node hello request could not be processed in the current control-plane state."),
                    "500": internal_error_json_response("Node hello could not be processed."),
                    "503": internal_error_json_response("A required control-plane dependency was unavailable.")
                }
            }
        },
        "/claw/internal/v1/node-sessions/{sessionId}:admit": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionAdmit",
                "summary": "Admit a previously created node session",
                "parameters": [session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionAdmitInput",
                    true,
                    "Node admit request."
                ),
                "responses": {
                    "200": json_response(
                        "Admitted node session state.",
                        "#/components/schemas/NodeSessionAdmitResponse"
                    ),
                    "401": internal_error_json_response("Authentication is required for the internal control-plane surface."),
                    "400": internal_error_json_response("The node session admit request body was invalid."),
                    "403": internal_error_json_response("The node session bootstrap token was invalid."),
                    "404": internal_error_json_response("The requested node session was not found."),
                    "409": internal_error_json_response("The node session could not be admitted in the current state."),
                    "500": internal_error_json_response("The node session could not be admitted.")
                }
            }
        },
        "/claw/internal/v1/node-sessions/{sessionId}:heartbeat": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionHeartbeat",
                "summary": "Refresh an admitted node session lease",
                "parameters": [session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionHeartbeatInput",
                    true,
                    "Heartbeat request."
                ),
                "responses": {
                    "200": json_response(
                        "Refreshed node session lease and posture.",
                        "#/components/schemas/NodeSessionHeartbeatResponse"
                    ),
                    "401": internal_error_json_response("Authentication is required for the internal control-plane surface."),
                    "400": internal_error_json_response("The node session heartbeat request body was invalid."),
                    "404": internal_error_json_response("The requested node session was not found."),
                    "409": internal_error_json_response("The node session lease was invalid, expired, or replaced."),
                    "500": internal_error_json_response("The heartbeat could not be processed.")
                }
            }
        },
        "/claw/internal/v1/node-sessions/{sessionId}:pull-desired-state": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionPullDesiredState",
                "summary": "Fetch the current desired state for a node session",
                "parameters": [session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionPullDesiredStateInput",
                    true,
                    "Desired-state pull request."
                ),
                "responses": {
                    "200": json_response(
                        "Desired-state projection or not-modified response.",
                        "#/components/schemas/NodeSessionPullDesiredStateResponse"
                    ),
                    "401": internal_error_json_response("Authentication is required for the internal control-plane surface."),
                    "400": internal_error_json_response("The desired-state pull request body was invalid."),
                    "404": internal_error_json_response("The requested node session was not found."),
                    "409": internal_error_json_response("The node session lease was invalid, expired, or replaced."),
                    "500": internal_error_json_response("The desired-state pull could not be processed."),
                    "503": internal_error_json_response("The control plane could not provide the requested desired-state projection.")
                }
            }
        },
        "/claw/internal/v1/node-sessions/{sessionId}:ack-desired-state": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionAckDesiredState",
                "summary": "Acknowledge desired-state application",
                "parameters": [session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionAckDesiredStateInput",
                    true,
                    "Desired-state acknowledgement request."
                ),
                "responses": {
                    "200": json_response(
                        "Desired-state acknowledgement was recorded.",
                        "#/components/schemas/NodeSessionAckDesiredStateResponse"
                    ),
                    "401": internal_error_json_response("Authentication is required for the internal control-plane surface."),
                    "400": internal_error_json_response("The desired-state acknowledgement request body was invalid."),
                    "404": internal_error_json_response("The requested node session was not found."),
                    "409": internal_error_json_response("The acknowledgement conflicted with the current session or desired state."),
                    "500": internal_error_json_response("The acknowledgement could not be processed.")
                }
            }
        },
        "/claw/internal/v1/node-sessions/{sessionId}:close": {
            "post": {
                "tags": ["internal"],
                "operationId": "internalNodeSessionClose",
                "summary": "Gracefully close a node session",
                "parameters": [session_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/NodeSessionCloseInput",
                    true,
                    "Node session close request."
                ),
                "responses": {
                    "200": json_response(
                        "Node session was closed.",
                        "#/components/schemas/NodeSessionCloseResponse"
                    ),
                    "401": internal_error_json_response("Authentication is required for the internal control-plane surface."),
                    "400": internal_error_json_response("The node session close request body was invalid."),
                    "404": internal_error_json_response("The requested node session was not found."),
                    "409": internal_error_json_response("The node session lease was invalid or expired."),
                    "500": internal_error_json_response("The node session could not be closed.")
                }
            }
        },
        "/claw/manage/v1/service": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageGetServiceStatus",
                "summary": "Read native service status",
                "responses": {
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "200": json_response(
                        "Current native service status projection.",
                        "#/components/schemas/ManageServiceExecutionResult"
                    ),
                    "500": internal_error_json_response("The native service control plane could not complete the requested action.")
                }
            }
        },
        "/claw/manage/v1/service:install": {
            "post": {
                "tags": ["manage"],
                "operationId": "manageInstallService",
                "summary": "Install the native server service",
                "responses": {
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "200": json_response(
                        "Install result from the native service control plane.",
                        "#/components/schemas/ManageServiceExecutionResult"
                    ),
                    "500": internal_error_json_response("The native service control plane could not complete the requested action.")
                }
            }
        },
        "/claw/manage/v1/service:start": {
            "post": {
                "tags": ["manage"],
                "operationId": "manageStartService",
                "summary": "Start the native server service",
                "responses": {
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "200": json_response(
                        "Start result from the native service control plane.",
                        "#/components/schemas/ManageServiceExecutionResult"
                    ),
                    "500": internal_error_json_response("The native service control plane could not complete the requested action.")
                }
            }
        },
        "/claw/manage/v1/service:stop": {
            "post": {
                "tags": ["manage"],
                "operationId": "manageStopService",
                "summary": "Stop the native server service",
                "responses": {
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "200": json_response(
                        "Stop result from the native service control plane.",
                        "#/components/schemas/ManageServiceExecutionResult"
                    ),
                    "500": internal_error_json_response("The native service control plane could not complete the requested action.")
                }
            }
        },
        "/claw/manage/v1/service:restart": {
            "post": {
                "tags": ["manage"],
                "operationId": "manageRestartService",
                "summary": "Restart the native server service",
                "responses": {
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "200": json_response(
                        "Restart result from the native service control plane.",
                        "#/components/schemas/ManageServiceExecutionResult"
                    ),
                    "500": internal_error_json_response("The native service control plane could not complete the requested action.")
                }
            }
        },
        "/claw/manage/v1/host-endpoints": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageListHostEndpoints",
                "summary": "List canonical host-managed endpoints",
                "responses": {
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "200": json_array_response(
                        "Current host-managed endpoint records.",
                        "#/components/schemas/ManageHostEndpointRecord"
                    )
                }
            }
        },
        "/claw/manage/v1/openclaw/runtime": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageGetOpenClawRuntime",
                "summary": "Read the canonical OpenClaw runtime status",
                "responses": {
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "200": json_response(
                        "Current canonical OpenClaw runtime projection.",
                        "#/components/schemas/ManageOpenClawRuntimeRecord"
                    )
                }
            }
        },
        "/claw/manage/v1/openclaw/gateway": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageGetOpenClawGateway",
                "summary": "Read the canonical OpenClaw gateway status",
                "responses": {
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "200": json_response(
                        "Current canonical OpenClaw gateway projection.",
                        "#/components/schemas/ManageOpenClawGatewayRecord"
                    )
                }
            }
        },
        "/claw/manage/v1/openclaw/gateway/invoke": {
            "post": {
                "tags": ["manage"],
                "operationId": "manageInvokeOpenClawGateway",
                "summary": "Invoke the canonical OpenClaw gateway control surface",
                "requestBody": json_request_body(
                    "#/components/schemas/ManageOpenClawGatewayInvokeRequest",
                    true,
                    "OpenClaw gateway invocation request."
                ),
                "responses": {
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "200": json_response(
                        "OpenClaw gateway invocation result.",
                        "#/components/schemas/ManageOpenClawGatewayInvokeResult"
                    ),
                    "400": internal_error_json_response("The OpenClaw gateway invocation request body was invalid."),
                    "500": internal_error_json_response("The OpenClaw gateway control plane could not complete the requested action.")
                }
            }
        },
        "/claw/manage/v1/rollouts": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageListRollouts",
                "summary": "List rollout records",
                "responses": {
                    "200": json_response(
                        "Current rollout list.",
                        "#/components/schemas/ManageRolloutListResult"
                    ),
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "503": internal_error_json_response("The rollout list could not be loaded.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageGetRollout",
                "summary": "Read one rollout record",
                "parameters": [rollout_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Requested rollout record.",
                        "#/components/schemas/ManageRolloutRecord"
                    ),
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "404": internal_error_json_response("The requested rollout was not found."),
                    "503": internal_error_json_response("The rollout record could not be loaded.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}/targets": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageListRolloutTargets",
                "summary": "List rollout target preview records",
                "parameters": [rollout_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Current rollout target preview records.",
                        "#/components/schemas/ManageRolloutTargetListResult"
                    ),
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "404": internal_error_json_response("The requested rollout was not found."),
                    "503": internal_error_json_response("The rollout target list could not be loaded.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageGetRolloutTarget",
                "summary": "Read one rollout target preview record",
                "parameters": [rollout_id_parameter(), node_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Requested rollout target preview record.",
                        "#/components/schemas/ManageRolloutTargetPreviewRecord"
                    ),
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "404": internal_error_json_response("The requested rollout target was not found."),
                    "503": internal_error_json_response("The rollout target record could not be loaded.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}/waves": {
            "get": {
                "tags": ["manage"],
                "operationId": "manageListRolloutWaves",
                "summary": "List rollout wave summary records",
                "parameters": [rollout_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Current rollout wave summary records.",
                        "#/components/schemas/ManageRolloutWaveListResult"
                    ),
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "404": internal_error_json_response("The requested rollout was not found."),
                    "503": internal_error_json_response("The rollout wave list could not be loaded.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}:preview": {
            "post": {
                "tags": ["manage"],
                "operationId": "managePreviewRollout",
                "summary": "Preview a rollout",
                "parameters": [rollout_id_parameter()],
                "requestBody": json_request_body(
                    "#/components/schemas/PreviewRolloutRouteBody",
                    false,
                    "Optional rollout preview request body."
                ),
                "responses": {
                    "200": json_response(
                        "Rollout preview result.",
                        "#/components/schemas/ManageRolloutPreview"
                    ),
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "400": internal_error_json_response("The rollout preview request body was invalid."),
                    "404": internal_error_json_response("The requested rollout was not found."),
                    "409": internal_error_json_response("The rollout preview could not proceed in the current state."),
                    "503": internal_error_json_response("The rollout preview could not be processed.")
                }
            }
        },
        "/claw/manage/v1/rollouts/{rolloutId}:start": {
            "post": {
                "tags": ["manage"],
                "operationId": "manageStartRollout",
                "summary": "Start a rollout after preview",
                "parameters": [rollout_id_parameter()],
                "responses": {
                    "200": json_response(
                        "Started rollout record.",
                        "#/components/schemas/ManageRolloutRecord"
                    ),
                    "401": internal_error_json_response("Authentication is required for the manage control-plane surface."),
                    "404": internal_error_json_response("The requested rollout was not found."),
                    "409": internal_error_json_response("The rollout could not be started in the current state."),
                    "503": internal_error_json_response("The rollout start operation could not be processed.")
                }
            }
        }
    });

    if !state.supports_manage_service_api() {
        if let Some(path_object) = paths.as_object_mut() {
            path_object.remove("/claw/manage/v1/service");
            path_object.remove("/claw/manage/v1/service:install");
            path_object.remove("/claw/manage/v1/service:start");
            path_object.remove("/claw/manage/v1/service:stop");
            path_object.remove("/claw/manage/v1/service:restart");
        }
    }

    paths
}

fn build_schemas() -> Value {
    json!({
        "SdkWorkApiResponse": {
            "type": "object",
            "description": "Canonical SDKWork success envelope (API_SPEC.md §15.1.1).",
            "properties": {
                "code": {"type": "integer", "description": "0 for success, non-zero for errors.", "example": 0},
                "data": {"description": "The response payload. Structure depends on the endpoint."},
                "traceId": {"type": "string", "description": "Server-side trace ID for request correlation."}
            },
            "required": ["code", "data", "traceId"]
        },
        "SdkWorkProblemDetail": {
            "type": "object",
            "description": "RFC 9457 application/problem+json error body (API_SPEC.md §15.2).",
            "properties": {
                "type": {"type": "string", "description": "URI reference for the problem type."},
                "title": {"type": "string", "description": "Short human-readable summary."},
                "status": {"type": "integer", "minimum": 100, "maximum": 599, "description": "HTTP status code."},
                "detail": {"type": ["string", "null"], "description": "Human-readable explanation specific to this occurrence."},
                "instance": {"type": ["string", "null"], "description": "URI reference identifying the problem occurrence."},
                "code": {"type": "integer", "description": "Platform result code (API_SPEC.md §15.3)."},
                "traceId": {"type": "string", "description": "Server-side trace ID for request correlation."},
                "operationId": {"type": ["string", "null"], "description": "OpenAPI operationId if available."}
            },
            "required": ["type", "title", "status", "code", "traceId"]
        },
        "PublicApiDiscoveryRecord": {
            "type": "object",
            "properties": {
                "family": {"type": "string"},
                "version": {"type": "string"},
                "basePath": {"type": "string"},
                "hostMode": {"type": "string"},
                "hostVersion": {"type": "string"},
                "openapiDocumentUrl": {"type": "string"},
                "healthLiveUrl": {"type": "string"},
                "healthReadyUrl": {"type": "string"},
                "capabilityKeys": string_array_schema(),
                "generatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "StudioInstanceRecord": {
            "type": "object",
            "description": "Studio instance projection surfaced by the canonical host public API.",
            "properties": {
                "id": {"type": "string"},
                "name": {"type": "string"},
                "description": {"type": ["string", "null"]},
                "status": {"type": "string"},
                "isBuiltIn": {"type": "boolean"},
                "isDefault": {"type": "boolean"},
                "baseUrl": {"type": ["string", "null"]},
                "websocketUrl": {"type": ["string", "null"]}
            },
            "additionalProperties": true
        },
        "StudioInstanceNullableRecord": {
            "oneOf": [
                schema_ref("#/components/schemas/StudioInstanceRecord"),
                {"type": "null"}
            ]
        },
        "StudioCreateInstanceInput": {
            "type": "object",
            "required": ["name", "runtimeKind", "deploymentMode", "transportKind"],
            "properties": {
                "name": {"type": "string"},
                "description": {"type": ["string", "null"]},
                "runtimeKind": {"type": "string"},
                "deploymentMode": {"type": "string"},
                "transportKind": {"type": "string"},
                "iconType": {"type": ["string", "null"]},
                "version": {"type": ["string", "null"]},
                "typeLabel": {"type": ["string", "null"]},
                "host": {"type": ["string", "null"]},
                "port": {"type": ["integer", "null"], "minimum": 0},
                "baseUrl": {"type": ["string", "null"]},
                "websocketUrl": {"type": ["string", "null"]},
                "storage": {"type": ["object", "null"], "additionalProperties": true},
                "config": {"type": ["object", "null"], "additionalProperties": true}
            }
        },
        "StudioUpdateInstanceInput": {
            "type": "object",
            "properties": {
                "name": {"type": ["string", "null"]},
                "description": {"type": ["string", "null"]},
                "iconType": {"type": ["string", "null"]},
                "version": {"type": ["string", "null"]},
                "typeLabel": {"type": ["string", "null"]},
                "host": {"type": ["string", "null"]},
                "port": {"type": ["integer", "null"], "minimum": 0},
                "baseUrl": {"type": ["string", "null"]},
                "websocketUrl": {"type": ["string", "null"]},
                "status": {"type": ["string", "null"]},
                "isDefault": {"type": ["boolean", "null"]},
                "config": {"type": ["object", "null"], "additionalProperties": true}
            }
        },
        "StudioInstanceDeleteResult": {
            "type": "boolean",
            "description": "Whether the requested canonical studio instance was deleted."
        },
        "StudioInstanceDetailRecord": {
            "type": "object",
            "properties": {
                "instance": schema_ref("#/components/schemas/StudioInstanceRecord"),
                "config": {"type": "object", "additionalProperties": true},
                "logs": {"type": "string"},
                "health": {"type": "object", "additionalProperties": true},
                "lifecycle": {"type": "object", "additionalProperties": true},
                "storage": {"type": "object", "additionalProperties": true},
                "connectivity": {"type": "object", "additionalProperties": true},
                "observability": {"type": "object", "additionalProperties": true},
                "dataAccess": {"type": "object", "additionalProperties": true},
                "artifacts": {
                    "type": "array",
                    "items": {"type": "object", "additionalProperties": true}
                },
                "capabilities": {
                    "type": "array",
                    "items": {"type": "object", "additionalProperties": true}
                },
                "officialRuntimeNotes": {
                    "type": "array",
                    "items": {"type": "object", "additionalProperties": true}
                },
                "consoleAccess": {"type": ["object", "null"], "additionalProperties": true},
                "workbench": {"type": ["object", "null"], "additionalProperties": true}
            },
            "additionalProperties": true
        },
        "StudioInstanceDetailNullableRecord": {
            "oneOf": [
                schema_ref("#/components/schemas/StudioInstanceDetailRecord"),
                {"type": "null"}
            ]
        },
        "StudioInstanceConfigRecord": {
            "type": "object",
            "properties": {
                "port": {"type": "string"},
                "sandbox": {"type": "boolean"},
                "autoUpdate": {"type": "boolean"},
                "logLevel": {"type": "string"},
                "corsOrigins": {"type": "string"},
                "workspacePath": {"type": ["string", "null"]},
                "baseUrl": {"type": ["string", "null"]},
                "websocketUrl": {"type": ["string", "null"]},
                "authToken": {"type": ["string", "null"]}
            },
            "additionalProperties": true
        },
        "StudioInstanceConfigNullableRecord": {
            "oneOf": [
                schema_ref("#/components/schemas/StudioInstanceConfigRecord"),
                {"type": "null"}
            ]
        },
        "StudioInstanceLogsRecord": {
            "type": "string",
            "description": "Studio instance logs projection surfaced by the canonical host public API."
        },
        "StudioNullResult": {
            "type": "null",
            "description": "The canonical studio public API completed the requested mutation without a response payload."
        },
        "StudioWorkbenchMutationResult": {
            "type": "boolean",
            "description": "Whether the requested managed studio workbench mutation changed persisted state."
        },
        "StudioOpenClawGatewayInvokePayload": {
            "type": "object",
            "required": ["request"],
            "properties": {
                "request": schema_ref("#/components/schemas/StudioOpenClawGatewayInvokeRequest"),
                "options": schema_ref("#/components/schemas/StudioOpenClawGatewayInvokeOptions")
            }
        },
        "StudioOpenClawGatewayInvokeRequest": {
            "type": "object",
            "required": ["tool"],
            "properties": {
                "tool": {"type": "string"},
                "action": {"type": ["string", "null"]},
                "args": {"type": ["object", "null"], "additionalProperties": true},
                "sessionKey": {"type": ["string", "null"]},
                "dryRun": {"type": ["boolean", "null"]}
            }
        },
        "StudioOpenClawGatewayInvokeOptions": {
            "type": "object",
            "properties": {
                "messageChannel": {"type": ["string", "null"]},
                "accountId": {"type": ["string", "null"]},
                "headers": {
                    "type": "object",
                    "additionalProperties": {"type": "string"}
                }
            }
        },
        "StudioOpenClawGatewayInvokeResult": {
            "type": "object",
            "additionalProperties": true,
            "description": "OpenClaw gateway invocation result payload."
        },
        "StudioCreateKernelChatSessionInput": {
            "type": "object",
            "required": ["instanceId"],
            "properties": {
                "instanceId": {"type": "string"},
                "model": {"type": ["string", "null"]},
                "agentId": {"type": ["string", "null"]},
                "title": {"type": ["string", "null"]}
            }
        },
        "StudioPatchKernelChatSessionInput": {
            "type": "object",
            "required": ["instanceId", "sessionId"],
            "properties": {
                "instanceId": {"type": "string"},
                "sessionId": {"type": "string"},
                "title": {"type": ["string", "null"]},
                "model": {"type": ["string", "null"]},
                "thinkingLevel": {"type": ["string", "null"]},
                "fastMode": {"type": ["boolean", "null"]},
                "verboseLevel": {"type": ["string", "null"]},
                "reasoningLevel": {"type": ["string", "null"]}
            }
        },
        "StudioStartKernelChatRunInput": {
            "type": "object",
            "required": ["instanceId", "sessionId", "content"],
            "properties": {
                "instanceId": {"type": "string"},
                "sessionId": {"type": "string"},
                "content": {"type": "string"},
                "model": {"type": ["string", "null"]}
            }
        },
        "StudioAbortKernelChatRunInput": {
            "type": "object",
            "properties": {
                "runId": {"type": ["string", "null"]}
            }
        },
        "KernelChatAgentProfile": {
            "type": "object",
            "properties": {
                "kernelId": {"type": "string"},
                "instanceId": {"type": "string"},
                "agentId": {"type": "string"},
                "label": {"type": "string"},
                "description": {"type": ["string", "null"]},
                "source": {"type": "string"},
                "systemPrompt": {"type": ["string", "null"]},
                "avatar": {"type": ["string", "null"]},
                "creator": {"type": ["string", "null"]}
            },
            "additionalProperties": true
        },
        "KernelChatSessionRef": {
            "type": "object",
            "properties": {
                "kernelId": {"type": "string"},
                "instanceId": {"type": "string"},
                "sessionId": {"type": "string"},
                "nativeSessionId": {"type": ["string", "null"]},
                "routingKey": {"type": ["string", "null"]},
                "agentId": {"type": ["string", "null"]},
                "lineageParentSessionId": {"type": ["string", "null"]}
            }
        },
        "KernelChatAuthority": {
            "type": "object",
            "properties": {
                "kind": {"type": "string"},
                "source": {"type": "string"},
                "durable": {"type": "boolean"},
                "writable": {"type": "boolean"}
            }
        },
        "KernelChatSession": {
            "type": "object",
            "properties": {
                "ref": schema_ref("#/components/schemas/KernelChatSessionRef"),
                "authority": schema_ref("#/components/schemas/KernelChatAuthority"),
                "lifecycle": {"type": "string"},
                "title": {"type": "string"},
                "createdAt": {"type": "integer", "format": "uint64", "minimum": 0},
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                "messageCount": {"type": "integer", "format": "uint64", "minimum": 0},
                "lastMessagePreview": {"type": ["string", "null"]},
                "sessionKind": {"type": ["string", "null"]},
                "actorBinding": {"type": ["object", "null"], "additionalProperties": true},
                "modelBinding": {"type": ["object", "null"], "additionalProperties": true},
                "capabilities": string_array_schema(),
                "activeRunId": {"type": ["string", "null"]},
                "nativeMetadata": {"type": ["object", "null"], "additionalProperties": true}
            },
            "additionalProperties": true
        },
        "KernelChatSessionNullableRecord": {
            "oneOf": [
                schema_ref("#/components/schemas/KernelChatSession"),
                {"type": "null"}
            ]
        },
        "KernelChatRun": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "sessionRef": schema_ref("#/components/schemas/KernelChatSessionRef"),
                "status": {"type": "string"},
                "createdAt": {"type": "integer", "format": "uint64", "minimum": 0},
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                "abortable": {"type": "boolean"},
                "nativeMetadata": {"type": ["object", "null"], "additionalProperties": true}
            },
            "additionalProperties": true
        },
        "KernelChatRunNullableRecord": {
            "oneOf": [
                schema_ref("#/components/schemas/KernelChatRun"),
                {"type": "null"}
            ]
        },
        "KernelChatMessage": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "sessionRef": schema_ref("#/components/schemas/KernelChatSessionRef"),
                "role": {"type": "string"},
                "status": {"type": "string"},
                "createdAt": {"type": "integer", "format": "uint64", "minimum": 0},
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                "text": {"type": "string"},
                "parts": {
                    "type": "array",
                    "items": {"type": "object", "additionalProperties": true}
                },
                "runId": {"type": ["string", "null"]},
                "model": {"type": ["string", "null"]},
                "senderLabel": {"type": ["string", "null"]},
                "nativeMetadata": {"type": ["object", "null"], "additionalProperties": true}
            },
            "additionalProperties": true
        },
        "StudioTaskMutationInput": {
            "type": "object",
            "properties": {
                "id": {"type": ["string", "null"]},
                "name": {"type": ["string", "null"]},
                "enabled": {"type": ["boolean", "null"]},
                "description": {"type": ["string", "null"]},
                "schedule": {"type": ["object", "null"], "additionalProperties": true},
                "payload": {"type": ["object", "null"], "additionalProperties": true},
                "delivery": {"type": ["object", "null"], "additionalProperties": true}
            },
            "additionalProperties": true
        },
        "StudioTaskCloneInput": {
            "type": "object",
            "properties": {
                "name": {"type": ["string", "null"]}
            }
        },
        "StudioTaskStatusInput": {
            "type": "object",
            "required": ["status"],
            "properties": {
                "status": {"type": "string", "enum": ["active", "paused"]}
            }
        },
        "StudioWorkbenchTaskExecutionRecord": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "taskId": {"type": "string"},
                "status": {"type": "string"},
                "trigger": {"type": "string"},
                "startedAt": {"type": "string"},
                "finishedAt": {"type": ["string", "null"]},
                "summary": {"type": "string"},
                "details": {"type": ["string", "null"]}
            },
            "additionalProperties": true
        },
        "StudioFileContentUpdateInput": {
            "type": "object",
            "required": ["content"],
            "properties": {
                "content": {"type": "string"}
            }
        },
        "StudioUpdateInstanceLlmProviderConfigInput": {
            "type": "object",
            "required": ["endpoint", "apiKeySource", "defaultModelId", "config"],
            "properties": {
                "endpoint": {"type": "string"},
                "apiKeySource": {"type": "string"},
                "defaultModelId": {"type": "string"},
                "reasoningModelId": {"type": ["string", "null"]},
                "embeddingModelId": {"type": ["string", "null"]},
                "config": {"type": "object", "additionalProperties": true}
            },
            "additionalProperties": true
        },
        "StudioConversationAttachmentRecord": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "kind": {"type": "string"},
                "name": {"type": "string"},
                "url": {"type": ["string", "null"]}
            },
            "additionalProperties": true
        },
        "StudioConversationMessageRecord": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "conversationId": {"type": "string"},
                "role": {"type": "string"},
                "content": {"type": "string"},
                "createdAt": {"type": "integer", "format": "uint64", "minimum": 0},
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                "model": {"type": ["string", "null"]},
                "senderInstanceId": {"type": ["string", "null"]},
                "status": {"type": "string"},
                "attachments": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/StudioConversationAttachmentRecord")
                }
            }
        },
        "StudioConversationRecord": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "title": {"type": "string"},
                "primaryInstanceId": {"type": "string"},
                "participantInstanceIds": string_array_schema(),
                "createdAt": {"type": "integer", "format": "uint64", "minimum": 0},
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                "messageCount": {"type": "integer", "format": "uint64", "minimum": 0},
                "lastMessagePreview": {"type": ["string", "null"]},
                "messages": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/StudioConversationMessageRecord")
                }
            }
        },
        "StudioConversationDeleteResult": {
            "type": "boolean",
            "description": "Whether the requested canonical studio conversation was deleted."
        },
        "HostPlatformStatusRecord": {
            "type": "object",
            "properties": {
                "mode": {"type": "string"},
                "lifecycle": {"type": "string"},
                "distributionFamily": {"type": "string", "enum": ["web", "desktop", "server"]},
                "deploymentFamily": {"type": "string", "enum": ["bareMetal", "container", "kubernetes"]},
                "acceleratorProfile": {"type": ["string", "null"], "enum": ["cpu", "nvidia-cuda", "amd-rocm", null]},
                "hostId": {"type": "string"},
                "displayName": {"type": "string"},
                "version": {"type": "string"},
                "desiredStateProjectionVersion": {"type": "string"},
                "rolloutEngineVersion": {"type": "string"},
                "manageBasePath": {"type": "string"},
                "internalBasePath": {"type": "string"},
                "stateStoreDriver": {"type": "string", "enum": ["json-file", "sqlite"]},
                "stateStore": {"$ref": "#/components/schemas/HostPlatformStateStoreRecord"},
                "capabilityKeys": string_array_schema(),
                "supportedCapabilityKeys": string_array_schema(),
                "availableCapabilityKeys": string_array_schema(),
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "HostPlatformStateStoreRecord": {
            "type": "object",
            "properties": {
                "activeProfileId": {"type": "string"},
                "providers": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/HostPlatformStateStoreProviderRecord")
                },
                "profiles": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/HostPlatformStateStoreProfileRecord")
                }
            }
        },
        "HostPlatformStateStoreProviderRecord": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "label": {"type": "string"},
                "availability": {"type": "string"},
                "requiresConfiguration": {"type": "boolean"},
                "configurationKeys": string_array_schema(),
                "projectionMode": {
                    "type": "string",
                    "enum": ["runtime", "metadataOnly"]
                }
            }
        },
        "HostPlatformStateStoreProfileRecord": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "label": {"type": "string"},
                "driver": {"type": "string"},
                "active": {"type": "boolean"},
                "availability": {"type": "string"},
                "path": {"type": ["string", "null"]},
                "connectionConfigured": {"type": "boolean"},
                "configuredKeys": string_array_schema(),
                "projectionMode": {
                    "type": "string",
                    "enum": ["runtime", "metadataOnly"]
                }
            }
        },
        "NodeSessionRecord": {
            "type": "object",
            "properties": {
                "sessionId": {"type": "string"},
                "nodeId": {"type": "string"},
                "state": {
                    "type": "string",
                    "enum": ["pending", "admitted", "degraded", "blocked", "replaced", "closed"]
                },
                "compatibilityState": {
                    "type": "string",
                    "enum": ["compatible", "degraded", "blocked"]
                },
                "successorSessionId": {"type": "string"},
                "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "desiredStateHash": {"type": "string"},
                "lastAppliedRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "lastAppliedHash": {"type": "string"},
                "lastKnownGoodRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "lastKnownGoodHash": {"type": "string"},
                "lastApplyResult": {
                    "type": "string",
                    "enum": ["accepted", "applied", "appliedDegraded", "rejected", "superseded"]
                },
                "lastSeenAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "NodeSessionHelloInput": {
            "type": "object",
            "properties": {
                "bootId": {"type": "string"},
                "nodeClaim": {
                    "type": "object",
                    "properties": {
                        "claimedNodeId": {"type": "string"},
                        "hostPlatform": {"type": "string"},
                        "hostArch": {"type": "string"}
                    }
                },
                "versionManifest": {
                    "type": "object",
                    "properties": {
                        "internalApiVersion": {"type": "string"},
                        "configProjectionVersion": {"type": "string"}
                    }
                },
                "capabilities": string_array_schema()
            }
        },
        "NodeSessionHelloResponse": {
            "type": "object",
            "properties": {
                "sessionId": {"type": "string"},
                "helloToken": {"type": "string"},
                "leaseProposal": {
                    "type": "object",
                    "properties": {
                        "leaseId": {"type": "string"},
                        "issuedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                        "expiresAt": {"type": "integer", "format": "uint64", "minimum": 0}
                    }
                },
                "admissionMode": {
                    "type": "string",
                    "enum": ["bootstrapRequired", "blocked"]
                },
                "compatibilityPreview": {
                    "type": "object",
                    "properties": {
                        "compatibilityState": {
                            "type": "string",
                            "enum": ["compatible", "degraded", "blocked"]
                        },
                        "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "desiredStateHash": {"type": "string"},
                        "reason": {"type": "string"}
                    }
                },
                "nextAction": {
                    "type": "string",
                    "enum": ["callAdmit", "stopAndWait"]
                }
            }
        },
        "NodeSessionAdmitInput": {
            "type": "object",
            "properties": {
                "helloToken": {"type": "string"}
            }
        },
        "NodeSessionAdmitResponse": {
            "type": "object",
            "properties": {
                "sessionId": {"type": "string"},
                "lease": {
                    "type": "object",
                    "properties": {
                        "leaseId": {"type": "string"},
                        "issuedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                        "expiresAt": {"type": "integer", "format": "uint64", "minimum": 0}
                    }
                },
                "compatibilityResult": {
                    "type": "object",
                    "properties": {
                        "compatibilityState": {
                            "type": "string",
                            "enum": ["compatible", "degraded", "blocked"]
                        },
                        "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "desiredStateHash": {"type": "string"},
                        "reason": {"type": "string"}
                    }
                },
                "effectiveCapabilities": string_array_schema(),
                "heartbeatPolicy": {
                    "type": "object",
                    "properties": {
                        "intervalSeconds": {"type": "integer", "minimum": 0},
                        "missTolerance": {"type": "integer", "minimum": 0},
                        "fullReportInterval": {"type": "integer", "minimum": 0}
                    }
                },
                "desiredStateCursor": {
                    "type": "object",
                    "properties": {
                        "currentRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "currentHash": {"type": "string"},
                        "requiredConfigProjectionVersion": {"type": "string"}
                    }
                }
            }
        },
        "NodeSessionHeartbeatInput": {
            "type": "object",
            "properties": {
                "leaseId": {"type": "string"},
                "lastSeenRevision": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "NodeSessionHeartbeatResponse": {
            "type": "object",
            "properties": {
                "lease": {
                    "type": "object",
                    "properties": {
                        "leaseId": {"type": "string"},
                        "issuedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                        "expiresAt": {"type": "integer", "format": "uint64", "minimum": 0}
                    }
                },
                "compatibilityResult": {
                    "type": "object",
                    "properties": {
                        "compatibilityState": {
                            "type": "string",
                            "enum": ["compatible", "degraded", "blocked"]
                        },
                        "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "desiredStateHash": {"type": "string"},
                        "reason": {"type": "string"}
                    }
                },
                "managementPosture": {
                    "type": "object",
                    "properties": {
                        "compatibilityState": {
                            "type": "string",
                            "enum": ["compatible", "degraded", "blocked"]
                        },
                        "allowedOperations": string_array_schema()
                    }
                },
                "desiredStateHint": {
                    "type": "object",
                    "properties": {
                        "hasUpdate": {"type": "boolean"},
                        "targetRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "targetHash": {"type": "string"},
                        "mandatory": {"type": "boolean"}
                    }
                }
            }
        },
        "NodeSessionPullDesiredStateInput": {
            "type": "object",
            "properties": {
                "leaseId": {"type": "string"},
                "knownRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "knownHash": {"type": "string"},
                "supportedConfigProjectionVersions": string_array_schema(),
                "effectiveCapabilities": string_array_schema()
            }
        },
        "NodeSessionPullDesiredStateResponse": {
            "oneOf": [
                {
                    "type": "object",
                    "properties": {
                        "mode": {"type": "string", "const": "notModified"},
                        "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "desiredStateHash": {"type": "string"},
                        "configProjectionVersion": {"type": "string"}
                    }
                },
                {
                    "type": "object",
                    "properties": {
                        "mode": {"type": "string", "const": "projection"},
                        "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "desiredStateHash": {"type": "string"},
                        "configProjectionVersion": {"type": "string"},
                        "requiredCapabilities": string_array_schema(),
                        "projection": {
                            "type": "object",
                            "properties": {
                                "nodeId": {"type": "string"},
                                "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                                "desiredStateHash": {"type": "string"},
                                "configProjectionVersion": {"type": "string"},
                                "semanticPayload": {"type": "string"}
                            }
                        },
                        "applyPolicy": {
                            "type": "object",
                            "properties": {
                                "mandatory": {"type": "boolean"}
                            }
                        }
                    }
                }
            ]
        },
        "NodeSessionAckDesiredStateInput": {
            "type": "object",
            "properties": {
                "leaseId": {"type": "string"},
                "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "desiredStateHash": {"type": "string"},
                "result": {
                    "type": "string",
                    "enum": ["accepted", "applied", "appliedDegraded", "rejected", "superseded"]
                },
                "effectiveCapabilities": string_array_schema(),
                "observedEndpoints": string_array_schema(),
                "applySummary": {
                    "type": "object",
                    "properties": {
                        "appliedAt": {"type": "integer", "format": "uint64", "minimum": 0},
                        "lastKnownGoodRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "compatibilityReasons": string_array_schema(),
                        "errors": string_array_schema(),
                        "warnings": string_array_schema()
                    }
                }
            }
        },
        "NodeSessionAckDesiredStateResponse": {
            "type": "object",
            "properties": {
                "recorded": {"type": "boolean"},
                "nextExpectedRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "managementPosture": {
                    "type": "object",
                    "properties": {
                        "compatibilityState": {
                            "type": "string",
                            "enum": ["compatible", "degraded", "blocked"]
                        },
                        "allowedOperations": string_array_schema()
                    }
                }
            }
        },
        "NodeSessionCloseInput": {
            "type": "object",
            "properties": {
                "leaseId": {"type": "string"},
                "reason": {"type": "string"},
                "successorHint": {"type": "string"}
            }
        },
        "NodeSessionCloseResponse": {
            "type": "object",
            "properties": {
                "closed": {"type": "boolean"},
                "replacementExpected": {"type": "boolean"}
            }
        },
        "ManageHostEndpointRecord": {
            "type": "object",
            "properties": {
                "endpointId": {"type": "string"},
                "bindHost": {"type": "string"},
                "requestedPort": {"type": "integer", "minimum": 0},
                "activePort": {"type": ["integer", "null"], "minimum": 0},
                "scheme": {"type": "string"},
                "baseUrl": {"type": ["string", "null"]},
                "websocketUrl": {"type": ["string", "null"]},
                "loopbackOnly": {"type": "boolean"},
                "dynamicPort": {"type": "boolean"},
                "lastConflictAt": {"type": ["integer", "null"], "format": "uint64", "minimum": 0},
                "lastConflictReason": {"type": ["string", "null"]}
            }
        },
        "ManageOpenClawRuntimeRecord": {
            "type": "object",
            "properties": {
                "runtimeKind": {"type": "string"},
                "lifecycle": {"type": "string"},
                "endpointId": {"type": ["string", "null"]},
                "requestedPort": {"type": ["integer", "null"], "minimum": 0},
                "activePort": {"type": ["integer", "null"], "minimum": 0},
                "baseUrl": {"type": ["string", "null"]},
                "websocketUrl": {"type": ["string", "null"]},
                "managedBy": {"type": "string"},
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "ManageOpenClawGatewayRecord": {
            "type": "object",
            "properties": {
                "gatewayKind": {"type": "string"},
                "lifecycle": {"type": "string"},
                "endpointId": {"type": ["string", "null"]},
                "requestedPort": {"type": ["integer", "null"], "minimum": 0},
                "activePort": {"type": ["integer", "null"], "minimum": 0},
                "baseUrl": {"type": ["string", "null"]},
                "websocketUrl": {"type": ["string", "null"]},
                "managedBy": {"type": "string"},
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "ManageOpenClawGatewayInvokeRequest": {
            "type": "object",
            "required": ["tool"],
            "properties": {
                "tool": {"type": "string"},
                "action": {"type": ["string", "null"]},
                "args": {"type": ["object", "null"], "additionalProperties": true},
                "sessionKey": {"type": ["string", "null"]},
                "dryRun": {"type": ["boolean", "null"]},
                "messageChannel": {"type": ["string", "null"]},
                "accountId": {"type": ["string", "null"]},
                "headers": {
                    "type": ["object", "null"],
                    "additionalProperties": {"type": "string"}
                }
            }
        },
        "ManageOpenClawGatewayInvokeResult": {
            "type": "object",
            "properties": {
                "accepted": {"type": "boolean"},
                "tool": {"type": "string"},
                "action": {"type": ["string", "null"]},
                "dryRun": {"type": "boolean"},
                "lifecycle": {"type": "string"},
                "message": {"type": "string"},
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "ManageServiceShellCommand": {
            "type": "object",
            "properties": {
                "program": {"type": "string"},
                "args": string_array_schema()
            }
        },
        "ManageServiceCommandResult": {
            "type": "object",
            "properties": {
                "program": {"type": "string"},
                "args": string_array_schema(),
                "exitCode": {"type": ["integer", "null"]},
                "stdout": {"type": "string"},
                "stderr": {"type": "string"},
                "success": {"type": "boolean"}
            }
        },
        "ManageServiceExecutionResult": {
            "type": "object",
            "properties": {
                "action": {"type": "string"},
                "platform": {"type": "string"},
                "serviceManager": {"type": "string"},
                "serviceName": {"type": "string"},
                "serviceConfigPath": {"type": "string"},
                "executablePath": {"type": "string"},
                "configFile": {"type": "string"},
                "commands": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/ManageServiceShellCommand")
                },
                "runtimeConfig": schema_ref("#/components/schemas/ManageServiceRuntimeConfig"),
                "artifactWritten": {"type": "boolean"},
                "writtenFiles": string_array_schema(),
                "success": {"type": "boolean"},
                "state": {"type": "string"},
                "commandResults": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/ManageServiceCommandResult")
                }
            }
        },
        "ManageServiceRuntimeConfig": {
            "type": "object",
            "properties": {
                "host": {"type": "string"},
                "port": {"type": "integer", "minimum": 0},
                "dataDir": {"type": "string"},
                "webDistDir": {"type": "string"},
                "stateStore": schema_ref("#/components/schemas/ManageServiceStateStoreConfig"),
                "auth": schema_ref("#/components/schemas/ManageServiceAuthConfig")
            }
        },
        "ManageServiceStateStoreConfig": {
            "type": "object",
            "properties": {
                "driver": {"type": "string"},
                "sqlitePath": {"type": ["string", "null"]},
                "postgresUrl": {"type": ["string", "null"]},
                "postgresSchema": {"type": ["string", "null"]}
            }
        },
        "ManageServiceAuthConfig": {
            "type": "object",
            "properties": {
                "manageUsername": {"type": ["string", "null"]},
                "managePassword": {"type": ["string", "null"]},
                "internalUsername": {"type": ["string", "null"]},
                "internalPassword": {"type": ["string", "null"]}
            }
        },
        "ManageRolloutRecord": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "phase": {
                    "type": "string",
                    "enum": [
                        "draft",
                        "previewing",
                        "awaitingApproval",
                        "ready",
                        "promoting",
                        "paused",
                        "completed",
                        "failed",
                        "cancelled"
                    ]
                },
                "attempt": {"type": "integer", "format": "uint64", "minimum": 0},
                "targetCount": {"type": "integer", "minimum": 0},
                "updatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        },
        "ManageRolloutListResult": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/ManageRolloutRecord")
                },
                "total": {"type": "integer", "minimum": 0}
            }
        },
        "ManageRolloutTargetPreviewRecord": {
            "type": "object",
            "properties": {
                "nodeId": {"type": "string"},
                "preflightOutcome": {
                    "type": "string",
                    "enum": [
                        "admissible",
                        "admissibleDegraded",
                        "blockedByVersion",
                        "blockedByCapability",
                        "blockedByTrust",
                        "blockedByPolicy"
                    ]
                },
                "blockedReason": {"type": "string"},
                "desiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                "desiredStateHash": {"type": "string"},
                "waveId": {"type": "string"}
            }
        },
        "ManageRolloutTargetListResult": {
            "type": "object",
            "properties": {
                "rolloutId": {"type": "string"},
                "attempt": {"type": "integer", "format": "uint64", "minimum": 0},
                "total": {"type": "integer", "minimum": 0},
                "items": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/ManageRolloutTargetPreviewRecord")
                }
            }
        },
        "ManageRolloutWaveRecord": {
            "type": "object",
            "properties": {
                "waveId": {"type": "string"},
                "index": {"type": "integer", "minimum": 1},
                "phase": {
                    "type": "string",
                    "enum": [
                        "pending",
                        "ready",
                        "promoting",
                        "verifying",
                        "completed",
                        "paused",
                        "failed",
                        "cancelled"
                    ]
                },
                "targetCount": {"type": "integer", "minimum": 0},
                "admissibleCount": {"type": "integer", "minimum": 0},
                "degradedCount": {"type": "integer", "minimum": 0},
                "blockedCount": {"type": "integer", "minimum": 0}
            }
        },
        "ManageRolloutWaveListResult": {
            "type": "object",
            "properties": {
                "rolloutId": {"type": "string"},
                "attempt": {"type": "integer", "format": "uint64", "minimum": 0},
                "total": {"type": "integer", "minimum": 0},
                "items": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/ManageRolloutWaveRecord")
                }
            }
        },
        "PreviewRolloutRouteBody": {
            "type": "object",
            "properties": {
                "rolloutId": {"type": "string"},
                "forceRecompute": {"type": "boolean"},
                "includeTargets": {"type": "boolean"}
            }
        },
        "ManageRolloutPreview": {
            "type": "object",
            "properties": {
                "rolloutId": {"type": "string"},
                "phase": {
                    "type": "string",
                    "enum": ["previewing", "awaitingApproval", "ready", "failed"]
                },
                "attempt": {"type": "integer", "format": "uint64", "minimum": 0},
                "summary": {
                    "type": "object",
                    "properties": {
                        "totalTargets": {"type": "integer", "minimum": 0},
                        "admissibleTargets": {"type": "integer", "minimum": 0},
                        "degradedTargets": {"type": "integer", "minimum": 0},
                        "blockedTargets": {"type": "integer", "minimum": 0},
                        "predictedWaveCount": {"type": "integer", "minimum": 0}
                    }
                },
                "targets": {
                    "type": "array",
                    "items": schema_ref("#/components/schemas/ManageRolloutTargetPreviewRecord")
                },
                "candidateRevisionSummary": {
                    "type": "object",
                    "properties": {
                        "totalTargets": {"type": "integer", "minimum": 0},
                        "minDesiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0},
                        "maxDesiredStateRevision": {"type": "integer", "format": "uint64", "minimum": 0}
                    }
                },
                "generatedAt": {"type": "integer", "format": "uint64", "minimum": 0}
            }
        }
    })
}

fn json_response(description: &str, schema_ref_path: &str) -> Value {
    json!({
        "description": description,
        "content": {
            "application/json": {
                "schema": {
                    "allOf": [
                        {"$ref": "#/components/schemas/SdkWorkApiResponse"},
                        {
                            "type": "object",
                            "properties": {
                                "data": {"$ref": schema_ref_path}
                            }
                        }
                    ]
                }
            }
        }
    })
}

fn json_array_response(description: &str, schema_ref_path: &str) -> Value {
    json!({
        "description": description,
        "content": {
            "application/json": {
                "schema": {
                    "allOf": [
                        {"$ref": "#/components/schemas/SdkWorkApiResponse"},
                        {
                            "type": "object",
                            "properties": {
                                "data": {
                                    "type": "array",
                                    "items": {"$ref": schema_ref_path}
                                }
                            }
                        }
                    ]
                }
            }
        }
    })
}

fn json_request_body(schema_ref_path: &str, required: bool, description: &str) -> Value {
    json!({
        "required": required,
        "description": description,
        "content": {
            "application/json": {
                "schema": {
                    "$ref": schema_ref_path
                }
            }
        }
    })
}

fn internal_error_json_response(description: &str) -> Value {
    json!({
        "description": description,
        "content": {
            "application/problem+json": {
                "schema": {
                    "$ref": "#/components/schemas/SdkWorkProblemDetail"
                }
            }
        }
    })
}

fn session_id_parameter() -> Value {
    json!({
        "name": "sessionId",
        "in": "path",
        "required": true,
        "description": "Node session identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn rollout_id_parameter() -> Value {
    json!({
        "name": "rolloutId",
        "in": "path",
        "required": true,
        "description": "Rollout identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn node_id_parameter() -> Value {
    json!({
        "name": "nodeId",
        "in": "path",
        "required": true,
        "description": "Node identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn studio_instance_id_parameter() -> Value {
    json!({
        "name": "id",
        "in": "path",
        "required": true,
        "description": "Studio instance identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn studio_task_id_parameter() -> Value {
    json!({
        "name": "taskId",
        "in": "path",
        "required": true,
        "description": "Managed studio workbench task identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn studio_file_id_parameter() -> Value {
    json!({
        "name": "fileId",
        "in": "path",
        "required": true,
        "description": "Managed studio workbench file identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn studio_provider_id_parameter() -> Value {
    json!({
        "name": "providerId",
        "in": "path",
        "required": true,
        "description": "Managed studio workbench LLM provider identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn studio_session_id_parameter() -> Value {
    json!({
        "name": "sessionId",
        "in": "path",
        "required": true,
        "description": "Kernel chat session identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn studio_run_id_parameter() -> Value {
    json!({
        "name": "runId",
        "in": "path",
        "required": true,
        "schema": {
            "type": "string"
        },
        "description": "Canonical studio kernel chat run identifier."
    })
}

fn studio_conversation_id_parameter() -> Value {
    json!({
        "name": "conversationId",
        "in": "path",
        "required": true,
        "description": "Studio conversation identifier.",
        "schema": {
            "type": "string"
        }
    })
}

fn schema_ref(reference: &str) -> Value {
    json!({
        "$ref": reference
    })
}

fn string_array_schema() -> Value {
    json!({
        "type": "array",
        "items": {
            "type": "string"
        }
    })
}
