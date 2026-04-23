use super::storage::StorageService;
use crate::framework::{
    config::AppConfig,
    paths::AppPaths,
    storage::{
        StorageDeleteRequest, StorageGetTextRequest, StorageListKeysRequest, StorageProviderKind,
        StoragePutTextRequest,
    },
    FrameworkError, Result,
};
use sdkwork_local_api_proxy_native::snapshot::{
    create_local_ai_proxy_provider_center_catalog, materialize_local_ai_proxy_snapshot_from_routes,
    parse_local_ai_proxy_route_snapshot, validate_local_ai_proxy_provider_center_catalog,
};
#[allow(unused_imports)]
pub use sdkwork_local_api_proxy_native::snapshot::{
    create_system_default_local_ai_proxy_snapshot, load_local_ai_proxy_snapshot,
    write_local_ai_proxy_snapshot, LocalAiProxyModelSnapshot,
    LocalAiProxyProviderCenterCatalogSnapshot, LocalAiProxyProviderCenterRouteRecord,
    LocalAiProxyRouteRuntimeConfigSnapshot, LocalAiProxyRouteSnapshot, LocalAiProxySnapshot,
    LOCAL_AI_PROXY_CONFIG_SCHEMA_VERSION, LOCAL_AI_PROXY_DEFAULT_BIND_HOST,
    LOCAL_AI_PROXY_DEFAULT_CLIENT_API_KEY, LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL,
    LOCAL_AI_PROXY_DEFAULT_PORT, LOCAL_AI_PROXY_DEFAULT_PROVIDER_ID,
    LOCAL_AI_PROXY_DEFAULT_ROUTE_ID, LOCAL_AI_PROXY_DEFAULT_UPSTREAM_BASE_URL,
    LOCAL_AI_PROXY_PROVIDER_CENTER_CATALOG_SCHEMA_VERSION,
    LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE, LOCAL_AI_PROXY_SCHEMA_VERSION,
};

pub fn materialize_local_ai_proxy_snapshot(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
    requested_port: u16,
    auth_token: impl Into<String>,
) -> LocalAiProxySnapshot {
    materialize_local_ai_proxy_snapshot_from_routes(
        load_provider_center_routes(paths, config, storage),
        requested_port,
        auth_token,
    )
}

pub fn export_provider_center_catalog(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
) -> Result<LocalAiProxyProviderCenterCatalogSnapshot> {
    let Some(profile_id) = resolve_provider_center_profile_id(config) else {
        return Ok(create_local_ai_proxy_provider_center_catalog(
            None,
            Vec::new(),
        ));
    };

    let listed = storage.list_keys(
        paths,
        config,
        StorageListKeysRequest {
            profile_id: Some(profile_id.clone()),
            namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
        },
    )?;

    let mut routes = Vec::new();
    for key in listed.keys {
        let value = storage
            .get_text(
                paths,
                config,
                StorageGetTextRequest {
                    profile_id: Some(profile_id.clone()),
                    namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                    key: key.clone(),
                },
            )?
            .value
            .unwrap_or_default();
        routes.push(LocalAiProxyProviderCenterRouteRecord { key, value });
    }

    Ok(create_local_ai_proxy_provider_center_catalog(
        Some(profile_id),
        routes,
    ))
}

pub fn restore_provider_center_catalog(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
    catalog: &LocalAiProxyProviderCenterCatalogSnapshot,
) -> Result<()> {
    validate_local_ai_proxy_provider_center_catalog(catalog)?;

    let profile_id = resolve_provider_center_profile_id(config).ok_or_else(|| {
        FrameworkError::NotFound(
            "writable sqlite storage profile for the local ai proxy provider center".to_string(),
        )
    })?;

    let listed = storage.list_keys(
        paths,
        config,
        StorageListKeysRequest {
            profile_id: Some(profile_id.clone()),
            namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
        },
    )?;

    for key in listed.keys {
        storage.delete(
            paths,
            config,
            StorageDeleteRequest {
                profile_id: Some(profile_id.clone()),
                namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                key,
            },
        )?;
    }

    for route in &catalog.routes {
        storage.put_text(
            paths,
            config,
            StoragePutTextRequest {
                profile_id: Some(profile_id.clone()),
                namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                key: route.key.clone(),
                value: route.value.clone(),
            },
        )?;
    }

    Ok(())
}

pub fn resolve_provider_center_profile_id(config: &AppConfig) -> Option<String> {
    let storage_config = config.storage.normalized();
    let writable_sqlite_profiles = storage_config
        .profiles
        .iter()
        .filter(|profile| profile.provider == StorageProviderKind::Sqlite && !profile.read_only)
        .collect::<Vec<_>>();

    if let Some(profile) = writable_sqlite_profiles
        .iter()
        .find(|profile| profile.id == storage_config.active_profile_id)
    {
        return Some(profile.id.clone());
    }

    if let Some(profile) = writable_sqlite_profiles.first() {
        return Some(profile.id.clone());
    }

    storage_config
        .profiles
        .iter()
        .find(|profile| profile.id == "default-sqlite" && !profile.read_only)
        .map(|profile| profile.id.clone())
}

fn load_provider_center_routes(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
) -> Vec<LocalAiProxyRouteSnapshot> {
    let Some(profile_id) = resolve_provider_center_profile_id(config) else {
        return Vec::new();
    };

    let listed = match storage.list_keys(
        paths,
        config,
        StorageListKeysRequest {
            profile_id: Some(profile_id.clone()),
            namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
        },
    ) {
        Ok(listed) => listed,
        Err(_) => return Vec::new(),
    };

    let mut routes = Vec::new();
    for key in listed.keys {
        let value = match storage.get_text(
            paths,
            config,
            StorageGetTextRequest {
                profile_id: Some(profile_id.clone()),
                namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                key,
            },
        ) {
            Ok(response) => response.value,
            Err(_) => None,
        };

        let Some(value) = value else {
            continue;
        };
        if let Some(route) = parse_local_ai_proxy_route_snapshot(&value) {
            routes.push(route);
        }
    }

    routes
}
