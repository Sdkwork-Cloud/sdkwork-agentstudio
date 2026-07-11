> Migrated from `docs/review/2026-04-06-openclaw-runtime-health-and-live-endpoint-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 OpenClaw Runtime Health And Live Endpoint Hardening

## Scope

This iteration continued the desktop embedded OpenClaw stabilization work after the earlier gateway-probe and host-provenance fixes.

The concrete symptoms targeted in this pass were:

- built-in OpenClaw WebSocket `ERR_CONNECTION_REFUSED`
- built-in OpenClaw console launch showing a URL before the gateway was actually usable
- built-in instance detail and connectivity snapshots exposing live gateway URLs while the managed runtime was still offline or stale
- supervisor runtime state staying on `Running` after the OpenClaw loopback listener disappeared

## Root Cause

Two independent problems were amplifying each other:

1. The built-in instance baseline projection published `baseUrl` and `websocketUrl` even before the managed gateway was actually running.
2. The desktop supervisor only remembered that the OpenClaw gateway had once become ready. After that point it did not continuously re-check that the managed process still had a working loopback listener.

That meant Agent Studio could keep projecting a connectable built-in OpenClaw runtime even when:

- the gateway had not started yet
- the process had exited
- the process was still alive but its HTTP listener was gone

The user-visible result matched the reported field failures:

- browser WebSocket attempts were made against a dead loopback port
- console launch surfaced a dead endpoint
- frontend features built on top of built-in endpoint metadata could enter the wrong path and fail later with `503`, empty panels, or refused connections

## Changes Landed

### 1. Built-in instances no longer publish live gateway URLs by default

File:

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`

Behavior change:

- `build_built_in_instance(...)` now initializes the built-in OpenClaw instance without live `baseUrl` / `websocketUrl` projection.
- The same applies to `instance.config.baseUrl` and `instance.config.websocketUrl`.

This prevents the baseline registry/detail projection from advertising a live local gateway before supervisor-backed liveness has been confirmed.

### 2. Live endpoint projection is now gated by real managed runtime readiness

File:

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`

Behavior change:

- `project_built_in_instance_live_state(...)` now computes OpenClaw lifecycle first.
- Live `baseUrl` / `websocketUrl` fields are only projected when lifecycle resolves to `Ready`.
- When lifecycle is not ready, the built-in instance keeps the configured port and auth token but clears live HTTP/WebSocket URL projection.

This keeps config and desired-state metadata available without lying about runtime reachability.

### 3. Supervisor now refreshes managed runtime health before reporting service state

File:

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/supervisor.rs`

Behavior change:

- `is_service_running(...)` now refreshes managed runtime state before answering.
- `snapshot(...)` now refreshes each managed service before building the public snapshot.
- The refresh step now:
  - detects exited managed child processes and marks the service failed
  - re-checks the built-in OpenClaw gateway with the same invoke-ready loopback probe used during startup
  - marks the gateway failed when the process is still alive but the local listener is no longer invoke-ready
  - restores `Running` if the gateway recovers and becomes healthy again

This closes the stale-supervisor-state gap that was allowing dead loopback endpoints to remain projected as healthy.

### 4. Built-in instance lifecycle now surfaces degraded gateway state

File:

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`

Behavior change:

- `managed_openclaw_lifecycle(...)` now maps a failed OpenClaw gateway service snapshot to `Degraded` instead of flattening everything to `Stopped`.
- Built-in instance detail therefore surfaces `Error` state when the managed gateway becomes stale or unhealthy after startup.

This gives the UI and startup surfaces a truthful error state instead of a false-ready or ambiguous-stopped projection.

## Regression Tests Added Or Updated

### New regression tests

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`
  - `built_in_instance_detail_hides_live_gateway_endpoints_when_the_gateway_is_not_running`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/supervisor.rs`
  - `supervisor_marks_the_openclaw_gateway_unhealthy_when_the_loopback_listener_disappears`

### Updated regression expectations

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`
  - `built_in_instance_detail_reports_gateway_and_openai_http_endpoints_when_the_gateway_is_running`
  - `built_in_instance_detail_exposes_console_access_with_auto_login_url`
  - `built_in_instance_detail_hides_auto_login_for_secret_ref_tokens`

These tests now explicitly require a running supervisor-backed OpenClaw runtime before live gateway URLs or auto-login console launch are considered available.

## Verification Evidence

The following commands were run after the code changes:

- `cargo test built_in_instance_detail_hides_live_gateway_endpoints_when_the_gateway_is_not_running --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test supervisor_marks_the_openclaw_gateway_unhealthy_when_the_loopback_listener_disappears --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test built_in_instance_detail_ --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test supervisor_ --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `pnpm.cmd check:desktop`

All of the above completed successfully in this iteration.

## Impact

This pass improves correctness across the shared desktop/server-style host model in three important ways:

1. The built-in OpenClaw projection now distinguishes configured intent from live endpoint readiness.
2. The supervisor no longer trusts a stale in-memory `Running` bit after the local gateway becomes unreachable.
3. UI and feature layers that depend on built-in OpenClaw endpoint metadata are less likely to walk into dead loopback endpoints and fail later with opaque browser/runtime errors.

## Remaining Gaps

This iteration did not yet close every user-reported issue. The most important remaining items are:

1. The bundled OpenClaw component version still normalizes to `2026.4.2` in `pnpm.cmd check:desktop`, which is still not aligned with the user's "upgrade to the latest version" requirement.
2. The built-in OpenClaw installer and packaged first-launch smoke path still need stronger end-to-end bundle/install verification across Windows, Linux, and macOS.
3. The full chat / notification / cron job / instance detail / file list / proxy router regression matrix still needs another round of focused validation on top of the new runtime-health truthfulness.
4. The local API proxy token accounting review remains open.

## Next Iteration

1. Trace the bundled OpenClaw version source through release metadata, bundled component sync, installer assets, and runtime activation so the desktop package stops pinning at `2026.4.2`.
2. Re-run the built-in OpenClaw functional matrix against:
   - gateway invoke
   - console launch
   - file list
   - chat session bootstrap
   - cron/task actions
3. Add at least one packaged first-launch smoke flow that proves:
   - installer unpack completed during install
   - built-in OpenClaw is started by host bootstrap
   - first renderer startup does not need to re-extract or re-bootstrap the OpenClaw archive

