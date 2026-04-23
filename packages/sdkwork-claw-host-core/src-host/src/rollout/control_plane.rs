use std::collections::BTreeSet;
use std::fmt::{Display, Formatter};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::domain::node::BUILT_IN_OPENCLAW_PRIMARY_NODE_ID;
use crate::domain::rollout::{
    ManageRolloutCandidateRevisionSummary, ManageRolloutListResult, ManageRolloutPreview,
    ManageRolloutPreviewSummary, ManageRolloutRecord, ManageRolloutTargetPreviewRecord,
    ManageRolloutWaveListResult, ManageRolloutWavePhase, ManageRolloutWaveRecord, PreflightOutcome,
    RolloutPhase,
};
use crate::internal::node_sessions::{
    compatibility_preview_from_target, project_node_sessions_from_preview,
    NodeSessionCompatibilityPreview, NodeSessionDesiredStateProjectionRecord, NodeSessionRecord,
};
use crate::projection::compiler::{DesiredStateInput, DesiredStateProjection, ProjectionCompiler};
use crate::rollout::engine::{preflight_target, RolloutPolicy, RolloutPreflightTarget};
use crate::storage::rollout_store::{JsonRolloutCatalogStore, RolloutCatalogStore};
use crate::storage::sqlite_store::SqliteRolloutCatalogStore;
use crate::storage::StorageError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreviewRolloutInput {
    pub rollout_id: String,
    pub force_recompute: bool,
    pub include_targets: bool,
}

#[derive(Debug)]
pub enum RolloutControlPlaneError {
    Store(StorageError),
    RolloutNotFound {
        rollout_id: String,
    },
    PreviewRequired {
        rollout_id: String,
    },
    RolloutBlocked {
        rollout_id: String,
        blocked_targets: usize,
    },
}

impl Display for RolloutControlPlaneError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            RolloutControlPlaneError::Store(error) => write!(f, "{error}"),
            RolloutControlPlaneError::RolloutNotFound { rollout_id } => {
                write!(f, "rollout was not found: {rollout_id}")
            }
            RolloutControlPlaneError::PreviewRequired { rollout_id } => {
                write!(f, "preview is required before start: {rollout_id}")
            }
            RolloutControlPlaneError::RolloutBlocked {
                rollout_id,
                blocked_targets,
            } => write!(
                f,
                "rollout is blocked by preflight policy: {rollout_id} ({blocked_targets} blocked targets)"
            ),
        }
    }
}

impl std::error::Error for RolloutControlPlaneError {}

impl From<StorageError> for RolloutControlPlaneError {
    fn from(value: StorageError) -> Self {
        RolloutControlPlaneError::Store(value)
    }
}

#[derive(Debug)]
pub struct RolloutControlPlane {
    store: Arc<dyn RolloutCatalogStore>,
    catalog: Mutex<PersistedRolloutCatalog>,
    compiler: ProjectionCompiler,
}

impl RolloutControlPlane {
    pub fn open(store_path: PathBuf) -> Result<Self, RolloutControlPlaneError> {
        Self::from_store(Arc::new(JsonRolloutCatalogStore::new(store_path)))
    }

    pub fn open_sqlite(database_path: PathBuf) -> Result<Self, RolloutControlPlaneError> {
        Self::from_store(Arc::new(SqliteRolloutCatalogStore::new(database_path)))
    }

    pub(crate) fn from_store(
        store: Arc<dyn RolloutCatalogStore>,
    ) -> Result<Self, RolloutControlPlaneError> {
        let catalog = load_or_seed_catalog(store.as_ref())?;
        let compiler = ProjectionCompiler::new();

        prime_compiler(&compiler, &catalog);

        Ok(Self {
            store,
            catalog: Mutex::new(catalog),
            compiler,
        })
    }

