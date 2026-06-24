> Migrated from `docs/review/step-03-local-ai-proxy-response-translation-hotspot-split-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the local proxy response-translation layer into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed request-serving with Anthropic/Gemini/Ollama response text extraction, stop-reason mapping, OpenAI chat-completion shaping, OpenAI responses-api shaping, and embeddings response shaping in the same runtime hotspot.
  - The same response-translation helper layer was shared by buffered translated responses and the streaming translation module, but it still had no dedicated owner after the request-translation and streaming splits.
  - `scripts/check-desktop-platform-foundation.mjs` did not yet freeze that response-translation boundary, so the helper stack could drift back into `local_ai_proxy.rs` without tripping a Step 03 gate.
- Implemented the narrow repair:
  - added `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/response_translation.rs`
  - moved shared Anthropic/Gemini/Ollama response text extraction, stop-reason mapping, chat-completion translation, responses-api translation, embeddings translation, and Ollama tool-call extraction into that module
  - changed `local_ai_proxy.rs` to declare `mod response_translation;` and explicitly delegate through:
    - `response_translation::build_openai_chat_completion_from_anthropic(...)`
    - `response_translation::build_openai_chat_completion_from_gemini(...)`
    - `response_translation::build_openai_chat_completion_from_ollama(...)`
    - `response_translation::build_openai_response_from_anthropic(...)`
    - `response_translation::build_openai_response_from_gemini(...)`
    - `response_translation::build_openai_response_from_ollama(...)`
    - `response_translation::build_openai_embeddings_from_gemini(...)`
    - `response_translation::build_openai_embeddings_from_ollama(...)`
  - updated `streaming.rs` to consume the shared response text and stop-reason helpers from the new response-translation boundary instead of reaching back into `local_ai_proxy.rs`
  - removed the now-dead in-file response-translation helper definitions from `local_ai_proxy.rs` after green verification, so the hotspot is materially smaller instead of duplicated
- Actual workspace result:
  - the local proxy runtime now keeps buffered and streaming response shaping under one dedicated owner while preserving the public `LocalAiProxyService` surface
  - Anthropic, Gemini, and Ollama translated response paths now share one frozen response-translation boundary instead of re-accumulating helper code in the main runtime file
  - fresh structure, runtime, desktop, and OpenClaw runtime checks stayed green after the split, duplicate-helper removal, and the streaming cross-module import fix

## OpenClaw Fact Sources

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
  - the browser-host truth source still publishes the built-in OpenClaw instance as `runtimeKind: 'openclaw'`, `deploymentMode: 'local-managed'`, and `transportKind: 'openclawGatewayWs'`, so response translation in the local proxy remains part of the managed OpenClaw request chain rather than an optional side surface.
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `runtimeKind === 'openclaw'` and `lifecycle.configWritable === true`, so translated response behavior continues to belong to a writable and diagnosable managed runtime envelope.
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off the `local-managed` deployment, so response-translation correctness remains part of the same managed runtime control plane.
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host still owns runtime lifecycle, request-serving orchestration, route-test persistence, and observability, but it now delegates the shared response-translation layer to a dedicated module.
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration, so response translation must stay in the runtime service layer rather than drifting into plugin bootstrap or host registration code.

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-response-translation local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is improved but not complete:
  - managed-provider projection is already in its own module
  - local proxy config loading and public-host resolution are already in their own module
  - route probing is already in its own module
  - shared upstream request/url construction is already in its own module
  - shared streaming detection and translation is already in its own module
  - shared request translation is already in its own module
  - shared response translation is now in its own module
  - the remaining observability/audit hot paths inside `local_ai_proxy.rs` are still open
- `CP03-3` is still open on broader multi-mode startup smoke and true upgrade-execution evidence
- Step 03 overall therefore remains open

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if response-normalization or provider response-builder helpers are reintroduced into `local_ai_proxy.rs` or duplicated across buffered and streaming translation paths.
- `streaming.rs` now deliberately consumes a small shared helper surface from `response_translation.rs`; later refactors must preserve that owner instead of moving text extraction and stop-reason mapping back into the main runtime file.
- Rollback is limited to:
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/response_translation.rs`
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks

