## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the shared local-proxy observability and request-audit layer into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes the last previously identified `local_ai_proxy.rs` observability/audit helper hotspot and preserves fresh desktop-gate evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed request-serving with route metrics updates, request-log persistence, request-audit context construction, logged-message extraction, and request/response preview generation in the same runtime hotspot.
  - The same observability helper stack was shared by buffered passthrough responses, translated OpenAI responses, native Anthropic/Gemini passthrough paths, and translated streaming completion callbacks, but it still had no dedicated owner after the config, probe, upstream, streaming, request-translation, and response-translation splits.
  - `scripts/check-desktop-platform-foundation.mjs` did not yet freeze that observability boundary, so the helper stack could drift back into `local_ai_proxy.rs` without tripping a Step 03 gate.
- Implemented the narrow repair:
  - added `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  - moved shared route-outcome metrics recording, token-usage adjustment, request-log persistence, completed-stream request-log persistence, request-audit context construction, model/message extraction, text-fragment capture, request preview resolution, and response preview extraction into that module
  - changed `local_ai_proxy.rs` to declare `mod observability;` and explicitly delegate through:
    - `observability::extract_response_preview_from_value(...)`
    - `observability::build_request_audit_context(...)`
    - `observability::record_proxy_route_outcome(...)`
    - `observability::record_proxy_route_usage_adjustment(...)`
    - `observability::record_proxy_request_log(...)`
    - `observability::record_completed_stream_request_log(...)`
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires the observability module file, the module declaration, explicit `observability::...` delegations, and the removal of the old in-file helper definitions from `local_ai_proxy.rs`
  - removed the now-dead in-file observability/audit helper definitions from `local_ai_proxy.rs` after green verification, so the hotspot is materially smaller instead of duplicated
- Actual workspace result:
  - the local proxy runtime now keeps shared metrics, request-log shaping, message extraction, and preview generation under one dedicated owner while preserving the public `LocalAiProxyService` surface
  - translated and passthrough request paths now share one frozen observability boundary instead of re-accumulating audit helpers in the main runtime file
  - fresh structure, runtime, desktop, and OpenClaw runtime checks stayed green after the split and duplicate-helper removal

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the browser-host truth source still publishes the built-in OpenClaw instance as `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`, so local-proxy observability remains part of the managed built-in OpenClaw request path rather than an optional side surface.
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - the built-in projection tests still freeze the same `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`, so the managed runtime identity remains under test while this boundary moves.
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `runtimeKind === 'openclaw'` at line `1123` and `lifecycle.configWritable === true` at line `1125`, so audit/log visibility continues to belong to a writable managed runtime envelope.
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`, so the same managed control-plane contract still owns the local proxy.
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - agent installation still checks `detail.instance.runtimeKind !== 'openclaw' || !detail.lifecycle.configWritable` at line `48`, proving downstream managed feature flows still depend on the same writable OpenClaw runtime envelope.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host still owns runtime lifecycle, auth/header normalization, upstream dispatch, and handler orchestration, but it now delegates the shared observability/audit layer to a dedicated module.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation at lines `3-7`, so local-proxy observability must stay in the runtime service layer rather than drifting into plugin bootstrap.

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-observability local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is smaller again, but Step 03 still remains open on the remaining desktop runtime-serving consolidation outside this extracted observability slice.
- `CP03-3` is still open on broader multi-mode startup, upgrade, rollback, and smoke evidence beyond the hotspots already closed.
- `CP03-4` remains open until the desktop evidence surface and Kernel Center views converge under the same auditable runtime facts.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if request-audit helpers, preview extraction, or route metrics updates are copied back into `local_ai_proxy.rs`.
- Streaming completion paths now deliberately call the same observability owner used by buffered request logging; later refactors must preserve that shared owner instead of forking separate audit logic per handler family.
- Rollback is limited to:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks
