use crate::framework::{
    config::AppConfig,
    embedded_host_server::{
        start_embedded_host_server, EmbeddedHostRuntimeSnapshot, EmbeddedHostRuntimeStatus,
        EmbeddedHostServerHandle,
    },
    logging::AppLogger,
    paths::AppPaths,
    services::{local_ai_proxy::LocalAiProxyService, supervisor::SupervisorService},
    Result,
};

#[derive(Debug)]
pub struct DesktopHostRuntime {
    snapshot: EmbeddedHostRuntimeSnapshot,
    _server: EmbeddedHostServerHandle,
}

impl DesktopHostRuntime {
    pub fn snapshot(&self) -> &EmbeddedHostRuntimeSnapshot {
        &self.snapshot
    }

    pub fn status(&self) -> EmbeddedHostRuntimeStatus {
        self._server.status()
    }

    #[cfg(test)]
    pub fn shutdown(self) -> Result<()> {
        self._server.shutdown()
    }
}

pub fn bootstrap_desktop_host_runtime(
    paths: &AppPaths,
    config: &AppConfig,
    supervisor: &SupervisorService,
    local_ai_proxy: &LocalAiProxyService,
    logger: &AppLogger,
) -> Result<Option<DesktopHostRuntime>> {
    if !config.desktop_host.enabled {
        logger.info(
            "desktop embedded host config opt-out is ignored because desktop combined mode requires the canonical loopback host",
        )?;
    }

    let server = start_embedded_host_server(
        paths,
        config,
        supervisor,
        local_ai_proxy,
        config.desktop_host.bind_host.as_str(),
        config.desktop_host.port,
        config.desktop_host.allow_dynamic_port,
    )?;
    let snapshot = server.snapshot().clone();
    logger.info(&format!(
        "desktop embedded host bootstrapped at {}",
        snapshot.browser_base_url
    ))?;

    Ok(Some(DesktopHostRuntime {
        snapshot,
        _server: server,
    }))
}

#[cfg(test)]
mod tests {
    use super::bootstrap_desktop_host_runtime;
    use crate::framework::{
        config::{AppConfig, DesktopHostConfig},
        embedded_host_server::{
            DESKTOP_EMBEDDED_HOST_DEFAULT_BIND_HOST, DESKTOP_EMBEDDED_HOST_ENDPOINT_ID,
            DESKTOP_EMBEDDED_HOST_MODE,
        },
        logging::init_logger,
        paths::resolve_paths_for_root,
        services::{
            local_ai_proxy::LocalAiProxyService,
            openclaw_runtime::ActivatedOpenClawRuntime,
            storage::StorageService,
            supervisor::{SupervisorService, SERVICE_ID_OPENCLAW_GATEWAY},
        },
    };
    use reqwest::StatusCode;
    use serde_json::Value;
    use std::{fs, net::TcpListener};

    #[test]
    fn embedded_host_bootstrap_resolves_loopback_endpoint_and_serves_health_route() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = SupervisorService::for_paths(&paths);

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        assert_eq!(snapshot.mode, DESKTOP_EMBEDDED_HOST_MODE);
        assert_eq!(
            snapshot.endpoint.endpoint_id,
            DESKTOP_EMBEDDED_HOST_ENDPOINT_ID
        );
        assert_eq!(
            snapshot.endpoint.bind_host,
            DESKTOP_EMBEDDED_HOST_DEFAULT_BIND_HOST
        );
        assert_eq!(
            snapshot.endpoint.requested_port,
            AppConfig::default().desktop_host.port
        );
        assert!(snapshot.endpoint.active_port.is_some());
        assert!(snapshot.browser_base_url.starts_with("http://127.0.0.1:"));

