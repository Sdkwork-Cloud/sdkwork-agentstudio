#[derive(
    Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, serde::Serialize, serde::Deserialize,
)]
#[serde(rename_all = "camelCase")]
pub enum StorageProviderKind {
    Memory,
    LocalFile,
    Sqlite,
    Postgres,
    RemoteApi,
}

impl Default for StorageProviderKind {
    fn default() -> Self {
        Self::LocalFile
    }
}

impl StorageProviderKind {
    pub fn id(&self) -> &'static str {
        match self {
            Self::Memory => "memory",
            Self::LocalFile => "local-file",
            Self::Sqlite => "sqlite",
            Self::Postgres => "postgres",
            Self::RemoteApi => "remote-api",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::Memory => "In-Memory",
            Self::LocalFile => "Managed Local File",
            Self::Sqlite => "SQLite",
            Self::Postgres => "PostgreSQL",
            Self::RemoteApi => "Remote API",
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCapabilities {
    pub durable: bool,
    pub structured: bool,
    pub queryable: bool,
    pub transactional: bool,
    pub remote: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StorageProfileConfig {
    pub id: String,
    pub label: String,
    pub provider: StorageProviderKind,
    pub namespace: String,
    pub path: Option<String>,
    pub connection: Option<String>,
    pub database: Option<String>,
    pub endpoint: Option<String>,
    pub read_only: bool,
}

impl Default for StorageProfileConfig {
    fn default() -> Self {
        Self::local_default()
    }
}

impl StorageProfileConfig {
    pub fn local_default() -> Self {
        Self {
            id: "default-local".to_string(),
            label: "Managed Local File".to_string(),
            provider: StorageProviderKind::LocalFile,
            namespace: "claw-studio".to_string(),
            path: Some("profiles/default-local.json".to_string()),
            connection: None,
            database: None,
            endpoint: None,
            read_only: false,
        }
    }

    pub fn sqlite_default() -> Self {
        Self {
            id: "default-sqlite".to_string(),
            label: "SQLite".to_string(),
            provider: StorageProviderKind::Sqlite,
            namespace: "claw-studio".to_string(),
            path: Some("profiles/default.db".to_string()),
            connection: None,
            database: None,
            endpoint: None,
            read_only: false,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StorageConfig {
    pub active_profile_id: String,
    pub profiles: Vec<StorageProfileConfig>,
}

impl Default for StorageConfig {
    fn default() -> Self {
        let profile = StorageProfileConfig::local_default();
        Self {
            active_profile_id: profile.id.clone(),
            profiles: vec![profile, StorageProfileConfig::sqlite_default()],
        }
    }
}

impl StorageConfig {
    pub fn normalized(&self) -> Self {
        let mut profiles = if self.profiles.is_empty() {
            vec![
                StorageProfileConfig::local_default(),
                StorageProfileConfig::sqlite_default(),
            ]
        } else {
            self.profiles.clone()
        };

        if !profiles.iter().any(|profile| profile.id == "default-local") {
            profiles.push(StorageProfileConfig::local_default());
        }
        if !profiles
            .iter()
            .any(|profile| profile.id == "default-sqlite")
        {
            profiles.push(StorageProfileConfig::sqlite_default());
        }

        let active_profile_id = if profiles
            .iter()
            .any(|profile| profile.id == self.active_profile_id)
        {
            self.active_profile_id.trim().to_string()
        } else {
            profiles
                .first()
                .map(|profile| profile.id.clone())
                .unwrap_or_else(|| StorageProfileConfig::local_default().id)
        };

        Self {
            active_profile_id,
            profiles,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum StorageAvailability {
    Ready,
    ConfigurationRequired,
    Planned,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageProviderInfo {
    pub id: String,
    pub kind: StorageProviderKind,
    pub label: String,
    pub availability: StorageAvailability,
    pub requires_configuration: bool,
    pub capabilities: StorageCapabilities,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct StorageProfileConfiguredFlags {
    pub connection_configured: bool,
    pub database_configured: bool,
    pub endpoint_configured: bool,
}

impl StorageProfileConfiguredFlags {
    pub fn from_options(
        connection: Option<&str>,
        database: Option<&str>,
        endpoint: Option<&str>,
    ) -> Self {
        Self {
            connection_configured: connection.is_some(),
            database_configured: database.is_some(),
            endpoint_configured: endpoint.is_some(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageProfileInfo {
    pub id: String,
    pub label: String,
    pub provider: StorageProviderKind,
    pub active: bool,
    pub availability: StorageAvailability,
    pub namespace: String,
    pub read_only: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub connection_configured: bool,
    pub database_configured: bool,
    pub endpoint_configured: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    pub active_profile_id: String,
    pub root_dir: String,
    pub providers: Vec<StorageProviderInfo>,
    pub profiles: Vec<StorageProfileInfo>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StorageGetTextRequest {
    pub profile_id: Option<String>,
    pub namespace: Option<String>,
    pub key: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageGetTextResponse {
    pub profile_id: String,
    pub namespace: String,
    pub key: String,
    pub value: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StoragePutTextRequest {
    pub profile_id: Option<String>,
    pub namespace: Option<String>,
    pub key: String,
    pub value: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoragePutTextResponse {
    pub profile_id: String,
    pub namespace: String,
    pub key: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StorageDeleteRequest {
    pub profile_id: Option<String>,
    pub namespace: Option<String>,
    pub key: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageDeleteResponse {
    pub profile_id: String,
    pub namespace: String,
    pub key: String,
    pub existed: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StorageListKeysRequest {
    pub profile_id: Option<String>,
    pub namespace: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageListKeysResponse {
    pub profile_id: String,
    pub namespace: String,
    pub keys: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::{StorageConfig, StorageProviderKind};

    #[test]
    fn default_storage_config_includes_local_and_sqlite_profiles() {
        let config = StorageConfig::default();

        assert_eq!(config.active_profile_id, "default-local");
        assert!(config
            .profiles
            .iter()
            .any(|profile| profile.id == "default-local"));
        assert!(config.profiles.iter().any(|profile| {
            profile.id == "default-sqlite" && profile.provider == StorageProviderKind::Sqlite
        }));
    }

    #[test]
    fn normalized_storage_config_backfills_builtin_sqlite_profile() {
        let config = StorageConfig {
            active_profile_id: "default-local".to_string(),
            profiles: vec![super::StorageProfileConfig::local_default()],
        };

        let normalized = config.normalized();

        assert!(normalized
            .profiles
            .iter()
            .any(|profile| profile.id == "default-local"));
        assert!(normalized.profiles.iter().any(|profile| {
            profile.id == "default-sqlite" && profile.provider == StorageProviderKind::Sqlite
        }));
    }
}
