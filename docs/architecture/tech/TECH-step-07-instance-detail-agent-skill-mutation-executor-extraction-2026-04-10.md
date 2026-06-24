> Migrated from `docs/review/step-07-instance-detail-agent-skill-mutation-executor-extraction-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Instance Detail Agent Skill Mutation Executor Extraction - 2026-04-10

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining page-owned agent-skill mutation executor wrappers out of `InstanceDetail.tsx`
  - keep mutation planning, pending-state wiring, reload behavior, and user-facing feedback page-owned while centralizing the repeated `agentSkillManagementService` adapter family

## Root Cause

- After `release-2026-04-10-153`, the current dirty worktree still kept one coherent service-binding family in `InstanceDetail.tsx`:
  - `executeInstall`
  - `executeToggle`
  - `executeRemove`
- Those wrappers did not own mutation request construction, pending-state management, reload behavior, or toast/error reporting:
  - they only adapted the page-owned `agentSkillManagementService` surface into the `buildOpenClawAgentSkillMutationHandlers(...)` callback contract
  - the actual agent-skill mutation orchestration still lived in `openClawAgentSkillMutationSupport.ts`
- That made them a good `154` candidate: the wrapper family was repetitive, page-owned, and stable enough to extract without widening the agent-skill mutation boundary.

## Implemented Fix

- Added `packages/sdkwork-claw-instances/src/services/instanceDetailAgentSkillMutationSupport.ts`.
- Added `createInstanceDetailAgentSkillMutationExecutors(...)` so the shared helper now owns only:
  - skill install executor binding
  - skill enable or disable executor binding
  - skill remove executor binding
- Added focused direct coverage in `packages/sdkwork-claw-instances/src/services/instanceDetailAgentSkillMutationSupport.test.ts`.
- Rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `agentSkillMutationExecutors` once through `createInstanceDetailAgentSkillMutationExecutors({ agentSkillManagementService })`
  - spreads that executor bundle into `buildOpenClawAgentSkillMutationHandlers(...)`
  - stops keeping three inline `agentSkillManagementService.*` executor wrappers in the page shell
- Exported the new helper from `packages/sdkwork-claw-instances/src/services/index.ts`.
- Updated `scripts/run-sdkwork-instances-check.mjs` so the new helper test runs inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `createInstanceDetailAgentSkillMutationExecutors(...)`
  - the handler builder to consume `...agentSkillMutationExecutors`
  - the page to stop keeping inline agent-skill executor wrappers
  - the shared helper to stay free of toast, navigation, and reload authority

## Boundary Decision

- `instanceDetailAgentSkillMutationSupport.ts` now owns only shared service-executor composition for the agent-skill mutation handler contract.
- `InstanceDetail.tsx` still explicitly owns:
  - the real `agentSkillManagementService` dependency
  - the choice to expose agent-skill executors to the mutation handler builder
  - all mutation request construction, pending-state wiring, reload behavior, toast reporting, dialog state, truth-source routing, and lifecycle control
- The helper still does not own:
  - mutation planning
  - pending-state management
  - reload behavior
  - navigation
  - user-facing toast feedback

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

These sources remain the authority for studio-backed workbench truth, runtime persistence, provider-center projection, Local Proxy routing, ecosystem/runtime ownership, and desktop plugin/runtime registration. This loop only centralizes the page-side agent-skill executor binding layer.

## Fresh Measurements

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`: `1006` lines / `40621` bytes
- `packages/sdkwork-claw-instances/src/services/instanceDetailAgentSkillMutationSupport.ts`: `19` lines / `957` bytes
- `packages/sdkwork-claw-instances/src/services/instanceDetailAgentSkillMutationSupport.test.ts`: `50` lines / `1813` bytes

Relative to the immediately prior `1004` page baseline from `release-2026-04-10-153`, the fresh current dirty worktree now re-measures `InstanceDetail.tsx` at `1006`. This loop records a verified boundary improvement for the shared agent-skill executor family while also documenting that the broader page baseline has shifted again in the current dirty worktree and is now the operative truth for subsequent loops.

- Fresh hotspot profile:
  - `InstanceDetail.tsx`: `1006`
  - `instanceDetailAgentSkillMutationSupport.ts`: `19`
  - `instanceDetailProviderCatalogMutationSupport.ts`: `41`
  - `instanceDetailConsoleErrorSupport.ts`: `20`
  - `instanceDetailReloadSupport.ts`: `26`
  - `instanceDetailSectionAvailabilitySupport.ts`: `30`
  - `instanceDetailNavigationSupport.ts`: `37`
  - `instanceLifecycleActionSupport.ts`: `150`
  - `instanceWorkbenchServiceCore.ts`: `1032`
  - `instanceServiceCore.ts`: `1274`
- Fresh build evidence:
  - `InstanceDetail-DU8ILXUB.js`: `176.60 kB`
  - `InstanceConfigWorkbenchPanel-C9gscZG4.js`: `63.33 kB`
  - `InstanceDetailFilesSection-DS0BlFgb.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceDetailAgentSkillMutationSupport.test.ts`
  - failed first because `instanceDetailAgentSkillMutationSupport.ts` did not yet exist
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline agent-skill executor wrappers
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceDetailAgentSkillMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/claw-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version
  - `pnpm.cmd build` prints a non-blocking Rolldown plugin timing warning; the build still exits successfully

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the remaining page-owned agent-skill executor wrapper family, but Step 07 is still not closed.

## Next Frontier

- Re-scan the fresh `1006`-line `InstanceDetail.tsx` baseline before selecting `155`.
- Favor only wrappers that still:
  - pre-bind page-owned authority without owning the real runtime action
  - can be covered with focused direct helper tests plus contract enforcement
- Prefer the next smallest page-owned service-adapter family instead of widening this helper beyond agent-skill executor binding.

