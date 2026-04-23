use crate::framework::{
    config::AppConfig,
    paths::AppPaths,
    ports::canonical_loopback_port_window_end,
    services::{
        local_ai_proxy::LocalAiProxyService,
        storage::StorageService,
        studio::{
            StudioConversationRecord, StudioCreateInstanceInput, StudioInstanceConfig,
            StudioService, StudioUpdateInstanceInput,
        },
        supervisor::SupervisorService,
    },
    FrameworkError, Result,
};
use sdkwork_claw_host_core::{
    host_endpoints::{
        HostEndpointRecord, HostEndpointRegistration, HostEndpointRegistry, OpenClawLifecycle,
    },
    port_allocator::{allocate_tcp_listener, PortAllocationRequest, PortRange},
};
use sdkwork_claw_host_studio::{
    build_default_studio_public_api_provider, build_typed_studio_public_api_provider,
    StudioOpenClawGatewayInvokeOptions, StudioOpenClawGatewayInvokeRequest,
    StudioPublicApiProvider, TypedStudioPublicApiBackend,
};
use sdkwork_claw_server::{
    bootstrap::{
        build_server_state_from_runtime_contract, LocalAiProxyTargetProvider,
        LocalAiProxyTargetProviderHandle, ManageOpenClawProvider, ManageOpenClawProviderHandle,
        ServerBoundEndpointContext, ServerState, ServerStateStoreSnapshot,
    },
    config::{
        ResolvedServerAuthConfig, ResolvedServerRuntimeConfig, ResolvedServerStateStoreConfig,
    },
    http::api_surface::{
        build_openapi_startup_catalog, write_runtime_openapi_snapshots, PublishedProxyTarget,
    },
    http::router::build_router,
};
use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    net::TcpListener,
    path::{Component, Path, PathBuf},
    sync::{
        mpsc::{self, Sender},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use uuid::Uuid;

pub const DESKTOP_EMBEDDED_HOST_ENDPOINT_ID: &str = "claw-manage-http";
pub const DESKTOP_EMBEDDED_HOST_MODE: &str = "desktopCombined";
#[cfg_attr(not(test), allow(dead_code))]
pub const DESKTOP_EMBEDDED_HOST_DEFAULT_BIND_HOST: &str = "127.0.0.1";
pub const DESKTOP_EMBEDDED_HOST_API_BASE_PATH: &str = "/claw/api/v1";
pub const DESKTOP_EMBEDDED_HOST_MANAGE_BASE_PATH: &str = "/claw/manage/v1";
pub const DESKTOP_EMBEDDED_HOST_INTERNAL_BASE_PATH: &str = "/claw/internal/v1";
const DESKTOP_EMBEDDED_HOST_WEB_DIST_DIR: &str = "web-dist";
const DESKTOP_EMBEDDED_HOST_NESTED_WEB_DIST_DIR: &str = "resources/web-dist";
const DESKTOP_EMBEDDED_HOST_FALLBACK_DIST_DIR: &str = "dist";
const DESKTOP_EMBEDDED_HOST_NESTED_FALLBACK_DIST_DIR: &str = "resources/dist";
const DESKTOP_SOURCE_FRONTEND_DIST_RELATIVE_PATH: &str = "../dist";
const DESKTOP_EMBEDDED_HOST_STARTUP_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedHostRuntimeSnapshot {
    pub mode: String,
    pub api_base_path: String,
    pub manage_base_path: String,
    pub internal_base_path: String,
    pub browser_base_url: String,
    pub browser_session_token: String,
    pub endpoint: HostEndpointRecord,
    pub state_store_driver: String,
    pub state_store: ServerStateStoreSnapshot,
    pub runtime_data_dir: PathBuf,
    pub web_dist_dir: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedHostRuntimeStatus {
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

type SharedEmbeddedHostRuntimeStatus = Arc<Mutex<EmbeddedHostRuntimeStatus>>;

#[derive(Debug)]
pub struct EmbeddedHostServerHandle {
    snapshot: EmbeddedHostRuntimeSnapshot,
    shutdown_tx: Option<Sender<()>>,
    status: SharedEmbeddedHostRuntimeStatus,
    thread: Option<thread::JoinHandle<Result<()>>>,
}

impl EmbeddedHostServerHandle {
    pub fn snapshot(&self) -> &EmbeddedHostRuntimeSnapshot {
        &self.snapshot
    }

    pub fn status(&self) -> EmbeddedHostRuntimeStatus {
        read_embedded_host_runtime_status(&self.status)
    }

    #[cfg(test)]
    pub fn shutdown(mut self) -> Result<()> {
        self.stop_server()
    }

    fn stop_server(&mut self) -> Result<()> {
        if let Some(shutdown_tx) = self.shutdown_tx.take() {
            mark_embedded_host_runtime_stopping(&self.status);
            let _ = shutdown_tx.send(());
        }

        if let Some(thread) = self.thread.take() {
            match thread.join() {
                Ok(Ok(())) => {
                    mark_embedded_host_runtime_stopped(&self.status);
                }
                Ok(Err(error)) => {
                    mark_embedded_host_runtime_failed(&self.status, error.to_string());
                    return Err(error);
                }
                Err(_) => {
                    let error = FrameworkError::Internal(
                        "embedded desktop host thread panicked during shutdown".to_string(),
                    );
                    mark_embedded_host_runtime_failed(&self.status, error.to_string());
                    return Err(error);
                }
            }
        }

        Ok(())
    }
}

impl Drop for EmbeddedHostServerHandle {
    fn drop(&mut self) {
        let _ = self.stop_server();
    }
}

pub fn start_embedded_host_server(
    paths: &AppPaths,
    config: &AppConfig,
    supervisor: &SupervisorService,
    local_ai_proxy: &LocalAiProxyService,
    bind_host: &str,
    requested_port: u16,
    allow_dynamic_port: bool,
) -> Result<EmbeddedHostServerHandle> {
    let bound_listener = allocate_tcp_listener(PortAllocationRequest {
        bind_host: bind_host.trim().to_string(),
        requested_port,
        fallback_range: allow_dynamic_port.then(|| {
            PortRange::new(requested_port, canonical_loopback_port_window_end(requested_port))
        }),
        allow_ephemeral_fallback: false,
    })
    .map_err(FrameworkError::Conflict)?;

    let bind_host = bound_listener.bind_host.clone();
    let requested_port = bound_listener.requested_port;
    let active_port = bound_listener.active_port;
    let dynamic_port = bound_listener.dynamic_port;
    let last_conflict_reason = bound_listener.last_conflict_reason.clone();
    let (server_state, snapshot) = build_embedded_host_server_state(
        paths,
        config,
        supervisor,
        local_ai_proxy,
        bind_host,
        requested_port,
        active_port,
        dynamic_port,
        last_conflict_reason,
    )?;
    let listener = bound_listener.into_listener();
    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>();
    let (ready_tx, ready_rx) = mpsc::channel::<std::result::Result<(), String>>();
    let server_state_for_thread = server_state.clone();
    let runtime_status = new_embedded_host_runtime_status();
    let runtime_status_for_thread = runtime_status.clone();

    let thread = thread::spawn(move || {
        let startup_tx = ready_tx.clone();
        let run_result = run_embedded_host_server(
            listener,
            server_state_for_thread,
            shutdown_rx,
            startup_tx,
            runtime_status_for_thread.clone(),
        );
        match &run_result {
            Ok(()) => mark_embedded_host_runtime_stopped(&runtime_status_for_thread),
            Err(error) => {
                mark_embedded_host_runtime_failed(&runtime_status_for_thread, error.to_string())
            }
        }
        if let Err(error) = &run_result {
            let _ = ready_tx.send(Err(error.to_string()));
        }
        run_result
    });

    let mut handle = EmbeddedHostServerHandle {
        snapshot,
        shutdown_tx: Some(shutdown_tx),
        status: runtime_status,
        thread: Some(thread),
    };
    if let Err(error) =
        wait_for_embedded_host_startup(ready_rx, DESKTOP_EMBEDDED_HOST_STARTUP_TIMEOUT)
    {
        let _ = handle.stop_server();
        return Err(error);
    }

    Ok(handle)
}

fn run_embedded_host_server(
    listener: TcpListener,
    server_state: ServerState,
    shutdown_rx: mpsc::Receiver<()>,
    ready_tx: mpsc::Sender<std::result::Result<(), String>>,
    runtime_status: SharedEmbeddedHostRuntimeStatus,
) -> Result<()> {
    listener
        .set_nonblocking(true)
        .map_err(FrameworkError::from)?;
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|error| FrameworkError::Internal(format!("build tokio runtime: {error}")))?;

    runtime.block_on(async move {
        let listener = tokio::net::TcpListener::from_std(listener).map_err(|error| {
            FrameworkError::Internal(format!("attach embedded host tcp listener: {error}"))
        })?;
        let app = build_router(server_state);
        mark_embedded_host_runtime_ready(&runtime_status);
        let _ = ready_tx.send(Ok(()));
        let shutdown = async move {
            let _ = tokio::task::spawn_blocking(move || shutdown_rx.recv()).await;
        };

        axum::serve(listener, app)
            .with_graceful_shutdown(shutdown)
            .await
            .map_err(|error| {
                FrameworkError::Internal(format!("serve embedded desktop host: {error}"))
            })
    })
}

fn wait_for_embedded_host_startup(
    ready_rx: mpsc::Receiver<std::result::Result<(), String>>,
    timeout: Duration,
) -> Result<()> {
    match ready_rx.recv_timeout(timeout) {
        Ok(Ok(())) => Ok(()),
        Ok(Err(message)) => Err(FrameworkError::Internal(message)),
        Err(mpsc::RecvTimeoutError::Timeout) => Err(FrameworkError::Timeout(format!(
            "timed out waiting for the embedded desktop host to become ready within {}ms",
            timeout.as_millis()
        ))),
        Err(mpsc::RecvTimeoutError::Disconnected) => Err(FrameworkError::Internal(
            "embedded desktop host stopped before reporting ready".to_string(),
        )),
    }
}

fn new_embedded_host_runtime_status() -> SharedEmbeddedHostRuntimeStatus {
    Arc::new(Mutex::new(EmbeddedHostRuntimeStatus {
        lifecycle: "starting".to_string(),
        last_error: None,
    }))
}

fn read_embedded_host_runtime_status(
    runtime_status: &SharedEmbeddedHostRuntimeStatus,
) -> EmbeddedHostRuntimeStatus {
    runtime_status
        .lock()
        .expect("embedded host runtime status lock")
        .clone()
}

fn write_embedded_host_runtime_status(
    runtime_status: &SharedEmbeddedHostRuntimeStatus,
    lifecycle: &str,
    last_error: Option<String>,
) {
    let mut status = runtime_status
        .lock()
        .expect("embedded host runtime status lock");
    status.lifecycle = lifecycle.to_string();
    status.last_error = last_error;
}

fn mark_embedded_host_runtime_ready(runtime_status: &SharedEmbeddedHostRuntimeStatus) {
    write_embedded_host_runtime_status(runtime_status, "ready", None);
}

fn mark_embedded_host_runtime_stopping(runtime_status: &SharedEmbeddedHostRuntimeStatus) {
    let current = read_embedded_host_runtime_status(runtime_status);
    if current.lifecycle != "degraded" && current.lifecycle != "stopped" {
        write_embedded_host_runtime_status(runtime_status, "stopping", current.last_error);
    }
}

fn mark_embedded_host_runtime_stopped(runtime_status: &SharedEmbeddedHostRuntimeStatus) {
    let current = read_embedded_host_runtime_status(runtime_status);
    if current.lifecycle != "degraded" {
        write_embedded_host_runtime_status(runtime_status, "stopped", current.last_error);
    }
}

fn mark_embedded_host_runtime_failed(
    runtime_status: &SharedEmbeddedHostRuntimeStatus,
    message: impl Into<String>,
) {
    write_embedded_host_runtime_status(runtime_status, "degraded", Some(message.into()));
}

fn openclaw_lifecycle_from_projection(value: &str) -> OpenClawLifecycle {
    match value {
        "ready" => OpenClawLifecycle::Ready,
        "starting" => OpenClawLifecycle::Starting,
        "degraded" | "error" => OpenClawLifecycle::Degraded,
        "stopping" => OpenClawLifecycle::Stopping,
        "stopped" | "offline" => OpenClawLifecycle::Stopped,
        _ => OpenClawLifecycle::Inactive,
    }
}

fn endpoint_path_from_record_url(
    url: Option<&str>,
    scheme: &str,
    host: &str,
    port: Option<u16>,
) -> Option<String> {
    let port = port?;
    let url = url?.trim();
    if url.is_empty() {
        return None;
    }

    let prefix = format!("{scheme}://{host}:{port}");
    match url.strip_prefix(&prefix) {
        Some("") | None => None,
        Some(path) => Some(path.to_string()),
    }
}

fn build_desktop_openclaw_control_plane(
    manage_openclaw_provider: &ManageOpenClawProviderHandle,
) -> Result<sdkwork_claw_host_core::openclaw_control_plane::OpenClawControlPlane> {
    let updated_at = 0;
    let endpoints = manage_openclaw_provider
        .list_host_endpoints(updated_at)
        .map_err(FrameworkError::Internal)?;
    let runtime = manage_openclaw_provider
        .get_runtime(updated_at)
        .map_err(FrameworkError::Internal)?;
    let gateway = manage_openclaw_provider
        .get_gateway(updated_at)
        .map_err(FrameworkError::Internal)?;

    let mut registry = HostEndpointRegistry::default();
    for endpoint in endpoints {
        let websocket_scheme = match endpoint.scheme.as_str() {
            "https" => "wss",
            "http" => "ws",
            other => other,
        };
        registry.register(HostEndpointRegistration {
            endpoint_id: endpoint.endpoint_id.clone(),
            bind_host: endpoint.bind_host.clone(),
            requested_port: endpoint.requested_port,
            active_port: endpoint.active_port,
            scheme: endpoint.scheme.clone(),
            base_path: endpoint_path_from_record_url(
                endpoint.base_url.as_deref(),
                endpoint.scheme.as_str(),
                endpoint.bind_host.as_str(),
                endpoint.active_port,
            ),
            websocket_path: endpoint_path_from_record_url(
                endpoint.websocket_url.as_deref(),
                websocket_scheme,
                endpoint.bind_host.as_str(),
                endpoint.active_port,
            ),
            loopback_only: endpoint.loopback_only,
            dynamic_port: endpoint.dynamic_port,
            last_conflict_at: endpoint.last_conflict_at,
            last_conflict_reason: endpoint.last_conflict_reason.clone(),
        });
    }

    let managed_by = if !runtime.managed_by.trim().is_empty() {
        runtime.managed_by.clone()
    } else if !gateway.managed_by.trim().is_empty() {
        gateway.managed_by.clone()
    } else {
        "claw-desktop".to_string()
    };

    let mut control_plane =
        sdkwork_claw_host_core::openclaw_control_plane::OpenClawControlPlane::inactive(managed_by)
            .with_host_endpoints(registry);
    if let Some(endpoint_id) = runtime.endpoint_id {
        control_plane = control_plane.with_runtime_endpoint(
            endpoint_id,
            openclaw_lifecycle_from_projection(runtime.lifecycle.as_str()),
        );
    }
    if let Some(endpoint_id) = gateway.endpoint_id {
        control_plane = control_plane.with_gateway_endpoint(
            endpoint_id,
            openclaw_lifecycle_from_projection(gateway.lifecycle.as_str()),
        );
    }

    Ok(control_plane)
}

fn build_embedded_host_server_state(
    paths: &AppPaths,
    config: &AppConfig,
    supervisor: &SupervisorService,
    local_ai_proxy: &LocalAiProxyService,
    bind_host: String,
    requested_port: u16,
    active_port: u16,
    dynamic_port: bool,
    last_conflict_reason: Option<String>,
) -> Result<(ServerState, EmbeddedHostRuntimeSnapshot)> {
    let runtime_data_dir = paths.machine_state_dir.join("desktop-host");
    fs::create_dir_all(&runtime_data_dir)?;
    let web_dist_dir = resolve_embedded_host_web_dist_dir(paths);

    let runtime_config = ResolvedServerRuntimeConfig {
        host: bind_host.clone(),
        port: requested_port,
        data_dir: runtime_data_dir.clone(),
        web_dist_dir: web_dist_dir.clone(),
        deployment_family: sdkwork_claw_server::config::ServerDeploymentFamily::BareMetal,
        accelerator_profile: None,
        state_store: ResolvedServerStateStoreConfig {
            driver: "sqlite".to_string(),
            sqlite_path: Some(runtime_data_dir.join("host-state.sqlite3")),
            postgres_url: None,
            postgres_schema: None,
        },
        auth: ResolvedServerAuthConfig {
            manage_username: None,
            manage_password: None,
            internal_username: None,
            internal_password: None,
        },
        allow_insecure_public_bind: false,
    };
    let effective_config_path = runtime_data_dir.join("claw-server.config.json");
    let executable_path = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("claw-desktop"));
    let mut server_state = build_server_state_from_runtime_contract(
        &runtime_config,
        effective_config_path,
        executable_path,
        ServerBoundEndpointContext {
            bind_host,
            requested_port,
            active_port,
            dynamic_port,
            last_conflict_reason,
        },
    );
    server_state.auth.browser_session_token = Some(Uuid::new_v4().simple().to_string());
    server_state.set_mode(DESKTOP_EMBEDDED_HOST_MODE);
    server_state.local_ai_proxy_target_provider =
        Some(build_desktop_local_ai_proxy_target_provider(local_ai_proxy));

    let endpoint = server_state
        .openclaw_control_plane
        .list_host_endpoints()
        .into_iter()
        .find(|record| record.endpoint_id == DESKTOP_EMBEDDED_HOST_ENDPOINT_ID)
        .ok_or_else(|| {
            FrameworkError::Internal(
                "canonical desktop embedded host endpoint is missing from server state".to_string(),
            )
        })?;
    let browser_base_url = endpoint.base_url.clone().ok_or_else(|| {
        FrameworkError::Internal(
            "canonical desktop embedded host endpoint is missing a baseUrl".to_string(),
        )
    })?;
    let browser_session_token =
        server_state
            .auth
            .browser_session_token
            .clone()
            .ok_or_else(|| {
                FrameworkError::Internal(
                    "desktop embedded host is missing the browser session token".to_string(),
                )
            })?;
    let snapshot = EmbeddedHostRuntimeSnapshot {
        mode: DESKTOP_EMBEDDED_HOST_MODE.to_string(),
        api_base_path: DESKTOP_EMBEDDED_HOST_API_BASE_PATH.to_string(),
        manage_base_path: DESKTOP_EMBEDDED_HOST_MANAGE_BASE_PATH.to_string(),
        internal_base_path: DESKTOP_EMBEDDED_HOST_INTERNAL_BASE_PATH.to_string(),
        browser_base_url,
        browser_session_token,
        endpoint,
        state_store_driver: server_state.state_store_driver.clone(),
        state_store: server_state.state_store.clone(),
        runtime_data_dir,
        web_dist_dir,
    };
    let manage_openclaw_provider =
        build_desktop_manage_openclaw_provider(paths, config, supervisor, snapshot.clone());
    let desktop_openclaw_control_plane = Arc::new(build_desktop_openclaw_control_plane(
        &manage_openclaw_provider,
    )?);
    let shared_workbench_api = build_default_studio_public_api_provider(
        snapshot.runtime_data_dir.clone(),
        desktop_openclaw_control_plane.clone(),
    )
    .map_err(FrameworkError::Internal)?;

    server_state.openclaw_control_plane = desktop_openclaw_control_plane;
    server_state.manage_openclaw_provider = manage_openclaw_provider;
    server_state.studio_public_api = Some(build_typed_studio_public_api_provider(
        DesktopStudioPublicApiBackend::new(paths, config, supervisor, shared_workbench_api),
    ));
    write_runtime_openapi_snapshots(&server_state, snapshot.browser_base_url.as_str())?;
    println!(
        "{}",
        serde_json::to_string(&build_openapi_startup_catalog(
            &server_state,
            snapshot.browser_base_url.as_str(),
        ))
        .expect("desktop openapi startup catalog should serialize to json")
    );

    Ok((server_state, snapshot))
}

fn resolve_embedded_host_web_dist_dir(paths: &AppPaths) -> PathBuf {
    resolve_embedded_host_web_dist_dir_with_manifest_dir(
        paths,
        Path::new(env!("CARGO_MANIFEST_DIR")),
    )
}

fn resolve_embedded_host_web_dist_dir_with_manifest_dir(
    paths: &AppPaths,
    manifest_dir: &Path,
) -> PathBuf {
    let mut candidates = vec![
        paths.install_root.join(DESKTOP_EMBEDDED_HOST_WEB_DIST_DIR),
        paths
            .install_root
            .join(DESKTOP_EMBEDDED_HOST_NESTED_WEB_DIST_DIR),
        paths
            .install_root
            .join(DESKTOP_EMBEDDED_HOST_FALLBACK_DIST_DIR),
        paths
            .install_root
            .join(DESKTOP_EMBEDDED_HOST_NESTED_FALLBACK_DIST_DIR),
    ];

    if let Some(resource_dir) = resolve_current_resource_dir() {
        candidates.extend([
            resource_dir.join(DESKTOP_EMBEDDED_HOST_WEB_DIST_DIR),
            resource_dir.join(DESKTOP_EMBEDDED_HOST_NESTED_WEB_DIST_DIR),
            resource_dir.join(DESKTOP_EMBEDDED_HOST_FALLBACK_DIST_DIR),
            resource_dir.join(DESKTOP_EMBEDDED_HOST_NESTED_FALLBACK_DIST_DIR),
        ]);
    }

    candidates.push(manifest_dir.join(DESKTOP_SOURCE_FRONTEND_DIST_RELATIVE_PATH));

    candidates
        .into_iter()
        .find(|candidate| candidate.join("index.html").is_file())
        .map(|candidate| normalize_embedded_host_candidate_path(&candidate))
        .unwrap_or_else(|| paths.install_root.join(DESKTOP_EMBEDDED_HOST_WEB_DIST_DIR))
}

fn normalize_embedded_host_candidate_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(Path::new(std::path::MAIN_SEPARATOR_STR)),
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Normal(value) => normalized.push(value),
        }
    }
    normalized
}

