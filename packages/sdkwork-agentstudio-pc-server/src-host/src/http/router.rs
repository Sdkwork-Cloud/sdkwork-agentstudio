//! Claw-server HTTP router — integrates `sdkwork-web-framework` 18-stage
//! interceptor pipeline for CORS, request identity, rate limiting, health,
//! metrics, and OpenAPI materialization.
//!
//! ## Auth model
//!
//! This server is a **control-plane standalone** profile. Authentication for
//! manage/internal routes is enforced by the existing basic-auth middleware
//! (`auth.rs`). The framework's pipeline handles infrastructure concerns
//! (CORS, request identity, method guard, request size limit, logging).
//! All routes are declared `Public` in the route manifest so the framework
//! skips JWT-based authentication/authorization stages; business-level auth
//! is delegated to the middleware layer.
//!
//! ## CORS model
//!
//! The framework's 18-stage pipeline includes a CORS interceptor (stage 3)
//! that validates origins and applies `Access-Control-Allow-Origin` /
//! `Access-Control-Allow-Methods` headers. A `DynamicCorsPolicySource`
//! (`ClawServerCorsPolicySource`) provides per-origin policy resolution for
//! loopback and Tauri desktop origins.
//!
//! Because the framework does not short-circuit OPTIONS preflight requests
//! and does not emit `Access-Control-Allow-Headers` / `Access-Control-Expose-Headers`,
//! a thin preflight middleware (`host_control_plane_cors`) is applied at the
//! business-router level to handle preflight short-circuiting and to append
//! the missing CORS headers to both preflight and actual responses.

use axum::{
    body::Body,
    extract::{Request, State},
    http::{
        header::{self, HeaderValue},
        HeaderMap, Method, StatusCode,
    },
    middleware::{from_fn_with_state, Next},
    response::{IntoResponse, Response},
    Router,
};
use sdkwork_web_axum::{with_web_request_context, WebFrameworkLayer};
use sdkwork_web_bootstrap::{init_tracing_from_env, mount_infra_routes, ServiceRouterConfig};
use sdkwork_web_core::{
    CorsPolicy, DynamicCorsPolicySource, WebEnvironment, WebFrameworkOptionalFeatures,
    WebRequestContextProfile, WebRequestContextResolver, WebRequestPrincipal,
};
use std::sync::Arc;

use crate::bootstrap::ServerState;
use crate::http::route_manifest::claw_server_route_manifest;
use crate::http::routes::api_public::api_public_routes;
use crate::http::routes::health::health_routes;
use crate::http::routes::internal_node_sessions::internal_node_session_routes;
use crate::http::routes::local_ai_compat::local_ai_compat_routes;
use crate::http::routes::manage_openclaw::manage_openclaw_routes;
use crate::http::routes::manage_rollouts::manage_rollout_routes;
use crate::http::routes::manage_service::manage_service_routes;
use crate::http::routes::openapi::openapi_routes;
use crate::http::routes::openclaw_gateway_proxy::openclaw_gateway_proxy_routes;
use crate::http::static_assets::StaticAssetMount;

// ── CORS policy source ──────────────────────────────────────────────────────

/// Dynamic CORS policy source for the control-plane standalone profile.
///
/// Allows private-network development origins and Tauri desktop origins.
/// Returns a per-origin `CorsPolicy` overlay that the framework's CORS
/// interceptor uses for origin validation and header application.
///
/// This replaces the previous static CORS middleware with a framework-native
/// `DynamicCorsPolicySource` (EP-16), keeping CORS policy resolution within
/// the 18-stage interceptor pipeline.
pub struct ClawServerCorsPolicySource;

#[async_trait::async_trait]
impl DynamicCorsPolicySource for ClawServerCorsPolicySource {
    async fn resolve(
        &self,
        ctx: &sdkwork_web_core::CorsPolicyContext,
    ) -> Result<Option<CorsPolicy>, sdkwork_web_core::WebFrameworkError> {
        let Some(origin) = &ctx.origin else {
            return Ok(None);
        };

        if !is_allowed_desktop_hosted_origin(origin) {
            return Ok(None);
        }

        // Return a per-origin policy overlay. The framework's CORS stage will
        // use this to validate the origin and apply Allow-Origin / Allow-Methods
        // headers. The preflight middleware supplements with Allow-Headers.
        Ok(Some(CorsPolicy {
            allow_all_origins: false,
            allowed_origins: vec![origin.clone()],
            allowed_methods: vec![
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::DELETE,
                Method::PATCH,
                Method::OPTIONS,
            ],
            allowed_headers: vec![
                "authorization".to_owned(),
                "content-type".to_owned(),
                "accept".to_owned(),
                "x-claw-browser-session".to_owned(),
                "x-sdkwork-trace-id".to_owned(),
            ],
            allow_credentials: true,
        }))
    }
}

