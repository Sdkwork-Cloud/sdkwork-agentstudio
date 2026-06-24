> Migrated from `docs/review/step-07-instance-detail-provider-catalog-mutation-executor-extraction-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Provider Catalog Mutation Executor Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned provider catalog mutation executor wrappers out of `InstanceDetail.tsx`
  - keep provider mutation decisions, reload wiring, toast reporting, and all write authority page-owned while centralizing the repeated `instanceService` adapter family

## Root Cause

- After `release-2026-04-10-152`, the current dirty worktree still kept one coherent service-binding family in `InstanceDetail.tsx`:
  - `executeProviderConfigUpdate`
  - `executeProviderCreate`
  - `executeProviderModelUpdate`
  - `executeProviderModelCreate`
  - `executeProviderModelDelete`
  - `executeProviderDelete`
- Those wrappers did not own validation, mutation planning, reload behavior, or user-facing feedback:
  - they only adapted the page-owned `instanceService` surface into the `createOpenClawProviderCatalogMutationRunner(...)` callback contract
  - the actual provider mutation orchestration still lived in `openClawProviderCatalogMutationSupport.ts`
- That made them a good `153` candidate: the wrapper family was repetitive, page-owned, and stable enough to extract without widening the provider mutation boundary.

## Implemented Fix

- Added `packages/sdkwork-claw-instances/src/services/instanceDetailProviderCatalogMutationSupport.ts`.
- Added `createInstanceDetailProviderCatalogMutationExecutors(...)` so the shared helper now owns only:
  - provider-config update executor binding
  - provider create executor binding
  - provider-model update executor binding
  - provider-model create executor binding
  - provider-model delete executor binding
  - provider delete executor binding
- Added focused direct coverage in `packages/sdkwork-claw-instances/src/services/instanceDetailProviderCatalogMutationSupport.test.ts`.
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `providerCatalogMutationExecutors` once through `createInstanceDetailProviderCatalogMutationExecutors({ instanceService })`
  - spreads that executor bundle into `createOpenClawProviderCatalogMutationRunner(...)`
  - stops keeping six inline `instanceService.*` provider executor wrappers in the page shell
- Exported the new helper from `packages/sdkwork-claw-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailProviderCatalogMutationExecutors(...)`
  - the runner to consume `...providerCatalogMutationExecutors`
  - the page to stop keeping inline provider catalog executor wrappers
  - the shared helper to stay free of toast, navigation, and reload authority

## Boundary Decision

- `instanceDetailProviderCatalogMutationSupport.ts` now owns only shared service-executor composition for the provider catalog runner contract.
- `InstanceDetail.tsx` still explicitly owns:
  - the real `instanceService` dependency
  - the choice to expose provider catalog executors to the runner
  - all provider mutation planning, reload wiring, toast reporting, dialog state, truth-source routing, and lifecycle control
- The helper still does not own:
  - provider validation
  - mutation planning
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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side provider catalog executor binding layer.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1004` lines / `40647` bytes
- `packages/sdkwork-claw-instances/src/services/instanceDetailProviderCatalogMutationSupport.ts`: `41` lines / `2254` bytes
- `packages/sdkwork-claw-instances/src/services/instanceDetailProviderCatalogMutationSupport.test.ts`: `78` lines / `3256` bytes

Relative to the immediately prior `1011` page baseline from `release-2026-04-10-152`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1004`. This loop records a verified boundary improvement for the shared provider catalog executor family while also documenting that the broader page baseline has shifted again in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1004`
  - `instanceDetailProviderCatalogMutationSupport.ts`: `41`
  - `instanceDetailConsoleErrorSupport.ts`: `20`
  - `instanceDetailReloadSupport.ts`: `26`
  - `instanceDetailSectionAvailabilitySupport.ts`: `30`
  - `instanceDetailNavigationSupport.ts`: `37`
  - `instanceLifecycleActionSupport.ts`: `150`
  - `instanceWorkbenchServiceCore.ts`: `1032`
  - `instanceServiceCore.ts`: `1274`
- Fresh build evidence:
  - `InstanceDetail-DKOx-fW4.js`: `176.66 kB`
  - `InstanceConfigWorkbenchPanel-DtYVJtPW.js`: `63.33 kB`
  - `InstanceDetailFilesSection-fotvmGzW.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceDetailProviderCatalogMutationSupport.test.ts`
  - failed first because `instanceDetailProviderCatalogMutationSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline provider catalog executor wrappers
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceDetailProviderCatalogMutationSupport.test.ts`
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

This loop closes the remaining page-owned provider catalog executor wrapper family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1004`-line `InstanceDetail.tsx` baseline before selecting `154`.
- Favor only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Prefer the next smallest page-owned service-adapter family instead of widening this helper beyond provider catalog executor binding.

