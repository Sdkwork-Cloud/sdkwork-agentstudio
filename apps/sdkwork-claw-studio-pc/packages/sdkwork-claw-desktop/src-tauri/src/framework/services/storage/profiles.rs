use crate::framework::{
    paths::AppPaths,
    storage::{
        StorageAvailability, StorageProfileConfig, StorageProfileConfiguredFlags,
        StorageProfileInfo, StorageProviderKind,
    },
    FrameworkError, Result,
};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
struct ResolvedStorageProfile {
    id: String,
    label: String,
    provider: StorageProviderKind,
    availability: StorageAvailability,
    namespace: String,
    read_only: bool,
    path: Option<PathBuf>,
    connection: Option<String>,
    database: Option<String>,
    endpoint: Option<String>,
}

#[derive(Clone, Debug)]
pub(crate) struct ResolvedStorageSnapshot {
    pub active_profile_id: String,
    pub profiles: Vec<StorageProfileInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StorageDriverScope {
    pub profile_id: String,
    pub provider: StorageProviderKind,
    pub namespace: String,
    pub read_only: bool,
    pub path: Option<PathBuf>,
    pub connection: Option<String>,
    pub database: Option<String>,
    pub endpoint: Option<String>,
}

pub(crate) fn build_storage_snapshot(
    paths: &AppPaths,
    profiles: &[StorageProfileConfig],
    active_profile_id: &str,
) -> ResolvedStorageSnapshot {
    let profiles = normalize_resolved_profiles(paths, profiles);
    let active_profile_id = resolve_active_profile_id_for_resolved(&profiles, active_profile_id);

    let profiles = profiles
        .into_iter()
        .map(|profile| {
            let active = profile.id == active_profile_id;
            profile.into_info(active)
        })
        .collect();

    ResolvedStorageSnapshot {
        active_profile_id,
        profiles,
    }
}

pub(crate) fn resolve_scope(
    paths: &AppPaths,
    profiles: &[StorageProfileConfig],
    active_profile_id: &str,
    profile_id: Option<&str>,
    namespace: Option<&str>,
) -> Result<StorageDriverScope> {
    let profiles = normalize_resolved_profiles(paths, profiles);
    let active_profile_id = resolve_active_profile_id_for_resolved(&profiles, active_profile_id);
    let requested_profile_id = profile_id.and_then(normalize_string);

    let profile = if let Some(requested_id) = requested_profile_id {
        profiles
            .into_iter()
            .find(|candidate| candidate.id == requested_id)
            .ok_or_else(|| {
                FrameworkError::NotFound(format!("storage profile \"{}\"", requested_id))
            })?
    } else {
        profiles
            .into_iter()
            .find(|candidate| candidate.id == active_profile_id)
            .unwrap_or_else(|| normalize_profile(paths, StorageProfileConfig::local_default(), 0))
    };

    let namespace = namespace
        .and_then(normalize_string)
        .unwrap_or_else(|| profile.namespace.clone());

    Ok(StorageDriverScope {
        profile_id: profile.id,
        provider: profile.provider,
        namespace,
        read_only: profile.read_only,
        path: profile.path,
        connection: profile.connection,
        database: profile.database,
        endpoint: profile.endpoint,
    })
}

pub(crate) fn normalize_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

impl ResolvedStorageProfile {
    fn into_info(self, active: bool) -> StorageProfileInfo {
        let configured = StorageProfileConfiguredFlags::from_options(
            self.connection.as_deref(),
            self.database.as_deref(),
            self.endpoint.as_deref(),
        );

        StorageProfileInfo {
            id: self.id,
            label: self.label,
            provider: self.provider,
            active,
            availability: self.availability,
            namespace: self.namespace,
            read_only: self.read_only,
            path: self.path.map(|value| value.to_string_lossy().into_owned()),
            connection_configured: configured.connection_configured,
            database_configured: configured.database_configured,
            endpoint_configured: configured.endpoint_configured,
        }
    }
}

impl StorageDriverScope {
    pub fn ensure_writable(&self) -> Result<()> {
        if self.read_only {
            return Err(FrameworkError::Conflict(format!(
                "storage profile \"{}\" is read-only",
                self.profile_id
            )));
        }

        Ok(())
    }

    pub fn path(&self) -> Result<&Path> {
        self.path.as_deref().ok_or_else(|| {
            FrameworkError::ValidationFailed(format!(
                "storage profile \"{}\" does not define a managed path",
                self.profile_id
            ))
        })
    }
}

fn normalize_resolved_profiles(
    paths: &AppPaths,
    profiles: &[StorageProfileConfig],
) -> Vec<ResolvedStorageProfile> {
    let source = if profiles.is_empty() {
        vec![StorageProfileConfig::local_default()]
    } else {
        profiles.to_vec()
    };

    source
        .into_iter()
        .enumerate()
        .map(|(index, profile)| normalize_profile(paths, profile, index))
        .collect()
}

fn normalize_profile(
    paths: &AppPaths,
    profile: StorageProfileConfig,
    index: usize,
) -> ResolvedStorageProfile {
    let kind = profile.provider.clone();
    let fallback_id = format!("{}-{}", kind.id(), index + 1);
    let id = normalize_string(profile.id.as_str()).unwrap_or(fallback_id);
    let label =
        normalize_string(profile.label.as_str()).unwrap_or_else(|| kind.label().to_string());
    let namespace =
        normalize_string(profile.namespace.as_str()).unwrap_or_else(|| "claw-studio".to_string());
    let path = match kind {
        StorageProviderKind::LocalFile => Some(resolve_relative_path_buf(
            paths,
            profile
                .path
                .as_deref()
                .unwrap_or("profiles/default-local.json"),
        )),
        StorageProviderKind::Sqlite => Some(resolve_relative_path_buf(
            paths,
            profile.path.as_deref().unwrap_or("profiles/default.db"),
        )),
        _ => None,
    };
    let connection = profile.connection.as_deref().and_then(normalize_string);
    let database = profile.database.as_deref().and_then(normalize_string);
    let endpoint = profile.endpoint.as_deref().and_then(normalize_string);
    let path_text = path
        .as_ref()
        .map(|value| value.to_string_lossy().into_owned());
    let availability = availability_for_profile(
        &kind,
        path_text.as_deref(),
        connection.as_deref(),
        database.as_deref(),
        endpoint.as_deref(),
    );

    ResolvedStorageProfile {
        id,
        label,
        provider: kind,
        availability,
        namespace,
        read_only: profile.read_only,
        path,
        connection,
        database,
        endpoint,
    }
}

fn resolve_relative_path_buf(paths: &AppPaths, value: &str) -> PathBuf {
    let candidate = Path::new(value.trim());
    if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        paths.storage_dir.join(candidate)
    }
}