/// Returns true if the origin is a private-network development or Tauri desktop origin.
fn is_allowed_desktop_hosted_origin(origin: &str) -> bool {
    let normalized = origin.trim().to_ascii_lowercase();

    sdkwork_web_core::is_development_private_network_origin(origin)
        || normalized == "http://tauri.localhost"
        || normalized == "https://tauri.localhost"
        || normalized == "tauri://localhost"
}

// ── Preflight middleware ────────────────────────────────────────────────────

/// CORS preflight and header-supplement middleware for desktop-combined mode.
///
/// This middleware complements the framework's CORS interceptor by:
/// 1. Short-circuiting OPTIONS preflight requests with a 204 response that
///    includes all required CORS headers.
/// 2. Appending `Access-Control-Allow-Headers`, `Access-Control-Expose-Headers`,
///    and `Vary` headers to non-preflight responses from allowed origins.
///
/// The framework's CORS stage handles `Access-Control-Allow-Origin` and
/// `Access-Control-Allow-Methods`; this middleware ensures the full set of
/// CORS headers required by browser clients is present.
pub async fn host_control_plane_cors(
    State(state): State<ServerState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let origin = request.headers().get(header::ORIGIN).cloned();
    let is_options = *request.method() == Method::OPTIONS;
    let has_acrm = request
        .headers()
        .contains_key(header::ACCESS_CONTROL_REQUEST_METHOD);

    // Only apply CORS in desktop-combined mode.
    let active = state.mode == "desktopCombined";
    let allowed_origin = if active {
        origin
            .as_ref()
            .filter(|o| {
                o.to_str()
                    .map(is_allowed_desktop_hosted_origin)
                    .unwrap_or(false)
            })
            .cloned()
    } else {
        None
    };

    // Short-circuit preflight requests.
    if is_options && origin.is_some() && has_acrm {
        if let Some(ref origin_value) = allowed_origin {
            let mut response = StatusCode::NO_CONTENT.into_response();
            append_supplemental_cors_headers(response.headers_mut(), origin_value);
            return response;
        }
    }

    let mut response = next.run(request).await;
    if let Some(ref origin_value) = allowed_origin {
        append_supplemental_cors_headers(response.headers_mut(), origin_value);
    }
    response
}

/// Append the CORS headers that the framework's CORS stage does not emit:
/// `Access-Control-Allow-Origin` (if not already present), `Access-Control-Allow-Headers`,
/// `Access-Control-Expose-Headers`, and `Vary`.
fn append_supplemental_cors_headers(headers: &mut HeaderMap, origin: &HeaderValue) {
    // Only add Allow-Origin if the framework hasn't already added it.
    if !headers.contains_key(header::ACCESS_CONTROL_ALLOW_ORIGIN) {
        headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin.clone());
    }
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PUT, DELETE, PATCH, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static(
            "authorization, content-type, accept, x-claw-browser-session, x-sdkwork-trace-id",
        ),
    );
    headers.insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        HeaderValue::from_static("www-authenticate, x-claw-correlation-id, x-sdkwork-trace-id"),
    );
    headers.insert(
        header::VARY,
        HeaderValue::from_static(
            "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
        ),
    );
}

// ── Resolver ────────────────────────────────────────────────────────────────

/// A control-plane standalone resolver that returns a synthetic public
/// principal for all requests. Business-level authentication is enforced
/// by the existing basic-auth middleware layer.
#[derive(Clone)]
pub struct ClawServerResolver;

#[async_trait::async_trait]
impl WebRequestContextResolver for ClawServerResolver {
    async fn resolve_api_key(
        &self,
        _raw_api_key: &str,
    ) -> Result<WebRequestPrincipal, sdkwork_web_core::WebFrameworkError> {
        Err(sdkwork_web_core::WebFrameworkError::dependency_unavailable(
            "api-key resolution is not configured; this server uses basic-auth middleware",
        ))
    }

