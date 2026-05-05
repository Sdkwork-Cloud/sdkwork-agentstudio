use axum::{
    http::{
        header::{self, WWW_AUTHENTICATE},
        HeaderMap, HeaderValue, StatusCode,
    },
    response::Response,
};
use base64::Engine;
use sdkwork_claw_host_core::internal::error::{InternalErrorCategory, InternalErrorResolution};

use crate::{bootstrap::ServerState, http::error_response::categorized_error_response};

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

pub fn authorize_manage_request(headers: &HeaderMap, state: &ServerState) -> Result<(), Response> {
    authorize_surface(
        headers,
        state.auth.manage.as_ref(),
        browser_session_token_for_surface(state),
        "claw-manage",
        state.host_platform_updated_at(),
    )
}

pub fn authorize_internal_request(
    headers: &HeaderMap,
    state: &ServerState,
) -> Result<(), Response> {
    authorize_surface(
        headers,
        state.auth.internal.as_ref(),
        browser_session_token_for_surface(state),
        "claw-internal",
        state.host_platform_updated_at(),
    )
}

pub fn authorize_browser_request(headers: &HeaderMap, state: &ServerState) -> Result<(), Response> {
    authorize_surface(
        headers,
        state.auth.manage.as_ref(),
        None,
        "claw-manage",
        state.host_platform_updated_at(),
    )
}

pub fn authorize_public_studio_request(
    headers: &HeaderMap,
    state: &ServerState,
) -> Result<(), Response> {
    let Some(browser_session_token) = browser_session_token_for_surface(state) else {
        return Ok(());
    };

    if request_matches_browser_session(headers, browser_session_token) {
        return Ok(());
    }

    Err(browser_session_unauthorized_response(
        state.host_platform_updated_at(),
    ))
}

fn authorize_surface(
    headers: &HeaderMap,
    credentials: Option<&BasicAuthCredentials>,
    browser_session_token: Option<&str>,
    realm: &'static str,
    now_ms: u64,
) -> Result<(), Response> {
    if let Some(browser_session_token) = browser_session_token {
        if request_matches_browser_session(headers, browser_session_token) {
            return Ok(());
        }

        if credentials.is_some_and(|value| request_matches_basic_auth(headers, value)) {
            return Ok(());
        }

        return Err(browser_session_unauthorized_response(now_ms));
    }

    let Some(credentials) = credentials else {
        return Ok(());
    };

    if request_matches_basic_auth(headers, credentials) {
        return Ok(());
    }

    Err(unauthorized_response(realm, now_ms))
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

fn unauthorized_response(realm: &'static str, now_ms: u64) -> Response {
    let mut response = categorized_error_response(
        "auth_required",
        InternalErrorCategory::Auth,
        "Authentication is required for this control-plane surface.",
        StatusCode::UNAUTHORIZED,
        false,
        InternalErrorResolution::ReAuthenticate,
        now_ms,
    );
    if let Ok(header_value) = HeaderValue::from_str(&format!("Basic realm=\"{realm}\"")) {
        response.headers_mut().insert(WWW_AUTHENTICATE, header_value);
    }
    response
}

fn browser_session_unauthorized_response(now_ms: u64) -> Response {
    let mut response = categorized_error_response(
        "auth_required",
        InternalErrorCategory::Auth,
        "A valid browser session token is required for this control-plane surface.",
        StatusCode::UNAUTHORIZED,
        false,
        InternalErrorResolution::ReAuthenticate,
        now_ms,
    );
    if let Ok(header_value) =
        HeaderValue::from_str(&format!("Bearer realm=\"{BROWSER_SESSION_REALM}\""))
    {
        response.headers_mut().insert(WWW_AUTHENTICATE, header_value);
    }
    response
}
