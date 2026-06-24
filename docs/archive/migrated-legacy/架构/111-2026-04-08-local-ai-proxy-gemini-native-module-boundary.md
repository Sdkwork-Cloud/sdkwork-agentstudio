# 111-2026-04-08 Local AI Proxy Gemini Native Module Boundary

## Decision

The desktop local AI proxy must keep Gemini native protocol request-serving in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, shared router assembly, auth/header normalization, upstream dispatch entrypoints, and the runtime-facing service methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  owns Gemini native `/v1beta/models`, `/v1beta/models/{model_action}`, and `/v1/models/{model_action}` request handlers plus Gemini-specific model-action parsing and supported-generation-method classification

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod gemini_native;` declaration, router delegation through `gemini_native::...`, and the removal of the old in-file Gemini handler definitions from the main runtime file.

## Why

- Step 03 remains strongly serial on desktop runtime-boundary work, and `local_ai_proxy.rs` was still carrying one protocol-specific request-serving hotspot after the earlier config, probe, upstream, streaming, request-translation, response-translation, and observability splits.
- The Gemini native path is a clean owner candidate because it bundles:
  - native model-list projection
  - native model-action parsing
  - supported-generation-method classification
  - Gemini-native upstream dispatch and streaming passthrough
  - request-audit and route-metric writeback through shared runtime owners
- Without a dedicated owner, Gemini native request logic drifts back into the main runtime file and makes the remaining runtime convergence harder to enforce.
- Built-in OpenClaw authority surfaces still depend on a stable managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so native Gemini handling still belongs inside the runtime service layer, not in plugin bootstrap or browser-host code.
- `plugins/mod.rs` remains host-plugin registration only, so Gemini native request-serving cannot move into plugin wiring.

## Standard

- New Gemini-native request handlers must live under `local_ai_proxy/gemini_native.rs`.
- New Gemini-native model-action parsing or supported-generation-method logic shared by Gemini native routes must live under `local_ai_proxy/gemini_native.rs`.
- `local_ai_proxy.rs` may register Gemini native handlers, but it should not re-accumulate Gemini-native protocol request logic once the boundary exists.
- Shared observability, streaming, and upstream helpers needed by Gemini native handlers should still come from their dedicated owners instead of being redefined inside the Gemini module.

## Impact

- Step 03 now has another smaller, clearer request-serving boundary inside the local proxy runtime.
- Future Gemini-native protocol changes can be reviewed independently from OpenAI-compatible routing, native Anthropic routing, startup lifecycle, route probing, streaming transport, and request/response translation.
- The desktop structure gate can now distinguish a real Gemini-native boundary split from an accidental handler shuffle.
