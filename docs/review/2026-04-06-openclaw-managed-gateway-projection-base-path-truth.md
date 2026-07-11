# 2026-04-06 OpenClaw Managed Gateway Projection Base-Path Truth

## Scope

This slice closes a concrete runtime-truth drift inside the desktop Rust host:

- built-in OpenClaw instance detail had already been hardened to project
  `gateway.controlUi.basePath` into the live gateway websocket URL
- but the desktop embedded host manage/runtime/gateway projection still
  published `ws://127.0.0.1:{port}` without the configured control-ui base path

That split left different layers of the same managed OpenClaw runtime publishing
different websocket truth.

## Root Cause

The bug was in
`packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`.

`managed_openclaw_gateway_endpoint(...)` still built the managed gateway
projection with a hardcoded root websocket URL:

- `base_url: http://127.0.0.1:{port}`
- `websocket_url: ws://127.0.0.1:{port}`

That meant the following surfaces could disagree for the same live managed
OpenClaw runtime:

- `GET /claw/manage/v1/host-endpoints`
- `GET /claw/manage/v1/openclaw/runtime`
- `GET /claw/manage/v1/openclaw/gateway`
- built-in instance detail / instance projection

In the presence of `gateway.controlUi.basePath`, the built-in instance detail
could say:

- `ws://127.0.0.1:{port}/openclaw`

while the manage/runtime/gateway projection still said:

- `ws://127.0.0.1:{port}`

This is exactly the kind of split that can surface as websocket connection
errors, console-open inconsistencies, or readiness drift in the desktop hosted
runtime.

## Fix

Implemented changes:

- `managed_openclaw_gateway_endpoint(...)` now reads
  `paths.openclaw_config_file` and projects the configured control-ui gateway
  path into the published websocket URL
- `get_host_endpoints(...)`, `get_openclaw_runtime(...)`, and
  `get_openclaw_gateway(...)` now pass `paths` into the managed gateway
  endpoint projection so the config-backed path can be resolved
- `build_openclaw_gateway_ws_url(...)` fallback no longer drops the resolved
  gateway path when only host/port data is available
- shared control-ui base-path resolution was extracted so the same normalization
  logic is reused across built-in detail and managed gateway projection paths

Deliberate non-change:

- HTTP `base_url` remains rooted at `http://127.0.0.1:{port}` so OpenAI HTTP
  endpoint derivation and existing gateway HTTP assumptions stay stable

## Regression Coverage

Added red-green regression:

- `managed_openclaw_gateway_projection_projects_control_ui_base_path_into_websocket_url`

This test now locks all three desktop manage surfaces to the same websocket
truth:

- host endpoint projection
- OpenClaw runtime projection
- OpenClaw gateway projection

## Verification

Executed and passed:

- `cargo test managed_openclaw_gateway_projection_projects_control_ui_base_path_into_websocket_url --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test built_in_instance_detail_projects_control_ui_base_path_into_live_gateway_websocket_url --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

## Remaining Risk

This slice fixes projection truth, not actual live socket dialability.

Still open:

- launched-session proof that the managed websocket is not only projected
  correctly but is actually connectable after startup
- browser-only fallback review in `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
  if any UI flow can still surface stale built-in websocket metadata
- live validation for chat, notification, cron, proxy router, and instance
  detail flows on top of the now-aligned managed gateway projection
