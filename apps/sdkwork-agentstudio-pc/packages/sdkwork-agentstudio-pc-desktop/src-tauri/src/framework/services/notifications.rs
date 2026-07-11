use crate::framework::{
    capabilities::CapabilityCatalog,
    config::AppConfig,
    kernel::{
        DesktopCapabilityStatus, DesktopNotificationInfo, DesktopNotificationProviderInfo,
        DesktopProviderAvailability,
    },
};

#[derive(Clone, Debug)]
pub struct NotificationService {
    catalog: CapabilityCatalog<DesktopNotificationProviderInfo>,
}

impl NotificationService {
    pub fn new() -> Self {
        Self {
            catalog: CapabilityCatalog::new(vec![
                DesktopNotificationProviderInfo {
                    id: "native".to_string(),
                    label: "Native Desktop".to_string(),
                    availability: DesktopProviderAvailability::Ready,
                    transport: "native".to_string(),
                    requires_user_consent: true,
                },
                DesktopNotificationProviderInfo {
                    id: "system-tray".to_string(),
                    label: "System Tray".to_string(),
                    availability: DesktopProviderAvailability::Planned,
                    transport: "tray".to_string(),
                    requires_user_consent: true,
                },
                DesktopNotificationProviderInfo {
                    id: "webhook".to_string(),
                    label: "Webhook Relay".to_string(),
                    availability: DesktopProviderAvailability::ConfigurationRequired,
                    transport: "http".to_string(),
                    requires_user_consent: false,
                },
            ]),
        }
    }

    pub fn kernel_info(&self, config: &AppConfig) -> DesktopNotificationInfo {
        let available_providers = self.catalog.entries();

        DesktopNotificationInfo {
            enabled: config.notifications.enabled,
            provider: config.notifications.provider.clone(),
            require_user_consent: config.notifications.require_user_consent,
            status: resolve_notification_status(config, &self.catalog),
            available_providers,
        }
    }
}

impl Default for NotificationService {
    fn default() -> Self {
        Self::new()
    }
}

fn resolve_notification_status(
    config: &AppConfig,
    catalog: &CapabilityCatalog<DesktopNotificationProviderInfo>,
) -> DesktopCapabilityStatus {
    if !config.notifications.enabled {
        return DesktopCapabilityStatus::Ready;
    }

    catalog.selected_status(config.notifications.provider.as_str())
}

#[cfg(test)]
mod tests {
    use super::NotificationService;
    use crate::framework::{config::AppConfig, kernel::DesktopProviderAvailability};

    #[test]
    fn notification_service_exposes_provider_registry() {
        let service = NotificationService::new();
        let info = service.kernel_info(&AppConfig::default());

        assert!(info
            .available_providers
            .iter()
            .any(|provider| provider.id == "native"
                && provider.availability == DesktopProviderAvailability::Ready));
        assert!(info
            .available_providers
            .iter()
            .any(|provider| provider.id == "system-tray"
                && provider.availability == DesktopProviderAvailability::Planned));
        assert!(info
            .available_providers
            .iter()
            .any(|provider| provider.id == "webhook"
                && provider.availability == DesktopProviderAvailability::ConfigurationRequired));
    }

    #[test]
    fn native_notifications_are_ready_once_runtime_adapters_are_wired() {
        let service = NotificationService::new();
        let info = service.kernel_info(&AppConfig::default());

        assert_eq!(
            info.status,
            crate::framework::kernel::DesktopCapabilityStatus::Ready
        );
    }

    #[test]
    fn native_provider_is_reported_ready_after_runtime_adapter_wiring() {
        let service = NotificationService::new();
        let info = service.kernel_info(&AppConfig::default());
        let provider = info
            .available_providers
            .iter()
            .find(|entry| entry.id == "native")
            .expect("native provider");

        assert_eq!(provider.availability, DesktopProviderAvailability::Ready);
    }
}
