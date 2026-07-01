use super::{
    read_json5_object, read_openclaw_provider_runtime_config, StudioInstanceDeploymentMode,
    StudioInstanceRecord, StudioRuntimeKind, StudioWorkbenchAgentProfile,
    StudioWorkbenchAgentRecord, StudioWorkbenchChannelRecord, StudioWorkbenchCronTasksSnapshot,
    StudioWorkbenchFileRecord, StudioWorkbenchLLMProviderModelRecord,
    StudioWorkbenchLLMProviderRecord, StudioWorkbenchMemoryEntryRecord, StudioWorkbenchSkillRecord,
    StudioWorkbenchSnapshot, StudioWorkbenchTaskExecutionRecord, StudioWorkbenchTaskRecord,
    StudioWorkbenchTaskScheduleConfig, StudioWorkbenchToolRecord,
};
use crate::framework::{
    paths::{normalize_openclaw_agent_id, AppPaths, OPENCLAW_DEFAULT_AGENT_ID, OPENCLAW_KERNEL_ID},
    services::kernel_runtime_authority::KernelRuntimeAuthorityService,
    FrameworkError, Result,
};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const MAX_TEXT_FILE_BYTES: usize = 256 * 1024;
const MAX_SCAN_ENTRIES: usize = 200;

#[derive(Clone, Debug)]
struct OpenClawAgentContext {
    id: String,
    name: String,
    description: String,
    avatar: String,
    system_prompt: String,
    creator: String,
    workspace: PathBuf,
}

pub(super) fn build_openclaw_workbench_snapshot(
    paths: &AppPaths,
    instance: &StudioInstanceRecord,
) -> Result<Option<StudioWorkbenchSnapshot>> {
    if instance.runtime_kind != StudioRuntimeKind::Openclaw
        || instance.deployment_mode != StudioInstanceDeploymentMode::LocalManaged
    {
        return Ok(None);
    }

    let config_path = readable_openclaw_config_file_path(paths)?;
    let config = read_json5_object(&config_path)?;
    let channels = build_openclaw_channels(&config);
    let channel_name_map = channels
        .iter()
        .map(|channel| (channel.id.clone(), channel.name.clone()))
        .collect::<BTreeMap<_, _>>();
    let cron_tasks = build_openclaw_cron_tasks_snapshot(paths, &channel_name_map)?;
    let llm_providers = build_openclaw_llm_providers(&config, &config_path);
    let agent_contexts = collect_openclaw_agent_contexts(paths, &config)?;
    let agents = build_openclaw_agents(&agent_contexts);
    let skills = build_openclaw_skills(paths, &config, &agent_contexts)?;
    let files = build_openclaw_files(paths, &config, &agent_contexts)?;
    let memory = build_openclaw_memory_entries(paths, &config, &agent_contexts, &files)?;
    let tools = build_openclaw_tools(&config);

    Ok(Some(StudioWorkbenchSnapshot {
        channels,
        cron_tasks,
        llm_providers,
        agents,
        skills,
        files,
        memory,
        tools,
    }))
}

fn build_openclaw_channels(config: &Value) -> Vec<StudioWorkbenchChannelRecord> {
    let Some(channels) = object_at_path(config, &["channels"]) else {
        return Vec::new();
    };

    let mut records = channels
        .iter()
        .filter(|(id, value)| {
            !matches!(id.as_str(), "defaults" | "modelByChannel")
                && value.is_object()
                && !id.starts_with('_')
        })
        .map(|(id, value)| build_openclaw_channel(id, value))
        .collect::<Vec<_>>();

    records.sort_by(|left, right| left.name.cmp(&right.name));
    records
}

fn build_openclaw_cron_tasks_snapshot(
    paths: &AppPaths,
    channel_name_map: &BTreeMap<String, String>,
) -> Result<StudioWorkbenchCronTasksSnapshot> {
    let cron_jobs_path = paths
        .kernel_paths(OPENCLAW_KERNEL_ID)?
        .openclaw_cron_dir()?
        .join("jobs.json");
    let jobs_root = read_json_value(&cron_jobs_path)?;
    let jobs = array_at_path(&jobs_root, &["jobs"])
        .cloned()
        .unwrap_or_default();

    let mut tasks = Vec::new();
    let mut task_executions_by_id = BTreeMap::new();

    for job in jobs {
        let Some(job_id) = string_at_path(&job, &["id"]) else {
            continue;
        };
        let executions = read_openclaw_cron_run_entries(paths, &job_id)?;
        let task = map_openclaw_cron_task(&job, channel_name_map, executions.first().cloned());
        task_executions_by_id.insert(job_id, executions);
        tasks.push(task);
    }

    tasks.sort_by(|left, right| left.name.cmp(&right.name));

    Ok(StudioWorkbenchCronTasksSnapshot {
        tasks,
        task_executions_by_id,
    })
}

fn build_openclaw_llm_providers(
    config: &Value,
    config_path: &Path,
) -> Vec<StudioWorkbenchLLMProviderRecord> {
    let Some(providers) = object_at_path(config, &["models", "providers"]) else {
        return Vec::new();
    };

    let last_checked_at = file_timestamp_label(config_path)
        .or_else(|| string_at_path(config, &["meta", "lastTouchedAt"]))
        .unwrap_or_else(|| "Unknown".to_string());

    let mut records = providers
        .iter()
        .filter_map(|(provider_id, provider_value)| {
            let endpoint = string_at_path(provider_value, &["baseUrl"])?;
            let models = array_at_path(provider_value, &["models"])
                .cloned()
                .unwrap_or_default();
            let model_records = build_openclaw_provider_models(&models);
            let primary_ref = string_at_path(config, &["agents", "defaults", "model", "primary"])
                .and_then(|entry| parse_openclaw_model_ref(&entry));
            let fallback_refs =
                array_at_path(config, &["agents", "defaults", "model", "fallbacks"])
                    .cloned()
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|entry| entry.as_str().and_then(parse_openclaw_model_ref))
                    .collect::<Vec<_>>();
            let default_model_id = model_records
                .iter()
                .find_map(|model| {
                    primary_ref
                        .as_ref()
                        .filter(|(current_provider_id, _)| current_provider_id == provider_id)
                        .map(|(_, model_id)| model_id.clone())
                        .filter(|model_id| model_id == &model.id)
                })
                .or_else(|| {
                    model_records
                        .iter()
                        .find(|model| model.role == "primary")
                        .map(|model| model.id.clone())
                })
                .or_else(|| model_records.first().map(|model| model.id.clone()))
                .unwrap_or_default();
            let reasoning_model_id = model_records
                .iter()
                .find_map(|model| {
                    fallback_refs
                        .iter()
                        .find(|(current_provider_id, model_id)| {
                            current_provider_id == provider_id && model_id == &model.id
                        })
                        .map(|(_, model_id)| model_id.clone())
                })
                .or_else(|| {
                    model_records
                        .iter()
                        .find(|model| model.role == "reasoning")
                        .map(|model| model.id.clone())
                });
            let embedding_model_id = model_records
                .iter()
                .find(|model| model.role == "embedding")
                .map(|model| model.id.clone());
            let api_key_source = describe_secret_source(value_at_path(provider_value, &["apiKey"]));
            let provider_runtime_config =
                read_openclaw_provider_runtime_config(config, provider_id, &default_model_id);

            Some(StudioWorkbenchLLMProviderRecord {
                id: provider_id.to_string(),
                name: title_case_identifier(provider_id),
                provider: provider_id.to_string(),
                endpoint,
                api_key_source,
                status: if default_model_id.is_empty() {
                    "configurationRequired".to_string()
                } else {
                    "ready".to_string()
                },
                default_model_id,
                reasoning_model_id,
                embedding_model_id,
                description: format!(
                    "{} provider configured through the built-in OpenClaw runtime.",
                    title_case_identifier(provider_id)
                ),
                icon: provider_id
                    .chars()
                    .next()
                    .map(|ch| ch.to_ascii_uppercase().to_string())
                    .unwrap_or_else(|| "O".to_string()),
                last_checked_at: last_checked_at.clone(),
                capabilities: infer_provider_capabilities(&models),
                models: model_records,
                config: provider_runtime_config,
            })
        })
        .collect::<Vec<_>>();

    records.sort_by(|left, right| left.name.cmp(&right.name));
    records
}

