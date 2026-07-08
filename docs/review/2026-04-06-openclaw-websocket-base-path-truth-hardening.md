# 2026-04-06 OpenClaw WebSocket Base-Path Truth Hardening

## Goal

Close the remaining OpenClaw websocket authority drift where some runtime
projections still published `ws://127.0.0.1:{port}` even when the managed or
associated OpenClaw gateway was configured with `gateway.controlUi.basePath`.

## Root Causes

1. Desktop built-in live-state projection in
   `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/studio.rs`
   hardcoded the built-in websocket URL to the gateway origin and ignored the
   managed config `controlUi.basePath`.
2. Local-external OpenClaw onboarding in
   `packages/sdkwork-clawstudio-instances/src/services/instanceOnboardingService.ts`
   also hardcoded the websocket URL to the gateway origin and ignored the same
   config field while discovering and associating existing OpenClaw installs.

## Red Regressions

- Desktop Rust regression:
  `built_in_instance_detail_projects_control_ui_base_path_into_live_gateway_websocket_url`
- TypeScript onboarding regressions:
  - `discoverInstalledOpenClawInstalls projects the configured control-ui base path into websocket metadata`
  - `associateOpenClawConfigPath projects the configured control-ui base path into websocket metadata`

## Implementation

### Desktop built-in runtime truth

- Changed built-in live-state projection to read the managed OpenClaw config
  file while the gateway is ready.
- Reused the canonical desktop helper that already understands
  `controlUi.basePath` instead of keeping a second websocket URL rule.
- Preserved the built-in HTTP `baseUrl` at the gateway root so OpenAI HTTP
  endpoint derivation still stays rooted at `http://127.0.0.1:{port}`.

### Local-external onboarding truth

- Added explicit `controlUi.basePath` normalization in
  `instanceOnboardingService.ts`.
- Changed discovery and association gateway websocket metadata to append the
  configured control-ui base path while keeping the HTTP base URL at the root
  origin.
- Preserved existing remote OpenClaw creation behavior because remote instances
  are still explicit user-authored endpoint metadata rather than config-derived
  local runtime projections.

## Verification

- `cargo test built_in_instance_detail_projects_control_ui_base_path_into_live_gateway_websocket_url --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml`
- `cargo test built_in_instance_detail_exposes_console_access_with_auto_login_url --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml`
- `cargo test built_in_instance_detail_hides_live_gateway_endpoints_when_the_gateway_is_not_running --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml`
- `pnpm.cmd check:desktop`
- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-clawstudio-instances/src/services/instanceOnboardingService.test.ts']))"`
- `pnpm.cmd lint`

## Outcome

- Desktop built-in instance detail, connectivity, and console-access projections
  now agree on the same canonical websocket authority.
- Local-external OpenClaw discovery and association no longer strip
  `controlUi.basePath` from websocket metadata.
- Shared OpenClaw websocket authority is now more consistent across desktop
  built-in and config-derived local-external onboarding flows.

## Remaining Follow-Up

- Capture launched-session evidence that the real built-in OpenClaw gateway and
  websocket become reachable in one managed desktop startup, not only in
  contract-level tests.
- Review browser-only fallback normalization in
  `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts` if live
  evidence shows it can override canonical websocket metadata from the host.
- Continue upward validation for chat, notification, cron, proxy router, and
  instance-detail behavior on top of the corrected websocket authority truth.
