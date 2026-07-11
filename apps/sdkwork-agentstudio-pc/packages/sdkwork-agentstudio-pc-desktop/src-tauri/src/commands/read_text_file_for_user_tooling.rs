use crate::{
    framework::{runtime, Result as FrameworkResult},
    state::AppState,
};

pub fn read_text_file_for_user_tooling_at(state: &AppState, path: &str) -> FrameworkResult<String> {
    state
        .context
        .services
        .filesystem
        .read_text_for_user_tooling(&state.context.paths, path)
}

#[tauri::command]
pub async fn read_text_file_for_user_tooling(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.read_text_file_for_user_tooling", move || {
        read_text_file_for_user_tooling_at(&state, &path)
    })
    .await
    .map_err(|error| error.to_string())
}
