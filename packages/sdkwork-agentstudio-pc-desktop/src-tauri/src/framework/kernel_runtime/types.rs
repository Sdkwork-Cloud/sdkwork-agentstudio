use std::path::PathBuf;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KernelRuntimeReadinessProbe {
    pub supports_loopback_health_probe: bool,
    pub health_probe_timeout_ms: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KernelRuntimeContract {
    pub runtime_id: String,
    pub config_file_path: PathBuf,
    pub owned_runtime_roots: Vec<PathBuf>,
    pub readiness_probe: KernelRuntimeReadinessProbe,
}
