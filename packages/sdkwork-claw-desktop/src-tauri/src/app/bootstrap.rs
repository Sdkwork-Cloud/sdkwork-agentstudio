use crate::{
    commands,
    framework::{
        config::{
            normalize_app_language_preference, APP_LANGUAGE_PREFERENCE_ENGLISH,
            APP_LANGUAGE_PREFERENCE_SIMPLIFIED_CHINESE, APP_LANGUAGE_PREFERENCE_SYSTEM,
            APP_LANGUAGE_PREFERENCE_TRADITIONAL_CHINESE,
        },
        context::{BuiltInOpenClawStatusChangedPayload, FrameworkContext},
        events,
        services::local_ai_proxy::SERVICE_ID_LOCAL_AI_PROXY,
        services::openclaw_runtime::{resolve_bundled_resource_root, ActivatedOpenClawRuntime},
        services::studio::StudioInstanceStatus,
        services::supervisor::SERVICE_ID_OPENCLAW_GATEWAY,
        FrameworkError, Result as FrameworkResult,
    },
    plugins,
    state::{AppMetadata, AppState},
};
use std::{sync::Arc, thread};
use tauri::{
    menu::{Menu, MenuBuilder, SubmenuBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, Window, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ICON_ID: &str = "main_tray";
const ROUTE_DASHBOARD: &str = "/dashboard";
const ROUTE_INSTANCES: &str = "/instances";
const ROUTE_TASKS: &str = "/tasks";
const ROUTE_SETTINGS: &str = "/settings";

pub(crate) const TRAY_MENU_ID_SHOW_WINDOW: &str = "show_window";
pub(crate) const TRAY_MENU_ID_OPEN_DASHBOARD: &str = "open_dashboard";
pub(crate) const TRAY_MENU_ID_OPEN_INSTANCES: &str = "open_instances";
pub(crate) const TRAY_MENU_ID_OPEN_TASKS: &str = "open_tasks";
pub(crate) const TRAY_MENU_ID_OPEN_SETTINGS: &str = "open_settings";
pub(crate) const TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY: &str = "restart_openclaw_gateway";
pub(crate) const TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES: &str = "restart_background_services";
pub(crate) const TRAY_MENU_ID_OPEN_LOGS_DIRECTORY: &str = "open_logs_directory";
pub(crate) const TRAY_MENU_ID_REVEAL_MAIN_LOG: &str = "reveal_main_log";
pub(crate) const TRAY_MENU_ID_OPEN_INTEGRATIONS_DIRECTORY: &str = "open_integrations_directory";
pub(crate) const TRAY_MENU_ID_OPEN_PLUGINS_DIRECTORY: &str = "open_plugins_directory";
pub(crate) const TRAY_MENU_ID_QUIT_APP: &str = "quit_app";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum TrayAction {
    ShowWindow,
    OpenRoute(&'static str),
    RestartManagedService(&'static str),
    RestartBackgroundServices,
    OpenLogsDirectory,
    RevealMainLog,
    OpenIntegrationsDirectory,
    OpenPluginsDirectory,
    QuitApp,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayNavigatePayload {
    route: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum TrayLanguage {
    En,
    Zh,
}

#[cfg(test)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum TrayMenuEntry {
    Item {
        id: &'static str,
        label: String,
    },
    Separator,
    Submenu {
        label: String,
        items: Vec<TrayMenuEntry>,
    },
}

#[derive(Clone, Copy, Debug)]
struct TrayLabels {
    open_window: &'static str,
    navigate: &'static str,
    dashboard: &'static str,
    instances: &'static str,
    tasks: &'static str,
    settings: &'static str,
    services: &'static str,
    restart_openclaw_gateway: &'static str,
    restart_all_background_services: &'static str,
    diagnostics: &'static str,
    open_logs_directory: &'static str,
    reveal_main_log: &'static str,
    open_integrations_directory: &'static str,
    open_plugins_directory: &'static str,
    quit_app: &'static str,
}

const OPENCLAW_ACTIVATION_STAGE_PREPARE_RUNTIME: &str =
    "bundled openclaw activation stage: prepare-runtime-activation";
const OPENCLAW_ACTIVATION_STAGE_BUNDLED_RUNTIME_READY: &str =
    "bundled openclaw activation stage: bundled-runtime-ready";
const OPENCLAW_ACTIVATION_STAGE_GATEWAY_CONFIGURED: &str =
    "bundled openclaw activation stage: gateway-configured";
const OPENCLAW_ACTIVATION_STAGE_LOCAL_AI_PROXY_READY: &str =
    "bundled openclaw activation stage: local-ai-proxy-ready";
const OPENCLAW_ACTIVATION_STAGE_DESKTOP_KERNEL_RUNNING: &str =
    "bundled openclaw activation stage: desktop-kernel-running";
const OPENCLAW_ACTIVATION_STAGE_BUILT_IN_INSTANCE_ONLINE: &str =
    "bundled openclaw activation stage: built-in-instance-online";

pub fn build() -> tauri::Builder<tauri::Wry> {
    plugins::register(tauri::Builder::default())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let mut context = FrameworkContext::bootstrap(&app_handle)?;
            context.bootstrap_desktop_host()?;
            let context = Arc::new(context);
            context.logger.info("managed desktop state initialized")?;
            let package_info = app.package_info();
            let metadata = AppMetadata::new(
                package_info.name.clone(),
                package_info.version.to_string(),
                crate::platform::current_target().to_string(),
            );

            let state = AppState::from_metadata(metadata, context.clone());
            app.manage(state);
            ensure_tray(&app_handle)?;
            let resource_root = resolve_bundled_openclaw_resource_root(&app_handle);
            sync_built_in_openclaw_status(context.as_ref(), StudioInstanceStatus::Starting);
            app.emit(events::APP_READY, ())?;
            spawn_bundled_openclaw_activation(context.clone(), resource_root);

            Ok(())
        })
        .on_window_event(handle_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::app_info::app_info,
            commands::component_commands::desktop_component_catalog,
            commands::component_commands::desktop_component_control,
            commands::desktop_kernel::desktop_kernel_info,
            commands::desktop_kernel::desktop_kernel_status,
            commands::desktop_kernel::ensure_desktop_kernel_running,
            commands::desktop_kernel::restart_desktop_kernel,
            commands::desktop_kernel::test_local_ai_proxy_route,
            commands::desktop_kernel::list_local_ai_proxy_request_logs,
            commands::desktop_kernel::list_local_ai_proxy_message_logs,
            commands::desktop_kernel::update_local_ai_proxy_message_capture,
            commands::openclaw_mirror::inspect_openclaw_mirror_export,
            commands::openclaw_mirror::export_openclaw_mirror,
            commands::openclaw_mirror::inspect_openclaw_mirror_import,
            commands::openclaw_mirror::import_openclaw_mirror,
            commands::desktop_kernel::desktop_storage_info,
            commands::get_app_paths::get_app_paths,
            commands::get_app_config::get_app_config,
            commands::set_app_language::set_app_language,
            commands::get_system_info::get_system_info,
            commands::get_device_id::get_device_id,
            commands::storage_commands::storage_get_text,
            commands::storage_commands::storage_put_text,
            commands::storage_commands::storage_delete,
            commands::storage_commands::storage_list_keys,
            commands::studio_commands::studio_list_instances,
            commands::studio_commands::studio_get_instance,
            commands::studio_commands::studio_get_instance_detail,
            commands::studio_commands::studio_get_kernel_agent_creation_capability,
            commands::studio_commands::studio_create_kernel_agent,
            commands::studio_commands::studio_list_kernel_chat_agent_profiles,
            commands::studio_commands::studio_list_persisted_kernel_chat_agents,
            commands::studio_commands::studio_replace_persisted_kernel_chat_agents,
            commands::studio_commands::studio_list_kernel_chat_sessions,
            commands::studio_commands::studio_get_kernel_chat_session,
            commands::studio_commands::studio_create_kernel_chat_session,
            commands::studio_commands::studio_list_kernel_chat_runs,
            commands::studio_commands::studio_get_kernel_chat_run,
            commands::studio_commands::studio_patch_kernel_chat_session,
            commands::studio_commands::studio_delete_kernel_chat_session,
            commands::studio_commands::studio_start_kernel_chat_run,
            commands::studio_commands::studio_abort_kernel_chat_run,
            commands::studio_commands::studio_load_kernel_chat_messages,
            commands::studio_commands::studio_invoke_openclaw_gateway,
            commands::studio_commands::studio_create_instance,
            commands::studio_commands::studio_update_instance,
            commands::studio_commands::studio_delete_instance,
            commands::studio_commands::studio_start_instance,
            commands::studio_commands::studio_stop_instance,
            commands::studio_commands::studio_restart_instance,
            commands::studio_commands::studio_get_instance_config,
            commands::studio_commands::studio_update_instance_config,
            commands::studio_commands::studio_get_instance_logs,
            commands::studio_commands::studio_create_instance_task,
            commands::studio_commands::studio_update_instance_task,
            commands::studio_commands::studio_update_instance_file_content,
            commands::studio_commands::studio_update_instance_llm_provider_config,
            commands::studio_commands::studio_clone_instance_task,
            commands::studio_commands::studio_run_instance_task_now,
            commands::studio_commands::studio_list_instance_task_executions,
            commands::studio_commands::studio_update_instance_task_status,
            commands::studio_commands::studio_delete_instance_task,
            commands::studio_commands::studio_list_conversations,
            commands::studio_commands::studio_put_conversation,
            commands::studio_commands::studio_delete_conversation,
            commands::studio_commands::get_desktop_host_runtime,
            commands::studio_commands::get_host_platform_status,
            commands::studio_commands::list_rollouts,
            commands::studio_commands::preview_rollout,
            commands::studio_commands::start_rollout,
            commands::studio_commands::get_host_endpoints,
            commands::studio_commands::get_openclaw_runtime,
            commands::studio_commands::get_openclaw_gateway,
            commands::studio_commands::invoke_managed_openclaw_gateway,
            commands::studio_commands::list_node_sessions,
            commands::job_commands::job_submit,
            commands::job_commands::job_submit_process,
            commands::job_commands::job_get,
            commands::job_commands::job_list,
            commands::job_commands::job_cancel,
            commands::list_directory::list_directory,
            commands::create_directory::create_directory,
            commands::remove_path::remove_path,
            commands::copy_path::copy_path,
            commands::move_path::move_path,
            commands::path_exists::path_exists,
            commands::path_exists_for_user_tooling::path_exists_for_user_tooling,
            commands::get_path_info::get_path_info,
            commands::read_binary_file::read_binary_file,
            commands::write_binary_file::write_binary_file,
            commands::open_external::open_external,
            commands::open_path::open_path,
            commands::process_commands::process_run_capture,
            commands::select_files::select_files,
            commands::save_blob_file::save_blob_file,
            commands::fetch_remote_url::fetch_remote_url,
            commands::capture_screenshot::capture_screenshot,
            commands::read_text_file::read_text_file,
            commands::read_text_file_for_user_tooling::read_text_file_for_user_tooling,
            commands::reveal_path::reveal_path,
            commands::write_text_file::write_text_file,
        ])
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| FrameworkError::NotFound("main window".to_string()))?;

    let _ = window.unminimize();
    window.show()?;
    window.set_focus()?;
    Ok(())
}

pub(crate) fn should_prevent_main_window_close(shutdown_requested: bool) -> bool {
    !shutdown_requested
}

pub(crate) fn tray_action_for_menu_id(id: &str) -> Option<TrayAction> {
    match id {
        TRAY_MENU_ID_SHOW_WINDOW => Some(TrayAction::ShowWindow),
        TRAY_MENU_ID_OPEN_DASHBOARD => Some(TrayAction::OpenRoute(ROUTE_DASHBOARD)),
        TRAY_MENU_ID_OPEN_INSTANCES => Some(TrayAction::OpenRoute(ROUTE_INSTANCES)),
        TRAY_MENU_ID_OPEN_TASKS => Some(TrayAction::OpenRoute(ROUTE_TASKS)),
        TRAY_MENU_ID_OPEN_SETTINGS => Some(TrayAction::OpenRoute(ROUTE_SETTINGS)),
        TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY => Some(TrayAction::RestartManagedService(
            SERVICE_ID_OPENCLAW_GATEWAY,
        )),
        TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES => Some(TrayAction::RestartBackgroundServices),
        TRAY_MENU_ID_OPEN_LOGS_DIRECTORY => Some(TrayAction::OpenLogsDirectory),
        TRAY_MENU_ID_REVEAL_MAIN_LOG => Some(TrayAction::RevealMainLog),
        TRAY_MENU_ID_OPEN_INTEGRATIONS_DIRECTORY => Some(TrayAction::OpenIntegrationsDirectory),
        TRAY_MENU_ID_OPEN_PLUGINS_DIRECTORY => Some(TrayAction::OpenPluginsDirectory),
        TRAY_MENU_ID_QUIT_APP => Some(TrayAction::QuitApp),
        _ => None,
    }
}

pub(crate) fn resolve_tray_language(
    configured_language: &str,
    system_locale: Option<&str>,
) -> TrayLanguage {
    match normalize_app_language_preference(configured_language) {
        APP_LANGUAGE_PREFERENCE_SYSTEM => system_locale_to_tray_language(system_locale),
        APP_LANGUAGE_PREFERENCE_SIMPLIFIED_CHINESE
        | APP_LANGUAGE_PREFERENCE_TRADITIONAL_CHINESE => TrayLanguage::Zh,
        APP_LANGUAGE_PREFERENCE_ENGLISH => TrayLanguage::En,
        _ => TrayLanguage::En,
    }
}

#[cfg(test)]
pub(crate) fn build_tray_menu_spec(language: TrayLanguage) -> Vec<TrayMenuEntry> {
    let labels = tray_labels_for(language);

    vec![
        TrayMenuEntry::Item {
            id: TRAY_MENU_ID_SHOW_WINDOW,
            label: labels.open_window.to_string(),
        },
        TrayMenuEntry::Separator,
        TrayMenuEntry::Submenu {
            label: labels.navigate.to_string(),
            items: vec![
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_DASHBOARD,
                    label: labels.dashboard.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_INSTANCES,
                    label: labels.instances.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_TASKS,
                    label: labels.tasks.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_SETTINGS,
                    label: labels.settings.to_string(),
                },
            ],
        },
        TrayMenuEntry::Submenu {
            label: labels.services.to_string(),
            items: vec![
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY,
                    label: labels.restart_openclaw_gateway.to_string(),
                },
                TrayMenuEntry::Separator,
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES,
                    label: labels.restart_all_background_services.to_string(),
                },
            ],
        },
        TrayMenuEntry::Submenu {
            label: labels.diagnostics.to_string(),
            items: vec![
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_LOGS_DIRECTORY,
                    label: labels.open_logs_directory.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_REVEAL_MAIN_LOG,
                    label: labels.reveal_main_log.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_INTEGRATIONS_DIRECTORY,
                    label: labels.open_integrations_directory.to_string(),
                },
                TrayMenuEntry::Item {
                    id: TRAY_MENU_ID_OPEN_PLUGINS_DIRECTORY,
                    label: labels.open_plugins_directory.to_string(),
                },
            ],
        },
        TrayMenuEntry::Separator,
        TrayMenuEntry::Item {
            id: TRAY_MENU_ID_QUIT_APP,
            label: labels.quit_app.to_string(),
        },
    ]
}

