use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesiredStateInput {
    pub node_id: String,
    pub config_projection_version: String,
    pub semantic_payload: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesiredStateProjection {
    pub node_id: String,
    pub desired_state_revision: u64,
    pub desired_state_hash: String,
    pub config_projection_version: String,
    pub semantic_payload: String,
}

#[derive(Debug, Default)]
pub struct ProjectionCompiler {
    projections: Mutex<HashMap<String, DesiredStateProjection>>,
}

impl ProjectionCompiler {
    pub fn new() -> Self {
        Self {
            projections: Mutex::new(HashMap::new()),
        }
    }

    pub fn compile(&self, input: &DesiredStateInput) -> DesiredStateProjection {
        let next_hash = canonical_projection_hash(input);
        let mut projections = self
            .projections
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if let Some(existing) = projections.get(&input.node_id) {
            if existing.desired_state_hash == next_hash {
                return existing.clone();
            }
        }

        let next_revision = projections
            .get(&input.node_id)
            .map(|projection| projection.desired_state_revision + 1)
            .unwrap_or(1);
        let projection = DesiredStateProjection {
            node_id: input.node_id.clone(),
            desired_state_revision: next_revision,
            desired_state_hash: next_hash,
            config_projection_version: input.config_projection_version.clone(),
            semantic_payload: input.semantic_payload.clone(),
        };

        projections.insert(input.node_id.clone(), projection.clone());
        projection
    }

    pub fn prime(&self, projection: DesiredStateProjection) {
        let mut projections = self
            .projections
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        match projections.get(&projection.node_id) {
            Some(existing)
                if existing.desired_state_revision > projection.desired_state_revision => {}
            _ => {
                projections.insert(projection.node_id.clone(), projection);
            }
        }
    }
}

fn canonical_projection_hash(input: &DesiredStateInput) -> String {
    let mut hasher = DefaultHasher::new();
    input.node_id.hash(&mut hasher);
    input.config_projection_version.hash(&mut hasher);
    input.semantic_payload.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}
