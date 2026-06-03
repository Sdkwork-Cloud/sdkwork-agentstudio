use super::requests::ProcessExecutionRequest;
use crate::framework::{
    kernel::DesktopProcessProfileInfo,
    paths::AppPaths,
    services::openclaw_runtime::ActivatedOpenClawRuntime,
    FrameworkError, Result,
};
use std::{collections::BTreeMap, env, path::PathBuf};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProcessProfile {
    pub id: String,
    pub job_kind: String,
    command: ProcessProfileCommand,
    display_command: String,
    display_args: Vec<String>,
    default_timeout_ms: u64,
    allow_cancellation: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum ProcessProfileCommand {
    Static {
        command: String,
        args: Vec<String>,
        cwd: Option<PathBuf>,
        env: BTreeMap<String, String>,
    },
    ManagedOpenClaw {
        args: Vec<String>,
    },
    ManagedNpx {
        args: Vec<String>,
    },
}

pub(crate) fn resolve_profile(profile_id: &str) -> Result<ProcessProfile> {
    let normalized = profile_id.trim();
    if normalized.is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "process profile id must not be empty".to_string(),
        ));
    }

    available_profiles()
        .into_iter()
        .find(|profile| profile.id == normalized)
        .ok_or_else(|| FrameworkError::NotFound(format!("process profile not found: {normalized}")))
}

pub(crate) fn available_profiles() -> Vec<ProcessProfile> {
    vec![
        test_echo_profile(),
        test_wait_profile(),
        channel_binding_profile(
            "channels.bind.qqbot",
            vec!["channels", "add", "--channel", "qqbot"],
        ),
        channel_binding_profile(
            "channels.bind.openclaw-weixin",
            vec!["channels", "login", "--channel", "openclaw-weixin"],
        ),
        channel_binding_profile(
            "channels.bind.feishu",
            vec!["channels", "login", "--channel", "feishu"],
        ),
        dingtalk_connector_binding_profile(),
    ]
}

impl ProcessProfile {
    pub(crate) fn to_request(&self) -> ProcessExecutionRequest {
        self.command.to_request(self.default_timeout_ms)
    }

    pub(crate) fn to_request_for_managed_openclaw_runtime(
        &self,
        paths: &AppPaths,
        runtime: &ActivatedOpenClawRuntime,
    ) -> Result<ProcessExecutionRequest> {
        self.command
            .to_request_for_managed_openclaw_runtime(paths, runtime, self.default_timeout_ms)
    }

    pub(crate) fn to_kernel_info(&self) -> DesktopProcessProfileInfo {
        DesktopProcessProfileInfo {
            id: self.id.clone(),
            job_kind: self.job_kind.clone(),
            command: self.display_command.clone(),
            args: self.display_args.clone(),
            default_timeout_ms: self.default_timeout_ms,
            allow_cancellation: self.allow_cancellation,
        }
    }

    pub(crate) fn allow_cancellation(&self) -> bool {
        self.allow_cancellation
    }
}

impl ProcessProfileCommand {
    fn to_request(&self, default_timeout_ms: u64) -> ProcessExecutionRequest {
        match self {
            Self::Static {
                command,
                args,
                cwd,
                env,
            } => ProcessExecutionRequest {
                command: command.clone(),
                args: args.clone(),
                cwd: cwd.clone(),
                timeout_ms: Some(default_timeout_ms),
                extra_env: env.clone(),
            },
            Self::ManagedOpenClaw { args } => ProcessExecutionRequest {
                command: "openclaw".to_string(),
                args: args.clone(),
                cwd: None,
                timeout_ms: Some(default_timeout_ms),
                extra_env: BTreeMap::new(),
            },
            Self::ManagedNpx { args } => ProcessExecutionRequest {
                command: "npx".to_string(),
                args: args.clone(),
                cwd: None,
                timeout_ms: Some(default_timeout_ms),
                extra_env: BTreeMap::new(),
            },
        }
    }

