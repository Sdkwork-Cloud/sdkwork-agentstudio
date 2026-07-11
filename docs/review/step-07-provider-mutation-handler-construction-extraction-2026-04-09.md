# Step 07 Provider Mutation Handler Construction Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining provider page-handler construction out of `InstanceDetail.tsx`
  - keep `toast.error(...)`, the real provider mutation runner, and all `instanceService.*` provider writes owned by the page shell
  - keep Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport truth-source routing unchanged

## Root Cause

- After the provider mutation build-result dispatch extraction, `InstanceDetail.tsx` still directly owned one more repeated provider orchestration cluster:
  - provider config save handler construction
  - provider dialog submit handler construction
  - provider model submit handler construction
  - provider-model delete handler construction
  - provider delete handler construction
- That meant the page still had to wire the same request-builder and mutation-dispatch pattern inline even though:
  - the orchestration is generic support-layer composition
  - the page only needs to inject page-owned dependencies such as the real mutation runner and `toast.error(...)`
  - the support layer already owns the provider mutation request builders and build-result dispatch helper

## Implemented Extraction

- Extended `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`, which now also owns:
  - provider page-handler construction through `buildOpenClawProviderMutationHandlers(...)`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates `providerMutationHandlers = buildOpenClawProviderMutationHandlers({...})`
  - routes provider config save through `providerMutationHandlers.onSaveProviderConfig`
  - routes provider dialog submit through `providerMutationHandlers.onSubmitProviderDialog`
  - routes provider model submit through `providerMutationHandlers.onSubmitProviderModelDialog`
  - routes provider delete through `providerMutationHandlers.onDeleteProvider`
  - routes provider-model delete through `providerMutationHandlers.onDeleteProviderModel`
  - stops defining those five provider handlers inline
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderCatalogMutationSupport.ts` now owns:
  - provider mutation request construction
  - provider mutation build-result dispatch
  - provider page-handler construction for the five provider mutation entrypoints
- `InstanceDetail.tsx` still explicitly owns:
  - `runProviderCatalogMutation(...)`
  - `toast.error(...)`
  - all provider mutation execution authority through injected page-owned callbacks
  - all `instanceService.*` provider writes through the injected runner
  - all `loadWorkbench(...)` authority
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

These sources remain the authority for browser-backed workbench persistence, Provider Center managed-provider projection, marketplace/install ownership, Local Proxy projection, and desktop runtime/plugin registration. This loop only moves provider handler construction.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1731`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `486`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.ts`: `69`
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `336`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`: `111`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`: `26`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.ts`: `284`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentMutationSupport.ts`: `146`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentSkillMutationSupport.ts`: `204`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.ts`: `29`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1636` page baseline from the provider mutation build-result dispatch note, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1731`. This loop records a verified boundary improvement rather than a raw page shrink, because the helper now owns the remaining provider handler construction while the worktree has also advanced elsewhere.

## Verification

- Focused RED was already established before this writeback:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - failed first because `buildOpenClawProviderMutationHandlers(...)` did not yet exist
  - `pnpm check:sdkwork-instances`
  - failed first because `InstanceDetail.tsx` still defined provider handlers inline and the contract still expected the new helper boundary
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-112') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status remains intentionally scoped:
  - repo-wide `pnpm lint` is still not the release gate for this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the provider mutation boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - provider dialog state-reset input shaping around `createOpenClawProviderCreateDialogState()` and `createOpenClawProviderModelCreateDialogState()`
  - another remaining page-owned orchestration cluster outside the provider family if it yields better shrink without crossing ownership boundaries
- Keep the same rule:
  - shared support-layer branching and presentation shaping may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing stay where they are
