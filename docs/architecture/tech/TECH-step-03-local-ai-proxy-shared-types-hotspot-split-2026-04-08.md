> Migrated from `docs/review/step-03-local-ai-proxy-shared-types-hotspot-split-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the local AI proxy shared type contract layer into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate, local-proxy Rust-test, and desktop runtime evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed generic runtime lifecycle and router assembly with one remaining shared type-contract hotspot:
    - `ProxyHttpResult<T>`
    - `LocalAiProxyLifecycle`
    - `LocalAiProxyDefaultRouteHealth`
    - `LocalAiProxyServiceHealth`
    - `LocalAiProxyServiceStatus`
    - `LocalAiProxyRouteRuntimeMetrics`
    - `LocalAiProxyRouteTestRecord`
    - `LocalAiProxyTokenUsage`
    - `LocalAiProxyAppState`
  - That type cluster was already consumed across `request_context.rs`, `response_io.rs`, `observability.rs`, `openai_compatible.rs`, `anthropic_native.rs`, `gemini_native.rs`, `streaming.rs`, `probe.rs`, `health.rs`, `projection.rs`, and `observability_store.rs`, proving it was a coherent cross-module owner rather than parent-runtime glue.
  - After the earlier observability-store split, `scripts/check-desktop-platform-foundation.mjs` still did not freeze this shared type boundary, so the parent runtime file remained a hidden second owner.
- Implemented the narrow repair:
  - added `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/types.rs` as the dedicated owner for:
    - shared proxy HTTP result typing
    - public lifecycle, health, status, metrics, and route-test contracts
    - internal shared token-usage and app-state contracts
  - changed `local_ai_proxy.rs` to keep lifecycle/service ownership, router assembly, `is_loopback_host(...)`, and `append_proxy_log(...)` while declaring `mod types;`
  - repointed:
    - `request_context.rs`, `response_io.rs`, `observability.rs`, `openai_compatible.rs`, `anthropic_native.rs`, and `gemini_native.rs` to consume `types::{...}`
    - `streaming.rs` to consume `types::LocalAiProxyTokenUsage`
    - `probe.rs` and `observability_store.rs` to consume `types::LocalAiProxyRouteTestRecord`
    - `projection.rs` to consume `types::LocalAiProxyServiceHealth`
    - `health.rs` to consume the shared lifecycle/health/status/metrics/test contracts through `types::{...}`
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires:
    - the `types.rs` module file
    - the `mod types;` declaration
    - explicit `types::...` ownership imports/usages in all representative consumers
    - removal of the old in-file type alias, public contracts, internal token-usage struct, and app-state struct from `local_ai_proxy.rs`
  - ran `cargo fmt` after the split and kept the structure gate green
- Actual workspace result:
  - the local proxy runtime now keeps runtime lifecycle and router assembly in `local_ai_proxy.rs` while the shared type-contract owner lives under a dedicated module consumed by request-context, response-io, observability, protocol-serving, streaming, health/status, projection, probe, and observability-store modules
  - `is_loopback_host(...)` and `append_proxy_log(...)` intentionally remain in the parent runtime file for now; this loop did not broaden the slice beyond the coherent shared type owner
  - fresh verification kept the new type boundary green across the desktop structure gate, focused local proxy Rust tests, OpenClaw runtime checks, and the full desktop check

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the built-in OpenClaw instance still publishes `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`, so the shared type layer still belongs to the managed built-in OpenClaw runtime chain rather than an unrelated browser-only helper surface
  - the browser-host truth source still marks the built-in managed runtime as config-writable at line `1277`, preserving the writable managed-runtime envelope around local proxy routing and observability configuration
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - built-in projection tests still freeze the same `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`, so the managed runtime identity remains under test while this shared type boundary moves
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `detail?.instance.runtimeKind === 'openclaw'` at line `1123` and `detail?.lifecycle.configWritable === true` at line `1125`, so the shared local proxy contracts still belong to a writable managed runtime envelope
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`, so the same managed control-plane contract still owns the local proxy surface that now consumes the new shared type owner
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still short-circuits non-OpenClaw runtimes at line `11`, so the shared type boundary remains inside the OpenClaw-specific runtime chain
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - the instance filter at line `143` still narrows installation flows to `runtimeKind === 'openclaw'`, proving downstream managed feature flows still depend on the same writable OpenClaw runtime envelope
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host now declares `mod types;` at line `61`, imports the runtime-side shared contracts from `types::{LocalAiProxyAppState, ProxyHttpResult}` at line `64`, re-exports the public shared contracts at line `67`, and intentionally retains only `is_loopback_host(...)` at line `478` and `append_proxy_log(...)` at line `486` from the older parent-only helper residue
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/types.rs`
  - the new module now owns `ProxyHttpResult<T>` at line `13`, `LocalAiProxyLifecycle` at line `16`, `LocalAiProxyDefaultRouteHealth` at line `23`, `LocalAiProxyServiceHealth` at line `34`, `LocalAiProxyServiceStatus` at line `48`, `LocalAiProxyRouteRuntimeMetrics` at line `57`, `LocalAiProxyRouteTestRecord` at line `77`, `LocalAiProxyTokenUsage` at line `88`, and `LocalAiProxyAppState` at line `96`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs`
  - the request-context owner now consumes `types::{LocalAiProxyAppState, ProxyHttpResult}` at line `3`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs`
  - the response/error owner now consumes `types::{LocalAiProxyTokenUsage, ProxyHttpResult}` at line `4`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  - the shared observability owner now consumes `types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult}` at line `5`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
  - the OpenAI-compatible owner now consumes `types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult}` at line `9`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  - the Anthropic-native owner now consumes `types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult}` at line `6`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  - the Gemini-native owner now consumes `types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult}` at line `6`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs`
  - the streaming owner now consumes `types::LocalAiProxyTokenUsage` at line `8`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  - the probe owner now consumes `types::LocalAiProxyRouteTestRecord` at line `4`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability_store.rs`
  - the observability-store owner now consumes `types::LocalAiProxyRouteTestRecord` at line `1`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  - the health/status owner now consumes `types::{...}` at line `8`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs`
  - the managed OpenClaw projection owner now consumes `types::LocalAiProxyServiceHealth` at line `2`
