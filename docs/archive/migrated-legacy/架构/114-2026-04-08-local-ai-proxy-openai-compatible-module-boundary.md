# 114-2026-04-08 Local AI Proxy OpenAI-Compatible Module Boundary

## Decision

The desktop local AI proxy must keep the OpenAI-compatible request-serving surface in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, shared router assembly, auth/header normalization, buffered upstream response handling, and the runtime-facing `LocalAiProxyService` methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
  owns:
  - `/v1/models`
  - `/v1/chat/completions`
  - `/v1/responses`
  - `/v1/embeddings`
  - OpenAI-compatible passthrough dispatch
  - translated Anthropic / Gemini / Ollama adapters for that surface
  - model-id resolution and token-usage extraction needed by that request-serving layer

The dedicated OpenAI-compatible module must continue to consume shared owners instead of duplicating them:

- `local_ai_proxy/request_translation.rs`
- `local_ai_proxy/response_translation.rs`
- `local_ai_proxy/streaming.rs`
- `local_ai_proxy/observability.rs`
- `local_ai_proxy/upstream.rs`

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod openai_compatible;` declaration, explicit route delegation through `openai_compatible::...`, removal of the old in-file handler/helper stack from `local_ai_proxy.rs`, and the relocated shared-helper usage inside `openai_compatible.rs`.

## Why

- Step 03 remains strongly serial on desktop runtime-boundary work, and `local_ai_proxy.rs` was still carrying one last large translated request-serving hotspot after the earlier config, projection, probe, upstream, streaming, request-translation, response-translation, observability, Gemini native, Anthropic native, and health/status splits.
- The OpenAI-compatible surface is a clean owner candidate because it bundles one coherent responsibility:
  - public OpenAI-compatible route registration
  - upstream passthrough routing
  - translated provider-specific Anthropic / Gemini / Ollama dispatch
  - model-id resolution for requests on that surface
  - token-usage extraction shared by translated OpenAI-compatible responses
- Without a dedicated owner, the main runtime file re-accumulates protocol translation, streaming completion wiring, upstream request construction, and provider-specific control flow that should stay outside the lifecycle/router assembly layer.
- Built-in OpenClaw authority surfaces still depend on a stable managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so the OpenAI-compatible proxy surface still belongs inside the runtime service layer rather than plugin bootstrap or browser-host code.
- `plugins/mod.rs` remains host-plugin registration only, so translated request handling cannot move into plugin wiring.

## Standard

- New OpenAI-compatible route handlers, translated provider adapters, model resolution, and token-usage extraction for the local proxy must live under `local_ai_proxy/openai_compatible.rs`.
- `local_ai_proxy.rs` may register the OpenAI-compatible routes and call `openai_compatible::extract_token_usage(...)`, but it should not re-accumulate the handler stack or its helper functions once the boundary exists.
- Shared request translation, response translation, streaming transport, observability writeback, and upstream request-building needed by the OpenAI-compatible surface must stay under their dedicated owners and be consumed from `openai_compatible.rs`.
- Sibling shared modules that need the OpenAI-compatible resolver or token-usage helper must import them from `openai_compatible.rs`, not from the parent runtime file.

## Impact

- Step 03 now has a dedicated owner for the translated OpenAI-compatible request surface inside the local proxy runtime.
- Future changes to `/v1/models`, `/v1/chat/completions`, `/v1/responses`, and `/v1/embeddings` can be reviewed independently from runtime lifecycle/startup logic, native Anthropic routing, native Gemini routing, health/status projection, and snapshot management.
- The desktop structure gate can now distinguish a real OpenAI-compatible boundary split from an accidental helper shuffle or a half-migration that leaves the main runtime file as a hidden second owner.