fn resolve_current_resource_dir() -> Option<PathBuf> {
    let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    tauri::utils::platform::resource_dir(context.package_info(), &tauri::utils::Env::default()).ok()
}

#[derive(Clone, Debug)]
struct DesktopStudioPublicApiBackend {
    paths: AppPaths,
    config: AppConfig,
    storage: StorageService,
    studio: StudioService,
    supervisor: SupervisorService,
    shared_workbench_api: std::sync::Arc<dyn StudioPublicApiProvider>,
}

impl DesktopStudioPublicApiBackend {
    fn new(
        paths: &AppPaths,
        config: &AppConfig,
        supervisor: &SupervisorService,
        shared_workbench_api: std::sync::Arc<dyn StudioPublicApiProvider>,
    ) -> Self {
        Self {
            paths: paths.clone(),
            config: config.clone(),
            storage: StorageService::new(),
            studio: StudioService::new(),
            supervisor: supervisor.clone(),
            shared_workbench_api,
        }
    }
}

impl TypedStudioPublicApiBackend for DesktopStudioPublicApiBackend {
    type InstanceRecord = crate::framework::services::studio::StudioInstanceRecord;
    type CreateInstanceInput = StudioCreateInstanceInput;
    type UpdateInstanceInput = StudioUpdateInstanceInput;
    type InstanceDetailRecord = crate::framework::services::studio::StudioInstanceDetailRecord;
    type InstanceConfigRecord = StudioInstanceConfig;
    type ConversationRecord = StudioConversationRecord;

