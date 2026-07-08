use crate::{
    framework::{
        runtime,
        services::openclaw_mirror_export::{
            OpenClawMirrorExportPreview, OpenClawMirrorExportRequest, OpenClawMirrorExportResult,
        },
        services::openclaw_mirror_import::{
            OpenClawMirrorImportPreview, OpenClawMirrorImportRequest, OpenClawMirrorImportResult,
        },
        Result as FrameworkResult,
    },
    state::AppState,
};
use std::path::PathBuf;

pub fn inspect_openclaw_mirror_export_from_state(
    state: &AppState,
) -> FrameworkResult<Option<OpenClawMirrorExportPreview>> {
    let config = state.config_snapshot();
    state.context.services.openclaw_mirror.inspect_export(
        &state.paths,
        &config,
        &state.context.services.storage,
        &state.context.services.supervisor,
    )
}

pub fn export_openclaw_mirror_from_state(
    state: &AppState,
    request: &OpenClawMirrorExportRequest,
) -> FrameworkResult<OpenClawMirrorExportResult> {
    let config = state.config_snapshot();
    state.context.services.openclaw_mirror.export(
        &state.paths,
        &config,
        &state.context.services.storage,
        &state.context.services.supervisor,
        request,
    )
}

pub fn inspect_openclaw_mirror_import_from_state(
    state: &AppState,
    source_path: &std::path::Path,
) -> FrameworkResult<Option<OpenClawMirrorImportPreview>> {
    state
        .context
        .services
        .openclaw_mirror
        .inspect_import(source_path)
}

pub fn import_openclaw_mirror_from_state(
    state: &AppState,
    request: &OpenClawMirrorImportRequest,
) -> FrameworkResult<OpenClawMirrorImportResult> {
    let config = state.config_snapshot();
    state.context.services.openclaw_mirror.import(
        &state.paths,
        &config,
        &state.context.services.storage,
        &state.context.services.local_ai_proxy,
        &state.context.services.supervisor,
        request,
    )
}

#[tauri::command]
pub async fn inspect_openclaw_mirror_export(
    state: tauri::State<'_, AppState>,
) -> Result<Option<OpenClawMirrorExportPreview>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.inspect_openclaw_mirror_export", move || {
        inspect_openclaw_mirror_export_from_state(&state)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn export_openclaw_mirror(
    state: tauri::State<'_, AppState>,
    request: OpenClawMirrorExportRequest,
) -> Result<OpenClawMirrorExportResult, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.export_openclaw_mirror", move || {
        export_openclaw_mirror_from_state(&state, &request)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn inspect_openclaw_mirror_import(
    state: tauri::State<'_, AppState>,
    source_path: String,
) -> Result<Option<OpenClawMirrorImportPreview>, String> {
    let state = state.inner().clone();
    let source_path = PathBuf::from(source_path);
    runtime::run_blocking_async("desktop.inspect_openclaw_mirror_import", move || {
        inspect_openclaw_mirror_import_from_state(&state, &source_path)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn import_openclaw_mirror(
    state: tauri::State<'_, AppState>,
    request: OpenClawMirrorImportRequest,
) -> Result<OpenClawMirrorImportResult, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.import_openclaw_mirror", move || {
        import_openclaw_mirror_from_state(&state, &request)
    })
    .await
    .map_err(|error| error.to_string())
}
