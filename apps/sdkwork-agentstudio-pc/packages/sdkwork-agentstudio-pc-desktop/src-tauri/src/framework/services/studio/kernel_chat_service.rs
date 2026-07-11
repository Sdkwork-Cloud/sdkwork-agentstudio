use super::{
    hermes_chat::{
        abort_kernel_chat_run_for_managed_hermes, create_kernel_chat_session_for_managed_hermes,
        delete_kernel_chat_session_for_managed_hermes, get_kernel_chat_run_for_managed_hermes,
        get_kernel_chat_session_for_managed_hermes,
        list_kernel_chat_agent_profiles_for_managed_hermes,
        list_kernel_chat_runs_for_managed_hermes, list_kernel_chat_sessions_for_managed_hermes,
        load_kernel_chat_messages_for_managed_hermes, patch_kernel_chat_session_for_managed_hermes,
        start_kernel_chat_run_for_managed_hermes,
    },
    is_managed_hermes_instance,
    kernel_chat::{
        KernelChatAgentProfile, KernelChatMessage, KernelChatRun, KernelChatSession,
        StudioCreateKernelChatSessionInput, StudioPatchKernelChatSessionInput,
        StudioStartKernelChatRunInput,
    },
    openclaw_chat::{
        is_openclaw_gateway_kernel_chat_instance,
        unsupported_desktop_authoritative_openclaw_kernel_chat_error,
    },
    AppConfig, AppPaths, FrameworkError, Result, StorageService, StudioInstanceDeploymentMode,
    StudioInstanceRecord, StudioRuntimeKind, StudioService,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum KernelChatHandlerKind {
    ManagedHermes,
    OpenClawGateway,
}

fn resolve_kernel_chat_handler(instance: &StudioInstanceRecord) -> Option<KernelChatHandlerKind> {
    if is_managed_hermes_instance(instance) {
        return Some(KernelChatHandlerKind::ManagedHermes);
    }

    if is_openclaw_gateway_kernel_chat_instance(instance) {
        return Some(KernelChatHandlerKind::OpenClawGateway);
    }

    None
}

fn load_kernel_chat_instance(
    service: &StudioService,
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
    instance_id: &str,
) -> Result<StudioInstanceRecord> {
    service
        .get_instance(paths, config, storage, instance_id)?
        .ok_or_else(|| FrameworkError::NotFound(format!("instance \"{instance_id}\"")))
}

fn deployment_mode_label(mode: &StudioInstanceDeploymentMode) -> &'static str {
    match mode {
        StudioInstanceDeploymentMode::LocalManaged => "local-managed",
        StudioInstanceDeploymentMode::LocalExternal => "local-external",
        StudioInstanceDeploymentMode::Remote => "remote",
    }
}

fn runtime_kind_label(kind: &StudioRuntimeKind) -> &str {
    match kind {
        StudioRuntimeKind::Openclaw => "openclaw",
        StudioRuntimeKind::Hermes => "hermes",
        StudioRuntimeKind::Zeroclaw => "zeroclaw",
        StudioRuntimeKind::Ironclaw => "ironclaw",
        StudioRuntimeKind::Custom => "custom",
        StudioRuntimeKind::Other(value) => value.as_str(),
    }
}

fn unsupported_kernel_chat_error(instance: &StudioInstanceRecord) -> FrameworkError {
    if matches!(
        resolve_kernel_chat_handler(instance),
        Some(KernelChatHandlerKind::OpenClawGateway)
    ) {
        return unsupported_desktop_authoritative_openclaw_kernel_chat_error(instance);
    }

    FrameworkError::InvalidOperation(format!(
        "instance \"{}\" does not expose desktop authoritative kernel chat for runtime \"{}\" with deployment mode \"{}\"",
        instance.id,
        runtime_kind_label(&instance.runtime_kind),
        deployment_mode_label(&instance.deployment_mode),
    ))
}

impl StudioService {
    pub fn list_kernel_chat_agent_profiles(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
    ) -> Result<Vec<KernelChatAgentProfile>> {
        let instance = load_kernel_chat_instance(self, paths, config, storage, instance_id)?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                list_kernel_chat_agent_profiles_for_managed_hermes(paths, &instance)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }

    pub fn list_kernel_chat_sessions(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
    ) -> Result<Vec<KernelChatSession>> {
        let instance = load_kernel_chat_instance(self, paths, config, storage, instance_id)?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                list_kernel_chat_sessions_for_managed_hermes(paths, &instance)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }

    pub fn get_kernel_chat_session(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
        session_id: &str,
    ) -> Result<Option<KernelChatSession>> {
        let instance = load_kernel_chat_instance(self, paths, config, storage, instance_id)?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                get_kernel_chat_session_for_managed_hermes(paths, &instance, session_id)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }

    pub fn create_kernel_chat_session(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        input: StudioCreateKernelChatSessionInput,
    ) -> Result<KernelChatSession> {
        let instance =
            load_kernel_chat_instance(self, paths, config, storage, input.instance_id.as_str())?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                create_kernel_chat_session_for_managed_hermes(paths, &instance, input)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }

    pub fn list_kernel_chat_runs(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
        session_id: &str,
    ) -> Result<Vec<KernelChatRun>> {
        let instance = load_kernel_chat_instance(self, paths, config, storage, instance_id)?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                list_kernel_chat_runs_for_managed_hermes(paths, &instance, session_id)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }

    pub fn get_kernel_chat_run(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
        session_id: &str,
        run_id: &str,
    ) -> Result<Option<KernelChatRun>> {
        let instance = load_kernel_chat_instance(self, paths, config, storage, instance_id)?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                get_kernel_chat_run_for_managed_hermes(paths, &instance, session_id, run_id)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }

    pub fn patch_kernel_chat_session(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        input: StudioPatchKernelChatSessionInput,
    ) -> Result<KernelChatSession> {
        let instance =
            load_kernel_chat_instance(self, paths, config, storage, input.instance_id.as_str())?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                patch_kernel_chat_session_for_managed_hermes(paths, &instance, input)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }

    pub fn delete_kernel_chat_session(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
        session_id: &str,
    ) -> Result<()> {
        let instance = load_kernel_chat_instance(self, paths, config, storage, instance_id)?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                delete_kernel_chat_session_for_managed_hermes(paths, &instance, session_id)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }

    pub fn start_kernel_chat_run(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        input: StudioStartKernelChatRunInput,
    ) -> Result<KernelChatRun> {
        let instance =
            load_kernel_chat_instance(self, paths, config, storage, input.instance_id.as_str())?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                start_kernel_chat_run_for_managed_hermes(paths, &instance, input)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }

    pub fn abort_kernel_chat_run(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
        session_id: &str,
        run_id: Option<&str>,
    ) -> Result<bool> {
        let instance = load_kernel_chat_instance(self, paths, config, storage, instance_id)?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                abort_kernel_chat_run_for_managed_hermes(&instance, session_id, run_id)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }

    pub fn load_kernel_chat_messages(
        &self,
        paths: &AppPaths,
        config: &AppConfig,
        storage: &StorageService,
        instance_id: &str,
        session_id: &str,
    ) -> Result<Vec<KernelChatMessage>> {
        let instance = load_kernel_chat_instance(self, paths, config, storage, instance_id)?;
        match resolve_kernel_chat_handler(&instance) {
            Some(KernelChatHandlerKind::ManagedHermes) => {
                load_kernel_chat_messages_for_managed_hermes(paths, &instance, session_id)
            }
            Some(KernelChatHandlerKind::OpenClawGateway) => {
                Err(unsupported_kernel_chat_error(&instance))
            }
            None => Err(unsupported_kernel_chat_error(&instance)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        resolve_kernel_chat_handler, unsupported_kernel_chat_error, KernelChatHandlerKind,
    };
    use crate::framework::{
        services::studio::{
            StudioInstanceConfig, StudioInstanceDeploymentMode, StudioInstanceIconType,
            StudioInstanceRecord, StudioInstanceStatus, StudioInstanceTransportKind,
            StudioRuntimeKind, StudioStorageBinding,
        },
        storage::StorageProviderKind,
    };

    fn build_instance(
        runtime_kind: StudioRuntimeKind,
        deployment_mode: StudioInstanceDeploymentMode,
    ) -> StudioInstanceRecord {
        StudioInstanceRecord {
            id: "instance".to_string(),
            name: "Instance".to_string(),
            description: None,
            runtime_kind,
            deployment_mode,
            transport_kind: StudioInstanceTransportKind::CustomHttp,
            status: StudioInstanceStatus::Offline,
            is_built_in: false,
            is_default: false,
            icon_type: StudioInstanceIconType::Box,
            version: "0.0.0".to_string(),
            type_label: "Test".to_string(),
            host: "127.0.0.1".to_string(),
            port: None,
            base_url: None,
            websocket_url: None,
            cpu: 0,
            memory: 0,
            total_memory: "0 B".to_string(),
            uptime: "0s".to_string(),
            capabilities: vec![],
            storage: StudioStorageBinding {
                profile_id: Some("default".to_string()),
                provider: StorageProviderKind::LocalFile,
                namespace: "test".to_string(),
                database: None,
                connection_hint: None,
                endpoint: None,
            },
            config: StudioInstanceConfig {
                port: String::new(),
                sandbox: false,
                auto_update: false,
                log_level: "info".to_string(),
                cors_origins: String::new(),
                workspace_path: None,
                base_url: None,
                websocket_url: None,
                auth_token: None,
            },
            created_at: 0,
            updated_at: 0,
            last_seen_at: None,
        }
    }

    #[test]
    fn kernel_chat_dispatcher_routes_local_managed_hermes_to_the_hermes_handler() {
        let instance = build_instance(
            StudioRuntimeKind::Hermes,
            StudioInstanceDeploymentMode::LocalManaged,
        );

        assert_eq!(
            resolve_kernel_chat_handler(&instance),
            Some(KernelChatHandlerKind::ManagedHermes)
        );
    }

    #[test]
    fn kernel_chat_dispatcher_routes_built_in_openclaw_to_the_gateway_handler() {
        let instance = build_instance(
            StudioRuntimeKind::Openclaw,
            StudioInstanceDeploymentMode::LocalManaged,
        );

        assert_eq!(
            resolve_kernel_chat_handler(&instance),
            Some(KernelChatHandlerKind::OpenClawGateway)
        );
    }

    #[test]
    fn kernel_chat_dispatcher_does_not_treat_local_external_hermes_as_a_managed_hermes_handler_target(
    ) {
        let instance = build_instance(
            StudioRuntimeKind::Hermes,
            StudioInstanceDeploymentMode::LocalExternal,
        );

        assert_eq!(resolve_kernel_chat_handler(&instance), None);
    }

    #[test]
    fn kernel_chat_dispatcher_routes_gateway_transport_instances_to_the_openclaw_gateway_handler() {
        let mut instance = build_instance(
            StudioRuntimeKind::Custom,
            StudioInstanceDeploymentMode::Remote,
        );
        instance.transport_kind = StudioInstanceTransportKind::OpenclawGatewayWs;

        assert_eq!(
            resolve_kernel_chat_handler(&instance),
            Some(KernelChatHandlerKind::OpenClawGateway)
        );
    }

    #[test]
    fn openclaw_kernel_chat_error_explains_gateway_authority_instead_of_generic_unsupported_runtime(
    ) {
        let instance = build_instance(
            StudioRuntimeKind::Openclaw,
            StudioInstanceDeploymentMode::LocalManaged,
        );

        let error = unsupported_kernel_chat_error(&instance);

        assert!(
            error
                .to_string()
                .contains("gateway-authoritative kernel chat"),
            "OpenClaw kernel chat errors should direct callers to gateway authority",
        );
    }
}
