> Migrated from `docs/review/step-07-instance-detail-console-link-pass-through-simplification-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Console Link Pass-through Simplification - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - remove the last trivial page-owned console-link wrapper from `InstanceDetail.tsx`
  - keep console target resolution, manual-login messaging, and error reporting in the shared console handler while eliminating redundant adapter noise in the page shell

## Root Cause

- After `release-2026-04-10-159`, the current dirty worktree still kept one trivial inline adapter in `InstanceDetail.tsx`:
  - `openExternalLink: (href) => openExternalUrl(href)`
- That wrapper did not add authority, translation, validation, or state:
  - `openExternalUrl` already matched the callback contract required by `buildOpenClawConsoleHandlers(...)`
  - the extra arrow adapter only kept unnecessary noise in the page hotspot
- Because no new helper surface was required, the optimal `160` move was a direct pass-through simplification guarded by the contract test rather than another helper extraction.

## Implemented Fix

- Updated `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so `buildOpenClawConsoleHandlers(...)` now receives:
  - `openExternalLink: openExternalUrl`
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - direct `openExternalUrl` pass-through in the page
  - the page to stop wrapping that host opener in a redundant arrow adapter
- This loop intentionally did not introduce a new helper module because the existing `openExternalUrl(...)` function already provided the correct contract shape.

## Boundary Decision

- `instanceLifecycleActionSupport.ts` continues to own:
  - console target resolution
  - manual-login info reporting
  - fallback error reporting
  - official-link execution orchestration
- `InstanceDetail.tsx` still explicitly owns:
  - the `detail` snapshot
  - the chosen host bridge function `openExternalUrl`
  - toast reporters
  - translation
- This loop only removes a redundant page adapter; it does not move or widen any lifecycle/console authority.

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only simplifies one page-side host callback binding.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1072` lines / `40274` bytes

Relative to the immediately prior `1072` page baseline from `release-2026-04-10-159`, the fresh current dirty worktree still re-measures `InstanceDetail.tsx` at `1072`. This loop records a verified contract simplification for the console-link binding while showing that the current hotspot line count is unchanged and remains the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1072`
  - `instanceDetailDeleteSupport.ts`: `23`
  - `instanceDetailManagedConfigMutationSupport.ts`: `53`
  - `instanceDetailLifecycleMutationSupport.ts`: `23`
  - `instanceDetailManagedChannelMutationSupport.ts`: `23`
  - `instanceDetailAgentMutationSupport.ts`: `25`
  - `instanceDetailAgentSkillMutationSupport.ts`: `23`
  - `instanceDetailProviderCatalogMutationSupport.ts`: `45`
  - `instanceDetailConsoleErrorSupport.ts`: `23`
  - `instanceDetailReloadSupport.ts`: `31`
  - `instanceDetailSectionAvailabilitySupport.ts`: `35`
  - `instanceDetailNavigationSupport.ts`: `43`
  - `instanceLifecycleActionSupport.ts`: `166`
  - `instanceWorkbenchServiceCore.ts`: `1135`
  - `instanceServiceCore.ts`: `1432`
- Fresh build evidence:
  - `InstanceDetail-C4lYz_CB.js`: `176.22 kB`
  - `InstanceConfigWorkbenchPanel-B8dWc4tM.js`: `63.33 kB`
  - `InstanceDetailFilesSection-CQ4qv1OQ.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still wrapped `openExternalUrl` in a redundant arrow adapter instead of passing it through directly
- GREEN:
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/claw-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version
  - `pnpm.cmd build` completed successfully in this loop without new functional warnings

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining trivial console-link adapter noise in the page shell, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1072`-line `InstanceDetail.tsx` baseline before selecting `161`.
- Favor only wrappers or binder noise that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be removed or extracted with focused contract coverage
- Prefer the next smallest page hotspot simplification that preserves existing page authority boundaries.

