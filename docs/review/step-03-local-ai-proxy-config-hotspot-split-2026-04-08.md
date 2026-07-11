## Highlights

- Step 03 continued on the next serial `CP03-2` blocker and split local proxy config loading plus public-host normalization out of the desktop local proxy hotspot.
- This loop keeps Step 03 open overall, but it closes another real runtime-boundary slice and proves the new boundary under the existing desktop gate.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed control-plane config loading, public-host normalization, loopback-safety resolution, proxy lifecycle, and request-serving logic in the same runtime hotspot.
  - the config-file helper stack is required before startup can bind the loopback proxy, but it is not part of the request-serving or projection lifecycle itself, so it was the next clean serial split point after the projection module extraction.
  - `scripts/check-desktop-platform-foundation.mjs` did not yet assert this boundary, so the config helper stack could drift back into the main runtime file without tripping a Step 03 gate.
- Implemented the narrow repair:
  - added `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/config.rs`
  - moved the local proxy config schema, config-file loading, public host normalization, loopback-safe host selection, and resolver helpers into that module
  - changed `local_ai_proxy.rs` to call `config::ensure_local_ai_proxy_config(...)`
  - changed the desktop bootstrap test import to consume `local_ai_proxy::config::default_local_ai_proxy_public_host`
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the desktop structure gate now requires:
    - the config module file to exist
    - `mod config;` in `local_ai_proxy.rs`
    - explicit `config::ensure_local_ai_proxy_config(...)` delegation
- Actual workspace result:
  - the local proxy runtime now keeps config-file parsing and public-host selection in a dedicated submodule owner
  - the Step 03 desktop structure gate proves that the boundary exists before the larger desktop check passes
  - fresh targeted Rust tests plus `pnpm.cmd check:desktop` and `pnpm.cmd check:desktop-openclaw-runtime` evidence stayed green after the split

## OpenClaw Fact Sources

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
  - the browser-host truth source still publishes the built-in OpenClaw instance as `runtimeKind: 'openclaw'`, `deploymentMode: 'local-managed'`, and ties it to the shared `openclaw.json` identity, so proxy public-host drift would leak directly into built-in authority surfaces.
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still depends on `runtimeKind === 'openclaw'` and `lifecycle.configWritable === true`, which keeps the local proxy config path in the same managed control-plane chain.
- `packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.ts`
  - agent installation still requires a writable OpenClaw config lifecycle before mutating workspace state, so local proxy config ownership remains part of the managed runtime baseline.
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off the built-in `local-managed` OpenClaw runtime, so proxy config and public-host semantics remain part of that same runtime contract.
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host still owns loopback proxy lifecycle and request-serving logic, but it now delegates config loading to a dedicated module.
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only registers host plugins, so local proxy config ownership must remain inside the runtime service boundary rather than hiding in plugin bootstrap.

## Verification Focus

- RED: `node scripts/check-desktop-platform-foundation.mjs`
- GREEN: `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-config local_ai_proxy_default_public_host_`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032-config project_managed_openclaw_provider`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:desktop-openclaw-runtime`

## Remaining Gaps

- `CP03-2` is improved but not complete:
  - managed-provider projection is already in its own module
  - local proxy config loading and public-host resolution are now in their own module
  - the rest of `local_ai_proxy.rs` plus the wider `studio.rs` hotspot are still open
- `CP03-3` is still open on broader multi-mode startup smoke and true upgrade-execution evidence
- Step 03 overall therefore remains open

## Risks And Rollback

- The split is intended to be behavior-preserving; the main risk is future drift if config parsing or public-host resolution gets copied back into `local_ai_proxy.rs`.
- The bootstrap import now points at the `config` submodule directly; if the crate-internal boundary changes again later, that import path must be updated deliberately rather than through implicit re-exports.
- Rollback for this loop is limited to:
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy/config.rs`
  - `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/app/bootstrap.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - the corresponding review, architecture, and release writebacks
