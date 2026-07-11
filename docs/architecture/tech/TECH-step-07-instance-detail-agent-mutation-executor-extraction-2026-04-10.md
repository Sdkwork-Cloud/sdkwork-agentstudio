> Migrated from `docs/review/step-07-instance-detail-agent-mutation-executor-extraction-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Agent Mutation Executor Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned agent mutation executors out of `InstanceDetail.tsx`
  - keep mutation planning, dialog state, pending-state wiring, reload behavior, and user-facing feedback page-owned while centralizing the repeated `instanceService` adapter family

## Root Cause

- After `release-2026-04-10-154`, the current dirty worktree still kept one coherent `instanceService` binding family in `InstanceDetail.tsx`:
  - `executeCreate`
  - `executeUpdate`
  - `executeDelete`
- Those wrappers did not own mutation request construction, dialog state, pending-state management, reload behavior, or toast/error reporting:
  - they only adapted the page-owned `instanceService` surface into the `createOpenClawAgentMutationRunner(...)` callback contract
  - the actual agent mutation orchestration still lived in `openClawAgentMutationSupport.ts`
- That made them a good `155` candidate: the wrapper family was repetitive, page-owned, and stable enough to extract without widening the OpenClaw agent mutation boundary.

## Implemented Fix

- Added `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationSupport.ts`.
- Added `createInstanceDetailAgentMutationExecutors(...)` so the shared helper now owns only:
  - agent create executor binding
  - agent update executor binding
  - agent delete executor binding
- Added focused direct coverage in `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationSupport.test.ts`.
- Rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `agentMutationExecutors` once through `createInstanceDetailAgentMutationExecutors({ instanceService })`
  - spreads that executor bundle into `createOpenClawAgentMutationRunner(...)`
  - stops keeping three inline `instanceService.*OpenClawAgent(...)` executor wrappers in the page shell
- Exported the new helper from `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailAgentMutationExecutors(...)`
  - the agent mutation runner to consume `...agentMutationExecutors`
  - the page to stop keeping inline agent executor wrappers
  - the shared helper to stay free of toast, navigation, and reload authority

## Boundary Decision

- `instanceDetailAgentMutationSupport.ts` now owns only shared service-executor composition for the agent mutation runner contract.
- `InstanceDetail.tsx` still explicitly owns:
  - the real `instanceService` dependency
  - the choice to expose agent executors to the runner
  - all mutation request construction, dialog-state wiring, pending-state wiring, reload behavior, toast reporting, truth-source routing, and lifecycle control
- The helper still does not own:
  - mutation planning
  - dialog visibility or selected-id state
  - pending-state management
  - reload behavior
  - navigation
  - user-facing toast feedback

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side agent executor binding layer.

## Fresh Measurements

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`: `1062` lines / `40391` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationSupport.ts`: `24` lines / `1051` bytes
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationSupport.test.ts`: `55` lines / `1855` bytes

Relative to the immediately prior `1006` page baseline from `release-2026-04-10-154`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1062`. This loop records a verified boundary improvement for the shared agent executor family while also documenting that the broader page baseline has shifted again in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1062`
  - `instanceDetailAgentMutationSupport.ts`: `24`
  - `instanceDetailAgentSkillMutationSupport.ts`: `22`
  - `instanceDetailProviderCatalogMutationSupport.ts`: `44`
  - `instanceDetailConsoleErrorSupport.ts`: `22`
  - `instanceDetailReloadSupport.ts`: `30`
  - `instanceDetailSectionAvailabilitySupport.ts`: `34`
  - `instanceDetailNavigationSupport.ts`: `42`
  - `instanceLifecycleActionSupport.ts`: `165`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- Fresh build evidence:
  - `InstanceDetail-C0XL-uCi.js`: `176.50 kB`
  - `InstanceConfigWorkbenchPanel-CUplMxGx.js`: `63.32 kB`
  - `InstanceDetailFilesSection-CT7_RDAK.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationSupport.test.ts`
  - failed first because `instanceDetailAgentMutationSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline agent executor wrappers
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceDetailAgentMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version
  - `pnpm.cmd build` prints a non-blocking Rolldown plugin timing warning; the build still exits successfully

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-owned agent executor wrapper family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1062`-line `InstanceDetail.tsx` baseline before selecting `156`.
- Favor only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Prefer the next smallest page-owned service-adapter family instead of widening this helper beyond agent executor binding.

