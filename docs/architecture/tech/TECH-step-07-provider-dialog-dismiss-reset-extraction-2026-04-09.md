> Migrated from `docs/review/step-07-provider-dialog-dismiss-reset-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Provider Dialog Dismiss Reset Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider dialog dismiss/reset callback cluster from `InstanceDetail.tsx`
  - stop using `InstanceDetailManagedLlmProvidersSection.tsx` as a dialog dismiss/reset bridge
  - keep page-owned provider truth, write authority, and OpenClaw control-plane boundaries unchanged

## Root Cause

- After the earlier provider mutation/helper extractions, `InstanceDetail.tsx` still kept one more unstable provider-dialog cluster inline:
  - `resetProviderDialogDraft(...)`
  - `resetProviderModelDialogDraft(...)`
  - `dismissProviderDialog(...)`
  - `dismissProviderModelDialog(...)`
- The managed composition wrapper also still owned another layer of close-time bridging for:
  - provider dialog draft reset on dialog close
  - provider model dialog draft reset on dialog close
  - provider delete-dialog dismiss cleanup
  - provider model delete-dialog dismiss cleanup
- That boundary did not need to stay split across the page and the managed wrapper as long as:
  - the page still injects all state setters
  - the page still owns `selectedProvider` truth
  - the page still owns all real `instanceService.*` writes, `toast` dispatch, and `loadWorkbench(...)` authority

## Implemented Extraction

- Extended `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts` so it now exports `buildLlmProviderDialogStateHandlers(...)`, which owns:
  - provider dialog close/reset callback shaping
  - provider model dialog close/reset callback shaping
  - provider delete-dialog dismiss callback shaping
  - provider model delete-dialog dismiss callback shaping
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - injects the page-owned setters into `buildLlmProviderDialogStateHandlers(...)`
  - uses the shared `dismissProviderDialog` and `dismissProviderModelDialog` callbacks for provider mutation `afterSuccess`
  - stops defining the named inline reset/dismiss provider dialog helpers
  - stops passing raw dismiss/reset props into the managed LLM provider composition wrapper
- Simplified `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx` so it now only composes:
  - `InstanceDetailLlmProvidersSection`
  - `InstanceDetailLlmProviderDialogs`
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `instanceDetailSectionModels.ts` now owns:
  - section-facing provider dialog close/reset callback shaping
  - section-facing provider model dialog close/reset callback shaping
  - provider/provider-model delete dialog dismiss cleanup callback shaping
  - dismiss-time sequencing through injected page-owned setters
- `InstanceDetailManagedLlmProvidersSection.tsx` now only owns:
  - section/dialog composition
- `InstanceDetail.tsx` still explicitly owns:
  - `setIsProviderDialogOpen(...)`
  - `setProviderDialogDraft(...)`
  - `setIsProviderModelDialogOpen(...)`
  - `setProviderModelDialogDraft(...)`
  - `setProviderDeleteId(...)`
  - `setProviderModelDeleteId(...)`
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

These sources remain the authority for browser-backed workbench persistence, Provider Center managed-provider projection, channel/market/install ownership, Local Proxy projection, and desktop runtime/plugin registration. This loop only moves provider dialog dismiss/reset callback shaping.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1909`
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `207`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedLlmProvidersSection.tsx`: `26`
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

Relative to the immediately prior `1742` page baseline from the agent dialog dismiss/reset note, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1909`. This loop still records a verified boundary improvement, but not a raw shrink, because the worktree advanced elsewhere while the shared helper now owns the provider dialog close/reset sequencing and the managed composition wrapper became thinner.

## Verification

- RED established in this loop:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
  - failed first because `buildLlmProviderDialogStateHandlers(...)` did not yet exist
  - `pnpm check:sdkwork-instances`
  - failed first because the provider catalog contract still expected the page to create that shared state helper boundary
- GREEN in and after this loop:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-105') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status:
  - repo-wide `pnpm lint` was not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining provider dialog dismiss/reset boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - another remaining provider dialog open/create draft-setup cluster
  - another remaining page-owned orchestration cluster that can move without absorbing write-path authority
- Keep the same rule:
  - shared callback shaping may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing stay where they are

