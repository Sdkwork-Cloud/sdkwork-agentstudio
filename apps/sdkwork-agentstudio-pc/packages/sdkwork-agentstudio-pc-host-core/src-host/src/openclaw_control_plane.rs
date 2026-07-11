use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::host_endpoints::{
    project_openclaw_gateway, project_openclaw_runtime, HostEndpointRecord, HostEndpointRegistry,
    OpenClawGatewayProjection, OpenClawLifecycle, OpenClawRuntimeProjection,
};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawGatewayInvokeRequest {
    pub tool: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dry_run: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_channel: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<BTreeMap<String, String>>,
}

#[derive(Debug, Clone)]
pub struct OpenClawControlPlane {
    host_endpoints: HostEndpointRegistry,
    runtime_endpoint_id: Option<String>,
    gateway_endpoint_id: Option<String>,
    runtime_lifecycle: OpenClawLifecycle,
    gateway_lifecycle: OpenClawLifecycle,
    managed_by: String,
}

impl OpenClawControlPlane {
    pub fn inactive(managed_by: impl Into<String>) -> Self {
        Self {
            host_endpoints: HostEndpointRegistry::default(),
            runtime_endpoint_id: None,
            gateway_endpoint_id: None,
            runtime_lifecycle: OpenClawLifecycle::Inactive,
            gateway_lifecycle: OpenClawLifecycle::Inactive,
            managed_by: managed_by.into(),
        }
    }

    pub fn with_host_endpoints(mut self, host_endpoints: HostEndpointRegistry) -> Self {
        self.host_endpoints = host_endpoints;
        self
    }

    pub fn with_runtime_endpoint(
        mut self,
        endpoint_id: impl Into<String>,
        lifecycle: OpenClawLifecycle,
    ) -> Self {
        self.runtime_endpoint_id = Some(endpoint_id.into());
        self.runtime_lifecycle = lifecycle;
        self
    }

    pub fn with_gateway_endpoint(
        mut self,
        endpoint_id: impl Into<String>,
        lifecycle: OpenClawLifecycle,
    ) -> Self {
        self.gateway_endpoint_id = Some(endpoint_id.into());
        self.gateway_lifecycle = lifecycle;
        self
    }

    pub fn list_host_endpoints(&self) -> Vec<HostEndpointRecord> {
        self.host_endpoints.list()
    }

    pub fn get_runtime(&self, updated_at: u64) -> OpenClawRuntimeProjection {
        let endpoint = self
            .runtime_endpoint_id
            .as_deref()
            .and_then(|endpoint_id| self.host_endpoints.get(endpoint_id));
        project_openclaw_runtime(
            endpoint,
            self.runtime_lifecycle,
            self.managed_by.clone(),
            updated_at,
        )
    }

    pub fn get_gateway(&self, updated_at: u64) -> OpenClawGatewayProjection {
        let endpoint = self
            .gateway_endpoint_id
            .as_deref()
            .and_then(|endpoint_id| self.host_endpoints.get(endpoint_id));
        project_openclaw_gateway(
            endpoint,
            self.gateway_lifecycle,
            self.managed_by.clone(),
            updated_at,
        )
    }

    pub fn invoke_gateway(
        &self,
        request: OpenClawGatewayInvokeRequest,
        updated_at: u64,
    ) -> Result<Value, String> {
        if self.gateway_lifecycle != OpenClawLifecycle::Ready {
            return Err("openclaw gateway is not ready".to_string());
        }

        if !request.dry_run.unwrap_or(false) {
            return Err(
                "openclaw gateway invoke is not implemented for this host shell"
                    .to_string(),
            );
        }

        Ok(json!({
            "accepted": true,
            "tool": request.tool,
            "action": request.action,
            "dryRun": true,
            "lifecycle": self.gateway_lifecycle.as_str(),
            "message": "openclaw gateway dry-run accepted",
            "updatedAt": updated_at
        }))
    }
}
