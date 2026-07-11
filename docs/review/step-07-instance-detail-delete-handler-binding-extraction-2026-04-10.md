# Step 07 Instance Detail Delete Handler Binding Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned delete handler bindings out of `InstanceDetail.tsx`
  - keep delete orchestration, active-instance cleanup, toast/error reporting, and truth-source routing page-owned while centralizing the repeated host/service adapter family

## Root Cause

- After `release-2026-04-10-158`, the current dirty worktree still kept one coherent page-owned delete binding family inline in `InstanceDetail.tsx` for `buildInstanceDeleteHandler(...)`:
  - `confirmDelete`
  - `executeDelete`
  - `navigateToInstances`
- Those wrappers did not own delete orchestration, active-instance reset, toast reporting, translation, or failure handling:
  - they only adapted browser confirmation, `instanceService.deleteInstance(...)`, and list navigation into the shared delete handler contract
  - the actual delete orchestration still lived in `instanceLifecycleActionSupport.ts`
- That made them a good `159` candidate: the wrapper family was repetitive, page-owned, and stable enough to extract without widening the delete-flow boundary.

## Implemented Fix

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailDeleteSupport.ts`.
- Added `createInstanceDetailDeleteHandlerBindings(...)` so the shared helper now owns only:
  - browser confirm binding
  - instance delete executor binding
  - instance-list navigation binding
- Added focused direct coverage in `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailDeleteSupport.test.ts`.
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `deleteHandlerBindings` once through `createInstanceDetailDeleteHandlerBindings({ confirmDelete: window.confirm, navigate, instanceService })`
  - spreads that binding bundle into `buildInstanceDeleteHandler(...)`
  - stops keeping inline delete host/service wrappers in the page shell
- Exported the new helper from `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailDeleteHandlerBindings(...)`
  - the delete handler builder to consume `...deleteHandlerBindings`
  - the page to stop keeping inline `confirmDelete`, `executeDelete`, and `navigateToInstances` wrappers
  - the shared helper to stay free of active-instance reset and user-facing feedback authority

## Boundary Decision

- `instanceDetailDeleteSupport.ts` now owns only shared browser/service binding composition for the delete handler contract.
- `InstanceDetail.tsx` still explicitly owns:
  - the real `instanceService` dependency
  - the browser `navigate` authority it passes into the helper
  - the choice to expose delete bindings to the handler builder
  - `instanceId`, `canDelete`, `activeInstanceId`, `setActiveInstanceId`, toast/error reporting, translation, and broader page control
- The helper still does not own:
  - delete orchestration
  - active-instance cleanup
  - success reporting
  - error reporting
  - translation
  - broader page control

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-agentstudio-pc-channels/src/services/channelService.ts`
- `packages/sdkwork-agentstudio-pc-market/src/services/marketService.ts`
- `packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side delete binding layer.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1072` lines / `40290` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailDeleteSupport.ts`: `23` lines / `769` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailDeleteSupport.test.ts`: `61` lines / `1678` bytes

Relative to the immediately prior `1068` page baseline from `release-2026-04-10-158`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1072`. This loop records a verified boundary improvement for the shared delete binding family while also documenting that the broader page baseline has shifted again in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1072`
  - `instanceDetailDeleteSupport.ts`: `23`
  - `instanceDetailManagedConfigMutationSupport.ts`: `53`
  - `instanceDetailLifecycleMutationSupport.ts`: `23`
  - `instanceDetailManagedChannelMutationSupport.ts`: `23`
  - `instanceDetailAgentMutationSupport.ts`: `25`
  - `instanceDetailAgentSkillMutationSupport.ts`: `23`
  - `instanceDetailProviderCatalogMutationSupport.ts`: `45`
  - `instanceDetailConsoleErrorSupport.ts`: `23`
  - `instanceDetailReloadSupport.ts`: `31`
  - `instanceDetailSectionAvailabilitySupport.ts`: `35`
  - `instanceDetailNavigationSupport.ts`: `43`
  - `instanceLifecycleActionSupport.ts`: `166`
  - `instanceWorkbenchServiceCore.ts`: `1135`
  - `instanceServiceCore.ts`: `1432`
- Fresh build evidence:
  - `InstanceDetail-k8YEvh91.js`: `176.23 kB`
  - `InstanceConfigWorkbenchPanel-CymDu054.js`: `63.33 kB`
  - `InstanceDetailFilesSection-CwfHzR4d.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailDeleteSupport.test.ts`
  - failed first because `instanceDetailDeleteSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline delete wrappers and did not yet construct `deleteHandlerBindings`
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailDeleteSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version
  - `pnpm.cmd build` prints a non-blocking Rolldown plugin timing warning; the build still exits successfully

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-owned delete binding family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1072`-line `InstanceDetail.tsx` baseline before selecting `160`.
- Favor only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Prefer the next smallest page-owned service-adapter family instead of widening delete support beyond host/service binding.
