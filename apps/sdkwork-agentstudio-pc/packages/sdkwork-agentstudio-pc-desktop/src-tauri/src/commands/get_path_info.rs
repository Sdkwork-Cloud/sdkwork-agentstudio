use crate::{
    framework::{filesystem::ManagedPathInfo, runtime},
    state::AppState,
};

#[tauri::command]
pub async fn get_path_info(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<ManagedPathInfo, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.get_path_info", move || {
        state
            .context
            .services
            .filesystem
            .get_path_info(&state.context.paths, &path)
    })
    .await
    .map_err(|error| error.to_string())
}
