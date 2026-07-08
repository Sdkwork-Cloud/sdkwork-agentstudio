# Step 07 Managed Config Save Runner Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining shared managed-config save orchestration cluster from `InstanceDetail.tsx`
  - keep the real `instanceService.*` managed-config write paths, `toast` dispatch, `loadWorkbench(...)` authority, truth-source gating, and page-owned draft/error/saving state in the page shell

## Root Cause

- After the prior provider-catalog runner extraction, `InstanceDetail.tsx` still owned one more repeated page-side orchestration cluster around local `runManagedConfigSave(...)`.
- That local runner still handled six managed OpenClaw config save flows:
  - web search
  - x search
  - native Codex web search
  - web fetch
  - auth cooldowns
  - dreaming
- The cluster still duplicated the same side-effect sequence:
  - enter saving state
  - clear page error state
  - execute the real page-owned save callback
  - show translated success toast
  - reload the workbench without spinner
  - map failures back into the page error state
- That sequence did not need to stay inline as long as:
  - each real `instanceService.saveOpenClaw*Config(...)` call stayed injected from the page
  - `toast.success(...)` and `loadWorkbench(...)` authority stayed page-owned
  - page-owned form draft, error, saving, readonly, and truth-source decisions stayed in `InstanceDetail.tsx`

## Implemented Extraction

- Added `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts` to own:
  - `OpenClawManagedConfigSaveRequest`
  - `CreateOpenClawManagedConfigSaveRunnerArgs`
  - `createOpenClawManagedConfigSaveRunner(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.test.ts`
- Updated the service barrel in:
  - `packages/sdkwork-clawstudio-instances/src/services/index.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates `runManagedConfigSave` through `createOpenClawManagedConfigSaveRunner(...)`
  - injects `reloadWorkbench`, `reportSuccess`, and `t`
  - keeps all six managed-config handlers calling the shared runner with page-owned save callbacks
  - removes the deleted local `const runManagedConfigSave = async (...) => { ... }` cluster
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawManagedConfigMutationSupport.ts` now owns:
  - shared save-state toggling
  - page error reset before save
  - translated success reporting through an injected page callback
  - post-save workbench reload sequencing through an injected page callback
  - fallback failure mapping into the injected page error setter
- `InstanceDetail.tsx` still explicitly owns:
  - all `instanceService.saveOpenClawWebSearchConfig(...)`
  - all `instanceService.saveOpenClawXSearchConfig(...)`
  - all `instanceService.saveOpenClawWebSearchNativeCodexConfig(...)`
  - all `instanceService.saveOpenClawWebFetchConfig(...)`
  - all `instanceService.saveOpenClawAuthCooldownsConfig(...)`
  - all `instanceService.saveOpenClawDreamingConfig(...)`
  - all `toast.success(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing decisions
  - all managed-config draft state, error state, and saving state ownership
- This loop does not move Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their existing authoritative layers.

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

These sources remain the authority for browser workbench persistence, Control UI section order, managed-provider classification, ecosystem/runtime boundaries, Local Proxy ownership, and desktop plugin/runtime ownership. The current loop only moves page-side managed-config save orchestration.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1930`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `373`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelMutationSupport.ts`: `239`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`

Because the dirty worktree already carries additional in-flight Step 07 edits beyond the prior release note snapshot, this loop records a verified boundary improvement and a fresh current-worktree hotspot re-baseline rather than claiming a clean raw page-size delta from `release-2026-04-09-96`.

## Verification

- RED already established in this loop before the extraction landed:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.test.ts`
  - failed first because `openClawManagedConfigMutationSupport.ts` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the shared managed-config runner helper did not exist yet
- GREEN in the implementation loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
- YELLOW on fresh repo-wide verification:
  - `pnpm lint`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining page-side managed-config orchestration boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - the remaining agent / skill action orchestration cluster
  - another page-owned orchestration helper that can move shared sequencing out without moving real write authority
- Keep the same rule:
  - shared request shaping and injected execution orchestration may move out
  - truth-source routing, real write-path execution, reload authority, and side-effect ownership must stay in the page
