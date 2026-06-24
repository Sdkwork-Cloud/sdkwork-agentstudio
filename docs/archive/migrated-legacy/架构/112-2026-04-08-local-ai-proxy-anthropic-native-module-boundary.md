# 112-2026-04-08 Local AI Proxy Anthropic Native Module Boundary

## Decision

The desktop local AI proxy must keep Anthropic native protocol request-serving in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, shared router assembly, auth/header normalization, upstream dispatch entrypoints, and the runtime-facing service methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  owns Anthropic native `/v1/messages` request handling, including native header forwarding, upstream `/messages` dispatch, and streaming passthrough wiring through the shared runtime owners

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod anthropic_native;` declaration, and router delegation through `post(anthropic_native::messages_handler)`.

## Why

- Step 03 remains strongly serial on desktop runtime-boundary work, and `local_ai_proxy.rs` was still carrying one protocol-specific native request-serving hotspot after the earlier config, probe, upstream, streaming, request-translation, response-translation, observability, and Gemini native splits.
- The Anthropic native path is a clean owner candidate because it bundles:
  - native `/v1/messages` request parsing
  - required `anthropic-version` fallback and optional `anthropic-beta` forwarding
  - Anthropic-native upstream dispatch
  - passthrough streaming completion logging through the shared observability owner
- Without a dedicated owner, Anthropic native request logic drifts back into the main runtime file and makes the remaining runtime convergence harder to enforce.
- Built-in OpenClaw authority surfaces still depend on a stable managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so native Anthropic handling still belongs inside the runtime service layer, not in plugin bootstrap or browser-host code.
- `plugins/mod.rs` remains host-plugin registration only, so Anthropic native request-serving cannot move into plugin wiring.

## Standard

- New Anthropic-native request handlers must live under `local_ai_proxy/anthropic_native.rs`.
- Anthropic-native header forwarding, upstream dispatch, and streaming passthrough logic shared by the native route must live under `local_ai_proxy/anthropic_native.rs`.
- `local_ai_proxy.rs` may register Anthropic native handlers, but it should not re-accumulate Anthropic-native protocol request logic once the boundary exists.
- Shared observability, streaming, upstream buffering, and snapshot/auth helpers needed by Anthropic native handlers should still come from their dedicated owners instead of being redefined inside the Anthropic module.

## Impact

- Step 03 now has another smaller, clearer request-serving boundary inside the local proxy runtime.
- Future Anthropic-native protocol changes can be reviewed independently from OpenAI-compatible routing, native Gemini routing, startup lifecycle, route probing, streaming transport, and request/response translation.
- The desktop structure gate can now distinguish a real Anthropic-native boundary split from an accidental handler shuffle.
