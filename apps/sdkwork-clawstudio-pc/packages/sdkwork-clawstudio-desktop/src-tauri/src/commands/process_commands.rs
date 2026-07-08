use crate::{
    framework::{
        runtime,
        services::process::{ProcessRequest, ProcessResult},
    },
    state::AppState,
};

#[tauri::command]
pub async fn process_run_capture(
    request: ProcessRequest,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ProcessResult, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("process.run_capture", move || {
        state
            .context
            .services
            .process
            .run_capture_and_emit(request, &app)
    })
    .await
    .map_err(|error| error.to_string())
}
