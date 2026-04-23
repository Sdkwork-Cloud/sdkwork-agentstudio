use axum::{
    body::Body,
    extract::State,
    http::{
        header::{self},
        Request, StatusCode,
    },
    middleware::{self, Next},
    response::{IntoResponse, Response},
    Router,
};

use crate::bootstrap::ServerState;
use crate::http::cors_policy::{
    append_cors_headers, is_cors_controlled_surface, is_cors_preflight_request,
    resolve_allowed_cors_origin,
};
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

pub fn build_router(state: ServerState) -> Router {
    let assets = StaticAssetMount::from_web_dist(state.web_dist_dir.clone());
    let manage_router = if state.supports_manage_service_api() {
        manage_rollout_routes()
            .merge(manage_service_routes())
            .merge(manage_openclaw_routes())
    } else {
        manage_rollout_routes().merge(manage_openclaw_routes())
    };
    let mut router = Router::new()
        .nest("/claw/health", health_routes())
        .nest("/claw/api/v1", api_public_routes())
        .nest("/claw/openapi", openapi_routes())
        .nest("/claw/internal/v1", internal_node_session_routes())
        .nest("/claw/manage/v1", manage_router)
        .merge(openclaw_gateway_proxy_routes());

    if state.local_ai_proxy_target_provider.is_some() {
        router = router.merge(local_ai_compat_routes());
    }

    assets
        .attach(router)
        .with_state(state.clone())
        .layer(middleware::from_fn_with_state(
            state,
            host_control_plane_cors,
        ))
}

async fn host_control_plane_cors(
    State(state): State<ServerState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let path = request.uri().path().to_string();
    let origin = request.headers().get(header::ORIGIN).cloned();
    let allowed_origin = resolve_allowed_cors_origin(&state, &path, origin.as_ref());
    let is_preflight =
        is_cors_preflight_request(request.method(), origin.as_ref(), request.headers());

    if is_preflight {
        if let Some(origin) = allowed_origin.as_ref() {
            let mut response = StatusCode::NO_CONTENT.into_response();
            append_cors_headers(response.headers_mut(), origin);
            return response;
        }

        if is_cors_controlled_surface(&path) {
            return StatusCode::FORBIDDEN.into_response();
        }
    }

    let mut response = next.run(request).await;
    if let Some(origin) = allowed_origin.as_ref() {
        append_cors_headers(response.headers_mut(), origin);
    }
    response
}
