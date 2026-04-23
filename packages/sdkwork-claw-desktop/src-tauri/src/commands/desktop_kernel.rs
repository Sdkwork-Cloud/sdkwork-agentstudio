use crate::{
    framework::{
        kernel::{DesktopKernelInfo, DesktopLocalAiProxyRouteTestRecord},
        kernel_host::types::DesktopKernelHostInfo,
        runtime,
        services::local_ai_proxy_observability::{
            LocalAiProxyMessageCaptureSettings, LocalAiProxyMessageLogRecord,
            LocalAiProxyMessageLogsQuery, LocalAiProxyPaginatedResult,
            LocalAiProxyRequestLogRecord, LocalAiProxyRequestLogsQuery,
        },
        storage::StorageInfo,
        Result as FrameworkResult,
    },
    state::AppState,
};

pub fn desktop_kernel_info_from_state(state: &AppState) -> FrameworkResult<DesktopKernelInfo> {
    let config = state.config_snapshot();

    state
        .context
        .services
        .desktop_kernel_info(&state.paths, &config)
}

pub fn desktop_storage_info_from_state(state: &AppState) -> StorageInfo {
    let config = state.config_snapshot();

    state
        .context
        .services
        .desktop_storage_info(&state.paths, &config)
}

pub fn desktop_kernel_status_from_state(
    state: &AppState,
) -> FrameworkResult<DesktopKernelHostInfo> {
    state
        .context
        .services
        .desktop_kernel_host_status(&state.paths)
}

pub fn test_local_ai_proxy_route_from_state(
    state: &AppState,
    route_id: &str,
) -> FrameworkResult<DesktopLocalAiProxyRouteTestRecord> {
    let record = state
        .context
        .services
        .local_ai_proxy
        .test_route_by_id(route_id)?;
    Ok(DesktopLocalAiProxyRouteTestRecord {
        route_id: record.route_id,
        status: record.status,
        tested_at: record.tested_at,
        latency_ms: record.latency_ms,
        checked_capability: record.checked_capability,
        model_id: record.model_id,
        error: record.error,
    })
}

pub fn list_local_ai_proxy_request_logs_from_state(
    state: &AppState,
    query: LocalAiProxyRequestLogsQuery,
) -> FrameworkResult<LocalAiProxyPaginatedResult<LocalAiProxyRequestLogRecord>> {
    state
        .context
        .services
        .local_ai_proxy
        .list_request_logs(&state.paths, query)
}

pub fn list_local_ai_proxy_message_logs_from_state(
    state: &AppState,
    query: LocalAiProxyMessageLogsQuery,
) -> FrameworkResult<LocalAiProxyPaginatedResult<LocalAiProxyMessageLogRecord>> {
    state
        .context
        .services
        .local_ai_proxy
        .list_message_logs(&state.paths, query)
}

pub fn update_local_ai_proxy_message_capture_from_state(
    state: &AppState,
    enabled: bool,
) -> FrameworkResult<LocalAiProxyMessageCaptureSettings> {
    state
        .context
        .services
        .local_ai_proxy
        .update_message_capture_settings(&state.paths, enabled)
}

#[tauri::command]
pub async fn desktop_kernel_info(
    state: tauri::State<'_, AppState>,
) -> Result<DesktopKernelInfo, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.kernel_info", move || {
        desktop_kernel_info_from_state(&state)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn desktop_kernel_status(
    state: tauri::State<'_, AppState>,
) -> Result<DesktopKernelHostInfo, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.kernel_status", move || {
        desktop_kernel_status_from_state(&state)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn ensure_desktop_kernel_running(
    state: tauri::State<'_, AppState>,
) -> Result<DesktopKernelHostInfo, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.ensure_kernel_running", move || {
        state
            .context
            .services
            .ensure_desktop_kernel_running(&state.paths, &state.config_snapshot())
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn restart_desktop_kernel(
    state: tauri::State<'_, AppState>,
) -> Result<DesktopKernelHostInfo, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.restart_kernel", move || {
        state
            .context
            .services
            .restart_desktop_kernel(&state.paths, &state.config_snapshot())
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn test_local_ai_proxy_route(
    state: tauri::State<'_, AppState>,
    route_id: String,
) -> Result<DesktopLocalAiProxyRouteTestRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.test_local_ai_proxy_route", move || {
        test_local_ai_proxy_route_from_state(&state, &route_id)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_local_ai_proxy_request_logs(
    state: tauri::State<'_, AppState>,
    query: LocalAiProxyRequestLogsQuery,
) -> Result<LocalAiProxyPaginatedResult<LocalAiProxyRequestLogRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.list_local_ai_proxy_request_logs", move || {
        list_local_ai_proxy_request_logs_from_state(&state, query)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_local_ai_proxy_message_logs(
    state: tauri::State<'_, AppState>,
    query: LocalAiProxyMessageLogsQuery,
) -> Result<LocalAiProxyPaginatedResult<LocalAiProxyMessageLogRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.list_local_ai_proxy_message_logs", move || {
        list_local_ai_proxy_message_logs_from_state(&state, query)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn update_local_ai_proxy_message_capture(
    state: tauri::State<'_, AppState>,
    enabled: bool,
) -> Result<LocalAiProxyMessageCaptureSettings, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.update_local_ai_proxy_message_capture", move || {
        update_local_ai_proxy_message_capture_from_state(&state, enabled)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn desktop_storage_info(
    state: tauri::State<'_, AppState>,
) -> Result<StorageInfo, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.storage_info", move || {
        Ok::<_, crate::framework::FrameworkError>(desktop_storage_info_from_state(&state))
    })
    .await
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        desktop_kernel_info_from_state, desktop_kernel_status_from_state,
        desktop_storage_info_from_state, list_local_ai_proxy_message_logs_from_state,
        list_local_ai_proxy_request_logs_from_state, test_local_ai_proxy_route_from_state,
    };
    use crate::{
        framework::{
            config::AppConfig,
            context::FrameworkContext,
            logging::init_logger,
            paths::resolve_paths_for_root,
            services::local_ai_proxy_observability::{
                LocalAiProxyMessageLogsQuery, LocalAiProxyRequestLogsQuery,
            },
            services::local_ai_proxy_snapshot::{
                LocalAiProxyModelSnapshot, LocalAiProxyRouteSnapshot, LocalAiProxySnapshot,
                LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY,
            },
        },
        state::AppState,
    };
    use std::{fs, sync::Arc};

    fn normalize_path_suffix(path: &str) -> String {
        path.replace('\\', "/")
    }

    #[test]
    fn desktop_kernel_info_exposes_extended_runtime_directories() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let info = desktop_kernel_info_from_state(&state).expect("kernel info");

        assert!(normalize_path_suffix(&info.directories.install_root).ends_with("install"));
        assert!(normalize_path_suffix(&info.directories.modules_dir).ends_with("install/modules"));
        assert!(normalize_path_suffix(&info.directories.runtimes_dir).ends_with("install/runtimes"));
        assert!(normalize_path_suffix(&info.directories.machine_root).ends_with("machine"));
        assert!(
            normalize_path_suffix(&info.directories.machine_state_dir).ends_with("machine/state")
        );
        assert!(
            normalize_path_suffix(&info.directories.machine_store_dir).ends_with("machine/store")
        );
        assert!(normalize_path_suffix(&info.directories.machine_staging_dir)
            .ends_with("machine/staging"));
        assert!(normalize_path_suffix(&info.directories.user_root).ends_with("user-home"));
        assert!(normalize_path_suffix(&info.directories.studio_dir).ends_with("user-home/studio"));
        assert!(normalize_path_suffix(&info.directories.storage_dir)
            .ends_with("user-home/user/storage"));
        assert!(normalize_path_suffix(&info.directories.plugins_dir)
            .ends_with("install/extensions/plugins"));
        assert!(info
            .directories
            .integrations_dir
            .replace('\\', "/")
            .ends_with("user-home/user/integrations"));
        assert!(normalize_path_suffix(&info.directories.backups_dir)
            .ends_with("user-home/studio/backups"));
        assert!(info.filesystem.supports_binary_io);
        assert!(info
            .process
            .available_profiles
            .iter()
            .any(|profile| profile.id == "diagnostics.echo"));
        assert_eq!(info.process.active_job_count, 0);
        assert_eq!(info.process.active_process_job_count, 0);
        assert!(info
            .permissions
            .entries
            .iter()
            .any(|entry| entry.key == "filesystem.managedRoots"));
        assert!(info
            .permissions
            .entries
            .iter()
            .any(|entry| entry.key == "browser.externalHttp"));
        assert_eq!(info.notifications.provider, "native");
        assert!(info
            .notifications
            .available_providers
            .iter()
            .any(|provider| provider.id == "native"));
        assert_eq!(info.payments.provider, "none");
        assert!(info
            .payments
            .available_providers
            .iter()
            .any(|provider| provider.id == "stripe"));
        assert!(info
            .integrations
            .available_adapters
            .iter()
            .any(|adapter| adapter.id == "plugin-host"));
        assert_eq!(info.supervisor.service_count, 1);
        assert_eq!(
            info.supervisor.managed_service_ids,
            vec!["openclaw_gateway".to_string()]
        );
        assert_eq!(info.supervisor.lifecycle, "running");
        assert_eq!(info.bundled_components.component_count, 0);
        assert_eq!(info.bundled_components.package_profile_id, "openclaw-only");
        assert_eq!(
            info.bundled_components.included_kernel_ids,
            vec!["openclaw"]
        );
        assert_eq!(info.bundled_components.component_count, 0);
        assert_eq!(
            info.bundled_components.default_enabled_kernel_ids,
            vec!["openclaw"]
        );
        assert!(info
            .bundled_components
            .default_startup_component_ids
            .is_empty());
        assert_eq!(info.host.topology.kind, "localManagedNative");
        assert_eq!(info.host.topology.state, "installed");
        assert_eq!(info.host.runtime.state, "stopped");
        assert_eq!(info.host.endpoint.preferred_port, 21_280);
        assert!(info.host.endpoint.base_url.starts_with("http://127.0.0.1:"));
        assert!(info.host.host.attach_supported);
        assert!(info.host.host.repair_supported);
        assert!(info.local_ai_proxy.route_metrics.is_empty());
        assert!(info.local_ai_proxy.route_tests.is_empty());
        assert!(!info.local_ai_proxy.message_capture_enabled);
        let payload = serde_json::to_value(&info).expect("kernel info json");
        assert_eq!(payload["activeRuntime"]["runtimeId"], "openclaw");
        assert_eq!(payload["activeRuntime"]["state"], "stopped");
        assert_eq!(payload["activeRuntime"]["health"], "degraded");
        assert!(normalize_path_suffix(
            payload["activeRuntime"]["configFile"]
                .as_str()
                .expect("active runtime config file"),
        )
        .ends_with("user-home/.openclaw/openclaw.json"));
        assert!(normalize_path_suffix(
            payload["activeRuntime"]["authority"]["configFile"]
                .as_str()
                .expect("active runtime config file"),
        )
        .ends_with("user-home/.openclaw/openclaw.json"));
        assert!(
            payload["activeRuntime"]["authority"]["configFilePath"].is_null(),
            "active runtime authority should not publish legacy configFilePath",
        );
        assert_eq!(payload["openClawRuntime"]["runtimeId"], "openclaw");
        assert_eq!(payload["openClawRuntime"]["lifecycle"], "inactive");
        assert!(normalize_path_suffix(
            payload["openClawRuntime"]["homeDir"]
                .as_str()
                .expect("runtime home dir"),
        )
        .ends_with("user-home/.openclaw"));
        assert!(
            payload["openClawRuntime"]["stateDir"].is_null(),
            "openClawRuntime.stateDir should not be published once .openclaw is the single canonical root",
        );
        assert!(normalize_path_suffix(
            payload["openClawRuntime"]["workspaceDir"]
                .as_str()
                .expect("runtime workspace dir"),
        )
        .ends_with("user-home/.openclaw/workspace"));
        assert!(normalize_path_suffix(
            payload["openClawRuntime"]["configFile"]
                .as_str()
                .expect("runtime config file"),
        )
        .ends_with("user-home/.openclaw/openclaw.json"));
        assert!(normalize_path_suffix(
            payload["openClawRuntime"]["authority"]["configFile"]
                .as_str()
                .expect("authority config file"),
        )
        .ends_with("user-home/.openclaw/openclaw.json"));
        assert!(
            payload["openClawRuntime"]["authority"]["configFilePath"].is_null(),
            "openclaw runtime authority should not publish legacy configFilePath",
        );
        let owned_runtime_roots = payload["openClawRuntime"]["authority"]["ownedRuntimeRoots"]
            .as_array()
            .expect("authority owned runtime roots");
        assert_eq!(owned_runtime_roots.len(), 1);
        assert!(normalize_path_suffix(
            owned_runtime_roots[0]
                .as_str()
                .expect("primary owned runtime root"),
        )
        .ends_with("install/runtimes/openclaw"));
        assert_eq!(
            payload["openClawRuntime"]["authority"]["readinessProbe"]
                ["supportsLoopbackHealthProbe"],
            true
        );
        assert_eq!(
            payload["openClawRuntime"]["authority"]["readinessProbe"]["healthProbeTimeoutMs"],
            750
        );
        assert_eq!(
            payload["openClawRuntime"]["startupChain"][0]["id"],
            "configureOpenClawGateway"
        );
        assert_eq!(
            payload["openClawRuntime"]["startupChain"][0]["status"],
            "pending"
        );
        assert_eq!(
            payload["openClawRuntime"]["startupChain"][1]["id"],
            "ensureLocalAiProxyReady"
        );
        assert_eq!(
            payload["openClawRuntime"]["startupChain"][2]["id"],
            "projectManagedOpenClawProvider"
        );
        assert!(normalize_path_suffix(
            info.local_ai_proxy
                .observability_db_path
                .as_deref()
                .expect("observability db path"),
        )
        .ends_with("machine/store/local-ai-proxy-observability.sqlite3"));
    }

    #[test]
    fn desktop_kernel_info_exposes_persisted_startup_evidence_summary() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let diagnostics_dir = paths.data_dir.join("diagnostics");
        fs::create_dir_all(&diagnostics_dir).expect("create diagnostics dir");
        fs::write(
            diagnostics_dir.join("desktop-startup-evidence.json"),
            r#"{
  "version": 1,
  "status": "passed",
  "phase": "shell-mounted",
  "runId": 11,
  "durationMs": 842,
  "recordedAt": "2026-04-08T10:30:00.000Z",
  "descriptor": {
    "mode": "desktopCombined",
    "lifecycle": "ready",
    "endpointId": "desktop-host",
    "requestedPort": 18797,
    "activePort": 18797,
    "loopbackOnly": true,
    "dynamicPort": false,
    "stateStoreDriver": "sqlite",
    "stateStoreProfileId": "default-sqlite",
    "browserBaseUrl": "http://127.0.0.1:18797"
  },
  "builtInInstance": {
    "id": "managed-openclaw-primary",
    "name": "Local Built-In",
    "version": "2026.4.2",
    "runtimeKind": "openclaw",
    "deploymentMode": "local-managed",
    "transportKind": "openclawGatewayWs",
    "baseUrl": "http://127.0.0.1:18797",
    "websocketUrl": "ws://127.0.0.1:18797/ws",
    "isBuiltIn": true,
    "isDefault": true,
    "status": "online"
  },
  "readinessEvidence": {
    "manageBaseUrl": "http://127.0.0.1:18797",
    "openClawRuntimeLifecycle": "ready",
    "openClawGatewayLifecycle": "ready",
    "ready": true
  },
  "error": {
    "message": "gateway websocket did not become dialable",
    "cause": "socket timeout"
  }
}
"#,
        )
        .expect("write startup evidence");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let info = desktop_kernel_info_from_state(&state).expect("kernel info");
        let payload = serde_json::to_value(&info).expect("kernel info json");

        assert_eq!(payload["desktopStartupEvidence"]["status"], "passed");
        assert_eq!(payload["desktopStartupEvidence"]["phase"], "shell-mounted");
        assert_eq!(payload["desktopStartupEvidence"]["runId"], 11);
        assert_eq!(
            payload["desktopStartupEvidence"]["recordedAt"],
            "2026-04-08T10:30:00.000Z"
        );
        assert_eq!(payload["desktopStartupEvidence"]["durationMs"], 842);
        assert_eq!(
            normalize_path_suffix(
                payload["desktopStartupEvidence"]["evidencePath"]
                    .as_str()
                    .expect("startup evidence path"),
            ),
            normalize_path_suffix(
                &paths
                    .data_dir
                    .join("diagnostics")
                    .join("desktop-startup-evidence.json")
                    .to_string_lossy(),
            )
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["descriptorMode"],
            "desktopCombined"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["descriptorLifecycle"],
            "ready"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["descriptorEndpointId"],
            "desktop-host"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["descriptorActivePort"],
            18797
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["descriptorRequestedPort"],
            18797
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["descriptorLoopbackOnly"],
            true
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["descriptorDynamicPort"],
            false
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["descriptorStateStoreDriver"],
            "sqlite"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["descriptorStateStoreProfileId"],
            "default-sqlite"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["descriptorBrowserBaseUrl"],
            "http://127.0.0.1:18797"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["manageBaseUrl"],
            "http://127.0.0.1:18797"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceId"],
            "managed-openclaw-primary"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceName"],
            "Local Built-In"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceVersion"],
            "2026.4.2"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceRuntimeKind"],
            "openclaw"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceDeploymentMode"],
            "local-managed"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceTransportKind"],
            "openclawGatewayWs"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceBaseUrl"],
            "http://127.0.0.1:18797"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceWebsocketUrl"],
            "ws://127.0.0.1:18797/ws"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceIsBuiltIn"],
            true
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceIsDefault"],
            true
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["builtInInstanceStatus"],
            "online"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["openClawRuntimeLifecycle"],
            "ready"
        );
        assert_eq!(
            payload["desktopStartupEvidence"]["openClawGatewayLifecycle"],
            "ready"
        );
        assert_eq!(payload["desktopStartupEvidence"]["ready"], true);
        assert_eq!(
            payload["desktopStartupEvidence"]["errorCause"],
            "socket timeout"
        );
    }

    #[test]
    fn desktop_kernel_info_exposes_bundle_manifest_kernel_profile_summary() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        fs::create_dir_all(&paths.foundation_components_dir).expect("foundation components dir");
        fs::write(
            paths.foundation_components_dir.join("bundle-manifest.json"),
            r#"{
  "version": 1,
  "packageProfileId": "hermes-only",
  "includedKernelIds": ["hermes"],
  "defaultEnabledKernelIds": ["hermes"]
}
"#,
        )
        .expect("bundle manifest");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let info = desktop_kernel_info_from_state(&state).expect("kernel info");
        let payload = serde_json::to_value(&info).expect("kernel info json");

        assert_eq!(info.bundled_components.package_profile_id, "hermes-only");
        assert_eq!(info.bundled_components.included_kernel_ids, vec!["hermes"]);
        assert_eq!(
            info.bundled_components.default_enabled_kernel_ids,
            vec!["hermes"]
        );
        assert_eq!(
            payload["bundledComponents"]["packageProfileId"],
            "hermes-only"
        );
        assert_eq!(
            payload["bundledComponents"]["includedKernelIds"][0],
            "hermes"
        );
        assert_eq!(
            payload["bundledComponents"]["defaultEnabledKernelIds"][0],
            "hermes"
        );
    }

    #[test]
    fn desktop_kernel_status_aligns_runtime_provenance_with_hermes_only_bundle_profiles() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        fs::create_dir_all(&paths.foundation_components_dir).expect("foundation components dir");
        fs::write(
            paths.foundation_components_dir.join("bundle-manifest.json"),
            r#"{
  "version": 1,
  "packageProfileId": "hermes-only",
  "includedKernelIds": ["hermes"],
  "defaultEnabledKernelIds": ["hermes"]
}
"#,
        )
        .expect("bundle manifest");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let status = desktop_kernel_status_from_state(&state).expect("kernel status");
        let info = desktop_kernel_info_from_state(&state).expect("kernel info");

        assert_eq!(status.provenance.runtime_id, "hermes");
        assert_eq!(info.host.provenance.runtime_id, "hermes");
        assert_eq!(info.active_runtime.runtime_id, "hermes");
        assert_eq!(info.active_runtime.state, info.host.runtime.state);
        assert_eq!(info.active_runtime.install_source.as_str(), "bundled");
        assert_eq!(
            info.active_runtime
                .authority
                .as_ref()
                .map(|authority| authority.runtime_id.as_str()),
            Some("hermes")
        );
        assert_eq!(info.bundled_components.package_profile_id, "hermes-only");
        assert_eq!(
            info.bundled_components.default_enabled_kernel_ids,
            vec!["hermes"]
        );
        let payload = serde_json::to_value(&info).expect("kernel info json");
        assert_eq!(payload["activeRuntime"]["runtimeId"], "hermes");
        assert_eq!(payload["activeRuntime"]["authority"]["runtimeId"], "hermes");
    }

    #[test]
    fn desktop_storage_info_exposes_default_local_profile() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let info = desktop_storage_info_from_state(&state);

        assert_eq!(info.active_profile_id, "default-local");
        assert!(info.profiles.iter().any(|profile| profile.active));
    }

    #[test]
    fn test_local_ai_proxy_route_from_state_returns_latest_probe_record() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);
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

        state
            .context
            .services
            .local_ai_proxy
            .start(&state.paths, snapshot)
            .expect("start local ai proxy");

        let record = test_local_ai_proxy_route_from_state(&state, "route-failed-probe")
            .expect("probe record");

        assert_eq!(record.route_id, "route-failed-probe");
        assert_eq!(record.status, "failed");
        assert_eq!(record.checked_capability, "chat");
        assert!(record
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("failed"));

        let request_logs = list_local_ai_proxy_request_logs_from_state(
            &state,
            LocalAiProxyRequestLogsQuery::default(),
        )
        .expect("request logs");
        let message_logs = list_local_ai_proxy_message_logs_from_state(
            &state,
            LocalAiProxyMessageLogsQuery::default(),
        )
        .expect("message logs");
        assert_eq!(request_logs.page, 1);
        assert_eq!(message_logs.page, 1);

        state
            .context
            .services
            .local_ai_proxy
            .stop()
            .expect("stop local ai proxy");
    }
}
