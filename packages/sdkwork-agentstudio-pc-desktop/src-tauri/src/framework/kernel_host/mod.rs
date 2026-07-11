pub mod platform;
mod platform_linux;
mod platform_macos;
mod platform_windows;
pub mod service_manager;
pub mod types;

use self::{
    platform::resolve_current_platform_service_spec,
    types::{
        DesktopKernelControlSocketInfo, DesktopKernelEndpointInfo, DesktopKernelHostInfo,
        DesktopKernelHostServiceInfo, DesktopKernelProvenanceInfo, DesktopKernelRuntimeStatusInfo,
        DesktopKernelTopologyInfo, KernelHostOwnershipMarker,
    },
};
use crate::framework::{
    kernel::DesktopSupervisorInfo,
    paths::AppPaths,
    services::{
        kernel_runtime_authority::KernelRuntimeAuthorityService,
        openclaw_runtime::{
            load_manifest, ActivatedOpenClawRuntime, DEFAULT_GATEWAY_PORT, OPENCLAW_RUNTIME_ID,
        },
        supervisor::SERVICE_ID_OPENCLAW_GATEWAY,
    },
    Result,
};
use std::{
    fs,
    net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpStream},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const DEFAULT_PREFERRED_PORT: u16 = DEFAULT_GATEWAY_PORT;
const KERNEL_HOST_OWNERSHIP_MARKER_FILE: &str = "kernel-host/runtime-owner.json";

#[cfg(test)]
mod tests {
    use super::{
        build_desktop_kernel_host_info,
        platform::{
            repair_platform_service_artifacts, resolve_platform_service_spec, KernelHostPlatform,
        },
        types::{DesktopKernelHostInfo, KernelHostOwnershipMarker, KernelServiceManagerKind},
        write_kernel_host_ownership_marker,
    };
    use crate::framework::{
        kernel::{DesktopSupervisorInfo, DesktopSupervisorServiceInfo},
        paths::{resolve_paths_for_root, OPENCLAW_KERNEL_ID},
        services::openclaw_runtime::ActivatedOpenClawRuntime,
    };
    use std::{fs, net::TcpListener, path::PathBuf};

    fn normalize(path: &std::path::Path) -> String {
        path.to_string_lossy().replace('\\', "/")
    }

    fn fake_runtime(
        paths: &crate::framework::paths::AppPaths,
        gateway_port: u16,
    ) -> ActivatedOpenClawRuntime {
        ActivatedOpenClawRuntime {
            install_key: "test-runtime".to_string(),
            install_dir: paths.openclaw_runtime_dir.join("test-runtime"),
            runtime_dir: paths
                .openclaw_runtime_dir
                .join("test-runtime")
                .join("runtime"),
            node_path: PathBuf::from("node"),
            cli_path: paths
                .openclaw_runtime_dir
                .join("test-runtime")
                .join("runtime")
                .join("package")
                .join("node_modules")
                .join("openclaw")
                .join("openclaw.mjs"),
            home_dir: paths.user_root.clone(),
            state_dir: paths.openclaw_root_dir.clone(),
            workspace_dir: paths.openclaw_workspace_dir.clone(),
            config_path: paths.openclaw_config_file.clone(),
            gateway_port,
            gateway_auth_token: "test-token".to_string(),
        }
    }

    fn stopped_supervisor() -> DesktopSupervisorInfo {
        DesktopSupervisorInfo {
            lifecycle: "running".to_string(),
            shutdown_requested: false,
            service_count: 1,
            managed_service_ids: vec!["openclaw_gateway".to_string()],
            services: vec![DesktopSupervisorServiceInfo {
                id: "openclaw_gateway".to_string(),
                display_name: "OpenClaw Gateway".to_string(),
                lifecycle: "stopped".to_string(),
                pid: None,
                last_exit_code: None,
                restart_count: 0,
                last_error: None,
            }],
        }
    }

    fn assert_native_service(info: &DesktopKernelHostInfo, port: u16) {
        assert_eq!(info.runtime.started_by, "nativeService");
        assert_eq!(info.host.ownership, "nativeService");
        assert_eq!(info.runtime.state, "running");
        assert_eq!(info.runtime.health, "healthy");
        assert_eq!(info.endpoint.active_port, port);
        assert_eq!(info.endpoint.endpoint_source, "attached");
    }

