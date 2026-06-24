> Migrated from `docs/review/step-07-instance-detail-managed-channel-mutation-executor-extraction-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Managed-Channel Mutation Executor Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned managed-channel mutation executors out of `InstanceDetail.tsx`
  - keep mutation planning, selection state, draft state, pending-state wiring, reload behavior, and user-facing feedback page-owned while centralizing the repeated `instanceService` adapter family

## Root Cause

- After `release-2026-04-10-155`, the current dirty worktree still kept one coherent `instanceService` binding family in `InstanceDetail.tsx` for the managed-channel runner:
  - `executeSaveConfig`
  - `executeToggleEnabled`
- Those wrappers did not own mutation-plan construction, field validation, draft resets, reload behavior, or error/toast reporting:
  - they only adapted the page-owned `instanceService` surface into the `createOpenClawManagedChannelMutationRunner(...)` callback contract
  - the actual managed-channel mutation orchestration still lived in `openClawManagedChannelMutationSupport.ts`
- That made them a good `156` candidate: the wrapper family was repetitive, page-owned, and stable enough to extract without widening the managed-channel mutation boundary.

## Implemented Fix

- Added `packages/sdkwork-claw-instances/src/services/instanceDetailManagedChannelMutationSupport.ts`.
- Added `createInstanceDetailManagedChannelMutationExecutors(...)` so the shared helper now owns only:
  - managed-channel save-config executor binding
  - managed-channel toggle-enabled executor binding
- Added focused direct coverage in `packages/sdkwork-claw-instances/src/services/instanceDetailManagedChannelMutationSupport.test.ts`.
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `managedChannelMutationExecutors` once through `createInstanceDetailManagedChannelMutationExecutors({ instanceService })`
  - spreads that executor bundle into `createOpenClawManagedChannelMutationRunner(...)`
  - stops keeping two inline `instanceService` executor wrappers in the page shell
- Exported the new helper from `packages/sdkwork-claw-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailManagedChannelMutationExecutors(...)`
  - the managed-channel mutation runner to consume `...managedChannelMutationExecutors`
  - the page to stop keeping inline managed-channel executor wrappers
  - the shared helper to stay free of toast, navigation, and reload authority

## Boundary Decision

- `instanceDetailManagedChannelMutationSupport.ts` now owns only shared service-executor composition for the managed-channel mutation runner contract.
- `InstanceDetail.tsx` still explicitly owns:
  - the real `instanceService` dependency
  - the choice to expose managed-channel executors to the runner
  - all mutation-plan construction, selection state, draft-state wiring, pending-state wiring, reload behavior, toast reporting, truth-source routing, and lifecycle control
- The helper still does not own:
  - mutation planning
  - selected-channel or draft state
  - pending-state management
  - reload behavior
  - navigation
  - user-facing toast feedback

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side managed-channel executor binding layer.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1063` lines / `40328` bytes
- `packages/sdkwork-claw-instances/src/services/instanceDetailManagedChannelMutationSupport.ts`: `22` lines / `983` bytes
- `packages/sdkwork-claw-instances/src/services/instanceDetailManagedChannelMutationSupport.test.ts`: `53` lines / `1748` bytes

Relative to the immediately prior `1062` page baseline from `release-2026-04-10-155`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1063`. This loop records a verified boundary improvement for the shared managed-channel executor family while also documenting that the broader page baseline has shifted again in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1063`
  - `instanceDetailManagedChannelMutationSupport.ts`: `22`
  - `instanceDetailAgentMutationSupport.ts`: `24`
  - `instanceDetailAgentSkillMutationSupport.ts`: `22`
  - `instanceDetailProviderCatalogMutationSupport.ts`: `44`
  - `instanceDetailConsoleErrorSupport.ts`: `22`
  - `instanceDetailReloadSupport.ts`: `30`
  - `instanceDetailSectionAvailabilitySupport.ts`: `34`
  - `instanceDetailNavigationSupport.ts`: `42`
  - `instanceLifecycleActionSupport.ts`: `165`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- Fresh build evidence:
  - `InstanceDetail-BTy41hdP.js`: `176.41 kB`
  - `InstanceConfigWorkbenchPanel-Cn02zlbl.js`: `63.33 kB`
  - `InstanceDetailFilesSection-h9RJSFSU.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceDetailManagedChannelMutationSupport.test.ts`
  - failed first because `instanceDetailManagedChannelMutationSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline managed-channel executor wrappers
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceDetailManagedChannelMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/claw-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version
  - `pnpm.cmd build` prints a non-blocking Rolldown plugin timing warning; the build still exits successfully

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-owned managed-channel executor wrapper family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1063`-line `InstanceDetail.tsx` baseline before selecting `157`.
- Favor only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Prefer the next smallest page-owned service-adapter family instead of widening this helper beyond managed-channel executor binding.

