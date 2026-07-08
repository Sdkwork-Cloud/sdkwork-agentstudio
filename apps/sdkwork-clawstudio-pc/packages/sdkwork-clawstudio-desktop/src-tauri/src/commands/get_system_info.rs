use crate::{framework::services::system::SystemSnapshot, state::AppState};

pub type SystemInfo = SystemSnapshot;

pub fn system_info_from_state(state: &AppState) -> SystemInfo {
    let mut snapshot = state.context.services.system.snapshot();
    snapshot.target = state.target.clone();
    snapshot
}

#[tauri::command]
pub fn get_system_info(state: tauri::State<'_, AppState>) -> SystemInfo {
    system_info_from_state(&state)
}
