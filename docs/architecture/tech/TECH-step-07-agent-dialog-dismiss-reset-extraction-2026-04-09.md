> Migrated from `docs/review/step-07-agent-dialog-dismiss-reset-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Agent Dialog Dismiss Reset Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining page-side agent dialog dismiss/reset cluster from `InstanceDetail.tsx`
  - keep dialog visibility state, selected-agent truth, and all real write authority in the page shell

## Root Cause

- After the agent dialog draft-selection extraction, `InstanceDetail.tsx` still delegated one more unstable boundary directly:
  - `onAgentDialogOpenChange: setIsAgentDialogOpen`
- That meant the section-level dialog close path did not own a shared reset rule for:
  - agent dialog open state
  - editing agent id reset
  - agent dialog draft reset back to the shared create baseline
- The page did not need to keep that close/reset wiring inline as long as:
  - page-owned state setters are still injected from the page
  - actual dialog open/close state ownership stays in the page
  - all `instanceService.*`, `toast`, and `loadWorkbench(...)` authority stays where it already is

## Implemented Extraction

- Extended `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts` so `buildAgentSectionProps(...)` now also owns:
  - agent dialog close/reset callback construction
  - shared reset-to-create baseline selection through `createOpenClawAgentCreateDialogState(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - passes `setIsAgentDialogOpen`
  - passes `setEditingAgentId`
  - keeps page-owned state authority
  - stops passing `onAgentDialogOpenChange: setIsAgentDialogOpen` directly
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `instanceDetailSectionModels.ts` now owns:
  - section-facing dialog close/reset callback shaping
  - reset-to-create baseline selection for agent dialog dismiss
  - page-setter orchestration for dismiss-time cleanup
- `InstanceDetail.tsx` still explicitly owns:
  - `setIsAgentDialogOpen(...)`
  - `setEditingAgentId(...)`
  - `setAgentDialogDraft(...)`
  - `selectedAgentWorkbench` truth
  - all `instanceService.*` agent writes
  - all `toast` dispatch and `loadWorkbench(...)` authority
  - Provider Center managed classification, Local Proxy routing, desktop runtime/plugin ownership, and transport/truth-source routing through the existing authoritative layers

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

These sources remain the authority for workbench persistence, managed-provider decisions, marketplace/install ownership, Local Proxy routing, and desktop runtime/plugin ownership. This loop only moves agent dialog dismiss/reset callback shaping.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1742`
- `packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.ts`: `148`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentPresentation.ts`: `263`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentMutationSupport.ts`: `135`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawAgentSkillMutationSupport.ts`: `187`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceLifecycleActionSupport.ts`: `26`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`: `353`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedChannelMutationSupport.ts`: `223`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`: `215`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedMemorySection.tsx`: `87`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedToolsSection.tsx`: `247`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately prior `1741` page baseline from the dialog draft-selection note, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1742`. This loop is still a verified boundary improvement, but not a raw shrink, because the shared section-model helper now carries the dismiss/reset sequencing while the page keeps explicit state-setter injection.

## Verification

- RED established in this loop:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still passed `onAgentDialogOpenChange: setIsAgentDialogOpen` directly and the helper did not yet own dismiss/reset wiring
- GREEN in and after this loop:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/instanceDetailSectionModels.test.tsx`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-104') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint status:
  - repo-wide `pnpm lint` was not rerun in this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the remaining page-side agent dialog dismiss/reset boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - another remaining page-owned dialog reset/dismiss cluster outside the new section-model boundary
  - another remaining page-owned orchestration cluster that can move without absorbing write-path authority
- Keep the same rule:
  - shared callback shaping may move out
  - page-owned truth sources, side effects, write callbacks, reload authority, and OpenClaw control-plane alignment stay where they are

