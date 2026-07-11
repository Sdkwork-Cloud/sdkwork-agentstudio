> Migrated from `docs/review/step-03-local-ai-proxy-streaming-hotspot-split-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the local proxy streaming-detection, passthrough, and OpenAI stream-translation helpers into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed request-serving with streaming request detection, passthrough streaming response construction, SSE/JSONL translation, and Anthropic/Gemini/Ollama stream-frame handling in the same runtime hotspot.
  - The same streaming helper layer was shared by native passthrough endpoints and multiple translated OpenAI-compatible paths, but it still had no dedicated owner after the upstream builder split.
  - `scripts/check-desktop-platform-foundation.mjs` did not yet freeze that streaming boundary, so the helper stack could drift back into `local_ai_proxy.rs` without tripping a Step 03 gate.
- Implemented the narrow repair:
  - added `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs`
  - moved stream request detection, OpenAI stream-endpoint resolution, passthrough streaming response construction, translated SSE/JSONL response builders, and Anthropic/Gemini/Ollama stream-frame handlers into that module
  - changed `local_ai_proxy.rs` to declare `mod streaming;` and explicitly delegate through:
    - `streaming::is_openai_stream_request(...)`
    - `streaming::openai_stream_endpoint_for_suffix(...)`
    - `streaming::build_passthrough_response(...)`
    - `streaming::build_translated_openai_sse_response(...)`
    - `streaming::build_translated_openai_jsonl_response(...)`
  - moved the `OpenAiStreamEndpoint` and `OpenAiTranslatedStreamState` ownership to the streaming module and updated the local unit tests to import those types from the new boundary
  - removed the now-dead streaming helper definitions from `local_ai_proxy.rs` after green verification, so the hotspot is actually smaller rather than duplicated
- Actual workspace result:
  - the local proxy runtime now keeps stream detection and translation logic under one dedicated owner while preserving the public `LocalAiProxyService` surface
  - Anthropic, Gemini, Ollama, and passthrough streaming paths now share one frozen streaming boundary instead of re-accumulating helper code in the main runtime file
  - fresh structure, runtime, desktop, and OpenClaw runtime checks stayed green after the split

## OpenClaw Fact Sources

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
  - the browser-host truth source still publishes the built-in OpenClaw instance as `runtimeKind: 'openclaw'`, `deploymentMode: 'local-managed'`, and `transportKind: 'openclawGatewayWs'`, so streaming translation in the local proxy remains part of the managed OpenClaw request chain rather than an optional side surface.
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `runtimeKind === 'openclaw'` and `lifecycle.configWritable === true`, so streaming request behavior continues to belong to a writable and diagnosable managed runtime envelope.
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off the `local-managed` deployment, so stream translation correctness remains part of the same managed runtime control plane.
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host still owns runtime lifecycle, request-serving orchestration, route-test persistence, and observability, but it now delegates the shared streaming layer to a dedicated module.
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration, so streaming request/response translation must stay in the runtime service layer rather than drifting into plugin bootstrap or host registration code.

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-streaming local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is improved but not complete:
  - managed-provider projection is already in its own module
  - local proxy config loading and public-host resolution are already in their own module
  - route probing is already in its own module
  - shared upstream request/url construction is already in its own module
  - shared streaming detection and translation is now in its own module
  - the remaining request-body/response translation and observability/audit hot paths inside `local_ai_proxy.rs` are still open
- `CP03-3` is still open on broader multi-mode startup smoke and true upgrade-execution evidence
- Step 03 overall therefore remains open

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if streaming helpers are reintroduced into `local_ai_proxy.rs` or duplicated across provider-specific handlers.
- `local_ai_proxy.rs` now deliberately depends on the `streaming` submodule for stream detection and response construction; later refactors must preserve that owner instead of rebuilding ad hoc streaming helpers.
- Rollback is limited to:
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks

