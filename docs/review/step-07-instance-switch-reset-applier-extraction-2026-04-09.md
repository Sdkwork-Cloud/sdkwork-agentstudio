# Step 07 Instance Switch Reset Applier Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the `[id]` instance-switch reset fan-out out of `InstanceDetail.tsx`
  - keep page-owned setter authority in the shell
  - centralize the shared reset baseline application for provider workspace, managed config, agent workspace, and lazy hydration state

## Root Cause

- After `release-2026-04-09-137`, the page-tail composition cluster was exhausted, but `InstanceDetail.tsx` still kept one large page-owned reset block inside the `[id]` effect.
- That effect still:
  - created `providerDialogResetDrafts`
  - created `providerWorkspaceResetState`
  - created `managedConfigResetState`
  - created `agentWorkspaceResetState`
  - created `workbenchHydrationResetState`
  - fanned those shared baselines into a long sequence of page setter calls
- The reset values were already authoritative in shared helpers, but the page still owned the repetitive bridge logic instead of routing it through one dedicated reset applier.
- Contract coverage also still encoded the older page-inline boundary, so the first RED needed to move the architecture contract before the new helper could be introduced cleanly.

## Implemented Fix

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailResetState.ts`.
- Added `applyInstanceDetailInstanceSwitchResetState(...)` so one dedicated helper now:
  - reads the shared provider reset baseline from `createOpenClawProviderWorkspaceResetState(...)`
  - reads the shared managed-config reset baseline from `createOpenClawManagedConfigResetState()`
  - reads the shared agent reset baseline from `createOpenClawAgentWorkspaceResetState()`
  - reads the shared lazy-hydration reset baseline from `createInstanceWorkbenchHydrationResetState()`
  - applies those baselines through page-owned setter callbacks supplied by `InstanceDetail.tsx`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the `[id]` effect now calls `applyInstanceDetailInstanceSwitchResetState({...})` instead of manually enumerating the full reset setter fan-out inline.
- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailResetState.test.ts` with direct helper coverage proving the new applier routes the shared baselines through page-owned setters.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to call `applyInstanceDetailInstanceSwitchResetState({...})`
  - the page to pass setter ownership into that helper
  - `instanceDetailResetState.ts` to own the shared reset-state application bridge
  - the page to stop directly constructing the four shared reset baselines inline

## Boundary Decision

- `instanceDetailResetState.ts` owns only pure reset-state bridging:
  - read shared reset baselines
  - apply them through injected setter callbacks
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all actual setters
  - all `instanceService.*` write callbacks
  - all `toast.*` dispatch
  - all `loadWorkbench(...)` authority
  - readonly gating, truth-source routing, navigation, and dialog ownership
- This loop does not move any runtime I/O, transport calls, Local Proxy ownership, Provider Center truth sources, or desktop plugin/runtime bootstrap boundaries.

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

These sources remain the authority for browser-backed OpenClaw workbench persistence, Provider Center managed-route truth, channel and market install flows, local proxy projection, and desktop runtime/plugin registration. This loop only centralizes page-side reset application for already-authoritative shared baselines.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1401`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailResetState.ts`: `113`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1408` page baseline from `release-2026-04-09-137`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1401`. This loop records another verified page-side reduction while moving the reset-setter bridge into a dedicated helper.

- Fresh build evidence:
  - `InstanceDetail-kG1tjTB4.js`: `177.92 kB`
  - `InstanceConfigWorkbenchPanel-BVEHLPYn.js`: `63.32 kB`
  - `InstanceDetailFilesSection-CZuj3pDg.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailResetState.test.ts`
  - failed first with `ERR_MODULE_NOT_FOUND` because `instanceDetailResetState.ts` did not exist yet
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailResetState.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the next high-value pure page-side reset bridge, but Step 07 is still not closed.

## Next Frontier

- Keep shrinking `InstanceDetail.tsx` through the remaining page-side state orchestration hotspots instead of continuing the now-exhausted section-tail extraction pattern.
- Preserve the same rule:
  - pure reset/state bridging, prop shaping, and presentation composition may move out
  - mutation authority, reload policy, truth-source routing, and runtime side effects stay in the page shell
