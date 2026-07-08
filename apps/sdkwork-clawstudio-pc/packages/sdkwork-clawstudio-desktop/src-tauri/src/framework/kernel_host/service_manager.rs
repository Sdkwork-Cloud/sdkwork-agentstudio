use super::{
    native_kernel_host_is_running,
    platform::{current_kernel_host_platform, repair_current_platform_service_artifacts},
    types::{KernelHostPlatform, KernelPlatformServiceSpec},
};
use crate::framework::{
    child_process::configure_hidden_child_process, paths::AppPaths,
    services::openclaw_runtime::ActivatedOpenClawRuntime, FrameworkError, Result,
};
#[cfg(windows)]
use std::ffi::OsString;
use std::{
    fmt,
    process::{Command, Stdio},
    sync::Arc,
    thread,
    time::{Duration, Instant},
};
#[cfg(windows)]
use windows_service::{
    service::{
        ServiceAccess, ServiceAction, ServiceActionType, ServiceErrorControl,
        ServiceFailureActions, ServiceFailureResetPeriod, ServiceInfo, ServiceStartType,
        ServiceState, ServiceType,
    },
    service_manager::{ServiceManager, ServiceManagerAccess},
};

const NATIVE_KERNEL_HOST_READY_TIMEOUT: Duration = Duration::from_secs(20);
const NATIVE_KERNEL_HOST_READY_POLL_INTERVAL: Duration = Duration::from_millis(250);
#[cfg(windows)]
const WINDOWS_SERVICE_STATUS_TIMEOUT: Duration = Duration::from_secs(15);
#[cfg(windows)]
const WINDOWS_SERVICE_DOES_NOT_EXIST: i32 = 1060;
#[cfg(windows)]
const WINDOWS_SERVICE_ALREADY_RUNNING: i32 = 1056;
#[cfg(windows)]
const WINDOWS_SERVICE_NOT_ACTIVE: i32 = 1062;
const STDERR_TAIL_LIMIT: usize = 4 * 1024;

#[derive(Clone)]
pub struct KernelHostServiceManager {
    backend: Arc<dyn KernelHostServicePlatformOps>,
}

impl fmt::Debug for KernelHostServiceManager {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("KernelHostServiceManager").finish()
    }
}

impl KernelHostServiceManager {
    pub fn new() -> Self {
        Self {
            backend: Arc::new(CurrentPlatformKernelHostServiceOps),
        }
    }

    #[cfg(test)]
    pub(crate) fn with_backend(backend: Arc<dyn KernelHostServicePlatformOps>) -> Self {
        Self { backend }
    }

    pub fn ensure_running(
        &self,
        paths: &AppPaths,
        runtime: Option<&ActivatedOpenClawRuntime>,
    ) -> Result<bool> {
        if runtime.is_none() {
            return Ok(false);
        }
        if native_kernel_host_is_running(paths, runtime)? {
            return Ok(true);
        }

        let spec = repair_current_platform_service_artifacts(paths)?;
        self.backend.install_or_update(&spec)?;
        self.backend.start(&spec)?;
        wait_for_native_kernel_host(paths, runtime)
    }

    pub fn restart(
        &self,
        paths: &AppPaths,
        runtime: Option<&ActivatedOpenClawRuntime>,
    ) -> Result<bool> {
        if runtime.is_none() {
            return Ok(false);
        }

        let spec = repair_current_platform_service_artifacts(paths)?;
        self.backend.install_or_update(&spec)?;
        let _ = self.backend.stop(&spec);
        self.backend.start(&spec)?;
        wait_for_native_kernel_host(paths, runtime)
    }
}

pub(crate) trait KernelHostServicePlatformOps: Send + Sync {
    fn install_or_update(&self, spec: &KernelPlatformServiceSpec) -> Result<()>;
    fn start(&self, spec: &KernelPlatformServiceSpec) -> Result<()>;
    fn stop(&self, spec: &KernelPlatformServiceSpec) -> Result<()>;
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct KernelHostShellCommand {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Clone, Copy, Debug, Default)]
struct CurrentPlatformKernelHostServiceOps;

