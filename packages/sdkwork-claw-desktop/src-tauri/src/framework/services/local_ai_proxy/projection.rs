use super::{
    resolve_projected_openclaw_provider_api, resolve_projected_openclaw_provider_base_url,
    types::LocalAiProxyServiceHealth, LocalAiProxyRouteSnapshot, LocalAiProxySnapshot,
    OPENCLAW_LOCAL_PROXY_API_KEY_PLACEHOLDER, OPENCLAW_LOCAL_PROXY_PROVIDER_AUTH,
    OPENCLAW_LOCAL_PROXY_PROVIDER_ID,
};
use crate::framework::{
    paths::AppPaths, services::kernel_runtime_authority::KernelRuntimeAuthorityService,
    FrameworkError, Result,
};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub(super) fn project_managed_openclaw_provider(
    paths: &AppPaths,
    snapshot: &LocalAiProxySnapshot,
    health: &LocalAiProxyServiceHealth,
) -> Result<()> {
    let route = snapshot.default_route().ok_or_else(|| {
        FrameworkError::ValidationFailed(
            "cannot project local ai proxy into openclaw config without a default route"
                .to_string(),
        )
    })?;
    let default_model_id = resolve_default_route_model_id(route)?;
    let mut root = read_openclaw_config_root(&readable_openclaw_config_path(paths))?;
    let overwrite_defaults =
        should_overwrite_managed_provider_defaults(&root, OPENCLAW_LOCAL_PROXY_PROVIDER_ID);
    let provider_root = ensure_json_object_mut(
        &mut root,
        &["models", "providers", OPENCLAW_LOCAL_PROXY_PROVIDER_ID],
    );
    let existing_models = provider_root
        .get("models")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let projected_base_url =
        resolve_projected_openclaw_provider_base_url(&route.client_protocol, &health.base_url);
    let projected_api = resolve_projected_openclaw_provider_api(&route.client_protocol);

    provider_root.insert("baseUrl".to_string(), Value::String(projected_base_url));
    provider_root.insert(
        "apiKey".to_string(),
        Value::String(OPENCLAW_LOCAL_PROXY_API_KEY_PLACEHOLDER.to_string()),
    );
    provider_root.insert("api".to_string(), Value::String(projected_api.to_string()));
    clear_legacy_openclaw_provider_runtime_config(provider_root);
    provider_root.insert(
        "auth".to_string(),
        Value::String(OPENCLAW_LOCAL_PROXY_PROVIDER_AUTH.to_string()),
    );
    provider_root.insert(
        "models".to_string(),
        Value::Array(build_openclaw_provider_models(
            existing_models,
            route,
            &default_model_id,
        )),
    );
    write_managed_provider_runtime_config(
        &mut root,
        OPENCLAW_LOCAL_PROXY_PROVIDER_ID,
        &default_model_id,
        route,
    );

    if overwrite_defaults {
        write_managed_provider_defaults(
            &mut root,
            OPENCLAW_LOCAL_PROXY_PROVIDER_ID,
            &default_model_id,
            route.reasoning_model_id.as_deref(),
        );
    }

    write_openclaw_config_root(&active_openclaw_config_path(paths), &root)
}

fn read_openclaw_config_root(path: &Path) -> Result<Value> {
    if !path.exists() {
        return Ok(Value::Object(serde_json::Map::new()));
    }

    let content = fs::read_to_string(path)?;
    let parsed = json5::from_str::<Value>(&content).map_err(|error| {
        FrameworkError::ValidationFailed(format!("invalid OpenClaw config document: {error}"))
    })?;

    if parsed.is_object() {
        return Ok(parsed);
    }

    Err(FrameworkError::ValidationFailed(format!(
        "OpenClaw config document must be a JSON object: {}",
        path.display()
    )))
}

fn write_openclaw_config_root(path: &Path, root: &Value) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, format!("{}\n", serde_json::to_string_pretty(root)?))?;
    Ok(())
}

fn readable_openclaw_config_path(paths: &AppPaths) -> PathBuf {
    active_openclaw_config_path(paths)
}

fn active_openclaw_config_path(paths: &AppPaths) -> PathBuf {
    KernelRuntimeAuthorityService::new()
        .active_config_file_path("openclaw", paths)
        .expect("canonical openclaw config path")
}

fn resolve_default_route_model_id(route: &LocalAiProxyRouteSnapshot) -> Result<String> {
    route.default_model_id
        .trim()
        .to_string()
        .chars()
        .next()
        .map(|_| route.default_model_id.trim().to_string())
        .or_else(|| {
            route.models.iter().find_map(|model| {
                let model_id = model.id.trim();
                (!model_id.is_empty()).then(|| model_id.to_string())
            })
        })
        .ok_or_else(|| {
            FrameworkError::ValidationFailed(
                "local ai proxy default route must expose at least one model before it can be projected into openclaw"
                    .to_string(),
            )
        })
}

fn clear_legacy_openclaw_provider_runtime_config(
    provider_root: &mut serde_json::Map<String, Value>,
) {
    for key in ["temperature", "topP", "maxTokens", "timeoutMs", "streaming"] {
        provider_root.remove(key);
    }
}

fn should_overwrite_managed_provider_defaults(root: &Value, provider_id: &str) -> bool {
    let Some(primary) = get_nested_string(root, &["agents", "defaults", "model", "primary"]) else {
        return true;
    };
    let Some((provider_key, _)) = primary.split_once('/') else {
        return true;
    };
    provider_key.trim() == provider_id.trim()
}

