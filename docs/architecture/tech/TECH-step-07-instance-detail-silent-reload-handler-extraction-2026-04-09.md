> Migrated from `docs/review/step-07-instance-detail-silent-reload-handler-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Silent Reload Handler Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining current-instance silent reload wrappers out of `InstanceDetail.tsx` and `instanceDetailSectionModels.ts`
  - keep the real `loadWorkbench(...)` authority in the page and section-model callers

## Root Cause

- After `release-2026-04-09-148`, the current dirty worktree still kept one coherent spinnerless reload wrapper pattern in two places:
  - `InstanceDetail.tsx` passed `onReloadFiles` and `onReloadConfig` as duplicate inline closures
  - `instanceDetailSectionModels.ts` still built the agent section `onReload` callback inline
- Those wrappers did not own any real runtime authority themselves:
  - they only guarded the current instance id
  - they only forced `{ withSpinner: false }`
  - the real `loadWorkbench(...)` implementation still lived outside the wrapper
- That made the remaining wrapper cluster a good micro-extraction candidate for `149` because the helper boundary is small, testable, and authority-preserving.

## Implemented Fix

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.ts`.
- Added `createInstanceDetailSilentWorkbenchReloadHandler(...)` so the shared helper now owns only:
  - current-instance id guarding
  - pre-binding `{ withSpinner: false }`
  - forwarding into an injected page-owned `reloadWorkbench(...)`
- Added focused direct coverage in `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.test.ts`.
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `reloadCurrentWorkbenchSilently` through `createInstanceDetailSilentWorkbenchReloadHandler(...)`
  - reuses that helper-backed callback for both `onReloadFiles` and `onReloadConfig`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts` so `buildAgentSectionProps(...)` now:
  - builds `reloadAgentWorkbenchSilently` through the same shared helper
  - stops keeping the inline `instanceId ? loadWorkbench(instanceId, { withSpinner: false }) : undefined` wrapper
- Exported the new helper from `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailSilentWorkbenchReloadHandler(...)`
  - the page to stop keeping inline spinnerless reload callbacks for files/config
  - `instanceDetailSectionModels.ts` to use the same helper for the agent-section reload callback
  - the shared helper to stay free of `toast`, `instanceService`, and navigation authority

## Boundary Decision

- `instanceDetailReloadSupport.ts` now owns only shared silent reload pre-binding for:
  - current instance id guard behavior
  - `{ withSpinner: false }` injection
  - forwarding into an injected loader callback
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers and setters
  - the real route `id`
  - the real `loadWorkbench(...)`
  - all mutation authority, navigation, dialogs, toasts, truth-source routing, and lifecycle control
- `instanceDetailSectionModels.ts` still explicitly owns:
  - the choice to expose a section `onReload`
  - the injected `loadWorkbench(...)` dependency
  - all section composition and dialog/reset behavior unrelated to silent reload pre-binding

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side and section-model-side silent reload pre-binding layer.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1056` lines / `41202` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.ts`: `16` lines / `496` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.test.ts`: `73` lines / `2117` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `463` lines / `14550` bytes

Relative to the last recorded `release-2026-04-09-148` page baseline of `994`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1056`. This loop still records a verified boundary improvement for the remaining silent reload wrapper cluster, while the broader page baseline has drifted upward in the current dirty worktree and should be treated as the fresh truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1056`
  - `instanceDetailReloadSupport.ts`: `16`
  - `instanceDetailSectionAvailabilitySupport.ts`: `34`
  - `instanceDetailNavigationSupport.ts`: `42`
  - `instanceLifecycleActionSupport.ts`: `165`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- Fresh build evidence:
  - `InstanceDetail-BmHVheOA.js`: `176.99 kB`
  - `InstanceConfigWorkbenchPanel-BLGh9sbs.js`: `63.33 kB`
  - `InstanceDetailFilesSection-3NqzV9rd.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.test.ts`
  - failed first because `instanceDetailReloadSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `instanceDetailReloadSupport.ts` did not yet exist
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.test.ts`
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

This loop closes the remaining shared silent reload wrapper cluster, but Step 07 is still not closed.

## Next Frontier

- Re-scan `InstanceDetail.tsx` against the fresh `1056`-line current-worktree baseline before choosing `150`; the older `994` baseline is no longer the operative truth.
- Prioritize only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with a focused direct helper test plus contract enforcement
- Avoid grouping unrelated toast/reporter adapters into one large helper unless a clearly reusable boundary emerges.

