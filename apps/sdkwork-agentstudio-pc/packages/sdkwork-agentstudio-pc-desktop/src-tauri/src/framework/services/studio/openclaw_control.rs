use super::{
    openclaw_workbench::read_openclaw_cron_run_entries, StudioOpenClawGatewayInvokeOptions,
    StudioOpenClawGatewayInvokeRequest, StudioWorkbenchTaskExecutionRecord,
};
use crate::framework::{
    paths::{AppPaths, OPENCLAW_KERNEL_ID},
    services::{
        openclaw_runtime::ActivatedOpenClawRuntime,
        supervisor::{ManagedServiceLifecycle, SupervisorService, SERVICE_ID_OPENCLAW_GATEWAY},
    },
    FrameworkError, Result,
};
use reqwest::blocking::Client;
use serde_json::{json, Value};
use std::{
    fs,
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

pub(super) fn require_running_openclaw_runtime(
    supervisor: &SupervisorService,
) -> Result<ActivatedOpenClawRuntime> {
    let runtime = supervisor
        .configured_openclaw_runtime()?
        .ok_or_else(|| FrameworkError::NotFound("configured openclaw runtime".to_string()))?;
    let snapshot = supervisor.snapshot()?;
    let gateway = snapshot
        .services
        .into_iter()
        .find(|service| service.id == SERVICE_ID_OPENCLAW_GATEWAY)
        .ok_or_else(|| FrameworkError::NotFound("managed service openclaw_gateway".to_string()))?;

    if gateway.lifecycle != ManagedServiceLifecycle::Running {
        return Err(FrameworkError::Conflict(
            "the built-in OpenClaw gateway is offline; start the built-in instance before managing cron tasks"
                .to_string(),
        ));
    }

    Ok(runtime)
}

pub(super) fn clone_openclaw_task(
    paths: &AppPaths,
    runtime: &ActivatedOpenClawRuntime,
    task_id: &str,
    name: Option<&str>,
) -> Result<()> {
    let mut params = read_openclaw_task_definition(paths, task_id)?;
    let object = params.as_object_mut().ok_or_else(|| {
        FrameworkError::ValidationFailed("OpenClaw cron job must be an object".to_string())
    })?;
    object.remove("id");
    object.remove("createdAtMs");
    object.remove("updatedAtMs");
    object.remove("state");
    if let Some(name) = name.map(str::trim).filter(|value| !value.is_empty()) {
        object.insert("name".to_string(), Value::String(name.to_string()));
    }

    let _ = OpenClawGatewayAdminClient::new(runtime).call("cron.add", &params)?;
    Ok(())
}

pub(super) fn create_openclaw_task(
    _paths: &AppPaths,
    runtime: &ActivatedOpenClawRuntime,
    payload: &Value,
) -> Result<()> {
    let _ = OpenClawGatewayAdminClient::new(runtime).call("cron.add", payload)?;
    Ok(())
}

pub(super) fn invoke_openclaw_gateway(
    runtime: &ActivatedOpenClawRuntime,
    request: &StudioOpenClawGatewayInvokeRequest,
    options: &StudioOpenClawGatewayInvokeOptions,
) -> Result<Value> {
    OpenClawGatewayAdminClient::new(runtime).invoke(request, options)
}

pub(super) fn run_openclaw_task_now(
    _paths: &AppPaths,
    runtime: &ActivatedOpenClawRuntime,
    task_id: &str,
) -> Result<StudioWorkbenchTaskExecutionRecord> {
    let response = OpenClawGatewayAdminClient::new(runtime).call(
        "cron.run",
        &json!({
            "id": task_id,
            "mode": "force",
        }),
    )?;
    let run_id = response
        .get("runId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);
    let now_ms = unix_timestamp_ms()?;

    Ok(StudioWorkbenchTaskExecutionRecord {
        id: run_id
            .clone()
            .unwrap_or_else(|| format!("{task_id}-manual-{now_ms}")),
        task_id: task_id.to_string(),
        status: "running".to_string(),
        trigger: "manual".to_string(),
        started_at: format_timestamp_ms(now_ms),
        finished_at: None,
        summary: "Manual OpenClaw cron run queued.".to_string(),
        details: run_id.map(|value| format!("runId={value}")),
    })
}

pub(super) fn list_openclaw_task_executions(
    paths: &AppPaths,
    task_id: &str,
) -> Result<Vec<StudioWorkbenchTaskExecutionRecord>> {
    read_openclaw_cron_run_entries(paths, task_id)
}

pub(super) fn update_openclaw_task_status(
    _paths: &AppPaths,
    runtime: &ActivatedOpenClawRuntime,
    task_id: &str,
    status: &str,
) -> Result<()> {
    let enabled = match status {
        "active" => true,
        "paused" => false,
        other => {
            return Err(FrameworkError::ValidationFailed(format!(
                "unsupported OpenClaw task status {other}"
            )))
        }
    };

    let _ = OpenClawGatewayAdminClient::new(runtime).call(
        "cron.update",
        &json!({
            "id": task_id,
            "patch": {
                "enabled": enabled,
            },
        }),
    )?;
    Ok(())
}

pub(super) fn update_openclaw_task(
    _paths: &AppPaths,
    runtime: &ActivatedOpenClawRuntime,
    task_id: &str,
    payload: &Value,
) -> Result<()> {
    let _ = OpenClawGatewayAdminClient::new(runtime).call(
        "cron.update",
        &json!({
            "id": task_id,
            "patch": payload,
        }),
    )?;
    Ok(())
}

pub(super) fn delete_openclaw_task(
    _paths: &AppPaths,
    runtime: &ActivatedOpenClawRuntime,
    task_id: &str,
) -> Result<bool> {
    let response = OpenClawGatewayAdminClient::new(runtime).call(
        "cron.remove",
        &json!({
            "id": task_id,
        }),
    )?;

    Ok(response
        .get("removed")
        .and_then(Value::as_bool)
        .unwrap_or(true))
}

fn read_openclaw_task_definition(paths: &AppPaths, task_id: &str) -> Result<Value> {
    let store_path = resolve_openclaw_jobs_store_path(paths)?;
    let root = read_json_document(&store_path)?;
    let jobs = root.get("jobs").and_then(Value::as_array).ok_or_else(|| {
        FrameworkError::ValidationFailed(format!(
            "invalid OpenClaw cron store at {}: missing jobs array",
            store_path.display()
        ))
    })?;

    jobs.iter()
        .find(|job| {
            job.get("id")
                .and_then(Value::as_str)
                .map(|value| value == task_id)
                .unwrap_or(false)
        })
        .cloned()
        .ok_or_else(|| FrameworkError::NotFound(format!("openclaw cron task \"{task_id}\"")))
}

fn resolve_openclaw_jobs_store_path(paths: &AppPaths) -> Result<std::path::PathBuf> {
    Ok(paths
        .kernel_paths(OPENCLAW_KERNEL_ID)?
        .openclaw_cron_dir()?
        .join("jobs.json"))
}

fn read_json_document(path: &Path) -> Result<Value> {
    if !path.exists() {
        return Err(FrameworkError::NotFound(format!(
            "OpenClaw cron store {}",
            path.display()
        )));
    }

    let content = fs::read_to_string(path)?;
    serde_json::from_str::<Value>(&content).map_err(Into::into)
}

struct OpenClawGatewayAdminClient<'a> {
    runtime: &'a ActivatedOpenClawRuntime,
}

impl<'a> OpenClawGatewayAdminClient<'a> {
    fn new(runtime: &'a ActivatedOpenClawRuntime) -> Self {
        Self { runtime }
    }

    fn call(&self, method: &str, params: &Value) -> Result<Value> {
        let request = build_gateway_invoke_request(method, params)?;
        self.send_request(
            method,
            &request,
            &StudioOpenClawGatewayInvokeOptions::default(),
        )
    }

    fn invoke(
        &self,
        request: &StudioOpenClawGatewayInvokeRequest,
        options: &StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value> {
        let payload = build_gateway_invoke_payload(request)?;
        let method = if let Some(action) = request
            .action
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            format!("{}.{}", request.tool.trim(), action)
        } else {
            request.tool.trim().to_string()
        };
        self.send_request(method.as_str(), &payload, options)
    }

    fn send_request(
        &self,
        method: &str,
        request: &Value,
        options: &StudioOpenClawGatewayInvokeOptions,
    ) -> Result<Value> {
        let url = format!(
            "http://127.0.0.1:{}/tools/invoke",
            self.runtime.gateway_port
        );
        let request = request.clone();
        let message_channel = options
            .message_channel
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string);
        let account_id = options
            .account_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string);
        let extra_headers = options
            .headers
            .iter()
            .filter_map(|(key, value)| {
                let key = key.trim();
                let value = value.trim();
                if key.is_empty() || value.is_empty() {
                    None
                } else {
                    Some((key.to_string(), value.to_string()))
                }
            })
            .collect::<Vec<_>>();
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|error| {
                FrameworkError::Internal(format!(
                    "failed to build OpenClaw gateway admin client: {error}"
                ))
            })?;
        let mut request_builder = client
            .post(url)
            .header(
                "authorization",
                format!("Bearer {}", self.runtime.gateway_auth_token),
            )
            .header("content-type", "application/json")
            .header("accept", "application/json");
        if let Some(message_channel) = message_channel.as_deref() {
            request_builder = request_builder.header("x-openclaw-message-channel", message_channel);
        }
        if let Some(account_id) = account_id.as_deref() {
            request_builder = request_builder.header("x-openclaw-account-id", account_id);
        }
        for (key, value) in &extra_headers {
            request_builder = request_builder.header(key.as_str(), value.as_str());
        }
        let response = request_builder.json(&request).send().map_err(|error| {
            FrameworkError::Conflict(format!(
                "failed to reach the built-in OpenClaw gateway for {method}: {error}"
            ))
        })?;
        let status = response.status();
        let body = response.text().map_err(|error| {
            FrameworkError::Internal(format!(
                "failed to read OpenClaw gateway response for {method}: {error}"
            ))
        })?;

        parse_gateway_invoke_response(method, status, body.as_str())
    }
}

