use crate::framework::{
    filesystem::{self, ManagedFileEntry, ManagedPathInfo},
    kernel::DesktopFileSystemInfo,
    paths::AppPaths,
    policy, Result,
};
use std::path::Path;

#[derive(Clone, Debug, Default)]
pub struct FileSystemService;

impl FileSystemService {
    pub fn new() -> Self {
        Self
    }

    pub fn list_directory(&self, paths: &AppPaths, path: &str) -> Result<Vec<ManagedFileEntry>> {
        filesystem::list_directory(paths, path)
    }

    pub fn path_exists(&self, paths: &AppPaths, path: &str) -> Result<bool> {
        filesystem::path_exists(paths, path)
    }

    pub fn path_exists_for_user_tooling(&self, paths: &AppPaths, path: &str) -> Result<bool> {
        let resolved = policy::resolve_user_tooling_config_path(paths, Path::new(path))?;
        Ok(resolved.exists())
    }

    pub fn get_path_info(&self, paths: &AppPaths, path: &str) -> Result<ManagedPathInfo> {
        filesystem::get_path_info(paths, path)
    }

    pub fn create_directory(&self, paths: &AppPaths, path: &str) -> Result<()> {
        filesystem::create_directory(paths, path)
    }

    pub fn remove_path(&self, paths: &AppPaths, path: &str) -> Result<()> {
        filesystem::remove_path(paths, path)
    }

    pub fn copy_path(&self, paths: &AppPaths, source: &str, destination: &str) -> Result<()> {
        filesystem::copy_path(paths, source, destination)
    }

    pub fn move_path(&self, paths: &AppPaths, source: &str, destination: &str) -> Result<()> {
        filesystem::move_path(paths, source, destination)
    }

    pub fn read_binary(&self, paths: &AppPaths, path: &str) -> Result<Vec<u8>> {
        filesystem::read_binary_file(paths, path)
    }

    pub fn write_binary(&self, paths: &AppPaths, path: &str, content: &[u8]) -> Result<()> {
        filesystem::write_binary_file(paths, path, content)
    }

    pub fn read_text(&self, paths: &AppPaths, path: &str) -> Result<String> {
        let resolved = policy::resolve_managed_path(paths, Path::new(path))?;
        Ok(std::fs::read_to_string(resolved)?)
    }

    pub fn read_text_for_user_tooling(&self, paths: &AppPaths, path: &str) -> Result<String> {
        let resolved = policy::resolve_user_tooling_config_path(paths, Path::new(path))?;
        Ok(std::fs::read_to_string(resolved)?)
    }

    pub fn write_text(&self, paths: &AppPaths, path: &str, content: &str) -> Result<()> {
        let resolved = policy::resolve_managed_path(paths, Path::new(path))?;
        policy::ensure_parent_directory(&resolved)?;
        std::fs::write(resolved, content)?;
        Ok(())
    }

    pub fn kernel_info(&self, paths: &AppPaths) -> DesktopFileSystemInfo {
        DesktopFileSystemInfo {
            default_working_directory: paths.data_dir.to_string_lossy().into_owned(),
            managed_roots: policy::managed_path_roots_snapshot(paths)
                .into_iter()
                .map(|root| root.to_string_lossy().into_owned())
                .collect(),
            supports_binary_io: true,
        }
    }
}
