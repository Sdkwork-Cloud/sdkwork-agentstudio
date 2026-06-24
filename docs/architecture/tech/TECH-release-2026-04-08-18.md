> Migrated from `docs/release/release-2026-04-08-18.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 continued on the serial `CP03-2` hotspot-splitting frontier and extracted the desktop local-proxy managed-provider projection into its own Rust module.
- This release candidate keeps Step 03 open overall, but it closes one real runtime-boundary slice and returns fresh desktop/runtime/lint/build evidence to green.

## Attempt Outcome

- The loop repaired two linked verification gaps:
  - `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` still mixed loopback proxy lifecycle with managed OpenClaw provider projection and `openclaw.json` write logic
  - `scripts/openclaw-release-contract.test.mjs` still treated `packages/sdkwork-claw-tasks/src/services/taskService.test.ts` as an OpenClaw version-fixture owner even though that file had already become a thin wrapper contract test
- Implemented the narrow repairs:
  - added `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs`
  - delegated `LocalAiProxyService::project_managed_openclaw_provider(...)` from `local_ai_proxy.rs` into the new projection module
  - tightened `scripts/check-desktop-platform-foundation.mjs` so the Step 03 desktop structure gate now requires the projection module file, the `mod projection;` declaration, and the explicit delegation call
  - removed the stale tasks-test fixture path from `scripts/openclaw-release-contract.test.mjs`
- Fresh verification:
  - `node scripts/check-desktop-platform-foundation.mjs`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032 project_managed_openclaw_provider`
  - `node scripts/openclaw-release-contract.test.mjs`
  - `pnpm.cmd check:desktop`
  - `pnpm.cmd check:desktop-openclaw-runtime`
  - `pnpm.cmd lint`
  - `pnpm.cmd build`

## Change Scope

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs`
- `scripts/check-desktop-platform-foundation.mjs`
- `scripts/openclaw-release-contract.test.mjs`
- `docs/review/step-03-local-ai-proxy-projection-hotspot-split-2026-04-08.md`
- `docs/架构/103-2026-04-08-local-ai-proxy-projection-module-boundary.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-18.md`
- `docs/release/releases.json`

## Verification Focus

- `node scripts/check-desktop-platform-foundation.mjs`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp032 project_managed_openclaw_provider`
- `node scripts/openclaw-release-contract.test.mjs`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd lint`
- `pnpm.cmd build`

## Risks And Rollback

- The projection split is intended to be behavior-preserving; the main risk is future drift if the projection helper stack starts leaking back into `local_ai_proxy.rs`.
- The release-contract fix is narrow and low-risk, but another stale fixture owner could still surface later if more wrapper tests are introduced without updating the contract script.
- Rollback is limited to the listed Rust/script files and the associated review, architecture, and release writebacks.

