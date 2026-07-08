use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Debug;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use reqwest::Client;
use sdkwork_clawstudio_host_core::openclaw_control_plane::{
    OpenClawControlPlane, OpenClawGatewayInvokeRequest as ControlPlaneOpenClawGatewayInvokeRequest,
};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Number, Value};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioOpenClawGatewayInvokeRequest {
    pub tool: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dry_run: Option<bool>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StudioOpenClawGatewayInvokeOptions {
    pub message_channel: Option<String>,
    pub account_id: Option<String>,
    pub headers: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioOpenClawGatewayInvokePayload {
    pub request: StudioOpenClawGatewayInvokeRequest,
    #[serde(default)]
    pub options: StudioOpenClawGatewayInvokeOptions,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioCreateKernelChatSessionInput {
    pub instance_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioPatchKernelChatSessionInput {
    pub instance_id: String,
    pub session_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thinking_level: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fast_mode: Option<Option<bool>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verbose_level: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning_level: Option<Option<String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioStartKernelChatRunInput {
    pub instance_id: String,
    pub session_id: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StudioAbortKernelChatRunInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
}

pub trait StudioPublicApiProvider: Send + Sync + Debug {
    fn list_instances(&self) -> Result<Value, String>;
    fn create_instance(&self, input: Value) -> Result<Value, String>;
    fn get_instance(&self, id: &str) -> Result<Option<Value>, String>;
    fn update_instance(&self, id: &str, input: Value) -> Result<Value, String>;
    fn delete_instance(&self, id: &str) -> Result<bool, String>;
    fn start_instance(&self, id: &str) -> Result<Option<Value>, String>;
    fn stop_instance(&self, id: &str) -> Result<Option<Value>, String>;
    fn restart_instance(&self, id: &str) -> Result<Option<Value>, String>;
    fn get_instance_detail(&self, id: &str) -> Result<Option<Value>, String>;
    fn get_instance_config(&self, id: &str) -> Result<Option<Value>, String>;
    fn update_instance_config(&self, id: &str, config: Value) -> Result<Option<Value>, String>;
    fn get_instance_logs(&self, id: &str) -> Result<String, String>;
    fn list_kernel_chat_agent_profiles(&self, instance_id: &str) -> Result<Value, String>;
    fn list_kernel_chat_sessions(&self, instance_id: &str) -> Result<Value, String>;
    fn get_kernel_chat_session(
        &self,
        instance_id: &str,
        session_id: &str,
    ) -> Result<Option<Value>, String>;
    fn create_kernel_chat_session(&self, input: Value) -> Result<Value, String>;
    fn list_kernel_chat_runs(&self, instance_id: &str, session_id: &str) -> Result<Value, String>;
    fn get_kernel_chat_run(
        &self,
        instance_id: &str,
        session_id: &str,
        run_id: &str,
    ) -> Result<Option<Value>, String>;
    fn patch_kernel_chat_session(&self, input: Value) -> Result<Value, String>;
    fn delete_kernel_chat_session(&self, instance_id: &str, session_id: &str)
        -> Result<(), String>;
    fn start_kernel_chat_run(&self, input: Value) -> Result<Value, String>;
    fn abort_kernel_chat_run(
        &self,
        instance_id: &str,
        session_id: &str,
        run_id: Option<String>,
    ) -> Result<bool, String>;
    fn load_kernel_chat_messages(&self, instance_id: &str, session_id: &str)
        -> Result<Value, String>;
    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value, String>;
    fn list_conversations(&self, instance_id: &str) -> Result<Value, String>;
    fn put_conversation(&self, id: &str, record: Value) -> Result<Value, String>;
    fn delete_conversation(&self, id: &str) -> Result<bool, String>;
    fn create_instance_task(&self, instance_id: &str, payload: Value) -> Result<(), String>;
    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> Result<(), String>;
    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> Result<bool, String>;
    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> Result<bool, String>;
    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> Result<(), String>;
    fn run_instance_task_now(&self, instance_id: &str, task_id: &str) -> Result<Value, String>;
    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Value, String>;
    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> Result<(), String>;
    fn delete_instance_task(&self, instance_id: &str, task_id: &str) -> Result<bool, String>;
}

pub trait TypedStudioPublicApiBackend: Send + Sync + Debug {
    type InstanceRecord: Serialize;
    type CreateInstanceInput: DeserializeOwned;
    type UpdateInstanceInput: DeserializeOwned;
    type InstanceDetailRecord: Serialize;
    type InstanceConfigRecord: Serialize + DeserializeOwned;
    type ConversationRecord: Serialize + DeserializeOwned;

    fn list_instances(&self) -> Result<Vec<Self::InstanceRecord>, String>;
    fn create_instance(
        &self,
        input: Self::CreateInstanceInput,
    ) -> Result<Self::InstanceRecord, String>;
    fn get_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String>;
    fn update_instance(
        &self,
        id: &str,
        input: Self::UpdateInstanceInput,
    ) -> Result<Self::InstanceRecord, String>;
    fn delete_instance(&self, id: &str) -> Result<bool, String>;
    fn start_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String>;
    fn stop_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String>;
    fn restart_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String>;
    fn get_instance_detail(&self, id: &str) -> Result<Option<Self::InstanceDetailRecord>, String>;
    fn get_instance_config(&self, id: &str) -> Result<Option<Self::InstanceConfigRecord>, String>;
    fn update_instance_config(
        &self,
        id: &str,
        config: Self::InstanceConfigRecord,
    ) -> Result<Option<Self::InstanceConfigRecord>, String>;
    fn get_instance_logs(&self, id: &str) -> Result<String, String>;
    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value, String>;
    fn list_conversations(
        &self,
        instance_id: &str,
    ) -> Result<Vec<Self::ConversationRecord>, String>;
    fn put_conversation(
        &self,
        id: &str,
        record: Self::ConversationRecord,
    ) -> Result<Self::ConversationRecord, String>;
    fn delete_conversation(&self, id: &str) -> Result<bool, String>;
    fn create_instance_task(&self, instance_id: &str, payload: Value) -> Result<(), String>;
    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> Result<(), String>;
    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> Result<bool, String>;
    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> Result<bool, String>;
    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> Result<(), String>;
    fn run_instance_task_now(&self, instance_id: &str, task_id: &str) -> Result<Value, String>;
    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Vec<Value>, String>;
    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> Result<(), String>;
    fn delete_instance_task(&self, instance_id: &str, task_id: &str) -> Result<bool, String>;
}

pub fn build_default_studio_public_api_provider(
    data_dir: PathBuf,
    openclaw_control_plane: Arc<OpenClawControlPlane>,
) -> Result<Arc<dyn StudioPublicApiProvider>, String> {
    Ok(Arc::new(ServerStudioPublicApiProvider::new(
        data_dir,
        openclaw_control_plane,
    )?))
}

pub fn build_typed_studio_public_api_provider<B>(backend: B) -> Arc<dyn StudioPublicApiProvider>
where
    B: TypedStudioPublicApiBackend + 'static,
{
    Arc::new(TypedStudioPublicApiProvider { backend })
}

const BUILT_IN_INSTANCE_ID: &str = "managed-openclaw-primary";
const DEFAULT_PORT: u16 = 21_280;
const STORAGE_DIR_NAME: &str = "studio-public-api";
const INSTANCES_FILE_NAME: &str = "instances.json";
const CONVERSATIONS_FILE_NAME: &str = "conversations.json";
const WORKBENCHES_FILE_NAME: &str = "workbenches.json";
const KERNEL_CHATS_FILE_NAME: &str = "kernel-chats.json";
const DEFAULT_OPENCLAW_PROVIDER_ID: &str = "openai";
const DEFAULT_OPENCLAW_AGENT_FILE_ID: &str = "/workspace/main/AGENTS.md";
const DEFAULT_OPENCLAW_MEMORY_FILE_ID: &str = "/workspace/main/MEMORY.md";
const DEFAULT_OPENCLAW_CONFIG_FILE_ID: &str = "/workspace/main/openclaw.json";
const DEFAULT_KERNEL_CHAT_SESSION_TITLE: &str = "New Chat";
const DEFAULT_HERMES_AGENT_ID: &str = "hermes-default";
const DEFAULT_HERMES_AGENT_LABEL: &str = "Hermes";

#[derive(Debug)]
struct ServerStudioPublicApiProvider {
    storage_dir: PathBuf,
    openclaw_control_plane: Arc<OpenClawControlPlane>,
    io_lock: Mutex<()>,
}

#[derive(Debug)]
struct TypedStudioPublicApiProvider<B>
where
    B: TypedStudioPublicApiBackend,
{
    backend: B,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct InstancesDocument {
    built_in_instance: Option<Value>,
    custom_instances: Vec<Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct ConversationsDocument {
    conversations: Vec<Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct WorkbenchesDocument {
    workbenches: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct KernelChatsDocument {
    instances: BTreeMap<String, StoredKernelChatInstance>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct StoredKernelChatInstance {
    sessions: BTreeMap<String, StoredKernelChatSession>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct StoredKernelChatSession {
    title: Option<String>,
    model: Option<String>,
    thinking_level: Option<String>,
    fast_mode: Option<bool>,
    verbose_level: Option<String>,
    reasoning_level: Option<String>,
    agent_id: Option<String>,
    created_at: u64,
    updated_at: u64,
    messages: Vec<StoredKernelChatMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredKernelChatMessage {
    id: String,
    role: String,
    text: String,
    created_at: u64,
    updated_at: u64,
    run_id: Option<String>,
    model: Option<String>,
    sender_label: Option<String>,
    native_metadata: Option<Value>,
}

#[derive(Debug, Clone)]
struct ProjectedKernelChatRun {
    id: String,
    created_at: u64,
    updated_at: u64,
    model: Option<String>,
    has_assistant_message: bool,
}

#[derive(Debug, Clone)]
struct BuiltInEndpointProjection {
    host: String,
    requested_port: Option<u16>,
    active_port: Option<u16>,
    base_url: Option<String>,
    websocket_url: Option<String>,
}

impl ServerStudioPublicApiProvider {
    fn new(
        data_dir: PathBuf,
        openclaw_control_plane: Arc<OpenClawControlPlane>,
    ) -> Result<Self, String> {
        let storage_dir = data_dir.join(STORAGE_DIR_NAME);
        fs::create_dir_all(&storage_dir)
            .map_err(|error| format!("create studio public api storage dir: {error}"))?;
        Ok(Self {
            storage_dir,
            openclaw_control_plane,
            io_lock: Mutex::new(()),
        })
    }

    fn with_io_lock<T, F>(&self, action: F) -> Result<T, String>
    where
        F: FnOnce(&Self) -> Result<T, String>,
    {
        let _guard = self
            .io_lock
            .lock()
            .map_err(|_| "lock studio public api storage".to_string())?;
        action(self)
    }

    fn instances_path(&self) -> PathBuf {
        self.storage_dir.join(INSTANCES_FILE_NAME)
    }

    fn conversations_path(&self) -> PathBuf {
        self.storage_dir.join(CONVERSATIONS_FILE_NAME)
    }

    fn workbenches_path(&self) -> PathBuf {
        self.storage_dir.join(WORKBENCHES_FILE_NAME)
    }

    fn kernel_chats_path(&self) -> PathBuf {
        self.storage_dir.join(KERNEL_CHATS_FILE_NAME)
    }

    fn read_instances(&self) -> Result<InstancesDocument, String> {
        let mut document = read_json_document(&self.instances_path())?;
        if normalize_default_instance_selection(&mut document) {
            self.write_instances(&document)?;
        }
        Ok(document)
    }

    fn write_instances(&self, document: &InstancesDocument) -> Result<(), String> {
        write_json_document(&self.instances_path(), document)
    }

    fn read_conversations(&self) -> Result<ConversationsDocument, String> {
        read_json_document(&self.conversations_path())
    }

    fn write_conversations(&self, document: &ConversationsDocument) -> Result<(), String> {
        write_json_document(&self.conversations_path(), document)
    }

    fn read_workbenches(&self) -> Result<WorkbenchesDocument, String> {
        read_json_document(&self.workbenches_path())
    }

    fn write_workbenches(&self, document: &WorkbenchesDocument) -> Result<(), String> {
        write_json_document(&self.workbenches_path(), document)
    }

    fn read_kernel_chats(&self) -> Result<KernelChatsDocument, String> {
        read_json_document(&self.kernel_chats_path())
    }

    fn write_kernel_chats(&self, document: &KernelChatsDocument) -> Result<(), String> {
        write_json_document(&self.kernel_chats_path(), document)
    }

    fn require_managed_hermes_kernel_chat_instance(&self, instance_id: &str) -> Result<Value, String> {
        let instances = self.read_instances()?;
        let instance = self
            .get_projected_instance(&instances, instance_id)
            .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;

        if !is_managed_hermes_kernel_chat_instance(&instance) {
            return Err(format!(
                "studio instance \"{instance_id}\" does not expose managed Hermes kernel chat"
            ));
        }

        Ok(instance)
    }

    fn built_in_status(&self) -> &'static str {
        let now = unix_timestamp_ms();
        let runtime = self.openclaw_control_plane.get_runtime(now);
        let gateway = self.openclaw_control_plane.get_gateway(now);
        if runtime.lifecycle == "ready" || gateway.lifecycle == "ready" {
            "online"
        } else if runtime.lifecycle == "starting" || gateway.lifecycle == "starting" {
            "starting"
        } else if runtime.lifecycle == "degraded" || gateway.lifecycle == "degraded" {
            "error"
        } else {
            "offline"
        }
    }

    fn built_in_endpoint_projection(&self) -> BuiltInEndpointProjection {
        let updated_at = unix_timestamp_ms();
        let runtime = self.openclaw_control_plane.get_runtime(updated_at);
        let gateway = self.openclaw_control_plane.get_gateway(updated_at);
        let endpoint_id = gateway
            .endpoint_id
            .clone()
            .or_else(|| runtime.endpoint_id.clone());
        let endpoint = endpoint_id.as_deref().and_then(|target| {
            self.openclaw_control_plane
                .list_host_endpoints()
                .into_iter()
                .find(|candidate| candidate.endpoint_id == target)
        });
        let host = endpoint
            .as_ref()
            .map(|record| record.bind_host.clone())
            .unwrap_or_else(|| "127.0.0.1".to_string());
        let active_port = gateway.active_port.or(runtime.active_port);
        let requested_port = gateway.requested_port.or(runtime.requested_port);
        let base_url = gateway.base_url.or(runtime.base_url);
        let websocket_url = gateway
            .websocket_url
            .or(runtime.websocket_url)
            .or_else(|| derive_websocket_endpoint(base_url.as_deref(), host.as_str(), active_port));

        BuiltInEndpointProjection {
            host,
            requested_port,
            active_port,
            base_url,
            websocket_url,
        }
    }

    fn built_in_instance_id_from_raw(raw: Option<&Value>) -> String {
        raw.and_then(|value| non_empty_string(value.get("id")))
            .map(|value| canonical_built_in_instance_id(value.as_str()).to_string())
            .filter(|value| value == BUILT_IN_INSTANCE_ID)
            .unwrap_or_else(|| BUILT_IN_INSTANCE_ID.to_string())
    }

    fn built_in_instance_id(&self, document: &InstancesDocument) -> String {
        Self::built_in_instance_id_from_raw(document.built_in_instance.as_ref())
    }

    fn project_built_in_instance(&self, raw: Option<Value>) -> Value {
        let built_in_id = Self::built_in_instance_id_from_raw(raw.as_ref());
        let endpoint = self.built_in_endpoint_projection();
        let config_port = endpoint.requested_port.unwrap_or(DEFAULT_PORT);
        let projected_port = endpoint.active_port.or(endpoint.requested_port);
        let mut baseline = json!({
            "id": BUILT_IN_INSTANCE_ID,
            "name": "Local Built-In",
            "description": "Packaged local OpenClaw kernel managed by Claw Studio.",
            "runtimeKind": "openclaw",
            "deploymentMode": "local-managed",
            "transportKind": "openclawGatewayWs",
            "status": self.built_in_status(),
            "isBuiltIn": true,
            "isDefault": true,
            "iconType": "server",
            "version": env!("CARGO_PKG_VERSION"),
            "typeLabel": "Built-In OpenClaw",
            "host": endpoint.host,
            "port": projected_port.map(Number::from).map(Value::Number).unwrap_or(Value::Null),
            "baseUrl": endpoint.base_url.clone().map(Value::String).unwrap_or(Value::Null),
            "websocketUrl": endpoint.websocket_url.clone().map(Value::String).unwrap_or(Value::Null),
            "cpu": 0,
            "memory": 0,
            "totalMemory": "Unknown",
            "uptime": "-",
            "capabilities": ["chat", "health", "files", "memory", "tasks", "tools", "models"],
            "storage": { "provider": "localFile", "namespace": "claw-studio" },
            "config": default_instance_config(
                config_port,
                endpoint.base_url.as_deref(),
                endpoint.websocket_url.as_deref(),
            ),
            "createdAt": unix_timestamp_ms(),
            "updatedAt": unix_timestamp_ms(),
            "lastSeenAt": Value::Null
        });
        if let Some(raw) = raw {
            merge_values(&mut baseline, raw);
        }
        self.normalize_instance(baseline, built_in_id.as_str(), true)
    }

    fn project_custom_instance(&self, raw: Value) -> Option<Value> {
        let id = raw.get("id").and_then(Value::as_str)?.to_string();
        Some(self.normalize_instance(raw, id.as_str(), false))
    }

    fn normalize_instance(&self, raw: Value, id: &str, built_in: bool) -> Value {
        let updated_at = unix_timestamp_ms();
        let mut object = into_object(raw);
        let built_in_endpoint = built_in.then(|| self.built_in_endpoint_projection());
        let runtime_kind = if built_in {
            "openclaw".to_string()
        } else {
            object
                .get("runtimeKind")
                .and_then(Value::as_str)
                .unwrap_or("openclaw")
                .to_string()
        };
        let deployment_mode = if built_in {
            "local-managed".to_string()
        } else {
            object
                .get("deploymentMode")
                .and_then(Value::as_str)
                .unwrap_or("remote")
                .to_string()
        };
        let transport_kind = if built_in {
            "openclawGatewayWs".to_string()
        } else {
            object
                .get("transportKind")
                .and_then(Value::as_str)
                .unwrap_or("openclawGatewayWs")
                .to_string()
        };
        let host = if built_in {
            built_in_endpoint
                .as_ref()
                .map(|endpoint| endpoint.host.clone())
                .unwrap_or_else(|| "127.0.0.1".to_string())
        } else {
            object
                .get("host")
                .and_then(Value::as_str)
                .unwrap_or("127.0.0.1")
                .to_string()
        };
        let requested_port = value_as_u16(object.get("port")).or_else(|| {
            object
                .get("config")
                .and_then(Value::as_object)
                .and_then(|config| value_as_u16(config.get("port")))
        });
        let config_port = if built_in {
            built_in_endpoint
                .as_ref()
                .and_then(|endpoint| endpoint.requested_port)
                .or(requested_port)
                .unwrap_or(DEFAULT_PORT)
        } else {
            requested_port.unwrap_or(DEFAULT_PORT)
        };
        let configured_base_url = if built_in {
            None
        } else {
            non_empty_string(object.get("baseUrl"))
                .or_else(|| {
                    object
                        .get("config")
                        .and_then(Value::as_object)
                        .and_then(|config| non_empty_string(config.get("baseUrl")))
                })
        };
        let configured_websocket_url = if built_in {
            None
        } else {
            non_empty_string(object.get("websocketUrl"))
                .or_else(|| {
                    object
                        .get("config")
                        .and_then(Value::as_object)
                        .and_then(|config| non_empty_string(config.get("websocketUrl")))
                })
        };
        let explicit_base_url_override = !built_in
            && (object.contains_key("baseUrl")
                || object
                    .get("config")
                    .and_then(Value::as_object)
                    .is_some_and(|config| config.contains_key("baseUrl")));
        let explicit_websocket_url_override = !built_in
            && (object.contains_key("websocketUrl")
                || object
                    .get("config")
                    .and_then(Value::as_object)
                    .is_some_and(|config| config.contains_key("websocketUrl")));
        let projected_port = if built_in {
            built_in_endpoint
                .as_ref()
                .and_then(|endpoint| endpoint.active_port.or(endpoint.requested_port))
        } else {
            Some(config_port)
        };
        let supports_ws =
            built_in || transport_kind == "openclawGatewayWs" || transport_kind == "customWs";
        let base_url = if built_in {
            built_in_endpoint
                .as_ref()
                .and_then(|endpoint| endpoint.base_url.clone())
        } else if explicit_base_url_override {
            configured_base_url.clone()
        } else {
            configured_base_url
                .clone()
                .or_else(|| Some(format!("http://{host}:{config_port}")))
        };
        let websocket_url = if built_in {
            built_in_endpoint
                .as_ref()
                .and_then(|endpoint| endpoint.websocket_url.clone())
        } else if explicit_websocket_url_override {
            configured_websocket_url.clone()
        } else {
            configured_websocket_url.clone().or_else(|| {
                if supports_ws {
                    derive_websocket_endpoint(base_url.as_deref(), host.as_str(), Some(config_port))
                } else {
                    None
                }
            })
        };
        let created_at = object
            .get("createdAt")
            .and_then(Value::as_u64)
            .unwrap_or(updated_at);
        let status = object
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or(if built_in {
                self.built_in_status()
            } else {
                "offline"
            })
            .to_string();

        object.insert("id".to_string(), Value::String(id.to_string()));
        object.insert(
            "name".to_string(),
            Value::String(
                object
                    .get("name")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| {
                        if built_in {
                            "Local Built-In".to_string()
                        } else {
                            "Custom instance".to_string()
                        }
                    }),
            ),
        );
        object.insert(
            "runtimeKind".to_string(),
            Value::String(runtime_kind.clone()),
        );
        object.insert(
            "deploymentMode".to_string(),
            Value::String(deployment_mode.clone()),
        );
        object.insert(
            "transportKind".to_string(),
            Value::String(transport_kind.clone()),
        );
        object.insert("status".to_string(), Value::String(status.clone()));
        object.insert("host".to_string(), Value::String(host.clone()));
        object.insert(
            "port".to_string(),
            projected_port
                .map(Number::from)
                .map(Value::Number)
                .unwrap_or(Value::Null),
        );
        object.insert(
            "baseUrl".to_string(),
            base_url
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null),
        );
        object.insert(
            "websocketUrl".to_string(),
            websocket_url
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null),
        );
        object.insert("isBuiltIn".to_string(), Value::Bool(built_in));
        object.insert(
            "isDefault".to_string(),
            Value::Bool(
                object
                    .get("isDefault")
                    .and_then(Value::as_bool)
                    .unwrap_or(built_in),
            ),
        );
        object.insert(
            "iconType".to_string(),
            Value::String(if built_in || deployment_mode == "remote" {
                "server".to_string()
            } else {
                "box".to_string()
            }),
        );
        object.insert(
            "version".to_string(),
            Value::String(
                object
                    .get("version")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string()),
            ),
        );
        object.insert(
            "typeLabel".to_string(),
            Value::String(
                object
                    .get("typeLabel")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| {
                        if built_in {
                            "Built-In OpenClaw".to_string()
                        } else {
                            format!("{runtime_kind} ({deployment_mode})")
                        }
                    }),
            ),
        );
        object.insert(
            "createdAt".to_string(),
            Value::Number(Number::from(created_at)),
        );
        object.insert(
            "updatedAt".to_string(),
            Value::Number(Number::from(updated_at)),
        );
        object.insert(
            "lastSeenAt".to_string(),
            if status == "online" {
                Value::Number(Number::from(updated_at))
            } else {
                object.get("lastSeenAt").cloned().unwrap_or(Value::Null)
            },
        );
        object.insert(
            "capabilities".to_string(),
            normalize_capabilities(object.get("capabilities").cloned(), runtime_kind.as_str()),
        );
        object.insert(
            "storage".to_string(),
            normalize_storage(
                object.get("storage").cloned(),
                if built_in { "claw-studio" } else { id },
                if deployment_mode == "remote" {
                    "remoteApi"
                } else {
                    "localFile"
                },
            ),
        );
        object.insert(
            "config".to_string(),
            normalize_config(
                object.get("config").cloned(),
                config_port,
                host.as_str(),
                supports_ws,
                base_url.as_deref(),
                websocket_url.as_deref(),
                built_in
                    || explicit_base_url_override
                    || explicit_websocket_url_override
                    || configured_base_url.is_some()
                    || configured_websocket_url.is_some(),
            ),
        );
        if explicit_base_url_override || explicit_websocket_url_override {
            if let Some(config) = object.get_mut("config").and_then(Value::as_object_mut) {
                if explicit_base_url_override && configured_base_url.is_none() {
                    config.insert("baseUrl".to_string(), Value::Null);
                }
                if explicit_websocket_url_override && configured_websocket_url.is_none() {
                    config.insert("websocketUrl".to_string(), Value::Null);
                }
            }
        }
        Value::Object(object)
    }

    fn list_projected_instances(&self, document: &InstancesDocument) -> Vec<Value> {
        let mut items = vec![self.project_built_in_instance(document.built_in_instance.clone())];
        let mut custom = document
            .custom_instances
            .iter()
            .filter_map(|value| self.project_custom_instance(value.clone()))
            .collect::<Vec<_>>();
        custom.sort_by(|left, right| {
            let left_updated = left.get("updatedAt").and_then(Value::as_u64).unwrap_or(0);
            let right_updated = right.get("updatedAt").and_then(Value::as_u64).unwrap_or(0);
            right_updated.cmp(&left_updated)
        });
        items.extend(custom);
        items
    }

    fn get_projected_instance(&self, document: &InstancesDocument, id: &str) -> Option<Value> {
        let built_in = self.project_built_in_instance(document.built_in_instance.clone());
        if built_in.get("id").and_then(Value::as_str) == Some(id.trim()) {
            return Some(built_in);
        }
        document
            .custom_instances
            .iter()
            .find(|value| value.get("id").and_then(Value::as_str) == Some(id))
            .and_then(|value| self.project_custom_instance(value.clone()))
    }

    fn project_conversation(&self, id: &str, raw: Value, built_in_instance_id: &str) -> Value {
        let updated_at = unix_timestamp_ms();
        let mut object = into_object(raw);
        let messages = object
            .get("messages")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let primary_instance_id = object
            .get("primaryInstanceId")
            .and_then(Value::as_str)
            .map(|value| canonicalize_built_in_instance_value(value, built_in_instance_id))
            .unwrap_or_else(|| built_in_instance_id.to_string());
        let participant_instance_ids = object
            .get("participantInstanceIds")
            .and_then(Value::as_array)
            .cloned()
            .map(|items| {
                Value::Array(
                    items.into_iter()
                        .filter_map(|item| item.as_str().map(|value| {
                            Value::String(canonicalize_built_in_instance_value(
                                value,
                                built_in_instance_id,
                            ))
                        }))
                        .collect(),
                )
            })
            .unwrap_or_else(|| {
                Value::Array(vec![Value::String(built_in_instance_id.to_string())])
            });
        object.insert("id".to_string(), Value::String(id.to_string()));
        object.insert(
            "title".to_string(),
            Value::String(
                object
                    .get("title")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| format!("Conversation {id}")),
            ),
        );
        object.insert(
            "primaryInstanceId".to_string(),
            Value::String(primary_instance_id),
        );
        object.insert(
            "participantInstanceIds".to_string(),
            participant_instance_ids,
        );
        object.insert(
            "createdAt".to_string(),
            Value::Number(Number::from(
                object
                    .get("createdAt")
                    .and_then(Value::as_u64)
                    .unwrap_or(updated_at),
            )),
        );
        object.insert(
            "updatedAt".to_string(),
            Value::Number(Number::from(updated_at)),
        );
        object.insert(
            "messageCount".to_string(),
            Value::Number(Number::from(messages.len() as u64)),
        );
        object.insert("messages".to_string(), Value::Array(messages));
        Value::Object(object)
    }

    fn instance_logs(&self, instance: &Value) -> String {
        let id = instance
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or(BUILT_IN_INSTANCE_ID);
        let status = instance
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("offline");
        let transport = instance
            .get("transportKind")
            .and_then(Value::as_str)
            .unwrap_or("openclawGatewayWs");
        let updated_at = instance
            .get("updatedAt")
            .and_then(Value::as_u64)
            .unwrap_or_else(unix_timestamp_ms);
        format!(
            "[{updated_at}] instance={id} status={status}\n[{updated_at}] transport={transport}"
        )
    }

    fn instance_workbench(
        &self,
        document: &mut WorkbenchesDocument,
        instance: &Value,
    ) -> Option<Value> {
        if !is_openclaw_workbench_instance(instance) {
            return None;
        }

        let instance_id = instance
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or(BUILT_IN_INSTANCE_ID)
            .to_string();
        let current = document
            .workbenches
            .get(instance_id.as_str())
            .cloned()
            .unwrap_or_else(|| create_default_workbench_snapshot(instance));
        let next = synchronize_workbench_snapshot(instance, current);
        document.workbenches.insert(instance_id, next.clone());
        Some(next)
    }

    fn instance_detail(&self, instance: &Value, workbench: Option<Value>) -> Value {
        let logs = self.instance_logs(instance);
        let status = instance
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("offline");
        let deployment_mode = instance
            .get("deploymentMode")
            .and_then(Value::as_str)
            .unwrap_or("remote");
        let base_url = normalized_instance_base_url(instance);
        let is_built_in = instance
            .get("isBuiltIn")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let openclaw_workbench_instance = is_openclaw_workbench_instance(instance);
        let workbench_managed = openclaw_workbench_instance && workbench.is_some();
        let endpoint_observed = openclaw_workbench_instance;
        let console_access = build_console_access(instance, workbench.as_ref());
        let lifecycle_owner = if deployment_mode == "remote" {
            "remoteService"
        } else if is_built_in && deployment_mode == "local-managed" {
            "appManaged"
        } else {
            "externalProcess"
        };
        let config_writable = openclaw_workbench_instance;
        let lifecycle_notes = if lifecycle_owner == "appManaged" {
            vec![
                Value::String(
                    "Runtime is hosted by the server control plane, but shared studio lifecycle control is disabled until a real controller is implemented."
                        .to_string(),
                ),
            ]
        } else if lifecycle_owner == "externalProcess" {
            vec![
                Value::String(
                    "Lifecycle is not controlled by this server-backed studio provider."
                        .to_string(),
                ),
            ]
        } else {
            vec![Value::String(
                "Lifecycle is owned by a remote deployment.".to_string(),
            )]
        };
        json!({
            "instance": instance,
            "config": instance.get("config").cloned().unwrap_or(Value::Null),
            "logs": logs.clone(),
            "health": {
                "score": if status == "online" { 91 } else { 48 },
                "status": if status == "online" { "healthy" } else if status == "error" { "degraded" } else { "offline" },
                "checks": [],
                "evaluatedAt": unix_timestamp_ms()
            },
            "lifecycle": {
                "owner": lifecycle_owner,
                "startStopSupported": false,
                "configWritable": config_writable,
                "lifecycleControllable": false,
                "workbenchManaged": workbench_managed,
                "endpointObserved": endpoint_observed,
                "notes": lifecycle_notes
            },
            "storage": {
                "status": if deployment_mode == "remote" { "planned" } else { "ready" },
                "provider": instance.get("storage").and_then(|value| value.get("provider")).and_then(Value::as_str).unwrap_or("localFile"),
                "namespace": instance.get("storage").and_then(|value| value.get("namespace")).and_then(Value::as_str).unwrap_or("claw-studio"),
                "durable": true,
                "queryable": false,
                "transactional": false,
                "remote": deployment_mode == "remote"
            },
            "connectivity": {
                "primaryTransport": instance.get("transportKind").cloned().unwrap_or(Value::Null),
                "endpoints": [connectivity_endpoint(
                    instance,
                    "base-url",
                    "Base URL",
                    "http",
                    base_url,
                    "config",
                )]
            },
            "observability": {
                "status": "limited",
                "logAvailable": true,
                "logPreview": logs.lines().map(|line| Value::String(line.to_string())).collect::<Vec<_>>(),
                "metricsSource": "derived",
                "lastSeenAt": instance.get("lastSeenAt").cloned().unwrap_or(Value::Null)
            },
            "dataAccess": {
                "routes": []
            },
            "artifacts": [],
            "capabilities": normalized_capability_snapshots(instance.get("capabilities").cloned()),
            "officialRuntimeNotes": [],
            "consoleAccess": console_access.unwrap_or(Value::Null),
            "workbench": workbench.unwrap_or(Value::Null)
        })
    }
}

impl StudioPublicApiProvider for ServerStudioPublicApiProvider {
    fn list_instances(&self) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            Ok(Value::Array(
                provider.list_projected_instances(&provider.read_instances()?),
            ))
        })
    }

    fn create_instance(&self, input: Value) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let input_object = input
                .as_object()
                .cloned()
                .ok_or_else(|| "studio instance create input must be an object".to_string())?;
            let mut document = provider.read_instances()?;
            let existing_ids = provider
                .list_projected_instances(&document)
                .into_iter()
                .filter_map(|value| {
                    value
                        .get("id")
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned)
                })
                .collect::<BTreeSet<_>>();
            let requested_id = input_object
                .get("id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| {
                    slugify(
                        input_object
                            .get("name")
                            .and_then(Value::as_str)
                            .unwrap_or("custom-instance"),
                    )
                });
            let mut payload = Value::Object(input_object);
            if let Some(object) = payload.as_object_mut() {
                object.insert(
                    "id".to_string(),
                    Value::String(dedupe_id(requested_id.as_str(), &existing_ids)),
                );
            }
            let created = provider
                .project_custom_instance(payload)
                .ok_or_else(|| "project created studio instance".to_string())?;
            document.custom_instances.push(created.clone());
            normalize_default_instance_selection(&mut document);
            provider.write_instances(&document)?;
            if is_openclaw_workbench_instance(&created) {
                let mut workbenches = provider.read_workbenches()?;
                provider.instance_workbench(&mut workbenches, &created);
                provider.write_workbenches(&workbenches)?;
            }
            Ok(created)
        })
    }

    fn get_instance(&self, id: &str) -> Result<Option<Value>, String> {
        self.with_io_lock(|provider| {
            Ok(provider.get_projected_instance(&provider.read_instances()?, id))
        })
    }

    fn update_instance(&self, id: &str, input: Value) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let mut document = provider.read_instances()?;
            let built_in_id = provider.built_in_instance_id(&document);
            if id == built_in_id {
                let mut next = document
                    .built_in_instance
                    .clone()
                    .unwrap_or_else(|| provider.project_built_in_instance(None));
                merge_values(&mut next, input);
                let projected = provider.project_built_in_instance(Some(next));
                document.built_in_instance = Some(projected.clone());
                normalize_default_instance_selection(&mut document);
                provider.write_instances(&document)?;
                let mut workbenches = provider.read_workbenches()?;
                let built_in_projection = provider.project_built_in_instance(document.built_in_instance.clone());
                if is_openclaw_workbench_instance(&built_in_projection) {
                    provider.instance_workbench(&mut workbenches, &built_in_projection);
                } else {
                    workbenches.workbenches.remove(id);
                }
                provider.write_workbenches(&workbenches)?;
                return Ok(built_in_projection);
            }
            let Some(index) = document
                .custom_instances
                .iter()
                .position(|value| value.get("id").and_then(Value::as_str) == Some(id))
            else {
                return Err(format!("studio instance \"{id}\" does not exist"));
            };
            let mut next = document.custom_instances[index].clone();
            merge_values(&mut next, input);
            let projected = provider
                .project_custom_instance(next)
                .ok_or_else(|| format!("project updated studio instance \"{id}\""))?;
            document.custom_instances[index] = projected.clone();
            normalize_default_instance_selection(&mut document);
            provider.write_instances(&document)?;
            let mut workbenches = provider.read_workbenches()?;
            let normalized = document.custom_instances[index].clone();
            if is_openclaw_workbench_instance(&normalized) {
                provider.instance_workbench(&mut workbenches, &normalized);
            } else {
                workbenches.workbenches.remove(id);
            }
            provider.write_workbenches(&workbenches)?;
            Ok(normalized)
        })
    }

    fn delete_instance(&self, id: &str) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            let mut document = provider.read_instances()?;
            let built_in_id = provider.built_in_instance_id(&document);
            if id == built_in_id {
                return Ok(false);
            }
            let initial_len = document.custom_instances.len();
            document
                .custom_instances
                .retain(|value| value.get("id").and_then(Value::as_str) != Some(id));
            let deleted = document.custom_instances.len() != initial_len;
            if deleted {
                provider.write_instances(&document)?;
                let mut conversations = provider.read_conversations()?;
                conversations.conversations = conversations
                    .conversations
                    .into_iter()
                    .filter_map(|value| {
                        let conversation_id =
                            value.get("id").and_then(Value::as_str)?.to_string();
                        let projected = provider.project_conversation(
                            conversation_id.as_str(),
                            value,
                            built_in_id.as_str(),
                        );
                        let primary_matches =
                            projected.get("primaryInstanceId").and_then(Value::as_str) == Some(id);
                        let participant_matches = projected
                            .get("participantInstanceIds")
                            .and_then(Value::as_array)
                            .is_some_and(|items| {
                                items.iter().any(|item| item.as_str() == Some(id))
                            });
                        if !primary_matches && !participant_matches {
                            return Some(projected);
                        }

                        let mut object = into_object(projected);
                        let mut participant_ids = object
                            .get("participantInstanceIds")
                            .and_then(Value::as_array)
                            .cloned()
                            .unwrap_or_default();
                        participant_ids.retain(|item| item.as_str() != Some(id));

                        if primary_matches {
                            let next_primary = participant_ids
                                .first()
                                .and_then(Value::as_str)
                                .map(ToOwned::to_owned)?;
                            object.insert(
                                "primaryInstanceId".to_string(),
                                Value::String(next_primary),
                            );
                        }

                        object.insert(
                            "participantInstanceIds".to_string(),
                            Value::Array(participant_ids),
                        );
                        object.insert(
                            "updatedAt".to_string(),
                            Value::Number(Number::from(unix_timestamp_ms())),
                        );
                        Some(Value::Object(object))
                    })
                    .collect();
                provider.write_conversations(&conversations)?;
                let mut workbenches = provider.read_workbenches()?;
                workbenches.workbenches.remove(id);
                provider.write_workbenches(&workbenches)?;
            }
            Ok(deleted)
        })
    }

    fn start_instance(&self, id: &str) -> Result<Option<Value>, String> {
        Err(format!(
            "studio instance \"{id}\" lifecycle control is unavailable for the server-backed studio provider"
        ))
    }

    fn stop_instance(&self, id: &str) -> Result<Option<Value>, String> {
        Err(format!(
            "studio instance \"{id}\" lifecycle control is unavailable for the server-backed studio provider"
        ))
    }

    fn restart_instance(&self, id: &str) -> Result<Option<Value>, String> {
        Err(format!(
            "studio instance \"{id}\" lifecycle control is unavailable for the server-backed studio provider"
        ))
    }

    fn get_instance_detail(&self, id: &str) -> Result<Option<Value>, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let Some(instance) = provider.get_projected_instance(&instances, id) else {
                return Ok(None);
            };
            let mut workbenches = provider.read_workbenches()?;
            let workbench = provider.instance_workbench(&mut workbenches, &instance);
            provider.write_workbenches(&workbenches)?;
            Ok(Some(provider.instance_detail(&instance, workbench)))
        })
    }

    fn get_instance_config(&self, id: &str) -> Result<Option<Value>, String> {
        self.with_io_lock(|provider| {
            Ok(provider
                .get_projected_instance(&provider.read_instances()?, id)
                .and_then(|instance| instance.get("config").cloned()))
        })
    }

    fn update_instance_config(&self, id: &str, config: Value) -> Result<Option<Value>, String> {
        self.with_io_lock(|provider| {
            let mut document = provider.read_instances()?;
            let built_in_id = provider.built_in_instance_id(&document);
            let apply_config = |mut next: Value, config: Value| -> Value {
                if let Some(object) = next.as_object_mut() {
                    let mut next_config = object
                        .get("config")
                        .cloned()
                        .unwrap_or_else(|| Value::Object(Map::new()));
                    merge_values(&mut next_config, config);
                    if let Some(config_object) = next_config.as_object() {
                        if let Some(port) = value_as_u16(config_object.get("port")) {
                            object.insert("port".to_string(), Value::Number(Number::from(port)));
                        }
                    }
                    object.insert("config".to_string(), next_config);
                }
                next
            };

            if id == built_in_id {
                let next = apply_config(
                    document
                        .built_in_instance
                        .clone()
                        .unwrap_or_else(|| provider.project_built_in_instance(None)),
                    config,
                );
                let projected = provider.project_built_in_instance(Some(next));
                let projected_config = projected.get("config").cloned();
                document.built_in_instance = Some(projected);
                provider.write_instances(&document)?;
                let mut workbenches = provider.read_workbenches()?;
                if let Some(instance) = document.built_in_instance.as_ref() {
                    provider.instance_workbench(&mut workbenches, instance);
                }
                provider.write_workbenches(&workbenches)?;
                return Ok(projected_config);
            }

            let Some(index) = document
                .custom_instances
                .iter()
                .position(|value| value.get("id").and_then(Value::as_str) == Some(id))
            else {
                return Ok(None);
            };
            let next = apply_config(document.custom_instances[index].clone(), config);
            let projected = provider.project_custom_instance(next);
            let Some(projected) = projected else {
                return Err(format!(
                    "project studio instance config update for \"{id}\""
                ));
            };
            let projected_config = projected.get("config").cloned();
            document.custom_instances[index] = projected;
            provider.write_instances(&document)?;
            let mut workbenches = provider.read_workbenches()?;
            if let Some(instance) = document.custom_instances.get(index) {
                provider.instance_workbench(&mut workbenches, instance);
            }
            provider.write_workbenches(&workbenches)?;
            Ok(projected_config)
        })
    }

    fn get_instance_logs(&self, id: &str) -> Result<String, String> {
        self.with_io_lock(|provider| {
            let instance = provider
                .get_projected_instance(&provider.read_instances()?, id)
                .ok_or_else(|| format!("studio instance \"{id}\" does not exist"))?;
            Ok(provider.instance_logs(&instance))
        })
    }

    fn list_kernel_chat_agent_profiles(&self, instance_id: &str) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let instance = provider.require_managed_hermes_kernel_chat_instance(instance_id)?;
            Ok(Value::Array(build_managed_hermes_kernel_chat_agent_profiles(
                instance_id,
                &instance,
            )))
        })
    }

    fn list_kernel_chat_sessions(&self, instance_id: &str) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let _instance = provider.require_managed_hermes_kernel_chat_instance(instance_id)?;
            let document = provider.read_kernel_chats()?;
            Ok(Value::Array(list_kernel_chat_sessions_from_document(
                &document,
                instance_id,
            )))
        })
    }

    fn get_kernel_chat_session(
        &self,
        instance_id: &str,
        session_id: &str,
    ) -> Result<Option<Value>, String> {
        self.with_io_lock(|provider| {
            let _instance = provider.require_managed_hermes_kernel_chat_instance(instance_id)?;
            let document = provider.read_kernel_chats()?;
            Ok(find_kernel_chat_session_value(
                &document,
                instance_id,
                session_id,
            ))
        })
    }

    fn create_kernel_chat_session(&self, input: Value) -> Result<Value, String> {
        let input: StudioCreateKernelChatSessionInput =
            deserialize_provider_value(input, "studio create kernel chat session input")?;
        self.with_io_lock(|provider| {
            let instance =
                provider.require_managed_hermes_kernel_chat_instance(input.instance_id.as_str())?;
            let mut document = provider.read_kernel_chats()?;
            let session = create_kernel_chat_session_in_document(&mut document, &instance, input)?;
            provider.write_kernel_chats(&document)?;
            Ok(session)
        })
    }

    fn list_kernel_chat_runs(&self, instance_id: &str, session_id: &str) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let _instance = provider.require_managed_hermes_kernel_chat_instance(instance_id)?;
            let document = provider.read_kernel_chats()?;
            Ok(Value::Array(list_kernel_chat_runs_from_document(
                &document,
                instance_id,
                session_id,
            )))
        })
    }

    fn get_kernel_chat_run(
        &self,
        instance_id: &str,
        session_id: &str,
        run_id: &str,
    ) -> Result<Option<Value>, String> {
        self.with_io_lock(|provider| {
            let _instance = provider.require_managed_hermes_kernel_chat_instance(instance_id)?;
            let document = provider.read_kernel_chats()?;
            Ok(find_kernel_chat_run_value(
                &document,
                instance_id,
                session_id,
                run_id,
            ))
        })
    }

    fn patch_kernel_chat_session(&self, input: Value) -> Result<Value, String> {
        let input: StudioPatchKernelChatSessionInput =
            deserialize_provider_value(input, "studio patch kernel chat session input")?;
        self.with_io_lock(|provider| {
            let instance =
                provider.require_managed_hermes_kernel_chat_instance(input.instance_id.as_str())?;
            let mut document = provider.read_kernel_chats()?;
            let session = patch_kernel_chat_session_in_document(&mut document, &instance, input)?;
            provider.write_kernel_chats(&document)?;
            Ok(session)
        })
    }

    fn delete_kernel_chat_session(
        &self,
        instance_id: &str,
        session_id: &str,
    ) -> Result<(), String> {
        self.with_io_lock(|provider| {
            let _instance = provider.require_managed_hermes_kernel_chat_instance(instance_id)?;
            let mut document = provider.read_kernel_chats()?;
            delete_kernel_chat_session_in_document(&mut document, instance_id, session_id);
            provider.write_kernel_chats(&document)
        })
    }

    fn start_kernel_chat_run(&self, input: Value) -> Result<Value, String> {
        let input: StudioStartKernelChatRunInput =
            deserialize_provider_value(input, "studio start kernel chat run input")?;
        self.with_io_lock(|provider| {
            let instance =
                provider.require_managed_hermes_kernel_chat_instance(input.instance_id.as_str())?;
            let mut document = provider.read_kernel_chats()?;
            let run = start_kernel_chat_run_in_document(&mut document, &instance, input)?;
            provider.write_kernel_chats(&document)?;
            Ok(run)
        })
    }

    fn abort_kernel_chat_run(
        &self,
        instance_id: &str,
        _session_id: &str,
        _run_id: Option<String>,
    ) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            let _instance = provider.require_managed_hermes_kernel_chat_instance(instance_id)?;
            Ok(false)
        })
    }

    fn load_kernel_chat_messages(
        &self,
        instance_id: &str,
        session_id: &str,
    ) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let _instance = provider.require_managed_hermes_kernel_chat_instance(instance_id)?;
            let document = provider.read_kernel_chats()?;
            Ok(Value::Array(load_kernel_chat_messages_from_document(
                &document,
                instance_id,
                session_id,
            )))
        })
    }

    fn create_instance_task(&self, instance_id: &str, payload: Value) -> Result<(), String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let next = create_instance_task_in_snapshot(snapshot, payload)?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)
        })
    }

    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> Result<(), String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let next = update_instance_task_in_snapshot(snapshot, task_id, payload)?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)
        })
    }

    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let (next, updated) =
                update_instance_file_content_in_snapshot(snapshot, file_id, content)?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)?;
            Ok(updated)
        })
    }

    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let (next, updated) =
                update_instance_llm_provider_config_in_snapshot(snapshot, provider_id, update)?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)?;
            Ok(updated)
        })
    }

    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> Result<(), String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let next = clone_instance_task_in_snapshot(snapshot, task_id, name.as_deref())?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)
        })
    }

    fn run_instance_task_now(&self, instance_id: &str, task_id: &str) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let (next, execution) = run_instance_task_now_in_snapshot(snapshot, task_id)?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)?;
            Ok(execution)
        })
    }

    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            provider.write_workbenches(&workbenches)?;
            Ok(Value::Array(list_instance_task_executions_from_snapshot(
                &snapshot, task_id,
            )))
        })
    }

    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> Result<(), String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let next = update_instance_task_status_in_snapshot(snapshot, task_id, status.as_str())?;
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)
        })
    }

    fn delete_instance_task(&self, instance_id: &str, task_id: &str) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let instance = provider
                .get_projected_instance(&instances, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let mut workbenches = provider.read_workbenches()?;
            let snapshot = provider
                .instance_workbench(&mut workbenches, &instance)
                .ok_or_else(|| {
                    format!(
                        "studio instance \"{instance_id}\" does not expose a managed workbench"
                    )
                })?;
            let (next, deleted) = delete_instance_task_in_snapshot(snapshot, task_id);
            workbenches
                .workbenches
                .insert(instance_id.to_string(), synchronize_workbench_snapshot(&instance, next));
            provider.write_workbenches(&workbenches)?;
            Ok(deleted)
        })
    }

    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let instance = provider
                .get_projected_instance(&provider.read_instances()?, instance_id)
                .ok_or_else(|| format!("studio instance \"{instance_id}\" does not exist"))?;
            let runtime_kind = instance
                .get("runtimeKind")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            let deployment_mode = instance
                .get("deploymentMode")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            let is_built_in = instance
                .get("isBuiltIn")
                .and_then(Value::as_bool)
                .unwrap_or(false);

            if runtime_kind != "openclaw" || !is_built_in || deployment_mode != "local-managed" {
                return Err(format!(
                    "studio instance \"{instance_id}\" does not expose an OpenClaw gateway"
                ));
            }

            provider.openclaw_control_plane.invoke_gateway(
                to_control_plane_gateway_invoke_request(request, options),
                unix_timestamp_ms(),
            )
        })
    }

    fn list_conversations(&self, instance_id: &str) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let built_in_id = provider.built_in_instance_id(&instances);
            let resolved_instance_id =
                canonicalize_built_in_instance_value(instance_id, built_in_id.as_str());
            let mut records = provider
                .read_conversations()?
                .conversations
                .into_iter()
                .filter_map(|value| {
                    let id = value.get("id").and_then(Value::as_str)?.to_string();
                    let projected =
                        provider.project_conversation(id.as_str(), value, built_in_id.as_str());
                    let primary_matches =
                        projected.get("primaryInstanceId").and_then(Value::as_str)
                            == Some(resolved_instance_id.as_str());
                    let participant_matches = projected
                        .get("participantInstanceIds")
                        .and_then(Value::as_array)
                        .is_some_and(|items| {
                            items.iter()
                                .any(|item| item.as_str() == Some(resolved_instance_id.as_str()))
                        });
                    if primary_matches || participant_matches {
                        Some(projected)
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>();
            records.sort_by(|left, right| {
                let left_updated = left.get("updatedAt").and_then(Value::as_u64).unwrap_or(0);
                let right_updated = right.get("updatedAt").and_then(Value::as_u64).unwrap_or(0);
                right_updated.cmp(&left_updated)
            });
            Ok(Value::Array(records))
        })
    }

    fn put_conversation(&self, id: &str, record: Value) -> Result<Value, String> {
        self.with_io_lock(|provider| {
            let instances = provider.read_instances()?;
            let built_in_id = provider.built_in_instance_id(&instances);
            let mut document = provider.read_conversations()?;
            let projected = provider.project_conversation(id, record, built_in_id.as_str());
            if let Some(index) = document
                .conversations
                .iter()
                .position(|value| value.get("id").and_then(Value::as_str) == Some(id))
            {
                document.conversations[index] = projected.clone();
            } else {
                document.conversations.insert(0, projected.clone());
            }
            provider.write_conversations(&document)?;
            Ok(projected)
        })
    }

    fn delete_conversation(&self, id: &str) -> Result<bool, String> {
        self.with_io_lock(|provider| {
            let mut document = provider.read_conversations()?;
            let initial_len = document.conversations.len();
            document
                .conversations
                .retain(|value| value.get("id").and_then(Value::as_str) != Some(id));
            let deleted = document.conversations.len() != initial_len;
            if deleted {
                provider.write_conversations(&document)?;
            }
            Ok(deleted)
        })
    }
}

