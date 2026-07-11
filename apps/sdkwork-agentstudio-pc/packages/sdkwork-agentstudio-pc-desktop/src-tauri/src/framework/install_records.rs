use crate::framework::Result;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub const OPENCLAW_INSTALL_RECORDS_HOME_NAME: &str = "openclaw-install";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallRecordStatus {
    Installed,
    Uninstalled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SupportedPlatform {
    Windows,
    Macos,
    Ubuntu,
    Android,
    Ios,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EffectiveRuntimePlatform {
    Windows,
    Macos,
    Ubuntu,
    Android,
    Ios,
    Wsl,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallScope {
    System,
    User,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallControlLevel {
    Managed,
    Partial,
    Opaque,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRecord {
    pub schema_version: String,
    pub software_name: String,
    pub manifest_name: String,
    pub manifest_path: String,
    pub manifest_source_input: String,
    pub manifest_source_kind: String,
    pub platform: SupportedPlatform,
    pub effective_runtime_platform: EffectiveRuntimePlatform,
    pub installer_home: String,
    pub install_scope: InstallScope,
    pub install_root: String,
    pub work_root: String,
    pub bin_dir: String,
    pub data_root: String,
    pub install_control_level: InstallControlLevel,
    pub status: InstallRecordStatus,
    #[serde(default)]
    pub installed_at: Option<String>,
    pub updated_at: String,
}

pub fn read_install_record(
    installer_home: &str,
    software_name: &str,
) -> Result<Option<InstallRecord>> {
    let path = resolve_install_record_file(installer_home, software_name);
    if !Path::new(&path).exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)?;
    Ok(Some(serde_json::from_str(&content)?))
}

#[cfg(test)]
pub fn write_install_record(
    installer_home: &str,
    software_name: &str,
    record: &InstallRecord,
) -> Result<String> {
    let path = resolve_install_record_file(installer_home, software_name);
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(
        &path,
        format!("{}\n", serde_json::to_string_pretty(record)?),
    )?;
    Ok(path)
}

pub fn resolve_preferred_openclaw_install_records_home(user_root: &Path) -> PathBuf {
    user_root.join(OPENCLAW_INSTALL_RECORDS_HOME_NAME)
}

pub fn resolve_openclaw_install_records_home_candidates(user_root: &Path) -> Vec<PathBuf> {
    vec![resolve_preferred_openclaw_install_records_home(user_root)]
}

fn resolve_install_record_file(installer_home: &str, software_name: &str) -> String {
    join_path_segments(
        installer_home,
        &[
            "state",
            "install-records",
            &format!("{}.json", slugify_software_name(software_name)),
        ],
    )
}

fn slugify_software_name(value: &str) -> String {
    let mut slug = String::new();
    let mut last_was_dash = false;

    for ch in value.trim().chars().flat_map(|ch| ch.to_lowercase()) {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            last_was_dash = false;
        } else if !last_was_dash {
            slug.push('-');
            last_was_dash = true;
        }
    }

    let slug = slug.trim_matches('-').to_owned();
    if slug.is_empty() {
        "software".to_owned()
    } else {
        slug
    }
}

fn join_path_segments(base: &str, segments: &[&str]) -> String {
    let separator = if looks_like_windows_path(base) {
        '\\'
    } else {
        '/'
    };
    let mut output = base.trim_end_matches(['\\', '/']).to_owned();
    for segment in segments {
        let segment = segment.trim_matches(['\\', '/']);
        if segment.is_empty() {
            continue;
        }
        if !output.ends_with(separator) {
            output.push(separator);
        }
        output.push_str(segment);
    }
    output
}

fn looks_like_windows_path(value: &str) -> bool {
    let trimmed = value.trim();
    trimmed.starts_with("\\\\")
        || trimmed.starts_with("//")
        || (trimmed.len() >= 2 && trimmed.as_bytes()[1] == b':')
}