impl KernelHostServicePlatformOps for CurrentPlatformKernelHostServiceOps {
    fn install_or_update(&self, spec: &KernelPlatformServiceSpec) -> Result<()> {
        match current_kernel_host_platform() {
            KernelHostPlatform::Windows => install_or_update_windows_service(spec),
            KernelHostPlatform::Macos | KernelHostPlatform::Linux => Ok(()),
        }
    }

    fn start(&self, spec: &KernelPlatformServiceSpec) -> Result<()> {
        match current_kernel_host_platform() {
            KernelHostPlatform::Windows => start_windows_service(spec),
            KernelHostPlatform::Macos => start_macos_launch_agent(spec),
            KernelHostPlatform::Linux => start_linux_user_service(spec),
        }
    }

    fn stop(&self, spec: &KernelPlatformServiceSpec) -> Result<()> {
        match current_kernel_host_platform() {
            KernelHostPlatform::Windows => stop_windows_service(spec),
            KernelHostPlatform::Macos => stop_macos_launch_agent(spec),
            KernelHostPlatform::Linux => stop_linux_user_service(spec),
        }
    }
}

pub(crate) fn build_launchctl_start_commands(
    spec: &KernelPlatformServiceSpec,
    uid: u32,
) -> Vec<KernelHostShellCommand> {
    let domain = format!("gui/{uid}");
    vec![
        KernelHostShellCommand {
            program: "launchctl".to_string(),
            args: vec![
                "bootstrap".to_string(),
                domain.clone(),
                spec.service_config_path.to_string_lossy().into_owned(),
            ],
        },
        KernelHostShellCommand {
            program: "launchctl".to_string(),
            args: vec![
                "enable".to_string(),
                format!("{domain}/{}", spec.service_name),
            ],
        },
        KernelHostShellCommand {
            program: "launchctl".to_string(),
            args: vec![
                "kickstart".to_string(),
                "-k".to_string(),
                format!("{domain}/{}", spec.service_name),
            ],
        },
    ]
}

pub(crate) fn build_systemd_user_start_commands(
    spec: &KernelPlatformServiceSpec,
) -> Vec<KernelHostShellCommand> {
    vec![
        KernelHostShellCommand {
            program: "systemctl".to_string(),
            args: vec!["--user".to_string(), "daemon-reload".to_string()],
        },
        KernelHostShellCommand {
            program: "systemctl".to_string(),
            args: vec![
                "--user".to_string(),
                "enable".to_string(),
                spec.service_name.clone(),
            ],
        },
        KernelHostShellCommand {
            program: "systemctl".to_string(),
            args: vec![
                "--user".to_string(),
                "restart".to_string(),
                spec.service_name.clone(),
            ],
        },
    ]
}

fn wait_for_native_kernel_host(
    paths: &AppPaths,
    runtime: Option<&ActivatedOpenClawRuntime>,
) -> Result<bool> {
    let deadline = Instant::now() + NATIVE_KERNEL_HOST_READY_TIMEOUT;
    while Instant::now() <= deadline {
        if native_kernel_host_is_running(paths, runtime)? {
            return Ok(true);
        }
        thread::sleep(NATIVE_KERNEL_HOST_READY_POLL_INTERVAL);
    }

    Ok(false)
}

fn start_macos_launch_agent(spec: &KernelPlatformServiceSpec) -> Result<()> {
    let uid = resolve_current_unix_uid();
    if launchctl_service_is_loaded(spec, uid)? {
        run_shell_commands(&build_launchctl_restart_commands(spec, uid))?;
        return Ok(());
    }

    run_shell_commands(&build_launchctl_start_commands(spec, uid))
}

fn stop_macos_launch_agent(spec: &KernelPlatformServiceSpec) -> Result<()> {
    let uid = resolve_current_unix_uid();
    run_shell_command(&KernelHostShellCommand {
        program: "launchctl".to_string(),
        args: vec![
            "bootout".to_string(),
            format!("gui/{uid}/{}", spec.service_name),
        ],
    })
}

