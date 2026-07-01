use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

use crate::cli::ClawServerCliCommand;

pub const CLAW_SERVER_DEFAULT_HOST: &str = "127.0.0.1";
pub const CLAW_SERVER_DEFAULT_PORT: u16 = 18_797;
pub const CLAW_SERVER_DEFAULT_DATA_DIR: &str = ".claw-server";
pub const CLAW_SERVER_DEFAULT_WEB_DIST_DIR: &str = "../sdkwork-claw-web/dist";
pub const CLAW_SERVER_DEFAULT_CONFIG_FILE_NAME: &str = "claw-server.config.json";
pub const CLAW_SERVER_DEFAULT_STATE_STORE_DRIVER: &str = "sqlite";
pub const CLAW_SERVER_DEFAULT_ALLOW_INSECURE_PUBLIC_BIND: bool = false;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ServerDeploymentFamily {
    BareMetal,
    Container,
    Kubernetes,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ServerAcceleratorProfile {
    Cpu,
    NvidiaCuda,
    AmdRocm,
}

impl ServerDeploymentFamily {
    pub fn as_contract_str(&self) -> &'static str {
        match self {
            Self::BareMetal => "bareMetal",
            Self::Container => "container",
            Self::Kubernetes => "kubernetes",
        }
    }
}