    pub fn active_rollout_id(&self) -> Result<String, RolloutControlPlaneError> {
        let catalog = self
            .catalog
            .lock()
            .expect("rollout catalog mutex should not be poisoned");
        resolve_active_rollout_id(&catalog).ok_or_else(|| {
            RolloutControlPlaneError::RolloutNotFound {
                rollout_id: "active".to_string(),
            }
        })
    }

    pub fn list_rollouts(&self) -> Result<ManageRolloutListResult, RolloutControlPlaneError> {
        let catalog = self
            .catalog
            .lock()
            .expect("rollout catalog mutex should not be poisoned");
        let mut items = catalog
            .rollouts
            .iter()
            .map(|rollout| rollout.record.clone())
            .collect::<Vec<_>>();

        items.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));

        Ok(ManageRolloutListResult {
            total: items.len(),
            items,
        })
    }

    pub fn preview_rollout(
        &self,
        input: PreviewRolloutInput,
    ) -> Result<ManageRolloutPreview, RolloutControlPlaneError> {
        let mut catalog = self
            .catalog
            .lock()
            .expect("rollout catalog mutex should not be poisoned");
        let rollout_index = catalog
            .rollouts
            .iter()
            .position(|rollout| rollout.record.id == input.rollout_id)
            .ok_or_else(|| RolloutControlPlaneError::RolloutNotFound {
                rollout_id: input.rollout_id.clone(),
            })?;
        let rollout = &mut catalog.rollouts[rollout_index];

        let full_preview = if !input.force_recompute {
            match rollout.preview.clone() {
                Some(existing_preview) => existing_preview,
                None => {
                    let generated = self.generate_preview(rollout);
                    rollout.preview = Some(generated.clone());
                    rollout.record.phase = generated.phase;
                    rollout.record.attempt = generated.attempt;
                    rollout.record.target_count = generated.summary.total_targets;
                    rollout.record.updated_at = generated.generated_at;
                    self.store.save_catalog(&catalog)?;
                    generated
                }
            }
        } else {
            let generated = self.generate_preview(rollout);
            rollout.preview = Some(generated.clone());
            rollout.record.phase = generated.phase;
            rollout.record.attempt = generated.attempt;
            rollout.record.target_count = generated.summary.total_targets;
            rollout.record.updated_at = generated.generated_at;
            self.store.save_catalog(&catalog)?;
            generated
        };

        Ok(render_preview_response(
            &full_preview,
            input.include_targets,
        ))
    }

    pub fn list_rollout_waves(
        &self,
        rollout_id: &str,
    ) -> Result<ManageRolloutWaveListResult, RolloutControlPlaneError> {
        let preview = self.preview_rollout(PreviewRolloutInput {
            rollout_id: rollout_id.to_string(),
            force_recompute: false,
            include_targets: true,
        })?;

        Ok(render_wave_list_response(&preview))
    }

    pub fn list_projected_node_sessions(
        &self,
        rollout_id: &str,
        lifecycle_ready: bool,
        session_prefix: &str,
        last_seen_at: u64,
    ) -> Result<Vec<NodeSessionRecord>, RolloutControlPlaneError> {
        let preview = self.preview_rollout(PreviewRolloutInput {
            rollout_id: rollout_id.to_string(),
            force_recompute: false,
            include_targets: true,
        })?;

        Ok(project_node_sessions_from_preview(
            &preview,
            lifecycle_ready,
            session_prefix,
            last_seen_at,
        ))
    }

    pub fn preview_node_session_compatibility(
        &self,
        rollout_id: &str,
        node_id: &str,
    ) -> Result<NodeSessionCompatibilityPreview, RolloutControlPlaneError> {
        let preview = self.preview_rollout(PreviewRolloutInput {
            rollout_id: rollout_id.to_string(),
            force_recompute: false,
            include_targets: true,
        })?;
        let target = preview
            .targets
            .iter()
            .find(|target| target.node_id == node_id);

        Ok(compatibility_preview_from_target(target))
    }

    pub fn resolve_node_desired_state(
        &self,
        rollout_id: &str,
        node_id: &str,
    ) -> Result<Option<NodeSessionDesiredStateProjectionRecord>, RolloutControlPlaneError> {
        let preview = self.preview_rollout(PreviewRolloutInput {
            rollout_id: rollout_id.to_string(),
            force_recompute: false,
            include_targets: true,
        })?;
        let preview_target = preview
            .targets
            .iter()
            .find(|target| target.node_id == node_id);
        let Some(preview_target) = preview_target else {
            return Ok(None);
        };
        if preview_target.desired_state_revision.is_none()
            || preview_target.desired_state_hash.is_none()
        {
            return Ok(None);
        }

        let catalog = self
            .catalog
            .lock()
            .expect("rollout catalog mutex should not be poisoned");
        let rollout = catalog
            .rollouts
            .iter()
            .find(|rollout| rollout.record.id == rollout_id)
            .ok_or_else(|| RolloutControlPlaneError::RolloutNotFound {
                rollout_id: rollout_id.to_string(),
            })?;
        let Some(target) = rollout
            .targets
            .iter()
            .find(|target| target.node_id == node_id)
        else {
            return Ok(None);
        };
        let projection = self.compiler.compile(&DesiredStateInput {
            node_id: target.node_id.clone(),
            config_projection_version: target.config_projection_version.clone(),
            semantic_payload: target.semantic_payload.clone(),
        });

        Ok(Some(NodeSessionDesiredStateProjectionRecord {
            required_capabilities: rollout.policy.required_capabilities.clone(),
            projection,
        }))
    }

    pub fn start_rollout(
        &self,
        rollout_id: &str,
    ) -> Result<ManageRolloutRecord, RolloutControlPlaneError> {
        let mut catalog = self
            .catalog
            .lock()
            .expect("rollout catalog mutex should not be poisoned");
        let rollout_index = catalog
            .rollouts
            .iter()
            .position(|rollout| rollout.record.id == rollout_id)
            .ok_or_else(|| RolloutControlPlaneError::RolloutNotFound {
                rollout_id: rollout_id.to_string(),
            })?;
        let preview = catalog.rollouts[rollout_index]
            .preview
            .clone()
            .ok_or_else(|| RolloutControlPlaneError::PreviewRequired {
                rollout_id: rollout_id.to_string(),
            })?;

        if preview.summary.blocked_targets > 0
            && !catalog.rollouts[rollout_index]
                .policy
                .allow_degraded_targets
        {
            return Err(RolloutControlPlaneError::RolloutBlocked {
                rollout_id: rollout_id.to_string(),
                blocked_targets: preview.summary.blocked_targets,
            });
        }

        catalog.rollouts[rollout_index].record.phase = RolloutPhase::Promoting;
        catalog.rollouts[rollout_index].record.attempt = preview.attempt;
        catalog.rollouts[rollout_index].record.target_count = preview.summary.total_targets;
        catalog.rollouts[rollout_index].record.updated_at = now_timestamp_ms();
        catalog.active_rollout_id = Some(rollout_id.to_string());
        self.store.save_catalog(&catalog)?;

        Ok(catalog.rollouts[rollout_index].record.clone())
    }

    fn generate_preview(&self, rollout: &PersistedRollout) -> ManageRolloutPreview {
        let attempt = rollout.record.attempt.max(1);
        let generated_at = now_timestamp_ms();
        let mut targets = Vec::with_capacity(rollout.targets.len());
        let mut admissible_targets = 0usize;
        let mut degraded_targets = 0usize;
        let mut blocked_targets = 0usize;
        let mut candidate_revisions = Vec::new();
        let mut predicted_waves = BTreeSet::new();

        for target in &rollout.targets {
            if let Some(wave_id) = target.wave_id.clone() {
                predicted_waves.insert(wave_id);
            }

            let preflight_target_input = RolloutPreflightTarget {
                node_id: target.node_id.clone(),
                capabilities: target.capabilities.clone(),
                trusted: target.trusted,
                compatible: target.compatible,
            };
            let policy = RolloutPolicy {
                required_capabilities: rollout.policy.required_capabilities.clone(),
                allow_degraded_targets: rollout.policy.allow_degraded_targets,
            };
            let preflight_outcome = preflight_target(&preflight_target_input, &policy);

            match preflight_outcome {
                PreflightOutcome::Admissible => {
                    admissible_targets += 1;
                    let projection = self.compiler.compile(&DesiredStateInput {
                        node_id: target.node_id.clone(),
                        config_projection_version: target.config_projection_version.clone(),
                        semantic_payload: target.semantic_payload.clone(),
                    });
                    candidate_revisions.push(projection.desired_state_revision);
                    targets.push(admissible_preview_target(
                        target,
                        preflight_outcome,
                        projection,
                    ));
                }
                PreflightOutcome::AdmissibleDegraded => {
                    degraded_targets += 1;
                    let projection = self.compiler.compile(&DesiredStateInput {
                        node_id: target.node_id.clone(),
                        config_projection_version: target.config_projection_version.clone(),
                        semantic_payload: target.semantic_payload.clone(),
                    });
                    candidate_revisions.push(projection.desired_state_revision);
                    targets.push(admissible_preview_target(
                        target,
                        preflight_outcome,
                        projection,
                    ));
                }
                blocked_outcome => {
                    blocked_targets += 1;
                    targets.push(ManageRolloutTargetPreviewRecord {
                        node_id: target.node_id.clone(),
                        preflight_outcome: blocked_outcome,
                        blocked_reason: Some(blocked_reason(blocked_outcome)),
                        desired_state_revision: None,
                        desired_state_hash: None,
                        wave_id: target.wave_id.clone(),
                    });
                }
            }
        }

        let phase = if blocked_targets > 0 && !rollout.policy.allow_degraded_targets {
            RolloutPhase::Failed
        } else {
            RolloutPhase::Ready
        };

        ManageRolloutPreview {
            rollout_id: rollout.record.id.clone(),
            phase,
            attempt,
            summary: ManageRolloutPreviewSummary {
                total_targets: rollout.targets.len(),
                admissible_targets,
                degraded_targets,
                blocked_targets,
                predicted_wave_count: predicted_waves.len().max(1),
            },
            targets,
            candidate_revision_summary: Some(ManageRolloutCandidateRevisionSummary {
                total_targets: rollout.targets.len(),
                min_desired_state_revision: candidate_revisions.iter().copied().min(),
                max_desired_state_revision: candidate_revisions.iter().copied().max(),
            }),
            generated_at,
        }
    }
}