fn build_launchctl_restart_commands(
    spec: &KernelPlatformServiceSpec,
    uid: u32,
) -> Vec<KernelHostShellCommand> {
    let mut commands = vec![KernelHostShellCommand {
        program: "launchctl".to_string(),
        args: vec![
            "bootout".to_string(),
            format!("gui/{uid}/{}", spec.service_name),
        ],
    }];
    commands.extend(build_launchctl_start_commands(spec, uid));
    commands
}

fn launchctl_service_is_loaded(spec: &KernelPlatformServiceSpec, uid: u32) -> Result<bool> {
    let output = run_shell_command_capture(&KernelHostShellCommand {
        program: "launchctl".to_string(),
        args: vec![
            "print".to_string(),
            format!("gui/{uid}/{}", spec.service_name),
        ],
    })?;
    Ok(output.status.success())
}

fn start_linux_user_service(spec: &KernelPlatformServiceSpec) -> Result<()> {
    run_shell_commands(&build_systemd_user_start_commands(spec))
}

fn stop_linux_user_service(spec: &KernelPlatformServiceSpec) -> Result<()> {
    run_shell_command(&KernelHostShellCommand {
        program: "systemctl".to_string(),
        args: vec![
            "--user".to_string(),
            "stop".to_string(),
            spec.service_name.clone(),
        ],
    })
}

fn run_shell_commands(commands: &[KernelHostShellCommand]) -> Result<()> {
    for command in commands {
        run_shell_command(command)?;
    }
    Ok(())
}

fn run_shell_command(command: &KernelHostShellCommand) -> Result<()> {
    let output = run_shell_command_capture(command)?;
    if output.status.success() {
        return Ok(());
    }

    Err(FrameworkError::ProcessFailed {
        command: render_shell_command(command),
        exit_code: output.status.code(),
        stderr_tail: truncate_stderr_tail(&String::from_utf8_lossy(&output.stderr)),
    })
}

fn run_shell_command_capture(command: &KernelHostShellCommand) -> Result<std::process::Output> {
    let mut process = Command::new(&command.program);
    process.args(&command.args);
    process.stdin(Stdio::null());
    process.stdout(Stdio::piped());
    process.stderr(Stdio::piped());
    configure_hidden_child_process(&mut process);
    Ok(process.output()?)
}

fn render_shell_command(command: &KernelHostShellCommand) -> String {
    std::iter::once(command.program.as_str())
        .chain(command.args.iter().map(String::as_str))
        .collect::<Vec<_>>()
        .join(" ")
}

fn truncate_stderr_tail(stderr: &str) -> String {
    let trimmed = stderr.trim();
    if trimmed.len() <= STDERR_TAIL_LIMIT {
        return trimmed.to_string();
    }
    trimmed[trimmed.len() - STDERR_TAIL_LIMIT..].to_string()
}

#[cfg(unix)]
fn resolve_current_unix_uid() -> u32 {
    unsafe { libc::getuid() }
}

#[cfg(not(unix))]
fn resolve_current_unix_uid() -> u32 {
    0
}

#[cfg(windows)]
fn install_or_update_windows_service(spec: &KernelPlatformServiceSpec) -> Result<()> {
    let manager = ServiceManager::local_computer(
        None::<&str>,
        ServiceManagerAccess::CONNECT | ServiceManagerAccess::CREATE_SERVICE,
    )
    .map_err(map_windows_service_error)?;
    let desired = build_windows_service_info(spec);
    let service_access = ServiceAccess::QUERY_STATUS
        | ServiceAccess::START
        | ServiceAccess::STOP
        | ServiceAccess::CHANGE_CONFIG
        | ServiceAccess::QUERY_CONFIG;

    let service = match manager.open_service(&spec.service_name, service_access) {
        Ok(service) => {
            service
                .change_config(&desired)
                .map_err(map_windows_service_error)?;
            service
        }
        Err(error)
            if windows_service_error_code(&error) == Some(WINDOWS_SERVICE_DOES_NOT_EXIST) =>
        {
            manager
                .create_service(&desired, service_access)
                .map_err(map_windows_service_error)?
        }
        Err(error) => return Err(map_windows_service_error(error)),
    };

    service
        .set_description(windows_service_description())
        .map_err(map_windows_service_error)?;
    service
        .set_delayed_auto_start(true)
        .map_err(map_windows_service_error)?;
    service
        .set_failure_actions_on_non_crash_failures(true)
        .map_err(map_windows_service_error)?;
    service
        .update_failure_actions(windows_service_failure_actions())
        .map_err(map_windows_service_error)?;
    Ok(())
}

#[cfg(not(windows))]
fn install_or_update_windows_service(_spec: &KernelPlatformServiceSpec) -> Result<()> {
    Err(FrameworkError::InvalidOperation(
        "windows service integration is unavailable on this platform".to_string(),
    ))
}

#[cfg(windows)]
fn start_windows_service(spec: &KernelPlatformServiceSpec) -> Result<()> {
    let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)
        .map_err(map_windows_service_error)?;
    let service = manager
        .open_service(
            &spec.service_name,
            ServiceAccess::QUERY_STATUS | ServiceAccess::START,
        )
        .map_err(map_windows_service_error)?;
    let status = service.query_status().map_err(map_windows_service_error)?;
    if matches!(
        status.current_state,
        ServiceState::Running | ServiceState::StartPending
    ) {
        return Ok(());
    }

    match service.start(&[] as &[OsString]) {
        Ok(()) => {}
        Err(error)
            if windows_service_error_code(&error) == Some(WINDOWS_SERVICE_ALREADY_RUNNING) =>
        {
            return Ok(());
        }
        Err(error) => return Err(map_windows_service_error(error)),
    }

    wait_for_windows_service_state(
        &spec.service_name,
        &service,
        ServiceState::Running,
        WINDOWS_SERVICE_STATUS_TIMEOUT,
    )
}

#[cfg(not(windows))]
fn start_windows_service(_spec: &KernelPlatformServiceSpec) -> Result<()> {
    Err(FrameworkError::InvalidOperation(
        "windows service integration is unavailable on this platform".to_string(),
    ))
}

#[cfg(windows)]
fn stop_windows_service(spec: &KernelPlatformServiceSpec) -> Result<()> {
    let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)
        .map_err(map_windows_service_error)?;
    let service = manager
        .open_service(
            &spec.service_name,
            ServiceAccess::QUERY_STATUS | ServiceAccess::STOP,
        )
        .map_err(map_windows_service_error)?;
    let status = service.query_status().map_err(map_windows_service_error)?;
    if status.current_state == ServiceState::Stopped {
        return Ok(());
    }

    match service.stop() {
        Ok(_) => {}
        Err(error) if windows_service_error_code(&error) == Some(WINDOWS_SERVICE_NOT_ACTIVE) => {
            return Ok(());
        }
        Err(error) => return Err(map_windows_service_error(error)),
    }

    wait_for_windows_service_state(
        &spec.service_name,
        &service,
        ServiceState::Stopped,
        WINDOWS_SERVICE_STATUS_TIMEOUT,
    )
}

#[cfg(not(windows))]
fn stop_windows_service(_spec: &KernelPlatformServiceSpec) -> Result<()> {
    Err(FrameworkError::InvalidOperation(
        "windows service integration is unavailable on this platform".to_string(),
    ))
}

#[cfg(windows)]
fn build_windows_service_info(spec: &KernelPlatformServiceSpec) -> ServiceInfo {
    ServiceInfo {
        name: OsString::from(&spec.service_name),
        display_name: OsString::from(windows_service_display_name()),
        service_type: ServiceType::OWN_PROCESS,
        start_type: ServiceStartType::AutoStart,
        error_control: ServiceErrorControl::Normal,
        executable_path: spec.launch_target.clone(),
        launch_arguments: spec.launch_arguments.iter().map(OsString::from).collect(),
        dependencies: Vec::new(),
        account_name: None,
        account_password: None,
    }
}

#[cfg(windows)]
fn windows_service_display_name() -> &'static str {
    "Claw Studio OpenClaw Kernel"
}

#[cfg(windows)]
fn windows_service_description() -> &'static str {
    "Owns the built-in OpenClaw kernel managed by Claw Studio."
}

