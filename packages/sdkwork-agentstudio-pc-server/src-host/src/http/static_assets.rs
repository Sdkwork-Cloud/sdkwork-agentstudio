use std::fs;
use std::path::{Component, Path, PathBuf};

use axum::{
    body::Body,
    extract::State,
    http::{header, HeaderValue, StatusCode, Uri},
    response::{Html, IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Serialize;

use crate::{
    bootstrap::ServerState,
    http::{api_envelope::next_trace_id, auth::authorize_browser_request},
};

const DEFAULT_STUDIO_API_BASE_PATH: &str = "/claw/api/v1";
const DEFAULT_MANAGE_BASE_PATH: &str = "/claw/manage/v1";
const DEFAULT_INTERNAL_BASE_PATH: &str = "/claw/internal/v1";
const BROWSER_SESSION_TOKEN_META_NAME: &str = "sdkwork-agentstudio-pc-browser-session-token";
const SERVER_BROWSER_BOOTSTRAP_DESCRIPTOR_PATH: &str = "/sdkwork-agentstudio-pc-bootstrap.json";

#[derive(Clone, Debug, PartialEq, Eq)]
struct ServerBrowserHostMetadata {
    mode: &'static str,
    distribution_family: &'static str,
    deployment_family: String,
    accelerator_profile: Option<String>,
    api_base_path: &'static str,
    manage_base_path: &'static str,
    internal_base_path: &'static str,
    browser_session_token: Option<String>,
}

#[derive(Debug, Clone)]
pub struct StaticAssetMount {
    dist_dir: PathBuf,
}

impl StaticAssetMount {
    pub fn from_web_dist(path: impl AsRef<Path>) -> Self {
        Self {
            dist_dir: PathBuf::from(path.as_ref()),
        }
    }

    pub fn attach(self, router: Router<ServerState>) -> Router<ServerState> {
        let dist_dir = self.dist_dir.clone();
        router
            .route(
                SERVER_BROWSER_BOOTSTRAP_DESCRIPTOR_PATH,
                get(get_browser_bootstrap_descriptor),
            )
            .fallback(get(
                move |State(state): State<ServerState>,
                      headers: axum::http::HeaderMap,
                      uri: Uri| {
                    let dist_dir = dist_dir.clone();
                    let request_path = uri.path().to_string();
                    async move {
                        let trace_id = next_trace_id();
                        if let Err(response) =
                            authorize_browser_request(&headers, &state, &trace_id)
                        {
                            return response;
                        }

                        serve_browser_path(
                            dist_dir,
                            &request_path,
                            ServerBrowserHostMetadata::from_state(&state),
                        )
                        .await
                    }
                },
            ))
    }
}

impl ServerBrowserHostMetadata {
    fn from_state(state: &ServerState) -> Self {
        Self {
            mode: state.mode,
            distribution_family: state.host_platform_distribution_family(),
            deployment_family: state.deployment_family.clone(),
            accelerator_profile: state.accelerator_profile.clone(),
            api_base_path: DEFAULT_STUDIO_API_BASE_PATH,
            manage_base_path: DEFAULT_MANAGE_BASE_PATH,
            internal_base_path: DEFAULT_INTERNAL_BASE_PATH,
            browser_session_token: state.auth.browser_session_token.clone(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ServerBrowserBootstrapDescriptor {
    mode: &'static str,
    distribution_family: &'static str,
    deployment_family: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    accelerator_profile: Option<String>,
    api_base_path: &'static str,
    manage_base_path: &'static str,
    internal_base_path: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    browser_session_token: Option<String>,
}

impl ServerBrowserBootstrapDescriptor {
    fn from_state(state: &ServerState) -> Self {
        ServerBrowserHostMetadata::from_state(state).into()
    }
}

impl From<ServerBrowserHostMetadata> for ServerBrowserBootstrapDescriptor {
    fn from(host_metadata: ServerBrowserHostMetadata) -> Self {
        Self {
            mode: host_metadata.mode,
            distribution_family: host_metadata.distribution_family,
            deployment_family: host_metadata.deployment_family,
            accelerator_profile: host_metadata.accelerator_profile,
            api_base_path: host_metadata.api_base_path,
            manage_base_path: host_metadata.manage_base_path,
            internal_base_path: host_metadata.internal_base_path,
            browser_session_token: host_metadata.browser_session_token,
        }
    }
}

async fn get_browser_bootstrap_descriptor(
    headers: axum::http::HeaderMap,
    State(state): State<ServerState>,
) -> Result<Json<ServerBrowserBootstrapDescriptor>, Response> {
    let trace_id = next_trace_id();
    authorize_browser_request(&headers, &state, &trace_id)?;
    Ok(Json(ServerBrowserBootstrapDescriptor::from_state(&state)))
}

async fn serve_browser_path(
    dist_dir: PathBuf,
    request_path: &str,
    host_metadata: ServerBrowserHostMetadata,
) -> Response {
    if request_path == "/claw" || request_path.starts_with("/claw/") {
        return StatusCode::NOT_FOUND.into_response();
    }

    if let Some(relative_path) = resolve_browser_relative_path(request_path) {
        let candidate_path = dist_dir.join(&relative_path);

        if candidate_path.is_file() {
            return serve_static_file(candidate_path);
        }

        if candidate_path.extension().is_some() {
            return StatusCode::NOT_FOUND.into_response();
        }
    }

    serve_index_html(dist_dir, host_metadata).await
}

async fn serve_index_html(dist_dir: PathBuf, host_metadata: ServerBrowserHostMetadata) -> Response {
    let index_path = dist_dir.join("index.html");
    match fs::read_to_string(index_path) {
        Ok(html) => Html(inject_server_host_metadata(&html, host_metadata)).into_response(),
        Err(_) => StatusCode::SERVICE_UNAVAILABLE.into_response(),
    }
}

fn inject_server_host_metadata(html: &str, host_metadata: ServerBrowserHostMetadata) -> String {
    let browser_session_metadata = host_metadata
        .browser_session_token
        .as_deref()
        .map(|token| {
            format!(
                "\n    <meta name=\"{BROWSER_SESSION_TOKEN_META_NAME}\" content=\"{}\" />\n",
                escape_html_attribute(token)
            )
        })
        .unwrap_or_default();
    let accelerator_metadata = host_metadata
        .accelerator_profile
        .as_deref()
        .map(|profile| {
            format!(
                "\n    <meta name=\"sdkwork-agentstudio-pc-accelerator-profile\" content=\"{}\" />",
                escape_html_attribute(profile)
            )
        })
        .unwrap_or_default();
    let metadata = format!(
        "\n    <meta name=\"sdkwork-agentstudio-pc-host-mode\" content=\"{}\" />\n    <meta name=\"sdkwork-agentstudio-pc-distribution-family\" content=\"{}\" />\n    <meta name=\"sdkwork-agentstudio-pc-deployment-family\" content=\"{}\" />{}\n    <meta name=\"sdkwork-agentstudio-pc-api-base-path\" content=\"{}\" />\n    <meta name=\"sdkwork-agentstudio-pc-manage-base-path\" content=\"{}\" />\n    <meta name=\"sdkwork-agentstudio-pc-internal-base-path\" content=\"{}\" />{}\n",
        escape_html_attribute(host_metadata.mode),
        escape_html_attribute(host_metadata.distribution_family),
        escape_html_attribute(host_metadata.deployment_family.as_str()),
        accelerator_metadata,
        escape_html_attribute(host_metadata.api_base_path),
        escape_html_attribute(host_metadata.manage_base_path),
        escape_html_attribute(host_metadata.internal_base_path),
        browser_session_metadata,
    );
    let sanitized_html = strip_server_host_metadata(html);

    match sanitized_html.find("</head>") {
        Some(index) => {
            let mut injected = String::with_capacity(sanitized_html.len() + metadata.len());
            injected.push_str(&sanitized_html[..index]);
            injected.push_str(&metadata);
            injected.push_str(&sanitized_html[index..]);
            injected
        }
        None => format!("{metadata}{sanitized_html}"),
    }
}

fn escape_html_attribute(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            _ => escaped.push(ch),
        }
    }
    escaped
}

fn strip_server_host_metadata(html: &str) -> String {
    [
        "sdkwork-agentstudio-pc-host-mode",
        "sdkwork-agentstudio-pc-distribution-family",
        "sdkwork-agentstudio-pc-deployment-family",
        "sdkwork-agentstudio-pc-accelerator-profile",
        "sdkwork-agentstudio-pc-api-base-path",
        "sdkwork-agentstudio-pc-manage-base-path",
        "sdkwork-agentstudio-pc-internal-base-path",
        BROWSER_SESSION_TOKEN_META_NAME,
    ]
    .into_iter()
    .fold(html.to_string(), |next_html, meta_name| {
        strip_meta_tag_by_name(&next_html, meta_name)
    })
}

fn strip_meta_tag_by_name(html: &str, meta_name: &str) -> String {
    let double_quoted_name = format!("name=\"{meta_name}\"");
    let single_quoted_name = format!("name='{meta_name}'");
    let mut stripped = String::with_capacity(html.len());
    let mut cursor = 0;

    while let Some(relative_tag_start) = html[cursor..].find("<meta") {
        let tag_start = cursor + relative_tag_start;
        stripped.push_str(&html[cursor..tag_start]);

        let Some(relative_tag_end) = html[tag_start..].find('>') else {
            stripped.push_str(&html[tag_start..]);
            return stripped;
        };

        let tag_end = tag_start + relative_tag_end + 1;
        let tag = &html[tag_start..tag_end];
        if !(tag.contains(&double_quoted_name) || tag.contains(&single_quoted_name)) {
            stripped.push_str(tag);
        }

        cursor = tag_end;
    }

    stripped.push_str(&html[cursor..]);
    stripped
}

fn resolve_browser_relative_path(request_path: &str) -> Option<PathBuf> {
    let trimmed_path = request_path.trim_start_matches('/');
    if trimmed_path.is_empty() {
        return None;
    }

    let mut relative_path = PathBuf::new();
    for component in Path::new(trimmed_path).components() {
        match component {
            Component::Normal(value) => relative_path.push(value),
            _ => return None,
        }
    }

    if relative_path.as_os_str().is_empty() {
        None
    } else {
        Some(relative_path)
    }
}

fn serve_static_file(path: PathBuf) -> Response {
    match fs::read(&path) {
        Ok(body) => {
            let mut response = Response::new(Body::from(body));
            *response.status_mut() = StatusCode::OK;
            response.headers_mut().insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static(content_type_for_path(&path)),
            );
            response
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

fn content_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
    {
        "css" => "text/css; charset=utf-8",
        "js" => "application/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "html" => "text/html; charset=utf-8",
        "txt" => "text/plain; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use axum::body::to_bytes;
    use axum::http::StatusCode;

    use super::{
        inject_server_host_metadata, serve_browser_path, ServerBrowserHostMetadata,
        BROWSER_SESSION_TOKEN_META_NAME, DEFAULT_INTERNAL_BASE_PATH, DEFAULT_MANAGE_BASE_PATH,
        DEFAULT_STUDIO_API_BASE_PATH,
    };

    #[test]
    fn inject_server_host_metadata_marks_server_mode_and_base_paths() {
        let html = inject_server_host_metadata(
            "<html><head></head><body></body></html>",
            ServerBrowserHostMetadata {
                mode: "server",
                distribution_family: "server",
                deployment_family: "bareMetal".to_string(),
                accelerator_profile: Some("cpu".to_string()),
                api_base_path: DEFAULT_STUDIO_API_BASE_PATH,
                manage_base_path: DEFAULT_MANAGE_BASE_PATH,
                internal_base_path: DEFAULT_INTERNAL_BASE_PATH,
                browser_session_token: None,
            },
        );

        assert!(html.contains("sdkwork-agentstudio-pc-host-mode"));
        assert!(html.contains("sdkwork-agentstudio-pc-distribution-family"));
        assert!(html.contains("sdkwork-agentstudio-pc-deployment-family"));
        assert!(html.contains("sdkwork-agentstudio-pc-accelerator-profile"));
        assert!(html.contains("sdkwork-agentstudio-pc-api-base-path"));
        assert!(html.contains("sdkwork-agentstudio-pc-manage-base-path"));
        assert!(html.contains("sdkwork-agentstudio-pc-internal-base-path"));
        assert!(html.contains("content=\"server\""));
        assert!(html.contains("content=\"bareMetal\""));
        assert!(html.contains("content=\"cpu\""));
    }

    #[test]
    fn inject_server_host_metadata_marks_desktop_combined_mode_when_requested() {
        let html = inject_server_host_metadata(
            "<html><head></head><body></body></html>",
            ServerBrowserHostMetadata {
                mode: "desktopCombined",
                distribution_family: "desktop",
                deployment_family: "container".to_string(),
                accelerator_profile: None,
                api_base_path: DEFAULT_STUDIO_API_BASE_PATH,
                manage_base_path: DEFAULT_MANAGE_BASE_PATH,
                internal_base_path: DEFAULT_INTERNAL_BASE_PATH,
                browser_session_token: None,
            },
        );

        assert!(html.contains("content=\"desktopCombined\""));
        assert!(html.contains("content=\"desktop\""));
        assert!(html.contains("content=\"container\""));
    }

    #[test]
    fn inject_server_host_metadata_refreshes_existing_host_metadata_values() {
        let html = inject_server_host_metadata(
            "<html><head>\
<meta name=\"sdkwork-agentstudio-pc-host-mode\" content=\"desktopCombined\" />\
<meta name=\"sdkwork-agentstudio-pc-distribution-family\" content=\"desktop\" />\
<meta name=\"sdkwork-agentstudio-pc-deployment-family\" content=\"bareMetal\" />\
<meta name=\"sdkwork-agentstudio-pc-accelerator-profile\" content=\"cpu\" />\
<meta name=\"sdkwork-agentstudio-pc-api-base-path\" content=\"/wrong/api\" />\
<meta name=\"sdkwork-agentstudio-pc-manage-base-path\" content=\"/wrong/manage\" />\
<meta name=\"sdkwork-agentstudio-pc-internal-base-path\" content=\"/wrong/internal\" />\
<meta name=\"sdkwork-agentstudio-pc-browser-session-token\" content=\"stale-token\" />\
</head><body></body></html>",
            ServerBrowserHostMetadata {
                mode: "server",
                distribution_family: "server",
                deployment_family: "kubernetes".to_string(),
                accelerator_profile: Some("nvidia-cuda".to_string()),
                api_base_path: DEFAULT_STUDIO_API_BASE_PATH,
                manage_base_path: DEFAULT_MANAGE_BASE_PATH,
                internal_base_path: DEFAULT_INTERNAL_BASE_PATH,
                browser_session_token: Some("fresh-token".to_string()),
            },
        );

        assert!(html.contains("<meta name=\"sdkwork-agentstudio-pc-host-mode\" content=\"server\" />"));
        assert!(
            html.contains("<meta name=\"sdkwork-agentstudio-pc-distribution-family\" content=\"server\" />")
        );
        assert!(html
            .contains("<meta name=\"sdkwork-agentstudio-pc-deployment-family\" content=\"kubernetes\" />"));
        assert!(html.contains(
            "<meta name=\"sdkwork-agentstudio-pc-accelerator-profile\" content=\"nvidia-cuda\" />"
        ));
        assert!(html.contains(&format!(
            "<meta name=\"{BROWSER_SESSION_TOKEN_META_NAME}\" content=\"fresh-token\" />"
        )));
        assert!(html.contains(&format!(
            "<meta name=\"sdkwork-agentstudio-pc-api-base-path\" content=\"{DEFAULT_STUDIO_API_BASE_PATH}\" />"
        )));
        assert!(html.contains(&format!(
            "<meta name=\"sdkwork-agentstudio-pc-manage-base-path\" content=\"{DEFAULT_MANAGE_BASE_PATH}\" />"
        )));
        assert!(html.contains(&format!(
            "<meta name=\"sdkwork-agentstudio-pc-internal-base-path\" content=\"{DEFAULT_INTERNAL_BASE_PATH}\" />"
        )));
        assert!(!html.contains("content=\"desktopCombined\""));
        assert!(!html.contains("content=\"bareMetal\""));
        assert!(!html.contains("content=\"stale-token\""));
        assert!(!html.contains("content=\"/wrong/api\""));
        assert!(!html.contains("content=\"/wrong/manage\""));
        assert!(!html.contains("content=\"/wrong/internal\""));
    }

    #[test]
    fn inject_server_host_metadata_removes_stale_optional_metadata_when_unconfigured() {
        let html = inject_server_host_metadata(
            "<html><head>\
<meta name=\"sdkwork-agentstudio-pc-host-mode\" content=\"server\" />\
<meta name=\"sdkwork-agentstudio-pc-distribution-family\" content=\"server\" />\
<meta name=\"sdkwork-agentstudio-pc-deployment-family\" content=\"container\" />\
<meta name=\"sdkwork-agentstudio-pc-accelerator-profile\" content=\"amd-rocm\" />\
<meta name=\"sdkwork-agentstudio-pc-api-base-path\" content=\"/claw/api/v1\" />\
<meta name=\"sdkwork-agentstudio-pc-manage-base-path\" content=\"/claw/manage/v1\" />\
<meta name=\"sdkwork-agentstudio-pc-internal-base-path\" content=\"/claw/internal/v1\" />\
<meta name=\"sdkwork-agentstudio-pc-browser-session-token\" content=\"stale-token\" />\
</head><body></body></html>",
            ServerBrowserHostMetadata {
                mode: "server",
                distribution_family: "server",
                deployment_family: "container".to_string(),
                accelerator_profile: None,
                api_base_path: DEFAULT_STUDIO_API_BASE_PATH,
                manage_base_path: DEFAULT_MANAGE_BASE_PATH,
                internal_base_path: DEFAULT_INTERNAL_BASE_PATH,
                browser_session_token: None,
            },
        );

        assert!(!html.contains("sdkwork-agentstudio-pc-accelerator-profile"));
        assert!(!html.contains(BROWSER_SESSION_TOKEN_META_NAME));
        assert!(!html.contains("stale-token"));
        assert!(
            html.contains("<meta name=\"sdkwork-agentstudio-pc-deployment-family\" content=\"container\" />")
        );
    }

    #[test]
    fn inject_server_host_metadata_escapes_dynamic_metadata_values() {
        let html = inject_server_host_metadata(
            "<html><head></head><body></body></html>",
            ServerBrowserHostMetadata {
                mode: "server",
                distribution_family: "server",
                deployment_family: "k8s\"edge\"&<prod>'".to_string(),
                accelerator_profile: Some("nvidia&\"cuda\"<'prod'>".to_string()),
                api_base_path: "/claw/api/v1?tenant=\"core\"&mode=<prod>",
                manage_base_path: "/claw/manage/v1?token='quoted'",
                internal_base_path: "/claw/internal/v1?scope=prod&kind=\"internal\"",
                browser_session_token: Some("session-<&>\"'".to_string()),
            },
        );

        assert!(html.contains(
            "<meta name=\"sdkwork-agentstudio-pc-deployment-family\" content=\"k8s&quot;edge&quot;&amp;&lt;prod&gt;&#39;\" />"
        ));
        assert!(html.contains(
            "<meta name=\"sdkwork-agentstudio-pc-accelerator-profile\" content=\"nvidia&amp;&quot;cuda&quot;&lt;&#39;prod&#39;&gt;\" />"
        ));
        assert!(html.contains(
            "<meta name=\"sdkwork-agentstudio-pc-api-base-path\" content=\"/claw/api/v1?tenant=&quot;core&quot;&amp;mode=&lt;prod&gt;\" />"
        ));
        assert!(html.contains(
            "<meta name=\"sdkwork-agentstudio-pc-manage-base-path\" content=\"/claw/manage/v1?token=&#39;quoted&#39;\" />"
        ));
        assert!(html.contains(
            "<meta name=\"sdkwork-agentstudio-pc-internal-base-path\" content=\"/claw/internal/v1?scope=prod&amp;kind=&quot;internal&quot;\" />"
        ));
        assert!(html.contains(&format!(
            "<meta name=\"{BROWSER_SESSION_TOKEN_META_NAME}\" content=\"session-&lt;&amp;&gt;&quot;&#39;\" />"
        )));
        assert!(!html.contains("content=\"k8s\"edge\"&<prod>'\""));
        assert!(!html.contains("content=\"session-<&>\"'\""));
    }

    #[tokio::test]
    async fn serve_browser_path_prefers_real_asset_files_before_index_fallback() {
        let dist_dir = create_test_dist_dir();
        let assets_dir = dist_dir.join("assets");
        fs::create_dir_all(&assets_dir).expect("assets directory should be created");
        fs::write(
            dist_dir.join("index.html"),
            "<html><head></head><body><div id=\"root\"></div></body></html>",
        )
        .expect("index.html should be written");
        fs::write(assets_dir.join("app.js"), "console.log('asset ok');")
            .expect("asset file should be written");

        let response = serve_browser_path(
            dist_dir,
            "/assets/app.js",
            ServerBrowserHostMetadata {
                mode: "server",
                distribution_family: "server",
                deployment_family: "bareMetal".to_string(),
                accelerator_profile: None,
                api_base_path: DEFAULT_STUDIO_API_BASE_PATH,
                manage_base_path: DEFAULT_MANAGE_BASE_PATH,
                internal_base_path: DEFAULT_INTERNAL_BASE_PATH,
                browser_session_token: None,
            },
        )
        .await;
        let status = response.status();
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("asset response body should be readable");
        let text = String::from_utf8(body.to_vec()).expect("asset response body should be utf-8");

        assert_eq!(status, StatusCode::OK);
        assert!(content_type.contains("javascript"));
        assert_eq!(text, "console.log('asset ok');");
    }

    fn create_test_dist_dir() -> std::path::PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "sdkwork-agentstudio-standalone-gateway-static-assets-{}-{unique_suffix}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("test dist directory should be created");
        directory
    }
}
