use crate::framework::kernel_host::{
    build_desktop_kernel_host_info, native_kernel_host_is_running,
    service_manager::KernelHostServiceManager, types::DesktopKernelHostInfo,
};
use crate::framework::{
    config::AppConfig,
    kernel::{
        DesktopBundledComponentsInfo, DesktopKernelInfo, DesktopKernelRuntimeAuthorityInfo,
        DesktopKernelRuntimeAuthorityProbeInfo, DesktopLocalAiProxyDefaultRouteInfo,
        DesktopLocalAiProxyInfo, DesktopLocalAiProxyRouteRuntimeMetrics,
        DesktopLocalAiProxyRouteTestRecord, DesktopOpenClawRuntimeInfo,
    },
    paths::AppPaths,
    policy::ExecutionPolicy,
    storage::StorageInfo,
    Result,
};

pub mod browser;
pub mod component_host;
pub mod components;
pub mod dialog;
pub mod filesystem;
pub mod integrations;
pub mod jobs;
pub mod kernel;
pub mod kernel_runtime_authority;
pub mod local_ai_proxy;
pub mod local_ai_proxy_observability;
pub mod local_ai_proxy_snapshot;
pub mod notifications;
pub mod openclaw_channel_config;
pub mod openclaw_mirror;
pub mod openclaw_mirror_export;
pub mod openclaw_mirror_import;
pub mod openclaw_mirror_manifest;
pub mod openclaw_runtime;
pub mod openclaw_runtime_snapshot;
pub mod path_registration;
pub mod payments;
pub mod permissions;
pub mod process;
pub mod retention;
pub mod security;
pub mod storage;
pub mod studio;
pub mod supervisor;
pub mod system;
pub mod upgrades;

use self::{
    browser::BrowserService,
    component_host::ComponentHostService,
    components::ComponentRegistryService,
    dialog::DialogService,
    filesystem::FileSystemService,
    integrations::IntegrationService,
    jobs::JobService,
    kernel::{KernelDomainSnapshots, KernelService},
    kernel_runtime_authority::KernelRuntimeAuthorityService,
    local_ai_proxy::{LocalAiProxyLifecycle, LocalAiProxyService},
    notifications::NotificationService,
    openclaw_mirror::OpenClawMirrorService,
    openclaw_runtime::OpenClawRuntimeService,
    openclaw_runtime_snapshot::OpenClawRuntimeSnapshotService,
    path_registration::PathRegistrationService,
    payments::PaymentService,
    permissions::PermissionService,
    process::ProcessService,
    retention::RetentionService,
    security::SecurityService,
    storage::StorageService,
    studio::StudioService,
    supervisor::SupervisorService,
    system::SystemService,
    upgrades::ComponentUpgradeService,
};

#[derive(Clone, Debug)]
pub struct FrameworkServices {
    pub system: SystemService,
    pub browser: BrowserService,
    pub component_host: ComponentHostService,
    pub components: ComponentRegistryService,
    pub dialog: DialogService,
    pub filesystem: FileSystemService,
    pub security: SecurityService,
    pub notifications: NotificationService,
    pub payments: PaymentService,
    pub integrations: IntegrationService,
    pub permissions: PermissionService,
    pub openclaw_mirror: OpenClawMirrorService,
    pub openclaw_runtime: OpenClawRuntimeService,
    pub openclaw_runtime_snapshot: OpenClawRuntimeSnapshotService,
    pub local_ai_proxy: LocalAiProxyService,
    pub path_registration: PathRegistrationService,
    pub process: ProcessService,
    pub jobs: JobService,
    #[allow(dead_code)]
    pub retention: RetentionService,
    pub storage: StorageService,
    pub studio: StudioService,
    pub kernel: KernelService,
    pub kernel_host_manager: KernelHostServiceManager,
    pub supervisor: SupervisorService,
    #[allow(dead_code)]
    pub upgrades: ComponentUpgradeService,
}

impl FrameworkServices {
    pub fn new(paths: &AppPaths, config: &AppConfig) -> Result<Self> {
        Self::with_kernel_host_manager(paths, config, KernelHostServiceManager::new())
    }

