use crate::framework::{
    services::openclaw_runtime::{load_manifest, ActivatedOpenClawRuntime},
    FrameworkError, Result,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const OPENCLAW_MIRROR_RUNTIME_ID: &str = "openclaw";
const OPENCLAW_MIRROR_VERSION: &str = "1.0.0";
const MANAGED_ASSET_SNAPSHOT_VERSION: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorRuntimeSnapshot {
    pub runtime_id: String,
    pub install_key: Option<String>,
    pub openclaw_version: Option<String>,
    pub node_version: Option<String>,
    pub platform: String,
    pub arch: String,
    pub home_dir: String,
    pub state_dir: String,
    pub workspace_dir: String,
    pub config_file: String,
    pub gateway_port: u16,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorManifestRuntimeSnapshot {
    pub runtime_id: String,
    pub install_key: Option<String>,
    pub openclaw_version: Option<String>,
    pub node_version: Option<String>,
    pub platform: String,
    pub arch: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorComponentRecord {
    pub id: String,
    pub kind: String,
    pub relative_path: String,
    pub source_path: String,
    pub digest_sha256: Option<String>,
    pub byte_size: Option<u64>,
    pub file_count: Option<u64>,
    pub includes_secrets: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorManifestComponentRecord {
    pub id: String,
    pub kind: String,
    pub relative_path: String,
    pub digest_sha256: Option<String>,
    pub byte_size: Option<u64>,
    pub file_count: Option<u64>,
    pub includes_secrets: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorManifestMetadataFileRecord {
    pub id: String,
    pub relative_path: String,
    pub digest_sha256: String,
    pub byte_size: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorManifestRecord {
    pub schema_version: u32,
    pub mirror_version: String,
    pub mode: String,
    pub created_at: String,
    pub runtime: OpenClawMirrorManifestRuntimeSnapshot,
    pub components: Vec<OpenClawMirrorManifestComponentRecord>,
    #[serde(default)]
    pub metadata_files: Vec<OpenClawMirrorManifestMetadataFileRecord>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorManagedAssetsSnapshot {
    pub schema_version: u32,
    pub skills: Vec<OpenClawMirrorManagedSkillAssetRecord>,
    pub plugins: Vec<OpenClawMirrorManagedPluginAssetRecord>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorManagedSkillAssetRecord {
    pub anchor: String,
    pub relative_path: String,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorManagedPluginAssetRecord {
    pub anchor: String,
    pub relative_path: String,
    pub entry_kind: String,
}

pub fn build_managed_runtime_snapshot(
    runtime: &ActivatedOpenClawRuntime,
) -> Result<OpenClawMirrorRuntimeSnapshot> {
    let manifest = load_manifest(&runtime.install_dir.join("manifest.json")).ok();
    let (fallback_openclaw_version, fallback_platform, fallback_arch) =
        split_install_key(&runtime.install_key);

    Ok(OpenClawMirrorRuntimeSnapshot {
        runtime_id: OPENCLAW_MIRROR_RUNTIME_ID.to_string(),
        install_key: Some(runtime.install_key.clone()),
        openclaw_version: manifest
            .as_ref()
            .map(|manifest| manifest.openclaw_version.clone())
            .or(fallback_openclaw_version),
        node_version: None,
        platform: manifest
            .as_ref()
            .map(|manifest| manifest.platform.clone())
            .unwrap_or(fallback_platform),
        arch: manifest
            .as_ref()
            .map(|manifest| manifest.arch.clone())
            .unwrap_or(fallback_arch),
        home_dir: normalize_path(&runtime.home_dir),
        state_dir: normalize_path(&runtime.state_dir),
        workspace_dir: normalize_path(&runtime.workspace_dir),
        config_file: normalize_path(&runtime.config_path),
        gateway_port: runtime.gateway_port,
    })
}

pub fn build_phase1_full_private_components(
    runtime: &ActivatedOpenClawRuntime,
) -> Result<Vec<OpenClawMirrorComponentRecord>> {
    validate_existing_path(&runtime.config_path, "OpenClaw config file path", false)?;
    validate_existing_path(&runtime.state_dir, "OpenClaw state path", true)?;
    validate_existing_path(&runtime.workspace_dir, "OpenClaw workspace path", true)?;

    Ok(vec![
        build_component_record(
            "config",
            "config",
            "components/config/openclaw.json",
            &runtime.config_path,
            false,
            &[],
        )?,
        build_component_record(
            "state",
            "state",
            "components/state",
            &runtime.state_dir,
            true,
            &[runtime.workspace_dir.clone(), runtime.config_path.clone()],
        )?,
        build_component_record(
            "workspace",
            "workspace",
            "components/workspace",
            &runtime.workspace_dir,
            false,
            &[],
        )?,
    ])
}

pub fn build_phase1_full_private_manifest(
    runtime: &ActivatedOpenClawRuntime,
    components: &[OpenClawMirrorComponentRecord],
    metadata_files: &[OpenClawMirrorManifestMetadataFileRecord],
) -> Result<OpenClawMirrorManifestRecord> {
    let runtime_snapshot = build_managed_runtime_snapshot(runtime)?;

    Ok(OpenClawMirrorManifestRecord {
        schema_version: 1,
        mirror_version: OPENCLAW_MIRROR_VERSION.to_string(),
        mode: "full-private".to_string(),
        created_at: OffsetDateTime::now_utc()
            .format(&Rfc3339)
            .map_err(|error| {
                FrameworkError::Internal(format!("format mirror timestamp: {error}"))
            })?,
        runtime: OpenClawMirrorManifestRuntimeSnapshot {
            runtime_id: runtime_snapshot.runtime_id,
            install_key: runtime_snapshot.install_key,
            openclaw_version: runtime_snapshot.openclaw_version,
            node_version: runtime_snapshot.node_version,
            platform: runtime_snapshot.platform,
            arch: runtime_snapshot.arch,
        },
        components: components
            .iter()
            .map(|component| OpenClawMirrorManifestComponentRecord {
                id: component.id.clone(),
                kind: component.kind.clone(),
                relative_path: component.relative_path.clone(),
                digest_sha256: component.digest_sha256.clone(),
                byte_size: component.byte_size,
                file_count: component.file_count,
                includes_secrets: component.includes_secrets,
            })
            .collect(),
        metadata_files: metadata_files.to_vec(),
    })
}

pub fn build_phase1_full_private_managed_assets_snapshot(
    runtime: &ActivatedOpenClawRuntime,
) -> Result<OpenClawMirrorManagedAssetsSnapshot> {
    let mut skills = Vec::new();
    collect_skill_assets(
        &runtime.state_dir,
        &runtime.state_dir.join("skills"),
        "state",
        &mut skills,
    )?;
    collect_skill_assets(
        &runtime.workspace_dir,
        &runtime.workspace_dir.join("skills"),
        "workspace",
        &mut skills,
    )?;
    skills.sort_by(|left, right| {
        left.anchor
            .cmp(&right.anchor)
            .then(left.relative_path.cmp(&right.relative_path))
    });
    skills.dedup();

    let mut plugins = Vec::new();
    collect_plugin_assets(
        &runtime.state_dir,
        &runtime.state_dir.join("extensions"),
        "state",
        &mut plugins,
    )?;
    collect_plugin_assets(
        &runtime.workspace_dir,
        &runtime.workspace_dir.join(".openclaw").join("extensions"),
        "workspace",
        &mut plugins,
    )?;
    plugins.sort_by(|left, right| {
        left.anchor
            .cmp(&right.anchor)
            .then(left.relative_path.cmp(&right.relative_path))
            .then(left.entry_kind.cmp(&right.entry_kind))
    });
    plugins.dedup();

    Ok(OpenClawMirrorManagedAssetsSnapshot {
        schema_version: MANAGED_ASSET_SNAPSHOT_VERSION,
        skills,
        plugins,
    })
}

pub fn build_virtual_component_record(
    id: &str,
    kind: &str,
    relative_path: &str,
    digest_sha256: String,
    byte_size: u64,
    file_count: u64,
    includes_secrets: bool,
) -> OpenClawMirrorComponentRecord {
    OpenClawMirrorComponentRecord {
        id: id.to_string(),
        kind: kind.to_string(),
        relative_path: relative_path.to_string(),
        source_path: relative_path.to_string(),
        digest_sha256: Some(digest_sha256),
        byte_size: Some(byte_size),
        file_count: Some(file_count),
        includes_secrets,
    }
}

pub fn build_manifest_metadata_file_record(
    id: &str,
    relative_path: &str,
    payload: &[u8],
) -> OpenClawMirrorManifestMetadataFileRecord {
    OpenClawMirrorManifestMetadataFileRecord {
        id: id.to_string(),
        relative_path: relative_path.to_string(),
        digest_sha256: compute_bytes_digest_sha256(payload),
        byte_size: payload.len() as u64,
    }
}

pub fn compute_component_digest_sha256(path: &Path) -> Result<String> {
    compute_component_digest_sha256_with_exclusions(path, &[])
}

pub fn compute_component_stats(path: &Path) -> Result<(u64, u64)> {
    collect_path_stats(path, &[])
}

fn compute_component_digest_sha256_with_exclusions(
    path: &Path,
    excluded_paths: &[PathBuf],
) -> Result<String> {
    let metadata = fs::metadata(path)?;
    if metadata.is_file() {
        return Ok(sha256_hex(&fs::read(path)?));
    }

    let mut hasher = Sha256::new();
    append_path_digest(path, path, excluded_paths, &mut hasher)?;
    Ok(bytes_to_lower_hex(hasher.finalize().as_ref()))
}

pub fn compute_bytes_digest_sha256(bytes: &[u8]) -> String {
    sha256_hex(bytes)
}

fn build_component_record(
    id: &str,
    kind: &str,
    relative_path: &str,
    source_path: &Path,
    includes_secrets: bool,
    excluded_paths: &[PathBuf],
) -> Result<OpenClawMirrorComponentRecord> {
    let (file_count, byte_size) = collect_path_stats(source_path, excluded_paths)?;
    let digest_sha256 =
        compute_component_digest_sha256_with_exclusions(source_path, excluded_paths)?;
    Ok(OpenClawMirrorComponentRecord {
        id: id.to_string(),
        kind: kind.to_string(),
        relative_path: relative_path.to_string(),
        source_path: normalize_path(source_path),
        digest_sha256: Some(digest_sha256),
        byte_size: Some(byte_size),
        file_count: Some(file_count),
        includes_secrets,
    })
}

fn validate_existing_path(path: &Path, label: &str, expect_directory: bool) -> Result<()> {
    if !path.exists() {
        return Err(FrameworkError::ValidationFailed(format!(
            "{label} does not exist: {}",
            normalize_path(path)
        )));
    }

    if expect_directory && !path.is_dir() {
        return Err(FrameworkError::ValidationFailed(format!(
            "{label} is not a directory: {}",
            normalize_path(path)
        )));
    }

    if !expect_directory && !path.is_file() {
        return Err(FrameworkError::ValidationFailed(format!(
            "{label} is not a file: {}",
            normalize_path(path)
        )));
    }

    Ok(())
}

fn collect_path_stats(path: &Path, excluded_paths: &[PathBuf]) -> Result<(u64, u64)> {
    let metadata = fs::metadata(path)?;
    if metadata.is_file() {
        return Ok((1, metadata.len()));
    }

    collect_directory_stats(path, excluded_paths)
}

fn collect_directory_stats(path: &Path, excluded_paths: &[PathBuf]) -> Result<(u64, u64)> {
    let mut file_count = 0_u64;
    let mut byte_size = 0_u64;

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        if should_exclude_path(&entry_path, excluded_paths) {
            continue;
        }
        let metadata = entry.metadata()?;
        if metadata.is_dir() {
            let (nested_count, nested_size) = collect_directory_stats(&entry_path, excluded_paths)?;
            file_count += nested_count;
            byte_size += nested_size;
            continue;
        }

        file_count += 1;
        byte_size += metadata.len();
    }

    Ok((file_count, byte_size))
}

fn collect_skill_assets(
    anchor_root: &Path,
    search_root: &Path,
    anchor: &str,
    skills: &mut Vec<OpenClawMirrorManagedSkillAssetRecord>,
) -> Result<()> {
    if !search_root.exists() || !search_root.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(search_root)? {
        let entry = entry?;
        let entry_path = entry.path();
        if entry.file_type()?.is_dir() {
            collect_skill_assets(anchor_root, &entry_path, anchor, skills)?;
            continue;
        }

        if entry
            .file_name()
            .to_string_lossy()
            .eq_ignore_ascii_case("SKILL.md")
        {
            if let Some(parent) = entry_path.parent() {
                skills.push(OpenClawMirrorManagedSkillAssetRecord {
                    anchor: anchor.to_string(),
                    relative_path: normalize_relative_path(anchor_root, parent)?,
                });
            }
        }
    }

    Ok(())
}

fn collect_plugin_assets(
    anchor_root: &Path,
    search_root: &Path,
    anchor: &str,
    plugins: &mut Vec<OpenClawMirrorManagedPluginAssetRecord>,
) -> Result<()> {
    if !search_root.exists() || !search_root.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(search_root)? {
        let entry = entry?;
        let entry_path = entry.path();
        let file_type = entry.file_type()?;

        if file_type.is_file() {
            if is_plugin_entry_file(&entry_path) {
                plugins.push(OpenClawMirrorManagedPluginAssetRecord {
                    anchor: anchor.to_string(),
                    relative_path: normalize_relative_path(anchor_root, &entry_path)?,
                    entry_kind: "file".to_string(),
                });
            }
            continue;
        }

        if file_type.is_dir() {
            if plugin_asset_directory_is_valid(&entry_path) {
                plugins.push(OpenClawMirrorManagedPluginAssetRecord {
                    anchor: anchor.to_string(),
                    relative_path: normalize_relative_path(anchor_root, &entry_path)?,
                    entry_kind: "directory".to_string(),
                });
                continue;
            }

            collect_plugin_assets(anchor_root, &entry_path, anchor, plugins)?;
        }
    }

    Ok(())
}

fn normalize_relative_path(anchor_root: &Path, path: &Path) -> Result<String> {
    let relative = path.strip_prefix(anchor_root).map_err(|_| {
        FrameworkError::ValidationFailed(format!(
            "OpenClaw asset path {} is outside anchor root {}",
            normalize_path(path),
            normalize_path(anchor_root)
        ))
    })?;
    Ok(normalize_path(relative))
}

fn append_path_digest(
    root: &Path,
    path: &Path,
    excluded_paths: &[PathBuf],
    hasher: &mut Sha256,
) -> Result<()> {
    let metadata = fs::metadata(path)?;
    let relative = path.strip_prefix(root).unwrap_or(path);
    let normalized = if relative.as_os_str().is_empty() {
        ".".to_string()
    } else {
        normalize_path(relative)
    };

    if metadata.is_dir() {
        hasher.update(b"dir\0");
        hasher.update(normalized.as_bytes());
        hasher.update(b"\0");

        let mut entries = fs::read_dir(path)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(FrameworkError::from)?;
        entries.sort_by(|left, right| {
            let left_name = left.file_name().to_string_lossy().into_owned();
            let right_name = right.file_name().to_string_lossy().into_owned();
            left_name
                .to_ascii_lowercase()
                .cmp(&right_name.to_ascii_lowercase())
                .then(left_name.cmp(&right_name))
        });

        for entry in entries {
            let entry_path = entry.path();
            if should_exclude_path(&entry_path, excluded_paths) {
                continue;
            }
            append_path_digest(root, &entry_path, excluded_paths, hasher)?;
        }

        return Ok(());
    }

    hasher.update(b"file\0");
    hasher.update(normalized.as_bytes());
    hasher.update(b"\0");
    hasher.update(&fs::read(path)?);
    hasher.update(b"\0");
    Ok(())
}

fn sha256_hex(bytes: &[u8]) -> String {
    bytes_to_lower_hex(Sha256::digest(bytes).as_ref())
}

fn bytes_to_lower_hex(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;

        let _ = write!(&mut output, "{byte:02x}");
    }
    output
}

fn should_exclude_path(path: &Path, excluded_paths: &[PathBuf]) -> bool {
    excluded_paths
        .iter()
        .any(|candidate| path.starts_with(candidate))
}

fn plugin_asset_directory_is_valid(path: &Path) -> bool {
    path.join("plugin.json").is_file()
        || path.join("package.json").is_file()
        || plugin_entrypoint_names()
            .iter()
            .any(|name| path.join(name).is_file())
}

fn is_plugin_entry_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|value| plugin_entrypoint_names().contains(&value))
        .unwrap_or(false)
}

fn plugin_entrypoint_names() -> &'static [&'static str] {
    &[
        "index.ts",
        "index.js",
        "index.mjs",
        "index.cjs",
        "index.mts",
        "index.cts",
    ]
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn split_install_key(install_key: &str) -> (Option<String>, String, String) {
    let trimmed = install_key.trim();
    if trimmed.is_empty() {
        return (None, "unknown".to_string(), "unknown".to_string());
    }

    let mut segments = trimmed.rsplitn(3, '-');
    let arch = segments.next().unwrap_or("unknown").to_string();
    let platform = segments.next().unwrap_or("unknown").to_string();
    let openclaw_version = segments
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .filter(|value| looks_like_openclaw_version_label(value))
        .map(str::to_string);

    (openclaw_version, platform, arch)
}

fn looks_like_openclaw_version_label(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty()
        && trimmed.chars().any(|character| character.is_ascii_digit())
        && trimmed.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_')
        })
}

#[cfg(test)]
mod tests {
    use super::{
        build_managed_runtime_snapshot, build_phase1_full_private_components,
        build_phase1_full_private_managed_assets_snapshot, build_phase1_full_private_manifest,
        OpenClawMirrorManagedPluginAssetRecord, OpenClawMirrorManagedSkillAssetRecord,
    };
    use crate::framework::{
        openclaw_release::{bundled_openclaw_version, required_openclaw_node_version},
        paths::{resolve_paths_for_root, AppPaths},
        services::openclaw_runtime::ActivatedOpenClawRuntime,
        FrameworkError,
    };
    use std::{fs, path::Path};

    fn current_openclaw_install_key() -> String {
        format!("{}-windows-x64", bundled_openclaw_version())
    }

    fn create_runtime(paths: &AppPaths) -> ActivatedOpenClawRuntime {
        let install_key = current_openclaw_install_key();
        let install_dir = paths.openclaw_runtime_dir.join(&install_key);
        ActivatedOpenClawRuntime {
            install_key,
            install_dir: install_dir.clone(),
            runtime_dir: install_dir.join("runtime"),
            node_path: install_dir.join("runtime").join("node.exe"),
            cli_path: install_dir.join("runtime").join("openclaw.cjs"),
            home_dir: paths.user_root.clone(),
            state_dir: paths.openclaw_root_dir.clone(),
            workspace_dir: paths.openclaw_workspace_dir.clone(),
            config_path: paths.openclaw_config_file.clone(),
            gateway_port: 21_280,
            gateway_auth_token: "mirror-test-token".to_string(),
        }
    }

    fn seed_built_in_openclaw_tree(paths: &AppPaths) {
        fs::create_dir_all(&paths.openclaw_workspace_dir).expect("workspace dir");
        fs::write(&paths.openclaw_config_file, "{ \"agents\": {} }").expect("config");
        fs::create_dir_all(paths.openclaw_root_dir.join("agents").join("main"))
            .expect("agents dir");
        fs::write(
            paths.openclaw_workspace_dir.join("AGENTS.md"),
            "# managed workspace",
        )
        .expect("workspace file");
    }

    fn path_label(path: &Path) -> String {
        path.to_string_lossy().replace('\\', "/")
    }

    #[test]
    fn openclaw_mirror_manifest_builds_built_in_runtime_snapshot() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_built_in_openclaw_tree(&paths);
        let runtime = create_runtime(&paths);

        let snapshot = build_managed_runtime_snapshot(&runtime).expect("runtime snapshot");

        assert_eq!(snapshot.runtime_id, "openclaw");
        let install_key = current_openclaw_install_key();
        assert_eq!(snapshot.install_key.as_deref(), Some(install_key.as_str()));
        assert_eq!(snapshot.gateway_port, 21_280);
        assert!(snapshot.home_dir.ends_with("app-user-root"));
        assert!(snapshot.state_dir.ends_with(".openclaw"));
        assert!(snapshot.workspace_dir.ends_with(".openclaw/workspace"));
        assert!(snapshot
            .config_file
            .ends_with("app-user-root/.openclaw/openclaw.json"));
    }

    #[test]
    fn openclaw_mirror_manifest_prefers_manifest_version_over_install_key_parsing() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_built_in_openclaw_tree(&paths);
        let mut runtime = create_runtime(&paths);
        runtime.install_key = "openclaw-nightly-windows-x64".to_string();
        runtime.install_dir = paths.openclaw_runtime_dir.join(&runtime.install_key);
        runtime.runtime_dir = runtime.install_dir.join("runtime");
        let manifest_version = bundled_openclaw_version();
        fs::create_dir_all(&runtime.install_dir).expect("create install dir");
        fs::write(
            runtime.install_dir.join("manifest.json"),
            r#"{
  "schemaVersion": 2,
  "runtimeId": "openclaw",
  "openclawVersion": "__OPENCLAW_VERSION__",
  "requiredExternalRuntimes": ["nodejs"],
  "requiredExternalRuntimeVersions": {
    "nodejs": "__NODE_VERSION__"
  },
  "platform": "windows",
  "arch": "x64",
  "cliRelativePath": "runtime/package/node_modules/openclaw/openclaw.mjs"
}"#
            .replace("__OPENCLAW_VERSION__", manifest_version)
            .replace("__NODE_VERSION__", required_openclaw_node_version()),
        )
        .expect("write manifest");

        let snapshot = build_managed_runtime_snapshot(&runtime).expect("runtime snapshot");

        assert_eq!(snapshot.openclaw_version.as_deref(), Some(manifest_version));
        assert_eq!(snapshot.platform, "windows");
        assert_eq!(snapshot.arch, "x64");
    }

    #[test]
    fn openclaw_mirror_manifest_does_not_infer_version_from_non_version_install_key_without_manifest(
    ) {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_built_in_openclaw_tree(&paths);
        let mut runtime = create_runtime(&paths);
        runtime.install_key = "openclaw-nightly-windows-x64".to_string();
        runtime.install_dir = paths.openclaw_runtime_dir.join(&runtime.install_key);
        runtime.runtime_dir = runtime.install_dir.join("runtime");
        fs::create_dir_all(&runtime.install_dir).expect("create install dir");

        let snapshot = build_managed_runtime_snapshot(&runtime).expect("runtime snapshot");

        assert_eq!(snapshot.openclaw_version, None);
        assert_eq!(snapshot.platform, "windows");
        assert_eq!(snapshot.arch, "x64");
    }

    #[test]
    fn openclaw_mirror_manifest_collects_phase1_full_private_components() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_built_in_openclaw_tree(&paths);
        let runtime = create_runtime(&paths);

        let components = build_phase1_full_private_components(&runtime).expect("mirror components");
        let manifest = build_phase1_full_private_manifest(&runtime, &components, &[])
            .expect("mirror manifest");

        assert_eq!(components.len(), 3);
        assert_eq!(components[0].id, "config");
        assert_eq!(components[1].id, "state");
        assert_eq!(components[2].id, "workspace");
        assert_eq!(manifest.mode, "full-private");
        assert_eq!(manifest.components.len(), 3);
        assert!(manifest.metadata_files.is_empty());
        assert_eq!(
            manifest.components[0].relative_path,
            "components/config/openclaw.json"
        );
    }

    #[test]
    fn openclaw_mirror_manifest_collects_built_in_assets_from_canonical_openclaw_roots_only() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_built_in_openclaw_tree(&paths);
        let runtime = create_runtime(&paths);

        fs::create_dir_all(paths.openclaw_skills_dir.join("shared-calendar"))
            .expect("shared skills dir");
        fs::write(
            paths
                .openclaw_skills_dir
                .join("shared-calendar")
                .join("SKILL.md"),
            "# shared calendar\n",
        )
        .expect("shared skill file");
        fs::create_dir_all(paths.openclaw_extensions_dir.join("voice-call"))
            .expect("managed extension dir");
        fs::write(
            paths
                .openclaw_extensions_dir
                .join("voice-call")
                .join("plugin.json"),
            "{ \"id\": \"voice-call\" }\n",
        )
        .expect("managed extension file");
        fs::create_dir_all(
            paths
                .openclaw_workspace_skills_dir
                .join("workspace-calendar"),
        )
        .expect("workspace skills dir");
        fs::write(
            paths
                .openclaw_workspace_skills_dir
                .join("workspace-calendar")
                .join("SKILL.md"),
            "# workspace calendar\n",
        )
        .expect("workspace skill file");
        fs::create_dir_all(
            paths
                .openclaw_workspace_extensions_dir
                .join("workspace-voice-call"),
        )
        .expect("workspace extension dir");
        fs::write(
            paths
                .openclaw_workspace_extensions_dir
                .join("workspace-voice-call")
                .join("plugin.json"),
            "{ \"id\": \"workspace-voice-call\" }\n",
        )
        .expect("workspace extension file");

        let snapshot =
            build_phase1_full_private_managed_assets_snapshot(&runtime).expect("asset snapshot");

        assert_eq!(
            snapshot.skills,
            vec![
                OpenClawMirrorManagedSkillAssetRecord {
                    anchor: "state".to_string(),
                    relative_path: "skills/shared-calendar".to_string(),
                },
                OpenClawMirrorManagedSkillAssetRecord {
                    anchor: "workspace".to_string(),
                    relative_path: "skills/workspace-calendar".to_string(),
                },
            ]
        );
        assert_eq!(
            snapshot.plugins,
            vec![
                OpenClawMirrorManagedPluginAssetRecord {
                    anchor: "state".to_string(),
                    relative_path: "extensions/voice-call".to_string(),
                    entry_kind: "directory".to_string(),
                },
                OpenClawMirrorManagedPluginAssetRecord {
                    anchor: "workspace".to_string(),
                    relative_path: ".openclaw/extensions/workspace-voice-call".to_string(),
                    entry_kind: "directory".to_string(),
                },
            ]
        );
    }

    #[test]
    fn openclaw_mirror_manifest_rejects_missing_built_in_paths() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_built_in_openclaw_tree(&paths);
        let runtime = create_runtime(&paths);
        fs::remove_file(&paths.openclaw_config_file).expect("remove config");

        let error =
            build_phase1_full_private_components(&runtime).expect_err("missing config should fail");

        match error {
            FrameworkError::ValidationFailed(reason) => {
                assert!(reason.contains("OpenClaw config file path does not exist"));
                assert!(reason.contains(&path_label(&paths.openclaw_config_file)));
            }
            other => panic!("unexpected error: {other}"),
        }
    }
}
