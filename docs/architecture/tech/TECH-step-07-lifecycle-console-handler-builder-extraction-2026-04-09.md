> Migrated from `docs/review/step-07-lifecycle-console-handler-builder-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Lifecycle And Console Handler Builder Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining lifecycle and OpenClaw console-launch handler composition out of `InstanceDetail.tsx`
  - keep real `instanceService.*`, page-owned `toast.*`, `openExternalUrl(...)`, and `loadWorkbench(...)` authority in the shell
  - centralize the last lifecycle and console-link page-side orchestration layer in shared lifecycle support

## Root Cause

- After `release-2026-04-09-143`, the page still kept one coherent inline orchestration bundle:
  - restart handler composition
  - stop handler composition
  - start handler composition
  - OpenClaw console target resolution and manual-login hint routing
  - official setup-link passthrough through the host external browser bridge
- Those handlers no longer owned the real authority themselves:
  - success or failure toast routing and workbench reload already lived behind `createInstanceLifecycleActionRunner(...)`
  - the page still owned the real `instanceService.*` callbacks and the host `openExternalUrl(...)` bridge
- The page was still carrying the repetitive "guard id, build request metadata, then delegate into injected authority" layer instead of routing that remaining composition through shared builders.

## Implemented Fix

- Extended `packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.ts`.
- Added `buildInstanceLifecycleActionHandlers(...)` so the shared helper now owns:
  - restart request composition
  - stop request composition
  - start request composition
  - the `instanceId` guard around those three lifecycle actions
- Added `buildOpenClawConsoleHandlers(...)` so the shared helper now also owns:
  - OpenClaw console target resolution preferring `autoLoginUrl` over `url`
  - fallback error routing when no console target exists
  - manual-login info routing when only a plain console URL is available
  - official setup-link passthrough through the injected host opener
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `lifecycleActionHandlers`
  - builds `consoleHandlers`
  - passes those handlers directly into the detail chrome and channels section props instead of keeping five inline lifecycle or console closures
- Added focused direct coverage in `packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.test.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test now runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `buildInstanceLifecycleActionHandlers(...)`
  - the page to use `buildOpenClawConsoleHandlers(...)`
  - the page to pass lifecycle and console props from those builders instead of inline closures
  - the shared helper to stay free of direct `instanceService`, `toast`, `loadWorkbench(...)`, and `openExternalUrl(...)` authority

## Boundary Decision

- `instanceLifecycleActionSupport.ts` now owns only page-side handler composition for:
  - lifecycle request shaping
  - console target selection
  - fallback console-error mapping
  - manual-login info routing
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers and setters
  - the real `instanceService.restartInstance(...)`, `.stopInstance(...)`, and `.startInstance(...)` callbacks
  - page-owned `toast.success(...)`, `toast.info(...)`, and `toast.error(...)`
  - the real `openExternalUrl(...)` host bridge
  - `loadWorkbench(...)`, truth-source routing, readonly gating, dialogs, navigation, and all write-path authority

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

These sources remain the authority for browser-backed OpenClaw workbench persistence, lifecycle readiness, managed config writability, host external-link behavior, default-agent skill install targeting, provider-center readonly projection, local proxy provider projection, and desktop plugin/runtime registration. This loop only centralizes page-side lifecycle and console handler composition around those already-authoritative runtime surfaces.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1055`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.ts`: `118`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.test.ts`: `235`

Relative to the immediately prior `1171` page baseline from `release-2026-04-09-143`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1055`. This loop removes the remaining inline lifecycle and console orchestration cluster from the page and converts that hotspot into stable shared-builder wiring with materially lower page weight.

- Fresh build evidence:
  - `InstanceDetail-AYuQo3Ke.js`: `176.77 kB`
  - `InstanceConfigWorkbenchPanel-DLxzRCKk.js`: `63.32 kB`
  - `InstanceDetailFilesSection-BmF0Xbpo.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.test.ts`
  - failed first because `instanceLifecycleActionSupport.ts` did not yet export `buildInstanceLifecycleActionHandlers(...)`
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.test.ts`
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

This loop closes the remaining lifecycle and console handler-composition bridge, but Step 07 is still not closed.

## Next Frontier

- Continue shrinking `InstanceDetail.tsx` through the next remaining page-side orchestration hotspot after the lifecycle and console cluster.
- The most likely remaining candidates are:
  - navigation and destructive-flow wrappers
  - provider dialog submit bridging
  - residual page-local confirmation or redirect orchestration

