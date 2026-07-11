use crate::framework::{paths::AppPaths, Result};

use super::KernelRuntimeContract;

pub trait KernelRuntimeAdapter {
    fn runtime_id(&self) -> &'static str;

    fn contract(&self, paths: &AppPaths) -> Result<KernelRuntimeContract>;

    fn verify_install(&self, _paths: &AppPaths, _install_key: &str) -> Result<()> {
        Ok(())
    }

    fn resolve_install_version_label(
        &self,
        _paths: &AppPaths,
        install_key: &str,
    ) -> Result<Option<String>> {
        Ok(Some(install_key.to_string()))
    }
}
