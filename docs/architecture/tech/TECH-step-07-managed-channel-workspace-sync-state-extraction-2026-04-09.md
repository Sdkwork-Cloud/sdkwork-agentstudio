> Migrated from `docs/review/step-07-managed-channel-workspace-sync-state-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Managed Channel Workspace Sync-State Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining managed-channel workspace sync-state shaping from the `InstanceDetail.tsx` `workbench?.managedChannels` effect
  - centralize that page-consumed selection fallback, draft-reset shaping, and error-reset shaping into a shared managed-channel presentation helper
  - keep page-owned setter dispatch, channel mutation execution, `toast` ownership, and `loadWorkbench(...)` authority in the page shell

## Root Cause

- After the provider reset-bundle and provider workspace sync-state extractions, `InstanceDetail.tsx` still owned one inline managed-channel sync cluster tied to `workbench?.managedChannels`:
  - empty managed-channel collection handling
  - selected managed-channel validity fallback to the current valid channel or `null`
  - managed-channel draft reset map clearing
  - managed-channel error reset shaping
- That cluster was still page-authored even though the actual mutation planning and mutation sequencing for managed channels already lived in shared helpers.

## Implemented Extraction

- Added `packages/sdkwork-claw-instances/src/services/openClawManagedChannelPresentation.ts` with:
  - `BuildOpenClawManagedChannelWorkspaceSyncStateInput`
  - `OpenClawManagedChannelWorkspaceSyncState`
  - `buildOpenClawManagedChannelWorkspaceSyncState(...)`
- The new helper centralizes the page-consumed managed-channel workspace sync baselines for:
  - selected managed-channel validity resolution through a callback-style `resolveSelectedManagedChannelId`
  - managed-channel draft reset map shaping
  - managed-channel error reset shaping
- Added focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawManagedChannelPresentation.test.ts`
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates one `managedChannelWorkspaceSyncState`
  - routes the `setSelectedManagedChannelId(...)` callback through `managedChannelWorkspaceSyncState.resolveSelectedManagedChannelId`
  - routes managed-channel draft resets through `managedChannelWorkspaceSyncState.managedChannelDrafts`
  - routes managed-channel error resets through `managedChannelWorkspaceSyncState.managedChannelError`
- Updated:
  - `packages/sdkwork-claw-instances/src/services/index.ts`
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawManagedChannelPresentation.ts` now owns:
  - managed-channel collection sync-state shaping
  - selected managed-channel validity fallback for collection changes
  - managed-channel draft reset-map baselines for collection changes
  - managed-channel error reset baselines for collection changes
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all page setter dispatch
  - all real managed-channel mutation execution
  - `toast.success(...)` and `toast.error(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - page-owned saving/error state outside the collection-sync helper
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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-channel persistence, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes page-consumed managed-channel collection sync-state shaping.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1494`
- `packages/sdkwork-claw-instances/src/services/openClawManagedChannelPresentation.ts`: `24`
- `packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.ts`: `223`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`: `127`
- `packages/sdkwork-claw-instances/src/services/openClawProviderPresentation.ts`: `93`
- `packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.ts`: `289`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.ts`: `642`
- `packages/sdkwork-claw-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `461`
- `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts`: `323`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts`: `1274`

Because the dirty worktree already carries adjacent Step 07 edits, this loop records a verified boundary improvement and a fresh current-worktree re-baseline rather than attributing every hotspot delta only to this extraction.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - failed first because `openClawManagedChannelPresentation.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the inline managed-channel workspace sync effect
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-124') throw new Error(latest.tag); console.log(latest.tag)"`
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
  - the remaining workbench file/memory loading reset pair
  - another small page-owned transient/reset bundle with the same pure value-shaping profile
- Keep the same rule:
  - shared sync/reset-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page

