> Migrated from `docs/review/step-07-instance-detail-toast-reporter-extraction-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Toast Reporter Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned `toast.success/error/info` reporter wrappers out of `InstanceDetail.tsx`
  - keep notification authority page-owned while centralizing repeated reporter binding

## Root Cause

- After `release-2026-04-10-150`, the current dirty worktree still kept a coherent page-owned wrapper family in `InstanceDetail.tsx`:
  - provider, agent-skill, agent, lifecycle, delete, managed-channel, and managed-config flows all re-bound `toast.success(...)`
  - multiple paths still re-bound `toast.error(...)`
  - the console path still re-bound `toast.info(...)`
- Those wrappers did not own runtime or mutation truth:
  - they only forwarded string messages into the imported toast surface
  - the actual mutation/lifecycle/console authority stayed elsewhere
- That made them a good `151` target because they form a stable shared contract: page-owned feedback reporters with no transport or navigation authority.

## Implemented Fix

- Added `packages/sdkwork-claw-instances/src/services/instanceDetailToastSupport.ts`.
- Added `createInstanceDetailToastReporters(...)` so the shared helper now owns only:
  - `reportSuccess(message)` forwarding into the injected toast surface
  - `reportError(message)` forwarding into the injected toast surface
  - `reportInfo(message)` forwarding into the injected toast surface
- Added focused direct coverage in `packages/sdkwork-claw-instances/src/services/instanceDetailToastSupport.test.ts`.
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `toastReporters` once through `createInstanceDetailToastReporters({ toast })`
  - routes all relevant runner/handler `reportSuccess` / `reportError` / `reportInfo` bindings through that shared helper
  - stops keeping inline `toast.success/error/info` wrappers in the page shell
- Exported the new helper from `packages/sdkwork-claw-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailToastReporters(...)`
  - the page to stop keeping inline `toast.success/error/info` wrappers
  - provider, agent, lifecycle, console, delete, managed-channel, and managed-config feedback paths to route through `toastReporters`
  - the shared helper to stay free of `instanceService`, navigation, and reload authority

## Boundary Decision

- `instanceDetailToastSupport.ts` now owns only shared toast-reporter composition for:
  - success message forwarding
  - error message forwarding
  - info message forwarding
- `InstanceDetail.tsx` still explicitly owns:
  - the imported `toast` dependency
  - the choice to wire feedback into each runner/handler
  - all mutation authority, navigation, dialogs, truth-source routing, reload behavior, and lifecycle control
- The helper still does not own:
  - transport access
  - instance mutation authority
  - delete/confirm flows
  - navigation
  - reload behavior

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-claw-channels/src/services/channelService.ts`
- `packages/sdkwork-claw-market/src/services/marketService.ts`
- `packages/sdkwork-claw-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side toast reporter binding layer.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1064` lines / `41287` bytes
- `packages/sdkwork-claw-instances/src/services/instanceDetailToastSupport.ts`: `17` lines / `579` bytes
- `packages/sdkwork-claw-instances/src/services/instanceDetailToastSupport.test.ts`: `53` lines / `1474` bytes

Relative to the immediately prior `1060` page baseline from `release-2026-04-10-150`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1064`. This loop records a verified boundary improvement for the shared toast reporter family while also documenting that the broader page baseline increased slightly in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1064`
  - `instanceDetailToastSupport.ts`: `17`
  - `instanceDetailReloadSupport.ts`: `30`
  - `instanceDetailSectionAvailabilitySupport.ts`: `34`
  - `instanceDetailNavigationSupport.ts`: `42`
  - `instanceLifecycleActionSupport.ts`: `165`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- Fresh build evidence:
  - `InstanceDetail-CIO8VtU-.js`: `177.12 kB`
  - `InstanceConfigWorkbenchPanel-R9LGj4E2.js`: `63.33 kB`
  - `InstanceDetailFilesSection-DExMSe6A.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceDetailToastSupport.test.ts`
  - failed first because `instanceDetailToastSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline toast reporter wrappers
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceDetailToastSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/claw-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version
  - `pnpm.cmd build` prints a non-blocking Rolldown plugin timing warning while still succeeding

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-owned toast reporter wrapper family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1064`-line `InstanceDetail.tsx` baseline before selecting `152`.
- Prioritize only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Treat broad hotspot drift as current truth; do not compare against older smaller baselines once the current dirty worktree has moved.

