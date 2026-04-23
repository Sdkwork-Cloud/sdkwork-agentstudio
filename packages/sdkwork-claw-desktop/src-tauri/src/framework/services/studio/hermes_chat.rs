use super::{
    hermes_state_root, is_managed_hermes_instance,
    kernel_chat::{
        KernelChatActorBinding, KernelChatAgentProfile, KernelChatAuthority, KernelChatMessage,
        KernelChatMessagePart, KernelChatModelBinding, KernelChatRun, KernelChatSession,
        KernelChatSessionRef,
        StudioCreateKernelChatSessionInput, StudioPatchKernelChatSessionInput,
        StudioStartKernelChatRunInput,
    },
    normalize_optional_string, unix_timestamp_ms, StudioInstanceRecord,
};
use crate::framework::{paths::AppPaths, FrameworkError, Result};
use reqwest::blocking::Client;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
};
use uuid::Uuid;

const DEFAULT_KERNEL_CHAT_SESSION_TITLE: &str = "New Chat";

#[derive(Clone, Debug)]
struct HermesSessionRow {
    session_id: String,
    title: Option<String>,
    agent_id: Option<String>,
    model: Option<String>,
    thinking_level: Option<String>,
    fast_mode: Option<bool>,
    verbose_level: Option<String>,
    reasoning_level: Option<String>,
    active_run_id: Option<String>,
    last_run_id: Option<String>,
    last_run_status: Option<String>,
    last_run_updated_at: Option<u64>,
    created_at: u64,
    updated_at: u64,
    message_count: u64,
    last_message_content: Option<String>,
}

#[derive(Clone, Debug)]
struct HermesRunRow {
    run_id: String,
    session_id: String,
    agent_id: Option<String>,
    model: Option<String>,
    status: String,
    created_at: u64,
    updated_at: u64,
}

#[derive(Clone, Debug)]
struct HermesAgentRow {
    instance_id: String,
    agent_id: String,
    label: String,
    description: Option<String>,
    source: String,
    system_prompt: Option<String>,
    avatar: Option<String>,
    creator: Option<String>,
}

fn hermes_state_db_path(paths: &AppPaths) -> PathBuf {
    hermes_state_root(paths).join("state.db")
}

fn ensure_table_column(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
    column_definition: &str,
) -> Result<()> {
    let mut statement = connection.prepare(format!("PRAGMA table_info({table_name})").as_str())?;
    let existing_columns = statement
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    if existing_columns
        .iter()
        .any(|existing_column| existing_column == column_name)
    {
        return Ok(());
    }

    connection.execute(
        format!("ALTER TABLE {table_name} ADD COLUMN {column_definition}").as_str(),
        [],
    )?;
    Ok(())
}

fn initialize_hermes_state_db(connection: &Connection) -> Result<()> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          title TEXT
        );
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          run_id TEXT,
          model TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS runs (
          run_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          agent_id TEXT,
          model TEXT,
          status TEXT NOT NULL,
          created_at_ms INTEGER NOT NULL,
          updated_at_ms INTEGER NOT NULL,
          FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS agents (
          instance_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          label TEXT NOT NULL,
          description TEXT,
          source TEXT NOT NULL,
          system_prompt TEXT,
          avatar TEXT,
          creator TEXT,
          created_at_ms INTEGER NOT NULL,
          updated_at_ms INTEGER NOT NULL,
          PRIMARY KEY(instance_id, agent_id)
        );
        CREATE INDEX IF NOT EXISTS idx_hermes_messages_session_id ON messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_hermes_messages_session_timestamp
          ON messages(session_id, timestamp, id);
        CREATE INDEX IF NOT EXISTS idx_hermes_runs_session_id ON runs(session_id, updated_at_ms, run_id);
        CREATE INDEX IF NOT EXISTS idx_hermes_agents_instance_updated_at
          ON agents(instance_id, updated_at_ms, agent_id);
        ",
    )?;
    ensure_table_column(connection, "sessions", "instance_id", "instance_id TEXT")?;
    ensure_table_column(connection, "sessions", "agent_id", "agent_id TEXT")?;
    ensure_table_column(connection, "sessions", "model", "model TEXT")?;
    ensure_table_column(connection, "sessions", "thinking_level", "thinking_level TEXT")?;
    ensure_table_column(connection, "sessions", "fast_mode", "fast_mode INTEGER")?;
    ensure_table_column(connection, "sessions", "verbose_level", "verbose_level TEXT")?;
    ensure_table_column(connection, "sessions", "reasoning_level", "reasoning_level TEXT")?;
    ensure_table_column(connection, "sessions", "active_run_id", "active_run_id TEXT")?;
    ensure_table_column(connection, "sessions", "last_run_id", "last_run_id TEXT")?;
    ensure_table_column(connection, "messages", "run_id", "run_id TEXT")?;
    ensure_table_column(connection, "messages", "model", "model TEXT")?;
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_hermes_sessions_instance_id
         ON sessions(instance_id, started_at, session_id)",
        [],
    )?;
    Ok(())
}

fn persist_hermes_agent_profile(
    connection: &Connection,
    instance_id: &str,
    agent_id: Option<&str>,
) -> Result<()> {
    let Some(agent_id) = normalize_optional_text(agent_id) else {
        return Ok(());
    };
    let now = unix_timestamp_ms()?;

    connection.execute(
        "INSERT INTO agents (
            instance_id,
            agent_id,
            label,
            description,
            source,
            system_prompt,
            avatar,
            creator,
            created_at_ms,
            updated_at_ms
         ) VALUES (?1, ?2, ?3, NULL, ?4, NULL, NULL, NULL, ?5, ?5)
         ON CONFLICT(instance_id, agent_id) DO UPDATE SET
            label = excluded.label,
            source = excluded.source,
            updated_at_ms = excluded.updated_at_ms",
        params![
            instance_id,
            agent_id.as_str(),
            agent_id.as_str(),
            "sessionBinding",
            now as i64
        ],
    )?;
    Ok(())
}

fn persist_hermes_run_record(
    connection: &Connection,
    session_id: &str,
    run_id: &str,
    agent_id: Option<&str>,
    model: Option<&str>,
    status: &str,
    created_at_ms: u64,
    updated_at_ms: u64,
) -> Result<()> {
    connection.execute(
        "INSERT OR REPLACE INTO runs (
            run_id,
            session_id,
            agent_id,
            model,
            status,
            created_at_ms,
            updated_at_ms
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            run_id,
            session_id,
            agent_id,
            model,
            status,
            created_at_ms as i64,
            updated_at_ms as i64
        ],
    )?;
    Ok(())
}

fn ensure_hermes_state_db(paths: &AppPaths, create_if_missing: bool) -> Result<Option<Connection>> {
    let db_path = hermes_state_db_path(paths);
    if !create_if_missing && !db_path.exists() {
        return Ok(None);
    }

    let Some(parent) = db_path.parent() else {
        return Err(FrameworkError::InvalidOperation(
            "Hermes state database path is missing a parent directory.".to_string(),
        ));
    };
    fs::create_dir_all(parent)?;

    let connection = Connection::open(&db_path)?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    initialize_hermes_state_db(&connection)?;

    Ok(Some(connection))
}

fn build_kernel_chat_session_ref(
    instance_id: &str,
    session_id: &str,
    agent_id: Option<String>,
) -> KernelChatSessionRef {
    KernelChatSessionRef {
        kernel_id: "hermes".to_string(),
        instance_id: instance_id.to_string(),
        session_id: session_id.to_string(),
        native_session_id: Some(session_id.to_string()),
        routing_key: None,
        agent_id,
        lineage_parent_session_id: None,
    }
}

fn build_kernel_chat_authority() -> KernelChatAuthority {
    KernelChatAuthority {
        kind: "sqlite".to_string(),
        source: "kernel".to_string(),
        durable: true,
        writable: true,
    }
}

fn normalize_session_title(value: Option<String>) -> String {
    normalize_optional_string(value)
        .unwrap_or_else(|| DEFAULT_KERNEL_CHAT_SESSION_TITLE.to_string())
}

fn resolve_session_patch_string(
    patch: Option<Option<String>>,
    current: Option<String>,
) -> Option<String> {
    match patch {
        Some(next) => normalize_optional_string(next),
        None => normalize_optional_string(current),
    }
}

fn resolve_session_patch_bool(
    patch: Option<Option<bool>>,
    current: Option<bool>,
) -> Option<bool> {
    match patch {
        Some(next) => next,
        None => current,
    }
}

fn truncate_preview(value: &str) -> Option<String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return None;
    }

    Some(normalized.chars().take(120).collect::<String>())
}

#[cfg(test)]
fn collect_text_fragments(value: &Value, fragments: &mut Vec<String>) {
    match value {
        Value::String(text) => {
            if !text.trim().is_empty() {
                fragments.push(text.trim().to_string());
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_text_fragments(item, fragments);
            }
        }
        Value::Object(object) => {
            if let Some(text) = object.get("text").and_then(Value::as_str) {
                if !text.trim().is_empty() {
                    fragments.push(text.trim().to_string());
                }
            }
            if let Some(content) = object.get("content") {
                collect_text_fragments(content, fragments);
            }
            if let Some(message) = object.get("message") {
                collect_text_fragments(message, fragments);
            }
            if let Some(output_text) = object.get("output_text").and_then(Value::as_str) {
                if !output_text.trim().is_empty() {
                    fragments.push(output_text.trim().to_string());
                }
            }
            for (key, value) in object {
                if matches!(
                    key.as_str(),
                    "text"
                        | "content"
                        | "message"
                        | "output_text"
                        | "summary"
                        | "id"
                        | "role"
                        | "type"
                        | "call_id"
                        | "callId"
                        | "tool_call_id"
                        | "toolCallId"
                        | "name"
                        | "arguments"
                        | "tool_calls"
                        | "toolCalls"
                        | "function"
                ) {
                    continue;
                }
                collect_text_fragments(value, fragments);
            }
        }
        _ => {}
    }
}

fn extract_hermes_message_text(raw_content: &str) -> String {
    let trimmed = raw_content.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        return build_hermes_message_parts_from_value(&value)
            .iter()
            .filter_map(|part| match part {
                KernelChatMessagePart::Text { text } => Some(text.as_str()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("\n\n");
    }

    trimmed.to_string()
}

#[cfg(test)]
fn extract_hermes_message_text_from_value(value: &Value) -> String {
    let structured_text = build_hermes_message_parts_from_value(value)
        .iter()
        .filter_map(|part| match part {
            KernelChatMessagePart::Text { text } => Some(text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    if !structured_text.is_empty() {
        return structured_text;
    }

    let mut fragments = Vec::new();
    collect_text_fragments(value, &mut fragments);
    if !fragments.is_empty() {
        return fragments.join("\n\n");
    }

    value
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
        .unwrap_or_default()
}

fn parse_hermes_message_native_metadata(raw_content: &str) -> Option<Value> {
    serde_json::from_str::<Value>(raw_content.trim())
        .ok()
        .map(|value| {
            json!({
                "rawContent": value,
            })
        })
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

fn normalize_kernel_chat_agent_profile_source(value: Option<&str>) -> String {
    match normalize_optional_text(value)
        .unwrap_or_else(|| "sessionBinding".to_string())
        .as_str()
    {
        "kernelCatalog" => "kernelCatalog".to_string(),
        "workbenchProjection" => "workbenchProjection".to_string(),
        "sessionBinding" | "persistedBinding" => "sessionBinding".to_string(),
        _ => "sessionBinding".to_string(),
    }
}

fn extract_text_from_content(value: &Value) -> Option<String> {
    let mut fragments = Vec::new();

    fn collect(value: &Value, fragments: &mut Vec<String>) {
        match value {
            Value::String(text) => {
                if !text.trim().is_empty() {
                    fragments.push(text.trim().to_string());
                }
            }
            Value::Array(items) => {
                for item in items {
                    collect(item, fragments);
                }
            }
            Value::Object(object) => {
                if let Some(item_type) = object.get("type").and_then(Value::as_str) {
                    match item_type {
                        "output_text" | "text" | "summary_text" | "reasoning_text"
                        | "input_text" => {
                            if let Some(text) = object.get("text").and_then(Value::as_str) {
                                if !text.trim().is_empty() {
                                    fragments.push(text.trim().to_string());
                                }
                            }
                            return;
                        }
                        "function_call" | "function_call_output" => return,
                        _ => {}
                    }
                }

                if let Some(text) = object.get("text").and_then(Value::as_str) {
                    if !text.trim().is_empty() {
                        fragments.push(text.trim().to_string());
                    }
                }
                if let Some(output_text) = object.get("output_text").and_then(Value::as_str) {
                    if !output_text.trim().is_empty() {
                        fragments.push(output_text.trim().to_string());
                    }
                }
                if let Some(summary) = object.get("summary") {
                    collect(summary, fragments);
                }
                if let Some(content) = object.get("content") {
                    collect(content, fragments);
                }
                if let Some(message) = object.get("message") {
                    collect(message, fragments);
                }
            }
            _ => {}
        }
    }

    collect(value, &mut fragments);
    if fragments.is_empty() {
        return None;
    }

    Some(fragments.join("\n\n"))
}

fn stringify_payload_value(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(text) => normalize_optional_text(Some(text.as_str())),
        _ => {
            let extracted_text = extract_text_from_content(value);
            if extracted_text.is_some() {
                extracted_text
            } else {
                Some(value.to_string())
            }
        }
    }
}

fn resolve_tool_call_id(value: &Value) -> Option<String> {
    normalize_optional_text(
        value
            .get("tool_call_id")
            .and_then(Value::as_str)
            .or(value.get("toolCallId").and_then(Value::as_str))
            .or(value.get("call_id").and_then(Value::as_str))
            .or(value.get("callId").and_then(Value::as_str))
            .or(value.get("id").and_then(Value::as_str)),
    )
}

fn resolve_tool_name(value: &Value) -> Option<String> {
    normalize_optional_text(
        value
            .get("tool_name")
            .and_then(Value::as_str)
            .or(value.get("toolName").and_then(Value::as_str))
            .or(value.get("name").and_then(Value::as_str))
            .or(value
                .get("function")
                .and_then(|function| function.get("name"))
                .and_then(Value::as_str)),
    )
}

fn resolve_tool_arguments_text(value: &Value) -> Option<String> {
    if let Some(arguments) = value
        .get("arguments_text")
        .and_then(Value::as_str)
        .or(value.get("argumentsText").and_then(Value::as_str))
        .or(value
            .get("function")
            .and_then(|function| function.get("arguments"))
            .and_then(Value::as_str))
        .or(value.get("arguments").and_then(Value::as_str))
    {
        return normalize_optional_text(Some(arguments));
    }

    value
        .get("arguments")
        .and_then(stringify_payload_value)
        .or_else(|| {
            value
                .get("function")
                .and_then(|function| function.get("arguments"))
                .and_then(stringify_payload_value)
        })
}

fn extract_reasoning_part(value: &Value) -> Option<KernelChatMessagePart> {
    let text = value
        .get("summary")
        .and_then(extract_text_from_content)
        .or_else(|| value.get("content").and_then(extract_text_from_content))
        .or_else(|| {
            value
                .get("text")
                .and_then(Value::as_str)
                .and_then(|text| normalize_optional_text(Some(text)))
        })
        .or_else(|| value.get("reasoning").and_then(extract_text_from_content))?;

    Some(KernelChatMessagePart::Reasoning { text })
}

fn extract_text_part(value: &Value) -> Option<KernelChatMessagePart> {
    extract_text_from_content(value).map(|text| KernelChatMessagePart::Text { text })
}

fn extract_tool_call_part(value: &Value) -> Option<KernelChatMessagePart> {
    let tool_name = resolve_tool_name(value)?;
    let arguments_text = resolve_tool_arguments_text(value);
    Some(KernelChatMessagePart::ToolCall {
        tool_name,
        tool_call_id: resolve_tool_call_id(value),
        detail: arguments_text.clone(),
        arguments_text,
    })
}

fn resolve_tool_result_error(value: &Value) -> Option<bool> {
    if let Some(error) = value.get("is_error").and_then(Value::as_bool) {
        return Some(error);
    }
    if let Some(error) = value.get("isError").and_then(Value::as_bool) {
        return Some(error);
    }
    if value.get("error").is_some() {
        return Some(true);
    }
    if let Some(status) = value.get("status").and_then(Value::as_str) {
        return Some(matches!(status.trim(), "error" | "failed"));
    }
    Some(false)
}

fn extract_tool_result_part(
    value: &Value,
    tool_names_by_call_id: &HashMap<String, String>,
) -> Option<KernelChatMessagePart> {
    let tool_call_id = resolve_tool_call_id(value);
    let tool_name = resolve_tool_name(value).or_else(|| {
        tool_call_id
            .as_ref()
            .and_then(|call_id| tool_names_by_call_id.get(call_id).cloned())
    })?;
    let text = value
        .get("output")
        .and_then(stringify_payload_value)
        .or_else(|| value.get("content").and_then(stringify_payload_value))
        .or_else(|| value.get("text").and_then(stringify_payload_value))
        .or_else(|| value.get("error").and_then(stringify_payload_value));
    let preview = text.clone();

    Some(KernelChatMessagePart::ToolResult {
        tool_name,
        tool_call_id,
        text,
        is_error: resolve_tool_result_error(value),
        preview,
    })
}

fn build_hermes_message_parts_from_value(value: &Value) -> Vec<KernelChatMessagePart> {
    let mut parts = Vec::new();
    let mut tool_names_by_call_id = HashMap::new();

    if let Some(output_items) = value.get("output").and_then(Value::as_array) {
        for item in output_items {
            match item.get("type").and_then(Value::as_str).map(str::trim) {
                Some("reasoning") => {
                    if let Some(part) = extract_reasoning_part(item) {
                        parts.push(part);
                    }
                }
                Some("function_call") => {
                    if let Some(part) = extract_tool_call_part(item) {
                        if let KernelChatMessagePart::ToolCall {
                            tool_name,
                            tool_call_id: Some(tool_call_id),
                            ..
                        } = &part
                        {
                            tool_names_by_call_id.insert(tool_call_id.clone(), tool_name.clone());
                        }
                        parts.push(part);
                    }
                }
                Some("function_call_output") => {
                    if let Some(part) = extract_tool_result_part(item, &tool_names_by_call_id) {
                        parts.push(part);
                    }
                }
                Some("message") => {
                    if let Some(part) = extract_text_part(item) {
                        parts.push(part);
                    }
                }
                _ => {}
            }
        }

        if !parts.is_empty() {
            return parts;
        }
    }

    if let Some(message) = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
    {
        if let Some(part) = extract_text_part(message) {
            parts.push(part);
        }
        if let Some(reasoning) = message
            .get("reasoning")
            .and_then(extract_text_from_content)
            .or_else(|| {
                message
                    .get("reasoning_content")
                    .and_then(extract_text_from_content)
            })
            .or_else(|| {
                message
                    .get("reasoningContent")
                    .and_then(extract_text_from_content)
            })
        {
            parts.push(KernelChatMessagePart::Reasoning { text: reasoning });
        }
        if let Some(tool_calls) = message.get("tool_calls").and_then(Value::as_array) {
            for tool_call in tool_calls {
                if let Some(part) = extract_tool_call_part(tool_call) {
                    parts.push(part);
                }
            }
        }
        if !parts.is_empty() {
            return parts;
        }
    }

    if value.get("role").is_some() || value.get("content").is_some() {
        if let Some(part) = extract_text_part(value) {
            parts.push(part);
        }
        if let Some(reasoning) = value
            .get("reasoning")
            .and_then(extract_text_from_content)
            .or_else(|| {
                value
                    .get("reasoning_content")
                    .and_then(extract_text_from_content)
            })
            .or_else(|| {
                value
                    .get("reasoningContent")
                    .and_then(extract_text_from_content)
            })
        {
            parts.push(KernelChatMessagePart::Reasoning { text: reasoning });
        }
        if let Some(tool_calls) = value.get("tool_calls").and_then(Value::as_array) {
            for tool_call in tool_calls {
                if let Some(part) = extract_tool_call_part(tool_call) {
                    parts.push(part);
                }
            }
        }
    }

    parts
}

fn persist_hermes_run_messages(
    connection: &Connection,
    session_id: &str,
    run_id: &str,
    user_content: &str,
    response_payload: &Value,
) -> Result<()> {
    let persisted_model = connection
        .query_row(
            "SELECT model FROM sessions WHERE session_id = ?1",
            params![session_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()?
        .flatten()
        .and_then(|value| normalize_optional_string(Some(value)));
    connection.execute(
        "UPDATE sessions
         SET active_run_id = NULL,
             last_run_id = ?2
         WHERE session_id = ?1",
        params![session_id, run_id],
    )?;
    connection.execute(
        "INSERT INTO messages (session_id, role, content, run_id, model) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![session_id, "user", user_content, run_id, persisted_model.clone()],
    )?;
    connection.execute(
        "INSERT INTO messages (session_id, role, content, run_id, model) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            session_id,
            "assistant",
            serde_json::to_string(response_payload).map_err(|error| {
                FrameworkError::Internal(format!(
                    "failed to serialize Hermes response payload for transcript persistence: {error}"
                ))
            })?,
            run_id,
            persisted_model,
        ],
    )?;

    Ok(())
}

fn build_hermes_message_parts(content: &str) -> Vec<KernelChatMessagePart> {
    if let Ok(value) = serde_json::from_str::<Value>(content.trim()) {
        let parts = build_hermes_message_parts_from_value(&value);
        if !parts.is_empty() {
            return parts;
        }
    }

    let text = extract_hermes_message_text(content);
    if !text.is_empty() {
        return vec![KernelChatMessagePart::Text { text }];
    }

    vec![KernelChatMessagePart::Notice {
        code: "empty-content".to_string(),
        text: content.to_string(),
        level: None,
    }]
}

#[cfg(test)]
fn query_hermes_session_row(
    connection: &Connection,
    session_id: &str,
) -> Result<Option<HermesSessionRow>> {
    connection
        .query_row(
            "
            SELECT
              s.session_id,
              s.title,
              s.agent_id,
              s.model,
              s.thinking_level,
              s.fast_mode,
              s.verbose_level,
              s.reasoning_level,
              s.active_run_id,
              s.last_run_id,
              (
                SELECT r.status
                FROM runs r
                WHERE r.run_id = s.last_run_id
                LIMIT 1
              ),
              (
                SELECT r.updated_at_ms
                FROM runs r
                WHERE r.run_id = s.last_run_id
                LIMIT 1
              ),
              COALESCE(CAST(strftime('%s', s.started_at) AS INTEGER), 0) * 1000,
              COALESCE(
                (
                  SELECT CAST(strftime('%s', m.timestamp) AS INTEGER) * 1000
                  FROM messages m
                  WHERE m.session_id = s.session_id
                  ORDER BY m.timestamp DESC, m.id DESC
                  LIMIT 1
                ),
                COALESCE(CAST(strftime('%s', s.started_at) AS INTEGER), 0) * 1000
              ),
              (
                SELECT COUNT(*)
                FROM messages m
                WHERE m.session_id = s.session_id
              ),
              (
                SELECT m.content
                FROM messages m
                WHERE m.session_id = s.session_id
                ORDER BY m.timestamp DESC, m.id DESC
                LIMIT 1
              )
            FROM sessions s
            WHERE s.session_id = ?1
            ",
            params![session_id],
            |row| {
                Ok(HermesSessionRow {
                    session_id: row.get(0)?,
                    title: row.get::<_, Option<String>>(1)?,
                    agent_id: row.get::<_, Option<String>>(2)?,
                    model: row.get::<_, Option<String>>(3)?,
                    thinking_level: row.get::<_, Option<String>>(4)?,
                    fast_mode: row.get::<_, Option<bool>>(5)?,
                    verbose_level: row.get::<_, Option<String>>(6)?,
                    reasoning_level: row.get::<_, Option<String>>(7)?,
                    active_run_id: row.get::<_, Option<String>>(8)?,
                    last_run_id: row.get::<_, Option<String>>(9)?,
                    last_run_status: row.get::<_, Option<String>>(10)?,
                    last_run_updated_at: row
                        .get::<_, Option<i64>>(11)?
                        .map(|value| value.max(0) as u64),
                    created_at: row.get::<_, i64>(12)?.max(0) as u64,
                    updated_at: row.get::<_, i64>(13)?.max(0) as u64,
                    message_count: row.get::<_, i64>(14)?.max(0) as u64,
                    last_message_content: row.get(15)?,
                })
            },
        )
        .optional()
        .map_err(FrameworkError::from)
}

fn build_kernel_chat_session(instance_id: &str, row: HermesSessionRow) -> KernelChatSession {
    let last_message_preview = row
        .last_message_content
        .as_deref()
        .map(extract_hermes_message_text)
        .and_then(|value| truncate_preview(&value));
    let agent_id = normalize_optional_string(row.agent_id);
    let model = normalize_optional_string(row.model);
    let thinking_level = normalize_optional_string(row.thinking_level);
    let fast_mode = row.fast_mode;
    let verbose_level = normalize_optional_string(row.verbose_level);
    let reasoning_level = normalize_optional_string(row.reasoning_level);
    let active_run_id = normalize_optional_string(row.active_run_id);
    let last_run_id = normalize_optional_string(row.last_run_id);
    let last_run_status = normalize_optional_string(row.last_run_status);
    let last_run_updated_at = row.last_run_updated_at;
    let title = normalize_session_title(row.title);
    let lifecycle = if row.message_count == 0 {
        "draft"
    } else {
        "ready"
    };
    let mut native_metadata = serde_json::Map::new();
    native_metadata.insert("authorityFile".to_string(), Value::String("state.db".to_string()));
    native_metadata.insert("runtimeKind".to_string(), Value::String("hermes".to_string()));
    if let Some(last_run_id) = last_run_id.clone() {
        native_metadata.insert("lastRunId".to_string(), Value::String(last_run_id));
    }
    if let Some(last_run_status) = last_run_status {
        native_metadata.insert("lastRunStatus".to_string(), Value::String(last_run_status));
    }
    if let Some(last_run_updated_at) = last_run_updated_at {
        native_metadata.insert(
            "lastRunUpdatedAt".to_string(),
            Value::Number(serde_json::Number::from(last_run_updated_at)),
        );
    }

    KernelChatSession {
        session_ref: build_kernel_chat_session_ref(instance_id, &row.session_id, agent_id.clone()),
        authority: build_kernel_chat_authority(),
        lifecycle: lifecycle.to_string(),
        title,
        created_at: row.created_at,
        updated_at: row.updated_at.max(row.created_at),
        message_count: row.message_count,
        last_message_preview,
        session_kind: Some("authoritative".to_string()),
        actor_binding: agent_id.as_ref().map(|agent_id| KernelChatActorBinding {
            agent_id: Some(agent_id.clone()),
            profile_id: None,
            label: Some(agent_id.clone()),
        }),
        model_binding: if model.is_some()
            || thinking_level.is_some()
            || fast_mode.is_some()
            || verbose_level.is_some()
            || reasoning_level.is_some()
        {
            Some(KernelChatModelBinding {
                model: model.clone(),
                default_model: model,
                thinking_level,
                fast_mode,
                verbose_level,
                reasoning_level,
            })
        } else {
            None
        },
        capabilities: vec![],
        active_run_id: active_run_id,
        native_metadata: Some(Value::Object(native_metadata)),
    }
}

fn build_kernel_chat_agent_profile(row: HermesAgentRow) -> KernelChatAgentProfile {
    KernelChatAgentProfile {
        kernel_id: "hermes".to_string(),
        instance_id: row.instance_id,
        agent_id: row.agent_id,
        label: row.label,
        description: normalize_optional_string(row.description),
        source: normalize_kernel_chat_agent_profile_source(Some(row.source.as_str())),
        system_prompt: normalize_optional_string(row.system_prompt),
        avatar: normalize_optional_string(row.avatar),
        creator: normalize_optional_string(row.creator),
    }
}

fn build_session_binding_kernel_chat_agent_profile(
    instance_id: &str,
    agent_id: &str,
) -> KernelChatAgentProfile {
    KernelChatAgentProfile {
        kernel_id: "hermes".to_string(),
        instance_id: instance_id.to_string(),
        agent_id: agent_id.to_string(),
        label: agent_id.to_string(),
        description: None,
        source: "sessionBinding".to_string(),
        system_prompt: None,
        avatar: None,
        creator: None,
    }
}

fn query_hermes_session_row_for_instance(
    connection: &Connection,
    instance_id: &str,
    session_id: &str,
) -> Result<Option<HermesSessionRow>> {
    connection
        .query_row(
            "
            SELECT
              s.session_id,
              s.title,
              s.agent_id,
              s.model,
              s.thinking_level,
              s.fast_mode,
              s.verbose_level,
              s.reasoning_level,
              s.active_run_id,
              s.last_run_id,
              (
                SELECT r.status
                FROM runs r
                WHERE r.run_id = s.last_run_id
                LIMIT 1
              ),
              (
                SELECT r.updated_at_ms
                FROM runs r
                WHERE r.run_id = s.last_run_id
                LIMIT 1
              ),
              COALESCE(CAST(strftime('%s', s.started_at) AS INTEGER), 0) * 1000,
              COALESCE(
                (
                  SELECT CAST(strftime('%s', m.timestamp) AS INTEGER) * 1000
                  FROM messages m
                  WHERE m.session_id = s.session_id
                  ORDER BY m.timestamp DESC, m.id DESC
                  LIMIT 1
                ),
                COALESCE(CAST(strftime('%s', s.started_at) AS INTEGER), 0) * 1000
              ),
              (
                SELECT COUNT(*)
                FROM messages m
                WHERE m.session_id = s.session_id
              ),
              (
                SELECT m.content
                FROM messages m
                WHERE m.session_id = s.session_id
                ORDER BY m.timestamp DESC, m.id DESC
                LIMIT 1
              )
            FROM sessions s
            WHERE s.session_id = ?1
              AND s.instance_id = ?2
            ",
            params![session_id, instance_id],
            |row| {
                Ok(HermesSessionRow {
                    session_id: row.get(0)?,
                    title: row.get::<_, Option<String>>(1)?,
                    agent_id: row.get::<_, Option<String>>(2)?,
                    model: row.get::<_, Option<String>>(3)?,
                    thinking_level: row.get::<_, Option<String>>(4)?,
                    fast_mode: row.get::<_, Option<bool>>(5)?,
                    verbose_level: row.get::<_, Option<String>>(6)?,
                    reasoning_level: row.get::<_, Option<String>>(7)?,
                    active_run_id: row.get::<_, Option<String>>(8)?,
                    last_run_id: row.get::<_, Option<String>>(9)?,
                    last_run_status: row.get::<_, Option<String>>(10)?,
                    last_run_updated_at: row
                        .get::<_, Option<i64>>(11)?
                        .map(|value| value.max(0) as u64),
                    created_at: row.get::<_, i64>(12)?.max(0) as u64,
                    updated_at: row.get::<_, i64>(13)?.max(0) as u64,
                    message_count: row.get::<_, i64>(14)?.max(0) as u64,
                    last_message_content: row.get(15)?,
                })
            },
        )
        .optional()
        .map_err(FrameworkError::from)
}

fn query_hermes_run_row(
    connection: &Connection,
    session_id: &str,
    run_id: &str,
) -> Result<Option<HermesRunRow>> {
    connection
        .query_row(
            "
            SELECT
              run_id,
              session_id,
              agent_id,
              model,
              status,
              created_at_ms,
              updated_at_ms
            FROM runs
            WHERE session_id = ?1
              AND run_id = ?2
            LIMIT 1
            ",
            params![session_id, run_id],
            |row| {
                Ok(HermesRunRow {
                    run_id: row.get(0)?,
                    session_id: row.get(1)?,
                    agent_id: row.get::<_, Option<String>>(2)?,
                    model: row.get::<_, Option<String>>(3)?,
                    status: row.get(4)?,
                    created_at: row.get::<_, i64>(5)?.max(0) as u64,
                    updated_at: row.get::<_, i64>(6)?.max(0) as u64,
                })
            },
        )
        .optional()
        .map_err(FrameworkError::from)
}

fn build_kernel_chat_run(instance_id: &str, row: HermesRunRow) -> KernelChatRun {
    let agent_id = normalize_optional_string(row.agent_id);
    let model = normalize_optional_string(row.model);
    let mut native_metadata = serde_json::Map::new();
    native_metadata.insert("authorityFile".to_string(), Value::String("state.db".to_string()));
    native_metadata.insert("runtimeKind".to_string(), Value::String("hermes".to_string()));
    native_metadata.insert("persisted".to_string(), Value::Bool(true));
    if let Some(agent_id) = agent_id.as_ref() {
        native_metadata.insert("agentId".to_string(), Value::String(agent_id.clone()));
    }
    if let Some(model) = model.as_ref() {
        native_metadata.insert("model".to_string(), Value::String(model.clone()));
    }

    KernelChatRun {
        id: row.run_id,
        session_ref: build_kernel_chat_session_ref(instance_id, &row.session_id, agent_id),
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at.max(row.created_at),
        abortable: false,
        native_metadata: Some(Value::Object(native_metadata)),
    }
}

fn list_kernel_chat_runs_from_connection(
    connection: &Connection,
    instance_id: &str,
    session_id: &str,
) -> Result<Vec<KernelChatRun>> {
    let mut statement = connection.prepare(
        "
            SELECT
              run_id,
              session_id,
              agent_id,
              model,
              status,
              created_at_ms,
              updated_at_ms
            FROM runs
            WHERE session_id = ?1
            ORDER BY updated_at_ms DESC, created_at_ms DESC, run_id DESC
            ",
    )?;

    let rows = statement.query_map(params![session_id], |row| {
        Ok(HermesRunRow {
            run_id: row.get(0)?,
            session_id: row.get(1)?,
            agent_id: row.get::<_, Option<String>>(2)?,
            model: row.get::<_, Option<String>>(3)?,
            status: row.get(4)?,
            created_at: row.get::<_, i64>(5)?.max(0) as u64,
            updated_at: row.get::<_, i64>(6)?.max(0) as u64,
        })
    })?;

    let mut runs = Vec::new();
    for row in rows {
        runs.push(build_kernel_chat_run(instance_id, row?));
    }

    Ok(runs)
}

fn get_kernel_chat_run_from_connection(
    connection: &Connection,
    instance_id: &str,
    session_id: &str,
    run_id: &str,
) -> Result<Option<KernelChatRun>> {
    let row = query_hermes_run_row(connection, session_id, run_id)?;
    Ok(row.map(|value| build_kernel_chat_run(instance_id, value)))
}

fn resolve_hermes_chat_endpoint(instance: &StudioInstanceRecord) -> Result<String> {
    let base_url = instance
        .base_url
        .as_deref()
        .or(instance.config.base_url.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            FrameworkError::InvalidOperation(format!(
                "instance \"{}\" does not expose a Hermes HTTP base URL",
                instance.id
            ))
        })?;

    if base_url.ends_with("/v1/chat/completions")
        || base_url.ends_with("/chat/completions")
        || base_url.ends_with("/v1/responses")
        || base_url.ends_with("/responses")
    {
        return Ok(base_url.to_string());
    }

    Ok(format!("{}/v1/responses", base_url.trim_end_matches('/')))
}

fn build_hermes_message_payload(content: &str) -> Value {
    json!([
        {
            "role": "user",
            "content": content,
        }
    ])
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum HermesChatEndpointMode {
    ChatCompletions,
    Responses,
}

fn resolve_hermes_chat_endpoint_mode(endpoint: &str) -> HermesChatEndpointMode {
    let normalized_endpoint = endpoint.trim().to_ascii_lowercase();
    if normalized_endpoint.ends_with("/v1/responses")
        || normalized_endpoint.ends_with("/responses")
    {
        return HermesChatEndpointMode::Responses;
    }

    HermesChatEndpointMode::ChatCompletions
}

fn build_hermes_request_body(
    endpoint: &str,
    session_id: &str,
    model: Option<&str>,
    content: &str,
) -> Value {
    let mut body = serde_json::Map::new();

    match resolve_hermes_chat_endpoint_mode(endpoint) {
        HermesChatEndpointMode::Responses => {
            body.insert("input".to_string(), Value::String(content.to_string()));
            body.insert(
                "conversation".to_string(),
                Value::String(session_id.to_string()),
            );
            body.insert("store".to_string(), Value::Bool(true));
        }
        HermesChatEndpointMode::ChatCompletions => {
            body.insert(
                "messages".to_string(),
                build_hermes_message_payload(content),
            );
        }
    }

    body.insert("stream".to_string(), Value::Bool(false));
    if let Some(model) = model.map(str::trim).filter(|value| !value.is_empty()) {
        body.insert("model".to_string(), Value::String(model.to_string()));
    }

    Value::Object(body)
}

fn request_hermes_chat_completion(
    instance: &StudioInstanceRecord,
    session_id: &str,
    model: Option<&str>,
    content: &str,
) -> Result<Value> {
    let endpoint = resolve_hermes_chat_endpoint(instance)?;
    let client = Client::builder().build().map_err(|error| {
        FrameworkError::Internal(format!("failed to build Hermes HTTP client: {error}"))
    })?;
    let mut request = client
        .post(endpoint.as_str())
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .header("X-Hermes-Session-Id", session_id);

    if let Some(auth_token) = instance
        .config
        .auth_token
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        request = request.bearer_auth(auth_token);
    }

    let request_body = build_hermes_request_body(&endpoint, session_id, model, content);

    let response = request.json(&request_body).send().map_err(|error| {
        FrameworkError::InvalidOperation(format!(
            "failed to start Hermes kernel chat run for instance \"{}\": {error}",
            instance.id
        ))
    })?;
    let status = response.status();

    if !status.is_success() {
        let response_text = response.text().unwrap_or_default();
        return Err(FrameworkError::InvalidOperation(format!(
            "Hermes kernel chat run for instance \"{}\" failed with status {}: {}",
            instance.id,
            status,
            response_text.trim()
        )));
    }

    response.json::<Value>().map_err(|error| {
        FrameworkError::Internal(format!(
            "failed to decode Hermes kernel chat run response for instance \"{}\": {error}",
            instance.id
        ))
    })
}

pub(super) fn list_kernel_chat_agent_profiles_for_managed_hermes(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
) -> Result<Vec<KernelChatAgentProfile>> {
    debug_assert!(is_managed_hermes_instance(instance));
    let Some(connection) = ensure_hermes_state_db(paths, false)? else {
        return Ok(vec![]);
    };

    let mut statement = connection.prepare(
        "
            SELECT
              instance_id,
              agent_id,
              label,
              description,
              source,
              system_prompt,
              avatar,
              creator
            FROM agents
            WHERE instance_id = ?1
            ORDER BY updated_at_ms DESC, label COLLATE NOCASE ASC, agent_id ASC
            ",
    )?;
    let rows = statement.query_map(params![instance.id.as_str()], |row| {
        Ok(HermesAgentRow {
            instance_id: row.get(0)?,
            agent_id: row.get(1)?,
            label: row.get(2)?,
            description: row.get::<_, Option<String>>(3)?,
            source: row.get(4)?,
            system_prompt: row.get::<_, Option<String>>(5)?,
            avatar: row.get::<_, Option<String>>(6)?,
            creator: row.get::<_, Option<String>>(7)?,
        })
    })?;

    let mut profiles = Vec::new();
    let mut seen_agent_ids = HashSet::new();
    for row in rows {
        let profile = build_kernel_chat_agent_profile(row?);
        let dedupe_key = profile.agent_id.to_ascii_lowercase();
        if seen_agent_ids.insert(dedupe_key) {
            profiles.push(profile);
        }
    }

    let mut session_statement = connection.prepare(
        "
            SELECT
              s.instance_id,
              s.agent_id
            FROM sessions s
            WHERE s.instance_id = ?1
              AND s.agent_id IS NOT NULL
              AND TRIM(s.agent_id) != ''
            GROUP BY s.instance_id, s.agent_id
            ORDER BY MAX(
              COALESCE(
                (
                  SELECT MAX(r.updated_at_ms)
                  FROM runs r
                  WHERE r.session_id = s.session_id
                ),
                COALESCE(CAST(strftime('%s', s.started_at) AS INTEGER), 0) * 1000
              )
            ) DESC,
            s.agent_id COLLATE NOCASE ASC
            ",
    )?;
    let session_rows = session_statement.query_map(params![instance.id.as_str()], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
        ))
    })?;

    for row in session_rows {
        let (instance_id, agent_id) = row?;
        let dedupe_key = agent_id.to_ascii_lowercase();
        if seen_agent_ids.insert(dedupe_key) {
            profiles.push(build_session_binding_kernel_chat_agent_profile(
                instance_id.as_str(),
                agent_id.as_str(),
            ));
        }
    }

    Ok(profiles)
}

pub(super) fn list_kernel_chat_sessions_for_managed_hermes(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
) -> Result<Vec<KernelChatSession>> {
    debug_assert!(is_managed_hermes_instance(instance));
    let instance_id = instance.id.as_str();
    let Some(connection) = ensure_hermes_state_db(paths, false)? else {
        return Ok(vec![]);
    };

    let mut statement = connection.prepare(
        "
            SELECT
              s.session_id,
              s.title,
              s.agent_id,
              s.model,
              s.thinking_level,
              s.fast_mode,
              s.verbose_level,
              s.reasoning_level,
              s.active_run_id,
              s.last_run_id,
              (
                SELECT r.status
                FROM runs r
                WHERE r.run_id = s.last_run_id
                LIMIT 1
              ),
              (
                SELECT r.updated_at_ms
                FROM runs r
                WHERE r.run_id = s.last_run_id
                LIMIT 1
              ),
              COALESCE(CAST(strftime('%s', s.started_at) AS INTEGER), 0) * 1000 AS created_at_ms,
              COALESCE(
                (
                  SELECT CAST(strftime('%s', m.timestamp) AS INTEGER) * 1000
                  FROM messages m
                  WHERE m.session_id = s.session_id
                  ORDER BY m.timestamp DESC, m.id DESC
                  LIMIT 1
                ),
                COALESCE(CAST(strftime('%s', s.started_at) AS INTEGER), 0) * 1000
              ) AS updated_at_ms,
              (
                SELECT COUNT(*)
                FROM messages m
                WHERE m.session_id = s.session_id
              ),
              (
                SELECT m.content
                FROM messages m
                WHERE m.session_id = s.session_id
                ORDER BY m.timestamp DESC, m.id DESC
                LIMIT 1
              )
            FROM sessions s
            WHERE s.instance_id = ?1
            ORDER BY updated_at_ms DESC, created_at_ms DESC, s.session_id DESC
            ",
    )?;

    let rows = statement.query_map(params![instance_id], |row| {
        Ok(HermesSessionRow {
            session_id: row.get(0)?,
            title: row.get::<_, Option<String>>(1)?,
            agent_id: row.get::<_, Option<String>>(2)?,
            model: row.get::<_, Option<String>>(3)?,
            thinking_level: row.get::<_, Option<String>>(4)?,
            fast_mode: row.get::<_, Option<bool>>(5)?,
            verbose_level: row.get::<_, Option<String>>(6)?,
            reasoning_level: row.get::<_, Option<String>>(7)?,
            active_run_id: row.get::<_, Option<String>>(8)?,
            last_run_id: row.get::<_, Option<String>>(9)?,
            last_run_status: row.get::<_, Option<String>>(10)?,
            last_run_updated_at: row
                .get::<_, Option<i64>>(11)?
                .map(|value| value.max(0) as u64),
            created_at: row.get::<_, i64>(12)?.max(0) as u64,
            updated_at: row.get::<_, i64>(13)?.max(0) as u64,
            message_count: row.get::<_, i64>(14)?.max(0) as u64,
            last_message_content: row.get(15)?,
        })
    })?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(build_kernel_chat_session(instance_id, row?));
    }

    Ok(sessions)
}

pub(super) fn get_kernel_chat_session_for_managed_hermes(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    session_id: &str,
) -> Result<Option<KernelChatSession>> {
    debug_assert!(is_managed_hermes_instance(instance));
    let Some(connection) = ensure_hermes_state_db(paths, false)? else {
        return Ok(None);
    };

    let row = query_hermes_session_row_for_instance(&connection, instance.id.as_str(), session_id)?;
    Ok(row.map(|value| build_kernel_chat_session(instance.id.as_str(), value)))
}

pub(super) fn list_kernel_chat_runs_for_managed_hermes(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    session_id: &str,
) -> Result<Vec<KernelChatRun>> {
    debug_assert!(is_managed_hermes_instance(instance));
    let Some(connection) = ensure_hermes_state_db(paths, false)? else {
        return Ok(vec![]);
    };
    if query_hermes_session_row_for_instance(&connection, instance.id.as_str(), session_id)?.is_none() {
        return Ok(vec![]);
    }

    list_kernel_chat_runs_from_connection(&connection, instance.id.as_str(), session_id)
}

pub(super) fn get_kernel_chat_run_for_managed_hermes(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    session_id: &str,
    run_id: &str,
) -> Result<Option<KernelChatRun>> {
    debug_assert!(is_managed_hermes_instance(instance));
    let Some(connection) = ensure_hermes_state_db(paths, false)? else {
        return Ok(None);
    };
    if query_hermes_session_row_for_instance(&connection, instance.id.as_str(), session_id)?.is_none() {
        return Ok(None);
    }

    get_kernel_chat_run_from_connection(&connection, instance.id.as_str(), session_id, run_id)
}

pub(super) fn create_kernel_chat_session_for_managed_hermes(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    input: StudioCreateKernelChatSessionInput,
) -> Result<KernelChatSession> {
    debug_assert!(is_managed_hermes_instance(instance));
    let Some(connection) = ensure_hermes_state_db(paths, true)? else {
        return Err(FrameworkError::Internal(
            "Hermes state database could not be opened.".to_string(),
        ));
    };

    let session_id = Uuid::new_v4().to_string();
    let persisted_agent_id = normalize_optional_string(input.agent_id.clone());
    persist_hermes_agent_profile(
        &connection,
        instance.id.as_str(),
        persisted_agent_id.as_deref(),
    )?;
    connection.execute(
        "INSERT INTO sessions (session_id, instance_id, title, agent_id, model) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            session_id,
            instance.id.as_str(),
            normalize_optional_string(input.title.clone()),
            persisted_agent_id,
            normalize_optional_string(input.model.clone()),
        ],
    )?;

    let row = query_hermes_session_row_for_instance(
        &connection,
        instance.id.as_str(),
        session_id.as_str(),
    )?
    .ok_or_else(|| {
        FrameworkError::Internal(format!(
            "created Hermes session \"{}\" could not be reloaded",
            session_id
        ))
    })?;

    Ok(build_kernel_chat_session(input.instance_id.as_str(), row))
}

