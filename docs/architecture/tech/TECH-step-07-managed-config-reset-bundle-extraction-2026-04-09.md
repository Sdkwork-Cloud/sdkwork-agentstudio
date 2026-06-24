> Migrated from `docs/review/step-07-managed-config-reset-bundle-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Managed Config Reset-Bundle Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining repeated managed-config reset baselines from the `InstanceDetail.tsx` instance-switch effect
  - centralize those page-consumed reset values into a shared helper bundle
  - keep the real `instanceService.saveOpenClaw*Config(...)` write paths, `toast` ownership, `loadWorkbench(...)` authority, readonly/truth-source gating, and page-owned setter dispatch in the page shell

## Root Cause

- After the managed-config sync and patch-helper loops, `InstanceDetail.tsx` still owned a dense instance-switch reset cluster for managed-config page state:
  - selected managed webSearch provider id
  - managed webSearch drafts, error, and saving flag
  - xSearch draft, error, and saving flag
  - native Codex webSearch draft, error, and saving flag
  - auth cooldowns draft, error, and saving flag
  - dreaming draft, error, and saving flag
- That effect also left the managed webFetch reset baseline split outside the reset cluster:
  - `webFetchSharedDraft`
  - `webFetchFallbackDraft`
  - `webFetchError`
  - `isSavingWebFetch`
- The page was therefore still hand-authoring the reset values for multiple managed-config surfaces even though the draft factories already owned the null-aware empty-state shaping.

## Implemented Extraction

- Added to `packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.ts`:
  - `OpenClawManagedConfigResetState`
  - `createOpenClawManagedConfigResetState(...)`
- The new reset helper composes the existing null-aware draft factories instead of re-encoding the reset baselines inline:
  - `createOpenClawWebSearchDraftState({ config: null })`
  - `createOpenClawXSearchDraft(null)`
  - `createOpenClawWebSearchNativeCodexDraft(null)`
  - `createOpenClawWebFetchDraftState(null)`
  - `createOpenClawAuthCooldownsDraft(null)`
  - `createOpenClawDreamingFormState(null)`
- Added focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - creates one `managedConfigResetState`
  - routes managed-config reset setter inputs through that helper bundle
  - resets the managed webFetch draft/error/saving state alongside the other managed-config surfaces during instance switches
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawManagedConfigDrafts.ts` now owns:
  - shared managed-config reset-value shaping for the page shell
  - the null-aware empty-state composition for all managed-config surfaces, including webFetch
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all page setter dispatch
  - all `buildOpenClaw*SaveInput(...)` calls
  - all `instanceService.saveOpenClaw*Config(...)` write calls
  - `toast.success(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - page-owned error and saving state across all managed-config surfaces
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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes page-consumed managed-config reset baselines.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1496`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.ts`: `642`
- `packages/sdkwork-claw-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx`: `277`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedWebFetchPanel.tsx`: `255`

Relative to the immediately prior `1490 / 562` baseline from the null-aware sync reuse loop, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1496` and `openClawManagedConfigDrafts.ts` at `642`. This loop records a boundary improvement and a fresh current-worktree re-baseline rather than claiming a raw page shrink. The helper absorbed the reset-bundle boundary and now also resets managed webFetch state during instance switches.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - failed first because `createOpenClawManagedConfigResetState(...)` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the inline managed-config reset baselines and did not route them through a shared helper
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-120') throw new Error(latest.tag); console.log(latest.tag)"`
- Repo-wide lint scope remains intentionally limited:
  - repo-wide `pnpm lint` is still not the release gate for this loop

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop materially improves the managed-config page boundary, but Step 07 is still not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now targeting one of:
  - the remaining instance-switch reset cluster outside managed-config
  - another small page-owned orchestration cluster that shrinks the page without moving real write authority
- Keep the same rule:
  - shared reset-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page

