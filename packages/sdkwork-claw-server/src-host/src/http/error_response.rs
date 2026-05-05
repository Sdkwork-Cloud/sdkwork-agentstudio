use axum::{
    http::{header::HeaderName, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use sdkwork_claw_host_core::internal::error::{
    InternalErrorCategory, InternalErrorEnvelope, InternalErrorResolution,
};
use std::sync::atomic::{AtomicU64, Ordering};

static ERROR_SEQUENCE: AtomicU64 = AtomicU64::new(1);

pub fn categorized_error_response(
    code: &str,
    category: InternalErrorCategory,
    message: &str,
    status: StatusCode,
    retryable: bool,
    resolution: InternalErrorResolution,
    now_ms: u64,
) -> Response {
    envelope_error_response(
        InternalErrorEnvelope::new(
            code,
            category,
            message,
            status.as_u16(),
            retryable,
            resolution,
        ),
        status,
        now_ms,
    )
}

pub fn validation_error_response(
    code: &str,
    message: &str,
    status: StatusCode,
    now_ms: u64,
) -> Response {
    categorized_error_response(
        code,
        InternalErrorCategory::Validation,
        message,
        status,
        false,
        InternalErrorResolution::FixRequest,
        now_ms,
    )
}

pub fn envelope_error_response(
    envelope: InternalErrorEnvelope,
    status: StatusCode,
    now_ms: u64,
) -> Response {
    let correlation_id = next_error_correlation_id(now_ms);
    let envelope = envelope.with_transport_context(correlation_id.clone(), now_ms.to_string());
    let mut response = (status, Json(envelope)).into_response();
    let header_name = HeaderName::from_static("x-claw-correlation-id");
    if let Ok(header_value) = axum::http::HeaderValue::from_str(&correlation_id) {
        response.headers_mut().insert(header_name, header_value);
    }
    response
}

fn next_error_correlation_id(now_ms: u64) -> String {
    let sequence = ERROR_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("req-{now_ms}-{sequence}")
}
