> Migrated from `docs/review/step-03-local-ai-proxy-observability-store-hotspot-split-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the local AI proxy shared observability-store state and lock layer into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate, local-proxy Rust-test, and desktop runtime evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed generic runtime lifecycle and router assembly with one remaining shared observability-store hotspot:
    - `LocalAiProxyObservabilityStore`
    - `LocalAiProxyRouteMetricsState`
    - `lock_observability(...)`
  - That store-and-lock cluster was already consumed across `local_ai_proxy.rs`, `health.rs`, and `observability.rs`, proving it was a coherent cross-module owner rather than parent-runtime glue.
  - After the earlier shared-support split, `scripts/check-desktop-platform-foundation.mjs` still did not freeze this observability-store boundary, so the parent runtime file remained a hidden second owner.
- Implemented the narrow repair:
  - added `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability_store.rs` as the dedicated owner for:
    - route metrics/test store state
    - route metrics runtime state
    - poisoned-lock handling for observability access
  - changed `local_ai_proxy.rs` to keep lifecycle, router assembly, `is_loopback_host(...)`, and `append_proxy_log(...)` while declaring `mod observability_store;`
  - repointed:
    - `local_ai_proxy.rs` to consume `observability_store::lock_observability(...)` and the extracted store type
    - `health.rs` to consume `observability_store::{lock_observability, LocalAiProxyObservabilityStore, LocalAiProxyRouteMetricsState}`
    - `observability.rs` to consume `observability_store::{LocalAiProxyObservabilityStore, LocalAiProxyRouteMetricsState}`
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires:
    - the `observability_store.rs` module file
    - the `mod observability_store;` declaration
    - explicit `observability_store::lock_observability(...)` usage in the runtime service
    - explicit observability-store type imports in `health.rs` and `observability.rs`
    - removal of the old in-file store struct and lock helper definitions from `local_ai_proxy.rs`
- Actual workspace result:
  - the local proxy runtime now keeps runtime lifecycle and router assembly in `local_ai_proxy.rs` while the shared observability-store owner lives under a dedicated module consumed by the runtime, health/status, and observability modules
  - `is_loopback_host(...)` and `append_proxy_log(...)` intentionally remain in the parent runtime file for now; this loop did not broaden the slice beyond the coherent store-and-lock owner
  - fresh verification kept the new observability-store boundary green across the desktop structure gate, focused local proxy Rust tests, OpenClaw runtime checks, and the full desktop check

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the built-in OpenClaw instance still publishes `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`, so the observability-store layer still belongs to the managed built-in OpenClaw runtime chain rather than an unrelated browser-only helper surface
  - the browser-host truth source still marks the built-in managed runtime as config-writable at line `1277`, preserving the writable managed-runtime envelope around local proxy routing and observability configuration
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - built-in projection tests still freeze the same `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`, so the managed runtime identity remains under test while this shared observability-store boundary moves
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `detail?.instance.runtimeKind === 'openclaw'` at line `1123` and `detail?.lifecycle.configWritable === true` at line `1125`, so the observability-store layer still belongs to a writable managed runtime envelope
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`, so the same managed control-plane contract still owns the local proxy surface that now consumes the new observability-store owner
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still short-circuits non-OpenClaw runtimes at line `13`, so the observability-store boundary remains inside the OpenClaw-specific runtime chain
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - agent installation still checks `detail.instance.runtimeKind !== 'openclaw' || !detail.lifecycle.configWritable` at line `48`, proving downstream managed feature flows still depend on the same writable OpenClaw runtime envelope
  - the instance filter at line `143` still narrows installation flows to `runtimeKind === 'openclaw'`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host now declares `mod observability_store;` at line `55`, uses `observability_store::lock_observability(...)` at lines `224`, `252`, and `489`, and intentionally retains only `is_loopback_host(...)` at line `561` and `append_proxy_log(...)` at line `569` from the older parent-only helper residue
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability_store.rs`
  - the new module now owns `LocalAiProxyObservabilityStore` at line `9`, `LocalAiProxyRouteMetricsState` at line `15`, and `lock_observability(...)` at line `32`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  - the health/status owner now consumes `observability_store::{lock_observability, LocalAiProxyObservabilityStore, LocalAiProxyRouteMetricsState}` at lines `3-4`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  - the shared observability owner now consumes `observability_store::{LocalAiProxyObservabilityStore, LocalAiProxyRouteMetricsState}` at line `2`
- `scripts/check-desktop-platform-foundation.mjs`
  - the Step 03 desktop structure gate now requires the observability-store module file at line `122`, the `mod observability_store;` declaration at line `265`, explicit store-owner usage at lines `415-425`, and removal of the obsolete in-file store and lock definitions from `local_ai_proxy.rs` at lines `435-445`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation in lines `1-8`, so observability store state and lock responsibilities must remain in the runtime service layer rather than drifting into plugin bootstrap

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo fmt --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-observability-store local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is smaller again, but Step 03 still remains open on the broader desktop runtime convergence work now that the protocol-specific owners, shared response/error owner, shared request-context owner, shared support owner, and shared observability-store owner are extracted.
- `CP03-3` is still open on multi-mode startup, upgrade, rollback, and smoke evidence beyond the hotspots already closed.
- `CP03-4` remains open until the desktop evidence surface and Kernel Center views converge under the same auditable runtime facts.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if shared observability store types or lock handling are copied back into `local_ai_proxy.rs` or duplicated independently across health and observability modules.
- `is_loopback_host(...)` and `append_proxy_log(...)` intentionally remain in the parent runtime file for now; later refactors should move them only if they can be closed as a separate coherent owner without re-entangling the new boundary.
- Rollback is limited to:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability_store.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks

