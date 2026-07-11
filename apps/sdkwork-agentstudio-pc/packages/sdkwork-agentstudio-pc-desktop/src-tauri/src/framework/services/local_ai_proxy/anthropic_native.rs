use super::{
    observability, request_context,
    response_io::{build_buffered_upstream_response, ProxyRouteOutcome},
    streaming,
    types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult},
    ANTHROPIC_BETA_HEADER, ANTHROPIC_CLIENT_PROTOCOL, ANTHROPIC_VERSION_HEADER,
    DEFAULT_ANTHROPIC_VERSION, X_API_KEY_HEADER,
};
use axum::{
    body::Bytes,
    extract::State,
    http::{header::CONTENT_TYPE, HeaderMap, HeaderValue, StatusCode},
    response::Response,
};
use sdkwork_local_api_proxy_native::support::proxy_error;
use serde_json::Value;
use std::time::Instant;

pub(super) async fn messages_handler(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    let snapshot = request_context::current_snapshot(&state)?;
    request_context::require_client_auth(&headers, &snapshot.auth_token)?;
    let route = request_context::require_route_for_protocol(&snapshot, ANTHROPIC_CLIENT_PROTOCOL)?;
    let payload = request_context::parse_json_body(&body)?;
    let streaming = payload
        .get("stream")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let started_at = Instant::now();
    let audit_context = observability::build_request_audit_context(route, "/v1/messages", &body);
    let result = async {
        let mut request = state
            .client
            .post(format!(
                "{}/messages",
                route.upstream_base_url.trim_end_matches('/')
            ))
            .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
            .header(X_API_KEY_HEADER, route.api_key.trim())
            .header(
                ANTHROPIC_VERSION_HEADER,
                request_context::header_text(&headers, ANTHROPIC_VERSION_HEADER)
                    .unwrap_or_else(|| DEFAULT_ANTHROPIC_VERSION.to_string()),
            );
        if let Some(beta) = request_context::header_text(&headers, ANTHROPIC_BETA_HEADER) {
            request = request.header(ANTHROPIC_BETA_HEADER, beta);
        }

        let response = request.body(body.to_vec()).send().await.map_err(|error| {
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
