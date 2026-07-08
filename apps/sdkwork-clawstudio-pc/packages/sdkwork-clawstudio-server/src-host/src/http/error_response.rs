//! Error response helpers — bridges legacy `InternalErrorCategory` callers to
//! the canonical `SdkWorkProblemDetail` (RFC 9457) wire format per
//! `API_SPEC.md` §15.2.
//!
//! All functions in this module produce `application/problem+json` responses
//! with numeric `code`, `traceId`, and `status` fields. The legacy string
//! codes are preserved as the `detail` prefix for diagnostic correlation but
//! the wire envelope is fully SDKWork-standard-compliant.

use axum::{
    http::StatusCode,
    response::Response,
};
use sdkwork_clawstudio_host_core::internal::error::{
    InternalErrorCategory, InternalErrorEnvelope, InternalErrorResolution,
};
use sdkwork_utils_rust::SdkWorkResultCode;

use crate::http::api_envelope::{api_problem, next_trace_id};

/// Map legacy `InternalErrorCategory` to the platform `SdkWorkResultCode`.
fn category_to_result_code(category: InternalErrorCategory) -> SdkWorkResultCode {
    match category {
        InternalErrorCategory::Auth | InternalErrorCategory::Session => {
            SdkWorkResultCode::AuthenticationRequired
        }
        InternalErrorCategory::Trust => SdkWorkResultCode::PermissionRequired,
        InternalErrorCategory::Compatibility | InternalErrorCategory::Validation => {
            SdkWorkResultCode::ValidationError
        }
        InternalErrorCategory::State => SdkWorkResultCode::Conflict,
        InternalErrorCategory::Dependency => SdkWorkResultCode::ServiceUnavailable,
        InternalErrorCategory::System => SdkWorkResultCode::InternalError,
    }
}

/// Build an RFC 9457 problem response from a legacy categorized error.
///
/// The `code` parameter (legacy string code) is prepended to the `detail`
/// field for diagnostic correlation. The HTTP body uses the standard
/// `SdkWorkProblemDetail` structure with a numeric `code` field.
#[allow(clippy::too_many_arguments)]
pub fn categorized_error_response(
    code: &str,
    category: InternalErrorCategory,
    message: &str,
    status: StatusCode,
    _retryable: bool,
    _resolution: InternalErrorResolution,
    _now_ms: u64,
) -> Response {
    let result_code = category_to_result_code(category);
    // If the status code doesn't match the result code's standard HTTP status,
    // prefer the explicit status code but keep the numeric code from the category.
    let trace_id = next_trace_id();
    let detail = format!("[{code}] {message}");

    // For status code mismatches, use the closest SdkWorkResultCode
    let effective_code = if status.as_u16() == result_code.http_status_code() {
        result_code
    } else {
        status_to_result_code(status, result_code)
    };

    api_problem(effective_code, detail, &trace_id)
}

/// Build a validation-error problem response (HTTP 400).
pub fn validation_error_response(
    code: &str,
    message: &str,
    status: StatusCode,
    _now_ms: u64,
) -> Response {
    let trace_id = next_trace_id();
    let detail = format!("[{code}] {message}");
    let result_code = if status == StatusCode::BAD_REQUEST {
        SdkWorkResultCode::ValidationError
    } else {
        status_to_result_code(status, SdkWorkResultCode::ValidationError)
    };
    api_problem(result_code, detail, &trace_id)
}

/// Build an RFC 9457 problem response from a legacy `InternalErrorEnvelope`.
///
/// This bridges the older structured error envelope to the canonical
/// `SdkWorkProblemDetail` wire format. The envelope's `code` and `message`
/// are combined into the `detail` field for diagnostic correlation.
pub fn envelope_error_response(
    envelope: InternalErrorEnvelope,
    status: StatusCode,
    _now_ms: u64,
) -> Response {
    let error = envelope.error;
    let result_code = category_to_result_code(error.category);
    let trace_id = next_trace_id();
    let detail = format!("[{}] {}", error.code, error.message);

    let effective_code = if status.as_u16() == result_code.http_status_code() {
        result_code
    } else {
        status_to_result_code(status, result_code)
    };

    api_problem(effective_code, detail, &trace_id)
}

/// Map an HTTP status code to the closest `SdkWorkResultCode`, falling back
/// to the provided `default_code` when no precise match exists.
fn status_to_result_code(
    status: StatusCode,
    default_code: SdkWorkResultCode,
) -> SdkWorkResultCode {
    match status.as_u16() {
        400 => SdkWorkResultCode::ValidationError,
        401 => SdkWorkResultCode::AuthenticationRequired,
        403 => SdkWorkResultCode::PermissionRequired,
        404 => SdkWorkResultCode::NotFound,
        405 => SdkWorkResultCode::MethodNotAllowed,
        408 => SdkWorkResultCode::RequestTimeout,
        409 => SdkWorkResultCode::Conflict,
        413 => SdkWorkResultCode::PayloadTooLarge,
        415 => SdkWorkResultCode::UnsupportedMediaType,
        422 => SdkWorkResultCode::UnprocessableEntity,
        429 => SdkWorkResultCode::RateLimitExceeded,
        500 => SdkWorkResultCode::InternalError,
        502 => SdkWorkResultCode::BadGateway,
        503 => SdkWorkResultCode::ServiceUnavailable,
        504 => SdkWorkResultCode::GatewayTimeout,
        _ => default_code,
    }
}
