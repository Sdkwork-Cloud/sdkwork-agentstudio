mod drivers;
mod profiles;
mod registry;

use self::profiles::{build_storage_snapshot, normalize_string, resolve_scope};
pub use self::registry::{StorageDriver, StorageDriverRegistry};

use crate::framework::{
    config::AppConfig,
    paths::AppPaths,
    storage::{
        StorageDeleteRequest, StorageDeleteResponse, StorageGetTextRequest, StorageGetTextResponse,
        StorageInfo, StorageListKeysRequest, StorageListKeysResponse, StoragePutTextRequest,
        StoragePutTextResponse,
    },
    FrameworkError, Result,
};

#[derive(Clone, Debug)]
pub struct StorageService {
    registry: StorageDriverRegistry,
}

impl StorageService {
    pub fn new() -> Self {
        Self::with_registry(StorageDriverRegistry::with_built_in_drivers())
    }

    pub fn with_registry(registry: StorageDriverRegistry) -> Self {
        Self { registry }
    }

    pub fn storage_info(&self, paths: &AppPaths, config: &AppConfig) -> StorageInfo {
        let storage_config = config.storage.normalized();
        let snapshot = build_storage_snapshot(
            paths,
            &storage_config.profiles,
            storage_config.active_profile_id.as_str(),
        );

        StorageInfo {
            active_profile_id: snapshot.active_profile_id,
            root_dir: paths.storage_dir.to_string_lossy().into_owned(),
            providers: self.registry.providers(),
            profiles: snapshot.profiles,
        }
    }

    pub fn get_text(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        request: StorageGetTextRequest,
    ) -> Result<StorageGetTextResponse> {
        let key = normalize_required_value("storage key", request.key.as_str())?;
        let storage_config = config.storage.normalized();
        let scope = resolve_scope(
            paths,
            &storage_config.profiles,
            storage_config.active_profile_id.as_str(),
            request.profile_id.as_deref(),
            request.namespace.as_deref(),
        )?;
        let value = self.registry.get(&scope.provider)?.get_text(&scope, &key)?;

        Ok(StorageGetTextResponse {
            profile_id: scope.profile_id,
            namespace: scope.namespace,
            key,
            value,
        })
    }

    pub fn put_text(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        request: StoragePutTextRequest,
    ) -> Result<StoragePutTextResponse> {
        let key = normalize_required_value("storage key", request.key.as_str())?;
        let storage_config = config.storage.normalized();
        let scope = resolve_scope(
            paths,
            &storage_config.profiles,
            storage_config.active_profile_id.as_str(),
            request.profile_id.as_deref(),
            request.namespace.as_deref(),
        )?;
        scope.ensure_writable()?;
        self.registry
            .get(&scope.provider)?
            .put_text(&scope, &key, request.value.as_str())?;

        Ok(StoragePutTextResponse {
            profile_id: scope.profile_id,
            namespace: scope.namespace,
            key,
        })
    }

    pub fn delete(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        request: StorageDeleteRequest,
    ) -> Result<StorageDeleteResponse> {
        let key = normalize_required_value("storage key", request.key.as_str())?;
        let storage_config = config.storage.normalized();
        let scope = resolve_scope(
            paths,
            &storage_config.profiles,
            storage_config.active_profile_id.as_str(),
            request.profile_id.as_deref(),
            request.namespace.as_deref(),
        )?;
        scope.ensure_writable()?;
        let existed = self.registry.get(&scope.provider)?.delete(&scope, &key)?;

        Ok(StorageDeleteResponse {
            profile_id: scope.profile_id,
            namespace: scope.namespace,
            key,
            existed,
        })
    }

    pub fn list_keys(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        request: StorageListKeysRequest,
    ) -> Result<StorageListKeysResponse> {
        let storage_config = config.storage.normalized();
        let scope = resolve_scope(
            paths,
            &storage_config.profiles,
            storage_config.active_profile_id.as_str(),
            request.profile_id.as_deref(),
            request.namespace.as_deref(),
        )?;
        let keys = self.registry.get(&scope.provider)?.list_keys(&scope)?;

        Ok(StorageListKeysResponse {
            profile_id: scope.profile_id,
            namespace: scope.namespace,
            keys,
        })
    }
}

impl Default for StorageService {
    fn default() -> Self {
        Self::new()
    }
}

fn normalize_required_value(label: &str, value: &str) -> Result<String> {
    normalize_string(value)
        .ok_or_else(|| FrameworkError::ValidationFailed(format!("{label} is required")))
}

#[cfg(test)]
mod tests {
    use super::{
        drivers::MemoryStorageDriver, registry::built_in_provider_info, StorageDriverRegistry,
        StorageService,
    };
    use crate::framework::{
        config::AppConfig,
        paths::resolve_paths_for_root,
        storage::{
            StorageGetTextRequest, StorageListKeysRequest, StorageProfileConfig,
            StorageProviderKind, StoragePutTextRequest,
        },
    };
    use std::sync::Arc;

