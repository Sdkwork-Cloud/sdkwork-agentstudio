use std::path::PathBuf;

use crate::rollout::control_plane::PersistedRolloutCatalog;
use crate::storage::file_store::{load_json_file, save_json_file};
use crate::storage::StorageError;

pub(crate) trait RolloutCatalogStore: Send + Sync + std::fmt::Debug {
    fn load_catalog(&self) -> Result<Option<PersistedRolloutCatalog>, StorageError>;
    fn save_catalog(&self, catalog: &PersistedRolloutCatalog) -> Result<(), StorageError>;
}

#[derive(Debug, Clone)]
pub(crate) struct JsonRolloutCatalogStore {
    path: PathBuf,
}

impl JsonRolloutCatalogStore {
    pub(crate) fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl RolloutCatalogStore for JsonRolloutCatalogStore {
    fn load_catalog(&self) -> Result<Option<PersistedRolloutCatalog>, StorageError> {
        load_json_file(&self.path).map_err(StorageError::from)
    }

    fn save_catalog(&self, catalog: &PersistedRolloutCatalog) -> Result<(), StorageError> {
        save_json_file(&self.path, catalog).map_err(StorageError::from)
    }
}