fn build_gateway_invoke_payload(request: &StudioOpenClawGatewayInvokeRequest) -> Result<Value> {
    let tool = request.tool.trim();
    if tool.is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "OpenClaw gateway tool name is required".to_string(),
        ));
    }

    let mut payload = serde_json::Map::new();
    payload.insert("tool".to_string(), Value::String(tool.to_string()));

    if let Some(action) = request
        .action
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        payload.insert("action".to_string(), Value::String(action.to_string()));
    }

    payload.insert(
        "args".to_string(),
        request
            .args
            .clone()
            .unwrap_or_else(|| Value::Object(serde_json::Map::new())),
    );

    if let Some(session_key) = request
        .session_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        payload.insert(
            "sessionKey".to_string(),
            Value::String(session_key.to_string()),
        );
    }

    if let Some(dry_run) = request.dry_run {
        payload.insert("dryRun".to_string(), Value::Bool(dry_run));
    }

    Ok(Value::Object(payload))
}

fn build_gateway_invoke_request(method: &str, params: &Value) -> Result<Value> {
    let descriptor = resolve_gateway_method_descriptor(method);
    if descriptor.tool.trim().is_empty() {
        return Err(FrameworkError::ValidationFailed(format!(
            "invalid OpenClaw gateway method {method}"
        )));
    }

    let mut request = serde_json::Map::new();
    request.insert(
        "tool".to_string(),
        Value::String(descriptor.tool.to_string()),
    );
    if let Some(action) = descriptor.action {
        request.insert("action".to_string(), Value::String(action.to_string()));
    }
    request.insert("args".to_string(), params.clone());
    Ok(Value::Object(request))
}

