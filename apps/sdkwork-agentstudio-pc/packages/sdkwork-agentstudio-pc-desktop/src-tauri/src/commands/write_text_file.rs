use crate::{
    framework::{runtime, Result as FrameworkResult},
    state::AppState,
};

pub fn write_text_file_at(state: &AppState, path: &str, content: &str) -> FrameworkResult<()> {
    state
        .context
        .services
        .filesystem
        .write_text(&state.context.paths, path, content)
}

#[tauri::command]
pub async fn write_text_file(
    path: String,
    content: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.write_text_file", move || {
        write_text_file_at(&state, &path, &content)
    })
    .await
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::write_text_file_at;
    use crate::{
        commands::read_text_file::read_text_file_at,
        framework::{
            config::AppConfig, context::FrameworkContext, logging::init_logger,
            paths::resolve_paths_for_root,
        },
    };
    use std::sync::Arc;

    #[test]
    fn writes_text_file_in_managed_data_directory() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = crate::state::AppState::from_context(context);

        write_text_file_at(&state, "docs/output.txt", "foundation ready").expect("write text file");
        let content = read_text_file_at(&state, "docs/output.txt").expect("read text file");

        assert_eq!(content, "foundation ready");
    }
}
