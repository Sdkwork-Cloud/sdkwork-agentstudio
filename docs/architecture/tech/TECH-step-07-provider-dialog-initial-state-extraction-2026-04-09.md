> Migrated from `docs/review/step-07-provider-dialog-initial-state-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Provider Dialog Initial State Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining page-local provider dialog initial-state construction from `InstanceDetail.tsx`
  - keep `toast.error(...)`, the real provider mutation runner, and all `instanceService.*` provider writes owned by the page shell
  - keep Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport truth-source routing unchanged

## Root Cause

- After the provider dialog reset-drafts extraction, `InstanceDetail.tsx` still directly owned one more provider dialog initialization seam:
  - initial provider dialog draft construction in `useState(...)`
  - initial provider-model dialog draft construction in `useState(...)`
- That meant the page still depended directly on the provider create-state factories even though:
  - the shared provider reset-drafts helper already defined the canonical empty provider dialog state pair
  - the page only needs the initial draft values, not the lower-level create-state factories
  - keeping the page on the shared reset helper shrinks direct presentation coupling and keeps the initialization baseline aligned with the reset baseline

## Implemented Extraction

- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - initializes `providerDialogDraft` from `createOpenClawProviderDialogResetDrafts().providerDialogDraft`
  - initializes `providerModelDialogDraft` from `createOpenClawProviderDialogResetDrafts().providerModelDialogDraft`
  - stops calling `createOpenClawProviderCreateDialogState()` directly
  - stops calling `createOpenClawProviderModelCreateDialogState()` directly
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderPresentation.ts` remains the owner of:
  - provider dialog create-state construction
  - provider-model create/edit-state construction
  - provider dialog reset-drafts bundle construction
  - provider dialog presentation derivation
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - `runProviderCatalogMutation(...)`
  - `toast.error(...)`
  - all provider mutation execution authority through injected page-owned callbacks
  - all `instanceService.*` provider writes through the injected runner
  - all `loadWorkbench(...)` authority
  - Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing through the existing authoritative layers

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-claw-channels/src/services/channelService.ts`
- `packages/sdkwork-claw-market/src/services/marketService.ts`
- `packages/sdkwork-claw-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for browser-backed workbench persistence, Provider Center managed-provider projection, marketplace/install ownership, Local Proxy projection, and desktop runtime/plugin registration. This loop only moves provider dialog initial-state wiring.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1720`
- `packages/sdkwork-claw-instances/src/services/openClawProviderPresentation.ts`: `84`
- `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts`: `343`
- `packages/sdkwork-claw-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `486`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`: `111`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`: `26`
- `packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.ts`: `284`
- `packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.ts`: `146`
- `packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.ts`: `204`
- `packages/sdkwork-claw-instances/src/services/instanceLifecycleActionSupport.ts`: `29`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1725` page baseline from the provider dialog reset-drafts note, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1720`. This loop records a verified boundary improvement and another small page shrink while the page stopped depending directly on the provider create-state factories.

## Verification

- Focused RED was established in this loop:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still initialized the two provider dialog drafts with the lower-level create-state factories instead of the shared reset-drafts helper
- GREEN in and after this loop:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-114') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status remains intentionally scoped:
  - repo-wide `pnpm lint` is still not the release gate for this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the provider dialog initialization boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - remaining provider dialog launch-state construction in the section-model helper if it can shrink further without crossing ownership boundaries
  - another remaining page-owned orchestration cluster outside the provider family if it yields better shrink
- Keep the same rule:
  - shared support-layer branching and presentation shaping may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing stay where they are

