use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::{json, Value};

use crate::bootstrap::ServerState;
use crate::http::routes::openapi::{
    build_local_ai_compat_document, build_native_v1_document, build_openclaw_gateway_document,
};

pub const CLAW_NATIVE_DOCUMENT_ID: &str = "claw-native-v1";
pub const CLAW_NATIVE_DOCUMENT_URL: &str = "/claw/openapi/v1.json";
pub const LOCAL_AI_COMPAT_DOCUMENT_ID: &str = "local-ai-compat-v1";
pub const LOCAL_AI_COMPAT_DOCUMENT_URL: &str = "/claw/openapi/local-ai-compat-v1.json";
pub const OPENCLAW_GATEWAY_DOCUMENT_ID: &str = "openclaw-gateway-v1";
pub const OPENCLAW_GATEWAY_DOCUMENT_URL: &str = "/claw/openapi/openclaw-gateway-v1.json";

pub const LOCAL_AI_COMPAT_PATHS: &[&str] = &[
    "/health",
    "/v1/health",
    "/v1/models",
    "/v1/chat/completions",
    "/v1/responses",
    "/v1/embeddings",
    "/v1/messages",
    "/v1beta/models",
    "/v1beta/models/{modelAction}",
    "/v1/models/{modelAction}",
];

pub const OPENCLAW_GATEWAY_PATHS: &[&str] = &["/claw/gateway/openclaw/tools/invoke"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublishedProxyTarget {
    pub id: &'static str,
    pub base_url: String,
    pub auth_token: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishedOpenApiDocument {
    pub id: &'static str,
    pub title: &'static str,
    pub version: &'static str,
    pub format: &'static str,
    pub url: &'static str,
    pub api_families: Vec<&'static str>,
    pub proxy_target: &'static str,
    pub runtime_capability: &'static str,
    pub generated_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiSurfaceCatalog {
    pub generated_at: u64,
    pub documents: Vec<PublishedOpenApiDocument>,
    pub gateway_endpoints: Vec<String>,
}

pub fn build_api_surface_catalog(state: &ServerState) -> ApiSurfaceCatalog {
    let generated_at = state.resource_projection_updated_at();
    let mut documents = vec![PublishedOpenApiDocument {
        id: CLAW_NATIVE_DOCUMENT_ID,
        title: "Claw Native Platform API",
        version: "v1",
        format: "openapi+json",
        url: CLAW_NATIVE_DOCUMENT_URL,
        api_families: vec!["health", "api", "internal", "manage"],
        proxy_target: "native-host",
        runtime_capability: "always",
        generated_at,
    }];
    let mut gateway_endpoints = vec![
        "/claw/openapi/discovery".to_string(),
        CLAW_NATIVE_DOCUMENT_URL.to_string(),
    ];

    if state.local_ai_proxy_target().is_some() {
        documents.push(PublishedOpenApiDocument {
            id: LOCAL_AI_COMPAT_DOCUMENT_ID,
            title: "Local AI Compatibility API",
            version: "v1",
            format: "openapi+json",
            url: LOCAL_AI_COMPAT_DOCUMENT_URL,
            api_families: vec!["health", "openai-compatible", "anthropic", "gemini"],
            proxy_target: "local-ai-proxy",
            runtime_capability: "local-ai-proxy",
            generated_at,
        });
        gateway_endpoints.push(LOCAL_AI_COMPAT_DOCUMENT_URL.to_string());
        gateway_endpoints.extend(LOCAL_AI_COMPAT_PATHS.iter().map(|path| (*path).to_string()));
    }

    if state.openclaw_gateway_target().is_some() {
        documents.push(PublishedOpenApiDocument {
            id: OPENCLAW_GATEWAY_DOCUMENT_ID,
            title: "OpenClaw Gateway Proxy API",
            version: "v1",
            format: "openapi+json",
            url: OPENCLAW_GATEWAY_DOCUMENT_URL,
            api_families: vec!["openclaw-gateway"],
            proxy_target: "openclaw-gateway",
            runtime_capability: "openclaw-gateway-http",
            generated_at,
        });
        gateway_endpoints.push(OPENCLAW_GATEWAY_DOCUMENT_URL.to_string());
        gateway_endpoints.extend(
            OPENCLAW_GATEWAY_PATHS
                .iter()
                .map(|path| (*path).to_string()),
        );
    }

    ApiSurfaceCatalog {
        generated_at,
        documents,
        gateway_endpoints,
    }
}

pub fn build_openapi_discovery(state: &ServerState) -> Value {
    let catalog = build_api_surface_catalog(state);
    json!({
        "family": "openapi",
        "hostMode": state.mode,
        "generatedAt": catalog.generated_at,
        "documents": catalog.documents,
    })
}

pub fn build_openapi_document(state: &ServerState, document_id: &str) -> Option<Value> {
    match document_id {
        CLAW_NATIVE_DOCUMENT_ID => Some(build_native_v1_document(state)),
        LOCAL_AI_COMPAT_DOCUMENT_ID if state.local_ai_proxy_target().is_some() => {
            Some(build_local_ai_compat_document(state))
        }
        OPENCLAW_GATEWAY_DOCUMENT_ID if state.openclaw_gateway_target().is_some() => {
            Some(build_openclaw_gateway_document(state))
        }
        _ => None,
    }
}

pub fn write_runtime_openapi_snapshots(
    state: &ServerState,
    _base_url: &str,
) -> io::Result<Vec<PathBuf>> {
    let output_dir = state
        .runtime_contract
        .runtime_config
        .data_dir
        .join("openapi");
    fs::create_dir_all(&output_dir)?;

    let mut written_paths = Vec::new();
    let discovery_path = output_dir.join("discovery.json");
    write_json_atomic(&discovery_path, &build_openapi_discovery(state))?;
    written_paths.push(discovery_path);

    for document in build_api_surface_catalog(state).documents {
        if let Some(schema) = build_openapi_document(state, document.id) {
            let document_path = output_dir.join(format!("{}.json", document.id));
            write_json_atomic(&document_path, &schema)?;
            written_paths.push(document_path);
        }
    }

    Ok(written_paths)
}

pub fn build_openapi_startup_catalog(state: &ServerState, base_url: &str) -> Value {
    let catalog = build_api_surface_catalog(state);
    let trimmed_base_url = base_url.trim_end_matches('/');
    json!({
        "kind": "sdkworkClawOpenApiCatalog",
        "hostMode": state.mode,
        "hostBaseUrl": trimmed_base_url,
        "openapiDiscoveryUrl": format!("{trimmed_base_url}/claw/openapi/discovery"),
        "documents": catalog.documents.iter().map(|document| json!({
            "id": document.id,
            "url": document.url,
            "absoluteUrl": format!("{trimmed_base_url}{}", document.url),
            "proxyTarget": document.proxy_target,
            "runtimeCapability": document.runtime_capability,
            "generatedAt": document.generated_at,
        })).collect::<Vec<_>>(),
        "gatewayEndpoints": catalog.gateway_endpoints.iter().map(|path| {
            Value::String(format!("{trimmed_base_url}{path}"))
        }).collect::<Vec<_>>(),
    })
}

fn write_json_atomic(path: &Path, value: &Value) -> io::Result<()> {
    let parent = path.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "runtime openapi snapshot path must have a parent directory",
        )
    })?;
    fs::create_dir_all(parent)?;
    let temp_path = path.with_extension(format!("{}.tmp", std::process::id()));
    fs::write(
        &temp_path,
        serde_json::to_vec_pretty(value).map_err(io::Error::other)?,
    )?;
    if path.exists() {
        fs::remove_file(path)?;
    }
    fs::rename(temp_path, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::Arc;

    use sdkwork_claw_host_core::host_endpoints::{
        HostEndpointRegistration, HostEndpointRegistry, OpenClawLifecycle,
    };
    use sdkwork_claw_host_core::openclaw_control_plane::OpenClawControlPlane;

    use super::{
        build_api_surface_catalog, write_runtime_openapi_snapshots, PublishedProxyTarget,
        CLAW_NATIVE_DOCUMENT_ID, LOCAL_AI_COMPAT_DOCUMENT_ID, OPENCLAW_GATEWAY_DOCUMENT_ID,
    };
    use crate::bootstrap::{
        build_control_plane_manage_openclaw_provider, build_server_state_with_overrides,
        build_server_state_with_rollout_data_dir, LocalAiProxyTargetProvider,
        LocalAiProxyTargetProviderHandle, ServerStateOverrides,
    };

    #[derive(Debug)]
    struct StaticLocalAiProxyTargetProvider;

    impl LocalAiProxyTargetProvider for StaticLocalAiProxyTargetProvider {
        fn local_ai_proxy_target(&self) -> Option<PublishedProxyTarget> {
            Some(PublishedProxyTarget {
                id: "local-ai-proxy",
                base_url: "http://127.0.0.1:18888".to_string(),
                auth_token: None,
            })
        }
    }

    #[test]
    fn build_api_surface_catalog_returns_the_native_document_by_default() {
        let state = build_server_state_with_rollout_data_dir(test_rollout_dir("native-only"));

        let catalog = build_api_surface_catalog(&state);

        assert_eq!(catalog.documents.len(), 1);
        assert_eq!(catalog.documents[0].id, CLAW_NATIVE_DOCUMENT_ID);
    }

    #[test]
    fn build_api_surface_catalog_includes_local_ai_document_when_the_proxy_target_is_available() {
        let state = build_server_state_with_overrides(
            test_rollout_dir("local-ai"),
            ServerStateOverrides {
                local_ai_proxy_target_provider: Some(LocalAiProxyTargetProviderHandle::new(
                    Arc::new(StaticLocalAiProxyTargetProvider),
                )),
                ..ServerStateOverrides::default()
            },
        );

        let catalog = build_api_surface_catalog(&state);

        assert!(catalog
            .documents
            .iter()
            .any(|document| document.id == LOCAL_AI_COMPAT_DOCUMENT_ID));
    }

    #[test]
    fn build_api_surface_catalog_includes_openclaw_gateway_document_when_the_gateway_is_ready() {
        let mut host_endpoints = HostEndpointRegistry::default();
        host_endpoints.register(HostEndpointRegistration {
            endpoint_id: "openclaw-gateway".to_string(),
            bind_host: "127.0.0.1".to_string(),
            requested_port: 18_871,
            active_port: Some(18_871),
            scheme: "http".to_string(),
            base_path: None,
            websocket_path: None,
            loopback_only: true,
            dynamic_port: false,
            last_conflict_at: None,
            last_conflict_reason: None,
        });
        let manage_openclaw_provider = build_control_plane_manage_openclaw_provider(Arc::new(
            OpenClawControlPlane::inactive("test")
                .with_host_endpoints(host_endpoints)
                .with_gateway_endpoint("openclaw-gateway", OpenClawLifecycle::Ready),
        ));
        let state = build_server_state_with_overrides(
            test_rollout_dir("openclaw-gateway"),
            ServerStateOverrides {
                manage_openclaw_provider: Some(manage_openclaw_provider),
                ..ServerStateOverrides::default()
            },
        );

        let catalog = build_api_surface_catalog(&state);

        assert!(catalog
            .documents
            .iter()
            .any(|document| document.id == OPENCLAW_GATEWAY_DOCUMENT_ID));
    }

    #[test]
    fn write_runtime_openapi_snapshots_persists_discovery_and_active_documents() {
        let state = build_server_state_with_overrides(
            test_rollout_dir("snapshot-write"),
            ServerStateOverrides {
                local_ai_proxy_target_provider: Some(LocalAiProxyTargetProviderHandle::new(
                    Arc::new(StaticLocalAiProxyTargetProvider),
                )),
                ..ServerStateOverrides::default()
            },
        );

        let written = write_runtime_openapi_snapshots(&state, "http://127.0.0.1:18797")
            .expect("write runtime openapi snapshots");

        assert!(written.iter().any(|path| path.ends_with("discovery.json")));
        assert!(written
            .iter()
            .any(|path| path.ends_with("claw-native-v1.json")));
        assert!(written
            .iter()
            .any(|path| path.ends_with("local-ai-compat-v1.json")));
    }

    fn test_rollout_dir(label: &str) -> PathBuf {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time")
            .as_millis();
        std::env::temp_dir().join(format!(
            "sdkwork-claw-server-api-surface-{label}-{timestamp}"
        ))
    }
}
