use super::openclaw_mirror_manifest::{
    build_managed_runtime_snapshot, build_manifest_metadata_file_record,
    build_phase1_full_private_components, build_phase1_full_private_managed_assets_snapshot,
    build_phase1_full_private_manifest, build_virtual_component_record,
    compute_bytes_digest_sha256, OpenClawMirrorComponentRecord,
    OpenClawMirrorManifestMetadataFileRecord, OpenClawMirrorManifestRecord,
    OpenClawMirrorRuntimeSnapshot,
};
use super::{
    local_ai_proxy_snapshot::{
        export_provider_center_catalog, LocalAiProxyProviderCenterCatalogSnapshot,
    },
    storage::StorageService,
};
#[cfg(windows)]
use crate::framework::child_process::configure_hidden_child_process;
use crate::framework::{
    config::AppConfig, paths::AppPaths, services::openclaw_runtime::ActivatedOpenClawRuntime,
    FrameworkError, Result,
};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorExportPreview {
    pub mode: String,
    pub runtime: OpenClawMirrorRuntimeSnapshot,
    pub components: Vec<OpenClawMirrorComponentRecord>,
    pub manifest: OpenClawMirrorManifestRecord,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorExportRequest {
    pub mode: String,
    pub destination_path: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawMirrorExportResult {
    pub destination_path: String,
    pub file_name: String,
    pub file_size_bytes: u64,
    pub manifest: OpenClawMirrorManifestRecord,
    pub components: Vec<OpenClawMirrorComponentRecord>,
    pub exported_at: String,
}

const STUDIO_ROUTING_COMPONENT_ID: &str = "studio-routing";
const STUDIO_ROUTING_COMPONENT_KIND: &str = "studio-routing";
const STUDIO_ROUTING_COMPONENT_RELATIVE_PATH: &str =
    "components/studio-routing/provider-center.json";
const RUNTIME_SNAPSHOT_METADATA_ID: &str = "runtime-snapshot";
const MANAGED_ASSETS_METADATA_ID: &str = "managed-assets-inventory";
const PRIVATE_RUNTIME_SNAPSHOT_FILE_NAME: &str = "runtime.json";
const PRIVATE_MANAGED_ASSETS_FILE_NAME: &str = "managed-assets.json";

#[derive(Clone, Debug)]
struct Phase1FullPrivateExportMaterialization {
    preview: OpenClawMirrorExportPreview,
    runtime_snapshot_payload: String,
    studio_routing_payload: String,
    managed_assets_payload: String,
}

pub fn build_phase1_full_private_export_preview(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
    runtime: &ActivatedOpenClawRuntime,
) -> Result<OpenClawMirrorExportPreview> {
    Ok(build_phase1_full_private_export_materialization(paths, config, storage, runtime)?.preview)
}

pub fn export_phase1_full_private_mirror(
    request: &OpenClawMirrorExportRequest,
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
    runtime: &ActivatedOpenClawRuntime,
) -> Result<OpenClawMirrorExportResult> {
    if request.mode != "full-private" {
        return Err(FrameworkError::InvalidOperation(format!(
            "unsupported openclaw mirror export mode: {}",
            request.mode
        )));
    }

    let materialization =
        build_phase1_full_private_export_materialization(paths, config, storage, runtime)?;
    let preview = materialization.preview;
    let destination_path = &request.destination_path;
    let parent_dir = destination_path.parent().ok_or_else(|| {
        FrameworkError::ValidationFailed(format!(
            "openclaw mirror export destination must include a parent directory: {}",
            destination_path.display()
        ))
    })?;

    fs::create_dir_all(parent_dir)?;
    let staging_root = parent_dir.join(format!(
        ".openclaw-mirror-export-staging-{}",
        Uuid::new_v4()
    ));
    fs::create_dir_all(&staging_root)?;

    let export_result = (|| -> Result<OpenClawMirrorExportResult> {
        write_preview_to_staging(
            &preview,
            &staging_root,
            runtime,
            &materialization.runtime_snapshot_payload,
            &materialization.studio_routing_payload,
            &materialization.managed_assets_payload,
        )?;
        create_archive_from_staging(&staging_root, destination_path)?;

        let metadata = fs::metadata(destination_path)?;
        let file_name = destination_path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| {
                FrameworkError::ValidationFailed(format!(
                    "openclaw mirror export destination has no file name: {}",
                    destination_path.display()
                ))
            })?;

        Ok(OpenClawMirrorExportResult {
            destination_path: normalize_path(destination_path),
            file_name: file_name.to_string(),
            file_size_bytes: metadata.len(),
            manifest: preview.manifest.clone(),
            components: preview.components.clone(),
            exported_at: OffsetDateTime::now_utc()
                .format(&Rfc3339)
                .map_err(|error| {
                    FrameworkError::Internal(format!(
                        "format openclaw mirror export timestamp: {error}"
                    ))
                })?,
        })
    })();

    let _ = fs::remove_dir_all(&staging_root);
    export_result
}

fn build_phase1_full_private_export_materialization(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
    runtime: &ActivatedOpenClawRuntime,
) -> Result<Phase1FullPrivateExportMaterialization> {
    let runtime_snapshot = build_managed_runtime_snapshot(runtime)?;
    let managed_assets = build_phase1_full_private_managed_assets_snapshot(runtime)?;
    let runtime_snapshot_payload = serialize_private_metadata_payload(&runtime_snapshot)?;
    let managed_assets_payload = serialize_private_metadata_payload(&managed_assets)?;
    let metadata_files =
        build_private_metadata_file_records(&runtime_snapshot_payload, &managed_assets_payload);
    let mut components = build_phase1_full_private_components(runtime)?;
    let (studio_routing_component, studio_routing_payload) =
        build_phase1_studio_routing_component(paths, config, storage)?;
    components.push(studio_routing_component);
    let manifest = build_phase1_full_private_manifest(runtime, &components, &metadata_files)?;

    Ok(Phase1FullPrivateExportMaterialization {
        preview: OpenClawMirrorExportPreview {
            mode: "full-private".to_string(),
            runtime: runtime_snapshot,
            components,
            manifest,
        },
        runtime_snapshot_payload,
        studio_routing_payload,
        managed_assets_payload,
    })
}

fn build_phase1_studio_routing_component(
    paths: &AppPaths,
    config: &AppConfig,
    storage: &StorageService,
) -> Result<(OpenClawMirrorComponentRecord, String)> {
    let catalog = export_provider_center_catalog(paths, config, storage)?;
    let payload = serialize_provider_center_catalog(&catalog)?;
    let component = build_virtual_component_record(
        STUDIO_ROUTING_COMPONENT_ID,
        STUDIO_ROUTING_COMPONENT_KIND,
        STUDIO_ROUTING_COMPONENT_RELATIVE_PATH,
        compute_bytes_digest_sha256(payload.as_bytes()),
        payload.len() as u64,
        1,
        true,
    );

    Ok((component, payload))
}

fn write_preview_to_staging(
    preview: &OpenClawMirrorExportPreview,
    staging_root: &Path,
    runtime: &ActivatedOpenClawRuntime,
    runtime_snapshot_payload: &str,
    studio_routing_payload: &str,
    managed_assets_payload: &str,
) -> Result<()> {
    fs::write(
        staging_root.join("manifest.json"),
        serde_json::to_string(&preview.manifest)?,
    )?;
    fs::write(
        staging_root.join(PRIVATE_RUNTIME_SNAPSHOT_FILE_NAME),
        runtime_snapshot_payload,
    )?;
    fs::write(
        staging_root.join(PRIVATE_MANAGED_ASSETS_FILE_NAME),
        managed_assets_payload,
    )?;

    for component in &preview.components {
        match component.id.as_str() {
            "config" => copy_file(
                &runtime.config_path,
                &staging_root.join(&component.relative_path),
            )?,
            "state" => copy_directory_contents(
                &runtime.state_dir,
                &staging_root.join(&component.relative_path),
                &[runtime.workspace_dir.clone(), runtime.config_path.clone()],
            )?,
            "workspace" => copy_directory_contents(
                &runtime.workspace_dir,
                &staging_root.join(&component.relative_path),
                &[],
            )?,
            STUDIO_ROUTING_COMPONENT_ID => write_virtual_file(
                &staging_root.join(&component.relative_path),
                studio_routing_payload,
            )?,
            other => {
                return Err(FrameworkError::InvalidOperation(format!(
                    "unsupported openclaw mirror component id: {other}"
                )))
            }
        }
    }

    Ok(())
}

fn build_private_metadata_file_records(
    runtime_snapshot_payload: &str,
    managed_assets_payload: &str,
) -> Vec<OpenClawMirrorManifestMetadataFileRecord> {
    vec![
        build_manifest_metadata_file_record(
            RUNTIME_SNAPSHOT_METADATA_ID,
            PRIVATE_RUNTIME_SNAPSHOT_FILE_NAME,
            runtime_snapshot_payload.as_bytes(),
        ),
        build_manifest_metadata_file_record(
            MANAGED_ASSETS_METADATA_ID,
            PRIVATE_MANAGED_ASSETS_FILE_NAME,
            managed_assets_payload.as_bytes(),
        ),
    ]
}

fn serialize_private_metadata_payload<T: serde::Serialize>(payload: &T) -> Result<String> {
    Ok(format!("{}\n", serde_json::to_string_pretty(payload)?))
}

fn serialize_provider_center_catalog(
    catalog: &LocalAiProxyProviderCenterCatalogSnapshot,
) -> Result<String> {
    Ok(format!("{}\n", serde_json::to_string_pretty(catalog)?))
}

fn copy_file(source_path: &Path, destination_path: &Path) -> Result<()> {
    let parent = destination_path.parent().ok_or_else(|| {
        FrameworkError::ValidationFailed(format!(
            "destination path has no parent directory: {}",
            destination_path.display()
        ))
    })?;
    fs::create_dir_all(parent)?;
    fs::copy(source_path, destination_path)?;
    Ok(())
}

fn write_virtual_file(destination_path: &Path, content: &str) -> Result<()> {
    let parent = destination_path.parent().ok_or_else(|| {
        FrameworkError::ValidationFailed(format!(
            "destination path has no parent directory: {}",
            destination_path.display()
        ))
    })?;
    fs::create_dir_all(parent)?;
    fs::write(destination_path, content)?;
    Ok(())
}

fn copy_directory_contents(
    source_dir: &Path,
    destination_dir: &Path,
    excluded_paths: &[PathBuf],
) -> Result<()> {
    fs::create_dir_all(destination_dir)?;

    for entry in fs::read_dir(source_dir)? {
        let entry = entry?;
        let entry_path = entry.path();
        if should_exclude_path(&entry_path, excluded_paths) {
            continue;
        }

        let destination_path = destination_dir.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_directory_contents(&entry_path, &destination_path, excluded_paths)?;
            continue;
        }

        copy_file(&entry_path, &destination_path)?;
    }

    Ok(())
}

