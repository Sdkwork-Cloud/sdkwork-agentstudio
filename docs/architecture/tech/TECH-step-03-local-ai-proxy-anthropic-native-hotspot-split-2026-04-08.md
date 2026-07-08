> Migrated from `docs/review/step-03-local-ai-proxy-anthropic-native-hotspot-split-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the Anthropic native `/v1/messages` handler layer into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate, runtime, and desktop-check evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed generic runtime orchestration with the Anthropic native `/v1/messages` request path even after the earlier config, probe, upstream, streaming, request-translation, response-translation, observability, and Gemini native splits.
  - That Anthropic native path is a self-contained protocol boundary because it owns native request parsing, native header forwarding, upstream `/messages` dispatch, streaming passthrough, and shared observability writeback through the existing runtime owners.
  - `scripts/check-desktop-platform-foundation.mjs` did not yet freeze one dedicated owner for the Anthropic native route, so that handler could drift back into `local_ai_proxy.rs` without any script-level failure.
- Implemented the narrow repair:
  - added `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  - moved the native Anthropic `/v1/messages` request handler into that module
  - changed `local_ai_proxy.rs` to declare `mod anthropic_native;` and route `/v1/messages` through `post(anthropic_native::messages_handler)`
  - kept shared snapshot lookup, auth enforcement, route selection, request-body parsing, streaming passthrough, upstream buffering, and observability logging under their already-extracted owners, with the new Anthropic module consuming those boundaries instead of duplicating them
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires:
    - the Anthropic native module file
    - the `mod anthropic_native;` declaration
    - explicit router delegation through `post(anthropic_native::messages_handler)`
- Actual workspace result:
  - the local proxy runtime now keeps Anthropic native request-serving under a dedicated owner while preserving the public `LocalAiProxyService` surface
  - the new module preserves the default `anthropic-version` fallback, optional `anthropic-beta` passthrough, native `/messages` upstream dispatch, and streaming request-log completion through the shared observability owner
  - fresh structure, runtime, desktop, and OpenClaw runtime checks stayed green after the split

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the built-in OpenClaw instance still publishes `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`, so Anthropic native proxy serving remains part of the managed built-in OpenClaw runtime chain rather than an unrelated side endpoint
  - the browser-host truth source still marks the built-in managed runtime as config-writable at line `1277`, preserving the writable managed-runtime envelope around the local proxy
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - built-in projection tests still freeze the same `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`, so the managed runtime identity remains under test while this handler boundary moves
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `runtimeKind === 'openclaw'` at line `1123` and `lifecycle.configWritable === true` at line `1125`, so Anthropic-native routing still belongs to a writable managed runtime envelope
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`, so the same managed control-plane contract still owns the local proxy
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still short-circuits non-OpenClaw runtimes at line `13`, so Anthropic native route behavior continues to sit under the OpenClaw-specific workspace projection
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - agent installation still checks `detail.instance.runtimeKind !== 'openclaw' || !detail.lifecycle.configWritable` at line `48`, proving downstream managed feature flows still depend on the same writable OpenClaw runtime envelope
  - the instance filter at line `143` still narrows installation flows to `runtimeKind === 'openclaw'`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host still owns runtime lifecycle, auth/header normalization, upstream dispatch entrypoints, and router assembly, but it now delegates the Anthropic native protocol layer to a dedicated module
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation in lines `1-7`, so Anthropic native request handling must stay in the runtime service layer rather than drifting into plugin bootstrap

## Verification Focus

- `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-anthropic-native local_ai_proxy_anthropic_messages_endpoint_`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-anthropic-native local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is smaller again, but Step 03 still remains open on the remaining local proxy request-serving and health/status hotspot consolidation work.
- `CP03-3` is still open on broader multi-mode startup, upgrade, rollback, and smoke evidence beyond the hotspots already closed.
- `CP03-4` remains open until the desktop evidence surface and Kernel Center views converge under the same auditable runtime facts.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if Anthropic native handler logic is copied back into `local_ai_proxy.rs`.
- Shared runtime owners for observability, streaming, upstream buffering, and snapshot/auth enforcement must remain shared; later refactors should not fork Anthropic-only copies.
- Rollback is limited to:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks

