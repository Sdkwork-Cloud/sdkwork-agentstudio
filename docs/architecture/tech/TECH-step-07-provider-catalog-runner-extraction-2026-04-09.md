> Migrated from `docs/review/step-07-provider-catalog-runner-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Provider Catalog Runner Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider-catalog mutation execution and completion orchestration cluster from `InstanceDetail.tsx`
  - keep the real `instanceService.*` write paths, `toast` dispatch, `loadWorkbench(...)` authority, selection truth, and dialog ownership in the page shell

## Root Cause

- After the prior provider-catalog request extraction, `InstanceDetail.tsx` still owned one more sizeable page-side orchestration cluster around:
  - `completeProviderCatalogMutation(...)`
  - `runProviderCatalogMutation(...)`
- That cluster still handled:
  - mutation-kind switching across provider update/create/delete and provider-model update/create/delete
  - translated success/failure toast dispatch
  - save-state toggling
  - workbench reload sequencing
  - selected-provider follow-up selection
- The page did not need to keep that switch-and-complete orchestration inline as long as:
  - real `instanceService.*` writes remained injected from the page
  - `toast` and `loadWorkbench(...)` authority remained page-owned
  - selection and dialog state ownership stayed with the page

## Implemented Extraction

- Extended `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts` to own:
  - `createOpenClawProviderCatalogMutationRunner(...)`
  - shared provider mutation execution sequencing through injected page-owned callbacks
  - translated success/failure reporting through injected page-owned reporters
  - post-mutation reload and selected-provider restoration sequencing
- Added focused coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds a single injected `runProviderCatalogMutation` runner from the shared helper
  - keeps each provider handler calling the runner with the already shared request object
  - removes inline `completeProviderCatalogMutation(...)`
  - removes the inline provider mutation switch
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderCatalogMutationSupport.ts` now owns:
  - provider mutation execution branching across all provider/provider-model mutation kinds
  - shared save-state toggling
  - translated success/failure reporting
  - post-mutation reload sequencing
  - selected-provider restoration sequencing
- `InstanceDetail.tsx` still explicitly owns:
  - all `instanceService.updateInstanceLlmProviderConfig(...)`
  - all `instanceService.createInstanceLlmProvider(...)`
  - all `instanceService.createInstanceLlmProviderModel(...)`
  - all `instanceService.updateInstanceLlmProviderModel(...)`
  - all `instanceService.deleteInstanceLlmProviderModel(...)`
  - all `instanceService.deleteInstanceLlmProvider(...)`
  - all `toast.success(...)` / `toast.error(...)`
  - all `loadWorkbench(...)` authority
  - selected provider state, provider dialog state, provider-model dialog state, and delete dialog cleanup ownership
- This loop does not move Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their existing authoritative layers.

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

These sources remain the authority for managed-provider classification, hosted/runtime projection, official ecosystem behavior, Local Proxy ownership, and desktop plugin/runtime boundaries. The current loop only moves page-side provider mutation execution orchestration.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1770`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `353`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelMutationSupport.ts`: `223`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailSectionContent.tsx`: `215`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `87`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `247`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the prior current-worktree baseline from `release-2026-04-09-95`, the page hotspot now moves from `1823` to `1770`.

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - failed first because `createOpenClawProviderCatalogMutationRunner(...)` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline `completeProviderCatalogMutation(...)`
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

This loop materially improves the remaining provider page orchestration boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - the remaining managed-config save runner cluster around `runManagedConfigSave(...)`
  - the remaining agent-dialog / skill-action orchestration cluster
- Keep the same rule:
  - shared request shaping and injected execution orchestration may move out
  - truth-source routing, real write-path execution, reload authority, and side-effect ownership must stay in the page

