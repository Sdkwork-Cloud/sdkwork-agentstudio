> Migrated from `docs/review/step-07-agent-reset-bundle-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Agent Reset-Bundle Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining agent-workbench reset baselines from the `InstanceDetail.tsx` instance-switch effect
  - centralize those page-consumed reset values into a shared agent presentation helper
  - keep the real agent CRUD, skill mutation execution, `toast` ownership, `loadWorkbench(...)` authority, and page-owned setter dispatch in the page shell

## Root Cause

- After the managed-config reset-bundle extraction, the same `id`-switch effect in `InstanceDetail.tsx` still owned a dense agent reset cluster:
  - agent dialog visibility
  - selected agent id
  - selected agent workbench snapshot
  - agent workbench error
  - agent workbench loading flag
  - agent dialog draft
  - editing agent id
  - agent delete id
  - installing skill flag
  - updating skill keys
- That cluster also left one agent reset gap in place:
  - `removingAgentSkillKeys` was not cleared on instance switches
- The page was therefore still hand-authoring the full agent reset baseline even though `openClawAgentPresentation.ts` already owned agent dialog state shaping.

## Implemented Extraction

- Added to `packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.ts`:
  - `OpenClawAgentWorkspaceResetState`
  - `createOpenClawAgentWorkspaceResetState(...)`
- The new helper composes `createOpenClawAgentCreateDialogState()` and centralizes the page-consumed reset baselines for:
  - dialog visibility
  - selected agent workbench state
  - workbench loading/error state
  - delete/install/update/remove skill transient state
- Added focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.test.ts`
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates one `agentWorkspaceResetState`
  - routes the agent instance-switch reset setter inputs through that helper bundle
  - resets `removingAgentSkillKeys` during instance switches alongside the rest of the agent transient state
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawAgentPresentation.ts` now owns:
  - shared agent page reset-value shaping
  - the composed fresh agent-create dialog baseline used by the page during instance switches
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all page setter dispatch
  - all real agent CRUD and skill-mutation execution
  - `toast.success(...)` and `toast.error(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - page-owned loading/error state
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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes page-consumed agent reset baselines.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1498`
- `packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.ts`: `289`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.ts`: `642`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx`: `277`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebFetchPanel.tsx`: `255`

Relative to the immediately prior `1496 / 263` baseline from the managed-config reset-bundle loop, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1498` and `openClawAgentPresentation.ts` at `289`. This loop records a boundary improvement and a fresh current-worktree re-baseline rather than claiming a raw page shrink. The helper absorbed the remaining agent reset boundary and now also resets `removingAgentSkillKeys` during instance switches.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.test.ts`
  - failed first because `createOpenClawAgentWorkspaceResetState(...)` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the inline agent reset baselines and did not route them through a shared helper
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-121') throw new Error(latest.tag); console.log(latest.tag)"`
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
  - the remaining provider-side reset cluster in the same `id`-switch effect
  - another small page-owned orchestration cluster that shrinks the page without moving real write authority
- Keep the same rule:
  - shared reset-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page

