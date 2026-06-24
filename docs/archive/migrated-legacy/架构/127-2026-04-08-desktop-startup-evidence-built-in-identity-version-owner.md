# 127-2026-04-08 Desktop Startup Evidence Built-In Identity Version Owner

## Decision

If persisted desktop startup evidence already contains shell-relevant built-in instance identity label or version fields, the desktop kernel/runtime publication chain must preserve them instead of truncating them before shell consumption.

For the current Step 03 `CP03-4` convergence scope, that explicitly includes:

- `builtInInstanceName`
- `builtInInstanceVersion`

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

Settings must not recover these fields by reading `diagnostics/desktop-startup-evidence.json` directly or by inferring them from the current live instance list or current runtime provenance.

## Why

- `builtInInstanceName` is the startup-time human-readable identity. Without it, the shell loses the operator-facing label for the exact built-in instance that the persisted startup snapshot validated.
- `builtInInstanceVersion` is the startup-time built-in version truth. Without it, the shell can only show current runtime provenance and cannot compare it against the persisted startup snapshot.
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
- `Kernel Center` may present the published built-in instance identity label and version fields, but it may not:
  - become a second parser for the raw evidence document
  - infer a synthetic startup name from the current live instance list
  - reconstruct startup version from the current runtime provenance snapshot

## Impact

- `CP03-4` now has an explicit rule for shell-facing startup-evidence built-in identity label and version truth.
- Future startup-evidence regressions can be audited at the kernel/runtime contract boundary instead of being rediscovered in shell code.
- The desktop shell gains better startup snapshot visibility while preserving the repository's host-to-feature dependency direction.
