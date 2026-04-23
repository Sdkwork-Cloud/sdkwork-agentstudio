use super::{
    local_ai_proxy_observability::{
        LocalAiProxyMessageCaptureSettings, LocalAiProxyMessageLogRecord,
        LocalAiProxyMessageLogsQuery, LocalAiProxyObservabilityRepository,
        LocalAiProxyPaginatedResult, LocalAiProxyRequestLogRecord, LocalAiProxyRequestLogsQuery,
    },
    local_ai_proxy_snapshot::{
        write_local_ai_proxy_snapshot, LocalAiProxyRouteSnapshot, LocalAiProxySnapshot,
        LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL,
    },
    storage::StorageService,
};
use crate::framework::{config::AppConfig, paths::AppPaths, FrameworkError, Result};
use sdkwork_local_api_proxy_native::probe::probe_route;
use sdkwork_local_api_proxy_native::runtime::start_local_api_proxy_server;
use sdkwork_local_api_proxy_native::runtime::LocalApiProxyServerHandle;
use sdkwork_local_api_proxy_native::support::current_time_ms;
use std::{
    fs,
    path::Path,
    sync::{Arc, Mutex, MutexGuard},
    time::Duration,
};

pub const SERVICE_ID_LOCAL_AI_PROXY: &str = "local_ai_proxy";
pub(crate) use sdkwork_local_api_proxy_native::constants::{
    LOCAL_API_PROXY_API_KEY_PLACEHOLDER as OPENCLAW_LOCAL_PROXY_API_KEY_PLACEHOLDER,
    LOCAL_API_PROXY_PROVIDER_ANTHROPIC_API as OPENCLAW_LOCAL_PROXY_PROVIDER_ANTHROPIC_API,
    LOCAL_API_PROXY_PROVIDER_AUTH as OPENCLAW_LOCAL_PROXY_PROVIDER_AUTH,
    LOCAL_API_PROXY_PROVIDER_GEMINI_API as OPENCLAW_LOCAL_PROXY_PROVIDER_GEMINI_API,
    LOCAL_API_PROXY_PROVIDER_ID as OPENCLAW_LOCAL_PROXY_PROVIDER_ID,
    LOCAL_API_PROXY_PROVIDER_OPENAI_API as OPENCLAW_LOCAL_PROXY_PROVIDER_OPENAI_API,
    LOCAL_API_PROXY_TOKEN_ENV_VAR as OPENCLAW_LOCAL_PROXY_TOKEN_ENV_VAR,
};
pub(crate) const ANTHROPIC_CLIENT_PROTOCOL: &str = "anthropic";
pub(crate) const GEMINI_CLIENT_PROTOCOL: &str = "gemini";
const OLLAMA_UPSTREAM_PROTOCOL: &str = "ollama";
const ANTHROPIC_VERSION_HEADER: &str = "anthropic-version";
const ANTHROPIC_BETA_HEADER: &str = "anthropic-beta";
const DEFAULT_ANTHROPIC_VERSION: &str = "2023-06-01";
const X_API_KEY_HEADER: &str = "x-api-key";
const X_GOOG_API_KEY_HEADER: &str = "x-goog-api-key";

mod anthropic_native;
pub(crate) mod config;
mod gemini_native;
mod health;
mod observability;
mod observability_store;
mod openai_compatible;
mod projection;
mod request_context;
mod request_translation;
mod response_io;
mod response_translation;
mod router;
mod streaming;
mod types;

use types::LocalAiProxyAppState;

#[allow(unused_imports)]
pub use types::{
    LocalAiProxyDefaultRouteHealth, LocalAiProxyLifecycle, LocalAiProxyRouteRuntimeMetrics,
    LocalAiProxyRouteTestRecord, LocalAiProxyServiceHealth, LocalAiProxyServiceStatus,
};

#[derive(Clone, Debug, Default)]
pub struct LocalAiProxyService {
    runtime: Arc<Mutex<LocalAiProxyRuntime>>,
}

#[derive(Debug)]
struct LocalAiProxyRuntime {
    lifecycle: LocalAiProxyLifecycle,
    health: Option<LocalAiProxyServiceHealth>,
    snapshot: Option<LocalAiProxySnapshot>,
    last_error: Option<String>,
    handle: Option<LocalApiProxyServerHandle>,
    observability: Arc<Mutex<observability_store::LocalAiProxyObservabilityStore>>,
    observability_repo: Option<LocalAiProxyObservabilityRepository>,
}

impl Default for LocalAiProxyRuntime {
    fn default() -> Self {
        Self {
            lifecycle: LocalAiProxyLifecycle::Stopped,
            health: None,
            snapshot: None,
            last_error: None,
            handle: None,
            observability: Arc::new(Mutex::new(
                observability_store::LocalAiProxyObservabilityStore::default(),
            )),
            observability_repo: None,
        }
    }
}

impl LocalAiProxyService {
    pub fn new() -> Self {
        Self {
            runtime: Arc::new(Mutex::new(LocalAiProxyRuntime::default())),
        }
    }

    pub fn ensure_snapshot(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
    ) -> Result<LocalAiProxySnapshot> {
        let _ = self.ensure_observability_repo(paths)?;
        let proxy_config = config::ensure_local_ai_proxy_config(paths)?;
        fs::write(
            &paths.local_ai_proxy_token_file,
            format!("{}\n", proxy_config.client_api_key),
        )?;
        let mut snapshot = super::local_ai_proxy_snapshot::materialize_local_ai_proxy_snapshot(
            paths,
            config,
            storage,
            proxy_config.requested_port,
            proxy_config.client_api_key.clone(),
        );
        snapshot.bind_host = proxy_config.bind_host.clone();
        write_local_ai_proxy_snapshot(&paths.local_ai_proxy_snapshot_file, &snapshot)?;
        let mut runtime = self.lock_runtime()?;
        runtime.snapshot = Some(snapshot.clone());
        runtime.last_error = None;
        let mut store = observability_store::lock_observability(&runtime.observability)?;
        health::reconcile_observability_store(&mut store, &snapshot);
        Ok(snapshot)
    }

    pub fn start(
        &self,
        paths: &AppPaths,
        snapshot: LocalAiProxySnapshot,
    ) -> Result<LocalAiProxyServiceHealth> {
        let _ = self.stop();
        let failed_snapshot = snapshot.clone();
        let start_result = (|| -> Result<LocalAiProxyServiceHealth> {
            let observability_repo = self.ensure_observability_repo(paths)?;
            let proxy_config = config::ensure_local_ai_proxy_config(paths)?;
            fs::write(
                &paths.local_ai_proxy_token_file,
                format!("{}\n", snapshot.auth_token),
            )?;
            write_local_ai_proxy_snapshot(&paths.local_ai_proxy_snapshot_file, &snapshot)?;
            if let Some(parent) = paths.local_ai_proxy_log_file.parent() {
                fs::create_dir_all(parent)?;
            }
            let observability = {
                let runtime = self.lock_runtime()?;
                runtime.observability.clone()
            };
            {
                let mut store = observability_store::lock_observability(&observability)?;
                health::reconcile_observability_store(&mut store, &snapshot);
            }
            let state = LocalAiProxyAppState {
                client: reqwest::Client::new(),
                snapshot: Arc::new(Mutex::new(snapshot.clone())),
                observability,
                observability_repo,
            };
            let router = router::build_router(state);
            let log_path = paths.local_ai_proxy_log_file.clone();
            let server = start_local_api_proxy_server(
                router,
                snapshot.bind_host.clone(),
                snapshot.requested_port,
                Duration::from_secs(10),
                move |error| {
                    let _ = append_proxy_log(
                        &log_path,
                        &format!("local ai proxy serve loop stopped unexpectedly: {error}"),
                    );
                },
            )?;
            let health = health::build_health(
                &snapshot,
                server.active_port,
                &proxy_config.public_base_host,
                paths,
            );

            let mut runtime = self.lock_runtime()?;
            runtime.lifecycle = LocalAiProxyLifecycle::Running;
            runtime.health = Some(health.clone());
            runtime.snapshot = Some(snapshot);
            runtime.last_error = None;
            runtime.handle = Some(server.handle);

            Ok(health)
        })();

        if let Err(error) = &start_result {
            let _ = self.record_failed_status(Some(failed_snapshot), &error.to_string());
        }

        start_result
    }

    pub fn stop(&self) -> Result<()> {
        let mut handle = {
            let mut runtime = self.lock_runtime()?;
            runtime.lifecycle = LocalAiProxyLifecycle::Stopped;
            runtime.health = None;
            runtime.handle.take()
        };

        if let Some(handle) = handle.as_mut() {
            handle.stop();
        }

        Ok(())
    }

    pub fn project_managed_openclaw_provider(
        &self,
        paths: &AppPaths,
        snapshot: &LocalAiProxySnapshot,
        health: &LocalAiProxyServiceHealth,
    ) -> Result<()> {
        projection::project_managed_openclaw_provider(paths, snapshot, health)
    }

    pub fn status(&self) -> Result<LocalAiProxyServiceStatus> {
        let runtime = self.lock_runtime()?;
        let snapshot = runtime.snapshot.clone();
        let observability = runtime.observability.clone();
        let route_metrics = snapshot
            .as_ref()
            .map(|value| health::build_route_metrics(value, &observability))
            .transpose()?
            .unwrap_or_default();
        let route_tests = snapshot
            .as_ref()
            .map(|value| health::collect_route_tests(value, &observability))
            .transpose()?
            .unwrap_or_default();
        Ok(LocalAiProxyServiceStatus {
            lifecycle: runtime.lifecycle.clone(),
            health: runtime.health.clone(),
            route_metrics,
            route_tests,
            last_error: runtime.last_error.clone(),
        })
    }

    pub fn observability_db_path(&self, paths: &AppPaths) -> Result<String> {
        Ok(self.ensure_observability_repo(paths)?.db_path_string())
    }

    pub fn message_capture_settings(
        &self,
        paths: &AppPaths,
    ) -> Result<LocalAiProxyMessageCaptureSettings> {
        Ok(self
            .ensure_observability_repo(paths)?
            .message_capture_settings()?)
    }

    pub fn update_message_capture_settings(
        &self,
        paths: &AppPaths,
        enabled: bool,
    ) -> Result<LocalAiProxyMessageCaptureSettings> {
        Ok(self
            .ensure_observability_repo(paths)?
            .update_message_capture_settings(enabled, current_time_ms())?)
    }

