## Highlights

- Step 03 advanced `CP03-4` and closed the next real desktop startup-evidence shell convergence gap.
- Persisted desktop startup evidence now preserves startup descriptor `mode` and `lifecycle` through the shared desktop kernel/runtime contract instead of truncating them before `Kernel Center`.
- Fresh targeted and gate-level verification stayed green after the end-to-end contract repair.

## Attempt Outcome

- Root cause:
  - the desktop bootstrap producer already persisted descriptor `mode` and `lifecycle` in `diagnostics/desktop-startup-evidence.json`
  - the desktop kernel publication summary still dropped those two descriptor identity fields while already carrying descriptor browser URL, readiness, built-in instance facts, and error details
  - `Kernel Center` therefore lost which hosted-runtime mode the startup snapshot represented and what lifecycle that descriptor had reached at snapshot time even though both facts already existed in the raw evidence document
  - `CP03-4` remained open because the shared shell-facing runtime truth chain still truncated part of the persisted startup-evidence descriptor identity surface
- Implemented the narrow repair:
  - added `descriptorMode` and `descriptorLifecycle` to the Rust `DesktopStartupEvidenceInfo` publication contract
  - taught the desktop kernel service to parse and preserve those two descriptor fields from the persisted startup-evidence document
  - extended the shared TypeScript runtime contract to preserve the same fields through `RuntimeDesktopKernelInfo.desktopStartupEvidence`
  - mapped the published fields into `dashboard.startupEvidence` in `kernelCenterService`
  - added bounded `Kernel Center` rows and the minimum English and Chinese locale keys required to surface those startup-time descriptor facts in the shell
- Actual workspace result:
  - desktop startup evidence now flows through the approved truth chain as:
    raw desktop evidence document -> desktop kernel summary -> shared runtime contract -> `Kernel Center`
  - `Kernel Center` now shows the startup descriptor mode and lifecycle alongside the previously published startup summary
  - Settings still does not read or parse desktop diagnostics files directly

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts`
  - remains the low-level producer of the persisted desktop startup-evidence document, including the sanitized descriptor surface with `mode` and `lifecycle`
- `packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/desktopStartupEvidence.test.ts`
  - freezes the passed-launch fixture that already carried the descriptor mode/lifecycle facts, proving the producer surface already existed before this loop
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - remains a fact source for the browser/runtime baseline that the desktop hosted descriptor and built-in OpenClaw projection must continue to align with
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - remains a fact source for managed OpenClaw semantics that continue to depend on the hosted runtime reaching the expected descriptor lifecycle
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - remains a fact source for how the managed OpenClaw workspace is presented once the hosted runtime descriptor stabilizes
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - remains part of the desktop runtime fact surface for the built-in OpenClaw startup chain and local proxy truth
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - remains part of the desktop plugin/runtime wiring surface that Step 03 treats as canonical infrastructure
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/kernel.rs`
  - now owns parsing and summarizing the persisted startup-evidence descriptor mode/lifecycle fields for the desktop kernel surface
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/kernel.rs`
  - now freezes the startup descriptor mode/lifecycle facts in the Rust-side desktop startup-evidence summary contract
- `packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts`
  - now freezes the shared TypeScript-side desktop startup-evidence summary contract with the same fields
- `packages/sdkwork-clawstudio-settings/src/services/kernelCenterService.ts`
  - now maps the published startup descriptor mode/lifecycle into `dashboard.startupEvidence`
- `packages/sdkwork-clawstudio-settings/src/KernelCenter.tsx`
  - now presents the published startup descriptor mode/lifecycle in the shell

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-clawstudio-settings/src/kernelCenter.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-settings/src/services/kernelCenterService.test.ts`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp034-startup-evidence-descriptor-mode-red desktop_kernel_info_exposes_persisted_startup_evidence_summary`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- This loop closes the next explicit `CP03-4` shell-facing startup descriptor gap:
  - the persisted startup-evidence descriptor mode is now visible in the shared kernel/runtime contract
  - the persisted startup-evidence descriptor lifecycle is now visible in the shared kernel/runtime contract
  - `Kernel Center` now consumes both without breaking host/shell boundaries
- Step 03 as a whole still remains open until the next real shell-facing or runtime-fact gap is surfaced by fresh evidence.
- This loop intentionally does not broaden into unrelated workspace TypeScript cleanup or non-desktop runtime work.

## Risks And Rollback

- The main risk remains future drift if the raw startup-evidence producer adds new descriptor shell-relevant fields without updating the Rust and TypeScript summary contracts together.
- This loop intentionally keeps raw diagnostic parsing inside the desktop kernel layer and does not let Settings infer or reconstruct dropped descriptor fields on its own.
- Rollback is limited to:
  - the desktop kernel startup-evidence publication chain
  - the shared runtime contract
  - the `Kernel Center` mapping and presentation rows
  - the associated locale, review, architecture, execution-card, and release writebacks
