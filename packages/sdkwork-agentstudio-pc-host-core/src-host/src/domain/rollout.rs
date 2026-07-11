use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PreflightOutcome {
    Admissible,
    AdmissibleDegraded,
    BlockedByVersion,
    BlockedByCapability,
    BlockedByTrust,
    BlockedByPolicy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RolloutPhase {
    Draft,
    Previewing,
    AwaitingApproval,
    Ready,
    Promoting,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManageRolloutRecord {
    pub id: String,
    pub phase: RolloutPhase,
    #[serde(with = "sdkwork_utils_rust::serde_uint64")]
    pub attempt: u64,
    pub target_count: usize,
    #[serde(with = "sdkwork_utils_rust::serde_uint64")]
    pub updated_at: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManageRolloutListResult {
    pub items: Vec<ManageRolloutRecord>,
    pub total: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManageRolloutTargetPreviewRecord {
    pub node_id: String,
    pub preflight_outcome: PreflightOutcome,
    pub blocked_reason: Option<String>,
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub desired_state_revision: Option<u64>,
    pub desired_state_hash: Option<String>,
    pub wave_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ManageRolloutWavePhase {
    Pending,
    Ready,
    Promoting,
    Verifying,
    Completed,
    Paused,
    Failed,
    Cancelled,
}

impl ManageRolloutWavePhase {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Ready => "ready",
            Self::Promoting => "promoting",
            Self::Verifying => "verifying",
            Self::Completed => "completed",
            Self::Paused => "paused",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManageRolloutWaveRecord {
    pub wave_id: String,
    pub index: usize,
    pub phase: ManageRolloutWavePhase,
    pub target_count: usize,
    pub admissible_count: usize,
    pub degraded_count: usize,
    pub blocked_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManageRolloutWaveListResult {
    pub rollout_id: String,
    #[serde(with = "sdkwork_utils_rust::serde_uint64")]
    pub attempt: u64,
    pub total: usize,
    pub items: Vec<ManageRolloutWaveRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManageRolloutPreviewSummary {
    pub total_targets: usize,
    pub admissible_targets: usize,
    pub degraded_targets: usize,
    pub blocked_targets: usize,
    pub predicted_wave_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManageRolloutCandidateRevisionSummary {
    pub total_targets: usize,
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub min_desired_state_revision: Option<u64>,
    #[serde(with = "sdkwork_utils_rust::serde_uint64::option")]
    pub max_desired_state_revision: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManageRolloutPreview {
    pub rollout_id: String,
    pub phase: RolloutPhase,
    #[serde(with = "sdkwork_utils_rust::serde_uint64")]
    pub attempt: u64,
    pub summary: ManageRolloutPreviewSummary,
    pub targets: Vec<ManageRolloutTargetPreviewRecord>,
    pub candidate_revision_summary: Option<ManageRolloutCandidateRevisionSummary>,
    #[serde(with = "sdkwork_utils_rust::serde_uint64")]
    pub generated_at: u64,
}
