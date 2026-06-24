# OpenClaw v2026.4.5 Usage Filter State Parity

> Correction on 2026-04-07: the public GitHub Releases baseline re-check showed latest stable
> OpenClaw is `v2026.4.2` released on `2026-04-02`, not `v2026.4.5`. This file is retained only as
> a historical implementation log from a stale audit target. Use
> `docs/step/2026-04-07-openclaw-public-release-baseline-correction.md` as the current baseline
> truth.

## Objective

Close the next real OpenClaw parity gap inside the shared `usage` workspace after the route/page landing:

1. upstream-style query and selection behavior had already been implemented in `sdkwork-claw-dashboard`
2. the remaining red state was now in parity contracts and zh usage localization quality
3. this loop needed to keep the unified architecture intact across web, desktop, server, docker, and k8s oriented validation paths

## Upstream Review Basis

Rechecked against bundled upstream OpenClaw usage sources:

- `.cache/bundled-components/upstreams/openclaw/ui/src/ui/controllers/usage.ts`
- `.cache/bundled-components/upstreams/openclaw/ui/src/ui/app-render-usage-tab.ts`
- `.cache/bundled-components/upstreams/openclaw/ui/src/ui/views/usage.ts`
- `.cache/bundled-components/upstreams/openclaw/ui/src/ui/views/usageTypes.ts`
- `.cache/bundled-components/upstreams/openclaw/ui/src/ui/views/usage-render-details.ts`
- `.cache/bundled-components/upstreams/openclaw/ui/src/ui/usage-helpers.ts`
- `.cache/bundled-components/upstreams/openclaw/ui/src/ui/views/usage-query.ts`

Confirmed that the local direction stayed correct:

- query parsing and suggestions belong in `packages/sdkwork-claw-dashboard/src/services`
- shift-range multi-select belongs in shared state logic, not shell-specific UI code
- log-role/tool/query filtering belongs in shared page/service composition
- host packages stay thin and only consume the shared dashboard feature surface

## Gap Before Fix

Two concrete issues remained after the previous landing:

### 1. Dashboard parity check was stale

The page had already moved to a grouped shared-services barrel import:

- `import { ..., usageWorkspaceService } from '../services';`

But the composition contract still required the old exact string:

- `import { usageWorkspaceService } from '../services';`

Result:

- `node scripts/run-sdkwork-dashboard-check.mjs`
- `pnpm.cmd check:sdkwork-dashboard`
- `pnpm.cmd lint`

all failed for an outdated contract, not for a real architecture regression.

### 2. zh usage strings were still corrupted

The new `usage` strings inside:

- `packages/sdkwork-claw-i18n/src/locales/zh/index.ts`

were a mix of mojibake and post-assignment patches. The runtime contract could limp through, but the localized surface was not shippable.

## TDD / Debugging Record

### Red

Observed fresh red states before code changes:

- `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/pages/usageWorkspacePageComposition.test.ts`
  - failed on the exact outdated import regex
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
  - failed after adding a focused zh usage readability assertion
  - actual `zh.sidebar.usage` value was mojibake rather than a readable Chinese string

### Root Cause

Root causes identified before fixing:

1. the dashboard contract encoded an obsolete import shape instead of the actual barrel-based architecture
2. the zh usage override block was not a complete, maintainable object and still contained corrupted strings

### Green

After the fixes below, both targeted red tests turned green:

- `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/pages/usageWorkspacePageComposition.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`

## Changes Landed

### 1. Usage composition contract updated to the real barrel boundary

Updated:

- `packages/sdkwork-claw-dashboard/src/pages/usageWorkspacePageComposition.test.ts`

What changed:

- replaced the brittle exact import assertion with a grouped barrel import assertion
- kept all meaningful contract checks:
  - page still imports from `../services`
  - page still references `usageWorkspaceService`
  - page still consumes `applyShiftRangeSelection`
  - page still consumes query and log filter helpers

Why this is the right fix:

- it preserves the architectural boundary
- it no longer punishes valid shared-barrel composition
- it avoids reintroducing subpath imports just to satisfy a stale test

### 2. zh usage locale override rewritten as one clean object

Updated:

- `packages/sdkwork-claw-i18n/src/locales/zh/index.ts`

What changed:

- replaced the corrupted `usage` override block with one complete, readable object
- removed the previous incremental post-assignment patching pattern
- corrected these usage-adjacent entry points too:
  - `locale.sidebar.usage`
  - `locale.commandPalette.commands.usage`

Why this is the right fix:

- the full object matches the current English usage shape in one place
- future keys can be reviewed structurally instead of scattered through follow-up assignments
- the user-facing shared `/usage` surface is no longer shipping broken Chinese copy for the newly landed feature

## Files Changed In This Loop

- `packages/sdkwork-claw-dashboard/src/pages/usageWorkspacePageComposition.test.ts`
- `packages/sdkwork-claw-i18n/src/index.test.ts`
- `packages/sdkwork-claw-i18n/src/locales/zh/index.ts`

## Verification

Fresh commands run after landing:

- `node --experimental-strip-types packages/sdkwork-claw-dashboard/src/pages/usageWorkspacePageComposition.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
- `pnpm.cmd --filter @sdkwork/claw-i18n sync:locales`
- `pnpm.cmd check:i18n`
- `pnpm.cmd check:sdkwork-dashboard`
- `pnpm.cmd lint`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:server`
- `pnpm.cmd build`

Result:

- all passed

## Result Assessment

### Closed in this loop

1. The shared usage workspace now passes its own parity contract with the current barrel-based architecture.
2. The newly landed zh usage surface is readable and structurally complete.
3. Web, desktop, server, release-contract, deployment-contract, and production build validation all stayed green after the fix.

### Honest Remaining Gaps

1. The broader zh split-resource tree still shows signs of systemic historical mojibake outside the usage-specific overrides fixed here.
2. This loop verified desktop/server/docker/k8s support through repo contracts and packaging/smoke test suites, not through live packaged launches of every platform artifact in the sandbox.
3. Usage chart-mode and daily-chart-mode parity with upstream OpenClaw remains partial; the meaningful shared filter/query/log behavior is now covered, but the chart surface is not yet a line-by-line upstream match.

## Next Best Follow-Up

The next high-value loop should target the broader zh locale corruption pattern as a workspace-level quality issue:

1. classify the encoding damage pattern across `packages/sdkwork-claw-i18n/src/locales/zh/*.json`
2. determine whether a deterministic source normalization pass can repair the split resources instead of relying on runtime overlays
3. add focused tests for a small cross-domain sample so future locale regressions fail fast
