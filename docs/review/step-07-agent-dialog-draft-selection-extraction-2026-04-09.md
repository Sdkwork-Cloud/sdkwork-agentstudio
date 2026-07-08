# Step 07 Agent Dialog Draft Selection Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining page-side agent dialog create/edit draft-selection cluster from `InstanceDetail.tsx`
  - keep dialog visibility, selected-agent truth, and all real write authority in the page shell

## Root Cause

- After the lifecycle runner extraction, `InstanceDetail.tsx` still owned one more repeated draft-selection cluster around:
  - `openCreateAgentDialog(...)`
  - `openEditAgentDialog(...)`
- That cluster still duplicated:
  - create-dialog reset state construction
  - edit-dialog draft construction
  - active-agent model-source inheritance selection from `selectedAgentWorkbench`
- The page did not need to keep that selection logic inline as long as:
  - `selectedAgentWorkbench` truth stays page-owned
  - `setIsAgentDialogOpen(true)` stays page-owned
  - `setAgentDialogDraft(...)` / `setEditingAgentId(...)` state ownership stays page-owned
  - all `instanceService.*`, `toast`, and `loadWorkbench(...)` authority stays where it already is

## Implemented Extraction

- Extended `packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.ts` to own:
  - `OpenClawAgentDialogState`
  - `OpenClawSelectedAgentWorkbenchState`
  - `createOpenClawAgentCreateDialogState(...)`
  - `createOpenClawAgentEditDialogState(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - consumes the shared create-dialog state helper in the page reset effect
  - consumes the shared create-dialog state helper in `openCreateAgentDialog(...)`
  - consumes the shared edit-dialog state helper in `openEditAgentDialog(...)`
  - keeps dialog visibility control in the page via `setIsAgentDialogOpen(true)`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawAgentPresentation.ts` now owns:
  - agent dialog create/edit draft construction
  - active-agent model-source inheritance selection for dialog edits
  - shared edit/create dialog state payload shaping
- `InstanceDetail.tsx` still explicitly owns:
  - `selectedAgentWorkbench` truth
  - `setIsAgentDialogOpen(...)`
  - `setAgentDialogDraft(...)`
  - `setEditingAgentId(...)`
  - all `instanceService.*` agent writes
  - all `toast` dispatch and `loadWorkbench(...)` authority
  - Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing through the existing authoritative layers

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

These sources remain the authority for browser workbench persistence, managed-provider and readonly decisions, marketplace/install ownership, Local Proxy ownership, and desktop plugin/runtime ownership. This loop only moves agent dialog draft-selection logic.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1741`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.ts`: `263`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.ts`: `135`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentSkillMutationSupport.ts`: `187`
- `packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.ts`: `26`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `353`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelMutationSupport.ts`: `223`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailSectionContent.tsx`: `215`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `87`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `247`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately prior `1911` page baseline from the lifecycle runner note, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1741`. This note records the fresh current-worktree baseline after the dialog-state extraction loop rather than claiming the whole raw delta came only from this helper.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.test.ts`
  - failed first because `openClawAgentPresentation.ts` did not yet export the new dialog-state helpers
  - `pnpm check:sdkwork-instances`
  - failed first because `scripts/sdkwork-instances-contract.test.ts` now required the page to route draft selection through the shared helper boundary
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-103') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status:
  - repo-wide `pnpm lint` was not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining page-side agent dialog draft-selection boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - another remaining agent dialog state/reset cluster
  - another remaining page-owned orchestration cluster that can move without absorbing write-path authority
- Keep the same rule:
  - shared state shaping may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, and OpenClaw control-plane alignment stay where they are
