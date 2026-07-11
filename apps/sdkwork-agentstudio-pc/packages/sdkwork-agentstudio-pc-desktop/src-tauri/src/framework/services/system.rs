use crate::{
    framework::{paths::AppPaths, Result},
    platform,
};

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshot {
    pub os: String,
    pub arch: String,
    pub family: String,
    pub target: String,
}

#[derive(Clone, Debug, Default)]
pub struct SystemService;

impl SystemService {
    pub fn new() -> Self {
        Self
    }

    pub fn snapshot(&self) -> SystemSnapshot {
        SystemSnapshot {
            os: platform::current_target().to_string(),
            arch: platform::current_arch().to_string(),
            family: platform::current_family().to_string(),
            target: platform::current_target().to_string(),
        }
    }

    pub fn load_or_create_device_id(&self, paths: &AppPaths) -> Result<String> {
        platform::load_or_create_device_id(paths)
    }
}

#[cfg(test)]
mod tests {
    use super::SystemService;

    #[test]
    fn system_service_reports_platform_snapshot() {
        let service = SystemService::new();
        let snapshot = service.snapshot();

        assert!(!snapshot.os.is_empty());
        assert!(!snapshot.arch.is_empty());
        assert!(!snapshot.family.is_empty());
        assert!(!snapshot.target.is_empty());
    }
}
