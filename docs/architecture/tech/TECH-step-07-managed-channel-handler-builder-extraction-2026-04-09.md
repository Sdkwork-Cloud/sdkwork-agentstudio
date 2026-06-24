> Migrated from `docs/review/step-07-managed-channel-handler-builder-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Managed Channel Handler Builder Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining managed-channel selection, draft patching, toggle, save, and delete handler composition out of `InstanceDetail.tsx`
  - keep real `instanceService.*`, page-owned setters, page-owned `toast.*`, and `loadWorkbench(...)` authority in the shell
  - centralize the last managed-channel page-side orchestration layer in shared managed-channel presentation and mutation helpers

## Root Cause

- After `release-2026-04-09-142`, the page still kept one coherent managed-channel orchestration bundle inline:
  - selected-channel change handling
  - field-draft patching
  - toggle request bridging
  - save request validation routing
  - delete request routing plus post-delete empty-draft restoration
- Those handlers no longer owned the real authority themselves:
  - managed-channel workspace sync, selection state, and workspace projection already lived in `openClawManagedChannelPresentation.ts`
  - draft patching, request construction, and the shared mutation runner already lived in `openClawManagedChannelMutationSupport.ts`
- The page was still carrying the repetitive "build request or patch state, guard skip cases, then delegate into the injected runner" layer instead of routing that remaining composition through shared helpers.

## Implemented Fix

- Extended `packages/sdkwork-claw-instances/src/services/openClawManagedChannelPresentation.ts`.
- Added `buildOpenClawManagedChannelStateHandlers(...)` so the presentation helper now owns:
  - selected-channel change routing through injected page setters
  - managed-channel draft patch routing through injected page setters
  - shared error-clear behavior for those two page-owned state transitions
- Extended `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.ts`.
- Added `buildOpenClawManagedChannelMutationHandlers(...)` so the mutation helper now owns:
  - toggle request lookup and routing
  - save request construction, validation-error routing, and final mutation delegation
  - delete request routing plus post-success empty-draft restoration through injected page setters
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `managedChannelStateHandlers`
  - builds `managedChannelMutationHandlers`
  - passes those handlers directly into the channels section props instead of keeping five inline managed-channel handlers
- The page still injects the real authority:
  - `runManagedChannelMutation` still owns the real `instanceService.saveOpenClawChannelConfig(...)` and `instanceService.setOpenClawChannelEnabled(...)` callbacks plus `toast.*` and `loadWorkbench(...)`
  - all managed-channel state containers and setters remain page-owned
  - truth-source routing, readonly gating, dialogs, and navigation remain page-owned
- Expanded direct helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
- Updated `scripts/run-sdkwork-instances-check.mjs` so the managed-channel helper tests now run inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `buildOpenClawManagedChannelStateHandlers(...)`
  - the page to use `buildOpenClawManagedChannelMutationHandlers(...)`
  - the page to pass direct section props from those builders instead of inline managed-channel handlers
  - the shared helpers to stay free of direct `instanceService`, `toast`, and page-owned reload authority
- Follow-up regression repaired in the same loop:
  - fresh web lint exposed a real narrowing issue on `emptyValues` inside the delete-success wrapper path
  - the delete handler builder now narrows the `deleteConfig` plan before reading `emptyValues` and then delegates the wrapped request safely

## Boundary Decision

- `openClawManagedChannelPresentation.ts` now owns only page-side state handler composition for managed-channel selection and draft patching.
- `openClawManagedChannelMutationSupport.ts` now owns only page-side managed-channel mutation handler composition:
  - toggle target lookup
  - save/delete request routing
  - validation-error forwarding through injected page error ownership
  - post-delete empty-draft restoration through injected page setter ownership
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers and setters
  - the real `instanceService.*` execution callbacks
  - page-owned `toast.success(...)` / `toast.error(...)`
  - `loadWorkbench(...)`, truth-source routing, readonly gating, dialogs, navigation, and all write-path authority

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

These sources remain the authority for browser-backed OpenClaw workbench persistence, writable managed-channel routing, default-agent skill install targeting, provider-center readonly projection, local proxy provider projection, and desktop plugin/runtime registration. This loop only centralizes page-side managed-channel handler composition around those already-authoritative runtime surfaces.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1171`
- `packages/sdkwork-claw-instances/src/services/openClawManagedChannelPresentation.ts`: `155`
- `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.ts`: `383`
- `scripts/run-sdkwork-instances-check.mjs`: `20`
- `scripts/sdkwork-instances-contract.test.ts`: `3473`

Relative to the immediately prior `1160` page baseline from `release-2026-04-09-142`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1171`. This loop still removes the remaining inline managed-channel orchestration cluster from the page, but the fresh baseline is slightly higher because the page now holds explicit shared-builder wiring and contract-stable prop injection points instead of opaque inline closures. The hotspot is cleaner even though the raw line count stayed effectively flat.

- Fresh build evidence:
  - `InstanceDetail-DNb6XXMi.js`: `177.33 kB`
  - `InstanceConfigWorkbenchPanel-DEX6_qRy.js`: `63.32 kB`
  - `InstanceDetailFilesSection-BiBxRpAO.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - failed first because `openClawManagedChannelPresentation.ts` did not yet export `buildOpenClawManagedChannelStateHandlers`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - failed first because `openClawManagedChannelMutationSupport.ts` did not yet export `buildOpenClawManagedChannelMutationHandlers`
- FOLLOW-UP regression repaired in the same loop:
  - `pnpm.cmd --filter @sdkwork/claw-web lint`
  - failed after the first handler extraction because `emptyValues` was read before the `deleteConfig` union branch was narrowed
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/claw-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining managed-channel handler-composition bridge, but Step 07 is still not closed.

## Next Frontier

- Continue shrinking `InstanceDetail.tsx` through the next remaining page-side orchestration hotspot after the managed-channel handler cluster.
- The most likely remaining candidates are:
  - lifecycle and OpenClaw console launch handler composition
  - small navigation and delete-confirmation wrappers
  - remaining page-local orchestration around instance-level destructive flows

