# 123-2026-04-08 Desktop Startup Evidence Kernel Publication Owner

## Decision

Desktop startup evidence must be exposed through one shared desktop kernel/runtime publication chain:

- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts`
  remains the low-level producer of the persisted startup-evidence document
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs`
  owns parsing and summarizing that persisted document for the desktop kernel surface
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
  owns the Rust-side `RuntimeDesktopKernelInfo.desktopStartupEvidence` contract
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
  owns the shared TypeScript-side desktop startup-evidence contract
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
  owns the shell-facing dashboard mapping from the published runtime contract into `dashboard.startupEvidence`
- `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
  owns presentation of the published summary in the shell

Settings must not read `diagnostics/desktop-startup-evidence.json` directly.

## Why

- The persisted startup-evidence document is a desktop runtime fact, not a shell-owned filesystem concern.
- If Settings reads that file directly, the host/shell boundary breaks and the shell becomes coupled to desktop-specific storage layout and parsing details.
- Publishing a compact summary through `RuntimeDesktopKernelInfo` keeps one truth chain:
  - bootstrap produces the evidence
  - desktop kernel parses and summarizes it
  - shared runtime contract publishes it
  - shell consumes it
- This also keeps future desktop/server/runtime surface work aligned with the existing Step 03 rule that runtime truth must move through explicit host/kernel contracts instead of ad hoc shell reads.

## Standard

- New shell-facing startup-evidence fields must be added to the shared desktop kernel/runtime contract, not loaded from desktop files in feature packages.
- The desktop kernel publication layer may summarize the persisted startup-evidence document, but the shell must consume only the published summary.
- `Kernel Center` remains a presenter of published runtime facts:
  - it may format or label the summary
  - it may not become a second parser or filesystem reader for the raw desktop evidence document
- The persisted startup-evidence document remains the low-level diagnostic artifact and should stay decoupled from shell implementation details.

## Impact

- `CP03-4` now has an explicit owner chain for desktop startup-evidence publication and shell consumption.
- Future changes to desktop startup evidence can be audited at the kernel/runtime contract boundary instead of being scattered across shell code.
- The desktop shell gains the required visibility into startup evidence while preserving the repository's host-to-feature dependency direction.