fn create_tray<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let icon = app.default_window_icon().cloned().ok_or_else(|| {
        FrameworkError::Internal("default window icon is not available".to_string())
    })?;
    let menu = build_tray_menu(app, active_tray_language(app))?;

    TrayIconBuilder::with_id(TRAY_ICON_ID)
        .icon(icon)
        .tooltip(app.package_info().name.clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_tray_menu_event(app, event.id().as_ref()))
        .on_tray_icon_event(|tray, event| handle_tray_icon_event(tray.app_handle(), event))
        .build(app)?;

    Ok(())
}

fn ensure_tray<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    if app.tray_by_id(TRAY_ICON_ID).is_some() {
        return Ok(());
    }

    create_tray(app)
}

pub fn refresh_tray_menu<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    ensure_tray(app)?;
    let tray = app
        .tray_by_id(TRAY_ICON_ID)
        .ok_or_else(|| FrameworkError::NotFound("main tray".to_string()))?;
    let menu = build_tray_menu(app, active_tray_language(app))?;
    tray.set_menu(Some(menu))?;
    Ok(())
}

fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if window.label() != MAIN_WINDOW_LABEL {
        return;
    }

    if let WindowEvent::CloseRequested { api, .. } = event {
        let app = window.app_handle();
        let Some(state) = app.try_state::<AppState>() else {
            return;
        };

        if should_prevent_main_window_close(state.shutdown_intent.is_requested()) {
            api.prevent_close();
            if let Err(error) = ensure_tray(&app) {
                log_runtime_error(
                    &app,
                    &format!(
                        "refusing to hide main window because the tray is unavailable: {error}"
                    ),
                );
                return;
            }
            if let Err(error) = window.hide() {
                log_runtime_error(&app, &format!("failed to hide main window: {error}"));
            }
        }
    }
}

fn handle_tray_menu_event<R: Runtime>(app: &AppHandle<R>, menu_id: &str) {
    let Some(action) = tray_action_for_menu_id(menu_id) else {
        return;
    };

    match action {
        TrayAction::ShowWindow => {
            if let Err(error) = show_main_window(app) {
                log_runtime_error(
                    app,
                    &format!("failed to show main window from tray: {error}"),
                );
            }
        }
        TrayAction::OpenRoute(route) => {
            if let Err(error) = open_route_from_tray(app, route) {
                log_runtime_error(app, &format!("failed to open route from tray: {error}"));
            }
        }
        TrayAction::RestartManagedService(service_id) => {
            if let Err(error) = restart_managed_service(app, service_id) {
                log_runtime_error(
                    app,
                    &format!("failed to restart managed service from tray: {error}"),
                );
            }
        }
        TrayAction::RestartBackgroundServices => {
            if let Err(error) = restart_background_services(app) {
                log_runtime_error(
                    app,
                    &format!("failed to restart background services from tray: {error}"),
                );
            }
        }
        TrayAction::OpenLogsDirectory => {
            if let Err(error) = open_logs_directory(app) {
                log_runtime_error(app, &format!("failed to open logs directory: {error}"));
            }
        }
        TrayAction::RevealMainLog => {
            if let Err(error) = reveal_main_log(app) {
                log_runtime_error(app, &format!("failed to reveal main log: {error}"));
            }
        }
        TrayAction::OpenIntegrationsDirectory => {
            if let Err(error) = open_integrations_directory(app) {
                log_runtime_error(
                    app,
                    &format!("failed to open integrations directory: {error}"),
                );
            }
        }
        TrayAction::OpenPluginsDirectory => {
            if let Err(error) = open_plugins_directory(app) {
                log_runtime_error(app, &format!("failed to open plugins directory: {error}"));
            }
        }
        TrayAction::QuitApp => request_explicit_quit(app.clone()),
    }
}

fn handle_tray_icon_event<R: Runtime>(app: &AppHandle<R>, event: TrayIconEvent) {
    if matches!(
        event,
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        }
    ) {
        if let Err(error) = show_main_window(app) {
            log_runtime_error(
                app,
                &format!("failed to restore main window from tray click: {error}"),
            );
        }
    }
}

fn restart_background_services<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    if state.shutdown_intent.is_requested() {
        return Err(FrameworkError::Conflict(
            "application shutdown has already been requested".to_string(),
        ));
    }

    state
        .context
        .services
        .ensure_local_ai_proxy_ready(&state.paths, &state.config_snapshot())?;
    state
        .context
        .services
        .supervisor
        .restart_openclaw_gateway(&state.paths)?;
    let planned_services = vec![
        SERVICE_ID_LOCAL_AI_PROXY.to_string(),
        SERVICE_ID_OPENCLAW_GATEWAY.to_string(),
    ];
    state.context.logger.info(&format!(
        "tray requested background service restart plan: {}",
        planned_services.join(", ")
    ))?;
    Ok(())
}

fn restart_managed_service<R: Runtime>(
    app: &AppHandle<R>,
    service_id: &'static str,
) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    if state.shutdown_intent.is_requested() {
        return Err(FrameworkError::Conflict(
            "application shutdown has already been requested".to_string(),
        ));
    }

    if service_id == SERVICE_ID_OPENCLAW_GATEWAY {
        state
            .context
            .services
            .supervisor
            .restart_openclaw_gateway(&state.paths)?;
    } else {
        state
            .context
            .services
            .supervisor
            .request_restart(service_id)?;
    }
    state.context.logger.info(&format!(
        "tray requested managed service restart: {service_id}"
    ))?;
    Ok(())
}

fn open_route_from_tray<R: Runtime>(app: &AppHandle<R>, route: &str) -> FrameworkResult<()> {
    show_main_window(app)?;

    let payload = TrayNavigatePayload {
        route: route.to_string(),
    };
    app.emit(events::TRAY_NAVIGATE, &payload)?;

    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let route_literal = serde_json::to_string(route)?;
        let script = format!(
            "window.__CLAW_PENDING_TRAY_ROUTE__ = {route}; window.dispatchEvent(new CustomEvent('claw:tray-navigate', {{ detail: {{ route: {route} }} }}));",
            route = route_literal
        );
        window.eval(script.as_str())?;
    }

    Ok(())
}

fn open_logs_directory<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    app.opener()
        .open_path(
            state.paths.logs_dir.to_string_lossy().into_owned(),
            None::<&str>,
        )
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn reveal_main_log<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    app.opener()
        .reveal_item_in_dir(&state.paths.main_log_file)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn open_integrations_directory<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    app.opener()
        .open_path(
            state.paths.integrations_dir.to_string_lossy().into_owned(),
            None::<&str>,
        )
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn open_plugins_directory<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    app.opener()
        .open_path(
            state.paths.plugins_dir.to_string_lossy().into_owned(),
            None::<&str>,
        )
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(())
}

fn request_explicit_quit<R: Runtime>(app: AppHandle<R>) {
    thread::spawn(move || {
        if let Err(error) = perform_explicit_shutdown(&app) {
            log_runtime_error(
                &app,
                &format!("graceful shutdown encountered an error: {error}"),
            );
        }
        app.exit(0);
    });
}

fn spawn_bundled_openclaw_activation(
    context: Arc<FrameworkContext>,
    resource_root: FrameworkResult<std::path::PathBuf>,
) {
    thread::spawn(move || {
        let activation_result = resource_root.and_then(|resource_root| {
            activate_bundled_openclaw_from_resource_root(context.as_ref(), &resource_root)
        });

        if let Err(error) = activation_result {
            sync_built_in_openclaw_status(context.as_ref(), StudioInstanceStatus::Error);
            let _ = context.logger.error(&format!(
                "bundled openclaw activation failed after app-ready: {error}"
            ));
        }
    });
}

fn resolve_bundled_openclaw_resource_root<R: Runtime>(
    app: &AppHandle<R>,
) -> FrameworkResult<std::path::PathBuf> {
    let resource_dir = app.path().resource_dir().map_err(FrameworkError::from)?;
    resolve_bundled_resource_root(&resource_dir)
}

