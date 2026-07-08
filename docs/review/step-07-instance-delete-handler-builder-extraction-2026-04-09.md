# Step 07 Instance Delete Handler Builder Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining instance-delete destructive-flow wrapper out of `InstanceDetail.tsx`
  - keep the real `instanceService.deleteInstance(...)`, page-owned `toast.*`, browser confirm, active-instance state, navigation authority, readonly/truth-source gating, and shell ownership in the page

## Root Cause

- After `release-2026-04-09-145`, `InstanceDetail.tsx` still owned one coherent destructive-flow wrapper:
  - guard `id` and `canDelete`
  - show the uninstall confirmation prompt
  - call `instanceService.deleteInstance(...)`
  - show success or failure toast messages
  - clear the active instance when the deleted instance matched it
  - navigate back to `/instances`
- That closure did not own the real authority surfaces itself:
  - the page still owned the real `instanceService.deleteInstance(...)` callback
  - the page still owned the browser confirm bridge, `toast.*`, `setActiveInstanceId(...)`, and `navigate(...)`
- The page also still carried one dead task-workspace navigation wrapper that no longer had any call sites, so the next smallest coherent cleanup was to centralize the delete handler and remove the dead navigation closure.

## Implemented Fix

- Extended `packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.ts`.
- Added `buildInstanceDeleteHandler(...)` so the shared helper now owns:
  - delete eligibility guarding
  - translated uninstall confirmation prompt routing through the injected browser confirmer
  - injected delete execution orchestration
  - translated success and fallback error routing through injected page reporters
  - active-instance clear routing when the deleted instance was the active one
  - post-delete navigation through the injected page-owned navigator
- Added focused direct coverage in `packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.test.ts`.
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `deleteHandler`
  - passes `onDelete={deleteHandler}` into `InstanceDetailHeader`
  - removes the inline `handleDelete` wrapper
  - removes the dead unused `openTaskWorkspace` closure
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `buildInstanceDeleteHandler(...)`
  - the page to stop keeping `handleDelete` inline
  - the page to stop carrying the dead `openTaskWorkspace` wrapper
  - the shared helper to stay free of direct `instanceService`, `toast`, `navigate(...)`, and `window.confirm(...)` authority

## Boundary Decision

- `instanceLifecycleActionSupport.ts` now owns only page-side destructive-flow handler composition for:
  - delete guard shaping
  - confirmation prompt routing
  - injected delete execution sequencing
  - active-instance clear routing
  - success and fallback error mapping
  - post-delete navigation routing
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers and setters
  - the real `instanceService.deleteInstance(...)`
  - the real browser `window.confirm(...)` bridge
  - page-owned `toast.success(...)` and `toast.error(...)`
  - `navigate(...)`, truth-source routing, readonly gating, dialogs, and all write-path authority

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
- `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for browser-backed workbench persistence, lifecycle readiness, managed-config writability, provider-center projection, Local Proxy routing/projection, and desktop plugin/runtime registration. This loop only centralizes the remaining page-side instance-delete destructive-flow handler composition and removes a dead navigation wrapper.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `991` lines / `40887` bytes
- `packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.ts`: `150` lines / `5218` bytes
- `packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.test.ts`: `364` lines / `12302` bytes

Relative to the immediately prior `1006` page baseline from `release-2026-04-09-145`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `991`. This loop removes the remaining inline instance-delete destructive-flow wrapper from the page, cleans out the dead task-workspace closure, and records another small but verified page reduction.

- Fresh build evidence:
  - `InstanceDetail-CSlA3mgV.js`: `176.98 kB`
  - `InstanceConfigWorkbenchPanel-BBx3G-_M.js`: `63.32 kB`
  - `InstanceDetailFilesSection-DrzbmVik.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.test.ts`
  - failed first because `buildInstanceDeleteHandler(...)` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the inline delete wrapper and did not build `deleteHandler`
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/clawstudio-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining instance-delete destructive-flow wrapper, but Step 07 is still not closed.

## Next Frontier

- Continue shrinking `InstanceDetail.tsx` through the next remaining page-side orchestration hotspot after the delete-flow cleanup.
- The most likely remaining candidates are:
  - section-availability wrapper composition
  - residual navigation closures like back-to-instances or provider-center routing
  - any remaining page-local handler that only packages injected authority without owning the real mutation or navigation surface
