# Step 07 Instance Detail Section Availability Renderer Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-local section-availability renderer wrapper out of `InstanceDetail.tsx`
  - keep the real workbench truth, translation function, formatting helpers, and component renderer injection in the page shell

## Root Cause

- After `release-2026-04-09-147`, `InstanceDetail.tsx` still owned one coherent presentation wrapper:
  - pre-binding `workbench`
  - pre-binding `t`
  - pre-binding `formatWorkbenchLabel(...)`
  - pre-binding `getCapabilityTone(...)`
  - forwarding `sectionId` and `fallbackKey` into `renderInstanceDetailSectionAvailability(...)`
- That wrapper did not own the real rendering authority itself:
  - the page still owned the live `workbench` snapshot
  - the page still owned the live translation and formatting helpers
  - the actual UI rendering still lived in `renderInstanceDetailSectionAvailability(...)`
- The page was still carrying a small but repetitive “bind stable page context, then render section availability on demand” closure instead of routing that pre-bound renderer through one focused helper.

## Implemented Fix

- Added `packages/sdkwork-clawstudio-instances/src/services/instanceDetailSectionAvailabilitySupport.ts`.
- Added `createInstanceDetailSectionAvailabilityRenderer(...)` so the shared helper now owns:
  - pre-binding the current workbench availability snapshot
  - pre-binding the translation function
  - pre-binding workbench label formatting
  - pre-binding capability tone formatting
  - forwarding per-call `sectionId` and `fallbackKey` into the injected renderer
- Added focused direct coverage in `packages/sdkwork-clawstudio-instances/src/services/instanceDetailSectionAvailabilitySupport.test.ts`.
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `renderWorkbenchSectionAvailability` through `createInstanceDetailSectionAvailabilityRenderer(...)`
  - injects `renderInstanceDetailSectionAvailability` instead of keeping the inline availability wrapper
- Exported the new helper from `packages/sdkwork-clawstudio-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailSectionAvailabilityRenderer(...)`
  - the page to stop keeping the inline availability arrow wrapper
  - the page to pass `renderInstanceDetailSectionAvailability` through the helper as an injected renderer
  - the shared helper to stay free of `toast`, `instanceService`, and navigation authority

## Boundary Decision

- `instanceDetailSectionAvailabilitySupport.ts` now owns only page-side pre-bound availability renderer composition for:
  - workbench availability snapshot injection
  - translation injection
  - formatting helper injection
  - section-specific forwarding into the injected renderer
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers and setters
  - the real `workbench` truth
  - the real `t`
  - the real `formatWorkbenchLabel(...)`
  - the real `getCapabilityTone(...)`
  - the choice to use `renderInstanceDetailSectionAvailability(...)`
  - all mutation authority, navigation, dialogs, toasts, truth-source routing, and reload authority

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

These sources remain the authority for browser-backed workbench persistence, runtime section availability truth, provider-center projection, Local Proxy routing/projection, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side availability-renderer pre-binding layer.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `994` lines / `41068` bytes
- `packages/sdkwork-clawstudio-instances/src/services/instanceDetailSectionAvailabilitySupport.ts`: `30` lines / `1309` bytes
- `packages/sdkwork-clawstudio-instances/src/services/instanceDetailSectionAvailabilitySupport.test.ts`: `68` lines / `2481` bytes

Relative to the immediately prior `998` page baseline from `release-2026-04-09-147`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `994`. This loop records another verified page reduction while moving the remaining section-availability renderer wrapper into a focused shared helper.

- Fresh build evidence:
  - `InstanceDetail-oxDUJZdg.js`: `176.99 kB`
  - `InstanceConfigWorkbenchPanel-gDi1y5gM.js`: `63.33 kB`
  - `InstanceDetailFilesSection-Dqu9ntwT.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceDetailSectionAvailabilitySupport.test.ts`
  - failed first because `instanceDetailSectionAvailabilitySupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the inline availability wrapper
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceDetailSectionAvailabilitySupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/clawstudio-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-local section-availability renderer wrapper, but Step 07 is still not closed.

## Next Frontier

- Continue shrinking `InstanceDetail.tsx` through the next remaining page-side wrapper hotspot after the availability-renderer extraction.
- The most likely remaining candidates are:
  - additional tiny presentation wrappers such as theme and loading presentation helpers
  - other page-local closures that only pre-bind injected authority without owning the real runtime surface
