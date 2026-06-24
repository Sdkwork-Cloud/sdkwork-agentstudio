# 103-2026-04-08 Local AI Proxy Projection Module Boundary

## Decision

The desktop local AI proxy must keep managed OpenClaw provider projection in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns proxy lifecycle, protocol translation, observability, route health, and the runtime-facing `project_managed_openclaw_provider(...)` entrypoint
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs`
  owns the managed OpenClaw provider projection itself, including `openclaw.json` reads/writes, provider default selection, model projection, and canonical runtime-param persistence

`scripts/check-desktop-platform-foundation.mjs` must keep asserting the module file, submodule declaration, and explicit delegation so this split cannot silently collapse back into the runtime hotspot.

## Why

- Step 03 remains strongly serial on runtime-boundary work, and `local_ai_proxy.rs` is still one of the major remaining hotspots.
- Managed OpenClaw provider projection is a distinct control-plane concern: it mutates writable config state, but it is not part of the request-serving lifecycle itself.
- `docs/架构/17-能力到API调用矩阵.md` already freezes the startup chain `configure_openclaw_gateway -> ensure_local_ai_proxy_ready -> project_managed_openclaw_provider`; splitting the projection owner makes that chain easier to reason about and easier to protect with focused tests.
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs` remains host-plugin registration only, so projection logic cannot be hidden in plugin bootstrap side effects.

## Standard

- New managed-provider projection helpers must live under `local_ai_proxy/projection.rs` instead of being added back into `local_ai_proxy.rs`.
- `local_ai_proxy.rs` may delegate to projection helpers, but it should not directly re-accumulate JSON read/write, provider-default, and model-projection logic.
- Projection changes must continue preserving the same runtime-facing entrypoint and test surface:
  - `LocalAiProxyService::project_managed_openclaw_provider(...)`
  - the `project_managed_openclaw_provider*` Rust tests
  - the desktop foundation structure gate

## Impact

- Step 03 now has one less runtime-boundary hotspot tied to the local proxy main file.
- Future projection changes can be reviewed and tested without scanning the full proxy runtime implementation.
- The startup-chain contract stays the same for higher layers while the Rust implementation gets a clearer module owner.
