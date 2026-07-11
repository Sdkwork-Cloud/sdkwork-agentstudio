use crate::{framework::runtime, state::AppState};

#[tauri::command]
pub async fn copy_path(
    source_path: String,
    destination_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.copy_path", move || {
        state.context.services.filesystem.copy_path(
            &state.context.paths,
            &source_path,
            &destination_path,
        )
    })
    .await
    .map_err(|error| error.to_string())
}