fn should_exclude_path(candidate_path: &Path, excluded_paths: &[PathBuf]) -> bool {
    excluded_paths.iter().any(|excluded_path| {
        candidate_path == excluded_path || candidate_path.starts_with(excluded_path)
    })
}

fn create_archive_from_staging(staging_root: &Path, destination_path: &Path) -> Result<()> {
    let temp_zip_path = destination_path.with_extension(format!("{}.zip", Uuid::new_v4()));

    #[cfg(windows)]
    let archive_result = create_windows_archive_from_staging(staging_root, &temp_zip_path);
    #[cfg(not(windows))]
    let archive_result = create_unix_archive_from_staging(staging_root, &temp_zip_path);

    if let Err(error) = archive_result {
        let _ = fs::remove_file(&temp_zip_path);
        return Err(error);
    }

    if destination_path.exists() {
        fs::remove_file(destination_path)?;
    }
    fs::rename(&temp_zip_path, destination_path)?;
    Ok(())
}

#[cfg(windows)]
fn create_windows_archive_from_staging(staging_root: &Path, destination_path: &Path) -> Result<()> {
    let archive_glob = format!("{}\\*", normalize_native_path(staging_root));
    let destination = normalize_native_path(destination_path);
    let script = format!(
        "$ErrorActionPreference = 'Stop'; if (Test-Path -LiteralPath '{destination}') {{ Remove-Item -LiteralPath '{destination}' -Force }}; Compress-Archive -Path '{archive_glob}' -DestinationPath '{destination}' -Force"
    );
    let mut command = Command::new("powershell");
    configure_hidden_child_process(&mut command);
    let output = command.args(["-NoProfile", "-Command", &script]).output()?;

    if !output.status.success() {
        return Err(FrameworkError::ProcessFailed {
            command: "powershell Compress-Archive".to_string(),
            exit_code: output.status.code(),
            stderr_tail: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        });
    }

    Ok(())
}

