> Migrated from `docs/review/step-07-instance-detail-console-error-reporter-extraction-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Console Error Reporter Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned `console.error(...)` reporter wrappers out of `InstanceDetail.tsx`
  - keep the global console dependency and all real load authority page-owned while centralizing repeated failure-prefix binding

## Root Cause

- After `release-2026-04-10-151`, the current dirty worktree still kept one coherent wrapper family in `InstanceDetail.tsx`:
  - `loadWorkbench(...)` still logged `Failed to fetch instance workbench:`
  - the agent workbench loader still rebound `Failed to load agent workbench:`
  - the files and memories lazy loaders still rebound `Failed to load instance files:` and `Failed to load instance memories:`
- Those wrappers did not own runtime truth or service authority:
  - they only prefixed an error message and forwarded the error object into the page-owned console surface
  - the real read authority stayed with injected `instanceWorkbenchService` and `agentWorkbenchService` calls plus the shared hydration helpers
- That made them a good `152` candidate: the wrapper family was repetitive, still page-owned, and stable enough for focused helper extraction without widening any runtime boundary.

## Implemented Fix

- Added `packages/sdkwork-claw-instances/src/services/instanceDetailConsoleErrorSupport.ts`.
- Added `createInstanceDetailConsoleErrorReporters(...)` so the shared helper now owns only:
  - workbench-load failure logging
  - agent-workbench failure logging
  - files lazy-load failure logging
  - memories lazy-load failure logging
- Added focused direct coverage in `packages/sdkwork-claw-instances/src/services/instanceDetailConsoleErrorSupport.test.ts`.
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `consoleErrorReporters` once through `createInstanceDetailConsoleErrorReporters({ console })`
  - routes the `loadWorkbench(...)` catch branch through `consoleErrorReporters.reportWorkbenchLoadError(...)`
  - routes agent/files/memories hydration `reportError` bindings through the shared helper instead of inline `console.error(...)` wrappers
- Exported the new helper from `packages/sdkwork-claw-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailConsoleErrorReporters(...)`
  - the page to stop keeping inline workbench, agent, files, and memories `console.error(...)` wrappers
  - the hydration and load paths to route through `consoleErrorReporters`
  - the shared helper to stay free of `instanceService`, navigation, and reload authority

## Boundary Decision

- `instanceDetailConsoleErrorSupport.ts` now owns only shared message-prefixed console-error forwarding for the remaining page-owned load paths.
- `InstanceDetail.tsx` still explicitly owns:
  - the global `console` dependency
  - the choice to wire failure logging into each load path
  - all service-loader authority
  - all mutation authority, navigation, dialogs, toasts, truth-source routing, reload behavior, and lifecycle control
- The helper still does not own:
  - transport access
  - instance mutation authority
  - navigation
  - reload behavior
  - user-facing toast feedback

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side console error reporter binding layer.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1011` lines / `41365` bytes
- `packages/sdkwork-claw-instances/src/services/instanceDetailConsoleErrorSupport.ts`: `20` lines / `831` bytes
- `packages/sdkwork-claw-instances/src/services/instanceDetailConsoleErrorSupport.test.ts`: `46` lines / `1714` bytes

Relative to the immediately prior `1064` page baseline from `release-2026-04-10-151`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1011`. This loop records a verified boundary improvement for the shared console error reporter family while also documenting that the broader page baseline has shifted again in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1011`
  - `instanceDetailConsoleErrorSupport.ts`: `20`
  - `instanceDetailReloadSupport.ts`: `26`
  - `instanceDetailSectionAvailabilitySupport.ts`: `30`
  - `instanceDetailNavigationSupport.ts`: `37`
  - `instanceLifecycleActionSupport.ts`: `150`
  - `instanceWorkbenchServiceCore.ts`: `1032`
  - `instanceServiceCore.ts`: `1274`
- Fresh build evidence:
  - `InstanceDetail-D9LWttFL.js`: `177.06 kB`
  - `InstanceConfigWorkbenchPanel-TT8xdRhq.js`: `63.33 kB`
  - `InstanceDetailFilesSection-Da_Dg1BG.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceDetailConsoleErrorSupport.test.ts`
  - failed first because `instanceDetailConsoleErrorSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline `console.error(...)` reporter wrappers
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceDetailConsoleErrorSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/claw-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version
  - `pnpm.cmd build` prints a non-blocking Rolldown plugin timing warning; the build still exits successfully

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-owned console error reporter wrapper family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1011`-line `InstanceDetail.tsx` baseline before selecting `153`.
- Favor only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Avoid widening the console helper into a generic logger unless another stable page-owned logging family appears.