impl TypedStudioPublicApiBackend for ServerStudioPublicApiProvider {
    type InstanceRecord = Value;
    type CreateInstanceInput = Value;
    type UpdateInstanceInput = Value;
    type InstanceDetailRecord = Value;
    type InstanceConfigRecord = Value;
    type ConversationRecord = Value;

    fn list_instances(&self) -> Result<Vec<Self::InstanceRecord>, String> {
        match <Self as StudioPublicApiProvider>::list_instances(self)? {
            Value::Array(items) => Ok(items),
            _ => Err("default studio provider instance list must serialize as an array".to_string()),
        }
    }

    fn create_instance(
        &self,
        input: Self::CreateInstanceInput,
    ) -> Result<Self::InstanceRecord, String> {
        <Self as StudioPublicApiProvider>::create_instance(self, input)
    }

    fn get_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String> {
        <Self as StudioPublicApiProvider>::get_instance(self, id)
    }

    fn update_instance(
        &self,
        id: &str,
        input: Self::UpdateInstanceInput,
    ) -> Result<Self::InstanceRecord, String> {
        <Self as StudioPublicApiProvider>::update_instance(self, id, input)
    }

    fn delete_instance(&self, id: &str) -> Result<bool, String> {
        <Self as StudioPublicApiProvider>::delete_instance(self, id)
    }

