## Highlights

- Step 03 continued on the next serial `CP03-2` blocker and split the managed OpenClaw provider projection out of the desktop local proxy hotspot.
- This loop keeps Step 03 open overall, but it closes one real runtime-boundary slice and restores fresh green evidence for the desktop/runtime gates after a stale release-contract fixture list was corrected.

## Attempt Outcome

- Root cause:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed loopback proxy lifecycle, protocol translation, observability, and managed OpenClaw provider projection into one large runtime hotspot.
  - the managed-provider projection path mutates `openclaw.json`, writes provider defaults, and persists runtime params, but it is not part of the request-serving lifecycle itself, so it was a clean serial split point for `CP03-2`.
  - after the split work, fresh `pnpm.cmd check:desktop` exposed a second real issue: `scripts/openclaw-release-contract.test.mjs` still treated `packages/sdkwork-clawstudio-tasks/src/services/taskService.test.ts` as an OpenClaw version-fixture owner even though that file had already been reduced to a thin wrapper contract test.
- Implemented the narrow repair:
  - added `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs` and moved the managed-provider projection / `openclaw.json` helper stack into that module
  - changed `LocalAiProxyService::project_managed_openclaw_provider(...)` in `local_ai_proxy.rs` to delegate directly to `projection::project_managed_openclaw_provider(...)`
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires:
    - the projection module file to exist
    - `mod projection;` in `local_ai_proxy.rs`
    - explicit delegation to `projection::project_managed_openclaw_provider(...)`
  - removed `packages/sdkwork-clawstudio-tasks/src/services/taskService.test.ts` from `scripts/openclaw-release-contract.test.mjs` so the release-metadata contract again points only at files that still own shared bundled-version fixtures
- Actual workspace result:
  - the desktop local proxy runtime now keeps the runtime-facing `project_managed_openclaw_provider(...)` API stable while giving the projection logic its own module boundary
  - the Step 03 desktop structure gate now proves that this boundary stays present instead of relying on a one-time manual refactor
  - fresh desktop/runtime/lint/build verification returned green after correcting the stale release-contract fixture owner

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the browser-host truth source still publishes the built-in OpenClaw instance as `runtimeKind: 'openclaw'`, `deploymentMode: 'local-managed'`, and binds it to the shared bundled OpenClaw version and `openclaw.json` identity.
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still depends on `runtimeKind === 'openclaw'` and `lifecycle.configWritable === true`, so projection changes must preserve the same writable managed-config chain.
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
  - managed channel writes still flow through the platform-backed OpenClaw config path, so provider projection remains part of the same writable control-plane surface.
- `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
  - market install flows still consume workspace package roots rather than handwritten transport shortcuts, which keeps Step 03 dependent on a stable managed OpenClaw config surface.
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - agent installation still rejects writes unless the target detail is an OpenClaw runtime with a writable config lifecycle.
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind: 'openclaw'` plus `deploymentMode: 'local-managed'`, so the projection path remains part of the built-in managed runtime contract.
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still treats OpenClaw provider management as a dedicated managed surface, reinforcing the need for a stable projection owner.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - the Rust host still owns loopback proxy readiness and the runtime-facing `project_managed_openclaw_provider(...)` entrypoint.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only registers host plugins, so provider projection and config mutation must stay in the runtime service boundary rather than in plugin bootstrap.

## Verification Focus

- `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032 project_managed_openclaw_provider`
- `node scripts/openclaw-release-contract.test.mjs`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd lint`
- `pnpm.cmd build`

## Remaining Gaps

- `CP03-2` is improved but not complete:
  - the managed-provider projection path now has a dedicated module owner
  - other Step 03 Rust hotspots such as the remaining `local_ai_proxy.rs`, `studio.rs`, and adjacent runtime surfaces still need further decomposition
- `CP03-3` is still open on broader multi-mode startup smoke and true upgrade-execution evidence
- Step 03 overall therefore remains open

## Risks And Rollback

- The projection split is intended to be behavior-preserving; the main risk is future drift if new projection helpers are added back into `local_ai_proxy.rs` without updating the desktop foundation gate.
- The `openclaw-release-contract.test.mjs` fix is intentionally narrow; the risk is only that another stale fixture owner could surface later in a different test file.
- Rollback for this loop is limited to:
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs`
  - `scripts/check-desktop-platform-foundation.mjs`
  - `scripts/openclaw-release-contract.test.mjs`
  - the corresponding review, architecture, and release writebacks
