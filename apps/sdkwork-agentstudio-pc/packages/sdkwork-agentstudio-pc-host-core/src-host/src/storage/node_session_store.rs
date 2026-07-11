use std::path::PathBuf;

use crate::internal::node_sessions::PersistedNodeSessionCatalog;
use crate::storage::file_store::{load_json_file, save_json_file};
use crate::storage::StorageError;

pub(crate) trait NodeSessionCatalogStore: Send + Sync + std::fmt::Debug {
    fn load_catalog(&self) -> Result<Option<PersistedNodeSessionCatalog>, StorageError>;
    fn save_catalog(&self, catalog: &PersistedNodeSessionCatalog) -> Result<(), StorageError>;
}

#[derive(Debug, Clone)]
pub(crate) struct JsonNodeSessionCatalogStore {
    path: PathBuf,
}

impl JsonNodeSessionCatalogStore {
    pub(crate) fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl NodeSessionCatalogStore for JsonNodeSessionCatalogStore {
    fn load_catalog(&self) -> Result<Option<PersistedNodeSessionCatalog>, StorageError> {
        load_json_file(&self.path).map_err(StorageError::from)
    }

    fn save_catalog(&self, catalog: &PersistedNodeSessionCatalog) -> Result<(), StorageError> {
        save_json_file(&self.path, catalog).map_err(StorageError::from)
    }
}
