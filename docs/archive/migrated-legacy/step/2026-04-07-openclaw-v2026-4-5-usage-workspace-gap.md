# OpenClaw v2026.4.5 Usage Workspace Gap Closure

> Correction on 2026-04-07: the public GitHub Releases baseline re-check showed latest stable
> OpenClaw is `v2026.4.2` released on `2026-04-02`, not `v2026.4.5`. This file is retained only as
> a historical implementation log from a stale audit target. Use
> `docs/step/2026-04-07-openclaw-public-release-baseline-correction.md` as the current baseline
> truth.

## Objective

Close the next real OpenClaw parity gap in local `claw-studio`: the shared `usage` workspace.

This loop kept the host architecture unified:

- business logic in `packages/sdkwork-claw-dashboard`
- shell wiring in `packages/sdkwork-claw-shell`
- locale wiring in `packages/sdkwork-claw-i18n`
- no web-only or desktop-only usage implementation forks

## Upstream Evidence

Verified against bundled upstream source snapshots:

- `.cache/bundled-components/upstreams/openclaw/ui/src/ui/controllers/usage.ts`
- `.cache/bundled-components/upstreams/openclaw/ui/src/ui/app-render-usage-tab.ts`
- `.cache/bundled-components/upstreams/openclaw/src/shared/usage-types.ts`
- `.cache/bundled-components/upstreams/openclaw/src/shared/session-usage-timeseries-types.ts`

Confirmed locally that transport support already existed in:

- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`

Available gateway methods already covered:

- `getGatewaySessionUsage`
- `getUsageCost`
- `getGatewaySessionUsageTimeseries`
- `getGatewaySessionUsageLogs`

## Gap Before Landing

Before this loop, local source had a real parity hole:

1. no shared `/usage` route in shell
2. no usage sidebar entry
3. no usage command palette action
4. no settings visibility toggle for usage
5. no shared dashboard usage workspace page
6. no dashboard contract coverage for the new surface
7. no route-surface approval for `/usage`

The partially written `packages/sdkwork-claw-dashboard/src/pages/UsageWorkspace.tsx` also left the workspace uncompilable.

## TDD Record

Red state was already captured before implementation:

- `packages/sdkwork-claw-dashboard/src/services/usageWorkspaceService.test.ts`
- `packages/sdkwork-claw-dashboard/src/pages/usageWorkspacePageComposition.test.ts`

Observed red reasons:

- missing `usageWorkspaceService.ts`
- missing `Usage.tsx`
- missing `UsageWorkspace.tsx`

Green closure in this loop was verified through the repo runner:

- `node scripts/run-sdkwork-dashboard-check.mjs`

## Problems Found During Landing

### 1. Incomplete shared page implementation

Problem:

- `UsageWorkspace.tsx` stopped after initial state declarations.

Fix:

- completed the shared React page
- kept data loading in `usageWorkspaceService`
- rendered:
  - instance selection
  - date range and timezone selection
  - compatibility fallback state
  - session table
  - daily breakdown
  - session detail
  - session timeline
  - session logs

### 2. Missing package dependency declaration

Problem:

- `sdkwork-claw-dashboard` imported `@sdkwork/claw-i18n` but did not declare it.

Fix:

- added `@sdkwork/claw-i18n` to `packages/sdkwork-claw-dashboard/package.json`

### 3. Shell surface drift

Problem:

- usage workspace existed nowhere in the shared shell surface.

Fix:

- added lazy route and route constant
- added sidebar item
- added command palette navigation command
- added sidebar prefetch entry
- added settings visibility item

### 4. UI contract regression

Problem:

- initial landing used native `<select>` and `<input>` controls
- workspace-wide `sdkwork-ui` contract forbids that outside the shared UI package

Fix:

- replaced native controls with shared primitives:
  - `Select`
  - `SelectTrigger`
  - `SelectContent`
  - `SelectItem`
  - `SelectValue`
  - `Input`
  - `DateInput`

### 5. Type cleanliness issue

Problem:

- `select` value accepted `null`, which broke workspace TSC in `pnpm lint`

Fix:

- normalized the select value to `activeInstanceId ?? ''`

### 6. Verification false negative caused by parallelism

Problem:

- `sync:locales` and `packages/sdkwork-claw-i18n/src/index.test.ts` were first run in parallel
- the test raced against stale aggregate locale files

Fix:

- reran locale sync and i18n verification in canonical sequence
- classified the first failure as verification sequencing noise, not product logic failure

## Files Landed

### Dashboard

- `packages/sdkwork-claw-dashboard/package.json`
- `packages/sdkwork-claw-dashboard/src/Usage.tsx`
- `packages/sdkwork-claw-dashboard/src/index.ts`
- `packages/sdkwork-claw-dashboard/src/pages/UsageWorkspace.tsx`
- `packages/sdkwork-claw-dashboard/src/pages/usageWorkspacePageComposition.test.ts`
- `packages/sdkwork-claw-dashboard/src/services/index.ts`
- `packages/sdkwork-claw-dashboard/src/services/usageWorkspaceService.ts`
- `packages/sdkwork-claw-dashboard/src/services/usageWorkspaceService.test.ts`
- `packages/sdkwork-claw-dashboard/src/types/index.ts`
- `packages/sdkwork-claw-dashboard/src/types/usage.ts`

### Shell / Settings

- `packages/sdkwork-claw-shell/src/application/router/AppRoutes.tsx`
- `packages/sdkwork-claw-shell/src/application/router/routePaths.ts`
- `packages/sdkwork-claw-shell/src/application/router/routePrefetch.ts`
- `packages/sdkwork-claw-shell/src/components/Sidebar.tsx`
- `packages/sdkwork-claw-shell/src/components/commandPaletteCommands.ts`
- `packages/sdkwork-claw-settings/src/GeneralSettings.tsx`

### I18n

- `packages/sdkwork-claw-i18n/src/locales/en/commandPalette.json`
- `packages/sdkwork-claw-i18n/src/locales/en/dashboard.json`
- `packages/sdkwork-claw-i18n/src/locales/en/sidebar.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/index.ts`

### Contracts / Checks

- `scripts/check-sdkwork-claw-route-surface.mjs`
- `scripts/run-sdkwork-dashboard-check.mjs`
- `scripts/sdkwork-dashboard-contract.test.ts`
- `scripts/sdkwork-shell-contract.test.ts`
- `package.json`

## Verification

Fresh commands run in this loop:

- `pnpm.cmd --filter @sdkwork/claw-i18n sync:locales`
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
- `node scripts/run-sdkwork-dashboard-check.mjs`
- `pnpm.cmd check:sdkwork-dashboard`
- `pnpm.cmd check:sdkwork-shell`
- `pnpm.cmd check:i18n`
- `pnpm.cmd check:sdkwork-routes`
- `pnpm.cmd lint`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:server`
- `pnpm.cmd build`

