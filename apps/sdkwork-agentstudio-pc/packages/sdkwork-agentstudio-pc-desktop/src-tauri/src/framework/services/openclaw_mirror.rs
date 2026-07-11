use super::{
    local_ai_proxy::LocalAiProxyService,
    openclaw_mirror_export::{
        build_phase1_full_private_export_preview, export_phase1_full_private_mirror,
        OpenClawMirrorExportPreview, OpenClawMirrorExportRequest, OpenClawMirrorExportResult,
    },
    openclaw_mirror_import::{
        import_openclaw_mirror, inspect_openclaw_mirror_import, OpenClawMirrorImportPreview,
        OpenClawMirrorImportRequest, OpenClawMirrorImportResult,
    },
    openclaw_runtime::OpenClawRuntimeService,
    storage::StorageService,
    supervisor::SupervisorService,
};
use crate::framework::{config::AppConfig, paths::AppPaths, FrameworkError, Result};
use std::path::Path;

#[derive(Clone, Debug, Default)]
pub struct OpenClawMirrorService;

impl OpenClawMirrorService {
    pub fn new() -> Self {
        Self
    }

    pub fn inspect_export(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        supervisor: &SupervisorService,
    ) -> Result<Option<OpenClawMirrorExportPreview>> {
        let Some(runtime) = resolve_configured_runtime(paths, supervisor)? else {
            return Ok(None);
        };

        build_phase1_full_private_export_preview(paths, config, storage, &runtime).map(Some)
    }

    pub fn export(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        supervisor: &SupervisorService,
        request: &OpenClawMirrorExportRequest,
    ) -> Result<OpenClawMirrorExportResult> {
        let runtime = resolve_configured_runtime(paths, supervisor)?
            .ok_or_else(|| FrameworkError::NotFound("configured openclaw runtime".to_string()))?;

        export_phase1_full_private_mirror(request, paths, config, storage, &runtime)
    }

    pub fn inspect_import(
        &self,
        source_path: &Path,
    ) -> Result<Option<OpenClawMirrorImportPreview>> {
        inspect_openclaw_mirror_import(source_path).map(Some)
    }

    pub fn import(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        local_ai_proxy: &LocalAiProxyService,
        supervisor: &SupervisorService,
        request: &OpenClawMirrorImportRequest,
    ) -> Result<OpenClawMirrorImportResult> {
        let runtime = resolve_configured_runtime(paths, supervisor)?
            .ok_or_else(|| FrameworkError::NotFound("configured openclaw runtime".to_string()))?;

        import_openclaw_mirror(
            paths,
            config,
            storage,
            local_ai_proxy,
            supervisor,
            &runtime,
            request,
        )
    }
}

fn resolve_configured_runtime(
    paths: &AppPaths,
    supervisor: &SupervisorService,
) -> Result<Option<super::openclaw_runtime::ActivatedOpenClawRuntime>> {
    let Some(runtime) = supervisor.configured_openclaw_runtime()? else {
        return Ok(None);
    };

    OpenClawRuntimeService::new()
        .refresh_configured_runtime(paths, &runtime)
        .map(Some)
}