fn parse_openclaw_model_ref(value: &str) -> Option<(String, String)> {
    let trimmed = value.trim();
    let (provider_id, model_id) = trimmed.split_once('/')?;
    let normalized_provider_id = provider_id.trim();
    let normalized_model_id = model_id.trim();
    if normalized_provider_id.is_empty() || normalized_model_id.is_empty() {
        return None;
    }

    Some((
        normalized_provider_id.to_string(),
        normalized_model_id.to_string(),
    ))
}

fn collect_openclaw_agent_contexts(
    paths: &AppPaths,
    config: &Value,
) -> Result<Vec<OpenClawAgentContext>> {
    let openclaw_paths = paths.kernel_paths(OPENCLAW_KERNEL_ID)?;
    let default_agent_id = resolve_default_openclaw_agent_id(config);
    let mut discovered_ids = BTreeSet::from([default_agent_id.clone()]);

    if let Some(agent_entries) = array_at_path(config, &["agents", "list"]) {
        for agent_entry in agent_entries {
            if let Some(agent_id) = string_at_path(agent_entry, &["id"]) {
                discovered_ids.insert(normalize_openclaw_agent_id(&agent_id));
            }
        }
    }

    let agents_dir = openclaw_paths.openclaw_agents_dir()?;
    if let Ok(entries) = fs::read_dir(&agents_dir) {
        for entry in entries.flatten().take(MAX_SCAN_ENTRIES) {
            if entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
                if let Some(id) = entry.file_name().to_str() {
                    discovered_ids.insert(normalize_openclaw_agent_id(id));
                }
            }
        }
    }

    let configured_by_id = array_at_path(config, &["agents", "list"])
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| {
            string_at_path(&entry, &["id"]).map(|id| (normalize_openclaw_agent_id(&id), entry))
        })
        .collect::<BTreeMap<_, _>>();

    let mut ordered_ids = discovered_ids.into_iter().collect::<Vec<_>>();
    ordered_ids.sort();
    if let Some(default_index) = ordered_ids.iter().position(|id| id == &default_agent_id) {
        ordered_ids.swap(0, default_index);
    }

    ordered_ids
        .into_iter()
        .map(|agent_id| {
            let config_entry = configured_by_id.get(&agent_id);
            let name = config_entry
                .and_then(|entry| string_at_path(entry, &["name"]))
                .unwrap_or_else(|| title_case_identifier(&agent_id));
            let avatar = config_entry
                .and_then(|entry| string_at_path(entry, &["identity", "emoji"]))
                .or_else(|| {
                    config_entry.and_then(|entry| string_at_path(entry, &["identity", "avatar"]))
                })
                .unwrap_or_else(|| "*".to_string());
            let workspace = resolve_openclaw_agent_workspace(paths, config_entry, &agent_id)?;
            let description = format!(
                "{} agent backed by workspace {}.",
                name,
                workspace.display()
            );
            let system_prompt = load_agent_prompt_summary(&workspace);

            Ok(OpenClawAgentContext {
                id: agent_id,
                name,
                description,
                avatar,
                system_prompt,
                creator: if workspace == openclaw_paths.workspace_dir {
                    "Claw Studio".to_string()
                } else {
                    "OpenClaw".to_string()
                },
                workspace,
            })
        })
        .collect()
}

fn build_openclaw_agents(
    agent_contexts: &[OpenClawAgentContext],
) -> Vec<StudioWorkbenchAgentRecord> {
    agent_contexts
        .iter()
        .map(|context| StudioWorkbenchAgentRecord {
            agent: StudioWorkbenchAgentProfile {
                id: context.id.clone(),
                name: context.name.clone(),
                description: context.description.clone(),
                avatar: context.avatar.clone(),
                system_prompt: context.system_prompt.clone(),
                creator: context.creator.clone(),
            },
            focus_areas: derive_focus_areas(
                &context.name,
                &context.description,
                &context.system_prompt,
            ),
            automation_fit_score: 72,
        })
        .collect()
}

fn build_openclaw_skills(
    paths: &AppPaths,
    config: &Value,
    agent_contexts: &[OpenClawAgentContext],
) -> Result<Vec<StudioWorkbenchSkillRecord>> {
    let runtime_package = paths
        .openclaw_runtime_dir
        .join("runtime")
        .join("package")
        .join("node_modules")
        .join("openclaw");
    let bundled_version = read_json_value(&runtime_package.join("package.json"))
        .ok()
        .and_then(|value| string_at_path(&value, &["version"]));
    let bundled_skill_allowlist = string_vec_at_path(config, &["skills", "allowBundled"])
        .into_iter()
        .map(|entry| entry.to_ascii_lowercase())
        .collect::<BTreeSet<_>>();
    let mut skills_by_id = BTreeMap::new();
    let openclaw_paths = paths.kernel_paths(OPENCLAW_KERNEL_ID)?;

    let mut roots = Vec::new();
    for raw_dir in string_vec_at_path(config, &["skills", "load", "extraDirs"]) {
        roots.push((
            resolve_openclaw_user_path(paths, &raw_dir)?,
            "Extra Skills".to_string(),
            None,
        ));
    }
    roots.extend(vec![
        (
            runtime_package.join("skills"),
            "Bundled OpenClaw".to_string(),
            bundled_version,
        ),
        (
            openclaw_paths.openclaw_skills_dir()?,
            "Built-in OpenClaw".to_string(),
            None,
        ),
    ]);
    roots.extend(agent_contexts.iter().map(|context| {
        (
            context.workspace.join("skills"),
            format!("{} Workspace", context.name),
            None,
        )
    }));

    for (root, author, version) in roots {
        if !root.exists() {
            continue;
        }
        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries.flatten().take(MAX_SCAN_ENTRIES) {
            if !entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
                continue;
            }
            let skill_file = entry.path().join("SKILL.md");
            if !skill_file.exists() {
                continue;
            }
            let Some(content) = read_text_preview(&skill_file) else {
                continue;
            };
            let skill_id = extract_frontmatter_value(&content, "name")
                .unwrap_or_else(|| entry.file_name().to_string_lossy().into_owned());
            let skill_slug = skill_id.to_ascii_lowercase();
            let directory_slug = entry.file_name().to_string_lossy().to_ascii_lowercase();
            if author == "Bundled OpenClaw"
                && !bundled_skill_allowlist.is_empty()
                && !bundled_skill_allowlist.contains(&skill_slug)
                && !bundled_skill_allowlist.contains(&directory_slug)
            {
                continue;
            }
            let description = extract_frontmatter_value(&content, "description")
                .unwrap_or_else(|| summarize_markdown(&content, 220));
            let metadata = fs::metadata(&skill_file).ok();

            skills_by_id.insert(
                skill_slug,
                StudioWorkbenchSkillRecord {
                    id: skill_id.clone(),
                    name: skill_id.clone(),
                    description,
                    author: author.clone(),
                    rating: 5.0,
                    downloads: 1,
                    category: infer_skill_category(&skill_id, &content),
                    icon: None,
                    version: version.clone(),
                    size: metadata.as_ref().map(|meta| format_size(meta.len())),
                    updated_at: metadata
                        .and_then(|meta| meta.modified().ok())
                        .and_then(system_time_label),
                    readme: Some(content),
                },
            );
        }
    }

    Ok(skills_by_id.into_values().collect())
}