struct OpenClawGatewayMethodDescriptor<'a> {
    tool: &'a str,
    action: Option<&'a str>,
}

fn resolve_gateway_method_descriptor(method: &str) -> OpenClawGatewayMethodDescriptor<'_> {
    match method.rsplit_once('.') {
        Some((tool, action)) if !tool.trim().is_empty() && !action.trim().is_empty() => {
            OpenClawGatewayMethodDescriptor {
                tool,
                action: Some(action),
            }
        }
        _ => OpenClawGatewayMethodDescriptor {
            tool: method,
            action: None,
        },
    }
}

fn parse_gateway_invoke_response(
    method: &str,
    status: reqwest::StatusCode,
    body: &str,
) -> Result<Value> {
    let payload = if body.trim().is_empty() {
        Value::Null
    } else {
        serde_json::from_str::<Value>(body).map_err(|error| {
            FrameworkError::ValidationFailed(format!(
                "invalid OpenClaw gateway response for {method}: {error}"
            ))
        })?
    };

    if !status.is_success() {
        return Err(map_gateway_http_failure(method, status, &payload));
    }

    let Some(object) = payload.as_object() else {
        return Err(FrameworkError::ValidationFailed(format!(
            "invalid OpenClaw gateway response for {method}: expected JSON object"
        )));
    };

    match object.get("ok").and_then(Value::as_bool) {
        Some(true) => Ok(object.get("result").cloned().unwrap_or(Value::Null)),
        Some(false) => Err(FrameworkError::Conflict(format!(
            "OpenClaw gateway method {method} failed: {}",
            gateway_error_message(&payload)
                .unwrap_or_else(|| "the gateway rejected the request".to_string())
        ))),
        None => Err(FrameworkError::ValidationFailed(format!(
            "invalid OpenClaw gateway response for {method}: missing ok flag"
        ))),
    }
}

