## Highlights

- Step 03 advanced `CP03-4` and closed the next real desktop startup-evidence shell convergence gap.
- Persisted desktop startup evidence now keeps `runId` and `errorCause` in the shared desktop kernel/runtime contract instead of dropping them before `Kernel Center`.
- Fresh targeted and gate-level verification stayed green after the end-to-end contract repair.

## Attempt Outcome

- Root cause:
  - the desktop bootstrap producer already persisted `runId` and `error.cause` in `diagnostics/desktop-startup-evidence.json`
  - the desktop kernel publication summary only carried status, phase, readiness, URLs, lifecycle, and `errorMessage`
  - `Kernel Center` therefore lost the startup-attempt identity and the lower-level causal hint even though both facts were already present in the raw desktop evidence document
  - `CP03-4` remained open because the shared shell-facing runtime truth chain still truncated part of the persisted startup-evidence diagnostic surface
- Implemented the narrow repair:
  - added `runId` and `errorCause` to the Rust `DesktopStartupEvidenceInfo` publication contract
  - taught the desktop kernel service to parse `runId` and `error.cause` from the persisted startup-evidence document
  - extended the shared TypeScript runtime contract to preserve those fields through `RuntimeDesktopKernelInfo.desktopStartupEvidence`
  - mapped both fields into `dashboard.startupEvidence` in `kernelCenterService`
  - added bounded `Kernel Center` rows and the minimum English and Chinese locale keys required to surface those facts in the shell
- Actual workspace result:
  - desktop startup evidence now flows through the approved truth chain as:
    raw desktop evidence document -> desktop kernel summary -> shared runtime contract -> `Kernel Center`
  - `Kernel Center` now shows the startup-evidence run id and error cause alongside the previously published summary fields
  - Settings still does not read or parse desktop diagnostics files directly

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts`
  - remains the low-level producer of the persisted desktop startup-evidence document, including `runId` and `error.cause`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/kernel.rs`
  - owns parsing and summarizing the persisted startup-evidence document for the desktop kernel surface
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/kernel.rs`
  - now freezes `runId` and `errorCause` in the Rust-side desktop startup-evidence summary contract
- `packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts`
  - now freezes the shared TypeScript-side desktop startup-evidence summary contract with the same fields
- `packages/sdkwork-clawstudio-settings/src/services/kernelCenterService.ts`
  - now maps the published fields into `dashboard.startupEvidence`
- `packages/sdkwork-clawstudio-settings/src/KernelCenter.tsx`
  - now presents the published startup-evidence run id and error cause in the shell

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-clawstudio-settings/src/kernelCenter.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-settings/src/services/kernelCenterService.test.ts`
- `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp034-startup-evidence-runid-green desktop_kernel_info_exposes_persisted_startup_evidence_summary`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- This loop closes the next explicit `CP03-4` shell-facing diagnostic identity gap:
  - the persisted startup-evidence run id is now visible in the shared kernel/runtime contract
  - the persisted startup-evidence error cause is now visible in the shared kernel/runtime contract
  - `Kernel Center` now consumes both without breaking host/shell boundaries
- Step 03 as a whole still remains open until the next real shell-facing or runtime-fact gap is surfaced by fresh evidence.
- This loop intentionally does not broaden into unrelated workspace TypeScript cleanup or non-desktop runtime work.

## Risks And Rollback

- The main risk remains future drift if the raw startup-evidence producer adds new shell-relevant diagnostic identity fields without updating the Rust and TypeScript summary contracts together.
- This loop intentionally keeps raw diagnostic parsing inside the desktop kernel layer and does not let Settings infer or reconstruct the dropped fields on its own.
- Rollback is limited to:
  - the desktop kernel startup-evidence publication chain
  - the shared runtime contract
  - the `Kernel Center` mapping and presentation rows
  - the associated locale, review, architecture, execution-card, and release writebacks
