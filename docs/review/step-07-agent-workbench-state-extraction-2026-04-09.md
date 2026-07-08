# Step 07 Agent Workbench State Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining agent-workbench selection sync and async load orchestration out of `InstanceDetail.tsx`
  - keep real `agentWorkbenchService.getAgentWorkbench(...)` authority, page-owned setters, and page-owned error policy in the shell
  - centralize agent selection fallback, loading lifecycle, cancellation, and fallback error mapping inside a dedicated helper

## Root Cause

- After `release-2026-04-09-140`, `InstanceDetail.tsx` still kept two adjacent page-side orchestration effects inline for the agents workspace:
  - selection sync when `workbench?.agents` changed
  - async agent detail loading when the active section or selected agent changed
- Those effects were still pure orchestration rather than transport authority:
  - validate or reset the selected agent id
  - clear stale selected-agent workbench state
  - clear stale error state
  - toggle loading
  - call the injected loader
  - suppress stale updates after cancellation
  - apply the fallback error message when the thrown error was blank
- The page already owned the real service call, route truth, dialogs, navigation, and write authority, but it still carried repetitive sync and async bridge code that could live behind a shared helper boundary.

## Implemented Fix

- Added `packages/sdkwork-clawstudio-instances/src/services/instanceDetailAgentWorkbenchState.ts`.
- Added two dedicated orchestration entry points:
  - `applyInstanceDetailAgentWorkbenchSyncState(...)`
  - `startLoadInstanceDetailAgentWorkbench(...)`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - routes agent selection validity and reset-state bridging through `applyInstanceDetailAgentWorkbenchSyncState(...)`
  - routes async selected-agent loading through `startLoadInstanceDetailAgentWorkbench(...)`
- The new helper now owns:
  - agent selection fallback to the first available agent
  - empty-agent reset baselines for selected id, workbench, error, and loading
  - selected-agent async loading lifecycle
  - cancellation guard orchestration
  - blank-error fallback mapping
- The page still injects the real authority:
  - `loadAgentWorkbench: (input) => agentWorkbenchService.getAgentWorkbench(input)`
  - `setSelectedAgentWorkbench`
  - `setAgentWorkbenchError`
  - `setIsAgentWorkbenchLoading`
  - page-owned `console.error(...)` reporting
- Added `packages/sdkwork-clawstudio-instances/src/services/instanceDetailAgentWorkbenchState.test.ts` with direct helper coverage proving:
  - empty agent collections reset the page-owned state baseline
  - valid selections are preserved and invalid selections fall back to the first agent
  - agent workbench loading resolves through the injected loader
  - failures report through the injected reporter and use the fallback error message when needed
  - cancellation suppresses stale post-resolution updates
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to call the two new agent-workbench helpers
  - the page to inject the real `agentWorkbenchService.getAgentWorkbench(...)` loader
  - the page to inject page-owned setter callbacks and error reporting
  - the helper to own the selection fallback and async load orchestration
  - the helper to stay free of `toast`, `loadWorkbench(...)`, and direct runtime-service authority
- Follow-up boundary repair in the same loop:
  - the helper now imports request and snapshot types from `agentWorkbenchServiceCore.ts`
  - it no longer directly references `agentWorkbenchService.ts`, which keeps the service-authority contract anchored in the page shell

## Boundary Decision

- `instanceDetailAgentWorkbenchState.ts` owns only page-side selection and loading orchestration:
  - selected-agent validity fallback
  - empty-agent reset baselines
  - async load lifecycle and cancellation
  - blank-error fallback mapping
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all real setter ownership
  - the real `agentWorkbenchService.getAgentWorkbench(...)` entry point
  - all page-owned error reporting policy
  - `loadWorkbench(...)`, truth-source routing, readonly gating, dialogs, navigation, and all write-path authority
- This loop does not move OpenClaw transport routing, Local Proxy projection, Provider Center truth, desktop plugin registration, or backend/runtime ownership.

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

These sources remain the authority for browser-backed OpenClaw workbench persistence, managed channel/config truth, default-agent skill install flows, managed-provider readonly routing, local proxy provider projection, and desktop plugin/runtime registration. This loop only centralizes page-side agent-workbench selection and load orchestration around those already-authoritative runtime surfaces.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1220`
- `packages/sdkwork-clawstudio-instances/src/services/instanceDetailAgentWorkbenchState.ts`: `95`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately prior `1251` page baseline from `release-2026-04-09-140`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1220`. This loop records another verified page-side reduction while moving the remaining agent-workbench sync and load orchestration into a dedicated helper.

- Fresh build evidence:
  - `InstanceDetail-BEfG3ppb.js`: `177.95 kB`
  - `InstanceConfigWorkbenchPanel-BlBE5ojh.js`: `63.32 kB`
  - `InstanceDetailFilesSection-DuLtB6bZ.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceDetailAgentWorkbenchState.test.ts`
  - failed first with `ERR_MODULE_NOT_FOUND` because `instanceDetailAgentWorkbenchState.ts` did not exist yet
- FOLLOW-UP regression repaired in the same loop:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed after rewiring because the new helper still referenced `agentWorkbenchService.ts` types and violated the page-owned service-authority boundary
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceDetailAgentWorkbenchState.test.ts`
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

This loop closes the next remaining agent-workbench state bridge, but Step 07 is still not closed.

## Next Frontier

- Continue shrinking `InstanceDetail.tsx` through the next remaining page-side orchestration hotspot after the selected-agent workbench sync/load cluster.
- Preserve the same rule:
  - pure sync-state bridging, async orchestration, reset-state bridging, prop shaping, and presentation composition may move out
  - truth-source routing, runtime service authority, write authority, and page-owned side effects stay in the page shell
