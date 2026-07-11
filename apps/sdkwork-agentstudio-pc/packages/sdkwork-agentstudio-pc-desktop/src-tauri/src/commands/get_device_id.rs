use crate::{framework::runtime, state::AppState};

#[tauri::command]
pub async fn get_device_id(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("system.get_device_id", move || {
        state
            .context
            .services
            .system
            .load_or_create_device_id(&state.context.paths)
    })
    .await
    .map_err(|error| error.to_string())
}
