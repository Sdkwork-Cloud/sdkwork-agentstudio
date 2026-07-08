use crate::{
    framework::{
        dialog::{apply_dialog_options, SaveFileOptions},
        services::dialog::DialogService,
    },
    state::AppState,
};
use tauri::{Manager, Runtime};
use tauri_plugin_dialog::{DialogExt, FileDialogBuilder};

#[cfg(test)]
mod tests {
    use crate::framework::services::dialog::DialogService;

    #[test]
    fn writes_blob_bytes_to_selected_path() {
        let temp = tempfile::tempdir().expect("temp dir");
        let target = temp.path().join("artifact.bin");
        let content = vec![1_u8, 2, 3, 4, 5];

        DialogService::new()
            .write_blob_to_path(&target, &content)
            .expect("write blob");

        assert_eq!(std::fs::read(&target).expect("read blob"), content);
    }
}

fn create_save_dialog<R: Runtime>(
    app: &tauri::AppHandle<R>,
    filename: &str,
    options: &SaveFileOptions,
) -> FileDialogBuilder<R> {
    let mut dialog = apply_dialog_options(
        app.dialog().file(),
        options.title.as_deref().or(Some("Save File")),
        options.default_path.as_deref(),
        &options.filters,
    );
    if let Some(resolved_file_name) =
        DialogService::new().resolve_default_file_name(filename, options.default_path.as_deref())
    {
        dialog = dialog.set_file_name(resolved_file_name);
    }

    if let Some(window) = app.get_webview_window("main") {
        return dialog.set_parent(&window);
    }

    dialog
}
#[tauri::command]
pub async fn save_blob_file(
    filename: String,
    content: Vec<u8>,
    options: Option<SaveFileOptions>,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let options = options.unwrap_or_default();
    let Some(target) = create_save_dialog(&app, &filename, &options).blocking_save_file() else {
        return Ok(());
    };

    let target_path = target.into_path().map_err(|error| error.to_string())?;
    state
        .context
        .services
        .dialog
        .write_blob_to_path(&target_path, &content)
}
