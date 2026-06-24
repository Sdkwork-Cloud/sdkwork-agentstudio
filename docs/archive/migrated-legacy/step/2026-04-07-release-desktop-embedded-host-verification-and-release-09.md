# Release Desktop Embedded Host Verification And Release 09

## Objective

- Investigate why `release-2026-04-07-08` still failed after the OpenClaw clean-clone hardening work.
- Repair the remaining desktop embedded-host verification drift that blocked GitHub publication.
- Record the carried-forward release evidence for the next publication candidate.

## Problems Found

1. `release-2026-04-07-08` failed in GitHub Actions run `24076080749`, so the earlier clean-clone fixes were not the final release blocker.
2. `build_embedded_host_server_state()` cloned `server_state.studio_public_api` before desktop wiring replaced `manage_openclaw_provider`, so the shared workbench API stayed attached to an inactive server control plane instead of the live desktop managed OpenClaw provider.
3. `DesktopStudioPublicApiBackend::get_instance_detail()` still attempted to deserialize `shared_detail.workbench` even when the shared detail explicitly returned `null`, producing a 500 instead of tolerating a missing workbench projection.
4. The OpenClaw mirror-import fixture still modeled an older gateway readiness contract and timed out because it did not implement `gateway health --json` or the allowlisted `/tools/invoke` probe used by current runtime readiness checks.
5. A small set of desktop Rust tests still asserted outdated offline semantics:
   - built-in list projection expected an always-present `base_url` while the runtime was offline
   - external profile-install-record detail expected `autoLoginUrl` while the gateway was offline

## Root Cause Evidence

### Desktop embedded-host authority drift

1. The desktop bootstrap tests that mutate public workbench state were failing even though the host server started successfully.
2. The server bootstrap path cloned the shared studio provider before desktop-specific authority was attached.
3. That left the public studio routes reading from the wrong control plane, so workbench mutations were routed against stale inactive state.

### Shared detail null-workbench failure

1. The shared workbench provider is allowed to omit workbench projection data by returning `workbench: null`.
2. The desktop backend treated any present `workbench` key as deserializable JSON and surfaced a 500 when the value was null.

### Mirror-import fixture drift

1. The fake runtime CLI only opened a TCP listener after `gateway` launch.
2. The current supervisor readiness path also requires:
   - `doctor --fix --non-interactive --yes`
   - `gateway health --json`
   - HTTP `POST /tools/invoke` for `cron.status`
3. Because the fixture did not implement those behaviors, the mirror-import restart tests failed even though production runtime logic was still correct.

## Changes Landed

### Desktop embedded-host authority repair

- Added a desktop control-plane rebuild path in `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`.
- Rebuilt the shared workbench API from the live desktop `ManageOpenClawProviderHandle` via `build_default_studio_public_api_provider(...)`.
- Rebound `server_state.openclaw_control_plane`, `server_state.manage_openclaw_provider`, and `server_state.studio_public_api` in the correct order so the desktop embedded host exposes live managed-workbench authority.
- Hardened detail projection so `workbench: null` is ignored instead of deserialized.

### Desktop verification fixture and expectation repair

- Added `configured_running_supervisor(...)` in `packages/sdkwork-claw-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs` and switched the affected bootstrap tests to a running configured supervisor.
- Replaced the stale mirror-import CLI fixture in `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs` with one that implements the current readiness contract.
- Updated the stale offline expectations in `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs` so tests now match current intended semantics.

## Verification

Fresh commands run in this loop:

```bash
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml built_in_instance_reads_http_auth_from_managed_openclaw_config -- --nocapture
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml local_external_openclaw_detail_reads_profile_specific_install_record_shape -- --nocapture
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_canonical_public_studio_routes -- --nocapture
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_exposes_canonical_public_studio_workbench_mutation_routes -- --nocapture
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap_detail_route_reflects_shared_workbench_mutations -- --nocapture
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_can_restart_gateway_when_requested -- --nocapture
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml openclaw_mirror_import_can_leave_gateway_stopped_after_restore -- --nocapture
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml
$env:CI='1'
$env:SDKWORK_SHARED_SDK_MODE='git'
pnpm lint
pnpm check:desktop
pnpm check:server
pnpm build
pnpm server:build
pnpm docs:build
```

Observed result:

1. All seven targeted desktop Rust regressions passed after the control-plane repair and fixture alignment.
2. The full desktop Rust suite passed with `409 passed; 0 failed`.
3. The full release-mode verification batch passed locally with `CI=1` and `SDKWORK_SHARED_SDK_MODE=git`.
4. The workspace release candidate is now `release-2026-04-07-09`; `release-2026-04-07-08` remains failed and unpublished.

## Status

- `release-2026-04-07-08` is now clearly a failed unpublished attempt and should not remain the active release candidate.
- The next carried-forward candidate is `release-2026-04-07-09`.
- Remaining operational work: re-run final release-note rendering, verify worktree cleanliness, commit the repair on `main`, push it, create `release-2026-04-07-09`, and confirm the GitHub release workflow publishes successfully.
