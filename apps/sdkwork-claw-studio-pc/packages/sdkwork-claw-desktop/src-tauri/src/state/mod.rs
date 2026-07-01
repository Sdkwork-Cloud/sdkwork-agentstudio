use crate::{
    framework::{config::AppConfig, context::FrameworkContext, paths::AppPaths},
    platform,
};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, RwLock,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AppMetadata {
    pub app_name: String,
    pub app_version: String,
    pub target: String,
}

impl AppMetadata {
    pub fn new(app_name: String, app_version: String, target: String) -> Self {
        Self {
            app_name,
            app_version,
            target,
        }
    }
}

impl Default for AppMetadata {
    fn default() -> Self {
        Self::new(
            "Claw Studio".to_string(),
            env!("CARGO_PKG_VERSION").to_string(),
            platform::current_target().to_string(),
        )
    }
}

#[derive(Clone, Debug, Default)]
pub struct ShutdownIntent {
    requested: Arc<AtomicBool>,
}

impl ShutdownIntent {
    pub fn is_requested(&self) -> bool {
        self.requested.load(Ordering::Relaxed)
    }

    pub fn request(&self) -> bool {
        !self.requested.swap(true, Ordering::Relaxed)
    }
}

#[derive(Clone, Debug)]
pub struct AppState {
    pub app_name: String,
    pub app_version: String,
    pub target: String,
    pub context: Arc<FrameworkContext>,
    pub paths: AppPaths,
    pub config: Arc<RwLock<AppConfig>>,
    pub shutdown_intent: ShutdownIntent,
}

impl AppState {
    #[cfg(test)]
    pub fn from_context(context: Arc<FrameworkContext>) -> Self {
        Self::from_metadata(AppMetadata::default(), context)
    }

    pub fn from_metadata(metadata: AppMetadata, context: Arc<FrameworkContext>) -> Self {
        Self {
            app_name: metadata.app_name,
            app_version: metadata.app_version,
            target: metadata.target,
            context: context.clone(),
            paths: context.paths.clone(),
            config: Arc::new(RwLock::new(context.config.clone())),
            shutdown_intent: ShutdownIntent::default(),
        }
    }

    pub fn config_snapshot(&self) -> AppConfig {
        self.config
            .read()
            .expect("application config read lock")
            .clone()
    }

    pub fn replace_config(&self, next_config: AppConfig) {
        *self.config.write().expect("application config write lock") = next_config;
    }
}

#[cfg(test)]
mod tests {
    use super::{AppMetadata, AppState, ShutdownIntent};
    use crate::framework::{
        config::AppConfig, context::FrameworkContext, logging::init_logger,
        paths::resolve_paths_for_root,
    };
    use std::sync::Arc;

    #[test]
    fn state_captures_framework_context() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let config = AppConfig {
            theme: "dark".to_string(),
            ..AppConfig::default()
        };
        let context = Arc::new(FrameworkContext::from_parts(
            paths.clone(),
            config.clone(),
            logger,
        ));

        let state = AppState::from_context(context.clone());

        assert!(Arc::ptr_eq(&state.context, &context));
        assert_eq!(state.context.paths, paths);
        assert_eq!(state.context.config, config);
        assert_eq!(state.config_snapshot(), config);
        assert_eq!(state.target, crate::platform::current_target());
        assert!(!state.shutdown_intent.is_requested());
    }

    #[test]
    fn state_uses_supplied_runtime_metadata() {
        let root = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(root.path()).expect("paths");
        let logger = init_logger(&paths).expect("logger");
        let context = Arc::new(FrameworkContext::from_parts(
            paths,
            AppConfig::default(),
            logger,
        ));
        let metadata = AppMetadata::new(
            "Claw Studio Desktop".to_string(),
            "9.9.9".to_string(),
            "test-target".to_string(),
        );

        let state = AppState::from_metadata(metadata.clone(), context);

        assert_eq!(state.app_name, metadata.app_name);
        assert_eq!(state.app_version, metadata.app_version);
        assert_eq!(state.target, metadata.target);
        assert_eq!(state.config_snapshot(), AppConfig::default());
    }

    #[test]
    fn shutdown_intent_is_shared_across_clones() {
        let intent = ShutdownIntent::default();
        let clone = intent.clone();

        assert!(intent.request());
        assert!(intent.is_requested());
        assert!(clone.is_requested());
        assert!(!clone.request());
    }
}
