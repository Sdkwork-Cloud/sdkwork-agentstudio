use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
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

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
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

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioStartKernelChatRunInput {
    pub instance_id: String,
    pub session_id: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelChatAgentProfile {
    pub kernel_id: String,
    pub instance_id: String,
    pub agent_id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedKernelChatAgentRecord {
    pub id: String,
    pub instance_id: String,
    pub kernel_id: String,
    pub agent_id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator: Option<String>,
    pub is_default: bool,
    pub sort_order: u32,
    pub synced_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_metadata: Option<Value>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelChatSessionRef {
    pub kernel_id: String,
    pub instance_id: String,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub routing_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lineage_parent_session_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelChatAuthority {
    pub kind: String,
    pub source: String,
    pub durable: bool,
    pub writable: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelChatActorBinding {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelChatModelBinding {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fast_mode: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verbose_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_level: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum KernelChatAttachmentKind {
    File,
    Image,
    Audio,
    Video,
    Screenshot,
    ScreenRecording,
    Link,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KernelChatNoticeLevel {
    Info,
    Warning,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelChatAttachment {
    pub id: String,
    pub kind: KernelChatAttachmentKind,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub object_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum KernelChatMessagePart {
    Text {
        text: String,
    },
    Reasoning {
        text: String,
    },
    ToolCall {
        tool_name: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        tool_call_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        arguments_text: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
    ToolResult {
        tool_name: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        tool_call_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        text: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
        #[serde(skip_serializing_if = "Option::is_none")]
        preview: Option<String>,
    },
    Attachment {
        attachment: KernelChatAttachment,
    },
    Notice {
        code: String,
        text: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        level: Option<KernelChatNoticeLevel>,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelChatSession {
    #[serde(rename = "ref")]
    pub session_ref: KernelChatSessionRef,
    pub authority: KernelChatAuthority,
    pub lifecycle: String,
    pub title: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub message_count: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message_preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor_binding: Option<KernelChatActorBinding>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_binding: Option<KernelChatModelBinding>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub capabilities: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_metadata: Option<Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelChatRun {
    pub id: String,
    pub session_ref: KernelChatSessionRef,
    pub status: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub abortable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_metadata: Option<Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KernelChatMessage {
    pub id: String,
    pub session_ref: KernelChatSessionRef,
    pub role: String,
    pub status: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub text: String,
    pub parts: Vec<KernelChatMessagePart>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_metadata: Option<Value>,
}

#[cfg(test)]
mod tests {
    use super::{
        KernelChatAttachment, KernelChatAttachmentKind, KernelChatMessagePart,
        KernelChatNoticeLevel,
    };
    use serde_json::json;

    #[test]
    fn kernel_chat_message_part_serializes_attachment_parts_with_shared_contract_field_names() {
        let part = KernelChatMessagePart::Attachment {
            attachment: KernelChatAttachment {
                id: "attachment-1".to_string(),
                kind: KernelChatAttachmentKind::Image,
                name: "diagram.png".to_string(),
                url: Some("https://example.com/diagram.png".to_string()),
                preview_url: Some("file:///diagram.png".to_string()),
                object_key: None,
                mime_type: Some("image/png".to_string()),
                size_bytes: Some(2048),
                file_id: None,
                original_url: None,
                width: Some(640),
                height: Some(480),
                duration_ms: None,
            },
        };

        assert_eq!(
            serde_json::to_value(part).expect("serialize attachment part"),
            json!({
                "kind": "attachment",
                "attachment": {
                    "id": "attachment-1",
                    "kind": "image",
                    "name": "diagram.png",
                    "url": "https://example.com/diagram.png",
                    "previewUrl": "file:///diagram.png",
                    "mimeType": "image/png",
                    "sizeBytes": 2048,
                    "width": 640,
                    "height": 480
                }
            }),
        );
    }

    #[test]
    fn kernel_chat_message_part_serializes_notice_levels_when_present() {
        let part = KernelChatMessagePart::Notice {
            code: "context-truncated".to_string(),
            text: "Context window was truncated before replay.".to_string(),
            level: Some(KernelChatNoticeLevel::Warning),
        };

        assert_eq!(
            serde_json::to_value(part).expect("serialize notice part"),
            json!({
                "kind": "notice",
                "code": "context-truncated",
                "text": "Context window was truncated before replay.",
                "level": "warning"
            }),
        );
    }
}
