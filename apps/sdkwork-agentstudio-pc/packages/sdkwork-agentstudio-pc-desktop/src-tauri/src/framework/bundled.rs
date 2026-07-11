use crate::framework::{
    layout::sync_component_registry_state,
    paths::AppPaths,
    services::{components::ComponentRegistryService, upgrades::ComponentUpgradeService},
    Result,
};
use std::{fs, path::Path};
use tauri::{path::BaseDirectory, AppHandle, Manager, Runtime};

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct BundledInstallSyncReport {
    pub seeded_component_ids: Vec<String>,
    pub seeded_runtime_ids: Vec<String>,
}

pub fn sync_bundled_installation_from_dir(
    bundle_root: &Path,
    paths: &AppPaths,
) -> Result<BundledInstallSyncReport> {
    let mut report = BundledInstallSyncReport::default();
    let bundled_foundation_dir = bundle_root.join("foundation");
    let bundled_modules_dir = bundle_root.join("modules");
    let bundled_runtimes_dir = bundle_root.join("runtimes");

    if bundled_foundation_dir.exists() {
        copy_directory_contents(&bundled_foundation_dir, &paths.foundation_dir)?;
    }

    if bundled_runtimes_dir.exists() {
        copy_directory_contents(&bundled_runtimes_dir, &paths.runtimes_dir)?;
        report.seeded_runtime_ids = enumerate_child_directory_names(&bundled_runtimes_dir)?;
        for runtime_id in &report.seeded_runtime_ids {
            let runtime_versions =
                enumerate_child_directory_names(&bundled_runtimes_dir.join(runtime_id))?;
            if let Some(version) = runtime_versions
                .into_iter()
                .filter(|candidate| candidate != "current")
                .last()
            {
                ComponentUpgradeService::new().activate_runtime_version(
                    paths,
                    runtime_id,
                    version.as_str(),
                )?;
            }
        }
    }

    let resources = ComponentRegistryService::new().load_resources(paths)?;
    sync_component_registry_state(paths, &resources.registry.components)?;
    for component in resources.registry.components {
        let bundled_version = component.bundled_version.trim();
        if bundled_version.is_empty() || bundled_version.eq_ignore_ascii_case("bundled") {
            continue;
        }

        let source_version_dir = bundled_modules_dir
            .join(&component.id)
            .join(bundled_version);
        if !source_version_dir.exists() {
            continue;
        }

        let target_component_dir = paths.modules_dir.join(&component.id);
        let target_version_dir = target_component_dir.join(bundled_version);
        fs::create_dir_all(&target_component_dir)?;
        if !target_version_dir.exists() {
            copy_directory_contents(&source_version_dir, &target_version_dir)?;
        }

        ComponentUpgradeService::new().activate_component_version(
            paths,
            &component.id,
            bundled_version,
        )?;
        report.seeded_component_ids.push(component.id);
    }

    report.seeded_component_ids.sort();
    report.seeded_runtime_ids.sort();
    Ok(report)
}

pub fn sync_bundled_installation<R: Runtime>(
    app: &AppHandle<R>,
    paths: &AppPaths,
) -> Result<BundledInstallSyncReport> {
    for bundle_root in bundled_resource_roots(app)? {
        if bundle_root.exists() {
            return sync_bundled_installation_from_dir(&bundle_root, paths);
        }
    }

    Ok(BundledInstallSyncReport::default())
}
fn copy_directory_contents(source_dir: &Path, target_dir: &Path) -> Result<()> {
    fs::create_dir_all(target_dir)?;

    for entry in fs::read_dir(source_dir)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target_dir.join(entry.file_name());

        if entry.file_type()?.is_dir() {
            copy_directory_contents(&source_path, &target_path)?;
            continue;
        }

        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&source_path, &target_path)?;
    }

    Ok(())
}

fn enumerate_child_directory_names(root: &Path) -> Result<Vec<String>> {
    let mut names = Vec::new();
    if !root.exists() {
        return Ok(names);
    }

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            names.push(entry.file_name().to_string_lossy().into_owned());
        }
    }
    names.sort();
    Ok(names)
}

fn bundled_resource_roots<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<std::path::PathBuf>> {
    let mut roots = Vec::new();
    if let Ok(path) = app
        .path()
        .resolve("generated/bundled", BaseDirectory::Resource)
    {
        roots.push(path);
    }
    roots.push(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("generated")
            .join("bundled"),
    );
    Ok(roots)
}

#[cfg(test)]
mod tests {
    use super::sync_bundled_installation_from_dir;
    use crate::framework::{
        layout::{ActiveState, ComponentsState, InventoryState, UpgradesState},
        openclaw_release::required_openclaw_node_version,
        paths::resolve_paths_for_root,
    };
    use std::path::Path;

    #[test]
    fn bundled_install_sync_seeds_foundation_modules_and_runtime_versions() {
        let root = tempfile::tempdir().expect("temp dir");
        let bundle_root = root.path().join("bundle-source");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        seed_fake_bundle_tree(bundle_root.as_path());

        let report = sync_bundled_installation_from_dir(bundle_root.as_path(), &paths)
            .expect("bundled install sync");

        assert_eq!(report.seeded_component_ids, vec!["codex".to_string()]);
        assert!(paths
            .foundation_components_dir
            .join("component-registry.json")
            .exists());
        assert!(paths
            .modules_dir
            .join("codex")
            .join("1.2.3")
            .join("bin")
            .exists());
        assert!(paths
            .modules_dir
            .join("codex")
            .join("current")
            .join("bin")
            .exists());
        assert!(paths
            .runtimes_dir
            .join("node")
            .join(required_openclaw_node_version())
            .join("node.exe")
            .exists());
        assert!(paths
            .runtimes_dir
            .join("node")
            .join("current")
            .join("node.exe")
            .exists());
    }

    #[test]
    fn bundled_install_sync_updates_component_and_runtime_state_for_activated_version() {
        let root = tempfile::tempdir().expect("temp dir");
        let bundle_root = root.path().join("bundle-source");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        seed_fake_bundle_tree(bundle_root.as_path());

        sync_bundled_installation_from_dir(bundle_root.as_path(), &paths)
            .expect("bundled install sync");

        let components = serde_json::from_str::<ComponentsState>(
            &std::fs::read_to_string(&paths.components_file).expect("components file"),
        )
        .expect("components json");
        let upgrades = serde_json::from_str::<UpgradesState>(
            &std::fs::read_to_string(&paths.upgrades_file).expect("upgrades file"),
        )
        .expect("upgrades json");
        let active = serde_json::from_str::<ActiveState>(
            &std::fs::read_to_string(&paths.active_file).expect("active file"),
        )
        .expect("active json");
        let inventory = serde_json::from_str::<InventoryState>(
            &std::fs::read_to_string(&paths.inventory_file).expect("inventory file"),
        )
        .expect("inventory json");

        assert_eq!(
            components
                .entries
                .get("codex")
                .and_then(|entry| entry.active_version.as_deref()),
            Some("1.2.3")
        );
        assert_eq!(
            upgrades
                .components
                .get("codex")
                .and_then(|entry| entry.last_applied_version.as_deref()),
            Some("1.2.3")
        );
        assert_eq!(
            inventory.module_packages.get("codex"),
            Some(&vec!["1.2.3".to_string()])
        );
        assert_eq!(
            inventory.runtime_packages.get("node"),
            Some(&vec![required_openclaw_node_version().to_string()])
        );
        assert_eq!(
            active
                .runtimes
                .get("node")
                .and_then(|entry| entry.active_runtime_install_key()),
            Some(required_openclaw_node_version())
        );
        let node_runtime = active.runtimes.get("node").expect("node active runtime");
        assert!(node_runtime.active_version.is_none());
        assert!(node_runtime.fallback_version.is_none());
    }

    fn seed_fake_bundle_tree(bundle_root: &Path) {
        let component_dir = bundle_root.join("foundation").join("components");
        let module_dir = bundle_root
            .join("modules")
            .join("codex")
            .join("1.2.3")
            .join("bin");
        let runtime_dir = bundle_root
            .join("runtimes")
            .join("node")
            .join(required_openclaw_node_version());

        std::fs::create_dir_all(&component_dir).expect("component dir");
        std::fs::create_dir_all(&module_dir).expect("module dir");
        std::fs::create_dir_all(&runtime_dir).expect("runtime dir");

        std::fs::write(
            component_dir.join("component-registry.json"),
            r#"{
  "version": 1,
  "components": [
    {
      "id": "codex",
      "displayName": "Codex",
      "kind": "binary",
      "bundledVersion": "1.2.3",
      "startupMode": "autoStart",
      "installSubdir": "modules/codex/current",
      "upgradeChannel": "stable",
      "serviceIds": ["codex"]
    }
  ]
}"#,
        )
        .expect("component registry");
        std::fs::write(
            component_dir.join("service-defaults.json"),
            r#"{
  "version": 1,
  "autoStartComponentIds": ["codex"],
  "manualComponentIds": [],
  "embeddedComponentIds": [],
  "routerServiceIds": []
}"#,
        )
        .expect("service defaults");
        std::fs::write(
            component_dir.join("upgrade-policy.json"),
            r#"{
  "version": 1,
  "autoUpgradeEnabled": false,
  "approvalMode": "manual",
  "defaultChannel": "stable",
  "maxRetainedHistoricalPackages": 3
}"#,
        )
        .expect("upgrade policy");
        std::fs::write(module_dir.join("codex.exe"), b"fake-codex").expect("codex binary");
        std::fs::write(runtime_dir.join("node.exe"), b"fake-node").expect("node runtime");
    }
}
