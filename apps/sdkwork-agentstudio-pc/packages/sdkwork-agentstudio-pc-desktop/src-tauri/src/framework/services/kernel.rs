use crate::framework::{
    kernel::{
        DesktopActiveKernelRuntimeInfo, DesktopBundledComponentsInfo, DesktopCapabilityInfo,
        DesktopCapabilityStatus, DesktopFileSystemInfo, DesktopIntegrationInfo,
        DesktopKernelDirectories, DesktopKernelInfo, DesktopKernelRuntimeAuthorityInfo,
        DesktopLocalAiProxyInfo, DesktopNotificationInfo, DesktopOpenClawRuntimeInfo,
        DesktopPaymentInfo, DesktopPermissionsInfo, DesktopProcessInfo, DesktopSecurityInfo,
        DesktopStartupEvidenceInfo, DesktopSupervisorInfo,
    },
    kernel_host::types::DesktopKernelHostInfo,
    paths::AppPaths,
    storage::StorageInfo,
};
use std::fs;

#[derive(Clone, Debug, Default)]
pub struct KernelService;

const DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH: &str = "diagnostics/desktop-startup-evidence.json";

pub struct KernelDomainSnapshots {
    pub filesystem: DesktopFileSystemInfo,
    pub security: DesktopSecurityInfo,
    pub process: DesktopProcessInfo,
    pub permissions: DesktopPermissionsInfo,
    pub notifications: DesktopNotificationInfo,
    pub payments: DesktopPaymentInfo,
    pub integrations: DesktopIntegrationInfo,
    pub supervisor: DesktopSupervisorInfo,
    pub open_claw_runtime: DesktopOpenClawRuntimeInfo,
    pub runtime_authorities: Vec<DesktopKernelRuntimeAuthorityInfo>,
    pub local_ai_proxy: DesktopLocalAiProxyInfo,
    pub desktop_startup_evidence: Option<DesktopStartupEvidenceInfo>,
    pub bundled_components: DesktopBundledComponentsInfo,
    pub storage: StorageInfo,
    pub host: DesktopKernelHostInfo,
}

impl KernelService {
    pub fn new() -> Self {
        Self
    }