impl ServerAcceleratorProfile {
    pub fn as_contract_str(&self) -> &'static str {
        match self {
            Self::Cpu => "cpu",
            Self::NvidiaCuda => "nvidia-cuda",
            Self::AmdRocm => "amd-rocm",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerRuntimeConfigResolutionRequest {
    pub command: ClawServerCliCommand,
    pub env: BTreeMap<String, String>,
    pub executable_path: Option<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedServerRuntimeConfig {
    pub host: String,
    pub port: u16,
    pub data_dir: PathBuf,
    pub web_dist_dir: PathBuf,
    pub deployment_family: ServerDeploymentFamily,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accelerator_profile: Option<ServerAcceleratorProfile>,
    pub state_store: ResolvedServerStateStoreConfig,
    pub auth: ResolvedServerAuthConfig,
    pub allow_insecure_public_bind: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedServerStateStoreConfig {
    pub driver: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sqlite_path: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub postgres_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub postgres_schema: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedServerAuthConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manage_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manage_password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub internal_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub internal_password: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ServerConfigFile {
    host: Option<String>,
    port: Option<u16>,
    data_dir: Option<PathBuf>,
    web_dist_dir: Option<PathBuf>,
    deployment_family: Option<ServerDeploymentFamily>,
    accelerator_profile: Option<ServerAcceleratorProfile>,
    allow_insecure_public_bind: Option<bool>,
    state_store: ServerStateStoreConfigFile,
    auth: ServerAuthConfigFile,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ServerStateStoreConfigFile {
    driver: Option<String>,
    sqlite_path: Option<PathBuf>,
    postgres_url: Option<String>,
    postgres_schema: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ServerAuthConfigFile {
    manage_username: Option<String>,
    manage_password: Option<String>,
    internal_username: Option<String>,
    internal_password: Option<String>,
}

pub fn resolve_server_runtime_config(
    request: ServerRuntimeConfigResolutionRequest,
) -> Result<ResolvedServerRuntimeConfig, String> {
    let packaged_bundle_paths =
        resolve_packaged_server_bundle_paths(request.executable_path.as_deref());
    let allow_missing_config_file = matches!(&request.command, ClawServerCliCommand::Service(_));
    let config_path = request
        .command
        .config_path()
        .cloned()
        .or_else(|| env_path(&request.env, "CLAW_SERVER_CONFIG"));
    let file = match config_path {
        Some(path) => load_server_config_file(&path, allow_missing_config_file)?,
        None => ServerConfigFile::default(),
    };

    let manage_username = first_some(
        file.auth.manage_username,
        request
            .env
            .get("CLAW_SERVER_MANAGE_USERNAME")
            .cloned()
            .and_then(normalize_string),
    );
    let manage_password = first_some(
        file.auth.manage_password,
        request
            .env
            .get("CLAW_SERVER_MANAGE_PASSWORD")
            .cloned()
            .and_then(normalize_string),
    );
    let internal_username = first_some(
        file.auth.internal_username,
        request
            .env
            .get("CLAW_SERVER_INTERNAL_USERNAME")
            .cloned()
            .and_then(normalize_string),
    )
    .or_else(|| manage_username.clone());
    let internal_password = first_some(
        file.auth.internal_password,
        request
            .env
            .get("CLAW_SERVER_INTERNAL_PASSWORD")
            .cloned()
            .and_then(normalize_string),
    )
    .or_else(|| manage_password.clone());
    let allow_insecure_public_bind = file
        .allow_insecure_public_bind
        .or(parse_optional_bool_env(
            &request.env,
            "CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND",
        )?)
        .unwrap_or(CLAW_SERVER_DEFAULT_ALLOW_INSECURE_PUBLIC_BIND);
    let deployment_family = file
        .deployment_family
        .or(resolve_server_deployment_family(env_string(
            &request.env,
            "CLAW_DEPLOYMENT_FAMILY",
        ))?)
        .unwrap_or(ServerDeploymentFamily::BareMetal);
    let accelerator_profile = file
        .accelerator_profile
        .or(resolve_server_accelerator_profile(env_string(
            &request.env,
            "CLAW_ACCELERATOR_PROFILE",
        ))?);

    Ok(ResolvedServerRuntimeConfig {
        host: request
            .command
            .host_override()
            .map(str::to_string)
            .or(file.host)
            .or_else(|| env_string(&request.env, "CLAW_SERVER_HOST"))
            .unwrap_or_else(|| CLAW_SERVER_DEFAULT_HOST.to_string()),
        port: request
            .command
            .port_override()
            .or(file.port)
            .or_else(|| env_u16(&request.env, "CLAW_SERVER_PORT"))
            .unwrap_or(CLAW_SERVER_DEFAULT_PORT),
        data_dir: file
            .data_dir
            .or_else(|| env_path(&request.env, "CLAW_SERVER_DATA_DIR"))
            .unwrap_or_else(|| {
                packaged_bundle_paths
                    .as_ref()
                    .map(|paths| paths.data_dir.clone())
                    .unwrap_or_else(|| PathBuf::from(CLAW_SERVER_DEFAULT_DATA_DIR))
            }),
        web_dist_dir: file
            .web_dist_dir
            .or_else(|| env_path(&request.env, "CLAW_SERVER_WEB_DIST"))
            .unwrap_or_else(|| {
                packaged_bundle_paths
                    .as_ref()
                    .map(|paths| paths.web_dist_dir.clone())
                    .unwrap_or_else(|| PathBuf::from(CLAW_SERVER_DEFAULT_WEB_DIST_DIR))
            }),
        deployment_family,
        accelerator_profile,
        state_store: ResolvedServerStateStoreConfig {
            driver: file
                .state_store
                .driver
                .or_else(|| env_string(&request.env, "CLAW_SERVER_STATE_STORE_DRIVER"))
                .unwrap_or_else(|| CLAW_SERVER_DEFAULT_STATE_STORE_DRIVER.to_string()),
            sqlite_path: file
                .state_store
                .sqlite_path
                .or_else(|| env_path(&request.env, "CLAW_SERVER_STATE_STORE_SQLITE_PATH")),
            postgres_url: file
                .state_store
                .postgres_url
                .or_else(|| env_string(&request.env, "CLAW_SERVER_STATE_STORE_POSTGRES_URL")),
            postgres_schema: file
                .state_store
                .postgres_schema
                .or_else(|| env_string(&request.env, "CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA")),
        },
        auth: ResolvedServerAuthConfig {
            manage_username,
            manage_password,
            internal_username,
            internal_password,
        },
        allow_insecure_public_bind,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct PackagedServerBundlePaths {
    data_dir: PathBuf,
    web_dist_dir: PathBuf,
}

fn resolve_packaged_server_bundle_paths(
    executable_path: Option<&Path>,
) -> Option<PackagedServerBundlePaths> {
    let executable_path = executable_path?;
    let executable_name = executable_path
        .file_name()?
        .to_str()?
        .trim()
        .to_ascii_lowercase();
    if executable_name != "claw-server" && executable_name != "claw-server.exe" {
        return None;
    }

    let bin_dir = executable_path.parent()?;
    if bin_dir.file_name()?.to_str()? != "bin" {
        return None;
    }

    let bundle_root = bin_dir.parent()?.to_path_buf();
    let web_dist_dir = bundle_root.join("web").join("dist");
    if !web_dist_dir.is_dir() {
        return None;
    }

    Some(PackagedServerBundlePaths {
        data_dir: bundle_root.join(CLAW_SERVER_DEFAULT_DATA_DIR),
        web_dist_dir,
    })
}

pub fn resolve_server_effective_config_path(
    command: &ClawServerCliCommand,
    env: &BTreeMap<String, String>,
    runtime_config: &ResolvedServerRuntimeConfig,
) -> PathBuf {
    command
        .config_path()
        .cloned()
        .or_else(|| env_path(env, "CLAW_SERVER_CONFIG"))
        .unwrap_or_else(|| {
            runtime_config
                .data_dir
                .join(CLAW_SERVER_DEFAULT_CONFIG_FILE_NAME)
        })
}

fn load_server_config_file(
    path: &PathBuf,
    allow_missing: bool,
) -> Result<ServerConfigFile, String> {
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(error) if allow_missing && error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ServerConfigFile::default());
        }
        Err(error) => {
            return Err(format!(
                "failed to read server config {}: {error}",
                path.display()
            ));
        }
    };
    serde_json::from_str::<ServerConfigFile>(&raw)
        .map_err(|error| format!("failed to parse server config {}: {error}", path.display()))
}

fn env_string(env: &BTreeMap<String, String>, key: &str) -> Option<String> {
    env.get(key).cloned().and_then(normalize_string)
}

fn env_path(env: &BTreeMap<String, String>, key: &str) -> Option<PathBuf> {
    env_string(env, key).map(PathBuf::from)
}

fn env_u16(env: &BTreeMap<String, String>, key: &str) -> Option<u16> {
    env_string(env, key).and_then(|value| value.parse::<u16>().ok())
}

fn parse_optional_bool_env(
    env: &BTreeMap<String, String>,
    key: &str,
) -> Result<Option<bool>, String> {
    let Some(value) = env_string(env, key) else {
        return Ok(None);
    };

    parse_bool_env_value(key, &value).map(Some)
}

fn parse_bool_env_value(key: &str, value: &str) -> Result<bool, String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Ok(true),
        "0" | "false" | "no" | "off" => Ok(false),
        _ => Err(format!(
            "invalid {key} value \"{value}\"; supported boolean values: true/false, 1/0, yes/no, on/off"
        )),
    }
}

pub(crate) fn resolve_server_deployment_family(
    value: Option<String>,
) -> Result<Option<ServerDeploymentFamily>, String> {
    let Some(value) = value.and_then(normalize_string) else {
        return Ok(None);
    };

    normalize_deployment_family(&value).map(Some).ok_or_else(|| {
        format!(
            "invalid CLAW_DEPLOYMENT_FAMILY value \"{value}\"; supported values: bareMetal, bare-metal, container, kubernetes"
        )
    })
}

pub(crate) fn resolve_server_accelerator_profile(
    value: Option<String>,
) -> Result<Option<ServerAcceleratorProfile>, String> {
    let Some(value) = value.and_then(normalize_string) else {
        return Ok(None);
    };

    normalize_accelerator_profile(&value).map(Some).ok_or_else(|| {
        format!(
            "invalid CLAW_ACCELERATOR_PROFILE value \"{value}\"; supported values: cpu, nvidia-cuda, amd-rocm"
        )
    })
}

fn normalize_deployment_family(value: &str) -> Option<ServerDeploymentFamily> {
    match value.trim().to_ascii_lowercase().as_str() {
        "baremetal" | "bare-metal" => Some(ServerDeploymentFamily::BareMetal),
        "container" => Some(ServerDeploymentFamily::Container),
        "kubernetes" | "k8s" => Some(ServerDeploymentFamily::Kubernetes),
        _ => None,
    }
}

fn normalize_accelerator_profile(value: &str) -> Option<ServerAcceleratorProfile> {
    match value.trim().to_ascii_lowercase().as_str() {
        "cpu" => Some(ServerAcceleratorProfile::Cpu),
        "nvidia-cuda" | "nvidiacuda" | "cuda" => Some(ServerAcceleratorProfile::NvidiaCuda),
        "amd-rocm" | "amdrocm" | "rocm" => Some(ServerAcceleratorProfile::AmdRocm),
        _ => None,
    }
}

fn first_some(left: Option<String>, right: Option<String>) -> Option<String> {
    left.or(right).and_then(normalize_string)
}

fn normalize_string(value: String) -> Option<String> {
    let normalized = value.trim().to_string();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

#[cfg(test)]
mod tests {
    use std::{
        collections::BTreeMap,
        env, fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{
        resolve_server_effective_config_path, resolve_server_runtime_config,
        ServerRuntimeConfigResolutionRequest,
    };
    use crate::cli::{
        ClawServerCliCommand, ClawServerServiceCommand, ClawServerServiceLifecycleArgs,
        ClawServerServicePlatform,
    };

    #[test]
    fn runtime_config_defaults_to_sqlite_state_store_driver() {
        let resolved = resolve_server_runtime_config(ServerRuntimeConfigResolutionRequest {
            command: ClawServerCliCommand::Run(crate::cli::ClawServerRunArgs {
                config_path: None,
                host: None,
                port: None,
            }),
            env: BTreeMap::new(),
            executable_path: None,
        })
        .expect("server runtime config should resolve default values");

        assert_eq!(resolved.state_store.driver, "sqlite");
        assert_eq!(resolved.state_store.sqlite_path, None);
        assert!(!resolved.allow_insecure_public_bind);
    }

    #[test]
    fn runtime_config_preserves_postgres_driver_value_for_projection_metadata() {
        let mut env = BTreeMap::new();
        env.insert(
            "CLAW_SERVER_STATE_STORE_DRIVER".to_string(),
            "postgres".to_string(),
        );

        let resolved = resolve_server_runtime_config(ServerRuntimeConfigResolutionRequest {
            command: ClawServerCliCommand::Run(crate::cli::ClawServerRunArgs {
                config_path: None,
                host: None,
                port: None,
            }),
            env,
            executable_path: None,
        })
        .expect("runtime config resolution should preserve the requested driver value");

        assert_eq!(resolved.state_store.driver, "postgres");
    }

    #[test]
    fn runtime_config_allows_explicit_insecure_public_bind_opt_in_from_env() {
        let mut env = BTreeMap::new();
        env.insert(
            "CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND".to_string(),
            "true".to_string(),
        );

        let resolved = resolve_server_runtime_config(ServerRuntimeConfigResolutionRequest {
            command: ClawServerCliCommand::Run(crate::cli::ClawServerRunArgs {
                config_path: None,
                host: Some("0.0.0.0".to_string()),
                port: None,
            }),
            env,
            executable_path: None,
        })
        .expect("runtime config should preserve the explicit insecure public bind opt-in");

        assert!(resolved.allow_insecure_public_bind);
    }

    #[test]
    fn runtime_config_projects_deployment_family_and_accelerator_profile_from_env() {
        let mut env = BTreeMap::new();
        env.insert(
            "CLAW_DEPLOYMENT_FAMILY".to_string(),
            "kubernetes".to_string(),
        );
        env.insert(
            "CLAW_ACCELERATOR_PROFILE".to_string(),
            "amd-rocm".to_string(),
        );

        let resolved = resolve_server_runtime_config(ServerRuntimeConfigResolutionRequest {
            command: ClawServerCliCommand::Run(crate::cli::ClawServerRunArgs {
                config_path: None,
                host: None,
                port: None,
            }),
            env,
            executable_path: None,
        })
        .expect("runtime config should project deployment metadata from env");

        assert_eq!(
            resolved.deployment_family,
            super::ServerDeploymentFamily::Kubernetes
        );
        assert_eq!(
            resolved.accelerator_profile,
            Some(super::ServerAcceleratorProfile::AmdRocm)
        );
    }

    #[test]
    fn service_install_resolution_allows_missing_explicit_config_path_and_preserves_target_path() {
        let config_path = unique_missing_config_path("service-install-target");
        let mut env = BTreeMap::new();
        env.insert(
            "CLAW_SERVER_DATA_DIR".to_string(),
            "./service-install-data".to_string(),
        );
        env.insert(
            "CLAW_SERVER_WEB_DIST".to_string(),
            "./service-install-web".to_string(),
        );
        env.insert(
            "CLAW_SERVER_STATE_STORE_DRIVER".to_string(),
            "sqlite".to_string(),
        );
        env.insert(
            "CLAW_SERVER_STATE_STORE_SQLITE_PATH".to_string(),
            "./service-install.sqlite3".to_string(),
        );
        let command = ClawServerCliCommand::Service(ClawServerServiceCommand::Install(
            ClawServerServiceLifecycleArgs {
                platform: ClawServerServicePlatform::Linux,
                config_path: Some(config_path.clone()),
                host: Some("0.0.0.0".to_string()),
                port: Some(19_111),
            },
        ));

        let resolved = resolve_server_runtime_config(ServerRuntimeConfigResolutionRequest {
            command: command.clone(),
            env: env.clone(),
            executable_path: None,
        })
        .expect("service install should allow a missing config target path");

        assert_eq!(resolved.host, "0.0.0.0");
        assert_eq!(resolved.port, 19_111);
        assert_eq!(resolved.data_dir, PathBuf::from("./service-install-data"));
        assert_eq!(
            resolved.web_dist_dir,
            PathBuf::from("./service-install-web")
        );
        assert_eq!(resolved.state_store.driver, "sqlite");
        assert_eq!(
            resolved.state_store.sqlite_path,
            Some(PathBuf::from("./service-install.sqlite3"))
        );
        assert_eq!(
            resolve_server_effective_config_path(&command, &env, &resolved),
            config_path
        );
    }

    #[test]
    fn service_status_resolution_allows_missing_env_config_path_and_keeps_env_target_path() {
        let config_path = unique_missing_config_path("service-status-env-target");
        let mut env = BTreeMap::new();
        env.insert(
            "CLAW_SERVER_CONFIG".to_string(),
            config_path.to_string_lossy().into_owned(),
        );
        env.insert("CLAW_SERVER_HOST".to_string(), "192.168.10.44".to_string());
        env.insert("CLAW_SERVER_PORT".to_string(), "19444".to_string());
        env.insert(
            "CLAW_SERVER_DATA_DIR".to_string(),
            "./service-status-data".to_string(),
        );
        let command = ClawServerCliCommand::Service(ClawServerServiceCommand::Status(
            ClawServerServiceLifecycleArgs {
                platform: ClawServerServicePlatform::Windows,
                config_path: None,
                host: None,
                port: None,
            },
        ));

        let resolved = resolve_server_runtime_config(ServerRuntimeConfigResolutionRequest {
            command: command.clone(),
            env: env.clone(),
            executable_path: None,
        })
        .expect("service status should allow a missing env config target path");

        assert_eq!(resolved.host, "192.168.10.44");
        assert_eq!(resolved.port, 19_444);
        assert_eq!(resolved.data_dir, PathBuf::from("./service-status-data"));
        assert_eq!(
            resolve_server_effective_config_path(&command, &env, &resolved),
            config_path
        );
    }

    #[test]
    fn runtime_config_uses_packaged_bundle_defaults_when_running_bundled_binary() {
        let bundle_root = unique_bundle_root("packaged-bundle-defaults");
        let executable_path = bundle_root.join("bin").join("claw-server");
        let web_dist_dir = bundle_root.join("web").join("dist");
        fs::create_dir_all(&web_dist_dir).expect("bundle web dist should be created");

        let resolved = resolve_server_runtime_config(ServerRuntimeConfigResolutionRequest {
            command: ClawServerCliCommand::Run(crate::cli::ClawServerRunArgs {
                config_path: None,
                host: None,
                port: None,
            }),
            env: BTreeMap::new(),
            executable_path: Some(executable_path),
        })
        .expect("runtime config should project packaged bundle defaults");

        assert_eq!(resolved.data_dir, bundle_root.join(".claw-server"));
        assert_eq!(resolved.web_dist_dir, web_dist_dir);

        let _ = fs::remove_dir_all(bundle_root);
    }

    #[test]
    fn runtime_config_ignores_packaged_shape_without_bundled_web_dist() {
        let bundle_root = unique_bundle_root("packaged-bundle-missing-web");
        let executable_path = bundle_root.join("bin").join("claw-server");
        fs::create_dir_all(
            executable_path
                .parent()
                .expect("bundle bin dir should exist"),
        )
        .expect("bundle bin dir should be created");

        let resolved = resolve_server_runtime_config(ServerRuntimeConfigResolutionRequest {
            command: ClawServerCliCommand::Run(crate::cli::ClawServerRunArgs {
                config_path: None,
                host: None,
                port: None,
            }),
            env: BTreeMap::new(),
            executable_path: Some(executable_path),
        })
        .expect("runtime config should fall back when bundle web dist is missing");

        assert_eq!(resolved.data_dir, PathBuf::from(".claw-server"));
        assert_eq!(
            resolved.web_dist_dir,
            PathBuf::from("../sdkwork-claw-web/dist")
        );

        let _ = fs::remove_dir_all(bundle_root);
    }

    fn unique_missing_config_path(label: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        env::temp_dir().join(format!(
            "sdkwork-claw-server-{label}-{}-{unique_suffix}.json",
            std::process::id()
        ))
    }

    fn unique_bundle_root(label: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        env::temp_dir().join(format!(
            "sdkwork-claw-server-bundle-{label}-{}-{unique_suffix}",
            std::process::id()
        ))
    }
}
