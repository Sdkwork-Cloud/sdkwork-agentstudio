> Migrated from `docs/review/step-07-provider-workspace-selection-state-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Provider Workspace Selection State Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider workspace selection/draft/request-parse cluster from `InstanceDetail.tsx`
  - keep provider draft state ownership, provider delete ids, and all write authority in the page shell
  - keep Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport truth-source routing unchanged

## Root Cause

- After the provider dialog launch extraction, `InstanceDetail.tsx` still directly owned one more provider workspace read-side cluster:
  - selected-provider lookup
  - deleting-provider lookup
  - deleting-provider-model lookup
  - selected-provider draft baseline selection
  - selected-provider request-draft baseline selection
  - selected-provider request parse-error shaping
  - pending-change detection
- That meant the page still had to re-derive a pure provider workspace selection view model inline even though:
  - the logic is read-side and presentation-oriented
  - it already depends on shared provider draft/request helpers
  - the page only needs to keep truth sources and write-path authority

## Implemented Extraction

- Extended `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`, which now owns:
  - selected-provider lookup from the current workbench
  - delete-target lookup for provider and provider model
  - selected-provider config draft baseline selection
  - selected-provider request draft baseline selection
  - selected-provider request parse-error shaping
  - selected-provider pending-change detection
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - memoizes `buildOpenClawProviderSelectionState(...)`
  - consumes `selectedProvider`, `deletingProvider`, `deletingProviderModel`, `selectedProviderDraft`, `selectedProviderRequestDraft`, `selectedProviderRequestParseError`, and `hasPendingProviderChanges` from the shared helper
  - stops defining those provider workspace derivations inline
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderWorkspacePresentation.ts` now owns:
  - provider workspace selection-state derivation
  - delete-target lookup for provider and provider model
  - provider request parse-error shaping for the selected provider workspace draft
  - pending-change detection for selected provider config/request drafts
- `InstanceDetail.tsx` still explicitly owns:
  - `selectedProviderId`
  - `providerDeleteId`
  - `providerModelDeleteId`
  - `providerDrafts`
  - `providerRequestDrafts`
  - all provider write handlers and `instanceService.*` mutations
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

These sources remain the authority for browser-backed workbench persistence, Provider Center managed-provider projection, marketplace/install ownership, Local Proxy projection, and desktop runtime/plugin registration. This loop only moves provider workspace selection-state derivation.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1881`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`: `111`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.ts`: `249`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.ts`: `38`
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

Relative to the immediately prior `1898` page baseline from the provider dialog launch callback note, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1881`. The page shrank again while `openClawProviderWorkspacePresentation.ts` absorbed the selected-provider workspace derivation.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - failed first because `buildOpenClawProviderSelectionState(...)` did not yet exist
  - `pnpm check:sdkwork-instances`
  - failed first because `InstanceDetail.tsx` still owned inline provider workspace selection derivations and the contract still expected the new helper boundary
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-108') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status:
  - repo-wide `pnpm lint` was not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the provider workspace read-side boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - another provider workspace draft/reset or dialog cluster
  - another remaining page-owned orchestration cluster outside the provider family
- Keep the same rule:
  - shared read-side derivation and callback shaping may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing stay where they are

