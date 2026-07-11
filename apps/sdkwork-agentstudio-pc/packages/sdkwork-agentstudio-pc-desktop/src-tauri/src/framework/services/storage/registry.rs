use super::{
    drivers::{
        LocalFileStorageDriver, MemoryStorageDriver, PostgresStorageDriver, SqliteStorageDriver,
        UnavailableStorageDriver,
    },
    profiles::StorageDriverScope,
};
use crate::framework::{
    storage::{StorageAvailability, StorageCapabilities, StorageProviderInfo, StorageProviderKind},
    FrameworkError, Result,
};
use std::{collections::BTreeMap, sync::Arc};

#[derive(Clone, Debug, Default)]
pub struct StorageDriverRegistry {
    drivers: BTreeMap<StorageProviderKind, RegisteredStorageDriver>,
}

#[derive(Clone)]
struct RegisteredStorageDriver {
    info: StorageProviderInfo,
    driver: Arc<dyn StorageDriver>,
}

impl std::fmt::Debug for RegisteredStorageDriver {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RegisteredStorageDriver")
            .field("info", &self.info)
            .finish()
    }
}

pub trait StorageDriver: Send + Sync + std::fmt::Debug {
    fn get_text(&self, scope: &StorageDriverScope, key: &str) -> Result<Option<String>>;
    fn put_text(&self, scope: &StorageDriverScope, key: &str, value: &str) -> Result<()>;
    fn delete(&self, scope: &StorageDriverScope, key: &str) -> Result<bool>;
    fn list_keys(&self, scope: &StorageDriverScope) -> Result<Vec<String>>;
}

impl StorageDriverRegistry {
    pub fn with_built_in_drivers() -> Self {
        let mut registry = Self::default();
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::Memory),
            Arc::new(MemoryStorageDriver::default()),
        );
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::LocalFile),
            Arc::new(LocalFileStorageDriver::default()),
        );
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::Sqlite),
            Arc::new(SqliteStorageDriver::default()),
        );
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::Postgres),
            Arc::new(PostgresStorageDriver::default()),
        );
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::RemoteApi),
            Arc::new(UnavailableStorageDriver::new(
                StorageProviderKind::RemoteApi,
                "storage driver \"remote-api\" is not implemented yet".to_string(),
            )),
        );
        registry
    }

    pub fn register_driver(
        &mut self,
        info: StorageProviderInfo,
        driver: Arc<dyn StorageDriver>,
    ) -> &mut Self {
        self.drivers
            .insert(info.kind.clone(), RegisteredStorageDriver { info, driver });
        self
    }

    pub fn providers(&self) -> Vec<StorageProviderInfo> {
        self.drivers
            .values()
            .map(|registered| registered.info.clone())
            .collect()
    }

    pub(crate) fn get(&self, kind: &StorageProviderKind) -> Result<&dyn StorageDriver> {
        self.drivers
            .get(kind)
            .map(|registered| registered.driver.as_ref())
            .ok_or_else(|| {
                FrameworkError::NotFound(format!(
                    "storage driver registry entry for provider \"{}\"",
                    kind.id()
                ))
            })
    }
}

pub(crate) fn built_in_provider_info(kind: StorageProviderKind) -> StorageProviderInfo {
    let capabilities = capabilities_for_kind(&kind);
    let availability = availability_for_provider(&kind);
    let requires_configuration = requires_configuration_for_provider(&kind);

    StorageProviderInfo {
        id: kind.id().to_string(),
        label: kind.label().to_string(),
        kind,
        availability,
        requires_configuration,
        capabilities,
    }
}

fn requires_configuration_for_provider(kind: &StorageProviderKind) -> bool {
    matches!(
        kind,
        StorageProviderKind::Postgres | StorageProviderKind::RemoteApi
    )
}

fn availability_for_provider(kind: &StorageProviderKind) -> StorageAvailability {
    match kind {
        StorageProviderKind::Memory
        | StorageProviderKind::LocalFile
        | StorageProviderKind::Sqlite => StorageAvailability::Ready,
        StorageProviderKind::Postgres => StorageAvailability::ConfigurationRequired,
        StorageProviderKind::RemoteApi => StorageAvailability::Planned,
    }
}

fn capabilities_for_kind(kind: &StorageProviderKind) -> StorageCapabilities {
    match kind {
        StorageProviderKind::Memory => StorageCapabilities {
            durable: false,
            structured: true,
            queryable: false,
            transactional: false,
            remote: false,
        },
        StorageProviderKind::LocalFile => StorageCapabilities {
            durable: true,
            structured: true,
            queryable: false,
            transactional: false,
            remote: false,
        },
        StorageProviderKind::Sqlite => StorageCapabilities {
            durable: true,
            structured: true,
            queryable: true,
            transactional: true,
            remote: false,
        },
        StorageProviderKind::Postgres => StorageCapabilities {
            durable: true,
            structured: true,
            queryable: true,
            transactional: true,
            remote: true,
        },
        StorageProviderKind::RemoteApi => StorageCapabilities {
            durable: true,
            structured: true,
            queryable: true,
            transactional: false,
            remote: true,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::StorageDriverRegistry;
    use crate::framework::storage::{StorageAvailability, StorageProviderKind};

    #[test]
    fn built_in_storage_registry_includes_pluggable_backends() {
        let providers = StorageDriverRegistry::with_built_in_drivers().providers();

        assert!(providers
            .iter()
            .any(|provider| provider.kind == StorageProviderKind::Memory));
        assert!(providers
            .iter()
            .any(|provider| provider.kind == StorageProviderKind::LocalFile));
        assert!(providers
            .iter()
            .any(|provider| provider.kind == StorageProviderKind::Sqlite));
        assert!(providers
            .iter()
            .any(|provider| provider.kind == StorageProviderKind::Postgres));
        assert!(providers
            .iter()
            .any(|provider| provider.kind == StorageProviderKind::RemoteApi));
    }

    #[test]
    fn provider_metadata_distinguishes_ready_and_configuration_required_backends() {
        let providers = StorageDriverRegistry::with_built_in_drivers().providers();
        let sqlite = providers
            .iter()
            .find(|provider| provider.kind == StorageProviderKind::Sqlite)
            .expect("sqlite provider");
        let postgres = providers
            .iter()
            .find(|provider| provider.kind == StorageProviderKind::Postgres)
            .expect("postgres provider");
        let remote_api = providers
            .iter()
            .find(|provider| provider.kind == StorageProviderKind::RemoteApi)
            .expect("remote api provider");

        assert_eq!(sqlite.availability, StorageAvailability::Ready);
        assert!(!sqlite.requires_configuration);
        assert_eq!(
            postgres.availability,
            StorageAvailability::ConfigurationRequired
        );
        assert!(postgres.requires_configuration);
        assert_eq!(remote_api.availability, StorageAvailability::Planned);
        assert!(remote_api.requires_configuration);
    }
}
