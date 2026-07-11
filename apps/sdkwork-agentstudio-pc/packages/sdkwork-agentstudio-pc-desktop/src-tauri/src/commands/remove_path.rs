use crate::{framework::runtime, state::AppState};

#[tauri::command]
pub async fn remove_path(path: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.remove_path", move || {
        state
            .context
            .services
            .filesystem
            .remove_path(&state.context.paths, &path)
    })
    .await
    .map_err(|error| error.to_string())
}