    #[test]
    fn platform_service_specs_cover_windows_macos_and_linux_hosts() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let windows = resolve_platform_service_spec(KernelHostPlatform::Windows, &paths);
        assert_eq!(
            windows.service_manager,
            KernelServiceManagerKind::WindowsService
        );
        assert_eq!(windows.service_name, "agentstudioOpenClawKernel");
        assert!(normalize(&windows.launch_target).ends_with("install/agent-studio.exe"));
        assert!(normalize(&windows.service_config_path)
            .ends_with("machine/state/kernel-host/windows-service.json"));
        assert_eq!(windows.launch_arguments[0], "--run-kernel-host-service");

        let macos = resolve_platform_service_spec(KernelHostPlatform::Macos, &paths);
        assert_eq!(
            macos.service_manager,
            KernelServiceManagerKind::LaunchdLaunchAgent
        );
        assert_eq!(macos.service_name, "ai.sdkwork.agentstudio.openclaw");
        assert!(normalize(&macos.launch_target).ends_with("install/agent-studio"));
        assert!(normalize(&macos.service_config_path)
            .ends_with("app-user-root/Library/LaunchAgents/ai.sdkwork.agentstudio.openclaw.plist"));
        assert_eq!(macos.launch_arguments[0], "--run-kernel-host-service");

        let linux = resolve_platform_service_spec(KernelHostPlatform::Linux, &paths);
        assert_eq!(linux.service_manager, KernelServiceManagerKind::SystemdUser);
        assert_eq!(linux.service_name, "agent-studio-openclaw");
        assert!(normalize(&linux.launch_target).ends_with("install/agent-studio"));
        assert!(normalize(&linux.service_config_path)
            .ends_with("app-user-root/.config/systemd/user/agent-studio-openclaw.service"));
        assert_eq!(linux.launch_arguments[0], "--run-kernel-host-service");
    }

    #[test]
    fn repair_platform_service_artifacts_writes_kernel_host_launch_specs_for_all_platforms() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let launcher = paths.install_root.join(if cfg!(windows) {
            "agent-studio.exe"
        } else {
            "agent-studio"
        });
        fs::write(&launcher, "launcher").expect("launcher");

        let windows = repair_platform_service_artifacts(
            KernelHostPlatform::Windows,
            &paths,
            launcher.as_path(),
        )
        .expect("windows artifacts");
        let windows_spec = serde_json::from_str::<serde_json::Value>(
            &fs::read_to_string(&windows.service_config_path).expect("windows service spec"),
        )
        .expect("windows service json");
        let windows_args = windows_spec
            .get("args")
            .and_then(serde_json::Value::as_array)
            .expect("windows args");
        assert!(windows_args
            .iter()
            .any(|value| value == "--run-kernel-host-service"));
        assert!(windows_args.iter().any(|value| {
            value.as_str() == Some(paths.machine_root.to_string_lossy().as_ref())
        }));
        assert!(windows_args
            .iter()
            .any(|value| { value.as_str() == Some(paths.user_root.to_string_lossy().as_ref()) }));

        let macos = repair_platform_service_artifacts(
            KernelHostPlatform::Macos,
            &paths,
            launcher.as_path(),
        )
        .expect("macos artifacts");
        let macos_plist =
            fs::read_to_string(&macos.service_config_path).expect("macos launch agent");
        assert!(macos_plist.contains("KeepAlive"));
        assert!(macos_plist.contains("--run-kernel-host-service"));
        assert!(normalize(&macos.service_config_path)
            .ends_with("app-user-root/Library/LaunchAgents/ai.sdkwork.agentstudio.openclaw.plist"));

        let linux = repair_platform_service_artifacts(
            KernelHostPlatform::Linux,
            &paths,
            launcher.as_path(),
        )
        .expect("linux artifacts");
        let linux_unit =
            fs::read_to_string(&linux.service_config_path).expect("linux systemd unit");
        assert!(linux_unit.contains("Restart=on-failure"));
        assert!(linux_unit.contains("--run-kernel-host-service"));
        assert!(normalize(&linux.service_config_path)
            .ends_with("app-user-root/.config/systemd/user/agent-studio-openclaw.service"));
    }

    #[test]
    fn desktop_kernel_host_info_reports_native_service_when_host_marker_is_present() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("listener");
        let gateway_port = listener.local_addr().expect("listener addr").port();
        let runtime = fake_runtime(&paths, gateway_port);

        write_kernel_host_ownership_marker(
            &paths,
            &KernelHostOwnershipMarker {
                service_name: "agent-studio-openclaw".to_string(),
                active_port: gateway_port,
                started_at_ms: 123,
                host_pid: Some(42),
            },
        )
        .expect("write marker");

        let info = build_desktop_kernel_host_info(
            &paths,
            Some(&runtime),
            &stopped_supervisor(),
            OPENCLAW_KERNEL_ID,
        )
        .expect("host info");

        assert_native_service(&info, gateway_port);
    }

    #[test]
    fn desktop_kernel_host_info_uses_user_root_as_openclaw_home_without_configured_runtime() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let info =
            build_desktop_kernel_host_info(&paths, None, &stopped_supervisor(), OPENCLAW_KERNEL_ID)
                .expect("host info");

        assert!(info
            .provenance
            .runtime_home_dir
            .replace('\\', "/")
            .ends_with("app-user-root"));
    }
}

