# Step 07 Instance Detail Managed Config Mutation Executor Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned managed-config save executors out of `InstanceDetail.tsx`
  - keep managed-config mutation planning, validation, saving state, reload behavior, toast/error reporting, and truth-source routing page-owned while centralizing the repeated `instanceService` adapter family

## Root Cause

- After `release-2026-04-10-157`, the current dirty worktree still kept one coherent `instanceService` binding family in `InstanceDetail.tsx` for managed-config save surfaces:
  - `webSearch`
  - `xSearch`
  - `webSearchNativeCodex`
  - `webFetch`
  - `authCooldowns`
  - `dreaming`
- Those wrappers did not own managed-config draft selection, validation, mutation-plan construction, page saving state, page error state, reload behavior, or toast reporting:
  - they only adapted the page-owned `instanceService` surface into the `buildOpenClawManagedConfigMutationHandlers(...)` callback contract
  - the actual mutation orchestration still lived in `openClawManagedConfigMutationSupport.ts`
- At close-out, `158` was still red because the helper interface spellings for:
  - `saveOpenClawWebSearchNativeCodexConfig`
  - `saveOpenClawAuthCooldownsConfig`
  were split across lines, and the contract test intentionally enforced single-line property spellings for those type references.

## Implemented Fix

- Added `packages/sdkwork-clawstudio-instances/src/services/instanceDetailManagedConfigMutationSupport.ts`.
- Added `createInstanceDetailManagedConfigMutationExecutors(...)` so the shared helper now owns only:
  - managed web-search save executor binding
  - managed x-search save executor binding
  - managed native-codex save executor binding
  - managed web-fetch save executor binding
  - managed auth-cooldowns save executor binding
  - managed dreaming save executor binding
- Added focused direct coverage in `packages/sdkwork-clawstudio-instances/src/services/instanceDetailManagedConfigMutationSupport.test.ts`.
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `managedConfigMutationExecutors` once through `createInstanceDetailManagedConfigMutationExecutors({ instanceService })`
  - routes every managed-config surface through `managedConfigMutationExecutors.<surface>.executeSave`
  - stops keeping six inline managed-config `instanceService` executor wrappers in the page shell
- Exported the new helper from `packages/sdkwork-clawstudio-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailManagedConfigMutationExecutors(...)`
  - the managed-config mutation handler builder to consume explicit `managedConfigMutationExecutors.<surface>.executeSave` bindings
  - the page to stop keeping inline managed-config save executor wrappers
  - the shared helper to stay free of direct reload, toast, and broader page authority
- Closed the remaining contract mismatch by normalizing the two regex-sensitive interface property type declarations to the single-line spellings enforced by the contract.

## Boundary Decision

- `instanceDetailManagedConfigMutationSupport.ts` now owns only shared service-executor composition for the managed-config handler contract.
- `InstanceDetail.tsx` still explicitly owns:
  - the real `instanceService` dependency
  - the choice to expose managed-config executors to the handler builder
  - all draft selection, validation, saving-state wiring, page error-state wiring, reload behavior, toast/error reporting, truth-source routing, and broader page control
- The helper still does not own:
  - managed-config mutation orchestration
  - validation
  - page saving state
  - page error state
  - reload behavior
  - navigation
  - user-facing toast feedback

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side managed-config executor binding layer.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1068` lines / `40254` bytes
- `packages/sdkwork-clawstudio-instances/src/services/instanceDetailManagedConfigMutationSupport.ts`: `53` lines / `2448` bytes
- `packages/sdkwork-clawstudio-instances/src/services/instanceDetailManagedConfigMutationSupport.test.ts`: `80` lines / `2936` bytes

Relative to the immediately prior `1065` page baseline from `release-2026-04-10-157`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1068`. This loop records a verified boundary improvement for the shared managed-config executor family while also documenting that the broader page baseline has shifted again in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1068`
  - `instanceDetailManagedConfigMutationSupport.ts`: `53`
  - `instanceDetailLifecycleMutationSupport.ts`: `23`
  - `instanceDetailManagedChannelMutationSupport.ts`: `23`
  - `instanceDetailAgentMutationSupport.ts`: `25`
  - `instanceDetailAgentSkillMutationSupport.ts`: `23`
  - `instanceDetailProviderCatalogMutationSupport.ts`: `45`
  - `instanceDetailConsoleErrorSupport.ts`: `23`
  - `instanceDetailReloadSupport.ts`: `31`
  - `instanceDetailSectionAvailabilitySupport.ts`: `35`
  - `instanceDetailNavigationSupport.ts`: `43`
  - `instanceLifecycleActionSupport.ts`: `166`
  - `instanceWorkbenchServiceCore.ts`: `1135`
  - `instanceServiceCore.ts`: `1432`
- Fresh build evidence:
  - `InstanceDetail-DPThmOAT.js`: `176.26 kB`
  - `InstanceConfigWorkbenchPanel-BQ4V-dDF.js`: `63.33 kB`
  - `InstanceDetailFilesSection-DBo8cPpm.js`: `2.38 kB`

## Verification

- RED inherited at loop close-out:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed because the helper interface declarations for `saveOpenClawWebSearchNativeCodexConfig` and `saveOpenClawAuthCooldownsConfig` were split across lines and missed the contract regex
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceDetailManagedConfigMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/clawstudio-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version
  - `pnpm.cmd build` prints a non-blocking Rolldown plugin timing warning; the build still exits successfully

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-owned managed-config executor wrapper family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1068`-line `InstanceDetail.tsx` baseline before selecting `159`.
- Favor only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Prefer the next smallest page-owned service-adapter family instead of widening the managed-config helper beyond executor binding.
