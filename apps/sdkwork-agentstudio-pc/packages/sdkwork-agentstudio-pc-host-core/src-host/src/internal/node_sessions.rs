use std::fmt::{Display, Formatter};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};

use serde::{Deserialize, Serialize};

use crate::domain::rollout::{
    ManageRolloutPreview, ManageRolloutTargetPreviewRecord, PreflightOutcome,
};
use crate::projection::compiler::DesiredStateProjection;
use crate::storage::node_session_store::{JsonNodeSessionCatalogStore, NodeSessionCatalogStore};
use crate::storage::sqlite_store::SqliteNodeSessionCatalogStore;
use crate::storage::StorageError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeSessionState {
    Pending,
    Admitted,
    Degraded,
    Blocked,
    Replaced,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeSessionCompatibilityState {
    Compatible,
    Degraded,
    Blocked,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionRecord {
    pub session_id: String,
    pub node_id: String,
    pub state: NodeSessionState,
    pub compatibility_state: NodeSessionCompatibilityState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub successor_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub desired_state_revision: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub desired_state_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub last_applied_revision: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_applied_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub last_known_good_revision: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_known_good_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_apply_result: Option<NodeSessionDesiredStateAckResult>,
    #[serde(with = "sdkwork_utils_rust::serde_uint64")]
    pub last_seen_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionCompatibilityPreview {
    pub compatibility_state: NodeSessionCompatibilityState,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub desired_state_revision: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub desired_state_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionHelloInput {
    pub boot_id: String,
    pub node_claim: NodeSessionHelloNodeClaim,
    pub version_manifest: NodeSessionHelloVersionManifest,
    #[serde(default)]
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionHelloNodeClaim {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub claimed_node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host_platform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host_arch: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionHelloVersionManifest {
    pub internal_api_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config_projection_version: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NodeSessionHelloAdmissionMode {
    BootstrapRequired,
    Blocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NodeSessionHelloResponseAction {
    CallAdmit,
    StopAndWait,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionLeaseProposal {
    pub lease_id: String,
    #[serde(with = "sdkwork_utils_rust::serde_uint64")]
    pub issued_at: u64,
    #[serde(with = "sdkwork_utils_rust::serde_uint64")]
    pub expires_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionHelloResponse {
    pub session_id: String,
    pub hello_token: String,
    pub lease_proposal: NodeSessionLeaseProposal,
    pub admission_mode: NodeSessionHelloAdmissionMode,
    pub compatibility_preview: NodeSessionCompatibilityPreview,
    pub next_action: NodeSessionHelloResponseAction,
}

#[derive(Debug)]
pub enum NodeSessionRegistryError {
    Store(StorageError),
    CatalogUnavailable { reason: String },
    SessionNotFound { session_id: String },
    HelloTokenInvalid { session_id: String },
    LeaseIdInvalid { session_id: String },
    LeaseExpired { session_id: String },
    SessionReplaced { session_id: String },
    StaleAck { session_id: String },
    DesiredStateConflict { session_id: String },
}

impl Display for NodeSessionRegistryError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            NodeSessionRegistryError::Store(error) => write!(f, "{error}"),
            NodeSessionRegistryError::CatalogUnavailable { reason } => {
                write!(f, "node session catalog is unavailable: {reason}")
            }
            NodeSessionRegistryError::SessionNotFound { session_id } => {
                write!(f, "node session was not found: {session_id}")
            }
            NodeSessionRegistryError::HelloTokenInvalid { session_id } => {
                write!(f, "node session hello token was invalid: {session_id}")
            }
            NodeSessionRegistryError::LeaseIdInvalid { session_id } => {
                write!(f, "node session lease id was invalid: {session_id}")
            }
            NodeSessionRegistryError::LeaseExpired { session_id } => {
                write!(f, "node session lease was expired: {session_id}")
            }
            NodeSessionRegistryError::SessionReplaced { session_id } => {
                write!(
                    f,
                    "node session was replaced by a newer session: {session_id}"
                )
            }
            NodeSessionRegistryError::StaleAck { session_id } => {
                write!(
                    f,
                    "node session desired state acknowledgement was stale: {session_id}"
                )
            }
            NodeSessionRegistryError::DesiredStateConflict { session_id } => {
                write!(
                    f,
                    "node session desired state did not match the current target: {session_id}"
                )
            }
        }
    }
}

impl std::error::Error for NodeSessionRegistryError {}

impl From<StorageError> for NodeSessionRegistryError {
    fn from(value: StorageError) -> Self {
        NodeSessionRegistryError::Store(value)
    }
}

#[derive(Debug)]
pub struct NodeSessionRegistry {
    store: Arc<dyn NodeSessionCatalogStore>,
    catalog: Mutex<PersistedNodeSessionCatalog>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionAdmitInput {
    pub hello_token: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionHeartbeatPolicy {
    pub interval_seconds: u32,
    pub miss_tolerance: u32,
    pub full_report_interval: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionDesiredStateCursor {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub current_revision: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_config_projection_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionAdmitResponse {
    pub session_id: String,
    pub lease: NodeSessionLeaseProposal,
    pub compatibility_result: NodeSessionCompatibilityPreview,
    pub effective_capabilities: Vec<String>,
    pub heartbeat_policy: NodeSessionHeartbeatPolicy,
    pub desired_state_cursor: NodeSessionDesiredStateCursor,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionHeartbeatInput {
    pub lease_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub last_seen_revision: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionManagementPosture {
    pub compatibility_state: NodeSessionCompatibilityState,
    pub allowed_operations: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionDesiredStateHint {
    pub has_update: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub target_revision: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_hash: Option<String>,
    pub mandatory: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionHeartbeatResponse {
    pub lease: NodeSessionLeaseProposal,
    pub compatibility_result: NodeSessionCompatibilityPreview,
    pub management_posture: NodeSessionManagementPosture,
    pub desired_state_hint: NodeSessionDesiredStateHint,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodeSessionDesiredStateProjectionRecord {
    pub required_capabilities: Vec<String>,
    pub projection: DesiredStateProjection,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionPullDesiredStateInput {
    pub lease_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub known_revision: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub known_hash: Option<String>,
    #[serde(default)]
    pub supported_config_projection_versions: Vec<String>,
    #[serde(default)]
    pub effective_capabilities: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionApplyPolicy {
    pub mandatory: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NodeSessionDesiredStateAckResult {
    Accepted,
    Applied,
    AppliedDegraded,
    Rejected,
    Superseded,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "mode",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum NodeSessionPullDesiredStateResponse {
    NotModified {
        #[serde(with = "sdkwork_utils_rust::serde_uint64")]
        desired_state_revision: u64,
        desired_state_hash: String,
        config_projection_version: String,
    },
    Projection {
        #[serde(with = "sdkwork_utils_rust::serde_uint64")]
        desired_state_revision: u64,
        desired_state_hash: String,
        config_projection_version: String,
        required_capabilities: Vec<String>,
        projection: DesiredStateProjection,
        apply_policy: NodeSessionApplyPolicy,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionAckDesiredStateApplySummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub applied_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub last_known_good_revision: Option<u64>,
    #[serde(default)]
    pub compatibility_reasons: Vec<String>,
    #[serde(default)]
    pub errors: Vec<String>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionAckDesiredStateInput {
    pub lease_id: String,
    #[serde(with = "sdkwork_utils_rust::serde_uint64")]
    pub desired_state_revision: u64,
    pub desired_state_hash: String,
    pub result: NodeSessionDesiredStateAckResult,
    #[serde(default)]
    pub effective_capabilities: Vec<String>,
    #[serde(default)]
    pub observed_endpoints: Vec<String>,
    pub apply_summary: NodeSessionAckDesiredStateApplySummary,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionAckDesiredStateResponse {
    pub recorded: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub next_expected_revision: Option<u64>,
    pub management_posture: NodeSessionManagementPosture,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionCloseInput {
    pub lease_id: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub successor_hint: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSessionCloseResponse {
    pub closed: bool,
    pub replacement_expected: bool,
}

impl NodeSessionRegistry {
    pub fn open(store_path: PathBuf) -> Result<Self, NodeSessionRegistryError> {
        Self::from_store(Arc::new(JsonNodeSessionCatalogStore::new(store_path)))
    }

    pub fn open_sqlite(database_path: PathBuf) -> Result<Self, NodeSessionRegistryError> {
        let store = SqliteNodeSessionCatalogStore::new(database_path)?;
        Self::from_store(Arc::new(store))
    }

    pub(crate) fn from_store(
        store: Arc<dyn NodeSessionCatalogStore>,
    ) -> Result<Self, NodeSessionRegistryError> {
        let catalog = load_or_seed_catalog(store.as_ref())?;

        Ok(Self {
            store,
            catalog: Mutex::new(catalog),
        })
    }

    fn lock_catalog(
        &self,
    ) -> Result<MutexGuard<'_, PersistedNodeSessionCatalog>, NodeSessionRegistryError> {
        self.catalog.lock().map_err(|error| {
            NodeSessionRegistryError::CatalogUnavailable {
                reason: error.to_string(),
            }
        })
    }

    pub fn list_sessions(&self) -> Result<Vec<NodeSessionRecord>, NodeSessionRegistryError> {
        let catalog = self.lock_catalog()?;
        let mut sessions = catalog
            .sessions
            .iter()
            .map(|session| session.record.clone())
            .collect::<Vec<_>>();

        sessions.sort_by(|left, right| {
            right
                .last_seen_at
                .cmp(&left.last_seen_at)
                .then_with(|| left.node_id.cmp(&right.node_id))
        });

        Ok(sessions)
    }

    pub fn hello(
        &self,
        input: NodeSessionHelloInput,
        compatibility_preview: NodeSessionCompatibilityPreview,
        observed_at: u64,
    ) -> Result<NodeSessionHelloResponse, NodeSessionRegistryError> {
        let mut catalog = self.lock_catalog()?;
        let sequence = catalog.next_sequence;
        catalog.next_sequence += 1;

        let node_id = input
            .node_claim
            .claimed_node_id
            .clone()
            .unwrap_or_else(|| format!("node-{sequence}"));
        let session_id = format!("ses-{sequence}");
        let hello_token = format!("hello-{sequence}");
        let lease_id = format!("lease-{sequence}");
        let lease_proposal = NodeSessionLeaseProposal {
            lease_id: lease_id.clone(),
            issued_at: observed_at,
            expires_at: observed_at.saturating_add(30_000),
        };
        let (state, admission_mode, next_action) =
            hello_outcome_for_compatibility(compatibility_preview.compatibility_state);
        let record = NodeSessionRecord {
            session_id: session_id.clone(),
            node_id,
            state,
            compatibility_state: compatibility_preview.compatibility_state,
            successor_session_id: None,
            desired_state_revision: compatibility_preview.desired_state_revision,
            desired_state_hash: compatibility_preview.desired_state_hash.clone(),
            last_applied_revision: None,
            last_applied_hash: None,
            last_known_good_revision: None,
            last_known_good_hash: None,
            last_apply_result: None,
            last_seen_at: observed_at,
        };

        catalog.sessions.push(PersistedNodeSession {
            record: record.clone(),
            boot_id: input.boot_id,
            hello_token: hello_token.clone(),
            lease_id,
            lease_issued_at: lease_proposal.issued_at,
            lease_expires_at: lease_proposal.expires_at,
            version_manifest: input.version_manifest,
            capabilities: input.capabilities,
            compatibility_reason: compatibility_preview.reason.clone(),
        });
        self.store.save_catalog(&catalog)?;

        Ok(NodeSessionHelloResponse {
            session_id,
            hello_token,
            lease_proposal,
            admission_mode,
            compatibility_preview,
            next_action,
        })
    }

    pub fn admit(
        &self,
        session_id: &str,
        input: NodeSessionAdmitInput,
        observed_at: u64,
    ) -> Result<NodeSessionAdmitResponse, NodeSessionRegistryError> {
        let mut catalog = self.lock_catalog()?;
        let session_index = catalog
            .sessions
            .iter()
            .position(|session| session.record.session_id == session_id)
            .ok_or_else(|| NodeSessionRegistryError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        if catalog.sessions[session_index].hello_token != input.hello_token {
            return Err(NodeSessionRegistryError::HelloTokenInvalid {
                session_id: session_id.to_string(),
            });
        }

        let successor_session_id = catalog.sessions[session_index].record.session_id.clone();
        let successor_node_id = catalog.sessions[session_index].record.node_id.clone();
        let successor_boot_id = catalog.sessions[session_index].boot_id.clone();
        for index in 0..catalog.sessions.len() {
            if index == session_index {
                continue;
            }
            let other = &mut catalog.sessions[index];
            if other.record.node_id != successor_node_id || other.boot_id == successor_boot_id {
                continue;
            }
            if matches!(
                other.record.state,
                NodeSessionState::Closed | NodeSessionState::Replaced
            ) {
                continue;
            }

            other.record.state = NodeSessionState::Replaced;
            other.record.successor_session_id = Some(successor_session_id.clone());
        }

        let session = &mut catalog.sessions[session_index];
        session.record.state = admitted_state_for_compatibility(session.record.compatibility_state);
        session.record.successor_session_id = None;
        session.record.last_seen_at = observed_at;
        session.lease_issued_at = observed_at;
        session.lease_expires_at = observed_at.saturating_add(30_000);
        let response = NodeSessionAdmitResponse {
            session_id: session.record.session_id.clone(),
            lease: NodeSessionLeaseProposal {
                lease_id: session.lease_id.clone(),
                issued_at: session.lease_issued_at,
                expires_at: session.lease_expires_at,
            },
            compatibility_result: compatibility_preview_from_persisted_session(session),
            effective_capabilities: session.capabilities.clone(),
            heartbeat_policy: NodeSessionHeartbeatPolicy {
                interval_seconds: 15,
                miss_tolerance: 3,
                full_report_interval: 4,
            },
            desired_state_cursor: NodeSessionDesiredStateCursor {
                current_revision: session.record.desired_state_revision,
                current_hash: session.record.desired_state_hash.clone(),
                required_config_projection_version: session
                    .version_manifest
                    .config_projection_version
                    .clone(),
            },
        };
        self.store.save_catalog(&catalog)?;

        Ok(response)
    }

    pub fn heartbeat(
        &self,
        session_id: &str,
        input: NodeSessionHeartbeatInput,
        observed_at: u64,
    ) -> Result<NodeSessionHeartbeatResponse, NodeSessionRegistryError> {
        let mut catalog = self.lock_catalog()?;
        let session = catalog
            .sessions
            .iter_mut()
            .find(|session| session.record.session_id == session_id)
            .ok_or_else(|| NodeSessionRegistryError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        ensure_valid_lease(session, &input.lease_id, session_id, observed_at)?;
        ensure_authoritative_runtime_session(session, session_id)?;

        session.record.last_seen_at = observed_at;
        session.lease_issued_at = observed_at;
        session.lease_expires_at = observed_at.saturating_add(30_000);
        let response = NodeSessionHeartbeatResponse {
            lease: NodeSessionLeaseProposal {
                lease_id: session.lease_id.clone(),
                issued_at: session.lease_issued_at,
                expires_at: session.lease_expires_at,
            },
            compatibility_result: compatibility_preview_from_persisted_session(session),
            management_posture: NodeSessionManagementPosture {
                compatibility_state: session.record.compatibility_state,
                allowed_operations: allowed_operations_for_compatibility(
                    session.record.compatibility_state,
                ),
            },
            desired_state_hint: NodeSessionDesiredStateHint {
                has_update: session.record.desired_state_revision != input.last_seen_revision,
                target_revision: session.record.desired_state_revision,
                target_hash: session.record.desired_state_hash.clone(),
                mandatory: matches!(
                    session.record.compatibility_state,
                    NodeSessionCompatibilityState::Compatible
                        | NodeSessionCompatibilityState::Degraded
                ),
            },
        };
        self.store.save_catalog(&catalog)?;

        Ok(response)
    }

    pub fn pull_desired_state(
        &self,
        session_id: &str,
        input: NodeSessionPullDesiredStateInput,
        desired_state: NodeSessionDesiredStateProjectionRecord,
        observed_at: u64,
    ) -> Result<NodeSessionPullDesiredStateResponse, NodeSessionRegistryError> {
        let mut catalog = self.lock_catalog()?;
        let session = catalog
            .sessions
            .iter_mut()
            .find(|session| session.record.session_id == session_id)
            .ok_or_else(|| NodeSessionRegistryError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        ensure_valid_lease(session, &input.lease_id, session_id, observed_at)?;
        ensure_authoritative_runtime_session(session, session_id)?;

        session.record.last_seen_at = observed_at;
        session.record.desired_state_revision =
            Some(desired_state.projection.desired_state_revision);
        session.record.desired_state_hash =
            Some(desired_state.projection.desired_state_hash.clone());

        let response = if input.known_revision
            == Some(desired_state.projection.desired_state_revision)
            && input.known_hash.as_deref()
                == Some(desired_state.projection.desired_state_hash.as_str())
        {
            NodeSessionPullDesiredStateResponse::NotModified {
                desired_state_revision: desired_state.projection.desired_state_revision,
                desired_state_hash: desired_state.projection.desired_state_hash.clone(),
                config_projection_version: desired_state
                    .projection
                    .config_projection_version
                    .clone(),
            }
        } else {
            NodeSessionPullDesiredStateResponse::Projection {
                desired_state_revision: desired_state.projection.desired_state_revision,
                desired_state_hash: desired_state.projection.desired_state_hash.clone(),
                config_projection_version: desired_state
                    .projection
                    .config_projection_version
                    .clone(),
                required_capabilities: desired_state.required_capabilities,
                projection: desired_state.projection,
                apply_policy: NodeSessionApplyPolicy {
                    mandatory: matches!(
                        session.record.compatibility_state,
                        NodeSessionCompatibilityState::Compatible
                            | NodeSessionCompatibilityState::Degraded
                    ),
                },
            }
        };
        self.store.save_catalog(&catalog)?;

        Ok(response)
    }

    pub fn ack_desired_state(
        &self,
        session_id: &str,
        input: NodeSessionAckDesiredStateInput,
        observed_at: u64,
    ) -> Result<NodeSessionAckDesiredStateResponse, NodeSessionRegistryError> {
        let mut catalog = self.lock_catalog()?;
        let session = catalog
            .sessions
            .iter_mut()
            .find(|session| session.record.session_id == session_id)
            .ok_or_else(|| NodeSessionRegistryError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        ensure_valid_lease(session, &input.lease_id, session_id, observed_at)?;
        ensure_authoritative_runtime_session(session, session_id)?;
        if session
            .record
            .desired_state_revision
            .is_some_and(|expected_revision| input.desired_state_revision < expected_revision)
        {
            return Err(NodeSessionRegistryError::StaleAck {
                session_id: session_id.to_string(),
            });
        }
        if session.record.desired_state_revision != Some(input.desired_state_revision)
            || session.record.desired_state_hash.as_deref()
                != Some(input.desired_state_hash.as_str())
        {
            return Err(NodeSessionRegistryError::DesiredStateConflict {
                session_id: session_id.to_string(),
            });
        }

        session.record.last_seen_at = observed_at;
        session.record.last_apply_result = Some(input.result);

        if matches!(
            input.result,
            NodeSessionDesiredStateAckResult::Applied
                | NodeSessionDesiredStateAckResult::AppliedDegraded
        ) {
            session.record.last_applied_revision = Some(input.desired_state_revision);
            session.record.last_applied_hash = Some(input.desired_state_hash.clone());
        }

        if let Some(last_known_good_revision) = input.apply_summary.last_known_good_revision {
            session.record.last_known_good_revision = Some(last_known_good_revision);
            if last_known_good_revision == input.desired_state_revision {
                session.record.last_known_good_hash = Some(input.desired_state_hash.clone());
            }
        } else if matches!(
            input.result,
            NodeSessionDesiredStateAckResult::Applied
                | NodeSessionDesiredStateAckResult::AppliedDegraded
        ) {
            session.record.last_known_good_revision = Some(input.desired_state_revision);
            session.record.last_known_good_hash = Some(input.desired_state_hash.clone());
        }

        let response = NodeSessionAckDesiredStateResponse {
            recorded: true,
            next_expected_revision: session.record.desired_state_revision,
            management_posture: NodeSessionManagementPosture {
                compatibility_state: session.record.compatibility_state,
                allowed_operations: allowed_operations_for_compatibility(
                    session.record.compatibility_state,
                ),
            },
        };
        self.store.save_catalog(&catalog)?;

        Ok(response)
    }

    pub fn close(
        &self,
        session_id: &str,
        input: NodeSessionCloseInput,
        observed_at: u64,
    ) -> Result<NodeSessionCloseResponse, NodeSessionRegistryError> {
        let mut catalog = self.lock_catalog()?;
        let session = catalog
            .sessions
            .iter_mut()
            .find(|session| session.record.session_id == session_id)
            .ok_or_else(|| NodeSessionRegistryError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        ensure_valid_lease(session, &input.lease_id, session_id, observed_at)?;

        session.record.state = NodeSessionState::Closed;
        session.record.successor_session_id = input.successor_hint.clone();
        session.record.last_seen_at = observed_at;
        let response = NodeSessionCloseResponse {
            closed: true,
            replacement_expected: input.successor_hint.is_some(),
        };
        self.store.save_catalog(&catalog)?;

        Ok(response)
    }
}

pub fn project_node_sessions_from_preview(
    preview: &ManageRolloutPreview,
    lifecycle_ready: bool,
    session_prefix: &str,
    last_seen_at: u64,
) -> Vec<NodeSessionRecord> {
    preview
        .targets
        .iter()
        .map(|target| {
            project_node_session_from_target(target, lifecycle_ready, session_prefix, last_seen_at)
        })
        .collect()
}

fn project_node_session_from_target(
    target: &ManageRolloutTargetPreviewRecord,
    lifecycle_ready: bool,
    session_prefix: &str,
    last_seen_at: u64,
) -> NodeSessionRecord {
    NodeSessionRecord {
        session_id: format!("{session_prefix}-{}", target.node_id),
        node_id: target.node_id.clone(),
        state: node_session_state_for_lifecycle(lifecycle_ready),
        compatibility_state: compatibility_state_for_preflight(target.preflight_outcome),
        successor_session_id: None,
        desired_state_revision: target.desired_state_revision,
        desired_state_hash: target.desired_state_hash.clone(),
        last_applied_revision: None,
        last_applied_hash: None,
        last_known_good_revision: None,
        last_known_good_hash: None,
        last_apply_result: None,
        last_seen_at,
    }
}

fn node_session_state_for_lifecycle(lifecycle_ready: bool) -> NodeSessionState {
    if lifecycle_ready {
        NodeSessionState::Admitted
    } else {
        NodeSessionState::Degraded
    }
}

fn compatibility_state_for_preflight(outcome: PreflightOutcome) -> NodeSessionCompatibilityState {
    match outcome {
        PreflightOutcome::Admissible => NodeSessionCompatibilityState::Compatible,
        PreflightOutcome::AdmissibleDegraded => NodeSessionCompatibilityState::Degraded,
        PreflightOutcome::BlockedByVersion
        | PreflightOutcome::BlockedByCapability
        | PreflightOutcome::BlockedByTrust
        | PreflightOutcome::BlockedByPolicy => NodeSessionCompatibilityState::Blocked,
    }
}

pub fn compatibility_preview_from_target(
    target: Option<&ManageRolloutTargetPreviewRecord>,
) -> NodeSessionCompatibilityPreview {
    match target {
        Some(target) => NodeSessionCompatibilityPreview {
            compatibility_state: compatibility_state_for_preflight(target.preflight_outcome),
            desired_state_revision: target.desired_state_revision,
            desired_state_hash: target.desired_state_hash.clone(),
            reason: target.blocked_reason.clone(),
        },
        None => NodeSessionCompatibilityPreview {
            compatibility_state: NodeSessionCompatibilityState::Blocked,
            desired_state_revision: None,
            desired_state_hash: None,
            reason: Some("node is not targeted by the current rollout".to_string()),
        },
    }
}

fn hello_outcome_for_compatibility(
    compatibility_state: NodeSessionCompatibilityState,
) -> (
    NodeSessionState,
    NodeSessionHelloAdmissionMode,
    NodeSessionHelloResponseAction,
) {
    match compatibility_state {
        NodeSessionCompatibilityState::Compatible | NodeSessionCompatibilityState::Degraded => (
            NodeSessionState::Pending,
            NodeSessionHelloAdmissionMode::BootstrapRequired,
            NodeSessionHelloResponseAction::CallAdmit,
        ),
        NodeSessionCompatibilityState::Blocked => (
            NodeSessionState::Blocked,
            NodeSessionHelloAdmissionMode::Blocked,
            NodeSessionHelloResponseAction::StopAndWait,
        ),
    }
}

fn admitted_state_for_compatibility(
    compatibility_state: NodeSessionCompatibilityState,
) -> NodeSessionState {
    match compatibility_state {
        NodeSessionCompatibilityState::Compatible => NodeSessionState::Admitted,
        NodeSessionCompatibilityState::Degraded => NodeSessionState::Degraded,
        NodeSessionCompatibilityState::Blocked => NodeSessionState::Blocked,
    }
}

fn compatibility_preview_from_persisted_session(
    session: &PersistedNodeSession,
) -> NodeSessionCompatibilityPreview {
    NodeSessionCompatibilityPreview {
        compatibility_state: session.record.compatibility_state,
        desired_state_revision: session.record.desired_state_revision,
        desired_state_hash: session.record.desired_state_hash.clone(),
        reason: session.compatibility_reason.clone(),
    }
}

fn ensure_valid_lease(
    session: &PersistedNodeSession,
    lease_id: &str,
    session_id: &str,
    observed_at: u64,
) -> Result<(), NodeSessionRegistryError> {
    if session.lease_id != lease_id {
        return Err(NodeSessionRegistryError::LeaseIdInvalid {
            session_id: session_id.to_string(),
        });
    }
    if observed_at > session.lease_expires_at {
        return Err(NodeSessionRegistryError::LeaseExpired {
            session_id: session_id.to_string(),
        });
    }

    Ok(())
}

fn ensure_authoritative_runtime_session(
    session: &PersistedNodeSession,
    session_id: &str,
) -> Result<(), NodeSessionRegistryError> {
    if session.record.state == NodeSessionState::Replaced {
        return Err(NodeSessionRegistryError::SessionReplaced {
            session_id: session_id.to_string(),
        });
    }

    Ok(())
}

fn allowed_operations_for_compatibility(
    compatibility_state: NodeSessionCompatibilityState,
) -> Vec<String> {
    match compatibility_state {
        NodeSessionCompatibilityState::Compatible | NodeSessionCompatibilityState::Degraded => {
            vec![
                "pullDesiredState".to_string(),
                "ackDesiredState".to_string(),
            ]
        }
        NodeSessionCompatibilityState::Blocked => Vec::new(),
    }
}

fn seed_node_session_catalog() -> PersistedNodeSessionCatalog {
    PersistedNodeSessionCatalog {
        next_sequence: 1,
        sessions: Vec::new(),
    }
}

fn load_or_seed_catalog(
    store: &dyn NodeSessionCatalogStore,
) -> Result<PersistedNodeSessionCatalog, NodeSessionRegistryError> {
    match store.load_catalog()? {
        Some(catalog) => Ok(catalog),
        None => {
            let seeded = seed_node_session_catalog();
            store.save_catalog(&seeded)?;
            Ok(seeded)
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct PersistedNodeSessionCatalog {
    next_sequence: u64,
    sessions: Vec<PersistedNodeSession>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct PersistedNodeSession {
    record: NodeSessionRecord,
    boot_id: String,
    hello_token: String,
    lease_id: String,
    lease_issued_at: u64,
    lease_expires_at: u64,
    version_manifest: NodeSessionHelloVersionManifest,
    capabilities: Vec<String>,
    compatibility_reason: Option<String>,
}
