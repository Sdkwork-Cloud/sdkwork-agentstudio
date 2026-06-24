> Migrated from `docs/review/step-07-provider-reset-bundle-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Provider Reset-Bundle Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider-workbench reset baselines from the `InstanceDetail.tsx` instance-switch effect
  - centralize those page-consumed reset values into a shared provider presentation helper
  - keep the real provider/provider-model mutation execution, `toast` ownership, `loadWorkbench(...)` authority, and page-owned setter dispatch in the page shell

## Root Cause

- After the managed-config reset-bundle extraction and the agent reset-bundle extraction, the same `id`-switch effect in `InstanceDetail.tsx` still owned a dense provider reset cluster:
  - provider dialog visibility
  - provider dialog draft
  - provider request draft map
  - provider-model dialog visibility
  - provider-model dialog draft
  - provider-model delete id
  - provider delete id
- The page was therefore still hand-authoring the provider transient reset baseline even though `openClawProviderPresentation.ts` already owned provider dialog draft shaping and reset draft composition.

## Implemented Extraction

- Added to `packages/sdkwork-claw-instances/src/services/openClawProviderPresentation.ts`:
  - `OpenClawProviderWorkspaceResetState`
  - `createOpenClawProviderWorkspaceResetState(...)`
- The new helper composes `createOpenClawProviderDialogResetDrafts()` and centralizes the page-consumed reset baselines for:
  - provider dialog visibility
  - provider dialog draft
  - provider request draft map
  - provider-model dialog visibility
  - provider-model dialog draft
  - provider/provider-model delete transient state
- Added focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawProviderPresentation.test.ts`
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates one `providerWorkspaceResetState`
  - routes the provider instance-switch reset setter inputs through that helper bundle
  - keeps all provider setter dispatch in the page while consuming shared reset values
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderPresentation.ts` now owns:
  - shared provider page reset-value shaping
  - the composed fresh provider/provider-model dialog baselines used by the page during instance switches
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all page setter dispatch
  - all real provider and provider-model mutation execution
  - `toast.success(...)` and `toast.error(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - page-owned loading/error state
- This loop does not move Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their authoritative layers.

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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes page-consumed provider reset baselines.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1637`
- `packages/sdkwork-claw-instances/src/services/openClawProviderPresentation.ts`: `108`
- `packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.ts`: `312`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.ts`: `713`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-claw-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `486`
- `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts`: `343`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`: `111`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1498 / 71` baseline from the agent reset-bundle loop, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1637` and `openClawProviderPresentation.ts` at `108`. This loop records a verified boundary improvement and a fresh current-worktree re-baseline rather than claiming a raw page shrink, because the dirty worktree already carries adjacent Step 07 edits beyond this provider reset extraction.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderPresentation.test.ts`
  - failed first because `createOpenClawProviderWorkspaceResetState(...)` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline provider reset baselines in the instance-switch effect
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-122') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint scope remains intentionally limited:
  - repo-wide `pnpm lint` is still not the release gate for this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the page boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - the remaining workbench file/memory loading reset pair in the same `id`-switch effect
  - another small page-owned orchestration cluster that shrinks the page without moving real write authority
- Keep the same rule:
  - shared reset-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page

