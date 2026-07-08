use crate::framework::{
    components::{
        bundled_component_defaults, default_startup_component_ids, PackagedComponentDefinition,
        PackagedComponentStartupMode,
    },
    kernel::{DesktopBundledComponentInfo, DesktopBundledComponentsInfo},
    paths::AppPaths,
    FrameworkError, Result,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{fs, path::Path};

const BUNDLE_MANIFEST_FILE_NAME: &str = "bundle-manifest.json";
const COMPONENT_REGISTRY_FILE_NAME: &str = "component-registry.json";
const SERVICE_DEFAULTS_FILE_NAME: &str = "service-defaults.json";
const UPGRADE_POLICY_FILE_NAME: &str = "upgrade-policy.json";
const DEFAULT_KERNEL_PACKAGE_PROFILE_ID: &str = "openclaw-only";
const DEFAULT_OPENCLAW_KERNEL_ID: &str = "openclaw";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct PackagedComponentRegistry {
    pub version: u32,
    pub components: Vec<PackagedComponentDefinition>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct BundledServiceDefaults {
    pub version: u32,
    pub auto_start_component_ids: Vec<String>,
    pub manual_component_ids: Vec<String>,
    pub embedded_component_ids: Vec<String>,
    pub router_service_ids: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct BundledUpgradePolicy {
    pub version: u32,
    pub auto_upgrade_enabled: bool,
    pub approval_mode: String,
    pub default_channel: String,
    pub max_retained_historical_packages: u32,
}

impl Default for BundledUpgradePolicy {
    fn default() -> Self {
        Self {
            version: 1,
            auto_upgrade_enabled: false,
            approval_mode: "manual".to_string(),
            default_channel: "stable".to_string(),
            max_retained_historical_packages: 3,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct BundledComponentResources {
    pub bundle_manifest: BundledKernelPackageManifest,
    pub registry: PackagedComponentRegistry,
    pub service_defaults: BundledServiceDefaults,
    pub upgrade_policy: BundledUpgradePolicy,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct BundledKernelPackageManifest {
    pub version: u32,
    pub package_profile_id: String,
    pub included_kernel_ids: Vec<String>,
    pub default_enabled_kernel_ids: Vec<String>,
}

impl Default for BundledKernelPackageManifest {
    fn default() -> Self {
        Self {
            version: 1,
            package_profile_id: DEFAULT_KERNEL_PACKAGE_PROFILE_ID.to_string(),
            included_kernel_ids: vec![DEFAULT_OPENCLAW_KERNEL_ID.to_string()],
            default_enabled_kernel_ids: vec![DEFAULT_OPENCLAW_KERNEL_ID.to_string()],
        }
    }
}

impl BundledKernelPackageManifest {
    fn normalized(self) -> Self {
        let package_profile_id = normalize_optional_string(Some(self.package_profile_id))
            .unwrap_or_else(|| DEFAULT_KERNEL_PACKAGE_PROFILE_ID.to_string());
        let included_kernel_ids = {
            let normalized = normalize_kernel_id_vec(self.included_kernel_ids);
            if normalized.is_empty() {
                vec![DEFAULT_OPENCLAW_KERNEL_ID.to_string()]
            } else {
                normalized
            }
        };
        let default_enabled_kernel_ids = {
            let mut normalized = normalize_kernel_id_vec(self.default_enabled_kernel_ids)
                .into_iter()
                .filter(|kernel_id| included_kernel_ids.contains(kernel_id))
                .collect::<Vec<_>>();
            if normalized.is_empty() {
                normalized = included_kernel_ids.clone();
            }
            normalized
        };

        Self {
            version: self.version,
            package_profile_id,
            included_kernel_ids,
            default_enabled_kernel_ids,
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct ComponentRegistryService;

impl ComponentRegistryService {
    pub fn new() -> Self {
        Self
    }

    pub fn load_resources(&self, paths: &AppPaths) -> Result<BundledComponentResources> {
        self.load_resources_from_dir(&paths.foundation_components_dir)
    }

    pub fn load_resources_from_dir(&self, directory: &Path) -> Result<BundledComponentResources> {
        let mut resources = BundledComponentResources::from_defaults();

        if directory.join(BUNDLE_MANIFEST_FILE_NAME).exists() {
            resources.bundle_manifest = read_json_file::<BundledKernelPackageManifest>(
                &directory.join(BUNDLE_MANIFEST_FILE_NAME),
            )?
            .normalized();
        }

        if directory.join(COMPONENT_REGISTRY_FILE_NAME).exists() {
            resources.registry = read_json_file(&directory.join(COMPONENT_REGISTRY_FILE_NAME))?;
        }

        if directory.join(SERVICE_DEFAULTS_FILE_NAME).exists() {
            resources.service_defaults =
                read_json_file(&directory.join(SERVICE_DEFAULTS_FILE_NAME))?;
        }

        if directory.join(UPGRADE_POLICY_FILE_NAME).exists() {
            resources.upgrade_policy = read_json_file(&directory.join(UPGRADE_POLICY_FILE_NAME))?;
        }

        Ok(resources)
    }

    pub fn kernel_info(&self, paths: &AppPaths) -> Result<DesktopBundledComponentsInfo> {
        let resources = self.load_resources(paths)?;

        Ok(DesktopBundledComponentsInfo {
            package_profile_id: resources.bundle_manifest.package_profile_id.clone(),
            included_kernel_ids: resources.bundle_manifest.included_kernel_ids.clone(),
            default_enabled_kernel_ids: resources
                .bundle_manifest
                .default_enabled_kernel_ids
                .clone(),
            component_count: resources.registry.components.len(),
            default_startup_component_ids: resources
                .service_defaults
                .auto_start_component_ids
                .clone(),
            auto_upgrade_enabled: resources.upgrade_policy.auto_upgrade_enabled,
            approval_mode: resources.upgrade_policy.approval_mode.clone(),
            components: resources
                .registry
                .components
                .into_iter()
                .map(|component| DesktopBundledComponentInfo {
                    id: component.id,
                    display_name: component.display_name,
                    kind: component_kind_label(&component.kind),
                    bundled_version: component.bundled_version,
                    startup_mode: startup_mode_label(&component.startup_mode),
                    install_subdir: component.install_subdir,
                })
                .collect(),
        })
    }

    pub fn default_runtime_id(&self, paths: &AppPaths) -> Result<String> {
        let resources = self.load_resources(paths)?;
        Ok(resources
            .bundle_manifest
            .default_enabled_kernel_ids
            .first()
            .cloned()
            .or_else(|| {
                resources
                    .bundle_manifest
                    .included_kernel_ids
                    .first()
                    .cloned()
            })
            .unwrap_or_else(|| DEFAULT_OPENCLAW_KERNEL_ID.to_string()))
    }
}

impl BundledComponentResources {
    pub fn from_defaults() -> Self {
        let definitions = bundled_component_defaults();
        let auto_start_component_ids = default_startup_component_ids(&definitions);
        let manual_component_ids = definitions
            .iter()
            .filter(|definition| definition.startup_mode == PackagedComponentStartupMode::Manual)
            .map(|definition| definition.id.clone())
            .collect::<Vec<_>>();
        let embedded_component_ids = definitions
            .iter()
            .filter(|definition| definition.startup_mode == PackagedComponentStartupMode::Embedded)
            .map(|definition| definition.id.clone())
            .collect::<Vec<_>>();
        Self {
            bundle_manifest: BundledKernelPackageManifest::default(),
            registry: PackagedComponentRegistry {
                version: 1,
                components: definitions,
            },
            service_defaults: BundledServiceDefaults {
                version: 1,
                auto_start_component_ids,
                manual_component_ids,
                embedded_component_ids,
                router_service_ids: Vec::new(),
            },
            upgrade_policy: BundledUpgradePolicy::default(),
        }
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn normalize_kernel_id_vec(values: Vec<String>) -> Vec<String> {
    let mut normalized = Vec::new();

    for value in values {
        if let Some(trimmed) = normalize_optional_string(Some(value)) {
            let kernel_id = trimmed.to_ascii_lowercase();
            if !normalized.contains(&kernel_id) {
                normalized.push(kernel_id);
            }
        }
    }

    normalized
}

fn read_json_file<T>(path: &Path) -> Result<T>
where
    T: DeserializeOwned,
{
    let content = fs::read_to_string(path).map_err(|error| {
        FrameworkError::Io(std::io::Error::new(
            error.kind(),
            format!("failed to read {}: {error}", path.display()),
        ))
    })?;
    Ok(serde_json::from_str::<T>(&content)?)
}

fn component_kind_label(kind: &crate::framework::components::PackagedComponentKind) -> String {
    match kind {
        crate::framework::components::PackagedComponentKind::Binary => "binary".to_string(),
        crate::framework::components::PackagedComponentKind::NodeApp => "nodeApp".to_string(),
        crate::framework::components::PackagedComponentKind::ServiceGroup => {
            "serviceGroup".to_string()
        }
        crate::framework::components::PackagedComponentKind::EmbeddedLibrary => {
            "embeddedLibrary".to_string()
        }
    }
}

fn startup_mode_label(mode: &crate::framework::components::PackagedComponentStartupMode) -> String {
    match mode {
        crate::framework::components::PackagedComponentStartupMode::AutoStart => {
            "autoStart".to_string()
        }
        crate::framework::components::PackagedComponentStartupMode::Manual => "manual".to_string(),
        crate::framework::components::PackagedComponentStartupMode::Embedded => {
            "embedded".to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ComponentRegistryService;
    use crate::framework::paths::resolve_paths_for_root;
    use std::fs;

    #[test]
    fn component_registry_resources_define_default_bundled_startup_contract() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = ComponentRegistryService::new();

        let resources = service
            .load_resources(&paths)
            .expect("bundled component resources");

        assert!(resources.registry.components.is_empty());
        assert!(resources
            .service_defaults
            .auto_start_component_ids
            .is_empty());
        assert!(resources.service_defaults.manual_component_ids.is_empty());
        assert!(resources.service_defaults.embedded_component_ids.is_empty());
        assert_eq!(
            resources.bundle_manifest.package_profile_id,
            "openclaw-only"
        );
        assert_eq!(
            resources.bundle_manifest.included_kernel_ids,
            vec!["openclaw"]
        );
        assert_eq!(
            resources.bundle_manifest.default_enabled_kernel_ids,
            vec!["openclaw"]
        );
        assert_eq!(resources.upgrade_policy.default_channel, "stable");
        assert_eq!(resources.upgrade_policy.approval_mode, "manual");
    }

    #[test]
    fn component_registry_resources_read_bundle_manifest_kernel_profile_summary() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = ComponentRegistryService::new();

        fs::create_dir_all(&paths.foundation_components_dir).expect("foundation components dir");
        fs::write(
            paths.foundation_components_dir.join("bundle-manifest.json"),
            r#"{
  "version": 1,
  "packageProfileId": "hermes-only",
  "includedKernelIds": ["hermes"],
  "defaultEnabledKernelIds": ["hermes"]
}
"#,
        )
        .expect("bundle manifest");

        let resources = service
            .load_resources(&paths)
            .expect("bundled component resources");

        assert_eq!(resources.bundle_manifest.package_profile_id, "hermes-only");
        assert_eq!(
            resources.bundle_manifest.included_kernel_ids,
            vec!["hermes"]
        );
        assert_eq!(
            resources.bundle_manifest.default_enabled_kernel_ids,
            vec!["hermes"]
        );
    }

    #[test]
    fn component_registry_resources_normalize_default_enabled_kernels_to_included_kernels() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = ComponentRegistryService::new();

        fs::create_dir_all(&paths.foundation_components_dir).expect("foundation components dir");
        fs::write(
            paths.foundation_components_dir.join("bundle-manifest.json"),
            r#"{
  "version": 1,
  "packageProfileId": "dual-kernel",
  "includedKernelIds": ["openclaw", "hermes"],
  "defaultEnabledKernelIds": ["missing-kernel"]
}
"#,
        )
        .expect("bundle manifest");

        let resources = service
            .load_resources(&paths)
            .expect("bundled component resources");

        assert_eq!(
            resources.bundle_manifest.default_enabled_kernel_ids,
            vec!["openclaw", "hermes"]
        );
    }

    #[test]
    fn component_registry_resources_canonicalize_kernel_ids_to_lowercase() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let service = ComponentRegistryService::new();

        fs::create_dir_all(&paths.foundation_components_dir).expect("foundation components dir");
        fs::write(
            paths.foundation_components_dir.join("bundle-manifest.json"),
            r#"{
  "version": 1,
  "packageProfileId": "mixed-case-profile",
  "includedKernelIds": [" OpenClaw ", "HERMES", "openclaw"],
  "defaultEnabledKernelIds": [" HERMES "]
}
"#,
        )
        .expect("bundle manifest");

        let resources = service
            .load_resources(&paths)
            .expect("bundled component resources");

        assert_eq!(
            resources.bundle_manifest.included_kernel_ids,
            vec!["openclaw", "hermes"]
        );
        assert_eq!(
            resources.bundle_manifest.default_enabled_kernel_ids,
            vec!["hermes"]
        );
    }
}
