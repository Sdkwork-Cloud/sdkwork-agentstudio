> Migrated from `docs/review/step-03-kernel-center-startup-evidence-convergence-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 advanced `CP03-4` and closed one real desktop startup-evidence shell convergence gap.
- Persisted desktop startup evidence now flows through the shared desktop kernel/runtime contract instead of forcing Settings to read desktop diagnostics files directly.
- Fresh UI-level, service-level, Rust-level, and desktop-gate verification stayed green.

## Attempt Outcome

- Root cause:
  - the desktop bootstrap already persisted `diagnostics/desktop-startup-evidence.json`, but the desktop kernel info surface did not publish any startup-evidence summary
  - `Kernel Center` therefore had no shared runtime/kernel fact surface to consume, and the only way to show startup evidence in Settings would have been a boundary-breaking direct file read from the shell layer
  - `CP03-4` remained open because the shell-facing runtime truth chain stopped at live runtime/provenance details instead of carrying the persisted startup evidence forward
- Implemented the narrow repair:
  - published a compact desktop startup-evidence summary on `RuntimeDesktopKernelInfo.desktopStartupEvidence`
  - loaded the persisted `diagnostics/desktop-startup-evidence.json` document in the desktop kernel service and projected only the shell-relevant summary fields
  - mapped the published summary into `dashboard.startupEvidence` in `kernelCenterService`
  - added a bounded `Kernel Center` startup-evidence section plus the minimum English and Chinese locale keys needed to expose that summary in the UI
  - added a new source-level UI contract test to freeze the shell consumer and locale presence
- Actual workspace result:
  - desktop startup evidence now flows from the bootstrap-produced diagnostics file into the desktop kernel summary, through the shared runtime contract, and into `Kernel Center`
  - `Kernel Center` now displays the published startup-evidence status, phase, recorded timestamp, readiness, evidence path, browser/manage URLs, runtime/gateway lifecycle, built-in instance status, and summarized error surface
  - the Settings package still does not read desktop diagnostics files directly

## OpenClaw Fact Sources

- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts`
  - remains the low-level producer of the persisted desktop startup-evidence document
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel.rs`
  - now owns parsing and summarizing the persisted startup-evidence document for the desktop kernel surface
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
  - now publishes the typed desktop startup-evidence summary on `RuntimeDesktopKernelInfo`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/mod.rs`
  - now wires the startup-evidence summary into `desktop_kernel_info`
- `packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts`
  - now freezes the shared TypeScript runtime contract for the desktop startup-evidence summary
- `packages/sdkwork-claw-settings/src/services/kernelCenterService.ts`
  - now maps the published summary into `dashboard.startupEvidence`
- `packages/sdkwork-claw-settings/src/KernelCenter.tsx`
  - now consumes the published summary and exposes it through a dedicated shell-facing section

## Verification Focus

- RED: `node --experimental-strip-types packages/sdkwork-claw-settings/src/kernelCenter.test.ts`
- GREEN: `node --experimental-strip-types packages/sdkwork-claw-settings/src/kernelCenter.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts`
- `cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml --target-dir target/step03-cp034-startup-evidence-green desktop_kernel_info_exposes_persisted_startup_evidence_summary`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- This loop closes one explicit `CP03-4` shell-facing evidence convergence gap:
  - the desktop startup-evidence truth chain is now visible in the shared kernel/runtime contract
  - `Kernel Center` now consumes that published summary without boundary violations
- Step 03 as a whole still remains open until the next real shell-facing or runtime-fact gap is surfaced by fresh evidence.
- This loop intentionally does not broaden into unrelated feature-package or non-desktop runtime work.

## Risks And Rollback

- The new shell section is intentionally thin and depends on the published summary contract; the main risk is future field drift if desktop startup evidence evolves without updating the Rust/TS contract pair and `Kernel Center` consumer together.
- This loop intentionally does not let Settings parse the raw diagnostics file or own any desktop filesystem logic.
- Rollback is limited to:
  - the desktop kernel startup-evidence publication chain
  - the runtime contract
  - the `Kernel Center` mapping and UI section
  - the associated locale, review, architecture, execution-card, and release writebacks

