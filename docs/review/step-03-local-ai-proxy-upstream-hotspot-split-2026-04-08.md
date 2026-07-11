## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted shared upstream request and URL construction into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real local-proxy runtime boundary and preserves fresh desktop-gate evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed request-serving, protocol translation, observability, route probing, and the shared upstream request/url builder layer in the same runtime hotspot.
  - Both the main request-serving handlers and the already-extracted `probe.rs` needed the same OpenAI-compatible, Gemini, and Ollama upstream request/url construction helpers, so that logic still had two consumers but no dedicated owner.
  - `scripts/check-desktop-platform-foundation.mjs` did not yet freeze that shared upstream-builder boundary, so future edits could easily drift the helper stack back into `local_ai_proxy.rs` without tripping a Step 03 gate.
- Implemented the narrow repair:
  - added `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/upstream.rs`
  - moved the shared OpenAI-compatible upstream request builder plus Gemini and Ollama upstream URL builders into that module
  - changed `local_ai_proxy.rs` to declare `mod upstream;` and explicitly delegate through:
    - `upstream::build_openai_compatible_upstream_request(...)`
    - `upstream::build_gemini_upstream_request_url(...)`
    - `upstream::build_ollama_upstream_request_url(...)`
  - changed `probe.rs` to consume the same `upstream` submodule instead of importing those helpers from `super`
  - tightened the desktop foundation gate so the upstream module file, declaration, and explicit delegations are now required
- Actual workspace result:
  - the local proxy runtime now keeps shared upstream request/url construction under a dedicated owner while preserving the public `LocalAiProxyService` surface
  - `probe.rs` and the main request-serving path now share one builder boundary instead of re-accumulating protocol-specific request construction in multiple places
  - fresh structure, runtime, and desktop checks stayed green after the split

## OpenClaw Fact Sources

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
  - the browser-host truth source still publishes the built-in OpenClaw instance as `runtimeKind: 'openclaw'`, `deploymentMode: 'local-managed'`, and `transportKind: 'openclawGatewayWs'`, so the local proxy upstream-builder layer still sits on the managed OpenClaw request path rather than an optional side surface.
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `runtimeKind === 'openclaw'` and `lifecycle.configWritable === true`, so provider-facing proxy requests remain part of a writable and diagnosable managed runtime chain.
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off the `local-managed` OpenClaw deployment, so request-shaping correctness inside the local proxy remains part of the same managed runtime envelope.
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host still owns runtime lifecycle, request serving, route-test persistence, and observability, but it now delegates shared upstream request/url construction to a dedicated module.
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration, so upstream request construction must stay inside the runtime service layer rather than drifting into plugin bootstrap or host registration code.

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-upstream local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is improved but not complete:
  - managed-provider projection is already in its own module
  - local proxy config loading and public-host resolution are already in their own module
  - route probing is already in its own module
  - shared upstream request/url construction is now in its own module
  - the remaining request-serving translation, streaming translation, and observability hot paths inside `local_ai_proxy.rs` are still open
- `CP03-3` is still open on broader multi-mode startup smoke and true upgrade-execution evidence
- Step 03 overall therefore remains open

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if provider-specific upstream request shaping gets copied back into `local_ai_proxy.rs` or duplicated across modules.
- `probe.rs` now deliberately depends on the `upstream` submodule boundary; later refactors must preserve that shared owner instead of reintroducing ad hoc per-consumer request builders.
- Rollback is limited to:
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/upstream.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks
