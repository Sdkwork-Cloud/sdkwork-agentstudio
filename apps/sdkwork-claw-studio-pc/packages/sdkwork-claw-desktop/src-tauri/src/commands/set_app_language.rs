use crate::{
    app::bootstrap::refresh_tray_menu,
    framework::{
        config::{normalize_app_language_preference, write_config, PublicAppConfig},
        events, Result as FrameworkResult,
    },
    state::AppState,
};
use tauri::{AppHandle, Emitter, Runtime};

fn set_app_language_from_state<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    language: &str,
) -> FrameworkResult<PublicAppConfig> {
    let mut next_config = state.config_snapshot();
    next_config.language = normalize_app_language_preference(language).to_string();
    write_config(&state.paths, &next_config)?;
    state.replace_config(next_config.clone());
    refresh_tray_menu(app)?;

    let projection = next_config.public_projection();
    app.emit(events::APP_CONFIG_UPDATED, &projection)?;
    Ok(projection)
}

#[tauri::command]
pub fn set_app_language<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    language: String,
) -> Result<PublicAppConfig, String> {
    set_app_language_from_state(&app, &state, &language).map_err(|error| error.to_string())
}
