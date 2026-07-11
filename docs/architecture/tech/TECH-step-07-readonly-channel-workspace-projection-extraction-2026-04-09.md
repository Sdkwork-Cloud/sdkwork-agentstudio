> Migrated from `docs/review/step-07-readonly-channel-workspace-projection-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Readonly Channel Workspace Projection Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining readonly channel projection cluster from `InstanceDetail.tsx`
  - centralize the page-consumed readonly channel workspace item shaping into a dedicated shared helper
  - keep page-owned managed-channel mutation execution, `toast` ownership, and `loadWorkbench(...)` authority unchanged

## Root Cause

- After the managed-channel toggle target lookup extraction, `InstanceDetail.tsx` still owned one readonly channel projection cluster:
  - cloning workbench channel setup steps
  - clearing editable `fields`
  - clearing editable `values`
  - reshaping the raw channel collection into summary-mode `ChannelWorkspaceItem[]`
- That cluster was still page-authored even though it only performed pure read-side projection and did not own any write-path authority.

## Implemented Extraction

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelPresentation.ts` with:
  - `buildReadonlyChannelWorkspaceItems(...)`
- The new helper centralizes the page-consumed readonly channel workspace projection for:
  - cloned setup-step arrays
  - empty editable `fields`
  - empty editable `values`
  - null-safe fallback when no runtime channel collection exists
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelPresentation.test.ts`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `readonlyChannelWorkspaceItems` through `buildReadonlyChannelWorkspaceItems(workbench?.channels)`
  - no longer carries the intermediate `readonlyChannelCatalogItems` projection
- Updated:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawChannelPresentation.ts` now owns:
  - readonly channel workspace projection for summary-mode channel rendering
- `openClawManagedChannelPresentation.ts` still owns:
  - managed-channel sync-state shaping
  - managed-channel selection-state shaping
  - managed-channel workspace projection
  - managed-channel null-safe lookup by id
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all page setter dispatch
  - all real managed-channel mutation execution
  - all `toast.success(...)` and `toast.error(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - page-owned saving/error state outside the shared presentation helpers
- This loop does not move Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their authoritative layers.

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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-channel persistence, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes page-consumed readonly channel workspace projection.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1460`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelPresentation.ts`: `12`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelPresentation.ts`: `103`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.ts`: `223`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`: `127`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.ts`: `93`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.ts`: `289`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.ts`: `642`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `461`
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `323`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately prior `1474` page baseline, this loop produces a real page-size drop while preserving the same page authority boundaries.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelPresentation.test.ts`
  - failed first because `openClawChannelPresentation.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the readonly channel projection cluster inline
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchHydration.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-129') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint scope remains intentionally limited:
  - repo-wide `pnpm lint` is still not the release gate for this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the readonly channels read-side boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - `availableAgentModelOptions`
  - another small page-owned pure projection bundle with a similar value-shaping profile
- Keep the same rule:
  - shared projection, selection, sync, and reset-state shaping may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page