    fn with_kernel_host_manager(
        paths: &AppPaths,
        config: &AppConfig,
        kernel_host_manager: KernelHostServiceManager,
    ) -> Result<Self> {
        let policy = ExecutionPolicy::for_paths_with_security(paths, &config.security)?;

        Ok(Self {
            system: SystemService::new(),
            browser: BrowserService::with_security(&config.security),
            component_host: ComponentHostService::new(),
            components: ComponentRegistryService::new(),
            dialog: DialogService::new(),
            filesystem: FileSystemService::new(),
            security: SecurityService::new(),
            notifications: NotificationService::new(),
            payments: PaymentService::new(),
            integrations: IntegrationService::new(),
            permissions: PermissionService::new(),
            openclaw_mirror: OpenClawMirrorService::new(),
            openclaw_runtime: OpenClawRuntimeService::new(),
            openclaw_runtime_snapshot: OpenClawRuntimeSnapshotService::new(),
            local_ai_proxy: LocalAiProxyService::new(),
            path_registration: PathRegistrationService::new(),
            process: ProcessService::new(policy),
            jobs: JobService::with_max_concurrent_process_jobs(config.process.max_concurrent_jobs),
            retention: RetentionService::new(),
            storage: StorageService::new(),
            studio: StudioService::new(),
            kernel: KernelService::new(),
            kernel_host_manager,
            supervisor: SupervisorService::for_paths(paths),
            upgrades: ComponentUpgradeService::new(),
        })
    }

    pub fn desktop_storage_info(&self, paths: &AppPaths, config: &AppConfig) -> StorageInfo {
        let normalized = AppConfig {
            storage: config.storage.normalized(),
            ..config.clone()
        };
        self.storage.storage_info(paths, &normalized)
    }

    pub fn desktop_kernel_info(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
    ) -> Result<DesktopKernelInfo> {
        let normalized = AppConfig {
            storage: config.storage.normalized(),
            ..config.clone()
        };
        let active_job_count = self.jobs.active_job_count()?;
        let active_process_job_count = self.jobs.active_process_job_count()?;
        let supervisor = self.supervisor.kernel_info()?;
        let bundled_components = self.components.kernel_info(paths)?;
        let primary_runtime_id = self.components.default_runtime_id(paths)?;
        let open_claw_runtime = self.openclaw_runtime_snapshot.kernel_info(
            paths,
            &self.supervisor,
            &self.local_ai_proxy,
        )?;
        let local_ai_proxy = self.desktop_local_ai_proxy_info(paths)?;
        let configured_openclaw_runtime = self.supervisor.configured_openclaw_runtime()?;
        let host = build_desktop_kernel_host_info(
            paths,
            configured_openclaw_runtime.as_ref(),
            &supervisor,
            &primary_runtime_id,
        )?;
        let runtime_authorities = self.desktop_runtime_authorities(
            paths,
            &bundled_components,
            &host,
            &open_claw_runtime,
        )?;

        Ok(self.kernel.kernel_info(
            paths,
            KernelDomainSnapshots {
                filesystem: self.filesystem.kernel_info(paths),
                security: self.security.kernel_info(&normalized),
                process: self.process.kernel_info(
                    &normalized,
                    active_job_count,
                    active_process_job_count,
                )?,
                permissions: self.permissions.kernel_info(&normalized),
                notifications: self.notifications.kernel_info(&normalized),
                payments: self.payments.kernel_info(&normalized),
                integrations: self.integrations.kernel_info(paths, &normalized)?,
                supervisor,
                open_claw_runtime,
                runtime_authorities,
                local_ai_proxy,
                desktop_startup_evidence: self.kernel.desktop_startup_evidence(paths),
                bundled_components,
                storage: self.storage.storage_info(paths, &normalized),
                host,
            },
        ))
    }

