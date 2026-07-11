pub use crate::domain::rollout::PreflightOutcome;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RolloutPreflightTarget {
    pub node_id: String,
    pub capabilities: Vec<String>,
    pub trusted: bool,
    pub compatible: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RolloutPolicy {
    pub required_capabilities: Vec<String>,
    pub allow_degraded_targets: bool,
}

pub fn preflight_target(
    target: &RolloutPreflightTarget,
    policy: &RolloutPolicy,
) -> PreflightOutcome {
    if !target.trusted {
        return PreflightOutcome::BlockedByTrust;
    }

    if !target.compatible {
        return PreflightOutcome::BlockedByVersion;
    }

    if policy.required_capabilities.iter().any(|required| {
        !target
            .capabilities
            .iter()
            .any(|capability| capability == required)
    }) {
        return PreflightOutcome::BlockedByCapability;
    }

    let _ = policy.allow_degraded_targets;
    PreflightOutcome::Admissible
}