fn resolve_active_profile_id_for_resolved(
    profiles: &[ResolvedStorageProfile],
    active_profile_id: &str,
) -> String {
    if profiles
        .iter()
        .any(|profile| profile.id == active_profile_id)
    {
        active_profile_id.trim().to_string()
    } else {
        profiles
            .first()
            .map(|profile| profile.id.clone())
            .unwrap_or_else(|| StorageProfileConfig::local_default().id)
    }
}

fn availability_for_profile(
    kind: &StorageProviderKind,
    path: Option<&str>,
    connection: Option<&str>,
    _database: Option<&str>,
    endpoint: Option<&str>,
) -> StorageAvailability {
    match kind {
        StorageProviderKind::Memory | StorageProviderKind::LocalFile => StorageAvailability::Ready,
        StorageProviderKind::Sqlite => {
            if path.is_some() {
                StorageAvailability::Ready
            } else {
                StorageAvailability::ConfigurationRequired
            }
        }
        StorageProviderKind::Postgres => {
            if connection.is_some() {
                StorageAvailability::Ready
            } else {
                StorageAvailability::ConfigurationRequired
            }
        }
        StorageProviderKind::RemoteApi => {
            if endpoint.is_some() {
                StorageAvailability::Planned
            } else {
                StorageAvailability::ConfigurationRequired
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::build_storage_snapshot;
    use crate::framework::{
        paths::resolve_paths_for_root,
        storage::{StorageAvailability, StorageProfileConfig, StorageProviderKind},
    };

    #[test]
    fn active_profile_falls_back_to_default_local_profile_when_missing() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let snapshot = build_storage_snapshot(&paths, &[], "missing-profile");

        assert_eq!(snapshot.active_profile_id, "default-local");
        assert!(snapshot
            .profiles
            .iter()
            .any(|profile| profile.active && profile.id == "default-local"));
    }

    #[test]
    fn configured_profiles_are_normalized_into_runtime_snapshot() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let profiles = vec![StorageProfileConfig {
            id: "team-db".to_string(),
            label: "".to_string(),
            provider: StorageProviderKind::Postgres,
            namespace: "team-space".to_string(),
            path: None,
            connection: Some("postgres://db.internal".to_string()),
            database: Some("claw".to_string()),
            endpoint: None,
            read_only: true,
        }];

        let snapshot = build_storage_snapshot(&paths, &profiles, "team-db");
        let profile = snapshot.profiles.first().expect("profile");

        assert_eq!(profile.id, "team-db");
        assert_eq!(profile.label, "PostgreSQL");
        assert_eq!(profile.namespace, "team-space");
        assert!(profile.active);
        assert!(profile.read_only);
        assert_eq!(profile.availability, StorageAvailability::Ready);
        assert!(profile.connection_configured);
        assert!(profile.database_configured);
        assert!(!profile.endpoint_configured);
    }

    #[test]
    fn sqlite_profiles_with_a_managed_path_are_ready() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let profiles = vec![StorageProfileConfig {
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

        let snapshot = build_storage_snapshot(&paths, &profiles, "default-sqlite");
        let profile = snapshot.profiles.first().expect("sqlite profile");

        assert_eq!(profile.availability, StorageAvailability::Ready);
    }

    #[test]
    fn public_storage_snapshot_redacts_raw_connection_fields() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let profiles = vec![StorageProfileConfig {
            id: "cloud-api".to_string(),
            label: "Remote API".to_string(),
            provider: StorageProviderKind::RemoteApi,
            namespace: "cloud".to_string(),
            path: None,
            connection: Some("opaque-secret".to_string()),
            database: Some("claw".to_string()),
            endpoint: Some("https://api.sdk.work/storage".to_string()),
            read_only: false,
        }];

        let snapshot = build_storage_snapshot(&paths, &profiles, "cloud-api");
        let value = serde_json::to_value(&snapshot.profiles).expect("storage info json");

        assert_eq!(
            value.pointer("/0/connection"),
            None,
            "public storage snapshot must not expose raw connection values"
        );
        assert_eq!(
            value.pointer("/0/endpoint"),
            None,
            "public storage snapshot must not expose raw endpoint values"
        );
        assert_eq!(
            value.pointer("/0/database"),
            None,
            "public storage snapshot must not expose raw database values"
        );
        assert_eq!(
            value
                .pointer("/0/connectionConfigured")
                .and_then(serde_json::Value::as_bool),
            Some(true)
        );
    }
}
