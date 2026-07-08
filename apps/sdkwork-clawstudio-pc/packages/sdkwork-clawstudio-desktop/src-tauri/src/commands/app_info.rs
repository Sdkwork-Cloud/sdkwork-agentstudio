use crate::state::AppState;

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub target: String,
}

pub fn app_info_from_state(state: &AppState) -> AppInfo {
    AppInfo {
        name: state.app_name.clone(),
        version: state.app_version.clone(),
        target: state.target.clone(),
    }
}

#[tauri::command]
pub fn app_info(state: tauri::State<'_, AppState>) -> AppInfo {
    app_info_from_state(&state)
}

#[cfg(test)]
mod tests {
    use super::app_info_from_state;
    use crate::{
        framework::{
            config::AppConfig, context::FrameworkContext, logging::init_logger,
            paths::resolve_paths_for_root,
        },
        state::{AppMetadata, AppState},
    };
    use std::sync::Arc;

    #[test]
    fn app_info_reads_runtime_metadata_from_state() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths,
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_metadata(
            AppMetadata::new(
                "Claw Studio Desktop".to_string(),
                "2.4.6".to_string(),
                "windows-x86_64".to_string(),
            ),
            context,
        );

        let info = app_info_from_state(&state);

        assert_eq!(info.name, "Claw Studio Desktop");
        assert_eq!(info.version, "2.4.6");
        assert_eq!(info.target, "windows-x86_64");
    }
}
