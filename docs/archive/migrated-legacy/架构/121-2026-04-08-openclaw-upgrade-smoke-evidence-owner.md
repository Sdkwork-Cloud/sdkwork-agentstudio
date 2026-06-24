# 121-2026-04-08 OpenClaw Upgrade Smoke Evidence Owner

## Decision

The desktop OpenClaw upgrade chain must keep one explicit smoke-evidence owner:

- `scripts/openclaw-upgrade-smoke-evidence.mjs`
  owns:
  - the aggregated desktop upgrade smoke evidence surface for Step 03 `CP03-3`
  - phase projection for:
    - `installer-smoke`
    - `packaged-launch-smoke`
    - `smoke-readiness`
- `scripts/release/smoke-desktop-installers.mjs`
  remains the low-level owner of installer smoke execution and report generation
- `scripts/release/smoke-desktop-packaged-launch.mjs`
  remains the low-level owner of packaged launch execution and captured startup-evidence orchestration
- `scripts/release/smoke-desktop-startup-evidence.mjs`
  remains the low-level owner of startup-evidence validation and startup smoke report generation

`package.json` must wire `node scripts/openclaw-upgrade-smoke-evidence.test.mjs` into `check:desktop-openclaw-runtime`.

## Why

- Step 03 `CP03-3` already had readiness, rollback, prepare, and packaged-release verification evidence owners, but desktop smoke evidence was still fragmented across lower-level release scripts.
- Without one Step 03-specific smoke aggregator, the desktop runtime gate could pass while still lacking an explicit contract that the smoke phase belonged to the upgrade chain.
- The low-level release smoke owners are still correct for execution, but they should not each become ad hoc Step 03 authority surfaces.
- A dedicated aggregator lets the repository freeze:
  - the existence of the smoke phase in the desktop upgrade chain
  - the order and naming of the smoke phases
  - blocker propagation semantics

## Standard

- New Step 03 desktop upgrade-smoke summary logic must live in `scripts/openclaw-upgrade-smoke-evidence.mjs`.
- The aggregator may compose lower-level release smoke owners, but it must not duplicate their report-writing logic.
- `check:desktop-openclaw-runtime` must keep the smoke-evidence contract alongside readiness, rollback, prepare, and packaged-release verification contracts.
- Lower-level release smoke scripts remain reusable release-flow owners and must keep their current responsibilities.

## Impact

- `CP03-3` now has an explicit desktop smoke-evidence owner instead of relying on scattered release scripts.
- Future work can target the next remaining upgrade-execution gap, namely a single owner for `sync` and `target clean`, without re-litigating desktop smoke ownership.
- The multi-mode release flow can continue to reuse the same installer / packaged-launch / startup smoke owners while Step 03 keeps one auditable desktop upgrade-smoke summary surface.