    async fn resolve_dual_token(
        &self,
        _raw_auth_token: &str,
        _raw_access_token: &str,
    ) -> Result<WebRequestPrincipal, sdkwork_web_core::WebFrameworkError> {
        Err(sdkwork_web_core::WebFrameworkError::dependency_unavailable(
            "dual-token resolution is not configured; this server uses basic-auth middleware",
        ))
    }

    async fn resolve_access_token(
        &self,
        _raw_access_token: &str,
    ) -> Result<WebRequestPrincipal, sdkwork_web_core::WebFrameworkError> {
        Err(sdkwork_web_core::WebFrameworkError::dependency_unavailable(
            "access-token resolution is not configured; this server uses basic-auth middleware",
        ))
    }
}

// ── Router builder ──────────────────────────────────────────────────────────

/// Build the complete HTTP router with the sdkwork-web-framework pipeline.
///
/// Architecture (assembled in order):
/// 1. Business routes (studio API, manage, internal, gateway proxy) — `Router<ServerState>`
/// 2. Static asset mount (SPA fallback, bootstrap descriptor) — `Router<ServerState>`
/// 3. CORS preflight middleware (desktop-combined mode) — `Router<ServerState>`
/// 4. Framework infra routes (healthz, readyz, metrics) — `Router<ServerState>`
/// 5. State erasure: `.with_state(state)` → `Router<()>`
/// 6. Framework 18-stage interceptor layer via `with_web_request_context` → `Router<()>`
pub fn build_router(state: ServerState) -> Router {
    // Initialize structured tracing from environment.
    init_tracing_from_env();

    let manifest = claw_server_route_manifest();
    let assets = StaticAssetMount::from_web_dist(state.web_dist_dir.clone());

    // ── Business routes (Router<ServerState>) ───────────────────────────
    let manage_router = if state.supports_manage_service_api() {
        manage_rollout_routes()
            .merge(manage_service_routes())
            .merge(manage_openclaw_routes())
    } else {
        manage_rollout_routes().merge(manage_openclaw_routes())
    };

    let mut business_router = Router::new()
        .nest("/claw/health", health_routes())
        .nest("/claw/api/v1", api_public_routes())
        .nest("/claw/openapi", openapi_routes())
        .nest("/claw/internal/v1", internal_node_session_routes())
        .nest("/claw/manage/v1", manage_router)
        .merge(openclaw_gateway_proxy_routes());

    if state.local_ai_proxy_target_provider.is_some() {
        business_router = business_router.merge(local_ai_compat_routes());
    }

    // ── Attach static assets (SPA fallback) — still Router<ServerState> ─
    let business_router = assets.attach(business_router);

    // ── CORS preflight middleware — still Router<ServerState> ─────────────
    let business_router =
        business_router.layer(from_fn_with_state(state.clone(), host_control_plane_cors));

    // ── Framework infra routes (healthz, readyz, metrics) ───────────────
    let service_config = ServiceRouterConfig::default().with_always_ready();

    let router = mount_infra_routes(business_router, service_config);

    // ── State erasure: Router<ServerState> → Router<()> ─────────────────
    let router = router.with_state(state);

    // ── Framework 18-stage interceptor layer ────────────────────────────
    let profile = WebRequestContextProfile {
        app_api_prefix: "/claw/api".to_owned(),
        backend_api_prefix: "/claw/manage".to_owned(),
        open_api_prefixes: vec!["/claw/openapi".to_owned()],
        public_path_prefixes: vec![
            "/claw/health".to_owned(),
            "/claw/api".to_owned(),
            "/claw/openapi".to_owned(),
            "/claw/internal".to_owned(),
            "/claw/manage".to_owned(),
            "/claw/gateway".to_owned(),
            "/healthz".to_owned(),
            "/readyz".to_owned(),
            "/livez".to_owned(),
            "/metrics".to_owned(),
        ],
        gateway_api_prefixes: vec!["/claw/gateway".to_owned()],
        environment: WebEnvironment::Dev,
    };

    let mut features = WebFrameworkOptionalFeatures::default().control_plane_standalone();
    features.dynamic_cors_policy = true;

    let framework_layer = WebFrameworkLayer::new(ClawServerResolver)
        .with_profile(profile)
        .with_route_manifest(manifest)
        .with_dynamic_cors_policy_source(Arc::new(ClawServerCorsPolicySource))
        .with_optional_features(features);

    // Apply the 18-stage interceptor pipeline (CORS, request identity,
    // method guard, request size limit, logging, etc.).
    with_web_request_context(router, framework_layer)
}
