> Migrated from `docs/release/release-2026-04-08-42.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 advanced `CP03-4` and preserved desktop startup-evidence built-in instance name and version facts through the shared kernel/runtime contract.
- `Kernel Center` now shows persisted startup-evidence built-in instance name and version in addition to the previously published summary fields.
- Fresh targeted plus gate-level verification remained green.

## Attempt Outcome

- The loop repaired the next missing `CP03-4` shell-facing evidence link:
  - the raw desktop startup-evidence document already contained the built-in instance name and version
  - the desktop kernel publication summary dropped those two fields before shell consumption
  - `Kernel Center` therefore lost the startup-time built-in identity label and version truth even though the producer already persisted them
- Implemented the narrow repairs:
  - added `builtInInstanceName` and `builtInInstanceVersion` to the desktop kernel startup-evidence summary contract
  - parsed and normalized those fields in the desktop kernel service
  - extended the shared TypeScript runtime contract and `kernelCenterService` dashboard mapping
  - added `Kernel Center` presentation rows and locale copy for the new fields
- Fresh verification:
  - `node --experimental-strip-types packages/sdkwork-claw-settings/src/kernelCenter.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
  - `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp034-startup-evidence-built-in-version-red desktop_kernel_info_exposes_persisted_startup_evidence_summary`
  - `pnpm.cmd check:desktop-openclaw-runtime`
  - `pnpm.cmd check:desktop`

## Change Scope

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs`
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
- `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
- `packages/sdkwork-claw-i18n/src/locales/en/settings.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/settings.json`
- `docs/review/step-03-kernel-center-startup-evidence-built-in-identity-version-convergence-2026-04-08.md`
- `docs/架构/127-2026-04-08-desktop-startup-evidence-built-in-identity-version-owner.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-42.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-claw-settings/src/kernelCenter.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp034-startup-evidence-built-in-version-red desktop_kernel_info_exposes_persisted_startup_evidence_summary`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Risks And Rollback

- The shell now depends on the published built-in startup identity/version fields remaining aligned with the raw desktop startup-evidence producer.
- This loop intentionally keeps startup-evidence parsing inside the desktop kernel layer and does not broaden shell ownership.
- Rollback is limited to the startup-evidence publication contract, `Kernel Center` mapping/presentation, locale copy, and the corresponding document writebacks.