fn build_openclaw_files(
    paths: &AppPaths,
    _config: &Value,
    agent_contexts: &[OpenClawAgentContext],
) -> Result<Vec<StudioWorkbenchFileRecord>> {
    let openclaw_paths = paths.kernel_paths(OPENCLAW_KERNEL_ID)?;
    let cron_dir = openclaw_paths.openclaw_cron_dir()?;
    let mut writable_roots = BTreeSet::from([openclaw_paths.workspace_dir.clone()]);
    writable_roots.extend(
        agent_contexts
            .iter()
            .map(|context| context.workspace.clone()),
    );
    let mut files = Vec::new();
    let authority_config_path = authority_openclaw_config_file_path(paths)?;
    push_file_record(
        &writable_roots,
        &authority_config_path,
        &mut files,
        &authority_config_path,
        "config",
        "synced",
        "OpenClaw configuration file.",
    );
    push_file_record(
        &writable_roots,
        &authority_config_path,
        &mut files,
        &paths.logs_dir.join("openclaw-gateway.log"),
        "log",
        "generated",
        "Bundled gateway log emitted by the managed runtime.",
    );
    push_file_record(
        &writable_roots,
        &authority_config_path,
        &mut files,
        &cron_dir.join("jobs.json"),
        "dataset",
        "generated",
        "OpenClaw cron job store for the managed runtime.",
    );
    push_file_record(
        &writable_roots,
        &authority_config_path,
        &mut files,
        &paths
            .openclaw_runtime_dir
            .join("runtime")
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("package.json"),
        "artifact",
        "generated",
        "Bundled OpenClaw package manifest.",
    );

    let run_logs_dir = cron_dir.join("runs");
    if let Ok(entries) = fs::read_dir(&run_logs_dir) {
        for entry in entries.flatten().take(MAX_SCAN_ENTRIES) {
            let path = entry.path();
            if path.extension().and_then(OsStr::to_str) == Some("jsonl") {
                push_file_record(
                    &writable_roots,
                    &authority_config_path,
                    &mut files,
                    &path,
                    "dataset",
                    "generated",
                    "Cron run log for an OpenClaw task.",
                );
            }
        }
    }

    for context in agent_contexts {
        for file_name in [
            "AGENTS.md",
            "SOUL.md",
            "TOOLS.md",
            "IDENTITY.md",
            "USER.md",
            "HEARTBEAT.md",
            "BOOT.md",
            "BOOTSTRAP.md",
            "MEMORY.md",
            "memory.md",
        ] {
            let category = if file_name.eq_ignore_ascii_case("MEMORY.md") {
                "memory"
            } else {
                "prompt"
            };
            let description = format!("{} bootstrap file for {}.", file_name, context.name);
            push_file_record(
                &writable_roots,
                &authority_config_path,
                &mut files,
                &context.workspace.join(file_name),
                category,
                "synced",
                &description,
            );
        }
    }

    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

fn build_openclaw_memory_entries(
    paths: &AppPaths,
    config: &Value,
    agent_contexts: &[OpenClawAgentContext],
    files: &[StudioWorkbenchFileRecord],
) -> Result<Vec<StudioWorkbenchMemoryEntryRecord>> {
    let openclaw_workspace_dir = paths.kernel_paths(OPENCLAW_KERNEL_ID)?.workspace_dir;
    let mut entries = vec![StudioWorkbenchMemoryEntryRecord {
        id: "memory-backend".to_string(),
        title: "Memory Backend".to_string(),
        r#type: "fact".to_string(),
        summary: format!(
            "Backend={}, citations={}.",
            string_at_path(config, &["memory", "backend"]).unwrap_or_else(|| "builtin".to_string()),
            string_at_path(config, &["memory", "citations"]).unwrap_or_else(|| "auto".to_string())
        ),
        source: "system".to_string(),
        updated_at: string_at_path(config, &["meta", "lastTouchedAt"])
            .unwrap_or_else(|| "Unknown".to_string()),
        retention: "rolling".to_string(),
        tokens: 32,
    }];

    for context in agent_contexts {
        for file_name in ["MEMORY.md", "memory.md"] {
            let path = context.workspace.join(file_name);
            if !path.exists() {
                continue;
            }
            let Some(content) = read_text_preview(&path) else {
                continue;
            };
            entries.push(StudioWorkbenchMemoryEntryRecord {
                id: format!("memory-{}-{}", context.id, file_name.to_ascii_lowercase()),
                title: format!("{} Memory", context.name),
                r#type: "conversation".to_string(),
                summary: summarize_markdown(&content, 220),
                source: if context.workspace == openclaw_workspace_dir {
                    "system".to_string()
                } else {
                    "agent".to_string()
                },
                updated_at: file_timestamp_label(&path).unwrap_or_else(|| "Unknown".to_string()),
                retention: "pinned".to_string(),
                tokens: token_estimate(&content),
            });
        }
    }

    for path_entry in array_at_path(config, &["memory", "qmd", "paths"])
        .cloned()
        .unwrap_or_default()
    {
        if let Some(path) = string_at_path(&path_entry, &["path"]) {
            let title = string_at_path(&path_entry, &["name"]).unwrap_or_else(|| path.clone());
            entries.push(StudioWorkbenchMemoryEntryRecord {
                id: format!("qmd-{}", title.to_ascii_lowercase()),
                title,
                r#type: "artifact".to_string(),
                summary: format!(
                    "QMD index path {}{}",
                    path,
                    string_at_path(&path_entry, &["pattern"])
                        .map(|pattern| format!(" (pattern: {pattern})"))
                        .unwrap_or_default()
                ),
                source: "system".to_string(),
                updated_at: "Configured".to_string(),
                retention: "rolling".to_string(),
                tokens: 16,
            });
        }
    }

    if entries.len() == 1 {
        for file in files {
            if file.category == "memory" && !file.content.trim().is_empty() {
                entries.push(StudioWorkbenchMemoryEntryRecord {
                    id: format!("file-{}", file.id),
                    title: file.name.clone(),
                    r#type: "artifact".to_string(),
                    summary: summarize_markdown(&file.content, 220),
                    source: "system".to_string(),
                    updated_at: file.updated_at.clone(),
                    retention: "pinned".to_string(),
                    tokens: token_estimate(&file.content),
                });
            }
        }
    }

    Ok(entries)
}

fn build_openclaw_tools(_config: &Value) -> Vec<StudioWorkbenchToolRecord> {
    const TOOLS: [(&str, &str, &str, &str, &str, &str, bool, &str, bool); 29] = [
        (
            "read",
            "read",
            "Read file contents",
            "filesystem",
            "read",
            "tool:read",
            false,
            "fs",
            false,
        ),
        (
            "write",
            "write",
            "Create or overwrite files",
            "filesystem",
            "write",
            "tool:write",
            false,
            "fs",
            false,
        ),
        (
            "edit",
            "edit",
            "Make precise edits",
            "filesystem",
            "write",
            "tool:edit",
            false,
            "fs",
            false,
        ),
        (
            "apply_patch",
            "apply_patch",
            "Patch files",
            "filesystem",
            "write",
            "tool:apply_patch",
            false,
            "fs",
            false,
        ),
        (
            "exec",
            "exec",
            "Run shell commands",
            "observability",
            "execute",
            "tool:exec",
            false,
            "runtime",
            false,
        ),
        (
            "process",
            "process",
            "Manage background processes",
            "observability",
            "execute",
            "tool:process",
            false,
            "runtime",
            false,
        ),
        (
            "web_search",
            "web_search",
            "Search the web",
            "reasoning",
            "read",
            "tool:web_search",
            false,
            "web",
            true,
        ),
        (
            "web_fetch",
            "web_fetch",
            "Fetch web content",
            "reasoning",
            "read",
            "tool:web_fetch",
            false,
            "web",
            true,
        ),
        (
            "memory_search",
            "memory_search",
            "Semantic memory search",
            "reasoning",
            "read",
            "tool:memory_search",
            false,
            "memory",
            true,
        ),
        (
            "memory_get",
            "memory_get",
            "Read memory files",
            "reasoning",
            "read",
            "tool:memory_get",
            false,
            "memory",
            true,
        ),
        (
            "sessions_list",
            "sessions_list",
            "List sessions",
            "reasoning",
            "read",
            "tool:sessions_list",
            false,
            "sessions",
            true,
        ),
        (
            "sessions_history",
            "sessions_history",
            "Read session history",
            "reasoning",
            "read",
            "tool:sessions_history",
            false,
            "sessions",
            true,
        ),
        (
            "sessions_send",
            "sessions_send",
            "Send to session",
            "reasoning",
            "execute",
            "tool:sessions_send",
            false,
            "sessions",
            true,
        ),
        (
            "sessions_spawn",
            "sessions_spawn",
            "Spawn sub-agent sessions",
            "reasoning",
            "execute",
            "tool:sessions_spawn",
            false,
            "sessions",
            true,
        ),
        (
            "sessions_yield",
            "sessions_yield",
            "Yield for sub-agent results",
            "reasoning",
            "execute",
            "tool:sessions_yield",
            false,
            "sessions",
            true,
        ),
        (
            "subagents",
            "subagents",
            "Manage sub-agents",
            "reasoning",
            "execute",
            "tool:subagents",
            false,
            "sessions",
            true,
        ),
        (
            "session_status",
            "session_status",
            "Inspect session status",
            "reasoning",
            "read",
            "tool:session_status",
            false,
            "sessions",
            true,
        ),
        (
            "browser",
            "browser",
            "Control a browser surface",
            "integration",
            "execute",
            "tool:browser",
            true,
            "ui",
            true,
        ),
        (
            "canvas",
            "canvas",
            "Control canvas surfaces",
            "integration",
            "write",
            "tool:canvas",
            true,
            "ui",
            true,
        ),
        (
            "message",
            "message",
            "Send channel messages",
            "integration",
            "write",
            "tool:message",
            false,
            "messaging",
            true,
        ),
        (
            "cron",
            "cron",
            "Schedule tasks",
            "automation",
            "execute",
            "tool:cron",
            false,
            "automation",
            true,
        ),
        (
            "gateway",
            "gateway",
            "Control the gateway",
            "automation",
            "execute",
            "tool:gateway",
            true,
            "automation",
            true,
        ),
        (
            "agents_list",
            "agents_list",
            "List agents",
            "reasoning",
            "read",
            "tool:agents_list",
            false,
            "agents",
            true,
        ),
        (
            "nodes",
            "nodes",
            "Inspect nodes and devices",
            "integration",
            "read",
            "tool:nodes",
            true,
            "nodes",
            true,
        ),
        (
            "image",
            "image",
            "Understand image inputs",
            "integration",
            "read",
            "tool:image",
            true,
            "media",
            true,
        ),
        (
            "image_generate",
            "image_generate",
            "Generate images",
            "integration",
            "execute",
            "tool:image_generate",
            true,
            "media",
            true,
        ),
        (
            "video_generate",
            "video_generate",
            "Generate videos",
            "integration",
            "execute",
            "tool:video_generate",
            true,
            "media",
            true,
        ),
        (
            "music_generate",
            "music_generate",
            "Generate music",
            "integration",
            "execute",
            "tool:music_generate",
            true,
            "media",
            true,
        ),
        (
            "tts",
            "tts",
            "Convert text to speech",
            "integration",
            "execute",
            "tool:tts",
            true,
            "media",
            true,
        ),
    ];

    let profile = string_at_path(_config, &["tools", "profile"]);
    let allow = string_vec_at_path(_config, &["tools", "allow"]);
    let also_allow = string_vec_at_path(_config, &["tools", "alsoAllow"]);
    let deny = string_vec_at_path(_config, &["tools", "deny"]);
    let policy_active = profile.is_some() || !allow.is_empty() || !also_allow.is_empty();

    TOOLS
        .into_iter()
        .map(
            |(id, name, description, category, access, command, beta, section, in_openclaw)| {
                let denied = deny
                    .iter()
                    .any(|token| tool_token_matches(id, section, in_openclaw, token));
                let allowed_by_profile = profile
                    .as_deref()
                    .map(|value| tool_allowed_by_profile(value, id))
                    .unwrap_or(false);
                let allowed_by_override = allow
                    .iter()
                    .chain(also_allow.iter())
                    .any(|token| tool_token_matches(id, section, in_openclaw, token));
                let status = if denied {
                    "restricted"
                } else if policy_active && !(allowed_by_profile || allowed_by_override) {
                    "restricted"
                } else if beta {
                    "beta"
                } else {
                    "ready"
                };

                StudioWorkbenchToolRecord {
                    id: id.to_string(),
                    name: name.to_string(),
                    description: description.to_string(),
                    category: category.to_string(),
                    status: status.to_string(),
                    access: access.to_string(),
                    command: command.to_string(),
                    last_used_at: None,
                }
            },
        )
        .collect()
}

fn build_openclaw_channel(id: &str, value: &Value) -> StudioWorkbenchChannelRecord {
    let channel_object = value.as_object();
    let enabled = bool_at_path(value, &["enabled"]).unwrap_or(false);
    let accounts_count = object_at_path(value, &["accounts"])
        .map(|accounts| accounts.len() as u32)
        .unwrap_or(0);
    let default_account = string_at_path(value, &["defaultAccount"]);
    let (field_count, configured_field_count) = count_channel_fields(channel_object);
    let configured = configured_field_count > 0 || accounts_count > 0;
    let status = if !configured {
        "not_configured"
    } else if enabled {
        "connected"
    } else {
        "disconnected"
    };

    let mut setup_steps = vec![format!(
        "Configure credentials or connection details for {}.",
        title_case_identifier(id)
    )];
    if accounts_count > 0 {
        setup_steps.push(format!(
            "{} account(s) discovered for this channel.",
            accounts_count
        ));
    } else {
        setup_steps.push("Add at least one account or destination target.".to_string());
    }
    if let Some(default_account) = default_account {
        setup_steps.push(format!("Default account: {}.", default_account));
    }
    if enabled {
        setup_steps.push("Channel is enabled for runtime delivery.".to_string());
    } else {
        setup_steps.push("Enable the channel after configuration validation.".to_string());
    }

    StudioWorkbenchChannelRecord {
        id: id.to_string(),
        name: title_case_identifier(id),
        description: format!(
            "{} integration configured through the built-in OpenClaw config file.",
            title_case_identifier(id)
        ),
        status: status.to_string(),
        enabled,
        field_count: field_count.max(accounts_count),
        configured_field_count,
        setup_steps,
    }
}

pub(super) fn read_openclaw_cron_run_entries(
    paths: &AppPaths,
    job_id: &str,
) -> Result<Vec<StudioWorkbenchTaskExecutionRecord>> {
    let run_log_path = paths
        .kernel_paths(OPENCLAW_KERNEL_ID)?
        .openclaw_cron_dir()?
        .join("runs")
        .join(format!("{job_id}.jsonl"));
    if !run_log_path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&run_log_path)?;
    let mut executions = Vec::new();

    for (index, line) in raw.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parsed = serde_json::from_str::<Value>(trimmed).map_err(|error| {
            FrameworkError::ValidationFailed(format!(
                "invalid cron run log entry {} in {}: {}",
                index + 1,
                run_log_path.display(),
                error
            ))
        })?;

        if string_at_path(&parsed, &["action"]).as_deref() != Some("finished") {
            continue;
        }

        let status = match string_at_path(&parsed, &["status"]).as_deref() {
            Some("ok") => "success",
            Some("error") | Some("skipped") => "failed",
            _ => "running",
        };
        let finished_at_ms = u64_at_path(&parsed, &["ts"]);
        let started_at_ms = u64_at_path(&parsed, &["runAtMs"]).or(finished_at_ms);
        let finished_at = finished_at_ms.map(format_timestamp_ms);
        let started_at = started_at_ms
            .map(format_timestamp_ms)
            .unwrap_or_else(|| "Unknown".to_string());
        let summary = string_at_path(&parsed, &["summary"])
            .or_else(|| string_at_path(&parsed, &["error"]))
            .unwrap_or_else(|| "OpenClaw cron run recorded without a summary.".to_string());
        let details = build_cron_execution_details(&parsed);

        executions.push(StudioWorkbenchTaskExecutionRecord {
            id: format!("{}-run-{}", job_id, executions.len() + 1),
            task_id: job_id.to_string(),
            status: status.to_string(),
            trigger: "schedule".to_string(),
            started_at,
            finished_at,
            summary,
            details,
        });
    }

    executions.sort_by(|left, right| right.started_at.cmp(&left.started_at));
    Ok(executions)
}