    fn start_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String> {
        <Self as StudioPublicApiProvider>::start_instance(self, id)
    }

    fn stop_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String> {
        <Self as StudioPublicApiProvider>::stop_instance(self, id)
    }

    fn restart_instance(&self, id: &str) -> Result<Option<Self::InstanceRecord>, String> {
        <Self as StudioPublicApiProvider>::restart_instance(self, id)
    }

    fn get_instance_detail(&self, id: &str) -> Result<Option<Self::InstanceDetailRecord>, String> {
        <Self as StudioPublicApiProvider>::get_instance_detail(self, id)
    }

    fn get_instance_config(&self, id: &str) -> Result<Option<Self::InstanceConfigRecord>, String> {
        <Self as StudioPublicApiProvider>::get_instance_config(self, id)
    }

    fn update_instance_config(
        &self,
        id: &str,
        config: Self::InstanceConfigRecord,
    ) -> Result<Option<Self::InstanceConfigRecord>, String> {
        <Self as StudioPublicApiProvider>::update_instance_config(self, id, config)
    }

    fn get_instance_logs(&self, id: &str) -> Result<String, String> {
        <Self as StudioPublicApiProvider>::get_instance_logs(self, id)
    }

    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value, String> {
        <Self as StudioPublicApiProvider>::invoke_openclaw_gateway(
            self,
            instance_id,
            request,
            options,
        )
    }

    fn list_conversations(
        &self,
        instance_id: &str,
    ) -> Result<Vec<Self::ConversationRecord>, String> {
        match <Self as StudioPublicApiProvider>::list_conversations(self, instance_id)? {
            Value::Array(items) => Ok(items),
            _ => Err(
                "default studio provider conversation list must serialize as an array".to_string(),
            ),
        }
    }

    fn put_conversation(
        &self,
        id: &str,
        record: Self::ConversationRecord,
    ) -> Result<Self::ConversationRecord, String> {
        <Self as StudioPublicApiProvider>::put_conversation(self, id, record)
    }

    fn delete_conversation(&self, id: &str) -> Result<bool, String> {
        <Self as StudioPublicApiProvider>::delete_conversation(self, id)
    }

    fn create_instance_task(&self, instance_id: &str, payload: Value) -> Result<(), String> {
        <Self as StudioPublicApiProvider>::create_instance_task(self, instance_id, payload)
    }

    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> Result<(), String> {
        <Self as StudioPublicApiProvider>::update_instance_task(self, instance_id, task_id, payload)
    }

    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> Result<bool, String> {
        <Self as StudioPublicApiProvider>::update_instance_file_content(
            self,
            instance_id,
            file_id,
            content,
        )
    }

    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> Result<bool, String> {
        <Self as StudioPublicApiProvider>::update_instance_llm_provider_config(
            self,
            instance_id,
            provider_id,
            update,
        )
    }

    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> Result<(), String> {
        <Self as StudioPublicApiProvider>::clone_instance_task(self, instance_id, task_id, name)
    }

    fn run_instance_task_now(&self, instance_id: &str, task_id: &str) -> Result<Value, String> {
        <Self as StudioPublicApiProvider>::run_instance_task_now(self, instance_id, task_id)
    }

    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Vec<Value>, String> {
        match <Self as StudioPublicApiProvider>::list_instance_task_executions(
            self,
            instance_id,
            task_id,
        )? {
            Value::Array(items) => Ok(items),
            _ => Err(
                "default studio provider task execution list must serialize as an array"
                    .to_string(),
            ),
        }
    }

    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> Result<(), String> {
        <Self as StudioPublicApiProvider>::update_instance_task_status(
            self,
            instance_id,
            task_id,
            status,
        )
    }

    fn delete_instance_task(&self, instance_id: &str, task_id: &str) -> Result<bool, String> {
        <Self as StudioPublicApiProvider>::delete_instance_task(self, instance_id, task_id)
    }
}

impl<B> StudioPublicApiProvider for TypedStudioPublicApiProvider<B>
where
    B: TypedStudioPublicApiBackend,
{
    fn list_instances(&self) -> Result<Value, String> {
        serialize_provider_value(self.backend.list_instances()?, "typed studio instance list")
    }

    fn create_instance(&self, input: Value) -> Result<Value, String> {
        let input = deserialize_provider_value(input, "typed studio create instance input")?;
        serialize_provider_value(
            self.backend.create_instance(input)?,
            "typed studio instance record",
        )
    }

    fn get_instance(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.get_instance(id)?,
            "typed studio instance record",
        )
    }

    fn update_instance(&self, id: &str, input: Value) -> Result<Value, String> {
        let input = deserialize_provider_value(input, "typed studio update instance input")?;
        serialize_provider_value(
            self.backend.update_instance(id, input)?,
            "typed studio instance record",
        )
    }

    fn delete_instance(&self, id: &str) -> Result<bool, String> {
        self.backend.delete_instance(id)
    }

    fn start_instance(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.start_instance(id)?,
            "typed studio instance record",
        )
    }

    fn stop_instance(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.stop_instance(id)?,
            "typed studio instance record",
        )
    }

    fn restart_instance(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.restart_instance(id)?,
            "typed studio instance record",
        )
    }

    fn get_instance_detail(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.get_instance_detail(id)?,
            "typed studio instance detail record",
        )
    }

    fn get_instance_config(&self, id: &str) -> Result<Option<Value>, String> {
        serialize_optional_provider_value(
            self.backend.get_instance_config(id)?,
            "typed studio instance config record",
        )
    }

    fn update_instance_config(&self, id: &str, config: Value) -> Result<Option<Value>, String> {
        let config = deserialize_provider_value(config, "typed studio instance config input")?;
        serialize_optional_provider_value(
            self.backend.update_instance_config(id, config)?,
            "typed studio instance config record",
        )
    }

    fn get_instance_logs(&self, id: &str) -> Result<String, String> {
        self.backend.get_instance_logs(id)
    }

    fn list_kernel_chat_agent_profiles(&self, instance_id: &str) -> Result<Value, String> {
        Err(format!(
            "typed studio public api backend does not expose kernel chat agent profiles for instance \"{instance_id}\""
        ))
    }

    fn list_kernel_chat_sessions(&self, instance_id: &str) -> Result<Value, String> {
        Err(format!(
            "typed studio public api backend does not expose kernel chat sessions for instance \"{instance_id}\""
        ))
    }

    fn get_kernel_chat_session(
        &self,
        instance_id: &str,
        session_id: &str,
    ) -> Result<Option<Value>, String> {
        Err(format!(
            "typed studio public api backend does not expose kernel chat session \"{session_id}\" for instance \"{instance_id}\""
        ))
    }

    fn create_kernel_chat_session(&self, _input: Value) -> Result<Value, String> {
        Err("typed studio public api backend does not expose kernel chat session creation".to_string())
    }

    fn list_kernel_chat_runs(&self, instance_id: &str, session_id: &str) -> Result<Value, String> {
        Err(format!(
            "typed studio public api backend does not expose kernel chat runs for session \"{session_id}\" on instance \"{instance_id}\""
        ))
    }

    fn get_kernel_chat_run(
        &self,
        instance_id: &str,
        session_id: &str,
        run_id: &str,
    ) -> Result<Option<Value>, String> {
        Err(format!(
            "typed studio public api backend does not expose kernel chat run \"{run_id}\" for session \"{session_id}\" on instance \"{instance_id}\""
        ))
    }

    fn patch_kernel_chat_session(&self, _input: Value) -> Result<Value, String> {
        Err("typed studio public api backend does not expose kernel chat session mutation".to_string())
    }

    fn delete_kernel_chat_session(
        &self,
        instance_id: &str,
        session_id: &str,
    ) -> Result<(), String> {
        Err(format!(
            "typed studio public api backend does not expose kernel chat session deletion for session \"{session_id}\" on instance \"{instance_id}\""
        ))
    }

    fn start_kernel_chat_run(&self, _input: Value) -> Result<Value, String> {
        Err("typed studio public api backend does not expose kernel chat run start".to_string())
    }

    fn abort_kernel_chat_run(
        &self,
        instance_id: &str,
        session_id: &str,
        _run_id: Option<String>,
    ) -> Result<bool, String> {
        Err(format!(
            "typed studio public api backend does not expose kernel chat run abort for session \"{session_id}\" on instance \"{instance_id}\""
        ))
    }

    fn load_kernel_chat_messages(
        &self,
        instance_id: &str,
        session_id: &str,
    ) -> Result<Value, String> {
        Err(format!(
            "typed studio public api backend does not expose kernel chat messages for session \"{session_id}\" on instance \"{instance_id}\""
        ))
    }

    fn invoke_openclaw_gateway(
        &self,
        instance_id: &str,
        request: StudioOpenClawGatewayInvokeRequest,
        options: StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value, String> {
        self.backend
            .invoke_openclaw_gateway(instance_id, request, options)
    }

    fn list_conversations(&self, instance_id: &str) -> Result<Value, String> {
        serialize_provider_value(
            self.backend.list_conversations(instance_id)?,
            "typed studio conversation list",
        )
    }

    fn put_conversation(&self, id: &str, record: Value) -> Result<Value, String> {
        let record = deserialize_provider_value(record, "typed studio conversation record")?;
        serialize_provider_value(
            self.backend.put_conversation(id, record)?,
            "typed studio conversation record",
        )
    }

    fn delete_conversation(&self, id: &str) -> Result<bool, String> {
        self.backend.delete_conversation(id)
    }

    fn create_instance_task(&self, instance_id: &str, payload: Value) -> Result<(), String> {
        self.backend.create_instance_task(instance_id, payload)
    }

    fn update_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        payload: Value,
    ) -> Result<(), String> {
        self.backend
            .update_instance_task(instance_id, task_id, payload)
    }

    fn update_instance_file_content(
        &self,
        instance_id: &str,
        file_id: &str,
        content: String,
    ) -> Result<bool, String> {
        self.backend
            .update_instance_file_content(instance_id, file_id, content)
    }

    fn update_instance_llm_provider_config(
        &self,
        instance_id: &str,
        provider_id: &str,
        update: Value,
    ) -> Result<bool, String> {
        self.backend
            .update_instance_llm_provider_config(instance_id, provider_id, update)
    }

    fn clone_instance_task(
        &self,
        instance_id: &str,
        task_id: &str,
        name: Option<String>,
    ) -> Result<(), String> {
        self.backend
            .clone_instance_task(instance_id, task_id, name)
    }

    fn run_instance_task_now(&self, instance_id: &str, task_id: &str) -> Result<Value, String> {
        self.backend.run_instance_task_now(instance_id, task_id)
    }

    fn list_instance_task_executions(
        &self,
        instance_id: &str,
        task_id: &str,
    ) -> Result<Value, String> {
        serialize_provider_value(
            self.backend
                .list_instance_task_executions(instance_id, task_id)?,
            "typed studio task execution list",
        )
    }

    fn update_instance_task_status(
        &self,
        instance_id: &str,
        task_id: &str,
        status: String,
    ) -> Result<(), String> {
        self.backend
            .update_instance_task_status(instance_id, task_id, status)
    }

    fn delete_instance_task(&self, instance_id: &str, task_id: &str) -> Result<bool, String> {
        self.backend.delete_instance_task(instance_id, task_id)
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn resolve_optional_string_patch(
    patch: Option<Option<String>>,
    current: Option<String>,
) -> Option<String> {
    match patch {
        Some(next) => normalize_optional_string(next),
        None => normalize_optional_string(current),
    }
}

fn resolve_optional_bool_patch(
    patch: Option<Option<bool>>,
    current: Option<bool>,
) -> Option<bool> {
    match patch {
        Some(next) => next,
        None => current,
    }
}

fn normalize_kernel_chat_title(value: Option<String>) -> String {
    normalize_optional_string(value).unwrap_or_else(|| DEFAULT_KERNEL_CHAT_SESSION_TITLE.to_string())
}

fn is_managed_hermes_kernel_chat_instance(instance: &Value) -> bool {
    instance.get("runtimeKind").and_then(Value::as_str) == Some("hermes")
        && instance.get("deploymentMode").and_then(Value::as_str) == Some("local-managed")
}

fn build_managed_hermes_kernel_chat_agent_profiles(
    instance_id: &str,
    instance: &Value,
) -> Vec<Value> {
    let label = non_empty_string(instance.get("name")).unwrap_or_else(|| DEFAULT_HERMES_AGENT_LABEL.to_string());
    vec![json!({
        "kernelId": "hermes",
        "instanceId": instance_id,
        "agentId": DEFAULT_HERMES_AGENT_ID,
        "label": label,
        "description": "Managed Hermes kernel chat profile projected by the canonical host.",
        "source": "studioProjection",
        "systemPrompt": Value::Null,
        "avatar": Value::Null,
        "creator": "claw-studio-host"
    })]
}

fn kernel_chat_instance_store_mut<'a>(
    document: &'a mut KernelChatsDocument,
    instance_id: &str,
) -> &'a mut StoredKernelChatInstance {
    document
        .instances
        .entry(instance_id.to_string())
        .or_default()
}

