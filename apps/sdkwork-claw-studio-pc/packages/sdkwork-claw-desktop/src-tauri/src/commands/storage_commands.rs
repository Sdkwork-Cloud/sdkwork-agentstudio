use crate::{
    framework::{
        runtime,
        storage::{
            StorageDeleteRequest, StorageDeleteResponse, StorageGetTextRequest,
            StorageGetTextResponse, StorageListKeysRequest, StorageListKeysResponse,
            StoragePutTextRequest, StoragePutTextResponse,
        },
        Result as FrameworkResult,
    },
    state::AppState,
};

pub fn storage_get_text_from_state(
    state: &AppState,
    request: StorageGetTextRequest,
) -> FrameworkResult<StorageGetTextResponse> {
    let config = state.config_snapshot();

    state
        .context
        .services
        .storage
        .get_text(&state.paths, &config, request)
}

pub fn storage_put_text_from_state(
    state: &AppState,
    request: StoragePutTextRequest,
) -> FrameworkResult<StoragePutTextResponse> {
    let config = state.config_snapshot();

    state
        .context
        .services
        .storage
        .put_text(&state.paths, &config, request)
}

pub fn storage_delete_from_state(
    state: &AppState,
    request: StorageDeleteRequest,
) -> FrameworkResult<StorageDeleteResponse> {
    let config = state.config_snapshot();

    state
        .context
        .services
        .storage
        .delete(&state.paths, &config, request)
}

pub fn storage_list_keys_from_state(
    state: &AppState,
    request: StorageListKeysRequest,
) -> FrameworkResult<StorageListKeysResponse> {
    let config = state.config_snapshot();

    state
        .context
        .services
        .storage
        .list_keys(&state.paths, &config, request)
}

#[tauri::command]
pub async fn storage_get_text(
    request: StorageGetTextRequest,
    state: tauri::State<'_, AppState>,
) -> Result<StorageGetTextResponse, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("storage.get_text", move || {
        storage_get_text_from_state(&state, request)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn storage_put_text(
    request: StoragePutTextRequest,
    state: tauri::State<'_, AppState>,
) -> Result<StoragePutTextResponse, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("storage.put_text", move || {
        storage_put_text_from_state(&state, request)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn storage_delete(
    request: StorageDeleteRequest,
    state: tauri::State<'_, AppState>,
) -> Result<StorageDeleteResponse, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("storage.delete", move || {
        storage_delete_from_state(&state, request)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn storage_list_keys(
    request: StorageListKeysRequest,
    state: tauri::State<'_, AppState>,
) -> Result<StorageListKeysResponse, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("storage.list_keys", move || {
        storage_list_keys_from_state(&state, request)
    })
    .await
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        storage_delete_from_state, storage_get_text_from_state, storage_list_keys_from_state,
        storage_put_text_from_state,
    };
    use crate::{
        framework::{
            config::AppConfig,
            context::FrameworkContext,
            logging::init_logger,
            paths::resolve_paths_for_root,
            storage::{
                StorageDeleteRequest, StorageGetTextRequest, StorageListKeysRequest,
                StoragePutTextRequest,
            },
        },
        state::AppState,
    };
    use std::sync::Arc;

    #[test]
    fn storage_commands_round_trip_default_local_profile() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            AppConfig::default(),
            logger,
        ));
        let state = AppState::from_context(context);

        storage_put_text_from_state(
            &state,
            StoragePutTextRequest {
                key: "greeting".to_string(),
                value: "hello".to_string(),
                ..StoragePutTextRequest::default()
            },
        )
        .expect("put");

        let value = storage_get_text_from_state(
            &state,
            StorageGetTextRequest {
                key: "greeting".to_string(),
                ..StorageGetTextRequest::default()
            },
        )
        .expect("get");
        let keys = storage_list_keys_from_state(&state, StorageListKeysRequest::default())
            .expect("list keys");
        let deleted = storage_delete_from_state(
            &state,
            StorageDeleteRequest {
                key: "greeting".to_string(),
                ..StorageDeleteRequest::default()
            },
        )
        .expect("delete");

        assert_eq!(value.value.as_deref(), Some("hello"));
        assert!(keys.keys.iter().any(|key| key == "greeting"));
        assert!(deleted.existed);
    }
}
