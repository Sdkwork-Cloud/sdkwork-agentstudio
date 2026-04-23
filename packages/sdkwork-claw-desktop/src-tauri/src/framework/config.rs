use crate::framework::{
    ports::{is_legacy_managed_loopback_port, DESKTOP_EMBEDDED_HOST_DEFAULT_PORT},
    paths::AppPaths,
    storage::{StorageConfig, StorageProfileConfiguredFlags, StorageProviderKind},
    Result,
};
use std::fs;

pub const APP_LANGUAGE_PREFERENCE_SYSTEM: &str = "system";
pub const APP_LANGUAGE_PREFERENCE_ENGLISH: &str = "en";
pub const APP_LANGUAGE_PREFERENCE_SIMPLIFIED_CHINESE: &str = "zh";
pub const APP_LANGUAGE_PREFERENCE_TRADITIONAL_CHINESE: &str = "zh-TW";
pub const APP_LANGUAGE_PREFERENCE_FRENCH: &str = "fr";
pub const APP_LANGUAGE_PREFERENCE_GERMAN: &str = "de";
pub const APP_LANGUAGE_PREFERENCE_BRAZILIAN_PORTUGUESE: &str = "pt-BR";
pub const APP_LANGUAGE_PREFERENCE_JAPANESE: &str = "ja";
pub const APP_LANGUAGE_PREFERENCE_KOREAN: &str = "ko";
pub const APP_LANGUAGE_PREFERENCE_SPANISH: &str = "es";
pub const APP_LANGUAGE_PREFERENCE_TURKISH: &str = "tr";
pub const APP_LANGUAGE_PREFERENCE_UKRAINIAN: &str = "uk";
pub const APP_LANGUAGE_PREFERENCE_POLISH: &str = "pl";
pub const APP_LANGUAGE_PREFERENCE_INDONESIAN: &str = "id";
pub const HOST_PLATFORM_DESIRED_STATE_PROJECTION_VERSION: &str = "phase1";
pub const HOST_PLATFORM_ROLLOUT_ENGINE_VERSION: &str = "phase1";
const CURRENT_APP_CONFIG_VERSION: u32 = 2;
const REQUIRED_APP_CONFIG_FIELDS: [&str; 15] = [
    "version",
    "distribution",
    "logLevel",
    "theme",
    "language",
    "telemetryEnabled",
    "security",
    "storage",
    "notifications",
    "payments",
    "integrations",
    "embeddedOpenclaw",
    "desktopHost",
    "process",
    "componentUpgrades",
];
const REQUIRED_SECURITY_CONFIG_FIELDS: [&str; 3] = [
    "strictPathPolicy",
    "allowExternalHttp",
    "allowCustomProcessCwd",
];
const REQUIRED_STORAGE_CONFIG_FIELDS: [&str; 2] = ["activeProfileId", "profiles"];
const REQUIRED_STORAGE_PROFILE_CONFIG_FIELDS: [&str; 5] =
    ["id", "label", "provider", "namespace", "readOnly"];
const REQUIRED_NOTIFICATION_CONFIG_FIELDS: [&str; 3] =
    ["enabled", "provider", "requireUserConsent"];
const REQUIRED_PAYMENT_CONFIG_FIELDS: [&str; 2] = ["provider", "sandbox"];
const REQUIRED_INTEGRATION_CONFIG_FIELDS: [&str; 3] =
    ["pluginsEnabled", "remoteApiEnabled", "allowUnsignedPlugins"];
const REQUIRED_EMBEDDED_OPENCLAW_CONFIG_FIELDS: [&str; 1] = ["exposeCliToShell"];
const REQUIRED_DESKTOP_HOST_CONFIG_FIELDS: [&str; 4] =
    ["enabled", "bindHost", "port", "allowDynamicPort"];