fn build_kernel_chat_session_ref_value(
    instance_id: &str,
    session_id: &str,
    agent_id: Option<&str>,
) -> Value {
    json!({
        "kernelId": "hermes",
        "instanceId": instance_id,
        "sessionId": session_id,
        "nativeSessionId": session_id,
        "routingKey": Value::Null,
        "agentId": agent_id
            .map(|value| Value::String(value.to_string()))
            .unwrap_or(Value::Null),
        "lineageParentSessionId": Value::Null
    })
}

fn build_kernel_chat_authority_value() -> Value {
    json!({
        "kind": "http",
        "source": "studioProjection",
        "durable": true,
        "writable": true
    })
}

fn build_kernel_chat_session_value(
    instance_id: &str,
    session_id: &str,
    stored: &StoredKernelChatSession,
) -> Value {
    let last_message_preview = stored
        .messages
        .last()
        .map(|message| message.text.trim().chars().take(120).collect::<String>())
        .filter(|value| !value.is_empty());
    let title = normalize_kernel_chat_title(stored.title.clone());
    let lifecycle = if stored.messages.is_empty() {
        "draft"
    } else {
        "ready"
    };

    json!({
        "ref": build_kernel_chat_session_ref_value(
            instance_id,
            session_id,
            stored.agent_id.as_deref(),
        ),
        "authority": build_kernel_chat_authority_value(),
        "lifecycle": lifecycle,
        "title": title,
        "createdAt": stored.created_at,
        "updatedAt": stored.updated_at.max(stored.created_at),
        "messageCount": stored.messages.len() as u64,
        "lastMessagePreview": last_message_preview.map(Value::String).unwrap_or(Value::Null),
        "sessionKind": "authoritative",
        "actorBinding": {
            "agentId": stored.agent_id.clone().map(Value::String).unwrap_or(Value::Null),
            "profileId": Value::Null,
            "label": stored
                .agent_id
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null)
        },
        "modelBinding": {
            "model": stored.model.clone().map(Value::String).unwrap_or(Value::Null),
            "defaultModel": stored.model.clone().map(Value::String).unwrap_or(Value::Null),
            "thinkingLevel": stored
                .thinking_level
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null),
            "fastMode": stored.fast_mode.map(Value::Bool).unwrap_or(Value::Null),
            "verboseLevel": stored
                .verbose_level
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null),
            "reasoningLevel": stored
                .reasoning_level
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null)
        },
        "capabilities": ["runs", "sessionMutation"],
        "activeRunId": Value::Null,
        "nativeMetadata": {
            "provider": "studio-public-api",
            "runtimeKind": "hermes"
        }
    })
}

fn build_kernel_chat_message_value(
    instance_id: &str,
    session_id: &str,
    message: &StoredKernelChatMessage,
) -> Value {
    let trimmed = message.text.trim();
    let parts = if trimmed.is_empty() {
        json!([{
            "kind": "notice",
            "code": "empty-content",
            "text": message.text
        }])
    } else {
        json!([{
            "kind": "text",
            "text": trimmed
        }])
    };

    json!({
        "id": message.id,
        "sessionRef": build_kernel_chat_session_ref_value(instance_id, session_id, None),
        "role": message.role,
        "status": "complete",
        "createdAt": message.created_at,
        "updatedAt": message.updated_at.max(message.created_at),
        "text": message.text,
        "parts": parts,
        "runId": message.run_id.clone().map(Value::String).unwrap_or(Value::Null),
        "model": message.model.clone().map(Value::String).unwrap_or(Value::Null),
        "senderLabel": message
            .sender_label
            .clone()
            .map(Value::String)
            .unwrap_or(Value::Null),
        "nativeMetadata": message
            .native_metadata
            .clone()
            .unwrap_or(Value::Null)
    })
}

fn build_kernel_chat_run_value(
    instance_id: &str,
    session_id: &str,
    session: &StoredKernelChatSession,
    run: &ProjectedKernelChatRun,
) -> Value {
    let agent_id = normalize_optional_string(session.agent_id.clone());
    let model = run
        .model
        .clone()
        .or_else(|| normalize_optional_string(session.model.clone()));
    let status = if run.has_assistant_message {
        "completed"
    } else {
        "running"
    };

    let mut native_metadata = serde_json::Map::new();
    native_metadata.insert(
        "provider".to_string(),
        Value::String("studio-public-api".to_string()),
    );
    native_metadata.insert(
        "runtimeKind".to_string(),
        Value::String("hermes".to_string()),
    );
    native_metadata.insert("persisted".to_string(), Value::Bool(true));
    if let Some(agent_id) = agent_id.as_ref() {
        native_metadata.insert("agentId".to_string(), Value::String(agent_id.clone()));
    }
    if let Some(model) = model.as_ref() {
        native_metadata.insert("model".to_string(), Value::String(model.clone()));
    }

    json!({
        "id": run.id,
        "sessionRef": build_kernel_chat_session_ref_value(
            instance_id,
            session_id,
            agent_id.as_deref(),
        ),
        "status": status,
        "createdAt": run.created_at,
        "updatedAt": run.updated_at.max(run.created_at),
        "abortable": false,
        "nativeMetadata": Value::Object(native_metadata)
    })
}

fn project_kernel_chat_runs(session: &StoredKernelChatSession) -> Vec<ProjectedKernelChatRun> {
    let mut runs = BTreeMap::<String, ProjectedKernelChatRun>::new();

    for message in &session.messages {
        let Some(run_id) = normalize_optional_string(message.run_id.clone()) else {
            continue;
        };
        let message_updated_at = message.updated_at.max(message.created_at);
        let message_model = normalize_optional_string(message.model.clone());
        let is_assistant_message = message.role.eq_ignore_ascii_case("assistant");

        runs.entry(run_id.clone())
            .and_modify(|run| {
                run.created_at = run.created_at.min(message.created_at);
                run.updated_at = run.updated_at.max(message_updated_at);
                if run.model.is_none() {
                    run.model = message_model.clone();
                }
                run.has_assistant_message = run.has_assistant_message || is_assistant_message;
            })
            .or_insert_with(|| ProjectedKernelChatRun {
                id: run_id,
                created_at: message.created_at,
                updated_at: message_updated_at,
                model: message_model,
                has_assistant_message: is_assistant_message,
            });
    }

    let mut items = runs.into_values().collect::<Vec<_>>();
    items.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| right.created_at.cmp(&left.created_at))
            .then_with(|| right.id.cmp(&left.id))
    });
    items
}

fn list_kernel_chat_sessions_from_document(
    document: &KernelChatsDocument,
    instance_id: &str,
) -> Vec<Value> {
    let mut items = document
        .instances
        .get(instance_id)
        .map(|instance| {
            instance
                .sessions
                .iter()
                .map(|(session_id, stored)| {
                    (
                        stored.updated_at,
                        stored.created_at,
                        build_kernel_chat_session_value(instance_id, session_id, stored),
                    )
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    items.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| right.1.cmp(&left.1)));
    items.into_iter().map(|(_, _, value)| value).collect()
}

fn find_kernel_chat_session_value(
    document: &KernelChatsDocument,
    instance_id: &str,
    session_id: &str,
) -> Option<Value> {
    document
        .instances
        .get(instance_id)?
        .sessions
        .get(session_id)
        .map(|stored| build_kernel_chat_session_value(instance_id, session_id, stored))
}

fn load_kernel_chat_messages_from_document(
    document: &KernelChatsDocument,
    instance_id: &str,
    session_id: &str,
) -> Vec<Value> {
    document
        .instances
        .get(instance_id)
        .and_then(|instance| instance.sessions.get(session_id))
        .map(|session| {
            session
                .messages
                .iter()
                .map(|message| build_kernel_chat_message_value(instance_id, session_id, message))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn list_kernel_chat_runs_from_document(
    document: &KernelChatsDocument,
    instance_id: &str,
    session_id: &str,
) -> Vec<Value> {
    document
        .instances
        .get(instance_id)
        .and_then(|instance| instance.sessions.get(session_id))
        .map(|session| {
            project_kernel_chat_runs(session)
                .into_iter()
                .map(|run| build_kernel_chat_run_value(instance_id, session_id, session, &run))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn find_kernel_chat_run_value(
    document: &KernelChatsDocument,
    instance_id: &str,
    session_id: &str,
    run_id: &str,
) -> Option<Value> {
    let normalized_run_id = run_id.trim();
    if normalized_run_id.is_empty() {
        return None;
    }

    let session = document
        .instances
        .get(instance_id)?
        .sessions
        .get(session_id)?;

    project_kernel_chat_runs(session)
        .into_iter()
        .find(|run| run.id == normalized_run_id)
        .map(|run| build_kernel_chat_run_value(instance_id, session_id, session, &run))
}

fn create_kernel_chat_session_in_document(
    document: &mut KernelChatsDocument,
    _instance: &Value,
    input: StudioCreateKernelChatSessionInput,
) -> Result<Value, String> {
    let now = unix_timestamp_ms();
    let session_id = Uuid::new_v4().to_string();
    let stored = StoredKernelChatSession {
        title: normalize_optional_string(input.title),
        model: normalize_optional_string(input.model),
        thinking_level: None,
        fast_mode: None,
        verbose_level: None,
        reasoning_level: None,
        agent_id: normalize_optional_string(input.agent_id).or_else(|| Some(DEFAULT_HERMES_AGENT_ID.to_string())),
        created_at: now,
        updated_at: now,
        messages: Vec::new(),
    };
    kernel_chat_instance_store_mut(document, input.instance_id.as_str())
        .sessions
        .insert(session_id.clone(), stored.clone());
    Ok(build_kernel_chat_session_value(
        input.instance_id.as_str(),
        session_id.as_str(),
        &stored,
    ))
}

fn patch_kernel_chat_session_in_document(
    document: &mut KernelChatsDocument,
    _instance: &Value,
    input: StudioPatchKernelChatSessionInput,
) -> Result<Value, String> {
    let stored = kernel_chat_instance_store_mut(document, input.instance_id.as_str())
        .sessions
        .get_mut(input.session_id.as_str())
        .ok_or_else(|| format!("kernel chat session \"{}\"", input.session_id))?;

    stored.title = resolve_optional_string_patch(input.title, stored.title.clone());
    stored.model = resolve_optional_string_patch(input.model, stored.model.clone());
    stored.thinking_level =
        resolve_optional_string_patch(input.thinking_level, stored.thinking_level.clone());
    stored.fast_mode = resolve_optional_bool_patch(input.fast_mode, stored.fast_mode);
    stored.verbose_level =
        resolve_optional_string_patch(input.verbose_level, stored.verbose_level.clone());
    stored.reasoning_level =
        resolve_optional_string_patch(input.reasoning_level, stored.reasoning_level.clone());
    stored.updated_at = unix_timestamp_ms();

    Ok(build_kernel_chat_session_value(
        input.instance_id.as_str(),
        input.session_id.as_str(),
        stored,
    ))
}

fn delete_kernel_chat_session_in_document(
    document: &mut KernelChatsDocument,
    instance_id: &str,
    session_id: &str,
) {
    if let Some(instance) = document.instances.get_mut(instance_id) {
        instance.sessions.remove(session_id);
        if instance.sessions.is_empty() {
            document.instances.remove(instance_id);
        }
    }
}

fn build_hermes_message_payload(content: &str) -> Value {
    json!([
        {
            "role": "user",
            "content": content,
        }
    ])
}

fn resolve_hermes_chat_endpoint(instance: &Value) -> Result<String, String> {
    let base_url = normalized_instance_base_url(instance)
        .ok_or_else(|| "managed Hermes instance does not expose an HTTP base URL".to_string())?;

    if base_url.ends_with("/v1/chat/completions")
        || base_url.ends_with("/chat/completions")
        || base_url.ends_with("/v1/responses")
        || base_url.ends_with("/responses")
    {
        return Ok(base_url);
    }

    Ok(format!("{}/v1/chat/completions", base_url.trim_end_matches('/')))
}

fn request_hermes_chat_completion(
    instance: &Value,
    session_id: &str,
    model: Option<&str>,
    content: &str,
) -> Result<Value, String> {
    let endpoint = resolve_hermes_chat_endpoint(instance)?;
    let auth_token = instance_config_string(instance, "authToken");
    let session_id = session_id.to_string();
    let endpoint = endpoint.to_string();
    let mut body = serde_json::Map::new();
    body.insert("messages".to_string(), build_hermes_message_payload(content));
    body.insert("stream".to_string(), Value::Bool(false));
    if let Some(model) = model.map(str::trim).filter(|value| !value.is_empty()) {
        body.insert("model".to_string(), Value::String(model.to_string()));
    }
    let future = async move {
        let client = Client::builder()
            .build()
            .map_err(|error| format!("build Hermes HTTP client: {error}"))?;
        let mut request = client
            .post(endpoint.as_str())
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header("X-Hermes-Session-Id", session_id);

        if let Some(auth_token) = auth_token {
            request = request.bearer_auth(auth_token);
        }

        let response = request
            .json(&Value::Object(body))
            .send()
            .await
            .map_err(|error| format!("start Hermes kernel chat run: {error}"))?;
        let status = response.status();
        if !status.is_success() {
            let response_text = response.text().await.unwrap_or_default();
            return Err(format!(
                "Hermes kernel chat run failed with status {}: {}",
                status,
                response_text.trim()
            ));
        }

        response
            .json::<Value>()
            .await
            .map_err(|error| format!("decode Hermes kernel chat response: {error}"))
    };

    std::thread::spawn(move || {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|error| format!("create Hermes runtime bridge: {error}"))?
            .block_on(future)
    })
    .join()
    .map_err(|_| "join Hermes runtime bridge thread".to_string())?
}

fn collect_text_fragments(value: &Value, fragments: &mut Vec<String>) {
    match value {
        Value::String(text) => {
            let normalized = text.trim();
            if !normalized.is_empty() {
                fragments.push(normalized.to_string());
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_text_fragments(item, fragments);
            }
        }
        Value::Object(object) => {
            if let Some(text) = object.get("text").and_then(Value::as_str) {
                let normalized = text.trim();
                if !normalized.is_empty() {
                    fragments.push(normalized.to_string());
                }
            }
            if let Some(content) = object.get("content") {
                collect_text_fragments(content, fragments);
            }
            if let Some(message) = object.get("message") {
                collect_text_fragments(message, fragments);
            }
            if let Some(output_text) = object.get("output_text").and_then(Value::as_str) {
                let normalized = output_text.trim();
                if !normalized.is_empty() {
                    fragments.push(normalized.to_string());
                }
            }
            for (key, value) in object {
                if matches!(key.as_str(), "text" | "content" | "message" | "output_text") {
                    continue;
                }
                collect_text_fragments(value, fragments);
            }
        }
        _ => {}
    }
}

fn extract_hermes_message_text(payload: &Value) -> String {
    if let Some(choices) = payload.get("choices").and_then(Value::as_array) {
        let mut fragments = Vec::new();
        for choice in choices {
            if let Some(content) = choice
                .get("message")
                .and_then(|value| value.get("content"))
            {
                collect_text_fragments(content, &mut fragments);
            }
        }
        if !fragments.is_empty() {
            return fragments.join("\n\n");
        }
    }

    if let Some(output) = payload.get("output") {
        let mut fragments = Vec::new();
        collect_text_fragments(output, &mut fragments);
        if !fragments.is_empty() {
            return fragments.join("\n\n");
        }
    }

    let mut fragments = Vec::new();
    collect_text_fragments(payload, &mut fragments);
    if !fragments.is_empty() {
        return fragments.join("\n\n");
    }
    payload
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| payload.to_string())
}

fn start_kernel_chat_run_in_document(
    document: &mut KernelChatsDocument,
    instance: &Value,
    input: StudioStartKernelChatRunInput,
) -> Result<Value, String> {
    let model = normalize_optional_string(input.model.clone());
    let response_payload = request_hermes_chat_completion(
        instance,
        input.session_id.as_str(),
        model.as_deref(),
        input.content.as_str(),
    )?;
    let run_id = response_payload
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("hermes-run-{}", Uuid::new_v4()));
    let now = unix_timestamp_ms();
    let assistant_text = extract_hermes_message_text(&response_payload);
    let instance_store = kernel_chat_instance_store_mut(document, input.instance_id.as_str());
    let session = instance_store
        .sessions
        .get_mut(input.session_id.as_str())
        .ok_or_else(|| format!("kernel chat session \"{}\"", input.session_id))?;

    session.messages.push(StoredKernelChatMessage {
        id: format!("message-{}", Uuid::new_v4()),
        role: "user".to_string(),
        text: input.content.clone(),
        created_at: now,
        updated_at: now,
        run_id: Some(run_id.clone()),
        model: model.clone(),
        sender_label: Some("You".to_string()),
        native_metadata: Some(json!({
            "source": "studio-public-api"
        })),
    });
    session.messages.push(StoredKernelChatMessage {
        id: format!("message-{}", Uuid::new_v4()),
        role: "assistant".to_string(),
        text: assistant_text,
        created_at: now,
        updated_at: now,
        run_id: Some(run_id.clone()),
        model: model.clone(),
        sender_label: Some(DEFAULT_HERMES_AGENT_LABEL.to_string()),
        native_metadata: Some(json!({
            "source": "studio-public-api",
            "response": response_payload
        })),
    });
    session.updated_at = unix_timestamp_ms().max(now);
    if model.is_some() {
        session.model = model.clone();
    }

    Ok(json!({
        "id": run_id,
        "sessionRef": build_kernel_chat_session_ref_value(
            input.instance_id.as_str(),
            input.session_id.as_str(),
            session.agent_id.as_deref(),
        ),
        "status": "completed",
        "createdAt": now,
        "updatedAt": session.updated_at,
        "abortable": false,
        "nativeMetadata": {
            "provider": "studio-public-api"
        }
    }))
}

fn is_built_in_local_openclaw_instance(instance: &Value) -> bool {
    instance.get("runtimeKind").and_then(Value::as_str) == Some("openclaw")
        && instance.get("isBuiltIn").and_then(Value::as_bool) == Some(true)
        && instance.get("deploymentMode").and_then(Value::as_str) == Some("local-managed")
}

fn has_live_openclaw_runtime_authority(instance: &Value) -> bool {
    if !is_built_in_local_openclaw_instance(instance) {
        return false;
    }

    let status = instance
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("offline");
    if status != "online" {
        return false;
    }

    normalized_instance_base_url(instance).is_some()
        || normalized_instance_websocket_url(instance).is_some()
}

fn is_openclaw_runtime_online(instance: &Value) -> bool {
    instance.get("status").and_then(Value::as_str) == Some("online")
}

fn offline_openclaw_console_reason(instance: &Value) -> String {
    match instance.get("deploymentMode").and_then(Value::as_str) {
        Some("local-external") => {
            "Local external OpenClaw runtime is offline; start the external process before opening the console."
                .to_string()
        }
        Some("remote") => {
            "Remote OpenClaw runtime is offline or unreachable; reconnect the instance before opening the console."
                .to_string()
        }
        _ => "OpenClaw runtime is offline; start the instance before opening the console."
            .to_string(),
    }
}

fn is_openclaw_workbench_instance(instance: &Value) -> bool {
    has_live_openclaw_runtime_authority(instance)
}

fn connectivity_endpoint(
    instance: &Value,
    id: &str,
    label: &str,
    kind: &str,
    url: Option<String>,
    source: &str,
) -> Value {
    let status = if url.is_some() {
        "ready"
    } else {
        "configurationRequired"
    };
    json!({
        "id": id,
        "label": label,
        "url": url.map(Value::String).unwrap_or(Value::Null),
        "kind": kind,
        "status": status,
        "exposure": endpoint_exposure_for_instance(instance),
        "auth": endpoint_auth_for_instance(instance),
        "source": source
    })
}

fn endpoint_exposure_for_instance(instance: &Value) -> &'static str {
    if instance.get("deploymentMode").and_then(Value::as_str) == Some("remote") {
        return "remote";
    }

    let host = normalized_instance_host(instance);
    if is_loopback_host(&host) {
        "loopback"
    } else {
        "private"
    }
}

fn endpoint_auth_for_instance(instance: &Value) -> &'static str {
    if instance_config_string(instance, "authToken").is_some() {
        "token"
    } else if instance.get("deploymentMode").and_then(Value::as_str) == Some("remote") {
        "external"
    } else {
        "unknown"
    }
}

fn build_console_access(instance: &Value, workbench: Option<&Value>) -> Option<Value> {
    if instance.get("runtimeKind").and_then(Value::as_str) != Some("openclaw") {
        return None;
    }

    if is_built_in_local_openclaw_instance(instance)
        && !has_live_openclaw_runtime_authority(instance)
    {
        return None;
    }

    let url = build_openclaw_control_ui_url(instance);
    let gateway_url = build_openclaw_gateway_ws_url(instance);
    let workbench_root = parse_workbench_openclaw_config_root(workbench);
    let explicit_mode = workbench_root
        .as_ref()
        .and_then(|root| nested_string(root, &["gateway", "auth", "mode"]))
        .map(|value| value.trim().to_ascii_lowercase());
    let config_token = workbench_root
        .as_ref()
        .and_then(|root| nested_string(root, &["gateway", "auth", "token"]))
        .map(ToOwned::to_owned);
    let token = config_token.or_else(|| instance_config_string(instance, "authToken"));
    let token_is_secret_ref = token
        .as_deref()
        .map(token_looks_secret_ref)
        .unwrap_or(false);
    let auth_mode = match explicit_mode.as_deref() {
        Some("token") => "token",
        Some("password") => "password",
        Some("none") => "none",
        Some("external") => "external",
        Some(_) => "unknown",
        None if token.is_some() => "token",
        None if instance.get("deploymentMode").and_then(Value::as_str) == Some("remote") => "external",
        None => "unknown",
    };
    let auth_source = if token.is_some() {
        if token_is_secret_ref {
            Some("secretRef")
        } else if workbench_root.is_some() {
            Some("configFile")
        } else {
            Some("workspaceConfig")
        }
    } else {
        None
    };
    let host = normalized_instance_host(instance);
    let loopback_target = gateway_url
        .as_deref()
        .and_then(url_host)
        .map(|value| is_loopback_host(&value))
        .unwrap_or_else(|| is_loopback_host(&host));
    let runtime_available = is_openclaw_runtime_online(instance);
    let auto_login_url = if let (Some(url), Some(gateway_url), Some(token)) =
        (url.as_ref(), gateway_url.as_ref(), token.as_ref())
    {
        if runtime_available && !token_is_secret_ref && loopback_target {
            Some(format!(
                "{url}?gatewayUrl={}#token={}",
                percent_encode_url_component(gateway_url),
                percent_encode_url_component(token)
            ))
        } else {
            None
        }
    } else {
        None
    };
    let reason = if !runtime_available {
        Some(offline_openclaw_console_reason(instance))
    } else if url.is_none() {
        Some("No OpenClaw Control UI endpoint is configured for this instance.".to_string())
    } else if auto_login_url.is_none() {
        match auth_mode {
            "token" if token_is_secret_ref => Some(
                "This OpenClaw token is secret-managed; open the console and complete authorization manually."
                    .to_string(),
            ),
            "token" if !loopback_target => Some(
                "Remote OpenClaw consoles require device pairing or manual authorization."
                    .to_string(),
            ),
            "external" => Some(
                "This OpenClaw console relies on external authentication and must be opened manually."
                    .to_string(),
            ),
            "unknown" => Some(
                "Claw Studio could not determine the OpenClaw console authentication mode."
                    .to_string(),
            ),
            _ => None,
        }
    } else {
        None
    };

    Some(json!({
        "kind": "openclawControlUi",
        "available": runtime_available && url.is_some(),
        "url": url.map(Value::String).unwrap_or(Value::Null),
        "autoLoginUrl": auto_login_url.map(Value::String).unwrap_or(Value::Null),
        "gatewayUrl": gateway_url.map(Value::String).unwrap_or(Value::Null),
        "authMode": auth_mode,
        "authSource": auth_source.map(|value| Value::String(value.to_string())).unwrap_or(Value::Null),
        "installMethod": if instance.get("isBuiltIn").and_then(Value::as_bool) == Some(true) {
            Value::String("bundled".to_string())
        } else {
            Value::String("unknown".to_string())
        },
        "reason": reason.map(Value::String).unwrap_or(Value::Null)
    }))
}

fn build_openclaw_control_ui_url(instance: &Value) -> Option<String> {
    let base_path = resolved_openclaw_control_ui_base_path(instance);

    if let Some(base_url) = normalized_instance_base_url(instance) {
        if let Some(origin) = url_origin(&base_url) {
            return Some(format!("{}{}", origin.trim_end_matches('/'), base_path));
        }
        return Some(format!("{}{}", base_url.trim_end_matches('/'), base_path));
    }

    let port = normalized_instance_port(instance)?;
    let host = normalized_instance_host(instance);
    Some(format!("http://{host}:{port}{base_path}"))
}

fn build_openclaw_gateway_ws_url(instance: &Value) -> Option<String> {
    let base_path = resolved_openclaw_control_ui_base_path(instance);
    let gateway_path = normalize_control_ui_gateway_path(&base_path);

    if let Some(websocket_url) = normalized_instance_websocket_url(instance) {
        if let Some(origin) = url_origin(&websocket_url) {
            return Some(format!("{origin}{gateway_path}"));
        }
        return Some(websocket_url.trim_end_matches('/').to_string());
    }

    if let Some(base_url) = normalized_instance_base_url(instance) {
        if let Some(origin) = url_origin(&base_url) {
            return Some(format!(
                "{}{}",
                http_origin_to_ws_origin(&origin),
                gateway_path
            ));
        }
    }

    let port = normalized_instance_port(instance)?;
    let host = normalized_instance_host(instance);
    Some(format!("ws://{host}:{port}"))
}

fn normalized_instance_base_url(instance: &Value) -> Option<String> {
    non_empty_string(instance.get("baseUrl")).or_else(|| instance_config_string(instance, "baseUrl"))
}

fn normalized_instance_websocket_url(instance: &Value) -> Option<String> {
    non_empty_string(instance.get("websocketUrl"))
        .or_else(|| instance_config_string(instance, "websocketUrl"))
}

fn normalized_instance_port(instance: &Value) -> Option<u16> {
    value_as_u16(instance.get("port")).or_else(|| {
        instance
            .get("config")
            .and_then(|value| value.get("port"))
            .and_then(|value| value_as_u16(Some(value)))
    })
}

fn instance_config_string(instance: &Value, key: &str) -> Option<String> {
    instance
        .get("config")
        .and_then(|value| value.get(key))
        .and_then(|value| non_empty_string(Some(value)))
}

fn normalized_instance_host(instance: &Value) -> String {
    non_empty_string(instance.get("host")).unwrap_or_else(|| "127.0.0.1".to_string())
}

fn resolved_openclaw_control_ui_base_path(instance: &Value) -> String {
    let base_url = normalized_instance_base_url(instance);
    let websocket_url = normalized_instance_websocket_url(instance);
    let configured_or_inferred = base_url
        .as_deref()
        .and_then(url_path)
        .or_else(|| websocket_url.as_deref().and_then(url_path));

    normalize_control_ui_base_path(configured_or_inferred)
}

fn normalize_control_ui_base_path(value: Option<String>) -> String {
    let trimmed = value.as_deref().unwrap_or("/").trim();
    if trimmed.is_empty() || trimmed == "/" {
        return "/".to_string();
    }

    format!("/{}/", trimmed.trim_matches('/'))
}

fn normalize_control_ui_gateway_path(base_path: &str) -> String {
    if base_path == "/" {
        String::new()
    } else {
        base_path.trim_end_matches('/').to_string()
    }
}

fn http_origin_to_ws_origin(origin: &str) -> String {
    if let Some(rest) = origin.strip_prefix("https://") {
        return format!("wss://{rest}");
    }
    if let Some(rest) = origin.strip_prefix("http://") {
        return format!("ws://{rest}");
    }
    origin.to_string()
}

fn url_origin(value: &str) -> Option<String> {
    let (scheme, rest) = value.split_once("://")?;
    let authority = rest.split('/').next().unwrap_or(rest).trim();
    if authority.is_empty() {
        return None;
    }
    Some(format!("{scheme}://{authority}"))
}

fn url_path(value: &str) -> Option<String> {
    let (_, rest) = value.split_once("://")?;
    let (_, path_and_more) = rest.split_once('/')?;
    let path = format!(
        "/{}",
        path_and_more.split(['?', '#']).next().unwrap_or_default()
    );
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}

fn url_host(value: &str) -> Option<String> {
    let authority = value.split_once("://")?.1.split('/').next()?.trim();
    let host_port = authority.rsplit('@').next().unwrap_or(authority);
    if host_port.starts_with('[') {
        let (host, _) = host_port.split_once(']')?;
        return Some(host.trim_start_matches('[').to_string());
    }
    Some(host_port.split(':').next().unwrap_or(host_port).to_string())
}

fn is_loopback_host(value: &str) -> bool {
    let normalized = value.trim().trim_matches(['[', ']']).to_ascii_lowercase();
    normalized == "127.0.0.1"
        || normalized == "::1"
        || normalized == "localhost"
        || normalized.ends_with(".localhost")
}

fn percent_encode_url_component(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.as_bytes() {
        if byte.is_ascii_alphanumeric() || matches!(*byte, b'-' | b'.' | b'_' | b'~') {
            encoded.push(*byte as char);
        } else {
            encoded.push_str(&format!("%{:02X}", byte));
        }
    }
    encoded
}

fn token_looks_secret_ref(value: &str) -> bool {
    let normalized = value.trim().to_ascii_lowercase();
    normalized.contains("secretref")
        || normalized.starts_with("secret:")
        || normalized.starts_with("secret://")
        || normalized.starts_with("${")
        || normalized.starts_with("{{")
        || normalized.starts_with("env:")
}

fn non_empty_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn parse_workbench_openclaw_config_root(workbench: Option<&Value>) -> Option<Value> {
    let files = workbench?.get("files")?.as_array()?;
    let config_content = files
        .iter()
        .find(|file| {
            file.get("id").and_then(Value::as_str) == Some(DEFAULT_OPENCLAW_CONFIG_FILE_ID)
                || file.get("path").and_then(Value::as_str) == Some(DEFAULT_OPENCLAW_CONFIG_FILE_ID)
        })?
        .get("content")
        .and_then(Value::as_str)?;
    serde_json::from_str::<Value>(config_content).ok()
}

fn nested_string<'a>(root: &'a Value, path: &[&str]) -> Option<&'a str> {
    let mut current = root;
    for segment in path {
        current = current.get(*segment)?;
    }
    current.as_str().filter(|value| !value.trim().is_empty())
}

fn synchronize_workbench_snapshot(instance: &Value, snapshot: Value) -> Value {
    if !is_openclaw_workbench_instance(instance) {
        return Value::Null;
    }

    let mut root = into_object(snapshot);
    if !matches!(root.get("channels"), Some(Value::Array(_))) {
        root.insert("channels".to_string(), Value::Array(Vec::new()));
    }
    if !matches!(root.get("skills"), Some(Value::Array(_))) {
        root.insert("skills".to_string(), Value::Array(Vec::new()));
    }
    if !matches!(root.get("agents"), Some(Value::Array(_))) {
        root.insert(
            "agents".to_string(),
            Value::Array(vec![json!({
                "agent": {
                    "id": "main",
                    "name": "Main",
                    "description": "Primary OpenClaw workspace agent.",
                    "avatar": "M",
                    "systemPrompt": "Coordinate OpenClaw workbench activity.",
                    "creator": "Claw Studio Host"
                },
                "focusAreas": ["planning", "automation", "operations"],
                "automationFitScore": 82
            })]),
        );
    }
    if !matches!(root.get("tools"), Some(Value::Array(_))) {
        root.insert(
            "tools".to_string(),
            Value::Array(vec![
                json!({
                    "id": "cron",
                    "name": "Cron Scheduler",
                    "description": "Create and run OpenClaw scheduled tasks.",
                    "category": "automation",
                    "status": "ready",
                    "access": "write",
                    "command": "openclaw:cron"
                }),
                json!({
                    "id": "workspace-files",
                    "name": "Workspace Files",
                    "description": "Edit OpenClaw workspace files from the canonical host API.",
                    "category": "filesystem",
                    "status": "ready",
                    "access": "write",
                    "command": "openclaw:files"
                }),
            ]),
        );
    }

    let mut providers = root
        .get("llmProviders")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| default_workbench_llm_providers(instance));
    if providers.is_empty() {
        providers = default_workbench_llm_providers(instance);
    }
    root.insert("llmProviders".to_string(), Value::Array(providers.clone()));

    let default_provider_id = providers
        .first()
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_OPENCLAW_PROVIDER_ID);
    let mut files = root
        .get("files")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| default_workbench_files(instance, default_provider_id));
    files = synchronize_workbench_files(instance, files, default_provider_id);
    root.insert("files".to_string(), Value::Array(files.clone()));
    root.insert(
        "memory".to_string(),
        Value::Array(build_workbench_memory_entries(&files)),
    );

    let mut cron_tasks = root
        .get("cronTasks")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let tasks = cron_tasks
        .get("tasks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let executions = cron_tasks
        .get("taskExecutionsById")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    cron_tasks.insert("tasks".to_string(), Value::Array(tasks));
    cron_tasks.insert("taskExecutionsById".to_string(), Value::Object(executions));
    root.insert("cronTasks".to_string(), Value::Object(cron_tasks));

    Value::Object(root)
}

fn create_default_workbench_snapshot(instance: &Value) -> Value {
    let providers = default_workbench_llm_providers(instance);
    let default_provider_id = providers
        .first()
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        .unwrap_or(DEFAULT_OPENCLAW_PROVIDER_ID);
    let files = default_workbench_files(instance, default_provider_id);
    json!({
        "channels": [],
        "cronTasks": {
            "tasks": [],
            "taskExecutionsById": {}
        },
        "llmProviders": providers,
        "agents": [
            {
                "agent": {
                    "id": "main",
                    "name": "Main",
                    "description": "Primary OpenClaw workspace agent.",
                    "avatar": "M",
                    "systemPrompt": "Coordinate OpenClaw workbench activity.",
                    "creator": "Claw Studio Host"
                },
                "focusAreas": ["planning", "automation", "operations"],
                "automationFitScore": 82
            }
        ],
        "skills": [],
        "files": files.clone(),
        "memory": build_workbench_memory_entries(&files),
        "tools": [
            {
                "id": "cron",
                "name": "Cron Scheduler",
                "description": "Create and run OpenClaw scheduled tasks.",
                "category": "automation",
                "status": "ready",
                "access": "write",
                "command": "openclaw:cron"
            },
            {
                "id": "workspace-files",
                "name": "Workspace Files",
                "description": "Edit OpenClaw workspace files from the canonical host API.",
                "category": "filesystem",
                "status": "ready",
                "access": "write",
                "command": "openclaw:files"
            }
        ]
    })
}

fn default_workbench_llm_providers(_instance: &Value) -> Vec<Value> {
    vec![json!({
        "id": DEFAULT_OPENCLAW_PROVIDER_ID,
        "name": "OpenAI",
        "provider": "openai",
        "endpoint": "https://api.openai.com/v1",
        "apiKeySource": "env:OPENAI_API_KEY",
        "status": "configurationRequired",
        "defaultModelId": "gpt-5.4",
        "reasoningModelId": "o4-mini",
        "embeddingModelId": "text-embedding-3-large",
        "description": "Primary hosted provider profile for the managed host workbench.",
        "icon": "O",
        "lastCheckedAt": pseudo_iso_timestamp(),
        "capabilities": ["chat", "reasoning", "embedding"],
        "models": [
            {
                "id": "gpt-5.4",
                "name": "GPT-5.4",
                "role": "primary",
                "contextWindow": "128k"
            },
            {
                "id": "o4-mini",
                "name": "o4-mini",
                "role": "reasoning",
                "contextWindow": "200k"
            },
            {
                "id": "text-embedding-3-large",
                "name": "text-embedding-3-large",
                "role": "embedding",
                "contextWindow": "8k"
            }
        ],
        "config": {
            "temperature": 0.2,
            "topP": 1.0,
            "maxTokens": 4096,
            "timeoutMs": 60000,
            "streaming": true
        }
    })]
}

fn default_workbench_files(instance: &Value, default_provider_id: &str) -> Vec<Value> {
    let instance_name = instance
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Local Built-In");
    let transport = instance
        .get("transportKind")
        .and_then(Value::as_str)
        .unwrap_or("openclawGatewayWs");
    let gateway = instance
        .get("baseUrl")
        .and_then(Value::as_str)
        .unwrap_or("unconfigured");

    sort_workbench_files(vec![
        create_workbench_file(
            DEFAULT_OPENCLAW_AGENT_FILE_ID,
            "AGENTS.md",
            DEFAULT_OPENCLAW_AGENT_FILE_ID,
            "prompt",
            "markdown",
            "Primary agent instructions for the OpenClaw workspace.",
            [
                "# Main Agent",
                "",
                &format!("You are the primary managed agent for {instance_name}."),
                "- Prefer real runtime actions over placeholder responses.",
                "- Keep plans concise and execution-oriented.",
            ]
            .join("\n"),
            false,
        ),
        create_workbench_file(
            DEFAULT_OPENCLAW_MEMORY_FILE_ID,
            "MEMORY.md",
            DEFAULT_OPENCLAW_MEMORY_FILE_ID,
            "memory",
            "markdown",
            "Pinned workspace memory for the OpenClaw workbench.",
            [
                "# Workspace Memory",
                "",
                &format!("- Runtime: {instance_name}"),
                &format!("- Transport: {transport}"),
                &format!("- Gateway: {gateway}"),
            ]
            .join("\n"),
            false,
        ),
        build_openclaw_config_file(instance, default_provider_id),
    ])
}

fn synchronize_workbench_files(
    instance: &Value,
    files: Vec<Value>,
    default_provider_id: &str,
) -> Vec<Value> {
    let existing_config = files
        .iter()
        .find(|file| {
            file.get("id").and_then(Value::as_str) == Some(DEFAULT_OPENCLAW_CONFIG_FILE_ID)
                || file.get("path").and_then(Value::as_str) == Some(DEFAULT_OPENCLAW_CONFIG_FILE_ID)
        })
        .cloned();
    let mut next = files
        .into_iter()
        .filter(|file| {
            file.get("id").and_then(Value::as_str) != Some(DEFAULT_OPENCLAW_CONFIG_FILE_ID)
        })
        .collect::<Vec<_>>();
    next.push(
        existing_config
            .unwrap_or_else(|| build_openclaw_config_file(instance, default_provider_id)),
    );
    sort_workbench_files(next)
}

fn build_openclaw_config_file(instance: &Value, default_provider_id: &str) -> Value {
    create_workbench_file(
        DEFAULT_OPENCLAW_CONFIG_FILE_ID,
        "openclaw.json",
        DEFAULT_OPENCLAW_CONFIG_FILE_ID,
        "config",
        "json",
        "OpenClaw runtime configuration snapshot.",
        build_default_openclaw_config_content(instance, default_provider_id),
        false,
    )
}

fn build_default_openclaw_config_content(instance: &Value, default_provider_id: &str) -> String {
    let port = instance
        .get("config")
        .and_then(|value| value.get("port"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| {
            instance
                .get("port")
                .and_then(Value::as_u64)
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| DEFAULT_PORT.to_string());

    serde_json::to_string_pretty(&json!({
        "runtime": "openclaw",
        "instanceId": instance.get("id").cloned().unwrap_or(Value::String(BUILT_IN_INSTANCE_ID.to_string())),
        "gateway": {
            "baseUrl": instance.get("baseUrl").cloned().unwrap_or(Value::Null),
            "websocketUrl": instance.get("websocketUrl").cloned().unwrap_or(Value::Null),
            "port": port
        },
        "workspace": {
            "root": "/workspace/main"
        },
        "channels": {},
        "models": {
            "defaultProvider": default_provider_id
        }
    }))
    .unwrap_or_else(|_| "{}".to_string())
}

fn build_workbench_memory_entries(files: &[Value]) -> Vec<Value> {
    files
        .iter()
        .filter(|file| {
            file.get("category").and_then(Value::as_str) == Some("memory")
                || file.get("name").and_then(Value::as_str) == Some("MEMORY.md")
        })
        .map(|file| {
            let content = file.get("content").and_then(Value::as_str).unwrap_or("");
            json!({
                "id": format!("memory:{}", file.get("id").and_then(Value::as_str).unwrap_or("memory")),
                "title": file.get("name").cloned().unwrap_or(Value::String("MEMORY.md".to_string())),
                "type": "runbook",
                "summary": summarize_memory_content(content),
                "source": "system",
                "updatedAt": file.get("updatedAt").cloned().unwrap_or(Value::String(pseudo_iso_timestamp())),
                "retention": "pinned",
                "tokens": std::cmp::max(1, content.len().div_ceil(4))
            })
        })
        .collect()
}

fn summarize_memory_content(content: &str) -> String {
    content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .next()
        .unwrap_or("OpenClaw workspace memory for the canonical host workbench.")
        .to_string()
}

fn create_workbench_file(
    id: &str,
    name: &str,
    path: &str,
    category: &str,
    language: &str,
    description: &str,
    content: String,
    is_readonly: bool,
) -> Value {
    json!({
        "id": id,
        "name": name,
        "path": path,
        "category": category,
        "language": language,
        "size": format_workbench_file_size(content.as_str()),
        "updatedAt": pseudo_iso_timestamp(),
        "status": "synced",
        "description": description,
        "content": content,
        "isReadonly": is_readonly
    })
}

fn format_workbench_file_size(content: &str) -> String {
    let bytes = content.len();
    if bytes < 1024 {
        format!("{bytes} B")
    } else {
        let kb = bytes as f64 / 1024.0;
        if kb >= 10.0 {
            format!("{:.0} KB", kb)
        } else {
            format!("{:.1} KB", kb)
        }
    }
}

fn sort_workbench_files(mut files: Vec<Value>) -> Vec<Value> {
    files.sort_by(|left, right| {
        let left_path = left.get("path").and_then(Value::as_str).unwrap_or("");
        let right_path = right.get("path").and_then(Value::as_str).unwrap_or("");
        left_path.cmp(right_path)
    });
    files
}

fn pseudo_iso_timestamp() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| format!("ts-{}", unix_timestamp_ms()))
}

