use std::{fmt, io, path::PathBuf};

pub type Result<T> = std::result::Result<T, FrameworkError>;

#[derive(Debug)]
pub enum FrameworkError {
    Io(io::Error),
    Serde(serde_json::Error),
    Tauri(tauri::Error),
    InvalidOperation(String),
    PolicyViolation {
        path: PathBuf,
        reason: String,
    },
    ValidationFailed(String),
    PolicyDenied {
        resource: String,
        reason: String,
    },
    NotFound(String),
    Conflict(String),
    #[allow(dead_code)]
    Timeout(String),
    #[allow(dead_code)]
    Cancelled(String),
    ProcessFailed {
        command: String,
        exit_code: Option<i32>,
        stderr_tail: String,
    },
    Internal(String),
}

impl fmt::Display for FrameworkError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(error) => write!(f, "io error: {error}"),
            Self::Serde(error) => write!(f, "serde error: {error}"),
            Self::Tauri(error) => write!(f, "tauri error: {error}"),
            Self::InvalidOperation(reason) => write!(f, "invalid operation: {reason}"),
            Self::PolicyViolation { path, reason } => {
                write!(f, "path policy violation for {}: {reason}", path.display())
            }
            Self::ValidationFailed(reason) => write!(f, "validation failed: {reason}"),
            Self::PolicyDenied { resource, reason } => {
                write!(f, "policy denied for {resource}: {reason}")
            }
            Self::NotFound(resource) => write!(f, "not found: {resource}"),
            Self::Conflict(reason) => write!(f, "conflict: {reason}"),
            Self::Timeout(reason) => write!(f, "timeout: {reason}"),
            Self::Cancelled(reason) => write!(f, "cancelled: {reason}"),
            Self::ProcessFailed {
                command,
                exit_code,
                stderr_tail,
            } => {
                write!(
                    f,
                    "process failed for \"{command}\" with exit code {:?}: {stderr_tail}",
                    exit_code
                )
            }
            Self::Internal(reason) => write!(f, "internal error: {reason}"),
        }
    }
}

impl std::error::Error for FrameworkError {}

impl From<io::Error> for FrameworkError {
    fn from(value: io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<serde_json::Error> for FrameworkError {
    fn from(value: serde_json::Error) -> Self {
        Self::Serde(value)
    }
}

impl From<tauri::Error> for FrameworkError {
    fn from(value: tauri::Error) -> Self {
        Self::Tauri(value)
    }
}

impl From<rusqlite::Error> for FrameworkError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Internal(format!("sqlite error: {value}"))
    }
}

impl From<sdkwork_local_api_proxy_native::error::LocalApiProxyNativeError> for FrameworkError {
    fn from(value: sdkwork_local_api_proxy_native::error::LocalApiProxyNativeError) -> Self {
        use sdkwork_local_api_proxy_native::error::LocalApiProxyNativeError;

        match value {
            LocalApiProxyNativeError::Io(error) => Self::Io(error),
            LocalApiProxyNativeError::Serde(error) => Self::Serde(error),
            LocalApiProxyNativeError::Sqlite(error) => {
                Self::Internal(format!("sqlite error: {error}"))
            }
            LocalApiProxyNativeError::ValidationFailed(reason) => Self::ValidationFailed(reason),
            LocalApiProxyNativeError::InvalidOperation(reason) => Self::InvalidOperation(reason),
            LocalApiProxyNativeError::NotFound(resource) => Self::NotFound(resource),
            LocalApiProxyNativeError::Conflict(reason) => Self::Conflict(reason),
            LocalApiProxyNativeError::Timeout(reason) => Self::Timeout(reason),
            LocalApiProxyNativeError::Internal(reason) => Self::Internal(reason),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::FrameworkError;

    #[test]
    fn policy_denied_errors_render_resource_reason() {
        let error = FrameworkError::PolicyDenied {
            resource: "command".to_string(),
            reason: "spawn is not allowed".to_string(),
        };

        assert!(error.to_string().contains("spawn is not allowed"));
        assert!(error.to_string().contains("command"));
    }

    #[test]
    fn process_failed_errors_render_exit_code_and_command() {
        let error = FrameworkError::ProcessFailed {
            command: "cmd /c echo hello".to_string(),
            exit_code: Some(1),
            stderr_tail: "boom".to_string(),
        };

        assert!(error.to_string().contains("cmd /c echo hello"));
        assert!(error.to_string().contains("1"));
        assert!(error.to_string().contains("boom"));
    }
}
