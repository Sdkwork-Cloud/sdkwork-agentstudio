use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn open_path(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let resolved_path = path.trim();
    if resolved_path.is_empty() {
        return Err("Path is required.".to_string());
    }

    app.opener()
        .open_path(resolved_path, None::<&str>)
        .map_err(|error| error.to_string())
}