fn map_openclaw_cron_task(
    job: &Value,
    channel_name_map: &BTreeMap<String, String>,
    latest_execution: Option<StudioWorkbenchTaskExecutionRecord>,
) -> StudioWorkbenchTaskRecord {
    let job_id = string_at_path(job, &["id"]).unwrap_or_else(|| "unknown-task".to_string());
    let name = string_at_path(job, &["name"]).unwrap_or_else(|| title_case_identifier(&job_id));
    let description = string_at_path(job, &["description"]);
    let prompt = string_at_path(job, &["payload", "message"])
        .or_else(|| string_at_path(job, &["payload", "text"]))
        .unwrap_or_else(|| "No prompt content configured.".to_string());
    let (schedule, schedule_mode, schedule_config, cron_expression) = derive_openclaw_schedule(job);
    let delivery_channel = string_at_path(job, &["delivery", "channel"]);
    let delivery_label = delivery_channel
        .as_ref()
        .and_then(|channel_id| channel_name_map.get(channel_id))
        .cloned()
        .or_else(|| {
            delivery_channel
                .clone()
                .map(|id| title_case_identifier(&id))
        });
    let last_run = u64_at_path(job, &["state", "lastRunAtMs"])
        .map(format_timestamp_ms)
        .or_else(|| {
            latest_execution
                .as_ref()
                .map(|execution| execution.started_at.clone())
        });
    let next_run = u64_at_path(job, &["state", "nextRunAtMs"]).map(format_timestamp_ms);
    let enabled = bool_at_path(job, &["enabled"]).unwrap_or(true);
    let last_run_status = string_at_path(job, &["state", "lastRunStatus"])
        .or_else(|| string_at_path(job, &["state", "lastStatus"]));
    let session_target = string_at_path(job, &["sessionTarget"]);
    let (session_mode, custom_session_id) = match session_target.as_deref() {
        Some("main") => ("main".to_string(), None),
        Some("current") => ("current".to_string(), None),
        Some(value) if value.starts_with("session:") => (
            "custom".to_string(),
            Some(value.trim_start_matches("session:").to_string()),
        ),
        _ => ("isolated".to_string(), None),
    };
    let wake_up_mode = match string_at_path(job, &["wakeMode"]).as_deref() {
        Some("next-heartbeat") => "nextCycle".to_string(),
        _ => "immediate".to_string(),
    };
    let timeout_seconds = match job
        .pointer("/payload/timeoutSeconds")
        .and_then(Value::as_u64)
    {
        Some(value) => Some(value),
        None => job
            .pointer("/payload/timeoutSeconds")
            .and_then(Value::as_i64)
            .and_then(|value| u64::try_from(value).ok()),
    };
    let schedule_kind = string_at_path(job, &["schedule", "kind"]);
    let raw_delivery_mode = string_at_path(job, &["delivery", "mode"]);
    let delivery_mode = match raw_delivery_mode.as_deref() {
        Some("none") => "none".to_string(),
        Some("webhook") => "webhook".to_string(),
        Some("announce") => "publishSummary".to_string(),
        None if session_target.as_deref() == Some("main") => "none".to_string(),
        _ => "publishSummary".to_string(),
    };
    let delete_after_run = match bool_at_path(job, &["deleteAfterRun"]) {
        Some(value) => Some(value),
        None if schedule_kind.as_deref() == Some("at") => Some(true),
        None => None,
    };

    StudioWorkbenchTaskRecord {
        id: job_id,
        name,
        description,
        prompt,
        schedule,
        schedule_mode,
        schedule_config,
        cron_expression,
        action_type: if string_at_path(job, &["payload", "kind"]).as_deref() == Some("systemEvent")
        {
            "message".to_string()
        } else {
            "skill".to_string()
        },
        status: map_openclaw_cron_task_status(enabled, last_run_status.as_deref()).to_string(),
        session_mode,
        wake_up_mode,
        execution_content: if string_at_path(job, &["payload", "kind"]).as_deref()
            == Some("systemEvent")
        {
            "sendPromptMessage".to_string()
        } else {
            "runAssistantTask".to_string()
        },
        timeout_seconds,
        delete_after_run,
        agent_id: string_at_path(job, &["agentId"]),
        model: string_at_path(job, &["payload", "model"]),
        thinking: string_at_path(job, &["payload", "thinking"]),
        light_context: bool_at_path(job, &["payload", "lightContext"]),
        delivery_mode,
        delivery_best_effort: bool_at_path(job, &["delivery", "bestEffort"]),
        delivery_channel,
        delivery_label,
        recipient: string_at_path(job, &["delivery", "to"]),
        last_run,
        next_run,
        latest_execution,
        raw_definition: job.as_object().map(|_| job.clone()),
        custom_session_id,
    }
}

fn derive_openclaw_schedule(
    job: &Value,
) -> (
    String,
    String,
    StudioWorkbenchTaskScheduleConfig,
    Option<String>,
) {
    let schedule = value_at_path(job, &["schedule"]).unwrap_or(&Value::Null);

    match string_at_path(schedule, &["kind"]).as_deref() {
        Some("every") => {
            let every_ms = u64_at_path(schedule, &["everyMs"]).unwrap_or(60_000);
            let (interval_value, interval_unit, label) = normalize_interval_from_ms(every_ms);
            (
                label,
                "interval".to_string(),
                StudioWorkbenchTaskScheduleConfig {
                    interval_value: Some(interval_value),
                    interval_unit: Some(interval_unit),
                    scheduled_date: None,
                    scheduled_time: None,
                    cron_expression: None,
                    cron_timezone: None,
                    stagger_ms: None,
                },
                None,
            )
        }
        Some("at") => {
            let at = string_at_path(schedule, &["at"]).unwrap_or_else(|| "Unknown".to_string());
            let (scheduled_date, scheduled_time) = split_schedule_datetime(&at);
            (
                at.clone(),
                "datetime".to_string(),
                StudioWorkbenchTaskScheduleConfig {
                    interval_value: None,
                    interval_unit: None,
                    scheduled_date,
                    scheduled_time,
                    cron_expression: None,
                    cron_timezone: None,
                    stagger_ms: None,
                },
                None,
            )
        }
        Some("cron") => {
            let expr =
                string_at_path(schedule, &["expr"]).unwrap_or_else(|| "* * * * *".to_string());
            (
                expr.clone(),
                "cron".to_string(),
                StudioWorkbenchTaskScheduleConfig {
                    interval_value: None,
                    interval_unit: None,
                    scheduled_date: None,
                    scheduled_time: None,
                    cron_expression: Some(expr.clone()),
                    cron_timezone: string_at_path(schedule, &["tz"]),
                    stagger_ms: u64_at_path(schedule, &["staggerMs"]),
                },
                Some(expr),
            )
        }
        _ => (
            "Unknown".to_string(),
            "cron".to_string(),
            StudioWorkbenchTaskScheduleConfig {
                interval_value: None,
                interval_unit: None,
                scheduled_date: None,
                scheduled_time: None,
                cron_expression: None,
                cron_timezone: None,
                stagger_ms: None,
            },
            None,
        ),
    }
}

fn build_cron_execution_details(value: &Value) -> Option<String> {
    let mut details = Vec::new();
    if let Some(model) = string_at_path(value, &["model"]) {
        details.push(format!("model={model}"));
    }
    if let Some(provider) = string_at_path(value, &["provider"]) {
        details.push(format!("provider={provider}"));
    }
    if let Some(error) = string_at_path(value, &["error"]) {
        details.push(error);
    }
    if let Some(delivery_status) = string_at_path(value, &["deliveryStatus"]) {
        details.push(format!("delivery={delivery_status}"));
    }
    if details.is_empty() {
        None
    } else {
        Some(details.join(" | "))
    }
}

fn map_openclaw_cron_task_status(enabled: bool, last_run_status: Option<&str>) -> &'static str {
    if !enabled {
        "paused"
    } else if matches!(last_run_status, Some("error")) {
        "failed"
    } else {
        "active"
    }
}

