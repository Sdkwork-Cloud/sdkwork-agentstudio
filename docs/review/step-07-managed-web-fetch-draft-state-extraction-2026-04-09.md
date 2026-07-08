# Step 07 Managed Web Fetch Draft-State Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining page-local managed webFetch draft-state shaping from `InstanceDetail.tsx`
  - keep the real `instanceService.saveOpenClawWebFetchConfig(...)` write path, `toast` dispatch, `loadWorkbench(...)` authority, readonly/truth-source gating, and page-owned form/error/saving state in the page shell

## Root Cause

- After the earlier managed-config draft extraction, `InstanceDetail.tsx` still owned one more direct webFetch draft-state coordination seam:
  - lazy initialization for `webFetchFallbackDraft`
  - workbench-sync composition for `webFetchSharedDraft` and `webFetchFallbackDraft`
- That page code still depended on the lower-level webFetch draft factories even though:
  - the page only needs the combined shared-plus-fallback draft-state bundle
  - the shared helper layer already owns the canonical snapshot-to-draft mapping rules
  - keeping the page on a combined helper removes repeated pairing logic and makes the page depend on one authoritative draft-state constructor instead of coordinating two low-level factories itself

## Implemented Extraction

- Added to `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`:
  - `OpenClawWebFetchDraftState`
  - `createOpenClawWebFetchDraftState(...)`
- Updated focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - initializes `webFetchFallbackDraft` from `createOpenClawWebFetchDraftState(null).fallbackDraft`
  - derives both `webFetchSharedDraft` and `webFetchFallbackDraft` from `createOpenClawWebFetchDraftState(managedWebFetchConfig)` inside the sync effect
  - stops coordinating the shared and fallback draft factories directly in the page shell
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawManagedConfigDrafts.ts` now owns:
  - webFetch shared draft shaping
  - webFetch fallback draft shaping
  - the combined webFetch draft-state bundle that pairs those two shapes for page consumption
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - `buildOpenClawWebFetchSaveInput(...)`
  - `instanceService.saveOpenClawWebFetchConfig(...)`
  - `toast.success(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - the page-owned error and saving state for the managed webFetch surface
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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes managed webFetch draft-state shaping.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1566`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`: `467`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedWebFetchPanel.tsx`: `255`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx`: `277`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `461`

Because the dirty worktree already carries adjacent Step 07 edits beyond the last writeback, this loop records a verified boundary improvement and a fresh current-worktree hotspot re-baseline rather than attributing the full page delta only to this one extraction.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - failed first because `createOpenClawWebFetchDraftState(...)` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still directly coordinated the two lower-level webFetch draft factories
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-115') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint scope remains intentionally limited:
  - repo-wide `pnpm lint` is still not the release gate for this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the managed webFetch page boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - another managed-config draft-state cluster adjacent to webFetch, such as webSearch, xSearch, auth cooldowns, or dreaming reset/sync shaping
  - another small page-owned orchestration cluster that shrinks the page without moving real write authority
- Keep the same rule:
  - shared draft-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page
