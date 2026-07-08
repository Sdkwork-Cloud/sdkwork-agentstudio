use super::{profiles::StorageDriverScope, registry::StorageDriver};
use crate::framework::{storage::StorageProviderKind, FrameworkError, Result};
use postgres::{Client as PostgresClient, Config as PostgresConfig, NoTls};
use rusqlite::{params, Connection as SqliteConnection, OptionalExtension};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::Path,
    str::FromStr,
    sync::{Arc, Mutex, MutexGuard},
    time::Duration,
};
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

#[derive(Clone, Debug, Default)]
pub struct LocalFileStorageDriver {
    lock: Arc<Mutex<()>>,
}

#[derive(Clone, Debug, Default)]
pub struct MemoryStorageDriver {
    state: Arc<Mutex<MemoryStorageState>>,
}

#[derive(Clone, Debug, Default)]
pub struct SqliteStorageDriver {
    lock: Arc<Mutex<()>>,
}

#[derive(Clone, Debug, Default)]
pub struct PostgresStorageDriver;

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
        self.with_connection(scope, |connection| {
            connection
                .query_row(
                    "SELECT value FROM storage_entries WHERE namespace = ?1 AND key = ?2",
                    params![scope.namespace.as_str(), key],
                    |row| row.get::<_, String>(0),
                )
                .optional()
        })
    }

    fn put_text(&self, scope: &StorageDriverScope, key: &str, value: &str) -> Result<()> {
        self.with_connection(scope, |connection| {
            connection.execute(
                "INSERT INTO storage_entries (namespace, key, value, updated_at)
                 VALUES (?1, ?2, ?3, unixepoch())
                 ON CONFLICT(namespace, key)
                 DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
                params![scope.namespace.as_str(), key, value],
            )?;
            Ok(())
        })
    }

    fn delete(&self, scope: &StorageDriverScope, key: &str) -> Result<bool> {
        self.with_connection(scope, |connection| {
            let affected = connection.execute(
                "DELETE FROM storage_entries WHERE namespace = ?1 AND key = ?2",
                params![scope.namespace.as_str(), key],
            )?;
            Ok(affected > 0)
        })
    }

    fn list_keys(&self, scope: &StorageDriverScope) -> Result<Vec<String>> {
        self.with_connection(scope, |connection| {
            let mut statement = connection
                .prepare("SELECT key FROM storage_entries WHERE namespace = ?1 ORDER BY key ASC")?;
            let rows = statement.query_map(params![scope.namespace.as_str()], |row| {
                row.get::<_, String>(0)
            })?;

            rows.collect::<std::result::Result<Vec<_>, _>>()
        })
    }
}

impl SqliteStorageDriver {
    fn lock(&self) -> Result<MutexGuard<'_, ()>> {
        self.lock.lock().map_err(|_| {
            FrameworkError::Internal("sqlite storage driver lock poisoned".to_string())
        })
    }

    fn with_connection<T, F>(&self, scope: &StorageDriverScope, operation: F) -> Result<T>
    where
        F: FnOnce(&SqliteConnection) -> std::result::Result<T, rusqlite::Error>,
    {
        let _guard = self.lock()?;
        let path = scope.path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let connection = SqliteConnection::open(path).map_err(sqlite_driver_error)?;
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(sqlite_driver_error)?;
        connection
            .execute_batch(SQLITE_SCHEMA_SQL)
            .map_err(sqlite_driver_error)?;

        operation(&connection).map_err(sqlite_driver_error)
    }
}

impl StorageDriver for PostgresStorageDriver {
    fn get_text(&self, scope: &StorageDriverScope, key: &str) -> Result<Option<String>> {
        let mut client = self.connect(scope)?;
        Ok(client
            .query_opt(
                "SELECT value FROM storage_entries WHERE namespace = $1 AND key = $2",
                &[&scope.namespace, &key],
            )
            .map_err(|error| postgres_query_error(scope, "read storage entry", error))?
            .map(|row| row.get::<_, String>(0)))
    }

    fn put_text(&self, scope: &StorageDriverScope, key: &str, value: &str) -> Result<()> {
        let mut client = self.connect(scope)?;
        client
            .execute(
                "INSERT INTO storage_entries (namespace, key, value, updated_at)
                 VALUES ($1, $2, $3, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
                 ON CONFLICT(namespace, key)
                 DO UPDATE SET value = EXCLUDED.value,
                               updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT",
                &[&scope.namespace, &key, &value],
            )
            .map_err(|error| postgres_query_error(scope, "write storage entry", error))?;
        Ok(())
    }

    fn delete(&self, scope: &StorageDriverScope, key: &str) -> Result<bool> {
        let mut client = self.connect(scope)?;
        let affected = client
            .execute(
                "DELETE FROM storage_entries WHERE namespace = $1 AND key = $2",
                &[&scope.namespace, &key],
            )
            .map_err(|error| postgres_query_error(scope, "delete storage entry", error))?;
        Ok(affected > 0)
    }

    fn list_keys(&self, scope: &StorageDriverScope) -> Result<Vec<String>> {
        let mut client = self.connect(scope)?;
        let rows = client
            .query(
                "SELECT key FROM storage_entries WHERE namespace = $1 ORDER BY key ASC",
                &[&scope.namespace],
            )
            .map_err(|error| postgres_query_error(scope, "list storage keys", error))?;

        Ok(rows
            .into_iter()
            .map(|row| row.get::<_, String>(0))
            .collect())
    }
}

impl PostgresStorageDriver {
    fn connect(&self, scope: &StorageDriverScope) -> Result<PostgresClient> {
        let connection = scope.connection.as_deref().ok_or_else(|| {
            FrameworkError::ValidationFailed(format!(
                "storage profile \"{}\" does not define a database connection",
                scope.profile_id
            ))
        })?;
        let mut config = PostgresConfig::from_str(connection).map_err(|error| {
            FrameworkError::ValidationFailed(format!(
                "storage profile \"{}\" has an invalid database connection: {error}",
                scope.profile_id
            ))
        })?;
        config.connect_timeout(Duration::from_secs(5));
        if let Some(database) = scope.database.as_deref() {
            config.dbname(database);
        }

        let mut client = config.connect(NoTls).map_err(|error| {
            FrameworkError::InvalidOperation(format!(
                "unable to connect storage profile \"{}\" to postgres: {error}",
                scope.profile_id
            ))
        })?;
        client
            .batch_execute(POSTGRES_SCHEMA_SQL)
            .map_err(|error| postgres_query_error(scope, "initialize postgres storage", error))?;

        Ok(client)
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

fn sqlite_driver_error(error: rusqlite::Error) -> FrameworkError {
    FrameworkError::InvalidOperation(format!("sqlite storage driver error: {error}"))
}

fn postgres_query_error(
    scope: &StorageDriverScope,
    action: &str,
    error: postgres::Error,
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
            "claw-studio",
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
            "{\n  \"claw-studio\": {\n    \"registry\": \"current-registry\"\n  }\n}\n}",
        )
        .expect("seed storage document with stale tail");
        let scope = storage_scope(
            "default-local",
            StorageProviderKind::LocalFile,
            "claw-studio",
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
            "{\n  \"claw-studio\": {\n    \"registry\": \"stale-registry\"\n  }\n}\n{\n  \"claw-studio\": {\n    \"registry\": \"current-registry\"\n  }\n}",
        )
        .expect("seed concatenated storage documents");
        let scope = storage_scope(
            "default-local",
            StorageProviderKind::LocalFile,
            "claw-studio",
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