    fn list_instances(&self) -> std::result::Result<Vec<Self::InstanceRecord>, String> {
        self.studio
            .list_instances_with_supervisor(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
            )
            .map_err(|error| error.to_string())
    }

    fn create_instance(
        &self,
        input: Self::CreateInstanceInput,
    ) -> std::result::Result<Self::InstanceRecord, String> {
        self.studio
            .create_instance(&self.paths, &self.config, &self.storage, input)
            .map_err(|error| error.to_string())
    }

    fn get_instance(&self, id: &str) -> std::result::Result<Option<Self::InstanceRecord>, String> {
        self.studio
            .get_instance_with_supervisor(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                id,
            )
            .map_err(|error| error.to_string())
    }

    fn update_instance(
        &self,
        id: &str,
        input: Self::UpdateInstanceInput,
    ) -> std::result::Result<Self::InstanceRecord, String> {
        self.studio
            .update_instance(&self.paths, &self.config, &self.storage, id, input)
            .map_err(|error| error.to_string())
    }

    fn delete_instance(&self, id: &str) -> std::result::Result<bool, String> {
        self.studio
            .delete_instance(&self.paths, &self.config, &self.storage, id)
            .map_err(|error| error.to_string())
    }

    fn start_instance(
        &self,
        id: &str,
    ) -> std::result::Result<Option<Self::InstanceRecord>, String> {
        self.studio
            .start_instance(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                id,
            )
            .map_err(|error| error.to_string())
    }