pub fn write_kernel_host_ownership_marker(
    paths: &AppPaths,
    marker: &KernelHostOwnershipMarker,
) -> Result<()> {
    let marker_path = kernel_host_ownership_marker_path(paths);
    if let Some(parent) = marker_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&marker_path, serde_json::to_string_pretty(marker)?)?;
    Ok(())
}

pub fn clear_kernel_host_ownership_marker(paths: &AppPaths) -> Result<()> {
    let marker_path = kernel_host_ownership_marker_path(paths);
    if marker_path.exists() {
        fs::remove_file(marker_path)?;
    }
    Ok(())
}

pub fn native_kernel_host_is_running(
    paths: &AppPaths,
    runtime: Option<&ActivatedOpenClawRuntime>,
) -> Result<bool> {
    let Some(marker) = read_kernel_host_ownership_marker(paths)? else {
        return Ok(false);
    };
    let expected_port = runtime
        .map(|configured| configured.gateway_port)
        .unwrap_or(marker.active_port);
    if marker.active_port != expected_port {
        return Ok(false);
    }
    Ok(loopback_port_is_ready(marker.active_port))
}

fn read_kernel_host_ownership_marker(
    paths: &AppPaths,
) -> Result<Option<KernelHostOwnershipMarker>> {
    let marker_path = kernel_host_ownership_marker_path(paths);
    if !marker_path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(marker_path)?;
    Ok(Some(serde_json::from_str::<KernelHostOwnershipMarker>(
        &content,
    )?))
}

fn kernel_host_ownership_marker_path(paths: &AppPaths) -> std::path::PathBuf {
    paths
        .machine_state_dir
        .join(KERNEL_HOST_OWNERSHIP_MARKER_FILE)
}

fn loopback_port_is_ready(port: u16) -> bool {
    let loopback = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, port));
    TcpStream::connect_timeout(&loopback, Duration::from_millis(200)).is_ok()
}

