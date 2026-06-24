# 108-2026-04-08 Local AI Proxy Request Translation Module Boundary

## Decision

The desktop local AI proxy must keep shared request-body translation logic in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, request-serving orchestration, auth/header normalization, upstream dispatch, response translation, route-test persistence, observability, and the runtime-facing service methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs`
  owns OpenAI request text extraction, chat/response conversation normalization, max-token normalization, and Anthropic/Gemini/Ollama request-payload builders for translated chat, responses, and embeddings paths

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod request_translation;` declaration, and explicit `request_translation::...` delegation from the main local proxy runtime.

## Why

- Step 03 remains strongly serial on runtime-boundary work, and `local_ai_proxy.rs` is still one of the main remaining hotspots.
- The same request-translation helper stack is shared across:
  - OpenAI chat completions to Anthropic/Gemini/Ollama translation
  - OpenAI responses to Anthropic/Gemini/Ollama translation
  - OpenAI embeddings to Gemini/Ollama translation
- Without a dedicated owner, text extraction, conversation shaping, and provider-specific payload assembly drift back into the main runtime file, making future response-translation and observability splits harder to enforce.
- Built-in OpenClaw authority surfaces still depend on stable local proxy request shaping under the managed runtime envelope, so translated request bodies need one reviewable owner inside the runtime service layer.
- `plugins/mod.rs` remains host-plugin registration only, so request translation must stay in the runtime service boundary rather than moving into plugin bootstrap or host wiring.

## Standard

- New OpenAI request normalization helpers must live under `local_ai_proxy/request_translation.rs`.
- New provider-specific request builders shared by more than one handler path must live under `local_ai_proxy/request_translation.rs`.
- `local_ai_proxy.rs` may call the request-translation module, but it should not re-accumulate shared request-normalization or request-builder stacks once the boundary exists.

## Impact

- Step 03 now has another smaller, clearer module boundary inside the local proxy runtime.
- Future request-shaping changes can be reviewed independently from startup lifecycle, route probing, upstream URL building, streaming translation, and observability.
- The desktop structure gate can now distinguish a real request-translation boundary split from an accidental helper shuffle.
