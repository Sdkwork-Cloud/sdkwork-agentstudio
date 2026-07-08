use super::types::{KernelPlatformServiceSpec, KernelServiceManagerKind};
use crate::framework::{paths::AppPaths, Result};
use std::{collections::BTreeMap, fs, path::Path};

pub(super) fn build_service_spec(
    paths: &AppPaths,
    launcher_path: &Path,
    service_home_dir: &Path,
) -> KernelPlatformServiceSpec {
    let agent_dir = service_home_dir.join("Library").join("LaunchAgents");
    let log_path = paths.machine_logs_dir.join("kernel-host.log");

    KernelPlatformServiceSpec {
        service_manager: KernelServiceManagerKind::LaunchdLaunchAgent,
        service_name: "ai.sdkwork.clawstudio.openclaw".to_string(),
        service_config_path: agent_dir.join("ai.sdkwork.clawstudio.openclaw.plist"),
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
            "launchd".to_string(),
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
    let args = std::iter::once(spec.launch_target.to_string_lossy().into_owned())
        .chain(spec.launch_arguments.iter().cloned())
        .map(|value| format!("    <string>{}</string>", escape_xml(&value)))
        .collect::<Vec<_>>()
        .join("\n");
    let env = spec
        .launch_environment
        .iter()
        .map(|(key, value)| {
            format!(
                "      <key>{}</key>\n      <string>{}</string>",
                escape_xml(key),
                escape_xml(value)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let document = format!(
        concat!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n",
            "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" ",
            "\"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n",
            "<plist version=\"1.0\">\n",
            "<dict>\n",
            "  <key>Label</key>\n",
            "  <string>{label}</string>\n",
            "  <key>ProgramArguments</key>\n",
            "  <array>\n",
            "{args}\n",
            "  </array>\n",
            "  <key>RunAtLoad</key>\n",
            "  <true/>\n",
            "  <key>KeepAlive</key>\n",
            "  <true/>\n",
            "  <key>WorkingDirectory</key>\n",
            "  <string>{working_directory}</string>\n",
            "  <key>StandardOutPath</key>\n",
            "  <string>{stdout_log_path}</string>\n",
            "  <key>StandardErrorPath</key>\n",
            "  <string>{stderr_log_path}</string>\n",
            "  <key>EnvironmentVariables</key>\n",
            "  <dict>\n",
            "{env}\n",
            "  </dict>\n",
            "</dict>\n",
            "</plist>\n"
        ),
        label = escape_xml(&spec.service_name),
        args = args,
        working_directory = escape_xml(&spec.working_directory.to_string_lossy()),
        stdout_log_path = escape_xml(&spec.stdout_log_path.to_string_lossy()),
        stderr_log_path = escape_xml(&spec.stderr_log_path.to_string_lossy()),
        env = env,
    );

    fs::write(&spec.service_config_path, document)?;
    Ok(())
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('\"', "&quot;")
        .replace('\'', "&apos;")
}
