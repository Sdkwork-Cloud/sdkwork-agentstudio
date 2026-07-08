# Step 07 Managed Config Mutation Handler Builder Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining managed-config save handler construction cluster from `InstanceDetail.tsx`
  - keep the real `instanceService.saveOpenClaw*Config(...)` write path, `toast` dispatch, `loadWorkbench(...)` authority, readonly routing, and page-owned form/error/saving state in the page shell

## Root Cause

- After the earlier managed-config draft and runner extractions, `InstanceDetail.tsx` still owned six closely related save handlers:
  - `handleSaveWebSearchConfig(...)`
  - `handleSaveXSearchConfig(...)`
  - `handleSaveWebSearchNativeCodexConfig(...)`
  - `handleSaveWebFetchConfig(...)`
  - `handleSaveAuthCooldownsConfig(...)`
  - `handleSaveDreamingConfig(...)`
- That cluster still repeated the same page-local pattern:
  - guard on `instanceId` and the active draft surface
  - build or validate the save input
  - map validation failures back into page-owned error state
  - route the finalized save into `runManagedConfigSave(...)`
- The page did not need to keep that request shaping inline as long as:
  - the real `instanceService.saveOpenClaw*Config(...)` calls stayed page-owned and injected
  - `runManagedConfigSave(...)` stayed page-owned with its `toast.success(...)` and `loadWorkbench(...)` bridges
  - readonly/truth-source routing and page state ownership stayed in `InstanceDetail.tsx`

## Implemented Fix

- Extended `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts` with:
  - `BuildOpenClawManagedConfigMutationHandlersArgs`
  - `buildOpenClawManagedConfigMutationHandlers(...)`
- Added focused RED/GREEN coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - constructs one shared `managedConfigMutationHandlers`
  - injects the real page-owned `instanceService.saveOpenClaw*Config(...)` callbacks into that builder
  - keeps all draft-change handlers, page state containers, and `runManagedConfigSave(...)` creation in the page shell
  - passes the shared handler bundle down to the managed memory/tools sections instead of keeping six inline save handlers
- Updated `scripts/sdkwork-instances-contract.test.ts` so the page contract now requires:
  - one shared managed-config mutation handler builder
  - page-owned save callbacks injected into that builder
  - no drift back to the six inline save handlers inside `InstanceDetail.tsx`

## Boundary Decision

- `openClawManagedConfigMutationSupport.ts` now owns:
  - per-surface managed-config save handler construction
  - managed-config request shaping for:
    - webSearch
    - xSearch
    - native Codex web search
    - webFetch
    - auth cooldowns
    - dreaming
  - translation of validation failures into page-consumable error messages before the shared runner executes
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all draft-change handlers
  - all `instanceService.saveOpenClaw*Config(...)` callbacks
  - the shared `runManagedConfigSave(...)` runner with page-owned `toast.success(...)` and `loadWorkbench(...)` authority
  - readonly and truth-source routing decisions

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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider routing, Local Proxy ownership, default-agent install targets, and desktop plugin/runtime registration. This loop only centralizes managed-config save handler construction.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1416`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts`: `338`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`
- Fresh build evidence:
  - `InstanceDetail-CiQXJyxQ.js`: `177.52 kB`
  - `InstanceConfigWorkbenchPanel-z1ow0i3W.js`: `63.32 kB`
  - `InstanceDetailFilesSection-BLTjOn7c.js`: `2.38 kB`

Relative to the immediately prior `1504` page baseline from the managed-channel runner note, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1416`. This loop records both a verified boundary improvement and a fresh current-worktree hotspot re-baseline.

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.test.ts`
  - failed first because `buildOpenClawManagedConfigMutationHandlers(...)` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the six inline managed-config save handlers
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/clawstudio-web lint`
  - `pnpm.cmd build`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially reduces the remaining page-side managed-config orchestration hotspot, but Step 07 is still not closed.

## Next Frontier

- Keep shrinking `InstanceDetail.tsx` through remaining page-side transient and navigation bundles only.
- Preserve the current rule:
  - shared request shaping and injected handler construction may move out
  - real write paths, reload authority, truth-source routing, and side effects stay in the page shell
