use super::{profiles::StorageDriverScope, registry::StorageDriver};
use crate::framework::{storage::StorageProviderKind, FrameworkError, Result};
use sdkwork_database_config::{DatabaseConfig, DatabaseEngine, DeploymentMode};
use sdkwork_database_sqlx::{DatabasePool, PoolBuilder};
use serde::de::DeserializeOwned;
use serde::Serialize;
use sqlx::{sqlite::SqlitePool, PgPool};
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, MutexGuard, OnceLock},
};
use tokio::runtime::Runtime;
use uuid::Uuid;

type NamespaceStore = BTreeMap<String, String>;
type ProfileNamespaceStore = BTreeMap<String, NamespaceStore>;
type MemoryStorageState = BTreeMap<String, ProfileNamespaceStore>;
type LocalFileStorageDocument = BTreeMap<String, NamespaceStore>;

const SQLITE_SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS storage_entries (
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (namespace, key)
);
CREATE INDEX IF NOT EXISTS idx_storage_entries_namespace
ON storage_entries (namespace);
"#;

const POSTGRES_SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS storage_entries (
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT),
    PRIMARY KEY (namespace, key)
);
CREATE INDEX IF NOT EXISTS idx_storage_entries_namespace
ON storage_entries (namespace);
"#;

/// Shared tokio runtime for bridging sync `StorageDriver` trait methods to
/// async `sqlx` queries.  Initialized once via `OnceLock`.
fn storage_runtime() -> &'static Runtime {
    static STORAGE_RUNTIME: OnceLock<Runtime> = OnceLock::new();
    STORAGE_RUNTIME.get_or_init(|| {
        Runtime::new().expect("failed to create tokio runtime for storage drivers")
    })
}

#[derive(Clone, Debug, Default)]
pub struct LocalFileStorageDriver {
    lock: Arc<Mutex<()>>,
}

#[derive(Clone, Debug, Default)]
pub struct MemoryStorageDriver {
    state: Arc<Mutex<MemoryStorageState>>,
}

#[derive(Clone, Debug)]
pub struct SqliteStorageDriver {
    pools: Arc<Mutex<BTreeMap<PathBuf, Arc<SqlitePool>>>>,
}

impl Default for SqliteStorageDriver {
    fn default() -> Self {
        Self {
            pools: Arc::new(Mutex::new(BTreeMap::new())),
        }
    }
}

#[derive(Clone, Debug)]
pub struct PostgresStorageDriver {
    pools: Arc<Mutex<BTreeMap<String, Arc<PgPool>>>>,
}

impl Default for PostgresStorageDriver {
    fn default() -> Self {
        Self {
            pools: Arc::new(Mutex::new(BTreeMap::new())),
        }
    }
}

#[derive(Clone, Debug)]
pub struct UnavailableStorageDriver {
    kind: StorageProviderKind,
    reason: String,
}

impl StorageDriver for LocalFileStorageDriver {
    fn get_text(&self, scope: &StorageDriverScope, key: &str) -> Result<Option<String>> {
        let _guard = self.lock()?;
        let document = self.read_document(scope.path()?)?;
        Ok(document
            .get(scope.namespace.as_str())
            .and_then(|entries| entries.get(key))
            .cloned())
    }

    fn put_text(&self, scope: &StorageDriverScope, key: &str, value: &str) -> Result<()> {
        let _guard = self.lock()?;
        let path = scope.path()?;
        let mut document = self.read_document(path)?;
        let namespace_entries = document.entry(scope.namespace.clone()).or_default();
        namespace_entries.insert(key.to_string(), value.to_string());
        self.write_document(path, &document)
    }

    fn delete(&self, scope: &StorageDriverScope, key: &str) -> Result<bool> {
        let _guard = self.lock()?;
        let path = scope.path()?;
        let mut document = self.read_document(path)?;
        let existed = if let Some(namespace_entries) = document.get_mut(scope.namespace.as_str()) {
            let existed = namespace_entries.remove(key).is_some();
            if namespace_entries.is_empty() {
                document.remove(scope.namespace.as_str());
            }
            existed
        } else {
            false
        };

        if existed {
            self.write_document(path, &document)?;
        }

        Ok(existed)
    }

