> Migrated from `docs/review/step-07-managed-web-search-provider-draft-helper-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Managed Web Search Provider Draft Helper Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining managed webSearch provider selection and provider-draft update shaping from `InstanceDetail.tsx`
  - keep the real `instanceService.saveOpenClawWebSearchConfig(...)` write path, `toast` ownership, `loadWorkbench(...)` authority, readonly/truth-source gating, and page-owned form/error/saving state in the page shell

## Root Cause

- After the managed webSearch draft-state sync extraction, `InstanceDetail.tsx` still owned one more page-local managed webSearch cluster:
  - selected provider lookup
  - selected provider draft fallback shaping
  - provider-draft mutation map updates
- That meant the page still directly depended on `createOpenClawWebSearchProviderDraft(...)` and kept webSearch provider-draft patch construction inline, even though:
  - the logic is still pure state derivation and pure draft-map updates
  - the page only needs the selected provider, the selected provider draft, and the next provider-draft map
  - the helper layer already owns the canonical provider-draft factory

## Implemented Extraction

- Added to `packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.ts`:
  - `OpenClawWebSearchProviderSelectionState`
  - `buildOpenClawWebSearchProviderSelectionState(...)`
  - `applyOpenClawWebSearchProviderDraftChange(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - derives `selectedWebSearchProvider` and `selectedWebSearchProviderDraft` through `buildOpenClawWebSearchProviderSelectionState(...)`
  - updates `webSearchProviderDrafts` through `applyOpenClawWebSearchProviderDraftChange(...)`
  - stops depending directly on `createOpenClawWebSearchProviderDraft(...)`
  - stops keeping a page-local `selectedWebSearchProvider` lookup `useMemo(...)`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawManagedConfigDrafts.ts` now owns:
  - managed webSearch selected-provider lookup from the synced provider id
  - selected provider draft fallback construction
  - provider-draft map patching for webSearch provider edits
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - `buildOpenClawWebSearchSaveInput(...)`
  - `instanceService.saveOpenClawWebSearchConfig(...)`
  - `toast.success(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - page-owned webSearch error and saving state
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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes managed webSearch provider draft-state shaping.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1557`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.ts`: `541`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx`: `277`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-claw-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `461`

Because the dirty worktree already carries adjacent Step 07 edits and this loop traded inline page logic for shared helper surface, this loop records a verified boundary improvement and a fresh current-worktree hotspot re-baseline rather than claiming a raw page shrink.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - failed first because `buildOpenClawWebSearchProviderSelectionState(...)` and `applyOpenClawWebSearchProviderDraftChange(...)` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still directly depended on `createOpenClawWebSearchProviderDraft(...)` and kept the selected-provider lookup/update cluster inline
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-117') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint scope remains intentionally limited:
  - repo-wide `pnpm lint` is still not the release gate for this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the managed webSearch provider-draft page boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - another managed-config draft-state/update cluster adjacent to webSearch, such as xSearch, auth cooldowns, native Codex web search, or dreaming reset/sync shaping
  - another small page-owned orchestration cluster that shrinks the page without moving real write authority
- Keep the same rule:
  - shared draft-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page