#[cfg(windows)]
fn windows_service_failure_actions() -> ServiceFailureActions {
    ServiceFailureActions {
        reset_period: ServiceFailureResetPeriod::After(Duration::from_secs(24 * 60 * 60)),
        reboot_msg: None,
        command: None,
        actions: Some(vec![
            ServiceAction {
                action_type: ServiceActionType::Restart,
                delay: Duration::from_secs(5),
            },
            ServiceAction {
                action_type: ServiceActionType::Restart,
                delay: Duration::from_secs(15),
            },
            ServiceAction {
                action_type: ServiceActionType::Restart,
                delay: Duration::from_secs(30),
            },
        ]),
    }
}

#[cfg(windows)]
fn wait_for_windows_service_state(
    service_name: &str,
    service: &windows_service::service::Service,
    target_state: ServiceState,
    timeout: Duration,
) -> Result<()> {
    let deadline = Instant::now() + timeout;
    while Instant::now() <= deadline {
        let status = service.query_status().map_err(map_windows_service_error)?;
        if status.current_state == target_state {
            return Ok(());
        }
        thread::sleep(NATIVE_KERNEL_HOST_READY_POLL_INTERVAL);
    }

    Err(FrameworkError::Timeout(format!(
        "windows service {} did not reach {:?} within {}ms",
        service_name,
        target_state,
        timeout.as_millis()
    )))
}

#[cfg(windows)]
fn windows_service_error_code(error: &windows_service::Error) -> Option<i32> {
    match error {
        windows_service::Error::Winapi(inner) => inner.raw_os_error(),
        _ => None,
    }
}

