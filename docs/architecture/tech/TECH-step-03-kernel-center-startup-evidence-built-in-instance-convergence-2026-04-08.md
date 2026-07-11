> Migrated from `docs/review/step-03-kernel-center-startup-evidence-built-in-instance-convergence-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 advanced `CP03-4` and closed the next real desktop startup-evidence shell convergence gap.
- Persisted desktop startup evidence now preserves built-in instance identity, transport, and URL facts through the shared desktop kernel/runtime contract instead of truncating them before `Kernel Center`.
- Fresh targeted and gate-level verification stayed green after the end-to-end contract repair.

## Attempt Outcome

- Root cause:
  - the desktop bootstrap producer already persisted built-in OpenClaw instance facts in `diagnostics/desktop-startup-evidence.json`
  - the desktop kernel publication summary only carried `builtInInstanceStatus` for the built-in instance projection
  - `Kernel Center` therefore lost which built-in instance was validated at startup and which startup-time transport and URLs were actually published
  - `CP03-4` remained open because the shared shell-facing runtime truth chain still truncated part of the persisted startup-evidence built-in instance surface
- Implemented the narrow repair:
  - added `builtInInstanceId`, `builtInInstanceTransportKind`, `builtInInstanceBaseUrl`, and `builtInInstanceWebsocketUrl` to the Rust `DesktopStartupEvidenceInfo` publication contract
  - taught the desktop kernel service to parse and normalize those four fields from the persisted startup-evidence document
  - extended the shared TypeScript runtime contract to preserve the same fields through `RuntimeDesktopKernelInfo.desktopStartupEvidence`
  - mapped the published fields into `dashboard.startupEvidence` in `kernelCenterService`
  - added bounded `Kernel Center` rows and the minimum English and Chinese locale keys required to surface those facts in the shell
- Actual workspace result:
  - desktop startup evidence now flows through the approved truth chain as:
    raw desktop evidence document -> desktop kernel summary -> shared runtime contract -> `Kernel Center`
  - `Kernel Center` now shows the built-in startup instance id, transport kind, base URL, websocket URL, and status alongside the previously published startup summary
  - Settings still does not read or parse desktop diagnostics files directly

## OpenClaw Fact Sources

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts`
  - remains the low-level producer of the persisted desktop startup-evidence document, including the sanitized built-in instance projection with `id`, `transportKind`, `baseUrl`, `websocketUrl`, and `status`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/desktopStartupEvidence.test.ts`
  - freezes the passed-launch fixture that already carried the built-in startup instance identity and URL facts, proving the producer surface already existed before this loop
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
  - remains one of the browser/runtime descriptor fact owners referenced by the broader Step 03 hosted desktop chain
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
  - remains a fact source for managed OpenClaw runtime/gateway capability semantics, including the hosted transport expectations used by Step 03 shell-facing convergence
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - remains a fact source for the built-in OpenClaw provider presentation model that depends on stable identity and URL truth
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - remains part of the desktop runtime fact surface for the built-in OpenClaw startup chain and local proxy truth
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`
  - remains part of the desktop plugin/runtime wiring surface that Step 03 treats as canonical infrastructure
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/kernel.rs`
  - owns parsing and summarizing the persisted startup-evidence document for the desktop kernel surface
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/kernel.rs`
  - now freezes the built-in startup instance identity, transport, and URL facts in the Rust-side desktop startup-evidence summary contract
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts`
  - now freezes the shared TypeScript-side desktop startup-evidence summary contract with the same fields
- `packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.ts`
  - now maps the published built-in instance fields into `dashboard.startupEvidence`
- `packages/sdkwork-agentstudio-pc-settings/src/KernelCenter.tsx`
  - now presents the published built-in startup instance facts in the shell

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-settings/src/kernelCenter.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.test.ts`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp034-startup-evidence-built-in-red desktop_kernel_info_exposes_persisted_startup_evidence_summary`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- This loop closes the next explicit `CP03-4` shell-facing built-in instance startup-evidence gap:
  - the persisted startup-evidence built-in instance id is now visible in the shared kernel/runtime contract
  - the persisted startup-evidence built-in instance transport kind is now visible in the shared kernel/runtime contract
  - the persisted startup-evidence built-in instance base URL and websocket URL are now visible in the shared kernel/runtime contract
  - `Kernel Center` now consumes all of them without breaking host/shell boundaries
- Step 03 as a whole still remains open until the next real shell-facing or runtime-fact gap is surfaced by fresh evidence.
- This loop intentionally does not broaden into unrelated workspace TypeScript cleanup or non-desktop runtime work.

## Risks And Rollback

- The main risk remains future drift if the raw startup-evidence producer adds new built-in instance shell-relevant fields without updating the Rust and TypeScript summary contracts together.
- This loop intentionally keeps raw diagnostic parsing inside the desktop kernel layer and does not let Settings infer or reconstruct dropped fields on its own.
- Rollback is limited to:
  - the desktop kernel startup-evidence publication chain
  - the shared runtime contract
  - the `Kernel Center` mapping and presentation rows
  - the associated locale, review, architecture, execution-card, and release writebacks

