## Highlights

- Step 03 advanced `CP03-4` and closed the next real desktop startup-evidence shell convergence gap.
- Persisted desktop startup evidence now preserves startup descriptor `requestedPort` and `dynamicPort` through the shared desktop kernel/runtime contract instead of truncating them before `Kernel Center`.
- Fresh targeted and gate-level verification remained green after the end-to-end contract repair.

## Attempt Outcome

- Root cause:
  - the desktop bootstrap producer already persisted descriptor `requestedPort` and `dynamicPort` in `diagnostics/desktop-startup-evidence.json`
  - the desktop kernel publication summary still dropped those two startup descriptor port-allocation fields while already carrying descriptor mode, lifecycle, endpoint identity, active port, state-store, browser URL, readiness, built-in instance facts, and error details
  - `Kernel Center` therefore lost what port the startup descriptor originally requested and whether that startup descriptor resolved through a dynamic port fallback, even though both facts already existed in the raw evidence document
  - `CP03-4` remained open because the shared shell-facing runtime truth chain still truncated part of the persisted startup-evidence descriptor port-allocation surface
- Implemented the narrow repair:
  - added `descriptorRequestedPort` and `descriptorDynamicPort` to the Rust `DesktopStartupEvidenceInfo` publication contract
  - taught the desktop kernel service to parse and preserve those two descriptor fields from the persisted startup-evidence document
  - extended the shared TypeScript runtime contract to preserve the same fields through `RuntimeDesktopKernelInfo.desktopStartupEvidence`
  - mapped the published fields into `dashboard.startupEvidence` in `kernelCenterService`
  - added bounded `Kernel Center` rows and the minimum English and Chinese locale keys required to surface those startup-time descriptor port-allocation facts in the shell
- Actual workspace result:
  - desktop startup evidence now flows through the approved truth chain as:
    raw desktop evidence document -> desktop kernel summary -> shared runtime contract -> `Kernel Center`
  - `Kernel Center` now shows the startup descriptor requested port and startup descriptor dynamic-port flag alongside the previously published startup summary
  - Settings still does not read or parse desktop diagnostics files directly

## OpenClaw Fact Sources

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts`
  - remains the low-level producer of the persisted desktop startup-evidence document, including the sanitized descriptor surface with `requestedPort` and `dynamicPort`
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
  - remains a fact source for the browser/runtime baseline that the desktop hosted descriptor and built-in OpenClaw projection must continue to align with
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
  - remains a fact source for the published browser/runtime contract expectations that must stay coherent with the hosted desktop descriptor
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
  - remains a fact source for managed OpenClaw semantics that continue to depend on the hosted runtime exposing stable endpoint and lifecycle facts through approved surfaces
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - remains a fact source for how the managed OpenClaw workspace is presented once the hosted runtime descriptor stabilizes
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - remains part of the desktop runtime fact surface for the built-in OpenClaw startup chain and local proxy truth
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`
  - remains part of the desktop plugin/runtime wiring surface that Step 03 treats as canonical infrastructure
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/kernel.rs`
  - now owns parsing and summarizing the persisted startup-evidence descriptor requested-port and dynamic-port fields for the desktop kernel surface
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/kernel.rs`
  - now freezes the startup descriptor port-allocation facts in the Rust-side desktop startup-evidence summary contract
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts`
  - now freezes the shared TypeScript-side desktop startup-evidence summary contract with the same fields
- `packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.ts`
  - now maps the published startup descriptor requested-port and dynamic-port fields into `dashboard.startupEvidence`
- `packages/sdkwork-agentstudio-pc-settings/src/KernelCenter.tsx`
  - now presents the published startup descriptor requested-port and dynamic-port fields in the shell

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-settings/src/kernelCenter.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.test.ts`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp034-startup-evidence-descriptor-requested-port-red desktop_kernel_info_exposes_persisted_startup_evidence_summary`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- This loop closes the next explicit `CP03-4` shell-facing startup descriptor gap:
  - the persisted startup-evidence descriptor requested port is now visible in the shared kernel/runtime contract
  - the persisted startup-evidence descriptor dynamic-port flag is now visible in the shared kernel/runtime contract
  - `Kernel Center` now consumes both without breaking host/shell boundaries
- Step 03 as a whole still remains open until the next real shell-facing or runtime-fact gap is surfaced by fresh evidence.
- This loop intentionally does not broaden into unrelated workspace TypeScript cleanup or non-desktop runtime work.

## Risks And Rollback

- The main risk remains future drift if the raw startup-evidence producer adds new descriptor shell-relevant fields without updating the Rust and TypeScript summary contracts together.
- This loop intentionally keeps raw diagnostic parsing inside the desktop kernel layer and does not let Settings infer or reconstruct dropped descriptor port-allocation fields on its own.
- Rollback is limited to:
  - the desktop kernel startup-evidence publication chain
  - the shared runtime contract
  - the `Kernel Center` mapping and presentation rows
  - the associated locale, review, architecture, execution-card, and release writebacks
