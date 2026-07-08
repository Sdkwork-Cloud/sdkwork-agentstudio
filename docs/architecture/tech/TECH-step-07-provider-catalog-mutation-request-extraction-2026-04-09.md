> Migrated from `docs/review/step-07-provider-catalog-mutation-request-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Provider Catalog Mutation Request Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider catalog mutation-request construction cluster from `InstanceDetail.tsx`
  - keep the real provider catalog mutation runner, `instanceService.*` write paths, toast dispatch, reload authority, and page state ownership in the page shell

## Root Cause

- After the section-router extraction, `InstanceDetail.tsx` still owned one more sizeable page-side orchestration hotspot around:
  - `handleSaveProviderConfig()`
  - `handleSubmitProviderDialog()`
  - `handleSubmitProviderModelDialog()`
  - `handleDeleteProviderModel()`
  - `handleDeleteProvider()`
- This cluster still handled readonly/precondition guards, save-input construction, validation-message translation, mutation-plan construction, and runner-request packaging, but it did not own the real Provider Center truth-source rules or the actual `instanceService.*` write-path execution.

## Implemented Extraction

- Added `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts` to own:
  - provider-config mutation request construction
  - provider-create mutation request construction
  - provider-model create/update mutation request construction
  - provider-model delete mutation request construction
  - provider delete mutation request construction
  - translation-aware `skip` / `error` / `mutation` result shaping for the page shell
- Added focused coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - consumes the shared provider-catalog request builders
  - forwards the built request object into the page-owned `runProviderCatalogMutation(...)`
  - keeps `completeProviderCatalogMutation(...)` and the real `instanceService.*` switch in-page
- Updated:
  - `packages/sdkwork-clawstudio-instances/src/services/index.ts`
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderCatalogMutationSupport.ts` owns only pure mutation-request construction:
  - precondition gating
  - save-input validation
  - translation-aware validation fallback selection
  - mutation-plan construction
  - runner metadata packaging through `afterSuccess`, `setSaving`, and `withSpinner`
- `InstanceDetail.tsx` still owns:
  - `runProviderCatalogMutation(...)`
  - `completeProviderCatalogMutation(...)`
  - all `instanceService.updateInstanceLlmProviderConfig(...)`
  - all `instanceService.createInstanceLlmProvider(...)`
  - all `instanceService.createInstanceLlmProviderModel(...)`
  - all `instanceService.updateInstanceLlmProviderModel(...)`
  - all `instanceService.deleteInstanceLlmProviderModel(...)`
  - all `instanceService.deleteInstanceLlmProvider(...)`
  - all `toast` dispatch
  - all `loadWorkbench(...)` authority
  - all provider selection state, dialog state, and dismiss/reset state ownership
- This loop does not move Provider Center managed classification, Local Proxy projection, desktop runtime/plugin boundaries, or transport/truth-source routing.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
- `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for Provider Center managed classification, gateway/detail truth, official channel setup surfaces, market and agent ecosystem behavior, Local Proxy projection, and desktop plugin/runtime ownership. The current loop only moves page-side provider mutation-request construction.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1972`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `241`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the prior current-worktree baseline from `release-2026-04-09-93`, the page hotspot now moves from `2009` to `1972`.

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - failed first because `openClawProviderCatalogMutationSupport.ts` did not exist yet
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
- YELLOW:
  - `pnpm lint`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining provider-catalog page orchestration boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - the remaining page-owned provider catalog runner/completion helpers
  - the remaining managed-channel/runtime orchestration cluster
- Keep the same rule:
  - pure page-side orchestration and request shaping may move out
  - truth-source routing, real write-path execution, reload authority, and side-effect ownership must stay in the page

