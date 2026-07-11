> Migrated from `docs/review/step-07-agent-model-option-projection-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Agent Model Option Projection Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining `availableAgentModelOptions` projection cluster from `InstanceDetail.tsx`
  - centralize the page-consumed agent model option shaping into the existing shared agent presentation helper
  - keep page-owned agent dialog visibility, mutation execution, `toast`, and `loadWorkbench(...)` authority unchanged

## Root Cause

- After `release-2026-04-09-129`, `InstanceDetail.tsx` still owned one pure agent-side projection bundle:
  - iterating over `workbench?.llmProviders`
  - normalizing provider ids with `normalizeLegacyProviderId(...)`
  - deduplicating provider/model refs with a page-local `Map`
  - shaping dialog-facing `{ value, label }[]` options for the agent editor
- That cluster was still page-authored even though it did not own any write-path authority, state transitions, or truth-source routing.

## Implemented Extraction

- Added `buildOpenClawAgentModelOptions(...)` to:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.ts`
- The new helper now owns:
  - legacy provider id normalization
  - null-safe provider/model iteration
  - duplicate model-ref suppression
  - final dialog-facing `{ value, label }[]` shaping
- Added focused coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.test.ts`
- Rewired:
  - `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- Updated the boundary contract in:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawAgentPresentation.ts` now owns:
  - agent dialog draft factories
  - agent reset-state baselines
  - agent param entry shaping
  - agent model option projection
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all page setter dispatch
  - real agent save/delete/install/toggle/remove execution
  - all `toast.success(...)` and `toast.error(...)`
  - all `loadWorkbench(...)` authority
  - page-owned dialog visibility and saving flags
  - truth-source selection and readonly/writable routing

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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, channel/market/agent ecosystem behavior, management capability truth, Local Proxy ownership, and desktop plugin/runtime registration. This loop only centralizes page-consumed agent model option projection.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1444`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.ts`: `324`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawChannelPresentation.ts`: `12`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelPresentation.ts`: `103`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.ts`: `223`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.ts`: `127`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderPresentation.ts`: `93`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.ts`: `642`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `461`
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `323`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately prior `1460` page baseline, this loop produces another real page-size drop while preserving the same page authority boundaries.

## Verification

- Focused RED before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.test.ts`
  - failed first because `buildOpenClawAgentModelOptions(...)` was not exported yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the inline `availableAgentModelOptions` projection
- GREEN after implementation and fresh re-run:
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
- Release evidence gate for this loop must also be green:
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-130') throw new Error(latest.tag); console.log(latest.tag)"`
- Session-known yellow:
  - repo-wide `pnpm lint` is still not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the agent dialog read-side boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now prioritizing one of:
  - the next small pure projection/selection/reset bundle still left in the page shell
  - section-level lazy composition to address the still-large `InstanceDetail` bundle
- Keep the same rule:
  - shared projection, selection, sync, and reset-state shaping may move out
  - truth-source routing, real write-path execution, `toast` ownership, and reload authority must stay in the page