pub(super) fn patch_kernel_chat_session_for_managed_hermes(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    input: StudioPatchKernelChatSessionInput,
) -> Result<KernelChatSession> {
    debug_assert!(is_managed_hermes_instance(instance));
    let Some(connection) = ensure_hermes_state_db(paths, false)? else {
        return Err(FrameworkError::NotFound(format!(
            "kernel chat session \"{}\"",
            input.session_id
        )));
    };
    let existing_row = query_hermes_session_row_for_instance(
        &connection,
        instance.id.as_str(),
        input.session_id.as_str(),
    )?
    .ok_or_else(|| {
        FrameworkError::NotFound(format!(
            "kernel chat session \"{}\"",
            input.session_id
        ))
    })?;
    let next_title = resolve_session_patch_string(input.title.clone(), existing_row.title.clone());
    let next_model = resolve_session_patch_string(input.model.clone(), existing_row.model.clone());
    let next_thinking_level = resolve_session_patch_string(
        input.thinking_level.clone(),
        existing_row.thinking_level.clone(),
    );
    let next_fast_mode =
        resolve_session_patch_bool(input.fast_mode, existing_row.fast_mode);
    let next_verbose_level = resolve_session_patch_string(
        input.verbose_level.clone(),
        existing_row.verbose_level.clone(),
    );
    let next_reasoning_level = resolve_session_patch_string(
        input.reasoning_level.clone(),
        existing_row.reasoning_level.clone(),
    );

    let updated = connection.execute(
        "UPDATE sessions
         SET title = ?2,
             model = ?3,
             thinking_level = ?4,
             fast_mode = ?5,
             verbose_level = ?6,
             reasoning_level = ?7
         WHERE session_id = ?1
           AND instance_id = ?8",
        params![
            input.session_id.as_str(),
            next_title,
            next_model,
            next_thinking_level,
            next_fast_mode,
            next_verbose_level,
            next_reasoning_level,
            instance.id.as_str(),
        ],
    )?;
    if updated == 0 {
        return Err(FrameworkError::NotFound(format!(
            "kernel chat session \"{}\"",
            input.session_id
        )));
    }

    let row = query_hermes_session_row_for_instance(
        &connection,
        instance.id.as_str(),
        input.session_id.as_str(),
    )?
    .ok_or_else(|| {
            FrameworkError::NotFound(format!("kernel chat session \"{}\"", input.session_id))
        })?;

    Ok(build_kernel_chat_session(input.instance_id.as_str(), row))
}

