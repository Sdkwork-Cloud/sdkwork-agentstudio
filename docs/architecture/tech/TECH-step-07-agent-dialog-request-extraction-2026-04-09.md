> Migrated from `docs/review/step-07-agent-dialog-request-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Agent Dialog Request Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining agent dialog request-construction cluster from `InstanceDetail.tsx`
  - keep the real `instanceService.*` writes, `toast` dispatch, `loadWorkbench(...)` authority, and page-owned dialog/delete state in the page shell

## Root Cause

- After the agent skill runner extraction, `InstanceDetail.tsx` still owned one more page-side request-shaping cluster around:
  - `handleSaveAgentDialog(...)`
  - `handleDeleteAgent(...)`
- That cluster still handled:
  - `buildOpenClawAgentInputFromForm(agentDialogDraft)`
  - required agent-id validation and its translated error message
  - create vs update mutation-kind selection
  - success/failure key selection for the shared runner
  - delete request construction and delete cleanup wiring
- The page did not need to keep that request construction inline as long as:
  - the real `instanceService.createOpenClawAgent(...)`
  - the real `instanceService.updateOpenClawAgent(...)`
  - the real `instanceService.deleteOpenClawAgent(...)`
  - `toast.success(...)` / `toast.error(...)`
  - `loadWorkbench(...)` authority
  - save-state setter ownership and dialog/delete cleanup ownership
  stayed page-owned and injected at the existing page boundary

## Implemented Extraction

- Extended `packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.ts` to also own:
  - `OpenClawAgentMutationBuildResult`
  - `buildOpenClawAgentSaveMutationRequest(...)`
  - `buildOpenClawAgentDeleteMutationRequest(...)`
- Expanded focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.test.ts`
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds save requests through `buildOpenClawAgentSaveMutationRequest(...)`
  - builds delete requests through `buildOpenClawAgentDeleteMutationRequest(...)`
  - keeps the validation toast in the page by handling the helper's `error` result
  - routes only finalized mutation requests into `runAgentMutation(...)`
  - removes the inline agent-input construction, id validation branch, mutation-kind selection, and success/failure key selection from the two handlers
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawAgentMutationSupport.ts` now owns:
  - agent dialog form-to-request conversion through `buildOpenClawAgentInputFromForm(...)`
  - translated missing-id error shaping for the save flow
  - create vs update mutation-kind selection
  - success/failure key selection for save and delete flows
  - delete request construction and cleanup callback wiring
- `InstanceDetail.tsx` still explicitly owns:
  - all `instanceService.createOpenClawAgent(...)`
  - all `instanceService.updateOpenClawAgent(...)`
  - all `instanceService.deleteOpenClawAgent(...)`
  - all `toast.success(...)` / `toast.error(...)` through injected callbacks or page-owned error handling
  - all `loadWorkbench(...)` authority
  - `setIsSavingAgentDialog(...)`, dialog-close cleanup, delete-dialog cleanup, selected-agent state, and editing-agent state
  - `openCreateAgentDialog(...)` / `openEditAgentDialog(...)` state wiring
- This loop does not move agent skill execution, Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their existing authoritative layers.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
  - still defines browser-backed workbench agent snapshots and gateway-derived connectivity metadata
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
  - still verifies built-in OpenClaw gateway endpoint projection
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
  - remains the page-owned authority for agent write callbacks, toasts, reloads, and dialog state
- `packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
  - still guards Control UI section order
- `packages/sdkwork-claw-agent/src/services/agentInstallService.ts`
  - still resolves agent paths and persists `agentSnapshots`, `allowAgentIds`, and `subagentDefaults`
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
  - still owns Provider Center managed and gateway readiness decisions
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - still owns provider workspace managed/readonly presentation decisions
- `packages/sdkwork-claw-market/src/services/marketService.ts`
  - still routes skill installs to the default agent workspace
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - still owns local proxy provider projection and default managed agent model projection
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`
  - still owns desktop plugin bootstrap

These sources remain the authority for browser workbench persistence, Control UI section alignment, managed-provider/readonly decisions, default-agent install targets, Local Proxy ownership, and desktop plugin/runtime ownership. The current loop only moves agent dialog request shaping.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1926`
- `packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.ts`: `146`
- `packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.ts`: `68`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-claw-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `373`
- `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1931` page baseline from the agent skill runner note, the page hotspot now moves down to `1926`.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.test.ts`
  - failed first because `buildOpenClawAgentSaveMutationRequest(...)` and `buildOpenClawAgentDeleteMutationRequest(...)` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the page still owned the inline agent dialog request-construction cluster
- GREEN in this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.test.ts`
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

This loop materially improves the remaining page-side agent dialog request-construction boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - `openCreateAgentDialog(...)` / `openEditAgentDialog(...)` draft-setup clustering if it can move without taking page state ownership
  - another remaining page-owned orchestration cluster outside the new agent save/delete request boundary
- Keep the same rule:
  - shared request shaping and injected execution orchestration may move out
  - truth-source routing, real write-path execution, reload authority, and side-effect ownership must stay in the page