    fn stop_instance(&self, id: &str) -> std::result::Result<Option<Self::InstanceRecord>, String> {
        self.studio
            .stop_instance(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                id,
            )
            .map_err(|error| error.to_string())
    }

    fn restart_instance(
        &self,
        id: &str,
    ) -> std::result::Result<Option<Self::InstanceRecord>, String> {
        self.studio
            .restart_instance(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                id,
            )
            .map_err(|error| error.to_string())
    }

    fn get_instance_detail(
        &self,
        id: &str,
    ) -> std::result::Result<Option<Self::InstanceDetailRecord>, String> {
        let mut detail = self
            .studio
            .get_instance_detail_with_supervisor(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                id,
            )
            .map_err(|error| error.to_string())?;
        let Some(detail_record) = detail.as_mut() else {
            return Ok(None);
        };
        if let Some(shared_detail) = self.shared_workbench_api.get_instance_detail(id)? {
            if let Some(workbench) = shared_detail
                .get("workbench")
                .filter(|value| !value.is_null())
                .cloned()
            {
                detail_record.workbench =
                    Some(serde_json::from_value(workbench).map_err(|error| {
                        format!("deserialize shared studio workbench: {error}")
                    })?);
            }
        }
        Ok(detail)
    }

    fn get_instance_config(
        &self,
        id: &str,
    ) -> std::result::Result<Option<Self::InstanceConfigRecord>, String> {
        self.studio
            .get_instance_config(&self.paths, &self.config, &self.storage, id)
            .map_err(|error| error.to_string())
    }

    fn update_instance_config(
        &self,
        id: &str,
        config: Self::InstanceConfigRecord,
    ) -> std::result::Result<Option<Self::InstanceConfigRecord>, String> {
        self.studio
            .update_instance_config(&self.paths, &self.config, &self.storage, id, config)
            .map_err(|error| error.to_string())
    }

    fn get_instance_logs(&self, id: &str) -> std::result::Result<String, String> {
        self.studio
            .get_instance_logs(&self.paths, &self.config, &self.storage, id)
            .map_err(|error| error.to_string())
    }

    fn create_instance_task(
        &self,
        instance_id: &str,
        payload: Value,
    ) -> std::result::Result<(), String> {
        self.shared_workbench_api
            .create_instance_task(instance_id, payload)
    }

    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> std::result::Result<(), String> {
        self.shared_workbench_api
            .update_instance_task(instance_id, task_id, payload)
    }

    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> std::result::Result<bool, String> {
        self.shared_workbench_api
            .update_instance_file_content(instance_id, file_id, content)
    }

    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> std::result::Result<bool, String> {
        self.shared_workbench_api
            .update_instance_llm_provider_config(instance_id, provider_id, update)
    }

    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> std::result::Result<(), String> {
        self.shared_workbench_api
            .clone_instance_task(instance_id, task_id, name)
    }

    fn run_instance_task_now(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> std::result::Result<Value, String> {
        self.shared_workbench_api
            .run_instance_task_now(instance_id, task_id)
    }

    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> std::result::Result<Vec<Value>, String> {
        self.shared_workbench_api
            .list_instance_task_executions(instance_id, task_id)
            .and_then(|value| {
                value
                    .as_array()
                    .cloned()
                    .ok_or_else(|| "studio task executions payload must be an array".to_string())
            })
    }

    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> std::result::Result<(), String> {
        self.shared_workbench_api
            .update_instance_task_status(instance_id, task_id, status)
    }

    fn delete_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> std::result::Result<bool, String> {
        self.shared_workbench_api
            .delete_instance_task(instance_id, task_id)
    }

    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> std::result::Result<serde_json::Value, String> {
        self.studio
            .invoke_openclaw_gateway(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                instance_id,
                &crate::framework::services::studio::StudioOpenClawGatewayInvokeRequest {
                    tool: request.tool,
                    action: request.action,
                    args: request.args,
                    session_key: request.session_key,
                    dry_run: request.dry_run,
                },
                &crate::framework::services::studio::StudioOpenClawGatewayInvokeOptions {
                    message_channel: options.message_channel,
                    account_id: options.account_id,
                    headers: options.headers,
                },
            )
            .map_err(|error| error.to_string())
    }

    fn list_conversations(
        &self,
        instance_id: &str,
    ) -> std::result::Result<Vec<Self::ConversationRecord>, String> {
        self.studio
            .list_conversations(&self.paths, &self.config, &self.storage, instance_id)
            .map_err(|error| error.to_string())
    }

    fn put_conversation(
        &self,
        id: &str,
        record: Self::ConversationRecord,
    ) -> std::result::Result<Self::ConversationRecord, String> {
        let mut record = record;
        record.id = id.to_string();

        self.studio
            .put_conversation(&self.paths, &self.config, &self.storage, record)
            .map_err(|error| error.to_string())
    }

    fn delete_conversation(&self, id: &str) -> std::result::Result<bool, String> {
        self.studio
            .delete_conversation(&self.paths, &self.config, &self.storage, id)
            .map_err(|error| error.to_string())
    }
}

#[derive(Clone, Debug)]
struct DesktopManageOpenClawProvider {
    paths: AppPaths,
    config: AppConfig,
    storage: StorageService,
    studio: StudioService,
    supervisor: SupervisorService,
    desktop_host_snapshot: EmbeddedHostRuntimeSnapshot,
}

#[derive(Clone, Debug)]
struct DesktopLocalAiProxyTargetProvider {
    local_ai_proxy: LocalAiProxyService,
}

impl LocalAiProxyTargetProvider for DesktopLocalAiProxyTargetProvider {
    fn local_ai_proxy_target(&self) -> Option<PublishedProxyTarget> {
        let status = self.local_ai_proxy.status().ok()?;
        let health = status.health?;
        let base_url = if health.loopback_only {
            format!("http://127.0.0.1:{}", health.active_port)
        } else {
            health.base_url.trim_end_matches("/v1").to_string()
        };
        Some(PublishedProxyTarget {
            id: "local-ai-proxy",
            base_url,
            auth_token: None,
        })
    }
}

fn build_desktop_local_ai_proxy_target_provider(
    local_ai_proxy: &LocalAiProxyService,
) -> LocalAiProxyTargetProviderHandle {
    LocalAiProxyTargetProviderHandle::new(Arc::new(DesktopLocalAiProxyTargetProvider {
        local_ai_proxy: local_ai_proxy.clone(),
    }))
}

impl DesktopManageOpenClawProvider {
    fn new(
        paths: &AppPaths,
        config: &AppConfig,
        supervisor: &SupervisorService,
        desktop_host_snapshot: EmbeddedHostRuntimeSnapshot,
    ) -> Self {
        Self {
            paths: paths.clone(),
            config: config.clone(),
            storage: StorageService::new(),
            studio: StudioService::new(),
            supervisor: supervisor.clone(),
            desktop_host_snapshot,
        }
    }
}

impl ManageOpenClawProvider for DesktopManageOpenClawProvider {
    fn list_host_endpoints(
        &self,
        _updated_at: u64,
    ) -> std::result::Result<Vec<HostEndpointRecord>, String> {
        self.studio
            .get_host_endpoints(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                Some(&self.desktop_host_snapshot),
            )
            .map_err(|error| error.to_string())
    }

    fn get_runtime(
        &self,
        updated_at: u64,
    ) -> std::result::Result<
        sdkwork_claw_host_core::host_endpoints::OpenClawRuntimeProjection,
        String,
    > {
        self.studio
            .get_openclaw_runtime(&self.paths, &self.config, &self.storage, &self.supervisor)
            .map(|mut projection| {
                projection.updated_at = updated_at;
                projection
            })
            .map_err(|error| error.to_string())
    }

    fn get_gateway(
        &self,
        updated_at: u64,
    ) -> std::result::Result<
        sdkwork_claw_host_core::host_endpoints::OpenClawGatewayProjection,
        String,
    > {
        self.studio
            .get_openclaw_gateway(&self.paths, &self.config, &self.storage, &self.supervisor)
            .map(|mut projection| {
                projection.updated_at = updated_at;
                projection
            })
            .map_err(|error| error.to_string())
    }

    fn gateway_invoke_is_available(&self, updated_at: u64) -> bool {
        self.get_gateway(updated_at)
            .is_ok_and(|projection| projection.lifecycle == "ready")
    }

    fn gateway_proxy_target(&self, updated_at: u64) -> Option<PublishedProxyTarget> {
        let gateway = self.get_gateway(updated_at).ok()?;
        if gateway.lifecycle != "ready" {
            return None;
        }

        let runtime = self
            .supervisor
            .configured_openclaw_runtime()
            .ok()
            .flatten()?;
        Some(PublishedProxyTarget {
            id: "openclaw-gateway",
            base_url: gateway.base_url?,
            auth_token: Some(runtime.gateway_auth_token),
        })
    }

    fn invoke_gateway(
        &self,
        request: sdkwork_claw_host_core::openclaw_control_plane::OpenClawGatewayInvokeRequest,
        _updated_at: u64,
    ) -> std::result::Result<Value, String> {
        self.studio
            .invoke_managed_openclaw_gateway(
                &self.paths,
                &self.config,
                &self.storage,
                &self.supervisor,
                request,
            )
            .map_err(|error| error.to_string())
    }
}

fn build_desktop_manage_openclaw_provider(
    paths: &AppPaths,
    config: &AppConfig,
    supervisor: &SupervisorService,
    desktop_host_snapshot: EmbeddedHostRuntimeSnapshot,
) -> ManageOpenClawProviderHandle {
    ManageOpenClawProviderHandle::new(Arc::new(DesktopManageOpenClawProvider::new(
        paths,
        config,
        supervisor,
        desktop_host_snapshot,
    )))
}

#[cfg(test)]
mod tests {
    use super::{
        build_embedded_host_server_state, build_typed_studio_public_api_provider,
        mark_embedded_host_runtime_failed, new_embedded_host_runtime_status,
        resolve_embedded_host_web_dist_dir, resolve_embedded_host_web_dist_dir_with_manifest_dir,
        start_embedded_host_server, wait_for_embedded_host_startup, DesktopStudioPublicApiBackend,
        EmbeddedHostRuntimeSnapshot, EmbeddedHostServerHandle, DESKTOP_EMBEDDED_HOST_API_BASE_PATH,
        DESKTOP_EMBEDDED_HOST_DEFAULT_BIND_HOST, DESKTOP_EMBEDDED_HOST_MODE,
    };
    use crate::framework::{
        config::AppConfig,
        logging::init_logger,
        paths::{resolve_paths_for_root, AppPaths},
        services::{
            local_ai_proxy::LocalAiProxyService,
            openclaw_runtime::ActivatedOpenClawRuntime,
            storage::StorageService,
            studio::{
                StudioConversationRecord, StudioCreateInstanceInput, StudioInstanceConfig,
                StudioInstanceDetailRecord, StudioInstanceRecord, StudioInstanceStatus,
                StudioUpdateInstanceInput,
            },
            supervisor::{SupervisorService, SERVICE_ID_OPENCLAW_GATEWAY},
        },
        FrameworkError,
    };
    use sdkwork_claw_host_core::host_endpoints::HostEndpointRecord;
    use sdkwork_claw_host_studio::{
        StudioOpenClawGatewayInvokeOptions, StudioOpenClawGatewayInvokeRequest,
        StudioPublicApiProvider, TypedStudioPublicApiBackend,
    };
    use sdkwork_claw_server::bootstrap::ServerStateStoreSnapshot;
    use serde_json::Value;
    use std::{
        fs,
        net::TcpListener,
        sync::{mpsc, Arc},
        time::Duration,
    };

    #[derive(Debug)]
    struct NoopSharedWorkbenchBackend;

    impl TypedStudioPublicApiBackend for NoopSharedWorkbenchBackend {
        type InstanceRecord = StudioInstanceRecord;
        type CreateInstanceInput = StudioCreateInstanceInput;
        type UpdateInstanceInput = StudioUpdateInstanceInput;
        type InstanceDetailRecord = StudioInstanceDetailRecord;
        type InstanceConfigRecord = StudioInstanceConfig;
        type ConversationRecord = StudioConversationRecord;

        fn list_instances(&self) -> Result<Vec<Self::InstanceRecord>, String> {
            Ok(Vec::new())
        }

        fn create_instance(
            &self,
            _input: Self::CreateInstanceInput,
        ) -> Result<Self::InstanceRecord, String> {
            Err("unused".to_string())
        }

        fn get_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn update_instance(
            &self,
            _id: &str,
            _input: Self::UpdateInstanceInput,
        ) -> Result<Self::InstanceRecord, String> {
            Err("unused".to_string())
        }

        fn delete_instance(&self, _id: &str) -> Result<bool, String> {
            Ok(false)
        }

        fn start_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn stop_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn restart_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn get_instance_detail(
            &self,
            _id: &str,
        ) -> Result<Option<Self::InstanceDetailRecord>, String> {
            Ok(None)
        }

        fn get_instance_config(
            &self,
            _id: &str,
        ) -> Result<Option<Self::InstanceConfigRecord>, String> {
            Ok(None)
        }

        fn update_instance_config(
            &self,
            _id: &str,
            _config: Self::InstanceConfigRecord,
        ) -> Result<Option<Self::InstanceConfigRecord>, String> {
            Ok(None)
        }

        fn get_instance_logs(&self, _id: &str) -> Result<String, String> {
            Ok(String::new())
        }

        fn invoke_openclaw_gateway(
            &self,
            _instance_id: &str,
            _request: StudioOpenClawGatewayInvokeRequest,
            _options: StudioOpenClawGatewayInvokeOptions,
        ) -> Result<Value, String> {
            Ok(Value::Null)
        }

        fn list_conversations(
            &self,
            _instance_id: &str,
        ) -> Result<Vec<Self::ConversationRecord>, String> {
            Ok(Vec::new())
        }

        fn put_conversation(
            &self,
            _id: &str,
            record: Self::ConversationRecord,
        ) -> Result<Self::ConversationRecord, String> {
            Ok(record)
        }

        fn delete_conversation(&self, _id: &str) -> Result<bool, String> {
            Ok(false)
        }

        fn create_instance_task(&self, _instance_id: &str, _payload: Value) -> Result<(), String> {
            Ok(())
        }

        fn update_instance_task(
            &self,
            _instance_id: &str,
            _task_id: &str,
            _payload: Value,
        ) -> Result<(), String> {
            Ok(())
        }

        fn update_instance_file_content(
            &self,
            _instance_id: &str,
            _file_id: &str,
            _content: String,
        ) -> Result<bool, String> {
            Ok(true)
        }

        fn update_instance_llm_provider_config(
            &self,
            _instance_id: &str,
            _provider_id: &str,
            _update: Value,
        ) -> Result<bool, String> {
            Ok(true)
        }

        fn clone_instance_task(
            &self,
            _instance_id: &str,
            _task_id: &str,
            _name: Option<String>,
        ) -> Result<(), String> {
            Ok(())
        }

        fn run_instance_task_now(
            &self,
            _instance_id: &str,
            _task_id: &str,
        ) -> Result<Value, String> {
            Ok(Value::Null)
        }

        fn list_instance_task_executions(
            &self,
            _instance_id: &str,
            _task_id: &str,
        ) -> Result<Vec<Value>, String> {
            Ok(Vec::new())
        }

        fn update_instance_task_status(
            &self,
            _instance_id: &str,
            _task_id: &str,
            _status: String,
        ) -> Result<(), String> {
            Ok(())
        }

        fn delete_instance_task(&self, _instance_id: &str, _task_id: &str) -> Result<bool, String> {
            Ok(false)
        }
    }

    fn reserve_available_loopback_port() -> u16 {
        TcpListener::bind("127.0.0.1:0")
            .expect("reserve loopback port")
            .local_addr()
            .expect("loopback addr")
            .port()
    }

    fn configured_running_supervisor(paths: &AppPaths) -> SupervisorService {
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

    fn noop_shared_workbench_provider() -> Arc<dyn StudioPublicApiProvider> {
        build_typed_studio_public_api_provider(NoopSharedWorkbenchBackend)
    }

    fn desktop_backend_fixture() -> (tempfile::TempDir, DesktopStudioPublicApiBackend) {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let _context = crate::framework::context::FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        );
        let supervisor = configured_running_supervisor(&paths);
        let backend = DesktopStudioPublicApiBackend::new(
            &paths,
            &AppConfig::default(),
            &supervisor,
            noop_shared_workbench_provider(),
        );

        (root, backend)
    }

    fn test_embedded_host_snapshot() -> EmbeddedHostRuntimeSnapshot {
        let browser_base_url = format!(
            "http://127.0.0.1:{}",
            crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT
        );
        EmbeddedHostRuntimeSnapshot {
            mode: DESKTOP_EMBEDDED_HOST_MODE.to_string(),
            api_base_path: DESKTOP_EMBEDDED_HOST_API_BASE_PATH.to_string(),
            manage_base_path: "/claw/manage/v1".to_string(),
            internal_base_path: "/claw/internal/v1".to_string(),
            browser_base_url: browser_base_url.clone(),
            browser_session_token: "desktop-session-token".to_string(),
            endpoint: HostEndpointRecord {
                endpoint_id: "claw-manage-http".to_string(),
                bind_host: "127.0.0.1".to_string(),
                requested_port: crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT,
                active_port: Some(crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT),
                scheme: "http".to_string(),
                base_url: Some(browser_base_url),
                websocket_url: None,
                loopback_only: true,
                dynamic_port: false,
                last_conflict_at: None,
                last_conflict_reason: None,
            },
            state_store_driver: "sqlite".to_string(),
            state_store: ServerStateStoreSnapshot {
                active_profile_id: "default-sqlite".to_string(),
                providers: Vec::new(),
                profiles: Vec::new(),
            },
            runtime_data_dir: std::path::PathBuf::from("/tmp/desktop-host"),
            web_dist_dir: std::path::PathBuf::from("/tmp/web-dist"),
        }
    }

    #[test]
    fn embedded_host_server_state_defaults_to_sqlite_state_store_driver() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = SupervisorService::for_paths(&paths);
        let local_ai_proxy = LocalAiProxyService::new();

        let (server_state, snapshot) = build_embedded_host_server_state(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &local_ai_proxy,
            "127.0.0.1".to_string(),
            crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT,
            crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT,
            false,
            None,
        )
        .expect("embedded host state");

        assert_eq!(snapshot.mode, DESKTOP_EMBEDDED_HOST_MODE);
        assert_eq!(server_state.mode, DESKTOP_EMBEDDED_HOST_MODE);
        assert_eq!(server_state.state_store_driver, "sqlite");
        assert_eq!(server_state.state_store.active_profile_id, "default-sqlite");
        assert!(
            server_state
                .state_store
                .profiles
                .iter()
                .any(|profile| profile.driver == "sqlite" && profile.active),
            "desktop embedded host should activate the sqlite state store profile by default"
        );
    }

    #[test]
    fn embedded_host_server_state_projects_local_ai_proxy_target_when_the_proxy_is_running() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = SupervisorService::for_paths(&paths);
        let local_ai_proxy = LocalAiProxyService::new();
        let storage = StorageService::new();
        let snapshot = local_ai_proxy
            .ensure_snapshot(&paths, &AppConfig::default(), &storage)
            .expect("local ai proxy snapshot");
        local_ai_proxy
            .start(&paths, snapshot)
            .expect("start local ai proxy");

        let (server_state, _snapshot) = build_embedded_host_server_state(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &local_ai_proxy,
            "127.0.0.1".to_string(),
            crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT,
            crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT,
            false,
            None,
        )
        .expect("embedded host state");

        let target = server_state
            .local_ai_proxy_target()
            .expect("local ai proxy target");

        assert!(target.base_url.starts_with("http://127.0.0.1:"));
        assert!(!target.base_url.ends_with("/v1"));

