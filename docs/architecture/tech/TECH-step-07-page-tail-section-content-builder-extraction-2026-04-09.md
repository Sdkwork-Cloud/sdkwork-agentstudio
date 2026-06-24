> Migrated from `docs/review/step-07-page-tail-section-content-builder-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Page Tail Section Content Builder Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-tail pure content wrappers for `agents`, `llmProviders`, and `cronTasks` out of `InstanceDetail.tsx`
  - route those three section-content nodes through `instanceDetailSectionModels.ts`
  - keep real mutation authority, workbench reload ownership, readonly gating, and truth-source routing in the page shell

## Root Cause

- After `release-2026-04-09-135`, `InstanceDetail.tsx` still owned three pure tail wrappers:
  - `agentSectionContent`
  - `llmProvidersSectionContent`
  - `tasksSectionContent`
- Those wrappers were no longer authoritative for OpenClaw writes. They only chose whether to render:
  - `InstanceDetailAgentsSection`
  - `InstanceDetailManagedLlmProvidersSection`
  - `CronTasksManager`
- The new section-model builders already existed, but the page had not been rewired yet.
- Contract coverage also still carried older direct-page assumptions for:
  - `CronTasksManager`
  - `InstanceDetailManagedLlmProvidersSection`
  - `InstanceDetailAgentsSection`
  so the first GREEN attempt exposed architecture-contract drift instead of a runtime defect.

## Implemented Fix

- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now routes:
  - `agentSectionContent` through `buildAgentSectionContent(...)`
  - `llmProvidersSectionContent` through `buildLlmProvidersSectionContent(...)`
  - `tasksSectionContent` through `buildTasksSectionContent(...)`
- Removed the now-redundant page-local imports of:
  - `CronTasksManager`
  - `InstanceDetailAgentsSection`
  - `InstanceDetailManagedLlmProvidersSection`
- Kept `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts` as the single pure composition owner for:
  - agent section content
  - managed provider section content
  - embedded cron task content
- Repaired the follow-up typing drift in `BuildTasksSectionContentInput` so it accepts `InstanceWorkbenchSnapshot | null`, which matches the page-owned `workbench` truth source instead of an invalid `Pick<InstanceWorkbenchSnapshot, 'cronTasks'>`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to reference `buildAgentSectionContent(...)`
  - the page to reference `buildLlmProvidersSectionContent(...)`
  - the page to reference `buildTasksSectionContent(...)`
  - direct component ownership evidence for `CronTasksManager`, `InstanceDetailManagedLlmProvidersSection`, and `InstanceDetailAgentsSection` to live in `instanceDetailSectionModels.ts`
- The focused helper coverage already added in `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.test.tsx` remains aligned with the new builder boundary.

## Boundary Decision

- `instanceDetailSectionModels.ts` now owns only pure section-content composition and section-prop shaping for the page-tail section nodes.
- `InstanceDetail.tsx` still explicitly owns:
  - all real `instanceService.*` write callbacks
  - all `toast` dispatch
  - all `loadWorkbench(...)` authority
  - readonly gating
  - truth-source routing
  - navigation and dialog ownership
  - page state, drafts, and mutation runner wiring
- This loop does not move Local Proxy routing, desktop runtime authority, Provider Center truth-source rules, or plugin/runtime bootstrap boundaries.

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

These sources remain the authority for browser-backed studio task/provider APIs, Provider Center managed-route detection, channel and market install flows, local proxy ownership, and desktop plugin/runtime registration. This loop only centralizes page-side content composition for already-authoritative workbench sections.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1408`
- `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts`: `435`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1414` page baseline from `release-2026-04-09-135`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1408`. This loop records another verified page-side reduction while deliberately moving pure tail content composition into the shared section-model helper.

- Fresh build evidence:
  - `InstanceDetail-CU1YTAaV.js`: `177.80 kB`
  - `InstanceConfigWorkbenchPanel-8Iev9096.js`: `63.32 kB`
  - `InstanceDetailFilesSection-DMukTGq0.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because older contract assertions still required direct page-local ownership of `CronTasksManager`, `InstanceDetailManagedLlmProvidersSection`, and `InstanceDetailAgentsSection`
- GREEN:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/claw-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.test.tsx` still cannot be executed directly in this sandbox because `pnpm.cmd exec tsx ...` returns `spawn EPERM`; the helper coverage remains typechecked by the web lint pass
  - `pnpm.cmd check:sdkwork-instances` still emits the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially reduces the remaining page-side hotspot and closes another pure composition cluster, but Step 07 is still not closed.

## Next Frontier

- Keep shrinking `InstanceDetail.tsx` through the remaining page-local section composition pair:
  - `memorySectionContent`
  - `toolsSectionContent`
- Preserve the same rule:
  - pure presentation / prop shaping / content composition may move out
  - mutation authority, reload policy, truth-source routing, and side effects stay in the page shell

