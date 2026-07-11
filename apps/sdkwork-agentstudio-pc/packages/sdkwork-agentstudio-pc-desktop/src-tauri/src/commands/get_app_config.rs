use crate::{framework::config::PublicAppConfig, state::AppState};

pub fn app_config_from_state(state: &AppState) -> PublicAppConfig {
    state.config_snapshot().public_projection()
}

#[tauri::command]
pub fn get_app_config(state: tauri::State<'_, AppState>) -> PublicAppConfig {
    app_config_from_state(&state)
}

#[cfg(test)]
mod tests {
    use super::app_config_from_state;
    use crate::{
        framework::{
            config::AppConfig, context::FrameworkContext, logging::init_logger,
            paths::resolve_paths_for_root,
        },
        state::AppState,
    };
    use std::sync::Arc;

    #[test]
    fn app_config_reads_state_snapshot() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let config = AppConfig {
            distribution: "cn".to_string(),
            theme: "dark".to_string(),
            telemetry_enabled: true,
            ..AppConfig::default()
        };
        let context = Arc::new(FrameworkContext::from_parts(paths, config.clone(), logger));
        let state = AppState::from_context(context);

        let snapshot = app_config_from_state(&state);

        assert_eq!(snapshot.distribution, "cn");
        assert_eq!(snapshot.theme, "dark");
        assert!(snapshot.telemetry_enabled);
        assert_eq!(snapshot.storage.active_profile_id, "default-local");
    }

    #[test]
    fn app_config_projection_redacts_storage_connection_values() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let config = AppConfig {
            storage: crate::framework::storage::StorageConfig {
                active_profile_id: "cloud-api".to_string(),
                profiles: vec![crate::framework::storage::StorageProfileConfig {
                    id: "cloud-api".to_string(),
                    label: "Remote API".to_string(),
                    provider: crate::framework::storage::StorageProviderKind::RemoteApi,
                    namespace: "cloud".to_string(),
                    path: None,
                    connection: Some("opaque-secret".to_string()),
                    database: Some("claw".to_string()),
                    endpoint: Some("https://api.sdk.work/storage".to_string()),
                    read_only: false,
                }],
            },
            ..AppConfig::default()
        };
        let context = Arc::new(FrameworkContext::from_parts(paths, config, logger));
        let state = AppState::from_context(context);

        let snapshot = app_config_from_state(&state);
        let profile = snapshot.storage.profiles.first().expect("storage profile");

        assert!(profile.connection_configured);
        assert!(profile.database_configured);
        assert!(profile.endpoint_configured);
    }
}
