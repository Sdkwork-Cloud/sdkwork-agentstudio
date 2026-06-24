# 110-2026-04-08 Local AI Proxy Observability Module Boundary

## Decision

The desktop local AI proxy must keep shared observability and request-audit logic in a dedicated module:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  owns runtime lifecycle, request-serving orchestration, auth/header normalization, upstream dispatch, route selection, and the runtime-facing service methods
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  owns route metrics updates, token-usage adjustments, request-log persistence, completed-stream request-log persistence, request-audit context shaping, logged-message extraction, request preview resolution, and response preview extraction

`scripts/check-desktop-platform-foundation.mjs` must assert the module file, the `mod observability;` declaration, explicit `observability::...` delegation from the main local proxy runtime, and the removal of the old in-file observability helper definitions.

## Why

- Step 03 remains strongly serial on desktop runtime-boundary work, and `local_ai_proxy.rs` was still carrying one large mixed observability/audit hotspot after the earlier config, probe, upstream, streaming, request-translation, and response-translation splits.
- The same audit helper stack is shared across:
  - buffered passthrough OpenAI-compatible requests
  - translated OpenAI chat/responses/embeddings handlers for Anthropic, Gemini, and Ollama
  - native Anthropic and Gemini passthrough handlers
  - translated and passthrough streaming completion callbacks that need one consistent request-log write path
- Without a dedicated owner, request-log shaping and preview extraction drift back into the main runtime file, making future lifecycle or handler-boundary work harder to reason about.
- Built-in OpenClaw authority surfaces still depend on a stable managed runtime envelope identified as `openclaw`, `local-managed`, and `openclawGatewayWs`, so local proxy audit logic needs one reviewable owner inside the runtime service layer.
- `plugins/mod.rs` remains host-plugin registration only, so observability cannot move into plugin bootstrap or host wiring.

## Standard

- New route metrics and request-log shaping helpers must live under `local_ai_proxy/observability.rs`.
- New logged-message extraction or request/response preview helpers shared by more than one handler path must live under `local_ai_proxy/observability.rs`.
- Streaming completion callbacks must write request-log evidence through the shared observability module, not bespoke in-handler closures that duplicate insert logic.
- `local_ai_proxy.rs` may call the observability module, but it should not re-accumulate shared metrics, audit-context, or preview helper stacks once the boundary exists.

## Impact

- Step 03 now has another smaller, clearer module boundary inside the local proxy runtime.
- Future audit/logging changes can be reviewed independently from startup lifecycle, route probing, upstream URL building, streaming transport, request translation, and response translation.
- The desktop structure gate can now distinguish a real observability-boundary split from an accidental helper shuffle.
