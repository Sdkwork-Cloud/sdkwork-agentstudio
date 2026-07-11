# Step 07 Managed Channel Mutation Helper Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining managed-channel draft patching, mutation-request construction, and shared mutation execution orchestration hotspot from `InstanceDetail.tsx`
  - keep the real `instanceService.*` write paths, `toast` dispatch, `loadWorkbench(...)` authority, readonly/truth-source decisions, and page state ownership in the page shell

## Root Cause

- After the provider-catalog request extraction, `InstanceDetail.tsx` still owned one more sizeable page-side orchestration cluster around:
  - `handleManagedChannelDraftChange()`
  - `handleToggleManagedChannel()`
  - `handleSaveManagedChannel()`
  - `handleDeleteManagedChannelConfiguration()`
- This cluster still handled:
  - selected-channel draft patching
  - toggle/save/delete mutation-plan construction
  - required-field validation for save
  - empty-value shaping for delete
  - repeated save/toggle/reload/toast orchestration
- That cluster did not own the actual OpenClaw truth-source rules or the real write-path execution. Those still belong to the page shell through `instanceService.*`, page-owned reload authority, and page-owned state transitions.

## Implemented Extraction

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.ts` to own:
  - `applyOpenClawManagedChannelDraftChange(...)`
  - `buildOpenClawManagedChannelToggleMutationRequest(...)`
  - `buildOpenClawManagedChannelSaveMutationRequest(...)`
  - `buildOpenClawManagedChannelDeleteMutationRequest(...)`
  - `runOpenClawManagedChannelMutation(...)` through injected page-owned callbacks
- Added focused coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - consumes the shared managed-channel draft patch helper
  - consumes the shared managed-channel mutation-request builders
  - forwards the built request into `runOpenClawManagedChannelMutation(...)`
  - injects the real `instanceService.*`, `loadWorkbench(...)`, and `toast` operations into the helper-owned runner
  - keeps the delete follow-up draft reset and selection-state cleanup page-owned
- Updated:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawManagedChannelMutationSupport.ts` now owns:
  - managed-channel draft patching
  - save/toggle/delete mutation-request construction
  - save required-field validation
  - delete empty-value shaping
  - injected runner sequencing over `executeSaveConfig`, `executeToggleEnabled`, `reloadWorkbench`, `reportSuccess`, and `reportError`
- `InstanceDetail.tsx` still explicitly owns:
  - all `instanceService.saveOpenClawChannelConfig(...)`
  - all `instanceService.setOpenClawChannelEnabled(...)`
  - all `toast.success(...)` / `toast.error(...)`
  - all `loadWorkbench(...)` authority
  - selected managed-channel id state, draft-map state, error state, and delete follow-up state reset
  - readonly gating and truth-source routing decisions
- This loop does not move Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their existing authoritative layers.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-agentstudio-pc-channels/src/services/channelService.ts`
- `packages/sdkwork-agentstudio-pc-market/src/services/marketService.ts`
- `packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for channel truth, hosted/runtime projection, official ecosystem behavior, Local Proxy ownership, and desktop plugin/runtime boundaries. The current loop only moves page-side managed-channel mutation orchestration.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1823`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.ts`: `223`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`: `215`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `87`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `247`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the prior current-worktree baseline from `release-2026-04-09-94`, the page hotspot now moves from `1972` to `1823`.

## Verification

- RED:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the managed-channel contract still expected the deleted local marker `const runManagedChannelMutation = async` after the page boundary moved to `runOpenClawManagedChannelMutation(...)`
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
- YELLOW:
  - `pnpm lint`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining managed-channel page orchestration boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - the remaining provider runner/completion helpers
  - the remaining page-owned orchestration clusters outside the new managed-channel helper boundary
- Keep the same rule:
  - shared request building and injected orchestration may move out
  - truth-source routing, real write-path execution, reload authority, and side-effect ownership must stay in the page
