pub use super::types::KernelHostPlatform;
use super::types::KernelPlatformServiceSpec;
use crate::framework::{paths::AppPaths, Result};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub fn current_kernel_host_platform() -> KernelHostPlatform {
    match crate::platform::current_target() {
        "windows" => KernelHostPlatform::Windows,
        "macos" => KernelHostPlatform::Macos,
        _ => KernelHostPlatform::Linux,
    }
}

pub fn resolve_current_platform_service_spec(paths: &AppPaths) -> KernelPlatformServiceSpec {
    let platform = current_kernel_host_platform();
    let launcher_path =
        std::env::current_exe().unwrap_or_else(|_| default_launcher_path(paths, platform));
    resolve_platform_service_spec_with_launcher(platform, paths, &launcher_path)
}

#[cfg_attr(not(test), allow(dead_code))]
pub fn resolve_platform_service_spec(
    platform: KernelHostPlatform,
    paths: &AppPaths,
) -> KernelPlatformServiceSpec {
    let launcher_path = default_launcher_path(paths, platform);
    resolve_platform_service_spec_with_launcher(platform, paths, &launcher_path)
}

pub fn repair_current_platform_service_artifacts(
    paths: &AppPaths,
) -> Result<KernelPlatformServiceSpec> {
    let platform = current_kernel_host_platform();
    let launcher_path =
        std::env::current_exe().unwrap_or_else(|_| default_launcher_path(paths, platform));
    repair_platform_service_artifacts(platform, paths, &launcher_path)
}

pub fn repair_platform_service_artifacts(
    platform: KernelHostPlatform,
    paths: &AppPaths,
    launcher_path: &Path,
) -> Result<KernelPlatformServiceSpec> {
    let spec = resolve_platform_service_spec_with_launcher(platform, paths, launcher_path);
    if let Some(parent) = spec.service_config_path.parent() {
        fs::create_dir_all(parent)?;
    }

    match platform {
        KernelHostPlatform::Windows => super::platform_windows::write_service_artifact(&spec)?,
        KernelHostPlatform::Macos => super::platform_macos::write_service_artifact(&spec)?,
        KernelHostPlatform::Linux => super::platform_linux::write_service_artifact(&spec)?,
    }

    Ok(spec)
}

fn resolve_platform_service_spec_with_launcher(
    platform: KernelHostPlatform,
    paths: &AppPaths,
    launcher_path: &Path,
) -> KernelPlatformServiceSpec {
    let service_home_dir = service_home_dir(paths);

    match platform {
        KernelHostPlatform::Windows => {
            super::platform_windows::build_service_spec(paths, launcher_path, &service_home_dir)
        }
        KernelHostPlatform::Macos => {
            super::platform_macos::build_service_spec(paths, launcher_path, &service_home_dir)
        }
        KernelHostPlatform::Linux => {
            super::platform_linux::build_service_spec(paths, launcher_path, &service_home_dir)
        }
    }
}

fn service_home_dir(paths: &AppPaths) -> PathBuf {
    let Some(current_name) = paths.user_root.file_name().and_then(|value| value.to_str()) else {
        return paths.user_root.clone();
    };
    if current_name != "crawstudio" {
        return paths.user_root.clone();
    }
    let Some(sdkwork_dir) = paths.user_root.parent() else {
        return paths.user_root.clone();
    };
    if sdkwork_dir.file_name().and_then(|value| value.to_str()) != Some(".sdkwork") {
        return paths.user_root.clone();
    }
    sdkwork_dir
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| paths.user_root.clone())
}

fn default_launcher_path(paths: &AppPaths, platform: KernelHostPlatform) -> PathBuf {
    paths.install_root.join(match platform {
        KernelHostPlatform::Windows => "claw-studio.exe",
        KernelHostPlatform::Macos | KernelHostPlatform::Linux => "claw-studio",
    })
}
