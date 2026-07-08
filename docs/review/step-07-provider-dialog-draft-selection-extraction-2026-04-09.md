# Step 07 Provider Dialog Draft Selection Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider dialog create/edit draft-selection cluster from `InstanceDetail.tsx`
  - keep provider dialog visibility state in the page shell
  - keep all real provider write authority and OpenClaw control-plane boundaries unchanged

## Root Cause

- After the provider dialog dismiss/reset extraction, `InstanceDetail.tsx` still directly owned one more provider dialog draft-selection cluster:
  - create-provider draft baseline selection
  - create-provider-model draft baseline selection
  - edit-provider-model draft shaping from the selected model
  - the same create baselines during page reset
- That meant the page still directly imported and used raw provider draft factories for dialog-state shaping even though:
  - those factories are pure data-shaping concerns
  - dialog visibility still belongs in the page
  - real provider writes still belong in the page

## Implemented Extraction

- Added `packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.ts`, which now owns:
  - `createOpenClawProviderCreateDialogState(...)`
  - `createOpenClawProviderModelCreateDialogState(...)`
  - `createOpenClawProviderModelEditDialogState(...)`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - initializes provider dialog draft state through the shared provider presentation helper
  - resets provider dialog draft state through the shared provider presentation helper
  - opens create-provider and create-provider-model dialogs from shared create baselines
  - opens edit-provider-model dialogs from the shared edit draft builder
  - stops directly using the raw provider dialog draft factories inline
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.test.ts`
- Updated:
  - `packages/sdkwork-clawstudio-instances/src/services/index.ts`
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderPresentation.ts` now owns:
  - provider create-dialog draft selection
  - provider-model create-dialog draft selection
  - provider-model edit-dialog draft selection
  - shared create-baseline reuse for page reset and provider dialog reset callbacks
- `InstanceDetail.tsx` still explicitly owns:
  - `setIsProviderDialogOpen(...)`
  - `setProviderDialogDraft(...)`
  - `setIsProviderModelDialogOpen(...)`
  - `setProviderModelDialogDraft(...)`
  - `selectedProvider` truth
  - all `instanceService.*` provider writes
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

These sources remain the authority for browser-backed workbench persistence, Provider Center managed-provider projection, marketplace/install ownership, Local Proxy projection, and desktop runtime/plugin registration. This loop only moves provider dialog create/edit draft shaping.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1924`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.ts`: `38`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.ts`: `207`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`: `26`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.ts`: `284`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.ts`: `146`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentSkillMutationSupport.ts`: `204`
- `packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.ts`: `29`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `373`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1909` page baseline from the provider dialog dismiss/reset note, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1924`. This loop still records a verified boundary improvement, but not a raw shrink, because the worktree advanced elsewhere while the shared provider presentation helper now owns the remaining create/edit draft selection baseline.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.test.ts`
  - failed first because `openClawProviderPresentation.ts` did not yet exist
  - `pnpm check:sdkwork-instances`
  - failed first because the page and services barrel had not yet moved to the shared provider presentation helper boundary
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-106') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status:
  - repo-wide `pnpm lint` was not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining provider dialog draft-selection boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - another remaining page-owned provider dialog visibility/open callback cluster
  - another remaining page-owned orchestration cluster outside the provider dialog family
- Keep the same rule:
  - shared draft shaping and callback construction may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing stay where they are
