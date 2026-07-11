# Step 07 Provider Mutation Build Result Dispatch Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider mutation build-result dispatch boilerplate from `InstanceDetail.tsx`
  - keep `toast`, `runProviderCatalogMutation(...)`, and all `instanceService.*` provider writes owned by the page shell
  - keep Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport truth-source routing unchanged

## Root Cause

- After the provider dialog presentation extraction, `InstanceDetail.tsx` still directly owned one more repeated provider mutation orchestration cluster:
  - `skip / error / mutation` result branching for provider config save
  - the same branching for provider dialog submit
  - the same branching for provider model submit
  - the same branching for provider-model delete
  - the same branching for provider delete
- That meant the page still had to duplicate mutation-result dispatch logic inline even though:
  - the branching is generic support-layer orchestration
  - the page only needs to inject the actual runner and page-owned `toast.error(...)`
  - the support layer already owns the provider mutation request types

## Implemented Extraction

- Extended `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`, which now owns:
  - `skip / error / mutation` build-result dispatch through `runOpenClawProviderCatalogMutationBuildResult(...)`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - routes all five provider mutation handlers through `runOpenClawProviderCatalogMutationBuildResult(...)`
  - injects `runProviderCatalogMutation(...)` as the execution dependency
  - injects `toast.error(...)` as the page-owned error reporter
  - stops branching on `mutationRequest.kind` inline for provider config save, provider dialog submit, provider model submit, provider-model delete, and provider delete
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderCatalogMutationSupport.ts` now owns:
  - provider mutation build-result dispatch
  - generic `skip / error / mutation` branching for provider mutations
- `InstanceDetail.tsx` still explicitly owns:
  - `runProviderCatalogMutation(...)`
  - `toast.error(...)`
  - all provider mutation request construction inputs
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

These sources remain the authority for browser-backed workbench persistence, Provider Center managed-provider projection, marketplace/install ownership, Local Proxy projection, and desktop runtime/plugin registration. This loop only moves provider mutation build-result dispatch.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1636`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `367`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.ts`: `59`
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `316`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`: `101`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`: `24`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.ts`: `263`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentMutationSupport.ts`: `135`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentSkillMutationSupport.ts`: `187`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.ts`: `26`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.ts`: `223`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`: `215`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `87`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `247`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately prior `1647` page baseline from the provider dialog presentation note, the fresh current-worktree re-baseline now measures `InstanceDetail.tsx` at `1636`. This loop records another verified page-side boundary improvement while the provider catalog mutation support helper absorbed the repeated provider mutation build-result dispatch.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - failed first because `runOpenClawProviderCatalogMutationBuildResult(...)` did not yet exist
  - `pnpm check:sdkwork-instances`
  - failed first because `InstanceDetail.tsx` still branched on provider mutation result kinds inline and the contract still expected the new helper boundary
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-111') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status:
  - repo-wide `pnpm lint` was not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the provider mutation dispatch boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - provider dialog state-reset input shaping or another remaining provider dialog orchestration cluster
  - another remaining page-owned orchestration cluster outside the provider family
- Keep the same rule:
  - shared support-layer branching and presentation shaping may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing stay where they are
