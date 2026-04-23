use super::{
    is_loopback_host,
    observability_store::{lock_observability, LocalAiProxyObservabilityStore},
    request_context,
    types::{
        LocalAiProxyAppState, LocalAiProxyRouteRuntimeMetrics, LocalAiProxyRouteTestRecord,
        LocalAiProxyServiceHealth, ProxyHttpResult,
    },
    LocalAiProxyRouteSnapshot, LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL,
};
use crate::framework::{paths::AppPaths, Result};
use axum::{extract::State, http::StatusCode, Json};
pub(super) use sdkwork_local_api_proxy_native::runtime::reconcile_observability_store;
use sdkwork_local_api_proxy_native::runtime::{
    build_route_metrics as project_route_metrics, collect_default_route_health,
    collect_route_tests as project_route_tests,
};
use sdkwork_local_api_proxy_native::support::proxy_error;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

pub(super) fn build_route_metrics(
    snapshot: &super::LocalAiProxySnapshot,
    observability: &Arc<Mutex<LocalAiProxyObservabilityStore>>,
) -> Result<Vec<LocalAiProxyRouteRuntimeMetrics>> {
    let store = lock_observability(observability)?;
    Ok(project_route_metrics(snapshot, &store))
}

pub(super) fn collect_route_tests(
    snapshot: &super::LocalAiProxySnapshot,
    observability: &Arc<Mutex<LocalAiProxyObservabilityStore>>,
) -> Result<Vec<LocalAiProxyRouteTestRecord>> {
    let store = lock_observability(observability)?;
    Ok(project_route_tests(snapshot, &store))
}

pub(super) async fn health_handler(
    State(state): State<LocalAiProxyAppState>,
) -> ProxyHttpResult<Json<Value>> {
    let snapshot = request_context::current_snapshot(&state)?;
    let route = snapshot.default_route().ok_or_else(|| {
        proxy_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "No active default route is available for the local AI proxy.",
        )
    })?;
    let default_routes = collect_default_route_health(&snapshot);

    Ok(Json(json!({
        "status": "ok",
        "service": "local-ai-proxy",
        "defaultRouteId": route.id,
        "defaultRouteName": route.name,
        "modelCount": route.models.len(),
        "upstreamBaseUrl": route.upstream_base_url,
        "defaultRoutes": default_routes.iter().map(|item| json!({
            "clientProtocol": item.client_protocol,
            "id": item.id,
            "name": item.name,
            "managedBy": item.managed_by,
            "upstreamProtocol": item.upstream_protocol,
            "upstreamBaseUrl": item.upstream_base_url,
            "modelCount": item.model_count,
        })).collect::<Vec<_>>(),
    })))
}

pub(super) fn build_health(
    snapshot: &super::LocalAiProxySnapshot,
    active_port: u16,
    public_base_host: &str,
    paths: &AppPaths,
) -> LocalAiProxyServiceHealth {
    let default_routes = collect_default_route_health(snapshot);
    let route = snapshot
        .default_route()
        .cloned()
        .unwrap_or_else(|| LocalAiProxyRouteSnapshot {
            id: snapshot.default_route_id.clone(),
            name: "Unavailable".to_string(),
            enabled: false,
            is_default: true,
            managed_by: "system-default".to_string(),
            client_protocol: LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL.to_string(),
            upstream_protocol: "sdkwork".to_string(),
            provider_id: "sdkwork".to_string(),
            upstream_base_url: String::new(),
            api_key: String::new(),
            default_model_id: String::new(),
            reasoning_model_id: None,
            embedding_model_id: None,
            models: Vec::new(),
            notes: None,
            expose_to: Vec::new(),
            runtime_config: Default::default(),
        });

    LocalAiProxyServiceHealth {
        base_url: format!("http://{}:{}/v1", public_base_host.trim(), active_port),
        active_port,
        loopback_only: is_loopback_host(snapshot.bind_host.trim()),
        default_route_id: route.id,
        default_route_name: route.name,
        default_routes,
        upstream_base_url: route.upstream_base_url,
        model_count: route.models.len(),
        snapshot_path: paths
            .local_ai_proxy_snapshot_file
            .to_string_lossy()
            .into_owned(),
        log_path: paths.local_ai_proxy_log_file.to_string_lossy().into_owned(),
    }
}