fn map_gateway_http_failure(
    method: &str,
    status: reqwest::StatusCode,
    payload: &Value,
) -> FrameworkError {
    let message = gateway_error_message(payload).unwrap_or_else(|| {
        format!(
            "OpenClaw gateway request failed with HTTP {}",
            status.as_u16()
        )
    });

    match status.as_u16() {
        401 => FrameworkError::Conflict(format!(
            "OpenClaw gateway authorization failed for {method}: {message}"
        )),
        404 => FrameworkError::ValidationFailed(format!(
            "OpenClaw gateway method {method} is not available: {message}"
        )),
        429 => {
            FrameworkError::Conflict(format!("OpenClaw gateway rate limited {method}: {message}"))
        }
        _ => FrameworkError::Conflict(format!(
            "OpenClaw gateway request for {method} failed with HTTP {}: {message}",
            status.as_u16()
        )),
    }
}

fn gateway_error_message(payload: &Value) -> Option<String> {
    if let Some(message) = payload
        .get("error")
        .and_then(Value::as_object)
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(message.to_string());
    }

    payload
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn unix_timestamp_ms() -> Result<u64> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(duration.as_millis() as u64)
}

fn format_timestamp_ms(timestamp_ms: u64) -> String {
    let seconds = i64::try_from(timestamp_ms / 1000).unwrap_or(0);
    OffsetDateTime::from_unix_timestamp(seconds)
        .ok()
        .and_then(|datetime| datetime.format(&Rfc3339).ok())
        .unwrap_or_else(|| timestamp_ms.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        clone_openclaw_task, create_openclaw_task, delete_openclaw_task,
        require_running_openclaw_runtime, run_openclaw_task_now, update_openclaw_task,
        update_openclaw_task_status,
    };
    use crate::framework::{
        paths::resolve_paths_for_root,
        services::{
            openclaw_runtime::ActivatedOpenClawRuntime,
            supervisor::{SupervisorService, SERVICE_ID_OPENCLAW_GATEWAY},
        },
    };
    use serde_json::{json, Value};
    use std::{
        fs,
        io::{Read, Write},
        net::{TcpListener, TcpStream},
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc, Mutex,
        },
        thread::{self, JoinHandle},
        time::Duration,
    };

    #[test]
    fn clone_reuses_gateway_call_with_the_exact_job_shape() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let (runtime, server) = create_runtime_fixture(&paths);

        fs::create_dir_all(paths.openclaw_root_dir.join("cron")).expect("cron dir");
        fs::write(
            paths.openclaw_root_dir.join("cron").join("jobs.json"),
            r#"{
  "version": 1,
  "jobs": [
    {
      "id": "job-1",
      "name": "Nightly Review",
      "description": "Summarize overnight updates.",
      "enabled": true,
      "deleteAfterRun": false,
      "agentId": "main",
      "sessionKey": "agent:main:cron:job-1",
      "schedule": {
        "kind": "cron",
        "expr": "0 7 * * *",
        "tz": "Asia/Shanghai",
        "staggerMs": 0
      },
      "sessionTarget": "isolated",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "Summarize overnight updates.",
        "model": "openai/gpt-5.4",
        "fallbacks": ["openai/gpt-5.3"],
        "thinking": "medium",
        "timeoutSeconds": 600,
        "lightContext": true
      },
      "delivery": {
        "mode": "announce",
        "channel": "telegram",
        "to": "123456",
        "accountId": "bot-default",
        "bestEffort": true
      },
      "failureAlert": false,
      "createdAtMs": 100,
      "updatedAtMs": 101,
      "state": {
        "nextRunAtMs": 200
      }
    }
  ]
}"#,
        )
        .expect("jobs store");

        clone_openclaw_task(&paths, &runtime, "job-1", Some("Nightly Review Copy"))
            .expect("clone task");

        let captured = read_capture(&server).expect("capture entry");
        assert_eq!(captured.path, "/tools/invoke");
        assert_eq!(captured.authorization.as_deref(), Some("Bearer test-token"));
        assert_eq!(captured.method, "cron.add");
        assert_eq!(
            captured.params.get("name").and_then(Value::as_str),
            Some("Nightly Review Copy")
        );
        assert!(captured.params.get("id").is_none());
        assert!(captured.params.get("state").is_none());
        assert_eq!(
            captured
                .params
                .pointer("/payload/fallbacks/0")
                .and_then(Value::as_str),
            Some("openai/gpt-5.3")
        );
        assert_eq!(
            captured
                .params
                .pointer("/delivery/accountId")
                .and_then(Value::as_str),
            Some("bot-default")
        );
        assert_eq!(
            captured.params.get("failureAlert").and_then(Value::as_bool),
            Some(false)
        );
    }

    #[test]
    fn create_and_update_forward_openclaw_upsert_payloads_without_rewriting_them() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let (runtime, server) = create_runtime_fixture(&paths);

        create_openclaw_task(
            &paths,
            &runtime,
            &serde_json::json!({
                "name": "Morning brief",
                "description": "Summarize overnight updates.",
                "enabled": true,
                "schedule": {
                    "kind": "cron",
                    "expr": "0 7 * * *"
                },
                "sessionTarget": "isolated",
                "wakeMode": "now",
                "payload": {
                    "kind": "agentTurn",
                    "message": "Summarize overnight updates.",
                    "timeoutSeconds": 600
                },
                "delivery": {
                    "mode": "announce",
                    "channel": "telegram",
                    "to": "channel:daily-brief"
                }
            }),
        )
        .expect("create task");
        update_openclaw_task(
            &paths,
            &runtime,
            "job-1",
            &serde_json::json!({
                "name": "Morning brief updated",
                "enabled": false,
                "payload": {
                    "kind": "agentTurn",
                    "message": "Summarize the last 12 hours."
                }
            }),
        )
        .expect("update task");

        let captures = read_all_captures(&server);
        assert_eq!(captures.len(), 2);
        assert_eq!(captures[0].method, "cron.add");
        assert_eq!(
            captures[0].params.get("name").and_then(Value::as_str),
            Some("Morning brief")
        );
        assert_eq!(
            captures[0]
                .params
                .pointer("/payload/timeoutSeconds")
                .and_then(Value::as_i64),
            Some(600)
        );
        assert_eq!(captures[1].method, "cron.update");
        assert_eq!(
            captures[1].params.get("id").and_then(Value::as_str),
            Some("job-1")
        );
        assert_eq!(
            captures[1]
                .params
                .pointer("/patch/name")
                .and_then(Value::as_str),
            Some("Morning brief updated")
        );
        assert_eq!(
            captures[1]
                .params
                .pointer("/patch/enabled")
                .and_then(Value::as_bool),
            Some(false)
        );
    }

    #[test]
    fn update_run_and_delete_use_the_managed_gateway_call_surface() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let (runtime, server) = create_runtime_fixture(&paths);

        update_openclaw_task_status(&paths, &runtime, "job-2", "paused").expect("pause task");
        let queued = run_openclaw_task_now(&paths, &runtime, "job-2").expect("queue run");
        let deleted = delete_openclaw_task(&paths, &runtime, "job-2").expect("delete task");

        let captures = read_all_captures(&server);
        assert_eq!(captures.len(), 3);
        assert_eq!(captures[0].method, "cron.update");
        assert_eq!(
            captures[0]
                .params
                .pointer("/patch/enabled")
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(captures[1].method, "cron.run");
        assert_eq!(
            captures[1].params.get("mode").and_then(Value::as_str),
            Some("force")
        );
        assert_eq!(captures[2].method, "cron.remove");
        assert_eq!(queued.status, "running");
        assert_eq!(queued.trigger, "manual");
        assert_eq!(queued.details.as_deref(), Some("runId=run-123"));
        assert!(deleted);
    }

    #[test]
    fn runtime_resolution_requires_the_gateway_to_be_running() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let supervisor = SupervisorService::new();
        let (runtime, _server) = create_runtime_fixture(&paths);

        supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");

        let error = require_running_openclaw_runtime(&supervisor)
            .expect_err("runtime should require a running gateway");
        assert!(error.to_string().contains("gateway is offline"));

        supervisor
            .record_running(SERVICE_ID_OPENCLAW_GATEWAY, Some(42))
            .expect("record running");
        let resolved = require_running_openclaw_runtime(&supervisor).expect("resolve runtime");
        assert_eq!(resolved.gateway_port, runtime.gateway_port);
    }

    #[derive(Clone, Debug)]
    struct CapturedGatewayCall {
        path: String,
        method: String,
        params: Value,
        authorization: Option<String>,
    }

    fn create_runtime_fixture(
        paths: &crate::framework::paths::AppPaths,
    ) -> (ActivatedOpenClawRuntime, TestGatewayServer) {
        let install_dir = paths.openclaw_runtime_dir.join("test-runtime");
        let runtime_dir = install_dir.join("runtime");
        let cli_path = runtime_dir
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("openclaw.mjs");
        let node_path = runtime_dir.join("node").join("node");
        let gateway_port = reserve_available_loopback_port();
        let server = TestGatewayServer::spawn(gateway_port);

        (
            ActivatedOpenClawRuntime {
                install_key: "test-runtime".to_string(),
                install_dir,
                runtime_dir,
                node_path,
                cli_path,
                home_dir: paths.user_root.clone(),
                state_dir: paths.openclaw_root_dir.clone(),
                workspace_dir: paths.openclaw_workspace_dir.clone(),
                config_path: paths.openclaw_config_file.clone(),
                gateway_port,
                gateway_auth_token: "test-token".to_string(),
            },
            server,
        )
    }

    fn read_capture(server: &TestGatewayServer) -> Option<CapturedGatewayCall> {
        read_all_captures(server).into_iter().last()
    }

    fn read_all_captures(server: &TestGatewayServer) -> Vec<CapturedGatewayCall> {
        server.captures()
    }

    fn reserve_available_loopback_port() -> u16 {
        TcpListener::bind("127.0.0.1:0")
            .expect("reserve loopback port")
            .local_addr()
            .expect("loopback addr")
            .port()
    }

    struct TestGatewayServer {
        captures: Arc<Mutex<Vec<CapturedGatewayCall>>>,
        stop: Arc<AtomicBool>,
        handle: Option<JoinHandle<()>>,
        port: u16,
    }

    impl TestGatewayServer {
        fn spawn(port: u16) -> Self {
            let listener = TcpListener::bind(("127.0.0.1", port)).expect("bind gateway server");
            listener
                .set_nonblocking(true)
                .expect("gateway listener nonblocking");

            let captures = Arc::new(Mutex::new(Vec::new()));
            let stop = Arc::new(AtomicBool::new(false));
            let worker_captures = Arc::clone(&captures);
            let worker_stop = Arc::clone(&stop);

            let handle = thread::spawn(move || {
                while !worker_stop.load(Ordering::SeqCst) {
                    match listener.accept() {
                        Ok((mut stream, _)) => {
                            handle_gateway_request(&mut stream, &worker_captures);
                        }
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(10));
                        }
                        Err(_) => break,
                    }
                }
            });

            Self {
                captures,
                stop,
                handle: Some(handle),
                port,
            }
        }

        fn captures(&self) -> Vec<CapturedGatewayCall> {
            self.captures.lock().expect("gateway captures lock").clone()
        }
    }

    impl Drop for TestGatewayServer {
        fn drop(&mut self) {
            self.stop.store(true, Ordering::SeqCst);
            let _ = TcpStream::connect(("127.0.0.1", self.port));
            if let Some(handle) = self.handle.take() {
                let _ = handle.join();
            }
        }
    }

    fn handle_gateway_request(
        stream: &mut TcpStream,
        captures: &Arc<Mutex<Vec<CapturedGatewayCall>>>,
    ) {
        stream
            .set_nonblocking(false)
            .expect("gateway stream blocking mode");
        let (path, headers, body) = read_http_request(stream);
        let payload = serde_json::from_slice::<Value>(&body).expect("gateway request json");
        let tool = payload
            .get("tool")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let method = payload
            .get("action")
            .and_then(Value::as_str)
            .map(|action| format!("{tool}.{action}"))
            .unwrap_or(tool);
        let params = payload.get("args").cloned().unwrap_or(Value::Null);
        captures
            .lock()
            .expect("gateway captures lock")
            .push(CapturedGatewayCall {
                path: path.clone(),
                method: method.clone(),
                params: params.clone(),
                authorization: headers.get("authorization").cloned(),
            });

        if path != "/tools/invoke" {
            write_json_response(
                stream,
                "404 Not Found",
                &json!({
                    "ok": false,
                    "error": {
                        "message": "unexpected path",
                    }
                }),
            );
            return;
        }

        let result = match method.as_str() {
            "cron.run" => json!({
                "ok": true,
                "enqueued": true,
                "runId": "run-123",
            }),
            "cron.remove" => json!({
                "removed": true,
            }),
            _ => json!({
                "ok": true,
                "method": method,
                "params": params,
            }),
        };

        write_json_response(
            stream,
            "200 OK",
            &json!({
                "ok": true,
                "result": result,
            }),
        );
    }

    fn read_http_request(
        stream: &mut TcpStream,
    ) -> (String, std::collections::BTreeMap<String, String>, Vec<u8>) {
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .expect("gateway read timeout");

        let mut buffer = Vec::new();
        let mut chunk = [0u8; 1024];
        let mut header_end = None;
        let mut content_length = 0usize;

        loop {
            let read = stream.read(&mut chunk).expect("read gateway request");
            if read == 0 {
                break;
            }
            buffer.extend_from_slice(&chunk[..read]);

            if header_end.is_none() {
                if let Some(index) = find_bytes(&buffer, b"\r\n\r\n") {
                    let end = index + 4;
                    let header_text = String::from_utf8_lossy(&buffer[..end]);
                    content_length = parse_content_length(header_text.as_ref());
                    header_end = Some(end);
                    if buffer.len() >= end + content_length {
                        break;
                    }
                }
            } else if buffer.len() >= header_end.expect("header end") + content_length {
                break;
            }
        }

        let header_end = header_end.expect("gateway request headers");
        let header_text = String::from_utf8_lossy(&buffer[..header_end]);
        let mut lines = header_text.split("\r\n").filter(|line| !line.is_empty());
        let request_line = lines.next().expect("request line");
        let path = request_line
            .split_whitespace()
            .nth(1)
            .unwrap_or_default()
            .to_string();
        let headers = lines
            .filter_map(|line| line.split_once(':'))
            .map(|(name, value)| (name.trim().to_ascii_lowercase(), value.trim().to_string()))
            .collect::<std::collections::BTreeMap<_, _>>();
        let body = buffer[header_end..header_end + content_length].to_vec();

        (path, headers, body)
    }

    fn parse_content_length(headers: &str) -> usize {
        headers
            .lines()
            .filter_map(|line| line.split_once(':'))
            .find_map(|(name, value)| {
                if name.trim().eq_ignore_ascii_case("content-length") {
                    value.trim().parse::<usize>().ok()
                } else {
                    None
                }
            })
            .unwrap_or(0)
    }

    fn find_bytes(buffer: &[u8], needle: &[u8]) -> Option<usize> {
        buffer
            .windows(needle.len())
            .position(|window| window == needle)
    }

    fn write_json_response(stream: &mut TcpStream, status_line: &str, body: &Value) {
        let body_text = serde_json::to_string(body).expect("response json");
        let response = format!(
            "HTTP/1.1 {status_line}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
            body_text.len(),
            body_text
        );
        stream
            .write_all(response.as_bytes())
            .expect("write gateway response");
        stream.flush().expect("flush gateway response");
    }
}
