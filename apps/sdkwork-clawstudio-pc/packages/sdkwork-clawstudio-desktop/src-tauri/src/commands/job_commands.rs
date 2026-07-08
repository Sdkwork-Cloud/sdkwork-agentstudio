use crate::{
    framework::{runtime, services::jobs::JobRecord},
    state::AppState,
};

#[tauri::command]
pub async fn job_submit(
    kind: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("jobs.submit", move || {
        state.context.services.jobs.submit_and_emit(&kind, &app)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn job_submit_process(
    profile_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("jobs.submit_process", move || {
        if profile_id.starts_with("channels.bind.") {
            let Some(openclaw_runtime) =
                state.context.services.supervisor.configured_openclaw_runtime()?
            else {
                return Err(crate::framework::FrameworkError::NotFound(
                    "configured openclaw runtime".to_string(),
                ));
            };

            return state.context.services.jobs.submit_managed_openclaw_process_and_emit(
                state.context.services.process.clone(),
                state.context.paths.clone(),
                openclaw_runtime,
                &profile_id,
                app,
            );
        }

        state.context.services.jobs.submit_process_and_emit(
            state.context.services.process.clone(),
            &profile_id,
            app,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn job_get(id: String, state: tauri::State<'_, AppState>) -> Result<JobRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("jobs.get", move || state.context.services.jobs.get(&id))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn job_list(state: tauri::State<'_, AppState>) -> Result<Vec<JobRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("jobs.list", move || state.context.services.jobs.list())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn job_cancel(
    id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<JobRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("jobs.cancel", move || {
        let current = state.context.services.jobs.get(&id)?;

        if let Some(process_id) = current.process_id.as_deref() {
            match state.context.services.process.cancel(process_id) {
                Ok(()) => {}
                Err(crate::framework::FrameworkError::NotFound(_)) => {}
                Err(error) => return Err(error),
            }
        }

        state.context.services.jobs.cancel_and_emit(&id, &app)
    })
    .await
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    #[test]
    fn channel_binding_process_submission_routes_through_managed_openclaw_runtime() {
        let source = include_str!("job_commands.rs");
        let command_source = source
            .split("pub async fn job_submit_process")
            .nth(1)
            .and_then(|tail| tail.split("pub async fn job_get").next())
            .expect("job_submit_process source");

        assert!(command_source.contains("profile_id.starts_with(\"channels.bind.\")"));
        assert!(command_source.contains("configured_openclaw_runtime()"));
        assert!(command_source.contains("submit_managed_openclaw_process_and_emit"));
        assert!(command_source.contains("state.context.paths.clone()"));
    }
}
