# Step 07 Provider Dialog Presentation Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider dialog presentation-derivation cluster from `InstanceDetail.tsx`
  - keep provider dialog draft truth, provider mutation authority, and dialog visibility authority in the page shell
  - keep Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport truth-source routing unchanged

## Root Cause

- After the provider workspace draft callback extraction, `InstanceDetail.tsx` still directly owned one more pure provider dialog presentation cluster:
  - provider dialog model parsing from `modelsText`
  - provider dialog request-overrides parse-error shaping
- That meant the page still had to compute read-side provider dialog presentation state inline even though:
  - the logic is pure parsing and display shaping
  - the logic already depends on shared provider parsing helpers
  - the page only needs to keep dialog state, write handlers, and mutation authority

## Implemented Extraction

- Extended `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.ts`, which now owns:
  - provider dialog models derivation through `parseOpenClawProviderModelsText(...)`
  - provider dialog request-overrides parse-error shaping through `parseOpenClawProviderRequestOverridesDraft(...)`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - memoizes `buildOpenClawProviderDialogPresentation(...)`
  - consumes `providerDialogModels` and `providerDialogRequestParseError` from the shared helper result
  - stops parsing provider dialog models inline
  - stops shaping provider dialog request parse errors inline
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.test.ts`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderPresentation.ts` now owns:
  - provider dialog models parsing
  - provider dialog request-overrides parse-error shaping
  - preservation of the existing parser-authored error-message semantics
- `InstanceDetail.tsx` still explicitly owns:
  - `providerDialogDraft`
  - `isProviderDialogOpen`
  - all provider dialog submit handlers and `instanceService.*` mutations
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

These sources remain the authority for browser-backed workbench persistence, Provider Center managed-provider projection, marketplace/install ownership, Local Proxy projection, and desktop runtime/plugin registration. This loop only moves provider dialog presentation derivation.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1647`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.ts`: `59`
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `316`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`: `101`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`: `24`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.ts`: `263`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentMutationSupport.ts`: `135`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentSkillMutationSupport.ts`: `187`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.ts`: `26`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `353`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.ts`: `223`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`: `215`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `87`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `247`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately prior `1648` page baseline from the provider workspace draft callback note, the fresh current-worktree re-baseline now measures `InstanceDetail.tsx` at `1647`. This loop records another verified page-side boundary improvement while `openClawProviderPresentation.ts` absorbed the remaining provider dialog presentation derivation.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.test.ts`
  - failed first because `buildOpenClawProviderDialogPresentation(...)` did not yet exist
  - `pnpm check:sdkwork-instances`
  - failed first because `InstanceDetail.tsx` still owned inline provider dialog presentation derivation and the contract still expected the new helper boundary
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-110') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status:
  - repo-wide `pnpm lint` was not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the provider dialog presentation boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - provider dialog submit-request shaping or adjacent provider save orchestration that still remains page-side
  - another remaining page-owned orchestration cluster outside the provider family
- Keep the same rule:
  - shared read-side presentation shaping may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing stay where they are
