use super::{
    types::{LocalAiProxyAppState, ProxyHttpResult},
    LocalAiProxyRouteSnapshot, LocalAiProxySnapshot, X_API_KEY_HEADER, X_GOOG_API_KEY_HEADER,
};
use axum::{
    body::Bytes,
    http::{header::AUTHORIZATION, HeaderMap, StatusCode},
};
use sdkwork_local_api_proxy_native::support::proxy_error;
use serde_json::Value;

pub(super) fn current_snapshot(
    state: &LocalAiProxyAppState,
) -> ProxyHttpResult<LocalAiProxySnapshot> {
    state
        .snapshot
        .lock()
        .map(|snapshot| snapshot.clone())
        .map_err(|_| {
            proxy_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Local AI proxy snapshot lock is unavailable.",
            )
        })
}

pub(super) fn require_route_for_protocol<'a>(
    snapshot: &'a LocalAiProxySnapshot,
    client_protocol: &str,
) -> ProxyHttpResult<&'a LocalAiProxyRouteSnapshot> {
    snapshot
        .route_for_client_protocol(client_protocol)
        .ok_or_else(|| {
            proxy_error(
                StatusCode::SERVICE_UNAVAILABLE,
                &format!("No active {client_protocol} route is available for the local AI proxy."),
            )
        })
}

pub(super) fn require_client_auth(
    headers: &HeaderMap,
    expected_token: &str,
) -> ProxyHttpResult<()> {
    let expected_header = format!("Bearer {}", expected_token.trim());
    let authorization = headers
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .trim()
        .to_string();
    let x_api_key = header_text(headers, X_API_KEY_HEADER).unwrap_or_default();
    let x_goog_api_key = header_text(headers, X_GOOG_API_KEY_HEADER).unwrap_or_default();

    if authorization == expected_header
        || x_api_key == expected_token.trim()
        || x_goog_api_key == expected_token.trim()
    {
        return Ok(());
    }

    Err(proxy_error(
        StatusCode::UNAUTHORIZED,
        "Local AI proxy client authorization failed.",
    ))
}

pub(super) fn header_text(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

pub(super) fn parse_json_body(body: &Bytes) -> ProxyHttpResult<Value> {
    serde_json::from_slice(body).map_err(|error| {
        proxy_error(
            StatusCode::BAD_REQUEST,
            &format!("Invalid JSON request body for local AI proxy: {error}"),
        )
    })
}
