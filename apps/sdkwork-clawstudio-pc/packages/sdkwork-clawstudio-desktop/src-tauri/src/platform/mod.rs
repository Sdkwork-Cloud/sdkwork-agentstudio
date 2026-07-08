use crate::framework::{paths::AppPaths, Result};
use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};

pub fn current_target() -> &'static str {
    std::env::consts::OS
}

pub fn current_arch() -> &'static str {
    std::env::consts::ARCH
}

pub fn current_family() -> &'static str {
    std::env::consts::FAMILY
}

pub fn load_or_create_device_id(paths: &AppPaths) -> Result<String> {
    if paths.device_id_file.exists() {
        let content = fs::read_to_string(&paths.device_id_file)?;
        let value = content.trim().to_string();
        if !value.is_empty() {
            return Ok(value);
        }
    }

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let value = format!("desktop-{}-{}-{stamp}", current_target(), current_arch());
    fs::write(&paths.device_id_file, &value)?;

    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::load_or_create_device_id;
    use crate::framework::paths::resolve_paths_for_root;

    #[test]
    fn persists_device_id_between_reads() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");

        let first = load_or_create_device_id(&paths).expect("first device id");
        let second = load_or_create_device_id(&paths).expect("second device id");

        assert_eq!(first, second);
        assert!(paths.device_id_file.exists());
    }
}
