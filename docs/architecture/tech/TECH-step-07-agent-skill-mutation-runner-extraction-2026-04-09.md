> Migrated from `docs/review/step-07-agent-skill-mutation-runner-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Agent Skill Mutation Runner Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining agent skill install / enable / remove orchestration cluster from `InstanceDetail.tsx`
  - keep the real `agentSkillManagementService.*` calls, `toast` dispatch, `loadWorkbench(...)` authority, and page-owned selection / workbench truth in the page shell

## Root Cause

- After the agent CRUD runner extraction, `InstanceDetail.tsx` still owned one more repeated page-side orchestration cluster around:
  - `handleInstallAgentSkill(...)`
  - `handleSetAgentSkillEnabled(...)`
  - `handleRemoveAgentSkill(...)`
- That cluster still duplicated the same side-effect sequence:
  - enter boolean or keyed pending state
  - execute the real page-owned skill mutation callback
  - show translated success toast
  - reload the workbench without spinner
  - map failures back into page-owned error toasts
  - clear boolean or keyed pending state
- The page did not need to keep that orchestration inline as long as:
  - each real `agentSkillManagementService.installSkill(...)`
  - each real `agentSkillManagementService.setSkillEnabled(...)`
  - each real `agentSkillManagementService.removeSkill(...)`
  - `toast.success(...)` / `toast.error(...)`
  - `loadWorkbench(...)` authority
  - `selectedAgentWorkbench`-derived request data
  stayed page-owned and injected into the runner

## Implemented Extraction

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentSkillMutationSupport.ts` to own:
  - `OpenClawAgentSkillMutationRequest`
  - `CreateOpenClawAgentSkillMutationRunnerArgs`
  - `createOpenClawAgentSkillMutationRunner(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
- Updated the service barrel in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates `runAgentSkillMutation` through `createOpenClawAgentSkillMutationRunner(...)`
  - injects reload authority, toast bridges, and `t`
  - keeps all three handlers building page-owned execute callbacks
  - removes the local `addPendingId(...)` / `removePendingId(...)` helpers from the page
  - removes inline pending / success / reload / failure orchestration from the three skill handlers
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawAgentSkillMutationSupport.ts` now owns:
  - boolean pending toggling for install actions
  - keyed pending-set add/remove for toggle and remove actions
  - translated success / failure reporting through injected page callbacks
  - post-mutation workbench reload sequencing through an injected page callback
- `InstanceDetail.tsx` still explicitly owns:
  - all `agentSkillManagementService.installSkill(...)`
  - all `agentSkillManagementService.setSkillEnabled(...)`
  - all `agentSkillManagementService.removeSkill(...)`
  - all `toast.success(...)` / `toast.error(...)` through injected callbacks
  - all `loadWorkbench(...)` authority
  - all `selectedAgentWorkbench` request construction, including workspace path, base dir, and file path
  - all page-owned selected-agent and agent-workbench truth
- This loop does not move agent CRUD execution, Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their existing authoritative layers.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-agentstudio-pc-channels/src/services/channelService.ts`
- `packages/sdkwork-agentstudio-pc-market/src/services/marketService.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for browser workbench persistence, Control UI section alignment, agent install/runtime boundaries, managed-provider/readonly decisions, Local Proxy ownership, and desktop plugin/runtime ownership. The current loop only moves page-side agent skill orchestration.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1931`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentSkillMutationSupport.ts`: `68`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentMutationSupport.ts`: `65`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `373`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1938` page baseline from the agent CRUD runner note, the page hotspot now moves down to `1931`.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
  - failed first because `openClawAgentSkillMutationSupport.ts` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the shared agent skill mutation helper did not exist yet
- GREEN in this loop:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
- YELLOW on fresh repo-wide verification:
  - `pnpm lint`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining page-side agent skill orchestration boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - the remaining agent dialog request-construction cluster
  - another shared page-owned orchestration boundary that preserves real write authority in the page
- Keep the same rule:
  - shared request shaping and injected execution orchestration may move out
  - truth-source routing, real write-path execution, reload authority, and side-effect ownership must stay in the page

