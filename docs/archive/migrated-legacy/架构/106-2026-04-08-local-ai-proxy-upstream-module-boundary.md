# 106-2026-04-08 Local AI Proxy Upstream Module Boundary

## Decision

The desktop local AI proxy must keep shared upstream request and URL construction in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, request serving, streaming translation, route-test persistence, observability, and the runtime-facing service methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  owns route-probe orchestration and delegates shared upstream request/url shaping to the upstream module
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/upstream.rs`
  owns shared OpenAI-compatible upstream request construction plus Gemini and Ollama upstream URL shaping

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod upstream;` declaration, and explicit `upstream::...` delegation from both the main runtime hotspot and the probe module.

## Why

- Step 03 remains strongly serial on runtime-boundary work, and `local_ai_proxy.rs` is still one of the main remaining hotspots.
- The upstream builder layer already had multiple runtime consumers:
  - the main request-serving path
  - the extracted route-probe path
- Without a dedicated owner, protocol-specific request/url shaping can drift into duplicate helper stacks, making later request-translation and streaming splits harder to enforce.
- Built-in OpenClaw authority surfaces still depend on stable managed local-proxy behavior, so provider-facing upstream request construction needs one reviewable owner inside the runtime service layer.
- `plugins/mod.rs` remains host-plugin registration only, so upstream request shaping must stay in the runtime service boundary rather than moving into plugin bootstrap or unrelated host code.

## Standard

- New shared OpenAI-compatible upstream request shaping must live under `local_ai_proxy/upstream.rs`.
- Gemini and Ollama upstream URL builders used by more than one local-proxy concern must also live under `local_ai_proxy/upstream.rs`.
- `local_ai_proxy.rs` and `probe.rs` may call the upstream module, but they should not re-accumulate duplicated provider-specific request/url builder helpers once the shared boundary exists.

## Impact

- Step 03 now has another smaller, clearer module boundary inside the local proxy runtime.
- Future provider-specific request-shaping changes can be reviewed independently from route probing, request-serving translation, and runtime lifecycle work.
- The desktop structure gate can now distinguish a real shared-upstream boundary split from an accidental helper shuffle.
