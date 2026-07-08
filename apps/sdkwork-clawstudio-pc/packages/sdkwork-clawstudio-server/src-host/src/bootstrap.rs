use std::env;
use std::fmt;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use sdkwork_clawstudio_host_core::host_core_metadata;
use sdkwork_clawstudio_host_core::host_endpoints::{
    HostEndpointRecord, HostEndpointRegistration, HostEndpointRegistry, OpenClawGatewayProjection,
    OpenClawRuntimeProjection,
};
use sdkwork_clawstudio_host_core::internal::node_sessions::NodeSessionRegistry;
use sdkwork_clawstudio_host_core::openclaw_control_plane::{
    OpenClawControlPlane, OpenClawGatewayInvokeRequest,
};
use sdkwork_clawstudio_host_core::rollout::control_plane::RolloutControlPlane;
use sdkwork_clawstudio_host_studio::{build_default_studio_public_api_provider, StudioPublicApiProvider};
use serde::Serialize;
use serde_json::Value;

use crate::config::{
    resolve_server_accelerator_profile, resolve_server_deployment_family,
    ResolvedServerRuntimeConfig, CLAW_SERVER_DEFAULT_STATE_STORE_DRIVER,
};
use crate::http::api_surface::PublishedProxyTarget;
use crate::http::auth::{BasicAuthCredentials, ServerAuthConfig};
use crate::service::{
    current_service_platform, ServerRuntimeContract, ServerServiceControlPlaneHandle,
};

#[cfg_attr(not(test), allow(dead_code))]
#[derive(Debug, Clone, Default)]
pub struct ServerStateOverrides {
    pub host: Option<String>,
    pub port: Option<u16>,
    pub auth: Option<ServerAuthConfig>,
    pub web_dist_dir: Option<PathBuf>,
    pub deployment_family: Option<String>,
    pub accelerator_profile: Option<String>,
    pub allow_insecure_public_bind: Option<bool>,
    pub state_store_driver: Option<String>,
    pub state_store_sqlite_path: Option<PathBuf>,
    pub state_store_postgres_url: Option<String>,
    pub state_store_postgres_schema: Option<String>,
    pub effective_config_path: Option<PathBuf>,
    pub executable_path: Option<PathBuf>,
    pub service_control_plane: Option<ServerServiceControlPlaneHandle>,
    pub manage_openclaw_provider: Option<ManageOpenClawProviderHandle>,
    pub local_ai_proxy_target_provider: Option<LocalAiProxyTargetProviderHandle>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerBoundEndpointContext {
    pub bind_host: String,
    pub requested_port: u16,
    pub active_port: u16,
    pub dynamic_port: bool,
    pub last_conflict_reason: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ServerHostCapabilities {
    pub manage_service_api: bool,
}

impl ServerHostCapabilities {
    pub const fn server() -> Self {
        Self {
            manage_service_api: true,
        }
    }

    pub const fn desktop_combined() -> Self {
        Self {
            manage_service_api: false,
        }
    }

    pub fn for_mode(mode: &str) -> Self {
        match mode {
            "server" => Self::server(),
            _ => Self::desktop_combined(),
        }
    }
}

pub trait ManageOpenClawProvider: Send + Sync {
    fn list_host_endpoints(&self, updated_at: u64) -> Result<Vec<HostEndpointRecord>, String>;
    fn get_runtime(&self, updated_at: u64) -> Result<OpenClawRuntimeProjection, String>;
    fn get_gateway(&self, updated_at: u64) -> Result<OpenClawGatewayProjection, String>;
    fn gateway_invoke_is_available(&self, updated_at: u64) -> bool;
    fn gateway_proxy_target(&self, updated_at: u64) -> Option<PublishedProxyTarget>;
    fn invoke_gateway(
        &self,
        request: OpenClawGatewayInvokeRequest,
        updated_at: u64,
    ) -> Result<Value, String>;
}

#[derive(Clone)]
pub struct ManageOpenClawProviderHandle {
    inner: Arc<dyn ManageOpenClawProvider>,
}

impl ManageOpenClawProviderHandle {
    pub fn new(inner: Arc<dyn ManageOpenClawProvider>) -> Self {
        Self { inner }
    }

    pub fn list_host_endpoints(&self, updated_at: u64) -> Result<Vec<HostEndpointRecord>, String> {
        self.inner.list_host_endpoints(updated_at)
    }

    pub fn get_runtime(&self, updated_at: u64) -> Result<OpenClawRuntimeProjection, String> {
        self.inner.get_runtime(updated_at)
    }

    pub fn get_gateway(&self, updated_at: u64) -> Result<OpenClawGatewayProjection, String> {
        self.inner.get_gateway(updated_at)
    }

    pub fn gateway_invoke_is_available(&self, updated_at: u64) -> bool {
        self.inner.gateway_invoke_is_available(updated_at)
    }

    pub fn gateway_proxy_target(&self, updated_at: u64) -> Option<PublishedProxyTarget> {
        self.inner.gateway_proxy_target(updated_at)
    }

    pub fn invoke_gateway(
        &self,
        request: OpenClawGatewayInvokeRequest,
        updated_at: u64,
    ) -> Result<Value, String> {
        self.inner.invoke_gateway(request, updated_at)
    }
}

impl fmt::Debug for ManageOpenClawProviderHandle {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("ManageOpenClawProviderHandle(..)")
    }
}

#[derive(Debug)]
struct ControlPlaneManageOpenClawProvider {
    openclaw_control_plane: Arc<OpenClawControlPlane>,
}

impl ManageOpenClawProvider for ControlPlaneManageOpenClawProvider {
    fn list_host_endpoints(&self, _updated_at: u64) -> Result<Vec<HostEndpointRecord>, String> {
        Ok(self.openclaw_control_plane.list_host_endpoints())
    }

    fn get_runtime(&self, updated_at: u64) -> Result<OpenClawRuntimeProjection, String> {
        Ok(self.openclaw_control_plane.get_runtime(updated_at))
    }

    fn get_gateway(&self, updated_at: u64) -> Result<OpenClawGatewayProjection, String> {
        Ok(self.openclaw_control_plane.get_gateway(updated_at))
    }

