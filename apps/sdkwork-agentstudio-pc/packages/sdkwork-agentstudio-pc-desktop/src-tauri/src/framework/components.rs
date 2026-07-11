use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PackagedComponentKind {
    Binary,
    NodeApp,
    ServiceGroup,
    EmbeddedLibrary,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PackagedComponentStartupMode {
    AutoStart,
    Manual,
    Embedded,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackagedComponentDefinition {
    pub id: String,
    pub display_name: String,
    pub kind: PackagedComponentKind,
    pub bundled_version: String,
    pub startup_mode: PackagedComponentStartupMode,
    pub install_subdir: String,
    pub upgrade_channel: String,
    pub service_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub commit: Option<String>,
}

pub fn bundled_component_defaults() -> Vec<PackagedComponentDefinition> {
    Vec::new()
}

pub fn default_startup_component_ids(definitions: &[PackagedComponentDefinition]) -> Vec<String> {
    definitions
        .iter()
        .filter(|definition| definition.startup_mode == PackagedComponentStartupMode::AutoStart)
        .map(|definition| definition.id.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{bundled_component_defaults, default_startup_component_ids};

    #[test]
    fn bundled_component_defaults_cover_packaged_platform_contract() {
        let definitions = bundled_component_defaults();
        assert!(definitions.is_empty());
        assert!(default_startup_component_ids(&definitions).is_empty());
    }
}
