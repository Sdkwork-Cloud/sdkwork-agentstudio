# Step 07 Managed Config Draft-Change Handler Builder Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining managed-config draft-change handler composition out of `InstanceDetail.tsx`
  - keep the real `instanceService.saveOpenClaw*Config(...)` write paths, page-owned `toast.*`, `loadWorkbench(...)` authority, readonly/truth-source gating, and form/error/saving state in the page shell

## Root Cause

- After `release-2026-04-09-144`, `InstanceDetail.tsx` still owned one coherent managed-config handler cluster:
  - webSearch shared draft changes
  - webSearch provider draft changes
  - xSearch draft changes
  - native Codex webSearch draft changes
  - webFetch shared draft changes
  - webFetch fallback draft changes
  - auth cooldowns draft changes
  - dreaming draft changes
- Those closures no longer owned the real mutation authority themselves:
  - save execution already lived behind `buildOpenClawManagedConfigMutationHandlers(...)`
  - the page still owned the real `instanceService.saveOpenClaw*Config(...)` callbacks, `toast.*`, and `loadWorkbench(...)`
- The page was still carrying repetitive "clear the page-owned error, patch the page-owned draft, then bridge through injected setters" orchestration instead of routing that last draft-change bundle through one shared builder.

## Implemented Fix

- Added `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigPresentation.ts`.
- Added `buildOpenClawManagedConfigDraftChangeHandlers(...)` so the shared helper now owns:
  - webSearch shared draft patching
  - selected webSearch provider draft patching with the selected-provider guard
  - xSearch draft patching
  - native Codex webSearch draft patching
  - webFetch shared draft patching
  - webFetch fallback draft patching
  - auth cooldowns draft patching
  - dreaming draft patching
  - per-surface page-owned error clearing before each patch
- Added focused direct coverage in `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigPresentation.test.ts`.
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `managedConfigDraftChangeHandlers`
  - passes draft-change props from that builder into the tools and memory section prop builders
  - removes the last inline managed-config draft-change closures from the page
- Exported the new helper from `packages/sdkwork-clawstudio-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `buildOpenClawManagedConfigDraftChangeHandlers(...)`
  - the page to route all managed-config draft-change props through that builder
  - the page to stop using inline managed-config draft-change closures
  - the shared helper to stay free of direct `instanceService`, `toast`, and `loadWorkbench(...)` authority

## Boundary Decision

- `openClawManagedConfigPresentation.ts` now owns only page-side draft-change handler composition for:
  - page-owned error reset routing
  - draft patch helper selection
  - selected webSearch provider guard handling
  - injected page-setter bridging across managed-config surfaces
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers and setters
  - the real `instanceService.saveOpenClawWebSearchConfig(...)`
  - the real `instanceService.saveOpenClawXSearchConfig(...)`
  - the real `instanceService.saveOpenClawWebSearchNativeCodexConfig(...)`
  - the real `instanceService.saveOpenClawWebFetchConfig(...)`
  - the real `instanceService.saveOpenClawAuthCooldownsConfig(...)`
  - the real `instanceService.saveOpenClawDreamingConfig(...)`
  - page-owned `toast.success(...)`
  - `loadWorkbench(...)`, truth-source routing, readonly gating, dialogs, navigation, and all write-path authority

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

These sources remain the authority for browser-backed workbench persistence, managed-config writability, provider-center projection, Local Proxy routing/projection, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes page-side managed-config draft-change handler composition around those already-authoritative runtime surfaces.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1006` lines / `41289` bytes
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigPresentation.ts`: `119` lines / `4641` bytes
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigPresentation.test.ts`: `251` lines / `9130` bytes

Relative to the immediately prior `1055` page baseline from `release-2026-04-09-144`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1006`. This loop removes the remaining inline managed-config draft-change orchestration cluster from the page and converts that hotspot into stable shared-builder wiring with another verified page reduction.

- Fresh build evidence:
  - `InstanceDetail-CjwdbUAz.js`: `177.00 kB`
  - `InstanceConfigWorkbenchPanel-B-98b5zm.js`: `63.32 kB`
  - `InstanceDetailFilesSection-CQ4NdCce.js`: `2.38 kB`

## Verification

- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigPresentation.test.ts`
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

This loop closes the remaining managed-config draft-change handler-composition bridge, but Step 07 is still not closed.

## Next Frontier

- Continue shrinking `InstanceDetail.tsx` through the next remaining page-side orchestration hotspot after the managed-config draft-change cluster.
- The most likely remaining candidates are:
  - task-workspace navigation wrappers
  - destructive delete-flow wrappers
  - residual navigation-side orchestration that still only packages page-owned authority
