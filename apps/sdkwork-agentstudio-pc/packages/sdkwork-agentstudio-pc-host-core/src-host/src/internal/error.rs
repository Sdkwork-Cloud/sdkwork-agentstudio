use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InternalErrorCategory {
    Auth,
    Trust,
    Session,
    Compatibility,
    State,
    Validation,
    Dependency,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InternalErrorResolution {
    FixRequest,
    ReAuthenticate,
    Retry,
    WaitAndRetry,
    RestartSession,
    FetchLatestProjection,
    UpgradeRequired,
    OperatorAction,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InternalErrorRecord {
    pub code: String,
    pub category: InternalErrorCategory,
    pub message: String,
    pub http_status: u16,
    pub retryable: bool,
    pub resolution: InternalErrorResolution,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct InternalErrorEnvelope {
    pub error: InternalErrorRecord,
}

impl InternalErrorEnvelope {
    pub fn new(
        code: impl Into<String>,
        category: InternalErrorCategory,
        message: impl Into<String>,
        http_status: u16,
        retryable: bool,
        resolution: InternalErrorResolution,
    ) -> Self {
        Self {
            error: InternalErrorRecord {
                code: code.into(),
                category,
                message: message.into(),
                http_status,
                retryable,
                resolution,
                correlation_id: None,
                timestamp: None,
            },
        }
    }

    pub fn with_transport_context(
        mut self,
        correlation_id: impl Into<String>,
        timestamp: impl Into<String>,
    ) -> Self {
        self.error.correlation_id = Some(correlation_id.into());
        self.error.timestamp = Some(timestamp.into());
        self
    }
}
