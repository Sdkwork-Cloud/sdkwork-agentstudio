pub const BUNDLED_OPENCLAW_VERSION: &str = env!("SDKWORK_BUNDLED_OPENCLAW_VERSION");
#[cfg(test)]
pub const REQUIRED_OPENCLAW_NODE_VERSION: &str = env!("SDKWORK_REQUIRED_OPENCLAW_NODE_VERSION");

pub fn bundled_openclaw_version() -> &'static str {
    BUNDLED_OPENCLAW_VERSION
}

#[cfg(test)]
pub fn required_openclaw_node_version() -> &'static str {
    REQUIRED_OPENCLAW_NODE_VERSION
}
