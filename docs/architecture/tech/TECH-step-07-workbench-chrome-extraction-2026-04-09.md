> Migrated from `docs/review/step-07-workbench-chrome-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Workbench Chrome Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - keep shrinking `InstanceDetail.tsx` after the shared primitive repair from the prior loop
  - move the remaining lower workbench chrome into a dedicated presentational boundary without moving OpenClaw write authority
  - re-run fresh verification on the current real worktree and record any non-Step blockers truthfully

## Root Cause

- After the shared primitive repair, the next highest-yield page hotspot was still the lower workbench chrome cluster inside `InstanceDetail.tsx`:
  - six summary cards
  - section sidebar
  - CPU / memory resource cards
  - section heading shell
- That cluster was pure presentation and section navigation. It did not own transport selection, managed OpenClaw authority, or write-path invocation, so leaving it inline kept the page hotspot larger than necessary.

## Implemented Extraction

- Added pure presentation builders to `packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.ts`:
  - `buildInstanceWorkbenchSummaryMetrics(...)`
  - `buildInstanceWorkbenchResourceMetrics(...)`
- Added a dedicated chrome boundary:
  - `packages/sdkwork-claw-instances/src/components/InstanceDetailWorkbenchChrome.tsx`
    - owns the lower summary deck
    - owns the section sidebar shell
    - owns the CPU / memory cards
    - owns the shared `SectionHeading(...)` composition for the active workbench section
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`:
  - now renders `InstanceDetailWorkbenchChrome`
  - keeps `activeSection` state in the page
  - keeps all write-path authority, toast dispatch, reload behavior, and truth-source routing in the page
- Updated `scripts/sdkwork-instances-contract.test.ts` so the summary-card contract follows the new page -> chrome -> presentation boundary instead of assuming the page must still contain the literal summary i18n keys inline.

## Verification Follow-up Repairs

- `pnpm lint` exposed two current-worktree TypeScript regressions and one existing boundary violation during this loop:
  - `InstanceDetail.tsx` still passed `updatingSkillKeys` / `removingSkillKeys` instead of the actual state names `updatingAgentSkillKeys` / `removingAgentSkillKeys`
  - `instanceWorkbenchServiceCore.ts` was missing type imports for `OpenClawChannelStatusResult` and `InstanceWorkbenchMemoryEntry`
  - `InstanceDetailOverviewSection.tsx` still imported `InstanceManagementSummary` through a direct service subpath instead of the public service barrel
- Repaired all three verification blockers with minimal changes.
- Repo-wide `pnpm lint` still does not close fully because `check:sdkwork-install` fails on the current dirty worktree's unrelated `.gitmodules` state:

## Boundary Decision

- `InstanceDetailWorkbenchChrome.tsx` owns only presentation and section navigation shell composition.
- `instanceDetailWorkbenchPresentation.ts` owns only pure descriptor building.
- `InstanceDetail.tsx` still owns:
  - `activeSection` state
  - all workbench loading and reload authority
  - all OpenClaw truth-source selection
  - all `instanceService.*` and `agentSkillManagementService.*` writes
  - all `toast` side effects
  - header action buttons and lifecycle control
- No transport, Provider Center managed classification, Local Proxy boundary, or desktop plugin/runtime authority moved in this loop.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-claw-channels/src/services/channelService.ts`
- `packages/sdkwork-claw-market/src/services/marketService.ts`
- `packages/sdkwork-claw-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`

These sources still place managed OpenClaw authority, provider workspace readonly semantics, market install entry points, channel write bridging, and local desktop runtime boundaries outside the page-level chrome extraction.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `2073`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailWorkbenchChrome.tsx`: `159`
- `packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.ts`: `273`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the prior loop's `2423`-line page baseline, this loop reduces `InstanceDetail.tsx` to `2073`.

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.test.ts`
  - `pnpm exec tsx packages/sdkwork-claw-instances/src/components/InstanceDetailWorkbenchChrome.test.tsx`
  - both initially failed because the new builders and the new chrome component did not exist yet
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.test.ts`
  - `pnpm exec tsx packages/sdkwork-claw-instances/src/components/InstanceDetailWorkbenchChrome.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
- YELLOW:
  - `pnpm lint`

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially reduces the page hotspot and improves the page/component/presentation split, but it does not close Step 07.

## Next Frontier

- Continue decomposing `InstanceDetail.tsx`, now targeting the remaining page-owned header / action chrome cluster because it is still large but mostly composition-driven.
- Keep `instanceWorkbenchServiceCore.ts` and `instanceServiceCore.ts` under watch, but the page is still the dominant active hotspot after this loop.

