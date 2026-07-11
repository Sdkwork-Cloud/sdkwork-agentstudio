use crate::framework::{kernel_host::types::DesktopKernelHostInfo, storage::StorageInfo};

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopCapabilityStatus {
    Ready,
    Planned,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCapabilityInfo {
    pub key: String,
    pub status: DesktopCapabilityStatus,
    pub detail: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelDirectories {
    pub install_root: String,
    pub modules_dir: String,
    pub runtimes_dir: String,
    pub machine_root: String,
    pub machine_state_dir: String,
    pub machine_store_dir: String,
    pub machine_staging_dir: String,
    pub user_root: String,
    pub studio_dir: String,
    pub storage_dir: String,
    pub plugins_dir: String,
    pub integrations_dir: String,
    pub backups_dir: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopFileSystemInfo {
    pub default_working_directory: String,
    pub managed_roots: Vec<String>,
    pub supports_binary_io: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSecurityInfo {
    pub strict_path_policy: bool,
    pub allow_external_http: bool,
    pub allow_custom_process_cwd: bool,
    pub allowed_spawn_commands: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopProcessProfileInfo {
    pub id: String,
    pub job_kind: String,
    pub command: String,
    pub args: Vec<String>,
    pub default_timeout_ms: u64,
    pub allow_cancellation: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopProcessInfo {
    pub default_timeout_ms: u64,
    pub max_concurrent_jobs: u32,
    pub active_job_count: usize,
    pub active_process_job_count: usize,
    pub available_profiles: Vec<DesktopProcessProfileInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopPermissionStatus {
    Granted,
    Managed,
    Planned,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DesktopProviderAvailability {
    Ready,
    ConfigurationRequired,
    Planned,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPermissionInfo {
    pub key: String,
    pub status: DesktopPermissionStatus,
    pub required: bool,
    pub detail: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPermissionsInfo {
    pub entries: Vec<DesktopPermissionInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNotificationProviderInfo {
    pub id: String,
    pub label: String,
    pub availability: DesktopProviderAvailability,
    pub transport: String,
    pub requires_user_consent: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNotificationInfo {
    pub enabled: bool,
    pub provider: String,
    pub require_user_consent: bool,
    pub status: DesktopCapabilityStatus,
    pub available_providers: Vec<DesktopNotificationProviderInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPaymentProviderInfo {
    pub id: String,
    pub label: String,
    pub availability: DesktopProviderAvailability,
    pub supports_sandbox: bool,
    pub remote: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPaymentInfo {
    pub provider: String,
    pub sandbox: bool,
    pub status: DesktopCapabilityStatus,
    pub available_providers: Vec<DesktopPaymentProviderInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopIntegrationAdapterInfo {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub availability: DesktopProviderAvailability,
    pub enabled: bool,
    pub requires_signed_plugins: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopIntegrationInfo {
    pub plugins_enabled: bool,
    pub remote_api_enabled: bool,
    pub allow_unsigned_plugins: bool,
    pub plugins_dir: String,
    pub integrations_dir: String,
    pub installed_plugin_count: usize,
    pub status: DesktopCapabilityStatus,
    pub available_adapters: Vec<DesktopIntegrationAdapterInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSupervisorServiceInfo {
    pub id: String,
    pub display_name: String,
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_exit_code: Option<i32>,
    pub restart_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSupervisorInfo {
    pub lifecycle: String,
    pub shutdown_requested: bool,
    pub service_count: usize,
    pub managed_service_ids: Vec<String>,
    pub services: Vec<DesktopSupervisorServiceInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBundledComponentInfo {
    pub id: String,
    pub display_name: String,
    pub kind: String,
    pub bundled_version: String,
    pub startup_mode: String,
    pub install_subdir: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBundledComponentsInfo {
    pub package_profile_id: String,
    pub included_kernel_ids: Vec<String>,
    pub default_enabled_kernel_ids: Vec<String>,
    pub component_count: usize,
    pub default_startup_component_ids: Vec<String>,
    pub auto_upgrade_enabled: bool,
    pub approval_mode: String,
    pub components: Vec<DesktopBundledComponentInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopOpenClawRuntimeStageInfo {
    pub id: String,
    pub status: String,
    pub detail: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopOpenClawProviderProjectionInfo {
    pub provider_id: String,
    pub available: bool,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopOpenClawRuntimeAuthorityProbeInfo {
    pub supports_loopback_health_probe: bool,
    pub health_probe_timeout_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopOpenClawRuntimeAuthorityInfo {
    pub config_file: String,
    pub owned_runtime_roots: Vec<String>,
    pub readiness_probe: DesktopOpenClawRuntimeAuthorityProbeInfo,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopOpenClawChannelConfigHealthInfo {
    pub status: String,
    pub valid: bool,
    pub runtime_metadata_available: bool,
    pub config_readable: bool,
    pub supported_channel_ids: Vec<String>,
    pub configured_channel_ids: Vec<String>,
    pub unknown_channel_ids: Vec<String>,
    pub malformed_channel_ids: Vec<String>,
    pub model_by_channel_ids: Vec<String>,
    pub unknown_model_by_channel_ids: Vec<String>,
    pub invalid_model_by_channel_ids: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopOpenClawRuntimeInfo {
    pub runtime_id: String,
    pub lifecycle: String,
    pub configured: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub openclaw_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_version: Option<String>,
    pub platform: String,
    pub arch: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_dir: Option<String>,
    pub home_dir: String,
    pub state_dir: String,
    pub workspace_dir: String,
    pub config_file: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway_port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gateway_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_ai_proxy_base_url: Option<String>,
    pub local_ai_proxy_snapshot_path: String,
    pub authority: DesktopOpenClawRuntimeAuthorityInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_config_health: Option<DesktopOpenClawChannelConfigHealthInfo>,
    pub provider_projection: DesktopOpenClawProviderProjectionInfo,
    pub startup_chain: Vec<DesktopOpenClawRuntimeStageInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelRuntimeAuthorityProbeInfo {
    pub supports_loopback_health_probe: bool,
    pub health_probe_timeout_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelRuntimeAuthorityInfo {
    pub runtime_id: String,
    pub config_file: String,
    pub owned_runtime_roots: Vec<String>,
    pub readiness_probe: DesktopKernelRuntimeAuthorityProbeInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_home_dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_install_dir: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopActiveKernelRuntimeInfo {
    pub runtime_id: String,
    pub state: String,
    pub health: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_key: Option<String>,
    pub install_source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_version: Option<String>,
    pub platform: String,
    pub arch: String,
    pub config_file: String,
    pub runtime_home_dir: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_install_dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authority: Option<DesktopKernelRuntimeAuthorityInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalAiProxyDefaultRouteInfo {
    pub client_protocol: String,
    pub id: String,
    pub name: String,
    pub managed_by: String,
    pub upstream_protocol: String,
    pub upstream_base_url: String,
    pub model_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalAiProxyRouteRuntimeMetrics {
    pub route_id: String,
    pub client_protocol: String,
    pub upstream_protocol: String,
    pub health: String,
    pub request_count: u64,
    pub success_count: u64,
    pub failure_count: u64,
    pub rpm: u64,
    pub total_tokens: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_tokens: u64,
    pub average_latency_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalAiProxyRouteTestRecord {
    pub route_id: String,
    pub status: String,
    pub tested_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    pub checked_capability: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalAiProxyInfo {
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub openai_compatible_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anthropic_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gemini_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_port: Option<u16>,
    pub loopback_only: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_route_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_route_name: Option<String>,
    pub default_routes: Vec<DesktopLocalAiProxyDefaultRouteInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream_base_url: Option<String>,
    pub model_count: usize,
    pub route_metrics: Vec<DesktopLocalAiProxyRouteRuntimeMetrics>,
    pub route_tests: Vec<DesktopLocalAiProxyRouteTestRecord>,
    pub message_capture_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub observability_db_path: Option<String>,
    pub config_file: String,
    pub snapshot_path: String,
    pub log_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopStartupEvidenceInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recorded_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    pub evidence_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor_lifecycle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor_endpoint_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor_requested_port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor_active_port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor_loopback_only: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor_dynamic_port: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor_state_store_driver: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor_state_store_profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub descriptor_browser_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manage_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_runtime_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_deployment_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_transport_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_websocket_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_is_built_in: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_is_default: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_in_instance_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_claw_runtime_lifecycle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_claw_gateway_lifecycle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ready: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_cause: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentDocumentationRef {
    pub label: String,
    pub location: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentEndpointInfo {
    pub id: String,
    pub label: String,
    pub transport: String,
    pub target: String,
    pub description: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentCapabilityInfo {
    pub key: String,
    pub label: String,
    pub kind: String,
    pub description: String,
    pub entrypoints: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentServiceBindingInfo {
    pub service_id: String,
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentInfo {
    pub id: String,
    pub display_name: String,
    pub kind: String,
    pub startup_mode: String,
    pub bundled_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fallback_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_commit: Option<String>,
    pub install_subdir: String,
    pub runtime_status: String,
    pub service_ids: Vec<String>,
    pub services: Vec<DesktopComponentServiceBindingInfo>,
    pub endpoints: Vec<DesktopComponentEndpointInfo>,
    pub capabilities: Vec<DesktopComponentCapabilityInfo>,
    pub docs: Vec<DesktopComponentDocumentationRef>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentCatalogInfo {
    pub default_startup_component_ids: Vec<String>,
    pub components: Vec<DesktopComponentInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopComponentControlResult {
    pub component_id: String,
    pub action: String,
    pub outcome: String,
    pub affected_service_ids: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelInfo {
    pub directories: DesktopKernelDirectories,
    pub capabilities: Vec<DesktopCapabilityInfo>,
    pub filesystem: DesktopFileSystemInfo,
    pub security: DesktopSecurityInfo,
    pub process: DesktopProcessInfo,
    pub permissions: DesktopPermissionsInfo,
    pub notifications: DesktopNotificationInfo,
    pub payments: DesktopPaymentInfo,
    pub integrations: DesktopIntegrationInfo,
    pub supervisor: DesktopSupervisorInfo,
    pub active_runtime: DesktopActiveKernelRuntimeInfo,
    pub open_claw_runtime: DesktopOpenClawRuntimeInfo,
    pub runtime_authorities: Vec<DesktopKernelRuntimeAuthorityInfo>,
    pub local_ai_proxy: DesktopLocalAiProxyInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub desktop_startup_evidence: Option<DesktopStartupEvidenceInfo>,
    pub bundled_components: DesktopBundledComponentsInfo,
    pub storage: StorageInfo,
    pub host: DesktopKernelHostInfo,
}
