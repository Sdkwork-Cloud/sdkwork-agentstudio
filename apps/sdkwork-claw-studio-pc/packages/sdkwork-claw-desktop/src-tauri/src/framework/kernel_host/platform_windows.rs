use super::types::{KernelPlatformServiceSpec, KernelServiceManagerKind};
use crate::framework::{paths::AppPaths, Result};
use serde_json::json;
use std::{collections::BTreeMap, fs, path::Path};

pub(super) fn build_service_spec(
    paths: &AppPaths,
    launcher_path: &Path,
    _service_home_dir: &Path,
) -> KernelPlatformServiceSpec {
    let state_dir = paths.machine_state_dir.join("kernel-host");
    let log_path = paths.machine_logs_dir.join("kernel-host.log");

    KernelPlatformServiceSpec {
        service_manager: KernelServiceManagerKind::WindowsService,
        service_name: "ClawStudioOpenClawKernel".to_string(),
        service_config_path: state_dir.join("windows-service.json"),
        launch_target: launcher_path.to_path_buf(),
        launch_arguments: vec![
            "--run-kernel-host-service".to_string(),
            "--machine-root".to_string(),
            paths.machine_root.to_string_lossy().into_owned(),
            "--user-root".to_string(),
            paths.user_root.to_string_lossy().into_owned(),
        ],
        launch_environment: BTreeMap::from([(
            "SDKWORK_CLAW_KERNEL_HOST".to_string(),
            "windowsService".to_string(),
        )]),
        working_directory: paths.install_root.clone(),
        stdout_log_path: log_path.clone(),
        stderr_log_path: log_path,
        control_socket_kind: "namedPipe".to_string(),
        control_socket_location: r"\\.\pipe\claw-studio-openclaw".to_string(),
        startup_mode: "auto".to_string(),
        attach_supported: true,
        repair_supported: true,
    }
}

pub(super) fn write_service_artifact(spec: &KernelPlatformServiceSpec) -> Result<()> {
    let command_line = std::iter::once(spec.launch_target.to_string_lossy().into_owned())
        .chain(spec.launch_arguments.iter().cloned())
        .collect::<Vec<_>>();
    let document = json!({
        "schemaVersion": 1,
        "serviceName": spec.service_name,
        "serviceManager": spec.service_manager.as_str(),
        "startupMode": spec.startup_mode,
        "workingDirectory": spec.working_directory,
        "command": spec.launch_target,
        "args": spec.launch_arguments,
        "commandLine": command_line,
        "environment": spec.launch_environment,
        "stdoutLogPath": spec.stdout_log_path,
        "stderrLogPath": spec.stderr_log_path,
        "controlSocket": {
            "kind": spec.control_socket_kind,
            "location": spec.control_socket_location,
        },
    });

    fs::write(
        &spec.service_config_path,
        serde_json::to_string_pretty(&document)?,
    )?;
    Ok(())
}
