> Migrated from `docs/review/step-07-agent-mutation-runner-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Agent Mutation Runner Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining agent create/update/delete mutation orchestration cluster from `InstanceDetail.tsx`
  - keep the real `instanceService.*` write paths, `toast` dispatch, `loadWorkbench(...)` authority, agent form validation, and page-owned dialog/delete state in the page shell

## Root Cause

- After the managed-config runner extraction, `InstanceDetail.tsx` still owned another page-side orchestration cluster around:
  - `handleSaveAgentDialog(...)`
  - `handleDeleteAgent(...)`
- That cluster still handled:
  - mutation-kind switching across create / update / delete
  - save-state toggling for the dialog flow
  - translated success / failure reporting
  - post-success dialog cleanup and delete-dialog cleanup
  - workbench reload without spinner
- The page did not need to keep that try/catch and mutation-kind switch inline as long as:
  - `buildOpenClawAgentInputFromForm(...)` and required-id validation stayed in the page
  - the real `instanceService.createOpenClawAgent(...)`
  - the real `instanceService.updateOpenClawAgent(...)`
  - the real `instanceService.deleteOpenClawAgent(...)`
  - `toast.success(...)` / `toast.error(...)`
  - `loadWorkbench(...)` authority
  - agent dialog state and delete state ownership
  stayed page-owned and injected into the runner

## Implemented Extraction

- Added `packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.ts` to own:
  - `OpenClawAgentMutationRequest`
  - `CreateOpenClawAgentMutationRunnerArgs`
  - `createOpenClawAgentMutationRunner(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.test.ts`
- Updated the service barrel in:
  - `packages/sdkwork-claw-instances/src/services/index.ts`
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates `runAgentMutation` through `createOpenClawAgentMutationRunner(...)`
  - injects create / update / delete callbacks, reload authority, toast bridges, and `t`
  - keeps `handleSaveAgentDialog(...)` focused on request building and validation
  - keeps `handleDeleteAgent(...)` focused on page-owned guard logic and delete-dialog cleanup wiring
  - removes the inline create/update/delete try/catch execution cluster from those handlers
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawAgentMutationSupport.ts` now owns:
  - create / update / delete mutation execution switching
  - optional dialog save-state toggling
  - translated success / failure reporting through injected page callbacks
  - post-success cleanup sequencing through injected page callbacks
  - workbench reload sequencing through an injected page callback
- `InstanceDetail.tsx` still explicitly owns:
  - `buildOpenClawAgentInputFromForm(agentDialogDraft)`
  - required agent-id validation and the direct validation error toast
  - all `instanceService.createOpenClawAgent(...)`
  - all `instanceService.updateOpenClawAgent(...)`
  - all `instanceService.deleteOpenClawAgent(...)`
  - all `toast.success(...)` / `toast.error(...)` through injected callbacks
  - all `loadWorkbench(...)` authority
  - agent dialog draft state, editing-agent state, delete-dialog state, and selected agent state
- This loop does not move agent skill install/remove/toggle execution, Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their existing authoritative layers.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-claw-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-claw-channels/src/services/channelService.ts`
- `packages/sdkwork-claw-market/src/services/marketService.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for browser workbench persistence, Control UI section alignment, agent install/runtime boundaries, managed-provider/readonly decisions, Local Proxy ownership, and desktop plugin/runtime ownership. The current loop only moves page-side agent CRUD mutation orchestration.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1938`
- `packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.ts`: `65`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-claw-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `373`
- `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1930` page baseline from the managed-config runner note, the raw page line count now re-measures at `1938`. This loop is still a verified boundary improvement, but not a raw shrink, because the current worktree keeps explicit injected runner wiring and agent-input validation in the page while moving the execution/cleanup switch into the shared helper.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.test.ts`
  - failed first because `openClawAgentMutationSupport.ts` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the shared agent mutation helper did not exist yet
- GREEN in this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
- YELLOW on the latest session-wide repo verification:
  - `pnpm lint`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining page-side agent CRUD orchestration boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - the remaining agent skill install / enable / remove orchestration cluster
  - the remaining agent dialog request-construction cluster
- Keep the same rule:
  - shared request shaping and injected execution orchestration may move out
  - truth-source routing, real write-path execution, reload authority, and side-effect ownership must stay in the page