    fn list_keys(&self, scope: &StorageDriverScope) -> Result<Vec<String>> {
        let _guard = self.lock()?;
        let document = self.read_document(scope.path()?)?;
        Ok(document
            .get(scope.namespace.as_str())
            .map(|entries| entries.keys().cloned().collect())
            .unwrap_or_default())
    }
}

impl LocalFileStorageDriver {
    fn lock(&self) -> Result<MutexGuard<'_, ()>> {
        self.lock
            .lock()
            .map_err(|_| FrameworkError::Internal("storage driver lock poisoned".to_string()))
    }

    fn read_document(&self, path: &Path) -> Result<LocalFileStorageDocument> {
        if !path.exists() {
            return Ok(BTreeMap::new());
        }

        let bytes = fs::read(path)?;
        if bytes.iter().all(u8::is_ascii_whitespace) {
            return Ok(BTreeMap::new());
        }

        match serde_json::from_slice::<LocalFileStorageDocument>(&bytes) {
            Ok(document) => Ok(document),
            Err(error) => recover_local_file_storage_document(path, &bytes, error),
        }
    }

    fn write_document(&self, path: &Path, document: &LocalFileStorageDocument) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let bytes = serde_json::to_vec_pretty(document)?;
        write_storage_document_bytes(path, &bytes)
    }
}

fn recover_local_file_storage_document<T>(
    path: &Path,
    bytes: &[u8],
    original_error: serde_json::Error,
) -> Result<T>
where
    T: DeserializeOwned + Serialize,
{
    let mut values = Vec::new();
    for value in serde_json::Deserializer::from_slice(bytes).into_iter::<serde_json::Value>() {
        match value {
            Ok(value) => values.push(value),
            Err(_) => break,
        }
    }

    for value in values.into_iter().rev() {
        if let Ok(document) = serde_json::from_value::<T>(value) {
            let bytes = serde_json::to_vec_pretty(&document)?;
            write_storage_document_bytes(path, &bytes)?;
            return Ok(document);
        }
    }

    Err(FrameworkError::from(original_error))
}

fn write_storage_document_bytes(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("storage.json");
    let temp_path = parent.join(format!(".{file_name}.{}.tmp", Uuid::new_v4()));
    let mut temp_file = fs::File::create(&temp_path)?;
    temp_file.write_all(bytes)?;
    temp_file.sync_all()?;
    drop(temp_file);

    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(path)?;
    }

    fs::rename(&temp_path, path).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        FrameworkError::from(error)
    })?;
    Ok(())
}

impl StorageDriver for MemoryStorageDriver {
    fn get_text(&self, scope: &StorageDriverScope, key: &str) -> Result<Option<String>> {
        let state = self.state()?;
        Ok(state
            .get(scope.profile_id.as_str())
            .and_then(|namespaces| namespaces.get(scope.namespace.as_str()))
            .and_then(|entries| entries.get(key))
            .cloned())
    }

    fn put_text(&self, scope: &StorageDriverScope, key: &str, value: &str) -> Result<()> {
        let mut state = self.state()?;
        let namespaces = state.entry(scope.profile_id.clone()).or_default();
        let entries = namespaces.entry(scope.namespace.clone()).or_default();
        entries.insert(key.to_string(), value.to_string());
        Ok(())
    }

    fn delete(&self, scope: &StorageDriverScope, key: &str) -> Result<bool> {
        let mut state = self.state()?;
        let existed = if let Some(namespaces) = state.get_mut(scope.profile_id.as_str()) {
            let existed = if let Some(entries) = namespaces.get_mut(scope.namespace.as_str()) {
                let existed = entries.remove(key).is_some();
                if entries.is_empty() {
                    namespaces.remove(scope.namespace.as_str());
                }
                existed
            } else {
                false
            };

            if namespaces.is_empty() {
                state.remove(scope.profile_id.as_str());
            }

            existed
        } else {
            false
        };

        Ok(existed)
    }

    fn list_keys(&self, scope: &StorageDriverScope) -> Result<Vec<String>> {
        let state = self.state()?;
        Ok(state
            .get(scope.profile_id.as_str())
            .and_then(|namespaces| namespaces.get(scope.namespace.as_str()))
            .map(|entries| entries.keys().cloned().collect())
            .unwrap_or_default())
    }
}

impl MemoryStorageDriver {
    fn state(&self) -> Result<MutexGuard<'_, MemoryStorageState>> {
        self.state
            .lock()
            .map_err(|_| FrameworkError::Internal("storage driver state poisoned".to_string()))
    }
}

impl StorageDriver for SqliteStorageDriver {
    fn get_text(&self, scope: &StorageDriverScope, key: &str) -> Result<Option<String>> {
        let pool = self.get_or_create_pool(scope)?;
        let row: Option<(String,)> = storage_runtime()
            .block_on(async {
                sqlx::query_as("SELECT value FROM storage_entries WHERE namespace = ? AND key = ?")
                    .bind(&scope.namespace)
                    .bind(key)
                    .fetch_optional(pool.as_ref())
                    .await
            })
            .map_err(sqlite_driver_error)?;
        Ok(row.map(|(value,)| value))
    }

    fn put_text(&self, scope: &StorageDriverScope, key: &str, value: &str) -> Result<()> {
        let pool = self.get_or_create_pool(scope)?;
        storage_runtime()
            .block_on(async {
                sqlx::query(
                    "INSERT INTO storage_entries (namespace, key, value, updated_at)
                     VALUES (?, ?, ?, unixepoch())
                     ON CONFLICT(namespace, key)
                     DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
                )
                .bind(&scope.namespace)
                .bind(key)
                .bind(value)
                .execute(pool.as_ref())
                .await
            })
            .map_err(sqlite_driver_error)?;
        Ok(())
    }

    fn delete(&self, scope: &StorageDriverScope, key: &str) -> Result<bool> {
        let pool = self.get_or_create_pool(scope)?;
        let result = storage_runtime()
            .block_on(async {
                sqlx::query("DELETE FROM storage_entries WHERE namespace = ? AND key = ?")
                    .bind(&scope.namespace)
                    .bind(key)
                    .execute(pool.as_ref())
                    .await
            })
            .map_err(sqlite_driver_error)?;
        Ok(result.rows_affected() > 0)
    }

    fn list_keys(&self, scope: &StorageDriverScope) -> Result<Vec<String>> {
        let pool = self.get_or_create_pool(scope)?;
        let rows: Vec<(String,)> = storage_runtime()
            .block_on(async {
                sqlx::query_as("SELECT key FROM storage_entries WHERE namespace = ? ORDER BY key ASC")
                    .bind(&scope.namespace)
                    .fetch_all(pool.as_ref())
                    .await
            })
            .map_err(sqlite_driver_error)?;
        Ok(rows.into_iter().map(|(key,)| key).collect())
    }
}

impl SqliteStorageDriver {
    fn get_or_create_pool(&self, scope: &StorageDriverScope) -> Result<Arc<SqlitePool>> {
        let path = scope.path()?.to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let mut pools = self.pools.lock().map_err(|_| {
            FrameworkError::Internal("sqlite storage driver pool cache lock poisoned".to_string())
        })?;

        if let Some(pool) = pools.get(&path) {
            return Ok(pool.clone());
        }

        let database_url = format!("sqlite://{}?mode=rwc", path.display());
        let pool = storage_runtime()
            .block_on(async {
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
                sqlx::query(SQLITE_SCHEMA_SQL).execute(&sqlite_pool).await?;
                Ok::<SqlitePool, sqlx::Error>(sqlite_pool)
            })
            .map_err(sqlite_driver_error)?;

        let pool = Arc::new(pool);
        pools.insert(path, pool.clone());
        Ok(pool)
    }
}