    pub fn list_request_logs(
        &self,
        paths: &AppPaths,
        query: LocalAiProxyRequestLogsQuery,
    ) -> Result<LocalAiProxyPaginatedResult<LocalAiProxyRequestLogRecord>> {
        Ok(self
            .ensure_observability_repo(paths)?
            .list_request_logs(query)?)
    }

    pub fn list_message_logs(
        &self,
        paths: &AppPaths,
        query: LocalAiProxyMessageLogsQuery,
    ) -> Result<LocalAiProxyPaginatedResult<LocalAiProxyMessageLogRecord>> {
        Ok(self
            .ensure_observability_repo(paths)?
            .list_message_logs(query)?)
    }

    pub fn test_route_by_id(&self, route_id: &str) -> Result<LocalAiProxyRouteTestRecord> {
        let route_id = route_id.trim();
        if route_id.is_empty() {
            return Err(FrameworkError::ValidationFailed(
                "local ai proxy route id is required".to_string(),
            ));
        }

        let (snapshot, observability) = {
            let runtime = self.lock_runtime()?;
            (runtime.snapshot.clone(), runtime.observability.clone())
        };
        let snapshot = snapshot.ok_or_else(|| {
            FrameworkError::Conflict(
                "local ai proxy snapshot is unavailable; ensure the proxy is initialized first"
                    .to_string(),
            )
        })?;
        let route = snapshot
            .routes
            .iter()
            .find(|entry| entry.id == route_id)
            .cloned()
            .ok_or_else(|| FrameworkError::NotFound(format!("local ai proxy route {route_id}")))?;

        let record = probe_route(&route)?;
        let mut store = observability_store::lock_observability(&observability)?;
        store.route_tests.insert(route.id.clone(), record.clone());
        Ok(record)
    }

    fn lock_runtime(&self) -> Result<MutexGuard<'_, LocalAiProxyRuntime>> {
        self.runtime.lock().map_err(|_| {
            FrameworkError::Internal("local ai proxy runtime lock poisoned".to_string())
        })
    }

    fn record_failed_status(
        &self,
        snapshot: Option<LocalAiProxySnapshot>,
        message: &str,
    ) -> Result<()> {
        let mut runtime = self.lock_runtime()?;
        runtime.lifecycle = LocalAiProxyLifecycle::Failed;
        runtime.health = None;
        runtime.snapshot = snapshot;
        runtime.last_error = Some(message.trim().to_string());
        runtime.handle = None;
        Ok(())
    }

    fn ensure_observability_repo(
        &self,
        paths: &AppPaths,
    ) -> Result<LocalAiProxyObservabilityRepository> {
        let mut runtime = self.lock_runtime()?;
        if let Some(repository) = runtime.observability_repo.clone() {
            return Ok(repository);
        }

        let repository = LocalAiProxyObservabilityRepository::new(
            paths.local_ai_proxy_observability_db_file.clone(),
        )?;
        runtime.observability_repo = Some(repository.clone());
        Ok(repository)
    }
}

fn is_loopback_host(value: &str) -> bool {
    let normalized = value.trim().trim_matches(['[', ']']).to_ascii_lowercase();
    normalized == "127.0.0.1"
        || normalized == "::1"
        || normalized == "localhost"
        || normalized.ends_with(".localhost")
}

pub(crate) fn resolve_projected_openclaw_provider_api(client_protocol: &str) -> &'static str {
    match client_protocol.trim() {
        ANTHROPIC_CLIENT_PROTOCOL => OPENCLAW_LOCAL_PROXY_PROVIDER_ANTHROPIC_API,
        GEMINI_CLIENT_PROTOCOL => OPENCLAW_LOCAL_PROXY_PROVIDER_GEMINI_API,
        _ => OPENCLAW_LOCAL_PROXY_PROVIDER_OPENAI_API,
    }
}

pub(crate) fn resolve_projected_openclaw_provider_base_url(
    client_protocol: &str,
    health_base_url: &str,
) -> String {
    let trimmed = health_base_url.trim();
    if client_protocol.trim() != GEMINI_CLIENT_PROTOCOL {
        return trimmed.to_string();
    }

    let root = trimmed.trim_end_matches("/v1").trim_end_matches('/');
    if root.is_empty() {
        trimmed.to_string()
    } else {
        root.to_string()
    }
}

fn append_proxy_log(path: &Path, message: &str) -> Result<()> {
    let mut current = if path.exists() {
        fs::read_to_string(path)?
    } else {
        String::new()
    };
    current.push_str(message);
    current.push('\n');
    fs::write(path, current)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        openai_compatible, streaming::OpenAiStreamEndpoint, streaming::OpenAiTranslatedStreamState,
        types::LocalAiProxyTokenUsage, LocalAiProxyService,
    };
    use crate::framework::{
        config::AppConfig,
        paths::resolve_paths_for_root,
        services::local_ai_proxy_snapshot::{
            create_system_default_local_ai_proxy_snapshot, materialize_local_ai_proxy_snapshot,
            LocalAiProxyModelSnapshot, LocalAiProxyRouteRuntimeConfigSnapshot,
            LocalAiProxyRouteSnapshot, LocalAiProxySnapshot, LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY,
            LOCAL_AI_PROXY_DEFAULT_PORT, LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE,
        },
        services::storage::StorageService,
        storage::{StorageProfileConfig, StorageProviderKind, StoragePutTextRequest},
    };
    use axum::{
        body::Bytes,
        extract::State,
        http::{HeaderMap, StatusCode},
        response::IntoResponse,
        routing::post,
        Json, Router,
    };
    use sdkwork_local_api_proxy_native::runtime::{
        start_local_api_proxy_server, LocalApiProxyServerHandle,
    };
    use serde_json::{json, Value};
    use std::{
        fs,
        sync::{Arc, Mutex},
        time::{Duration, Instant},
    };

    #[test]
    fn local_ai_proxy_binds_only_to_loopback() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot =
            create_system_default_local_ai_proxy_snapshot(0, LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY);

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");

        assert_eq!(
            health.base_url,
            expected_test_public_v1_base_url(health.active_port)
        );
        assert!(health.loopback_only);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_health_exposes_protocol_default_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let snapshot =
            create_system_default_local_ai_proxy_snapshot(0, LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY);

        let health = super::health::build_health(
            &snapshot,
            LOCAL_AI_PROXY_DEFAULT_PORT,
            &expected_test_public_host(),
            &paths,
        );

        assert_eq!(
            health
                .default_routes
                .iter()
                .map(|route| route.client_protocol.as_str())
                .collect::<Vec<_>>(),
            vec!["openai-compatible", "anthropic", "gemini"]
        );
        assert_eq!(
            health
                .default_routes
                .iter()
                .map(|route| route.name.as_str())
                .collect::<Vec<_>>(),
            vec![
                "SDKWork Default",
                "SDKWork Anthropic Default",
                "SDKWork Gemini Default"
            ]
        );
        assert!(health
            .default_routes
            .iter()
            .all(|route| route.managed_by == "system-default"));
        assert!(health
            .default_routes
            .iter()
            .all(|route| route.model_count == 3));
    }

    #[test]
    fn local_ai_proxy_default_public_host_prefers_branded_host_when_it_resolves_to_loopback() {
        let mut resolver = |host: &str| match host {
            "ai.sdkwork.localhost" => vec!["127.0.0.1".parse().expect("loopback ip")],
            "localhost" => vec!["127.0.0.1".parse().expect("loopback ip")],
            "127.0.0.1" => vec!["127.0.0.1".parse().expect("loopback ip")],
            _ => Vec::new(),
        };

        assert_eq!(
            super::config::resolve_default_local_ai_proxy_public_host_with_resolver(&mut resolver),
            "ai.sdkwork.localhost"
        );
    }

    #[test]
    fn local_ai_proxy_default_public_host_falls_back_when_branded_host_is_not_loopback_safe() {
        let mut resolver = |host: &str| match host {
            "ai.sdkwork.localhost" => vec!["198.18.0.9".parse().expect("non-loopback ip")],
            "localhost" => vec![
                "127.0.0.1".parse().expect("ipv4 loopback"),
                "::1".parse().expect("ipv6 loopback"),
            ],
            "127.0.0.1" => vec!["127.0.0.1".parse().expect("loopback ip")],
            _ => Vec::new(),
        };

        assert_eq!(
            super::config::resolve_default_local_ai_proxy_public_host_with_resolver(&mut resolver),
            "localhost"
        );
    }

    #[test]
    fn local_ai_proxy_start_failure_marks_runtime_failed_and_records_the_error() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let mut snapshot =
            create_system_default_local_ai_proxy_snapshot(0, LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY);
        snapshot.bind_host = "invalid host name".to_string();

        let error = service
            .start(&paths, snapshot.clone())
            .expect_err("start should fail for an invalid bind host");
        let status = service.status().expect("status after failed start");

        assert!(error.to_string().contains("failed to bind local ai proxy"));
        assert_eq!(status.lifecycle, super::LocalAiProxyLifecycle::Failed);
        assert!(status.health.is_none());
        assert!(status
            .last_error
            .as_deref()
            .unwrap_or_default()
            .contains("failed to bind local ai proxy"));
    }

    #[test]
    fn local_ai_proxy_health_endpoint_reports_running_status() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot =
            create_system_default_local_ai_proxy_snapshot(0, LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY);

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let body = request_json("GET", &format!("{}/health", health.base_url), None, None);

        assert_eq!(body["status"], "ok");
        assert_eq!(body["service"], "local-ai-proxy");
        assert_eq!(
            body["defaultRouteId"],
            "local-ai-proxy-system-default-openai-compatible"
        );
        assert_eq!(body["defaultRouteName"], "SDKWork Default");
        assert_eq!(
            body["defaultRoutes"]
                .as_array()
                .expect("defaultRoutes array")
                .iter()
                .filter_map(|route| route.get("clientProtocol").and_then(Value::as_str))
                .collect::<Vec<_>>(),
            vec!["openai-compatible", "anthropic", "gemini"]
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_models_endpoint_projects_default_route_models() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-custom".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-custom".to_string(),
                name: "Custom OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: "https://api.openai.com/v1".to_string(),
                api_key: "sk-live".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-5.4".to_string(),
                        name: "GPT-5.4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "o4-mini".to_string(),
                        name: "o4-mini".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let body = request_json(
            "GET",
            &format!("{}/models", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            None,
        );

        assert_eq!(body["object"], "list");
        assert_eq!(body["data"][0]["id"], "gpt-5.4");
        assert_eq!(body["data"][1]["id"], "o4-mini");

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_chat_completions_forwards_to_selected_upstream_with_bearer_auth() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "hello" }],
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.authorization.as_deref(),
            Some("Bearer upstream-secret")
        );
        assert_eq!(capture.body["model"], "gpt-5.4");
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_status_records_route_metrics_after_successful_request() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let _ = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "hello metrics" }],
            })),
        );

        let status = service.status().expect("status");
        let metrics = status
            .route_metrics
            .iter()
            .find(|entry| entry.route_id == "route-upstream")
            .expect("route metrics");

        assert_eq!(metrics.client_protocol, "openai-compatible");
        assert_eq!(metrics.upstream_protocol, "openai-compatible");
        assert_eq!(metrics.health, "healthy");
        assert_eq!(metrics.request_count, 1);
        assert_eq!(metrics.success_count, 1);
        assert_eq!(metrics.failure_count, 0);
        assert_eq!(metrics.rpm, 1);
        assert_eq!(metrics.total_tokens, 0);
        assert_eq!(metrics.input_tokens, 0);
        assert_eq!(metrics.output_tokens, 0);
        assert_eq!(metrics.cache_tokens, 0);
        assert!(metrics.average_latency_ms <= metrics.last_latency_ms.unwrap_or(u64::MAX));
        assert!(metrics.last_latency_ms.is_some());
        assert!(metrics.last_used_at.is_some());
        assert_eq!(metrics.last_error, None);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_status_records_translated_usage_when_upstream_usage_is_present() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let _ = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "claude-sonnet-4-20250514",
                "messages": [{ "role": "user", "content": "hello usage" }],
            })),
        );

        let status = service.status().expect("status");
        let metrics = status
            .route_metrics
            .iter()
            .find(|entry| entry.route_id == "route-anthropic-openai")
            .expect("route metrics");

        assert_eq!(metrics.health, "healthy");
        assert_eq!(metrics.request_count, 1);
        assert_eq!(metrics.success_count, 1);
        assert_eq!(metrics.failure_count, 0);
        assert_eq!(metrics.input_tokens, 12);
        assert_eq!(metrics.output_tokens, 8);
        assert_eq!(metrics.total_tokens, 20);
        assert_eq!(metrics.cache_tokens, 0);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_status_records_anthropic_streaming_usage_after_translation() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai-stream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai-stream".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let _ = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "claude-sonnet-4-20250514",
                "messages": [{ "role": "user", "content": "hello usage stream" }],
                "stream": true,
            }),
        );

        let status = service.status().expect("status");
        let metrics = status
            .route_metrics
            .iter()
            .find(|entry| entry.route_id == "route-anthropic-openai-stream")
            .expect("route metrics");

        assert_eq!(metrics.health, "healthy");
        assert_eq!(metrics.request_count, 1);
        assert_eq!(metrics.success_count, 1);
        assert_eq!(metrics.failure_count, 0);
        assert_eq!(metrics.input_tokens, 12);
        assert_eq!(metrics.output_tokens, 8);
        assert_eq!(metrics.total_tokens, 20);
        assert_eq!(metrics.cache_tokens, 0);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_status_records_gemini_streaming_usage_after_translation() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai-stream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai-stream".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let _ = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "gemini-2.5-pro",
                "messages": [{ "role": "user", "content": "hello usage stream" }],
                "stream": true,
            }),
        );

        let status = service.status().expect("status");
        let metrics = status
            .route_metrics
            .iter()
            .find(|entry| entry.route_id == "route-gemini-openai-stream")
            .expect("route metrics");

        assert_eq!(metrics.health, "healthy");
        assert_eq!(metrics.request_count, 1);
        assert_eq!(metrics.success_count, 1);
        assert_eq!(metrics.failure_count, 0);
        assert_eq!(metrics.input_tokens, 10);
        assert_eq!(metrics.output_tokens, 8);
        assert_eq!(metrics.total_tokens, 18);
        assert_eq!(metrics.cache_tokens, 0);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn extract_token_usage_does_not_double_count_cached_prompt_tokens_when_total_absent() {
        let usage = openai_compatible::extract_token_usage(&json!({
            "usage": {
                "prompt_tokens": 12_307,
                "completion_tokens": 6,
                "prompt_tokens_details": {
                    "cached_tokens": 4_096
                }
            }
        }));

        assert_eq!(usage.input_tokens, 12_307);
        assert_eq!(usage.output_tokens, 6);
        assert_eq!(usage.cache_tokens, 4_096);
        assert_eq!(usage.total_tokens, 12_313);
    }

    #[test]
    fn extract_token_usage_reads_openai_responses_cached_input_tokens() {
        let usage = openai_compatible::extract_token_usage(&json!({
            "usage": {
                "input_tokens": 12_307,
                "output_tokens": 6,
                "total_tokens": 12_313,
                "input_tokens_details": {
                    "cached_tokens": 4_096
                }
            }
        }));

        assert_eq!(usage.input_tokens, 12_307);
        assert_eq!(usage.output_tokens, 6);
        assert_eq!(usage.cache_tokens, 4_096);
        assert_eq!(usage.total_tokens, 12_313);
    }

    #[test]
    fn openai_stream_usage_merge_does_not_double_count_cached_prompt_tokens_in_total() {
        let mut state = OpenAiTranslatedStreamState::new(
            OpenAiStreamEndpoint::ChatCompletions,
            "gpt-5.4",
            "test-stream",
        );

        state.merge_usage(&LocalAiProxyTokenUsage {
            total_tokens: 12_307,
            input_tokens: 12_307,
            output_tokens: 0,
            cache_tokens: 4_096,
        });
        state.merge_usage(&LocalAiProxyTokenUsage {
            total_tokens: 0,
            input_tokens: 12_307,
            output_tokens: 6,
            cache_tokens: 4_096,
        });

        assert_eq!(state.usage.input_tokens, 12_307);
        assert_eq!(state.usage.output_tokens, 6);
        assert_eq!(state.usage.cache_tokens, 4_096);
        assert_eq!(state.usage.total_tokens, 12_313);
    }

    #[test]
    fn local_ai_proxy_persists_request_logs_with_stream_timings_and_message_capture_opt_in() {
        use crate::framework::services::local_ai_proxy_observability::{
            LocalAiProxyMessageLogsQuery, LocalAiProxyRequestLogsQuery,
        };

        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-observability".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-observability".to_string(),
                name: "OpenAI Observability".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");

        let initial_settings = service
            .message_capture_settings(&paths)
            .expect("initial message capture settings");
        assert_eq!(initial_settings.enabled, false);

        let _ = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "capture disabled first" }],
            })),
        );

        let first_request_logs = service
            .list_request_logs(&paths, LocalAiProxyRequestLogsQuery::default())
            .expect("list request logs after first request");
        let request_log = first_request_logs.items.first().expect("request log");
        assert_eq!(first_request_logs.total, 1);
        assert_eq!(request_log.provider_id, "openai");
        assert_eq!(request_log.model_id.as_deref(), Some("gpt-5.4"));
        assert_eq!(request_log.status, "succeeded");
        assert!(request_log.total_duration_ms > 0);

        let first_message_logs = service
            .list_message_logs(&paths, LocalAiProxyMessageLogsQuery::default())
            .expect("message logs should be queryable");
        assert_eq!(first_message_logs.total, 0);

        let updated_settings = service
            .update_message_capture_settings(&paths, true)
            .expect("enable message capture");
        assert_eq!(updated_settings.enabled, true);

        let _ = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "capture enabled second" }],
                "stream": true,
            }),
        );

        let request_logs = service
            .list_request_logs(&paths, LocalAiProxyRequestLogsQuery::default())
            .expect("list request logs");
        let latest_request_log = request_logs.items.first().expect("latest request log");
        assert_eq!(request_logs.total, 2);
        assert_eq!(latest_request_log.provider_id, "openai");
        assert_eq!(latest_request_log.status, "succeeded");
        assert!(latest_request_log.ttft_ms.is_some());
        assert!(latest_request_log.total_duration_ms >= latest_request_log.ttft_ms.unwrap_or(0));

        let message_logs = service
            .list_message_logs(&paths, LocalAiProxyMessageLogsQuery::default())
            .expect("list message logs");
        let latest_message_log = message_logs.items.first().expect("message log");
        assert_eq!(message_logs.total, 1);
        assert_eq!(latest_message_log.provider_id, "openai");
        assert_eq!(latest_message_log.message_count, 1);
        assert_eq!(latest_message_log.messages[0].role, "user");
        assert_eq!(
            latest_message_log.messages[0].content,
            "capture enabled second"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_request_logs_capture_openai_prompt_completion_and_cache_usage() {
        use crate::framework::services::local_ai_proxy_observability::LocalAiProxyRequestLogsQuery;

        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-openai-usage".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-openai-usage".to_string(),
                name: "OpenAI Usage".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let _ = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "usage detail request" }],
            })),
        );

        let request_logs = service
            .list_request_logs(&paths, LocalAiProxyRequestLogsQuery::default())
            .expect("list request logs");
        let latest_request_log = request_logs.items.first().expect("latest request log");

        assert_eq!(latest_request_log.total_tokens, 12_313);
        assert_eq!(latest_request_log.prompt_tokens, 12_307);
        assert_eq!(latest_request_log.completion_tokens, 6);
        assert_eq!(latest_request_log.input_tokens, 12_307);
        assert_eq!(latest_request_log.output_tokens, 6);
        assert_eq!(latest_request_log.cache_tokens, 4_096);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_request_logs_capture_openai_responses_input_output_and_cache_usage() {
        use crate::framework::services::local_ai_proxy_observability::LocalAiProxyRequestLogsQuery;

        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-openai-responses-usage".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-openai-responses-usage".to_string(),
                name: "OpenAI Responses Usage".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "input": "responses usage detail request",
            })),
        );
        assert_eq!(
            response.pointer("/usage/input_tokens"),
            Some(&json!(12_307))
        );
        assert_eq!(response.pointer("/usage/output_tokens"), Some(&json!(6)));
        assert_eq!(
            response.pointer("/usage/total_tokens"),
            Some(&json!(12_313))
        );
        assert_eq!(
            response.pointer("/usage/input_tokens_details/cached_tokens"),
            Some(&json!(4_096))
        );

        let request_logs = service
            .list_request_logs(&paths, LocalAiProxyRequestLogsQuery::default())
            .expect("list request logs");
        let latest_request_log = request_logs.items.first().expect("latest request log");

        assert_eq!(latest_request_log.endpoint, "/v1/responses");
        assert_eq!(latest_request_log.total_tokens, 12_313);
        assert_eq!(latest_request_log.prompt_tokens, 12_307);
        assert_eq!(latest_request_log.completion_tokens, 6);
        assert_eq!(latest_request_log.input_tokens, 12_307);
        assert_eq!(latest_request_log.output_tokens, 6);
        assert_eq!(latest_request_log.cache_tokens, 4_096);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_test_route_by_id_records_latest_successful_probe() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        service
            .start(&paths, snapshot)
            .expect("start local ai proxy");

        let result = service
            .test_route_by_id("route-upstream")
            .expect("probe should complete");

        assert_eq!(result.route_id, "route-upstream");
        assert_eq!(result.status, "passed");
        assert_eq!(result.checked_capability, "chat");
        assert_eq!(result.model_id.as_deref(), Some("gpt-5.4"));
        assert!(result.latency_ms.is_some());
        assert_eq!(result.error, None);

        let status = service.status().expect("status");
        let latest = status
            .route_tests
            .iter()
            .find(|entry| entry.route_id == "route-upstream")
            .expect("latest route test");
        assert_eq!(latest.status, "passed");
        assert_eq!(latest.checked_capability, "chat");

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_test_route_by_id_records_latest_failed_probe() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-failed-probe".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-failed-probe".to_string(),
                name: "Failed Probe Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: "http://127.0.0.1:9/v1".to_string(),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        service
            .start(&paths, snapshot)
            .expect("start local ai proxy");

        let result = service
            .test_route_by_id("route-failed-probe")
            .expect("probe should return a failure record");

        assert_eq!(result.route_id, "route-failed-probe");
        assert_eq!(result.status, "failed");
        assert_eq!(result.checked_capability, "chat");
        assert_eq!(result.model_id.as_deref(), Some("gpt-5.4"));
        assert!(result
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("failed"));

        let status = service.status().expect("status");
        let latest = status
            .route_tests
            .iter()
            .find(|entry| entry.route_id == "route-failed-probe")
            .expect("latest route test");
        assert_eq!(latest.status, "failed");
        assert!(latest
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("failed"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_endpoint_forwards_to_selected_upstream_with_bearer_auth() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: Some("text-embedding-3-large".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-5.4".to_string(),
                        name: "GPT-5.4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-3-large".to_string(),
                        name: "text-embedding-3-large".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-5.4",
                "input": "hello responses",
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/v1/responses"));
        assert_eq!(
            capture.authorization.as_deref(),
            Some("Bearer upstream-secret")
        );
        assert_eq!(capture.body["model"], "gpt-5.4");
        assert_eq!(
            response["output"][0]["content"][0]["text"],
            "responses proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_translate_to_anthropic_upstream_preserves_usage() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "claude-sonnet-4-20250514".to_string(),
                    name: "Claude Sonnet 4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "claude-sonnet-4-20250514",
                "input": "hello anthropic response",
            })),
        );

        assert_eq!(
            response["output"][0]["content"][0]["text"],
            "anthropic proxied response"
        );
        assert_eq!(response.pointer("/usage/input_tokens"), Some(&json!(12)));
        assert_eq!(response.pointer("/usage/output_tokens"), Some(&json!(8)));
        assert_eq!(response.pointer("/usage/total_tokens"), Some(&json!(20)));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_translate_to_gemini_upstream_preserves_usage() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gemini-2.5-pro".to_string(),
                    name: "Gemini 2.5 Pro".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gemini-2.5-pro",
                "input": "hello gemini response",
            })),
        );

        assert_eq!(
            response["output"][0]["content"][0]["text"],
            "gemini proxied response"
        );
        assert_eq!(response.pointer("/usage/input_tokens"), Some(&json!(10)));
        assert_eq!(response.pointer("/usage/output_tokens"), Some(&json!(8)));
        assert_eq!(response.pointer("/usage/total_tokens"), Some(&json!(18)));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_embeddings_endpoint_forwards_to_selected_upstream_with_bearer_auth() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: Some("text-embedding-3-large".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-5.4".to_string(),
                        name: "GPT-5.4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-3-large".to_string(),
                        name: "text-embedding-3-large".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/embeddings", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "text-embedding-3-large",
                "input": "embed this text",
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/v1/embeddings"));
        assert_eq!(
            capture.authorization.as_deref(),
            Some("Bearer upstream-secret")
        );
        assert_eq!(capture.body["model"], "text-embedding-3-large");
        assert_eq!(response["data"][0]["embedding"][0], 0.12);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_azure_openai_chat_completions_maps_to_v1_endpoint_with_api_key_header() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-azure".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-azure".to_string(),
                name: "Azure OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "azure-openai".to_string(),
                provider_id: "azure-openai".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "azure-upstream-secret".to_string(),
                default_model_id: "gpt-4.1".to_string(),
                reasoning_model_id: Some("gpt-4.1".to_string()),
                embedding_model_id: Some("text-embedding-3-large".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-4.1".to_string(),
                        name: "GPT-4.1".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-3-large".to_string(),
                        name: "text-embedding-3-large".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gpt-4.1",
                "messages": [{ "role": "user", "content": "hello azure" }],
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/openai/v1/chat/completions"));
        assert_eq!(capture.authorization, None);
        assert_eq!(capture.x_api_key.as_deref(), Some("azure-upstream-secret"));
        assert_eq!(capture.body["model"], "gpt-4.1");
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_chat_completions_translate_to_anthropic_upstream() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "claude-sonnet-4-20250514",
                "messages": [
                    { "role": "system", "content": "You are a precise assistant." },
                    { "role": "user", "content": "hello anthropic through openai" }
                ],
                "max_tokens": 256,
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/v1/messages"));
        assert_eq!(capture.authorization, None);
        assert_eq!(
            capture.x_api_key.as_deref(),
            Some("anthropic-upstream-secret")
        );
        assert_eq!(capture.anthropic_version.as_deref(), Some("2023-06-01"));
        assert_eq!(capture.body["model"], "claude-sonnet-4-20250514");
        assert_eq!(capture.body["system"], "You are a precise assistant.");
        assert_eq!(
            capture.body["messages"][0]["content"],
            "hello anthropic through openai"
        );
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "anthropic proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_chat_completions_translate_to_anthropic_upstream_streaming() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (first_chunk_latency, content_type, body) = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "claude-sonnet-4-20250514",
                "messages": [
                    { "role": "system", "content": "You are a precise assistant." },
                    { "role": "user", "content": "hello anthropic streaming" }
                ],
                "stream": true,
            }),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/v1/messages"));
        assert_eq!(capture.body["stream"], true);
        assert!(
            first_chunk_latency < Duration::from_millis(650),
            "expected first translated chunk before upstream tail finished, got {:?}",
            first_chunk_latency
        );
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("\"object\":\"chat.completion.chunk\""));
        assert!(body.contains("anthropic stream chunk 1"));
        assert!(body.contains("anthropic stream chunk 2"));
        assert!(body.contains("[DONE]"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_chat_completions_translate_to_gemini_upstream() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "gemini-2.5-pro",
                "messages": [
                    { "role": "system", "content": "You are a concise assistant." },
                    { "role": "user", "content": "hello gemini through openai" }
                ],
                "max_tokens": 512,
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/gemini-2.5-pro:generateContent")
        );
        assert_eq!(capture.authorization, None);
        assert_eq!(
            capture.x_goog_api_key.as_deref(),
            Some("gemini-upstream-secret")
        );
        assert_eq!(
            capture.body["systemInstruction"]["parts"][0]["text"],
            "You are a concise assistant."
        );
        assert_eq!(capture.body["contents"][0]["role"], "user");
        assert_eq!(
            capture.body["contents"][0]["parts"][0]["text"],
            "hello gemini through openai"
        );
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "gemini proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_chat_completions_translate_to_gemini_upstream_streaming() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (first_chunk_latency, content_type, body) = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "gemini-2.5-pro",
                "messages": [
                    { "role": "system", "content": "You are a concise assistant." },
                    { "role": "user", "content": "hello gemini streaming" }
                ],
                "stream": true,
            }),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse")
        );
        assert!(
            first_chunk_latency < Duration::from_millis(650),
            "expected first translated chunk before upstream tail finished, got {:?}",
            first_chunk_latency
        );
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("\"object\":\"chat.completion.chunk\""));
        assert!(body.contains("gemini stream chunk 1"));
        assert!(body.contains("gemini stream chunk 2"));
        assert!(body.contains("[DONE]"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_chat_completions_translate_to_ollama_upstream() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-ollama-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-ollama-openai".to_string(),
                name: "Ollama via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "ollama".to_string(),
                provider_id: "ollama".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "ollama-local".to_string(),
                default_model_id: "glm-4.7-flash".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("nomic-embed-text".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "glm-4.7-flash".to_string(),
                        name: "GLM 4.7 Flash".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "nomic-embed-text".to_string(),
                        name: "nomic-embed-text".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "glm-4.7-flash",
                "messages": [
                    { "role": "system", "content": "You are a concise assistant." },
                    { "role": "user", "content": "hello ollama through openai" }
                ],
                "max_tokens": 512,
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/api/chat"));
        assert_eq!(capture.authorization, None);
        assert_eq!(capture.body["model"], "glm-4.7-flash");
        assert_eq!(capture.body["messages"][0]["role"], "system");
        assert_eq!(
            capture.body["messages"][0]["content"],
            "You are a concise assistant."
        );
        assert_eq!(capture.body["messages"][1]["role"], "user");
        assert_eq!(
            capture.body["messages"][1]["content"],
            "hello ollama through openai"
        );
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "ollama proxied response"
        );
        assert_eq!(response["usage"]["prompt_tokens"], 10);
        assert_eq!(response["usage"]["completion_tokens"], 8);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_chat_completions_translate_to_ollama_upstream_streaming() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-ollama-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-ollama-openai".to_string(),
                name: "Ollama via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "ollama".to_string(),
                provider_id: "ollama".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "ollama-local".to_string(),
                default_model_id: "glm-4.7-flash".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "glm-4.7-flash".to_string(),
                    name: "GLM 4.7 Flash".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (first_chunk_latency, content_type, body) = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "glm-4.7-flash",
                "messages": [
                    { "role": "user", "content": "hello ollama streaming" }
                ],
                "stream": true,
            }),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/api/chat"));
        assert!(
            first_chunk_latency < Duration::from_millis(650),
            "expected first translated chunk before upstream tail finished, got {:?}",
            first_chunk_latency
        );
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("\"object\":\"chat.completion.chunk\""));
        assert!(body.contains("ollama stream chunk 1"));
        assert!(body.contains("ollama stream chunk 2"));
        assert!(body.contains("[DONE]"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_translate_to_ollama_upstream_preserves_usage() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-ollama-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-ollama-openai".to_string(),
                name: "Ollama via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "ollama".to_string(),
                provider_id: "ollama".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "ollama-local".to_string(),
                default_model_id: "glm-4.7-flash".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "glm-4.7-flash".to_string(),
                    name: "GLM 4.7 Flash".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "glm-4.7-flash",
                "input": "hello ollama response",
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/api/chat"));
        assert_eq!(capture.body["messages"][0]["role"], "user");
        assert_eq!(
            capture.body["messages"][0]["content"],
            "hello ollama response"
        );
        assert_eq!(
            response["output"][0]["content"][0]["text"],
            "ollama proxied response"
        );
        assert_eq!(response["usage"]["input_tokens"], 10);
        assert_eq!(response["usage"]["output_tokens"], 8);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_embeddings_translate_to_ollama_upstream() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-ollama-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-ollama-openai".to_string(),
                name: "Ollama via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "ollama".to_string(),
                provider_id: "ollama".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "ollama-local".to_string(),
                default_model_id: "glm-4.7-flash".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("nomic-embed-text".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "glm-4.7-flash".to_string(),
                        name: "GLM 4.7 Flash".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "nomic-embed-text".to_string(),
                        name: "nomic-embed-text".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/embeddings", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "nomic-embed-text",
                "input": "embedding request for ollama",
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/api/embed"));
        assert_eq!(capture.body["model"], "nomic-embed-text");
        assert_eq!(capture.body["input"], "embedding request for ollama");
        assert_eq!(response["data"][0]["embedding"][0], 0.12);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_translate_to_anthropic_upstream_streaming() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "claude-sonnet-4-20250514".to_string(),
                    name: "Claude Sonnet 4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (_, content_type, body) = request_streaming_response(
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "claude-sonnet-4-20250514",
                "input": "hello anthropic response stream",
                "stream": true,
            }),
        );

        let capture = upstream.capture();
        assert_eq!(capture.path.as_deref(), Some("/v1/messages"));
        assert_eq!(capture.body["stream"], true);
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("\"type\":\"response.output_text.delta\""));
        assert!(body.contains("anthropic stream chunk 1"));
        assert!(body.contains("anthropic stream chunk 2"));
        assert!(body.contains("\"type\":\"response.completed\""));
        assert!(body
            .contains("\"usage\":{\"input_tokens\":12,\"output_tokens\":8,\"total_tokens\":20}"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_responses_translate_to_gemini_upstream_streaming() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gemini-2.5-pro".to_string(),
                    name: "Gemini 2.5 Pro".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (_, content_type, body) = request_streaming_response(
            &format!("{}/responses", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "gemini-2.5-pro",
                "input": "hello gemini response stream",
                "stream": true,
            }),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse")
        );
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("\"type\":\"response.output_text.delta\""));
        assert!(body.contains("gemini stream chunk 1"));
        assert!(body.contains("gemini stream chunk 2"));
        assert!(body.contains("\"type\":\"response.completed\""));
        assert!(body
            .contains("\"usage\":{\"input_tokens\":10,\"output_tokens\":8,\"total_tokens\":18}"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_openai_embeddings_translate_to_gemini_upstream() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini-openai".to_string(),
                name: "Gemini via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json(
            "POST",
            &format!("{}/embeddings", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            Some(json!({
                "model": "text-embedding-004",
                "input": "embed this through gemini"
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/text-embedding-004:embedContent")
        );
        assert_eq!(
            capture.x_goog_api_key.as_deref(),
            Some("gemini-upstream-secret")
        );
        assert_eq!(
            capture.body["content"]["parts"][0]["text"],
            "embed this through gemini"
        );
        assert_eq!(response["data"][0]["embedding"][0], 0.12);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_chat_completions_streaming_passthrough_preserves_first_chunk_latency() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-upstream".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-upstream".to_string(),
                name: "Forwarded Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "openai-compatible".to_string(),
                provider_id: "openai".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "upstream-secret".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gpt-5.4".to_string(),
                    name: "GPT-5.4".to_string(),
                }],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let (first_chunk_latency, content_type, body) = request_streaming_response(
            &format!("{}/chat/completions", health.base_url),
            Some(LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
            json!({
                "model": "gpt-5.4",
                "messages": [{ "role": "user", "content": "hello stream" }],
                "stream": true,
            }),
        );

        assert!(
            first_chunk_latency < Duration::from_millis(650),
            "expected first chunk before upstream tail finished, got {:?}",
            first_chunk_latency
        );
        assert!(content_type.starts_with("text/event-stream"));
        assert!(body.contains("proxied chunk 1"));
        assert!(body.contains("proxied chunk 2"));
        assert!(body.contains("[DONE]"));

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_anthropic_messages_endpoint_forwards_to_selected_upstream_with_native_headers(
    ) {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic".to_string(),
                name: "Anthropic Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "anthropic".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: format!("{}/v1", upstream.base_url),
                api_key: "anthropic-upstream-secret".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "claude-sonnet-4-20250514".to_string(),
                    name: "Claude Sonnet 4".to_string(),
                }],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json_with_headers(
            "POST",
            &format!("{}/messages", health.base_url),
            &[
                ("x-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY),
                ("anthropic-version", "2023-06-01"),
            ],
            Some(json!({
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 128,
                "messages": [{ "role": "user", "content": "hello anthropic" }],
            })),
        );

        let capture = upstream.capture();
        assert_eq!(capture.authorization, None);
        assert_eq!(
            capture.x_api_key.as_deref(),
            Some("anthropic-upstream-secret")
        );
        assert_eq!(capture.anthropic_version.as_deref(), Some("2023-06-01"));
        assert_eq!(capture.body["model"], "claude-sonnet-4-20250514");
        assert_eq!(response["content"][0]["text"], "anthropic proxied response");

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_generate_content_endpoint_forwards_to_selected_upstream_with_native_headers(
    ) {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json_with_headers(
            "POST",
            &format!(
                "{}/v1beta/models/gemini-2.5-pro:generateContent",
                expected_test_public_root_base_url(health.active_port)
            ),
            &[("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)],
            Some(json!({
                "contents": [{
                    "role": "user",
                    "parts": [{ "text": "hello gemini" }]
                }]
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/gemini-2.5-pro:generateContent")
        );
        assert_eq!(capture.authorization, None);
        assert_eq!(
            capture.x_goog_api_key.as_deref(),
            Some("gemini-upstream-secret")
        );
        assert_eq!(
            capture.body["contents"][0]["parts"][0]["text"],
            "hello gemini"
        );
        assert_eq!(
            response["candidates"][0]["content"]["parts"][0]["text"],
            "gemini proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_embed_content_endpoint_forwards_to_selected_upstream_with_native_headers(
    ) {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json_with_headers(
            "POST",
            &format!(
                "{}/v1beta/models/text-embedding-004:embedContent",
                expected_test_public_root_base_url(health.active_port)
            ),
            &[("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)],
            Some(json!({
                "content": {
                    "parts": [{ "text": "embed this content" }]
                }
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1beta/models/text-embedding-004:embedContent")
        );
        assert_eq!(
            capture.x_goog_api_key.as_deref(),
            Some("gemini-upstream-secret")
        );
        assert_eq!(
            capture.body["content"]["parts"][0]["text"],
            "embed this content"
        );
        assert_eq!(response["embedding"]["values"][0], 0.12);

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_v1_generate_content_endpoint_preserves_requested_api_version() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: format!("{}/v1beta", upstream.base_url),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: None,
                models: vec![LocalAiProxyModelSnapshot {
                    id: "gemini-2.5-pro".to_string(),
                    name: "Gemini 2.5 Pro".to_string(),
                }],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json_with_headers(
            "POST",
            &format!(
                "{}/v1/models/gemini-2.5-pro:generateContent",
                expected_test_public_root_base_url(health.active_port)
            ),
            &[("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)],
            Some(json!({
                "contents": [{
                    "role": "user",
                    "parts": [{ "text": "hello gemini stable" }]
                }]
            })),
        );

        let capture = upstream.capture();
        assert_eq!(
            capture.path.as_deref(),
            Some("/v1/models/gemini-2.5-pro:generateContent")
        );
        assert_eq!(
            response["candidates"][0]["content"]["parts"][0]["text"],
            "gemini proxied response"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_models_endpoint_projects_route_models_in_native_shape() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: "https://generativelanguage.googleapis.com".to_string(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let response = request_json_with_headers(
            "GET",
            &format!(
                "{}/v1beta/models",
                expected_test_public_root_base_url(health.active_port)
            ),
            &[("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)],
            None,
        );

        assert_eq!(response["models"][0]["name"], "models/gemini-2.5-pro");
        assert_eq!(
            response["models"][0]["supportedGenerationMethods"][0],
            "generateContent"
        );
        assert_eq!(response["models"][1]["name"], "models/text-embedding-004");
        assert_eq!(
            response["models"][1]["supportedGenerationMethods"][0],
            "embedContent"
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_native_endpoint_rejects_models_not_exposed_by_route() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        runtime.block_on(async {
            let response = reqwest::Client::new()
                .post(format!(
                    "{}/v1beta/models/gemini-2.5-flash:generateContent",
                    expected_test_public_root_base_url(health.active_port)
                ))
                .header("content-type", "application/json")
                .header("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)
                .body(
                    json!({
                        "contents": [{
                            "role": "user",
                            "parts": [{ "text": "hello" }]
                        }]
                    })
                    .to_string(),
                )
                .send()
                .await
                .expect("request");

            assert_eq!(response.status(), StatusCode::NOT_FOUND);
            let body = response.json::<Value>().await.expect("json body");
            assert_eq!(
                body["error"],
                "Gemini model \"gemini-2.5-flash\" is not exposed by local AI proxy route \"Gemini Route\"."
            );
        });
        assert!(upstream.capture.lock().expect("capture").is_none());

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn local_ai_proxy_gemini_native_endpoint_rejects_unsupported_model_actions() {
        let upstream = TestUpstreamServer::start();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: 0,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: upstream.base_url.clone(),
                api_key: "gemini-upstream-secret".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "Text Embedding 004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["desktop-clients".to_string()],
                runtime_config: Default::default(),
            }],
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy");
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        runtime.block_on(async {
            let response = reqwest::Client::new()
                .post(format!(
                    "{}/v1beta/models/text-embedding-004:generateContent",
                    expected_test_public_root_base_url(health.active_port)
                ))
                .header("content-type", "application/json")
                .header("x-goog-api-key", LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY)
                .body(
                    json!({
                        "contents": [{
                            "role": "user",
                            "parts": [{ "text": "hello" }]
                        }]
                    })
                    .to_string(),
                )
                .send()
                .await
                .expect("request");

            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
            let body = response.json::<Value>().await.expect("json body");
            assert_eq!(
                body["error"],
                "Gemini model \"text-embedding-004\" on local AI proxy route \"Gemini Route\" does not support action \"generateContent\"."
            );
        });
        assert!(upstream.capture.lock().expect("capture").is_none());

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn project_managed_openclaw_provider_writes_openclaw_provider_and_defaults() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = sample_projection_snapshot();
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project OpenClaw provider");

        let projected = read_json(&openclaw_config_file_path(&paths));
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["baseUrl"],
            health.base_url
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["apiKey"],
            "${SDKWORK_LOCAL_PROXY_TOKEN}"
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["api"],
            "openai-completions"
        );
        let provider = projected["models"]["providers"]["sdkwork-local-proxy"]
            .as_object()
            .expect("provider object");
        assert!(!provider.contains_key("streaming"));
        assert_eq!(
            projected["agents"]["defaults"]["model"]["primary"],
            "sdkwork-local-proxy/gpt-5.4"
        );
        assert_eq!(
            projected["agents"]["defaults"]["model"]["fallbacks"][0],
            "sdkwork-local-proxy/o4-mini"
        );
    }

    #[test]
    fn project_managed_openclaw_provider_preserves_non_built_in_defaults() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = sample_projection_snapshot();
        let health = sample_projection_health();

        fs::write(
            &paths.openclaw_config_file,
            r#"{
  "models": {
    "providers": {
      "anthropic": {
        "baseUrl": "https://api.anthropic.com/v1",
        "apiKey": "sk-anthropic",
        "models": [
          { "id": "claude-sonnet-4-5", "name": "Claude Sonnet 4.5" }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-5"
      }
    }
  }
}
"#,
        )
        .expect("seed openclaw config");

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project OpenClaw provider");

        let projected = read_json(&openclaw_config_file_path(&paths));
        assert_eq!(
            projected["agents"]["defaults"]["model"]["primary"],
            "anthropic/claude-sonnet-4-5"
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["baseUrl"],
            health.base_url
        );
    }

    #[test]
    fn local_ai_proxy_falls_back_to_dynamic_port_when_requested_port_is_busy() {
        let busy_listener = std::net::TcpListener::bind(("127.0.0.1", 0)).expect("busy listener");
        let busy_port = busy_listener
            .local_addr()
            .expect("busy listener addr")
            .port();
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            requested_port: busy_port,
            ..sample_projection_snapshot()
        };

        let health = service
            .start(&paths, snapshot)
            .expect("start local ai proxy with fallback port");

        assert_ne!(health.active_port, busy_port);
        assert_eq!(
            health.base_url,
            expected_test_public_v1_base_url(health.active_port)
        );

        service.stop().expect("stop local ai proxy");
    }

    #[test]
    fn project_managed_openclaw_provider_enables_streaming_for_translated_protocols_when_proxy_can_translate(
    ) {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: LOCAL_AI_PROXY_DEFAULT_PORT,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-anthropic-openai".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic-openai".to_string(),
                name: "Anthropic via OpenAI".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: "https://api.anthropic.com/v1".to_string(),
                api_key: "sk-anthropic".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        };
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project OpenClaw provider");

        let projected = read_json(&openclaw_config_file_path(&paths));
        let provider = projected["models"]["providers"]["sdkwork-local-proxy"]
            .as_object()
            .expect("provider object");
        assert!(!provider.contains_key("streaming"));
    }

    #[test]
    fn project_managed_openclaw_provider_uses_anthropic_messages_for_native_anthropic_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            default_route_id: "route-anthropic".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-anthropic".to_string(),
                name: "Anthropic Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "anthropic".to_string(),
                upstream_protocol: "anthropic".to_string(),
                provider_id: "anthropic".to_string(),
                upstream_base_url: "https://api.anthropic.com/v1".to_string(),
                api_key: "sk-anthropic".to_string(),
                default_model_id: "claude-sonnet-4-20250514".to_string(),
                reasoning_model_id: Some("claude-opus-4-20250514".to_string()),
                embedding_model_id: None,
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "claude-sonnet-4-20250514".to_string(),
                        name: "Claude Sonnet 4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "claude-opus-4-20250514".to_string(),
                        name: "Claude Opus 4".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
            ..sample_projection_snapshot()
        };
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project OpenClaw provider");

        let projected = read_json(&openclaw_config_file_path(&paths));
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["baseUrl"],
            health.base_url
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["api"],
            "anthropic-messages"
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["auth"],
            "api-key"
        );
    }

    #[test]
    fn project_managed_openclaw_provider_uses_google_generative_ai_for_native_gemini_routes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let snapshot = LocalAiProxySnapshot {
            default_route_id: "route-gemini".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-gemini".to_string(),
                name: "Gemini Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "user".to_string(),
                client_protocol: "gemini".to_string(),
                upstream_protocol: "gemini".to_string(),
                provider_id: "gemini".to_string(),
                upstream_base_url: "https://generativelanguage.googleapis.com".to_string(),
                api_key: "sk-gemini".to_string(),
                default_model_id: "gemini-2.5-pro".to_string(),
                reasoning_model_id: None,
                embedding_model_id: Some("text-embedding-004".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gemini-2.5-pro".to_string(),
                        name: "Gemini 2.5 Pro".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-004".to_string(),
                        name: "text-embedding-004".to_string(),
                    },
                ],
                notes: None,
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
            ..sample_projection_snapshot()
        };
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project OpenClaw provider");

        let projected = read_json(&openclaw_config_file_path(&paths));
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["baseUrl"],
            expected_test_public_root_base_url(LOCAL_AI_PROXY_DEFAULT_PORT)
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["api"],
            "google-generative-ai"
        );
        assert_eq!(
            projected["models"]["providers"]["sdkwork-local-proxy"]["auth"],
            "api-key"
        );
    }

    #[test]
    fn project_managed_openclaw_provider_does_not_persist_legacy_route_runtime_config_fields() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let mut config = AppConfig::default();
        config.storage.active_profile_id = "default-sqlite".to_string();
        config.storage.profiles = vec![StorageProfileConfig {
            id: "default-sqlite".to_string(),
            label: "SQLite".to_string(),
            provider: StorageProviderKind::Sqlite,
            namespace: "claw-studio".to_string(),
            path: Some("profiles/default.db".to_string()),
            connection: None,
            database: None,
            endpoint: None,
            read_only: false,
        }];
        let storage = StorageService::new();

        storage
            .put_text(
                &paths,
                &config,
                StoragePutTextRequest {
                    profile_id: Some("default-sqlite".to_string()),
                    namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                    key: "route-openai".to_string(),
                    value: r#"{
  "id": "route-openai",
  "name": "OpenAI",
  "enabled": true,
  "isDefault": true,
  "managedBy": "user",
  "clientProtocol": "openai-compatible",
  "upstreamProtocol": "openai-compatible",
  "providerId": "openai",
  "upstreamBaseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-openai",
  "defaultModelId": "gpt-5.4",
  "reasoningModelId": "o4-mini",
  "embeddingModelId": "text-embedding-3-large",
  "models": [
    { "id": "gpt-5.4", "name": "GPT-5.4" },
    { "id": "o4-mini", "name": "o4-mini" },
    { "id": "text-embedding-3-large", "name": "text-embedding-3-large" }
  ],
  "config": {
    "temperature": 0.35,
    "topP": 0.9,
    "maxTokens": 24000,
    "timeoutMs": 90000,
    "streaming": false
  },
  "exposeTo": ["openclaw"]
}"#
                    .to_string(),
                },
            )
            .expect("seed provider center route with runtime config");

        let snapshot = materialize_local_ai_proxy_snapshot(
            &paths,
            &config,
            &storage,
            LOCAL_AI_PROXY_DEFAULT_PORT,
            LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY,
        );
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project OpenClaw provider");

        let projected = read_json(&openclaw_config_file_path(&paths));
        let provider = projected["models"]["providers"]["sdkwork-local-proxy"]
            .as_object()
            .expect("provider object");
        assert!(!provider.contains_key("temperature"));
        assert!(!provider.contains_key("topP"));
        assert!(!provider.contains_key("maxTokens"));
        assert!(!provider.contains_key("timeoutMs"));
        assert!(!provider.contains_key("streaming"));
    }

    #[test]
    fn project_managed_openclaw_provider_persists_runtime_config_in_canonical_defaults_model_params(
    ) {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = LocalAiProxyService::new();
        let mut snapshot = sample_projection_snapshot();
        snapshot.routes[0].runtime_config = LocalAiProxyRouteRuntimeConfigSnapshot {
            temperature: serde_json::Number::from_f64(0.35),
            top_p: serde_json::Number::from_f64(0.9),
            max_tokens: Some(24_000),
            timeout_ms: Some(90_000),
            streaming: Some(false),
        };
        let health = sample_projection_health();

        service
            .project_managed_openclaw_provider(&paths, &snapshot, &health)
            .expect("project OpenClaw provider");

        let projected = read_json(&openclaw_config_file_path(&paths));
        assert_eq!(
            projected["agents"]["defaults"]["models"]["sdkwork-local-proxy/gpt-5.4"]["params"]
                ["temperature"],
            json!(0.35)
        );
        assert_eq!(
            projected["agents"]["defaults"]["models"]["sdkwork-local-proxy/gpt-5.4"]["params"]
                ["topP"],
            json!(0.9)
        );
        assert_eq!(
            projected["agents"]["defaults"]["models"]["sdkwork-local-proxy/gpt-5.4"]["params"]
                ["maxTokens"],
            json!(24_000)
        );
        assert_eq!(
            projected["agents"]["defaults"]["models"]["sdkwork-local-proxy/gpt-5.4"]["params"]
                ["timeoutMs"],
            json!(90_000)
        );
        assert_eq!(
            projected["agents"]["defaults"]["models"]["sdkwork-local-proxy/gpt-5.4"]["params"]
                ["streaming"],
            json!(false)
        );
    }

    fn sample_projection_snapshot() -> LocalAiProxySnapshot {
        LocalAiProxySnapshot {
            schema_version: 1,
            bind_host: "127.0.0.1".to_string(),
            requested_port: LOCAL_AI_PROXY_DEFAULT_PORT,
            auth_token: LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY.to_string(),
            default_route_id: "route-sdkwork".to_string(),
            routes: vec![LocalAiProxyRouteSnapshot {
                id: "route-sdkwork".to_string(),
                name: "SDKWork Route".to_string(),
                enabled: true,
                is_default: true,
                managed_by: "system-default".to_string(),
                client_protocol: "openai-compatible".to_string(),
                upstream_protocol: "sdkwork".to_string(),
                provider_id: "sdkwork".to_string(),
                upstream_base_url: "https://ai.sdkwork.com".to_string(),
                api_key: "sk-sdkwork-upstream".to_string(),
                default_model_id: "gpt-5.4".to_string(),
                reasoning_model_id: Some("o4-mini".to_string()),
                embedding_model_id: Some("text-embedding-3-large".to_string()),
                models: vec![
                    LocalAiProxyModelSnapshot {
                        id: "gpt-5.4".to_string(),
                        name: "GPT-5.4".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "o4-mini".to_string(),
                        name: "o4-mini".to_string(),
                    },
                    LocalAiProxyModelSnapshot {
                        id: "text-embedding-3-large".to_string(),
                        name: "text-embedding-3-large".to_string(),
                    },
                ],
                notes: Some("Managed local proxy provider".to_string()),
                expose_to: vec!["openclaw".to_string()],
                runtime_config: Default::default(),
            }],
        }
    }

    fn sample_projection_health() -> super::LocalAiProxyServiceHealth {
        super::LocalAiProxyServiceHealth {
            base_url: expected_test_public_v1_base_url(LOCAL_AI_PROXY_DEFAULT_PORT),
            active_port: LOCAL_AI_PROXY_DEFAULT_PORT,
            loopback_only: true,
            default_route_id: "route-sdkwork".to_string(),
            default_route_name: "SDKWork Route".to_string(),
            default_routes: vec![super::LocalAiProxyDefaultRouteHealth {
                client_protocol: "openai-compatible".to_string(),
                id: "route-sdkwork".to_string(),
                name: "SDKWork Route".to_string(),
                managed_by: "system-default".to_string(),
                upstream_protocol: "sdkwork".to_string(),
                upstream_base_url: "https://ai.sdkwork.com".to_string(),
                model_count: 3,
            }],
            upstream_base_url: "https://ai.sdkwork.com".to_string(),
            model_count: 3,
            snapshot_path: "snapshot.json".to_string(),
            log_path: "proxy.log".to_string(),
        }
    }

    fn expected_test_public_host() -> String {
        super::config::default_local_ai_proxy_public_host()
    }

    fn expected_test_public_root_base_url(port: u16) -> String {
        format!("http://{}:{port}", expected_test_public_host())
    }

    fn expected_test_public_v1_base_url(port: u16) -> String {
        format!("{}/v1", expected_test_public_root_base_url(port))
    }

    fn openclaw_config_file_path(paths: &crate::framework::paths::AppPaths) -> std::path::PathBuf {
        crate::framework::services::kernel_runtime_authority::KernelRuntimeAuthorityService::new()
            .active_config_file_path("openclaw", paths)
            .unwrap_or_else(|_| {
                paths
                    .kernel_paths("openclaw")
                    .map(|kernel| kernel.config_file)
                    .unwrap_or_else(|_| paths.openclaw_config_file.clone())
            })
    }

    fn read_json(path: &std::path::Path) -> Value {
        serde_json::from_str(&fs::read_to_string(path).expect("read projected config"))
            .expect("projected config json")
    }

    fn request_json(
        method: &str,
        url: &str,
        bearer_token: Option<&str>,
        body: Option<Value>,
    ) -> Value {
        let mut headers = Vec::new();
        if let Some(token) = bearer_token {
            headers.push(("authorization", format!("Bearer {token}")));
        }

        let header_refs = headers
            .iter()
            .map(|(name, value)| (*name, value.as_str()))
            .collect::<Vec<_>>();

        request_json_with_headers(method, url, &header_refs, body)
    }

    fn request_json_with_headers(
        method: &str,
        url: &str,
        headers: &[(&str, &str)],
        body: Option<Value>,
    ) -> Value {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        runtime.block_on(async move {
            let client = reqwest::Client::new();
            let mut request = match method {
                "GET" => client.get(url),
                "POST" => client.post(url),
                other => panic!("unsupported method: {other}"),
            };

            for (name, value) in headers {
                request = request.header(*name, *value);
            }
            if let Some(payload) = body {
                request = request.header("content-type", "application/json");
                request = request.body(payload.to_string());
            }

            let response = request.send().await.expect("request");
            let status = response.status();
            let text = response.text().await.expect("response text");
            assert!(
                status.is_success(),
                "expected successful response, got {status}: {text}"
            );
            serde_json::from_str(&text).expect("response json")
        })
    }

    fn request_streaming_response(
        url: &str,
        bearer_token: Option<&str>,
        body: Value,
    ) -> (Duration, String, String) {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        runtime.block_on(async move {
            let client = reqwest::Client::new();
            let mut request = client
                .post(url)
                .header("content-type", "application/json")
                .header("accept", "text/event-stream, application/json")
                .body(body.to_string());
            if let Some(token) = bearer_token {
                request = request.bearer_auth(token);
            }

            let start = Instant::now();
            let mut response = request.send().await.expect("request");
            let status = response.status();
            if !status.is_success() {
                let text = response.text().await.expect("response text");
                panic!("expected successful response, got {status}: {text}");
            }

            let content_type = response
                .headers()
                .get("content-type")
                .and_then(|value| value.to_str().ok())
                .unwrap_or_default()
                .to_string();
            let first_chunk = response
                .chunk()
                .await
                .expect("first chunk read")
                .expect("first chunk");
            let first_chunk_latency = start.elapsed();
            let mut body_bytes = first_chunk.to_vec();
            while let Some(chunk) = response.chunk().await.expect("chunk read") {
                body_bytes.extend_from_slice(&chunk);
            }

            (
                first_chunk_latency,
                content_type,
                String::from_utf8(body_bytes).expect("streaming response utf8"),
            )
        })
    }

    #[derive(Clone, Debug, PartialEq)]
    struct UpstreamCapture {
        path: Option<String>,
        authorization: Option<String>,
        x_api_key: Option<String>,
        x_goog_api_key: Option<String>,
        anthropic_version: Option<String>,
        body: Value,
    }

    struct TestUpstreamServer {
        base_url: String,
        capture: Arc<Mutex<Option<UpstreamCapture>>>,
        handle: Option<LocalApiProxyServerHandle>,
    }

    impl TestUpstreamServer {
        fn start() -> Self {
            let capture = Arc::new(Mutex::new(None));
            let state = capture.clone();
            async fn chat_handler(
                State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                headers: HeaderMap,
                uri: axum::http::Uri,
                Json(body): Json<Value>,
            ) -> axum::response::Response {
                let stream = body.get("stream").and_then(Value::as_bool).unwrap_or(false);
                let detailed_usage_requested = body
                    .pointer("/messages/0/content")
                    .and_then(Value::as_str)
                    .map(|value| value.contains("usage detail request"))
                    .unwrap_or(false);
                *capture.lock().expect("capture") = Some(UpstreamCapture {
                    path: uri.path_and_query().map(|value| value.to_string()),
                    authorization: headers
                        .get("authorization")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_api_key: headers
                        .get("x-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_goog_api_key: headers
                        .get("x-goog-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    anthropic_version: headers
                        .get("anthropic-version")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    body,
                });

                if stream {
                    let stream = async_stream::stream! {
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "data: {\"choices\":[{\"delta\":{\"content\":\"proxied chunk 1\"}}]}\n\n",
                        ));
                        tokio::time::sleep(Duration::from_millis(900)).await;
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "data: {\"choices\":[{\"delta\":{\"content\":\"proxied chunk 2\"}}]}\n\n",
                        ));
                        yield Ok::<Bytes, std::io::Error>(Bytes::from("data: [DONE]\n\n"));
                    };

                    return axum::response::Response::builder()
                        .status(StatusCode::OK)
                        .header("content-type", "text/event-stream")
                        .body(axum::body::Body::from_stream(stream))
                        .expect("stream response");
                }

                (
                    StatusCode::OK,
                    Json(json!({
                        "id": "chatcmpl-local-proxy",
                        "object": "chat.completion",
                        "choices": [
                            {
                                "index": 0,
                                "message": {
                                    "role": "assistant",
                                    "content": "proxied response"
                                }
                            }
                        ],
                        "usage": detailed_usage_requested.then_some(json!({
                            "prompt_tokens": 12_307,
                            "completion_tokens": 6,
                            "total_tokens": 12_313,
                            "prompt_tokens_details": {
                                "cached_tokens": 4_096
                            }
                        }))
                    })),
                )
                    .into_response()
            }

            async fn responses_handler(
                State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                headers: HeaderMap,
                uri: axum::http::Uri,
                Json(body): Json<Value>,
            ) -> impl IntoResponse {
                let detailed_usage_requested = body
                    .pointer("/input")
                    .map(Value::to_string)
                    .map(|value| value.contains("responses usage detail request"))
                    .unwrap_or(false);
                *capture.lock().expect("capture") = Some(UpstreamCapture {
                    path: uri.path_and_query().map(|value| value.to_string()),
                    authorization: headers
                        .get("authorization")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_api_key: headers
                        .get("x-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_goog_api_key: headers
                        .get("x-goog-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    anthropic_version: headers
                        .get("anthropic-version")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    body,
                });

                (
                    StatusCode::OK,
                    Json(json!({
                        "id": "resp_local_proxy",
                        "object": "response",
                        "output": [
                            {
                                "type": "message",
                                "role": "assistant",
                                "content": [
                                    {
                                        "type": "output_text",
                                        "text": "responses proxied response"
                                    }
                                ]
                            }
                        ],
                        "usage": detailed_usage_requested.then_some(json!({
                            "input_tokens": 12_307,
                            "output_tokens": 6,
                            "total_tokens": 12_313,
                            "input_tokens_details": {
                                "cached_tokens": 4_096
                            }
                        }))
                    })),
                )
            }

            async fn embeddings_handler(
                State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                headers: HeaderMap,
                uri: axum::http::Uri,
                Json(body): Json<Value>,
            ) -> impl IntoResponse {
                *capture.lock().expect("capture") = Some(UpstreamCapture {
                    path: uri.path_and_query().map(|value| value.to_string()),
                    authorization: headers
                        .get("authorization")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_api_key: headers
                        .get("x-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_goog_api_key: headers
                        .get("x-goog-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    anthropic_version: headers
                        .get("anthropic-version")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    body,
                });

                (
                    StatusCode::OK,
                    Json(json!({
                        "object": "list",
                        "data": [
                            {
                                "object": "embedding",
                                "index": 0,
                                "embedding": [0.12, 0.34, 0.56]
                            }
                        ]
                    })),
                )
            }

            async fn anthropic_messages_handler(
                State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                headers: HeaderMap,
                uri: axum::http::Uri,
                Json(body): Json<Value>,
            ) -> axum::response::Response {
                let stream = body.get("stream").and_then(Value::as_bool).unwrap_or(false);
                *capture.lock().expect("capture") = Some(UpstreamCapture {
                    path: uri.path_and_query().map(|value| value.to_string()),
                    authorization: headers
                        .get("authorization")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_api_key: headers
                        .get("x-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_goog_api_key: headers
                        .get("x-goog-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    anthropic_version: headers
                        .get("anthropic-version")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    body,
                });

                if stream {
                    let stream = async_stream::stream! {
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg-local-proxy\",\"model\":\"claude-sonnet-4-20250514\",\"usage\":{\"input_tokens\":12,\"output_tokens\":0},\"content\":[]}}\n\n",
                        ));
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"anthropic stream chunk 1\"}}\n\n",
                        ));
                        tokio::time::sleep(Duration::from_millis(900)).await;
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"anthropic stream chunk 2\"}}\n\n",
                        ));
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"},\"usage\":{\"output_tokens\":8}}\n\n",
                        ));
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n",
                        ));
                    };

                    return axum::response::Response::builder()
                        .status(StatusCode::OK)
                        .header("content-type", "text/event-stream")
                        .body(axum::body::Body::from_stream(stream))
                        .expect("stream response");
                }

                (
                    StatusCode::OK,
                    Json(json!({
                        "id": "msg-local-proxy",
                        "type": "message",
                        "model": "claude-sonnet-4-20250514",
                        "role": "assistant",
                        "content": [
                            {
                                "type": "text",
                                "text": "anthropic proxied response"
                            }
                        ],
                        "usage": {
                            "input_tokens": 12,
                            "output_tokens": 8
                        }
                    })),
                )
                    .into_response()
            }

            async fn gemini_generate_handler(
                State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                headers: HeaderMap,
                uri: axum::http::Uri,
                Json(body): Json<Value>,
            ) -> axum::response::Response {
                let stream = uri.path().contains(":streamGenerateContent");
                *capture.lock().expect("capture") = Some(UpstreamCapture {
                    path: uri.path_and_query().map(|value| value.to_string()),
                    authorization: headers
                        .get("authorization")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_api_key: headers
                        .get("x-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_goog_api_key: headers
                        .get("x-goog-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    anthropic_version: headers
                        .get("anthropic-version")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    body,
                });

                if stream {
                    let stream = async_stream::stream! {
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"gemini stream chunk 1\"}]}}]}\n\n",
                        ));
                        tokio::time::sleep(Duration::from_millis(900)).await;
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"gemini stream chunk 2\"}],\"role\":\"model\"},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"promptTokenCount\":10,\"candidatesTokenCount\":8,\"totalTokenCount\":18}}\n\n",
                        ));
                    };

                    return axum::response::Response::builder()
                        .status(StatusCode::OK)
                        .header("content-type", "text/event-stream")
                        .body(axum::body::Body::from_stream(stream))
                        .expect("stream response");
                }

                (
                    StatusCode::OK,
                    Json(json!({
                        "candidates": [
                            {
                                "content": {
                                    "parts": [
                                        { "text": "gemini proxied response" }
                                    ]
                                }
                            }
                        ],
                        "usageMetadata": {
                            "promptTokenCount": 10,
                            "candidatesTokenCount": 8,
                            "totalTokenCount": 18
                        }
                    })),
                )
                    .into_response()
            }

            async fn gemini_embed_handler(
                State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                headers: HeaderMap,
                uri: axum::http::Uri,
                Json(body): Json<Value>,
            ) -> impl IntoResponse {
                *capture.lock().expect("capture") = Some(UpstreamCapture {
                    path: uri.path_and_query().map(|value| value.to_string()),
                    authorization: headers
                        .get("authorization")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_api_key: headers
                        .get("x-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_goog_api_key: headers
                        .get("x-goog-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    anthropic_version: headers
                        .get("anthropic-version")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    body,
                });

                (
                    StatusCode::OK,
                    Json(json!({
                        "embedding": {
                            "values": [0.12, 0.34, 0.56]
                        }
                    })),
                )
            }

            async fn ollama_chat_handler(
                State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                headers: HeaderMap,
                uri: axum::http::Uri,
                Json(body): Json<Value>,
            ) -> axum::response::Response {
                let stream = body.get("stream").and_then(Value::as_bool).unwrap_or(false);
                *capture.lock().expect("capture") = Some(UpstreamCapture {
                    path: uri.path_and_query().map(|value| value.to_string()),
                    authorization: headers
                        .get("authorization")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_api_key: headers
                        .get("x-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_goog_api_key: headers
                        .get("x-goog-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    anthropic_version: headers
                        .get("anthropic-version")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    body,
                });

                if stream {
                    let stream = async_stream::stream! {
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "{\"model\":\"glm-4.7-flash\",\"message\":{\"role\":\"assistant\",\"content\":\"ollama stream chunk 1\"},\"done\":false}\n",
                        ));
                        tokio::time::sleep(Duration::from_millis(900)).await;
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "{\"model\":\"glm-4.7-flash\",\"message\":{\"role\":\"assistant\",\"content\":\"ollama stream chunk 2\"},\"done\":false}\n",
                        ));
                        yield Ok::<Bytes, std::io::Error>(Bytes::from(
                            "{\"model\":\"glm-4.7-flash\",\"message\":{\"role\":\"assistant\",\"content\":\"\"},\"done\":true,\"done_reason\":\"stop\",\"prompt_eval_count\":10,\"eval_count\":8}\n",
                        ));
                    };

                    return axum::response::Response::builder()
                        .status(StatusCode::OK)
                        .header("content-type", "application/x-ndjson")
                        .body(axum::body::Body::from_stream(stream))
                        .expect("ollama stream response");
                }

                (
                    StatusCode::OK,
                    Json(json!({
                        "model": "glm-4.7-flash",
                        "message": {
                            "role": "assistant",
                            "content": "ollama proxied response"
                        },
                        "done": true,
                        "done_reason": "stop",
                        "prompt_eval_count": 10,
                        "eval_count": 8
                    })),
                )
                    .into_response()
            }

            async fn ollama_embed_handler(
                State(capture): State<Arc<Mutex<Option<UpstreamCapture>>>>,
                headers: HeaderMap,
                uri: axum::http::Uri,
                Json(body): Json<Value>,
            ) -> impl IntoResponse {
                *capture.lock().expect("capture") = Some(UpstreamCapture {
                    path: uri.path_and_query().map(|value| value.to_string()),
                    authorization: headers
                        .get("authorization")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_api_key: headers
                        .get("x-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    x_goog_api_key: headers
                        .get("x-goog-api-key")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    anthropic_version: headers
                        .get("anthropic-version")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string()),
                    body,
                });

                (
                    StatusCode::OK,
                    Json(json!({
                        "model": "nomic-embed-text",
                        "embeddings": [[0.12, 0.34, 0.56]],
                        "prompt_eval_count": 5
                    })),
                )
            }

            let router = Router::new()
                .route("/v1/chat/completions", post(chat_handler))
                .route("/openai/v1/chat/completions", post(chat_handler))
                .route("/v1/responses", post(responses_handler))
                .route("/v1/embeddings", post(embeddings_handler))
                .route("/v1/messages", post(anthropic_messages_handler))
                .route(
                    "/v1beta/models/gemini-2.5-pro:generateContent",
                    post(gemini_generate_handler),
                )
                .route(
                    "/v1beta/models/gemini-2.5-pro:streamGenerateContent",
                    post(gemini_generate_handler),
                )
                .route(
                    "/v1/models/gemini-2.5-pro:generateContent",
                    post(gemini_generate_handler),
                )
                .route(
                    "/v1/models/gemini-2.5-pro:streamGenerateContent",
                    post(gemini_generate_handler),
                )
                .route(
                    "/v1beta/models/text-embedding-004:embedContent",
                    post(gemini_embed_handler),
                )
                .route("/api/chat", post(ollama_chat_handler))
                .route("/api/embed", post(ollama_embed_handler))
                .with_state(state);
            let server = start_local_api_proxy_server(
                router,
                "127.0.0.1".to_string(),
                0,
                Duration::from_secs(10),
                |error| eprintln!("test upstream server stopped unexpectedly: {error}"),
            )
            .expect("start upstream server");

            Self {
                base_url: format!("http://127.0.0.1:{}", server.active_port),
                capture,
                handle: Some(server.handle),
            }
        }

        fn capture(&self) -> UpstreamCapture {
            self.capture
                .lock()
                .expect("capture")
                .clone()
                .expect("captured request")
        }
    }

    impl Drop for TestUpstreamServer {
        fn drop(&mut self) {
            if let Some(handle) = self.handle.as_mut() {
                handle.stop();
            }
        }
    }
}
