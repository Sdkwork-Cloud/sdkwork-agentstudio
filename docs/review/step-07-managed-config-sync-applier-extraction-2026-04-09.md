# Step 07 Managed Config Sync Applier Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the managed-config draft sync setter bridges out of `InstanceDetail.tsx`
  - preserve the existing six `useEffect(...)` ownership and dependency boundaries in the page
  - keep page-owned state, setters, write authority, reload policy, and truth-source routing in the shell

## Root Cause

- After `release-2026-04-09-138`, `InstanceDetail.tsx` still kept six repetitive managed-config sync effects inline for:
  - `managedWebSearchConfig`
  - `managedAuthCooldownsConfig`
  - `managedDreamingConfig`
  - `managedXSearchConfig`
  - `managedWebSearchNativeCodexConfig`
  - `managedWebFetchConfig`
- Those effects were already pure page-side state-bridging logic:
  - derive shared form-state from the current managed config
  - fan the result into page-owned setter callbacks
  - clear the corresponding page error state
- The page still owned too much repeated bridge code even though the draft factories were already authoritative in shared helpers.
- The first contract rewrite for `webFetch` was also too broad and incorrectly forbade the page's valid `useState(...)` initializer call to `createOpenClawWebFetchDraftState(null).fallbackDraft`.

## Implemented Fix

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailManagedConfigSyncState.ts`.
- Added one dedicated sync applier per managed-config surface:
  - `applyInstanceDetailManagedWebSearchSyncState(...)`
  - `applyInstanceDetailManagedAuthCooldownsSyncState(...)`
  - `applyInstanceDetailManagedDreamingSyncState(...)`
  - `applyInstanceDetailManagedXSearchSyncState(...)`
  - `applyInstanceDetailManagedWebSearchNativeCodexSyncState(...)`
  - `applyInstanceDetailManagedWebFetchSyncState(...)`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the six existing effects now call those helpers instead of constructing draft state inline.
- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailManagedConfigSyncState.test.ts` with focused direct coverage proving each helper:
  - derives the correct draft state from the shared factory
  - clears the corresponding page-owned error state
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now enforces:
  - the page must call the six managed-config sync appliers
  - the page must pass setter ownership into those helpers
  - the managed `webFetch` sync effect must not recreate `createOpenClawWebFetchDraftState(...)` inline
  - the page may still use `createOpenClawWebFetchDraftState(null).fallbackDraft` for its initial `useState(...)` baseline
- Restored the missing `createOpenClawWebFetchDraftState` import in `InstanceDetail.tsx` after fresh web lint exposed the follow-up initializer regression.

## Boundary Decision

- `instanceDetailManagedConfigSyncState.ts` owns only pure sync-state bridging:
  - read the authoritative shared draft factories
  - apply the results through injected page-owned setter callbacks
  - clear page-owned error state
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all actual setters
  - all `instanceService.*` write callbacks
  - all `toast.*` dispatch
  - all `loadWorkbench(...)` authority
  - readonly gating, truth-source routing, navigation, dialogs, and effect ownership
- This loop does not move any runtime I/O, transport calls, Local Proxy ownership, Provider Center truth, or desktop/plugin bootstrap boundaries.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-agentstudio-pc-market/src/services/marketService.ts`
- `packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for browser-backed OpenClaw workbench persistence, Provider Center managed-route truth, market and install flows, local proxy projection, and desktop runtime/plugin registration. This loop only centralizes page-side managed-config draft synchronization for already-authoritative shared factories.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1297`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailManagedConfigSyncState.ts`: `106`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately prior `1401` page baseline from `release-2026-04-09-138`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1297`. This loop records another verified page-side reduction while moving the remaining managed-config sync setter bridges into a dedicated helper.

- Fresh build evidence:
  - `InstanceDetail-DVHUn05d.js`: `178.17 kB`
  - `InstanceConfigWorkbenchPanel-3yxDTn4F.js`: `63.32 kB`
  - `InstanceDetailFilesSection-DcVlwd9r.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailManagedConfigSyncState.test.ts`
  - failed first with `ERR_MODULE_NOT_FOUND` because `instanceDetailManagedConfigSyncState.ts` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first with `ENOENT` because the new helper file did not exist yet
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailManagedConfigSyncState.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the next high-value pure page-side managed-config sync bridge, but Step 07 is still not closed.

## Next Frontier

- Keep shrinking `InstanceDetail.tsx` through the remaining page-side state orchestration hotspots after the managed-config sync cluster.
- Preserve the same rule:
  - pure sync-state bridging, reset-state bridging, prop shaping, and presentation composition may move out
  - mutation authority, reload policy, truth-source routing, and runtime side effects stay in the page shell