#[cfg(not(windows))]
fn create_unix_archive_from_staging(staging_root: &Path, destination_path: &Path) -> Result<()> {
    let output = Command::new("zip")
        .args(["-q", "-r", destination_path.to_string_lossy().as_ref(), "."])
        .current_dir(staging_root)
        .output()?;

    if !output.status.success() {
        return Err(FrameworkError::ProcessFailed {
            command: "zip -q -r".to_string(),
            exit_code: output.status.code(),
            stderr_tail: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        });
    }

    Ok(())
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn normalize_native_path(path: &Path) -> String {
    path.to_string_lossy().replace('\'', "''")
}

#[cfg(test)]
mod tests {
    use super::{
        build_phase1_full_private_export_preview, export_phase1_full_private_mirror,
        OpenClawMirrorExportRequest,
    };
    use crate::framework::{
        config::AppConfig,
        openclaw_release::bundled_openclaw_version,
        paths::{resolve_paths_for_root, AppPaths},
        services::{
            local_ai_proxy_snapshot::LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE,
            openclaw_runtime::ActivatedOpenClawRuntime, storage::StorageService,
        },
        storage::{StorageProfileConfig, StorageProviderKind, StoragePutTextRequest},
    };
    use std::{fs, io::Read, path::Path, process::Command};

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
        fs::create_dir_all(paths.openclaw_root_dir.join("agents").join("main"))
            .expect("agents dir");
        fs::create_dir_all(&paths.openclaw_workspace_dir).expect("workspace dir");
        fs::write(&paths.openclaw_config_file, "{ \"agents\": {} }").expect("config");
        fs::write(
            paths
                .openclaw_root_dir
                .join("agents")
                .join("main")
                .join("profile.json"),
            "{ \"id\": \"main\" }",
        )
        .expect("state file");
        fs::write(
            paths.openclaw_workspace_dir.join("AGENTS.md"),
            "# managed workspace",
        )
        .expect("workspace file");
    }

    fn create_storage_config() -> AppConfig {
        let mut config = AppConfig::default();
        config.storage.active_profile_id = "default-sqlite".to_string();
        config.storage.profiles = vec![StorageProfileConfig {
            id: "default-sqlite".to_string(),
            label: "SQLite".to_string(),
            provider: StorageProviderKind::Sqlite,
            namespace: "claw-studio".to_string(),
            path: Some("profiles/default.db".to_string()),
            connection: None,
            database: None,
            endpoint: None,
            read_only: false,
        }];
        config
    }

    fn seed_provider_center_route(paths: &AppPaths, config: &AppConfig) {
        StorageService::new()
            .put_text(
                paths,
                config,
                StoragePutTextRequest {
                    profile_id: Some("default-sqlite".to_string()),
                    namespace: Some(LOCAL_AI_PROXY_PROVIDER_CENTER_NAMESPACE.to_string()),
                    key: "route-openai".to_string(),
                    value: r#"{
  "id": "route-openai",
  "name": "OpenAI Mirror Route",
  "enabled": true,
  "isDefault": true,
  "managedBy": "user",
  "clientProtocol": "openai-compatible",
  "upstreamProtocol": "openai-compatible",
  "providerId": "openai",
  "upstreamBaseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-openai",
  "defaultModelId": "gpt-5.4",
  "models": [
    { "id": "gpt-5.4", "name": "GPT-5.4" }
  ],
  "notes": "mirror export route",
  "exposeTo": ["openclaw"]
}"#
                    .to_string(),
                },
            )
            .expect("seed provider center route");
    }

    fn extract_archive_for_test(archive_path: &Path, destination_dir: &Path) {
        fs::create_dir_all(destination_dir).expect("extract destination");
        let zip_path = destination_dir.join("mirror-test.zip");
        fs::copy(archive_path, &zip_path).expect("copy test archive");
        #[cfg(windows)]
        {
            let status = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    &format!(
                        "Expand-Archive -Force -LiteralPath '{}' -DestinationPath '{}'",
                        zip_path.display(),
                        destination_dir.display()
                    ),
                ])
                .status()
                .expect("run expand-archive");
            assert!(status.success(), "expand-archive should succeed");
        }

        #[cfg(not(windows))]
        {
            let status = Command::new("unzip")
                .args([
                    "-qq",
                    zip_path.to_string_lossy().as_ref(),
                    "-d",
                    destination_dir.to_string_lossy().as_ref(),
                ])
                .status()
                .expect("run unzip");
            assert!(status.success(), "unzip should succeed");
        }
    }

    #[test]
    fn openclaw_mirror_export_hides_windows_archive_child_processes() {
        let production_source = include_str!("openclaw_mirror_export.rs")
            .split("mod tests {")
            .next()
            .expect("production source");
        let archive_source = production_source
            .split("fn create_windows_archive_from_staging")
            .nth(1)
            .and_then(|tail| tail.split("fn create_unix_archive_from_staging").next())
            .expect("windows archive source");

        assert!(
            archive_source.contains("configure_hidden_child_process(&mut command);"),
            "PowerShell Compress-Archive must use the shared hidden child process policy"
        );
    }

    #[test]
    fn openclaw_mirror_export_builds_phase1_preview() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_built_in_openclaw_tree(&paths);
        let config = create_storage_config();
        seed_provider_center_route(&paths, &config);
        let storage = StorageService::new();
        let runtime = create_runtime(&paths);

        let preview = build_phase1_full_private_export_preview(&paths, &config, &storage, &runtime)
            .expect("mirror export preview");

        assert_eq!(preview.mode, "full-private");
        assert_eq!(preview.components.len(), 4);
        assert_eq!(preview.manifest.components.len(), 4);
        assert_eq!(
            preview.components[0].relative_path,
            "components/config/openclaw.json"
        );
        assert!(preview.components.iter().all(|component| component
            .digest_sha256
            .as_deref()
            .unwrap_or_default()
            .len()
            == 64));
        assert!(preview.manifest.components.iter().all(|component| component
            .digest_sha256
            .as_deref()
            .unwrap_or_default()
            .len()
            == 64));
        assert!(preview
            .components
            .iter()
            .any(|component| component.id == "studio-routing"));
    }

    #[test]
    fn openclaw_mirror_export_writes_ocmirror_zip_with_manifest_and_payloads() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        seed_built_in_openclaw_tree(&paths);
        let config = create_storage_config();
        seed_provider_center_route(&paths, &config);
        let storage = StorageService::new();
        let runtime = create_runtime(&paths);
        let destination_path = root
            .path()
            .join("exports")
            .join("managed-full-private.ocmirror");

        let result = export_phase1_full_private_mirror(
            &OpenClawMirrorExportRequest {
                mode: "full-private".to_string(),
                destination_path: destination_path.clone(),
            },
            &paths,
            &config,
            &storage,
            &runtime,
        )
        .expect("export mirror");

        assert_eq!(result.file_name, "managed-full-private.ocmirror");
        assert!(destination_path.exists());
        assert!(result.file_size_bytes > 0);

        let extracted_dir = root.path().join("extracted");
        extract_archive_for_test(&destination_path, &extracted_dir);
        assert!(extracted_dir.join("manifest.json").exists());
        assert!(extracted_dir.join("runtime.json").exists());
        assert!(extracted_dir.join("managed-assets.json").exists());
        assert!(extracted_dir
            .join("components")
            .join("config")
            .join("openclaw.json")
            .exists());
        assert!(extracted_dir
            .join("components")
            .join("workspace")
            .join("AGENTS.md")
            .exists());
        assert!(extracted_dir
            .join("components")
            .join("state")
            .join("agents")
            .join("main")
            .join("profile.json")
            .exists());
        assert!(extracted_dir
            .join("components")
            .join("studio-routing")
            .join("provider-center.json")
            .exists());

        let mut manifest_json = String::new();
        fs::File::open(extracted_dir.join("manifest.json"))
            .expect("manifest entry")
            .read_to_string(&mut manifest_json)
            .expect("manifest text");
        assert!(manifest_json.contains("\"mode\":\"full-private\""));
        assert!(manifest_json.contains("\"relativePath\":\"components/config/openclaw.json\""));
        assert!(manifest_json.contains("\"digestSha256\":\""));
        assert!(manifest_json.contains("\"id\":\"studio-routing\""));
        assert!(manifest_json.contains("\"metadataFiles\":["));
        assert!(manifest_json.contains("\"id\":\"runtime-snapshot\""));
        assert!(manifest_json.contains("\"relativePath\":\"runtime.json\""));
        assert!(manifest_json.contains("\"id\":\"managed-assets-inventory\""));
        assert!(manifest_json.contains("\"relativePath\":\"managed-assets.json\""));
    }
}
