# Step 07 Workbench Hydration Reset-State Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining workbench lazy-loading reset baselines from the `InstanceDetail.tsx` instance-switch effect
  - centralize the page-consumed file-loading and memory-loading reset state into a shared workbench hydration helper
  - keep page-owned lazy-load execution, cancellation guards, workbench merging, and `loadWorkbench(...)` authority in the page shell

## Root Cause

- After the managed-channel workspace sync-state extraction, `InstanceDetail.tsx` still owned one small inline reset pair inside the instance-switch effect:
  - `setIsWorkbenchFilesLoading(false)`
  - `setIsWorkbenchMemoryLoading(false)`
- Those values were page-authored even though the lazy-load decision and merge helpers already lived in `instanceWorkbenchHydration.ts`.

## Implemented Extraction

- Added to `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.ts`:
  - `InstanceWorkbenchHydrationResetState`
  - `createInstanceWorkbenchHydrationResetState(...)`
- The new helper centralizes the page-consumed hydration reset baselines for:
  - file lazy-load loading-state reset
  - memory lazy-load loading-state reset
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates one `workbenchHydrationResetState`
  - routes `setIsWorkbenchFilesLoading(...)` through `workbenchHydrationResetState.isFilesLoading`
  - routes `setIsWorkbenchMemoryLoading(...)` through `workbenchHydrationResetState.isMemoryLoading`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `instanceWorkbenchHydration.ts` now owns:
  - lazy-load decision helpers for files and memory
  - lazy-load merge helpers for files and memory
  - hydration reset baselines for file-loading and memory-loading state during instance switches
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all page setter dispatch
  - actual lazy-load effect execution for files and memory
  - cancellation guards for the async lazy-load effects
  - `instanceWorkbenchService.listInstanceFiles(...)`
  - `instanceWorkbenchService.listInstanceMemories(...)`
  - merge application into the current workbench snapshot
  - all `loadWorkbench(...)` authority
  - page-owned logging and failure handling
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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes page-consumed lazy-loading reset baselines.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1496`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.ts`: `101`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelPresentation.ts`: `24`
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
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.test.ts`
  - failed first because `createInstanceWorkbenchHydrationResetState(...)` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the inline hydration reset pair
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchHydration.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedChannelMutationSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-125') throw new Error(latest.tag); console.log(latest.tag)"`
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
  - the remaining managed-channel selection/draft derivation cluster
  - another small page-owned transient/reset bundle with the same pure value-shaping profile
- Keep the same rule:
  - shared sync/reset-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page
