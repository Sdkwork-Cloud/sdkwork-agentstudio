use super::{
    observability, request_context,
    response_io::{build_buffered_upstream_response, ProxyRouteOutcome},
    streaming,
    types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult},
    LocalAiProxyRouteSnapshot, GEMINI_CLIENT_PROTOCOL, X_GOOG_API_KEY_HEADER,
};
use axum::{
    body::Bytes,
    extract::{OriginalUri, Path as AxumPath, State},
    http::{header::CONTENT_TYPE, HeaderMap, HeaderValue, StatusCode},
    response::Response,
    Json,
};
use sdkwork_local_api_proxy_native::support::proxy_error;
use sdkwork_local_api_proxy_native::upstream::build_gemini_upstream_request_url;
use serde_json::{json, Value};
use std::time::Instant;

pub(super) async fn models_handler_v1beta(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
) -> ProxyHttpResult<Json<Value>> {
    models_handler(state, headers, "v1beta").await
}

async fn models_handler(
    state: LocalAiProxyAppState,
    headers: HeaderMap,
    api_version: &str,
) -> ProxyHttpResult<Json<Value>> {
    let snapshot = request_context::current_snapshot(&state)?;
    request_context::require_client_auth(&headers, &snapshot.auth_token)?;
    let route = request_context::require_route_for_protocol(&snapshot, GEMINI_CLIENT_PROTOCOL)?;

    Ok(Json(json!({
        "models": route.models.iter().map(|model| {
            json!({
                "name": format!("models/{}", model.id),
                "displayName": model.name,
                "description": format!("Local AI proxy route \"{}\" on {}.", route.name, api_version),
                "supportedGenerationMethods": supported_generation_methods(route, &model.id),
            })
        }).collect::<Vec<_>>(),
    })))
}

pub(super) async fn model_action_handler_v1beta(
    State(state): State<LocalAiProxyAppState>,
    AxumPath(model_action): AxumPath<String>,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    model_action_handler(state, model_action, headers, original_uri, body, "v1beta").await
}

pub(super) async fn model_action_handler_v1(
    State(state): State<LocalAiProxyAppState>,
    AxumPath(model_action): AxumPath<String>,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    model_action_handler(state, model_action, headers, original_uri, body, "v1").await
}

async fn model_action_handler(
    state: LocalAiProxyAppState,
    model_action: String,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
    api_version: &str,
) -> ProxyHttpResult<Response> {
    let snapshot = request_context::current_snapshot(&state)?;
    request_context::require_client_auth(&headers, &snapshot.auth_token)?;
    let route = request_context::require_route_for_protocol(&snapshot, GEMINI_CLIENT_PROTOCOL)?;
    let (model_id, action) = parse_model_action(&model_action).ok_or_else(|| {
        proxy_error(
            StatusCode::BAD_REQUEST,
            "Invalid Gemini model action. Expected a path like models/{model}:generateContent.",
        )
    })?;
    if !matches!(
        action,
        "generateContent" | "streamGenerateContent" | "embedContent" | "batchEmbedContents"
    ) {
        return Err(proxy_error(
            StatusCode::NOT_IMPLEMENTED,
            &format!("Unsupported Gemini model action: {action}"),
        ));
    }
    if !route.models.iter().any(|model| model.id == model_id) {
        return Err(proxy_error(
            StatusCode::NOT_FOUND,
            &format!(
                "Gemini model \"{model_id}\" is not exposed by local AI proxy route \"{}\".",
                route.name
            ),
        ));
    }
    if !supported_generation_methods(route, model_id)
        .into_iter()
        .any(|supported_action| supported_action == action)
    {
        return Err(proxy_error(
            StatusCode::BAD_REQUEST,
            &format!(
                "Gemini model \"{model_id}\" on local AI proxy route \"{}\" does not support action \"{action}\".",
                route.name
            ),
        ));
    }

    let streaming = action == "streamGenerateContent";
    let started_at = Instant::now();
    let audit_context = observability::build_request_audit_context(
        route,
        &format!("/{api_version}/models/{model_action}"),
        &body,
    );
    let result = async {
        let response = state
            .client
            .post(build_gemini_upstream_request_url(
                route,
                api_version,
                &model_action,
                original_uri.0.query(),
            ))
            .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
            .header(X_GOOG_API_KEY_HEADER, route.api_key.trim())
            .body(body.to_vec())
            .send()
            .await
            .map_err(|error| {
                proxy_error(
                    StatusCode::BAD_GATEWAY,
                    &format!("Local AI proxy upstream request failed: {error}"),
                )
            })?;

        if streaming && response.status().is_success() {
            let status = response.status();
            let observability_repo = state.observability_repo.clone();
            let request_audit_context = audit_context.clone();
            let request_started_at = started_at;
            return Ok(ProxyRouteOutcome {
                response: streaming::build_passthrough_response(
                    response,
                    started_at,
                    move |ttft_ms, response_text| {
                        observability::record_completed_stream_request_log(
                            &observability_repo,
                            request_audit_context,
                            status,
                            request_started_at,
                            LocalAiProxyTokenUsage::default(),
                            ttft_ms,
                            response_text,
                        );
                    },
                )
                .await?,
                status,
                usage: LocalAiProxyTokenUsage::default(),
                error: None,
                response_preview: None,
                response_body: None,
            });
        }

        build_buffered_upstream_response(response).await
    }
    .await;

    observability::record_proxy_route_outcome(&state, route, started_at.elapsed(), &result);
    observability::record_proxy_request_log(&state, &audit_context, started_at.elapsed(), &result);
    result.map(|outcome| outcome.response)
}

fn parse_model_action(model_action: &str) -> Option<(&str, &str)> {
    let (model_id, action) = model_action.split_once(':')?;
    let model_id = model_id.trim();
    let action = action.trim();
    if model_id.is_empty() || action.is_empty() {
        return None;
    }

    Some((model_id, action))
}

fn supported_generation_methods(
    route: &LocalAiProxyRouteSnapshot,
    model_id: &str,
) -> Vec<&'static str> {
    let is_embedding = route.embedding_model_id.as_deref() == Some(model_id);
    let is_generation = route.default_model_id == model_id
        || route.reasoning_model_id.as_deref() == Some(model_id)
        || !is_embedding;

    let mut methods = Vec::new();
    if is_generation {
        methods.push("generateContent");
        methods.push("streamGenerateContent");
    }
    if is_embedding {
        methods.push("embedContent");
        methods.push("batchEmbedContents");
    }
    methods
}
