use crate::{framework::runtime, state::AppState};

#[tauri::command]
pub async fn write_binary_file(
    path: String,
    content: Vec<u8>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.write_binary_file", move || {
        state
            .context
            .services
            .filesystem
            .write_binary(&state.context.paths, &path, &content)
    })
    .await
    .map_err(|error| error.to_string())
}
