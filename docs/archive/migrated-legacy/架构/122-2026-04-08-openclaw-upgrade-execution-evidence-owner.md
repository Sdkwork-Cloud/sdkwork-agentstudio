# 122-2026-04-08 OpenClaw Upgrade Execution Evidence Owner

## Decision

The desktop OpenClaw upgrade chain must keep one explicit execution-evidence owner:

- `scripts/openclaw-upgrade-execution-evidence.mjs`
  owns:
  - the aggregated desktop upgrade-execution evidence surface for Step 03 `CP03-3`
  - phase projection for:
    - `sync-plan`
    - `target-clean`
    - `prepare-plan`
    - `release-verify`
    - `execution-readiness`
- `scripts/run-desktop-release-build.mjs`
  remains the low-level owner of desktop release phase planning
- `scripts/sync-bundled-components.mjs`
  remains the low-level owner of bundled component release sync behavior
- `scripts/ensure-tauri-target-clean.mjs`
  remains the low-level owner of stale Tauri target inspection and cleanup
- `scripts/prepare-openclaw-runtime.mjs`
  remains the low-level owner of bundled OpenClaw runtime preparation
- `scripts/verify-desktop-openclaw-release-assets.mjs`
  remains the low-level owner of packaged desktop OpenClaw release verification

`package.json` must wire `node scripts/openclaw-upgrade-execution-evidence.test.mjs` into `check:desktop-openclaw-runtime`.

## Why

- Step 03 already had explicit owners for readiness, rollback evidence, packaged-release verification, and smoke evidence, but the earlier execution chain still depended on manual correlation across multiple lower-level scripts.
- Without one dedicated execution aggregator, the repository could keep the low-level scripts while silently drifting the actual Step 03 desktop upgrade chain.
- A dedicated aggregator lets the repository freeze:
  - that desktop release sync still routes through the expected release-sync contract
  - that stale Tauri targets are explicitly checked and converge cleanly
  - that preparation still belongs to `prepare-openclaw-runtime`
  - that packaged release verification still gates bundle/smoke execution
- The lower-level owners remain correct for execution and should not be replaced by one large duplicate script.

## Standard

- New Step 03 desktop upgrade-execution summary logic must live in `scripts/openclaw-upgrade-execution-evidence.mjs`.
- The aggregator may compose lower-level release-phase, target-clean, and verification owners, but it must not re-implement their underlying behavior.
- `check:desktop-openclaw-runtime` must keep the execution-evidence contract alongside readiness, rollback, prepare, packaged-release verification, and smoke-evidence contracts.
- Lower-level release/build/verify scripts remain reusable release-flow owners and must keep their current responsibilities.

## Impact

- `CP03-3` now has one explicit desktop execution-evidence owner instead of relying on scattered script authority.
- Future Step 03 work can move from `CP03-3` into `CP03-4` evidence-surface convergence without re-litigating the desktop upgrade execution chain.
- The multi-mode release flow can continue reusing the same low-level sync, cleanup, prepare, and verify owners while Step 03 keeps one auditable desktop upgrade-execution summary surface.