    fn gateway_invoke_is_available(&self, updated_at: u64) -> bool {
        self.openclaw_control_plane
            .get_gateway(updated_at)
            .lifecycle
            == "ready"
    }

    fn gateway_proxy_target(&self, updated_at: u64) -> Option<PublishedProxyTarget> {
        let gateway = self.openclaw_control_plane.get_gateway(updated_at);
        if gateway.lifecycle != "ready" {
            return None;
        }

        gateway.base_url.map(|base_url| PublishedProxyTarget {
            id: "openclaw-gateway",
            base_url,
            auth_token: None,
        })
    }

    fn invoke_gateway(
        &self,
        request: OpenClawGatewayInvokeRequest,
        updated_at: u64,
    ) -> Result<Value, String> {
        self.openclaw_control_plane
            .invoke_gateway(request, updated_at)
    }
}

pub fn build_control_plane_manage_openclaw_provider(
    openclaw_control_plane: Arc<OpenClawControlPlane>,
) -> ManageOpenClawProviderHandle {
    ManageOpenClawProviderHandle::new(Arc::new(ControlPlaneManageOpenClawProvider {
        openclaw_control_plane,
    }))
}

pub fn manage_capability_keys_for_mode(mode: &str) -> Vec<String> {
    let capabilities = ServerHostCapabilities::for_mode(mode);
    let mut capability_keys = vec![
        "manage.rollouts.list".to_string(),
        "manage.rollouts.preview".to_string(),
        "manage.rollouts.start".to_string(),
        "manage.host-endpoints.read".to_string(),
        "manage.openclaw.runtime.read".to_string(),
        "manage.openclaw.gateway.read".to_string(),
        "manage.openclaw.gateway.invoke".to_string(),
    ];

    if capabilities.manage_service_api {
        capability_keys.extend([
            "manage.service.status".to_string(),
            "manage.service.install".to_string(),
            "manage.service.start".to_string(),
            "manage.service.stop".to_string(),
            "manage.service.restart".to_string(),
        ]);
    }

    capability_keys
}

pub fn host_platform_capability_keys_for_mode(mode: &str) -> Vec<String> {
    let mut capability_keys = vec![
        "internal.host-platform.read".to_string(),
        "internal.node-sessions.hello".to_string(),
        "internal.node-sessions.admit".to_string(),
        "internal.node-sessions.heartbeat".to_string(),
        "internal.node-sessions.pull-desired-state".to_string(),
        "internal.node-sessions.ack-desired-state".to_string(),
        "internal.node-sessions.close".to_string(),
        "internal.node-sessions.list".to_string(),
    ];
    capability_keys.extend(manage_capability_keys_for_mode(mode));
    capability_keys
}

pub trait LocalAiProxyTargetProvider: Send + Sync {
    fn local_ai_proxy_target(&self) -> Option<PublishedProxyTarget>;
}

#[derive(Clone)]
pub struct LocalAiProxyTargetProviderHandle {
    inner: Arc<dyn LocalAiProxyTargetProvider>,
}

impl LocalAiProxyTargetProviderHandle {
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn new(inner: Arc<dyn LocalAiProxyTargetProvider>) -> Self {
        Self { inner }
    }

    pub fn local_ai_proxy_target(&self) -> Option<PublishedProxyTarget> {
        self.inner.local_ai_proxy_target()
    }
}

impl fmt::Debug for LocalAiProxyTargetProviderHandle {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("LocalAiProxyTargetProviderHandle(..)")
    }
}

#[cfg_attr(not(test), allow(dead_code))]
#[derive(Debug, Clone)]
pub struct ServerState {
    pub mode: &'static str,
    pub capabilities: ServerHostCapabilities,
    pub resource_projection_updated_at: u64,
    pub deployment_family: String,
    pub accelerator_profile: Option<String>,
    #[allow(dead_code)]
    pub host: String,
    #[allow(dead_code)]
    pub port: u16,
    pub state_store_driver: String,
    pub state_store: ServerStateStoreSnapshot,
    pub auth: ServerAuthConfig,
    pub web_dist_dir: PathBuf,
    pub runtime_contract: ServerRuntimeContract,
    pub service_control_plane: ServerServiceControlPlaneHandle,
    pub openclaw_control_plane: Arc<OpenClawControlPlane>,
    pub manage_openclaw_provider: ManageOpenClawProviderHandle,
    pub local_ai_proxy_target_provider: Option<LocalAiProxyTargetProviderHandle>,
    pub rollout_control_plane: Arc<RolloutControlPlane>,
    pub node_session_registry: Arc<NodeSessionRegistry>,
    pub studio_public_api: Option<Arc<dyn StudioPublicApiProvider>>,
}

#[cfg_attr(not(test), allow(dead_code))]
impl ServerState {
    #[allow(dead_code)]
    pub fn listen_address(&self) -> SocketAddr {
        let ip = self
            .host
            .parse::<IpAddr>()
            .unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED));
        SocketAddr::new(ip, self.port)
    }

    pub fn host_platform_updated_at(&self) -> u64 {
        unix_timestamp_ms()
    }

    pub fn resource_projection_updated_at(&self) -> u64 {
        self.resource_projection_updated_at
    }

    pub fn host_platform_distribution_family(&self) -> &'static str {
        match self.mode {
            "desktopCombined" => "desktop",
            _ => "server",
        }
    }

    pub fn host_platform_id(&self) -> &'static str {
        match self.mode {
            "desktopCombined" => "desktop-local",
            _ => "server-local",
        }
    }

    pub fn host_platform_display_name(&self) -> &'static str {
        match self.mode {
            "desktopCombined" => "Desktop Combined Host",
            _ => "Server Combined Host",
        }
    }

    pub fn host_platform_version(&self) -> String {
        let metadata = host_core_metadata();
        metadata.package_version.to_string()
    }

    pub fn set_mode(&mut self, mode: &'static str) {
        self.mode = mode;
        self.capabilities = ServerHostCapabilities::for_mode(mode);
        self.resource_projection_updated_at = unix_timestamp_ms();
    }

    pub fn supports_manage_service_api(&self) -> bool {
        self.capabilities.manage_service_api
    }

    pub fn local_ai_proxy_target(&self) -> Option<PublishedProxyTarget> {
        self.local_ai_proxy_target_provider
            .as_ref()
            .and_then(LocalAiProxyTargetProviderHandle::local_ai_proxy_target)
    }

    pub fn openclaw_gateway_target(&self) -> Option<PublishedProxyTarget> {
        self.manage_openclaw_provider
            .gateway_proxy_target(self.resource_projection_updated_at())
    }

    pub fn host_platform_supported_capability_keys(&self) -> Vec<String> {
        host_platform_capability_keys_for_mode(self.mode)
    }

    pub fn host_platform_available_capability_keys(&self, updated_at: u64) -> Vec<String> {
        let mut capability_keys = self.host_platform_supported_capability_keys();
        if !self
            .manage_openclaw_provider
            .gateway_invoke_is_available(updated_at)
        {
            capability_keys.retain(|key| key != "manage.openclaw.gateway.invoke");
        }

        capability_keys
    }

    #[allow(dead_code)]
    pub fn host_platform_capability_keys(&self) -> Vec<String> {
        self.host_platform_available_capability_keys(self.resource_projection_updated_at())
    }
}

#[allow(dead_code)]
pub fn build_server_state() -> ServerState {
    server_state_or_exit(try_build_server_state(), "server state should initialize")
}

pub fn build_server_state_from_runtime_contract(
    config: &ResolvedServerRuntimeConfig,
    effective_config_path: PathBuf,
    executable_path: PathBuf,
    bound_endpoint: ServerBoundEndpointContext,
) -> ServerState {
    server_state_or_exit(
        try_build_server_state_from_runtime_contract(
            config,
            effective_config_path,
            executable_path,
            bound_endpoint,
        ),
        "server state should initialize from runtime config",
    )
}

fn server_state_or_exit(result: Result<ServerState, String>, context: &str) -> ServerState {
    match result {
        Ok(state) => state,
        Err(error) => {
            eprintln!("{context}: {error}");
            std::process::exit(1);
        }
    }
}

#[allow(dead_code)]
fn try_build_server_state() -> Result<ServerState, String> {
    let rollout_data_dir = env::var("CLAW_SERVER_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(".clawstudio-server"));

    try_build_server_state_with_rollout_data_dir(rollout_data_dir)
}

fn try_build_server_state_from_runtime_contract(
    config: &ResolvedServerRuntimeConfig,
    effective_config_path: PathBuf,
    executable_path: PathBuf,
    bound_endpoint: ServerBoundEndpointContext,
) -> Result<ServerState, String> {
    validate_public_bind_configuration(config)?;

    let rollout_data_dir = config.data_dir.clone();
    let host = resolve_server_host(Some(bound_endpoint.bind_host.clone()));
    let port = bound_endpoint.active_port;
    let auth = server_auth_config_from_runtime_config(config);
    let web_dist_dir = config.web_dist_dir.clone();
    let state_store_driver =
        resolve_server_state_store_driver(Some(config.state_store.driver.clone()))?;
    let state_store_sqlite_path = config
        .state_store
        .sqlite_path
        .clone()
        .unwrap_or_else(|| rollout_data_dir.join("host-state.sqlite3"));
    let state_store_postgres_projection = ServerStateStorePostgresProjection {
        postgres_url: config.state_store.postgres_url.clone(),
        postgres_schema: config.state_store.postgres_schema.clone(),
    };
    let (rollout_control_plane, node_session_registry) = build_host_runtime_state_stores(
        &rollout_data_dir,
        state_store_driver,
        Some(state_store_sqlite_path.clone()),
    )?;
    let state_store = build_server_state_store_snapshot(
        &rollout_data_dir,
        state_store_driver,
        &state_store_sqlite_path,
        &state_store_postgres_projection,
    );
    let runtime_contract = ServerRuntimeContract {
        platform: current_service_platform(),
        executable_path,
        config_path: effective_config_path,
        runtime_config: config.clone(),
    };
    let resource_projection_updated_at = unix_timestamp_ms();
    let openclaw_control_plane = Arc::new(build_server_openclaw_control_plane(&bound_endpoint));
    let manage_openclaw_provider =
        build_control_plane_manage_openclaw_provider(openclaw_control_plane.clone());
    let studio_public_api = build_default_studio_public_api_provider(
        rollout_data_dir.clone(),
        openclaw_control_plane.clone(),
    )?;

    Ok(ServerState {
        mode: "server",
        capabilities: ServerHostCapabilities::server(),
        resource_projection_updated_at,
        deployment_family: config.deployment_family.as_contract_str().to_string(),
        accelerator_profile: config
            .accelerator_profile
            .as_ref()
            .map(|profile| profile.as_contract_str().to_string()),
        host,
        port,
        state_store_driver: state_store_driver.as_str().to_string(),
        state_store,
        auth,
        web_dist_dir,
        runtime_contract,
        service_control_plane: ServerServiceControlPlaneHandle::os(),
        openclaw_control_plane,
        manage_openclaw_provider,
        local_ai_proxy_target_provider: None,
        rollout_control_plane: Arc::new(rollout_control_plane),
        node_session_registry: Arc::new(node_session_registry),
        studio_public_api: Some(studio_public_api),
    })
}

#[cfg_attr(not(test), allow(dead_code))]
pub fn build_server_state_with_rollout_data_dir(rollout_data_dir: PathBuf) -> ServerState {
    server_state_or_exit(
        try_build_server_state_with_rollout_data_dir(rollout_data_dir),
        "server state should initialize from rollout data dir",
    )
}

#[cfg_attr(not(test), allow(dead_code))]
fn try_build_server_state_with_rollout_data_dir(
    rollout_data_dir: PathBuf,
) -> Result<ServerState, String> {
    try_build_server_state_with_overrides(rollout_data_dir, ServerStateOverrides::default())
}

#[cfg_attr(not(test), allow(dead_code))]
pub fn build_server_state_with_overrides(
    rollout_data_dir: PathBuf,
    overrides: ServerStateOverrides,
) -> ServerState {
    server_state_or_exit(
        try_build_server_state_with_overrides(rollout_data_dir, overrides),
        "server state should initialize from overrides",
    )
}

#[cfg_attr(not(test), allow(dead_code))]
fn try_build_server_state_with_overrides(
    rollout_data_dir: PathBuf,
    overrides: ServerStateOverrides,
) -> Result<ServerState, String> {
    let host = overrides
        .host
        .unwrap_or_else(|| resolve_server_host(env::var("CLAW_SERVER_HOST").ok()));
    let port = overrides.port.unwrap_or_else(|| {
        env::var("CLAW_SERVER_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(18_797)
    });
    let auth = overrides.auth.unwrap_or_else(resolve_server_auth_config);
    let web_dist_dir = overrides
        .web_dist_dir
        .unwrap_or_else(|| resolve_server_web_dist_dir(env::var("CLAW_SERVER_WEB_DIST").ok()));
    let state_store_driver = resolve_server_state_store_driver(
        overrides
            .state_store_driver
            .clone()
            .or_else(|| env::var("CLAW_SERVER_STATE_STORE_DRIVER").ok()),
    )?;
    let state_store_sqlite_path = overrides
        .state_store_sqlite_path
        .clone()
        .unwrap_or_else(|| {
            resolve_server_state_store_sqlite_path(
                &rollout_data_dir,
                env::var("CLAW_SERVER_STATE_STORE_SQLITE_PATH").ok(),
            )
        });
    let state_store_postgres_projection = resolve_server_state_store_postgres_projection(
        overrides.state_store_postgres_url.clone(),
        overrides.state_store_postgres_schema.clone(),
    );
    let (rollout_control_plane, node_session_registry) = build_host_runtime_state_stores(
        &rollout_data_dir,
        state_store_driver,
        Some(state_store_sqlite_path.clone()),
    )?;
    let state_store = build_server_state_store_snapshot(
        &rollout_data_dir,
        state_store_driver,
        &state_store_sqlite_path,
        &state_store_postgres_projection,
    );
    let deployment_family = resolve_server_deployment_family(
        overrides
            .deployment_family
            .clone()
            .or_else(|| env::var("CLAW_DEPLOYMENT_FAMILY").ok()),
    )?
    .unwrap_or(crate::config::ServerDeploymentFamily::BareMetal);
    let accelerator_profile = resolve_server_accelerator_profile(
        overrides
            .accelerator_profile
            .clone()
            .or_else(|| env::var("CLAW_ACCELERATOR_PROFILE").ok()),
    )?;
    let runtime_config = ResolvedServerRuntimeConfig {
        host: host.clone(),
        port,
        data_dir: rollout_data_dir.clone(),
        web_dist_dir: web_dist_dir.clone(),
        deployment_family: deployment_family.clone(),
        accelerator_profile: accelerator_profile.clone(),
        state_store: crate::config::ResolvedServerStateStoreConfig {
            driver: state_store_driver.as_str().to_string(),
            sqlite_path: Some(state_store_sqlite_path.clone()),
            postgres_url: state_store_postgres_projection.postgres_url.clone(),
            postgres_schema: state_store_postgres_projection.postgres_schema.clone(),
        },
        auth: resolved_server_auth_config(&auth),
        allow_insecure_public_bind: overrides.allow_insecure_public_bind.unwrap_or_else(|| {
            env::var("CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND")
                .ok()
                .map(|value| {
                    matches!(
                        value.trim().to_ascii_lowercase().as_str(),
                        "1" | "true" | "yes" | "on"
                    )
                })
                .unwrap_or(false)
        }),
    };
    validate_public_bind_configuration(&runtime_config)?;
    let effective_config_path = overrides
        .effective_config_path
        .clone()
        .or_else(|| env::var("CLAW_SERVER_CONFIG").ok().map(PathBuf::from))
        .unwrap_or_else(|| {
            rollout_data_dir.join(crate::config::CLAW_SERVER_DEFAULT_CONFIG_FILE_NAME)
        });
    let executable_path = overrides.executable_path.clone().unwrap_or_else(|| {
        std::env::current_exe().unwrap_or_else(|_| PathBuf::from("clawstudio-server"))
    });
    let runtime_contract = ServerRuntimeContract {
        platform: current_service_platform(),
        executable_path,
        config_path: effective_config_path,
        runtime_config,
    };
    let resource_projection_updated_at = unix_timestamp_ms();
    let openclaw_control_plane = Arc::new(build_server_openclaw_control_plane(
        &ServerBoundEndpointContext {
            bind_host: host.clone(),
            requested_port: port,
            active_port: port,
            dynamic_port: false,
            last_conflict_reason: None,
        },
    ));
    let manage_openclaw_provider =
        overrides
            .manage_openclaw_provider
            .clone()
            .unwrap_or_else(|| {
                build_control_plane_manage_openclaw_provider(openclaw_control_plane.clone())
            });
    let studio_public_api = build_default_studio_public_api_provider(
        rollout_data_dir.clone(),
        openclaw_control_plane.clone(),
    )?;

    Ok(ServerState {
        mode: "server",
        capabilities: ServerHostCapabilities::server(),
        resource_projection_updated_at,
        deployment_family: deployment_family.as_contract_str().to_string(),
        accelerator_profile: accelerator_profile
            .as_ref()
            .map(|profile| profile.as_contract_str().to_string()),
        host,
        port,
        state_store_driver: state_store_driver.as_str().to_string(),
        state_store,
        auth,
        web_dist_dir,
        runtime_contract,
        service_control_plane: overrides
            .service_control_plane
            .unwrap_or_else(ServerServiceControlPlaneHandle::os),
        openclaw_control_plane,
        manage_openclaw_provider,
        local_ai_proxy_target_provider: overrides.local_ai_proxy_target_provider,
        rollout_control_plane: Arc::new(rollout_control_plane),
        node_session_registry: Arc::new(node_session_registry),
        studio_public_api: Some(studio_public_api),
    })
}

#[cfg_attr(not(test), allow(dead_code))]
pub fn resolve_server_web_dist_dir(value: Option<String>) -> PathBuf {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("../sdkwork-clawstudio-web/dist"))
}

fn resolve_server_host(value: Option<String>) -> String {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .unwrap_or_else(|| "127.0.0.1".to_string())
}

#[cfg_attr(not(test), allow(dead_code))]
fn resolve_server_auth_config() -> ServerAuthConfig {
    let manage =
        resolve_basic_auth_from_env("CLAW_SERVER_MANAGE_USERNAME", "CLAW_SERVER_MANAGE_PASSWORD");
    let internal = resolve_basic_auth_from_env(
        "CLAW_SERVER_INTERNAL_USERNAME",
        "CLAW_SERVER_INTERNAL_PASSWORD",
    )
    .or_else(|| manage.clone());

    ServerAuthConfig {
        manage,
        internal,
        browser_session_token: None,
    }
}

#[cfg_attr(not(test), allow(dead_code))]
fn resolve_basic_auth_from_env(
    username_var: &str,
    password_var: &str,
) -> Option<BasicAuthCredentials> {
    let username = env::var(username_var)
        .ok()
        .map(|value| value.trim().to_string());
    let password = env::var(password_var)
        .ok()
        .map(|value| value.trim().to_string());
    match (username, password) {
        (Some(username), Some(password)) if !username.is_empty() && !password.is_empty() => {
            Some(BasicAuthCredentials { username, password })
        }
        _ => None,
    }
}

fn server_auth_config_from_runtime_config(
    config: &ResolvedServerRuntimeConfig,
) -> ServerAuthConfig {
    let manage = basic_auth_credentials_from_pair(
        config.auth.manage_username.clone(),
        config.auth.manage_password.clone(),
    );
    let internal = basic_auth_credentials_from_pair(
        config.auth.internal_username.clone(),
        config.auth.internal_password.clone(),
    )
    .or_else(|| manage.clone());

    ServerAuthConfig {
        manage,
        internal,
        browser_session_token: None,
    }
}

fn resolved_server_auth_config(auth: &ServerAuthConfig) -> crate::config::ResolvedServerAuthConfig {
    crate::config::ResolvedServerAuthConfig {
        manage_username: auth.manage.as_ref().map(|value| value.username.clone()),
        manage_password: auth.manage.as_ref().map(|value| value.password.clone()),
        internal_username: auth.internal.as_ref().map(|value| value.username.clone()),
        internal_password: auth.internal.as_ref().map(|value| value.password.clone()),
    }
}

fn basic_auth_credentials_from_pair(
    username: Option<String>,
    password: Option<String>,
) -> Option<BasicAuthCredentials> {
    match (username, password) {
        (Some(username), Some(password))
            if !username.trim().is_empty() && !password.trim().is_empty() =>
        {
            Some(BasicAuthCredentials { username, password })
        }
        _ => None,
    }
}

fn validate_public_bind_configuration(config: &ResolvedServerRuntimeConfig) -> Result<(), String> {
    if config.allow_insecure_public_bind || host_is_loopback_or_local(&config.host) {
        return Ok(());
    }

    let auth = server_auth_config_from_runtime_config(config);
    if auth.manage.is_some() && auth.internal.is_some() {
        return Ok(());
    }

    Err(
        "refusing to start clawstudio-server on a non-loopback host without control-plane credentials; set CLAW_SERVER_MANAGE_USERNAME and CLAW_SERVER_MANAGE_PASSWORD (and optionally CLAW_SERVER_INTERNAL_USERNAME / CLAW_SERVER_INTERNAL_PASSWORD) or explicitly opt in with CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=true".to_string(),
    )
}

fn host_is_loopback_or_local(host: &str) -> bool {
    let normalized = host.trim().to_ascii_lowercase();
    if matches!(normalized.as_str(), "127.0.0.1" | "localhost" | "::1") {
        return true;
    }

    normalized
        .parse::<IpAddr>()
        .map(|value| value.is_loopback())
        .unwrap_or(false)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ServerStateStoreDriver {
    JsonFile,
    Sqlite,
}

impl ServerStateStoreDriver {
    fn as_str(&self) -> &'static str {
        match self {
            ServerStateStoreDriver::JsonFile => "json-file",
            ServerStateStoreDriver::Sqlite => "sqlite",
        }
    }
}

fn resolve_server_state_store_driver(
    value: Option<String>,
) -> Result<ServerStateStoreDriver, String> {
    let normalized = value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .unwrap_or_else(|| CLAW_SERVER_DEFAULT_STATE_STORE_DRIVER.to_string());

    match normalized.as_str() {
        "json-file" => Ok(ServerStateStoreDriver::JsonFile),
        "sqlite" => Ok(ServerStateStoreDriver::Sqlite),
        "postgres" => Err(
            "invalid CLAW_SERVER_STATE_STORE_DRIVER value \"postgres\"; postgres is currently exposed as a metadata-only projection and cannot be selected as the active runtime driver; supported values: json-file, sqlite"
                .to_string(),
        ),
        _ => Err(format!(
            "invalid CLAW_SERVER_STATE_STORE_DRIVER value \"{normalized}\"; supported values: json-file, sqlite"
        )),
    }
}

#[cfg_attr(not(test), allow(dead_code))]
fn resolve_server_state_store_sqlite_path(
    rollout_data_dir: &PathBuf,
    value: Option<String>,
) -> PathBuf {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| rollout_data_dir.join("host-state.sqlite3"))
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct ServerStateStorePostgresProjection {
    postgres_url: Option<String>,
    postgres_schema: Option<String>,
}

impl ServerStateStorePostgresProjection {
    fn configured_keys(&self) -> Vec<String> {
        let mut keys = Vec::new();
        if self.postgres_url.is_some() {
            keys.push("postgresUrl".to_string());
        }
        if self.postgres_schema.is_some() {
            keys.push("postgresSchema".to_string());
        }
        keys
    }

    fn connection_configured(&self) -> bool {
        self.postgres_url.is_some()
    }
}

#[cfg_attr(not(test), allow(dead_code))]
fn resolve_server_state_store_postgres_projection(
    postgres_url_override: Option<String>,
    postgres_schema_override: Option<String>,
) -> ServerStateStorePostgresProjection {
    ServerStateStorePostgresProjection {
        postgres_url: normalize_optional_string(
            postgres_url_override.or_else(|| env::var("CLAW_SERVER_STATE_STORE_POSTGRES_URL").ok()),
        ),
        postgres_schema: normalize_optional_string(
            postgres_schema_override
                .or_else(|| env::var("CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA").ok()),
        ),
    }
}

#[cfg_attr(not(test), allow(dead_code))]
fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
}

fn build_host_runtime_state_stores(
    rollout_data_dir: &PathBuf,
    driver: ServerStateStoreDriver,
    sqlite_path_override: Option<PathBuf>,
) -> Result<(RolloutControlPlane, NodeSessionRegistry), String> {
    match driver {
        ServerStateStoreDriver::JsonFile => {
            let rollout_store_path = rollout_data_dir.join("rollouts.json");
            let node_session_store_path = rollout_data_dir.join("node-sessions.json");
            let rollout_control_plane =
                RolloutControlPlane::open(rollout_store_path).map_err(|error| {
                    format!("server rollout control plane should initialize: {error}")
                })?;
            let node_session_registry = NodeSessionRegistry::open(node_session_store_path)
                .map_err(|error| {
                    format!("server node session registry should initialize: {error}")
                })?;

            Ok((rollout_control_plane, node_session_registry))
        }
        ServerStateStoreDriver::Sqlite => {
            let sqlite_store_path =
                sqlite_path_override.unwrap_or_else(|| rollout_data_dir.join("host-state.sqlite3"));
            let rollout_control_plane = RolloutControlPlane::open_sqlite(sqlite_store_path.clone())
                .map_err(|error| {
                    format!("server rollout control plane should initialize: {error}")
                })?;
            let node_session_registry = NodeSessionRegistry::open_sqlite(sqlite_store_path)
                .map_err(|error| {
                    format!("server node session registry should initialize: {error}")
                })?;

            Ok((rollout_control_plane, node_session_registry))
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStateStoreSnapshot {
    pub active_profile_id: String,
    pub providers: Vec<ServerStateStoreProviderRecord>,
    pub profiles: Vec<ServerStateStoreProfileRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStateStoreProviderRecord {
    pub id: String,
    pub label: String,
    pub availability: String,
    pub requires_configuration: bool,
    pub configuration_keys: Vec<String>,
    pub projection_mode: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStateStoreProfileRecord {
    pub id: String,
    pub label: String,
    pub driver: String,
    pub active: bool,
    pub availability: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub connection_configured: bool,
    pub configured_keys: Vec<String>,
    pub projection_mode: String,
}

fn build_server_state_store_snapshot(
    rollout_data_dir: &PathBuf,
    active_driver: ServerStateStoreDriver,
    sqlite_path: &PathBuf,
    postgres_projection: &ServerStateStorePostgresProjection,
) -> ServerStateStoreSnapshot {
    let active_profile_id = match active_driver {
        ServerStateStoreDriver::JsonFile => "default-json-file",
        ServerStateStoreDriver::Sqlite => "default-sqlite",
    }
    .to_string();
    let postgres_configured_keys = postgres_projection.configured_keys();

    ServerStateStoreSnapshot {
        active_profile_id,
        providers: vec![
            ServerStateStoreProviderRecord {
                id: "json-file".to_string(),
                label: "JSON File Catalogs".to_string(),
                availability: "ready".to_string(),
                requires_configuration: false,
                configuration_keys: Vec::new(),
                projection_mode: "runtime".to_string(),
            },
            ServerStateStoreProviderRecord {
                id: "sqlite".to_string(),
                label: "SQLite Host State".to_string(),
                availability: "ready".to_string(),
                requires_configuration: false,
                configuration_keys: Vec::new(),
                projection_mode: "runtime".to_string(),
            },
            ServerStateStoreProviderRecord {
                id: "postgres".to_string(),
                label: "PostgreSQL Host State".to_string(),
                availability: "planned".to_string(),
                requires_configuration: true,
                configuration_keys: vec!["postgresUrl".to_string(), "postgresSchema".to_string()],
                projection_mode: "metadataOnly".to_string(),
            },
        ],
        profiles: vec![
            ServerStateStoreProfileRecord {
                id: "default-json-file".to_string(),
                label: "JSON File Catalogs".to_string(),
                driver: "json-file".to_string(),
                active: active_driver == ServerStateStoreDriver::JsonFile,
                availability: "ready".to_string(),
                path: Some(rollout_data_dir.to_string_lossy().into_owned()),
                connection_configured: false,
                configured_keys: Vec::new(),
                projection_mode: "runtime".to_string(),
            },
            ServerStateStoreProfileRecord {
                id: "default-sqlite".to_string(),
                label: "SQLite Host State".to_string(),
                driver: "sqlite".to_string(),
                active: active_driver == ServerStateStoreDriver::Sqlite,
                availability: "ready".to_string(),
                path: Some(sqlite_path.to_string_lossy().into_owned()),
                connection_configured: false,
                configured_keys: Vec::new(),
                projection_mode: "runtime".to_string(),
            },
            ServerStateStoreProfileRecord {
                id: "planned-postgres".to_string(),
                label: "PostgreSQL Host State".to_string(),
                driver: "postgres".to_string(),
                active: false,
                availability: "planned".to_string(),
                path: None,
                connection_configured: postgres_projection.connection_configured(),
                configured_keys: postgres_configured_keys,
                projection_mode: "metadataOnly".to_string(),
            },
        ],
    }
}

fn unix_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn build_server_openclaw_control_plane(
    bound_endpoint: &ServerBoundEndpointContext,
) -> OpenClawControlPlane {
    let mut host_endpoints = HostEndpointRegistry::default();
    host_endpoints.register(HostEndpointRegistration {
        endpoint_id: "claw-manage-http".to_string(),
        bind_host: bound_endpoint.bind_host.clone(),
        requested_port: bound_endpoint.requested_port,
        active_port: Some(bound_endpoint.active_port),
        scheme: "http".to_string(),
        base_path: None,
        websocket_path: None,
        loopback_only: matches!(
            bound_endpoint.bind_host.as_str(),
            "127.0.0.1" | "localhost" | "::1"
        ),
        dynamic_port: bound_endpoint.dynamic_port,
        last_conflict_at: None,
        last_conflict_reason: bound_endpoint.last_conflict_reason.clone(),
    });

    OpenClawControlPlane::inactive("clawstudio-server").with_host_endpoints(host_endpoints)
}

#[cfg(test)]
mod tests {
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use sdkwork_clawstudio_host_core::host_endpoints::{
        HostEndpointRegistration, HostEndpointRegistry, OpenClawLifecycle,
    };
    use sdkwork_clawstudio_host_core::openclaw_control_plane::OpenClawControlPlane;

    use super::{
        build_control_plane_manage_openclaw_provider, build_server_state_from_runtime_contract,
        build_server_state_with_overrides, resolve_server_host, resolve_server_web_dist_dir,
        try_build_server_state_from_runtime_contract, try_build_server_state_with_overrides,
        ServerBoundEndpointContext, ServerStateOverrides,
    };

    #[test]
    fn server_bootstrap_production_path_has_no_panic_exits() {
        let source = include_str!("bootstrap.rs");
        let production_source = source.split("#[cfg(test)]").next().unwrap_or(source);
        let forbidden_patterns = [
            ".expect(",
            ".unwrap(",
            "panic!(",
            "todo!(",
            "unimplemented!(",
            "unreachable!(",
        ];
        let mut offenders = Vec::new();

        for (index, line) in production_source.lines().enumerate() {
            for pattern in forbidden_patterns {
                if line.contains(pattern) {
                    offenders.push(format!("{}:{}", index + 1, line.trim()));
                }
            }
        }

        assert!(
            offenders.is_empty(),
            "server bootstrap production code must report startup errors instead of panicking:\n{}",
            offenders.join("\n")
        );
    }

    #[test]
    fn resolve_server_web_dist_dir_prefers_explicit_value() {
        assert_eq!(
            resolve_server_web_dist_dir(Some("custom-web-dist".to_string())),
            PathBuf::from("custom-web-dist"),
        );
        assert_eq!(
            resolve_server_web_dist_dir(None),
            PathBuf::from("../sdkwork-clawstudio-web/dist"),
        );
    }

    #[test]
    fn build_server_state_defaults_to_loopback_host() {
        assert_eq!(resolve_server_host(None), "127.0.0.1");
    }

    #[test]
    fn build_server_state_seeds_default_sqlite_driver_file() {
        let rollout_data_dir = create_test_rollout_data_dir("sqlite-default-driver-seed");

        let state = build_server_state_with_overrides(
            rollout_data_dir.clone(),
            ServerStateOverrides::default(),
        );
        drop(state);

        let sqlite_store_path = rollout_data_dir.join("host-state.sqlite3");
        let sqlite_bytes =
            fs::read(&sqlite_store_path).expect("server startup should seed host-state.sqlite3");

        let _ = fs::remove_dir_all(rollout_data_dir);

        assert!(!sqlite_bytes.is_empty());
    }

    #[test]
    fn build_server_state_supports_sqlite_state_store_driver() {
        let rollout_data_dir = create_test_rollout_data_dir("sqlite-driver-seed");
        let state = build_server_state_with_overrides(
            rollout_data_dir.clone(),
            ServerStateOverrides {
                state_store_driver: Some("sqlite".to_string()),
                ..ServerStateOverrides::default()
            },
        );
        drop(state);

        let sqlite_store_path = rollout_data_dir.join("host-state.sqlite3");
        let sqlite_bytes = fs::read(&sqlite_store_path)
            .expect("server startup should seed a sqlite state store file");

        let _ = fs::remove_dir_all(rollout_data_dir);

        assert!(!sqlite_bytes.is_empty());
    }

    #[test]
    fn runtime_contract_state_preserves_requested_and_active_server_ports_when_binding_falls_back()
    {
        let rollout_data_dir = create_test_rollout_data_dir("runtime-contract-bound-endpoint");
        let effective_config_path = rollout_data_dir.join("clawstudio-server.config.json");
        let executable_path = rollout_data_dir.join("clawstudio-server.exe");
        let state = build_server_state_from_runtime_contract(
            &crate::config::ResolvedServerRuntimeConfig {
                host: "127.0.0.1".to_string(),
                port: 28_901,
                data_dir: rollout_data_dir.clone(),
                web_dist_dir: PathBuf::from("../sdkwork-clawstudio-web/dist"),
                deployment_family: crate::config::ServerDeploymentFamily::BareMetal,
                accelerator_profile: None,
                state_store: crate::config::ResolvedServerStateStoreConfig {
                    driver: "json-file".to_string(),
                    sqlite_path: None,
                    postgres_url: None,
                    postgres_schema: None,
                },
                auth: crate::config::ResolvedServerAuthConfig {
                    manage_username: None,
                    manage_password: None,
                    internal_username: None,
                    internal_password: None,
                },
                allow_insecure_public_bind: false,
            },
            effective_config_path,
            executable_path,
            ServerBoundEndpointContext {
                bind_host: "127.0.0.1".to_string(),
                requested_port: 18_797,
                active_port: 28_901,
                dynamic_port: true,
                last_conflict_reason: Some(
                    "requested tcp listener 127.0.0.1:18797 is unavailable".to_string(),
                ),
            },
        );
        let host_endpoints = state.openclaw_control_plane.list_host_endpoints();
        let control_plane_endpoint = host_endpoints
            .iter()
            .find(|record| record.endpoint_id == "claw-manage-http")
            .expect("server state should publish the control-plane endpoint");

        assert_eq!(control_plane_endpoint.requested_port, 18_797);
        assert_eq!(control_plane_endpoint.active_port, Some(28_901));
        assert!(control_plane_endpoint.dynamic_port);
        assert!(control_plane_endpoint.last_conflict_reason.is_some());
    }

    #[test]
    fn control_plane_manage_openclaw_provider_reports_gateway_invoke_available_when_gateway_is_ready(
    ) {
        let mut host_endpoints = HostEndpointRegistry::default();
        host_endpoints.register(HostEndpointRegistration {
            endpoint_id: "openclaw-gateway".to_string(),
            bind_host: "127.0.0.1".to_string(),
            requested_port: 18_871,
            active_port: Some(18_871),
            scheme: "http".to_string(),
            base_path: None,
            websocket_path: Some("/ws".to_string()),
            loopback_only: true,
            dynamic_port: false,
            last_conflict_at: None,
            last_conflict_reason: None,
        });

        let provider = build_control_plane_manage_openclaw_provider(std::sync::Arc::new(
            OpenClawControlPlane::inactive("clawstudio-server")
                .with_host_endpoints(host_endpoints)
                .with_gateway_endpoint("openclaw-gateway", OpenClawLifecycle::Ready),
        ));

        assert!(
            provider.gateway_invoke_is_available(123),
            "control-plane manage provider should surface gateway invoke availability once the gateway lifecycle is ready"
        );
    }

    #[test]
    fn build_server_state_reports_invalid_state_store_driver() {
        let rollout_data_dir = create_test_rollout_data_dir("invalid-state-store-driver");
        let error = try_build_server_state_with_overrides(
            rollout_data_dir.clone(),
            ServerStateOverrides {
                state_store_driver: Some("bad-driver".to_string()),
                ..ServerStateOverrides::default()
            },
        )
        .expect_err("invalid state store driver should be rejected");
        let _ = fs::remove_dir_all(rollout_data_dir);

        assert!(error.contains("CLAW_SERVER_STATE_STORE_DRIVER"));
        assert!(error.contains("json-file"));
        assert!(error.contains("sqlite"));
    }

    #[test]
    fn build_server_state_rejects_postgres_runtime_driver_with_metadata_only_hint() {
        let rollout_data_dir = create_test_rollout_data_dir("postgres-metadata-only-driver");
        let error = try_build_server_state_with_overrides(
            rollout_data_dir.clone(),
            ServerStateOverrides {
                state_store_driver: Some("postgres".to_string()),
                ..ServerStateOverrides::default()
            },
        )
        .expect_err("postgres state store driver should be rejected until runtime support lands");
        let _ = fs::remove_dir_all(rollout_data_dir);

        assert!(error.contains("postgres"));
        assert!(error.contains("metadata-only"));
        assert!(error.contains("json-file"));
        assert!(error.contains("sqlite"));
    }

    #[test]
    fn build_server_state_rejects_public_bind_without_control_plane_credentials() {
        let rollout_data_dir = create_test_rollout_data_dir("public-bind-auth-required");
        let effective_config_path = rollout_data_dir.join("clawstudio-server.config.json");
        let executable_path = rollout_data_dir.join("clawstudio-server.exe");
        let error = try_build_server_state_from_runtime_contract(
            &crate::config::ResolvedServerRuntimeConfig {
                host: "0.0.0.0".to_string(),
                port: 18_797,
                data_dir: rollout_data_dir.clone(),
                web_dist_dir: PathBuf::from("../sdkwork-clawstudio-web/dist"),
                deployment_family: crate::config::ServerDeploymentFamily::BareMetal,
                accelerator_profile: None,
                state_store: crate::config::ResolvedServerStateStoreConfig {
                    driver: "sqlite".to_string(),
                    sqlite_path: Some(rollout_data_dir.join("host-state.sqlite3")),
                    postgres_url: None,
                    postgres_schema: None,
                },
                auth: crate::config::ResolvedServerAuthConfig {
                    manage_username: None,
                    manage_password: None,
                    internal_username: None,
                    internal_password: None,
                },
                allow_insecure_public_bind: false,
            },
            effective_config_path,
            executable_path,
            ServerBoundEndpointContext {
                bind_host: "0.0.0.0".to_string(),
                requested_port: 18_797,
                active_port: 18_797,
                dynamic_port: false,
                last_conflict_reason: None,
            },
        )
        .expect_err("public bind without manage credentials should be rejected");

        let _ = fs::remove_dir_all(rollout_data_dir);

        assert!(error.contains("CLAW_SERVER_MANAGE_USERNAME"));
        assert!(error.contains("CLAW_SERVER_MANAGE_PASSWORD"));
        assert!(error.contains("CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND"));
    }

    #[test]
    fn build_server_state_allows_public_bind_when_explicitly_opted_in() {
        let rollout_data_dir = create_test_rollout_data_dir("public-bind-insecure-opt-in");
        let effective_config_path = rollout_data_dir.join("clawstudio-server.config.json");
        let executable_path = rollout_data_dir.join("clawstudio-server.exe");
        let state = try_build_server_state_from_runtime_contract(
            &crate::config::ResolvedServerRuntimeConfig {
                host: "0.0.0.0".to_string(),
                port: 18_797,
                data_dir: rollout_data_dir.clone(),
                web_dist_dir: PathBuf::from("../sdkwork-clawstudio-web/dist"),
                deployment_family: crate::config::ServerDeploymentFamily::BareMetal,
                accelerator_profile: None,
                state_store: crate::config::ResolvedServerStateStoreConfig {
                    driver: "sqlite".to_string(),
                    sqlite_path: Some(rollout_data_dir.join("host-state.sqlite3")),
                    postgres_url: None,
                    postgres_schema: None,
                },
                auth: crate::config::ResolvedServerAuthConfig {
                    manage_username: None,
                    manage_password: None,
                    internal_username: None,
                    internal_password: None,
                },
                allow_insecure_public_bind: true,
            },
            effective_config_path,
            executable_path,
            ServerBoundEndpointContext {
                bind_host: "0.0.0.0".to_string(),
                requested_port: 18_797,
                active_port: 18_797,
                dynamic_port: false,
                last_conflict_reason: None,
            },
        )
        .expect("explicit insecure public bind opt-in should allow startup");

        let _ = fs::remove_dir_all(rollout_data_dir);

        assert_eq!(state.host, "0.0.0.0");
    }

    fn create_test_rollout_data_dir(label: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let directory = env::temp_dir().join(format!(
            "sdkwork-clawstudio-server-bootstrap-{label}-{}-{unique_suffix}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("bootstrap test rollout directory should be created");
        directory
    }
}
