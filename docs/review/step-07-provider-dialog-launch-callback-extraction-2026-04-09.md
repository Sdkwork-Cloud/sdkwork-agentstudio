# Step 07 Provider Dialog Launch Callback Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider dialog open/create/edit launch callback cluster from `InstanceDetail.tsx`
  - keep page-owned dialog visibility setters and provider write authority unchanged
  - keep Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport truth-source routing unchanged

## Root Cause

- After the provider dialog dismiss/reset extraction and provider draft-selection extraction, `InstanceDetail.tsx` still directly owned one more provider dialog launch cluster:
  - create-provider dialog open orchestration
  - create-provider-model dialog open orchestration
  - edit-provider-model dialog open orchestration
- That meant the page still had to shape section-facing provider dialog launch callbacks inline even though:
  - the callback construction is presentation orchestration for the LLM provider section
  - the section-model helper already owns adjacent agent and provider dialog callback shaping
  - the page only needs to keep the real setters, truth sources, and mutation authority

## Implemented Extraction

- Extended `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`, which now owns section-facing provider dialog launch callbacks for:
  - create-provider dialog open orchestration
  - create-provider-model dialog open orchestration
  - edit-provider-model dialog open orchestration
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - passes `setIsProviderDialogOpen(...)` and `setProviderDialogDraft(...)` into `buildLlmProviderSectionProps(...)`
  - passes `setIsProviderModelDialogOpen(...)` and `setProviderModelDialogDraft(...)` into `buildLlmProviderSectionProps(...)`
  - stops defining inline `openCreateProviderDialog(...)`
  - stops defining inline `openCreateProviderModelDialog(...)`
  - stops defining inline `openEditProviderModelDialog(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `instanceDetailSectionModels.ts` now owns:
  - section-facing provider dialog launch callback construction
  - create-provider dialog launch gating through `canManageOpenClawProviders`
  - provider-model create/edit launch draft selection via the shared provider presentation helper
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

These sources remain the authority for browser-backed workbench persistence, Provider Center managed-provider projection, marketplace/install ownership, Local Proxy projection, and desktop runtime/plugin registration. This loop only moves provider dialog launch callback construction.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1898`
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `249`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`: `26`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.ts`: `38`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.ts`: `284`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentMutationSupport.ts`: `146`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentSkillMutationSupport.ts`: `204`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.ts`: `29`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `373`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1924` page baseline from the provider dialog draft-selection note, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1898`. The page shrank while `instanceDetailSectionModels.ts` absorbed the section-facing provider dialog launch orchestration.

## Verification

- RED established in this loop:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
  - failed first because `buildLlmProviderSectionProps(...)` did not yet compose provider dialog launch callbacks
  - `pnpm check:sdkwork-instances`
  - failed first because `InstanceDetail.tsx` still owned inline provider dialog launch callbacks and the contract boundaries still pointed at the page-owned cluster
- GREEN in and after this loop:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-107') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status:
  - repo-wide `pnpm lint` was not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining provider dialog launch boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - another remaining provider dialog or provider-config orchestration cluster
  - another remaining page-owned orchestration cluster outside the provider dialog family
- Keep the same rule:
  - shared callback shaping and draft selection may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing stay where they are
