> Migrated from `docs/review/step-03-local-ai-proxy-openai-compatible-hotspot-split-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the OpenAI-compatible `/v1/models`, `/v1/chat/completions`, `/v1/responses`, and `/v1/embeddings` request-serving layer into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate, runtime, and desktop-check evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed generic runtime orchestration with the whole OpenAI-compatible serving stack even after the earlier config, projection, probe, upstream, streaming, request-translation, response-translation, observability, Gemini native, Anthropic native, and health/status splits.
  - That OpenAI-compatible stack is one coherent owner because it owns the public `/v1/models`, `/v1/chat/completions`, `/v1/responses`, and `/v1/embeddings` surface, passthrough request serving, provider-specific Anthropic/Gemini/Ollama adapters, model-id resolution, and token-usage extraction while consuming already-extracted shared helpers from the request-translation, response-translation, streaming, observability, and upstream boundaries.
  - `scripts/check-desktop-platform-foundation.mjs` had already been tightened to require route delegation and old-helper removal, but it was still asserting many OpenAI-compatible dependency usages inside `local_ai_proxy.rs`, so the real module split stayed red even after the handler stack moved.
- Implemented the narrow repair:
  - kept `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs` as the dedicated owner for:
    - `/v1/models`
    - `/v1/chat/completions`
    - `/v1/responses`
    - `/v1/embeddings`
    - OpenAI-compatible passthrough serving
    - Anthropic / Gemini / Ollama translated adapter dispatch
    - model-id resolution and token-usage extraction for that surface
  - changed `local_ai_proxy.rs` to keep router assembly and buffered-response orchestration while delegating through:
    - `get(openai_compatible::models_handler)`
    - `post(openai_compatible::chat_completions_handler)`
    - `post(openai_compatible::openai_responses_handler)`
    - `post(openai_compatible::openai_embeddings_handler)`
    - `openai_compatible::extract_token_usage(...)`
  - removed the obsolete in-file OpenAI-compatible handler/helper stack from `local_ai_proxy.rs`
  - repointed `request_translation.rs`, `response_translation.rs`, and `streaming.rs` so the remaining shared modules now consume `resolve_request_model_id(...)` and `extract_token_usage(...)` from `openai_compatible.rs` instead of the parent runtime file
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires:
    - the OpenAI-compatible module file
    - the `mod openai_compatible;` declaration
    - explicit route delegation through `openai_compatible::...`
    - removal of the obsolete in-file OpenAI-compatible handler/helper stack from `local_ai_proxy.rs`
    - shared upstream, streaming, request-translation, response-translation, and observability usage to live under `openai_compatible.rs` instead of drifting back into the main runtime file
- Actual workspace result:
  - the local proxy runtime now keeps lifecycle, shared router assembly, and buffered upstream response handling in `local_ai_proxy.rs` while the OpenAI-compatible request-serving surface lives under a dedicated owner
  - the new module preserves provider-specific translated request serving for Anthropic, Gemini, and Ollama without duplicating the already-extracted shared helper layers
  - the first Rust verification pass exposed one real residual boundary bug, namely sibling modules still importing resolver/token-usage helpers from the deleted parent location; after repointing those imports to `openai_compatible.rs`, the structure gate, Rust tests, OpenClaw runtime checks, and desktop checks all returned to green

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the built-in OpenClaw instance still publishes `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`, so the OpenAI-compatible local proxy surface remains part of the managed built-in OpenClaw runtime chain rather than an unrelated browser-only endpoint
  - the browser-host truth source still marks the built-in managed runtime as config-writable at line `1277`, preserving the writable managed-runtime envelope around local proxy configuration and provider routing
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - built-in projection tests still freeze the same `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`, so the managed runtime identity remains under test while this request-serving boundary moves
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `detail?.instance.runtimeKind === 'openclaw'` at line `1123` and `detail?.lifecycle.configWritable === true` at line `1125`, so the OpenAI-compatible proxy surface still belongs to a writable managed runtime envelope
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`, so the same managed control-plane contract still owns the local proxy request surface
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still short-circuits non-OpenClaw runtimes at line `13`, so OpenAI-compatible route behavior continues to sit under the OpenClaw-specific workspace projection
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - agent installation still checks `detail.instance.runtimeKind !== 'openclaw' || !detail.lifecycle.configWritable` at line `48`, proving downstream managed feature flows still depend on the same writable OpenClaw runtime envelope
  - the instance filter at line `143` still narrows installation flows to `runtimeKind === 'openclaw'`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host now declares `mod openai_compatible;` at line `61`, routes `/v1/models`, `/v1/chat/completions`, `/v1/responses`, and `/v1/embeddings` through `openai_compatible::...` at lines `696-707`, and uses `openai_compatible::extract_token_usage(...)` in buffered upstream response handling at line `608`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation in lines `1-8`, so OpenAI-compatible request handling must stay in the runtime service layer rather than drifting into plugin bootstrap

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-openai-compatible local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is smaller again, but Step 03 still remains open on the broader desktop runtime convergence work now that the major protocol-specific and OpenAI-compatible request-serving hotspots have been extracted.
- `CP03-3` is still open on multi-mode startup, upgrade, rollback, and smoke evidence beyond the hotspots already closed.
- `CP03-4` remains open until the desktop evidence surface and Kernel Center views converge under the same auditable runtime facts.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if OpenAI-compatible request-serving or helper ownership is copied back into `local_ai_proxy.rs`.
- Shared runtime owners for request translation, response translation, streaming, observability, and upstream request building must remain shared; later refactors should not fork OpenAI-compatible-only copies of those concerns outside the dedicated module boundary.
- Rollback is limited to:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/response_translation.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks

