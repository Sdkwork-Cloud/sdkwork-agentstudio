> Migrated from `docs/review/step-07-agent-skill-request-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Agent Skill Request Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining agent skill request-construction cluster from `InstanceDetail.tsx`
  - keep the real `agentSkillManagementService.*` calls, `toast` dispatch, `loadWorkbench(...)` authority, and page-owned selected-agent truth in the page shell

## Root Cause

- After the agent dialog request extraction, `InstanceDetail.tsx` still owned one more page-side request-shaping cluster around:
  - `handleInstallAgentSkill(...)`
  - `handleSetAgentSkillEnabled(...)`
  - `handleRemoveAgentSkill(...)`
- That cluster still handled:
  - guard logic for `instanceId` and `selectedAgentWorkbench`
  - install / toggle / remove payload construction
  - success/failure key selection
  - pending key selection and pending setter routing
- The page did not need to keep that request construction inline as long as:
  - the real `agentSkillManagementService.installSkill(...)`
  - the real `agentSkillManagementService.setSkillEnabled(...)`
  - the real `agentSkillManagementService.removeSkill(...)`
  - `toast.success(...)` / `toast.error(...)`
  - `loadWorkbench(...)` authority
  - selected-agent workbench truth, workspace path, and pending-state ownership
  stayed page-owned and injected at the existing page boundary

## Implemented Extraction

- Extended `packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.ts` to also own:
  - `OpenClawAgentSkillMutationBuildResult`
  - `buildOpenClawAgentSkillInstallMutationRequest(...)`
  - `buildOpenClawAgentSkillToggleMutationRequest(...)`
  - `buildOpenClawAgentSkillRemoveMutationRequest(...)`
- Expanded focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds install requests through `buildOpenClawAgentSkillInstallMutationRequest(...)`
  - builds toggle requests through `buildOpenClawAgentSkillToggleMutationRequest(...)`
  - builds remove requests through `buildOpenClawAgentSkillRemoveMutationRequest(...)`
  - routes only finalized mutation requests into `runAgentSkillMutation(...)`
  - removes the inline install/toggle/remove request shaping from those three handlers
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawAgentSkillMutationSupport.ts` now owns:
  - install/toggle/remove request shaping
  - request payload assembly for skill install/toggle/remove callbacks
  - success/failure key selection for the three skill flows
  - pending setter / pending key metadata selection
- `InstanceDetail.tsx` still explicitly owns:
  - all `agentSkillManagementService.installSkill(...)`
  - all `agentSkillManagementService.setSkillEnabled(...)`
  - all `agentSkillManagementService.removeSkill(...)`
  - all `toast.success(...)` / `toast.error(...)` through injected callbacks
  - all `loadWorkbench(...)` authority
  - selected-agent workbench truth, workspace path ownership, install/remove/toggle entry points, and pending-state ownership
- This loop does not move agent CRUD execution, Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their existing authoritative layers.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-claw-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-claw-market/src/services/marketService.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for browser workbench persistence, Control UI section alignment, default-agent install targets, managed-provider/readonly decisions, Local Proxy ownership, and desktop plugin/runtime ownership. The current loop only moves page-side agent skill request shaping.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1906`
- `packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.ts`: `204`
- `packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.ts`: `146`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-claw-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `373`
- `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1926` page baseline from the agent dialog request note, the page hotspot now moves down to `1906`.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
  - failed first because the new skill request builders did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the page still owned the inline agent skill request-construction cluster
- GREEN in this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
- Repo-wide lint status:
  - not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining page-side agent skill request-construction boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - `openCreateAgentDialog(...)` / `openEditAgentDialog(...)` draft-setup clustering if it can move without taking page state ownership
  - the repeated lifecycle action try/catch cluster around restart / stop / start
  - another remaining page-owned orchestration cluster outside the new agent skill request boundary
- Keep the same rule:
  - shared request shaping and injected execution orchestration may move out
  - truth-source routing, real write-path execution, reload authority, and side-effect ownership must stay in the page

