use crate::{
    framework::{
        kernel::{DesktopComponentCatalogInfo, DesktopComponentControlResult},
        runtime,
        services::component_host::ComponentControlAction,
        Result as FrameworkResult,
    },
    state::AppState,
};

pub fn desktop_component_catalog_from_state(
    state: &AppState,
) -> FrameworkResult<DesktopComponentCatalogInfo> {
    state
        .context
        .services
        .component_host
        .component_catalog(&state.paths, &state.context.services.supervisor)
}

pub fn desktop_component_control_from_state(
    state: &AppState,
    component_id: &str,
    action: &str,
) -> FrameworkResult<DesktopComponentControlResult> {
    let parsed_action = ComponentControlAction::parse(action)?;
    state.context.services.component_host.control_component(
        &state.paths,
        &state.context.services.supervisor,
        component_id,
        parsed_action,
    )
}

#[tauri::command]
pub async fn desktop_component_catalog(
    state: tauri::State<'_, AppState>,
) -> Result<DesktopComponentCatalogInfo, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.component_catalog", move || {
        desktop_component_catalog_from_state(&state)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn desktop_component_control(
    component_id: String,
    action: String,
    state: tauri::State<'_, AppState>,
) -> Result<DesktopComponentControlResult, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("desktop.component_control", move || {
        desktop_component_control_from_state(&state, component_id.as_str(), action.as_str())
    })
    .await
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{desktop_component_catalog_from_state, desktop_component_control_from_state};
    use crate::{
        framework::{
            config::AppConfig, context::FrameworkContext, logging::init_logger,
            paths::resolve_paths_for_root,
        },
        state::AppState,
    };
    use std::sync::Arc;

    #[test]
    fn desktop_component_catalog_is_empty_until_support_components_are_registered() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let catalog = desktop_component_catalog_from_state(&state).expect("component catalog");
        assert!(catalog.default_startup_component_ids.is_empty());
        assert!(catalog.components.is_empty());
    }

    #[test]
    fn desktop_component_control_rejects_unknown_components() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        let error = desktop_component_control_from_state(&state, "missing-component", "start")
            .expect_err("unknown component should be rejected");

        assert!(error.to_string().contains("component not found"));
    }
}