impl StorageDriver for PostgresStorageDriver {
    fn get_text(&self, scope: &StorageDriverScope, key: &str) -> Result<Option<String>> {
        let pool = self.get_or_create_pool(scope)?;
        let row: Option<(String,)> = storage_runtime()
            .block_on(async {
                sqlx::query_as("SELECT value FROM storage_entries WHERE namespace = $1 AND key = $2")
                    .bind(&scope.namespace)
                    .bind(key)
                    .fetch_optional(pool.as_ref())
                    .await
            })
            .map_err(|error| postgres_query_error(scope, "read storage entry", error))?;
        Ok(row.map(|(value,)| value))
    }

    fn put_text(&self, scope: &StorageDriverScope, key: &str, value: &str) -> Result<()> {
        let pool = self.get_or_create_pool(scope)?;
        storage_runtime()
            .block_on(async {
                sqlx::query(
                    "INSERT INTO storage_entries (namespace, key, value, updated_at)
                     VALUES ($1, $2, $3, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
                     ON CONFLICT(namespace, key)
                     DO UPDATE SET value = EXCLUDED.value,
                                   updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT",
                )
                .bind(&scope.namespace)
                .bind(key)
                .bind(value)
                .execute(pool.as_ref())
                .await
            })
            .map_err(|error| postgres_query_error(scope, "write storage entry", error))?;
        Ok(())
    }

    fn delete(&self, scope: &StorageDriverScope, key: &str) -> Result<bool> {
        let pool = self.get_or_create_pool(scope)?;
        let result = storage_runtime()
            .block_on(async {
                sqlx::query("DELETE FROM storage_entries WHERE namespace = $1 AND key = $2")
                    .bind(&scope.namespace)
                    .bind(key)
                    .execute(pool.as_ref())
                    .await
            })
            .map_err(|error| postgres_query_error(scope, "delete storage entry", error))?;
        Ok(result.rows_affected() > 0)
    }

    fn list_keys(&self, scope: &StorageDriverScope) -> Result<Vec<String>> {
        let pool = self.get_or_create_pool(scope)?;
        let rows: Vec<(String,)> = storage_runtime()
            .block_on(async {
                sqlx::query_as("SELECT key FROM storage_entries WHERE namespace = $1 ORDER BY key ASC")
                    .bind(&scope.namespace)
                    .fetch_all(pool.as_ref())
                    .await
            })
            .map_err(|error| postgres_query_error(scope, "list storage keys", error))?;
        Ok(rows.into_iter().map(|(key,)| key).collect())
    }
}

impl PostgresStorageDriver {
    fn get_or_create_pool(&self, scope: &StorageDriverScope) -> Result<Arc<PgPool>> {
        let connection = scope.connection.as_deref().ok_or_else(|| {
            FrameworkError::ValidationFailed(format!(
                "storage profile \"{}\" does not define a database connection",
                scope.profile_id
            ))
        })?;

        let pool_key = match &scope.database {
            Some(database) => format!("{connection}/{database}"),
            None => connection.to_string(),
        };

        let mut pools = self.pools.lock().map_err(|_| {
            FrameworkError::Internal(
                "postgres storage driver pool cache lock poisoned".to_string(),
            )
        })?;

        if let Some(pool) = pools.get(&pool_key) {
            return Ok(pool.clone());
        }

        let effective_url = match &scope.database {
            Some(database) if !connection.contains("?dbname=") && !connection.contains("/") => {
                format!("{connection}?dbname={database}")
            }
            _ => connection.to_string(),
        };

        let pool = storage_runtime()
            .block_on(async {
                let config = DatabaseConfig {
                    engine: DatabaseEngine::Postgres,
                    url: effective_url,
                    mode: DeploymentMode::Standalone,
                    max_connections: 5,
                    ..Default::default()
                };
                let db_pool = PoolBuilder::new(config).build().await?;
                let pg_pool = match db_pool {
                    DatabasePool::Postgres(pool, _) => pool,
                    _ => {
                        return Err(sqlx::Error::Configuration(
                            "expected Postgres pool but got different engine".into(),
                        ));
                    }
                };
                sqlx::query(POSTGRES_SCHEMA_SQL).execute(&pg_pool).await?;
                Ok::<PgPool, sqlx::Error>(pg_pool)
            })
            .map_err(|error| postgres_query_error(scope, "initialize postgres storage", error))?;

        let pool = Arc::new(pool);
        pools.insert(pool_key, pool.clone());
        Ok(pool)
    }
}

impl UnavailableStorageDriver {
    pub fn new(kind: StorageProviderKind, reason: String) -> Self {
        Self { kind, reason }
    }

