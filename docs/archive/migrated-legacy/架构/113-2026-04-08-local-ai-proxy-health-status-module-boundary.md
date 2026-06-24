# 113-2026-04-08 Local AI Proxy Health/Status Module Boundary

## Decision

The desktop local AI proxy must keep health/status projection in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, shared router assembly, auth/header normalization, upstream dispatch entrypoints, and the runtime-facing service methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  owns `/health` request handling, runtime health snapshot building, route metrics projection, route test projection, default-route health projection, route-health derivation, and observability-store reconciliation

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod health;` declaration, health-handler delegation through `get(health::health_handler)`, the delegated status-projection calls, and the removal of the old in-file helper definitions from the main runtime file.

## Why

- Step 03 remains strongly serial on desktop runtime-boundary work, and `local_ai_proxy.rs` was still carrying one shared health/status hotspot after the earlier config, probe, upstream, streaming, request-translation, response-translation, observability, Gemini native, and Anthropic native splits.
- The health/status path is a clean owner candidate because it bundles:
  - `/health` response serving
  - health snapshot shaping for the runtime lifecycle surface
  - route metrics and route test projection from the observability store
  - default-route health projection for OpenAI-compatible, Anthropic, and Gemini clients
  - observability-store reconciliation when snapshots change
- Without a dedicated owner, health/status projection logic drifts back into the main runtime file and makes the remaining runtime convergence harder to enforce.
- Built-in OpenClaw authority surfaces still depend on a stable managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so health/status serving still belongs inside the runtime service layer, not in plugin bootstrap or browser-host code.
- `plugins/mod.rs` remains host-plugin registration only, so health/status serving cannot move into plugin wiring.

## Standard

- New local proxy health/status handlers and projection helpers must live under `local_ai_proxy/health.rs`.
- Runtime health snapshot building, default-route health shaping, and route metrics/test projection shared by the runtime status surface must live under `local_ai_proxy/health.rs`.
- `local_ai_proxy.rs` may register the health routes and invoke the projection helpers, but it should not re-accumulate health/status projection logic once the boundary exists.
- Shared observability storage, snapshot/auth helpers, and provider request handlers needed by health/status projection should still come from their dedicated owners instead of being redefined inside the health module.

## Impact

- Step 03 now has another smaller, clearer projection boundary inside the local proxy runtime.
- Future health/status changes can be reviewed independently from OpenAI-compatible request serving, native Anthropic/Gemini routing, startup lifecycle, route probing, streaming transport, and request/response translation.
- The desktop structure gate can now distinguish a real health/status boundary split from an accidental helper shuffle.
