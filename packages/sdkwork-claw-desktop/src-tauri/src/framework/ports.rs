pub const CANONICAL_LOOPBACK_PORT_WINDOW_START: u16 = 21_280;
pub const CANONICAL_LOOPBACK_PORT_WINDOW_SIZE: u16 = 32;

pub const OPENCLAW_GATEWAY_DEFAULT_PORT: u16 = CANONICAL_LOOPBACK_PORT_WINDOW_START;

pub const OPENCLAW_BROWSER_CONTROL_DERIVED_PORT_OFFSET: u16 = 2;
pub const OPENCLAW_BROWSER_CONTROL_DEFAULT_PORT: u16 =
    OPENCLAW_GATEWAY_DEFAULT_PORT + OPENCLAW_BROWSER_CONTROL_DERIVED_PORT_OFFSET;

pub const OPENCLAW_SIDECAR_RESERVED_PORT_START: u16 = OPENCLAW_BROWSER_CONTROL_DEFAULT_PORT;
pub const OPENCLAW_SIDECAR_RESERVED_PORT_END: u16 = OPENCLAW_SIDECAR_RESERVED_PORT_START + 6;

pub const DESKTOP_EMBEDDED_HOST_DEFAULT_PORT: u16 = OPENCLAW_SIDECAR_RESERVED_PORT_END + 1;

pub const OPENCLAW_GATEWAY_FALLBACK_PORT_RANGE_START: u16 = DESKTOP_EMBEDDED_HOST_DEFAULT_PORT + 1;
pub const OPENCLAW_GATEWAY_FALLBACK_PORT_RANGE_END: u16 =
    OPENCLAW_GATEWAY_FALLBACK_PORT_RANGE_START + 9;
pub const LOCAL_AI_PROXY_FALLBACK_PORT_RANGE_START: u16 =
    OPENCLAW_GATEWAY_FALLBACK_PORT_RANGE_END + 1;
pub const LOCAL_AI_PROXY_FALLBACK_PORT_RANGE_END: u16 =
    LOCAL_AI_PROXY_FALLBACK_PORT_RANGE_START + 9;
pub const DESKTOP_EMBEDDED_HOST_FALLBACK_PORT_RANGE_START: u16 =
    LOCAL_AI_PROXY_FALLBACK_PORT_RANGE_END + 1;
pub const DESKTOP_EMBEDDED_HOST_FALLBACK_PORT_RANGE_END: u16 =
    DESKTOP_EMBEDDED_HOST_FALLBACK_PORT_RANGE_START + 9;

pub const fn canonical_loopback_port_window_end(requested_port: u16) -> u16 {
    requested_port.saturating_add(CANONICAL_LOOPBACK_PORT_WINDOW_SIZE - 1)
}

pub const fn managed_gateway_fallback_port_range_start(requested_port: u16) -> u16 {
    if requested_port == OPENCLAW_GATEWAY_DEFAULT_PORT {
        OPENCLAW_GATEWAY_FALLBACK_PORT_RANGE_START
    } else {
        requested_port
    }
}

pub const fn managed_gateway_fallback_port_range_end(requested_port: u16) -> u16 {
    if requested_port == OPENCLAW_GATEWAY_DEFAULT_PORT {
        OPENCLAW_GATEWAY_FALLBACK_PORT_RANGE_END
    } else {
        canonical_loopback_port_window_end(requested_port)
    }
}

pub const fn managed_desktop_host_fallback_port_range_start(requested_port: u16) -> u16 {
    if requested_port == DESKTOP_EMBEDDED_HOST_DEFAULT_PORT {
        DESKTOP_EMBEDDED_HOST_FALLBACK_PORT_RANGE_START
    } else {
        requested_port
    }
}

pub const fn managed_desktop_host_fallback_port_range_end(requested_port: u16) -> u16 {
    if requested_port == DESKTOP_EMBEDDED_HOST_DEFAULT_PORT {
        DESKTOP_EMBEDDED_HOST_FALLBACK_PORT_RANGE_END
    } else {
        canonical_loopback_port_window_end(requested_port)
    }
}
