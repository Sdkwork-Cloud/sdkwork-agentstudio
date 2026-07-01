use super::{
    observability_store::{LocalAiProxyObservabilityStore, LocalAiProxyRouteMetricsState},
    response_io::{extract_proxy_error_message, ProxyRouteOutcome},
    types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult},
    LocalAiProxyRouteSnapshot,
};
use crate::framework::services::local_ai_proxy_observability::{
    LocalAiProxyLoggedMessage, LocalAiProxyObservabilityRepository, LocalAiProxyRequestLogInsert,
};
use axum::{body::Bytes, http::StatusCode};
use sdkwork_local_api_proxy_native::response::{
    format_json_response_body, normalize_response_text, resolve_response_preview,
};
pub(super) use sdkwork_local_api_proxy_native::runtime::build_request_audit_projection;
use sdkwork_local_api_proxy_native::support::{current_time_ms, duration_to_ms};
use std::{
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use uuid::Uuid;

#[derive(Clone, Debug)]
pub(super) struct LocalAiProxyRequestAuditContext {
    id: String,
    created_at: u64,
    route_id: String,
    route_name: String,
    provider_id: String,
    client_protocol: String,
    upstream_protocol: String,
    endpoint: String,
    model_id: Option<String>,
    base_url: String,
    request_preview: Option<String>,
    request_body: Option<String>,
    messages: Vec<LocalAiProxyLoggedMessage>,
}

pub(super) fn record_proxy_route_outcome(
    state: &LocalAiProxyAppState,
    route: &LocalAiProxyRouteSnapshot,
    elapsed: Duration,
    result: &ProxyHttpResult<ProxyRouteOutcome>,
) {
    let now_ms = current_time_ms();
    let latency_ms = elapsed.as_millis().min(u128::from(u64::MAX)) as u64;
    let mut store = match state.observability.lock() {
        Ok(value) => value,
        Err(_) => {
            return;
        }
    };
    let entry = store
        .route_metrics
        .entry(route.id.clone())
        .or_insert_with(|| LocalAiProxyRouteMetricsState {
            client_protocol: route.client_protocol.clone(),
            upstream_protocol: route.upstream_protocol.clone(),
            ..Default::default()
        });
    entry.client_protocol = route.client_protocol.clone();
    entry.upstream_protocol = route.upstream_protocol.clone();
    entry.request_count += 1;
    entry.cumulative_latency_ms = entry.cumulative_latency_ms.saturating_add(latency_ms);
    entry.last_latency_ms = Some(latency_ms);
    entry.last_used_at = Some(now_ms);
    entry.recent_request_timestamps_ms.push_back(now_ms);
    while entry
        .recent_request_timestamps_ms
        .front()
        .copied()
        .is_some_and(|timestamp| now_ms.saturating_sub(timestamp) > 60_000)
    {
        entry.recent_request_timestamps_ms.pop_front();
    }

    match result {
        Ok(outcome) if outcome.status.is_success() => {
            entry.success_count += 1;
            entry.total_tokens = entry
                .total_tokens
                .saturating_add(outcome.usage.total_tokens);
            entry.input_tokens = entry
                .input_tokens
                .saturating_add(outcome.usage.input_tokens);
            entry.output_tokens = entry
                .output_tokens
                .saturating_add(outcome.usage.output_tokens);
            entry.cache_tokens = entry
                .cache_tokens
                .saturating_add(outcome.usage.cache_tokens);
            entry.last_error = None;
        }
        Ok(outcome) => {
            entry.failure_count += 1;
            entry.last_error =
                Some(outcome.error.clone().unwrap_or_else(|| {
                    format!("route request failed with status {}", outcome.status)
                }));
        }
        Err(error) => {
            entry.failure_count += 1;
            entry.last_error = Some(extract_proxy_error_message(error));
        }
    }
}

pub(super) fn record_proxy_route_usage_adjustment(
    observability: &Arc<Mutex<LocalAiProxyObservabilityStore>>,
    route_id: &str,
    usage: &LocalAiProxyTokenUsage,
) {
    if usage == &LocalAiProxyTokenUsage::default() {
        return;
    }

    let mut store = match observability.lock() {
        Ok(value) => value,
        Err(_) => {
            return;
        }
    };
    let Some(entry) = store.route_metrics.get_mut(route_id) else {
        return;
    };
    entry.total_tokens = entry.total_tokens.saturating_add(usage.total_tokens);
    entry.input_tokens = entry.input_tokens.saturating_add(usage.input_tokens);
    entry.output_tokens = entry.output_tokens.saturating_add(usage.output_tokens);
    entry.cache_tokens = entry.cache_tokens.saturating_add(usage.cache_tokens);
}

pub(super) fn record_proxy_request_log(
    state: &LocalAiProxyAppState,
    context: &LocalAiProxyRequestAuditContext,
    elapsed: Duration,
    result: &ProxyHttpResult<ProxyRouteOutcome>,
) {
    let insert = match result {
        Ok(outcome) => LocalAiProxyRequestLogInsert {
            id: context.id.clone(),
            created_at: context.created_at,
            route_id: context.route_id.clone(),
            route_name: context.route_name.clone(),
            provider_id: context.provider_id.clone(),
            client_protocol: context.client_protocol.clone(),
            upstream_protocol: context.upstream_protocol.clone(),
            endpoint: context.endpoint.clone(),
            status: if outcome.status.is_success() {
                "succeeded".to_string()
            } else {
                "failed".to_string()
            },
            model_id: context.model_id.clone(),
            base_url: context.base_url.clone(),
            ttft_ms: None,
            total_duration_ms: duration_to_ms(elapsed),
            total_tokens: outcome.usage.total_tokens,
            input_tokens: outcome.usage.input_tokens,
            output_tokens: outcome.usage.output_tokens,
            cache_tokens: outcome.usage.cache_tokens,
            request_preview: context.request_preview.clone(),
            response_preview: outcome.response_preview.clone(),
            error: outcome.error.clone(),
            request_body: context.request_body.clone(),
            response_body: outcome.response_body.clone(),
            response_status: Some(outcome.status.as_u16()),
            messages: context.messages.clone(),
        },
        Err((status, body)) => {
            let error = extract_proxy_error_message(&(status.clone(), body.clone()));
            let response_body = format_json_response_body(&body.0);
            LocalAiProxyRequestLogInsert {
                id: context.id.clone(),
                created_at: context.created_at,
                route_id: context.route_id.clone(),
                route_name: context.route_name.clone(),
                provider_id: context.provider_id.clone(),
                client_protocol: context.client_protocol.clone(),
                upstream_protocol: context.upstream_protocol.clone(),
                endpoint: context.endpoint.clone(),
                status: "failed".to_string(),
                model_id: context.model_id.clone(),
                base_url: context.base_url.clone(),
                ttft_ms: None,
                total_duration_ms: duration_to_ms(elapsed),
                total_tokens: 0,
                input_tokens: 0,
                output_tokens: 0,
                cache_tokens: 0,
                request_preview: context.request_preview.clone(),
                response_preview: resolve_response_preview(Some(&body.0), &error),
                error: Some(error),
                request_body: context.request_body.clone(),
                response_body,
                response_status: Some(status.as_u16()),
                messages: context.messages.clone(),
            }
        }
    };

    let _ = state.observability_repo.insert_request_log(insert);
}

pub(super) fn record_completed_stream_request_log(
    repository: &LocalAiProxyObservabilityRepository,
    context: LocalAiProxyRequestAuditContext,
    status: StatusCode,
    started_at: Instant,
    usage: LocalAiProxyTokenUsage,
    ttft_ms: Option<u64>,
    response_text: Option<String>,
) {
    let response_preview = response_text
        .as_ref()
        .and_then(|value| normalize_response_text(value));
    let _ = repository.insert_request_log(LocalAiProxyRequestLogInsert {
        id: context.id,
        created_at: context.created_at,
        route_id: context.route_id,
        route_name: context.route_name,
        provider_id: context.provider_id,
        client_protocol: context.client_protocol,
        upstream_protocol: context.upstream_protocol,
        endpoint: context.endpoint,
        status: if status.is_success() {
            "succeeded".to_string()
        } else {
            "failed".to_string()
        },
        model_id: context.model_id,
        base_url: context.base_url,
        ttft_ms,
        total_duration_ms: duration_to_ms(started_at.elapsed()),
        total_tokens: usage.total_tokens,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_tokens: usage.cache_tokens,
        request_preview: context.request_preview,
        response_preview: response_preview.clone(),
        error: (!status.is_success()).then(|| format!("stream completed with status {status}")),
        request_body: context.request_body,
        response_body: response_text,
        response_status: Some(status.as_u16()),
        messages: context.messages,
    });
}

pub(super) fn build_request_audit_context(
    route: &LocalAiProxyRouteSnapshot,
    endpoint: &str,
    body: &Bytes,
) -> LocalAiProxyRequestAuditContext {
    let projection = build_request_audit_projection(route, endpoint, body);

    LocalAiProxyRequestAuditContext {
        id: Uuid::new_v4().simple().to_string(),
        created_at: current_time_ms(),
        route_id: route.id.clone(),
        route_name: route.name.clone(),
        provider_id: route.provider_id.clone(),
        client_protocol: route.client_protocol.clone(),
        upstream_protocol: route.upstream_protocol.clone(),
        endpoint: endpoint.to_string(),
        model_id: projection.model_id,
        base_url: route.upstream_base_url.clone(),
        request_preview: projection.request_preview,
        request_body: projection.request_body,
        messages: projection.messages,
    }
}
