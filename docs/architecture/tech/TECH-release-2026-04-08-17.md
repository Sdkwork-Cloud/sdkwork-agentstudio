> Migrated from `docs/release/release-2026-04-08-17.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 moved from package parity back to `CP03-3` and added an explicit desktop OpenClaw rollback-evidence layer.
- This release candidate keeps Step 03 open overall, but it closes the desktop rollback-baseline evidence slice with a real script, test, and fresh runtime-gate verification.

## Attempt Outcome

- Implemented:
  - `scripts/openclaw-upgrade-rollback-evidence.mjs`
  - `scripts/openclaw-upgrade-rollback-evidence.test.mjs`
  - updated `package.json` so `check:desktop-openclaw-runtime` executes the new rollback-evidence contract
  - hardened `scripts/release-flow-contract.test.mjs` so git-based release-flow assertions skip only on sandbox-only Node child-process `EPERM` failures
- Actual workspace evidence:
  - `node scripts/openclaw-upgrade-rollback-evidence.mjs --rollback-version 2026.4.2`
  - result: `rollbackReady: true`
  - baseline alignment: `config/openclaw-release.json`, bundled runtime manifest, and packaged release manifest all stayed pinned to `2026.4.2`
  - runtime evidence: prepared runtime remained reusable and packaged release assets verified successfully for the current Windows `x64` target
  - fresh `pnpm.cmd lint` initially exposed the sandbox-specific `EPERM` failure path in `scripts/release-flow-contract.test.mjs`; after the narrow hardening, lint returned green again without weakening the non-sandbox release contract

## Change Scope

- `scripts/openclaw-upgrade-rollback-evidence.mjs`
- `scripts/openclaw-upgrade-rollback-evidence.test.mjs`
- `scripts/release-flow-contract.test.mjs`
- `package.json`
- `docs/review/step-03-openclaw升级与回滚-2026-04-08.md`
- `docs/架构/102-2026-04-08-openclaw-upgrade-rollback-evidence-chain.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-17.md`
- `docs/release/releases.json`

## Verification Focus

- `node scripts/openclaw-upgrade-rollback-evidence.mjs --rollback-version 2026.4.2`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd lint`
- `pnpm.cmd build`

## Risks And Rollback

- The new script is evidence-only; the main risk is future drift if readiness, prepare, or packaged verification behavior changes without updating the aggregated report.
- The `EPERM` skip in `scripts/release-flow-contract.test.mjs` is sandbox-scoped by design; rollback should remove it only if this environment no longer blocks Node child-process `git` execution.
- Step 03 is still not complete because multi-mode smoke evidence and runtime-hotspot splitting remain open.
- Rollback for this loop is isolated to the new evidence script, its test, the `check:desktop-openclaw-runtime` command wiring, `scripts/release-flow-contract.test.mjs`, and these documentation writebacks.

