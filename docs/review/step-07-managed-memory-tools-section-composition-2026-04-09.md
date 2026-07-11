# Step 07 Managed Memory And Tools Section Prop Builder Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining page-local `memory` / `tools` prop assembly and fallback-key literals from `InstanceDetail.tsx`
  - route those pure section-composition blocks through the existing `instanceDetailSectionModels.ts`
  - keep real mutation authority, reload policy, readonly gating, and truth-source routing in the page shell

## Root Cause

- After `release-2026-04-09-134`, `InstanceDetail.tsx` still owned two large pure-composition blocks:
  - `memorySectionContent`
  - `toolsSectionContent`
- Those blocks were not authoritative for OpenClaw writes. They only:
  - selected section empty-state copy
  - shaped props for the managed memory section
  - shaped props for the managed tools section
- Leaving them inline kept the page hotspot large even though the boundary had already stabilized enough to move this work into a shared section-model helper.

## Implemented Fix

- Exported the managed section prop interfaces from:
  - `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedMemorySection.tsx`
  - `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedToolsSection.tsx`
- Extended `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts` with:
  - `BuildManagedMemorySectionPropsInput`
  - `BuildManagedToolsSectionPropsInput`
  - `buildManagedMemorySectionProps(...)`
  - `buildManagedToolsSectionProps(...)`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates one shared `renderWorkbenchSectionAvailability(...)`
  - routes the `llmProviders` availability notice through that shared renderer
  - builds `memorySectionProps` through `buildManagedMemorySectionProps(...)`
  - builds `toolsSectionProps` through `buildManagedToolsSectionProps(...)`
  - renders the managed section components from those builder outputs instead of keeping the prop literals inline
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
- Updated `scripts/sdkwork-instances-contract.test.ts` so the boundary gate now requires:
  - the page to reference `buildManagedMemorySectionProps(...)`
  - the page to reference `buildManagedToolsSectionProps(...)`
  - the `memory` / `tools` fallback keys to live in the shared section-model helper instead of drifting back into the page

## Boundary Decision

- `instanceDetailSectionModels.ts` now owns only pure section-prop shaping for the managed memory and tools surfaces:
  - fallback-key selection
  - empty-state handoff
  - page-state-to-section-props translation
- `InstanceDetail.tsx` still explicitly owns:
  - all real `instanceService.saveOpenClaw*Config(...)` callbacks
  - all `toast` dispatch
  - all `loadWorkbench(...)` authority
  - all page state and draft state
  - readonly gating
  - truth-source routing
  - navigation and dialog ownership
- This loop does not move Local Proxy routing, desktop runtime authority, provider-center semantics, or plugin bootstrap boundaries.

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

These sources remain the authority for browser-backed managed workbench persistence, Control UI section semantics, Provider Center routing, default-agent install behavior, Local Proxy ownership, and desktop plugin/runtime registration. This loop only centralizes page-side section prop assembly.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1414`
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `388`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1416` page baseline from `release-2026-04-09-134`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1414`. This loop records a small but verified page-side reduction while moving another pure-composition slice out of the shell.

- Fresh build evidence:
  - `InstanceDetail-zJw2KVxb.js`: `177.56 kB`
  - `InstanceConfigWorkbenchPanel-B6hfgQIq.js`: `63.32 kB`
  - `InstanceDetailFilesSection-DjP3j9kO.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still did not route `memory` / `tools` prop assembly through `buildManagedMemorySectionProps(...)` and `buildManagedToolsSectionProps(...)`
- GREEN:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx` now contains direct helper coverage, but executing it via `pnpm.cmd exec tsx ...` remains blocked in this sandbox by `spawn EPERM`; the new coverage was still typechecked by `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - repo-wide `pnpm lint` was not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially reduces the remaining page-side composition hotspot, but Step 07 is still not closed.

## Next Frontier

- Keep shrinking `InstanceDetail.tsx` through the remaining page-side content composition cluster:
  - `agentSectionContent`
  - `llmProvidersSectionContent`
  - `tasksSectionContent`
- Preserve the current rule:
  - pure presentation / prop shaping may move out
  - mutation authority, reload policy, truth-source routing, and side effects stay in the page shell
