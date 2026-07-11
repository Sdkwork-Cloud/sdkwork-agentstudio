# Step 07 Managed Web Search Draft-State Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining page-local managed webSearch draft-state sync shaping from `InstanceDetail.tsx`
  - keep the real `instanceService.saveOpenClawWebSearchConfig(...)` write path, `toast` ownership, `loadWorkbench(...)` authority, readonly/truth-source gating, and page-owned form/error/saving state in the page shell

## Root Cause

- After the managed webFetch draft-state extraction, `InstanceDetail.tsx` still owned one more page-local managed-config sync seam for web search:
  - current-provider preservation when the managed provider catalog changes
  - fallback selection to the configured provider or the first available provider
  - shared draft remapping and provider-draft reset during workbench sync
- That page effect still mixed selection rules with snapshot-to-draft shaping even though:
  - the logic is pure state derivation from the managed webSearch snapshot plus the current selected provider id
  - the page only needs the final selected-provider id, shared draft, and reset provider-draft store
  - keeping the selection fallback and shared draft mapping in one helper reduces page-side branching without moving save authority out of the page

## Implemented Extraction

- Added to `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.ts`:
  - `OpenClawWebSearchDraftState`
  - `createOpenClawWebSearchDraftState(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.test.ts`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - derives the managed webSearch provider selection fallback through `createOpenClawWebSearchDraftState(...)`
  - derives the managed webSearch shared draft through the same helper
  - resets the provider-draft store from the helper result instead of coordinating this shape inline
  - stops depending directly on `createOpenClawWebSearchSharedDraft(...)`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawManagedConfigDrafts.ts` now owns:
  - managed webSearch selected-provider fallback derivation
  - managed webSearch shared draft shaping
  - the combined managed webSearch draft-state bundle consumed by the page sync effect
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - `buildOpenClawWebSearchSaveInput(...)`
  - `instanceService.saveOpenClawWebSearchConfig(...)`
  - `toast.success(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - page-owned webSearch error and saving state
  - page-owned per-provider draft editing after initial draft-state sync
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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes managed webSearch draft-state shaping.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1554`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.ts`: `499`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx`: `277`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedWebFetchPanel.tsx`: `255`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `461`

Relative to the immediately prior `1566` page baseline from the managed webFetch draft-state loop, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1554`. This loop records a verified boundary improvement and another small page shrink while the shared managed-config helper absorbed the remaining managed webSearch sync shaping.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - failed first because `createOpenClawWebSearchDraftState(...)` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still owned the inline managed webSearch provider-selection fallback and shared-draft sync logic
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-116') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint scope remains intentionally limited:
  - repo-wide `pnpm lint` is still not the release gate for this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the managed webSearch page boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - another managed-config draft-state cluster adjacent to webSearch and webFetch, such as auth cooldowns, xSearch, native Codex web search, or dreaming reset/sync shaping
  - another small page-owned orchestration cluster that shrinks the page without moving real write authority
- Keep the same rule:
  - shared draft-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page
