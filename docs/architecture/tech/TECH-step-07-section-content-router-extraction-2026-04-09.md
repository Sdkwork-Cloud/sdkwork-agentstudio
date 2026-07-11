> Migrated from `docs/review/step-07-section-content-router-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Section Content Router Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining page-local section switching and availability routing cluster from `InstanceDetail.tsx`
  - move the overview / channels / cronTasks / skills / files / config section router into a dedicated composition component
  - keep page ownership for truth-source selection, mutation authority, navigation, reload policy, and dialog state

## Root Cause

- After the managed `memory/tools` extraction, `InstanceDetail.tsx` still owned one more large pure-composition hotspot:
  - `renderSectionAvailability(...)`
  - `renderOverviewSection()`
  - `renderChannelsSection()`
  - `renderTasksSection()`
  - `renderSkillsSection()`
  - `renderFilesSection()`
  - `renderConfigSection()`
  - `renderSectionContent()`
- This cluster still decided which section surface to show, which fallback notice to display, and how to wire the section shell composition, but it did not own the real OpenClaw write paths or truth-source routing.

## Implemented Extraction

- Added `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx` to own:
  - shared section-availability rendering through `renderInstanceDetailSectionAvailability(...)`
  - active-section switching for `overview`, `channels`, `cronTasks`, `llmProviders`, `agents`, `skills`, `files`, `memory`, `tools`, and `config`
  - section-level composition for:
    - `InstanceDetailOverviewSection`
    - `InstanceDetailChannelsSection`
    - `InstanceDetailSkillsSection`
    - `InstanceDetailFilesSection`
    - `InstanceConfigWorkbenchPanel`
  - pass-through routing for the already separated page-built nodes:
    - `agents`
    - `llmProviders`
    - `memory`
    - `tools`
    - `cronTasks`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds the already-separated `agentSectionContent`, `llmProvidersSectionContent`, `tasksSectionContent`, `memorySectionContent`, and `toolsSectionContent`
  - delegates all section switching and availability routing to `InstanceDetailSectionContent`
  - reuses the extracted `renderInstanceDetailSectionAvailability(...)` helper for `llmProviders`, `memory`, and `tools`
- Added focused coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.test.tsx`
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract gate now enforces:
  - the page no longer keeps the section router and section-availability functions inline
  - the dedicated section-content component owns the overview / channels / skills / files / config routing boundary
  - old evidence positions for shared primitives, files, overview, and managed-file channel proof now follow the real component boundaries instead of stale page assumptions

## Boundary Decision

- `InstanceDetailSectionContent.tsx` owns only section composition:
  - active-section switching
  - section availability fallback rendering
  - section-level render delegation into already-separated child components
- `InstanceDetail.tsx` still owns:
  - all `instanceService.*` writes
  - all `agentSkillManagementService.*` writes
  - all `toast` dispatch
  - all `loadWorkbench(...)` authority
  - all page state, readonly gating, truth-source routing, navigation, and dialog ownership
  - page-built precomposed nodes for the already more specialized section boundaries
- This loop does not move Provider Center managed classification, Local Proxy routing, desktop runtime authority, or plugin bootstrap boundaries.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-agentstudio-pc-channels/src/services/channelService.ts`
- `packages/sdkwork-agentstudio-pc-market/src/services/marketService.ts`
- `packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for runtime truth, managed-provider semantics, ecosystem behavior, Local Proxy projection, and desktop/plugin boundaries. The current loop only moves page-side section composition.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `2009`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`: `222`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `93`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `258`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the prior current-worktree baseline from `release-2026-04-09-92`, the page hotspot now moves from `2102` to `2009`.

## Verification

- RED:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.test.tsx`
  - failed first because `InstanceDetailSectionContent.tsx` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the page still kept the section router inline and the component file did not exist
- GREEN:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
- YELLOW:
  - repo-wide `pnpm lint`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining page-side section-composition boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting the remaining orchestration clusters around:
  - provider catalog mutation lifecycle helpers
  - remaining managed-channel / runtime-surface page orchestration
- Keep the same rule:
  - pure composition and presentation shaping may move out of the page
  - truth-source routing, mutation authority, reload policy, and side-effect ownership must stay in the page

