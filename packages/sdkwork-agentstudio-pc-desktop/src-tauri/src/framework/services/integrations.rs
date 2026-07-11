use crate::framework::{
    capabilities::CapabilityCatalog,
    config::AppConfig,
    kernel::{
        DesktopCapabilityStatus, DesktopIntegrationAdapterInfo, DesktopIntegrationInfo,
        DesktopProviderAvailability,
    },
    paths::AppPaths,
    Result,
};

#[derive(Clone, Debug, Default)]
pub struct IntegrationService;

impl IntegrationService {
    pub fn new() -> Self {
        Self
    }

    pub fn kernel_info(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
    ) -> Result<DesktopIntegrationInfo> {
        let installed_plugin_count = count_directory_entries(&paths.plugins_dir)?;
        let catalog = self.catalog(config);
        let available_adapters = catalog.entries();

        Ok(DesktopIntegrationInfo {
            plugins_enabled: config.integrations.plugins_enabled,
            remote_api_enabled: config.integrations.remote_api_enabled,
            allow_unsigned_plugins: config.integrations.allow_unsigned_plugins,
            plugins_dir: paths.plugins_dir.to_string_lossy().into_owned(),
            integrations_dir: paths.integrations_dir.to_string_lossy().into_owned(),
            installed_plugin_count,
            status: resolve_integration_status(config, &catalog),
            available_adapters,
        })
    }

    fn catalog(&self, config: &AppConfig) -> CapabilityCatalog<DesktopIntegrationAdapterInfo> {
        CapabilityCatalog::new(vec![
            DesktopIntegrationAdapterInfo {
                id: "plugin-host".to_string(),
                label: "Plugin Host".to_string(),
                kind: "plugin".to_string(),
                availability: DesktopProviderAvailability::Ready,
                enabled: config.integrations.plugins_enabled,
                requires_signed_plugins: !config.integrations.allow_unsigned_plugins,
            },
            DesktopIntegrationAdapterInfo {
                id: "remote-api".to_string(),
                label: "Remote API Bridge".to_string(),
                kind: "remoteApi".to_string(),
                availability: DesktopProviderAvailability::ConfigurationRequired,
                enabled: config.integrations.remote_api_enabled,
                requires_signed_plugins: false,
            },
            DesktopIntegrationAdapterInfo {
                id: "external-process".to_string(),
                label: "External Process Bridge".to_string(),
                kind: "process".to_string(),
                availability: DesktopProviderAvailability::Ready,
                enabled: true,
                requires_signed_plugins: false,
            },
        ])
    }
}

fn resolve_integration_status(
    config: &AppConfig,
    catalog: &CapabilityCatalog<DesktopIntegrationAdapterInfo>,
) -> DesktopCapabilityStatus {
    let plugins_ready =
        config.integrations.plugins_enabled && catalog.has_ready_entry("plugin-host");
    let process_bridge_ready = catalog.has_ready_entry_in(["external-process"]);

    if plugins_ready || process_bridge_ready {
        DesktopCapabilityStatus::Ready
    } else {
        DesktopCapabilityStatus::Planned
    }
}

fn count_directory_entries(path: &std::path::Path) -> Result<usize> {
    let count = std::fs::read_dir(path)?.count();
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::IntegrationService;
    use crate::framework::{
        config::AppConfig, kernel::DesktopProviderAvailability, paths::resolve_paths_for_root,
    };

    #[test]
    fn integration_service_exposes_adapter_registry() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = IntegrationService::new();
        let info = service
            .kernel_info(&paths, &AppConfig::default())
            .expect("kernel info");

        assert!(info
            .available_adapters
            .iter()
            .any(|adapter| adapter.id == "plugin-host"
                && adapter.availability == DesktopProviderAvailability::Ready));
        assert!(info
            .available_adapters
            .iter()
            .any(|adapter| adapter.id == "remote-api"
                && adapter.availability == DesktopProviderAvailability::ConfigurationRequired));
    }

    #[test]
    fn integration_status_stays_ready_via_process_bridge_even_when_plugins_are_disabled() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = IntegrationService::new();
        let info = service
            .kernel_info(
                &paths,
                &AppConfig {
                    integrations: crate::framework::config::IntegrationConfig {
                        plugins_enabled: false,
                        ..crate::framework::config::IntegrationConfig::default()
                    },
                    ..AppConfig::default()
                },
            )
            .expect("kernel info");

        assert_eq!(
            info.status,
            crate::framework::kernel::DesktopCapabilityStatus::Ready
        );
    }
}
