# Step 07 Instance Detail Provider Delete State Binding Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned provider delete-state setter and clear wrappers out of `InstanceDetail.tsx`
  - keep provider dialog visibility, mutation execution, toast reporting, and truth-source routing page-owned while centralizing the repeated setter-binding family

## Root Cause

- After `release-2026-04-10-160`, the current dirty worktree still kept one coherent provider delete-state wrapper family inline in `InstanceDetail.tsx`:
  - `setProviderDeleteId: (value) => setProviderDeleteId(value)`
  - `setProviderModelDeleteId: (value) => setProviderModelDeleteId(value)`
  - `clearProviderDeleteId: () => setProviderDeleteId(null)`
  - `clearProviderModelDeleteId: () => setProviderModelDeleteId(null)`
- Those wrappers did not own provider selection logic, mutation planning, reload behavior, or user-facing feedback:
  - they only adapted page-owned React setters into the shared dialog-state and provider-mutation handler contracts
  - the actual delete-flow orchestration still lived in `instanceDetailSectionModels.ts` and `openClawProviderCatalogMutationSupport.ts`
- That made them a good `161` candidate: the wrapper family was repetitive, page-owned, and stable enough to extract without widening the provider boundary.

## Implemented Fix

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailProviderDeleteStateSupport.ts`.
- Added `createInstanceDetailProviderDeleteStateBindings(...)` so the shared helper now owns only:
  - provider delete-id setter pass-through binding
  - provider-model delete-id setter pass-through binding
  - provider delete-id clear callback binding
  - provider-model delete-id clear callback binding
- Added focused direct coverage in `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailProviderDeleteStateSupport.test.ts`.
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `providerDeleteStateBindings` once through `createInstanceDetailProviderDeleteStateBindings({ setProviderDeleteId, setProviderModelDeleteId })`
  - routes `buildLlmProviderDialogStateHandlers(...)` through `providerDeleteStateBindings.setProviderDeleteId` and `providerDeleteStateBindings.setProviderModelDeleteId`
  - routes `buildOpenClawProviderMutationHandlers(...)` through `providerDeleteStateBindings.clearProviderDeleteId` and `providerDeleteStateBindings.clearProviderModelDeleteId`
  - stops keeping inline provider delete-state wrappers in the page shell
- Exported the new helper from `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailProviderDeleteStateBindings(...)`
  - dialog-state wiring to consume `providerDeleteStateBindings.setProviderDeleteId` and `providerDeleteStateBindings.setProviderModelDeleteId`
  - provider mutation handling to consume `providerDeleteStateBindings.clearProviderDeleteId` and `providerDeleteStateBindings.clearProviderModelDeleteId`
  - the page to stop keeping inline provider delete-state wrappers
  - the shared helper to stay free of dialog visibility, mutation execution, toast, and broader page authority

## Boundary Decision

- `instanceDetailProviderDeleteStateSupport.ts` now owns only shared setter-binding composition for provider delete state.
- `InstanceDetail.tsx` still explicitly owns:
  - the real React state setters
  - provider dialog visibility
  - provider mutation execution
  - reload wiring
  - toast/error reporting
  - truth-source routing
  - broader page control
- The helper still does not own:
  - provider selection logic
  - provider mutation planning
  - reload behavior
  - translation
  - user-facing feedback

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side provider delete-state binding layer.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1019` lines / `40530` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailProviderDeleteStateSupport.ts`: `19` lines / `838` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailProviderDeleteStateSupport.test.ts`: `47` lines / `1630` bytes

Relative to the immediately prior `1072` page baseline from `release-2026-04-10-160`, the fresh current dirty worktree re-measured `InstanceDetail.tsx` at `1019`. This loop records a verified boundary improvement for the shared provider delete-state family while also documenting that the broader page baseline has shifted again in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1019`
  - `instanceDetailProviderDeleteStateSupport.ts`: `19`
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
  - `InstanceDetail-BIS6s_AZ.js`: `176.35 kB`
  - `InstanceConfigWorkbenchPanel-BJrAF71h.js`: `63.33 kB`
  - `InstanceDetailFilesSection-9Om5DNvC.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailProviderDeleteStateSupport.test.ts`
  - failed first because `instanceDetailProviderDeleteStateSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline provider delete-state wrappers and did not yet construct `providerDeleteStateBindings`
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailProviderDeleteStateSupport.test.ts`
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

This loop closes the remaining page-owned provider delete-state binding family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1019`-line `InstanceDetail.tsx` baseline before selecting `162`.
- Favor only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Prefer the final remaining agent-state and loader-binding families instead of widening provider delete-state support beyond setter composition.