        local_ai_proxy.stop().expect("stop local ai proxy");
    }

    #[test]
    fn embedded_host_server_state_binds_manage_openclaw_provider_to_live_supervisor_runtime() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = configured_running_supervisor(&paths);
        let local_ai_proxy = LocalAiProxyService::new();

        let (server_state, _snapshot) = build_embedded_host_server_state(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &local_ai_proxy,
            "127.0.0.1".to_string(),
            crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT,
            crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT,
            false,
            None,
        )
        .expect("embedded host state");

        let host_endpoints = server_state
            .manage_openclaw_provider
            .list_host_endpoints(0)
            .expect("manage provider host endpoints");
        let runtime = server_state
            .manage_openclaw_provider
            .get_runtime(0)
            .expect("manage provider runtime");
        let gateway = server_state
            .manage_openclaw_provider
            .get_gateway(0)
            .expect("manage provider gateway");

        assert!(host_endpoints.iter().any(|endpoint| {
            endpoint.endpoint_id == "openclaw-gateway"
                && endpoint.active_port.is_some()
                && endpoint.base_url.as_deref().is_some()
                && endpoint.websocket_url.as_deref().is_some()
        }));
        assert_eq!(runtime.lifecycle, "ready");
        assert_eq!(runtime.endpoint_id.as_deref(), Some("openclaw-gateway"));
        assert_eq!(gateway.lifecycle, "ready");
        assert_eq!(gateway.endpoint_id.as_deref(), Some("openclaw-gateway"));
    }

    #[test]
    fn embedded_host_manage_openclaw_provider_honors_requested_projection_timestamp() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = configured_running_supervisor(&paths);
        let local_ai_proxy = LocalAiProxyService::new();

        let (server_state, _snapshot) = build_embedded_host_server_state(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &local_ai_proxy,
            "127.0.0.1".to_string(),
            crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT,
            crate::framework::ports::DESKTOP_EMBEDDED_HOST_DEFAULT_PORT,
            false,
            None,
        )
        .expect("embedded host state");

        let runtime = server_state
            .manage_openclaw_provider
            .get_runtime(123)
            .expect("manage provider runtime");
        let gateway = server_state
            .manage_openclaw_provider
            .get_gateway(123)
            .expect("manage provider gateway");

        assert_eq!(runtime.updated_at, 123);
        assert_eq!(gateway.updated_at, 123);
    }

    #[test]
    fn embedded_host_startup_wait_returns_internal_error_when_server_thread_reports_failure() {
        let (ready_tx, ready_rx) = mpsc::channel();
        ready_tx
            .send(Err(
                "failed to attach embedded host tcp listener".to_string()
            ))
            .expect("ready channel should accept a startup failure");

        let error = wait_for_embedded_host_startup(ready_rx, Duration::from_millis(50))
            .expect_err("startup wait should surface the server-thread failure");

        assert!(matches!(
            error,
            FrameworkError::Internal(message)
                if message.contains("failed to attach embedded host tcp listener")
        ));
    }

    #[test]
    fn embedded_host_startup_wait_times_out_when_server_thread_never_reports_ready() {
        let (_ready_tx, ready_rx) = mpsc::channel::<std::result::Result<(), String>>();

        let error = wait_for_embedded_host_startup(ready_rx, Duration::from_millis(10))
            .expect_err("startup wait should time out when the server never reports ready");

        assert!(matches!(
            error,
            FrameworkError::Timeout(message)
                if message.contains("embedded desktop host")
        ));
    }

    #[test]
    fn embedded_host_server_handle_reports_ready_status_after_startup() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = SupervisorService::for_paths(&paths);
        let local_ai_proxy = LocalAiProxyService::new();

        let handle = start_embedded_host_server(
            &paths,
            &AppConfig::default(),
            &supervisor,
            &local_ai_proxy,
            DESKTOP_EMBEDDED_HOST_DEFAULT_BIND_HOST,
            AppConfig::default().desktop_host.port,
            true,
        )
        .expect("embedded host should start");

        let status = handle.status();

        assert_eq!(status.lifecycle, "ready");
        assert_eq!(status.last_error, None);

        handle.shutdown().expect("shutdown embedded host");
    }

    #[test]
    fn embedded_host_server_handle_reports_degraded_status_after_background_failure() {
        let runtime_status = new_embedded_host_runtime_status();
        let runtime_status_for_thread = runtime_status.clone();
        let handle = EmbeddedHostServerHandle {
            snapshot: test_embedded_host_snapshot(),
            shutdown_tx: None,
            status: runtime_status,
            thread: Some(std::thread::spawn(move || {
                mark_embedded_host_runtime_failed(
                    &runtime_status_for_thread,
                    "embedded desktop host serve loop stopped unexpectedly",
                );
                Err(FrameworkError::Internal(
                    "embedded desktop host serve loop stopped unexpectedly".to_string(),
                ))
            })),
        };

        std::thread::sleep(Duration::from_millis(20));
        let status = handle.status();

        assert_eq!(status.lifecycle, "degraded");
        assert_eq!(
            status.last_error.as_deref(),
            Some("embedded desktop host serve loop stopped unexpectedly")
        );
    }

    #[test]
    fn embedded_host_shutdown_surfaces_server_thread_errors() {
        let handle = EmbeddedHostServerHandle {
            snapshot: test_embedded_host_snapshot(),
            shutdown_tx: None,
            status: new_embedded_host_runtime_status(),
            thread: Some(std::thread::spawn(|| {
                Err(FrameworkError::Internal(
                    "embedded desktop host serve loop stopped unexpectedly".to_string(),
                ))
            })),
        };

        let error = handle
            .shutdown()
            .expect_err("shutdown should surface embedded host thread errors");

        assert!(matches!(
            error,
            FrameworkError::Internal(message)
                if message.contains("serve loop stopped unexpectedly")
        ));
    }

    #[test]
    fn resolve_embedded_host_web_dist_dir_prefers_nested_resource_root() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let nested_resource_root = paths.install_root.join("resources").join("web-dist");
        fs::create_dir_all(&nested_resource_root).expect("nested resource root");
        fs::write(
            nested_resource_root.join("index.html"),
            "<html><head></head><body></body></html>",
        )
        .expect("resource index");

        let resolved = resolve_embedded_host_web_dist_dir(&paths);

        assert_eq!(resolved, nested_resource_root);
    }

    #[test]
    fn resolve_embedded_host_web_dist_dir_falls_back_to_source_frontend_dist_when_local_resources_are_missing(
    ) {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let manifest_dir = root.path().join("src-tauri");
        let source_frontend_dist = root.path().join("dist");
        fs::create_dir_all(&manifest_dir).expect("manifest dir");
        fs::create_dir_all(&source_frontend_dist).expect("source frontend dist");
        fs::write(
            source_frontend_dist.join("index.html"),
            "<html><head></head><body></body></html>",
        )
        .expect("source dist index");

        let resolved = resolve_embedded_host_web_dist_dir_with_manifest_dir(&paths, &manifest_dir);

        assert_eq!(resolved, source_frontend_dist);
    }

    #[test]
    fn desktop_backend_lists_built_in_instance_as_online_when_supervisor_reports_running() {
        let (_root, backend) = desktop_backend_fixture();

        let instances = backend.list_instances().expect("list instances");
        let built_in = instances
            .into_iter()
            .find(|instance| instance.is_built_in)
            .expect("built-in instance");

        assert_eq!(built_in.status, StudioInstanceStatus::Online);
    }

    #[test]
    fn desktop_backend_detail_projects_built_in_instance_as_online_when_supervisor_reports_running()
    {
        let (_root, backend) = desktop_backend_fixture();

        let detail = backend
            .get_instance_detail("managed-openclaw-primary")
            .expect("instance detail")
            .expect("built-in detail");

        assert_eq!(detail.instance.status, StudioInstanceStatus::Online);
        assert!(detail.observability.last_seen_at.is_some());
    }
}
