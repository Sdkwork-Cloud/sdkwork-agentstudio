> Migrated from `docs/review/step-07-managed-config-draft-change-helper-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Managed Config Draft-Change Helper Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining repeated managed-config draft field-patching lambdas from `InstanceDetail.tsx`
  - keep the real `instanceService.saveOpenClaw*Config(...)` write paths, `toast` ownership, `loadWorkbench(...)` authority, readonly/truth-source gating, and page-owned form/error/saving state in the page shell

## Root Cause

- After the managed webSearch provider helper extraction, `InstanceDetail.tsx` still owned seven near-identical managed-config draft patch patterns:
  - webSearch shared draft
  - xSearch draft
  - native Codex webSearch draft
  - webFetch shared draft
  - webFetch fallback draft
  - auth cooldowns draft
  - dreaming draft
- Six of those lambdas repeated the same nullable state shape:
  - guard `current`
  - spread current draft
  - patch `[key]: value`
- The remaining webFetch fallback lambda repeated the same non-null spread-and-patch shape.

## Implemented Extraction

- Added to `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`:
  - `applyOpenClawNullableDraftFieldChange(...)`
  - `applyOpenClawDraftFieldChange(...)`
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - routes webSearch shared draft updates through `applyOpenClawNullableDraftFieldChange(...)`
  - routes xSearch draft updates through `applyOpenClawNullableDraftFieldChange(...)`
  - routes native Codex webSearch draft updates through `applyOpenClawNullableDraftFieldChange(...)`
  - routes webFetch shared draft updates through `applyOpenClawNullableDraftFieldChange(...)`
  - routes auth cooldowns draft updates through `applyOpenClawNullableDraftFieldChange(...)`
  - routes dreaming draft updates through `applyOpenClawNullableDraftFieldChange(...)`
  - routes webFetch fallback draft updates through `applyOpenClawDraftFieldChange(...)`
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`

## Boundary Decision

- `openClawManagedConfigDrafts.ts` now owns:
  - shared nullable managed-config draft field patching
  - shared non-null managed-config draft field patching
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all `buildOpenClaw*SaveInput(...)` calls
  - all `instanceService.saveOpenClaw*Config(...)` write calls
  - `toast.success(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - page-owned error and saving state across all managed-config surfaces
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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only centralizes repeated managed-config draft field patching.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1510`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.ts`: `562`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx`: `277`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailManagedWebFetchPanel.tsx`: `255`

Relative to the immediately prior `1557` page baseline from the managed webSearch provider helper loop, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1510`. This loop records both a verified boundary improvement and another page shrink while the repeated managed-config draft patch lambdas moved into shared helpers.

## Verification

- Focused RED was explicit before the helper landed:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - failed first because `applyOpenClawNullableDraftFieldChange(...)` and `applyOpenClawDraftFieldChange(...)` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the repeated inline draft patch lambdas
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-118') throw new Error(latest.tag); console.log(latest.tag)"`
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
  - managed-config init/reset shaping around auth cooldowns, xSearch, native Codex webSearch, or dreaming
  - another small page-owned orchestration cluster that shrinks the page without moving real write authority
- Keep the same rule:
  - shared draft-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page

