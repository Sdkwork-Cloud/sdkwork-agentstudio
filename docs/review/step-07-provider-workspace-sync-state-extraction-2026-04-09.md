# Step 07 Provider Workspace Sync-State Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining provider workspace sync-state shaping from the `InstanceDetail.tsx` `workbench?.llmProviders` effect
  - centralize that page-consumed selection fallback and draft-reset shaping into a shared provider workspace presentation helper
  - keep page-owned setter dispatch, provider mutation execution, `toast` ownership, and `loadWorkbench(...)` authority in the page shell

## Root Cause

- After the provider reset-bundle extraction, `InstanceDetail.tsx` still owned one inline provider workspace sync cluster tied to `workbench?.llmProviders`:
  - empty provider collection handling
  - selected provider fallback to the current valid provider or first available provider
  - provider config draft reset map clearing
  - provider request draft reset map clearing
- That cluster was still page-authored even though `openClawProviderWorkspacePresentation.ts` already owned provider workspace state shaping and selection-state derivation.

## Implemented Extraction

- Added to `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`:
  - `BuildOpenClawProviderWorkspaceSyncStateInput`
  - `OpenClawProviderWorkspaceSyncState`
  - `buildOpenClawProviderWorkspaceSyncState(...)`
- The new helper centralizes the page-consumed provider workspace sync baselines for:
  - selected provider fallback resolution through a callback-style `resolveSelectedProviderId`
  - provider config draft reset map shaping
  - provider request draft reset map shaping
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates one `providerWorkspaceSyncState`
  - routes the `setSelectedProviderId(...)` callback through `providerWorkspaceSyncState.resolveSelectedProviderId`
  - routes provider draft/request reset maps through that shared helper output
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawProviderWorkspacePresentation.ts` now owns:
  - provider workspace collection sync-state shaping
  - selected-provider fallback logic for collection changes
  - provider draft/request reset map baselines for provider collection changes
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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes page-consumed provider workspace sync-state shaping.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1632`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`: `142`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.ts`: `108`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.ts`: `312`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`: `713`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts`: `39`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `486`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailSectionModels.ts`: `343`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1134`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1431`

Relative to the immediately prior `1637 / 111` baseline from the provider reset-bundle loop, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1632` and `openClawProviderWorkspacePresentation.ts` at `142`. This loop records both a verified boundary improvement and a small page shrink while the provider workspace sync-state logic moved out of the page.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - failed first because `buildOpenClawProviderWorkspaceSyncState(...)` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the inline provider workspace sync effect
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-123') throw new Error(latest.tag); console.log(latest.tag)"`
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
  - the managed-channel selection/draft sync effect that still keeps empty-state handling and selection fallback inline
  - the remaining workbench file/memory loading reset pair
- Keep the same rule:
  - shared sync/reset-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page