    fn error(&self) -> FrameworkError {
        FrameworkError::InvalidOperation(self.reason.clone())
    }
}

impl StorageDriver for UnavailableStorageDriver {
    fn get_text(&self, _scope: &StorageDriverScope, _key: &str) -> Result<Option<String>> {
        let _ = &self.kind;
        Err(self.error())
    }

    fn put_text(&self, _scope: &StorageDriverScope, _key: &str, _value: &str) -> Result<()> {
        let _ = &self.kind;
        Err(self.error())
    }

    fn delete(&self, _scope: &StorageDriverScope, _key: &str) -> Result<bool> {
        let _ = &self.kind;
        Err(self.error())
    }

    fn list_keys(&self, _scope: &StorageDriverScope) -> Result<Vec<String>> {
        let _ = &self.kind;
        Err(self.error())
    }
}

fn sqlite_driver_error(error: sqlx::Error) -> FrameworkError {
    FrameworkError::InvalidOperation(format!("sqlite storage driver error: {error}"))
}

fn postgres_query_error(
    scope: &StorageDriverScope,
    action: &str,
    error: sqlx::Error,
) -> FrameworkError {
    FrameworkError::InvalidOperation(format!(
        "unable to {action} for storage profile \"{}\": {error}",
        scope.profile_id
    ))
}

#[cfg(test)]
mod tests {
    use super::StorageDriverScope;
    use super::{
        LocalFileStorageDriver, MemoryStorageDriver, PostgresStorageDriver, SqliteStorageDriver,
        StorageDriver, UnavailableStorageDriver,
    };
    use crate::framework::storage::StorageProviderKind;
    use std::fs;

    #[test]
    fn local_file_driver_persists_values_across_driver_instances() {
        let root = tempfile::tempdir().expect("temp dir");
        let path = root.path().join("profiles/default-local.json");
        let scope = storage_scope(
            "default-local",
            StorageProviderKind::LocalFile,
            "agent-studio",
            Some(path),
        );

        let first = LocalFileStorageDriver::default();
        first
            .put_text(&scope, "welcome", "desktop kernel")
            .expect("put text");

        let reopened = LocalFileStorageDriver::default();
        let value = reopened.get_text(&scope, "welcome").expect("get text");

        assert_eq!(value.as_deref(), Some("desktop kernel"));
    }

    #[test]
    fn local_file_driver_repairs_valid_document_with_trailing_stale_bytes() {
        let root = tempfile::tempdir().expect("temp dir");
        let path = root.path().join("profiles/default-local.json");
        fs::create_dir_all(path.parent().expect("profile dir")).expect("create profile dir");
        fs::write(
            &path,
            "{\n  \"agent-studio\": {\n    \"registry\": \"current-registry\"\n  }\n}\n}",
        )
        .expect("seed storage document with stale tail");
        let scope = storage_scope(
            "default-local",
            StorageProviderKind::LocalFile,
            "agent-studio",
            Some(path.clone()),
        );

        let driver = LocalFileStorageDriver::default();
        let value = driver.get_text(&scope, "registry").expect("get text");

        assert_eq!(value.as_deref(), Some("current-registry"));
        let repaired = fs::read_to_string(path).expect("repaired storage document");
        serde_json::from_str::<serde_json::Value>(&repaired)
            .expect("storage document should be repaired to strict JSON");
    }

