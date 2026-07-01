use crate::framework::{paths::AppPaths, Result};
use sdkwork_local_api_proxy_native::config::{
    default_local_ai_proxy_public_host as shared_default_local_ai_proxy_public_host,
    ensure_local_ai_proxy_client_api_key as shared_ensure_local_ai_proxy_client_api_key,
    ensure_local_ai_proxy_config as shared_ensure_local_ai_proxy_config,
    resolve_default_local_ai_proxy_public_host_with_resolver as shared_resolve_default_local_ai_proxy_public_host_with_resolver,
    LocalAiProxyConfigFile as SharedLocalAiProxyConfigFile,
};
use std::net::IpAddr;

pub(super) type LocalAiProxyConfigFile = SharedLocalAiProxyConfigFile;

pub(crate) fn ensure_local_ai_proxy_client_api_key(paths: &AppPaths) -> Result<String> {
    Ok(shared_ensure_local_ai_proxy_client_api_key(
        &paths.local_ai_proxy_config_file,
    )?)
}

pub(super) fn ensure_local_ai_proxy_config(paths: &AppPaths) -> Result<LocalAiProxyConfigFile> {
    Ok(shared_ensure_local_ai_proxy_config(
        &paths.local_ai_proxy_config_file,
    )?)
}

#[allow(dead_code)]
pub(crate) fn default_local_ai_proxy_public_host() -> String {
    shared_default_local_ai_proxy_public_host()
}

#[allow(dead_code)]
pub(super) fn resolve_default_local_ai_proxy_public_host_with_resolver<F>(
    resolver: &mut F,
) -> String
where
    F: FnMut(&str) -> Vec<IpAddr>,
{
    shared_resolve_default_local_ai_proxy_public_host_with_resolver(resolver)
}
