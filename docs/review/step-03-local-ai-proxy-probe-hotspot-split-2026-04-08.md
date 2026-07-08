## Highlights

- Step 03 continued on the next serial `CP03-2` blocker and split local proxy route probing plus protocol-specific upstream probe requests out of the desktop local proxy hotspot.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and proves the new boundary under the existing desktop gate.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed route-probe orchestration, probe capability classification, protocol-specific upstream probe requests, probe response success parsing, runtime lifecycle, and request-serving logic in the same runtime hotspot.
  - `LocalAiProxyService::test_route_by_id(...)` and `status().route_tests` depend on that probe behavior, but the probe stack is a control-plane verification concern rather than part of request translation or proxy startup itself.
  - `scripts/check-desktop-platform-foundation.mjs` did not yet assert this boundary, so protocol-specific probe HTTP logic could drift back into the main runtime file without tripping a Step 03 gate.
- Implemented the narrow repair:
  - added `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  - moved route probe orchestration, capability resolution, OpenAI-compatible / Anthropic / Gemini / Ollama upstream probe requests, and upstream probe success parsing into that module
  - changed `local_ai_proxy.rs` to call `probe::probe_route(&route)` from `LocalAiProxyService::test_route_by_id(...)`
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the desktop structure gate now requires:
    - the probe module file to exist
    - `mod probe;` in `local_ai_proxy.rs`
    - explicit `probe::probe_route(...)` delegation
- Actual workspace result:
  - the local proxy runtime now keeps route probing in a dedicated submodule owner while preserving the runtime-facing `LocalAiProxyService` API
  - the Step 03 desktop structure gate proves that the route-probe boundary exists before the larger desktop check passes
  - fresh targeted Rust tests plus `pnpm.cmd check:desktop` and `pnpm.cmd check:desktop-openclaw-runtime` evidence stayed green after the split

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the browser-host truth source still publishes the built-in OpenClaw instance as `runtimeKind: 'openclaw'`, `deploymentMode: 'local-managed'`, and `transportKind: 'openclawGatewayWs'`, so route-probe evidence remains part of the built-in managed runtime control-plane chain rather than an optional side surface.
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `runtimeKind === 'openclaw'` and `lifecycle.configWritable === true`, so provider-route probe evidence continues to feed a managed runtime that is expected to remain writable and diagnosable.
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still distinguishes the `local-managed` OpenClaw runtime, which keeps provider-route validation and route-test evidence in the same managed runtime envelope.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host still owns route-test persistence and service-level status reporting, but it now delegates probe behavior to a dedicated module.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only registers host plugins, so route-probe ownership must stay in the runtime service layer rather than drifting into plugin bootstrap or other host registration code.

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-probe local_ai_proxy_test_route_by_id_`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:desktop-openclaw-runtime`

## Remaining Gaps

- `CP03-2` is improved but not complete:
  - managed-provider projection is already in its own module
  - local proxy config loading and public-host resolution are already in their own module
  - route probing is now in its own module
  - the remaining request-serving / protocol-translation / observability hot paths inside `local_ai_proxy.rs` are still open
- `CP03-3` is still open on broader multi-mode startup smoke and true upgrade-execution evidence
- Step 03 overall therefore remains open

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if protocol-specific probe HTTP construction gets copied back into `local_ai_proxy.rs`.
- `LocalAiProxyService::test_route_by_id(...)` now deliberately depends on the `probe` submodule boundary; later internal refactors must preserve that delegation or update the gate deliberately.
- Rollback for this loop is limited to:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks
