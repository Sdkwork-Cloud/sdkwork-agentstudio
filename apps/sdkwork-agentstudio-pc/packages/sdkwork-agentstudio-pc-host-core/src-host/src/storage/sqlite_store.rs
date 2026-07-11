use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use sdkwork_database_config::{DatabaseConfig, DatabaseEngine, DeploymentMode};
use sdkwork_database_sqlx::{DatabasePool, PoolBuilder};
use serde::de::DeserializeOwned;
use serde::Serialize;
use sqlx::sqlite::SqlitePool;
use tokio::runtime::Runtime;

use crate::internal::node_sessions::PersistedNodeSessionCatalog;
use crate::rollout::control_plane::PersistedRolloutCatalog;
use crate::storage::node_session_store::NodeSessionCatalogStore;
use crate::storage::rollout_store::RolloutCatalogStore;
use crate::storage::StorageError;

const SQLITE_SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS host_catalog_documents (
    catalog_key TEXT PRIMARY KEY,
    document_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
"#;

const ROLLOUT_CATALOG_KEY: &str = "rollout-catalog";
const NODE_SESSION_CATALOG_KEY: &str = "node-session-catalog";

/// A SQLite-backed catalog database using `sqlx::SqlitePool`.
///
/// This struct bridges sync trait methods (`RolloutCatalogStore`,
/// `NodeSessionCatalogStore`) to async `sqlx` queries via a dedicated
/// `tokio::runtime::Runtime`. The runtime is lightweight (single worker
/// thread) and lives for the lifetime of the database handle.
#[derive(Debug, Clone)]
pub(crate) struct SqliteCatalogDatabase {
    runtime: Arc<Runtime>,
    pool: Arc<SqlitePool>,
}

impl SqliteCatalogDatabase {
    pub(crate) fn new(path: PathBuf) -> Result<Self, StorageError> {
        ensure_parent_directory(&path)?;
        let runtime = Runtime::new().map_err(|e| {
            StorageError::Message(format!("failed to create tokio runtime: {e}"))
        })?;

        let database_url = format!("sqlite://{}?mode=rwc", path.display());

        let pool = runtime.block_on(async {
            let config = DatabaseConfig {
                engine: DatabaseEngine::Sqlite,
                url: database_url,
                mode: DeploymentMode::Standalone,
                max_connections: 1,
                ..Default::default()
            };
            let db_pool = PoolBuilder::new(config).build().await?;
            let sqlite_pool = match db_pool {
                DatabasePool::Sqlite(pool, _) => pool,
                _ => {
                    return Err(sqlx::Error::Configuration(
                        "expected SQLite pool but got different engine".into(),
                    ));
                }
            };
            // Run schema migration.
            sqlx::query(SQLITE_SCHEMA_SQL).execute(&sqlite_pool).await?;
            Ok::<SqlitePool, sqlx::Error>(sqlite_pool)
        })?;

        Ok(Self {
            runtime: Arc::new(runtime),
            pool: Arc::new(pool),
        })
    }

    fn load_document<T>(&self, catalog_key: &str) -> Result<Option<T>, StorageError>
    where
        T: DeserializeOwned,
    {
        let row: Option<(String,)> = self.runtime.block_on(async {
            sqlx::query_as("SELECT document_json FROM host_catalog_documents WHERE catalog_key = ?")
                .bind(catalog_key)
                .fetch_optional(self.pool.as_ref())
                .await
        })?;

        row.map(|(document_json,)| serde_json::from_str::<T>(&document_json).map_err(StorageError::from))
            .transpose()
    }

    fn save_document<T>(&self, catalog_key: &str, document: &T) -> Result<(), StorageError>
    where
        T: Serialize,
    {
        let document_json = serde_json::to_string_pretty(document)?;
        self.runtime.block_on(async {
            sqlx::query(
                "INSERT INTO host_catalog_documents (catalog_key, document_json, updated_at)
                 VALUES (?1, ?2, unixepoch() * 1000)
                 ON CONFLICT(catalog_key)
                 DO UPDATE SET document_json = excluded.document_json,
                               updated_at = excluded.updated_at",
            )
            .bind(catalog_key)
            .bind(&document_json)
            .execute(self.pool.as_ref())
            .await
        })?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub(crate) struct SqliteRolloutCatalogStore {
    database: SqliteCatalogDatabase,
}

impl SqliteRolloutCatalogStore {
    pub(crate) fn new(path: PathBuf) -> Result<Self, StorageError> {
        Ok(Self {
            database: SqliteCatalogDatabase::new(path)?,
        })
    }
}

impl RolloutCatalogStore for SqliteRolloutCatalogStore {
    fn load_catalog(&self) -> Result<Option<PersistedRolloutCatalog>, StorageError> {
        self.database.load_document(ROLLOUT_CATALOG_KEY)
    }

    fn save_catalog(&self, catalog: &PersistedRolloutCatalog) -> Result<(), StorageError> {
        self.database.save_document(ROLLOUT_CATALOG_KEY, catalog)
    }
}

#[derive(Debug, Clone)]
pub(crate) struct SqliteNodeSessionCatalogStore {
    database: SqliteCatalogDatabase,
}

impl SqliteNodeSessionCatalogStore {
    pub(crate) fn new(path: PathBuf) -> Result<Self, StorageError> {
        Ok(Self {
            database: SqliteCatalogDatabase::new(path)?,
        })
    }
}

impl NodeSessionCatalogStore for SqliteNodeSessionCatalogStore {
    fn load_catalog(&self) -> Result<Option<PersistedNodeSessionCatalog>, StorageError> {
        self.database.load_document(NODE_SESSION_CATALOG_KEY)
    }

    fn save_catalog(&self, catalog: &PersistedNodeSessionCatalog) -> Result<(), StorageError> {
        self.database
            .save_document(NODE_SESSION_CATALOG_KEY, catalog)
    }
}

fn ensure_parent_directory(path: &Path) -> Result<(), StorageError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| StorageError::Message(format!("sqlite storage io error: {error}")))?;
    }

    Ok(())
}