fn workbench_tasks(root: &Map<String, Value>) -> Vec<Value> {
    root.get("cronTasks")
        .and_then(|value| value.get("tasks"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn set_workbench_tasks(root: &mut Map<String, Value>, tasks: Vec<Value>) {
    let mut cron_tasks = root
        .get("cronTasks")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    cron_tasks.insert("tasks".to_string(), Value::Array(tasks));
    cron_tasks
        .entry("taskExecutionsById".to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    root.insert("cronTasks".to_string(), Value::Object(cron_tasks));
}

fn workbench_task_executions_map(root: &Map<String, Value>) -> Map<String, Value> {
    root.get("cronTasks")
        .and_then(|value| value.get("taskExecutionsById"))
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

fn set_workbench_task_executions_map(root: &mut Map<String, Value>, executions: Map<String, Value>) {
    let mut cron_tasks = root
        .get("cronTasks")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    cron_tasks.insert("taskExecutionsById".to_string(), Value::Object(executions));
    cron_tasks
        .entry("tasks".to_string())
        .or_insert_with(|| Value::Array(Vec::new()));
    root.insert("cronTasks".to_string(), Value::Object(cron_tasks));
}

fn build_workbench_task_record(
    payload: &Value,
    existing: Option<&Value>,
    forced_id: Option<String>,
) -> Value {
    let root = payload.as_object().cloned().unwrap_or_default();
    let schedule = root
        .get("schedule")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let job_payload = root
        .get("payload")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let name = root
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Untitled task");
    let id = forced_id
        .or_else(|| root.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
        .or_else(|| {
            existing
                .and_then(|value| value.get("id"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| format!("task-{}", unix_timestamp_ms()));
    let schedule_kind = schedule
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("cron");
    let (schedule_label, schedule_mode, schedule_config, cron_expression) = match schedule_kind {
        "every" => {
            let every_ms = schedule
                .get("everyMs")
                .and_then(Value::as_u64)
                .unwrap_or(30 * 60 * 1000);
            let interval_minutes = std::cmp::max(1, ((every_ms as f64) / 60000.0).round() as u64);
            (
                format!("@every {interval_minutes}m"),
                "interval".to_string(),
                json!({
                    "intervalValue": interval_minutes,
                    "intervalUnit": "minute"
                }),
                Value::Null,
            )
        }
        "at" => {
            let at = schedule
                .get("at")
                .and_then(Value::as_str)
                .unwrap_or("2026-01-01T09:00:00Z");
            (
                format!("at {at}"),
                "datetime".to_string(),
                json!({
                    "scheduledDate": at.split('T').next().unwrap_or("2026-01-01"),
                    "scheduledTime": at
                        .split('T')
                        .nth(1)
                        .and_then(|value| value.get(0..5))
                        .unwrap_or("09:00")
                }),
                Value::Null,
            )
        }
        _ => {
            let expr = schedule
                .get("expr")
                .and_then(Value::as_str)
                .unwrap_or("* * * * *");
            (
                expr.to_string(),
                "cron".to_string(),
                json!({
                    "cronExpression": expr,
                    "cronTimezone": schedule.get("tz").cloned().unwrap_or(Value::Null),
                    "staggerMs": schedule.get("staggerMs").cloned().unwrap_or(Value::Null)
                }),
                Value::String(expr.to_string()),
            )
        }
    };
    let payload_kind = job_payload
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or("agentTurn");
    let session_mode = match root.get("sessionTarget").and_then(Value::as_str) {
        Some("isolated") => "isolated",
        Some("current") => "current",
        Some("custom") => "custom",
        _ => "main",
    };
    let delivery = root
        .get("delivery")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let delivery_mode = match delivery.get("mode").and_then(Value::as_str) {
        Some("webhook") => "webhook",
        Some("none") => "none",
        _ if session_mode == "main" && !delivery.contains_key("mode") => "none",
        _ => "publishSummary",
    };

    json!({
        "id": id,
        "name": name,
        "description": root.get("description").cloned().unwrap_or(Value::Null),
        "prompt": job_payload.get("message").cloned().or_else(|| job_payload.get("text").cloned()).unwrap_or(Value::String(String::new())),
        "schedule": schedule_label,
        "scheduleMode": schedule_mode,
        "scheduleConfig": schedule_config,
        "cronExpression": cron_expression,
        "actionType": if payload_kind == "systemEvent" { "message" } else { "skill" },
        "status": if root.get("enabled").and_then(Value::as_bool) == Some(false) { "paused" } else { "active" },
        "sessionMode": session_mode,
        "customSessionId": root.get("customSessionId").cloned().unwrap_or(Value::Null),
        "wakeUpMode": if root.get("wakeMode").and_then(Value::as_str) == Some("next-heartbeat") { "nextCycle" } else { "immediate" },
        "executionContent": if payload_kind == "systemEvent" { "sendPromptMessage" } else { "runAssistantTask" },
        "timeoutSeconds": job_payload.get("timeoutSeconds").cloned().unwrap_or(Value::Null),
        "deleteAfterRun": root.get("deleteAfterRun").cloned().unwrap_or(Value::Null),
        "agentId": root.get("agentId").cloned().unwrap_or(Value::Null),
        "model": job_payload.get("model").cloned().unwrap_or(Value::Null),
        "thinking": job_payload.get("thinking").cloned().unwrap_or(Value::Null),
        "lightContext": job_payload.get("lightContext").cloned().unwrap_or(Value::Null),
        "deliveryMode": delivery_mode,
        "deliveryBestEffort": delivery.get("bestEffort").cloned().unwrap_or(Value::Null),
        "deliveryChannel": delivery.get("channel").cloned().unwrap_or(Value::Null),
        "deliveryLabel": delivery.get("label").cloned().unwrap_or(Value::Null),
        "recipient": delivery.get("to").cloned().unwrap_or(Value::Null),
        "lastRun": existing.and_then(|value| value.get("lastRun")).cloned().unwrap_or(Value::Null),
        "nextRun": existing.and_then(|value| value.get("nextRun")).cloned().unwrap_or(Value::Null),
        "latestExecution": existing.and_then(|value| value.get("latestExecution")).cloned().unwrap_or(Value::Null),
        "rawDefinition": payload.clone()
    })
}

fn create_task_execution_record(task_id: &str, trigger: &str) -> Value {
    let timestamp = pseudo_iso_timestamp();
    json!({
        "id": format!("exec-{}", unix_timestamp_ms()),
        "taskId": task_id,
        "status": "success",
        "trigger": trigger,
        "startedAt": timestamp,
        "finishedAt": timestamp,
        "summary": "Managed task completed successfully."
    })
}

fn create_instance_task_in_snapshot(snapshot: Value, payload: Value) -> Result<Value, String> {
    let mut root = into_object(snapshot);
    let mut tasks = workbench_tasks(&root);
    let task = build_workbench_task_record(&payload, None, None);
    let task_id = task
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "task record must include an id".to_string())?;
    if tasks
        .iter()
        .any(|entry| entry.get("id").and_then(Value::as_str) == Some(task_id))
    {
        return Err(format!("task \"{task_id}\" already exists"));
    }
    tasks.insert(0, task);
    set_workbench_tasks(&mut root, tasks);
    Ok(Value::Object(root))
}

fn update_instance_task_in_snapshot(
    snapshot: Value,
    task_id: &str,
    payload: Value,
) -> Result<Value, String> {
    let mut root = into_object(snapshot);
    let tasks = workbench_tasks(&root);
    let Some(current) = tasks
        .iter()
        .find(|entry| entry.get("id").and_then(Value::as_str) == Some(task_id))
        .cloned()
    else {
        return Err(format!("task \"{task_id}\" not found"));
    };
    let next_tasks = tasks
        .into_iter()
        .map(|entry| {
            if entry.get("id").and_then(Value::as_str) == Some(task_id) {
                build_workbench_task_record(&payload, Some(&current), Some(task_id.to_string()))
            } else {
                entry
            }
        })
        .collect::<Vec<_>>();
    set_workbench_tasks(&mut root, next_tasks);
    Ok(Value::Object(root))
}

fn clone_instance_task_in_snapshot(
    snapshot: Value,
    task_id: &str,
    name: Option<&str>,
) -> Result<Value, String> {
    let mut root = into_object(snapshot);
    let mut tasks = workbench_tasks(&root);
    let existing_ids = tasks
        .iter()
        .filter_map(|entry| entry.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
        .collect::<BTreeSet<_>>();
    let Some(source) = tasks
        .iter()
        .find(|entry| entry.get("id").and_then(Value::as_str) == Some(task_id))
        .cloned()
    else {
        return Err(format!("task \"{task_id}\" not found"));
    };
    let source_name = source
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Untitled task")
        .to_string();
    let cloned_id = dedupe_id(&format!("{task_id}-copy"), &existing_ids);
    let mut cloned = source;
    if let Some(object) = cloned.as_object_mut() {
        object.insert("id".to_string(), Value::String(cloned_id.clone()));
        object.insert(
            "name".to_string(),
            Value::String(
                name.filter(|value| !value.trim().is_empty())
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| format!("{source_name} (copy)")),
            ),
        );
        object.insert("latestExecution".to_string(), Value::Null);
        object.remove("lastRun");
        object.remove("nextRun");
        if let Some(raw_definition) = object
            .get_mut("rawDefinition")
            .and_then(Value::as_object_mut)
        {
            raw_definition.insert("id".to_string(), Value::String(cloned_id));
        }
    }
    tasks.insert(0, cloned);
    set_workbench_tasks(&mut root, tasks);
    Ok(Value::Object(root))
}

fn run_instance_task_now_in_snapshot(
    snapshot: Value,
    task_id: &str,
) -> Result<(Value, Value), String> {
    let mut root = into_object(snapshot);
    let mut tasks = workbench_tasks(&root);
    let task = tasks
        .iter_mut()
        .find(|entry| entry.get("id").and_then(Value::as_str) == Some(task_id))
        .ok_or_else(|| format!("task \"{task_id}\" not found"))?;
    let execution = create_task_execution_record(task_id, "manual");
    if let Some(task_object) = task.as_object_mut() {
        task_object.insert("latestExecution".to_string(), execution.clone());
        task_object.insert(
            "lastRun".to_string(),
            execution
                .get("startedAt")
                .cloned()
                .unwrap_or(Value::String(pseudo_iso_timestamp())),
        );
    }
    let mut executions = workbench_task_executions_map(&root);
    let mut items = executions
        .remove(task_id)
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default();
    items.insert(0, execution.clone());
    executions.insert(task_id.to_string(), Value::Array(items));
    set_workbench_tasks(&mut root, tasks);
    set_workbench_task_executions_map(&mut root, executions);
    Ok((Value::Object(root), execution))
}

fn list_instance_task_executions_from_snapshot(snapshot: &Value, task_id: &str) -> Vec<Value> {
    snapshot
        .get("cronTasks")
        .and_then(|value| value.get("taskExecutionsById"))
        .and_then(|value| value.get(task_id))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn update_instance_task_status_in_snapshot(
    snapshot: Value,
    task_id: &str,
    status: &str,
) -> Result<Value, String> {
    let mut root = into_object(snapshot);
    let mut tasks = workbench_tasks(&root);
    let mut found = false;
    for task in &mut tasks {
        if task.get("id").and_then(Value::as_str) == Some(task_id) {
            found = true;
            if let Some(task_object) = task.as_object_mut() {
                task_object.insert("status".to_string(), Value::String(status.to_string()));
            }
        }
    }
    if !found {
        return Err(format!("task \"{task_id}\" not found"));
    }
    set_workbench_tasks(&mut root, tasks);
    Ok(Value::Object(root))
}

fn delete_instance_task_in_snapshot(snapshot: Value, task_id: &str) -> (Value, bool) {
    let mut root = into_object(snapshot);
    let tasks = workbench_tasks(&root);
    let deleted = tasks
        .iter()
        .any(|entry| entry.get("id").and_then(Value::as_str) == Some(task_id));
    let next_tasks = tasks
        .into_iter()
        .filter(|entry| entry.get("id").and_then(Value::as_str) != Some(task_id))
        .collect::<Vec<_>>();
    let mut executions = workbench_task_executions_map(&root);
    executions.remove(task_id);
    set_workbench_tasks(&mut root, next_tasks);
    set_workbench_task_executions_map(&mut root, executions);
    (Value::Object(root), deleted)
}

fn update_instance_file_content_in_snapshot(
    snapshot: Value,
    file_id: &str,
    content: String,
) -> Result<(Value, bool), String> {
    let mut root = into_object(snapshot);
    let mut files = root
        .get("files")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut updated = false;
    for file in &mut files {
        let matches = file.get("id").and_then(Value::as_str) == Some(file_id)
            || file.get("path").and_then(Value::as_str) == Some(file_id);
        if matches {
            updated = true;
            if let Some(file_object) = file.as_object_mut() {
                file_object.insert("content".to_string(), Value::String(content.clone()));
                file_object.insert(
                    "size".to_string(),
                    Value::String(format_workbench_file_size(content.as_str())),
                );
                file_object.insert(
                    "updatedAt".to_string(),
                    Value::String(pseudo_iso_timestamp()),
                );
                file_object.insert("status".to_string(), Value::String("modified".to_string()));
            }
        }
    }
    files = sort_workbench_files(files);
    root.insert("files".to_string(), Value::Array(files.clone()));
    root.insert(
        "memory".to_string(),
        Value::Array(build_workbench_memory_entries(&files)),
    );
    Ok((Value::Object(root), updated))
}

fn update_instance_llm_provider_config_in_snapshot(
    snapshot: Value,
    provider_id: &str,
    update: Value,
) -> Result<(Value, bool), String> {
    let update_object = update
        .as_object()
        .cloned()
        .ok_or_else(|| "llm provider config update must be an object".to_string())?;
    let endpoint = update_object
        .get("endpoint")
        .and_then(Value::as_str)
        .unwrap_or("https://api.openai.com/v1");
    let api_key_source = update_object
        .get("apiKeySource")
        .and_then(Value::as_str)
        .unwrap_or("");
    let default_model_id = update_object
        .get("defaultModelId")
        .and_then(Value::as_str)
        .unwrap_or("gpt-5.4");
    let reasoning_model_id = update_object
        .get("reasoningModelId")
        .and_then(Value::as_str);
    let embedding_model_id = update_object
        .get("embeddingModelId")
        .and_then(Value::as_str);
    let config = update_object
        .get("config")
        .cloned()
        .unwrap_or_else(|| json!({
            "temperature": 0.2,
            "topP": 1.0,
            "maxTokens": 4096,
            "timeoutMs": 60000,
            "streaming": true
        }));

    let mut root = into_object(snapshot);
    let mut providers = root
        .get("llmProviders")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut updated = false;
    for provider in &mut providers {
        if provider.get("id").and_then(Value::as_str) == Some(provider_id) {
            updated = true;
            if let Some(provider_object) = provider.as_object_mut() {
                provider_object.insert(
                    "endpoint".to_string(),
                    Value::String(endpoint.to_string()),
                );
                provider_object.insert(
                    "apiKeySource".to_string(),
                    Value::String(api_key_source.to_string()),
                );
                provider_object.insert(
                    "status".to_string(),
                    Value::String(
                        if api_key_source.trim().is_empty() {
                            "configurationRequired"
                        } else {
                            "ready"
                        }
                        .to_string(),
                    ),
                );
                provider_object.insert(
                    "defaultModelId".to_string(),
                    Value::String(default_model_id.to_string()),
                );
                provider_object.insert(
                    "reasoningModelId".to_string(),
                    reasoning_model_id
                        .map(|value| Value::String(value.to_string()))
                        .unwrap_or(Value::Null),
                );
                provider_object.insert(
                    "embeddingModelId".to_string(),
                    embedding_model_id
                        .map(|value| Value::String(value.to_string()))
                        .unwrap_or(Value::Null),
                );
                provider_object.insert(
                    "lastCheckedAt".to_string(),
                    Value::String(pseudo_iso_timestamp()),
                );
                provider_object.insert("config".to_string(), config.clone());
                provider_object.insert(
                    "models".to_string(),
                    Value::Array(build_provider_models(
                        default_model_id,
                        reasoning_model_id,
                        embedding_model_id,
                    )),
                );
            }
        }
    }

    if !updated {
        providers.push(json!({
            "id": provider_id,
            "name": provider_id.to_ascii_uppercase(),
            "provider": provider_id,
            "endpoint": endpoint,
            "apiKeySource": api_key_source,
            "status": if api_key_source.trim().is_empty() { "configurationRequired" } else { "ready" },
            "defaultModelId": default_model_id,
            "reasoningModelId": reasoning_model_id,
            "embeddingModelId": embedding_model_id,
            "description": "Managed provider profile projected by the canonical host workbench.",
            "icon": provider_id
                .chars()
                .next()
                .map(|value| value.to_ascii_uppercase().to_string())
                .unwrap_or_else(|| "P".to_string()),
            "lastCheckedAt": pseudo_iso_timestamp(),
            "capabilities": ["chat", "reasoning", "embedding"],
            "models": build_provider_models(
                default_model_id,
                reasoning_model_id,
                embedding_model_id,
            ),
            "config": config
        }));
        updated = true;
    }

    root.insert("llmProviders".to_string(), Value::Array(providers));
    Ok((Value::Object(root), updated))
}

fn build_provider_models(
    default_model_id: &str,
    reasoning_model_id: Option<&str>,
    embedding_model_id: Option<&str>,
) -> Vec<Value> {
    let mut models = vec![json!({
        "id": default_model_id,
        "name": default_model_id,
        "role": "primary",
        "contextWindow": "128k"
    })];
    if let Some(value) = reasoning_model_id {
        models.push(json!({
            "id": value,
            "name": value,
            "role": "reasoning",
            "contextWindow": "200k"
        }));
    }
    if let Some(value) = embedding_model_id {
        models.push(json!({
            "id": value,
            "name": value,
            "role": "embedding",
            "contextWindow": "8k"
        }));
    }
    models
}

fn normalize_storage(raw: Option<Value>, namespace: &str, provider: &str) -> Value {
    let mut value = json!({ "provider": provider, "namespace": namespace });
    if let Some(raw) = raw {
        merge_values(&mut value, raw);
    }
    value
}

fn default_instance_config(
    port: u16,
    published_base_url: Option<&str>,
    published_websocket_url: Option<&str>,
) -> Value {
    json!({
        "port": port.to_string(),
        "sandbox": true,
        "autoUpdate": true,
        "logLevel": "info",
        "corsOrigins": "*",
        "baseUrl": published_base_url.map(|value| Value::String(value.to_string())).unwrap_or(Value::Null),
        "websocketUrl": published_websocket_url.map(|value| Value::String(value.to_string())).unwrap_or(Value::Null),
        "authToken": Value::Null
    })
}

fn normalize_config(
    raw: Option<Value>,
    port: u16,
    host: &str,
    supports_ws: bool,
    published_base_url: Option<&str>,
    published_websocket_url: Option<&str>,
    force_published_urls: bool,
) -> Value {
    let mut value = default_instance_config(port, published_base_url, published_websocket_url);
    if let Some(raw) = raw {
        merge_values(&mut value, raw);
    }
    let resolved_base_url = if force_published_urls {
        published_base_url.map(|value| Value::String(value.to_string()))
    } else {
        Some(Value::String(format!("http://{host}:{port}")))
    }
    .unwrap_or(Value::Null);
    let resolved_websocket_url = if force_published_urls {
        published_websocket_url
            .map(|value| Value::String(value.to_string()))
            .or_else(|| {
                if supports_ws {
                    derive_websocket_endpoint(published_base_url, host, Some(port))
                        .map(Value::String)
                } else {
                    None
                }
            })
    } else if supports_ws {
        Some(Value::String(format!("ws://{host}:{port}")))
    } else {
        None
    }
    .unwrap_or(Value::Null);
    if let Some(object) = value.as_object_mut() {
        object.insert("port".to_string(), Value::String(port.to_string()));
        object.insert("baseUrl".to_string(), resolved_base_url);
        object.insert("websocketUrl".to_string(), resolved_websocket_url);
    }
    value
}

fn normalize_default_instance_selection(document: &mut InstancesDocument) -> bool {
    let selected_custom_index = document
        .custom_instances
        .iter()
        .rposition(|value| value.get("isDefault").and_then(Value::as_bool) == Some(true));
    let built_in_should_be_default = selected_custom_index.is_none();
    let mut changed = false;

    let built_in = document
        .built_in_instance
        .get_or_insert_with(|| Value::Object(Map::new()));
    let previous_built_in_default = built_in
        .get("isDefault")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    if previous_built_in_default != built_in_should_be_default {
        let mut object = into_object(built_in.clone());
        object.insert(
            "isDefault".to_string(),
            Value::Bool(built_in_should_be_default),
        );
        *built_in = Value::Object(object);
        changed = true;
    }

    for (index, instance) in document.custom_instances.iter_mut().enumerate() {
        let should_be_default = selected_custom_index == Some(index);
        let previous = instance
            .get("isDefault")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if previous != should_be_default {
            let mut object = into_object(instance.clone());
            object.insert("isDefault".to_string(), Value::Bool(should_be_default));
            *instance = Value::Object(object);
            changed = true;
        }
    }

    changed
}

fn canonical_built_in_instance_id(value: &str) -> &str {
    let normalized = value.trim();
    if normalized == BUILT_IN_INSTANCE_ID {
        BUILT_IN_INSTANCE_ID
    } else {
        normalized
    }
}

fn canonicalize_built_in_instance_value(value: &str, built_in_instance_id: &str) -> String {
    if value.trim() == built_in_instance_id {
        built_in_instance_id.to_string()
    } else {
        value.trim().to_string()
    }
}

fn to_control_plane_gateway_invoke_request(
    request: StudioOpenClawGatewayInvokeRequest,
    options: StudioOpenClawGatewayInvokeOptions,
) -> ControlPlaneOpenClawGatewayInvokeRequest {
    ControlPlaneOpenClawGatewayInvokeRequest {
        tool: request.tool,
        action: request.action,
        args: request.args,
        session_key: request.session_key,
        dry_run: request.dry_run,
        message_channel: options.message_channel,
        account_id: options.account_id,
        headers: if options.headers.is_empty() {
            None
        } else {
            Some(options.headers)
        },
    }
}

fn derive_websocket_endpoint(
    base_url: Option<&str>,
    host: &str,
    active_port: Option<u16>,
) -> Option<String> {
    if let Some(base_url) = base_url {
        if let Some(stripped) = base_url.strip_prefix("https://") {
            return Some(format!("wss://{stripped}"));
        }
        if let Some(stripped) = base_url.strip_prefix("http://") {
            return Some(format!("ws://{stripped}"));
        }
    }

    active_port.map(|port| format!("ws://{host}:{port}"))
}

fn normalize_capabilities(raw: Option<Value>, runtime_kind: &str) -> Value {
    if let Some(raw) = raw {
        if let Some(items) = raw.as_array() {
            if !items.is_empty() {
                return Value::Array(items.clone());
            }
        }
    }
    let defaults = if runtime_kind == "openclaw" {
        vec![
            "chat", "health", "files", "memory", "tasks", "tools", "models",
        ]
    } else {
        vec!["chat", "health", "models"]
    };
    Value::Array(
        defaults
            .into_iter()
            .map(|item| Value::String(item.to_string()))
            .collect(),
    )
}

fn normalized_capability_snapshots(raw: Option<Value>) -> Value {
    let capabilities = raw
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| item.as_str().map(ToOwned::to_owned))
        .map(|id| {
            json!({
                "id": id,
                "status": "ready",
                "detail": "Server-backed studio detail projection.",
                "source": "runtime"
            })
        })
        .collect::<Vec<_>>();
    Value::Array(capabilities)
}

fn value_as_u16(value: Option<&Value>) -> Option<u16> {
    match value? {
        Value::Number(number) => number.as_u64().and_then(|value| u16::try_from(value).ok()),
        Value::String(value) => value.parse::<u16>().ok(),
        _ => None,
    }
}

fn merge_values(target: &mut Value, patch: Value) {
    match (target, patch) {
        (Value::Object(target_object), Value::Object(patch_object)) => {
            for (key, patch_value) in patch_object {
                if let Some(target_value) = target_object.get_mut(&key) {
                    merge_values(target_value, patch_value);
                } else {
                    target_object.insert(key, patch_value);
                }
            }
        }
        (target_slot, patch_value) => *target_slot = patch_value,
    }
}

fn into_object(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(object) => object,
        _ => Map::new(),
    }
}

fn read_json_document<T>(path: &Path) -> Result<T, String>
where
    T: Default + DeserializeOwned + Serialize,
{
    if !path.exists() {
        return Ok(T::default());
    }
    let bytes = fs::read(path).map_err(|error| format!("read {}: {error}", path.display()))?;
    if bytes.is_empty() {
        return Ok(T::default());
    }
    match serde_json::from_slice(&bytes) {
        Ok(document) => Ok(document),
        Err(error) => recover_json_document_from_concatenated_store(path, &bytes, error),
    }
}

fn recover_json_document_from_concatenated_store<T>(
    path: &Path,
    bytes: &[u8],
    original_error: serde_json::Error,
) -> Result<T, String>
where
    T: DeserializeOwned + Serialize,
{
    let mut values = Vec::new();
    for value in serde_json::Deserializer::from_slice(bytes).into_iter::<Value>() {
        match value {
            Ok(value) => values.push(value),
            Err(_) => break,
        }
    }

    for value in values.into_iter().rev() {
        if let Ok(document) = serde_json::from_value::<T>(value) {
            write_json_document(path, &document)?;
            return Ok(document);
        }
    }

    Err(format!("deserialize {}: {original_error}", path.display()))
}

fn write_json_document<T>(path: &Path, value: &T) -> Result<(), String>
where
    T: Serialize,
{
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("create {}: {error}", parent.display()))?;
    }
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("serialize {}: {error}", path.display()))?;
    write_json_document_bytes(path, &bytes)
}

fn write_json_document_bytes(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("document.json");
    let temp_path = parent.join(format!(".{file_name}.{}.tmp", Uuid::new_v4()));
    let mut temp_file = fs::File::create(&temp_path)
        .map_err(|error| format!("create {}: {error}", temp_path.display()))?;
    temp_file
        .write_all(bytes)
        .map_err(|error| format!("write {}: {error}", temp_path.display()))?;
    temp_file
        .sync_all()
        .map_err(|error| format!("flush {}: {error}", temp_path.display()))?;
    drop(temp_file);

    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("replace {}: {error}", path.display()))?;
    }

    fs::rename(&temp_path, path).map_err(|error| {
        let _ = fs::remove_file(&temp_path);
        format!(
            "replace {} with {}: {error}",
            path.display(),
            temp_path.display()
        )
    })
}

fn serialize_provider_value<T>(value: T, label: &str) -> Result<Value, String>
where
    T: Serialize,
{
    serde_json::to_value(value).map_err(|error| format!("serialize {label}: {error}"))
}

fn serialize_optional_provider_value<T>(
    value: Option<T>,
    label: &str,
) -> Result<Option<Value>, String>
where
    T: Serialize,
{
    value
        .map(|item| serialize_provider_value(item, label))
        .transpose()
}

fn deserialize_provider_value<T>(value: Value, label: &str) -> Result<T, String>
where
    T: DeserializeOwned,
{
    serde_json::from_value(value).map_err(|error| format!("deserialize {label}: {error}"))
}

fn slugify(input: &str) -> String {
    let mut result = String::new();
    let mut last_dash = false;
    for character in input.chars() {
        if character.is_ascii_alphanumeric() {
            result.push(character.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            result.push('-');
            last_dash = true;
        }
    }
    let trimmed = result.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "custom-instance".to_string()
    } else {
        trimmed
    }
}

fn dedupe_id(base: &str, existing: &BTreeSet<String>) -> String {
    if !existing.contains(base) {
        return base.to_string();
    }
    let mut counter = 2u64;
    loop {
        let candidate = format!("{base}-{counter}");
        if !existing.contains(&candidate) {
            return candidate;
        }
        counter += 1;
    }
}

fn unix_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::{
        build_default_studio_public_api_provider, build_typed_studio_public_api_provider,
        StudioOpenClawGatewayInvokeOptions, StudioOpenClawGatewayInvokeRequest,
        TypedStudioPublicApiBackend,
    };
    use sdkwork_clawstudio_host_core::{
        host_endpoints::{HostEndpointRegistration, HostEndpointRegistry, OpenClawLifecycle},
        openclaw_control_plane::OpenClawControlPlane,
    };
    use serde::{Deserialize, Serialize};
    use serde_json::{json, Value};
    use std::{
        fs,
        sync::{Arc, Mutex},
    };

    #[test]
    fn host_studio_production_path_has_no_panic_exits() {
        let source = include_str!("lib.rs");
        let production_source = source.split("#[cfg(test)]").next().unwrap_or(source);
        let forbidden_patterns = [
            ".expect(",
            ".unwrap(",
            "panic!(",
            "todo!(",
            "unimplemented!(",
            "unreachable!(",
        ];
        let mut offenders = Vec::new();

        for (index, line) in production_source.lines().enumerate() {
            for pattern in forbidden_patterns {
                if line.contains(pattern) {
                    offenders.push(format!("{}:{}", index + 1, line.trim()));
                }
            }
        }

        assert!(
            offenders.is_empty(),
            "host-studio production code must avoid panic exits on runtime boundaries:\n{}",
            offenders.join("\n")
        );
    }

    #[test]
    fn default_provider_exposes_canonical_built_in_instance_projection() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let instances = provider.list_instances().expect("list instances");
        let built_in = instances
            .as_array()
            .and_then(|items| {
                items.iter().find(|item| {
                    item.get("id").and_then(serde_json::Value::as_str)
                        == Some("managed-openclaw-primary")
                })
            })
            .expect("built-in instance");

        assert_eq!(
            built_in
                .get("deploymentMode")
                .and_then(serde_json::Value::as_str),
            Some("local-managed")
        );
        assert_eq!(
            built_in
                .get("transportKind")
                .and_then(serde_json::Value::as_str),
            Some("openclawGatewayWs")
        );
    }

    #[test]
    fn default_provider_repairs_concatenated_instance_store_documents_before_listing() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = super::ServerStudioPublicApiProvider::new(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");
        let instances_path = provider.instances_path();
        fs::create_dir_all(instances_path.parent().expect("instances dir"))
            .expect("create instances dir");
        let stale_document = json!({
            "customInstances": [
                {
                    "id": "stale-openclaw",
                    "name": "Stale OpenClaw"
                }
            ]
        });
        let current_document = json!({
            "customInstances": [
                {
                    "id": "current-openclaw",
                    "name": "Current OpenClaw"
                }
            ]
        });
        fs::write(
            &instances_path,
            format!(
                "{}\n{}",
                serde_json::to_string_pretty(&stale_document).expect("stale json"),
                serde_json::to_string_pretty(&current_document).expect("current json")
            ),
        )
        .expect("write concatenated instances store");

        let instances = <super::ServerStudioPublicApiProvider as super::StudioPublicApiProvider>::list_instances(
            &provider,
        )
        .expect("list instances");
        let ids = instances
            .as_array()
            .expect("instance array")
            .iter()
            .filter_map(|instance| instance.get("id").and_then(Value::as_str))
            .collect::<Vec<_>>();

        assert!(ids.contains(&"current-openclaw"));
        assert!(!ids.contains(&"stale-openclaw"));
        serde_json::from_str::<Value>(
            &fs::read_to_string(&instances_path).expect("repaired instances store"),
        )
        .expect("instances store should be repaired to one strict JSON document");
    }

    #[test]
    fn default_provider_repairs_instance_store_document_with_trailing_stale_bytes() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = super::ServerStudioPublicApiProvider::new(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");
        let instances_path = provider.instances_path();
        fs::create_dir_all(instances_path.parent().expect("instances dir"))
            .expect("create instances dir");
        let current_document = json!({
            "customInstances": [
                {
                    "id": "current-openclaw",
                    "name": "Current OpenClaw"
                }
            ]
        });
        fs::write(
            &instances_path,
            format!(
                "{}\n{{\"customInstances\":[{{\"id\":\"stale-openclaw\"",
                serde_json::to_string_pretty(&current_document).expect("current json")
            ),
        )
        .expect("write instances store with stale tail");

        let instances = <super::ServerStudioPublicApiProvider as super::StudioPublicApiProvider>::list_instances(
            &provider,
        )
        .expect("list instances");
        let ids = instances
            .as_array()
            .expect("instance array")
            .iter()
            .filter_map(|instance| instance.get("id").and_then(Value::as_str))
            .collect::<Vec<_>>();

        assert!(ids.contains(&"current-openclaw"));
        assert!(!ids.contains(&"stale-openclaw"));
        let repaired = fs::read_to_string(&instances_path).expect("repaired instances store");
        serde_json::from_str::<Value>(&repaired)
            .expect("instances store should be repaired to one strict JSON document");
        assert!(!repaired.contains("stale-openclaw"));
    }

    #[test]
    fn default_provider_projects_built_in_endpoint_from_openclaw_control_plane() {
        let root = tempfile::tempdir().expect("temp dir");
        let mut host_endpoints = HostEndpointRegistry::default();
        host_endpoints.register(HostEndpointRegistration {
            endpoint_id: "openclaw-gateway".to_string(),
            bind_host: "10.0.0.8".to_string(),
            requested_port: 28_789,
            active_port: Some(42_617),
            scheme: "http".to_string(),
            base_path: None,
            websocket_path: None,
            loopback_only: false,
            dynamic_port: true,
            last_conflict_at: None,
            last_conflict_reason: Some("requested port busy".to_string()),
        });
        let control_plane = OpenClawControlPlane::inactive("test-host")
            .with_host_endpoints(host_endpoints)
            .with_gateway_endpoint("openclaw-gateway", OpenClawLifecycle::Ready);
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(control_plane),
        )
        .expect("provider");

        let built_in = provider
            .get_instance("managed-openclaw-primary")
            .expect("get instance")
            .expect("built-in instance");

        assert_eq!(
            built_in
                .get("host")
                .and_then(serde_json::Value::as_str),
            Some("10.0.0.8")
        );
        assert_eq!(
            built_in
                .get("port")
                .and_then(serde_json::Value::as_u64),
            Some(42_617)
        );
        assert_eq!(
            built_in
                .get("baseUrl")
                .and_then(serde_json::Value::as_str),
            Some("http://10.0.0.8:42617")
        );
        assert_eq!(
            built_in
                .get("websocketUrl")
                .and_then(serde_json::Value::as_str),
            Some("ws://10.0.0.8:42617")
        );
        assert_eq!(
            built_in
                .get("config")
                .and_then(|value| value.get("port"))
                .and_then(serde_json::Value::as_str),
            Some("28789")
        );
        assert_eq!(
            built_in
                .get("config")
                .and_then(|value| value.get("baseUrl"))
                .and_then(serde_json::Value::as_str),
            Some("http://10.0.0.8:42617")
        );
    }

    #[test]
    fn default_provider_rejects_legacy_built_in_openclaw_identity_requests() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        assert_eq!(
            provider
                .get_instance("local-built-in")
                .expect("legacy lookup should not error"),
            None
        );
        assert_eq!(
            provider
                .get_instance_detail("local-built-in")
                .expect("legacy detail lookup should not error"),
            None
        );
    }

    #[test]
    fn default_provider_persists_custom_instance_config_updates() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Shared Server Instance",
                "runtimeKind": "openclaw",
                "deploymentMode": "local-managed",
                "transportKind": "openclawGatewayWs"
            }))
            .expect("create instance");
        let id = created
            .get("id")
            .and_then(serde_json::Value::as_str)
            .expect("id");

        let config = provider
            .update_instance_config(
                id,
                json!({
                    "port": "28888",
                    "sandbox": true,
                    "autoUpdate": false,
                    "logLevel": "debug",
                    "corsOrigins": "http://localhost:3001"
                }),
            )
            .expect("update config")
            .expect("config projection");

        assert_eq!(
            config.get("port").and_then(serde_json::Value::as_str),
            Some("28888")
        );
    }

    #[test]
    fn default_provider_preserves_stable_built_in_openclaw_identity_without_rewriting_legacy_id() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = super::ServerStudioPublicApiProvider::new(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");
        provider
            .write_instances(&super::InstancesDocument {
                built_in_instance: Some(json!({
                    "id": "managed-openclaw-primary",
                    "name": "Built-In OpenClaw Primary",
                    "description": "Stable built-in OpenClaw identity.",
                    "runtimeKind": "openclaw",
                    "deploymentMode": "local-managed",
                    "transportKind": "openclawGatewayWs",
                    "status": "online",
                    "isBuiltIn": true,
                    "isDefault": true,
                    "typeLabel": "Built-In OpenClaw"
                })),
                custom_instances: Vec::new(),
            })
            .expect("seed instances");

        let instances = provider.list_instances().expect("list instances");
        let built_in = instances
            .iter()
            .find(|item| {
                item.get("id").and_then(serde_json::Value::as_str)
                    == Some("managed-openclaw-primary")
            })
            .expect("stable built-in instance");

        assert_eq!(
            built_in
                .get("name")
                .and_then(serde_json::Value::as_str),
            Some("Built-In OpenClaw Primary")
        );
        assert!(
            !instances.iter().any(|item| {
                item.get("id").and_then(serde_json::Value::as_str) == Some("local-built-in")
            }),
            "stable built-in identity should not be rewritten back to local-built-in"
        );

        let detail = provider
            .get_instance_detail("managed-openclaw-primary")
            .expect("get detail")
            .expect("stable built-in detail");
        assert_eq!(
            detail
                .get("instance")
                .and_then(|value| value.get("id"))
                .and_then(serde_json::Value::as_str),
            Some("managed-openclaw-primary")
        );
    }

    #[test]
    fn default_provider_updates_stable_built_in_openclaw_by_actual_instance_id() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = super::ServerStudioPublicApiProvider::new(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");
        provider
            .write_instances(&super::InstancesDocument {
                built_in_instance: Some(json!({
                    "id": "managed-openclaw-primary",
                    "name": "Built-In OpenClaw Primary",
                    "description": "Stable built-in OpenClaw identity.",
                    "runtimeKind": "openclaw",
                    "deploymentMode": "local-managed",
                    "transportKind": "openclawGatewayWs",
                    "status": "offline",
                    "isBuiltIn": true,
                    "isDefault": true,
                    "typeLabel": "Built-In OpenClaw"
                })),
                custom_instances: Vec::new(),
            })
            .expect("seed instances");

        let updated = provider
            .update_instance(
                "managed-openclaw-primary",
                json!({
                    "name": "Built-In OpenClaw Primary Renamed",
                    "config": {
                        "port": "18871"
                    }
                }),
            )
            .expect("update built-in instance");

        assert_eq!(
            updated.get("id").and_then(serde_json::Value::as_str),
            Some("managed-openclaw-primary")
        );
        assert_eq!(
            updated.get("name").and_then(serde_json::Value::as_str),
            Some("Built-In OpenClaw Primary Renamed")
        );
    }

    #[test]
    fn default_provider_does_not_project_built_in_managed_workbench_when_control_plane_is_inactive() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let detail = provider
            .get_instance_detail("managed-openclaw-primary")
            .expect("detail request should succeed")
            .expect("built-in detail should exist");
        let task_create_error = provider
            .create_instance_task(
                "managed-openclaw-primary",
                json!({
                    "id": "job-1",
                    "name": "Daily Sync",
                    "schedule": {
                        "kind": "cron",
                        "expr": "0 9 * * *",
                        "tz": "Asia/Shanghai"
                    },
                    "payload": {
                        "kind": "agentTurn",
                        "message": "Summarize updates.",
                        "model": "openai/gpt-5.4"
                    }
                }),
            )
            .expect_err("inactive control plane should not expose managed task CRUD");
        let file_update_error = provider
            .update_instance_file_content(
                "managed-openclaw-primary",
                "/workspace/main/AGENTS.md",
                "# Updated main agent".to_string(),
            )
            .expect_err("inactive control plane should not expose managed file edits");
        let provider_update_error = provider
            .update_instance_llm_provider_config(
                "managed-openclaw-primary",
                "openai",
                json!({
                    "endpoint": "https://api.openai.com/v1",
                    "apiKeySource": "env:OPENAI_API_KEY",
                    "defaultModelId": "gpt-5.4",
                    "reasoningModelId": "o4-mini",
                    "embeddingModelId": "text-embedding-3-large",
                    "config": {
                        "temperature": 0.1,
                        "topP": 1.0,
                        "maxTokens": 4096,
                        "timeoutMs": 60000,
                        "streaming": true
                    }
                }),
            )
            .expect_err("inactive control plane should not expose managed provider edits");

        assert_eq!(detail.get("workbench"), Some(&Value::Null));
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("lifecycleControllable"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("workbenchManaged"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("endpointObserved"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert!(
            task_create_error.contains("managed workbench"),
            "unexpected error: {task_create_error}"
        );
        assert!(
            file_update_error.contains("managed workbench"),
            "unexpected error: {file_update_error}"
        );
        assert!(
            provider_update_error.contains("managed workbench"),
            "unexpected error: {provider_update_error}"
        );
    }

    #[test]
    fn default_provider_preserves_remote_custom_endpoint_projection_and_unique_default_selection() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Remote Gateway",
                "runtimeKind": "openclaw",
                "deploymentMode": "remote",
                "transportKind": "openclawGatewayWs",
                "host": "gateway.example.com",
                "port": 443,
                "baseUrl": "https://gateway.example.com/claw/api",
                "websocketUrl": "wss://gateway.example.com/claw/ws",
                "isDefault": true,
                "config": {
                    "port": "443",
                    "baseUrl": "https://gateway.example.com/claw/api",
                    "websocketUrl": "wss://gateway.example.com/claw/ws"
                }
            }))
            .expect("create remote instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id")
            .to_string();

        let built_in = provider
            .get_instance("managed-openclaw-primary")
            .expect("get built-in")
            .expect("built-in projection");
        let remote = provider
            .get_instance(id.as_str())
            .expect("get remote")
            .expect("remote projection");
        let detail = provider
            .get_instance_detail(id.as_str())
            .expect("detail request should succeed")
            .expect("remote detail should exist");

        assert_eq!(
            built_in.get("isDefault").and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(remote.get("isDefault").and_then(Value::as_bool), Some(true));
        assert_eq!(
            remote.get("deploymentMode").and_then(Value::as_str),
            Some("remote")
        );
        assert_eq!(
            remote.get("baseUrl").and_then(Value::as_str),
            Some("https://gateway.example.com/claw/api")
        );
        assert_eq!(
            remote.get("websocketUrl").and_then(Value::as_str),
            Some("wss://gateway.example.com/claw/ws")
        );
        assert_eq!(remote.get("port").and_then(Value::as_u64), Some(443));
        assert_eq!(
            remote
                .get("config")
                .and_then(|value| value.get("baseUrl"))
                .and_then(Value::as_str),
            Some("https://gateway.example.com/claw/api")
        );
        assert_eq!(
            remote
                .get("config")
                .and_then(|value| value.get("websocketUrl"))
                .and_then(Value::as_str),
            Some("wss://gateway.example.com/claw/ws")
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("owner"))
                .and_then(Value::as_str),
            Some("remoteService")
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("startStopSupported"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("configWritable"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("lifecycleControllable"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("workbenchManaged"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("endpointObserved"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(detail.get("workbench"), Some(&Value::Null));
    }

    #[test]
    fn default_provider_remote_openclaw_detail_downgrades_blank_base_url_endpoint_status() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Remote Blank Base URL",
                "runtimeKind": "openclaw",
                "deploymentMode": "remote",
                "transportKind": "openclawGatewayWs",
                "host": "gateway.example.com",
                "port": 443,
                "baseUrl": "",
                "websocketUrl": "wss://gateway.example.com/claw/ws",
                "config": {
                    "port": "443",
                    "baseUrl": "",
                    "websocketUrl": "wss://gateway.example.com/claw/ws"
                }
            }))
            .expect("create remote instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id");

        let detail = provider
            .get_instance_detail(id)
            .expect("detail request should succeed")
            .expect("remote detail should exist");
        let endpoint = detail
            .get("connectivity")
            .and_then(|value| value.get("endpoints"))
            .and_then(Value::as_array)
            .and_then(|endpoints| {
                endpoints.iter().find(|endpoint| {
                    endpoint.get("id").and_then(Value::as_str) == Some("base-url")
                })
            })
            .expect("base-url endpoint");

        assert_eq!(
            endpoint.get("status").and_then(Value::as_str),
            Some("configurationRequired")
        );
        assert_eq!(endpoint.get("url"), Some(&Value::Null));
    }

    #[test]
    fn default_provider_remote_openclaw_projection_collapses_blank_endpoint_strings_to_null() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Remote Blank Endpoints",
                "runtimeKind": "openclaw",
                "deploymentMode": "remote",
                "transportKind": "openclawGatewayWs",
                "host": "gateway.example.com",
                "port": 443,
                "baseUrl": "",
                "websocketUrl": "",
                "config": {
                    "port": "443",
                    "baseUrl": "",
                    "websocketUrl": ""
                }
            }))
            .expect("create remote instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id");

        let projected = provider
            .get_instance(id)
            .expect("get instance should succeed")
            .expect("projected instance should exist");

        assert_eq!(projected.get("baseUrl"), Some(&Value::Null));
        assert_eq!(projected.get("websocketUrl"), Some(&Value::Null));
        assert_eq!(
            projected
                .get("config")
                .and_then(|value| value.get("baseUrl")),
            Some(&Value::Null)
        );
        assert_eq!(
            projected
                .get("config")
                .and_then(|value| value.get("websocketUrl")),
            Some(&Value::Null)
        );
    }

    #[test]
    fn default_provider_remote_openclaw_detail_hides_console_launch_while_runtime_is_offline() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Remote Gateway Console",
                "runtimeKind": "openclaw",
                "deploymentMode": "remote",
                "transportKind": "openclawGatewayWs",
                "host": "gateway.example.com",
                "port": 443,
                "baseUrl": "https://gateway.example.com/claw/api",
                "websocketUrl": "wss://gateway.example.com/claw/ws",
                "config": {
                    "port": "443",
                    "baseUrl": "https://gateway.example.com/claw/api",
                    "websocketUrl": "wss://gateway.example.com/claw/ws",
                    "authToken": "remote-token"
                }
            }))
            .expect("create remote instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id");

        let detail = provider
            .get_instance_detail(id)
            .expect("detail request should succeed")
            .expect("remote detail should exist");
        let console_access = detail
            .get("consoleAccess")
            .and_then(Value::as_object)
            .expect("detail should include console access");

        assert_eq!(
            console_access.get("available").and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            console_access.get("url").and_then(Value::as_str),
            Some("https://gateway.example.com/claw/api/")
        );
        assert_eq!(
            console_access.get("gatewayUrl").and_then(Value::as_str),
            Some("wss://gateway.example.com/claw/api")
        );
        assert_eq!(
            console_access.get("authMode").and_then(Value::as_str),
            Some("token")
        );
        assert_eq!(
            console_access.get("authSource").and_then(Value::as_str),
            Some("workspaceConfig")
        );
        assert_eq!(
            console_access.get("installMethod").and_then(Value::as_str),
            Some("unknown")
        );
        assert!(
            console_access
                .get("reason")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .contains("offline")
        );
        assert_eq!(
            console_access.get("autoLoginUrl"),
            Some(&Value::Null)
        );
    }

    #[test]
    fn default_provider_remote_openclaw_detail_exposes_console_launch_when_runtime_is_online() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Remote Gateway Console",
                "runtimeKind": "openclaw",
                "deploymentMode": "remote",
                "status": "online",
                "transportKind": "openclawGatewayWs",
                "host": "gateway.example.com",
                "port": 443,
                "baseUrl": "https://gateway.example.com/claw/api",
                "websocketUrl": "wss://gateway.example.com/claw/ws",
                "config": {
                    "port": "443",
                    "baseUrl": "https://gateway.example.com/claw/api",
                    "websocketUrl": "wss://gateway.example.com/claw/ws",
                    "authToken": "remote-token"
                }
            }))
            .expect("create remote instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id");

        let detail = provider
            .get_instance_detail(id)
            .expect("detail request should succeed")
            .expect("remote detail should exist");
        let console_access = detail
            .get("consoleAccess")
            .and_then(Value::as_object)
            .expect("detail should include console access");

        assert_eq!(
            console_access.get("available").and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            console_access.get("reason").and_then(Value::as_str),
            Some(
                "Remote OpenClaw consoles require device pairing or manual authorization."
            )
        );
        assert_eq!(
            console_access.get("autoLoginUrl"),
            Some(&Value::Null)
        );
    }

    #[test]
    fn default_provider_built_in_openclaw_detail_omits_console_access_without_live_runtime_authority() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let detail = provider
            .get_instance_detail("managed-openclaw-primary")
            .expect("detail request should succeed")
            .expect("built-in detail should exist");
        assert_eq!(detail.get("consoleAccess"), Some(&Value::Null));
    }

    #[test]
    fn default_provider_built_in_openclaw_detail_exposes_bundled_console_access_when_control_plane_publishes_runtime_endpoints() {
        let root = tempfile::tempdir().expect("temp dir");
        let mut host_endpoints = HostEndpointRegistry::default();
        host_endpoints.register(HostEndpointRegistration {
            endpoint_id: "openclaw-gateway".to_string(),
            bind_host: "127.0.0.1".to_string(),
            requested_port: 21_280,
            active_port: Some(21_280),
            scheme: "http".to_string(),
            base_path: None,
            websocket_path: None,
            loopback_only: true,
            dynamic_port: false,
            last_conflict_at: None,
            last_conflict_reason: None,
        });
        let control_plane = OpenClawControlPlane::inactive("test-host")
            .with_host_endpoints(host_endpoints)
            .with_gateway_endpoint("openclaw-gateway", OpenClawLifecycle::Ready);
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(control_plane),
        )
        .expect("provider");

        let detail = provider
            .get_instance_detail("managed-openclaw-primary")
            .expect("detail request should succeed")
            .expect("built-in detail should exist");
        let console_access = detail
            .get("consoleAccess")
            .and_then(Value::as_object)
            .expect("detail should include console access");

        assert_eq!(
            console_access.get("available").and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            console_access.get("url").and_then(Value::as_str),
            Some("http://127.0.0.1:21280/")
        );
        assert_eq!(
            console_access.get("installMethod").and_then(Value::as_str),
            Some("bundled")
        );
        assert_eq!(
            console_access.get("authMode").and_then(Value::as_str),
            Some("unknown")
        );
    }

    #[test]
    fn default_provider_local_external_openclaw_detail_exposes_console_access_without_workbench() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Local External OpenClaw",
                "runtimeKind": "openclaw",
                "deploymentMode": "local-external",
                "status": "online",
                "transportKind": "openclawGatewayWs",
                "host": "127.0.0.1",
                "port": 28789,
                "baseUrl": "http://127.0.0.1:28789",
                "websocketUrl": "ws://127.0.0.1:28789",
                "config": {
                    "port": "28789",
                    "baseUrl": "http://127.0.0.1:28789",
                    "websocketUrl": "ws://127.0.0.1:28789",
                    "authToken": "local-external-token"
                }
            }))
            .expect("create local external instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id");

        let detail = provider
            .get_instance_detail(id)
            .expect("detail request should succeed")
            .expect("detail should exist");
        let console_access = detail
            .get("consoleAccess")
            .and_then(Value::as_object)
            .expect("detail should include console access");

        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("owner"))
                .and_then(Value::as_str),
            Some("externalProcess")
        );
        assert_eq!(detail.get("workbench"), Some(&Value::Null));
        assert_eq!(
            console_access.get("available").and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            console_access.get("installMethod").and_then(Value::as_str),
            Some("unknown")
        );
        assert_eq!(
            console_access.get("autoLoginUrl").and_then(Value::as_str),
            Some(
                "http://127.0.0.1:28789/?gatewayUrl=ws%3A%2F%2F127.0.0.1%3A28789#token=local-external-token"
            )
        );
    }

    #[test]
    fn default_provider_local_external_openclaw_detail_hides_console_launch_while_runtime_is_offline() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Local External OpenClaw",
                "runtimeKind": "openclaw",
                "deploymentMode": "local-external",
                "transportKind": "openclawGatewayWs",
                "host": "127.0.0.1",
                "port": 28789,
                "baseUrl": "http://127.0.0.1:28789",
                "websocketUrl": "ws://127.0.0.1:28789",
                "config": {
                    "port": "28789",
                    "baseUrl": "http://127.0.0.1:28789",
                    "websocketUrl": "ws://127.0.0.1:28789",
                    "authToken": "local-external-token"
                }
            }))
            .expect("create local external instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id");

        let detail = provider
            .get_instance_detail(id)
            .expect("detail request should succeed")
            .expect("detail should exist");
        let console_access = detail
            .get("consoleAccess")
            .and_then(Value::as_object)
            .expect("detail should include console access");

        assert_eq!(
            console_access.get("available").and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(console_access.get("autoLoginUrl"), Some(&Value::Null));
        assert!(
            console_access
                .get("reason")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .contains("offline")
        );
    }

    #[test]
    fn default_provider_defaults_custom_openclaw_instances_to_remote_without_a_managed_workbench() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Discovered OpenClaw",
                "runtimeKind": "openclaw",
                "transportKind": "openclawGatewayWs",
                "host": "router.example.com",
                "port": 28789,
                "baseUrl": "https://router.example.com/v1",
                "websocketUrl": "wss://router.example.com/ws"
            }))
            .expect("create instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id");

        let detail = provider
            .get_instance_detail(id)
            .expect("detail request should succeed")
            .expect("detail should exist");

        assert_eq!(
            created.get("deploymentMode").and_then(Value::as_str),
            Some("remote")
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("owner"))
                .and_then(Value::as_str),
            Some("remoteService")
        );
        assert_eq!(detail.get("workbench"), Some(&Value::Null));
    }

    #[test]
    fn default_provider_treats_custom_local_managed_openclaw_as_external_metadata_only() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Custom Local Managed",
                "runtimeKind": "openclaw",
                "deploymentMode": "local-managed",
                "transportKind": "openclawGatewayWs",
                "host": "127.0.0.1",
                "port": 28789,
                "baseUrl": "http://127.0.0.1:28789",
                "websocketUrl": "ws://127.0.0.1:28789"
            }))
            .expect("create local managed instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id");

        let detail = provider
            .get_instance_detail(id)
            .expect("detail request should succeed")
            .expect("detail should exist");

        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("owner"))
                .and_then(Value::as_str),
            Some("externalProcess")
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("startStopSupported"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("configWritable"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("lifecycleControllable"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("workbenchManaged"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            detail
                .get("lifecycle")
                .and_then(|value| value.get("endpointObserved"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(detail.get("workbench"), Some(&Value::Null));
    }

    #[test]
    fn default_provider_rejects_synthetic_lifecycle_mutations() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Remote Gateway",
                "runtimeKind": "openclaw",
                "deploymentMode": "remote",
                "transportKind": "openclawGatewayWs",
                "host": "gateway.example.com",
                "port": 443,
                "baseUrl": "https://gateway.example.com/claw/api"
            }))
            .expect("create remote instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id");

        let error = provider
            .start_instance(id)
            .expect_err("server provider should reject synthetic lifecycle control");
        assert!(
            error.contains("lifecycle control"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn default_provider_delete_instance_preserves_shared_conversations_when_other_participants_remain() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_default_studio_public_api_provider(
            root.path().to_path_buf(),
            std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
        )
        .expect("provider");

        let created = provider
            .create_instance(json!({
                "name": "Remote Gateway",
                "runtimeKind": "openclaw",
                "deploymentMode": "remote",
                "transportKind": "openclawGatewayWs",
                "host": "gateway.example.com",
                "port": 443,
                "baseUrl": "https://gateway.example.com/claw/api"
            }))
            .expect("create remote instance");
        let id = created
            .get("id")
            .and_then(Value::as_str)
            .expect("id");

        provider
            .put_conversation(
                "shared-thread",
                json!({
                    "title": "Shared Thread",
                    "primaryInstanceId": id,
                    "participantInstanceIds": [id, "managed-openclaw-primary"],
                    "messages": []
                }),
            )
            .expect("put shared conversation");
        provider
            .put_conversation(
                "orphan-thread",
                json!({
                    "title": "Orphan Thread",
                    "primaryInstanceId": id,
                    "participantInstanceIds": [id],
                    "messages": []
                }),
            )
            .expect("put orphan conversation");

        assert!(provider.delete_instance(id).expect("delete instance"));

        let built_in_conversations = provider
            .list_conversations("managed-openclaw-primary")
            .expect("list built-in conversations");
        let built_in_items = built_in_conversations
            .as_array()
            .expect("built-in conversation list should be an array");
        let shared = built_in_items
            .iter()
            .find(|value| value.get("id").and_then(Value::as_str) == Some("shared-thread"))
            .expect("shared conversation should remain");

        assert_eq!(
            shared.get("primaryInstanceId").and_then(Value::as_str),
            Some("managed-openclaw-primary")
        );
        assert_eq!(
            shared
                .get("participantInstanceIds")
                .and_then(Value::as_array)
                .cloned(),
            Some(vec![Value::String("managed-openclaw-primary".to_string())])
        );
        assert!(
            built_in_items
                .iter()
                .all(|value| value.get("id").and_then(Value::as_str) != Some("orphan-thread"))
        );
        assert_eq!(
            provider
                .list_conversations(id)
                .expect("list deleted instance conversations")
                .as_array()
                .map(|items| items.len()),
            Some(0)
        );
    }

    #[test]
    fn default_backend_can_be_wrapped_by_typed_adapter_without_losing_built_in_projection() {
        let root = tempfile::tempdir().expect("temp dir");
        let provider = build_typed_studio_public_api_provider(
            super::ServerStudioPublicApiProvider::new(
                root.path().to_path_buf(),
                std::sync::Arc::new(OpenClawControlPlane::inactive("test-host")),
            )
            .expect("backend"),
        );

        let instances = provider.list_instances().expect("list instances");
        let built_in = instances
            .as_array()
            .and_then(|items| {
                items.iter().find(|item| {
                    item.get("id").and_then(serde_json::Value::as_str)
                        == Some("managed-openclaw-primary")
                })
            })
            .expect("built-in instance");

        assert_eq!(
            built_in
                .get("deploymentMode")
                .and_then(serde_json::Value::as_str),
            Some("local-managed")
        );
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeInstanceRecord {
        id: String,
        name: String,
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeCreateInstanceInput {
        name: String,
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeUpdateInstanceInput {
        name: String,
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeInstanceDetailRecord {
        id: String,
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeInstanceConfigRecord {
        port: String,
    }

    #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct FakeConversationRecord {
        id: String,
        title: String,
    }

    #[derive(Debug)]
    struct FakeTypedStudioBackend {
        created_names: Arc<Mutex<Vec<String>>>,
    }

    impl TypedStudioPublicApiBackend for FakeTypedStudioBackend {
        type InstanceRecord = FakeInstanceRecord;
        type CreateInstanceInput = FakeCreateInstanceInput;
        type UpdateInstanceInput = FakeUpdateInstanceInput;
        type InstanceDetailRecord = FakeInstanceDetailRecord;
        type InstanceConfigRecord = FakeInstanceConfigRecord;
        type ConversationRecord = FakeConversationRecord;

        fn list_instances(&self) -> Result<Vec<Self::InstanceRecord>, String> {
            Ok(Vec::new())
        }

        fn create_instance(
            &self,
            input: Self::CreateInstanceInput,
        ) -> Result<Self::InstanceRecord, String> {
            self.created_names
                .lock()
                .expect("created names lock")
                .push(input.name.clone());
            Ok(FakeInstanceRecord {
                id: "fake-instance".to_string(),
                name: input.name,
            })
        }

        fn get_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn update_instance(
            &self,
            _id: &str,
            _input: Self::UpdateInstanceInput,
        ) -> Result<Self::InstanceRecord, String> {
            Err("unused".to_string())
        }

        fn delete_instance(&self, _id: &str) -> Result<bool, String> {
            Ok(false)
        }

        fn start_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn stop_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn restart_instance(&self, _id: &str) -> Result<Option<Self::InstanceRecord>, String> {
            Ok(None)
        }

        fn get_instance_detail(
            &self,
            _id: &str,
        ) -> Result<Option<Self::InstanceDetailRecord>, String> {
            Ok(None)
        }

        fn get_instance_config(
            &self,
            _id: &str,
        ) -> Result<Option<Self::InstanceConfigRecord>, String> {
            Ok(None)
        }

        fn update_instance_config(
            &self,
            _id: &str,
            _config: Self::InstanceConfigRecord,
        ) -> Result<Option<Self::InstanceConfigRecord>, String> {
            Ok(None)
        }

        fn get_instance_logs(&self, _id: &str) -> Result<String, String> {
            Ok(String::new())
        }

        fn invoke_openclaw_gateway(
            &self,
            _instance_id: &str,
            request: StudioOpenClawGatewayInvokeRequest,
            options: StudioOpenClawGatewayInvokeOptions,
        ) -> Result<Value, String> {
            Ok(json!({
                "tool": request.tool,
                "action": request.action,
                "messageChannel": options.message_channel
            }))
        }

        fn create_instance_task(
            &self,
            _instance_id: &str,
            _payload: Value,
        ) -> Result<(), String> {
            Ok(())
        }

        fn update_instance_task(
            &self,
            _instance_id: &str,
            _task_id: &str,
            _payload: Value,
        ) -> Result<(), String> {
            Ok(())
        }

        fn update_instance_file_content(
            &self,
            _instance_id: &str,
            _file_id: &str,
            _content: String,
        ) -> Result<bool, String> {
            Ok(true)
        }

        fn update_instance_llm_provider_config(
            &self,
            _instance_id: &str,
            _provider_id: &str,
            _update: Value,
        ) -> Result<bool, String> {
            Ok(true)
        }

        fn clone_instance_task(
            &self,
            _instance_id: &str,
            _task_id: &str,
            _name: Option<String>,
        ) -> Result<(), String> {
            Ok(())
        }

        fn run_instance_task_now(
            &self,
            _instance_id: &str,
            _task_id: &str,
        ) -> Result<Value, String> {
            Ok(json!({
                "id": "exec-1",
                "taskId": "job-1"
            }))
        }

        fn list_instance_task_executions(
            &self,
            _instance_id: &str,
            _task_id: &str,
        ) -> Result<Vec<Value>, String> {
            Ok(vec![json!({
                "id": "exec-1",
                "taskId": "job-1"
            })])
        }

        fn update_instance_task_status(
            &self,
            _instance_id: &str,
            _task_id: &str,
            _status: String,
        ) -> Result<(), String> {
            Ok(())
        }

        fn delete_instance_task(
            &self,
            _instance_id: &str,
            _task_id: &str,
        ) -> Result<bool, String> {
            Ok(true)
        }

        fn list_conversations(&self, _instance_id: &str) -> Result<Vec<Self::ConversationRecord>, String> {
            Ok(Vec::new())
        }

        fn put_conversation(
            &self,
            _id: &str,
            record: Self::ConversationRecord,
        ) -> Result<Self::ConversationRecord, String> {
            Ok(record)
        }

        fn delete_conversation(&self, _id: &str) -> Result<bool, String> {
            Ok(false)
        }
    }

    #[test]
    fn typed_provider_serializes_typed_backend_results_and_deserializes_inputs() {
        let created_names = Arc::new(Mutex::new(Vec::new()));
        let provider = build_typed_studio_public_api_provider(FakeTypedStudioBackend {
            created_names: created_names.clone(),
        });

        let created = provider
            .create_instance(json!({
                "name": "Desktop Typed Backend"
            }))
            .expect("create instance through typed provider");

        assert_eq!(
            created.get("id").and_then(serde_json::Value::as_str),
            Some("fake-instance")
        );
        assert_eq!(
            created.get("name").and_then(serde_json::Value::as_str),
            Some("Desktop Typed Backend")
        );
        assert_eq!(
            created_names.lock().expect("created names lock").as_slice(),
            ["Desktop Typed Backend"]
        );
    }
}