fn count_channel_fields(channel_object: Option<&Map<String, Value>>) -> (u32, u32) {
    let Some(channel_object) = channel_object else {
        return (0, 0);
    };

    let mut field_count = 0_u32;
    let mut configured_field_count = 0_u32;

    for (key, value) in channel_object {
        if matches!(
            key.as_str(),
            "enabled"
                | "defaultAccount"
                | "accounts"
                | "healthMonitor"
                | "allowFrom"
                | "dmPolicy"
                | "groupPolicy"
        ) {
            continue;
        }
        field_count += 1;
        if is_configured_value(value) {
            configured_field_count += 1;
        }
    }

    if let Some(accounts) = channel_object.get("accounts").and_then(Value::as_object) {
        field_count = field_count.saturating_add(accounts.len() as u32);
        configured_field_count = configured_field_count.saturating_add(accounts.len() as u32);
    }

    (field_count.max(1), configured_field_count)
}

fn normalize_interval_from_ms(every_ms: u64) -> (u32, String, String) {
    let day_ms = 24 * 60 * 60 * 1000;
    let hour_ms = 60 * 60 * 1000;
    let minute_ms = 60 * 1000;

    if every_ms >= day_ms && every_ms % day_ms == 0 {
        let value = u32::try_from(every_ms / day_ms).unwrap_or(1);
        return (value, "day".to_string(), format!("Every {} day(s)", value));
    }
    if every_ms >= hour_ms && every_ms % hour_ms == 0 {
        let value = u32::try_from(every_ms / hour_ms).unwrap_or(1);
        return (
            value,
            "hour".to_string(),
            format!("Every {} hour(s)", value),
        );
    }

    let value = u32::try_from((every_ms / minute_ms).max(1)).unwrap_or(1);
    (
        value,
        "minute".to_string(),
        format!("Every {} minute(s)", value),
    )
}

fn build_openclaw_provider_models(models: &[Value]) -> Vec<StudioWorkbenchLLMProviderModelRecord> {
    let mut records = Vec::new();
    let mut reasoning_taken = false;
    let mut embedding_taken = false;

    for (index, model) in models.iter().enumerate() {
        let id = string_at_path(model, &["id"]).unwrap_or_else(|| format!("model-{}", index + 1));
        let name = string_at_path(model, &["name"]).unwrap_or_else(|| id.clone());
        let is_reasoning = bool_at_path(model, &["reasoning"]).unwrap_or(false);
        let is_embedding = id.to_ascii_lowercase().contains("embed")
            || name.to_ascii_lowercase().contains("embed")
            || string_at_path(model, &["api"])
                .map(|api| api.to_ascii_lowercase().contains("embedding"))
                .unwrap_or(false);
        let role = if is_embedding && !embedding_taken {
            embedding_taken = true;
            "embedding"
        } else if is_reasoning && !reasoning_taken {
            reasoning_taken = true;
            "reasoning"
        } else if index == 0 {
            "primary"
        } else {
            "fallback"
        };
        let context_window = u64_at_path(model, &["contextWindow"])
            .map(|value| format!("{} tokens", value))
            .unwrap_or_else(|| "Unknown".to_string());

        records.push(StudioWorkbenchLLMProviderModelRecord {
            id,
            name,
            role: role.to_string(),
            context_window,
        });
    }

    if let Some(first) = records.first_mut() {
        if first.role == "fallback" {
            first.role = "primary".to_string();
        }
    }

    records
}

fn infer_provider_capabilities(models: &[Value]) -> Vec<String> {
    let mut capabilities = BTreeSet::new();
    capabilities.insert("chat".to_string());

    for model in models {
        if bool_at_path(model, &["reasoning"]).unwrap_or(false) {
            capabilities.insert("reasoning".to_string());
        }
        if string_at_path(model, &["id"])
            .map(|id| id.to_ascii_lowercase().contains("embed"))
            .unwrap_or(false)
        {
            capabilities.insert("embedding".to_string());
        }
        if array_at_path(model, &["input"])
            .map(|values| values.iter().any(|value| value.as_str() == Some("image")))
            .unwrap_or(false)
        {
            capabilities.insert("vision".to_string());
        }
    }

    capabilities.into_iter().collect()
}

fn resolve_default_openclaw_agent_id(config: &Value) -> String {
    let agent_entries = array_at_path(config, &["agents", "list"])
        .cloned()
        .unwrap_or_default();

    if let Some(default_id) = agent_entries.iter().find_map(|entry| {
        if bool_at_path(entry, &["default"]).unwrap_or(false) {
            string_at_path(entry, &["id"])
        } else {
            None
        }
    }) {
        return normalize_openclaw_agent_id(&default_id);
    }

    agent_entries
        .first()
        .and_then(|entry| string_at_path(entry, &["id"]))
        .map(|id| normalize_openclaw_agent_id(&id))
        .unwrap_or_else(|| OPENCLAW_DEFAULT_AGENT_ID.to_string())
}

fn resolve_openclaw_agent_workspace(
    paths: &AppPaths,
    config_entry: Option<&Value>,
    agent_id: &str,
) -> Result<PathBuf> {
    let openclaw_paths = paths.kernel_paths(OPENCLAW_KERNEL_ID)?;
    if let Some(raw_workspace) =
        config_entry.and_then(|entry| string_at_path(entry, &["workspace"]))
    {
        return resolve_openclaw_user_path(paths, &raw_workspace);
    }

    openclaw_paths.openclaw_agent_workspace_dir(agent_id)
}

fn resolve_openclaw_user_path(paths: &AppPaths, raw: &str) -> Result<PathBuf> {
    let openclaw_paths = paths.kernel_paths(OPENCLAW_KERNEL_ID)?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(openclaw_paths.workspace_dir);
    }
    let candidate = PathBuf::from(trimmed);
    if candidate.is_absolute() {
        return Ok(candidate);
    }
    if let Some(stripped) = trimmed.strip_prefix("~/") {
        return Ok(paths.user_root.join(stripped));
    }
    Ok(openclaw_paths.state_dir.join(trimmed))
}

fn load_agent_prompt_summary(workspace: &Path) -> String {
    for file_name in ["AGENTS.md", "IDENTITY.md", "SOUL.md"] {
        let path = workspace.join(file_name);
        if let Some(content) = read_text_preview(&path) {
            let summary = summarize_markdown(&content, 420);
            if !summary.is_empty() {
                return summary;
            }
        }
    }

    "No workspace bootstrap prompt files were found for this agent.".to_string()
}

fn derive_focus_areas(name: &str, description: &str, system_prompt: &str) -> Vec<String> {
    let source = format!("{name} {description} {system_prompt}").to_ascii_lowercase();
    let mut focus_areas = Vec::new();

    for (needle, label) in [
        ("code", "Code"),
        ("debug", "Code"),
        ("tool", "Automation"),
        ("cron", "Automation"),
        ("memory", "Reasoning"),
        ("search", "Reasoning"),
        ("message", "Messaging"),
        ("channel", "Messaging"),
    ] {
        if source.contains(needle) && !focus_areas.iter().any(|item| item == label) {
            focus_areas.push(label.to_string());
        }
    }

    if focus_areas.is_empty() {
        focus_areas.push("Generalist".to_string());
    }

    focus_areas
}

fn describe_secret_source(value: Option<&Value>) -> String {
    let Some(value) = value else {
        return "not-configured".to_string();
    };

    if let Some(raw) = value.as_str() {
        let trimmed = raw.trim();
        if trimmed.starts_with("${") && trimmed.ends_with('}') {
            return format!(
                "env:{}",
                trimmed.trim_start_matches("${").trim_end_matches('}')
            );
        }
        if !trimmed.is_empty() {
            return "inline-secret".to_string();
        }
    }

    if let Some(object) = value.as_object() {
        if let (Some(source), Some(provider), Some(id)) = (
            object.get("source").and_then(Value::as_str),
            object.get("provider").and_then(Value::as_str),
            object.get("id").and_then(Value::as_str),
        ) {
            return format!("{source}:{provider}:{id}");
        }
    }

    "configured".to_string()
}