Result:

- all passed after fixing the `null` select value and replacing native form controls with shared UI primitives

## Result Assessment

### Closed in this loop

1. Local app now has a real shared `/usage` workspace.
2. The usage workspace is reachable from shared shell navigation instead of being hidden behind a package-local export only.
3. The OpenClaw date-interpretation compatibility fallback is surfaced through the shared usage service and UI.
4. Desktop and web keep consuming one shared usage architecture.
5. Route, dashboard, shell, i18n, desktop, server, and workspace-level checks all stayed green after the landing.

### Honest remaining gaps versus upstream

This landing is strong, but not full upstream UI parity yet.

Still not fully mirrored from upstream usage tab:

1. advanced day/hour/session multi-selection flows
2. query draft/apply/clear workflow
3. chart-mode and daily-chart-mode switching
4. column-visibility tuning
5. session-log role/tool filters
6. pinned-header and context-expansion controls

Classification:

- source architecture: aligned for the shared usage workspace landing
- UI behavior parity: partially aligned

## Recommended Next Loop

Best next iteration for this area:

1. move the current first landing from summary-first to analysis-first by adding upstream-style session/day/hour filtering
2. add chart-mode and daily-breakdown mode toggles from upstream usage semantics
3. add session log filters and visible-column configuration
4. keep every addition inside `sdkwork-claw-dashboard` and shared shell surfaces only

## Multi-Mode Impact

This loop did not create host-specific divergence.

Validated shared-mode impact:

- web: covered by `pnpm.cmd lint`, `pnpm.cmd build`
- desktop: covered by `pnpm.cmd check:desktop`
- server: covered by `pnpm.cmd check:server`
- docker/k8s release-contract scope: indirectly covered through the broader `pnpm.cmd lint` parity and automation suite

Remaining live-environment truth:

- real packaged desktop launch on a target machine
- real container boot
- real kubernetes deployment boot

Those remain environment-bound and were not falsely claimed as executed here.
