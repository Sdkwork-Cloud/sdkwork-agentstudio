## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the local proxy health/status projection layer into a dedicated Rust submodule.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and preserves fresh desktop-gate, runtime, and desktop-check evidence.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed generic runtime orchestration with `/health` request serving, runtime health snapshot shaping, route metrics projection, route test projection, default-route health projection, and observability-store reconciliation.
  - Those concerns form one coherent health/status owner because they all project runtime and observability state into auditable service health or status surfaces without owning provider-specific request translation.
  - `scripts/check-desktop-platform-foundation.mjs` did not yet freeze one dedicated owner for that health/status boundary, so those helpers could drift back into `local_ai_proxy.rs` without any script-level failure.
- Implemented the narrow repair:
  - added `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  - moved the `/health` and `/v1/health` handler, health snapshot builder, route metrics projection, route test collection, default-route health projection, route-health derivation, and observability-store reconciliation into that module
  - changed `local_ai_proxy.rs` to declare `mod health;` and explicitly delegate through:
    - `get(health::health_handler)`
    - `health::reconcile_observability_store(...)`
    - `health::build_health(...)`
    - `health::build_route_metrics(...)`
    - `health::collect_route_tests(...)`
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires:
    - the health module file
    - the `mod health;` declaration
    - explicit health-handler and health/status projection delegation
    - removal of the obsolete in-file health/status helper stack from `local_ai_proxy.rs`
- Actual workspace result:
  - the local proxy runtime now keeps health/status projection under a dedicated owner while preserving the public `LocalAiProxyService` surface
  - the new module preserves the existing `/health` response shape, default-route projection for `openai-compatible`, `anthropic`, and `gemini`, and the runtime status view built from the same observability store
  - fresh structure, runtime, desktop, and OpenClaw runtime checks stayed green after the split

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the built-in OpenClaw instance still publishes `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`, so the local proxy health/status surface remains part of the managed built-in OpenClaw runtime chain rather than an unrelated side endpoint
  - the browser-host truth source still marks the built-in managed runtime as config-writable at line `1277`, preserving the writable managed-runtime envelope around the health/status projection
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - built-in projection tests still freeze the same `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`, so the managed runtime identity remains under test while this projection boundary moves
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `runtimeKind === 'openclaw'` at line `1123` and `lifecycle.configWritable === true` at line `1125`, so the exposed local proxy health/status surface still belongs to a writable managed runtime envelope
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`, so the same managed control-plane contract still owns the local proxy runtime status surface
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still short-circuits non-OpenClaw runtimes at line `13`, so local proxy health/status projection continues to sit under the OpenClaw-specific workspace projection
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - agent installation still checks `detail.instance.runtimeKind !== 'openclaw' || !detail.lifecycle.configWritable` at line `48`, proving downstream managed feature flows still depend on the same writable OpenClaw runtime envelope
  - the instance filter at line `143` still narrows installation flows to `runtimeKind === 'openclaw'`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host still owns runtime lifecycle, auth/header normalization, upstream dispatch entrypoints, and router assembly, but it now delegates health/status projection to a dedicated module
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation in lines `1-7`, so health/status serving must stay in the runtime service layer rather than drifting into plugin bootstrap

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-health local_ai_proxy_`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-2` is smaller again, but Step 03 still remains open on the remaining local proxy request-serving hotspot consolidation work, most notably the OpenAI-compatible handler cluster.
- `CP03-3` is still open on broader multi-mode startup, upgrade, rollback, and smoke evidence beyond the hotspots already closed.
- `CP03-4` remains open until the desktop evidence surface and Kernel Center views converge under the same auditable runtime facts.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if health/status projection logic is copied back into `local_ai_proxy.rs`.
- Shared runtime owners for observability, snapshot/auth, and provider request handling must remain shared; later refactors should not fork status-only copies of those concerns.
- Rollback is limited to:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks
