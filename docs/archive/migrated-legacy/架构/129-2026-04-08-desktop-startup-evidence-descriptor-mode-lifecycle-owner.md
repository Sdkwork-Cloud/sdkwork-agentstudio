# 129-2026-04-08 Desktop Startup Evidence Descriptor Mode Lifecycle Owner

## Decision

If persisted desktop startup evidence already contains shell-relevant startup descriptor identity fields, the desktop kernel/runtime publication chain must preserve them instead of truncating them before shell consumption.

For the current Step 03 `CP03-4` convergence scope, that explicitly includes:

- `descriptorMode`
- `descriptorLifecycle`

The owner chain remains:

- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts`
  produces the raw persisted evidence document
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs`
  parses and normalizes the shell-relevant evidence fields
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
  owns the Rust-side published startup-evidence summary contract
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
  owns the shared TypeScript-side published startup-evidence summary contract
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
  maps the published fields into the shell dashboard model
- `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
  renders the published summary in the shell

Settings must not recover these descriptor facts by reading `diagnostics/desktop-startup-evidence.json` directly or by inferring them from the current live runtime contract.

## Why

- `descriptorMode` is the startup-time hosted runtime identity surface. Without it, the shell cannot tell which hosted runtime mode the persisted startup snapshot validated.
- `descriptorLifecycle` is the startup-time hosted runtime readiness surface. Without it, the shell cannot compare current runtime state against the descriptor lifecycle captured at startup.
- Both facts already exist in the raw evidence document, so dropping them in the kernel publication layer creates a false boundary where raw truth exists but the shared runtime contract silently hides part of it.
- Preserving the fields in the explicit publication chain keeps the Step 03 rule intact:
  - bootstrap produces the evidence
  - desktop kernel summarizes it
  - shared runtime contract publishes it
  - shell consumes it

## Standard

- When a persisted desktop startup-evidence field is both:
  - already produced by the bootstrap evidence document
  - needed by shell diagnostics or operator workflows
  it must be added to the shared desktop kernel/runtime summary contract.
- The desktop kernel publication layer may normalize or rename those fields for the shared contract, but the shell must consume only the published summary.
- `Kernel Center` may present the published startup descriptor mode/lifecycle fields, but it may not:
  - become a second parser for the raw evidence document
  - infer a synthetic startup descriptor from the current runtime contract
  - reconstruct startup descriptor lifecycle from the current live host state

## Impact

- `CP03-4` now has an explicit rule for shell-facing startup-evidence descriptor identity truth.
- Future startup-evidence regressions can be audited at the kernel/runtime contract boundary instead of being rediscovered in shell code.
- The desktop shell gains better startup snapshot visibility while preserving the repository's host-to-feature dependency direction.