fn activate_bundled_openclaw_from_resource_root(
    context: &FrameworkContext,
    resource_root: &std::path::Path,
) -> FrameworkResult<()> {
    log_bundled_openclaw_activation_stage(context, OPENCLAW_ACTIVATION_STAGE_PREPARE_RUNTIME)?;
    context
        .services
        .supervisor
        .prepare_openclaw_runtime_activation(&context.paths)
        .map_err(|error| {
            sync_built_in_openclaw_status(context, StudioInstanceStatus::Error);
            error
        })?;
    let runtime = context
        .services
        .openclaw_runtime
        .ensure_bundled_runtime_from_root(&context.paths, resource_root)
        .map_err(|error| {
            sync_built_in_openclaw_status(context, StudioInstanceStatus::Error);
            error
        })?;
    log_bundled_openclaw_activation_stage(
        context,
        OPENCLAW_ACTIVATION_STAGE_BUNDLED_RUNTIME_READY,
    )?;
    finalize_openclaw_activation(context, runtime)
}

fn finalize_openclaw_activation(
    context: &FrameworkContext,
    runtime: ActivatedOpenClawRuntime,
) -> FrameworkResult<()> {
    sync_built_in_openclaw_status(context, StudioInstanceStatus::Starting);
    if context.config.embedded_openclaw.expose_cli_to_shell {
        context
            .services
            .path_registration
            .install_openclaw_shims(&context.paths)?;
        context
            .services
            .path_registration
            .ensure_user_bin_on_path(&context.paths)?;
    }
    context
        .services
        .supervisor
        .configure_openclaw_gateway(&runtime)
        .map_err(|error| {
            sync_built_in_openclaw_status(context, StudioInstanceStatus::Error);
            error
        })?;
    log_bundled_openclaw_activation_stage(context, OPENCLAW_ACTIVATION_STAGE_GATEWAY_CONFIGURED)?;
    context
        .services
        .ensure_local_ai_proxy_ready(&context.paths, &context.config)
        .map_err(|error| {
            sync_built_in_openclaw_status(context, StudioInstanceStatus::Error);
            error
        })?;
    log_bundled_openclaw_activation_stage(context, OPENCLAW_ACTIVATION_STAGE_LOCAL_AI_PROXY_READY)?;
    if let Err(error) = context
        .services
        .ensure_desktop_kernel_running(&context.paths, &context.config)
    {
        sync_built_in_openclaw_status(context, StudioInstanceStatus::Error);
        return Err(FrameworkError::Internal(format!(
            "failed to start bundled openclaw gateway: {error}"
        )));
    }
    log_bundled_openclaw_activation_stage(
        context,
        OPENCLAW_ACTIVATION_STAGE_DESKTOP_KERNEL_RUNNING,
    )?;
    sync_built_in_openclaw_status(context, StudioInstanceStatus::Online);
    log_bundled_openclaw_activation_stage(
        context,
        OPENCLAW_ACTIVATION_STAGE_BUILT_IN_INSTANCE_ONLINE,
    )?;
    Ok(())
}

fn log_bundled_openclaw_activation_stage(
    context: &FrameworkContext,
    message: &str,
) -> FrameworkResult<()> {
    context.logger.info(message)?;
    Ok(())
}

fn sync_built_in_openclaw_status(context: &FrameworkContext, status: StudioInstanceStatus) {
    if let Err(error) = context.services.studio.set_built_in_openclaw_status(
        &context.paths,
        &context.config,
        &context.services.storage,
        status.clone(),
    ) {
        let _ = context.logger.warn(&format!(
            "failed to update built-in openclaw lifecycle status to {:?}: {error}",
            status
        ));
        return;
    }

    if let Err(error) =
        context.emit_built_in_openclaw_status_changed(BuiltInOpenClawStatusChangedPayload {
            instance_id: "managed-openclaw-primary".to_string(),
            status,
        })
    {
        let _ = context.logger.warn(&format!(
            "failed to emit built-in openclaw lifecycle status change event: {error}"
        ));
    }
}

fn perform_explicit_shutdown<R: Runtime>(app: &AppHandle<R>) -> FrameworkResult<()> {
    let state = app.state::<AppState>();
    let first_request = state.shutdown_intent.request();
    if first_request {
        state
            .context
            .logger
            .info("explicit application shutdown requested from tray")?;
    }

    state.context.services.supervisor.begin_shutdown()?;

    if let Err(error) = state.context.services.process.cancel_all() {
        let _ = state.context.logger.warn(&format!(
            "failed to terminate all active child processes during shutdown: {error}"
        ));
    }

    if let Err(error) = state.context.services.supervisor.complete_shutdown() {
        let _ = state.context.logger.warn(&format!(
            "failed to finalize supervisor shutdown state: {error}"
        ));
    }
    if let Err(error) = state.context.services.local_ai_proxy.stop() {
        let _ = state.context.logger.warn(&format!(
            "failed to stop local ai proxy during shutdown: {error}"
        ));
    }

    Ok(())
}

fn log_runtime_error<R: Runtime>(app: &AppHandle<R>, message: &str) {
    if let Some(state) = app.try_state::<AppState>() {
        let _ = state.context.logger.error(message);
    }
}

fn active_tray_language<R: Runtime>(app: &AppHandle<R>) -> TrayLanguage {
    let system_locale = sys_locale::get_locale();

    app.try_state::<AppState>()
        .map(|state| {
            let config = state.config_snapshot();
            resolve_tray_language(&config.language, system_locale.as_deref())
        })
        .unwrap_or_else(|| resolve_tray_language("system", system_locale.as_deref()))
}

fn system_locale_to_tray_language(locale: Option<&str>) -> TrayLanguage {
    let normalized = locale
        .unwrap_or_default()
        .trim()
        .to_lowercase()
        .replace('_', "-");

    if normalized.starts_with("zh") {
        return TrayLanguage::Zh;
    }

    TrayLanguage::En
}

fn tray_labels_for(language: TrayLanguage) -> TrayLabels {
    match language {
        TrayLanguage::En => TrayLabels {
            open_window: "Open Window",
            navigate: "Navigate",
            dashboard: "Dashboard",
            instances: "Instances",
            tasks: "Tasks",
            settings: "Settings",
            services: "Services",
            restart_openclaw_gateway: "Restart OpenClaw Gateway",
            restart_all_background_services: "Restart All Background Services",
            diagnostics: "Diagnostics",
            open_logs_directory: "Open Logs Directory",
            reveal_main_log: "Reveal Main Log",
            open_integrations_directory: "Open Integrations Directory",
            open_plugins_directory: "Open Plugins Directory",
            quit_app: "Quit Claw Studio",
        },
        TrayLanguage::Zh => TrayLabels {
            open_window: "\u{6253}\u{5f00}\u{7a97}\u{53e3}",
            navigate: "\u{5bfc}\u{822a}",
            dashboard: "\u{5de5}\u{4f5c}\u{53f0}",
            instances: "\u{5b9e}\u{4f8b}",
            tasks: "\u{4efb}\u{52a1}",
            settings: "\u{8bbe}\u{7f6e}",
            services: "\u{670d}\u{52a1}",
            restart_openclaw_gateway: "\u{91cd}\u{542f} OpenClaw Gateway",
            restart_all_background_services:
                "\u{91cd}\u{542f}\u{5168}\u{90e8}\u{540e}\u{53f0}\u{670d}\u{52a1}",
            diagnostics: "\u{8bca}\u{65ad}",
            open_logs_directory: "\u{6253}\u{5f00}\u{65e5}\u{5fd7}\u{76ee}\u{5f55}",
            reveal_main_log: "\u{5b9a}\u{4f4d}\u{4e3b}\u{65e5}\u{5fd7}",
            open_integrations_directory: "\u{6253}\u{5f00}\u{96c6}\u{6210}\u{76ee}\u{5f55}",
            open_plugins_directory: "\u{6253}\u{5f00}\u{63d2}\u{4ef6}\u{76ee}\u{5f55}",
            quit_app: "\u{9000}\u{51fa} Claw Studio",
        },
    }
}

fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    language: TrayLanguage,
) -> FrameworkResult<Menu<R>> {
    let labels = tray_labels_for(language);
    let open_menu = SubmenuBuilder::new(app, labels.navigate)
        .text(TRAY_MENU_ID_OPEN_DASHBOARD, labels.dashboard)
        .text(TRAY_MENU_ID_OPEN_INSTANCES, labels.instances)
        .text(TRAY_MENU_ID_OPEN_TASKS, labels.tasks)
        .text(TRAY_MENU_ID_OPEN_SETTINGS, labels.settings)
        .build()?;
    let services_menu = SubmenuBuilder::new(app, labels.services)
        .text(
            TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY,
            labels.restart_openclaw_gateway,
        )
        .separator()
        .text(
            TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES,
            labels.restart_all_background_services,
        )
        .build()?;
    let diagnostics_menu = SubmenuBuilder::new(app, labels.diagnostics)
        .text(TRAY_MENU_ID_OPEN_LOGS_DIRECTORY, labels.open_logs_directory)
        .text(TRAY_MENU_ID_REVEAL_MAIN_LOG, labels.reveal_main_log)
        .text(
            TRAY_MENU_ID_OPEN_INTEGRATIONS_DIRECTORY,
            labels.open_integrations_directory,
        )
        .text(
            TRAY_MENU_ID_OPEN_PLUGINS_DIRECTORY,
            labels.open_plugins_directory,
        )
        .build()?;

    MenuBuilder::new(app)
        .text(TRAY_MENU_ID_SHOW_WINDOW, labels.open_window)
        .separator()
        .item(&open_menu)
        .item(&services_menu)
        .item(&diagnostics_menu)
        .separator()
        .text(TRAY_MENU_ID_QUIT_APP, labels.quit_app)
        .build()
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::{
        activate_bundled_openclaw_from_resource_root, build_tray_menu_spec, resolve_tray_language,
        should_prevent_main_window_close, tray_action_for_menu_id, TrayAction, TrayLanguage,
        TrayMenuEntry, TRAY_MENU_ID_QUIT_APP, TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES,
        TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY, TRAY_MENU_ID_SHOW_WINDOW,
    };
    use crate::framework::{
        config::AppConfig,
        context::FrameworkContext,
        layout::ActiveState,
        logging::init_logger,
        openclaw_release::bundled_openclaw_version,
        paths::resolve_paths_for_root,
        services::{
            local_ai_proxy::config::default_local_ai_proxy_public_host,
            openclaw_runtime::BundledOpenClawManifest,
            studio::StudioInstanceStatus,
            supervisor::{ManagedServiceLifecycle, SERVICE_ID_OPENCLAW_GATEWAY},
        },
    };
    use serde_json::Value;
    use sha2::{Digest, Sha256};
    use std::{
        fs,
        io::Read,
        process::{Child, Command},
        thread,
        time::Duration,
    };

    #[test]
    fn invoke_handler_registers_studio_openclaw_gateway_proxy_command() {
        let source = include_str!("bootstrap.rs");
        let production_source = source
            .split("mod tests {")
            .next()
            .expect("production bootstrap source");

        assert!(
            production_source.contains("commands::studio_commands::studio_invoke_openclaw_gateway")
        );
    }

    #[test]
    fn setup_ensures_tray_before_starting_bundled_background_runtime() {
        let source = include_str!("bootstrap.rs");
        let production_source = source
            .split("mod tests {")
            .next()
            .expect("production bootstrap source");

        let ensure_tray_index = production_source
            .find("ensure_tray(&app_handle)?;")
            .expect("tray setup should ensure the tray exists");
        let activate_runtime_index = production_source
            .find("spawn_bundled_openclaw_activation(context.clone(), resource_root);")
            .expect("tray setup should still schedule the built-in OpenClaw activation");

        assert!(
            ensure_tray_index < activate_runtime_index,
            "tray readiness should happen before built-in OpenClaw activation so the app remains reachable while background startup is slow"
        );
    }

    #[test]
    fn setup_bootstrap_emits_app_ready_before_background_bundled_openclaw_activation() {
        let source = include_str!("bootstrap.rs");
        let production_source = source
            .split("mod tests {")
            .next()
            .expect("production bootstrap source");

        assert!(
            !production_source.contains("activation_result?;"),
            "setup should no longer bubble bundled openclaw activation failures before app-ready"
        );

        let app_ready_index = production_source
            .find("app.emit(events::APP_READY, ())?;")
            .expect("setup should emit app ready before background activation");
        let activate_runtime_index = production_source
            .find("spawn_bundled_openclaw_activation(context.clone(), resource_root);")
            .expect("setup should schedule bundled openclaw activation in the background");

        assert!(
            app_ready_index < activate_runtime_index,
            "app-ready should be emitted before bundled openclaw activation is scheduled"
        );
    }

    #[test]
    fn background_bundled_openclaw_activation_logs_failures_without_bubbling_into_setup() {
        let source = include_str!("bootstrap.rs");
        let production_source = source
            .split("mod tests {")
            .next()
            .expect("production bootstrap source");

        let activation_failure_log_index = production_source
            .find("bundled openclaw activation failed after app-ready:")
            .expect("background activation should log bundled openclaw activation failures");
        let activation_spawn_index = production_source
            .find("spawn_bundled_openclaw_activation(context.clone(), resource_root);")
            .expect("setup should schedule bundled openclaw activation in the background");

        assert!(
            activation_spawn_index < activation_failure_log_index,
            "background activation failures should be logged from the async activation path"
        );
    }

    #[test]
    fn bundled_openclaw_activation_emits_stage_logs_for_packaged_setup_debugging() {
        let source = include_str!("bootstrap.rs");
        let production_source = source
            .split("mod tests {")
            .next()
            .expect("production bootstrap source");

        for stage_marker in [
            "bundled openclaw activation stage: prepare-runtime-activation",
            "bundled openclaw activation stage: bundled-runtime-ready",
            "bundled openclaw activation stage: gateway-configured",
            "bundled openclaw activation stage: local-ai-proxy-ready",
            "bundled openclaw activation stage: desktop-kernel-running",
            "bundled openclaw activation stage: built-in-instance-online",
        ] {
            assert!(
                production_source.contains(stage_marker),
                "packaged setup should log activation stage marker {stage_marker}"
            );
        }
    }

    #[test]
    fn sync_built_in_openclaw_status_emits_a_desktop_event_after_persisting_status() {
        let source = include_str!("bootstrap.rs");
        let production_source = source
            .split("mod tests {")
            .next()
            .expect("production bootstrap source");
        let sync_fn_source = production_source
            .split("fn sync_built_in_openclaw_status")
            .nth(1)
            .and_then(|tail| tail.split("fn perform_explicit_shutdown").next())
            .expect("sync built-in openclaw status source");

        let persist_index = sync_fn_source
            .find("context.services.studio.set_built_in_openclaw_status")
            .expect("sync should persist the built-in instance status");
        let emit_index = sync_fn_source
            .find("context.emit_built_in_openclaw_status_changed")
            .expect("sync should emit a desktop event for background status convergence");

        assert!(
            persist_index < emit_index,
            "status persistence should happen before the desktop event is emitted"
        );
    }

    #[test]
    fn refresh_tray_menu_recreates_the_main_tray_when_it_is_missing() {
        let source = include_str!("bootstrap.rs");
        let production_source = source
            .split("mod tests {")
            .next()
            .expect("production bootstrap source");
        let refresh_tray_menu_source = production_source
            .split("pub fn refresh_tray_menu")
            .nth(1)
            .and_then(|tail| tail.split("fn handle_window_event").next())
            .expect("refresh tray menu source");

        let ensure_tray_index = refresh_tray_menu_source
            .find("ensure_tray(app)?;")
            .expect("tray refresh should recreate the tray before reconfiguring the menu");
        let lookup_index = refresh_tray_menu_source
            .find(".tray_by_id(TRAY_ICON_ID)")
            .expect("tray refresh should retrieve the ensured tray handle");

        assert!(
            ensure_tray_index < lookup_index,
            "tray refresh should recreate the tray before looking up the tray handle"
        );
    }

    #[test]
    fn close_request_keeps_the_window_visible_when_the_tray_is_unavailable() {
        let source = include_str!("bootstrap.rs");
        let production_source = source
            .split("mod tests {")
            .next()
            .expect("production bootstrap source");
        let handle_window_event_source = production_source
            .split("fn handle_window_event")
            .nth(1)
            .and_then(|tail| tail.split("fn handle_tray_menu_event").next())
            .expect("handle window event source");

        let ensure_tray_index = handle_window_event_source
            .find("if let Err(error) = ensure_tray(&app)")
            .expect("close-to-tray flow should verify the tray remains reachable");
        let hide_window_index = handle_window_event_source
            .find("if let Err(error) = window.hide()")
            .expect("close-to-tray flow should still hide the window after the guard");

        assert!(
            ensure_tray_index < hide_window_index,
            "close-to-tray should only hide the window after the tray is confirmed reachable"
        );
    }

    #[test]
    fn close_request_is_intercepted_until_shutdown_is_requested() {
        assert!(should_prevent_main_window_close(false));
        assert!(!should_prevent_main_window_close(true));
    }

    #[test]
    fn tray_menu_promotes_open_window_to_the_first_level() {
        let spec = build_tray_menu_spec(TrayLanguage::En);

        assert_eq!(
            spec.first(),
            Some(&TrayMenuEntry::Item {
                id: TRAY_MENU_ID_SHOW_WINDOW,
                label: "Open Window".to_string(),
            })
        );
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Submenu { label, .. } if label == "Services"
            )
        }));
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Submenu { label, items }
                    if label == "Services"
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY
                                    && label == "Restart OpenClaw Gateway"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES
                                    && label == "Restart All Background Services"
                        ))
            )
        }));
    }

    #[test]
    fn tray_language_uses_explicit_preference_before_system_locale() {
        assert_eq!(
            resolve_tray_language("system", Some("zh-CN")),
            TrayLanguage::Zh
        );
        assert_eq!(resolve_tray_language("en", Some("zh-CN")), TrayLanguage::En);
        assert_eq!(
            resolve_tray_language("zh-TW", Some("en-US")),
            TrayLanguage::Zh
        );
        assert_eq!(resolve_tray_language("ja", Some("zh-CN")), TrayLanguage::En);
    }

    #[test]
    fn tray_menu_labels_localize_to_simplified_chinese() {
        let spec = build_tray_menu_spec(TrayLanguage::Zh);

        assert_eq!(
            spec.first(),
            Some(&TrayMenuEntry::Item {
                id: TRAY_MENU_ID_SHOW_WINDOW,
                label: "\u{6253}\u{5f00}\u{7a97}\u{53e3}".to_string(),
            })
        );
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Submenu { label, .. } if label == "\u{5bfc}\u{822a}"
            )
        }));
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Submenu { label, items }
                    if label == "\u{670d}\u{52a1}"
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_OPENCLAW_GATEWAY
                                    && label == "\u{91cd}\u{542f} OpenClaw Gateway"
                        ))
                        && items.iter().any(|item| matches!(
                            item,
                            TrayMenuEntry::Item { id, label }
                                if *id == TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES
                                    && label
                                        == "\u{91cd}\u{542f}\u{5168}\u{90e8}\u{540e}\u{53f0}\u{670d}\u{52a1}"
                        ))
            )
        }));
        assert!(spec.iter().any(|entry| {
            matches!(
                entry,
                TrayMenuEntry::Item { id, label }
                    if *id == TRAY_MENU_ID_QUIT_APP
                        && label == "\u{9000}\u{51fa} Claw Studio"
            )
        }));
    }

    #[test]
    fn tray_menu_ids_map_to_expected_actions() {
        assert_eq!(
            tray_action_for_menu_id(TRAY_MENU_ID_SHOW_WINDOW),
            Some(TrayAction::ShowWindow)
        );
        assert_eq!(
            tray_action_for_menu_id("open_dashboard"),
            Some(TrayAction::OpenRoute("/dashboard"))
        );
        assert_eq!(
            tray_action_for_menu_id("open_instances"),
            Some(TrayAction::OpenRoute("/instances"))
        );
        assert_eq!(
            tray_action_for_menu_id("open_tasks"),
            Some(TrayAction::OpenRoute("/tasks"))
        );
        assert_eq!(
            tray_action_for_menu_id("open_settings"),
            Some(TrayAction::OpenRoute("/settings"))
        );
        assert_eq!(
            tray_action_for_menu_id("restart_openclaw_gateway"),
            Some(TrayAction::RestartManagedService("openclaw_gateway"))
        );
        assert_eq!(
            tray_action_for_menu_id(TRAY_MENU_ID_RESTART_BACKGROUND_SERVICES),
            Some(TrayAction::RestartBackgroundServices)
        );
        assert_eq!(
            tray_action_for_menu_id("open_logs_directory"),
            Some(TrayAction::OpenLogsDirectory)
        );
        assert_eq!(
            tray_action_for_menu_id("reveal_main_log"),
            Some(TrayAction::RevealMainLog)
        );
        assert_eq!(
            tray_action_for_menu_id("open_integrations_directory"),
            Some(TrayAction::OpenIntegrationsDirectory)
        );
        assert_eq!(
            tray_action_for_menu_id("open_plugins_directory"),
            Some(TrayAction::OpenPluginsDirectory)
        );
        assert_eq!(
            tray_action_for_menu_id(TRAY_MENU_ID_QUIT_APP),
            Some(TrayAction::QuitApp)
        );
        assert_eq!(tray_action_for_menu_id("missing"), None);
    }

    #[test]
    fn bundled_openclaw_activation_installs_runtime_shims_by_default() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = FrameworkContext::from_parts(paths.clone(), AppConfig::default(), logger);
        let resource_root = create_bundled_gateway_fixture(root.path());
        seed_built_in_openclaw_gateway_port(&paths, reserve_available_loopback_port());

        activate_bundled_openclaw_from_resource_root(&context, &resource_root)
            .expect("activate bundled openclaw");

        assert!(paths.user_bin_dir.join("openclaw.cmd").exists());
        assert!(paths.user_bin_dir.join("openclaw.ps1").exists());
        assert!(paths.user_bin_dir.join("openclaw").exists());

        let active = serde_json::from_str::<ActiveState>(
            &fs::read_to_string(&paths.active_file).expect("active file"),
        )
        .expect("active json");
        let openclaw_config = serde_json::from_str::<Value>(
            &fs::read_to_string(&openclaw_config_file_path(&paths)).expect("openclaw config file"),
        )
        .expect("openclaw config json");
        assert_eq!(
            active
                .runtimes
                .get("openclaw")
                .and_then(|entry| entry.active_version.as_deref()),
            Some(
                format!(
                    "{}-{}-{}",
                    bundled_openclaw_version(),
                    normalized_openclaw_platform(),
                    normalized_openclaw_arch()
                )
                .as_str()
            )
        );
        assert_eq!(
            openclaw_config["models"]["providers"]["sdkwork-local-proxy"]["apiKey"],
            "${SDKWORK_LOCAL_PROXY_TOKEN}"
        );
        assert!(
            openclaw_config["models"]["providers"]["sdkwork-local-proxy"]["baseUrl"]
                .as_str()
                .expect("local proxy base url")
                .starts_with(&format!("http://{}:", default_local_ai_proxy_public_host()))
        );
        assert_eq!(
            openclaw_config["agents"]["defaults"]["model"]["primary"],
            "sdkwork-local-proxy/sdkwork-chat"
        );

        let snapshot = context.services.supervisor.snapshot().expect("snapshot");
        let openclaw = snapshot
            .services
            .into_iter()
            .find(|managed_service| managed_service.id == SERVICE_ID_OPENCLAW_GATEWAY)
            .expect("openclaw service");
        assert_eq!(openclaw.lifecycle, ManagedServiceLifecycle::Running);
        assert!(openclaw.pid.is_some());
        let built_in = context
            .services
            .studio
            .get_instance(
                &paths,
                &context.config,
                &context.services.storage,
                "managed-openclaw-primary",
            )
            .expect("get built-in instance")
            .expect("built-in instance");
        assert_eq!(built_in.status, StudioInstanceStatus::Online);

        context
            .services
            .local_ai_proxy
            .stop()
            .expect("stop local ai proxy");
        context
            .services
            .supervisor
            .begin_shutdown()
            .expect("shutdown");
        context
            .services
            .supervisor
            .complete_shutdown()
            .expect("complete shutdown");
    }

    #[test]
    fn bundled_openclaw_activation_marks_built_in_instance_error_when_gateway_start_fails() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = FrameworkContext::from_parts(paths.clone(), AppConfig::default(), logger);
        let resource_root = create_failing_bundled_gateway_fixture(root.path());
        seed_built_in_openclaw_gateway_port(&paths, reserve_available_loopback_port());

        let error = activate_bundled_openclaw_from_resource_root(&context, &resource_root)
            .expect_err("activate bundled openclaw should fail");

        assert!(error.to_string().contains("gateway"));

        let built_in = context
            .services
            .studio
            .get_instance(
                &paths,
                &context.config,
                &context.services.storage,
                "managed-openclaw-primary",
            )
            .expect("get built-in instance")
            .expect("built-in instance");
        assert_eq!(built_in.status, StudioInstanceStatus::Error);
        context
            .services
            .local_ai_proxy
            .stop()
            .expect("stop local ai proxy");
    }

    #[test]
    fn bundled_openclaw_activation_marks_built_in_instance_error_when_runtime_installation_fails() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = FrameworkContext::from_parts(paths.clone(), AppConfig::default(), logger);
        let resource_root = create_bundled_gateway_fixture(root.path());
        seed_built_in_openclaw_gateway_port(&paths, reserve_available_loopback_port());
        fs::remove_file(resource_root.join("manifest.json")).expect("remove bundled manifest");

        let error = activate_bundled_openclaw_from_resource_root(&context, &resource_root)
            .expect_err(
                "activate bundled openclaw should fail when runtime installation is broken",
            );

        assert!(!error.to_string().trim().is_empty());

        let built_in = context
            .services
            .studio
            .get_instance(
                &paths,
                &context.config,
                &context.services.storage,
                "managed-openclaw-primary",
            )
            .expect("get built-in instance")
            .expect("built-in instance");
        assert_eq!(built_in.status, StudioInstanceStatus::Error);
    }

    #[test]
    fn bundled_openclaw_activation_skips_runtime_shims_when_shell_exposure_is_disabled() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let config = AppConfig {
            embedded_openclaw: crate::framework::config::EmbeddedOpenClawConfig {
                expose_cli_to_shell: false,
            },
            ..AppConfig::default()
        };
        let context = FrameworkContext::from_parts(paths.clone(), config, logger);
        let resource_root = create_bundled_gateway_fixture(root.path());
        seed_built_in_openclaw_gateway_port(&paths, reserve_available_loopback_port());

        activate_bundled_openclaw_from_resource_root(&context, &resource_root)
            .expect("activate bundled openclaw");

        assert!(!paths.user_bin_dir.join("openclaw.cmd").exists());
        assert!(!paths.user_bin_dir.join("openclaw.ps1").exists());
        assert!(!paths.user_bin_dir.join("openclaw").exists());

        context
            .services
            .local_ai_proxy
            .stop()
            .expect("stop local ai proxy");
        context
            .services
            .supervisor
            .begin_shutdown()
            .expect("shutdown");
        context
            .services
            .supervisor
            .complete_shutdown()
            .expect("complete shutdown");
    }

    #[cfg(windows)]
    #[test]
    fn bundled_openclaw_activation_reaps_stale_gateway_processes_before_rewriting_managed_config() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = FrameworkContext::from_parts(paths.clone(), AppConfig::default(), logger);
        let resource_root = create_bundled_gateway_fixture(root.path());
        seed_built_in_openclaw_gateway_port(&paths, reserve_available_loopback_port());

        let mut stale_gateway = spawn_stale_gateway_process_locking_config(
            root.path(),
            &paths.openclaw_config_file,
            &paths.openclaw_runtime_dir,
        );

        let activation_result =
            activate_bundled_openclaw_from_resource_root(&context, &resource_root);
        let _ = terminate_child(&mut stale_gateway);

        activation_result.expect(
            "activation should succeed after reaping the stale gateway before rewriting the OpenClaw config file",
        );

        context
            .services
            .local_ai_proxy
            .stop()
            .expect("stop local ai proxy");
        context
            .services
            .supervisor
            .begin_shutdown()
            .expect("shutdown");
        context
            .services
            .supervisor
            .complete_shutdown()
            .expect("complete shutdown");
    }

    fn reserve_available_loopback_port() -> u16 {
        std::net::TcpListener::bind("127.0.0.1:0")
            .expect("reserve loopback port")
            .local_addr()
            .expect("loopback addr")
            .port()
    }

    fn openclaw_config_file_path(paths: &crate::framework::paths::AppPaths) -> std::path::PathBuf {
        crate::framework::services::kernel_runtime_authority::KernelRuntimeAuthorityService::new()
            .active_config_file_path("openclaw", paths)
            .unwrap_or_else(|_| {
                paths
                    .kernel_paths("openclaw")
                    .map(|kernel| kernel.config_file)
                    .unwrap_or_else(|_| paths.openclaw_config_file.clone())
            })
    }

    fn seed_built_in_openclaw_gateway_port(paths: &crate::framework::paths::AppPaths, port: u16) {
        if let Some(parent) = paths.openclaw_config_file.parent() {
            fs::create_dir_all(parent).expect("openclaw config dir");
        }
        fs::write(
            &paths.openclaw_config_file,
            format!("{{\n  \"gateway\": {{\n    \"port\": {port}\n  }}\n}}\n"),
        )
        .expect("seed openclaw config");
    }

    #[cfg(windows)]
    fn spawn_stale_gateway_process_locking_config(
        root: &std::path::Path,
        config_path: &std::path::Path,
        openclaw_runtime_dir: &std::path::Path,
    ) -> Child {
        let stale_runtime_dir = openclaw_runtime_dir.join("stale-lock-holder");
        let fake_openclaw_script = stale_runtime_dir.join("openclaw.mjs");
        let lock_script_path = root.join("lock-openclaw-config.ps1");
        let ready_file_path = root.join("lock-openclaw-config.ready");

        fs::create_dir_all(&stale_runtime_dir).expect("stale runtime dir");
        fs::write(&fake_openclaw_script, "// stale gateway marker\n")
            .expect("fake openclaw script");
        fs::write(
            &lock_script_path,
            r#"
param(
  [string]$RuntimeScriptPath,
  [string]$Mode,
  [string]$ConfigPath,
  [string]$ReadyFilePath
)
$ErrorActionPreference = 'Stop'
$parent = Split-Path -Parent $ReadyFilePath
if (-not [string]::IsNullOrWhiteSpace($parent)) {
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
}
$stream = [System.IO.File]::Open($ConfigPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
try {
  Set-Content -LiteralPath $ReadyFilePath -Value 'ready' -NoNewline
  Start-Sleep -Seconds 60
} finally {
  $stream.Dispose()
}
"#,
        )
        .expect("lock script");

        let mut child = Command::new("powershell")
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                lock_script_path.to_string_lossy().as_ref(),
                fake_openclaw_script.to_string_lossy().as_ref(),
                "gateway",
                config_path.to_string_lossy().as_ref(),
                ready_file_path.to_string_lossy().as_ref(),
            ])
            .spawn()
            .expect("spawn stale gateway lock process");

        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        while std::time::Instant::now() < deadline {
            if ready_file_path.exists() {
                return child;
            }
            if let Ok(Some(status)) = child.try_wait() {
                panic!(
                    "stale gateway lock process exited before acquiring the config lock: {status}"
                );
            }
            thread::sleep(Duration::from_millis(50));
        }

        let _ = terminate_child(&mut child);
        panic!("stale gateway lock process did not acquire the config lock before timeout");
    }

    #[cfg(windows)]
    fn terminate_child(child: &mut Child) -> std::io::Result<()> {
        if child.try_wait()?.is_some() {
            return Ok(());
        }
        child.kill()?;
        let _ = child.wait();
        Ok(())
    }

    fn bundled_gateway_fixture_cli_source() -> &'static str {
        r#"import fs from 'node:fs';
import http from 'node:http';
const configPath = process.env.OPENCLAW_CONFIG_PATH;
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const gatewayPort = Number(config?.gateway?.port ?? 18789);
const expectedAuthorization = `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN ?? ''}`;
const server = http.createServer((req, res) => {
  if (req.url !== '/tools/invoke' || req.method !== 'POST') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: { message: 'unexpected path' } }));
    return;
  }
  if ((req.headers.authorization ?? '') !== expectedAuthorization) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: { message: 'unauthorized' } }));
    return;
  }
  let body = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const payload = body.trim() ? JSON.parse(body) : {};
    if (payload.tool !== 'cron' || payload.action !== 'status') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: { message: `unexpected method ${payload.tool ?? 'missing'}.${payload.action ?? 'missing'}` } }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, result: { method: `${payload.tool}.${payload.action}` } }));
  });
});
server.listen(gatewayPort, '127.0.0.1');
setInterval(() => {}, 1000);
"#
    }

    #[cfg(windows)]
    fn create_bundled_gateway_fixture(root: &std::path::Path) -> std::path::PathBuf {
        let resource_root = root.join("bundled-openclaw");
        let runtime_root = resource_root.join("runtime");
        let cli_path = runtime_root
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(&cli_path, bundled_gateway_fixture_cli_source()).expect("cli file");

        let manifest = BundledOpenClawManifest {
            schema_version: 2,
            runtime_id: "openclaw".to_string(),
            openclaw_version: bundled_openclaw_version().to_string(),
            required_external_runtimes: vec!["nodejs".to_string()],
            required_external_runtime_versions: std::collections::BTreeMap::from([(
                "nodejs".to_string(),
                "22.16.0".to_string(),
            )]),
            platform: normalized_openclaw_platform().to_string(),
            arch: normalized_openclaw_arch().to_string(),
            cli_relative_path: "runtime/package/node_modules/openclaw/openclaw.mjs".to_string(),
        };

        fs::write(
            resource_root.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest file");
        write_test_runtime_sidecar_manifest(&runtime_root, &manifest);

        resource_root
    }

    #[cfg(not(windows))]
    fn create_bundled_gateway_fixture(root: &std::path::Path) -> std::path::PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let resource_root = root.join("bundled-openclaw");
        let runtime_root = resource_root.join("runtime");
        let cli_path = runtime_root
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(&cli_path, bundled_gateway_fixture_cli_source()).expect("cli file");

        let manifest = BundledOpenClawManifest {
            schema_version: 2,
            runtime_id: "openclaw".to_string(),
            openclaw_version: bundled_openclaw_version().to_string(),
            required_external_runtimes: vec!["nodejs".to_string()],
            required_external_runtime_versions: std::collections::BTreeMap::from([(
                "nodejs".to_string(),
                "22.16.0".to_string(),
            )]),
            platform: normalized_openclaw_platform().to_string(),
            arch: normalized_openclaw_arch().to_string(),
            cli_relative_path: "runtime/package/node_modules/openclaw/openclaw.mjs".to_string(),
        };

        fs::write(
            resource_root.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest file");
        write_test_runtime_sidecar_manifest(&runtime_root, &manifest);

        resource_root
    }

    fn write_test_runtime_sidecar_manifest(
        runtime_root: &std::path::Path,
        manifest: &BundledOpenClawManifest,
    ) {
        let mut files = Vec::new();
        let cli_relative_path = manifest
            .cli_relative_path
            .trim_start_matches("runtime/")
            .to_string();
        files.push(runtime_integrity_file(runtime_root, &cli_relative_path));

        fs::write(
            runtime_root.join(".sdkwork-openclaw-runtime.json"),
            format!(
                "{}\n",
                serde_json::to_string_pretty(&serde_json::json!({
                    "schemaVersion": manifest.schema_version,
                    "runtimeId": manifest.runtime_id,
                    "openclawVersion": manifest.openclaw_version,
                    "requiredExternalRuntimes": manifest.required_external_runtimes,
                    "requiredExternalRuntimeVersions": manifest.required_external_runtime_versions,
                    "platform": manifest.platform,
                    "arch": manifest.arch,
                    "cliRelativePath": manifest.cli_relative_path,
                    "runtimeIntegrity": {
                        "schemaVersion": 1,
                        "files": files,
                    },
                }))
                .expect("runtime sidecar json")
            ),
        )
        .expect("runtime sidecar");
    }

    fn runtime_integrity_file(
        runtime_root: &std::path::Path,
        relative_path: &str,
    ) -> serde_json::Value {
        let absolute_path = runtime_root.join(relative_path);
        let metadata = fs::metadata(&absolute_path).expect("runtime integrity metadata");
        serde_json::json!({
            "relativePath": relative_path,
            "size": metadata.len(),
            "sha256": sha256_file_hex(&absolute_path),
        })
    }

    fn sha256_file_hex(path: &std::path::Path) -> String {
        let mut file = fs::File::open(path).expect("open integrity file");
        let mut hasher = Sha256::new();
        let mut buffer = [0_u8; 8192];

        loop {
            let bytes_read = file.read(&mut buffer).expect("read integrity file");
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }

        hasher
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    }

    #[cfg(windows)]
    fn create_failing_bundled_gateway_fixture(root: &std::path::Path) -> std::path::PathBuf {
        let resource_root = root.join("bundled-openclaw-failing");
        let runtime_root = resource_root.join("runtime");
        let cli_path = runtime_root
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(&cli_path, "process.exit(1);\n").expect("cli file");

        let manifest = BundledOpenClawManifest {
            schema_version: 2,
            runtime_id: "openclaw".to_string(),
            openclaw_version: bundled_openclaw_version().to_string(),
            required_external_runtimes: vec!["nodejs".to_string()],
            required_external_runtime_versions: std::collections::BTreeMap::from([(
                "nodejs".to_string(),
                "22.16.0".to_string(),
            )]),
            platform: normalized_openclaw_platform().to_string(),
            arch: normalized_openclaw_arch().to_string(),
            cli_relative_path: "runtime/package/node_modules/openclaw/openclaw.mjs".to_string(),
        };

        fs::write(
            resource_root.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest file");
        write_test_runtime_sidecar_manifest(&runtime_root, &manifest);

        resource_root
    }

    #[cfg(not(windows))]
    fn create_failing_bundled_gateway_fixture(root: &std::path::Path) -> std::path::PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let resource_root = root.join("bundled-openclaw-failing");
        let runtime_root = resource_root.join("runtime");
        let cli_path = runtime_root
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(&cli_path, "process.exit(1);\n").expect("cli file");

        let manifest = BundledOpenClawManifest {
            schema_version: 2,
            runtime_id: "openclaw".to_string(),
            openclaw_version: bundled_openclaw_version().to_string(),
            required_external_runtimes: vec!["nodejs".to_string()],
            required_external_runtime_versions: std::collections::BTreeMap::from([(
                "nodejs".to_string(),
                "22.16.0".to_string(),
            )]),
            platform: normalized_openclaw_platform().to_string(),
            arch: normalized_openclaw_arch().to_string(),
            cli_relative_path: "runtime/package/node_modules/openclaw/openclaw.mjs".to_string(),
        };

        fs::write(
            resource_root.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).expect("manifest json"),
        )
        .expect("manifest file");
        write_test_runtime_sidecar_manifest(&runtime_root, &manifest);

        resource_root
    }

    fn normalized_openclaw_platform() -> &'static str {
        match crate::platform::current_target() {
            "windows" => "windows",
            "macos" => "macos",
            "linux" => "linux",
            other => other,
        }
    }

    fn normalized_openclaw_arch() -> &'static str {
        match crate::platform::current_arch() {
            "x86_64" => "x64",
            "aarch64" => "arm64",
            other => other,
        }
    }
}
