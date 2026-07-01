pub mod file_store;
pub mod node_session_store;
pub mod rollout_store;
pub mod sqlite_store;

use std::fmt::{Display, Formatter};

use crate::storage::file_store::JsonFileStoreError;

#[derive(Debug)]
pub enum StorageError {
    File(JsonFileStoreError),
    Serialize(serde_json::Error),
    Sqlite(sqlx::Error),
    Message(String),
}

impl Display for StorageError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageError::File(error) => write!(f, "{error}"),
            StorageError::Serialize(error) => write!(f, "storage serialization error: {error}"),
            StorageError::Sqlite(error) => write!(f, "sqlite storage error: {error}"),
            StorageError::Message(message) => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for StorageError {}

impl From<JsonFileStoreError> for StorageError {
    fn from(value: JsonFileStoreError) -> Self {
        StorageError::File(value)
    }
}

impl From<serde_json::Error> for StorageError {
    fn from(value: serde_json::Error) -> Self {
        StorageError::Serialize(value)
    }
}

impl From<sqlx::Error> for StorageError {
    fn from(value: sqlx::Error) -> Self {
        StorageError::Sqlite(value)
    }
}
