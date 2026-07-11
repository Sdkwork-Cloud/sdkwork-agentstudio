use crate::framework::kernel::{
    DesktopCapabilityStatus, DesktopIntegrationAdapterInfo, DesktopNotificationProviderInfo,
    DesktopPaymentProviderInfo, DesktopProviderAvailability,
};

pub trait CapabilityCatalogEntry {
    fn id(&self) -> &str;
    fn availability(&self) -> &DesktopProviderAvailability;
}

#[derive(Clone, Debug, Default)]
pub struct CapabilityCatalog<T> {
    entries: Vec<T>,
}

impl<T> CapabilityCatalog<T> {
    pub fn new(entries: Vec<T>) -> Self {
        Self { entries }
    }

    pub fn entries(&self) -> Vec<T>
    where
        T: Clone,
    {
        self.entries.clone()
    }
}

impl<T> CapabilityCatalog<T>
where
    T: CapabilityCatalogEntry,
{
    pub fn selected_status(&self, selected_id: &str) -> DesktopCapabilityStatus {
        capability_status_for_availability(self.selected_availability(selected_id))
    }

    pub fn has_ready_entry(&self, id: &str) -> bool {
        self.entries
            .iter()
            .any(|entry| entry.id() == id && is_ready(entry.availability()))
    }

    pub fn has_ready_entry_in<'a, I>(&self, ids: I) -> bool
    where
        I: IntoIterator<Item = &'a str>,
    {
        ids.into_iter().any(|id| self.has_ready_entry(id))
    }

    fn selected_availability(&self, selected_id: &str) -> Option<DesktopProviderAvailability> {
        self.entries
            .iter()
            .find(|entry| entry.id() == selected_id)
            .map(|entry| entry.availability().clone())
    }
}

pub fn capability_status_for_availability(
    availability: Option<DesktopProviderAvailability>,
) -> DesktopCapabilityStatus {
    match availability {
        Some(DesktopProviderAvailability::Ready) => DesktopCapabilityStatus::Ready,
        Some(
            DesktopProviderAvailability::ConfigurationRequired
            | DesktopProviderAvailability::Planned,
        )
        | None => DesktopCapabilityStatus::Planned,
    }
}

fn is_ready(availability: &DesktopProviderAvailability) -> bool {
    matches!(availability, DesktopProviderAvailability::Ready)
}

impl CapabilityCatalogEntry for DesktopNotificationProviderInfo {
    fn id(&self) -> &str {
        self.id.as_str()
    }

    fn availability(&self) -> &DesktopProviderAvailability {
        &self.availability
    }
}

impl CapabilityCatalogEntry for DesktopPaymentProviderInfo {
    fn id(&self) -> &str {
        self.id.as_str()
    }

    fn availability(&self) -> &DesktopProviderAvailability {
        &self.availability
    }
}

impl CapabilityCatalogEntry for DesktopIntegrationAdapterInfo {
    fn id(&self) -> &str {
        self.id.as_str()
    }

    fn availability(&self) -> &DesktopProviderAvailability {
        &self.availability
    }
}

#[cfg(test)]
mod tests {
    use super::CapabilityCatalog;
    use crate::framework::kernel::{
        DesktopCapabilityStatus, DesktopIntegrationAdapterInfo, DesktopPaymentProviderInfo,
        DesktopProviderAvailability,
    };

    #[test]
    fn selected_status_resolves_from_provider_availability() {
        let catalog = CapabilityCatalog::new(vec![
            payment_provider("none", DesktopProviderAvailability::Ready),
            payment_provider("stripe", DesktopProviderAvailability::ConfigurationRequired),
        ]);

        assert_eq!(
            catalog.selected_status("none"),
            DesktopCapabilityStatus::Ready
        );
        assert_eq!(
            catalog.selected_status("stripe"),
            DesktopCapabilityStatus::Planned
        );
    }

    #[test]
    fn missing_provider_resolves_to_planned_status() {
        let catalog = CapabilityCatalog::new(vec![payment_provider(
            "none",
            DesktopProviderAvailability::Ready,
        )]);

        assert_eq!(
            catalog.selected_status("missing"),
            DesktopCapabilityStatus::Planned
        );
    }

    #[test]
    fn ready_entry_checks_are_shared_for_integration_catalogs() {
        let catalog = CapabilityCatalog::new(vec![
            integration_adapter("plugin-host", DesktopProviderAvailability::Ready),
            integration_adapter(
                "remote-api",
                DesktopProviderAvailability::ConfigurationRequired,
            ),
        ]);

        assert!(catalog.has_ready_entry("plugin-host"));
        assert!(catalog.has_ready_entry_in(["plugin-host", "external-process"]));
        assert!(!catalog.has_ready_entry("remote-api"));
    }

    fn payment_provider(
        id: &str,
        availability: DesktopProviderAvailability,
    ) -> DesktopPaymentProviderInfo {
        DesktopPaymentProviderInfo {
            id: id.to_string(),
            label: id.to_string(),
            availability,
            supports_sandbox: true,
            remote: false,
        }
    }

    fn integration_adapter(
        id: &str,
        availability: DesktopProviderAvailability,
    ) -> DesktopIntegrationAdapterInfo {
        DesktopIntegrationAdapterInfo {
            id: id.to_string(),
            label: id.to_string(),
            kind: "plugin".to_string(),
            availability,
            enabled: true,
            requires_signed_plugins: false,
        }
    }
}