    #[test]
    fn requested_profile_selection_can_override_active_profile() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let mut config = AppConfig::default();
        config.storage.active_profile_id = "default-local".to_string();
        config.storage.profiles = vec![
            StorageProfileConfig::local_default(),
            StorageProfileConfig {
                id: "volatile-memory".to_string(),
                label: "In-Memory".to_string(),
                provider: StorageProviderKind::Memory,
                namespace: "volatile".to_string(),
                path: None,
                connection: None,
                database: None,
                endpoint: None,
                read_only: false,
            },
        ];
        let service = StorageService::new();

        service
            .put_text(
                &paths,
                &config,
                StoragePutTextRequest {
                    key: "mode".to_string(),
                    value: "local".to_string(),
                    ..StoragePutTextRequest::default()
                },
            )
            .expect("put local value");
        service
            .put_text(
                &paths,
                &config,
                StoragePutTextRequest {
                    profile_id: Some("volatile-memory".to_string()),
                    key: "mode".to_string(),
                    value: "memory".to_string(),
                    ..StoragePutTextRequest::default()
                },
            )
            .expect("put memory value");

        let local_keys = service
            .list_keys(&paths, &config, StorageListKeysRequest::default())
            .expect("list local keys");
        let memory_value = service
            .get_text(
                &paths,
                &config,
                StorageGetTextRequest {
                    profile_id: Some("volatile-memory".to_string()),
                    key: "mode".to_string(),
                    ..StorageGetTextRequest::default()
                },
            )
            .expect("get memory value");

        assert_eq!(local_keys.profile_id, "default-local");
        assert!(local_keys.keys.iter().any(|key| key == "mode"));
        assert_eq!(memory_value.profile_id, "volatile-memory");
        assert_eq!(memory_value.value.as_deref(), Some("memory"));
    }

    #[test]
    fn injected_registry_can_replace_placeholder_remote_api_driver() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let mut config = AppConfig::default();
        config.storage.active_profile_id = "cloud-api".to_string();
        config.storage.profiles = vec![StorageProfileConfig {
            id: "cloud-api".to_string(),
            label: "Remote API".to_string(),
            provider: StorageProviderKind::RemoteApi,
            namespace: "cloud".to_string(),
            path: None,
            connection: None,
            database: None,
            endpoint: Some("https://api.sdk.work".to_string()),
            read_only: false,
        }];

        let mut registry = StorageDriverRegistry::with_built_in_drivers();
        registry.register_driver(
            built_in_provider_info(StorageProviderKind::RemoteApi),
            Arc::new(MemoryStorageDriver::default()),
        );

        let service = StorageService::with_registry(registry);
        service
            .put_text(
                &paths,
                &config,
                StoragePutTextRequest {
                    key: "token".to_string(),
                    value: "ready".to_string(),
                    ..StoragePutTextRequest::default()
                },
            )
            .expect("remote api driver injected through registry");

        let response = service
            .get_text(
                &paths,
                &config,
                StorageGetTextRequest {
                    key: "token".to_string(),
                    ..StorageGetTextRequest::default()
                },
            )
            .expect("get injected remote api value");

        assert_eq!(response.profile_id, "cloud-api");
        assert_eq!(response.value.as_deref(), Some("ready"));
    }

    #[test]
    fn sqlite_profile_round_trips_values_through_storage_service() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let mut config = AppConfig::default();
        config.storage.active_profile_id = "default-sqlite".to_string();
        config.storage.profiles = vec![StorageProfileConfig {
            id: "default-sqlite".to_string(),
            label: "SQLite".to_string(),
            provider: StorageProviderKind::Sqlite,
            namespace: "studio.chat".to_string(),
            path: Some("profiles/default.db".to_string()),
            connection: None,
            database: None,
            endpoint: None,
            read_only: false,
        }];
        let service = StorageService::new();

        service
            .put_text(
                &paths,
                &config,
                StoragePutTextRequest {
                    key: "conversation:1".to_string(),
                    value: "{\"title\":\"SQLite\"}".to_string(),
                    ..StoragePutTextRequest::default()
                },
            )
            .expect("put sqlite value");

        let listed = service
            .list_keys(&paths, &config, StorageListKeysRequest::default())
            .expect("list sqlite keys");
        let response = service
            .get_text(
                &paths,
                &config,
                StorageGetTextRequest {
                    key: "conversation:1".to_string(),
                    ..StorageGetTextRequest::default()
                },
            )
            .expect("get sqlite value");

        assert_eq!(listed.profile_id, "default-sqlite");
        assert_eq!(listed.keys, vec!["conversation:1".to_string()]);
        assert_eq!(response.value.as_deref(), Some("{\"title\":\"SQLite\"}"));
    }
}
