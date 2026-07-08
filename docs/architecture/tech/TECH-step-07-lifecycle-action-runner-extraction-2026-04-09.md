> Migrated from `docs/review/step-07-lifecycle-action-runner-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Lifecycle Action Runner Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining lifecycle action orchestration cluster from `InstanceDetail.tsx`
  - keep the real `instanceService.startInstance(...)`, `stopInstance(...)`, `restartInstance(...)`, `toast` dispatch, and `loadWorkbench(...)` authority in the page shell

## Root Cause

- After the agent skill request extraction, `InstanceDetail.tsx` still owned one more repeated page-side orchestration cluster around:
  - `handleRestart(...)`
  - `handleStop(...)`
  - `handleStart(...)`
- That cluster still duplicated the same sequence:
  - guard on `instanceId`
  - invoke the real lifecycle service call
  - show translated success toast
  - reload the workbench
  - map failures back into translated error toasts
- The page did not need to keep that try/catch orchestration inline as long as:
  - the real `instanceService.restartInstance(...)`
  - the real `instanceService.stopInstance(...)`
  - the real `instanceService.startInstance(...)`
  - `toast.success(...)` / `toast.error(...)`
  - `loadWorkbench(...)` authority
  stayed page-owned and injected into a shared runner

## Implemented Extraction

- Added `packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.ts` to own:
  - `InstanceLifecycleActionRequest`
  - `CreateInstanceLifecycleActionRunnerArgs`
  - `createInstanceLifecycleActionRunner(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.test.ts`
- Updated the service barrel in:
  - `packages/sdkwork-clawstudio-instances/src/services/index.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates `runLifecycleAction` through `createInstanceLifecycleActionRunner(...)`
  - injects reload authority, toast bridges, and `t`
  - keeps all three handlers focused on choosing the page-owned lifecycle callback and translation keys
  - removes the inline lifecycle try/catch sequence from the three handlers
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `instanceLifecycleActionSupport.ts` now owns:
  - lifecycle action execution sequencing
  - translated success reporting through injected page callbacks
  - post-success workbench reload sequencing through an injected page callback
  - translated fallback failure reporting through an injected page callback
- `InstanceDetail.tsx` still explicitly owns:
  - all `instanceService.restartInstance(...)`
  - all `instanceService.stopInstance(...)`
  - all `instanceService.startInstance(...)`
  - all `toast.success(...)` / `toast.error(...)` through injected callbacks
  - all `loadWorkbench(...)` authority
  - all page-owned lifecycle entry points and capability gating
- This loop does not move Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their existing authoritative layers.

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

These sources remain the authority for browser workbench persistence, Control UI section alignment, default-agent install targets, managed-provider/readonly decisions, Local Proxy ownership, and desktop plugin/runtime ownership. The current loop only moves lifecycle orchestration.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1911`
- `packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.ts`: `29`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentSkillMutationSupport.ts`: `204`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.ts`: `146`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `373`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1906` page baseline from the agent skill request note, the raw page line count now re-measures at `1911`. This loop is still a verified boundary improvement, but not a raw shrink, because the current worktree keeps explicit injected lifecycle runner wiring in the page shell while moving the repeated orchestration cluster into the shared helper.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.test.ts`
  - failed first because `instanceLifecycleActionSupport.ts` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the page still owned the inline lifecycle action orchestration cluster
- GREEN in this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
- Repo-wide lint status:
  - not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining page-side lifecycle orchestration boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - `openCreateAgentDialog(...)` / `openEditAgentDialog(...)` draft-setup clustering
  - another remaining page-owned orchestration cluster outside the new lifecycle runner boundary
- Keep the same rule:
  - shared request shaping and injected execution orchestration may move out
  - truth-source routing, real write-path execution, reload authority, and side-effect ownership must stay in the page