pub fn build_desktop_kernel_host_info(
    paths: &AppPaths,
    runtime: Option<&ActivatedOpenClawRuntime>,
    supervisor: &DesktopSupervisorInfo,
    runtime_id: &str,
) -> Result<DesktopKernelHostInfo> {
    let service_spec = resolve_current_platform_service_spec(paths);
    let managed_service = supervisor
        .services
        .iter()
        .find(|service| service.id == SERVICE_ID_OPENCLAW_GATEWAY);
    let native_host_running = native_kernel_host_is_running(paths, runtime)?;
    let marker = if native_host_running {
        read_kernel_host_ownership_marker(paths)?
    } else {
        None
    };
    let lifecycle = managed_service
        .map(|service| service.lifecycle.as_str())
        .unwrap_or("stopped");
    let runtime_state = if native_host_running {
        "running"
    } else {
        match lifecycle {
            "running" => "running",
            "starting" => "starting",
            "failed" => "failedSafe",
            "stopping" => "stopped",
            _ => "stopped",
        }
    };
    let runtime_health = match runtime_state {
        "running" => "healthy",
        "failedSafe" => "failedSafe",
        _ => "degraded",
    };
    let active_port = marker
        .as_ref()
        .map(|ownership| ownership.active_port)
        .or_else(|| runtime.map(|configured| configured.gateway_port))
        .unwrap_or(DEFAULT_PREFERRED_PORT);
    let manifest = runtime
        .and_then(|configured| load_manifest(&configured.install_dir.join("manifest.json")).ok());
    let install_key = runtime.map(|configured| configured.install_key.clone());
    let endpoint_source = if native_host_running {
        "attached"
    } else if active_port == DEFAULT_PREFERRED_PORT {
        "configured"
    } else {
        "allocated"
    };
    let ownership = if native_host_running {
        "nativeService"
    } else {
        "appSupervisor"
    };
    let runtime_label = match runtime_id.trim() {
        OPENCLAW_RUNTIME_ID => "OpenClaw",
        "hermes" => "Hermes",
        _ => "managed runtime",
    };
    let runtime_kernel_paths = paths.kernel_paths(runtime_id).ok();

    Ok(DesktopKernelHostInfo {
        topology: DesktopKernelTopologyInfo {
            kind: "localManagedNative".to_string(),
            state: "installed".to_string(),
            label: "Built-In Native Runtime".to_string(),
            recommended: true,
        },
        runtime: DesktopKernelRuntimeStatusInfo {
            state: runtime_state.to_string(),
            health: runtime_health.to_string(),
            reason: match runtime_state {
                "running" if native_host_running => {
                    format!("Kernel attached to a healthy native-service {runtime_label} host.")
                }
                "running" => format!("Kernel attached to a healthy local {runtime_label} host."),
                "starting" => "Kernel launch is in progress.".to_string(),
                "failedSafe" => {
                    "Kernel entered failed-safe mode after exhausting restart attempts.".to_string()
                }
                _ => "Kernel is provisioned but not currently running.".to_string(),
            },
            started_by: ownership.to_string(),
            last_transition_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        },
        endpoint: DesktopKernelEndpointInfo {
            preferred_port: DEFAULT_PREFERRED_PORT,
            active_port,
            base_url: format!("http://127.0.0.1:{active_port}"),
            websocket_url: format!("ws://127.0.0.1:{active_port}"),
            loopback_only: true,
            dynamic_port: active_port != DEFAULT_PREFERRED_PORT,
            endpoint_source: endpoint_source.to_string(),
        },
        host: DesktopKernelHostServiceInfo {
            service_manager: service_spec.service_manager.as_str().to_string(),
            ownership: ownership.to_string(),
            service_name: service_spec.service_name,
            service_config_path: service_spec
                .service_config_path
                .to_string_lossy()
                .into_owned(),
            startup_mode: service_spec.startup_mode,
            attach_supported: service_spec.attach_supported,
            repair_supported: service_spec.repair_supported,
            control_socket: Some(DesktopKernelControlSocketInfo {
                socket_kind: service_spec.control_socket_kind,
                location: service_spec.control_socket_location,
                available: false,
            }),
        },
        provenance: DesktopKernelProvenanceInfo {
            runtime_id: runtime_id.trim().to_string(),
            install_key,
            runtime_version: manifest.as_ref().map(|item| item.openclaw_version.clone()),
            node_version: manifest
                .as_ref()
                .and_then(|item| item.external_node_version().map(str::to_string)),
            platform: manifest
                .as_ref()
                .map(|item| item.platform.clone())
                .unwrap_or_else(|| crate::platform::current_target().to_string()),
            arch: manifest
                .as_ref()
                .map(|item| item.arch.clone())
                .unwrap_or_else(|| crate::platform::current_arch().to_string()),
            install_source: "bundled".to_string(),
            config_file: if runtime_id.trim() == OPENCLAW_RUNTIME_ID {
                runtime
                    .map(|configured| configured.config_path.to_string_lossy().into_owned())
                    .unwrap_or_else(|| {
                        KernelRuntimeAuthorityService::new()
                            .active_config_file_path(runtime_id, paths)
                            .unwrap_or_else(|_| {
                                runtime_kernel_paths
                                    .as_ref()
                                    .map(|kernel| kernel.config_file.clone())
                                    .unwrap_or_else(|| paths.openclaw_config_file.clone())
                            })
                            .to_string_lossy()
                            .into_owned()
                    })
            } else {
                KernelRuntimeAuthorityService::new()
                    .active_config_file_path(runtime_id, paths)
                    .unwrap_or_else(|_| {
                        runtime_kernel_paths
                            .as_ref()
                            .map(|kernel| kernel.config_file.clone())
                            .unwrap_or_else(|| {
                                paths
                                    .kernels_state_dir
                                    .join(runtime_id.trim())
                                    .join("config")
                                    .join(format!("{}.json", runtime_id.trim()))
                            })
                    })
                    .to_string_lossy()
                    .into_owned()
            },
            runtime_home_dir: runtime
                .map(|configured| configured.home_dir.to_string_lossy().into_owned())
                .or_else(|| {
                    if runtime_id.trim() == OPENCLAW_RUNTIME_ID {
                        return Some(paths.user_root.to_string_lossy().into_owned());
                    }

                    runtime_kernel_paths
                        .as_ref()
                        .map(|kernel| kernel.kernel_state_dir.to_string_lossy().into_owned())
                })
                .unwrap_or_else(|| paths.user_root.to_string_lossy().into_owned()),
            runtime_install_dir: runtime
                .map(|configured| configured.install_dir.to_string_lossy().into_owned())
                .or_else(|| {
                    runtime_kernel_paths
                        .as_ref()
                        .map(|kernel| kernel.runtime_dir.to_string_lossy().into_owned())
                }),
        },
    })
}
