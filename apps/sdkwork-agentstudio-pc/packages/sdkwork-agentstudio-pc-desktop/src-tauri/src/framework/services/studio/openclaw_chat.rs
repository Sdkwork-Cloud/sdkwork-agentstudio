use super::{FrameworkError, StudioInstanceRecord, StudioInstanceTransportKind, StudioRuntimeKind};

pub(super) fn is_openclaw_gateway_kernel_chat_instance(instance: &StudioInstanceRecord) -> bool {
    matches!(instance.runtime_kind, StudioRuntimeKind::Openclaw)
        || matches!(
            instance.transport_kind,
            StudioInstanceTransportKind::OpenclawGatewayWs
        )
}

pub(super) fn unsupported_desktop_authoritative_openclaw_kernel_chat_error(
    instance: &StudioInstanceRecord,
) -> FrameworkError {
    FrameworkError::InvalidOperation(format!(
        "instance \"{}\" uses gateway-authoritative kernel chat; route chat through the OpenClaw gateway adapter instead of desktop authoritative kernel chat commands",
        instance.id,
    ))
}