fn file_timestamp_label(path: &Path) -> Option<String> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    system_time_label(modified)
}

fn read_json_value(path: &Path) -> Result<Value> {
    if !path.exists() {
        return Ok(Value::Null);
    }

    let content = fs::read_to_string(path)?;
    serde_json::from_str(&content)
        .or_else(|_| json5::from_str(&content))
        .map_err(|error| {
            FrameworkError::ValidationFailed(format!(
                "invalid json document at {}: {}",
                path.display(),
                error
            ))
        })
}

fn read_text_preview(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    let limited = if bytes.len() > MAX_TEXT_FILE_BYTES {
        &bytes[..MAX_TEXT_FILE_BYTES]
    } else {
        &bytes[..]
    };
    Some(String::from_utf8_lossy(limited).into_owned())
}

fn summarize_markdown(content: &str, max_len: usize) -> String {
    let stripped = strip_frontmatter(content)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#') && !line.starts_with("```"))
        .collect::<Vec<_>>()
        .join(" ");
    let summary = stripped.trim();
    if summary.len() <= max_len {
        summary.to_string()
    } else {
        format!("{}...", &summary[..max_len.saturating_sub(3)])
    }
}

fn strip_frontmatter(content: &str) -> &str {
    if !content.starts_with("---") {
        return content;
    }
    let Some(end_index) = content[3..].find("\n---") else {
        return content;
    };
    let start = 3 + end_index + 4;
    content.get(start..).map(str::trim_start).unwrap_or(content)
}

fn value_at_path<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = value;
    for segment in path {
        current = current.as_object()?.get(*segment)?;
    }
    Some(current)
}

fn object_at_path<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Map<String, Value>> {
    value_at_path(value, path)?.as_object()
}

fn array_at_path<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Vec<Value>> {
    value_at_path(value, path)?.as_array()
}

fn string_at_path(value: &Value, path: &[&str]) -> Option<String> {
    value_at_path(value, path)?
        .as_str()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn bool_at_path(value: &Value, path: &[&str]) -> Option<bool> {
    value_at_path(value, path)?.as_bool()
}

fn u64_at_path(value: &Value, path: &[&str]) -> Option<u64> {
    value_at_path(value, path)?.as_u64()
}

fn is_configured_value(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(value) => *value,
        Value::Number(_) => true,
        Value::String(value) => !value.trim().is_empty(),
        Value::Array(values) => !values.is_empty(),
        Value::Object(values) => !values.is_empty(),
    }
}

fn split_schedule_datetime(value: &str) -> (Option<String>, Option<String>) {
    if let Some((date, time)) = value.split_once('T') {
        return (
            Some(date.trim().to_string()),
            Some(time.trim_end_matches('Z').trim().to_string()),
        );
    }
    if let Some((date, time)) = value.split_once(' ') {
        return (Some(date.trim().to_string()), Some(time.trim().to_string()));
    }
    (Some(value.trim().to_string()), None)
}

