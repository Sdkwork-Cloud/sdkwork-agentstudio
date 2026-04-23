use axum::{
    body::{Body, Bytes},
    extract::State,
    http::{header, HeaderMap, HeaderName, Method, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use sdkwork_claw_host_core::internal::error::{InternalErrorCategory, InternalErrorResolution};

use crate::bootstrap::ServerState;
use crate::http::error_response::categorized_error_response;

pub fn openclaw_gateway_proxy_routes() -> Router<ServerState> {
    Router::new().route(
        "/claw/gateway/openclaw/tools/invoke",
        any(forward_openclaw_gateway_request),
    )
}

async fn forward_openclaw_gateway_request(
    State(state): State<ServerState>,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let Some(target) = state.openclaw_gateway_target() else {
        return categorized_error_response(
            "openclaw_gateway_unavailable",
            InternalErrorCategory::Dependency,
            "The OpenClaw gateway proxy surface is not active on this host.",
            StatusCode::SERVICE_UNAVAILABLE,
            true,
            InternalErrorResolution::WaitAndRetry,
            state.host_platform_updated_at(),
        );
    };

    forward_proxy_request(
        target.base_url.as_str(),
        target.auth_token.as_deref(),
        method,
        uri,
        headers,
        body,
        state.host_platform_updated_at(),
    )
    .await
}

async fn forward_proxy_request(
    upstream_base_url: &str,
    auth_token: Option<&str>,
    method: Method,
    uri: Uri,
    headers: HeaderMap,
    body: Bytes,
    now_ms: u64,
) -> Response {
    let client = reqwest::Client::new();
    let path_and_query = uri
        .path_and_query()
        .map(|value| value.as_str())
        .unwrap_or_else(|| uri.path());
    let governed_path = path_and_query
        .strip_prefix("/claw/gateway/openclaw")
        .unwrap_or("");
    let upstream_url = format!(
        "{}{}",
        upstream_base_url.trim_end_matches('/'),
        governed_path
    );
    let mut request = client.request(method, upstream_url);

    for (name, value) in headers.iter() {
        if should_skip_request_header(name) || *name == header::AUTHORIZATION {
            continue;
        }
        request = request.header(name, value);
    }

    if let Some(token) = auth_token {
        request = request.header(header::AUTHORIZATION, format!("Bearer {token}"));
    }

    let response = match request.body(body).send().await {
        Ok(response) => response,
        Err(error) => {
            return categorized_error_response(
                "openclaw_gateway_upstream_unreachable",
                InternalErrorCategory::Dependency,
                &format!(
                    "The built-in host could not reach the OpenClaw gateway upstream: {error}"
                ),
                StatusCode::BAD_GATEWAY,
                true,
                InternalErrorResolution::Retry,
                now_ms,
            );
        }
    };

    let status = response.status();
    let response_headers = response.headers().clone();
    let response_body = match response.bytes().await {
        Ok(body) => body,
        Err(error) => {
            return categorized_error_response(
                "openclaw_gateway_upstream_invalid_response",
                InternalErrorCategory::Dependency,
                &format!("The OpenClaw gateway upstream returned an unreadable response: {error}"),
                StatusCode::BAD_GATEWAY,
                true,
                InternalErrorResolution::Retry,
                now_ms,
            );
        }
    };

    let mut builder = Response::builder().status(status);
    for (name, value) in response_headers.iter() {
        if should_skip_response_header(name) {
            continue;
        }
        builder = builder.header(name, value);
    }

    builder
        .body(Body::from(response_body))
        .unwrap_or_else(|_| StatusCode::BAD_GATEWAY.into_response())
}

fn should_skip_request_header(name: &HeaderName) -> bool {
    matches!(
        name.as_str(),
        "host" | "connection" | "content-length" | "transfer-encoding"
    )
}

fn should_skip_response_header(name: &HeaderName) -> bool {
    matches!(
        name.as_str(),
        "connection"
            | "content-length"
            | "proxy-authenticate"
            | "proxy-authorization"
            | "te"
            | "trailer"
            | "transfer-encoding"
            | "upgrade"
    )
}

#[cfg(test)]
mod tests {
    use std::net::SocketAddr;
    use std::path::PathBuf;
    use std::sync::Arc;

    use axum::{
        body::Body,
        extract::OriginalUri,
        http::{header, HeaderMap, Request, StatusCode},
        response::Response,
        routing::any,
        Json, Router,
    };
    use sdkwork_claw_host_core::host_endpoints::{
        HostEndpointRecord, OpenClawGatewayProjection, OpenClawRuntimeProjection,
    };
    use sdkwork_claw_host_core::openclaw_control_plane::OpenClawGatewayInvokeRequest;
    use serde_json::{json, Value};
    use tower::ServiceExt;

    use super::openclaw_gateway_proxy_routes;
    use crate::bootstrap::{
        build_server_state_with_overrides, ManageOpenClawProvider, ManageOpenClawProviderHandle,
        ServerStateOverrides,
    };
    use crate::http::api_surface::PublishedProxyTarget;

    #[derive(Debug)]
    struct StaticManageOpenClawProvider {
        base_url: String,
        auth_token: String,
    }

    impl ManageOpenClawProvider for StaticManageOpenClawProvider {
        fn list_host_endpoints(&self, _updated_at: u64) -> Result<Vec<HostEndpointRecord>, String> {
            Ok(Vec::new())
        }

        fn get_runtime(&self, updated_at: u64) -> Result<OpenClawRuntimeProjection, String> {
            Ok(OpenClawRuntimeProjection {
                runtime_kind: "openclaw".to_string(),
                lifecycle: "ready".to_string(),
                endpoint_id: Some("openclaw-gateway".to_string()),
                requested_port: None,
                active_port: None,
                base_url: Some(self.base_url.clone()),
                websocket_url: None,
                managed_by: "test".to_string(),
                updated_at,
            })
        }

        fn get_gateway(&self, updated_at: u64) -> Result<OpenClawGatewayProjection, String> {
            Ok(OpenClawGatewayProjection {
                gateway_kind: "openclawGateway".to_string(),
                lifecycle: "ready".to_string(),
                endpoint_id: Some("openclaw-gateway".to_string()),
                requested_port: None,
                active_port: None,
                base_url: Some(self.base_url.clone()),
                websocket_url: None,
                managed_by: "test".to_string(),
                updated_at,
            })
        }

        fn gateway_invoke_is_available(&self, _updated_at: u64) -> bool {
            true
        }

        fn gateway_proxy_target(&self, _updated_at: u64) -> Option<PublishedProxyTarget> {
            Some(PublishedProxyTarget {
                id: "openclaw-gateway",
                base_url: self.base_url.clone(),
                auth_token: Some(self.auth_token.clone()),
            })
        }

        fn invoke_gateway(
            &self,
            _request: OpenClawGatewayInvokeRequest,
            _updated_at: u64,
        ) -> Result<Value, String> {
            Ok(Value::Null)
        }
    }

    #[tokio::test]
    async fn openclaw_gateway_proxy_routes_forward_governed_paths_and_inject_gateway_auth() {
        let upstream = spawn_upstream_echo_server().await;
        let app = openclaw_gateway_proxy_routes().with_state(build_server_state_with_overrides(
            test_rollout_dir("forward-openclaw-gateway"),
            ServerStateOverrides {
                manage_openclaw_provider: Some(ManageOpenClawProviderHandle::new(Arc::new(
                    StaticManageOpenClawProvider {
                        base_url: upstream.base_url.clone(),
                        auth_token: "gateway-token".to_string(),
                    },
                ))),
                ..ServerStateOverrides::default()
            },
        ));

        let response = app
            .oneshot(
                Request::post("/claw/gateway/openclaw/tools/invoke?mode=dry-run")
                    .header("authorization", "Bearer client-token")
                    .body(Body::from(r#"{"tool":"ping"}"#))
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = read_response_json(response).await;
        assert_eq!(
            body.get("pathAndQuery").and_then(Value::as_str),
            Some("/tools/invoke?mode=dry-run")
        );
        assert_eq!(
            body.get("authorization").and_then(Value::as_str),
            Some("Bearer gateway-token")
        );

        upstream.shutdown();
    }

    async fn read_response_json(response: Response) -> Value {
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body bytes");
        serde_json::from_slice(&body).expect("json body")
    }

    struct UpstreamHandle {
        base_url: String,
        shutdown: tokio::sync::oneshot::Sender<()>,
    }

    impl UpstreamHandle {
        fn shutdown(self) {
            let _ = self.shutdown.send(());
        }
    }

    async fn spawn_upstream_echo_server() -> UpstreamHandle {
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .expect("listener");
        let address = listener.local_addr().expect("local addr");
        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
        let app = Router::new().route(
            "/{*path}",
            any(
                |OriginalUri(uri): OriginalUri, headers: HeaderMap| async move {
                    Json(json!({
                        "pathAndQuery": uri.path_and_query().map(|value| value.as_str()).unwrap_or(uri.path()),
                        "authorization": headers
                            .get(header::AUTHORIZATION)
                            .and_then(|value| value.to_str().ok()),
                    }))
                },
            ),
        );
        tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    let _ = shutdown_rx.await;
                })
                .await
                .expect("serve upstream");
        });

        UpstreamHandle {
            base_url: format!("http://{}", format_socket_addr(address)),
            shutdown: shutdown_tx,
        }
    }

    fn format_socket_addr(address: SocketAddr) -> String {
        format!("{}:{}", address.ip(), address.port())
    }

    fn test_rollout_dir(label: &str) -> PathBuf {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time")
            .as_millis();
        std::env::temp_dir().join(format!(
            "sdkwork-claw-server-openclaw-routes-{label}-{timestamp}"
        ))
    }
}
