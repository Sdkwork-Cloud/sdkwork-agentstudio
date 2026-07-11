use crate::framework::{config::AppConfig, kernel::DesktopSecurityInfo, policy};

#[derive(Clone, Debug, Default)]
pub struct SecurityService;

impl SecurityService {
    pub fn new() -> Self {
        Self
    }

    pub fn kernel_info(&self, config: &AppConfig) -> DesktopSecurityInfo {
        DesktopSecurityInfo {
            strict_path_policy: config.security.strict_path_policy,
            allow_external_http: config.security.allow_external_http,
            allow_custom_process_cwd: config.security.allow_custom_process_cwd,
            allowed_spawn_commands: policy::allowed_spawn_commands_snapshot(),
        }
    }
}