fn title_case_identifier(value: &str) -> String {
    value
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .filter(|segment| !segment.is_empty())
        .map(|segment| {
            let mut chars = segment.chars();
            match chars.next() {
                Some(first) => format!(
                    "{}{}",
                    first.to_ascii_uppercase(),
                    chars.as_str().to_ascii_lowercase()
                ),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn format_timestamp_ms(timestamp_ms: u64) -> String {
    let seconds = i64::try_from(timestamp_ms / 1000).unwrap_or(0);
    OffsetDateTime::from_unix_timestamp(seconds)
        .ok()
        .and_then(|datetime| datetime.format(&Rfc3339).ok())
        .unwrap_or_else(|| timestamp_ms.to_string())
}

fn system_time_label(value: SystemTime) -> Option<String> {
    let duration = value.duration_since(UNIX_EPOCH).ok()?;
    Some(format_timestamp_ms(duration.as_millis() as u64))
}

fn format_size(bytes: u64) -> String {
    if bytes >= 1024 * 1024 {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    } else if bytes >= 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{bytes} B")
    }
}

fn infer_language(path: &Path) -> String {
    match path
        .extension()
        .and_then(OsStr::to_str)
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "json" => "json",
        "md" => "markdown",
        "log" | "txt" => "plaintext",
        "yaml" | "yml" => "yaml",
        "" => "plaintext",
        _ => "plaintext",
    }
    .to_string()
}

fn file_name_or_path(path: &Path) -> String {
    path.file_name()
        .and_then(OsStr::to_str)
        .map(|value| value.to_string())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn token_estimate(text: &str) -> u32 {
    let tokens = (text.chars().count() / 4).max(1);
    u32::try_from(tokens).unwrap_or(u32::MAX)
}

fn push_file_record(
    writable_roots: &BTreeSet<PathBuf>,
    authority_config_path: &Path,
    files: &mut Vec<StudioWorkbenchFileRecord>,
    path: &Path,
    category: &str,
    status: &str,
    description: &str,
) {
    let content = read_text_preview(path).unwrap_or_default();
    let metadata = fs::metadata(path).ok();
    let file_status = if path.exists() { status } else { "missing" };

    files.push(StudioWorkbenchFileRecord {
        id: path.to_string_lossy().into_owned(),
        name: file_name_or_path(path),
        path: path.to_string_lossy().into_owned(),
        category: category.to_string(),
        language: infer_language(path),
        size: metadata
            .as_ref()
            .map(|meta| format_size(meta.len()))
            .unwrap_or_else(|| "0 B".to_string()),
        updated_at: metadata
            .and_then(|meta| meta.modified().ok())
            .and_then(system_time_label)
            .unwrap_or_else(|| "Unknown".to_string()),
        status: file_status.to_string(),
        description: description.to_string(),
        content,
        is_readonly: !is_openclaw_workbench_file_writable(
            authority_config_path,
            writable_roots,
            path,
        ),
    });
}

fn is_openclaw_workbench_bootstrap_file(path: &Path) -> bool {
    matches!(
        path.file_name().and_then(OsStr::to_str),
        Some(
            "AGENTS.md"
                | "SOUL.md"
                | "TOOLS.md"
                | "IDENTITY.md"
                | "USER.md"
                | "HEARTBEAT.md"
                | "BOOTSTRAP.md"
                | "MEMORY.md"
                | "memory.md"
        )
    )
}

fn is_openclaw_workbench_file_writable(
    authority_config_path: &Path,
    writable_roots: &BTreeSet<PathBuf>,
    path: &Path,
) -> bool {
    if path == authority_config_path {
        return true;
    }

    if !is_openclaw_workbench_bootstrap_file(path) {
        return false;
    }

    writable_roots.iter().any(|root| path.starts_with(root))
}

fn readable_openclaw_config_file_path(paths: &AppPaths) -> Result<PathBuf> {
    authority_openclaw_config_file_path(paths)
}

fn authority_openclaw_config_file_path(paths: &AppPaths) -> Result<PathBuf> {
    KernelRuntimeAuthorityService::new()
        .active_config_file_path("openclaw", paths)
}

fn extract_frontmatter_value(content: &str, key: &str) -> Option<String> {
    if !content.starts_with("---") {
        return None;
    }
    let end_index = content[3..].find("\n---")?;
    let frontmatter = &content[..3 + end_index + 4];
    let needle = format!("{key}:");

    frontmatter
        .lines()
        .find_map(|line| line.trim().strip_prefix(&needle))
        .map(str::trim)
        .map(|value| value.trim_matches('"').trim_matches('\'').to_string())
        .filter(|value| !value.is_empty())
}

fn infer_skill_category(skill_name: &str, content: &str) -> String {
    let source = format!("{skill_name} {content}").to_ascii_lowercase();
    if source.contains("browser") || source.contains("web") {
        "Integration".to_string()
    } else if source.contains("image") || source.contains("audio") {
        "Media".to_string()
    } else if source.contains("cron") || source.contains("automation") {
        "Automation".to_string()
    } else if source.contains("code") || source.contains("patch") || source.contains("git") {
        "Code".to_string()
    } else if source.contains("memory") || source.contains("search") {
        "Reasoning".to_string()
    } else {
        "General".to_string()
    }
}

fn string_vec_at_path(value: &Value, path: &[&str]) -> Vec<String> {
    array_at_path(value, path)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| item.as_str().map(|value| value.trim().to_string()))
        .filter(|item| !item.is_empty())
        .collect()
}

fn tool_allowed_by_profile(profile: &str, tool_id: &str) -> bool {
    match profile {
        "full" => true,
        "minimal" => matches!(tool_id, "session_status"),
        "messaging" => matches!(
            tool_id,
            "sessions_list" | "sessions_history" | "sessions_send" | "session_status" | "message"
        ),
        "coding" => matches!(
            tool_id,
            "read"
                | "write"
                | "edit"
                | "apply_patch"
                | "exec"
                | "process"
                | "web_search"
                | "web_fetch"
                | "memory_search"
                | "memory_get"
                | "sessions_list"
                | "sessions_history"
                | "sessions_send"
                | "sessions_spawn"
                | "sessions_yield"
                | "subagents"
                | "session_status"
                | "cron"
                | "agents_list"
                | "image"
                | "image_generate"
                | "video_generate"
                | "music_generate"
        ),
        _ => false,
    }
}

fn tool_token_matches(
    tool_id: &str,
    section: &str,
    include_in_openclaw_group: bool,
    token: &str,
) -> bool {
    let normalized = token.trim().to_ascii_lowercase();
    normalized == tool_id
        || normalized == format!("tool:{tool_id}")
        || normalized == format!("group:{section}")
        || (include_in_openclaw_group && normalized == "group:openclaw")
}

#[cfg(test)]
mod tests {
    use super::{
        build_openclaw_llm_providers, build_openclaw_tools, collect_openclaw_agent_contexts,
        map_openclaw_cron_task,
    };
    use crate::framework::paths::resolve_paths_for_root;
    use crate::framework::services::studio::StudioWorkbenchLLMProviderConfigRecord;
    use serde_json::json;
    use std::collections::BTreeMap;

    #[test]
    fn build_openclaw_llm_providers_reads_runtime_params_from_defaults_model_catalog() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let openclaw_root = temp_dir.path().join(".openclaw");
        let config_path = openclaw_root.join("openclaw.json");
        std::fs::create_dir_all(&openclaw_root).expect("create openclaw root");
        std::fs::write(&config_path, "{}").expect("seed config path");

        let providers = build_openclaw_llm_providers(
            &json!({
                "models": {
                    "providers": {
                        "openai": {
                            "baseUrl": "https://api.openai.com/v1",
                            "apiKey": "${OPENAI_API_KEY}",
                            "temperature": 0.05,
                            "topP": 0.1,
                            "maxTokens": 256,
                            "timeoutMs": 1000,
                            "streaming": false,
                            "models": [
                                { "id": "gpt-5.4", "name": "GPT-5.4" },
                                { "id": "o4-mini", "name": "o4-mini", "reasoning": true },
                                {
                                    "id": "text-embedding-3-large",
                                    "name": "text-embedding-3-large",
                                    "api": "embedding"
                                }
                            ]
                        }
                    }
                },
                "agents": {
                    "defaults": {
                        "model": {
                            "primary": "openai/gpt-5.4",
                            "fallbacks": ["openai/o4-mini"]
                        },
                        "models": {
                            "openai/gpt-5.4": {
                                "params": {
                                    "temperature": 0.3,
                                    "topP": 0.95,
                                    "maxTokens": 12000,
                                    "timeoutMs": 120000,
                                    "streaming": true
                                }
                            }
                        }
                    }
                }
            }),
            &config_path,
        );

        assert_eq!(providers.len(), 1);
        assert_eq!(providers[0].default_model_id, "gpt-5.4");
        assert_eq!(providers[0].reasoning_model_id.as_deref(), Some("o4-mini"));
        assert_eq!(
            providers[0].config,
            StudioWorkbenchLLMProviderConfigRecord {
                temperature: 0.3,
                top_p: 0.95,
                max_tokens: 12000,
                timeout_ms: 120000,
                streaming: true,
            }
        );
    }

    #[test]
    fn agent_contexts_do_not_treat_non_main_default_agent_as_the_primary_workspace() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp_dir.path()).expect("paths");

        let contexts = collect_openclaw_agent_contexts(
            &paths,
            &json!({
                "agents": {
                    "list": [
                        { "id": "Reviewer Team", "name": "Reviewer", "default": true },
                        { "id": "main", "name": "Main" }
                    ]
                }
            }),
        )
        .expect("agent contexts");

        let main = contexts
            .iter()
            .find(|context| context.id == "main")
            .expect("main agent");
        let reviewer = contexts
            .iter()
            .find(|context| context.id == "reviewer-team")
            .expect("canonical reviewer agent");

        assert_eq!(main.workspace, paths.openclaw_workspace_dir);
        assert_eq!(
            reviewer.workspace,
            paths.openclaw_root_dir.join("workspace-reviewer-team")
        );
    }

    #[test]
    fn map_openclaw_cron_task_surfaces_advanced_openclaw_fields() {
        let task = map_openclaw_cron_task(
            &json!({
                "id": "job-1",
                "name": "Project monitor",
                "description": "Summarize overnight updates.",
                "enabled": true,
                "deleteAfterRun": true,
                "agentId": "ops",
                "schedule": {
                    "kind": "cron",
                    "expr": "0 7 * * *",
                    "tz": "Asia/Shanghai",
                    "staggerMs": 30000
                },
                "sessionTarget": "session:project-alpha-monitor",
                "wakeMode": "next-heartbeat",
                "payload": {
                    "kind": "agentTurn",
                    "message": "Summarize overnight updates.",
                    "model": "openai/gpt-5.4",
                    "thinking": "high",
                    "timeoutSeconds": 600,
                    "lightContext": true,
                    "fallbacks": ["openai/gpt-5.3"]
                },
                "delivery": {
                    "mode": "webhook",
                    "to": "https://hooks.example.com/openclaw/cron",
                    "bestEffort": true
                },
                "state": {
                    "nextRunAtMs": 1700000000000_i64
                }
            }),
            &BTreeMap::new(),
            None,
        );

        assert_eq!(task.session_mode, "custom");
        assert_eq!(
            task.custom_session_id.as_deref(),
            Some("project-alpha-monitor")
        );
        assert_eq!(
            task.schedule_config.cron_timezone.as_deref(),
            Some("Asia/Shanghai")
        );
        assert_eq!(task.schedule_config.stagger_ms, Some(30000));
        assert_eq!(task.wake_up_mode, "nextCycle");
        assert_eq!(task.timeout_seconds, Some(600));
        assert_eq!(task.delete_after_run, Some(true));
        assert_eq!(task.agent_id.as_deref(), Some("ops"));
        assert_eq!(task.model.as_deref(), Some("openai/gpt-5.4"));
        assert_eq!(task.thinking.as_deref(), Some("high"));
        assert_eq!(task.light_context, Some(true));
        assert_eq!(task.delivery_mode, "webhook");
        assert_eq!(task.delivery_best_effort, Some(true));
        assert_eq!(
            task.recipient.as_deref(),
            Some("https://hooks.example.com/openclaw/cron")
        );
        assert!(task.raw_definition.is_some());
    }

    #[test]
    fn build_openclaw_tools_exposes_video_and_music_generation_tools() {
        let tools = build_openclaw_tools(&json!({
            "tools": {
                "profile": "coding"
            }
        }));

        let video_generate = tools
            .iter()
            .find(|tool| tool.id == "video_generate")
            .expect("video_generate tool");
        assert_eq!(video_generate.command, "tool:video_generate");
        assert_eq!(video_generate.category, "integration");
        assert_eq!(video_generate.access, "execute");
        assert_eq!(video_generate.status, "beta");

        let music_generate = tools
            .iter()
            .find(|tool| tool.id == "music_generate")
            .expect("music_generate tool");
        assert_eq!(music_generate.command, "tool:music_generate");
        assert_eq!(music_generate.category, "integration");
        assert_eq!(music_generate.access, "execute");
        assert_eq!(music_generate.status, "beta");
    }
}
