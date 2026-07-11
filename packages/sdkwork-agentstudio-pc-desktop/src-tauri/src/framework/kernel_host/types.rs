use std::{collections::BTreeMap, path::PathBuf};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum KernelHostPlatform {
    Windows,
    Macos,
    Linux,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub enum KernelServiceManagerKind {
    WindowsService,
    LaunchdLaunchAgent,
    SystemdUser,
    SystemdSystem,
    TauriSupervisor,
}

impl KernelServiceManagerKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::WindowsService => "windowsService",
            Self::LaunchdLaunchAgent => "launchdLaunchAgent",
            Self::SystemdUser => "systemdUser",
            Self::SystemdSystem => "systemdSystem",
            Self::TauriSupervisor => "tauriSupervisor",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KernelPlatformServiceSpec {
    pub service_manager: KernelServiceManagerKind,
    pub service_name: String,
    pub service_config_path: PathBuf,
    pub launch_target: PathBuf,
    pub launch_arguments: Vec<String>,
    pub launch_environment: BTreeMap<String, String>,
    pub working_directory: PathBuf,
    pub stdout_log_path: PathBuf,
    pub stderr_log_path: PathBuf,
    pub control_socket_kind: String,
    pub control_socket_location: String,
    pub startup_mode: String,
    pub attach_supported: bool,
    pub repair_supported: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelHostOwnershipMarker {
    pub service_name: String,
    pub active_port: u16,
    pub started_at_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host_pid: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelTopologyInfo {
    pub kind: String,
    pub state: String,
    pub label: String,
    pub recommended: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelRuntimeStatusInfo {
    pub state: String,
    pub health: String,
    pub reason: String,
    pub started_by: String,
    pub last_transition_at: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelEndpointInfo {
    pub preferred_port: u16,
    pub active_port: u16,
    pub base_url: String,
    pub websocket_url: String,
    pub loopback_only: bool,
    pub dynamic_port: bool,
    pub endpoint_source: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelControlSocketInfo {
    pub socket_kind: String,
    pub location: String,
    pub available: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelHostServiceInfo {
    pub service_manager: String,
    pub ownership: String,
    pub service_name: String,
    pub service_config_path: String,
    pub startup_mode: String,
    pub attach_supported: bool,
    pub repair_supported: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub control_socket: Option<DesktopKernelControlSocketInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelProvenanceInfo {
    pub runtime_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_version: Option<String>,
    pub platform: String,
    pub arch: String,
    pub install_source: String,
    pub config_file: String,
    pub runtime_home_dir: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_install_dir: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopKernelHostInfo {
    pub topology: DesktopKernelTopologyInfo,
    pub runtime: DesktopKernelRuntimeStatusInfo,
    pub endpoint: DesktopKernelEndpointInfo,
    pub host: DesktopKernelHostServiceInfo,
    pub provenance: DesktopKernelProvenanceInfo,
}