pub(super) fn delete_kernel_chat_session_for_managed_hermes(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    session_id: &str,
) -> Result<()> {
    debug_assert!(is_managed_hermes_instance(instance));
    let Some(connection) = ensure_hermes_state_db(paths, false)? else {
        return Ok(());
    };

    connection.execute(
        "DELETE FROM sessions WHERE session_id = ?1 AND instance_id = ?2",
        params![session_id, instance.id.as_str()],
    )?;
    Ok(())
}

pub(super) fn start_kernel_chat_run_for_managed_hermes(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    input: StudioStartKernelChatRunInput,
) -> Result<KernelChatRun> {
    debug_assert!(is_managed_hermes_instance(instance));
    let now = unix_timestamp_ms()?;
    let Some(connection) = ensure_hermes_state_db(paths, true)? else {
        return Err(FrameworkError::Internal(
            "Hermes state database could not be opened.".to_string(),
        ));
    };
    let session_row = query_hermes_session_row_for_instance(
        &connection,
        instance.id.as_str(),
        input.session_id.as_str(),
    )?
    .ok_or_else(|| {
        FrameworkError::NotFound(format!(
            "kernel chat session \"{}\"",
            input.session_id
        ))
    })?;
    let requested_model = normalize_optional_string(input.model.clone());
    let persisted_model = normalize_optional_string(session_row.model.clone());
    let effective_model = requested_model.clone().or_else(|| persisted_model);
    if let Some(model) = requested_model.as_ref() {
        connection.execute(
            "UPDATE sessions
             SET model = ?2,
                 active_run_id = NULL
             WHERE session_id = ?1
               AND instance_id = ?3",
            params![input.session_id.as_str(), model, instance.id.as_str()],
        )?;
    } else {
        connection.execute(
            "UPDATE sessions SET active_run_id = NULL WHERE session_id = ?1 AND instance_id = ?2",
            params![input.session_id.as_str(), instance.id.as_str()],
        )?;
    }

    let run_agent_id = normalize_optional_string(session_row.agent_id.clone());
    persist_hermes_agent_profile(&connection, instance.id.as_str(), run_agent_id.as_deref())?;

    let response_payload = request_hermes_chat_completion(
        instance,
        input.session_id.as_str(),
        effective_model.as_deref(),
        input.content.as_str(),
    )?;
    let response_id = response_payload
        .get("id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| format!("hermes-run-{}", Uuid::new_v4()));
    let completed_at = unix_timestamp_ms()?.max(now);
    persist_hermes_run_record(
        &connection,
        input.session_id.as_str(),
        response_id.as_str(),
        run_agent_id.as_deref(),
        effective_model.as_deref(),
        "completed",
        now,
        completed_at,
    )?;
    persist_hermes_run_messages(
        &connection,
        input.session_id.as_str(),
        response_id.as_str(),
        input.content.as_str(),
        &response_payload,
    )?;

    Ok(KernelChatRun {
        id: response_id,
        session_ref: build_kernel_chat_session_ref(
            input.instance_id.as_str(),
            input.session_id.as_str(),
            run_agent_id,
        ),
        status: "completed".to_string(),
        created_at: now,
        updated_at: completed_at,
        abortable: false,
        native_metadata: Some(json!({
            "authority": "hermes-http",
            "response": response_payload,
            "persisted": true,
        })),
    })
}

pub(super) fn abort_kernel_chat_run_for_managed_hermes(
    instance: &StudioInstanceRecord,
    _session_id: &str,
    _run_id: Option<&str>,
) -> Result<bool> {
    debug_assert!(is_managed_hermes_instance(instance));
    Ok(false)
}

pub(super) fn load_kernel_chat_messages_for_managed_hermes(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
    session_id: &str,
) -> Result<Vec<KernelChatMessage>> {
    debug_assert!(is_managed_hermes_instance(instance));
    let instance_id = instance.id.as_str();
    let Some(connection) = ensure_hermes_state_db(paths, false)? else {
        return Ok(vec![]);
    };
    let session_row =
        query_hermes_session_row_for_instance(&connection, instance.id.as_str(), session_id)?;
    if session_row.is_none() {
        return Ok(vec![]);
    }
    let session_agent_id =
        session_row.and_then(|row| normalize_optional_string(row.agent_id));

    let mut statement = connection.prepare(
        "
            SELECT
              id,
              role,
              content,
              run_id,
              model,
              COALESCE(CAST(strftime('%s', timestamp) AS INTEGER), 0) * 1000
            FROM messages
            WHERE session_id = ?1
            ORDER BY timestamp ASC, id ASC
            ",
    )?;
    let rows = statement.query_map(params![session_id], |row| {
        let message_id = row.get::<_, i64>(0)?.max(0);
        let role = row.get::<_, String>(1)?;
        let content = row.get::<_, String>(2)?;
        let run_id = row.get::<_, Option<String>>(3)?;
        let model = row.get::<_, Option<String>>(4)?;
        let timestamp = row.get::<_, i64>(5)?.max(0) as u64;
        Ok((message_id, role, content, run_id, model, timestamp))
    })?;

    let session_ref = build_kernel_chat_session_ref(instance_id, session_id, session_agent_id);
    let mut messages = Vec::new();
    for row in rows {
        let (message_id, role, content, run_id, model, timestamp) = row?;
        let text = extract_hermes_message_text(content.as_str());
        let parts = build_hermes_message_parts(content.as_str());

        messages.push(KernelChatMessage {
            id: message_id.to_string(),
            session_ref: session_ref.clone(),
            role: role.trim().to_lowercase(),
            status: "complete".to_string(),
            created_at: timestamp,
            updated_at: timestamp,
            text,
            parts,
            run_id: normalize_optional_string(run_id),
            model: normalize_optional_string(model),
            sender_label: None,
            native_metadata: parse_hermes_message_native_metadata(content.as_str()),
        });
    }

    Ok(messages)
}

#[cfg(test)]
mod tests {
    use super::{
        build_hermes_message_parts, build_hermes_request_body, build_kernel_chat_session,
        create_kernel_chat_session_for_managed_hermes, extract_hermes_message_text,
        extract_hermes_message_text_from_value, get_kernel_chat_run_from_connection,
        hermes_state_db_path, initialize_hermes_state_db,
        list_kernel_chat_agent_profiles_for_managed_hermes,
        list_kernel_chat_runs_from_connection, list_kernel_chat_sessions_for_managed_hermes,
        parse_hermes_message_native_metadata, patch_kernel_chat_session_for_managed_hermes,
        persist_hermes_run_messages, query_hermes_session_row,
        query_hermes_session_row_for_instance, resolve_hermes_chat_endpoint,
        start_kernel_chat_run_for_managed_hermes,
    };
    use crate::framework::paths::resolve_paths_for_root;
    use crate::framework::services::studio::kernel_chat::{
        KernelChatMessagePart, StudioCreateKernelChatSessionInput,
        StudioPatchKernelChatSessionInput, StudioStartKernelChatRunInput,
    };
    use rusqlite::{params, Connection};
    use serde_json::json;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        sync::{Arc, Mutex},
        thread,
    };

    fn create_managed_hermes_instance_with_id(
        id: &str,
        base_url: &str,
    ) -> super::StudioInstanceRecord {
        serde_json::from_value(json!({
            "id": id,
            "name": "Managed Hermes",
            "description": "Managed Hermes instance",
            "runtimeKind": "hermes",
            "deploymentMode": "local-managed",
            "transportKind": "customHttp",
            "status": "online",
            "isBuiltIn": true,
            "isDefault": false,
            "iconType": "server",
            "version": "2026.4.21",
            "typeLabel": "Hermes Agent",
            "host": "127.0.0.1",
            "port": 19540,
            "baseUrl": base_url,
            "websocketUrl": null,
            "cpu": 0,
            "memory": 0,
            "totalMemory": "0 GB",
            "uptime": "0m",
            "capabilities": ["chat"],
            "storage": {
                "provider": "localFile",
                "namespace": "fixture"
            },
            "config": {
                "port": "19540",
                "sandbox": true,
                "autoUpdate": false,
                "logLevel": "info",
                "corsOrigins": "*",
                "baseUrl": base_url,
                "websocketUrl": null,
                "authToken": "fixture-token"
            },
            "createdAt": 1,
            "updatedAt": 1,
            "lastSeenAt": 1
        }))
        .expect("deserialize managed hermes instance fixture")
    }

    fn create_managed_hermes_instance(base_url: &str) -> super::StudioInstanceRecord {
        create_managed_hermes_instance_with_id("instance-hermes", base_url)
    }

    fn spawn_single_response_server(
        response_body: serde_json::Value,
    ) -> (
        String,
        Arc<Mutex<Option<serde_json::Value>>>,
        thread::JoinHandle<()>,
    ) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind single response server");
        let base_url = format!("http://{}", listener.local_addr().expect("resolve server address"));
        let captured_request_body = Arc::new(Mutex::new(None));
        let captured_request_body_clone = Arc::clone(&captured_request_body);
        let response_text = response_body.to_string();
        let response_length = response_text.len();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept single response connection");
            let mut buffer = Vec::new();
            let mut chunk = [0_u8; 1024];
            let mut header_end = None;
            let mut content_length = 0_usize;

            loop {
                let read = stream.read(&mut chunk).expect("read request bytes");
                if read == 0 {
                    break;
                }

                buffer.extend_from_slice(&chunk[..read]);

                if header_end.is_none() {
                    if let Some(position) =
                        buffer.windows(4).position(|window| window == b"\r\n\r\n")
                    {
                        let end = position + 4;
                        header_end = Some(end);
                        let header_text = String::from_utf8_lossy(&buffer[..end]);
                        content_length = header_text
                            .lines()
                            .find_map(|line| {
                                let (name, value) = line.split_once(':')?;
                                if name.trim().eq_ignore_ascii_case("content-length") {
                                    value.trim().parse::<usize>().ok()
                                } else {
                                    None
                                }
                            })
                            .unwrap_or(0);
                    }
                }

                if let Some(end) = header_end {
                    if buffer.len() >= end + content_length {
                        break;
                    }
                }
            }

            let body = if let Some(end) = header_end {
                serde_json::from_slice::<serde_json::Value>(&buffer[end..end + content_length])
                    .expect("parse captured request body")
            } else {
                json!(null)
            };
            *captured_request_body_clone
                .lock()
                .expect("lock captured request body") = Some(body);

            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {response_length}\r\nConnection: close\r\n\r\n{response_text}"
            )
            .expect("write response");
            stream.flush().expect("flush response");
        });

        (base_url, captured_request_body, handle)
    }

    #[test]
    fn hermes_chat_endpoint_defaults_to_responses_for_managed_base_urls() {
        let instance = create_managed_hermes_instance("http://127.0.0.1:19540");

        assert_eq!(
            resolve_hermes_chat_endpoint(&instance).expect("resolve responses endpoint"),
            "http://127.0.0.1:19540/v1/responses"
        );
    }

    #[test]
    fn hermes_request_body_uses_responses_contract_for_responses_endpoints() {
        assert_eq!(
            build_hermes_request_body(
                "http://127.0.0.1:19540/v1/responses",
                "session-1",
                Some("hermes/latest"),
                "Inspect the workspace",
            ),
            json!({
                "input": "Inspect the workspace",
                "conversation": "session-1",
                "store": true,
                "stream": false,
                "model": "hermes/latest"
            }),
        );
    }

    #[test]
    fn hermes_request_body_preserves_legacy_chat_completions_contract_for_explicit_legacy_endpoints(
    ) {
        assert_eq!(
            build_hermes_request_body(
                "http://127.0.0.1:19540/v1/chat/completions",
                "session-1",
                Some("hermes/latest"),
                "Inspect the workspace",
            ),
            json!({
                "messages": [
                    {
                        "role": "user",
                        "content": "Inspect the workspace"
                    }
                ],
                "stream": false,
                "model": "hermes/latest"
            }),
        );
    }

    #[test]
    fn hermes_message_text_extracts_assistant_text_from_chat_completion_payloads() {
        let payload = json!({
            "id": "resp-1",
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "assistant reply"
                    }
                }
            ]
        });

        assert_eq!(
            extract_hermes_message_text_from_value(&payload),
            "assistant reply"
        );
        assert_eq!(
            extract_hermes_message_text(payload.to_string().as_str()),
            "assistant reply"
        );
    }

    #[test]
    fn hermes_run_persistence_writes_user_and_assistant_messages_into_state_db() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (session_id, title) VALUES (?1, ?2)",
                params!["session-1", "Session"],
            )
            .expect("insert session");

        let response_payload = json!({
            "id": "resp-1",
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "assistant reply"
                    }
                }
            ]
        });
        persist_hermes_run_messages(
            &connection,
            "session-1",
            "resp-1",
            "user prompt",
            &response_payload,
        )
        .expect("persist hermes run messages");

        let mut statement = connection
            .prepare("SELECT role, content FROM messages WHERE session_id = ?1 ORDER BY id ASC")
            .expect("prepare query");
        let rows = statement
            .query_map(params!["session-1"], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .expect("query rows")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("collect rows");
        let session_row = query_hermes_session_row(&connection, "session-1")
            .expect("query session row")
            .expect("session row exists");

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].0, "user");
        assert_eq!(rows[0].1, "user prompt");
        assert_eq!(rows[1].0, "assistant");
        assert!(
            rows[1].1.contains("\"assistant reply\""),
            "assistant payload should preserve the raw Hermes response JSON",
        );
        assert_eq!(session_row.message_count, 2);
        assert_eq!(
            extract_hermes_message_text(rows[1].1.as_str()),
            "assistant reply"
        );
        assert_eq!(
            parse_hermes_message_native_metadata(rows[1].1.as_str()),
            Some(json!({
                "rawContent": response_payload,
            })),
        );
    }

    #[test]
    fn hermes_session_projection_preserves_persisted_agent_and_model_bindings() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (
                    session_id,
                    title,
                    agent_id,
                    model,
                    thinking_level,
                    fast_mode,
                    verbose_level,
                    reasoning_level
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    "session-1",
                    "Kernel Session",
                    "research",
                    "hermes/latest",
                    "deep",
                    1_i64,
                    "full",
                    "stream"
                ],
            )
            .expect("insert session with persisted bindings");

        let row = query_hermes_session_row(&connection, "session-1")
            .expect("query session row")
            .expect("session row exists");
        let session = build_kernel_chat_session("instance-hermes", row);

        assert_eq!(session.session_ref.agent_id.as_deref(), Some("research"));
        assert_eq!(
            session
                .actor_binding
                .as_ref()
                .and_then(|binding| binding.agent_id.as_deref()),
            Some("research")
        );
        assert_eq!(
            session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.model.as_deref()),
            Some("hermes/latest")
        );
        assert_eq!(
            session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.default_model.as_deref()),
            Some("hermes/latest")
        );
        assert_eq!(
            session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.thinking_level.as_deref()),
            Some("deep")
        );
        assert_eq!(
            session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.fast_mode),
            Some(true)
        );
        assert_eq!(
            session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.verbose_level.as_deref()),
            Some("full")
        );
        assert_eq!(
            session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.reasoning_level.as_deref()),
            Some("stream")
        );
    }

    #[test]
    fn managed_hermes_session_creation_persists_agent_profiles_in_local_state_db() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let instance = create_managed_hermes_instance("http://127.0.0.1:19540");

        let session = create_kernel_chat_session_for_managed_hermes(
            &paths,
            &instance,
            StudioCreateKernelChatSessionInput {
                instance_id: instance.id.clone(),
                model: Some("hermes/research".to_string()),
                agent_id: Some("research".to_string()),
                title: Some("Research Session".to_string()),
            },
        )
        .expect("create managed hermes session");
        let profiles = list_kernel_chat_agent_profiles_for_managed_hermes(&paths, &instance)
            .expect("list agent profiles");

        assert_eq!(session.session_ref.agent_id.as_deref(), Some("research"));
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].instance_id, instance.id);
        assert_eq!(profiles[0].agent_id, "research");
        assert_eq!(profiles[0].label, "research");
        assert_eq!(profiles[0].source, "sessionBinding");
    }

    #[test]
    fn managed_hermes_agent_profile_listing_recovers_session_bound_agents_without_agents_table_rows()
    {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let instance = create_managed_hermes_instance("http://127.0.0.1:19540");
        let connection = Connection::open(hermes_state_db_path(&paths)).expect("open state db");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (session_id, instance_id, title, agent_id, model) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    "session-research",
                    instance.id.as_str(),
                    "Research Session",
                    "research",
                    "hermes/research"
                ],
            )
            .expect("insert session");
        drop(connection);

        let profiles = list_kernel_chat_agent_profiles_for_managed_hermes(&paths, &instance)
            .expect("list recovered profiles");

        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].instance_id, instance.id);
        assert_eq!(profiles[0].agent_id, "research");
        assert_eq!(profiles[0].label, "research");
        assert_eq!(profiles[0].source, "sessionBinding");
    }

    #[test]
    fn managed_hermes_session_patch_persists_session_override_bindings() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let instance = create_managed_hermes_instance("http://127.0.0.1:19540");

        let created_session = create_kernel_chat_session_for_managed_hermes(
            &paths,
            &instance,
            StudioCreateKernelChatSessionInput {
                instance_id: instance.id.clone(),
                model: Some("hermes/research".to_string()),
                agent_id: Some("research".to_string()),
                title: Some("Research Session".to_string()),
            },
        )
        .expect("create managed hermes session");

        let patched_session = patch_kernel_chat_session_for_managed_hermes(
            &paths,
            &instance,
            StudioPatchKernelChatSessionInput {
                instance_id: instance.id.clone(),
                session_id: created_session.session_ref.session_id.clone(),
                title: None,
                model: Some(Some("hermes/support".to_string())),
                thinking_level: Some(Some("deep".to_string())),
                fast_mode: Some(Some(true)),
                verbose_level: Some(Some("full".to_string())),
                reasoning_level: Some(Some("stream".to_string())),
            },
        )
        .expect("patch managed hermes session");

        assert_eq!(
            patched_session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.model.as_deref()),
            Some("hermes/support")
        );
        assert_eq!(
            patched_session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.thinking_level.as_deref()),
            Some("deep")
        );
        assert_eq!(
            patched_session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.fast_mode),
            Some(true)
        );
        assert_eq!(
            patched_session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.verbose_level.as_deref()),
            Some("full")
        );
        assert_eq!(
            patched_session
                .model_binding
                .as_ref()
                .and_then(|binding| binding.reasoning_level.as_deref()),
            Some("stream")
        );

        let connection = Connection::open(hermes_state_db_path(&paths)).expect("open state db");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        let row = query_hermes_session_row_for_instance(
            &connection,
            instance.id.as_str(),
            created_session.session_ref.session_id.as_str(),
        )
        .expect("query patched session row")
        .expect("patched session row exists");

        assert_eq!(row.model.as_deref(), Some("hermes/support"));
        assert_eq!(row.thinking_level.as_deref(), Some("deep"));
        assert_eq!(row.fast_mode, Some(true));
        assert_eq!(row.verbose_level.as_deref(), Some("full"));
        assert_eq!(row.reasoning_level.as_deref(), Some("stream"));
    }

    #[test]
    fn managed_hermes_session_listing_sorts_by_latest_message_update_desc() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let instance = create_managed_hermes_instance("http://127.0.0.1:19540");
        let connection = Connection::open(hermes_state_db_path(&paths)).expect("open state db");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (session_id, instance_id, started_at, title, agent_id, model) VALUES (?1, ?2, datetime(?3, 'unixepoch'), ?4, ?5, ?6)",
                params![
                    "session-older",
                    instance.id.as_str(),
                    1_i64,
                    "Older",
                    "z-agent",
                    "z-model"
                ],
            )
            .expect("insert older session");
        connection
            .execute(
                "INSERT INTO sessions (session_id, instance_id, started_at, title, agent_id, model) VALUES (?1, ?2, datetime(?3, 'unixepoch'), ?4, ?5, ?6)",
                params![
                    "session-newer",
                    instance.id.as_str(),
                    2_i64,
                    "Newer",
                    "a-agent",
                    "a-model"
                ],
            )
            .expect("insert newer session");
        connection
            .execute(
                "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?1, ?2, ?3, datetime(?4, 'unixepoch'))",
                params!["session-older", "assistant", "older reply", 10_i64],
            )
            .expect("insert older message");
        connection
            .execute(
                "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?1, ?2, ?3, datetime(?4, 'unixepoch'))",
                params!["session-newer", "assistant", "newer reply", 30_i64],
            )
            .expect("insert newer message");

        let sessions = list_kernel_chat_sessions_for_managed_hermes(&paths, &instance)
            .expect("list kernel chat sessions");

        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0].session_ref.session_id, "session-newer");
        assert_eq!(sessions[0].updated_at, 30_000);
        assert_eq!(sessions[1].session_ref.session_id, "session-older");
        assert_eq!(sessions[1].updated_at, 10_000);
    }

    #[test]
    fn managed_hermes_state_db_scopes_sessions_and_agents_by_instance() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let instance_a =
            create_managed_hermes_instance_with_id("instance-hermes-a", "http://127.0.0.1:19540");
        let instance_b =
            create_managed_hermes_instance_with_id("instance-hermes-b", "http://127.0.0.1:29540");

        create_kernel_chat_session_for_managed_hermes(
            &paths,
            &instance_a,
            StudioCreateKernelChatSessionInput {
                instance_id: instance_a.id.clone(),
                model: Some("hermes/research".to_string()),
                agent_id: Some("research".to_string()),
                title: Some("Research A".to_string()),
            },
        )
        .expect("create instance a session");
        create_kernel_chat_session_for_managed_hermes(
            &paths,
            &instance_b,
            StudioCreateKernelChatSessionInput {
                instance_id: instance_b.id.clone(),
                model: Some("hermes/support".to_string()),
                agent_id: Some("support".to_string()),
                title: Some("Support B".to_string()),
            },
        )
        .expect("create instance b session");

        let sessions_a = list_kernel_chat_sessions_for_managed_hermes(&paths, &instance_a)
            .expect("list instance a sessions");
        let sessions_b = list_kernel_chat_sessions_for_managed_hermes(&paths, &instance_b)
            .expect("list instance b sessions");
        let agents_a = list_kernel_chat_agent_profiles_for_managed_hermes(&paths, &instance_a)
            .expect("list instance a agents");
        let agents_b = list_kernel_chat_agent_profiles_for_managed_hermes(&paths, &instance_b)
            .expect("list instance b agents");

        assert_eq!(sessions_a.len(), 1);
        assert_eq!(sessions_a[0].session_ref.instance_id, instance_a.id);
        assert_eq!(sessions_a[0].session_ref.agent_id.as_deref(), Some("research"));
        assert_eq!(sessions_b.len(), 1);
        assert_eq!(sessions_b[0].session_ref.instance_id, instance_b.id);
        assert_eq!(sessions_b[0].session_ref.agent_id.as_deref(), Some("support"));
        assert_eq!(agents_a.len(), 1);
        assert_eq!(agents_a[0].instance_id, instance_a.id);
        assert_eq!(agents_a[0].agent_id, "research");
        assert_eq!(agents_b.len(), 1);
        assert_eq!(agents_b[0].instance_id, instance_b.id);
        assert_eq!(agents_b[0].agent_id, "support");
    }

    #[test]
    fn hermes_run_persistence_records_last_run_linkage_for_sessions_and_messages() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (session_id, title) VALUES (?1, ?2)",
                params!["session-1", "Session"],
            )
            .expect("insert session");

        let response_payload = json!({
            "id": "resp-run-1",
            "output": [
                {
                    "type": "message",
                    "role": "assistant",
                    "content": [
                        {
                            "type": "output_text",
                            "text": "assistant reply"
                        }
                    ]
                }
            ]
        });
        persist_hermes_run_messages(
            &connection,
            "session-1",
            "resp-run-1",
            "user prompt",
            &response_payload,
        )
        .expect("persist hermes run messages");

        let row = query_hermes_session_row(&connection, "session-1")
            .expect("query session row")
            .expect("session row exists");

        assert_eq!(row.active_run_id.as_deref(), None);
        assert_eq!(row.last_run_id.as_deref(), Some("resp-run-1"));

        let mut statement = connection
            .prepare(
                "SELECT role, run_id, content FROM messages WHERE session_id = ?1 ORDER BY id ASC",
            )
            .expect("prepare message query");
        let rows = statement
            .query_map(params!["session-1"], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .expect("query rows")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("collect rows");

        assert_eq!(
            rows,
            vec![
                (
                    "user".to_string(),
                    Some("resp-run-1".to_string()),
                    "user prompt".to_string(),
                ),
                (
                    "assistant".to_string(),
                    Some("resp-run-1".to_string()),
                    response_payload.to_string(),
                ),
            ]
        );
    }

    #[test]
    fn hermes_run_persistence_records_message_level_model_binding() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (session_id, title, model) VALUES (?1, ?2, ?3)",
                params!["session-1", "Session", "hermes/latest"],
            )
            .expect("insert session");

        let response_payload = json!({
            "id": "resp-model-1",
            "output": [
                {
                    "type": "message",
                    "role": "assistant",
                    "content": [
                        {
                            "type": "output_text",
                            "text": "assistant reply"
                        }
                    ]
                }
            ]
        });
        persist_hermes_run_messages(
            &connection,
            "session-1",
            "resp-model-1",
            "user prompt",
            &response_payload,
        )
        .expect("persist hermes run messages");

        let mut statement = connection
            .prepare(
                "SELECT role, model FROM messages WHERE session_id = ?1 ORDER BY id ASC",
            )
            .expect("prepare model query");
        let rows = statement
            .query_map(params!["session-1"], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
            })
            .expect("query rows")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("collect rows");

        assert_eq!(
            rows,
            vec![
                ("user".to_string(), Some("hermes/latest".to_string())),
                ("assistant".to_string(), Some("hermes/latest".to_string())),
            ]
        );
    }

    #[test]
    fn managed_hermes_run_start_falls_back_to_persisted_session_model_for_requests_and_runs() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let response_payload = json!({
            "id": "resp-fallback-1",
            "output": [
                {
                    "type": "message",
                    "role": "assistant",
                    "content": [
                        {
                            "type": "output_text",
                            "text": "assistant reply"
                        }
                    ]
                }
            ]
        });
        let (base_url, captured_request_body, server_handle) =
            spawn_single_response_server(response_payload.clone());
        let instance = create_managed_hermes_instance(&base_url);
        let connection = Connection::open(hermes_state_db_path(&paths)).expect("open state db");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (session_id, instance_id, title, agent_id, model) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    "session-fallback",
                    instance.id.as_str(),
                    "Fallback Session",
                    "research",
                    "hermes/persisted"
                ],
            )
            .expect("insert fallback session");
        drop(connection);

        let run = start_kernel_chat_run_for_managed_hermes(
            &paths,
            &instance,
            StudioStartKernelChatRunInput {
                instance_id: instance.id.clone(),
                session_id: "session-fallback".to_string(),
                content: "user prompt".to_string(),
                model: None,
            },
        )
        .expect("start managed hermes run");
        server_handle.join().expect("join single response server");

        let captured_request_body = captured_request_body
            .lock()
            .expect("lock captured request body")
            .clone()
            .expect("captured request body");
        assert_eq!(
            captured_request_body.get("model").and_then(serde_json::Value::as_str),
            Some("hermes/persisted")
        );
        assert_eq!(run.id, "resp-fallback-1");

        let connection = Connection::open(hermes_state_db_path(&paths)).expect("re-open state db");
        let persisted_run_model = connection
            .query_row(
                "SELECT model FROM runs WHERE run_id = ?1",
                params!["resp-fallback-1"],
                |row| row.get::<_, Option<String>>(0),
            )
            .expect("query persisted run model");
        assert_eq!(persisted_run_model.as_deref(), Some("hermes/persisted"));
    }

    #[test]
    fn hermes_state_db_initialization_includes_authoritative_run_storage() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (session_id, title) VALUES (?1, ?2)",
                params!["session-1", "Session"],
            )
            .expect("insert session");

        connection
            .execute(
                "INSERT INTO runs (run_id, session_id, status, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5)",
                params!["run-1", "session-1", "completed", 1000_i64, 1200_i64],
            )
            .expect("insert run row");

        let count = connection
            .query_row("SELECT COUNT(*) FROM runs", [], |row| row.get::<_, i64>(0))
            .expect("count runs");

        assert_eq!(count, 1);
    }

    #[test]
    fn hermes_session_projection_exposes_last_run_status_metadata() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (session_id, title, last_run_id) VALUES (?1, ?2, ?3)",
                params!["session-1", "Session", "run-1"],
            )
            .expect("insert session");
        connection
            .execute(
                "INSERT INTO runs (run_id, session_id, status, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5)",
                params!["run-1", "session-1", "completed", 1000_i64, 1200_i64],
            )
            .expect("insert run row");

        let row = query_hermes_session_row(&connection, "session-1")
            .expect("query session row")
            .expect("session row exists");
        let session = build_kernel_chat_session("instance-hermes", row);

        assert_eq!(
            session.native_metadata,
            Some(json!({
                "authorityFile": "state.db",
                "runtimeKind": "hermes",
                "lastRunId": "run-1",
                "lastRunStatus": "completed",
                "lastRunUpdatedAt": 1200_u64,
            })),
        );
    }

    #[test]
    fn hermes_run_projection_lists_authoritative_runs_newest_first() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (session_id, title) VALUES (?1, ?2)",
                params!["session-1", "Session"],
            )
            .expect("insert session");
        connection
            .execute(
                "INSERT INTO runs (run_id, session_id, agent_id, model, status, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "run-older",
                    "session-1",
                    "planner",
                    "hermes/planner",
                    "queued",
                    1000_i64,
                    2000_i64
                ],
            )
            .expect("insert older run");
        connection
            .execute(
                "INSERT INTO runs (run_id, session_id, agent_id, model, status, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "run-latest",
                    "session-1",
                    "researcher",
                    "hermes/researcher",
                    "completed",
                    1500_i64,
                    3000_i64
                ],
            )
            .expect("insert latest run");

        let runs = list_kernel_chat_runs_from_connection(&connection, "instance-hermes", "session-1")
            .expect("list runs");

        assert_eq!(runs.len(), 2);
        assert_eq!(runs[0].id, "run-latest");
        assert_eq!(runs[0].session_ref.agent_id.as_deref(), Some("researcher"));
        assert_eq!(runs[0].status, "completed");
        assert_eq!(
            runs[0].native_metadata,
            Some(json!({
                "authorityFile": "state.db",
                "runtimeKind": "hermes",
                "agentId": "researcher",
                "model": "hermes/researcher",
                "persisted": true,
            })),
        );
        assert_eq!(runs[1].id, "run-older");
    }

    #[test]
    fn hermes_run_projection_resolves_runs_by_session_and_id() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        initialize_hermes_state_db(&connection).expect("initialize hermes schema");
        connection
            .execute(
                "INSERT INTO sessions (session_id, title) VALUES (?1, ?2)",
                params!["session-1", "Session"],
            )
            .expect("insert session");
        connection
            .execute(
                "INSERT INTO runs (run_id, session_id, agent_id, model, status, created_at_ms, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    "run-1",
                    "session-1",
                    "planner",
                    "hermes/planner",
                    "completed",
                    1000_i64,
                    1200_i64
                ],
            )
            .expect("insert run");

        let run = get_kernel_chat_run_from_connection(
            &connection,
            "instance-hermes",
            "session-1",
            "run-1",
        )
        .expect("get run")
        .expect("run exists");

        assert_eq!(run.id, "run-1");
        assert_eq!(run.session_ref.session_id, "session-1");
        assert_eq!(run.session_ref.agent_id.as_deref(), Some("planner"));
        assert_eq!(run.created_at, 1000);
        assert_eq!(run.updated_at, 1200);
        assert_eq!(run.abortable, false);
        assert_eq!(
            get_kernel_chat_run_from_connection(
                &connection,
                "instance-hermes",
                "session-1",
                "missing-run",
            )
            .expect("get missing run"),
            None,
        );
    }

    #[test]
    fn hermes_message_parts_extract_tool_calls_from_chat_completions_payloads() {
        let payload = json!({
            "id": "resp-2",
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "I need to inspect the config first.",
                        "tool_calls": [
                            {
                                "id": "call-1",
                                "type": "function",
                                "function": {
                                    "name": "fs.read",
                                    "arguments": "{\"path\":\"config.yaml\"}"
                                }
                            }
                        ]
                    }
                }
            ]
        });

        let parts = build_hermes_message_parts(payload.to_string().as_str());

        assert_eq!(
            parts,
            vec![
                KernelChatMessagePart::Text {
                    text: "I need to inspect the config first.".to_string(),
                },
                KernelChatMessagePart::ToolCall {
                    tool_name: "fs.read".to_string(),
                    tool_call_id: Some("call-1".to_string()),
                    arguments_text: Some("{\"path\":\"config.yaml\"}".to_string()),
                    detail: Some("{\"path\":\"config.yaml\"}".to_string()),
                },
            ],
        );
    }

    #[test]
    fn hermes_message_parts_extract_reasoning_and_tool_results_from_responses_payloads() {
        let payload = json!({
            "id": "resp-3",
            "output": [
                {
                    "type": "reasoning",
                    "summary": [
                        {
                            "type": "summary_text",
                            "text": "Need to inspect the kernel config before answering."
                        }
                    ]
                },
                {
                    "type": "function_call",
                    "call_id": "call-2",
                    "name": "fs.read",
                    "arguments": "{\"path\":\"kernel.json\"}"
                },
                {
                    "type": "function_call_output",
                    "call_id": "call-2",
                    "output": "kernel contents"
                },
                {
                    "type": "message",
                    "role": "assistant",
                    "content": [
                        {
                            "type": "output_text",
                            "text": "I found the kernel configuration."
                        }
                    ]
                }
            ]
        });

        let parts = build_hermes_message_parts(payload.to_string().as_str());

        assert_eq!(
            parts,
            vec![
                KernelChatMessagePart::Reasoning {
                    text: "Need to inspect the kernel config before answering.".to_string(),
                },
                KernelChatMessagePart::ToolCall {
                    tool_name: "fs.read".to_string(),
                    tool_call_id: Some("call-2".to_string()),
                    arguments_text: Some("{\"path\":\"kernel.json\"}".to_string()),
                    detail: Some("{\"path\":\"kernel.json\"}".to_string()),
                },
                KernelChatMessagePart::ToolResult {
                    tool_name: "fs.read".to_string(),
                    tool_call_id: Some("call-2".to_string()),
                    text: Some("kernel contents".to_string()),
                    is_error: Some(false),
                    preview: Some("kernel contents".to_string()),
                },
                KernelChatMessagePart::Text {
                    text: "I found the kernel configuration.".to_string(),
                },
            ],
        );
    }
}
