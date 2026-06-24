> Migrated from `docs/release/release-2026-04-08-36.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 advanced into `CP03-3` and added a dedicated desktop OpenClaw upgrade smoke-evidence owner.
- The desktop runtime gate now freezes smoke evidence in the same chain as readiness, rollback, prepare, and packaged-release verification.
- Fresh targeted and gate-level checks stayed green.

## Attempt Outcome

- The loop repaired one missing `CP03-3` evidence owner:
  - the repository already had installer smoke, packaged launch smoke, and startup smoke scripts, but there was no single OpenClaw upgrade-smoke aggregator for the desktop runtime chain
  - `check:desktop-openclaw-runtime` therefore guarded readiness, rollback evidence, preparation, and packaged-release verification without freezing a dedicated smoke-evidence owner
- Implemented the narrow repairs:
  - added `scripts/openclaw-upgrade-smoke-evidence.mjs` to aggregate desktop installer smoke and packaged launch smoke into a final smoke-readiness evidence surface
  - added `scripts/openclaw-upgrade-smoke-evidence.test.mjs` to freeze gate integration, the passed aggregate summary, and blocker propagation when packaged launch smoke fails
  - updated `package.json` so `check:desktop-openclaw-runtime` now executes the new smoke-evidence test
- Fresh verification:
  - RED: `node scripts/openclaw-upgrade-smoke-evidence.test.mjs`
  - GREEN: `node scripts/openclaw-upgrade-smoke-evidence.test.mjs`
  - `pnpm.cmd check:desktop-openclaw-runtime`
  - `pnpm.cmd check:desktop`

## Change Scope

- `scripts/openclaw-upgrade-smoke-evidence.mjs`
- `scripts/openclaw-upgrade-smoke-evidence.test.mjs`
- `package.json`
- `docs/review/step-03-openclaw-upgrade-smoke-evidence-2026-04-08.md`
- `docs/架构/121-2026-04-08-openclaw-upgrade-smoke-evidence-owner.md`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/release/release-2026-04-08-36.md`
- `docs/release/releases.json`

## Verification Focus

- `node scripts/openclaw-upgrade-smoke-evidence.test.mjs`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Risks And Rollback

- The new script aggregates existing smoke owners, so the main risk is contract drift if low-level smoke outputs change without updating the aggregator.
- This loop intentionally does not broaden into `sync` or `target clean`; those remain the next explicit upgrade-execution evidence gap.
- Rollback is limited to the listed script/config files and the associated review, architecture, execution-card, and release writebacks.

