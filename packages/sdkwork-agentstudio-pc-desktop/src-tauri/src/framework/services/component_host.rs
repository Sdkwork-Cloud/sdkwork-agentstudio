use crate::framework::{
    components::{
        PackagedComponentDefinition, PackagedComponentKind, PackagedComponentStartupMode,
    },
    kernel::{
        DesktopComponentCapabilityInfo, DesktopComponentCatalogInfo, DesktopComponentControlResult,
        DesktopComponentDocumentationRef, DesktopComponentEndpointInfo, DesktopComponentInfo,
        DesktopComponentServiceBindingInfo,
    },
    layout::ComponentsState,
    paths::AppPaths,
    FrameworkError, Result,
};
use serde::de::DeserializeOwned;
use std::{collections::HashMap, fs, path::Path};

use super::{
    components::ComponentRegistryService,
    supervisor::{ManagedServiceLifecycle, SupervisorService},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ComponentControlAction {
    Start,
    Stop,
    Restart,
}

impl ComponentControlAction {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Start => "start",
            Self::Stop => "stop",
            Self::Restart => "restart",
        }
    }

    pub fn parse(value: &str) -> Result<Self> {
        match value {
            "start" => Ok(Self::Start),
            "stop" => Ok(Self::Stop),
            "restart" => Ok(Self::Restart),
            _ => Err(FrameworkError::ValidationFailed(format!(
                "unsupported component control action: {value}"
            ))),
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct ComponentHostService;

impl ComponentHostService {
    pub fn new() -> Self {
        Self
    }

    pub fn component_catalog(
        &self,
        paths: &AppPaths,
        supervisor: &SupervisorService,
    ) -> Result<DesktopComponentCatalogInfo> {
        let resources = ComponentRegistryService::new().load_resources(paths)?;
        let components_state = read_json_file::<ComponentsState>(&paths.components_file)?;
        let supervisor_snapshot = supervisor.snapshot()?;
        let service_map = supervisor_snapshot
            .services
            .into_iter()
            .map(|service| (service.id.clone(), service))
            .collect::<HashMap<_, _>>();

        let components = resources
            .registry
            .components
            .into_iter()
            .map(|definition| {
                let component_state = components_state.entries.get(&definition.id);
                let resolved_service_ids = resolved_component_service_ids(&definition);
                let services = resolved_service_ids
                    .iter()
                    .filter_map(|service_id| service_map.get(service_id))
                    .map(|service| DesktopComponentServiceBindingInfo {
                        service_id: service.id.clone(),
                        lifecycle: managed_service_lifecycle_label(&service.lifecycle).to_string(),
                        pid: service.pid,
                        last_error: service.last_error.clone(),
                    })
                    .collect::<Vec<_>>();

                Ok(DesktopComponentInfo {
                    id: definition.id.clone(),
                    display_name: definition.display_name.clone(),
                    kind: component_kind_label(&definition.kind).to_string(),
                    startup_mode: startup_mode_label(&definition.startup_mode).to_string(),
                    bundled_version: component_state
                        .map(|entry| entry.bundled_version.clone())
                        .unwrap_or_else(|| definition.bundled_version.clone()),
                    active_version: component_state.and_then(|entry| entry.active_version.clone()),
                    fallback_version: component_state
                        .and_then(|entry| entry.fallback_version.clone()),
                    repository_url: component_source_url(&definition),
                    source_commit: definition.commit.clone(),
                    install_subdir: definition.install_subdir.clone(),
                    runtime_status: component_runtime_status(&definition, &services),
                    service_ids: resolved_service_ids.clone(),
                    services,
                    endpoints: component_endpoints(&definition),
                    capabilities: component_capabilities(&definition),
                    docs: component_docs(&definition),
                })
            })
            .collect::<Result<Vec<_>>>()?;

        Ok(DesktopComponentCatalogInfo {
            default_startup_component_ids: resources.service_defaults.auto_start_component_ids,
            components,
        })
    }

    pub fn control_component(
        &self,
        paths: &AppPaths,
        supervisor: &SupervisorService,
        component_id: &str,
        action: ComponentControlAction,
    ) -> Result<DesktopComponentControlResult> {
        let resources = ComponentRegistryService::new().load_resources(paths)?;
        let definition = resources
            .registry
            .components
            .into_iter()
            .find(|component| component.id == component_id)
            .ok_or_else(|| {
                FrameworkError::NotFound(format!("component not found: {component_id}"))
            })?;

        if definition.startup_mode == PackagedComponentStartupMode::Embedded {
            return Ok(DesktopComponentControlResult {
                component_id: component_id.to_string(),
                action: action.as_str().to_string(),
                outcome: "embedded".to_string(),
                affected_service_ids: Vec::new(),
            });
        }

        let resolved_service_ids = resolved_component_service_ids(&definition);
        let service_map = supervisor
            .snapshot()?
            .services
            .into_iter()
            .map(|service| (service.id.clone(), service))
            .collect::<HashMap<_, _>>();

        let mut changed = false;
        for service_id in &resolved_service_ids {
            let lifecycle = service_map
                .get(service_id)
                .map(|service| service.lifecycle.clone());

            match action {
                ComponentControlAction::Start => {
                    if !matches!(lifecycle, Some(ManagedServiceLifecycle::Running)) {
                        supervisor.request_restart(service_id)?;
                        changed = true;
                    }
                }
                ComponentControlAction::Stop => {
                    if !matches!(lifecycle, Some(ManagedServiceLifecycle::Stopped)) {
                        supervisor.stop_service(service_id)?;
                        changed = true;
                    }
                }
                ComponentControlAction::Restart => {
                    supervisor.request_restart(service_id)?;
                    changed = true;
                }
            }
        }

        Ok(DesktopComponentControlResult {
            component_id: component_id.to_string(),
            action: action.as_str().to_string(),
            outcome: if definition.service_ids.is_empty() {
                "noop".to_string()
            } else if changed {
                match action {
                    ComponentControlAction::Start => "started".to_string(),
                    ComponentControlAction::Stop => "stopped".to_string(),
                    ComponentControlAction::Restart => "restarted".to_string(),
                }
            } else {
                "noop".to_string()
            },
            affected_service_ids: resolved_service_ids,
        })
    }
}

fn read_json_file<T>(path: &Path) -> Result<T>
where
    T: DeserializeOwned,
{
    let content = fs::read_to_string(path).map_err(|error| {
        FrameworkError::Io(std::io::Error::new(
            error.kind(),
            format!("failed to read {}: {error}", path.display()),
        ))
    })?;
    Ok(serde_json::from_str::<T>(&content)?)
}

fn managed_service_lifecycle_label(lifecycle: &ManagedServiceLifecycle) -> &'static str {
    match lifecycle {
        ManagedServiceLifecycle::Starting => "starting",
        ManagedServiceLifecycle::Running => "running",
        ManagedServiceLifecycle::Stopping => "stopping",
        ManagedServiceLifecycle::Stopped => "stopped",
        ManagedServiceLifecycle::Failed => "failed",
    }
}

fn component_kind_label(kind: &PackagedComponentKind) -> &'static str {
    match kind {
        PackagedComponentKind::Binary => "binary",
        PackagedComponentKind::NodeApp => "nodeApp",
        PackagedComponentKind::ServiceGroup => "serviceGroup",
        PackagedComponentKind::EmbeddedLibrary => "embeddedLibrary",
    }
}

fn startup_mode_label(mode: &PackagedComponentStartupMode) -> &'static str {
    match mode {
        PackagedComponentStartupMode::AutoStart => "autoStart",
        PackagedComponentStartupMode::Manual => "manual",
        PackagedComponentStartupMode::Embedded => "embedded",
    }
}

fn resolved_component_service_ids(definition: &PackagedComponentDefinition) -> Vec<String> {
    definition.service_ids.clone()
}

fn component_runtime_status(
    definition: &PackagedComponentDefinition,
    services: &[DesktopComponentServiceBindingInfo],
) -> String {
    if definition.startup_mode == PackagedComponentStartupMode::Embedded {
        return "embedded".to_string();
    }

    generic_component_runtime_status(services)
}

fn generic_component_runtime_status(services: &[DesktopComponentServiceBindingInfo]) -> String {
    if services.is_empty() {
        return "stopped".to_string();
    }

    let running = services
        .iter()
        .filter(|service| service.lifecycle == "running")
        .count();
    let failed = services
        .iter()
        .filter(|service| service.lifecycle == "failed")
        .count();
    let transition = services
        .iter()
        .filter(|service| matches!(service.lifecycle.as_str(), "starting" | "stopping"))
        .count();

    if failed > 0 && running == 0 {
        return "failed".to_string();
    }
    if transition > 0 {
        return "transitioning".to_string();
    }
    if running == services.len() {
        return "running".to_string();
    }
    if running == 0 {
        return "stopped".to_string();
    }
    if failed > 0 {
        return "degraded".to_string();
    }

    "partial".to_string()
}

fn component_source_url(definition: &PackagedComponentDefinition) -> Option<String> {
    definition.source_url.clone()
}

fn component_docs(
    _definition: &PackagedComponentDefinition,
) -> Vec<DesktopComponentDocumentationRef> {
    Vec::new()
}

fn component_endpoints(
    _definition: &PackagedComponentDefinition,
) -> Vec<DesktopComponentEndpointInfo> {
    Vec::new()
}

fn component_capabilities(
    _definition: &PackagedComponentDefinition,
) -> Vec<DesktopComponentCapabilityInfo> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::{ComponentControlAction, ComponentHostService};
    use crate::framework::paths::resolve_paths_for_root;
    use crate::framework::services::supervisor::SupervisorService;

    #[test]
    fn component_host_catalog_uses_empty_defaults_until_support_components_are_registered() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = SupervisorService::new();

        let catalog = ComponentHostService::new()
            .component_catalog(&paths, &supervisor)
            .expect("component catalog");

        assert!(catalog.default_startup_component_ids.is_empty());
        assert!(catalog.components.is_empty());
    }

    #[test]
    fn component_host_control_rejects_unknown_components_when_no_support_components_are_registered()
    {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let supervisor = SupervisorService::new();
        let service = ComponentHostService::new();

        let error = service
            .control_component(
                &paths,
                &supervisor,
                "missing-component",
                ComponentControlAction::Start,
            )
            .expect_err("unknown component should be rejected");

        assert!(error.to_string().contains("component not found"));
    }
}
