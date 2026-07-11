> Migrated from `docs/review/step-07-section-model-helper-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Section Model Helper Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - keep shrinking `InstanceDetail.tsx` by removing page-local orchestration literals instead of extracting more low-value visual chrome
  - move the `agents` and `llmProviders` section-model assembly into a dedicated pure helper boundary
  - preserve page ownership for all truth-source selection, mutation authority, navigation, reload policy, and dialog state

## Root Cause

- After the workbench chrome and header chrome loops, the next concentrated page-local hotspot was no longer visual markup. It was the remaining section-model assembly cluster inside `InstanceDetail.tsx`:
  - `agentSectionProps`
  - `llmProviderSectionProps`
  - `llmProviderDialogProps`
- These large object literals still encoded page composition details, setter wrapping, and reload wiring inline even though they owned no real write-path authority.

## Implemented Extraction

- Added `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts` to own:
  - `buildAgentSectionProps(...)`
  - `buildLlmProviderSectionProps(...)`
  - `buildLlmProviderDialogProps(...)`
- Exported `InstanceDetailAgentsSectionProps` so the new helper can shape the real section contract instead of duplicating a parallel prop interface.
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` to consume the new builders instead of keeping the three object literals inline.
- Added `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx` to pin:
  - agent skill pending-key mapping
  - page-owned no-spinner reload wiring
  - provider availability notice preservation
  - provider delete id passthrough and dialog field change handlers
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract gate now enforces the new page -> section-model helper boundary.

## Boundary Decision

- `instanceDetailSectionModels.ts` owns only pure section-model assembly:
  - prop shaping
  - local setter wrapping for dialog field changes
  - no-spinner reload callback composition
- `InstanceDetail.tsx` still owns:
  - all `instanceService.*` and `agentSkillManagementService.*` writes
  - all navigation
  - all `toast` dispatch
  - all `loadWorkbench(...)` authority
  - all `setState(...)` ownership and truth-source gating
  - Provider Center managed classification, Local Proxy routing, and desktop runtime/plugin boundaries through the existing authoritative layers

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-agentstudio-pc-channels/src/services/channelService.ts`
- `packages/sdkwork-agentstudio-pc-market/src/services/marketService.ts`
- `packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/plugins/mod.rs`

These sources remain the authority for runtime truth, managed-provider behavior, and desktop/runtime boundaries. The new helper does not move those concerns.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `2161`
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `145`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailHeader.tsx`: `162`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailWorkbenchChrome.tsx`: `166`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1431`

This loop records a fresh current-worktree hotspot re-baseline. Because the worktree already carries additional in-flight Step 07 edits beyond the previously written release-90 snapshot, this review records a verified boundary improvement and new hotspot profile instead of claiming a clean raw line-count drop from that earlier note.

## Verification

- RED:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
  - failed first because `instanceDetailSectionModels.ts` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the helper file did not exist and the page still kept the section-model object literals inline
- GREEN:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
- YELLOW:

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the page-side orchestration boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting the remaining orchestration cluster around:
  - `memorySectionProps`
  - the managed tools panel JSX prebuilds
  - `toolsSectionProps`
- Keep the same rule: pure model/composition helpers may move, but page-owned write authority must stay in the page.

