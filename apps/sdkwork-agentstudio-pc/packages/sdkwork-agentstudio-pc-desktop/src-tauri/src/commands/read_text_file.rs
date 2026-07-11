use crate::{
    framework::{runtime, Result as FrameworkResult},
    state::AppState,
};

pub fn read_text_file_at(state: &AppState, path: &str) -> FrameworkResult<String> {
    state
        .context
        .services
        .filesystem
        .read_text(&state.context.paths, path)
}

#[tauri::command]
pub async fn read_text_file(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.read_text_file", move || {
        read_text_file_at(&state, &path)
    })
    .await
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::read_text_file_at;
    use crate::framework::{
        config::AppConfig, context::FrameworkContext, logging::init_logger,
        paths::resolve_paths_for_root,
    };
    use std::sync::Arc;

    #[test]
    fn reads_text_file_in_managed_data_directory() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = crate::state::AppState::from_context(context);
        let target = paths.data_dir.join("docs").join("note.txt");
        std::fs::create_dir_all(target.parent().expect("parent")).expect("create parent");
        std::fs::write(&target, "hello desktop").expect("write fixture");

        let content = read_text_file_at(&state, "docs/note.txt").expect("read text file");

        assert_eq!(content, "hello desktop");
    }
}