fn write_managed_provider_defaults(
    root: &mut Value,
    provider_id: &str,
    default_model_id: &str,
    reasoning_model_id: Option<&str>,
) {
    let defaults_model = ensure_json_object_mut(root, &["agents", "defaults", "model"]);
    defaults_model.insert(
        "primary".to_string(),
        Value::String(build_openclaw_model_ref(provider_id, default_model_id)),
    );
    defaults_model.insert(
        "fallbacks".to_string(),
        Value::Array(
            reasoning_model_id
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .filter(|value| *value != default_model_id)
                .map(|value| Value::String(build_openclaw_model_ref(provider_id, value)))
                .into_iter()
                .collect(),
        ),
    );
}

fn write_managed_provider_runtime_config(
    root: &mut Value,
    provider_id: &str,
    default_model_id: &str,
    route: &LocalAiProxyRouteSnapshot,
) {
    let model_ref = build_openclaw_model_ref(provider_id, default_model_id);
    if let Some(params) = build_managed_provider_runtime_params(route) {
        let model_root =
            ensure_json_object_mut(root, &["agents", "defaults", "models", model_ref.as_str()]);
        model_root.insert("params".to_string(), Value::Object(params));
        return;
    }

    if let Some(model_root) =
        get_nested_value_mut(root, &["agents", "defaults", "models", model_ref.as_str()])
            .and_then(Value::as_object_mut)
    {
        model_root.remove("params");
    }
}

fn build_managed_provider_runtime_params(
    route: &LocalAiProxyRouteSnapshot,
) -> Option<serde_json::Map<String, Value>> {
    let mut params = serde_json::Map::new();
    if let Some(value) = route.runtime_config.temperature.clone() {
        params.insert("temperature".to_string(), Value::Number(value));
    }
    if let Some(value) = route.runtime_config.top_p.clone() {
        params.insert("topP".to_string(), Value::Number(value));
    }
    if let Some(value) = route.runtime_config.max_tokens {
        params.insert(
            "maxTokens".to_string(),
            Value::Number(serde_json::Number::from(value)),
        );
    }
    if let Some(value) = route.runtime_config.timeout_ms {
        params.insert(
            "timeoutMs".to_string(),
            Value::Number(serde_json::Number::from(value)),
        );
    }
    if let Some(value) = route.runtime_config.streaming {
        params.insert("streaming".to_string(), Value::Bool(value));
    }
    (!params.is_empty()).then_some(params)
}

fn build_openclaw_model_ref(provider_id: &str, model_id: &str) -> String {
    format!("{}/{}", provider_id.trim(), model_id.trim())
}

fn build_openclaw_provider_models(
    existing_models: Vec<Value>,
    route: &LocalAiProxyRouteSnapshot,
    default_model_id: &str,
) -> Vec<Value> {
    let mut existing_by_id = std::collections::BTreeMap::new();
    let mut passthrough = Vec::new();
    for model in existing_models {
        let Some(model_id) = model
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            passthrough.push(model);
            continue;
        };
        existing_by_id.insert(model_id.to_string(), model);
    }

    let mut next = route
        .models
        .iter()
        .map(|model| {
            let model_id = model.id.trim();
            let mut next_model = existing_by_id
                .remove(model_id)
                .and_then(|value| value.as_object().cloned())
                .unwrap_or_default();
            next_model.insert("id".to_string(), Value::String(model_id.to_string()));
            next_model.insert(
                "name".to_string(),
                Value::String(model.name.trim().to_string()),
            );
            next_model.insert(
                "reasoning".to_string(),
                Value::Bool(route.reasoning_model_id.as_deref() == Some(model_id)),
            );
            next_model.insert(
                "input".to_string(),
                Value::Array(vec![Value::String("text".to_string())]),
            );
            next_model.insert(
                "cost".to_string(),
                json!({ "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }),
            );
            next_model.insert(
                "contextWindow".to_string(),
                Value::Number(serde_json::Number::from(
                    if route.embedding_model_id.as_deref() == Some(model_id) {
                        8_192
                    } else if route.reasoning_model_id.as_deref() == Some(model_id) {
                        200_000
                    } else {
                        128_000
                    },
                )),
            );
            next_model.insert(
                "maxTokens".to_string(),
                Value::Number(serde_json::Number::from(
                    if route.embedding_model_id.as_deref() == Some(model_id) {
                        8_192
                    } else {
                        32_000
                    },
                )),
            );
            Value::Object(next_model)
        })
        .collect::<Vec<_>>();

    if !route
        .models
        .iter()
        .any(|model| model.id.trim() == default_model_id.trim())
    {
        next.push(json!({
            "id": default_model_id.trim(),
            "name": default_model_id.trim(),
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 32000
        }));
    }

    next.extend(passthrough);
    next
}

fn ensure_json_object_mut<'a>(
    root: &'a mut Value,
    path: &[&str],
) -> &'a mut serde_json::Map<String, Value> {
    if !root.is_object() {
        *root = Value::Object(serde_json::Map::new());
    }

    let mut current = root;
    for segment in path {
        let object = current
            .as_object_mut()
            .expect("json object root should stay object");
        current = object
            .entry((*segment).to_string())
            .or_insert_with(|| Value::Object(serde_json::Map::new()));
        if !current.is_object() {
            *current = Value::Object(serde_json::Map::new());
        }
    }

    current
        .as_object_mut()
        .expect("json object path should resolve to object")
}

fn get_nested_value_mut<'a>(root: &'a mut Value, path: &[&str]) -> Option<&'a mut Value> {
    let mut current = root;
    for segment in path {
        current = current.get_mut(*segment)?;
    }
    Some(current)
}

fn get_nested_string(root: &Value, path: &[&str]) -> Option<String> {
    let mut current = root;
    for segment in path {
        current = current.get(*segment)?;
    }
    current
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}
