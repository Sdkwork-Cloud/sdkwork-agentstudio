//! SDKWork API envelope helpers — `SdkWorkApiResponse` (success) and
//! `SdkWorkProblemDetail` (RFC 9457 error) per `API_SPEC.md` §14–§16.
//!
//! All HTTP handlers in this server MUST route responses through these helpers
//! to guarantee wire-level compliance with the SDKWork platform standard.

use axum::{
    http::{header, HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use sdkwork_utils_rust::{
    SdkWorkApiResponse, SdkWorkPageData, SdkWorkProblemDetail, SdkWorkResultCode,
    SdkWorkResourceData, PageInfo, SDKWORK_TRACE_ID_HEADER,
};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TRACE_SEQUENCE: AtomicU64 = AtomicU64::new(1);

/// Generate a server-side trace ID for request correlation.
///
/// Format: `req-{unix_ms}-{sequence}` — stable, lexicographically sortable,
/// and safe for use in HTTP headers and JSON bodies.
pub fn next_trace_id() -> String {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default();
    let seq = TRACE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("req-{now_ms}-{seq}")
}

/// Wrap any serializable data in the canonical `SdkWorkApiResponse` success
/// envelope and return an `axum::Response` with the `X-SdkWork-Trace-Id` header.
///
/// ```json
/// { "code": 0, "data": <T>, "traceId": "req-..." }
/// ```
pub fn api_success<T: serde::Serialize>(data: T, trace_id: &str) -> Response {
    let body = SdkWorkApiResponse::success(data, trace_id);
    let mut response = Json(body).into_response();
    insert_trace_header(&mut response, trace_id);
    response
}

/// Wrap a single resource in `SdkWorkResourceData<T>` then in the success
/// envelope. Use for `GET /resource/{id}` style endpoints.
#[allow(dead_code)]
pub fn api_resource<T: serde::Serialize>(item: T, trace_id: &str) -> Response {
    api_success(SdkWorkResourceData { item }, trace_id)
}

/// Wrap a paginated list in `SdkWorkPageData<T>` then in the success envelope.
/// Use for all list/search endpoints per `API_SPEC.md` §16 and `PAGINATION_SPEC.md`.
///
/// ```json
/// { "code": 0, "data": { "items": [...], "pageInfo": {...} }, "traceId": "req-..." }
/// ```
pub fn api_list_success<T: serde::Serialize>(
    items: Vec<T>,
    page_info: PageInfo,
    trace_id: &str,
) -> Response {
    let data = SdkWorkPageData { items, page_info };
    api_success(data, trace_id)
}

/// Build an RFC 9457 `application/problem+json` error response.
pub fn api_problem(
    result_code: SdkWorkResultCode,
    detail: impl Into<String>,
    trace_id: &str,
) -> Response {
    let problem = SdkWorkProblemDetail::platform(result_code, detail, trace_id);
    let status = StatusCode::from_u16(result_code.http_status_code())
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    let mut response = (status, Json(problem)).into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/problem+json"),
    );
    insert_trace_header(&mut response, trace_id);
    response
}

/// Convenience: build a validation-error problem response (HTTP 400).
#[allow(dead_code)]
pub fn api_validation_error(detail: impl Into<String>, trace_id: &str) -> Response {
    api_problem(SdkWorkResultCode::ValidationError, detail, trace_id)
}

/// Convenience: build a not-found problem response (HTTP 404).
#[allow(dead_code)]
pub fn api_not_found(detail: impl Into<String>, trace_id: &str) -> Response {
    api_problem(SdkWorkResultCode::NotFound, detail, trace_id)
}

/// Convenience: build an authentication-required problem response (HTTP 401).
pub fn api_unauthorized(detail: impl Into<String>, trace_id: &str) -> Response {
    api_problem(SdkWorkResultCode::AuthenticationRequired, detail, trace_id)
}

/// Convenience: build a service-unavailable problem response (HTTP 503).
#[allow(dead_code)]
pub fn api_service_unavailable(detail: impl Into<String>, trace_id: &str) -> Response {
    api_problem(SdkWorkResultCode::ServiceUnavailable, detail, trace_id)
}

/// Convenience: build an internal-error problem response (HTTP 500).
#[allow(dead_code)]
pub fn api_internal_error(detail: impl Into<String>, trace_id: &str) -> Response {
    api_problem(SdkWorkResultCode::InternalError, detail, trace_id)
}

/// Wrapper type for handler return values — automatically wraps data in the
/// canonical `SdkWorkApiResponse` success envelope when converted to a response.
///
/// # Example
///
/// ```rust,ignore
/// async fn handler() -> Result<ApiResponse<Value>, Response> {
///     Ok(ApiResponse(json!({ "status": "ok" })))
/// }
/// ```
#[allow(dead_code)]
pub struct ApiResponse<T: serde::Serialize>(pub T);

impl<T: serde::Serialize> IntoResponse for ApiResponse<T> {
    fn into_response(self) -> Response {
        let trace_id = next_trace_id();
        api_success(self.0, &trace_id)
    }
}

fn insert_trace_header(response: &mut Response, trace_id: &str) {
    if let Ok(value) = HeaderValue::from_str(trace_id) {
        response
            .headers_mut()
            .insert(HeaderName::from_static(SDKWORK_TRACE_ID_HEADER), value);
    }
}
