> Migrated from `docs/review/step-07-workbench-lazy-load-orchestration-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Workbench Lazy-Load Orchestration Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining file and memory lazy-load async orchestration out of `InstanceDetail.tsx`
  - keep real loader authority, page-owned setters, and error reporting in the page shell
  - centralize cancellation, merge, and loading-lifecycle behavior inside the existing hydration helper module

## Root Cause

- After `release-2026-04-09-139`, `InstanceDetail.tsx` still kept two remaining async hydration effect bodies inline for:
  - lazy file loading
  - lazy memory loading
- Those effects still repeated the same orchestration pattern:
  - guard on lazy-load eligibility
  - create a cancellation flag
  - flip the loading setter on
  - call the injected loader
  - merge the result back into the current workbench snapshot
  - report failures
  - clear the loading setter only when still active
- The page already consumed shared hydration decision and merge helpers from `instanceWorkbenchHydration.ts`, but it still owned the repetitive async bridge instead of routing that orchestration through the same shared module.

## Implemented Fix

- Extended `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.ts`.
- Added two shared orchestration entry points:
  - `startLazyLoadInstanceWorkbenchFiles(...)`
  - `startLazyLoadInstanceWorkbenchMemory(...)`
- The existing hydration module now owns:
  - lazy-load eligibility checks
  - cancellation guard orchestration
  - merge application back into the current workbench snapshot
  - loading-state lifecycle while the request remains active
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the two lazy-load effects now call those helpers instead of manually:
  - creating `cancelled`
  - toggling the loading flags inline
  - calling `mergeLazyLoadedWorkbenchFiles(...)` and `mergeLazyLoadedWorkbenchMemories(...)` inline
- The page still injects the real authority:
  - `loadFiles: (instanceId, agents) => instanceWorkbenchService.listInstanceFiles(instanceId, agents)`
  - `loadMemories: (instanceId, agents) => instanceWorkbenchService.listInstanceMemories(instanceId, agents)`
  - `setWorkbench`
  - `setIsWorkbenchFilesLoading`
  - `setIsWorkbenchMemoryLoading`
  - page-owned `console.error(...)` reporters
- Expanded `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.test.ts` with direct coverage proving:
  - files hydrate through the injected loader and merge back into the current workbench
  - memory failures route through the injected error reporter and restore loading when active
  - cancellation suppresses post-resolution merge and loading reset
- Updated `scripts/run-sdkwork-instances-check.mjs` so the hydration helper test now runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to call the two new lazy-load helpers
  - the page to inject the real file and memory loaders
  - the page to inject loading setters, `setWorkbench`, and error reporters
  - `instanceWorkbenchHydration.ts` to own the lazy-load guard and merge orchestration
  - the helper to stay free of `instanceWorkbenchService`, `toast`, and `loadWorkbench(...)`

## Boundary Decision

- `instanceWorkbenchHydration.ts` now owns only shared async hydration orchestration:
  - decide whether lazy loading should start
  - manage cancellation and loading-lifecycle flow
  - merge hydrated results back into the current snapshot through injected setter ownership
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all actual setters
  - the real `instanceWorkbenchService.listInstanceFiles(...)` and `.listInstanceMemories(...)` entry points
  - all error reporting policy
  - all `loadWorkbench(...)` authority
  - readonly gating, truth-source routing, navigation, dialogs, and write-path ownership
- This loop does not move runtime I/O ownership, transport routing, Local Proxy projection, Provider Center truth, or desktop/plugin bootstrap boundaries.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for browser-backed OpenClaw workbench persistence, managed-route truth, market and skill-install flows, local proxy projection, and desktop runtime/plugin registration. This loop only centralizes page-side lazy-load orchestration for already-authoritative workbench hydration loaders.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1251`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.ts`: `222`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately prior `1297` page baseline from `release-2026-04-09-139`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1251`. This loop records another verified page-side reduction while moving the remaining lazy-load async orchestration into the shared hydration helper.

- Fresh build evidence:
  - `InstanceDetail-CeMwRuSz.js`: `178.00 kB`
  - `InstanceConfigWorkbenchPanel-DjkZ4z1l.js`: `63.32 kB`
  - `InstanceDetailFilesSection-BM8lkLhr.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.test.ts`
  - failed first because `instanceWorkbenchHydration.ts` did not yet export `startLazyLoadInstanceWorkbenchFiles`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` did not yet route the lazy-load effects through the new helper
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.test.ts`
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

This loop closes the next remaining async hydration orchestration bridge, but Step 07 is still not closed.

## Next Frontier

- Continue shrinking `InstanceDetail.tsx` through the next remaining page-side orchestration hotspot after the lazy-load async cluster.
- Preserve the same rule:
  - pure async orchestration, reset-state bridging, prop shaping, and presentation composition may move out
  - truth-source routing, write authority, and runtime side effects stay in the page shell

