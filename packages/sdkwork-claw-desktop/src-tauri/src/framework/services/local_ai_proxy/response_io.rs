use super::{
    openai_compatible,
    types::{LocalAiProxyTokenUsage, ProxyHttpResult},
};
use axum::{
    body::Body,
    http::{header::CONTENT_TYPE, HeaderValue, StatusCode},
    response::Response,
};
pub(super) use sdkwork_local_api_proxy_native::response::extract_http_error_message as extract_proxy_error_message;
pub(super) use sdkwork_local_api_proxy_native::response::resolve_error_message;
use sdkwork_local_api_proxy_native::response::{
    format_json_response_body, normalize_response_text, resolve_response_preview,
};
use sdkwork_local_api_proxy_native::support::proxy_error;
use serde_json::Value;

pub(super) struct ProxyRouteOutcome {
    pub(super) response: Response,
    pub(super) status: StatusCode,
    pub(super) usage: LocalAiProxyTokenUsage,
    pub(super) error: Option<String>,
    pub(super) response_preview: Option<String>,
    pub(super) response_body: Option<String>,
}

pub(super) fn build_json_outcome(
    status: StatusCode,
    body: Value,
    usage: LocalAiProxyTokenUsage,
) -> ProxyHttpResult<ProxyRouteOutcome> {
    let response_preview = resolve_response_preview(Some(&body), "");
    let response_body = format_json_response_body(&body);
    Ok(ProxyRouteOutcome {
        response: build_json_response(status, body)?,
        status,
        usage,
        error: None,
        response_preview,
        response_body,
    })
}

pub(super) async fn build_buffered_upstream_response(
    response: reqwest::Response,
) -> ProxyHttpResult<ProxyRouteOutcome> {
    let status = response.status();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .cloned()
        .unwrap_or_else(|| HeaderValue::from_static("application/json"));
    let bytes = response.bytes().await.map_err(|error| {
        proxy_error(
            StatusCode::BAD_GATEWAY,
            &format!("Local AI proxy failed to read upstream response body: {error}"),
        )
    })?;
    let text = String::from_utf8_lossy(&bytes).trim().to_string();
    let json = serde_json::from_slice::<Value>(&bytes).ok();
    let usage = json
        .as_ref()
        .map(openai_compatible::extract_token_usage)
        .unwrap_or_default();
    let error = (!status.is_success()).then(|| resolve_error_message(json.as_ref(), &text, status));
    let response_preview = resolve_response_preview(json.as_ref(), &text);
    let response = Response::builder()
        .status(status)
        .header(CONTENT_TYPE, content_type)
        .body(Body::from(bytes))
        .map_err(|build_error| {
            proxy_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Local AI proxy failed to build buffered response: {build_error}"),
            )
        })?;

    Ok(ProxyRouteOutcome {
        response,
        status,
        usage,
        error,
        response_preview,
        response_body: normalize_response_text(&text),
    })
}

pub(super) async fn parse_json_response(response: reqwest::Response) -> ProxyHttpResult<Value> {
    response.json::<Value>().await.map_err(|error| {
        proxy_error(
            StatusCode::BAD_GATEWAY,
            &format!("Local AI proxy failed to decode upstream JSON response: {error}"),
        )
    })
}

fn build_json_response(status: StatusCode, body: Value) -> ProxyHttpResult<Response> {
    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
        .body(Body::from(body.to_string()))
        .map_err(|error| {
            proxy_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Local AI proxy failed to build JSON response: {error}"),
            )
        })
}