    fn to_request_for_managed_openclaw_runtime(
        &self,
        paths: &AppPaths,
        runtime: &ActivatedOpenClawRuntime,
        default_timeout_ms: u64,
    ) -> Result<ProcessExecutionRequest> {
        match self {
            Self::Static { .. } => Ok(self.to_request(default_timeout_ms)),
            Self::ManagedOpenClaw { args } => {
                let mut env = runtime.managed_env_with_local_ai_proxy(paths)?;
                env.insert("PATH".to_string(), prepend_path_env(&paths.user_bin_dir));

                Ok(ProcessExecutionRequest {
                    command: resolve_managed_node_command(&runtime.node_path),
                    args: std::iter::once(runtime.cli_path.to_string_lossy().into_owned())
                        .chain(args.iter().cloned())
                        .collect(),
                    cwd: Some(runtime.runtime_dir.clone()),
                    timeout_ms: Some(default_timeout_ms),
                    extra_env: env,
                })
            }
            Self::ManagedNpx { args } => {
                let mut env = runtime.managed_env_with_local_ai_proxy(paths)?;
                env.insert("PATH".to_string(), prepend_path_env(&paths.user_bin_dir));

                Ok(ProcessExecutionRequest {
                    command: resolve_managed_npx_command(&runtime.node_path)?,
                    args: args.clone(),
                    cwd: Some(runtime.runtime_dir.clone()),
                    timeout_ms: Some(default_timeout_ms),
                    extra_env: env,
                })
            }
        }
    }
}

fn channel_binding_profile(id: &str, args: Vec<&str>) -> ProcessProfile {
    let display_args = args.into_iter().map(str::to_string).collect::<Vec<_>>();
    ProcessProfile {
        id: id.to_string(),
        job_kind: "channels.binding".to_string(),
        command: ProcessProfileCommand::ManagedOpenClaw {
            args: display_args.clone(),
        },
        display_command: "openclaw".to_string(),
        display_args,
        default_timeout_ms: 300_000,
        allow_cancellation: true,
    }
}

fn dingtalk_connector_binding_profile() -> ProcessProfile {
    let display_args = vec![
        "-y".to_string(),
        "@dingtalk-real-ai/dingtalk-connector".to_string(),
        "install".to_string(),
    ];

    ProcessProfile {
        id: "channels.bind.dingtalk-connector".to_string(),
        job_kind: "channels.binding".to_string(),
        command: ProcessProfileCommand::ManagedNpx {
            args: display_args.clone(),
        },
        display_command: "npx".to_string(),
        display_args,
        default_timeout_ms: 300_000,
        allow_cancellation: true,
    }
}

#[cfg(windows)]
fn test_echo_profile() -> ProcessProfile {
    ProcessProfile {
        id: "diagnostics.echo".to_string(),
        job_kind: "process.diagnostics".to_string(),
        command: ProcessProfileCommand::Static {
            command: "cmd".to_string(),
            args: vec!["/C".to_string(), "echo desktop-kernel".to_string()],
            cwd: None,
            env: BTreeMap::new(),
        },
        display_command: "cmd".to_string(),
        display_args: vec!["/C".to_string(), "echo desktop-kernel".to_string()],
        default_timeout_ms: 2_000,
        allow_cancellation: true,
    }
}

#[cfg(windows)]
fn test_wait_profile() -> ProcessProfile {
    ProcessProfile {
        id: "diagnostics.wait".to_string(),
        job_kind: "process.diagnostics".to_string(),
        command: ProcessProfileCommand::Static {
            command: "cmd".to_string(),
            args: vec![
                "/C".to_string(),
                "ping -n 6 127.0.0.1 >nul && echo waited".to_string(),
            ],
            cwd: None,
            env: BTreeMap::new(),
        },
        display_command: "cmd".to_string(),
        display_args: vec![
            "/C".to_string(),
            "ping -n 6 127.0.0.1 >nul && echo waited".to_string(),
        ],
        default_timeout_ms: 10_000,
        allow_cancellation: true,
    }
}

#[cfg(not(windows))]
fn test_echo_profile() -> ProcessProfile {
    ProcessProfile {
        id: "diagnostics.echo".to_string(),
        job_kind: "process.diagnostics".to_string(),
        command: ProcessProfileCommand::Static {
            command: "sh".to_string(),
            args: vec!["-c".to_string(), "printf desktop-kernel".to_string()],
            cwd: None,
            env: BTreeMap::new(),
        },
        display_command: "sh".to_string(),
        display_args: vec!["-c".to_string(), "printf desktop-kernel".to_string()],
        default_timeout_ms: 2_000,
        allow_cancellation: true,
    }
}

#[cfg(not(windows))]
fn test_wait_profile() -> ProcessProfile {
    ProcessProfile {
        id: "diagnostics.wait".to_string(),
        job_kind: "process.diagnostics".to_string(),
        command: ProcessProfileCommand::Static {
            command: "sh".to_string(),
            args: vec!["-c".to_string(), "sleep 2; printf waited".to_string()],
            cwd: None,
            env: BTreeMap::new(),
        },
        display_command: "sh".to_string(),
        display_args: vec!["-c".to_string(), "sleep 2; printf waited".to_string()],
        default_timeout_ms: 10_000,
        allow_cancellation: true,
    }
}

fn prepend_path_env(user_bin_dir: &std::path::Path) -> String {
    let current = env::var_os("PATH")
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_default();
    let separator = if cfg!(windows) { ';' } else { ':' };
    let user_bin = user_bin_dir.to_string_lossy();

    if current
        .split(separator)
        .any(|entry| entry.eq_ignore_ascii_case(user_bin.as_ref()))
    {
        return current;
    }

    if current.is_empty() {
        return user_bin.into_owned();
    }

    format!("{user_bin}{separator}{current}")
}

fn resolve_managed_node_command(node_path: &std::path::Path) -> String {
    if node_path.is_absolute() {
        return node_path.to_string_lossy().into_owned();
    }

    let raw = node_path.to_string_lossy();
    let normalized = raw.replace('\\', "/").to_ascii_lowercase();

    if normalized.ends_with("/node.exe") || normalized == "node.exe" {
        "node.exe".to_string()
    } else {
        "node".to_string()
    }
}

fn resolve_managed_npx_command(node_path: &std::path::Path) -> Result<String> {
    if node_path.is_absolute() {
        let node_dir = node_path.parent().ok_or_else(|| {
            FrameworkError::NotFound(format!(
                "external Node.js executable parent directory was not found for {}",
                node_path.display()
            ))
        })?;
        let candidates = if cfg!(windows) {
            vec![node_dir.join("npx.cmd"), node_dir.join("npx.exe"), node_dir.join("npx")]
        } else {
            vec![node_dir.join("npx"), node_dir.join("npx.cmd")]
        };

        if let Some(candidate) = candidates.into_iter().find(|candidate| candidate.exists()) {
            return Ok(candidate.to_string_lossy().into_owned());
        }

        return Err(FrameworkError::NotFound(format!(
            "external npx executable was not found next to configured Node.js at {}",
            node_path.display()
        )));
    }

    Ok(if cfg!(windows) {
        "npx.cmd".to_string()
    } else {
        "npx".to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::{available_profiles, resolve_profile};
    use crate::framework::{
        paths::resolve_paths_for_root,
        services::openclaw_runtime::ActivatedOpenClawRuntime,
    };

    #[test]
    fn resolves_known_process_profiles() {
        let profile = resolve_profile("diagnostics.echo").expect("profile");

        assert_eq!(profile.id, "diagnostics.echo");
        assert_eq!(profile.job_kind, "process.diagnostics");
    }

    #[test]
    fn rejects_unknown_process_profiles() {
        let error = resolve_profile("missing.profile").expect_err("unknown profile should fail");

        assert!(error.to_string().contains("process profile not found"));
    }

    #[test]
    fn available_profiles_include_wait_profile() {
        let profiles = available_profiles();

        assert!(profiles
            .iter()
            .any(|profile| profile.id == "diagnostics.echo"));
        assert!(profiles
            .iter()
            .any(|profile| profile.id == "diagnostics.wait"));
    }

    #[test]
    fn available_profiles_include_whitelisted_channel_binding_profiles() {
        let profiles = available_profiles();
        let profile_ids = profiles.iter().map(|profile| profile.id.as_str()).collect::<Vec<_>>();

        assert!(profile_ids.contains(&"channels.bind.qqbot"));
        assert!(profile_ids.contains(&"channels.bind.openclaw-weixin"));
        assert!(profile_ids.contains(&"channels.bind.feishu"));
        assert!(profile_ids.contains(&"channels.bind.dingtalk-connector"));
    }

    #[test]
    fn channel_binding_profiles_use_official_commands_only() {
        let qqbot = resolve_profile("channels.bind.qqbot").expect("qqbot profile");
        assert_eq!(qqbot.job_kind, "channels.binding");
        assert_eq!(qqbot.to_request().command, "openclaw");
        assert_eq!(
            qqbot.to_request().args,
            vec!["channels", "add", "--channel", "qqbot"]
        );

        let weixin = resolve_profile("channels.bind.openclaw-weixin").expect("weixin profile");
        assert_eq!(weixin.to_request().command, "openclaw");
        assert_eq!(
            weixin.to_request().args,
            vec!["channels", "login", "--channel", "openclaw-weixin"]
        );

        let feishu = resolve_profile("channels.bind.feishu").expect("feishu profile");
        assert_eq!(feishu.to_request().command, "openclaw");
        assert_eq!(
            feishu.to_request().args,
            vec!["channels", "login", "--channel", "feishu"]
        );

        let dingtalk = resolve_profile("channels.bind.dingtalk-connector").expect("dingtalk profile");
        assert_eq!(dingtalk.to_request().command, "npx");
        assert_eq!(
            dingtalk.to_request().args,
            vec!["-y", "@dingtalk-real-ai/dingtalk-connector", "install"]
        );
    }

    #[test]
    fn channel_binding_kernel_info_keeps_official_openclaw_commands_for_operator_visibility() {
        let qqbot = resolve_profile("channels.bind.qqbot").expect("qqbot profile");
        let info = qqbot.to_kernel_info();

        assert_eq!(info.command, "openclaw");
        assert_eq!(info.args, vec!["channels", "add", "--channel", "qqbot"]);
    }

    #[test]
    fn managed_openclaw_binding_profiles_execute_configured_runtime_without_path_openclaw() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_openclaw_runtime(&paths);
        let qqbot = resolve_profile("channels.bind.qqbot").expect("qqbot profile");

        let request = qqbot
            .to_request_for_managed_openclaw_runtime(&paths, &runtime)
            .expect("managed request");

        assert_eq!(request.command, "node");
        assert_eq!(
            request.args,
            vec![
                runtime.cli_path.to_string_lossy().into_owned(),
                "channels".to_string(),
                "add".to_string(),
                "--channel".to_string(),
                "qqbot".to_string(),
            ]
        );
        assert_eq!(request.cwd.as_deref(), Some(runtime.runtime_dir.as_path()));
        assert_eq!(
            request.extra_env.get("OPENCLAW_CONFIG_PATH"),
            Some(&runtime.config_path.to_string_lossy().into_owned())
        );
        assert_eq!(
            request.extra_env.get("OPENCLAW_GATEWAY_TOKEN"),
            Some(&runtime.gateway_auth_token)
        );
    }

    #[test]
    fn managed_openclaw_binding_profiles_preserve_absolute_configured_node_runtime() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let mut runtime = fake_openclaw_runtime(&paths);
        runtime.node_path = paths.user_bin_dir.join(if cfg!(windows) {
            "node.exe"
        } else {
            "node"
        });
        std::fs::create_dir_all(runtime.node_path.parent().expect("node parent"))
            .expect("node dir");
        std::fs::write(&runtime.node_path, "node").expect("node");
        let feishu = resolve_profile("channels.bind.feishu").expect("feishu profile");

        let request = feishu
            .to_request_for_managed_openclaw_runtime(&paths, &runtime)
            .expect("managed request");

        assert_eq!(
            request.command,
            runtime.node_path.to_string_lossy().into_owned()
        );
        assert_eq!(
            request.args.first(),
            Some(&runtime.cli_path.to_string_lossy().into_owned())
        );
    }

    #[test]
    fn dingtalk_connector_profile_uses_npx_next_to_configured_node_runtime() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let mut runtime = fake_openclaw_runtime(&paths);
        let node_dir = paths.user_bin_dir.join("node-runtime");
        runtime.node_path = node_dir.join(if cfg!(windows) { "node.exe" } else { "node" });
        let npx_path = node_dir.join(if cfg!(windows) { "npx.cmd" } else { "npx" });
        std::fs::create_dir_all(&node_dir).expect("node dir");
        std::fs::write(&runtime.node_path, "node").expect("node");
        std::fs::write(&npx_path, "npx").expect("npx");
        let dingtalk =
            resolve_profile("channels.bind.dingtalk-connector").expect("dingtalk profile");

        let request = dingtalk
            .to_request_for_managed_openclaw_runtime(&paths, &runtime)
            .expect("managed request");

        assert_eq!(request.command, npx_path.to_string_lossy().into_owned());
        assert_eq!(
            request.args,
            vec!["-y", "@dingtalk-real-ai/dingtalk-connector", "install"]
        );
        assert_eq!(request.cwd.as_deref(), Some(runtime.runtime_dir.as_path()));
    }

    fn fake_openclaw_runtime(
        paths: &crate::framework::paths::AppPaths,
    ) -> ActivatedOpenClawRuntime {
        let install_dir = paths.openclaw_runtime_dir.join("test-runtime");
        let runtime_dir = install_dir.join("runtime");
        let cli_path = runtime_dir
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");

        std::fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        std::fs::write(&cli_path, "console.log('openclaw');").expect("cli");

        ActivatedOpenClawRuntime {
            install_key: "test-runtime".to_string(),
            install_dir,
            runtime_dir,
            node_path: std::path::PathBuf::from("node"),
            cli_path,
            home_dir: paths.user_root.clone(),
            state_dir: paths.openclaw_root_dir.clone(),
            workspace_dir: paths.openclaw_workspace_dir.clone(),
            config_path: paths.openclaw_config_file.clone(),
            gateway_port: 21_280,
            gateway_auth_token: "test-token".to_string(),
        }
    }
}