fn render_preview_response(
    preview: &ManageRolloutPreview,
    include_targets: bool,
) -> ManageRolloutPreview {
    if include_targets {
        return preview.clone();
    }

    let mut without_targets = preview.clone();
    without_targets.targets.clear();
    without_targets
}

fn render_wave_list_response(preview: &ManageRolloutPreview) -> ManageRolloutWaveListResult {
    let mut items: Vec<ManageRolloutWaveRecord> = Vec::new();

    for target in &preview.targets {
        let wave_id = target
            .wave_id
            .clone()
            .unwrap_or_else(|| DEFAULT_ROLLOUT_WAVE_ID.to_string());
        let wave_index =
            if let Some(existing_index) = items.iter().position(|item| item.wave_id == wave_id) {
                existing_index
            } else {
                items.push(ManageRolloutWaveRecord {
                    wave_id: wave_id.clone(),
                    index: items.len() + 1,
                    phase: ManageRolloutWavePhase::Ready,
                    target_count: 0,
                    admissible_count: 0,
                    degraded_count: 0,
                    blocked_count: 0,
                });
                items.len() - 1
            };
        let wave = items
            .get_mut(wave_index)
            .expect("wave index should resolve to a mutable record");

        wave.target_count += 1;

        match target.preflight_outcome {
            PreflightOutcome::Admissible => {
                wave.admissible_count += 1;
            }
            PreflightOutcome::AdmissibleDegraded => {
                wave.degraded_count += 1;
            }
            _ => {
                wave.blocked_count += 1;
                wave.phase = ManageRolloutWavePhase::Failed;
            }
        }
    }

    ManageRolloutWaveListResult {
        rollout_id: preview.rollout_id.clone(),
        attempt: preview.attempt,
        total: items.len(),
        items,
    }
}

