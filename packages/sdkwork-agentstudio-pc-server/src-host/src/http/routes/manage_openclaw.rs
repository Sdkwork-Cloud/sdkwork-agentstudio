use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use sdkwork_agentstudio_host_core::openclaw_control_plane::OpenClawGatewayInvokeRequest;
use sdkwork_agentstudio_host_core::internal::error::{InternalErrorCategory, InternalErrorResolution};

use crate::{
    bootstrap::ServerState,
    http::{
        api_envelope::{api_list_success, api_success, next_trace_id},
        auth::authorize_manage_request,
        error_response::categorized_error_response,
    },
};
use sdkwork_utils_rust::http_api::{
    offset_list_page_data, validated_offset_list_params, OffsetListPageParams,
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
    axum::extract::RawQuery(raw_query): axum::extract::RawQuery,
) -> Result<Response, Response> {
    let trace_id = next_trace_id();
    authorize_manage_request(&headers, &state, &trace_id)?;
    let updated_at = state.host_platform_updated_at();
    let params = parse_offset_list_params(&raw_query, updated_at)?;
    state
        .manage_openclaw_provider
        .list_host_endpoints(updated_at)
        .map(|data| {
            let total = data.len() as i64;
            let page = offset_list_page_data(data, total, params);
            api_list_success(page.items, page.page_info, &trace_id)
        })
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

fn parse_offset_list_params(raw_query: &str, now_ms: u64) -> Result<OffsetListPageParams, Response> {
    let query_map: std::collections::HashMap<String, String> =
        serde_urlencoded::from_str(raw_query).unwrap_or_default();
    let page = query_map
        .get("page")
        .and_then(|value| value.parse::<i64>().ok());
    let page_size = query_map
        .get("page_size")
        .and_then(|value| value.parse::<i64>().ok());
    validated_offset_list_params(page, page_size).map_err(|code| {
        categorized_error_response(
            "invalid_pagination_params",
            InternalErrorCategory::Validation,
            &format!("Invalid pagination parameters: {}", code.symbol()),
            StatusCode::BAD_REQUEST,
            false,
            InternalErrorResolution::FixRequest,
            now_ms,
        )
    })
}
