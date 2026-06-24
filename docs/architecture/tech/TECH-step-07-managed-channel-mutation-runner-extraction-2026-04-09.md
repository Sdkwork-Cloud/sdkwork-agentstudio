> Migrated from `docs/review/step-07-managed-channel-mutation-runner-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Managed Channel Mutation Runner Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the repeated managed-channel mutation dependency bundle from `InstanceDetail.tsx`
  - keep page-owned `instanceService.*`, `toast`, `loadWorkbench(...)`, readonly routing, and transient state authority unchanged

## Root Cause

- `handleToggleManagedChannel()`, `handleSaveManagedChannel()`, and `handleDeleteManagedChannelConfiguration()` each rebuilt the same `runOpenClawManagedChannelMutation(...)` dependency object:
  - `executeSaveConfig`
  - `executeToggleEnabled`
  - spinnerless workbench reload
  - success/error toast reporters
- That duplication kept page-side write authority correct, but it left `InstanceDetail.tsx` carrying one more avoidable orchestration hotspot.
- Fresh RED also exposed a real follow-up bug during the refactor:
  - the delete wrapper read `baseRequest.mutationPlan.emptyValues` from a union-typed closure without stable narrowing, which failed TypeScript lint until the narrowed value was captured explicitly

## Implemented Fix

- Extended `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.ts` with:
  - `CreateOpenClawManagedChannelMutationRunnerArgs`
  - `createOpenClawManagedChannelMutationRunner(...)`
- Added focused RED/GREEN coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` to:
  - construct one shared `runManagedChannelMutation`
  - route toggle and save directly through that runner
  - keep delete-specific draft reset page-owned, but pass the final request through the same runner
- Updated `scripts/sdkwork-instances-contract.test.ts` so the page contract now requires:
  - one shared managed-channel mutation runner
  - no repeated inline save/toggle/reload/toast dependency bundle inside the three handlers

## Boundary Decision

- `openClawManagedChannelMutationSupport.ts` now owns:
  - injected managed-channel mutation runner composition
  - adapter wiring from page-owned save/toggle callbacks into `runOpenClawManagedChannelMutation(...)`
- `InstanceDetail.tsx` still explicitly owns:
  - `instanceService.saveOpenClawChannelConfig(...)`
  - `instanceService.setOpenClawChannelEnabled(...)`
  - `toast.success(...)` / `toast.error(...)`
  - `loadWorkbench(...)`
  - selected-channel id, draft map, error state, and delete follow-up draft reset
  - readonly and truth-source routing decisions

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

These sources still anchor browser fallback truth, managed channel/config semantics, Provider Center managed-state rules, local proxy provider projection, and desktop plugin/runtime ownership. This loop only extracts repeated page-side mutation runner wiring.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1504`
- `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.ts`: `275`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`: `1431`
- Fresh build evidence:
  - `InstanceDetail-Dwuvrazg.js`: `178.64 kB`
  - `InstanceConfigWorkbenchPanel-DOJc8SB6.js`: `63.32 kB`
  - `InstanceDetailFilesSection-CuOu19Fl.js`: `2.38 kB`

Because the worktree already carries adjacent Step 07 edits, this loop records a verified current-worktree re-baseline rather than attributing every chunk delta only to the shared runner extraction.

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop removes another repeated page-side orchestration bundle and closes a real narrowing regression discovered during verification, but Step 07 is still not closed.

## Next Frontier

- Keep shrinking `InstanceDetail.tsx` through page-side transient and presentation bundles only.
- Preserve the current rule:
  - shared request building and injected orchestration may move out
  - real write paths, reload authority, truth-source routing, and side effects stay in the page shell

