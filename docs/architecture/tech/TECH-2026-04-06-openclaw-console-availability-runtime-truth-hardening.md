> Migrated from `docs/review/2026-04-06-openclaw-console-availability-runtime-truth-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 OpenClaw Console Availability Runtime Truth Hardening

## Scope

This iteration closes the next shared-host correctness gap in the OpenClaw
instance-detail projection: `consoleAccess.available` was still being inferred
from "console URL can be derived" instead of "runtime is actually online".

The bug affected the shared Rust host surface across:

- desktop embedded host
- server / host-studio backed deployments
- docker / k8s modes consuming the same host-studio projection

## Root Cause

Two projection paths had diverged from runtime truth:

1. `packages/sdkwork-clawstudio-host-studio/src-host/src/lib.rs`
   `build_console_access(...)`
   - built-in managed OpenClaw already gated console projection on live runtime
     authority
   - remote and local-external OpenClaw instances still set
     `consoleAccess.available = url.is_some()`
   - that meant registry-default `offline` instances still surfaced an
     "Open OpenClaw Console" affordance

2. `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/studio.rs`
   `build_openclaw_console_access(...)`
   - only the built-in bundled gateway respected runtime status
   - local-external and remote instances still treated known URL + token as
     enough evidence to expose console launch / auto-login

The failure mode was identical across deployment families:

- instance detail claimed the console was available
- the runtime was still `offline`
- UI/runtime truth drifted, especially for remote and local-external OpenClaw
  instances

## Changes

### 1. Host-Studio Runtime Truth

Updated host-studio console projection so remote/local-external OpenClaw
instances now require runtime status `online` before `consoleAccess.available`
is true.

Behavior after the fix:

- `available = false` while runtime is offline
- `autoLoginUrl = null` while runtime is offline
- `url` / `gatewayUrl` remain projected for diagnostics and manual inspection
- `reason` now explains offline/unreachable runtime state

Built-in managed OpenClaw behavior remains unchanged:

- if there is no live runtime authority, host-studio still omits
  `consoleAccess`

### 2. Desktop Runtime Truth

Updated desktop console projection to use the same runtime truth for
local-external and remote OpenClaw instances:

- any OpenClaw instance must be `status == online` before console launch is
  exposed
- offline instances no longer emit auto-login URLs
- built-in bundled gateway keeps its existing "not running yet" reason
- remote and local-external deployments now emit explicit offline guidance

### 3. Regression Coverage

Added/updated regressions for both negative and positive cases:

- offline remote OpenClaw console projection is unavailable
- offline local-external OpenClaw console projection is unavailable
- online remote OpenClaw console projection remains available
- online local-external OpenClaw console auto-login remains available

This avoids the false fix of simply disabling console launch everywhere.

## Files Changed

- `packages/sdkwork-clawstudio-host-studio/src-host/src/lib.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/studio.rs`

## Verification

Red evidence captured before implementation:

- `cargo test --manifest-path packages/sdkwork-clawstudio-host-studio/src-host/Cargo.toml hides_console_launch_while_runtime_is_offline`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml hides_console_launch_while_runtime_is_offline`

Green evidence after implementation:

- `cargo test --manifest-path packages/sdkwork-clawstudio-host-studio/src-host/Cargo.toml console_launch`
- `cargo test --manifest-path packages/sdkwork-clawstudio-host-studio/src-host/Cargo.toml default_provider_local_external_openclaw_detail_exposes_console_access_without_workbench`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml console_launch`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml local_external_openclaw_detail_reads_install_record_for_console_auto_login`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml remote_openclaw_instance_detail_does_not_reuse_built_in_local_workbench`

## Remaining Follow-Up

The next adjacent correctness slice remains:

- launched-session runtime truth for real built-in OpenClaw readiness
- proxy/router + websocket reachability validation on top of the corrected
  instance-detail truth
- upward regression coverage for chat, notification, cron, and instance detail
  behavior once runtime truth converges end-to-end

