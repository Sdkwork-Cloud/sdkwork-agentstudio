use crate::framework::{
    bundled::{sync_bundled_installation, BundledInstallSyncReport},
    config::{load_or_create_config, AppConfig},
    desktop_host_bootstrap::{bootstrap_desktop_host_runtime, DesktopHostRuntime},
    events,
    logging::{init_logger, AppLogger},
    paths::AppPaths,
    services::{studio::StudioInstanceStatus, FrameworkServices},
    FrameworkError, Result,
};
use std::{
    fmt::Debug,
    sync::{Arc, Mutex},
};
use tauri::{AppHandle, Emitter, Runtime};

pub type DesktopHostRuntimeState = (
    Option<crate::framework::embedded_host_server::EmbeddedHostRuntimeSnapshot>,
    Option<crate::framework::embedded_host_server::EmbeddedHostRuntimeStatus>,
);

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuiltInOpenClawStatusChangedPayload {
    pub instance_id: String,
    pub status: StudioInstanceStatus,
}

pub trait FrameworkEventSink: Debug + Send + Sync {
    fn emit_built_in_openclaw_status_changed(
        &self,
        payload: BuiltInOpenClawStatusChangedPayload,
    ) -> Result<()>;
}

impl<R: Runtime> FrameworkEventSink for AppHandle<R> {
    fn emit_built_in_openclaw_status_changed(
        &self,
        payload: BuiltInOpenClawStatusChangedPayload,
    ) -> Result<()> {
        self.emit(events::BUILT_IN_OPENCLAW_STATUS_CHANGED, payload)
            .map_err(FrameworkError::from)
    }
}

#[derive(Debug)]
pub struct FrameworkContext {
    pub paths: AppPaths,
    pub config: AppConfig,
    pub logger: AppLogger,
    pub services: FrameworkServices,
    event_sink: Option<Arc<dyn FrameworkEventSink>>,
    desktop_host: Mutex<Option<DesktopHostRuntime>>,
}

impl FrameworkContext {
    pub fn bootstrap<R: Runtime>(app: &AppHandle<R>) -> Result<Self> {
        let paths = crate::framework::paths::resolve_paths(app)?;
        let mut context =
            bootstrap_context_for_paths(paths, |paths| sync_bundled_installation(app, paths))?;
        context.event_sink = Some(Arc::new(app.clone()));
        Ok(context)
    }

    pub fn bootstrap_desktop_host(&self) -> Result<()> {
        let _ = self.ensure_desktop_host_runtime()?;
        Ok(())
    }

    pub fn ensure_desktop_host_runtime(
        &self,
    ) -> Result<Option<crate::framework::embedded_host_server::EmbeddedHostRuntimeSnapshot>> {
        let mut desktop_host = self.lock_desktop_host()?;
        if let Some(runtime) = desktop_host.as_ref() {
            let status = runtime.status();
            if status.lifecycle == "ready" || status.lifecycle == "starting" {
                return Ok(Some(runtime.snapshot().clone()));
            }

            self.logger.warn(&format!(
                "desktop embedded host runtime is {}; restarting embedded host before returning the runtime descriptor",
                status.lifecycle
            ))?;
            *desktop_host = None;
        }

        *desktop_host = bootstrap_desktop_host_runtime(
            &self.paths,
            &self.config,
            &self.services.supervisor,
            &self.services.local_ai_proxy,
            &self.logger,
        )?;

        Ok(desktop_host
            .as_ref()
            .map(|runtime| runtime.snapshot().clone()))
    }

    pub fn desktop_host_runtime_state(&self) -> Result<DesktopHostRuntimeState> {
        let desktop_host = self.lock_desktop_host()?;
        Ok(match desktop_host.as_ref() {
            Some(runtime) => (Some(runtime.snapshot().clone()), Some(runtime.status())),
            None => (None, None),
        })
    }

    pub fn emit_built_in_openclaw_status_changed(
        &self,
        payload: BuiltInOpenClawStatusChangedPayload,
    ) -> Result<()> {
        self.event_sink
            .as_ref()
            .ok_or_else(|| {
                FrameworkError::Internal(
                    "framework context event sink should be available in the desktop runtime"
                        .to_string(),
                )
            })?
            .emit_built_in_openclaw_status_changed(payload)
    }

    #[cfg(test)]
    pub fn from_parts(paths: AppPaths, config: AppConfig, logger: AppLogger) -> Self {
        let services = FrameworkServices::new(&paths, &config).expect("framework services");

        Self {
            paths,
            config,
            logger,
            services,
            event_sink: None,
            desktop_host: Mutex::new(None),
        }
    }

    #[cfg(test)]
    pub fn set_desktop_host_for_test(&self, runtime: DesktopHostRuntime) {
        *self.lock_desktop_host().expect("desktop host runtime lock") = Some(runtime);
    }

    fn lock_desktop_host(&self) -> Result<std::sync::MutexGuard<'_, Option<DesktopHostRuntime>>> {
        self.desktop_host.lock().map_err(|_| {
            FrameworkError::Internal("desktop embedded host runtime lock was poisoned".to_string())
        })
    }
}

fn bootstrap_context_for_paths<F>(
    paths: AppPaths,
    sync_bundled_installation: F,
) -> Result<FrameworkContext>
where
    F: FnOnce(&AppPaths) -> Result<BundledInstallSyncReport>,
{
    let logger = init_logger(&paths)?;
    let report = sync_bundled_installation(&paths).map_err(|error| {
        let _ = log_bundled_install_sync_failure(&logger, &error.to_string());
        error
    })?;
    log_bundled_install_sync_report(&logger, &report)?;
    let config = load_or_create_config(&paths)?;
    logger.info("framework context bootstrapped")?;
    let services = FrameworkServices::new(&paths, &config)?;

    Ok(FrameworkContext {
        paths,
        config,
        logger,
        services,
        event_sink: None,
        desktop_host: Mutex::new(None),
    })
}

fn log_bundled_install_sync_report(
    logger: &AppLogger,
    report: &BundledInstallSyncReport,
) -> Result<()> {
    if report.seeded_component_ids.is_empty() && report.seeded_runtime_ids.is_empty() {
        return Ok(());
    }

    let components = if report.seeded_component_ids.is_empty() {
        "none".to_string()
    } else {
        report.seeded_component_ids.join(", ")
    };
    let runtimes = if report.seeded_runtime_ids.is_empty() {
        "none".to_string()
    } else {
        report.seeded_runtime_ids.join(", ")
    };

    logger.info(&format!(
        "synced bundled installation: components=[{components}], runtimes=[{runtimes}]"
    ))
}

fn log_bundled_install_sync_failure(logger: &AppLogger, error: &str) -> Result<()> {
    logger.error(&format!("failed to sync bundled installation: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{
        bootstrap_context_for_paths, log_bundled_install_sync_failure,
        log_bundled_install_sync_report, FrameworkContext,
    };
    use crate::framework::{
        bundled::BundledInstallSyncReport, config::AppConfig,
        desktop_host_bootstrap::bootstrap_desktop_host_runtime, logging::init_logger,
        paths::resolve_paths_for_root,
    };

    #[test]
    fn framework_context_exposes_live_desktop_host_status() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = FrameworkContext::from_parts(paths, AppConfig::default(), logger);
        let runtime = bootstrap_desktop_host_runtime(
            &context.paths,
            &context.config,
            &context.services.supervisor,
            &context.services.local_ai_proxy,
            &context.logger,
        )
        .expect("bootstrap desktop host")
        .expect("desktop host runtime");

        context.set_desktop_host_for_test(runtime);

        let (_snapshot, status) = context
            .desktop_host_runtime_state()
            .expect("desktop host runtime state");
        let status = status.expect("desktop host runtime status");

        assert_eq!(status.lifecycle, "ready");
        assert_eq!(status.last_error, None);
    }

    #[test]
    fn framework_context_can_bootstrap_desktop_host_after_it_is_shared() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = std::sync::Arc::new(FrameworkContext::from_parts(
            paths,
            AppConfig::default(),
            logger,
        ));

        context
            .bootstrap_desktop_host()
            .expect("shared framework context should still bootstrap desktop host");

        let (_snapshot, status) = context
            .desktop_host_runtime_state()
            .expect("desktop host runtime state");
        let status = status.expect("desktop host runtime status");

        assert_eq!(status.lifecycle, "ready");
    }

    #[test]
    fn bundled_install_sync_report_logs_seeded_components_and_runtimes() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");

        log_bundled_install_sync_report(
            &logger,
            &BundledInstallSyncReport {
                seeded_component_ids: vec!["codex".to_string()],
                seeded_runtime_ids: vec!["node".to_string()],
            },
        )
        .expect("log bundled install sync report");

        let content = std::fs::read_to_string(&paths.main_log_file).expect("log content");
        assert!(content.contains("synced bundled installation:"));
        assert!(content.contains("components=[codex]"));
        assert!(content.contains("runtimes=[node]"));
    }

    #[test]
    fn bundled_install_sync_failure_logs_error() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");

        log_bundled_install_sync_failure(&logger, "bundled sync exploded")
            .expect("log bundled install sync failure");

        let content = std::fs::read_to_string(&paths.main_log_file).expect("log content");
        assert!(
            content.contains("ERROR failed to sync bundled installation: bundled sync exploded")
        );
    }

    #[test]
    fn bootstrap_fail_fast_does_not_swallow_bundled_install_sync_or_default_service_failures() {
        let source = include_str!("context.rs");
        let production_source = source
            .split("#[cfg(test)]")
            .next()
            .expect("production context source");

        assert!(
            !production_source.contains(
                "Err(error) => log_bundled_install_sync_failure(&logger, &error.to_string())?"
            ),
            "framework bootstrap must fail fast when bundled install synchronization fails"
        );
        assert!(
            !production_source.contains("match services.supervisor.start_default_services()"),
            "framework bootstrap must not swallow default-service startup failures in a warning-only branch"
        );
    }

    #[test]
    fn bootstrap_context_for_paths_aborts_when_bundled_install_sync_fails() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let error = bootstrap_context_for_paths(paths.clone(), |_| {
            Err(crate::framework::FrameworkError::Internal(
                "bundled sync exploded".to_string(),
            ))
        })
        .expect_err("bootstrap should abort when bundled install sync fails");

        assert!(error.to_string().contains("bundled sync exploded"));
    }
}
