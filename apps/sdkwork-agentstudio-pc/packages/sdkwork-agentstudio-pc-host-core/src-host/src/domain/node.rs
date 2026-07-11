pub const BUILT_IN_OPENCLAW_PRIMARY_NODE_ID: &str = "managed-openclaw-primary";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodeDescriptor {
    pub node_id: String,
    pub capabilities: Vec<String>,
    pub trusted: bool,
    pub compatible: bool,
}