const REQUIRED_PROCESS_CONFIG_FIELDS: [&str; 2] = ["defaultTimeoutMs", "maxConcurrentJobs"];
const REQUIRED_COMPONENT_UPGRADE_CONFIG_FIELDS: [&str; 4] = [
    "autoUpgradeEnabled",
    "approvalMode",
    "defaultChannel",
    "maxRetainedHistoricalPackages",
];

pub fn normalize_app_language_preference(value: &str) -> &'static str {
    let normalized = value.trim().to_lowercase().replace('_', "-");

    if normalized == APP_LANGUAGE_PREFERENCE_SYSTEM {
        return APP_LANGUAGE_PREFERENCE_SYSTEM;
    }

    if normalized.starts_with("zh-tw")
        || normalized.starts_with("zh-hk")
        || normalized.starts_with("zh-mo")
        || normalized.starts_with("zh-hant")
    {
        return APP_LANGUAGE_PREFERENCE_TRADITIONAL_CHINESE;
    }

    if normalized.starts_with("zh") {
        return APP_LANGUAGE_PREFERENCE_SIMPLIFIED_CHINESE;
    }

    if normalized.starts_with("en") {
        return APP_LANGUAGE_PREFERENCE_ENGLISH;
    }

    if normalized.starts_with("fr") {
        return APP_LANGUAGE_PREFERENCE_FRENCH;
    }

    if normalized.starts_with("de") {
        return APP_LANGUAGE_PREFERENCE_GERMAN;
    }

    if normalized.starts_with("pt") {
        return APP_LANGUAGE_PREFERENCE_BRAZILIAN_PORTUGUESE;
    }

    if normalized.starts_with("ja") {
        return APP_LANGUAGE_PREFERENCE_JAPANESE;
    }

    if normalized.starts_with("ko") {
        return APP_LANGUAGE_PREFERENCE_KOREAN;
    }

    if normalized.starts_with("es") {
        return APP_LANGUAGE_PREFERENCE_SPANISH;
    }

    if normalized.starts_with("tr") {
        return APP_LANGUAGE_PREFERENCE_TURKISH;
    }

    if normalized.starts_with("uk") {
        return APP_LANGUAGE_PREFERENCE_UKRAINIAN;
    }

    if normalized.starts_with("pl") {
        return APP_LANGUAGE_PREFERENCE_POLISH;
    }

    if normalized.starts_with("id") {
        return APP_LANGUAGE_PREFERENCE_INDONESIAN;
    }

    APP_LANGUAGE_PREFERENCE_SYSTEM
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SecurityConfig {
    pub strict_path_policy: bool,
    pub allow_external_http: bool,
    pub allow_custom_process_cwd: bool,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            strict_path_policy: true,
            allow_external_http: true,
            allow_custom_process_cwd: false,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NotificationConfig {
    pub enabled: bool,
    pub provider: String,
    pub require_user_consent: bool,
}

impl Default for NotificationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            provider: "native".to_string(),
            require_user_consent: true,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PaymentConfig {
    pub provider: String,
    pub sandbox: bool,
}

impl Default for PaymentConfig {
    fn default() -> Self {
        Self {
            provider: "none".to_string(),
            sandbox: true,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct IntegrationConfig {
    pub plugins_enabled: bool,
    pub remote_api_enabled: bool,
    pub allow_unsigned_plugins: bool,
}

impl Default for IntegrationConfig {
    fn default() -> Self {
        Self {
            plugins_enabled: true,
            remote_api_enabled: false,
            allow_unsigned_plugins: false,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct EmbeddedOpenClawConfig {
    pub expose_cli_to_shell: bool,
}

impl Default for EmbeddedOpenClawConfig {
    fn default() -> Self {
        Self {
            expose_cli_to_shell: true,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct DesktopHostConfig {
    pub enabled: bool,
    pub bind_host: String,
    pub port: u16,
    pub allow_dynamic_port: bool,
}

impl Default for DesktopHostConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            bind_host: "127.0.0.1".to_string(),
            port: DESKTOP_EMBEDDED_HOST_DEFAULT_PORT,
            allow_dynamic_port: true,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ProcessConfig {
    pub default_timeout_ms: u64,
    pub max_concurrent_jobs: u32,
}

impl Default for ProcessConfig {
    fn default() -> Self {
        Self {
            default_timeout_ms: 120_000,
            max_concurrent_jobs: 4,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ComponentUpgradeConfig {
    pub auto_upgrade_enabled: bool,
    pub approval_mode: String,
    pub default_channel: String,
    pub max_retained_historical_packages: u32,
}

impl Default for ComponentUpgradeConfig {
    fn default() -> Self {
        Self {
            auto_upgrade_enabled: false,
            approval_mode: "manual".to_string(),
            default_channel: "stable".to_string(),
            max_retained_historical_packages: 3,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppConfig {
    pub version: u32,
    pub distribution: String,
    pub log_level: String,
    pub theme: String,
    pub language: String,
    pub telemetry_enabled: bool,
    pub security: SecurityConfig,
    pub storage: StorageConfig,
    pub notifications: NotificationConfig,
    pub payments: PaymentConfig,
    pub integrations: IntegrationConfig,
    pub embedded_openclaw: EmbeddedOpenClawConfig,
    pub desktop_host: DesktopHostConfig,
    pub process: ProcessConfig,
    pub component_upgrades: ComponentUpgradeConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: CURRENT_APP_CONFIG_VERSION,
            distribution: "global".to_string(),
            log_level: "info".to_string(),
            theme: "system".to_string(),
            language: APP_LANGUAGE_PREFERENCE_SYSTEM.to_string(),
            telemetry_enabled: false,
            security: SecurityConfig::default(),
            storage: StorageConfig::default(),
            notifications: NotificationConfig::default(),
            payments: PaymentConfig::default(),
            integrations: IntegrationConfig::default(),
            embedded_openclaw: EmbeddedOpenClawConfig::default(),
            desktop_host: DesktopHostConfig::default(),
            process: ProcessConfig::default(),
            component_upgrades: ComponentUpgradeConfig::default(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicStorageProfileConfig {
    pub id: String,
    pub label: String,
    pub provider: StorageProviderKind,
    pub namespace: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub connection_configured: bool,
    pub database_configured: bool,
    pub endpoint_configured: bool,
    pub read_only: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicStorageConfig {
    pub active_profile_id: String,
    pub profiles: Vec<PublicStorageProfileConfig>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicAppConfig {
    pub version: u32,
    pub distribution: String,
    pub log_level: String,
    pub theme: String,
    pub language: String,
    pub telemetry_enabled: bool,
    pub security: SecurityConfig,
    pub storage: PublicStorageConfig,
    pub notifications: NotificationConfig,
    pub payments: PaymentConfig,
    pub integrations: IntegrationConfig,
    pub embedded_openclaw: EmbeddedOpenClawConfig,
    pub desktop_host: DesktopHostConfig,
    pub process: ProcessConfig,
    pub component_upgrades: ComponentUpgradeConfig,
}

pub fn load_or_create_config(paths: &AppPaths) -> Result<AppConfig> {
    if paths.config_file.exists() {
        let content = fs::read_to_string(&paths.config_file)?;
        let config = if content.trim().is_empty() {
            AppConfig::default()
        } else {
            let document = serde_json::from_str::<serde_json::Value>(&content)?;
            validate_app_config_document(&document)?;
            serde_json::from_value::<AppConfig>(document)?.normalized()
        };
        write_config(paths, &config)?;
        return Ok(config);
    }

    let config = AppConfig::default();
    write_config(paths, &config)?;
    Ok(config)
}

pub fn write_config(paths: &AppPaths, config: &AppConfig) -> Result<()> {
    let normalized = config.normalized();
    let content = serde_json::to_string_pretty(&normalized)?;
    let temp_path = paths.config_file.with_extension("json.tmp");
    fs::write(&temp_path, content)?;
    if paths.config_file.is_file() {
        fs::remove_file(&paths.config_file)?;
    }
    fs::rename(temp_path, &paths.config_file)?;
    Ok(())
}

impl AppConfig {
    pub fn normalized(&self) -> Self {
        let mut next = self.clone();
        next.version = CURRENT_APP_CONFIG_VERSION;
        next.language = normalize_app_language_preference(&next.language).to_string();
        next.storage = next.storage.normalized();
        if next.desktop_host.bind_host.trim().is_empty() {
            next.desktop_host.bind_host = DesktopHostConfig::default().bind_host;
        }
        if next.desktop_host.port == 0
            || is_legacy_managed_loopback_port(next.desktop_host.port)
        {
            next.desktop_host.port = DesktopHostConfig::default().port;
        }
        // Desktop combined mode requires the embedded loopback host. Keep stale opt-out values
        // from drifting the runtime into an unsupported startup contract.
        next.desktop_host.enabled = true;
        next
    }

    pub fn public_projection(&self) -> PublicAppConfig {
        let normalized = self.normalized();

        PublicAppConfig {
            version: normalized.version,
            distribution: normalized.distribution,
            log_level: normalized.log_level,
            theme: normalized.theme,
            language: normalized.language,
            telemetry_enabled: normalized.telemetry_enabled,
            security: normalized.security,
            storage: project_storage_config(&normalized.storage),
            notifications: normalized.notifications,
            payments: normalized.payments,
            integrations: normalized.integrations,
            embedded_openclaw: normalized.embedded_openclaw,
            desktop_host: normalized.desktop_host,
            process: normalized.process,
            component_upgrades: normalized.component_upgrades,
        }
    }
}

fn validate_app_config_document(document: &serde_json::Value) -> Result<()> {
    let root = document.as_object().ok_or_else(|| {
        crate::framework::FrameworkError::ValidationFailed(
            "app config must be a JSON object".to_string(),
        )
    })?;

    let version = root
        .get("version")
        .and_then(serde_json::Value::as_u64)
        .ok_or_else(|| {
            crate::framework::FrameworkError::ValidationFailed(
                "missing required app config field version".to_string(),
            )
        })?;

    if version != u64::from(CURRENT_APP_CONFIG_VERSION) {
        return Err(crate::framework::FrameworkError::ValidationFailed(format!(
            "unsupported app config version {version}; expected {}",
            CURRENT_APP_CONFIG_VERSION
        )));
    }

    for field in REQUIRED_APP_CONFIG_FIELDS.iter().copied() {
        if !root.contains_key(field) {
            return Err(crate::framework::FrameworkError::ValidationFailed(format!(
                "missing required app config field {field}"
            )));
        }
    }

    validate_required_object_fields(root, "security", &REQUIRED_SECURITY_CONFIG_FIELDS)?;
    validate_required_object_fields(root, "storage", &REQUIRED_STORAGE_CONFIG_FIELDS)?;
    validate_required_array_object_fields(
        root,
        "storage",
        "profiles",
        &REQUIRED_STORAGE_PROFILE_CONFIG_FIELDS,
    )?;
    validate_required_object_fields(root, "notifications", &REQUIRED_NOTIFICATION_CONFIG_FIELDS)?;
    validate_required_object_fields(root, "payments", &REQUIRED_PAYMENT_CONFIG_FIELDS)?;
    validate_required_object_fields(root, "integrations", &REQUIRED_INTEGRATION_CONFIG_FIELDS)?;
    validate_required_object_fields(
        root,
        "embeddedOpenclaw",
        &REQUIRED_EMBEDDED_OPENCLAW_CONFIG_FIELDS,
    )?;
    validate_required_object_fields(root, "desktopHost", &REQUIRED_DESKTOP_HOST_CONFIG_FIELDS)?;
    validate_required_object_fields(root, "process", &REQUIRED_PROCESS_CONFIG_FIELDS)?;
    validate_required_object_fields(
        root,
        "componentUpgrades",
        &REQUIRED_COMPONENT_UPGRADE_CONFIG_FIELDS,
    )?;

    Ok(())
}

fn validate_required_array_object_fields(
    root: &serde_json::Map<String, serde_json::Value>,
    field: &str,
    array_field: &str,
    required_fields: &[&str],
) -> Result<()> {
    let section = root
        .get(field)
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| {
            crate::framework::FrameworkError::ValidationFailed(format!(
                "app config field {field} must be an object"
            ))
        })?;
    let items = section
        .get(array_field)
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| {
            crate::framework::FrameworkError::ValidationFailed(format!(
                "app config field {field}.{array_field} must be an array"
            ))
        })?;

    for (index, item) in items.iter().enumerate() {
        let entry = item.as_object().ok_or_else(|| {
            crate::framework::FrameworkError::ValidationFailed(format!(
                "app config field {field}.{array_field}[{index}] must be an object"
            ))
        })?;

        for required_field in required_fields.iter().copied() {
            if !entry.contains_key(required_field) {
                return Err(crate::framework::FrameworkError::ValidationFailed(format!(
                    "missing required app config field {field}.{array_field}[{index}].{required_field}"
                )));
            }
        }
    }

    Ok(())
}

fn validate_required_object_fields(
    root: &serde_json::Map<String, serde_json::Value>,
    field: &str,
    required_fields: &[&str],
) -> Result<()> {
    let section = root
        .get(field)
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| {
            crate::framework::FrameworkError::ValidationFailed(format!(
                "app config field {field} must be an object"
            ))
        })?;

    for required_field in required_fields.iter().copied() {
        if !section.contains_key(required_field) {
            return Err(crate::framework::FrameworkError::ValidationFailed(format!(
                "missing required app config field {field}.{required_field}"
            )));
        }
    }

    Ok(())
}

fn project_storage_config(config: &StorageConfig) -> PublicStorageConfig {
    let normalized = config.normalized();

    PublicStorageConfig {
        active_profile_id: normalized.active_profile_id,
        profiles: normalized
            .profiles
            .iter()
            .map(project_storage_profile)
            .collect(),
    }
}

fn project_storage_profile(
    profile: &crate::framework::storage::StorageProfileConfig,
) -> PublicStorageProfileConfig {
    let flags = StorageProfileConfiguredFlags::from_options(
        profile.connection.as_deref(),
        profile.database.as_deref(),
        profile.endpoint.as_deref(),
    );

    PublicStorageProfileConfig {
        id: profile.id.clone(),
        label: profile.label.clone(),
        provider: profile.provider.clone(),
        namespace: profile.namespace.clone(),
        path: profile.path.clone(),
        connection_configured: flags.connection_configured,
        database_configured: flags.database_configured,
        endpoint_configured: flags.endpoint_configured,
        read_only: profile.read_only,
    }
}

#[cfg(test)]
mod tests {
    use super::{load_or_create_config, write_config, AppConfig};
    use crate::framework::paths::resolve_paths_for_root;
    use serde_json::Value;

    #[test]
    fn writes_default_config_when_missing() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let config = load_or_create_config(&paths).expect("config");
        let saved = std::fs::read_to_string(&paths.config_file).expect("saved config");

        assert_eq!(config.theme, "system");
        assert!(saved.contains("telemetryEnabled"));
    }

    #[test]
    fn recreates_default_config_when_existing_file_is_empty() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        std::fs::write(&paths.config_file, "").expect("empty config");

        let config = load_or_create_config(&paths).expect("config");
        let saved = std::fs::read_to_string(&paths.config_file).expect("saved config");
        let value = serde_json::from_str::<Value>(&saved).expect("json value");

        assert_eq!(config, AppConfig::default());
        assert_eq!(value.get("theme").and_then(Value::as_str), Some("system"));
    }

    #[test]
    fn default_config_serializes_kernel_sections() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        write_config(&paths, &AppConfig::default()).expect("write config");
        let saved = std::fs::read_to_string(&paths.config_file).expect("saved config");
        let value = serde_json::from_str::<Value>(&saved).expect("json value");

        assert!(value.get("version").is_some(), "missing version");
        assert!(value.get("storage").is_some(), "missing storage");
        assert!(
            value.get("notifications").is_some(),
            "missing notifications"
        );
        assert!(value.get("payments").is_some(), "missing payments");
        assert!(value.get("integrations").is_some(), "missing integrations");
        assert!(
            value.get("embeddedOpenclaw").is_some(),
            "missing embedded openclaw config"
        );
        assert!(value.get("process").is_some(), "missing process");
        assert!(
            value.get("componentUpgrades").is_some(),
            "missing component upgrades"
        );
    }

    #[test]
    fn default_embedded_openclaw_config_enables_shell_cli_exposure() {
        let config = AppConfig::default();

        assert!(
            config.embedded_openclaw.expose_cli_to_shell,
            "bundled openclaw shell exposure should be enabled by default"
        );
    }

    #[test]
    fn rejects_outdated_config_version() {
        let config = AppConfig {
            version: 1,
            embedded_openclaw: super::EmbeddedOpenClawConfig {
                expose_cli_to_shell: false,
            },
            ..AppConfig::default()
        };
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        std::fs::write(
            &paths.config_file,
            serde_json::to_string_pretty(&config).expect("serialize outdated config"),
        )
        .expect("write outdated config");
        let error = load_or_create_config(&paths).expect_err("outdated config rejected");

        assert!(
            error.to_string().contains("unsupported app config version"),
            "outdated configs should be rejected instead of migrated"
        );
    }

    #[test]
    fn preserves_explicit_shell_cli_opt_out_for_current_config_version() {
        let config = AppConfig {
            embedded_openclaw: super::EmbeddedOpenClawConfig {
                expose_cli_to_shell: false,
            },
            ..AppConfig::default()
        };

        let normalized = config.normalized();

        assert_eq!(normalized.version, AppConfig::default().version);
        assert!(
            !normalized.embedded_openclaw.expose_cli_to_shell,
            "current-version configs should still be able to opt out explicitly"
        );
    }

    #[test]
    fn normalizes_current_version_desktop_host_opt_out_back_to_enabled() {
        let config = AppConfig {
            desktop_host: super::DesktopHostConfig {
                enabled: false,
                ..super::DesktopHostConfig::default()
            },
            ..AppConfig::default()
        };

        let normalized = config.normalized();

        assert_eq!(normalized.version, AppConfig::default().version);
        assert!(
            normalized.desktop_host.enabled,
            "desktop combined mode requires the canonical embedded host even when config tries to opt out"
        );
    }

    #[test]
    fn rejects_config_missing_required_sections() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        std::fs::write(
            &paths.config_file,
            r#"{
        "version": 2,
        "distribution": "cn",
        "theme": "dark"
      }"#,
        )
        .expect("partial config");

        let error = load_or_create_config(&paths).expect_err("partial config rejected");

        assert!(
            error
                .to_string()
                .contains("missing required app config field"),
            "partial configs should be rejected instead of default-filled"
        );
    }

    #[test]
    fn rejects_config_with_partial_desktop_host_section() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let mut document = serde_json::to_value(AppConfig::default()).expect("default config json");

        document["desktopHost"] = serde_json::json!({
            "enabled": true
        });

        std::fs::write(
            &paths.config_file,
            serde_json::to_string_pretty(&document).expect("serialize partial desktop host"),
        )
        .expect("write partial desktop host config");

        let error =
            load_or_create_config(&paths).expect_err("partial desktop host config rejected");

        assert!(
            error
                .to_string()
                .contains("missing required app config field desktopHost.bindHost"),
            "nested config sections should be complete and explicit"
        );
    }

    #[test]
    fn rejects_config_with_partial_storage_profile_section() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let mut document = serde_json::to_value(AppConfig::default()).expect("default config json");

        document["storage"] = serde_json::json!({
            "activeProfileId": "team-postgres",
            "profiles": [
                {
                    "id": "team-postgres",
                    "label": "Team DB"
                }
            ]
        });

        std::fs::write(
            &paths.config_file,
            serde_json::to_string_pretty(&document).expect("serialize partial storage config"),
        )
        .expect("write partial storage config");

        let error =
            load_or_create_config(&paths).expect_err("partial storage config should be rejected");

        assert!(
            error
                .to_string()
                .contains("missing required app config field storage.profiles[0].provider"),
            "storage profiles should be complete and explicit"
        );
    }

    #[test]
    fn default_config_uses_system_language_preference() {
        let config = AppConfig::default();

        assert_eq!(config.language, "system");
    }

    #[test]
    fn config_normalizes_language_preference() {
        let config = AppConfig {
            language: "zh-CN".to_string(),
            ..AppConfig::default()
        };

        assert_eq!(config.normalized().language, "zh");
    }

    #[test]
    fn config_preserves_supported_non_english_language_preferences() {
        let config = AppConfig {
            language: "pt-PT".to_string(),
            ..AppConfig::default()
        };

        assert_eq!(config.normalized().language, "pt-BR");
    }

    #[test]
    fn public_projection_redacts_storage_connection_values() {
        let config = AppConfig {
            storage: crate::framework::storage::StorageConfig {
                active_profile_id: "team-postgres".to_string(),
                profiles: vec![crate::framework::storage::StorageProfileConfig {
                    id: "team-postgres".to_string(),
                    label: "Team DB".to_string(),
                    provider: crate::framework::storage::StorageProviderKind::Postgres,
                    namespace: "team".to_string(),
                    path: None,
                    connection: Some("postgres://user:secret@db.internal/claw".to_string()),
                    database: Some("claw".to_string()),
                    endpoint: Some("https://api.sdk.work/storage".to_string()),
                    read_only: true,
                }],
            },
            ..AppConfig::default()
        };

        let projection = config.public_projection();
        let profile = projection
            .storage
            .profiles
            .first()
            .expect("storage profile");
        let value = serde_json::to_value(&projection).expect("public config json");

        assert!(profile.connection_configured);
        assert!(profile.database_configured);
        assert!(profile.endpoint_configured);
        assert_eq!(projection.language, "system");
        assert_eq!(
            value.pointer("/storage/profiles/0/connection"),
            None,
            "public config must not expose raw storage connection values"
        );
        assert_eq!(
            value.pointer("/storage/profiles/0/endpoint"),
            None,
            "public config must not expose raw storage endpoint values"
        );
        assert_eq!(
            value.pointer("/componentUpgrades/defaultChannel"),
            Some(&Value::String("stable".to_string()))
        );
    }

    #[test]
    fn embedded_host_default_config_serializes_desktop_host_section() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        write_config(&paths, &AppConfig::default()).expect("write config");
        let saved = std::fs::read_to_string(&paths.config_file).expect("saved config");
        let value = serde_json::from_str::<Value>(&saved).expect("json value");

        assert_eq!(
            value.pointer("/desktopHost/enabled"),
            Some(&Value::Bool(true)),
            "desktop host should be enabled by default so desktop combined mode boots the canonical loopback host",
        );
        assert_eq!(
            value.pointer("/desktopHost/bindHost"),
            Some(&Value::String("127.0.0.1".to_string())),
            "desktop host should default to loopback binding",
        );
        assert_eq!(
            value.pointer("/desktopHost/allowDynamicPort"),
            Some(&Value::Bool(true)),
            "desktop host should allow dynamic fallback when the requested loopback port is busy",
        );
        assert!(
            value
                .pointer("/desktopHost/port")
                .and_then(Value::as_u64)
                .is_some(),
            "desktop host should publish a requested port in config",
        );
    }
}