fn admissible_preview_target(
    target: &PersistedRolloutTarget,
    preflight_outcome: PreflightOutcome,
    projection: DesiredStateProjection,
) -> ManageRolloutTargetPreviewRecord {
    ManageRolloutTargetPreviewRecord {
        node_id: target.node_id.clone(),
        preflight_outcome,
        blocked_reason: None,
        desired_state_revision: Some(projection.desired_state_revision),
        desired_state_hash: Some(projection.desired_state_hash),
        wave_id: target.wave_id.clone(),
    }
}

fn blocked_reason(outcome: PreflightOutcome) -> String {
    match outcome {
        PreflightOutcome::BlockedByVersion => "node version is not compatible".to_string(),
        PreflightOutcome::BlockedByCapability => "missing required rollout capability".to_string(),
        PreflightOutcome::BlockedByTrust => "node trust posture blocks the rollout".to_string(),
        PreflightOutcome::BlockedByPolicy => "rollout policy blocks the target".to_string(),
        PreflightOutcome::Admissible | PreflightOutcome::AdmissibleDegraded => {
            "target is admissible".to_string()
        }
    }
}

const DEFAULT_ROLLOUT_WAVE_ID: &str = "wave-default";

fn prime_compiler(compiler: &ProjectionCompiler, catalog: &PersistedRolloutCatalog) {
    for rollout in &catalog.rollouts {
        if let Some(preview) = &rollout.preview {
            for target in &preview.targets {
                let Some(desired_state_revision) = target.desired_state_revision else {
                    continue;
                };
                let Some(desired_state_hash) = target.desired_state_hash.clone() else {
                    continue;
                };
                let Some(persisted_target) = rollout
                    .targets
                    .iter()
                    .find(|persisted_target| persisted_target.node_id == target.node_id)
                else {
                    continue;
                };

                compiler.prime(DesiredStateProjection {
                    node_id: target.node_id.clone(),
                    desired_state_revision,
                    desired_state_hash,
                    config_projection_version: persisted_target.config_projection_version.clone(),
                    semantic_payload: persisted_target.semantic_payload.clone(),
                });
            }
        }
    }
}

