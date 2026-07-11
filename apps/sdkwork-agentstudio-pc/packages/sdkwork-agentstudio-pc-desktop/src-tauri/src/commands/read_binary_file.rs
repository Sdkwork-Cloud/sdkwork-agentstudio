use crate::{framework::runtime, state::AppState};

#[tauri::command]
pub async fn read_binary_file(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<u8>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.read_binary_file", move || {
        state
            .context
            .services
            .filesystem
            .read_binary(&state.context.paths, &path)
    })
    .await
    .map_err(|error| error.to_string())
}
