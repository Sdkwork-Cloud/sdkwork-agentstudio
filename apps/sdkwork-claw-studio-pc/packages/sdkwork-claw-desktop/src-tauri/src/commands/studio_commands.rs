use crate::{
    framework::{
        context::BuiltInOpenClawStatusChangedPayload,
        runtime,
        services::studio::{
            HostPlatformStatusRecord, InternalNodeSessionRecord, KernelChatAgentProfile,
            KernelChatMessage, KernelChatRun, KernelChatSession, ManageRolloutListResult,
            ManageRolloutPreview, ManageRolloutRecord, PersistedKernelChatAgentRecord,
            PreviewRolloutInput, StudioConversationRecord, StudioCreateInstanceInput,
            StudioCreateKernelAgentInput, StudioCreateKernelChatSessionInput,
            StudioCreatedKernelAgentRecord, StudioInstanceConfig, StudioInstanceDetailRecord,
            StudioInstanceRecord, StudioInstanceStatus, StudioKernelAgentCreationCapability,
            StudioOpenClawGatewayInvokeOptions, StudioOpenClawGatewayInvokeRequest,
            StudioPatchKernelChatSessionInput, StudioStartKernelChatRunInput,
            StudioUpdateInstanceInput, StudioUpdateInstanceLlmProviderConfigInput,
            StudioWorkbenchTaskExecutionRecord,
        },
        Result as FrameworkResult,
    },
    state::AppState,
};
use sdkwork_claw_host_core::{
    host_endpoints::{HostEndpointRecord, OpenClawGatewayProjection, OpenClawRuntimeProjection},
    openclaw_control_plane::OpenClawGatewayInvokeRequest,
};
use serde::Serialize;
use serde_json::Value;

const BUILT_IN_OPENCLAW_INSTANCE_ID: &str = "managed-openclaw-primary";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopHostedRuntimeRecord {
    pub mode: String,
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    pub api_base_path: String,
    pub manage_base_path: String,
    pub internal_base_path: String,
    pub browser_base_url: String,
    pub browser_session_token: String,
    pub endpoint_id: String,
    pub requested_port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_port: Option<u16>,
    pub loopback_only: bool,
    pub dynamic_port: bool,
    pub state_store_driver: String,
    pub state_store_profile_id: String,
    pub runtime_data_dir: String,
    pub web_dist_dir: String,
}

fn list_instances_from_state(state: &AppState) -> FrameworkResult<Vec<StudioInstanceRecord>> {
    let config = state.config_snapshot();
    state
        .context
        .services
        .studio
        .list_instances_with_supervisor(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
        )
}

fn is_built_in_openclaw_status_event_instance(instance: &StudioInstanceRecord) -> bool {
    instance.is_built_in
        && instance.runtime_kind == crate::framework::services::studio::StudioRuntimeKind::Openclaw
        && instance.deployment_mode
            == crate::framework::services::studio::StudioInstanceDeploymentMode::LocalManaged
        && instance.transport_kind
            == crate::framework::services::studio::StudioInstanceTransportKind::OpenclawGatewayWs
}