#[cfg(windows)]
fn map_windows_service_error(error: windows_service::Error) -> FrameworkError {
    match error {
        windows_service::Error::Winapi(inner) => FrameworkError::Io(inner),
        other => FrameworkError::Internal(format!("windows service error: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_launchctl_start_commands, build_systemd_user_start_commands,
        KernelHostServiceManager, KernelHostServicePlatformOps,
    };
    use crate::framework::{
        kernel_host::{
            clear_kernel_host_ownership_marker,
            platform::resolve_platform_service_spec,
            types::{KernelHostOwnershipMarker, KernelHostPlatform},
            write_kernel_host_ownership_marker,
        },
        paths::resolve_paths_for_root,
        services::openclaw_runtime::ActivatedOpenClawRuntime,
    };
    use std::{
        net::TcpListener,
        path::PathBuf,
        sync::{Arc, Mutex},
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn macos_start_commands_bootstrap_enable_and_kickstart_launch_agent() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let spec = resolve_platform_service_spec(KernelHostPlatform::Macos, &paths);

        let commands = build_launchctl_start_commands(&spec, 501);

        assert_eq!(commands.len(), 3);
        assert_eq!(commands[0].program, "launchctl");
        assert_eq!(
            commands[0].args,
            vec![
                "bootstrap".to_string(),
                "gui/501".to_string(),
                spec.service_config_path.to_string_lossy().into_owned(),
            ]
        );
        assert_eq!(
            commands[1].args,
            vec![
                "enable".to_string(),
                format!("gui/501/{}", spec.service_name)
            ]
        );
        assert_eq!(
            commands[2].args,
            vec![
                "kickstart".to_string(),
                "-k".to_string(),
                format!("gui/501/{}", spec.service_name),
            ]
        );
    }

    #[test]
    fn linux_start_commands_reload_enable_and_restart_user_unit() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let spec = resolve_platform_service_spec(KernelHostPlatform::Linux, &paths);

        let commands = build_systemd_user_start_commands(&spec);

        assert_eq!(commands.len(), 3);
        assert_eq!(commands[0].program, "systemctl");
        assert_eq!(
            commands[0].args,
            vec!["--user".to_string(), "daemon-reload".to_string()]
        );
        assert_eq!(
            commands[1].args,
            vec![
                "--user".to_string(),
                "enable".to_string(),
                spec.service_name.clone(),
            ]
        );
        assert_eq!(
            commands[2].args,
            vec![
                "--user".to_string(),
                "restart".to_string(),
                spec.service_name.clone(),
            ]
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_service_info_uses_own_process_autostart_and_launcher_arguments() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let spec = resolve_platform_service_spec(KernelHostPlatform::Windows, &paths);

        let info = super::build_windows_service_info(&spec);
        let failure_actions = super::windows_service_failure_actions();

        assert_eq!(
            info.service_type,
            windows_service::service::ServiceType::OWN_PROCESS
        );
        assert_eq!(
            info.start_type,
            windows_service::service::ServiceStartType::AutoStart
        );
        assert_eq!(
            info.display_name,
            std::ffi::OsString::from("Claw Studio OpenClaw Kernel")
        );
        assert!(info
            .launch_arguments
            .iter()
            .any(|value| value == "--run-kernel-host-service"));
        assert_eq!(failure_actions.actions.expect("failure actions").len(), 3);
    }

    #[test]
    fn ensure_running_installs_and_starts_native_service_until_marker_is_live() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_runtime(&paths, reserve_loopback_port());
        let backend = Arc::new(FakePlatformOps::new(paths.clone(), runtime.gateway_port));
        let manager = KernelHostServiceManager::with_backend(backend.clone());

        let attached = manager
            .ensure_running(&paths, Some(&runtime))
            .expect("ensure running");

        assert!(attached);
        assert_eq!(
            backend.events(),
            vec!["install".to_string(), "start".to_string()]
        );
    }

    #[test]
    fn restart_stops_and_starts_native_service_again() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_runtime(&paths, reserve_loopback_port());
        let backend = Arc::new(FakePlatformOps::new(paths.clone(), runtime.gateway_port));
        let manager = KernelHostServiceManager::with_backend(backend.clone());

        manager
            .ensure_running(&paths, Some(&runtime))
            .expect("initial ensure");
        let restarted = manager.restart(&paths, Some(&runtime)).expect("restart");

        assert!(restarted);
        assert_eq!(
            backend.events(),
            vec![
                "install".to_string(),
                "start".to_string(),
                "install".to_string(),
                "stop".to_string(),
                "start".to_string(),
            ]
        );
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

    fn reserve_loopback_port() -> u16 {
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("listener");
        let port = listener.local_addr().expect("listener addr").port();
        drop(listener);
        port
    }

    #[derive(Debug)]
    struct FakePlatformOps {
        paths: crate::framework::paths::AppPaths,
        gateway_port: u16,
        events: Mutex<Vec<String>>,
        listener: Mutex<Option<TcpListener>>,
    }

    impl FakePlatformOps {
        fn new(paths: crate::framework::paths::AppPaths, gateway_port: u16) -> Self {
            Self {
                paths,
                gateway_port,
                events: Mutex::new(Vec::new()),
                listener: Mutex::new(None),
            }
        }

        fn events(&self) -> Vec<String> {
            self.events.lock().expect("events").clone()
        }
    }

    impl KernelHostServicePlatformOps for FakePlatformOps {
        fn install_or_update(
            &self,
            _spec: &crate::framework::kernel_host::types::KernelPlatformServiceSpec,
        ) -> crate::framework::Result<()> {
            self.events
                .lock()
                .expect("events")
                .push("install".to_string());
            Ok(())
        }

        fn start(
            &self,
            spec: &crate::framework::kernel_host::types::KernelPlatformServiceSpec,
        ) -> crate::framework::Result<()> {
            self.events
                .lock()
                .expect("events")
                .push("start".to_string());
            let listener =
                TcpListener::bind(("127.0.0.1", self.gateway_port)).expect("gateway listener");
            *self.listener.lock().expect("listener") = Some(listener);
            write_kernel_host_ownership_marker(
                &self.paths,
                &KernelHostOwnershipMarker {
                    service_name: spec.service_name.clone(),
                    active_port: self.gateway_port,
                    started_at_ms: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                    host_pid: Some(42),
                },
            )?;
            Ok(())
        }

        fn stop(
            &self,
            _spec: &crate::framework::kernel_host::types::KernelPlatformServiceSpec,
        ) -> crate::framework::Result<()> {
            self.events.lock().expect("events").push("stop".to_string());
            self.listener.lock().expect("listener").take();
            clear_kernel_host_ownership_marker(&self.paths)?;
            Ok(())
        }
    }
}