- `scripts/check-desktop-platform-foundation.mjs`
  - the Step 03 desktop structure gate now requires the shared types module file at line `125`, the `mod types;` declaration at line `282`, representative `types::...` ownership usage at lines `507-647`, and removal of the obsolete in-file shared type definitions from `local_ai_proxy.rs` at lines `457-497`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation at lines `3-7`, so shared local proxy contracts must remain in the runtime service layer rather than drifting into plugin bootstrap

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo fmt --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-types local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is smaller again, but Step 03 still remains open on the broader desktop runtime convergence work now that the protocol-specific owners, shared response/error owner, shared request-context owner, shared support owner, shared observability-store owner, and shared types owner are extracted.
- `CP03-3` is still open on multi-mode startup, upgrade, rollback, and smoke evidence beyond the hotspots already closed.
- `CP03-4` remains open until the desktop evidence surface and Kernel Center views converge under the same auditable runtime facts.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if shared local proxy contracts are copied back into `local_ai_proxy.rs` or duplicated independently across protocol, health, projection, and observability owners.
- The public lifecycle/health/status contracts remain intentionally re-exported from `local_ai_proxy.rs` so external call sites do not change while ownership moves under `types.rs`.
- `is_loopback_host(...)` and `append_proxy_log(...)` intentionally remain in the parent runtime file for now; later refactors should move them only if they can be closed as a separate coherent owner without re-entangling the new boundary.
- Rollback is limited to:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/types.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability_store.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks

