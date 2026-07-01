use crate::framework::{
    capabilities::CapabilityCatalog,
    config::AppConfig,
    kernel::{
        DesktopCapabilityStatus, DesktopPaymentInfo, DesktopPaymentProviderInfo,
        DesktopProviderAvailability,
    },
};

#[derive(Clone, Debug)]
pub struct PaymentService {
    catalog: CapabilityCatalog<DesktopPaymentProviderInfo>,
}

impl PaymentService {
    pub fn new() -> Self {
        Self {
            catalog: CapabilityCatalog::new(vec![
                DesktopPaymentProviderInfo {
                    id: "none".to_string(),
                    label: "Disabled".to_string(),
                    availability: DesktopProviderAvailability::Ready,
                    supports_sandbox: true,
                    remote: false,
                },
                DesktopPaymentProviderInfo {
                    id: "stripe".to_string(),
                    label: "Stripe".to_string(),
                    availability: DesktopProviderAvailability::ConfigurationRequired,
                    supports_sandbox: true,
                    remote: true,
                },
                DesktopPaymentProviderInfo {
                    id: "paddle".to_string(),
                    label: "Paddle".to_string(),
                    availability: DesktopProviderAvailability::ConfigurationRequired,
                    supports_sandbox: true,
                    remote: true,
                },
                DesktopPaymentProviderInfo {
                    id: "wechat-pay".to_string(),
                    label: "WeChat Pay".to_string(),
                    availability: DesktopProviderAvailability::Planned,
                    supports_sandbox: false,
                    remote: true,
                },
            ]),
        }
    }

    pub fn kernel_info(&self, config: &AppConfig) -> DesktopPaymentInfo {
        let available_providers = self.catalog.entries();

        DesktopPaymentInfo {
            provider: config.payments.provider.clone(),
            sandbox: config.payments.sandbox,
            status: resolve_payment_status(config, &self.catalog),
            available_providers,
        }
    }
}

impl Default for PaymentService {
    fn default() -> Self {
        Self::new()
    }
}

fn resolve_payment_status(
    config: &AppConfig,
    catalog: &CapabilityCatalog<DesktopPaymentProviderInfo>,
) -> DesktopCapabilityStatus {
    catalog.selected_status(config.payments.provider.as_str())
}

#[cfg(test)]
mod tests {
    use super::PaymentService;
    use crate::framework::{config::AppConfig, kernel::DesktopProviderAvailability};

    #[test]
    fn payment_service_exposes_provider_registry() {
        let service = PaymentService::new();
        let info = service.kernel_info(&AppConfig::default());

        assert!(info
            .available_providers
            .iter()
            .any(|provider| provider.id == "none"
                && provider.availability == DesktopProviderAvailability::Ready));
        assert!(info
            .available_providers
            .iter()
            .any(|provider| provider.id == "stripe"
                && provider.availability == DesktopProviderAvailability::ConfigurationRequired));
    }

    #[test]
    fn unknown_payment_provider_resolves_to_planned_status() {
        let service = PaymentService::new();
        let info = service.kernel_info(&AppConfig {
            payments: crate::framework::config::PaymentConfig {
                provider: "missing".to_string(),
                ..crate::framework::config::PaymentConfig::default()
            },
            ..AppConfig::default()
        });

        assert_eq!(
            info.status,
            crate::framework::kernel::DesktopCapabilityStatus::Planned
        );
    }
}