fn emit_built_in_openclaw_status_changed_if_needed(
    state: &AppState,
    instance_id: &str,
    status: StudioInstanceStatus,
) -> Result<(), String> {
    let should_emit = if instance_id == BUILT_IN_OPENCLAW_INSTANCE_ID {
        true
    } else {
        let config = state.config_snapshot();
        state
            .context
            .services
            .studio
            .get_instance_with_supervisor(
                &state.paths,
                &config,
                &state.context.services.storage,
                &state.context.services.supervisor,
                instance_id,
            )
            .ok()
            .flatten()
            .is_some_and(|instance| is_built_in_openclaw_status_event_instance(&instance))
    };

    if !should_emit {
        return Ok(());
    }

    state
        .context
        .emit_built_in_openclaw_status_changed(BuiltInOpenClawStatusChangedPayload {
            instance_id: instance_id.to_string(),
            status,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_list_instances(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<StudioInstanceRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_instances", move || {
        list_instances_from_state(&state)
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_get_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_instance_with_supervisor(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_get_instance_detail(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceDetailRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_instance_detail", move || {
        let config = state.config_snapshot();
        state
            .context
            .services
            .studio
            .get_instance_detail_with_supervisor(
                &state.paths,
                &config,
                &state.context.services.storage,
                &state.context.services.supervisor,
                id.as_str(),
            )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_get_kernel_agent_creation_capability(
    state: tauri::State<'_, AppState>,
    instance_id: String,
) -> Result<StudioKernelAgentCreationCapability, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_kernel_agent_creation_capability", move || {
        let config = state.config_snapshot();
        state
            .context
            .services
            .studio
            .get_kernel_agent_creation_capability(
                &state.paths,
                &config,
                &state.context.services.storage,
                instance_id.as_str(),
            )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_create_kernel_agent(
    state: tauri::State<'_, AppState>,
    input: StudioCreateKernelAgentInput,
) -> Result<StudioCreatedKernelAgentRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.create_kernel_agent", move || {
        let config = state.config_snapshot();
        state.context.services.studio.create_kernel_agent(
            &state.paths,
            &config,
            &state.context.services.storage,
            input,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_list_kernel_chat_agent_profiles(
    state: tauri::State<'_, AppState>,
    instance_id: String,
) -> Result<Vec<KernelChatAgentProfile>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_kernel_chat_agent_profiles", move || {
        let config = state.config_snapshot();
        state
            .context
            .services
            .studio
            .list_kernel_chat_agent_profiles(
                &state.paths,
                &config,
                &state.context.services.storage,
                instance_id.as_str(),
            )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_list_persisted_kernel_chat_agents(
    state: tauri::State<'_, AppState>,
    instance_id: String,
) -> Result<Vec<PersistedKernelChatAgentRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_persisted_kernel_chat_agents", move || {
        let config = state.config_snapshot();
        state
            .context
            .services
            .studio
            .list_persisted_kernel_chat_agents(
                &state.paths,
                &config,
                &state.context.services.storage,
                instance_id.as_str(),
            )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_replace_persisted_kernel_chat_agents(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    records: Vec<PersistedKernelChatAgentRecord>,
) -> Result<Vec<PersistedKernelChatAgentRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.replace_persisted_kernel_chat_agents", move || {
        let config = state.config_snapshot();
        state
            .context
            .services
            .studio
            .replace_persisted_kernel_chat_agents(
                &state.paths,
                &config,
                &state.context.services.storage,
                instance_id.as_str(),
                records,
            )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_list_kernel_chat_sessions(
    state: tauri::State<'_, AppState>,
    instance_id: String,
) -> Result<Vec<KernelChatSession>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_kernel_chat_sessions", move || {
        let config = state.config_snapshot();
        state.context.services.studio.list_kernel_chat_sessions(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_get_kernel_chat_session(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    session_id: String,
) -> Result<Option<KernelChatSession>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_kernel_chat_session", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_kernel_chat_session(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            session_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_create_kernel_chat_session(
    state: tauri::State<'_, AppState>,
    input: StudioCreateKernelChatSessionInput,
) -> Result<KernelChatSession, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.create_kernel_chat_session", move || {
        let config = state.config_snapshot();
        state.context.services.studio.create_kernel_chat_session(
            &state.paths,
            &config,
            &state.context.services.storage,
            input,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_list_kernel_chat_runs(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    session_id: String,
) -> Result<Vec<KernelChatRun>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_kernel_chat_runs", move || {
        let config = state.config_snapshot();
        state.context.services.studio.list_kernel_chat_runs(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            session_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_get_kernel_chat_run(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    session_id: String,
    run_id: String,
) -> Result<Option<KernelChatRun>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_kernel_chat_run", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_kernel_chat_run(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            session_id.as_str(),
            run_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_patch_kernel_chat_session(
    state: tauri::State<'_, AppState>,
    input: StudioPatchKernelChatSessionInput,
) -> Result<KernelChatSession, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.patch_kernel_chat_session", move || {
        let config = state.config_snapshot();
        state.context.services.studio.patch_kernel_chat_session(
            &state.paths,
            &config,
            &state.context.services.storage,
            input,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_delete_kernel_chat_session(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    session_id: String,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.delete_kernel_chat_session", move || {
        let config = state.config_snapshot();
        state.context.services.studio.delete_kernel_chat_session(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            session_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_start_kernel_chat_run(
    state: tauri::State<'_, AppState>,
    input: StudioStartKernelChatRunInput,
) -> Result<KernelChatRun, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.start_kernel_chat_run", move || {
        let config = state.config_snapshot();
        state.context.services.studio.start_kernel_chat_run(
            &state.paths,
            &config,
            &state.context.services.storage,
            input,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_abort_kernel_chat_run(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    session_id: String,
    run_id: Option<String>,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.abort_kernel_chat_run", move || {
        let config = state.config_snapshot();
        state.context.services.studio.abort_kernel_chat_run(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            session_id.as_str(),
            run_id.as_deref(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_load_kernel_chat_messages(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    session_id: String,
) -> Result<Vec<KernelChatMessage>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.load_kernel_chat_messages", move || {
        let config = state.config_snapshot();
        state.context.services.studio.load_kernel_chat_messages(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            session_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_invoke_openclaw_gateway(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    request: StudioOpenClawGatewayInvokeRequest,
    options: Option<StudioOpenClawGatewayInvokeOptions>,
) -> Result<Value, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.invoke_openclaw_gateway", move || {
        let config = state.config_snapshot();
        state.context.services.studio.invoke_openclaw_gateway(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            &request,
            &options.unwrap_or_default(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_create_instance(
    state: tauri::State<'_, AppState>,
    input: StudioCreateInstanceInput,
) -> Result<StudioInstanceRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.create_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.create_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            input,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance(
    state: tauri::State<'_, AppState>,
    id: String,
    input: StudioUpdateInstanceInput,
) -> Result<StudioInstanceRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.update_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
            input,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_delete_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.delete_instance", move || {
        let config = state.config_snapshot();
        state.context.services.studio.delete_instance(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_start_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let state = state.inner().clone();
    let instance_id = id.clone();
    let command_state = state.clone();
    let result = runtime::run_blocking_async("studio.start_instance", move || {
        let config = command_state.config_snapshot();
        command_state.context.services.studio.start_instance(
            &command_state.paths,
            &config,
            &command_state.context.services.storage,
            &command_state.context.services.supervisor,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string());

    match &result {
        Ok(Some(instance)) => emit_built_in_openclaw_status_changed_if_needed(
            &state,
            instance.id.as_str(),
            instance.status.clone(),
        )?,
        Err(_) => emit_built_in_openclaw_status_changed_if_needed(
            &state,
            instance_id.as_str(),
            StudioInstanceStatus::Error,
        )?,
        Ok(None) => {}
    }

    result
}

#[tauri::command]
pub async fn studio_stop_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let state = state.inner().clone();
    let instance_id = id.clone();
    let command_state = state.clone();
    let result = runtime::run_blocking_async("studio.stop_instance", move || {
        let config = command_state.config_snapshot();
        command_state.context.services.studio.stop_instance(
            &command_state.paths,
            &config,
            &command_state.context.services.storage,
            &command_state.context.services.supervisor,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string());

    match &result {
        Ok(Some(instance)) => emit_built_in_openclaw_status_changed_if_needed(
            &state,
            instance.id.as_str(),
            instance.status.clone(),
        )?,
        Err(_) => emit_built_in_openclaw_status_changed_if_needed(
            &state,
            instance_id.as_str(),
            StudioInstanceStatus::Error,
        )?,
        Ok(None) => {}
    }

    result
}

#[tauri::command]
pub async fn studio_restart_instance(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceRecord>, String> {
    let state = state.inner().clone();
    let instance_id = id.clone();
    let command_state = state.clone();
    let result = runtime::run_blocking_async("studio.restart_instance", move || {
        let config = command_state.config_snapshot();
        command_state.context.services.studio.restart_instance(
            &command_state.paths,
            &config,
            &command_state.context.services.storage,
            &command_state.context.services.supervisor,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string());

    match &result {
        Ok(Some(instance)) => emit_built_in_openclaw_status_changed_if_needed(
            &state,
            instance.id.as_str(),
            instance.status.clone(),
        )?,
        Err(_) => emit_built_in_openclaw_status_changed_if_needed(
            &state,
            instance_id.as_str(),
            StudioInstanceStatus::Error,
        )?,
        Ok(None) => {}
    }

    result
}

#[tauri::command]
pub async fn studio_get_instance_config(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<StudioInstanceConfig>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_instance_config", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_instance_config(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance_config(
    state: tauri::State<'_, AppState>,
    id: String,
    config: StudioInstanceConfig,
) -> Result<Option<StudioInstanceConfig>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance_config", move || {
        let app_config = state.config_snapshot();
        state.context.services.studio.update_instance_config(
            &state.paths,
            &app_config,
            &state.context.services.storage,
            id.as_str(),
            config,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_get_instance_logs(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_instance_logs", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_instance_logs(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_create_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    payload: Value,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.create_instance_task", move || {
        let config = state.config_snapshot();
        state.context.services.studio.create_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            &payload,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
    payload: Value,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance_task", move || {
        let config = state.config_snapshot();
        state.context.services.studio.update_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
            &payload,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance_file_content(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    file_id: String,
    content: String,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance_file_content", move || {
        let config = state.config_snapshot();
        state.context.services.studio.update_instance_file_content(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            file_id.as_str(),
            content.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance_llm_provider_config(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    provider_id: String,
    update: StudioUpdateInstanceLlmProviderConfigInput,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance_llm_provider_config", move || {
        let config = state.config_snapshot();
        state
            .context
            .services
            .studio
            .update_instance_llm_provider_config(
                &state.paths,
                &config,
                &state.context.services.storage,
                instance_id.as_str(),
                provider_id.as_str(),
                update,
            )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_clone_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
    name: Option<String>,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.clone_instance_task", move || {
        let config = state.config_snapshot();
        state.context.services.studio.clone_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
            name.as_deref(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_run_instance_task_now(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
) -> Result<StudioWorkbenchTaskExecutionRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.run_instance_task_now", move || {
        let config = state.config_snapshot();
        state.context.services.studio.run_instance_task_now(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_list_instance_task_executions(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
) -> Result<Vec<StudioWorkbenchTaskExecutionRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_instance_task_executions", move || {
        let config = state.config_snapshot();
        state.context.services.studio.list_instance_task_executions(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
            task_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_update_instance_task_status(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
    status: String,
) -> Result<(), String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.update_instance_task_status", move || {
        let config = state.config_snapshot();
        state.context.services.studio.update_instance_task_status(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
            status.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_delete_instance_task(
    state: tauri::State<'_, AppState>,
    instance_id: String,
    task_id: String,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.delete_instance_task", move || {
        let config = state.config_snapshot();
        state.context.services.studio.delete_instance_task(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            instance_id.as_str(),
            task_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_list_conversations(
    state: tauri::State<'_, AppState>,
    instance_id: String,
) -> Result<Vec<StudioConversationRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_conversations", move || {
        let config = state.config_snapshot();
        state.context.services.studio.list_conversations(
            &state.paths,
            &config,
            &state.context.services.storage,
            instance_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_put_conversation(
    state: tauri::State<'_, AppState>,
    record: StudioConversationRecord,
) -> Result<StudioConversationRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.put_conversation", move || {
        let config = state.config_snapshot();
        state.context.services.studio.put_conversation(
            &state.paths,
            &config,
            &state.context.services.storage,
            record,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn studio_delete_conversation(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.delete_conversation", move || {
        let config = state.config_snapshot();
        state.context.services.studio.delete_conversation(
            &state.paths,
            &config,
            &state.context.services.storage,
            id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_desktop_host_runtime(
    state: tauri::State<'_, AppState>,
) -> Result<Option<DesktopHostedRuntimeRecord>, String> {
    let state = state.inner().clone();
    Ok(
        runtime::run_blocking_async("studio.get_desktop_host_runtime", move || {
            let _ = state.context.ensure_desktop_host_runtime()?;
            let (desktop_host, desktop_host_status) = state.context.desktop_host_runtime_state()?;

            Ok(desktop_host.map(|snapshot| {
                let lifecycle = desktop_host_status
                    .as_ref()
                    .map(|status| status.lifecycle.clone())
                    .unwrap_or_else(|| "starting".to_string());
                let last_error = desktop_host_status.and_then(|status| status.last_error);

                DesktopHostedRuntimeRecord {
                    mode: snapshot.mode,
                    lifecycle,
                    last_error,
                    api_base_path: snapshot.api_base_path,
                    manage_base_path: snapshot.manage_base_path,
                    internal_base_path: snapshot.internal_base_path,
                    browser_base_url: snapshot.browser_base_url,
                    browser_session_token: snapshot.browser_session_token,
                    endpoint_id: snapshot.endpoint.endpoint_id,
                    requested_port: snapshot.endpoint.requested_port,
                    active_port: snapshot.endpoint.active_port,
                    loopback_only: snapshot.endpoint.loopback_only,
                    dynamic_port: snapshot.endpoint.dynamic_port,
                    state_store_driver: snapshot.state_store_driver,
                    state_store_profile_id: snapshot.state_store.active_profile_id,
                    runtime_data_dir: snapshot.runtime_data_dir.to_string_lossy().into_owned(),
                    web_dist_dir: snapshot.web_dist_dir.to_string_lossy().into_owned(),
                }
            }))
        })
        .await
        .map_err(|error| error.to_string())?,
    )
}

#[tauri::command]
pub async fn get_host_platform_status(
    state: tauri::State<'_, AppState>,
) -> Result<HostPlatformStatusRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_host_platform_status", move || {
        let config = state.config_snapshot();
        let _ = state.context.ensure_desktop_host_runtime()?;
        let (desktop_host, desktop_host_status) = state.context.desktop_host_runtime_state()?;
        state.context.services.studio.get_host_platform_status(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            desktop_host.as_ref(),
            desktop_host_status.as_ref(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_rollouts(
    state: tauri::State<'_, AppState>,
) -> Result<ManageRolloutListResult, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_rollouts", move || {
        let config = state.config_snapshot();
        state.context.services.studio.list_rollouts(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn preview_rollout(
    state: tauri::State<'_, AppState>,
    input: PreviewRolloutInput,
) -> Result<ManageRolloutPreview, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.preview_rollout", move || {
        let config = state.config_snapshot();
        state.context.services.studio.preview_rollout(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            input,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn start_rollout(
    state: tauri::State<'_, AppState>,
    rollout_id: String,
) -> Result<ManageRolloutRecord, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.start_rollout", move || {
        let config = state.config_snapshot();
        state.context.services.studio.start_rollout(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            rollout_id.as_str(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_node_sessions(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<InternalNodeSessionRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.list_node_sessions", move || {
        let config = state.config_snapshot();
        let _ = state.context.ensure_desktop_host_runtime()?;
        let (desktop_host, desktop_host_status) = state.context.desktop_host_runtime_state()?;
        state.context.services.studio.list_node_sessions(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            desktop_host.as_ref(),
            desktop_host_status.as_ref(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_host_endpoints(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<HostEndpointRecord>, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_host_endpoints", move || {
        let config = state.config_snapshot();
        let _ = state.context.ensure_desktop_host_runtime()?;
        let (desktop_host, _desktop_host_status) = state.context.desktop_host_runtime_state()?;
        state.context.services.studio.get_host_endpoints(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
            desktop_host.as_ref(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_openclaw_runtime(
    state: tauri::State<'_, AppState>,
) -> Result<OpenClawRuntimeProjection, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_openclaw_runtime", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_openclaw_runtime(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_openclaw_gateway(
    state: tauri::State<'_, AppState>,
) -> Result<OpenClawGatewayProjection, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.get_openclaw_gateway", move || {
        let config = state.config_snapshot();
        state.context.services.studio.get_openclaw_gateway(
            &state.paths,
            &config,
            &state.context.services.storage,
            &state.context.services.supervisor,
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn invoke_managed_openclaw_gateway(
    state: tauri::State<'_, AppState>,
    request: OpenClawGatewayInvokeRequest,
) -> Result<Value, String> {
    let state = state.inner().clone();
    runtime::run_blocking_async("studio.invoke_managed_openclaw_gateway", move || {
        let config = state.config_snapshot();
        state
            .context
            .services
            .studio
            .invoke_managed_openclaw_gateway(
                &state.paths,
                &config,
                &state.context.services.storage,
                &state.context.services.supervisor,
                request,
            )
    })
    .await
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use crate::framework::services::studio::{
        StudioInstanceConfig, StudioInstanceDeploymentMode, StudioInstanceIconType,
        StudioInstanceRecord, StudioInstanceStatus, StudioInstanceTransportKind, StudioRuntimeKind,
        StudioStorageBinding,
    };

    fn command_source_segment<'a>(source: &'a str, fn_name: &str) -> &'a str {
        let start = source
            .find(&format!("pub async fn {fn_name}"))
            .expect("command function should exist");
        let rest = &source[start..];
        let end = rest
            .find("\n#[tauri::command]\npub async fn ")
            .map(|offset| start + offset)
            .unwrap_or(source.len());
        &source[start..end]
    }

    #[test]
    fn stable_built_in_openclaw_instances_still_match_status_event_semantics() {
        let instance = StudioInstanceRecord {
            id: "managed-openclaw-primary".to_string(),
            name: "Built-In OpenClaw Primary".to_string(),
            description: Some("Stable built-in OpenClaw identity.".to_string()),
            runtime_kind: StudioRuntimeKind::Openclaw,
            deployment_mode: StudioInstanceDeploymentMode::LocalManaged,
            transport_kind: StudioInstanceTransportKind::OpenclawGatewayWs,
            status: StudioInstanceStatus::Offline,
            is_built_in: true,
            is_default: true,
            icon_type: StudioInstanceIconType::Server,
            version: "2026.4.15".to_string(),
            type_label: "Built-In OpenClaw".to_string(),
            host: "127.0.0.1".to_string(),
            port: Some(21_280),
            base_url: Some("http://127.0.0.1:21280".to_string()),
            websocket_url: Some("ws://127.0.0.1:21280".to_string()),
            cpu: 0,
            memory: 0,
            total_memory: "Unknown".to_string(),
            uptime: "-".to_string(),
            capabilities: vec![],
            storage: StudioStorageBinding {
                profile_id: Some("default-local".to_string()),
                provider: crate::framework::storage::StorageProviderKind::LocalFile,
                namespace: "claw-studio".to_string(),
                database: None,
                connection_hint: None,
                endpoint: None,
            },
            config: StudioInstanceConfig {
                port: "21280".to_string(),
                sandbox: true,
                auto_update: true,
                log_level: "info".to_string(),
                cors_origins: "*".to_string(),
                workspace_path: None,
                base_url: Some("http://127.0.0.1:21280".to_string()),
                websocket_url: Some("ws://127.0.0.1:21280".to_string()),
                auth_token: None,
            },
            created_at: 1,
            updated_at: 1,
            last_seen_at: Some(1),
        };

        assert!(super::is_built_in_openclaw_status_event_instance(&instance));
    }

    #[test]
    fn built_in_lifecycle_commands_emit_status_changed_events_after_manual_actions() {
        let source = include_str!("studio_commands.rs");
        let production_source = source
            .split("#[cfg(test)]")
            .next()
            .expect("production source");

        assert!(
            production_source.contains("fn emit_built_in_openclaw_status_changed_if_needed"),
            "studio commands should centralize built-in OpenClaw status event emission"
        );
        assert!(
            production_source.contains("fn is_built_in_openclaw_status_event_instance"),
            "studio commands should resolve built-in OpenClaw status event targets semantically"
        );

        for fn_name in [
            "studio_start_instance",
            "studio_stop_instance",
            "studio_restart_instance",
        ] {
            let segment = command_source_segment(production_source, fn_name);
            assert!(
                segment.contains("emit_built_in_openclaw_status_changed_if_needed"),
                "{fn_name} should emit the built-in OpenClaw status changed event"
            );
            assert!(
                segment.contains("StudioInstanceStatus::Error"),
                "{fn_name} should emit an error status when the manual lifecycle action fails"
            );
        }
    }

    #[test]
    fn desktop_host_runtime_command_ensures_embedded_host_before_returning_descriptor() {
        let source = include_str!("studio_commands.rs");
        let production_source = source
            .split("#[cfg(test)]")
            .next()
            .expect("production source");
        let segment = command_source_segment(production_source, "get_desktop_host_runtime");

        let ensure_index = segment
            .find("state.context.ensure_desktop_host_runtime()")
            .expect("get_desktop_host_runtime should self-heal the embedded desktop host first");
        let state_index = segment
            .find("state.context.desktop_host_runtime_state()?")
            .expect("get_desktop_host_runtime should read the desktop host state");

        assert!(
            ensure_index < state_index,
            "get_desktop_host_runtime must ensure the embedded host before exposing its descriptor"
        );
    }

    #[test]
    fn desktop_host_projection_commands_ensure_embedded_host_before_reading_shared_state() {
        let source = include_str!("studio_commands.rs");
        let production_source = source
            .split("#[cfg(test)]")
            .next()
            .expect("production source");

        for fn_name in [
            "get_host_platform_status",
            "list_node_sessions",
            "get_host_endpoints",
        ] {
            let segment = command_source_segment(production_source, fn_name);
            let ensure_index = segment
                .find("state.context.ensure_desktop_host_runtime()")
                .unwrap_or_else(|| {
                    panic!("{fn_name} should self-heal the embedded desktop host first")
                });
            let state_index = segment
                .find("state.context.desktop_host_runtime_state()?")
                .unwrap_or_else(|| {
                    panic!("{fn_name} should read the desktop host state after ensuring it")
                });

            assert!(
                ensure_index < state_index,
                "{fn_name} must ensure the embedded host before reading shared desktop host state"
            );
        }
    }

    #[test]
    fn desktop_host_projection_commands_read_snapshot_and_status_atomically() {
        let source = include_str!("studio_commands.rs");
        let production_source = source
            .split("#[cfg(test)]")
            .next()
            .expect("production source");

        for fn_name in [
            "get_desktop_host_runtime",
            "get_host_platform_status",
            "list_node_sessions",
            "get_host_endpoints",
        ] {
            let segment = command_source_segment(production_source, fn_name);
            assert!(
                segment.contains("state.context.desktop_host_runtime_state()?"),
                "{fn_name} should read the desktop host snapshot/status from one locked state projection"
            );
            assert!(
                !segment.contains("state.context.desktop_host_snapshot()")
                    && !segment.contains("state.context.desktop_host_status()"),
                "{fn_name} should not read desktop host snapshot/status through separate lock acquisitions"
            );
        }
    }
}
