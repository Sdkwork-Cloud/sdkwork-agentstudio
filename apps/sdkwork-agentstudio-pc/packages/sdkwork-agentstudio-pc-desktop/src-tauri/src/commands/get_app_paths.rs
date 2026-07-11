use crate::{framework::paths::AppPaths, state::AppState};

pub fn app_paths_from_state(state: &AppState) -> AppPaths {
    state.paths.clone()
}

#[tauri::command]
pub fn get_app_paths(state: tauri::State<'_, AppState>) -> AppPaths {
    app_paths_from_state(&state)
}

#[cfg(test)]
mod tests {
    use super::app_paths_from_state;
    use crate::{
        framework::{
            config::AppConfig, context::FrameworkContext, logging::init_logger,
            paths::resolve_paths_for_root,
        },
        state::AppState,
    };
    use std::sync::Arc;

    #[test]
    fn app_paths_reads_state_snapshot() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let snapshot = app_paths_from_state(&state);

        assert_eq!(snapshot, paths);
    }
}
