# 107-2026-04-08 Local AI Proxy Streaming Module Boundary

## Decision

The desktop local AI proxy must keep shared streaming detection and translation logic in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, request-serving orchestration, non-stream request translation, route-test persistence, observability, and the runtime-facing service methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs`
  owns stream request detection, OpenAI stream-endpoint resolution, passthrough streaming response construction, translated SSE/JSONL response builders, and Anthropic/Gemini/Ollama stream-frame translation

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod streaming;` declaration, and explicit `streaming::...` delegation from the main local proxy runtime.

## Why

- Step 03 remains strongly serial on runtime-boundary work, and `local_ai_proxy.rs` is still one of the main remaining hotspots.
- The same streaming helper stack is shared across:
  - OpenAI-compatible passthrough streaming
  - Anthropic-to-OpenAI streaming translation
  - Gemini-to-OpenAI streaming translation
  - Ollama-to-OpenAI streaming translation
- Without a dedicated owner, stream detection and response translation drift back into the main runtime file, making future request-translation and observability splits harder to enforce.
- Built-in OpenClaw authority surfaces still depend on stable local proxy behavior under the managed runtime envelope, so stream response shaping needs one reviewable owner inside the runtime service layer.
- `plugins/mod.rs` remains host-plugin registration only, so streaming behavior must stay in the runtime service boundary rather than moving into plugin bootstrap or host wiring.

## Standard

- New stream request detection or OpenAI stream-endpoint resolution helpers must live under `local_ai_proxy/streaming.rs`.
- New passthrough or translated SSE/JSONL response builders must live under `local_ai_proxy/streaming.rs`.
- Provider-specific stream-frame handlers shared by more than one handler path must also live under `local_ai_proxy/streaming.rs`.
- `local_ai_proxy.rs` may call the streaming module, but it should not re-accumulate shared stream helper stacks once the boundary exists.

## Impact

- Step 03 now has another smaller, clearer module boundary inside the local proxy runtime.
- Future streaming changes can be reviewed independently from startup lifecycle, route probing, and non-stream request translation.
- The desktop structure gate can now distinguish a real streaming-boundary split from an accidental helper shuffle.
