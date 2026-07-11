use super::observability_store::LocalAiProxyObservabilityStore;
use crate::framework::services::{
    local_ai_proxy_observability::LocalAiProxyObservabilityRepository,
    local_ai_proxy_snapshot::LocalAiProxySnapshot,
};
use axum::{http::StatusCode, Json};
pub use sdkwork_local_api_proxy_native::response::LocalAiProxyTokenUsage;
pub use sdkwork_local_api_proxy_native::runtime::{
    LocalAiProxyDefaultRouteHealth, LocalAiProxyLifecycle, LocalAiProxyRouteRuntimeMetrics,
    LocalAiProxyRouteTestRecord, LocalAiProxyServiceHealth, LocalAiProxyServiceStatus,
};
use serde_json::Value;
use std::{
    result::Result as StdResult,
    sync::{Arc, Mutex},
};

pub(super) type ProxyHttpResult<T> = StdResult<T, (StatusCode, Json<Value>)>;

#[derive(Clone)]
pub(super) struct LocalAiProxyAppState {
    pub(super) client: reqwest::Client,
    pub(super) snapshot: Arc<Mutex<LocalAiProxySnapshot>>,
    pub(super) observability: Arc<Mutex<LocalAiProxyObservabilityStore>>,
    pub(super) observability_repo: LocalAiProxyObservabilityRepository,
}
