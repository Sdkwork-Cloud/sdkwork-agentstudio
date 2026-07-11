> Migrated from `docs/review/step-07-instance-detail-navigation-support-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Navigation Support Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining simple navigation and shared-status label wrappers out of `InstanceDetail.tsx`
  - keep the real `navigate(...)`, page-owned `setActiveInstanceId(...)`, and route authority in the page shell

## Root Cause

- After `release-2026-04-09-146`, `InstanceDetail.tsx` still owned one small but coherent page-local wrapper cluster:
  - back-to-instances navigation for the not-found state
  - back-to-instances navigation for the header-level back button
  - provider-center navigation
  - agent-market navigation with `instanceId` query shaping
  - set-active callback packaging for the header
  - shared status-label translation via `instances.shared.status.*`
- Those wrappers did not own the real authority surfaces themselves:
  - the page still owned `navigate(...)`
  - the page still owned `setActiveInstanceId(...)`
  - the page still owned the actual loaded `instance` and route `id`
- The page was still carrying repetitive route-string shaping and translation wiring instead of routing that remaining lightweight wrapper cluster through one focused helper.

## Implemented Fix

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailNavigationSupport.ts`.
- Added `createSharedStatusLabelGetter(...)` so the shared helper now owns:
  - shared instance-status translation key shaping
- Added `buildInstanceDetailNavigationHandlers(...)` so the shared helper now owns:
  - back-to-instances route packaging
  - provider-center route packaging
  - agent-market route packaging with optional `instanceId` query shaping
  - active-instance guard and setter routing
- Added focused direct coverage in `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailNavigationSupport.test.ts`.
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `detailNavigationHandlers`
  - builds `getSharedStatusLabel` through `createSharedStatusLabelGetter(...)`
  - passes navigation callbacks from that helper into the header, back buttons, agent section props, and provider section props
- Exported the new helper from `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createSharedStatusLabelGetter(...)`
  - the page to use `buildInstanceDetailNavigationHandlers(...)`
  - the page to route agent-market, provider-center, back-to-instances, and set-active callbacks through that helper
  - the shared helper to stay free of direct `toast`, `instanceService`, and destructive-flow authority

## Boundary Decision

- `instanceDetailNavigationSupport.ts` now owns only page-side navigation and status-label composition for:
  - shared status translation key shaping
  - route path construction for provider center and agent market
  - back navigation packaging
  - active-instance setter guard routing
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers and setters
  - the real `navigate(...)`
  - the real `setActiveInstanceId(...)`
  - the loaded `instance` truth and current route `id`
  - all mutation authority, dialogs, toasts, truth-source routing, and reload authority

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

These sources remain the authority for browser-backed workbench persistence, provider-center routing context, managed-config writability, ecosystem/runtime ownership, Local Proxy routing/projection, and desktop plugin/runtime registration. This loop only centralizes page-side route and status-label wrapper composition.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `998` lines / `41071` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailNavigationSupport.ts`: `37` lines / `1142` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailNavigationSupport.test.ts`: `87` lines / `2942` bytes

Relative to the immediately prior `991` page baseline from `release-2026-04-09-146`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `998`. This loop improves the page boundary by moving the remaining lightweight navigation and status-label wrappers into a shared helper, but the fresh page baseline is slightly higher because the page now carries one more explicit shared-builder wiring point.

- Fresh build evidence:
  - `InstanceDetail-Bjkb8t9q.js`: `177.00 kB`
  - `InstanceConfigWorkbenchPanel-CZ5k-XbN.js`: `63.32 kB`
  - `InstanceDetailFilesSection-ByLqIfq4.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailNavigationSupport.test.ts`
  - failed first because `instanceDetailNavigationSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline navigation wrappers and direct shared-status mapping
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailNavigationSupport.test.ts`
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

This loop closes the remaining lightweight navigation and shared-status wrapper cluster, but Step 07 is still not closed.

## Next Frontier

- Continue shrinking `InstanceDetail.tsx` through the next remaining page-side wrapper hotspot after this navigation extraction.
- The most likely remaining candidates are:
  - the `renderWorkbenchSectionAvailability(...)` wrapper
  - other tiny page-local presentation wrappers that only pre-bind injected page authority