fn load_or_seed_catalog(
    store: &dyn RolloutCatalogStore,
) -> Result<PersistedRolloutCatalog, RolloutControlPlaneError> {
    match store.load_catalog()? {
        Some(catalog) => Ok(catalog),
        None => {
            let seeded = seed_rollout_catalog();
            store.save_catalog(&seeded)?;
            Ok(seeded)
        }
    }
}

fn seed_rollout_catalog() -> PersistedRolloutCatalog {
    let seeded_at = now_timestamp_ms();

    PersistedRolloutCatalog {
        active_rollout_id: Some("rollout-a".to_string()),
        rollouts: vec![
            PersistedRollout {
                record: ManageRolloutRecord {
                    id: "rollout-a".to_string(),
                    phase: RolloutPhase::Draft,
                    attempt: 0,
                    target_count: 2,
                    updated_at: seeded_at,
                },
                policy: PersistedRolloutPolicy {
                    required_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                    allow_degraded_targets: false,
                },
                targets: vec![
                    PersistedRolloutTarget {
                        node_id: BUILT_IN_OPENCLAW_PRIMARY_NODE_ID.to_string(),
                        capabilities: vec![
                            "desired-state.pull".to_string(),
                            "runtime.apply".to_string(),
                        ],
                        trusted: true,
                        compatible: true,
                        config_projection_version: "v1".to_string(),
                        semantic_payload: "service=openclaw;mode=combined".to_string(),
                        wave_id: Some("wave-1".to_string()),
                    },
                    PersistedRolloutTarget {
                        node_id: "managed-remote".to_string(),
                        capabilities: vec![
                            "desired-state.pull".to_string(),
                            "runtime.apply".to_string(),
                        ],
                        trusted: true,
                        compatible: true,
                        config_projection_version: "v1".to_string(),
                        semantic_payload: "service=openclaw;mode=remote".to_string(),
                        wave_id: Some("wave-1".to_string()),
                    },
                ],
                preview: None,
            },
            PersistedRollout {
                record: ManageRolloutRecord {
                    id: "rollout-b".to_string(),
                    phase: RolloutPhase::Failed,
                    attempt: 1,
                    target_count: 2,
                    updated_at: seeded_at.saturating_sub(1_000),
                },
                policy: PersistedRolloutPolicy {
                    required_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                    allow_degraded_targets: false,
                },
                targets: vec![
                    PersistedRolloutTarget {
                        node_id: "attached-remote".to_string(),
                        capabilities: vec!["desired-state.pull".to_string()],
                        trusted: true,
                        compatible: true,
                        config_projection_version: "v1".to_string(),
                        semantic_payload: "service=openclaw;mode=attached".to_string(),
                        wave_id: Some("wave-1".to_string()),
                    },
                    PersistedRolloutTarget {
                        node_id: "quarantined-node".to_string(),
                        capabilities: vec![
                            "desired-state.pull".to_string(),
                            "runtime.apply".to_string(),
                        ],
                        trusted: false,
                        compatible: true,
                        config_projection_version: "v1".to_string(),
                        semantic_payload: "service=openclaw;mode=quarantine".to_string(),
                        wave_id: Some("wave-2".to_string()),
                    },
                ],
                preview: None,
            },
            PersistedRollout {
                record: ManageRolloutRecord {
                    id: "rollout-c".to_string(),
                    phase: RolloutPhase::Completed,
                    attempt: 1,
                    target_count: 1,
                    updated_at: seeded_at.saturating_sub(2_000),
                },
                policy: PersistedRolloutPolicy {
                    required_capabilities: vec!["desired-state.pull".to_string()],
                    allow_degraded_targets: false,
                },
                targets: vec![PersistedRolloutTarget {
                    node_id: "archive-node".to_string(),
                    capabilities: vec!["desired-state.pull".to_string()],
                    trusted: true,
                    compatible: true,
                    config_projection_version: "v1".to_string(),
                    semantic_payload: "service=openclaw;mode=archive".to_string(),
                    wave_id: Some("wave-1".to_string()),
                }],
                preview: None,
            },
        ],
    }
}

fn now_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_millis() as u64
}

fn resolve_active_rollout_id(catalog: &PersistedRolloutCatalog) -> Option<String> {
    catalog
        .active_rollout_id
        .as_ref()
        .filter(|rollout_id| {
            catalog
                .rollouts
                .iter()
                .any(|rollout| rollout.record.id == **rollout_id)
        })
        .cloned()
        .or_else(|| {
            catalog
                .rollouts
                .first()
                .map(|rollout| rollout.record.id.clone())
        })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct PersistedRolloutCatalog {
    #[serde(default)]
    active_rollout_id: Option<String>,
    rollouts: Vec<PersistedRollout>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct PersistedRollout {
    record: ManageRolloutRecord,
    policy: PersistedRolloutPolicy,
    targets: Vec<PersistedRolloutTarget>,
    preview: Option<ManageRolloutPreview>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct PersistedRolloutPolicy {
    required_capabilities: Vec<String>,
    allow_degraded_targets: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct PersistedRolloutTarget {
    node_id: String,
    capabilities: Vec<String>,
    trusted: bool,
    compatible: bool,
    config_projection_version: String,
    semantic_payload: String,
    wave_id: Option<String>,
}
