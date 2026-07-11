use crate::{
    framework::{filesystem::ManagedFileEntry, runtime},
    state::AppState,
};

#[tauri::command]
pub async fn list_directory(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ManagedFileEntry>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.list_directory", move || {
        state
            .context
            .services
            .filesystem
            .list_directory(&state.context.paths, &path)
    })
    .await
    .map_err(|error| error.to_string())
}
