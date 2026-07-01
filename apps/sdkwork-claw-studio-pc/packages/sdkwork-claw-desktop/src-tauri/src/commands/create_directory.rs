use crate::{framework::runtime, state::AppState};

#[tauri::command]
pub async fn create_directory(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.create_directory", move || {
        state
            .context
            .services
            .filesystem
            .create_directory(&state.context.paths, &path)
    })
    .await
    .map_err(|error| error.to_string())
}