    fn desktop_local_ai_proxy_info(&self, paths: &AppPaths) -> Result<DesktopLocalAiProxyInfo> {
        let status = self.local_ai_proxy.status()?;
        let message_capture_settings = self.local_ai_proxy.message_capture_settings(paths)?;
        let observability_db_path = self.local_ai_proxy.observability_db_path(paths)?;
        let health = status.health.as_ref();
        let root_base_url = health.map(|item| item.base_url.trim_end_matches("/v1").to_string());
        Ok(DesktopLocalAiProxyInfo {
            lifecycle: match status.lifecycle {
                LocalAiProxyLifecycle::Running => "running".to_string(),
                LocalAiProxyLifecycle::Stopped => "stopped".to_string(),
                LocalAiProxyLifecycle::Failed => "failed".to_string(),
            },
            base_url: health.map(|item| item.base_url.clone()),
            root_base_url: root_base_url.clone(),
            openai_compatible_base_url: health.map(|item| item.base_url.clone()),
            anthropic_base_url: health.map(|item| item.base_url.clone()),
            gemini_base_url: root_base_url,
            active_port: health.map(|item| item.active_port),
            loopback_only: health.map(|item| item.loopback_only).unwrap_or(true),
            default_route_id: health.map(|item| item.default_route_id.clone()),
            default_route_name: health.map(|item| item.default_route_name.clone()),
            default_routes: health
                .map(|item| {
                    item.default_routes
                        .iter()
                        .map(|route| DesktopLocalAiProxyDefaultRouteInfo {
                            client_protocol: route.client_protocol.clone(),
                            id: route.id.clone(),
                            name: route.name.clone(),
                            managed_by: route.managed_by.clone(),
                            upstream_protocol: route.upstream_protocol.clone(),
                            upstream_base_url: route.upstream_base_url.clone(),
                            model_count: route.model_count,
                        })
                        .collect()
                })
                .unwrap_or_default(),
            upstream_base_url: health.map(|item| item.upstream_base_url.clone()),
            model_count: health.map(|item| item.model_count).unwrap_or_default(),
            route_metrics: status
                .route_metrics
                .into_iter()
                .map(|metric| DesktopLocalAiProxyRouteRuntimeMetrics {
                    route_id: metric.route_id,
                    client_protocol: metric.client_protocol,
                    upstream_protocol: metric.upstream_protocol,
                    health: metric.health,
                    request_count: metric.request_count,
                    success_count: metric.success_count,
                    failure_count: metric.failure_count,
                    rpm: metric.rpm,
                    total_tokens: metric.total_tokens,
                    input_tokens: metric.input_tokens,
                    output_tokens: metric.output_tokens,
                    cache_tokens: metric.cache_tokens,
                    average_latency_ms: metric.average_latency_ms,
                    last_latency_ms: metric.last_latency_ms,
                    last_used_at: metric.last_used_at,
                    last_error: metric.last_error,
                })
                .collect(),
            route_tests: status
                .route_tests
                .into_iter()
                .map(|record| DesktopLocalAiProxyRouteTestRecord {
                    route_id: record.route_id,
                    status: record.status,
                    tested_at: record.tested_at,
                    latency_ms: record.latency_ms,
                    checked_capability: record.checked_capability,
                    model_id: record.model_id,
                    error: record.error,
                })
                .collect(),
            message_capture_enabled: message_capture_settings.enabled,
            observability_db_path: Some(observability_db_path),
            config_file: paths
                .local_ai_proxy_config_file
                .to_string_lossy()
                .into_owned(),
            snapshot_path: health
                .map(|item| item.snapshot_path.clone())
                .unwrap_or_else(|| {
                    paths
                        .local_ai_proxy_snapshot_file
                        .to_string_lossy()
                        .into_owned()
                }),
            log_path: health
                .map(|item| item.log_path.clone())
                .unwrap_or_else(|| paths.local_ai_proxy_log_file.to_string_lossy().into_owned()),
            last_error: status.last_error,
        })
    }

    pub fn desktop_kernel_host_status(&self, paths: &AppPaths) -> Result<DesktopKernelHostInfo> {
        let supervisor = self.supervisor.kernel_info()?;
        let configured_openclaw_runtime = self.supervisor.configured_openclaw_runtime()?;
        let primary_runtime_id = self.components.default_runtime_id(paths)?;
        build_desktop_kernel_host_info(
            paths,
            configured_openclaw_runtime.as_ref(),
            &supervisor,
            &primary_runtime_id,
        )
    }

    fn desktop_runtime_authorities(
        &self,
        paths: &AppPaths,
        bundled_components: &DesktopBundledComponentsInfo,
        host: &DesktopKernelHostInfo,
        open_claw_runtime: &DesktopOpenClawRuntimeInfo,
    ) -> Result<Vec<DesktopKernelRuntimeAuthorityInfo>> {
        let authority_service = KernelRuntimeAuthorityService::new();
        let mut runtime_ids = bundled_components.included_kernel_ids.clone();
        if !runtime_ids
            .iter()
            .any(|runtime_id| runtime_id == &host.provenance.runtime_id)
        {
            runtime_ids.push(host.provenance.runtime_id.clone());
        }

        let mut authorities = Vec::new();
        for runtime_id in runtime_ids {
            let Some(contract) = authority_service.managed_contract(&runtime_id, paths)? else {
                continue;
            };

            if runtime_id == open_claw_runtime.runtime_id {
                authorities.push(DesktopKernelRuntimeAuthorityInfo {
                    runtime_id,
                    config_file: open_claw_runtime.authority.config_file.clone(),
                    owned_runtime_roots: open_claw_runtime.authority.owned_runtime_roots.clone(),
                    readiness_probe: DesktopKernelRuntimeAuthorityProbeInfo {
                        supports_loopback_health_probe: open_claw_runtime
                            .authority
                            .readiness_probe
                            .supports_loopback_health_probe,
                        health_probe_timeout_ms: open_claw_runtime
                            .authority
                            .readiness_probe
                            .health_probe_timeout_ms,
                    },
                    runtime_version: open_claw_runtime.openclaw_version.clone(),
                    node_version: open_claw_runtime.node_version.clone(),
                    platform: Some(open_claw_runtime.platform.clone()),
                    arch: Some(open_claw_runtime.arch.clone()),
                    install_source: Some(host.provenance.install_source.clone()),
                    runtime_home_dir: Some(open_claw_runtime.home_dir.clone()),
                    runtime_install_dir: open_claw_runtime.install_dir.clone(),
                });
                continue;
            }

            authorities.push(DesktopKernelRuntimeAuthorityInfo {
                runtime_id: runtime_id.clone(),
                config_file: contract.config_file_path.to_string_lossy().into_owned(),
                owned_runtime_roots: contract
                    .owned_runtime_roots
                    .iter()
                    .map(|path| path.to_string_lossy().into_owned())
                    .collect(),
                readiness_probe: DesktopKernelRuntimeAuthorityProbeInfo {
                    supports_loopback_health_probe: contract
                        .readiness_probe
                        .supports_loopback_health_probe,
                    health_probe_timeout_ms: contract.readiness_probe.health_probe_timeout_ms,
                },
                runtime_version: if host.provenance.runtime_id == runtime_id {
                    host.provenance.runtime_version.clone()
                } else {
                    None
                },
                node_version: if host.provenance.runtime_id == runtime_id {
                    host.provenance.node_version.clone()
                } else {
                    None
                },
                platform: if host.provenance.runtime_id == runtime_id {
                    Some(host.provenance.platform.clone())
                } else {
                    None
                },
                arch: if host.provenance.runtime_id == runtime_id {
                    Some(host.provenance.arch.clone())
                } else {
                    None
                },
                install_source: if host.provenance.runtime_id == runtime_id {
                    Some(host.provenance.install_source.clone())
                } else {
                    None
                },
                runtime_home_dir: None,
                runtime_install_dir: contract
                    .owned_runtime_roots
                    .first()
                    .map(|path| path.to_string_lossy().into_owned()),
            });
        }

        Ok(authorities)
    }

    pub fn ensure_local_ai_proxy_ready(&self, paths: &AppPaths, config: &AppConfig) -> Result<()> {
        let snapshot = self
            .local_ai_proxy
            .ensure_snapshot(paths, config, &self.storage)?;
        let health = self.local_ai_proxy.start(paths, snapshot.clone())?;
        self.local_ai_proxy
            .project_managed_openclaw_provider(paths, &snapshot, &health)?;
        Ok(())
    }

    pub fn ensure_desktop_kernel_running(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
    ) -> Result<DesktopKernelHostInfo> {
        let configured_openclaw_runtime = self.supervisor.configured_openclaw_runtime()?;
        if configured_openclaw_runtime.is_none() {
            return self.desktop_kernel_host_status(paths);
        }

        self.ensure_local_ai_proxy_ready(paths, config)?;
        let native_host_running =
            native_kernel_host_is_running(paths, configured_openclaw_runtime.as_ref())?;
        if native_host_running {
            return self.desktop_kernel_host_status(paths);
        }
        if should_boot_desktop_kernel_via_platform_host_manager()
            && self
                .kernel_host_manager
                .ensure_running(paths, configured_openclaw_runtime.as_ref())
                .unwrap_or(false)
        {
            return self.desktop_kernel_host_status(paths);
        }

        if !self
            .supervisor
            .is_service_running(supervisor::SERVICE_ID_OPENCLAW_GATEWAY)?
        {
            self.supervisor.start_openclaw_gateway(paths)?;
        }

        self.desktop_kernel_host_status(paths)
    }

    pub fn restart_desktop_kernel(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
    ) -> Result<DesktopKernelHostInfo> {
        let configured_openclaw_runtime = self.supervisor.configured_openclaw_runtime()?;
        if configured_openclaw_runtime.is_none() {
            return self.desktop_kernel_host_status(paths);
        }

        self.ensure_local_ai_proxy_ready(paths, config)?;
        let native_host_running =
            native_kernel_host_is_running(paths, configured_openclaw_runtime.as_ref())?;
        if (native_host_running || should_boot_desktop_kernel_via_platform_host_manager())
            && self
                .kernel_host_manager
                .restart(paths, configured_openclaw_runtime.as_ref())
                .unwrap_or(false)
        {
            return self.desktop_kernel_host_status(paths);
        }

        self.supervisor.restart_openclaw_gateway(paths)?;
        self.desktop_kernel_host_status(paths)
    }
}

