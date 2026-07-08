> Migrated from `docs/review/step-03-local-ai-proxy-gemini-native-hotspot-split-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the Gemini native protocol handlers from the main local proxy runtime file into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real request-serving hotspot and preserves fresh desktop-gate evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed generic runtime orchestration with Gemini-native route listing and model-action request handling for both `/v1beta/models` and `/v1/models/{model_action}`.
  - The Gemini native handler stack carried its own protocol-specific model-action parsing, supported-generation-method classification, upstream request dispatch, streaming passthrough, and request-log wiring, which made it a clean request-serving boundary instead of a generic helper shuffle.
  - `scripts/check-desktop-platform-foundation.mjs` did not yet freeze one dedicated owner for the Gemini native protocol path, so those handlers could drift back into `local_ai_proxy.rs` without any script-level failure.
- Implemented the narrow repair:
  - added `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  - moved the Gemini native `/v1beta/models`, `/v1beta/models/{model_action}`, and `/v1/models/{model_action}` handlers plus Gemini-specific model-action parsing and supported-generation-method resolution into that module
  - changed `local_ai_proxy.rs` to declare `mod gemini_native;` and explicitly delegate router registration through:
    - `get(gemini_native::models_handler_v1beta)`
    - `post(gemini_native::model_action_handler_v1beta)`
    - `post(gemini_native::model_action_handler_v1)`
  - kept the shared lifecycle, snapshot, auth, observability, upstream URL builder, and streaming owners in their already-frozen modules while the new Gemini owner consumed those boundaries instead of copying their logic
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires the Gemini native module file, the module declaration, router delegation through `gemini_native::...`, and the removal of the old in-file Gemini handler and parser definitions from `local_ai_proxy.rs`
  - removed the now-dead in-file Gemini native handler definitions from `local_ai_proxy.rs` after green verification, so the hotspot is materially smaller instead of duplicated
- Actual workspace result:
  - the local proxy runtime now keeps Gemini native request-serving under a dedicated owner while preserving the public `LocalAiProxyService` surface
  - the main runtime file now owns less protocol-specific HTTP handling and more clearly routes Gemini-native traffic into a dedicated module
  - fresh structure, runtime, desktop, and OpenClaw runtime checks stayed green after the split and duplicate-handler removal

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the built-in OpenClaw instance still publishes `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`, so the Gemini native protocol path remains part of the managed built-in OpenClaw runtime chain rather than an unrelated side endpoint.
  - the browser-host truth source still marks the built-in managed runtime as config-writable at line `1277`, preserving the writable managed-runtime envelope around the local proxy.
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - built-in projection tests still freeze the same `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`, so the managed runtime identity remains under test while this handler boundary moves.
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `runtimeKind === 'openclaw'` at line `1123` and `lifecycle.configWritable === true` at line `1125`, so Gemini-native routing still belongs to a writable managed runtime envelope.
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`, so the same managed control-plane contract still owns the local proxy.
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still short-circuits non-OpenClaw runtimes at line `13`, so Gemini-native route behavior continues to sit under the OpenClaw-specific workspace projection.
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - agent installation still checks `detail.instance.runtimeKind !== 'openclaw' || !detail.lifecycle.configWritable` at line `48`, proving downstream managed feature flows still depend on the same writable OpenClaw runtime envelope.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host still owns runtime lifecycle, auth/header normalization, upstream dispatch, and handler orchestration, but it now delegates the Gemini native protocol layer to a dedicated module.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation at lines `3-7`, so Gemini native request handling must stay in the runtime service layer rather than drifting into plugin bootstrap.

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-gemini-native local_ai_proxy_gemini_`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-gemini-native local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is smaller again, but Step 03 still remains open on the remaining desktop runtime-serving consolidation outside this Gemini native protocol slice.
- `CP03-3` is still open on broader multi-mode startup, upgrade, rollback, and smoke evidence beyond the hotspots already closed.
- `CP03-4` remains open until the desktop evidence surface and Kernel Center views converge under the same auditable runtime facts.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if Gemini native handler logic or model-action parsing is copied back into `local_ai_proxy.rs`.
- Gemini native request-serving now deliberately consumes shared observability, streaming, and upstream owners instead of duplicating them; later refactors must preserve those shared owners instead of creating protocol-local forks.
- Rollback is limited to:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks

