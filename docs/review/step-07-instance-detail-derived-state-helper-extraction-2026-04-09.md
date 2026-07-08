# Step 07 Instance Detail Derived State Helper Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-facing pure derived-state cluster out of `InstanceDetail.tsx`
  - keep page-owned write authority, `toast`, `loadWorkbench(...)`, and truth-source routing unchanged
  - close the contract drift introduced by the extraction and re-verify that the page still compiles and builds

## Root Cause

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` still mixed page-owned mutation wiring with a large pure read-side projection cluster for:
  - provider readonly and Provider Center ownership state
  - managed-channel selection and workspace projection
  - managed web-search provider selection
  - management summary and memory workbench shaping
  - provider dialog presentation and agent model options
- After the helper extraction landed, `scripts/sdkwork-instances-contract.test.ts` still pinned `detail?.lifecycle.configWritable` to the page source instead of the new helper boundary.
- Fresh TypeScript verification then exposed a real regression: `handleOpenOpenClawConsole(...)` still referenced a removed local `consoleAccess` variable instead of the surviving `detail.consoleAccess` truth source.

## Implemented Fix

- Added `packages/sdkwork-clawstudio-instances/src/services/instanceDetailDerivedState.ts`.
- Added `packages/sdkwork-clawstudio-instances/src/services/instanceDetailDerivedState.test.ts`.
- Exported the helper through `packages/sdkwork-clawstudio-instances/src/services/index.ts`.
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` to consume `buildInstanceDetailDerivedState(...)` for:
  - `isOpenClawConfigWritable`
  - lifecycle capability booleans
  - provider readonly and Provider Center capability state
  - `memoryWorkbenchState`
  - `managementSummary`
  - `providerSelectionState`
  - `managedChannelSelectionState`
  - `webSearchProviderSelectionState`
  - `providerDialogPresentation`
  - `availableAgentModelOptions`
  - `readonlyChannelWorkspaceItems`
  - `managedChannelWorkspaceItems`
- Updated `scripts/sdkwork-instances-contract.test.ts` so the `configWritable` ownership contract now asserts against `instanceDetailDerivedState.ts`.
- Added a RED/GREEN contract around `handleOpenOpenClawConsole(...)` and fixed the page to read `detail?.consoleAccess` directly.

## Boundary Decision

- `instanceDetailDerivedState.ts` now owns pure read-side shaping only.
- `InstanceDetail.tsx` still owns:
  - all page state containers and setter dispatch
  - all real writes via `instanceService`
  - `toast.success(...)` / `toast.error(...)`
  - `loadWorkbench(...)`
  - dialog visibility and saving state
  - truth-source routing and readonly/writable decisions
- OpenClaw fact sources re-read for this loop:
  - `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
  - `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
  - `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1527`
- `packages/sdkwork-clawstudio-instances/src/services/instanceDetailDerivedState.ts`: `200`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`
- Fresh build evidence:
  - `InstanceDetail-Cas29TB5.js`: `175.16 kB`
  - `InstanceConfigWorkbenchPanel-CnJPMEfq.js`: `61.84 kB`
  - `InstanceDetailFilesSection-ByFS8voq.js`: `2.33 kB`

## Verification

- RED before closure:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
- GREEN after implementation and fresh re-run:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceDetailDerivedState.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawChannelPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the derived-state boundary drift and the follow-up `consoleAccess` compile regression, but it does not claim Step 07 closure.

## Next Frontier

- Keep targeting page-side pure presentation and transient-state bundles inside `InstanceDetail.tsx`.
- Do not move write-path authority, `toast`, `loadWorkbench(...)`, or truth-source routing out of the page shell.
- Keep `instanceDetailDerivedState.ts` limited to pure derivation; if the next candidate needs side effects, it should stay in the page or move into a dedicated mutation helper instead.
