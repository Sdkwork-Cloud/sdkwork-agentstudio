# 105-2026-04-08 Local AI Proxy Probe Module Boundary

## Decision

The desktop local AI proxy must keep route probing in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, request serving, route-test persistence, observability, and the runtime-facing service methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  owns route-probe orchestration, probe capability classification, protocol-specific upstream probe requests, and upstream probe success/error interpretation

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod probe;` declaration, and explicit `probe::probe_route(...)` delegation.

## Why

- Step 03 remains strongly serial on runtime-boundary work, and `local_ai_proxy.rs` is still one of the major remaining hotspots.
- Route probing is a managed control-plane verification concern used to produce route-test evidence, but it is not part of the steady-state request-serving path itself.
- Built-in OpenClaw authority surfaces still depend on stable `local-managed` runtime health and diagnosability, so probe behavior needs one stable owner instead of being mixed into unrelated runtime logic.
- `plugins/mod.rs` remains host-plugin registration only, so route-probe ownership must stay in the runtime service layer rather than being hidden in plugin bootstrap or test-only helpers.

## Standard

- New local proxy probe capabilities, probe transport variations, and upstream probe success/error handling must live under `local_ai_proxy/probe.rs`.
- `LocalAiProxyService::test_route_by_id(...)` may delegate to the probe module, but it should not directly re-accumulate protocol-specific probe request construction.
- `local_ai_proxy.rs` may persist route-test results and expose them through service status, but it should not inline the probe HTTP logic once the probe boundary exists.

## Impact

- Step 03 now has another smaller, clearer module boundary inside the local proxy runtime.
- Future provider-specific probe changes can be reviewed independently from request translation, observability, and startup lifecycle changes.
- The desktop structure gate can now distinguish a real route-probe boundary split from an accidental one-off refactor.
