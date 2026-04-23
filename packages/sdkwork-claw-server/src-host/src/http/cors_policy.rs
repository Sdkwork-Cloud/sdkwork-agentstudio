use axum::http::{
    header::{self, HeaderValue},
    HeaderMap, Method,
};

use crate::{bootstrap::ServerState, http::auth::BROWSER_SESSION_HEADER_NAME};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CorsSurface {
    StudioPublicApi,
    ManageApi,
    InternalHostPlatform,
}

fn classify_cors_surface(path: &str) -> Option<CorsSurface> {
    if path.starts_with("/claw/api/v1/studio") {
        return Some(CorsSurface::StudioPublicApi);
    }

    if path.starts_with("/claw/manage/v1/") {
        return Some(CorsSurface::ManageApi);
    }

    if path == "/claw/internal/v1/host-platform" {
        return Some(CorsSurface::InternalHostPlatform);
    }

    None
}

fn is_allowed_desktop_hosted_origin(origin: &HeaderValue) -> bool {
    let Ok(origin) = origin.to_str() else {
        return false;
    };
    let normalized = origin.trim().to_ascii_lowercase();

    normalized.starts_with("http://127.0.0.1:")
        || normalized.starts_with("https://127.0.0.1:")
        || normalized.starts_with("http://localhost:")
        || normalized.starts_with("https://localhost:")
        || normalized.starts_with("http://[::1]:")
        || normalized.starts_with("https://[::1]:")
        || normalized == "http://tauri.localhost"
        || normalized == "https://tauri.localhost"
        || normalized == "tauri://localhost"
}

pub fn is_cors_preflight_request(
    method: &Method,
    origin: Option<&HeaderValue>,
    headers: &HeaderMap,
) -> bool {
    *method == Method::OPTIONS
        && origin.is_some()
        && headers.contains_key(header::ACCESS_CONTROL_REQUEST_METHOD)
}

pub fn is_cors_controlled_surface(path: &str) -> bool {
    classify_cors_surface(path).is_some()
}

pub fn resolve_allowed_cors_origin(
    state: &ServerState,
    path: &str,
    origin: Option<&HeaderValue>,
) -> Option<HeaderValue> {
    if state.mode != "desktopCombined" {
        return None;
    }

    let surface = classify_cors_surface(path)?;
    let origin = origin?;

    if !is_allowed_desktop_hosted_origin(origin) {
        return None;
    }

    match surface {
        CorsSurface::StudioPublicApi
        | CorsSurface::ManageApi
        | CorsSurface::InternalHostPlatform => Some(origin.clone()),
    }
}

pub fn append_cors_headers(headers: &mut HeaderMap, origin: &HeaderValue) {
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin.clone());
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_str(&format!(
            "authorization, content-type, accept, {BROWSER_SESSION_HEADER_NAME}"
        ))
        .expect("allow-headers value should be valid"),
    );
    headers.insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        HeaderValue::from_static("www-authenticate, x-claw-correlation-id"),
    );
    headers.insert(
        header::VARY,
        HeaderValue::from_static(
            "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
        ),
    );
}