fn should_boot_desktop_kernel_via_platform_host_manager() -> bool {
    // The embedded desktop runtime must stay in the interactive user session on Windows
    // so browser launch, plugin install, and similar OpenClaw flows behave like standalone.
    !cfg!(windows)
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::{
        path::PathBuf,
        sync::{Mutex, MutexGuard, OnceLock},
    };

    fn process_env_mutex() -> &'static Mutex<()> {
        static PROCESS_ENV_MUTEX: OnceLock<Mutex<()>> = OnceLock::new();
        PROCESS_ENV_MUTEX.get_or_init(|| Mutex::new(()))
    }

    fn loopback_port_mutex() -> &'static Mutex<()> {
        static LOOPBACK_PORT_MUTEX: OnceLock<Mutex<()>> = OnceLock::new();
        LOOPBACK_PORT_MUTEX.get_or_init(|| Mutex::new(()))
    }

    pub(crate) fn lock_process_env() -> MutexGuard<'static, ()> {
        process_env_mutex()
            .lock()
            .expect("lock shared process environment for tests")
    }

    pub(crate) fn lock_loopback_ports() -> MutexGuard<'static, ()> {
        loopback_port_mutex()
            .lock()
            .expect("lock shared loopback ports for tests")
    }

    #[cfg(windows)]
    pub(crate) fn resolve_test_node_executable(context: &str) -> PathBuf {
        let _env_lock = lock_process_env();
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node.exe"))
            .find(|candidate| candidate.exists())
            .unwrap_or_else(|| panic!("node.exe should be available on PATH for {context}"))
    }

    #[cfg(not(windows))]
    pub(crate) fn resolve_test_node_executable(context: &str) -> PathBuf {
        let _env_lock = lock_process_env();
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node"))
            .find(|candidate| candidate.exists())
            .unwrap_or_else(|| panic!("node should be available on PATH for {context}"))
    }
}

#[cfg(test)]
mod tests {
    use super::{FrameworkServices, LocalAiProxyLifecycle};
    use crate::framework::{
        config::AppConfig,
        kernel_host::{
            service_manager::{KernelHostServiceManager, KernelHostServicePlatformOps},
            types::{KernelHostOwnershipMarker, KernelPlatformServiceSpec},
            write_kernel_host_ownership_marker,
        },
        paths::resolve_paths_for_root,
        services::{
            openclaw_channel_config::write_test_openclaw_channel_metadata,
            openclaw_runtime::ActivatedOpenClawRuntime, supervisor,
        },
    };
    use std::{
        fs,
        net::TcpListener,
        path::PathBuf,
        sync::{Arc, Mutex},
        time::{SystemTime, UNIX_EPOCH},
    };

    fn fake_runtime(
        paths: &crate::framework::paths::AppPaths,
        gateway_port: u16,
    ) -> ActivatedOpenClawRuntime {
        ActivatedOpenClawRuntime {
            install_key: "test-runtime".to_string(),
            install_dir: paths.openclaw_runtime_dir.join("test-runtime"),
            runtime_dir: paths
                .openclaw_runtime_dir
                .join("test-runtime")
                .join("runtime"),
            node_path: PathBuf::from("node"),
            cli_path: paths
                .openclaw_runtime_dir
                .join("test-runtime")
                .join("runtime")
                .join("package")
                .join("node_modules")
                .join("openclaw")
                .join("openclaw.mjs"),
            home_dir: paths.user_root.clone(),
            state_dir: paths.openclaw_root_dir.clone(),
            workspace_dir: paths.openclaw_workspace_dir.clone(),
            config_path: paths.openclaw_config_file.clone(),
            gateway_port,
            gateway_auth_token: "test-token".to_string(),
        }
    }

    fn fake_supervisor_runtime(
        paths: &crate::framework::paths::AppPaths,
        gateway_port: u16,
    ) -> ActivatedOpenClawRuntime {
        let install_dir = paths.openclaw_runtime_dir.join("test-gateway");
        let runtime_dir = install_dir.join("runtime");
        let cli_path = runtime_dir
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        write_test_openclaw_channel_metadata(&runtime_dir);
        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {gateway_port}\n  }}\n}}\n"),
        )
        .expect("config file");
        fs::write(
            &cli_path,
            "import fs from 'node:fs';\n\
             import http from 'node:http';\n\
             const args = process.argv.slice(2);\n\
             const configPath = process.env.OPENCLAW_CONFIG_PATH;\n\
             const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));\n\
             const gatewayPort = Number(config.gateway?.port ?? 21280);\n\
             const expectedAuthorization = `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN ?? ''}`;\n\
             if (args[0] === 'gateway' && args[1] === 'health') {\n\
               process.stdout.write(JSON.stringify({ ok: true, result: { status: 'ok' } }));\n\
               process.exit(0);\n\
             }\n\
             if (args[0] !== 'gateway') {\n\
               process.stderr.write(`unexpected args: ${args.join(' ')}`);\n\
               process.exit(1);\n\
             }\n\
             const server = http.createServer((req, res) => {\n\
               if (req.url === '/health' || req.url === '/healthz') {\n\
                 res.writeHead(200, { 'content-type': 'application/json' });\n\
                 res.end(JSON.stringify({ ok: true, status: 'live' }));\n\
                 return;\n\
               }\n\
               if (req.url === '/ready' || req.url === '/readyz') {\n\
                 res.writeHead(200, { 'content-type': 'application/json' });\n\
                 res.end(JSON.stringify({ ready: true, failing: [], uptimeMs: 1 }));\n\
                 return;\n\
               }\n\
               if (req.url !== '/tools/invoke' || req.method !== 'POST') {\n\
                 res.writeHead(404, { 'content-type': 'application/json' });\n\
                 res.end(JSON.stringify({ ok: false, error: { message: 'unexpected path' } }));\n\
                 return;\n\
               }\n\
               if ((req.headers.authorization ?? '') !== expectedAuthorization) {\n\
                 res.writeHead(401, { 'content-type': 'application/json' });\n\
                 res.end(JSON.stringify({ ok: false, error: { message: 'unauthorized' } }));\n\
                 return;\n\
               }\n\
               let body = '';\n\
               req.setEncoding('utf8');\n\
               req.on('data', (chunk) => { body += chunk; });\n\
               req.on('end', () => {\n\
                 const payload = body.trim() ? JSON.parse(body) : {};\n\
                 res.writeHead(200, { 'content-type': 'application/json' });\n\
                 res.end(JSON.stringify({ ok: true, result: { method: payload.action ? `${payload.tool}.${payload.action}` : payload.tool ?? 'unknown' } }));\n\
               });\n\
             });\n\
             server.listen(gatewayPort, '127.0.0.1');\n\
             setInterval(() => {}, 1000);\n",
        )
        .expect("cli file");

        ActivatedOpenClawRuntime {
            install_key: "test-gateway".to_string(),
            install_dir,
            runtime_dir,
            node_path: resolve_test_node_executable(),
            cli_path,
            home_dir: paths.user_root.clone(),
            state_dir: paths.openclaw_root_dir.clone(),
            workspace_dir: paths.openclaw_workspace_dir.clone(),
            config_path: paths.openclaw_config_file.clone(),
            gateway_port,
            gateway_auth_token: "test-token".to_string(),
        }
    }

    #[test]
    fn ensure_desktop_kernel_running_attaches_to_a_running_native_host_before_falling_back() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let services = FrameworkServices::new(&paths, &AppConfig::default()).expect("services");
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("listener");
        let gateway_port = listener.local_addr().expect("listener addr").port();
        let runtime = fake_runtime(&paths, gateway_port);

        services
            .supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        write_kernel_host_ownership_marker(
            &paths,
            &KernelHostOwnershipMarker {
                service_name: "agent-studio-openclaw".to_string(),
                active_port: gateway_port,
                started_at_ms: 123,
                host_pid: Some(7),
            },
        )
        .expect("write marker");

        let info = services
            .ensure_desktop_kernel_running(&paths, &AppConfig::default())
            .expect("kernel status");

        assert_eq!(info.runtime.started_by, "nativeService");
        assert_eq!(info.host.ownership, "nativeService");

        let supervisor = services.supervisor.kernel_info().expect("supervisor info");
        let gateway = supervisor
            .services
            .into_iter()
            .find(|service| service.id == supervisor::SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("gateway service");
        assert_eq!(gateway.lifecycle, "stopped");
    }

    #[test]
    fn ensure_desktop_kernel_running_returns_status_when_openclaw_runtime_is_not_configured() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let services = FrameworkServices::new(&paths, &AppConfig::default()).expect("services");

        let info = services
            .ensure_desktop_kernel_running(&paths, &AppConfig::default())
            .expect("generic hosted runtimes should not require a configured OpenClaw runtime");

        assert_eq!(info.runtime.state, "stopped");
        assert_eq!(info.runtime.health, "degraded");
        assert_eq!(
            services
                .local_ai_proxy
                .status()
                .expect("local ai proxy status")
                .lifecycle,
            LocalAiProxyLifecycle::Stopped
        );
        assert!(
            !paths.local_ai_proxy_config_file.exists(),
            "generic hosted runtimes must not create local ai proxy config during kernel ensure"
        );
        assert!(
            !paths.local_ai_proxy_snapshot_file.exists(),
            "generic hosted runtimes must not create local ai proxy snapshot during kernel ensure"
        );
        assert!(
            !paths.local_ai_proxy_token_file.exists(),
            "generic hosted runtimes must not create local ai proxy token during kernel ensure"
        );
    }

    #[test]
    fn restart_desktop_kernel_returns_status_when_openclaw_runtime_is_not_configured() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let services = FrameworkServices::new(&paths, &AppConfig::default()).expect("services");

        let info = services
            .restart_desktop_kernel(&paths, &AppConfig::default())
            .expect("generic hosted runtimes should not restart an unavailable OpenClaw runtime");

        assert_eq!(info.runtime.state, "stopped");
        assert_eq!(info.runtime.health, "degraded");
        assert_eq!(
            services
                .local_ai_proxy
                .status()
                .expect("local ai proxy status")
                .lifecycle,
            LocalAiProxyLifecycle::Stopped
        );
        assert!(
            !paths.local_ai_proxy_config_file.exists(),
            "generic hosted runtimes must not create local ai proxy config during kernel restart"
        );
        assert!(
            !paths.local_ai_proxy_snapshot_file.exists(),
            "generic hosted runtimes must not create local ai proxy snapshot during kernel restart"
        );
        assert!(
            !paths.local_ai_proxy_token_file.exists(),
            "generic hosted runtimes must not create local ai proxy token during kernel restart"
        );
    }

    #[cfg(not(windows))]
    #[test]
    fn ensure_desktop_kernel_running_prefers_native_service_manager_before_supervisor_spawn() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_runtime(&paths, reserve_loopback_port());
        let backend = Arc::new(FakeKernelHostPlatformOps::new(
            paths.clone(),
            runtime.gateway_port,
        ));
        let services = FrameworkServices::with_kernel_host_manager(
            &paths,
            &AppConfig::default(),
            KernelHostServiceManager::with_backend(backend.clone()),
        )
        .expect("services");

        services
            .supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        let info = services
            .ensure_desktop_kernel_running(&paths, &AppConfig::default())
            .expect("ensure desktop kernel");

        assert_eq!(info.host.ownership, "nativeService");
        assert_eq!(
            backend.events(),
            vec!["install".to_string(), "start".to_string()]
        );

        let supervisor = services.supervisor.kernel_info().expect("supervisor info");
        let gateway = supervisor
            .services
            .into_iter()
            .find(|service| service.id == supervisor::SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("gateway service");
        assert_eq!(gateway.lifecycle, "stopped");
    }

    #[cfg(windows)]
    #[test]
    fn ensure_desktop_kernel_running_prefers_supervisor_spawn_before_native_service_manager() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_supervisor_runtime(&paths, reserve_loopback_port());
        let backend = Arc::new(FakeKernelHostPlatformOps::new(
            paths.clone(),
            runtime.gateway_port,
        ));
        let services = FrameworkServices::with_kernel_host_manager(
            &paths,
            &AppConfig::default(),
            KernelHostServiceManager::with_backend(backend.clone()),
        )
        .expect("services");

        services
            .supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        let info = services
            .ensure_desktop_kernel_running(&paths, &AppConfig::default())
            .expect("ensure desktop kernel");

        assert_eq!(info.host.ownership, "appSupervisor");
        assert_eq!(backend.events(), Vec::<String>::new());

        let supervisor = services.supervisor.kernel_info().expect("supervisor info");
        let gateway = supervisor
            .services
            .into_iter()
            .find(|service| service.id == supervisor::SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("gateway service");
        assert_eq!(gateway.lifecycle, "running");

        services.supervisor.begin_shutdown().expect("shutdown");
    }

    #[cfg(not(windows))]
    #[test]
    fn restart_desktop_kernel_restarts_native_service_when_available() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_runtime(&paths, reserve_loopback_port());
        let backend = Arc::new(FakeKernelHostPlatformOps::new(
            paths.clone(),
            runtime.gateway_port,
        ));
        let services = FrameworkServices::with_kernel_host_manager(
            &paths,
            &AppConfig::default(),
            KernelHostServiceManager::with_backend(backend.clone()),
        )
        .expect("services");

        services
            .supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        services
            .ensure_desktop_kernel_running(&paths, &AppConfig::default())
            .expect("initial ensure");

        let info = services
            .restart_desktop_kernel(&paths, &AppConfig::default())
            .expect("restart desktop kernel");

        assert_eq!(info.host.ownership, "nativeService");
        assert_eq!(
            backend.events(),
            vec![
                "install".to_string(),
                "start".to_string(),
                "install".to_string(),
                "stop".to_string(),
                "start".to_string(),
            ]
        );
    }

    #[cfg(windows)]
    #[test]
    fn restart_desktop_kernel_restarts_supervisor_gateway_when_native_service_is_not_running() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let runtime = fake_supervisor_runtime(&paths, reserve_loopback_port());
        let backend = Arc::new(FakeKernelHostPlatformOps::new(
            paths.clone(),
            runtime.gateway_port,
        ));
        let services = FrameworkServices::with_kernel_host_manager(
            &paths,
            &AppConfig::default(),
            KernelHostServiceManager::with_backend(backend.clone()),
        )
        .expect("services");

        services
            .supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");
        services
            .ensure_desktop_kernel_running(&paths, &AppConfig::default())
            .expect("initial ensure");

        let info = services
            .restart_desktop_kernel(&paths, &AppConfig::default())
            .expect("restart desktop kernel");

        assert_eq!(info.host.ownership, "appSupervisor");
        assert_eq!(backend.events(), Vec::<String>::new());

        let supervisor = services.supervisor.kernel_info().expect("supervisor info");
        let gateway = supervisor
            .services
            .into_iter()
            .find(|service| service.id == supervisor::SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("gateway service");
        assert_eq!(gateway.lifecycle, "running");

        services.supervisor.begin_shutdown().expect("shutdown");
    }

    #[cfg(windows)]
    fn resolve_test_node_executable() -> PathBuf {
        super::test_support::resolve_test_node_executable("desktop kernel service tests")
    }

    #[cfg(not(windows))]
    fn resolve_test_node_executable() -> PathBuf {
        super::test_support::resolve_test_node_executable("desktop kernel service tests")
    }

    fn reserve_loopback_port() -> u16 {
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("listener");
        let port = listener.local_addr().expect("listener addr").port();
        drop(listener);
        port
    }

    #[derive(Debug)]
    struct FakeKernelHostPlatformOps {
        paths: crate::framework::paths::AppPaths,
        gateway_port: u16,
        events: Mutex<Vec<String>>,
        listener: Mutex<Option<TcpListener>>,
    }

    impl FakeKernelHostPlatformOps {
        fn new(paths: crate::framework::paths::AppPaths, gateway_port: u16) -> Self {
            Self {
                paths,
                gateway_port,
                events: Mutex::new(Vec::new()),
                listener: Mutex::new(None),
            }
        }

        fn events(&self) -> Vec<String> {
            self.events.lock().expect("events").clone()
        }
    }

    impl KernelHostServicePlatformOps for FakeKernelHostPlatformOps {
        fn install_or_update(
            &self,
            _spec: &KernelPlatformServiceSpec,
        ) -> crate::framework::Result<()> {
            self.events
                .lock()
                .expect("events")
                .push("install".to_string());
            Ok(())
        }

        fn start(&self, spec: &KernelPlatformServiceSpec) -> crate::framework::Result<()> {
            self.events
                .lock()
                .expect("events")
                .push("start".to_string());
            let listener =
                TcpListener::bind(("127.0.0.1", self.gateway_port)).expect("gateway listener");
            *self.listener.lock().expect("listener") = Some(listener);
            write_kernel_host_ownership_marker(
                &self.paths,
                &KernelHostOwnershipMarker {
                    service_name: spec.service_name.clone(),
                    active_port: self.gateway_port,
                    started_at_ms: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                    host_pid: Some(64),
                },
            )?;
            Ok(())
        }

        fn stop(&self, _spec: &KernelPlatformServiceSpec) -> crate::framework::Result<()> {
            self.events.lock().expect("events").push("stop".to_string());
            self.listener.lock().expect("listener").take();
            let _ = crate::framework::kernel_host::clear_kernel_host_ownership_marker(&self.paths);
            Ok(())
        }
    }
}
