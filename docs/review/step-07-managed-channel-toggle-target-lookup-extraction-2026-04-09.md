# Step 07 Managed Channel Toggle Target Lookup Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining inline managed-channel toggle target lookup from `InstanceDetail.tsx`
  - centralize the page-consumed managed-channel lookup by id into the shared managed-channel presentation helper
  - keep page-owned mutation execution, `toast` ownership, and `loadWorkbench(...)` authority in the page shell

## Root Cause

- After the managed-channel workspace projection extraction, `InstanceDetail.tsx` still owned one small inline managed-channel lookup inside `onToggleManagedChannel`:
  - `managedChannels.find((item) => item.id === channelId)`
- That branch was still page-authored even though it only performed pure target lookup and did not own any write-path authority.

## Implemented Extraction

- Added to `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelPresentation.ts`:
  - `findOpenClawManagedChannelById(...)`
- The new helper centralizes the page-consumed managed-channel lookup for:
  - matching a managed channel by id
  - null-safe fallback for missing ids and empty collections
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelPresentation.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - routes `onToggleManagedChannel` target lookup through `findOpenClawManagedChannelById(...)`
  - keeps the actual toggle mutation execution in `handleToggleManagedChannel(...)`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawManagedChannelPresentation.ts` now owns:
  - managed-channel collection sync-state shaping
  - managed-channel selection-state lookup
  - managed-channel workspace projection
  - managed-channel null-safe lookup by id for page-consumed action targeting
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all page setter dispatch
  - all real managed-channel mutation execution
  - all `toast.success(...)` and `toast.error(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - page-owned saving/error state outside the shared presentation helper
- This loop does not move Provider Center managed classification, Local Proxy routing/projection, desktop runtime/plugin ownership, or transport/truth-source routing out of their authoritative layers.

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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-channel persistence, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes page-consumed managed-channel toggle target lookup.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1474`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelPresentation.ts`: `103`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelMutationSupport.ts`: `223`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`: `127`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.ts`: `93`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.ts`: `289`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`: `642`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `461`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.ts`: `323`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`

Because the dirty worktree already carries adjacent Step 07 edits, this loop records a verified boundary improvement and a fresh current-worktree re-baseline rather than attributing every hotspot delta only to this extraction.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - failed first because `findOpenClawManagedChannelById(...)` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the inline managed-channel lookup inside `onToggleManagedChannel`
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-128') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint scope remains intentionally limited:
  - repo-wide `pnpm lint` is still not the release gate for this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the managed-channel read-side boundary again, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - the readonly channel projection cluster
  - another small page-owned pure projection bundle with a similar value-shaping profile
- Keep the same rule:
  - shared projection, selection, sync, and reset-state shaping may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page