    pub fn desktop_startup_evidence(&self, paths: &AppPaths) -> Option<DesktopStartupEvidenceInfo> {
        let evidence_path = paths.data_dir.join(DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH);
        if !evidence_path.exists() {
            return None;
        }

        let evidence_path_string = evidence_path.to_string_lossy().into_owned();
        let raw_document = match fs::read_to_string(&evidence_path) {
            Ok(document) => document,
            Err(error) => {
                return Some(DesktopStartupEvidenceInfo {
                    status: None,
                    phase: None,
                    run_id: None,
                    recorded_at: None,
                    duration_ms: None,
                    evidence_path: evidence_path_string,
                    descriptor_mode: None,
                    descriptor_lifecycle: None,
                    descriptor_endpoint_id: None,
                    descriptor_requested_port: None,
                    descriptor_active_port: None,
                    descriptor_loopback_only: None,
                    descriptor_dynamic_port: None,
                    descriptor_state_store_driver: None,
                    descriptor_state_store_profile_id: None,
                    descriptor_browser_base_url: None,
                    manage_base_url: None,
                    built_in_instance_id: None,
                    built_in_instance_name: None,
                    built_in_instance_version: None,
                    built_in_instance_runtime_kind: None,
                    built_in_instance_deployment_mode: None,
                    built_in_instance_transport_kind: None,
                    built_in_instance_base_url: None,
                    built_in_instance_websocket_url: None,
                    built_in_instance_is_built_in: None,
                    built_in_instance_is_default: None,
                    built_in_instance_status: None,
                    open_claw_runtime_lifecycle: None,
                    open_claw_gateway_lifecycle: None,
                    ready: None,
                    error_message: Some(format!(
                        "Unable to read desktop startup evidence: {error}"
                    )),
                    error_cause: None,
                })
            }
        };

        let document: DesktopStartupEvidenceDocument = match serde_json::from_str(&raw_document) {
            Ok(document) => document,
            Err(error) => {
                return Some(DesktopStartupEvidenceInfo {
                    status: None,
                    phase: None,
                    run_id: None,
                    recorded_at: None,
                    duration_ms: None,
                    evidence_path: evidence_path_string,
                    descriptor_mode: None,
                    descriptor_lifecycle: None,
                    descriptor_endpoint_id: None,
                    descriptor_requested_port: None,
                    descriptor_active_port: None,
                    descriptor_loopback_only: None,
                    descriptor_dynamic_port: None,
                    descriptor_state_store_driver: None,
                    descriptor_state_store_profile_id: None,
                    descriptor_browser_base_url: None,
                    manage_base_url: None,
                    built_in_instance_id: None,
                    built_in_instance_name: None,
                    built_in_instance_version: None,
                    built_in_instance_runtime_kind: None,
                    built_in_instance_deployment_mode: None,
                    built_in_instance_transport_kind: None,
                    built_in_instance_base_url: None,
                    built_in_instance_websocket_url: None,
                    built_in_instance_is_built_in: None,
                    built_in_instance_is_default: None,
                    built_in_instance_status: None,
                    open_claw_runtime_lifecycle: None,
                    open_claw_gateway_lifecycle: None,
                    ready: None,
                    error_message: Some(format!(
                        "Unable to parse desktop startup evidence: {error}"
                    )),
                    error_cause: None,
                })
            }
        };

        Some(DesktopStartupEvidenceInfo {
            status: normalize_optional_string(document.status),
            phase: normalize_optional_string(document.phase),
            run_id: document.run_id,
            recorded_at: normalize_optional_string(document.recorded_at),
            duration_ms: document.duration_ms,
            evidence_path: evidence_path_string,
            descriptor_mode: document
                .descriptor
                .as_ref()
                .and_then(|descriptor| normalize_optional_string(descriptor.mode.clone())),
            descriptor_lifecycle: document
                .descriptor
                .as_ref()
                .and_then(|descriptor| normalize_optional_string(descriptor.lifecycle.clone())),
            descriptor_endpoint_id: document
                .descriptor
                .as_ref()
                .and_then(|descriptor| normalize_optional_string(descriptor.endpoint_id.clone())),
            descriptor_requested_port: document
                .descriptor
                .as_ref()
                .and_then(|descriptor| descriptor.requested_port),
            descriptor_active_port: document
                .descriptor
                .as_ref()
                .and_then(|descriptor| descriptor.active_port),
            descriptor_loopback_only: document
                .descriptor
                .as_ref()
                .and_then(|descriptor| descriptor.loopback_only),
            descriptor_dynamic_port: document
                .descriptor
                .as_ref()
                .and_then(|descriptor| descriptor.dynamic_port),
            descriptor_state_store_driver: document.descriptor.as_ref().and_then(|descriptor| {
                normalize_optional_string(descriptor.state_store_driver.clone())
            }),
            descriptor_state_store_profile_id: document.descriptor.as_ref().and_then(
                |descriptor| normalize_optional_string(descriptor.state_store_profile_id.clone()),
            ),
            descriptor_browser_base_url: document
                .descriptor
                .and_then(|descriptor| normalize_optional_string(descriptor.browser_base_url)),
            manage_base_url: document
                .readiness_evidence
                .as_ref()
                .and_then(|evidence| normalize_optional_string(evidence.manage_base_url.clone())),
            built_in_instance_id: document
                .built_in_instance
                .as_ref()
                .and_then(|instance| normalize_optional_string(instance.id.clone())),
            built_in_instance_name: document
                .built_in_instance
                .as_ref()
                .and_then(|instance| normalize_optional_string(instance.name.clone())),
            built_in_instance_version: document
                .built_in_instance
                .as_ref()
                .and_then(|instance| normalize_optional_string(instance.version.clone())),
            built_in_instance_runtime_kind: document
                .built_in_instance
                .as_ref()
                .and_then(|instance| normalize_optional_string(instance.runtime_kind.clone())),
            built_in_instance_deployment_mode: document
                .built_in_instance
                .as_ref()
                .and_then(|instance| normalize_optional_string(instance.deployment_mode.clone())),
            built_in_instance_transport_kind: document
                .built_in_instance
                .as_ref()
                .and_then(|instance| normalize_optional_string(instance.transport_kind.clone())),
            built_in_instance_base_url: document
                .built_in_instance
                .as_ref()
                .and_then(|instance| normalize_optional_string(instance.base_url.clone())),
            built_in_instance_websocket_url: document
                .built_in_instance
                .as_ref()
                .and_then(|instance| normalize_optional_string(instance.websocket_url.clone())),
            built_in_instance_is_built_in: document
                .built_in_instance
                .as_ref()
                .and_then(|instance| instance.is_built_in),
            built_in_instance_is_default: document
                .built_in_instance
                .as_ref()
                .and_then(|instance| instance.is_default),
            built_in_instance_status: document
                .built_in_instance
                .and_then(|instance| normalize_optional_string(instance.status)),
            open_claw_runtime_lifecycle: document.readiness_evidence.as_ref().and_then(
                |evidence| normalize_optional_string(evidence.open_claw_runtime_lifecycle.clone()),
            ),
            open_claw_gateway_lifecycle: document.readiness_evidence.as_ref().and_then(
                |evidence| normalize_optional_string(evidence.open_claw_gateway_lifecycle.clone()),
            ),
            ready: document
                .readiness_evidence
                .and_then(|evidence| evidence.ready),
            error_message: document
                .error
                .as_ref()
                .and_then(|error| normalize_optional_string(error.message.clone())),
            error_cause: document
                .error
                .and_then(|error| normalize_optional_string(error.cause)),
        })
    }

    pub fn kernel_info(
        &self,
        paths: &AppPaths,
        domains: KernelDomainSnapshots,
    ) -> DesktopKernelInfo {
        let active_runtime = resolve_active_runtime(
            &domains.host,
            &domains.runtime_authorities,
            &domains.open_claw_runtime,
        );
        let capabilities = vec![
            DesktopCapabilityInfo {
                key: "filesystem".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} managed runtime roots are governed by the filesystem kernel.",
                    domains.filesystem.managed_roots.len()
                ),
            },
            DesktopCapabilityInfo {
                key: "security".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} allowlisted process commands are enforced by policy.",
                    domains.security.allowed_spawn_commands.len()
                ),
            },
            DesktopCapabilityInfo {
                key: "process".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} process profiles are registered, {} process jobs are active, and the max concurrent job budget is {}.",
                    domains.process.available_profiles.len(),
                    domains.process.active_process_job_count,
                    domains.process.max_concurrent_jobs
                ),
            },
            DesktopCapabilityInfo {
                key: "jobs".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} active jobs are currently tracked by the desktop kernel.",
                    domains.process.active_job_count
                ),
            },
            DesktopCapabilityInfo {
                key: "storage".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} storage provider kinds are registered for the desktop kernel.",
                    domains.storage.providers.len()
                ),
            },
            DesktopCapabilityInfo {
                key: "notifications".to_string(),
                status: domains.notifications.status.clone(),
                detail: format!(
                    "Notification domain exposes {} providers with active provider \"{}\" and user consent policy {}.",
                    domains.notifications.available_providers.len(),
                    domains.notifications.provider,
                    if domains.notifications.require_user_consent {
                        "enabled"
                    } else {
                        "disabled"
                    }
                ),
            },
            DesktopCapabilityInfo {
                key: "permissions".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} permission policy entries are standardized across granted, managed, and planned desktop access surfaces.",
                    domains.permissions.entries.len()
                ),
            },
            DesktopCapabilityInfo {
                key: "integrations".to_string(),
                status: domains.integrations.status.clone(),
                detail: format!(
                    "Integration domain exposes {} adapters across plugins at {} and bridges at {}.",
                    domains.integrations.available_adapters.len(),
                    domains.integrations.plugins_dir,
                    domains.integrations.integrations_dir
                ),
            },
            DesktopCapabilityInfo {
                key: "payments".to_string(),
                status: domains.payments.status.clone(),
                detail: format!(
                    "Payment domain exposes {} providers with active provider \"{}\" in {} mode.",
                    domains.payments.available_providers.len(),
                    domains.payments.provider,
                    if domains.payments.sandbox {
                        "sandbox"
                    } else {
                        "live"
                    }
                ),
            },
            DesktopCapabilityInfo {
                key: "supervisor".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "Supervisor tracks {} managed background services with lifecycle \"{}\".",
                    domains.supervisor.service_count, domains.supervisor.lifecycle
                ),
            },
            DesktopCapabilityInfo {
                key: "openclaw-runtime".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "Built-in OpenClaw runtime lifecycle is \"{}\" with {} startup stages tracked.",
                    domains.open_claw_runtime.lifecycle,
                    domains.open_claw_runtime.startup_chain.len()
                ),
            },
            DesktopCapabilityInfo {
                key: "local-ai-proxy".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "Local AI proxy lifecycle is \"{}\" with {} projected models and base URL {}.",
                    domains.local_ai_proxy.lifecycle,
                    domains.local_ai_proxy.model_count,
                    domains
                        .local_ai_proxy
                        .base_url
                        .clone()
                        .unwrap_or_else(|| "unavailable".to_string())
                ),
            },
            DesktopCapabilityInfo {
                key: "bundled-components".to_string(),
                status: DesktopCapabilityStatus::Ready,
                detail: format!(
                    "{} bundled components are registered with {} default startup components.",
                    domains.bundled_components.component_count,
                    domains.bundled_components.default_startup_component_ids.len()
                ),
            },
        ];

        DesktopKernelInfo {
            directories: DesktopKernelDirectories {
                install_root: paths.install_root.to_string_lossy().into_owned(),
                modules_dir: paths.modules_dir.to_string_lossy().into_owned(),
                runtimes_dir: paths.runtimes_dir.to_string_lossy().into_owned(),
                machine_root: paths.machine_root.to_string_lossy().into_owned(),
                machine_state_dir: paths.machine_state_dir.to_string_lossy().into_owned(),
                machine_store_dir: paths.machine_store_dir.to_string_lossy().into_owned(),
                machine_staging_dir: paths.machine_staging_dir.to_string_lossy().into_owned(),
                user_root: paths.user_root.to_string_lossy().into_owned(),
                studio_dir: paths.studio_dir.to_string_lossy().into_owned(),
                storage_dir: paths.storage_dir.to_string_lossy().into_owned(),
                plugins_dir: paths.plugins_dir.to_string_lossy().into_owned(),
                integrations_dir: paths.integrations_dir.to_string_lossy().into_owned(),
                backups_dir: paths.backups_dir.to_string_lossy().into_owned(),
            },
            capabilities,
            filesystem: domains.filesystem,
            security: domains.security,
            process: domains.process,
            permissions: domains.permissions,
            notifications: domains.notifications,
            payments: domains.payments,
            integrations: domains.integrations,
            supervisor: domains.supervisor,
            active_runtime,
            open_claw_runtime: domains.open_claw_runtime,
            runtime_authorities: domains.runtime_authorities,
            local_ai_proxy: domains.local_ai_proxy,
            desktop_startup_evidence: domains.desktop_startup_evidence,
            bundled_components: domains.bundled_components,
            storage: domains.storage,
            host: domains.host,
        }
    }
}

fn resolve_active_runtime(
    host: &DesktopKernelHostInfo,
    runtime_authorities: &[DesktopKernelRuntimeAuthorityInfo],
    open_claw_runtime: &DesktopOpenClawRuntimeInfo,
) -> DesktopActiveKernelRuntimeInfo {
    let runtime_id = host.provenance.runtime_id.clone();
    let authority = runtime_authorities
        .iter()
        .find(|authority| authority.runtime_id == runtime_id)
        .cloned();
    let is_openclaw_runtime = runtime_id == open_claw_runtime.runtime_id;

    DesktopActiveKernelRuntimeInfo {
        runtime_id,
        state: host.runtime.state.clone(),
        health: host.runtime.health.clone(),
        reason: host.runtime.reason.clone(),
        install_key: host.provenance.install_key.clone(),
        install_source: authority
            .as_ref()
            .and_then(|authority| authority.install_source.clone())
            .unwrap_or_else(|| host.provenance.install_source.clone()),
        runtime_version: authority
            .as_ref()
            .and_then(|authority| authority.runtime_version.clone())
            .or_else(|| {
                if is_openclaw_runtime {
                    open_claw_runtime.openclaw_version.clone()
                } else {
                    host.provenance.runtime_version.clone()
                }
            }),
        node_version: authority
            .as_ref()
            .and_then(|authority| authority.node_version.clone())
            .or_else(|| {
                if is_openclaw_runtime {
                    open_claw_runtime.node_version.clone()
                } else {
                    host.provenance.node_version.clone()
                }
            }),
        platform: authority
            .as_ref()
            .and_then(|authority| authority.platform.clone())
            .unwrap_or_else(|| {
                if is_openclaw_runtime {
                    open_claw_runtime.platform.clone()
                } else {
                    host.provenance.platform.clone()
                }
            }),
        arch: authority
            .as_ref()
            .and_then(|authority| authority.arch.clone())
            .unwrap_or_else(|| {
                if is_openclaw_runtime {
                    open_claw_runtime.arch.clone()
                } else {
                    host.provenance.arch.clone()
                }
            }),
        config_file: authority
            .as_ref()
            .map(|authority| authority.config_file.clone())
            .unwrap_or_else(|| {
                if is_openclaw_runtime {
                    open_claw_runtime.config_file.clone()
                } else {
                    host.provenance.config_file.clone()
                }
            }),
        runtime_home_dir: authority
            .as_ref()
            .and_then(|authority| authority.runtime_home_dir.clone())
            .unwrap_or_else(|| {
                if is_openclaw_runtime {
                    open_claw_runtime.home_dir.clone()
                } else {
                    host.provenance.runtime_home_dir.clone()
                }
            }),
        runtime_install_dir: authority
            .as_ref()
            .and_then(|authority| authority.runtime_install_dir.clone())
            .or_else(|| {
                if is_openclaw_runtime {
                    open_claw_runtime.install_dir.clone()
                } else {
                    host.provenance.runtime_install_dir.clone()
                }
            }),
        authority,
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStartupEvidenceDocument {
    status: Option<String>,
    phase: Option<String>,
    run_id: Option<u64>,
    recorded_at: Option<String>,
    duration_ms: Option<u64>,
    descriptor: Option<DesktopStartupEvidenceDescriptor>,
    readiness_evidence: Option<DesktopStartupEvidenceReadiness>,
    built_in_instance: Option<DesktopStartupEvidenceBuiltInInstance>,
    error: Option<DesktopStartupEvidenceError>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStartupEvidenceDescriptor {
    mode: Option<String>,
    lifecycle: Option<String>,
    endpoint_id: Option<String>,
    requested_port: Option<u16>,
    active_port: Option<u16>,
    loopback_only: Option<bool>,
    dynamic_port: Option<bool>,
    state_store_driver: Option<String>,
    state_store_profile_id: Option<String>,
    browser_base_url: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStartupEvidenceReadiness {
    manage_base_url: Option<String>,
    open_claw_runtime_lifecycle: Option<String>,
    open_claw_gateway_lifecycle: Option<String>,
    ready: Option<bool>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStartupEvidenceBuiltInInstance {
    id: Option<String>,
    name: Option<String>,
    version: Option<String>,
    runtime_kind: Option<String>,
    deployment_mode: Option<String>,
    transport_kind: Option<String>,
    base_url: Option<String>,
    websocket_url: Option<String>,
    is_built_in: Option<bool>,
    is_default: Option<bool>,
    status: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStartupEvidenceError {
    message: Option<String>,
    cause: Option<String>,
}
