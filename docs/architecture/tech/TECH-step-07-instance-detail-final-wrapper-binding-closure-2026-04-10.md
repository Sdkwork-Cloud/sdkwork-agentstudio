> Migrated from `docs/review/step-07-instance-detail-final-wrapper-binding-closure-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Final Wrapper Binding Closure - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - close the last remaining page-owned wrapper families in `InstanceDetail.tsx`
  - keep page-owned state setters, service instances, reload behavior, toast reporting, and truth-source routing intact while centralizing the remaining binding composition

## Root Cause

- After `release-2026-04-10-161`, the current dirty worktree still kept exactly two wrapper families inline in `InstanceDetail.tsx`:
  - agent mutation state cleanup:
    - `dismissAgentDialog: () => { setIsAgentDialogOpen(false); setEditingAgentId(null); }`
    - `clearAgentDeleteId: () => setAgentDeleteId(null)`
  - workbench loader bindings:
    - `loadAgentWorkbench: (input) => agentWorkbenchService.getAgentWorkbench(input)`
    - `loadFiles: (instanceId, agents) => instanceWorkbenchService.listInstanceFiles(instanceId, agents)`
    - `loadMemories: (instanceId, agents) => instanceWorkbenchService.listInstanceMemories(instanceId, agents)`
- Those wrappers did not own mutation orchestration, lazy-load policy, error handling, or user-facing feedback:
  - they only adapted page-owned state setters and bound class-backed service methods into already-extracted helper contracts
  - the actual mutation planning still lived in `openClawAgentMutationSupport.ts`
  - the actual load orchestration still lived in `instanceDetailAgentWorkbenchState.ts` and `instanceWorkbenchHydration.ts`
- That made them a good `162` candidate: they were the last tiny adapter families blocking `CP07-3` closure.

## Implemented Fix

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationStateSupport.ts`.
- Added `createInstanceDetailAgentMutationStateBindings(...)` so the shared helper now owns only:
  - agent dialog dismiss binding
  - agent delete-id clear binding
- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailWorkbenchLoaderSupport.ts`.
- Added `createInstanceDetailWorkbenchLoaderBindings(...)` so the shared helper now owns only:
  - bound agent workbench loader composition
  - bound instance files lazy-loader composition
  - bound instance memories lazy-loader composition
- Added focused direct coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationStateSupport.test.ts`
  - `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailWorkbenchLoaderSupport.test.ts`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `agentMutationStateBindings` once through `createInstanceDetailAgentMutationStateBindings({ setIsAgentDialogOpen, setEditingAgentId, setAgentDeleteId })`
  - builds `workbenchLoaderBindings` through `createInstanceDetailWorkbenchLoaderBindings({ agentWorkbenchService, instanceWorkbenchService })`
  - routes `buildOpenClawAgentMutationHandlers(...)` through `agentMutationStateBindings.dismissAgentDialog` and `agentMutationStateBindings.clearAgentDeleteId`
  - routes `startLoadInstanceDetailAgentWorkbench(...)`, `startLazyLoadInstanceWorkbenchFiles(...)`, and `startLazyLoadInstanceWorkbenchMemory(...)` through the shared bound loaders
  - stops keeping the final inline agent-state and service-method wrappers in the page shell
- Exported the new helpers from `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so both new helper tests run inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailAgentMutationStateBindings(...)`
  - the page to use `createInstanceDetailWorkbenchLoaderBindings(...)`
  - agent mutation handling to consume `agentMutationStateBindings.dismissAgentDialog` and `agentMutationStateBindings.clearAgentDeleteId`
  - agent/files/memories loading to consume `workbenchLoaderBindings.loadAgentWorkbench`, `workbenchLoaderBindings.loadFiles`, and `workbenchLoaderBindings.loadMemories`
  - the page to stop keeping the final inline wrapper families
  - both shared helpers to stay free of toast, navigation, reload, and broader page authority

## Boundary Decision

- `instanceDetailAgentMutationStateSupport.ts` now owns only page-owned state cleanup binding for agent mutation flows.
- `instanceDetailWorkbenchLoaderSupport.ts` now owns only page-owned class-method binding for agent/files/memories loader callbacks.
- `InstanceDetail.tsx` still explicitly owns:
  - the real React state setters
  - the real `agentWorkbenchService` and `instanceWorkbenchService` instances
  - lazy-load policy
  - error reporting
  - reload behavior
  - toast reporting
  - truth-source routing
  - broader page control
- The new helpers still do not own:
  - mutation planning
  - validation
  - cancellation behavior
  - lazy-load policy
  - user-facing feedback
  - translation

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the final page-side state and service binding layers.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1031` lines / `40947` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationStateSupport.ts`: `18` lines / `607` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationStateSupport.test.ts`: `43` lines / `1518` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailWorkbenchLoaderSupport.ts`: `28` lines / `1348` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailWorkbenchLoaderSupport.test.ts`: `74` lines / `2527` bytes

Relative to the immediately prior `1019` page baseline from `release-2026-04-10-161`, the fresh current dirty worktree re-measures `InstanceDetail.tsx` at `1031`. This loop records a verified closure of the final remaining wrapper families while also documenting that the current dirty worktree baseline has shifted again and is now the operative truth for Step 07 closure.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1031`
  - `instanceDetailProviderDeleteStateSupport.ts`: `19`
  - `instanceDetailAgentMutationStateSupport.ts`: `18`
  - `instanceDetailWorkbenchLoaderSupport.ts`: `28`
  - `instanceDetailDeleteSupport.ts`: `19`
  - `instanceDetailManagedConfigMutationSupport.ts`: `49`
  - `instanceDetailLifecycleMutationSupport.ts`: `19`
  - `instanceDetailManagedChannelMutationSupport.ts`: `19`
  - `instanceDetailAgentMutationSupport.ts`: `21`
  - `instanceDetailAgentSkillMutationSupport.ts`: `19`
  - `instanceDetailProviderCatalogMutationSupport.ts`: `41`
  - `instanceDetailConsoleErrorSupport.ts`: `20`
  - `instanceDetailReloadSupport.ts`: `26`
  - `instanceDetailSectionAvailabilitySupport.ts`: `30`
  - `instanceDetailNavigationSupport.ts`: `37`
  - `instanceLifecycleActionSupport.ts`: `150`
  - `instanceWorkbenchServiceCore.ts`: `1032`
  - `instanceServiceCore.ts`: `1274`
- Fresh build evidence:
  - `InstanceDetail-B7qB1tcv.js`: `176.52 kB`
  - `InstanceConfigWorkbenchPanel-CHqsvN9P.js`: `63.33 kB`
  - `InstanceDetailFilesSection-DVvFZx6U.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationStateSupport.test.ts`
  - failed first because `instanceDetailAgentMutationStateSupport.ts` did not yet exist
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailWorkbenchLoaderSupport.test.ts`
  - failed first because `instanceDetailWorkbenchLoaderSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline agent-state and loader-binding wrappers
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationStateSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailWorkbenchLoaderSupport.test.ts`
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
- `CP07-3`: green
- `CP07-4`: pending final closure writeback

This loop closes the final remaining page-owned wrapper families in `InstanceDetail.tsx`. `CP07-3` is now green.

## Next Frontier

- Write the explicit final closure record for `CP07-4`.
- Carry the verified `CP07-3` closure into architecture and release evidence so Step 07 can be marked closed.

