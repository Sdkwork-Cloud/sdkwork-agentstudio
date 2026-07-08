# Step 07 Provider Dialog Reset Drafts Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining provider dialog reset-drafts bundle shaping out of `InstanceDetail.tsx`
  - keep `toast.error(...)`, the real provider mutation runner, and all `instanceService.*` provider writes owned by the page shell
  - keep Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport truth-source routing unchanged

## Root Cause

- After the provider mutation handler-construction extraction, the page still directly owned one more duplicated provider dialog reset cluster:
  - instance-switch reset of provider dialog draft and provider-model dialog draft
  - provider dialog close reset
  - provider-model dialog close reset
- That meant the page and the section-model helper still rebuilt the same pair of empty provider dialog drafts in multiple places even though:
  - the reset bundle is shared presentation-layer state shaping
  - the page only needs to inject state setters and keep ownership of visibility flags, delete ids, writes, `toast`, and reload
  - the provider presentation layer already owned the dialog create/edit state factories

## Implemented Extraction

- Extended `packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.ts`, which now also owns:
  - shared provider dialog reset-draft bundle creation through `createOpenClawProviderDialogResetDrafts()`
- Rewired `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.ts` so the shared dialog-state helper now:
  - consumes `setProviderDialogDraft`
  - consumes `setProviderModelDialogDraft`
  - resets both dialogs by calling `createOpenClawProviderDialogResetDrafts()` internally instead of requiring page-owned reset closures
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - uses `createOpenClawProviderDialogResetDrafts()` during instance-switch reset
  - injects state setters directly into `buildLlmProviderDialogStateHandlers(...)`
  - stops rebuilding provider dialog reset drafts inline for dialog close/reset handling
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.test.tsx`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderPresentation.ts` now owns:
  - provider dialog create-state construction
  - provider-model create/edit-state construction
  - provider dialog reset-drafts bundle construction
  - provider dialog presentation derivation
- `instanceDetailSectionModels.ts` now owns:
  - provider dialog close/reset orchestration through injected setters
- `InstanceDetail.tsx` still explicitly owns:
  - `runProviderCatalogMutation(...)`
  - `toast.error(...)`
  - all provider mutation execution authority through injected page-owned callbacks
  - all `instanceService.*` provider writes through the injected runner
  - all `loadWorkbench(...)` authority
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

These sources remain the authority for browser-backed workbench persistence, Provider Center managed-provider projection, marketplace/install ownership, Local Proxy projection, and desktop runtime/plugin registration. This loop only moves provider dialog reset-draft shaping.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1725`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `486`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.ts`: `84`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.ts`: `343`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`: `111`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`: `26`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.ts`: `284`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.ts`: `146`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentSkillMutationSupport.ts`: `204`
- `packages/sdkwork-clawstudio-instances/src/services/instanceLifecycleActionSupport.ts`: `29`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1731` page baseline from the provider mutation handler-construction note, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1725`. This loop records both a verified boundary improvement and a small page shrink while the provider presentation helper absorbed the shared reset-drafts bundle.

## Verification

- Focused RED was established in this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.test.ts`
  - failed first because `createOpenClawProviderDialogResetDrafts()` did not yet exist
  - `pnpm exec tsx packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.test.tsx`
  - failed first because `buildLlmProviderDialogStateHandlers(...)` still required page-owned reset callbacks
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the contract still saw inline page-owned provider reset composition
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.test.ts`
  - `pnpm exec tsx packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.test.tsx`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-113') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status remains intentionally scoped:
  - repo-wide `pnpm lint` is still not the release gate for this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the provider dialog reset boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - remaining provider dialog draft initialization around the page-level `useState(...)` initializers
  - another remaining page-owned orchestration cluster outside the provider family if it yields better shrink without crossing ownership boundaries
- Keep the same rule:
  - shared support-layer branching and presentation shaping may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing stay where they are