        let http_status = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                reqwest::get(format!("{}/claw/health/live", snapshot.browser_base_url))
                    .await
                    .expect("health response")
                    .status()
            });

        assert_eq!(http_status, StatusCode::OK);
        runtime.shutdown().expect("shutdown desktop host");
    }

    #[test]
    fn embedded_host_bootstrap_preserves_requested_port_when_loopback_binding_falls_back() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let requested_port = reserve_available_loopback_port();
        let held_listener =
            TcpListener::bind((DESKTOP_EMBEDDED_HOST_DEFAULT_BIND_HOST, requested_port))
                .expect("held listener");
        let supervisor = SupervisorService::for_paths(&paths);
        let config = AppConfig {
            desktop_host: DesktopHostConfig {
                port: requested_port,
                ..DesktopHostConfig::default()
            },
            ..AppConfig::default()
        };

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &config,
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        assert_eq!(snapshot.endpoint.requested_port, requested_port);
        assert_ne!(snapshot.endpoint.active_port, Some(requested_port));
        assert!(snapshot.endpoint.dynamic_port);
        assert!(snapshot.endpoint.last_conflict_reason.is_some());

        drop(held_listener);
        runtime.shutdown().expect("shutdown desktop host");
    }

    #[test]
    fn embedded_host_bootstrap_ignores_disabled_config_and_still_starts() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = SupervisorService::for_paths(&paths);
        let config = AppConfig {
            desktop_host: DesktopHostConfig {
                enabled: false,
                ..DesktopHostConfig::default()
            },
            ..AppConfig::default()
        };

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &config,
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        assert_eq!(snapshot.mode, DESKTOP_EMBEDDED_HOST_MODE);
        assert!(snapshot.browser_base_url.starts_with("http://127.0.0.1:"));
        runtime.shutdown().expect("shutdown desktop host");
    }

    #[test]
    fn embedded_host_bootstrap_serves_root_html_with_desktop_combined_host_metadata() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = SupervisorService::for_paths(&paths);
        let embedded_web_dist = paths.install_root.join("resources").join("web-dist");
        fs::create_dir_all(&embedded_web_dist).expect("embedded web-dist dir");
        fs::write(
            embedded_web_dist.join("index.html"),
            "<html><head></head><body><div id=\"root\"></div></body></html>",
        )
        .expect("embedded host index");

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        let response = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                reqwest::get(snapshot.browser_base_url.clone())
                    .await
                    .expect("root html response")
            });
        let status = response.status();
        let body = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async { response.text().await.expect("root html text") });

        assert_eq!(
            status,
            StatusCode::OK,
            "desktop embedded host must serve the browser shell root html"
        );
        assert!(body.contains("sdkwork-claw-host-mode"));
        assert!(body.contains("content=\"desktopCombined\""));
        assert!(body.contains("sdkwork-claw-api-base-path"));
        assert!(body.contains("sdkwork-claw-manage-base-path"));
        assert!(body.contains("sdkwork-claw-internal-base-path"));
        assert!(body.contains("sdkwork-claw-browser-session-token"));

        runtime.shutdown().expect("shutdown desktop host");
    }

    #[test]
    fn embedded_host_bootstrap_exposes_structured_browser_bootstrap_descriptor() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = SupervisorService::for_paths(&paths);

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        let response = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                reqwest::get(format!(
                    "{}/sdkwork-claw-bootstrap.json",
                    snapshot.browser_base_url
                ))
                .await
                .expect("bootstrap descriptor response")
            });
        let status = response.status();
        let body = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                response
                    .json::<Value>()
                    .await
                    .expect("bootstrap descriptor json")
            });

        assert_eq!(
            status,
            StatusCode::OK,
            "desktop embedded host must expose a structured bootstrap descriptor"
        );
        assert_eq!(
            body.get("mode").and_then(Value::as_str),
            Some(DESKTOP_EMBEDDED_HOST_MODE)
        );
        assert_eq!(
            body.get("manageBasePath").and_then(Value::as_str),
            Some("/claw/manage/v1")
        );
        assert_eq!(
            body.get("internalBasePath").and_then(Value::as_str),
            Some("/claw/internal/v1")
        );
        assert_eq!(
            body.get("browserSessionToken").and_then(Value::as_str),
            Some(snapshot.browser_session_token.as_str())
        );

        runtime.shutdown().expect("shutdown desktop host");
    }

    #[test]
    fn embedded_host_bootstrap_exposes_root_native_local_ai_proxy_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = configured_running_supervisor(&paths);
        let local_ai_proxy = start_running_local_ai_proxy(&paths, &AppConfig::default());

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &local_ai_proxy,
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        let responses = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                let host_health = reqwest::get(format!("{}/health", snapshot.browser_base_url))
                    .await
                    .expect("root health response");
                let host_v1_health =
                    reqwest::get(format!("{}/v1/health", snapshot.browser_base_url))
                        .await
                        .expect("root v1 health response");
                let discovery = reqwest::get(format!(
                    "{}/claw/openapi/discovery",
                    snapshot.browser_base_url
                ))
                .await
                .expect("openapi discovery response");

                (
                    (host_health.status(), host_health.text().await),
                    (host_v1_health.status(), host_v1_health.text().await),
                    (
                        discovery.status(),
                        discovery
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                )
            });

        assert_eq!(
            responses.0 .0,
            StatusCode::OK,
            "desktop embedded host must expose the root-native local-ai-proxy /health route"
        );
        assert_eq!(
            responses.1 .0,
            StatusCode::OK,
            "desktop embedded host must expose the root-native local-ai-proxy /v1/health route"
        );
        assert_eq!(
            responses.2 .0,
            StatusCode::OK,
            "desktop embedded host must expose openapi discovery for optional proxy documents"
        );
        assert!(
            responses
                .2
                 .1
                .get("documents")
                .and_then(Value::as_array)
                .is_some_and(|documents| documents.iter().any(|document| {
                    document.get("id").and_then(Value::as_str) == Some("local-ai-compat-v1")
                        && document.get("url").and_then(Value::as_str)
                            == Some("/claw/openapi/local-ai-compat-v1.json")
                })),
            "desktop embedded host discovery must advertise the local-ai compatibility document when the local ai proxy is active"
        );
        assert!(
            responses
                .2
                 .1
                .get("documents")
                .and_then(Value::as_array)
                .is_some_and(|documents| documents.iter().any(|document| {
                    document.get("id").and_then(Value::as_str) == Some("openclaw-gateway-v1")
                        && document.get("url").and_then(Value::as_str)
                            == Some("/claw/openapi/openclaw-gateway-v1.json")
                })),
            "desktop embedded host discovery must advertise the governed openclaw gateway document when the managed gateway is active"
        );

        runtime.shutdown().expect("shutdown desktop host");
        local_ai_proxy.stop().expect("stop local ai proxy");
    }

    #[test]
    fn embedded_host_bootstrap_exposes_canonical_server_route_families() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = SupervisorService::for_paths(&paths);

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        let responses = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                let client = build_browser_session_client(snapshot.browser_base_url.as_str()).await;
                let openapi = client
                    .get(format!(
                        "{}/claw/openapi/v1.json",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("openapi response");
                let manage_runtime = client
                    .get(format!(
                        "{}/claw/manage/v1/openclaw/runtime",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("manage runtime response");
                let internal_platform = client
                    .get(format!(
                        "{}/claw/internal/v1/host-platform",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("internal host platform response");

                (
                    (
                        openapi.status(),
                        openapi
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        manage_runtime.status(),
                        manage_runtime
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        internal_platform.status(),
                        internal_platform
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                )
            });

        assert_eq!(
            responses.0 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical openapi document"
        );
        assert_eq!(
            responses.0 .1.get("openapi").and_then(Value::as_str),
            Some("3.1.0")
        );
        assert_eq!(
            responses.1 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical manage openclaw runtime route"
        );
        assert_eq!(
            responses.1 .1.get("runtimeKind").and_then(Value::as_str),
            Some("openclaw")
        );
        assert_eq!(
            responses.2 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical internal host platform route"
        );
        assert_eq!(
            responses.2 .1.get("mode").and_then(Value::as_str),
            Some(DESKTOP_EMBEDDED_HOST_MODE)
        );
        assert_eq!(
            responses.2 .1.get("manageBasePath").and_then(Value::as_str),
            Some("/claw/manage/v1")
        );
        assert_eq!(
            responses
                .2
                 .1
                .get("internalBasePath")
                .and_then(Value::as_str),
            Some("/claw/internal/v1")
        );

        runtime.shutdown().expect("shutdown desktop host");
    }

    #[test]
    fn embedded_host_bootstrap_exposes_canonical_public_studio_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = SupervisorService::for_paths(&paths);

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        let responses = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                let client = build_browser_session_client(snapshot.browser_base_url.as_str()).await;
                let list_instances = client
                    .get(format!(
                        "{}/claw/api/v1/studio/instances",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio instance list response");
                let get_instance = client
                    .get(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio instance get response");
                let get_instance_detail = client
                    .get(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/detail",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio instance detail response");
                let get_instance_config = client
                    .get(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/config",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio instance config response");
                let get_instance_logs = client
                    .get(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/logs",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio instance logs response");

                (
                    (
                        list_instances.status(),
                        list_instances
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        get_instance.status(),
                        get_instance
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        get_instance_detail.status(),
                        get_instance_detail
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        get_instance_config.status(),
                        get_instance_config
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        get_instance_logs.status(),
                        get_instance_logs
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                )
            });

        assert_eq!(
            responses.0 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance list route"
        );
        assert!(
            responses.0 .1.as_array().is_some_and(|items| items.iter().any(|item| {
                item.get("id").and_then(Value::as_str) == Some("managed-openclaw-primary")
            })),
            "desktop embedded host must project the built-in instance through the canonical public studio list route"
        );
        assert_eq!(
            responses.1 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance detail route"
        );
        assert_eq!(
            responses.1 .1.get("id").and_then(Value::as_str),
            Some("managed-openclaw-primary")
        );
        assert_eq!(
            responses.1 .1.get("isBuiltIn").and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            responses.2 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance detail projection route"
        );
        assert_eq!(
            responses
                .2
                 .1
                .get("instance")
                .and_then(|value| value.get("id"))
                .and_then(Value::as_str),
            Some("managed-openclaw-primary")
        );
        assert!(responses.2 .1.get("health").is_some());
        assert_eq!(
            responses.3 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance config projection route"
        );
        assert_eq!(
            responses.3 .1.get("port").and_then(Value::as_str),
            Some("21280")
        );
        assert_eq!(
            responses.4 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance logs projection route"
        );
        assert!(responses.4 .1.is_string());

        runtime.shutdown().expect("shutdown desktop host");
    }

    #[test]
    fn embedded_host_bootstrap_exposes_canonical_public_studio_conversation_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = SupervisorService::for_paths(&paths);

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        let responses = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                let client = build_browser_session_client(snapshot.browser_base_url.as_str()).await;
                let put_conversation = client
                    .put(format!(
                        "{}/claw/api/v1/studio/conversations/conversation-1",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "id": "conversation-1",
                        "title": "Local conversation",
                        "primaryInstanceId": "managed-openclaw-primary",
                        "participantInstanceIds": ["managed-openclaw-primary"],
                        "createdAt": 1,
                        "updatedAt": 2,
                        "messageCount": 1,
                        "lastMessagePreview": "Hello from desktop host",
                        "messages": [
                            {
                                "id": "message-1",
                                "conversationId": "conversation-1",
                                "role": "user",
                                "content": "Hello from desktop host",
                                "createdAt": 1,
                                "updatedAt": 2,
                                "status": "complete"
                            }
                        ]
                    }))
                    .send()
                    .await
                    .expect("studio conversation put response");
                let list_conversations = client
                    .get(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/conversations",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio conversation list response");
                let delete_conversation = client
                    .delete(format!(
                        "{}/claw/api/v1/studio/conversations/conversation-1",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio conversation delete response");

                (
                    (
                        put_conversation.status(),
                        put_conversation
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        list_conversations.status(),
                        list_conversations
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        delete_conversation.status(),
                        delete_conversation
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                )
            });

        assert_eq!(
            responses.0 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio conversation upsert route"
        );
        assert_eq!(
            responses.0 .1.get("id").and_then(Value::as_str),
            Some("conversation-1")
        );
        assert_eq!(
            responses.1 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio conversation list route"
        );
        assert!(
            responses.1 .1.as_array().is_some_and(|items| items.iter().any(|item| {
                item.get("id").and_then(Value::as_str) == Some("conversation-1")
            })),
            "desktop embedded host must project conversations through the canonical public studio conversation list route"
        );
        assert_eq!(
            responses.2 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio conversation delete route"
        );
        assert_eq!(responses.2 .1.as_bool(), Some(true));

        runtime.shutdown().expect("shutdown desktop host");
    }

    #[test]
    fn embedded_host_bootstrap_exposes_canonical_public_studio_instance_mutation_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = SupervisorService::for_paths(&paths);

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        let responses = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                let client = build_browser_session_client(snapshot.browser_base_url.as_str()).await;
                let create_response = client
                    .post(format!(
                        "{}/claw/api/v1/studio/instances",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "name": "Desktop embedded host instance",
                        "runtimeKind": "openclaw",
                        "deploymentMode": "local-managed",
                        "transportKind": "openclawGatewayWs"
                    }))
                    .send()
                    .await
                    .expect("studio instance create response");
                let create_status = create_response.status();
                let created = create_response
                    .json::<Value>()
                    .await
                    .unwrap_or_else(|_| Value::String("invalid-json".to_string()));
                let created_id = created
                    .get("id")
                    .and_then(Value::as_str)
                    .expect("created studio instance should include an id")
                    .to_string();

                let update_response = client
                    .put(format!(
                        "{}/claw/api/v1/studio/instances/{}",
                        snapshot.browser_base_url, created_id
                    ))
                    .json(&serde_json::json!({
                        "name": "Updated desktop embedded host instance",
                        "status": "offline"
                    }))
                    .send()
                    .await
                    .expect("studio instance update response");
                let start_response = client
                    .post(format!(
                        "{}/claw/api/v1/studio/instances/{}:start",
                        snapshot.browser_base_url, created_id
                    ))
                    .send()
                    .await
                    .expect("studio instance start response");
                let stop_response = client
                    .post(format!(
                        "{}/claw/api/v1/studio/instances/{}:stop",
                        snapshot.browser_base_url, created_id
                    ))
                    .send()
                    .await
                    .expect("studio instance stop response");
                let restart_response = client
                    .post(format!(
                        "{}/claw/api/v1/studio/instances/{}:restart",
                        snapshot.browser_base_url, created_id
                    ))
                    .send()
                    .await
                    .expect("studio instance restart response");
                let config_response = client
                    .put(format!(
                        "{}/claw/api/v1/studio/instances/{}/config",
                        snapshot.browser_base_url, created_id
                    ))
                    .json(&serde_json::json!({
                        "port": "28888",
                        "sandbox": true,
                        "autoUpdate": false,
                        "logLevel": "debug",
                        "corsOrigins": "http://localhost:3001"
                    }))
                    .send()
                    .await
                    .expect("studio instance config response");
                let delete_response = client
                    .delete(format!(
                        "{}/claw/api/v1/studio/instances/{}",
                        snapshot.browser_base_url, created_id
                    ))
                    .send()
                    .await
                    .expect("studio instance delete response");

                (
                    (create_status, created),
                    (
                        update_response.status(),
                        update_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        start_response.status(),
                        start_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        stop_response.status(),
                        stop_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        restart_response.status(),
                        restart_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        config_response.status(),
                        config_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        delete_response.status(),
                        delete_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                )
            });

        assert_eq!(
            responses.0 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance create route"
        );
        assert_eq!(
            responses.0 .1.get("name").and_then(Value::as_str),
            Some("Desktop embedded host instance")
        );
        assert_eq!(
            responses.1 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance update route"
        );
        assert_eq!(
            responses.1 .1.get("name").and_then(Value::as_str),
            Some("Updated desktop embedded host instance")
        );
        assert_eq!(
            responses.2 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance start route"
        );
        assert_eq!(
            responses.2 .1.get("status").and_then(Value::as_str),
            Some("online")
        );
        assert_eq!(
            responses.3 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance stop route"
        );
        assert_eq!(
            responses.3 .1.get("status").and_then(Value::as_str),
            Some("offline")
        );
        assert_eq!(
            responses.4 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance restart route"
        );
        assert_eq!(
            responses.4 .1.get("status").and_then(Value::as_str),
            Some("online")
        );
        assert_eq!(
            responses.5 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance config update route"
        );
        assert_eq!(
            responses.5 .1.get("port").and_then(Value::as_str),
            Some("28888")
        );
        assert_eq!(
            responses.6 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio instance delete route"
        );
        assert_eq!(responses.6 .1.as_bool(), Some(true));

        runtime.shutdown().expect("shutdown desktop host");
    }

    #[test]
    fn embedded_host_bootstrap_exposes_canonical_public_studio_workbench_mutation_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = configured_running_supervisor(&paths);

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        let responses = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                let client = build_browser_session_client(snapshot.browser_base_url.as_str()).await;
                let create_task_response = client
                    .post(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/tasks",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "id": "job-1",
                        "name": "Daily Sync",
                        "schedule": {
                            "kind": "cron",
                            "expr": "0 9 * * *",
                            "tz": "Asia/Shanghai"
                        },
                        "payload": {
                            "kind": "agentTurn",
                            "message": "Summarize updates.",
                            "model": "openai/gpt-5.4"
                        }
                    }))
                    .send()
                    .await
                    .expect("studio task create response");
                let update_task_response = client
                    .put(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/tasks/job-1",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "id": "job-1",
                        "name": "Updated Daily Sync",
                        "enabled": false,
                        "schedule": {
                            "kind": "cron",
                            "expr": "0 10 * * *",
                            "tz": "Asia/Shanghai"
                        },
                        "payload": {
                            "kind": "agentTurn",
                            "message": "Summarize only critical updates.",
                            "model": "openai/gpt-5.4"
                        }
                    }))
                    .send()
                    .await
                    .expect("studio task update response");
                let clone_task_response = client
                    .post(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/tasks/job-1:clone",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "name": "Daily Sync Copy"
                    }))
                    .send()
                    .await
                    .expect("studio task clone response");
                let run_task_response = client
                    .post(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/tasks/job-1:run",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio task run response");
                let executions_response = client
                    .get(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/tasks/job-1/executions",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio task executions response");
                let status_response = client
                    .post(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/tasks/job-1:status",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "status": "paused"
                    }))
                    .send()
                    .await
                    .expect("studio task status response");
                let file_update_response = client
                    .put(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/files/%2Fworkspace%2Fmain%2FAGENTS.md",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "content": "# Updated main agent"
                    }))
                    .send()
                    .await
                    .expect("studio file update response");
                let provider_update_response = client
                    .put(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/llm-providers/openai",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "endpoint": "https://api.openai.com/v1",
                        "apiKeySource": "env:OPENAI_API_KEY",
                        "defaultModelId": "gpt-5.4",
                        "reasoningModelId": "o4-mini",
                        "embeddingModelId": "text-embedding-3-large",
                        "config": {
                            "temperature": 0.1,
                            "topP": 1.0,
                            "maxTokens": 4096,
                            "timeoutMs": 60000,
                            "streaming": true
                        }
                    }))
                    .send()
                    .await
                    .expect("studio provider update response");
                let delete_task_response = client
                    .delete(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/tasks/job-1",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio task delete response");

                (
                    (
                        create_task_response.status(),
                        create_task_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        update_task_response.status(),
                        update_task_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        clone_task_response.status(),
                        clone_task_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        run_task_response.status(),
                        run_task_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        executions_response.status(),
                        executions_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        status_response.status(),
                        status_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        file_update_response.status(),
                        file_update_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        provider_update_response.status(),
                        provider_update_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                    (
                        delete_task_response.status(),
                        delete_task_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                )
            });

        assert_eq!(
            responses.0 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio task create route"
        );
        assert_eq!(
            responses.1 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio task update route"
        );
        assert_eq!(
            responses.2 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio task clone route"
        );
        assert_eq!(
            responses.3 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio task run route"
        );
        assert_eq!(
            responses.4 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio task executions route"
        );
        assert_eq!(
            responses.5 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio task status route"
        );
        assert_eq!(
            responses.6 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio file update route"
        );
        assert_eq!(
            responses.7 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio llm provider update route"
        );
        assert_eq!(
            responses.8 .0,
            StatusCode::OK,
            "desktop embedded host must publish the canonical public studio task delete route"
        );

        assert_eq!(responses.0 .1, Value::Null);
        assert_eq!(responses.1 .1, Value::Null);
        assert_eq!(responses.2 .1, Value::Null);
        assert_eq!(
            responses.3 .1.get("taskId").and_then(Value::as_str),
            Some("job-1")
        );
        assert_eq!(responses.4 .1.as_array().map(|items| items.len()), Some(1));
        assert_eq!(responses.5 .1, Value::Null);
        assert_eq!(responses.6 .1.as_bool(), Some(true));
        assert_eq!(responses.7 .1.as_bool(), Some(true));
        assert_eq!(responses.8 .1.as_bool(), Some(true));

        runtime.shutdown().expect("shutdown desktop host");
    }

    #[test]
    fn embedded_host_bootstrap_detail_route_reflects_shared_workbench_mutations() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let supervisor = configured_running_supervisor(&paths);

        let runtime = bootstrap_desktop_host_runtime(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &LocalAiProxyService::new(),
            &logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");
        let snapshot = runtime.snapshot().clone();

        let responses = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime")
            .block_on(async {
                let client = build_browser_session_client(snapshot.browser_base_url.as_str()).await;
                let create_task_response = client
                    .post(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/tasks",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "id": "job-2",
                        "name": "Detail Sync",
                        "schedule": {
                            "kind": "cron",
                            "expr": "0 11 * * *",
                            "tz": "Asia/Shanghai"
                        },
                        "payload": {
                            "kind": "agentTurn",
                            "message": "Project canonical detail.",
                            "model": "openai/gpt-5.4"
                        }
                    }))
                    .send()
                    .await
                    .expect("studio task create response");
                let file_update_response = client
                    .put(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/files/%2Fworkspace%2Fmain%2FAGENTS.md",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "content": "# Canonical detail content"
                    }))
                    .send()
                    .await
                    .expect("studio file update response");
                let provider_update_response = client
                    .put(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/llm-providers/openai",
                        snapshot.browser_base_url
                    ))
                    .json(&serde_json::json!({
                        "endpoint": "https://api.openai.com/v1",
                        "apiKeySource": "env:OPENAI_API_KEY",
                        "defaultModelId": "gpt-4.1-mini",
                        "reasoningModelId": "o4-mini",
                        "embeddingModelId": "text-embedding-3-large",
                        "config": {
                            "temperature": 0.2,
                            "topP": 1.0,
                            "maxTokens": 4096,
                            "timeoutMs": 60000,
                            "streaming": true
                        }
                    }))
                    .send()
                    .await
                    .expect("studio provider update response");
                let detail_response = client
                    .get(format!(
                        "{}/claw/api/v1/studio/instances/managed-openclaw-primary/detail",
                        snapshot.browser_base_url
                    ))
                    .send()
                    .await
                    .expect("studio detail response");

                (
                    (create_task_response.status(), create_task_response.json::<Value>().await),
                    (file_update_response.status(), file_update_response.json::<Value>().await),
                    (
                        provider_update_response.status(),
                        provider_update_response.json::<Value>().await,
                    ),
                    (
                        detail_response.status(),
                        detail_response
                            .json::<Value>()
                            .await
                            .unwrap_or_else(|_| Value::String("invalid-json".to_string())),
                    ),
                )
            });

        assert_eq!(responses.0 .0, StatusCode::OK);
        assert_eq!(responses.1 .0, StatusCode::OK);
        assert_eq!(responses.2 .0, StatusCode::OK);
        assert_eq!(
            responses.3 .0,
            StatusCode::OK,
            "desktop embedded host detail route must stay readable after shared workbench mutations"
        );
        assert!(
            responses
                .3
                 .1
                .get("workbench")
                .and_then(|value| value.get("cronTasks"))
                .and_then(|value| value.get("tasks"))
                .and_then(Value::as_array)
                .is_some_and(|items| items.iter().any(|item| {
                    item.get("id").and_then(Value::as_str) == Some("job-2")
                })),
            "desktop embedded host detail route must reflect shared task mutations in the canonical workbench snapshot"
        );
        assert!(
            responses
                .3
                 .1
                .get("workbench")
                .and_then(|value| value.get("files"))
                .and_then(Value::as_array)
                .is_some_and(|items| items.iter().any(|item| {
                    item.get("path").and_then(Value::as_str) == Some("/workspace/main/AGENTS.md")
                        && item.get("content").and_then(Value::as_str)
                            == Some("# Canonical detail content")
                })),
            "desktop embedded host detail route must reflect shared file mutations in the canonical workbench snapshot"
        );
        assert!(
            responses
                .3
                 .1
                .get("workbench")
                .and_then(|value| value.get("llmProviders"))
                .and_then(Value::as_array)
                .is_some_and(|items| items.iter().any(|item| {
                    item.get("id").and_then(Value::as_str) == Some("openai")
                        && item.get("defaultModelId").and_then(Value::as_str)
                            == Some("gpt-4.1-mini")
                })),
            "desktop embedded host detail route must reflect shared llm provider mutations in the canonical workbench snapshot"
        );

        runtime.shutdown().expect("shutdown desktop host");
    }

    fn reserve_available_loopback_port() -> u16 {
        let listener = TcpListener::bind((DESKTOP_EMBEDDED_HOST_DEFAULT_BIND_HOST, 0))
            .expect("reserve loopback port");
        let port = listener.local_addr().expect("listener addr").port();
        drop(listener);
        port
    }

    fn configured_running_supervisor(
        paths: &crate::framework::paths::AppPaths,
    ) -> SupervisorService {
        let supervisor = SupervisorService::new();
        let install_dir = paths.openclaw_runtime_dir.join("test-runtime");
        let runtime_dir = install_dir.join("runtime");
        let runtime = ActivatedOpenClawRuntime {
            install_key: "test-runtime".to_string(),
            install_dir,
            runtime_dir: runtime_dir.clone(),
            node_path: runtime_dir.join("node").join("node"),
            cli_path: runtime_dir
                .join("package")
                .join("node_modules")
                .join("openclaw")
                .join("openclaw.mjs"),
            home_dir: paths.openclaw_root_dir.clone(),
            state_dir: paths.openclaw_root_dir.clone(),
            workspace_dir: paths.openclaw_workspace_dir.clone(),
            config_path: paths.openclaw_config_file.clone(),
            gateway_port: reserve_available_loopback_port(),
            gateway_auth_token: "test-token".to_string(),
        };

        supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        supervisor
            .record_running(SERVICE_ID_OPENCLAW_GATEWAY, Some(42))
            .expect("record running");
        supervisor
    }

    fn start_running_local_ai_proxy(
        paths: &crate::framework::paths::AppPaths,
        config: &AppConfig,
    ) -> LocalAiProxyService {
        let service = LocalAiProxyService::new();
        let storage = StorageService::new();
        let snapshot = service
            .ensure_snapshot(paths, config, &storage)
            .expect("local ai proxy snapshot");

        service
            .start(paths, snapshot)
            .expect("start local ai proxy service");

        service
    }

    async fn build_browser_session_client(browser_base_url: &str) -> reqwest::Client {
        let bootstrap_client = reqwest::Client::new();
        let browser_session_token =
            fetch_browser_session_token(&bootstrap_client, browser_base_url).await;
        let mut default_headers = reqwest::header::HeaderMap::new();
        default_headers.insert(
            "x-claw-browser-session",
            reqwest::header::HeaderValue::from_str(browser_session_token.as_str())
                .expect("browser session token header should be valid"),
        );

        reqwest::Client::builder()
            .default_headers(default_headers)
            .build()
            .expect("browser session client")
    }

    async fn fetch_browser_session_token(
        client: &reqwest::Client,
        browser_base_url: &str,
    ) -> String {
        let descriptor = client
            .get(format!("{browser_base_url}/sdkwork-claw-bootstrap.json"))
            .send()
            .await
            .expect("bootstrap descriptor response")
            .json::<Value>()
            .await
            .expect("bootstrap descriptor body");

        descriptor
            .get("browserSessionToken")
            .and_then(Value::as_str)
            .map(str::to_string)
            .expect("desktop bootstrap descriptor should expose the browser session token")
    }
}
