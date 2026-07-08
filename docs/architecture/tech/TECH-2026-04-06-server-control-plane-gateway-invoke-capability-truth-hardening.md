> Migrated from `docs/review/2026-04-06-server-control-plane-gateway-invoke-capability-truth-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Server Control-Plane Gateway Invoke Capability Truth Hardening

## Scope

This iteration closes the next shared-host truth gap after the desktop hosted
readiness hardening.

Desktop startup now refuses to declare the managed OpenClaw runtime ready until
the host publishes `manage.openclaw.gateway.invoke` in
`availableCapabilityKeys`.

That made the next shared-runtime question unavoidable:

- does the server/control-plane host publish the same capability truth?
- or does it stay pessimistic even when its managed gateway projection is
  already ready?

## Root Cause

`packages/sdkwork-clawstudio-server/src-host/src/bootstrap.rs`
`ControlPlaneManageOpenClawProvider::gateway_invoke_is_available(...)` was
hard-coded to `false`.

That created a capability-truth split inside the shared Rust host layer:

- `invoke_gateway(...)` already delegated into `OpenClawControlPlane`
- `OpenClawControlPlane::invoke_gateway(...)` itself already gates on gateway
  lifecycle readiness
- but the server provider still reported gateway invoke availability as
  permanently unavailable

So even if the control plane had a ready gateway projection, server/docker/k8s
host-platform status would keep omitting
`manage.openclaw.gateway.invoke` from `availableCapabilityKeys`.

## Changes

### 1. Server Provider Now Derives Invoke Availability From Gateway Lifecycle

The server control-plane manage provider now resolves invoke availability from
the control-plane gateway projection lifecycle instead of returning a constant
`false`.

This aligns server behavior with the desktop embedded host semantics:

- gateway ready -> invoke capability available
- gateway not ready -> invoke capability unavailable

### 2. The Shared Host-Platform Contract Is Locked At The API Surface

Added a focused route-level regression proving that when the real
control-plane-backed provider reports a ready gateway projection:

- `/claw/internal/v1/host-platform`
- must include `manage.openclaw.gateway.invoke`
- in both `availableCapabilityKeys` and `capabilityKeys`

### 3. Provider-Level Regression Prevents Reintroducing The Hardcoded False

Added a focused bootstrap regression proving the real
`ControlPlaneManageOpenClawProvider` must return `true` for
`gateway_invoke_is_available(...)` when the underlying control plane has a
ready gateway endpoint.

## Files Changed

- `packages/sdkwork-clawstudio-server/src-host/src/bootstrap.rs`
- `packages/sdkwork-clawstudio-server/src-host/src/main.rs`

## Verification

Red evidence captured before implementation:

- `cargo test control_plane_manage_openclaw_provider_reports_gateway_invoke_available_when_gateway_is_ready --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml`
- `cargo test internal_host_platform_route_reports_gateway_invoke_available_when_control_plane_gateway_is_ready --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml`

Green evidence after implementation:

- `cargo test control_plane_manage_openclaw_provider_reports_gateway_invoke_available_when_gateway_is_ready --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml`
- `cargo test internal_host_platform_route_reports_gateway_invoke_available_when_control_plane_gateway_is_ready --manifest-path packages/sdkwork-clawstudio-server/src-host/Cargo.toml`
- `pnpm.cmd check:server`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd lint`

## Remaining Follow-Up

The next adjacent runtime-proof slice remains:

- launched-session evidence for real built-in OpenClaw `online` convergence and
  WebSocket reachability is still needed beyond contract-level capability truth
- upward validation for chat, notification, cron, proxy router, and
  instance-detail behavior should continue on top of the now-aligned shared
  invoke-capability contract
- packaged installer smoke on Windows/Linux/macOS is still required outside the
  synthetic release checks