    #[test]
    fn local_file_driver_repairs_concatenated_documents_by_keeping_newest_document() {
        let root = tempfile::tempdir().expect("temp dir");
        let path = root.path().join("profiles/default-local.json");
        fs::create_dir_all(path.parent().expect("profile dir")).expect("create profile dir");
        fs::write(
            &path,
            "{\n  \"agent-studio\": {\n    \"registry\": \"stale-registry\"\n  }\n}\n{\n  \"agent-studio\": {\n    \"registry\": \"current-registry\"\n  }\n}",
        )
        .expect("seed concatenated storage documents");
        let scope = storage_scope(
            "default-local",
            StorageProviderKind::LocalFile,
            "agent-studio",
            Some(path.clone()),
        );

        let driver = LocalFileStorageDriver::default();
        let value = driver.get_text(&scope, "registry").expect("get text");

        assert_eq!(value.as_deref(), Some("current-registry"));
        let repaired = fs::read_to_string(path).expect("repaired storage document");
        assert!(!repaired.contains("stale-registry"));
        serde_json::from_str::<serde_json::Value>(&repaired)
            .expect("storage document should be repaired to strict JSON");
    }

    #[test]
    fn memory_driver_stores_values_in_process_only() {
        let scope = storage_scope(
            "volatile-memory",
            StorageProviderKind::Memory,
            "volatile",
            None,
        );
        let driver = MemoryStorageDriver::default();

        driver
            .put_text(&scope, "session", "ready")
            .expect("put text");
        let value = driver.get_text(&scope, "session").expect("get text");
        let isolated = MemoryStorageDriver::default()
            .get_text(&scope, "session")
            .expect("isolated get text");

        assert_eq!(value.as_deref(), Some("ready"));
        assert_eq!(isolated, None);
    }

    #[test]
    fn unavailable_driver_returns_stable_runtime_errors() {
        let scope = storage_scope("sqlite-runtime", StorageProviderKind::Sqlite, "data", None);
        let driver = UnavailableStorageDriver::new(
            StorageProviderKind::Sqlite,
            "storage driver \"sqlite\" is not implemented yet".to_string(),
        );

        let error = driver
            .get_text(&scope, "mode")
            .expect_err("sqlite runtime access should not be available yet");

        assert_eq!(
            error.to_string(),
            "invalid operation: storage driver \"sqlite\" is not implemented yet"
        );
    }

    #[test]
    fn sqlite_driver_persists_values_across_driver_instances() {
        let root = tempfile::tempdir().expect("temp dir");
        let path = root.path().join("profiles/default.db");
        let scope = storage_scope(
            "default-sqlite",
            StorageProviderKind::Sqlite,
            "studio.chat",
            Some(path),
        );

        let first = SqliteStorageDriver::default();
        first
            .put_text(&scope, "conversation:1", "{\"title\":\"Hello\"}")
            .expect("put text");

        let reopened = SqliteStorageDriver::default();
        let value = reopened
            .get_text(&scope, "conversation:1")
            .expect("get text");
        let keys = reopened.list_keys(&scope).expect("list keys");

        assert_eq!(value.as_deref(), Some("{\"title\":\"Hello\"}"));
        assert_eq!(keys, vec!["conversation:1".to_string()]);
    }

    #[test]
    fn postgres_driver_requires_connection_details() {
        let scope = storage_scope(
            "team-postgres",
            StorageProviderKind::Postgres,
            "studio.chat",
            None,
        );
        let driver = PostgresStorageDriver::default();

        let error = driver
            .get_text(&scope, "conversation:1")
            .expect_err("postgres driver should require connection details");

        assert_eq!(
            error.to_string(),
            "validation failed: storage profile \"team-postgres\" does not define a database connection"
        );
    }

    fn storage_scope(
        profile_id: &str,
        provider: StorageProviderKind,
        namespace: &str,
        path: Option<std::path::PathBuf>,
    ) -> StorageDriverScope {
        StorageDriverScope {
            profile_id: profile_id.to_string(),
            provider,
            namespace: namespace.to_string(),
            read_only: false,
            path,
            connection: None,
            database: None,
            endpoint: None,
        }
    }
}
