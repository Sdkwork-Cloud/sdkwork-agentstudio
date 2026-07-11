> Migrated from `docs/review/step-07-instance-detail-workbench-reload-binding-extraction-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Workbench Reload Binding Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned `loadWorkbench(...)` adapter wrappers out of `InstanceDetail.tsx`
  - keep the real `loadWorkbench(...)` implementation authoritative in the page shell while exposing shared reload bindings for runner composition

## Root Cause

- After `release-2026-04-09-149`, the current dirty worktree still kept one coherent wrapper family in `InstanceDetail.tsx`:
  - five mutation runners still received `reloadWorkbench: (instanceId, options) => loadWorkbench(instanceId, options)`
  - the lifecycle runner still received `reloadWorkbench: (instanceId) => loadWorkbench(instanceId)`
- Those wrappers did not own runtime truth or write authority:
  - they only forwarded into the real page-owned `loadWorkbench(...)`
  - they only stabilized whether reloads accepted options or used the default spinner path
- That made them the next clean `150` candidate: the wrapper family is repetitive, still page-owned, and belongs in the same `instanceDetailReloadSupport.ts` helper family as the prior silent reload extraction.

## Implemented Fix

- Expanded `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.ts`.
- Added `createInstanceDetailWorkbenchReloadHandlers(...)` so the shared helper now owns only:
  - pass-through `reloadWorkbench(instanceId, options?)`
  - default-spinner `reloadWorkbenchImmediately(instanceId)`
  - forwarding into the injected page-owned `loadWorkbench(...)`
- Extended focused direct coverage in `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.test.ts`.
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `workbenchReloadHandlers` once through `createInstanceDetailWorkbenchReloadHandlers(...)`
  - passes `workbenchReloadHandlers.reloadWorkbench` into provider, agent-skill, agent, managed-channel, and managed-config mutation runners
  - passes `workbenchReloadHandlers.reloadWorkbenchImmediately` into the lifecycle runner
  - reuses `workbenchReloadHandlers.reloadWorkbench` as the injected loader for `createInstanceDetailSilentWorkbenchReloadHandler(...)`
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailWorkbenchReloadHandlers(...)`
  - the page to stop keeping inline `loadWorkbench` pass-through wrappers for runner wiring
  - lifecycle wiring to use the default-spinner reload binding
  - the reload support helper to stay free of `toast`, `instanceService`, and navigation authority

## Self-Correction During Verification

- The first fresh `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint` run in this loop failed on a real type-boundary mismatch:
  - `instanceDetailSectionModels.ts` still injects a loader type that requires an explicit `options` object
  - the expanded silent reload helper had been loosened to accept optional `options`
- The loop was returned to the current-step-not-closed state.
- The fix was:
  - tighten `CreateInstanceDetailSilentWorkbenchReloadHandlerArgs.reloadWorkbench` back to the explicit-options signature
  - keep `createInstanceDetailWorkbenchReloadHandlers(...)` as the page-side optional-options adapter
- After that correction, the full verification sequence was rerun fresh and passed.

## Boundary Decision

- `instanceDetailReloadSupport.ts` now owns only shared reload-binding composition for:
  - page-owned `loadWorkbench(...)` pass-through bindings
  - default-spinner reload binding
  - current-instance spinnerless reload binding
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers and setters
  - the real route `id`
  - the real `loadWorkbench(...)`
  - all mutation authority, navigation, dialogs, toasts, truth-source routing, and lifecycle control
- The helper still does not own:
  - transport access
  - instance mutation authority
  - user-facing toasts
  - navigation
  - confirm/delete flows

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side reload-binding composition layer.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1060` lines / `41289` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.ts`: `30` lines / `1014` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.test.ts`: `124` lines / `3803` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `463` lines / `14550` bytes

Relative to the immediately prior `1056` page baseline from `release-2026-04-09-149`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1060`. This loop records a verified boundary improvement for the shared `loadWorkbench(...)` adapter family while also documenting that the broader page baseline increased slightly in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1060`
  - `instanceDetailReloadSupport.ts`: `30`
  - `instanceDetailSectionAvailabilitySupport.ts`: `34`
  - `instanceDetailNavigationSupport.ts`: `42`
  - `instanceLifecycleActionSupport.ts`: `165`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- Fresh build evidence:
  - `InstanceDetail-xpkNywC6.js`: `177.09 kB`
  - `InstanceConfigWorkbenchPanel-DBRg4QRE.js`: `63.33 kB`
  - `InstanceDetailFilesSection-CWdp6zFZ.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.test.ts`
  - failed first because `createInstanceDetailWorkbenchReloadHandlers(...)` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline `loadWorkbench` runner adapters
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailReloadSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version
  - `pnpm.cmd build` prints a non-blocking Rolldown plugin timing warning; the build still exits successfully

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-owned `loadWorkbench(...)` adapter family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1060`-line `InstanceDetail.tsx` baseline before selecting `151`.
- Favor only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Do not bundle unrelated toast adapters into a generic helper unless the remaining hotspots prove a stable shared contract.

