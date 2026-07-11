# Step 07 Managed Config Null-Aware Draft Sync Reuse - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the remaining repeated managed-config sync null-guard branches from `InstanceDetail.tsx`
  - reuse the existing null-aware draft factories for auth cooldowns, dreaming, xSearch, and native Codex webSearch
  - keep the real `instanceService.saveOpenClaw*Config(...)` write paths, `toast` ownership, `loadWorkbench(...)` authority, readonly/truth-source gating, and page-owned form/error/saving state in the page shell

## Root Cause

- After the managed-config draft patch-helper extraction, `InstanceDetail.tsx` still owned four near-identical sync effects that repeated the same null branch:
  - `managedAuthCooldownsConfig`
  - `managedDreamingConfig`
  - `managedXSearchConfig`
  - `managedWebSearchNativeCodexConfig`
- Each effect still:
  - checked `if (!managed...Config)`
  - set the page draft to `null`
  - reset the matching error
  - returned early
- That branching was redundant because the existing shared draft factories already own null shaping:
  - `createOpenClawAuthCooldownsDraft(...)`
  - `createOpenClawDreamingFormState(...)`
  - `createOpenClawXSearchDraft(...)`
  - `createOpenClawWebSearchNativeCodexDraft(...)`

## Implemented Reuse

- Updated `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - routes auth cooldowns sync directly through `createAuthCooldownsFormState(managedAuthCooldownsConfig)`
  - routes dreaming sync directly through `createOpenClawDreamingFormState(managedDreamingConfig)`
  - routes xSearch sync directly through `createXSearchFormState(managedXSearchConfig)`
  - routes native Codex webSearch sync directly through `createWebSearchNativeCodexFormState(managedWebSearchNativeCodexConfig)`
  - keeps the page-owned `set*Error(null)` resets adjacent to those sync effects
- Updated:
  - `scripts/sdkwork-instances-contract.test.ts`
- No new managed-config helper surface was added in this loop. The page now fully reuses the existing null-aware draft factories instead of re-implementing their null branch.

## Boundary Decision

- Shared helpers remain the authority for:
  - null-aware draft-state shaping for auth cooldowns, dreaming, xSearch, and native Codex webSearch
  - managed-config draft parsing and save-input construction
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers
  - all page `set*Error(null)` resets
  - all `buildOpenClaw*SaveInput(...)` calls
  - all `instanceService.saveOpenClaw*Config(...)` write calls
  - `toast.success(...)`
  - all `loadWorkbench(...)` authority
  - readonly/truth-source routing
  - page-owned error and saving state across all managed-config surfaces
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

These sources remain the authority for browser-backed workbench persistence, Control UI section order, managed-provider projection, ecosystem/runtime ownership, Local Proxy routing, and desktop plugin/runtime registration. This loop only removes redundant page-side null guards and reuses existing shared draft factories more completely.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1490`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.ts`: `562`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigMutationSupport.ts`: `36`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedWebSearchPanel.tsx`: `277`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailManagedWebFetchPanel.tsx`: `255`

Relative to the immediately prior `1510` page baseline from the managed-config draft patch-helper loop, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1490`. This loop records another verified page shrink while the page stopped duplicating null-aware managed-config sync logic that already lived in shared draft factories.

## Verification

- Focused RED was explicit before the page simplification landed:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept the repeated inline null-guard branches in the four managed-config sync effects
- GREEN in and after this loop:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagedConfigDrafts.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceMemoryWorkbenchPresentation.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
  - `node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('docs/release/releases.json','utf8')); const latest=data.releases[data.releases.length-1]; if(latest.tag!=='release-2026-04-09-119') throw new Error(latest.tag); console.log(latest.tag)"`
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
  - managed-config reset-bundle shaping on instance switches
  - another small page-owned orchestration cluster that shrinks the page without moving real write authority
- Keep the same rule:
  - shared draft-state shaping and page-consumed helper composition may move out
  - truth-source routing, real write-path execution, toast ownership, and reload authority must stay in the page
