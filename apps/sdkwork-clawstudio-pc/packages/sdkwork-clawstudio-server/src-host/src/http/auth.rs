//! Authentication middleware for the control-plane standalone profile.
//!
//! This server uses basic-auth and browser-session token authentication
//! enforced at the business-middleware layer. The framework's 18-stage
//! pipeline handles infrastructure concerns (CORS, request identity, method
//! guard, request size limit, logging). All routes are declared `Public` in
//! the route manifest so the framework skips JWT-based authentication stages;
//! business-level auth is delegated to the functions in this module.
//!
//! Auth error responses use the canonical `SdkWorkProblemDetail` (RFC 9457)
//! wire format via `api_unauthorized` from `api_envelope.rs`, ensuring
//! compliance with `API_SPEC.md` §15.2.

use axum::{
    http::{
        header::{self, WWW_AUTHENTICATE},
        HeaderMap, HeaderValue,
    },
    response::Response,
};
use base64::Engine;

use crate::bootstrap::ServerState;
use crate::http::api_envelope::api_unauthorized;

pub const BROWSER_SESSION_HEADER_NAME: &str = "x-claw-browser-session";
const BROWSER_SESSION_REALM: &str = "claw-browser-session";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BasicAuthCredentials {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ServerAuthConfig {
    pub manage: Option<BasicAuthCredentials>,
    pub internal: Option<BasicAuthCredentials>,
    pub browser_session_token: Option<String>,
}

/// Authorize a manage-surface request.
///
/// Returns `Ok(())` if the request carries valid basic-auth credentials or
/// a valid browser-session token; otherwise returns an `SdkWorkProblemDetail`
/// 401 response with a `WWW-Authenticate` challenge header.
pub fn authorize_manage_request(
    headers: &HeaderMap,
    state: &ServerState,
    trace_id: &str,
) -> Result<(), Response> {
    authorize_surface(
        headers,
        state.auth.manage.as_ref(),
        browser_session_token_for_surface(state),
        "claw-manage",
        trace_id,
    )
}

/// Authorize an internal-surface request.
///
/// Uses the `internal` credentials set (or browser-session token in
/// desktop-combined mode).
pub fn authorize_internal_request(
    headers: &HeaderMap,
    state: &ServerState,
    trace_id: &str,
) -> Result<(), Response> {
    authorize_surface(
        headers,
        state.auth.internal.as_ref(),
        browser_session_token_for_surface(state),
        "claw-internal",
        trace_id,
    )
}

/// Authorize a browser-surface request (manage credentials, no session token).
pub fn authorize_browser_request(
    headers: &HeaderMap,
    state: &ServerState,
    trace_id: &str,
) -> Result<(), Response> {
    authorize_surface(
        headers,
        state.auth.manage.as_ref(),
        None,
        "claw-manage",
        trace_id,
    )
}

/// Authorize a public studio API request.
///
/// If no browser-session token is configured, the request is allowed (open
/// access). Otherwise the request must carry a matching session token.
pub fn authorize_public_studio_request(
    headers: &HeaderMap,
    state: &ServerState,
    trace_id: &str,
) -> Result<(), Response> {
    let Some(browser_session_token) = browser_session_token_for_surface(state) else {
        return Ok(());
    };

    if request_matches_browser_session(headers, browser_session_token) {
        return Ok(());
    }

    Err(browser_session_unauthorized_response(trace_id))
}

fn authorize_surface(
    headers: &HeaderMap,
    credentials: Option<&BasicAuthCredentials>,
    browser_session_token: Option<&str>,
    realm: &'static str,
    trace_id: &str,
) -> Result<(), Response> {
    if let Some(browser_session_token) = browser_session_token {
        if request_matches_browser_session(headers, browser_session_token) {
            return Ok(());
        }

        if credentials.is_some_and(|value| request_matches_basic_auth(headers, value)) {
            return Ok(());
        }

        return Err(browser_session_unauthorized_response(trace_id));
    }

    let Some(credentials) = credentials else {
        return Ok(());
    };

    if request_matches_basic_auth(headers, credentials) {
        return Ok(());
    }

    Err(unauthorized_response(realm, trace_id))
}

fn request_matches_basic_auth(headers: &HeaderMap, credentials: &BasicAuthCredentials) -> bool {
    let Some(value) = headers.get(header::AUTHORIZATION) else {
        return false;
    };
    let Ok(value) = value.to_str() else {
        return false;
    };
    let Some(encoded) = value.strip_prefix("Basic ") else {
        return false;
    };
    let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(encoded) else {
        return false;
    };
    let Ok(decoded) = String::from_utf8(decoded) else {
        return false;
    };

    decoded == format!("{}:{}", credentials.username, credentials.password)
}

fn request_matches_browser_session(headers: &HeaderMap, browser_session_token: &str) -> bool {
    headers
        .get(BROWSER_SESSION_HEADER_NAME)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value == browser_session_token)
}

fn browser_session_token_for_surface(state: &ServerState) -> Option<&str> {
    if state.mode == "desktopCombined" {
        return state.auth.browser_session_token.as_deref();
    }

    None
}

/// Build a 401 problem response with a `Basic` challenge for manage/internal
/// surfaces.
fn unauthorized_response(realm: &'static str, trace_id: &str) -> Response {
    let mut response = api_unauthorized(
        format!("Authentication is required for this control-plane surface (realm=\"{realm}\")."),
        trace_id,
    );
    if let Ok(header_value) = HeaderValue::from_str(&format!("Basic realm=\"{realm}\"")) {
        response.headers_mut().insert(WWW_AUTHENTICATE, header_value);
    }
    response
}

/// Build a 401 problem response with a `Bearer` challenge for browser-session
/// surfaces.
fn browser_session_unauthorized_response(trace_id: &str) -> Response {
    let mut response = api_unauthorized(
        "A valid browser session token is required for this control-plane surface.",
        trace_id,
    );
    if let Ok(header_value) =
        HeaderValue::from_str(&format!("Bearer realm=\"{BROWSER_SESSION_REALM}\""))
    {
        response.headers_mut().insert(WWW_AUTHENTICATE, header_value);
    }
    response
}
