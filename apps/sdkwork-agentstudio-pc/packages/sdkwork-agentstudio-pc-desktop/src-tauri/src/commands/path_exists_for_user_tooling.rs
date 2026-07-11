use crate::{framework::runtime, state::AppState};

#[tauri::command]
pub async fn path_exists_for_user_tooling(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("filesystem.path_exists_for_user_tooling", move || {
        state
            .context
            .services
            .filesystem
            .path_exists_for_user_tooling(&state.context.paths, &path)
    })
    .await
    .map_err(|error| error.to_string())
}
