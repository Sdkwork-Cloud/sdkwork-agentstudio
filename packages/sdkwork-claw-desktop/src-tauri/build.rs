use std::{
    env, fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

const FRONTEND_DIST_RELATIVE_PATH: &str = "../dist";
const GENERATED_BUNDLED_RELATIVE_PATH: &str = "generated/bundled";
const GENERATED_BUNDLED_PLACEHOLDER_FILE_NAME: &str = "placeholder.txt";
const OPENCLAW_RELEASE_CONFIG_RELATIVE_PATH: &str = "../../../config/kernel-releases/openclaw.json";

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawReleaseConfig {
    stable_version: String,
    node_version: String,
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed={FRONTEND_DIST_RELATIVE_PATH}");
    println!("cargo:rerun-if-changed={GENERATED_BUNDLED_RELATIVE_PATH}");

    let manifest_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is always set by Cargo"),
    );

    export_openclaw_release_env(&manifest_dir);
    ensure_required_tauri_paths(&manifest_dir);
    tauri_build::build();
}

fn cargo_warn(message: &str) {
    println!("cargo:warning={message}");
}

fn export_openclaw_release_env(manifest_dir: &Path) {
    let release_config_path = manifest_dir.join(OPENCLAW_RELEASE_CONFIG_RELATIVE_PATH);
    println!("cargo:rerun-if-changed={}", release_config_path.display());

    let release_config = serde_json::from_str::<OpenClawReleaseConfig>(
        &fs::read_to_string(&release_config_path).unwrap_or_else(|error| {
            panic!(
                "failed to read {}: {}",
                release_config_path.display(),
                error
            )
        }),
    )
    .unwrap_or_else(|error| {
        panic!(
            "failed to parse OpenClaw release config {}: {}",
            release_config_path.display(),
            error
        )
    });

    println!(
        "cargo:rustc-env=SDKWORK_BUNDLED_OPENCLAW_VERSION={}",
        release_config.stable_version
    );
    println!(
        "cargo:rustc-env=SDKWORK_REQUIRED_OPENCLAW_NODE_VERSION={}",
        release_config.node_version
    );
}

fn ensure_required_tauri_paths(manifest_dir: &Path) {
    ensure_directory_exists(
        &manifest_dir.join(FRONTEND_DIST_RELATIVE_PATH),
        "frontendDist",
    );
    ensure_generated_bundled_placeholder(&manifest_dir.join(GENERATED_BUNDLED_RELATIVE_PATH));
}

fn ensure_directory_exists(directory: &Path, label: &str) {
    if directory.exists() {
        return;
    }

    match fs::create_dir_all(directory) {
        Ok(()) => {
            cargo_warn(&format!(
                "created missing {} directory {} so clean-clone cargo builds can resolve the Tauri config",
                label,
                directory.display()
            ));
        }
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            repair_stale_directory_entry(directory, label);
        }
        Err(error) => {
            cargo_warn(&format!(
                "failed to create missing {} directory {}: {}",
                label,
                directory.display(),
                error
            ));
        }
    }
}

fn repair_stale_directory_entry(directory: &Path, label: &str) {
    let metadata = match fs::symlink_metadata(directory) {
        Ok(metadata) => metadata,
        Err(error) => {
            cargo_warn(&format!(
                "failed to inspect stale {} path {}: {}",
                label,
                directory.display(),
                error
            ));
            return;
        }
    };

    if metadata.is_dir() && directory.exists() {
        return;
    }

    let remove_result = if metadata.file_type().is_symlink() || metadata.is_file() {
        fs::remove_file(directory)
    } else if metadata.is_dir() && is_windows_reparse_directory(&metadata) {
        fs::remove_dir(directory)
    } else {
        fs::remove_dir_all(directory)
    };

    if let Err(error) = remove_result {
        cargo_warn(&format!(
            "failed to remove stale {} path {}: {}",
            label,
            directory.display(),
            error
        ));
        return;
    }

    if let Err(error) = fs::create_dir_all(directory) {
        cargo_warn(&format!(
            "failed to recreate {} directory {} after removing a stale path: {}",
            label,
            directory.display(),
            error
        ));
        return;
    }

    cargo_warn(&format!(
        "recreated {} directory {} after removing a stale clean-clone path",
        label,
        directory.display()
    ));
}

#[cfg(windows)]
fn is_windows_reparse_directory(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;

    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_windows_reparse_directory(_metadata: &fs::Metadata) -> bool {
    false
}

fn ensure_generated_bundled_placeholder(directory: &Path) {
    ensure_directory_exists(directory, "generated bundled resources");

    let placeholder_path = directory.join(GENERATED_BUNDLED_PLACEHOLDER_FILE_NAME);
    let has_real_entries = match fs::read_dir(directory) {
        Ok(entries) => entries.filter_map(Result::ok).any(|entry| {
            if entry.file_name() == GENERATED_BUNDLED_PLACEHOLDER_FILE_NAME {
                return false;
            }

            match entry.file_type() {
                Ok(file_type) => file_type.is_file() || file_type.is_dir(),
                Err(_) => true,
            }
        }),
        Err(error) => {
            cargo_warn(&format!(
                "failed to inspect generated bundled resources at {}: {}",
                directory.display(),
                error
            ));
            return;
        }
    };

    if has_real_entries {
        if placeholder_path.is_file() {
            if let Err(error) = fs::remove_file(&placeholder_path) {
                cargo_warn(&format!(
                    "failed to remove stale generated bundled placeholder {}: {}",
                    placeholder_path.display(),
                    error
                ));
            }
        }
        return;
    }

    if placeholder_path.is_file() {
        return;
    }

    if let Err(error) = fs::write(
        &placeholder_path,
        "Generated placeholder file for clean-clone cargo builds.\n",
    ) {
        cargo_warn(&format!(
            "failed to write generated bundled placeholder {}: {}",
            placeholder_path.display(),
            error
        ));
        return;
    }

    cargo_warn(&format!(
        "seeded generated bundled placeholder {} so Tauri resource glob resolution stays valid before sync",
        placeholder_path.display()
    ));
}
