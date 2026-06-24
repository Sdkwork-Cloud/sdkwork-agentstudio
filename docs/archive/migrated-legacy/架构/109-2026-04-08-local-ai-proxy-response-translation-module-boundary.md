# 109-2026-04-08 Local AI Proxy Response Translation Module Boundary

## Decision

The desktop local AI proxy must keep shared response-translation logic in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, request-serving orchestration, auth/header normalization, upstream dispatch, route-test persistence, observability, and the runtime-facing service methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/response_translation.rs`
  owns Anthropic/Gemini/Ollama response text extraction, stop-reason mapping, OpenAI chat-completion shaping, OpenAI responses-api shaping, embeddings response shaping, and the shared provider response helpers consumed by both buffered and streaming translation paths

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod response_translation;` declaration, and explicit `response_translation::...` delegation from the main local proxy runtime.

## Why

- Step 03 remains strongly serial on runtime-boundary work, and `local_ai_proxy.rs` is still one of the main remaining hotspots.
- The same response-translation helper stack is shared across:
  - Anthropic-to-OpenAI buffered chat and responses translation
  - Gemini-to-OpenAI buffered chat, responses, and embeddings translation
  - Ollama-to-OpenAI buffered chat, responses, and embeddings translation
  - streaming frame handling that still needs the same provider-specific text extraction and finish-reason mapping
- Without a dedicated owner, provider response parsing and OpenAI response shaping drift back into the main runtime file, making the remaining observability split harder to enforce.
- Built-in OpenClaw authority surfaces still depend on stable local proxy response shaping under the managed runtime envelope, so translated response bodies need one reviewable owner inside the runtime service layer.
- `plugins/mod.rs` remains host-plugin registration only, so response translation must stay in the runtime service boundary rather than moving into plugin bootstrap or host wiring.

## Standard

- New provider-specific response parsing helpers must live under `local_ai_proxy/response_translation.rs`.
- New buffered response builders shared by more than one handler path must live under `local_ai_proxy/response_translation.rs`.
- Shared response helpers needed by streaming translation should be imported from `response_translation.rs`, not duplicated in `streaming.rs` or reintroduced in `local_ai_proxy.rs`.
- `local_ai_proxy.rs` may call the response-translation module, but it should not re-accumulate shared response-normalization or response-builder stacks once the boundary exists.

## Impact

- Step 03 now has another smaller, clearer module boundary inside the local proxy runtime.
- Future response-shaping changes can be reviewed independently from startup lifecycle, route probing, upstream URL building, streaming transport, request translation, and observability.
- The desktop structure gate can now distinguish a real response-translation boundary split from an accidental helper shuffle.
