# 104-2026-04-08 Local AI Proxy Config Module Boundary

## Decision

The desktop local AI proxy must keep config-file loading and public-host resolution in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, request serving, protocol translation, observability, and the runtime-facing orchestration methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/config.rs`
  owns the config schema, config-file read/write behavior, public host normalization, and loopback-safe public-host selection

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod config;` declaration, and explicit `config::ensure_local_ai_proxy_config(...)` delegation.

## Why

- Step 03 remains strongly serial on runtime-boundary work, and `local_ai_proxy.rs` is still one of the major remaining hotspots.
- Local proxy config loading is a control-plane concern required before startup, but it is not part of the request-serving lifecycle itself.
- Public-host resolution affects built-in OpenClaw authority surfaces and startup evidence, so it needs one stable owner instead of being mixed into unrelated runtime logic.
- `plugins/mod.rs` remains host-plugin registration only, so proxy config ownership must stay in the runtime service layer rather than being hidden in plugin bootstrap or test-only helpers.

## Standard

- New local proxy config schema fields, config-file parsing rules, and public-host normalization logic must live under `local_ai_proxy/config.rs`.
- `local_ai_proxy.rs` may delegate to the config module, but it should not directly re-accumulate config-file parsing and public-host selection logic.
- Crate-internal consumers that need the canonical default local proxy public host should import it from the config submodule instead of relying on incidental wrappers.

## Impact

- Step 03 now has another smaller, clearer module boundary inside the local proxy runtime.
- Future config changes can be reviewed independently from request-translation and observability changes.
- The desktop structure gate can now distinguish a real config-boundary split from an accidental one-off refactor.
