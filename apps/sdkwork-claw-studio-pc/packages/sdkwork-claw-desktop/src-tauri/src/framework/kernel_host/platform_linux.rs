use super::types::{KernelPlatformServiceSpec, KernelServiceManagerKind};
use crate::framework::{paths::AppPaths, Result};
use std::{collections::BTreeMap, fs, path::Path};

pub(super) fn build_service_spec(
    paths: &AppPaths,
    launcher_path: &Path,
    service_home_dir: &Path,
) -> KernelPlatformServiceSpec {
    let systemd_dir = service_home_dir
        .join(".config")
        .join("systemd")
        .join("user");
    let log_path = paths.machine_logs_dir.join("kernel-host.log");

    KernelPlatformServiceSpec {
        service_manager: KernelServiceManagerKind::SystemdUser,
        service_name: "claw-studio-openclaw".to_string(),
        service_config_path: systemd_dir.join("claw-studio-openclaw.service"),
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
            "systemd".to_string(),
        )]),
        working_directory: paths.install_root.clone(),
        stdout_log_path: log_path.clone(),
        stderr_log_path: log_path,
        control_socket_kind: "unixDomainSocket".to_string(),
        control_socket_location: paths
            .machine_runtime_dir
            .join("kernel-host")
            .join("kernel-host.sock")
            .to_string_lossy()
            .into_owned(),
        startup_mode: "auto".to_string(),
        attach_supported: true,
        repair_supported: true,
    }
}

pub(super) fn write_service_artifact(spec: &KernelPlatformServiceSpec) -> Result<()> {
    let exec_start = std::iter::once(spec.launch_target.to_string_lossy().into_owned())
        .chain(spec.launch_arguments.iter().cloned())
        .map(|value| quote_systemd_arg(&value))
        .collect::<Vec<_>>()
        .join(" ");
    let env = spec
        .launch_environment
        .iter()
        .map(|(key, value)| {
            format!(
                "Environment=\"{}={}\"",
                escape_systemd(key),
                escape_systemd(value)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let document = format!(
        concat!(
            "[Unit]\n",
            "Description=Claw Studio OpenClaw Kernel\n",
            "After=network-online.target\n",
            "Wants=network-online.target\n\n",
            "[Service]\n",
            "Type=simple\n",
            "WorkingDirectory={working_directory}\n",
            "ExecStart={exec_start}\n",
            "{env}\n",
            "Restart=on-failure\n",
            "RestartSec=5\n",
            "StandardOutput=append:{stdout_log_path}\n",
            "StandardError=append:{stderr_log_path}\n\n",
            "[Install]\n",
            "WantedBy=default.target\n"
        ),
        working_directory = quote_systemd_arg(&spec.working_directory.to_string_lossy()),
        exec_start = exec_start,
        env = env,
        stdout_log_path = quote_systemd_arg(&spec.stdout_log_path.to_string_lossy()),
        stderr_log_path = quote_systemd_arg(&spec.stderr_log_path.to_string_lossy()),
    );

    fs::write(&spec.service_config_path, document)?;
    Ok(())
}

fn quote_systemd_arg(value: &str) -> String {
    format!("\"{}\"", escape_systemd(value))
}

fn escape_systemd(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\"', "\\\"")
}
