# Step 07 Provider Workspace Draft Callback Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider workspace draft callback cluster from `InstanceDetail.tsx`
  - keep provider draft state ownership, provider request draft state ownership, and all provider write authority in the page shell
  - keep Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport truth-source routing unchanged

## Root Cause

- After the provider workspace selection-state extraction, `InstanceDetail.tsx` still directly owned one more provider workspace draft callback cluster:
  - config field draft updates
  - config object draft updates
  - request-overrides draft updates
  - selected-provider draft reset
- That meant the page still had to compose section-facing provider workspace draft callbacks inline even though:
  - the logic is pure draft orchestration for the LLM provider section
  - the logic already depends on shared provider draft helpers
  - the page only needs to keep draft truth sources and mutation authority

## Implemented Extraction

- Extended `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.ts`, which now owns:
  - selected-provider field draft updates through `applyOpenClawProviderFieldDraftChange(...)`
  - selected-provider config draft updates through `applyOpenClawProviderConfigDraftChange(...)`
  - selected-provider request-overrides draft updates through `applyOpenClawProviderRequestDraftChange(...)`
  - selected-provider draft reset baselines through `createOpenClawProviderConfigDraft(...)` and `createOpenClawProviderRequestDraft(...)`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - passes `setProviderDrafts(...)` into `buildLlmProviderSectionProps(...)`
  - passes `setProviderRequestDrafts(...)` into `buildLlmProviderSectionProps(...)`
  - stops defining inline `handleProviderFieldChange(...)`
  - stops defining inline `handleProviderConfigChange(...)`
  - stops defining inline `handleProviderRequestOverridesChange(...)`
  - stops defining inline `handleResetProviderDraft(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.test.tsx`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `instanceDetailSectionModels.ts` now owns:
  - section-facing provider workspace draft callback construction
  - readonly gating for provider draft updates
  - provider draft reset baseline reconstruction for the selected provider
- `InstanceDetail.tsx` still explicitly owns:
  - `selectedProviderId`
  - `providerDrafts`
  - `providerRequestDrafts`
  - `selectedProvider` truth through the provider workspace selection helper
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

These sources remain the authority for browser-backed workbench persistence, Provider Center managed-provider projection, marketplace/install ownership, Local Proxy projection, and desktop runtime/plugin registration. This loop only moves provider workspace draft callback shaping.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1648`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.ts`: `316`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`: `101`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.ts`: `33`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`: `24`
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

Relative to the immediately prior `1881` page baseline from the provider workspace selection-state note, the fresh current-worktree re-baseline now measures `InstanceDetail.tsx` at `1648`. This loop records a verified boundary improvement while the section-model helper absorbed the remaining provider workspace draft callback shaping from the page.

## Verification

- RED established in this loop:
  - `pnpm exec tsx packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.test.tsx`
  - failed first because `buildLlmProviderSectionProps(...)` did not yet compose provider workspace draft callbacks
  - `pnpm check:sdkwork-instances`
  - failed first because `InstanceDetail.tsx` still owned inline provider draft/reset callbacks and the contract still expected the new helper boundary
- GREEN in and after this loop:
  - `pnpm exec tsx packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.test.tsx`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-109') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status:
  - repo-wide `pnpm lint` was not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the provider workspace draft boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - provider workspace request-parse or save-request shaping that still remains page-side
  - another remaining page-owned orchestration cluster outside the provider family
- Keep the same rule:
  - shared callback shaping and read-side draft orchestration may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing stay where they are
