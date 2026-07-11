use crate::framework::{paths::AppPaths, policy, FrameworkError, Result};
use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedFileEntry {
    pub path: PathBuf,
    pub name: String,
    pub kind: String,
    pub size: Option<u64>,
    pub extension: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedPathInfo {
    pub path: PathBuf,
    pub name: String,
    pub kind: String,
    pub size: Option<u64>,
    pub extension: Option<String>,
    pub exists: bool,
    pub last_modified_ms: Option<u64>,
}

pub fn list_directory(paths: &AppPaths, path: &str) -> Result<Vec<ManagedFileEntry>> {
    let resolved = policy::resolve_managed_path(paths, Path::new(path))?;
    let metadata = fs::metadata(&resolved)?;
    if !metadata.is_dir() {
        return Err(FrameworkError::InvalidOperation(format!(
            "{} is not a directory",
            resolved.display()
        )));
    }

    let mut entries = fs::read_dir(&resolved)?
        .map(|entry| {
            let entry = entry?;
            let path = entry.path();
            let metadata = entry.metadata()?;
            let kind = if metadata.is_dir() {
                "directory"
            } else {
                "file"
            };
            let size = if metadata.is_file() {
                Some(metadata.len())
            } else {
                None
            };
            let name = entry.file_name().to_string_lossy().into_owned();
            let extension = path
                .extension()
                .map(|value| value.to_string_lossy().into_owned());

            Ok(ManagedFileEntry {
                path,
                name,
                kind: kind.to_string(),
                size,
                extension,
            })
        })
        .collect::<Result<Vec<_>>>()?;

    entries.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(entries)
}

pub fn path_exists(paths: &AppPaths, path: &str) -> Result<bool> {
    let resolved = policy::resolve_managed_path(paths, Path::new(path))?;
    Ok(resolved.exists())
}

pub fn get_path_info(paths: &AppPaths, path: &str) -> Result<ManagedPathInfo> {
    let resolved = policy::resolve_managed_path(paths, Path::new(path))?;
    Ok(build_path_info(&resolved))
}

pub fn create_directory(paths: &AppPaths, path: &str) -> Result<()> {
    let resolved = policy::resolve_managed_path(paths, Path::new(path))?;
    fs::create_dir_all(resolved)?;
    Ok(())
}

pub fn remove_path(paths: &AppPaths, path: &str) -> Result<()> {
    let resolved = policy::resolve_managed_path(paths, Path::new(path))?;
    policy::ensure_not_managed_root(paths, &resolved)?;
    let metadata = fs::metadata(&resolved)?;

    if metadata.is_dir() {
        fs::remove_dir_all(resolved)?;
    } else {
        fs::remove_file(resolved)?;
    }

    Ok(())
}

pub fn copy_path(paths: &AppPaths, source: &str, destination: &str) -> Result<()> {
    let source_path = policy::resolve_managed_path(paths, Path::new(source))?;
    let destination_path = policy::resolve_managed_path(paths, Path::new(destination))?;
    ensure_distinct_paths(&source_path, &destination_path)?;
    ensure_destination_available(&destination_path)?;
    copy_path_internal(&source_path, &destination_path)
}

pub fn move_path(paths: &AppPaths, source: &str, destination: &str) -> Result<()> {
    let source_path = policy::resolve_managed_path(paths, Path::new(source))?;
    let destination_path = policy::resolve_managed_path(paths, Path::new(destination))?;
    ensure_distinct_paths(&source_path, &destination_path)?;
    ensure_destination_available(&destination_path)?;
    policy::ensure_not_managed_root(paths, &source_path)?;

    match fs::rename(&source_path, &destination_path) {
        Ok(()) => Ok(()),
        Err(_) => {
            copy_path_internal(&source_path, &destination_path)?;
            remove_existing_path(&source_path)?;
            Ok(())
        }
    }
}

pub fn read_binary_file(paths: &AppPaths, path: &str) -> Result<Vec<u8>> {
    let resolved = policy::resolve_managed_path(paths, Path::new(path))?;
    let metadata = fs::metadata(&resolved)?;
    if metadata.is_dir() {
        return Err(FrameworkError::InvalidOperation(format!(
            "{} is not a file",
            resolved.display()
        )));
    }

    Ok(fs::read(resolved)?)
}

pub fn write_binary_file(paths: &AppPaths, path: &str, content: &[u8]) -> Result<()> {
    let resolved = policy::resolve_managed_path(paths, Path::new(path))?;
    policy::ensure_parent_directory(&resolved)?;
    fs::write(resolved, content)?;
    Ok(())
}

fn build_path_info(path: &Path) -> ManagedPathInfo {
    match fs::metadata(path) {
        Ok(metadata) => {
            let kind = if metadata.is_dir() {
                "directory"
            } else {
                "file"
            };
            let size = if metadata.is_file() {
                Some(metadata.len())
            } else {
                None
            };
            let extension = path
                .extension()
                .map(|value| value.to_string_lossy().into_owned());
            let last_modified_ms = metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as u64);

            ManagedPathInfo {
                path: path.to_path_buf(),
                name: path_name(path),
                kind: kind.to_string(),
                size,
                extension,
                exists: true,
                last_modified_ms,
            }
        }
        Err(_) => ManagedPathInfo {
            path: path.to_path_buf(),
            name: path_name(path),
            kind: "missing".to_string(),
            size: None,
            extension: path
                .extension()
                .map(|value| value.to_string_lossy().into_owned()),
            exists: false,
            last_modified_ms: None,
        },
    }
}

fn path_name(path: &Path) -> String {
    path.file_name()
        .or_else(|| {
            path.components()
                .next_back()
                .map(|component| component.as_os_str())
        })
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn copy_path_internal(source: &Path, destination: &Path) -> Result<()> {
    let metadata = fs::metadata(source)?;
    if metadata.is_dir() {
        fs::create_dir_all(destination)?;
        for entry in fs::read_dir(source)? {
            let entry = entry?;
            let child_source = entry.path();
            let child_destination = destination.join(entry.file_name());
            copy_path_internal(&child_source, &child_destination)?;
        }
        return Ok(());
    }

    policy::ensure_parent_directory(destination)?;
    fs::copy(source, destination)?;
    Ok(())
}

fn remove_existing_path(path: &Path) -> Result<()> {
    let metadata = fs::metadata(path)?;
    if metadata.is_dir() {
        fs::remove_dir_all(path)?;
    } else {
        fs::remove_file(path)?;
    }

    Ok(())
}

fn ensure_distinct_paths(source: &Path, destination: &Path) -> Result<()> {
    if source == destination {
        return Err(FrameworkError::InvalidOperation(
            "source and destination paths must be different".to_string(),
        ));
    }

    Ok(())
}

fn ensure_destination_available(destination: &Path) -> Result<()> {
    if destination.exists() {
        return Err(FrameworkError::InvalidOperation(format!(
            "destination already exists: {}",
            destination.display()
        )));
    }

    policy::ensure_parent_directory(destination)
}

#[cfg(test)]
mod tests {
    use super::{
        copy_path, create_directory, get_path_info, list_directory, move_path, path_exists,
        read_binary_file, remove_path, write_binary_file,
    };
    use crate::framework::paths::resolve_paths_for_root;

    #[test]
    fn creates_and_lists_directory_entries() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        create_directory(&paths, "workspace/docs").expect("create directory");
        std::fs::write(paths.data_dir.join("workspace").join("readme.md"), "hello")
            .expect("write file");

        let entries = list_directory(&paths, "workspace").expect("list directory");
        let names = entries
            .iter()
            .map(|entry| entry.name.as_str())
            .collect::<Vec<_>>();

        assert_eq!(names, vec!["docs", "readme.md"]);
        assert_eq!(entries[0].kind, "directory");
        assert_eq!(entries[1].kind, "file");
    }

    #[test]
    fn copies_moves_and_removes_managed_paths() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        std::fs::create_dir_all(paths.data_dir.join("source")).expect("create source dir");
        std::fs::write(paths.data_dir.join("source").join("note.txt"), "foundation")
            .expect("write source file");

        copy_path(&paths, "source", "copies/source-copy").expect("copy directory");
        move_path(&paths, "copies/source-copy", "archive/source-final").expect("move directory");
        remove_path(&paths, "source").expect("remove source");

        assert!(!paths.data_dir.join("source").exists());
        assert_eq!(
            std::fs::read_to_string(
                paths
                    .data_dir
                    .join("archive")
                    .join("source-final")
                    .join("note.txt")
            )
            .expect("read moved file"),
            "foundation"
        );
    }

    #[test]
    fn reports_existence_and_path_metadata() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        std::fs::create_dir_all(paths.data_dir.join("meta")).expect("create meta dir");
        std::fs::write(
            paths.data_dir.join("meta").join("info.json"),
            "{}".as_bytes(),
        )
        .expect("write meta file");

        assert!(path_exists(&paths, "meta/info.json").expect("existing path"));
        assert!(!path_exists(&paths, "meta/missing.json").expect("missing path"));

        let info = get_path_info(&paths, "meta/info.json").expect("path info");
        let missing = get_path_info(&paths, "meta/missing.json").expect("missing path info");

        assert_eq!(info.kind, "file");
        assert_eq!(info.extension.as_deref(), Some("json"));
        assert_eq!(info.size, Some(2));
        assert!(info.exists);
        assert!(info.last_modified_ms.is_some());
        assert_eq!(missing.kind, "missing");
        assert!(!missing.exists);
    }

    #[test]
    fn writes_and_reads_binary_files() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let payload = vec![0_u8, 7, 15, 31, 63, 127, 255];

        write_binary_file(&paths, "binary/blob.bin", &payload).expect("write binary file");
        let bytes = read_binary_file(&paths, "binary/blob.bin").expect("read binary file");
        let info = get_path_info(&paths, "binary/blob.bin").expect("binary path info");

        assert_eq!(bytes, payload);
        assert_eq!(info.kind, "file");
        assert_eq!(info.extension.as_deref(), Some("bin"));
        assert_eq!(info.size, Some(payload.len() as u64));
    }
}
