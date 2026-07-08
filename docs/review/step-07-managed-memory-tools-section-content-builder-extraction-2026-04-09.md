# Step 07 Managed Memory And Tools Section Content Builder Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-local `memorySectionContent` / `toolsSectionContent` wrappers out of `InstanceDetail.tsx`
  - route those two managed section content nodes through `instanceDetailSectionModels.ts`
  - keep real OpenClaw write authority, reload ownership, readonly gating, and truth-source routing in the page shell

## Root Cause

- After `release-2026-04-09-136`, the page-tail `agents` / `llmProviders` / `cronTasks` wrappers were gone, but `InstanceDetail.tsx` still owned two direct managed-section wrappers:
  - `memorySectionContent`
  - `toolsSectionContent`
- Those wrappers were purely presentational. They no longer decided:
  - persistence authority
  - save callback ownership
  - draft truth sources
  - readonly policy
- Leaving them inline meant the page still had a residual section-tail composition pair even though the prop shaping for both sections had already moved into `instanceDetailSectionModels.ts`.

## Implemented Fix

- Extended `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.ts` with:
  - `BuildManagedMemorySectionContentInput`
  - `BuildManagedToolsSectionContentInput`
  - `buildManagedMemorySectionContent(...)`
  - `buildManagedToolsSectionContent(...)`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now routes:
  - `memorySectionContent` through `buildManagedMemorySectionContent(...)`
  - `toolsSectionContent` through `buildManagedToolsSectionContent(...)`
- Removed the direct page-local managed section wrapper usage for:
  - `InstanceDetailManagedMemorySection`
  - `InstanceDetailManagedToolsSection`
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.test.tsx`
- Updated `scripts/sdkwork-instances-contract.test.ts` so the boundary gate now requires:
  - the page to reference `buildManagedMemorySectionContent(...)`
  - the page to reference `buildManagedToolsSectionContent(...)`
  - direct component ownership evidence for `InstanceDetailManagedMemorySection` and `InstanceDetailManagedToolsSection` to live in `instanceDetailSectionModels.ts`

## Boundary Decision

- `instanceDetailSectionModels.ts` now owns both:
  - managed memory / tools prop shaping
  - managed memory / tools content composition
- `InstanceDetail.tsx` still explicitly owns:
  - all page state and draft stores
  - all real `instanceService.saveOpenClaw*Config(...)` callbacks
  - all `toast.success(...)` / `toast.error(...)`
  - all `loadWorkbench(...)` authority
  - readonly gating
  - truth-source routing
  - navigation and dialog ownership
- This loop still does not move Local Proxy routing, desktop runtime authority, Provider Center managed-route rules, or plugin/runtime bootstrap boundaries.

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

These sources remain the authority for studio-backed task/provider APIs, Provider Center managed-route detection, channel and marketplace flows, local proxy ownership, and desktop plugin/runtime registration. This loop only centralizes one more pure section-composition pair.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1408`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.ts`: `457`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1408` page baseline from `release-2026-04-09-136`, this loop keeps the page hotspot flat while shifting the remaining managed memory / tools content wrappers into the shared section-model helper.

- Fresh build evidence:
  - `InstanceDetail-2G0EP9cl.js`: `177.93 kB`
  - `InstanceConfigWorkbenchPanel-BynCO4E3.js`: `63.32 kB`
  - `InstanceDetailFilesSection-DQ1yuoCn.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the new contract now required `buildManagedMemorySectionContent(...)` and `buildManagedToolsSectionContent(...)` while `InstanceDetail.tsx` still rendered those managed sections directly
- GREEN:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/clawstudio-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.test.tsx` still cannot be executed directly in this sandbox because `pnpm.cmd exec tsx ...` returns `spawn EPERM`; the helper coverage remains typechecked by the web lint pass
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about `@buape/carbon@0.0.0-beta-20260327000044`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-tail managed memory / tools composition pair, but Step 07 is still not closed.

## Next Frontier

- The page-tail composition cluster is now effectively exhausted.
- The next Step 07 move should return to a fresh gap audit and pick the next highest-value pure page-side bundle instead of repeating the same extraction pattern mechanically.
