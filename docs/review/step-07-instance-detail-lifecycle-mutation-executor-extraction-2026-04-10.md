# Step 07 Instance Detail Lifecycle Mutation Executor Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned lifecycle mutation executors out of `InstanceDetail.tsx`
  - keep lifecycle orchestration, reload behavior, console actions, delete flow, and user-facing feedback page-owned while centralizing the repeated `instanceService` adapter family

## Root Cause

- After `release-2026-04-10-156`, the current dirty worktree still kept one coherent `instanceService` binding family in `InstanceDetail.tsx` for the lifecycle handler builder:
  - `executeRestart`
  - `executeStop`
  - `executeStart`
- Those wrappers did not own lifecycle request construction, reload behavior, toast/error reporting, console access, or delete flow:
  - they only adapted the page-owned `instanceService` surface into the `buildInstanceLifecycleActionHandlers(...)` callback contract
  - the actual lifecycle orchestration still lived in `instanceLifecycleActionSupport.ts`
- That made them a good `157` candidate: the wrapper family was repetitive, page-owned, and stable enough to extract without widening the lifecycle boundary.

## Implemented Fix

- Added `packages/sdkwork-clawstudio-instances/src/services/instanceDetailLifecycleMutationSupport.ts`.
- Added `createInstanceDetailLifecycleMutationExecutors(...)` so the shared helper now owns only:
  - lifecycle restart executor binding
  - lifecycle stop executor binding
  - lifecycle start executor binding
- Added focused direct coverage in `packages/sdkwork-clawstudio-instances/src/services/instanceDetailLifecycleMutationSupport.test.ts`.
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `lifecycleMutationExecutors` once through `createInstanceDetailLifecycleMutationExecutors({ instanceService })`
  - spreads that executor bundle into `buildInstanceLifecycleActionHandlers(...)`
  - stops keeping three inline lifecycle `instanceService` executor wrappers in the page shell
- Exported the new helper from `packages/sdkwork-clawstudio-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailLifecycleMutationExecutors(...)`
  - the lifecycle handler builder to consume `...lifecycleMutationExecutors`
  - the page to stop keeping inline lifecycle executor wrappers
  - the shared helper to stay free of toast, navigation, and reload authority

## Boundary Decision

- `instanceDetailLifecycleMutationSupport.ts` now owns only shared service-executor composition for the lifecycle handler contract.
- `InstanceDetail.tsx` still explicitly owns:
  - the real `instanceService` dependency
  - the choice to expose lifecycle executors to the handler builder
  - all lifecycle request construction, reload behavior, toast reporting, console access, delete flow, truth-source routing, and broader page control
- The helper still does not own:
  - lifecycle orchestration
  - reload behavior
  - console access
  - delete flow
  - navigation
  - user-facing toast feedback

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side lifecycle executor binding layer.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1065` lines / `40293` bytes
- `packages/sdkwork-clawstudio-instances/src/services/instanceDetailLifecycleMutationSupport.ts`: `22` lines / `917` bytes
- `packages/sdkwork-clawstudio-instances/src/services/instanceDetailLifecycleMutationSupport.test.ts`: `58` lines / `1712` bytes

Relative to the immediately prior `1063` page baseline from `release-2026-04-10-156`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1065`. This loop records a verified boundary improvement for the shared lifecycle executor family while also documenting that the broader page baseline has shifted again in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1065`
  - `instanceDetailLifecycleMutationSupport.ts`: `22`
  - `instanceDetailManagedChannelMutationSupport.ts`: `22`
  - `instanceDetailAgentMutationSupport.ts`: `24`
  - `instanceDetailAgentSkillMutationSupport.ts`: `22`
  - `instanceDetailProviderCatalogMutationSupport.ts`: `44`
  - `instanceDetailConsoleErrorSupport.ts`: `22`
  - `instanceDetailReloadSupport.ts`: `30`
  - `instanceDetailSectionAvailabilitySupport.ts`: `34`
  - `instanceDetailNavigationSupport.ts`: `42`
  - `instanceLifecycleActionSupport.ts`: `165`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- Fresh build evidence:
  - `InstanceDetail-CI3cO9q_.js`: `176.33 kB`
  - `InstanceConfigWorkbenchPanel-ChyP7aeU.js`: `63.33 kB`
  - `InstanceDetailFilesSection-BryJrg_d.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceDetailLifecycleMutationSupport.test.ts`
  - failed first because `instanceDetailLifecycleMutationSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline lifecycle executor wrappers
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceDetailLifecycleMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/clawstudio-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version
  - `pnpm.cmd build` prints a non-blocking Rolldown plugin timing warning; the build still exits successfully

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-owned lifecycle executor wrapper family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1065`-line `InstanceDetail.tsx` baseline before selecting `158`.
- Favor only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Prefer the next smallest page-owned service-adapter family instead of widening this helper beyond lifecycle executor binding.
