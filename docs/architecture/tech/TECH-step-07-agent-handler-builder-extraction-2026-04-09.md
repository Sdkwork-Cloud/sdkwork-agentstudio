> Migrated from `docs/review/step-07-agent-handler-builder-extraction-2026-04-09.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 07 Agent Handler Builder Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - move the remaining agent dialog launch and agent/skill mutation handler composition out of `InstanceDetail.tsx`
  - keep real `instanceService.*`, `agentSkillManagementService.*`, page-owned setters, and page-owned `toast.*` policy in the shell
  - centralize page-side handler assembly in the existing agent presentation and mutation support layers

## Root Cause

- After `release-2026-04-09-141`, `InstanceDetail.tsx` still kept one remaining agent handler cluster inline:
  - create-agent dialog launch
  - edit-agent dialog launch
  - save-agent dialog mutation bridge
  - delete-agent mutation bridge
  - install-skill mutation bridge
  - toggle-skill mutation bridge
  - remove-skill mutation bridge
- Those handlers were no longer owning transport or write-path rules directly:
  - dialog state factories already lived in `openClawAgentPresentation.ts`
  - save/delete request shaping and mutation running already lived in `openClawAgentMutationSupport.ts`
  - skill install/toggle/remove request shaping and mutation running already lived in `openClawAgentSkillMutationSupport.ts`
- The page still carried the repetitive “build request, skip or report validation, then delegate into the injected runner” orchestration instead of routing that last handler-composition layer through the same shared support modules.

## Implemented Fix

- Extended `packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.ts`.
- Added `buildOpenClawAgentDialogStateHandlers(...)` so the presentation helper now owns:
  - create dialog-state application through injected page setters
  - edit dialog-state application through injected page setters
- Extended `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.ts`.
- Added `buildOpenClawAgentMutationHandlers(...)` so the mutation helper now owns:
  - save-agent request construction and validation routing
  - delete-agent request routing
  - delegating the final request into the injected page-owned mutation runner
- Extended `packages/sdkwork-clawstudio-instances/src/services/openClawAgentSkillMutationSupport.ts`.
- Added `buildOpenClawAgentSkillMutationHandlers(...)` so the skill mutation helper now owns:
  - install-skill request routing
  - toggle-skill request routing
  - remove-skill request routing
  - delegating the final request into the injected page-owned skill mutation runner
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now:
  - builds `agentDialogStateHandlers`
  - builds `agentMutationHandlers`
  - builds `agentSkillMutationHandlers`
  - passes those handlers into `buildAgentSectionProps(...)`
- The page still injects the real authority:
  - `runAgentMutation` still owns the real `instanceService.createOpenClawAgent(...)`, `.updateOpenClawAgent(...)`, and `.deleteOpenClawAgent(...)` callbacks plus `toast.*` and `loadWorkbench(...)`
  - `runAgentSkillMutation` still owns the real `agentSkillManagementService.installSkill(...)`, `.setSkillEnabled(...)`, and `.removeSkill(...)` callbacks plus `toast.*` and `loadWorkbench(...)`
  - all page state containers and setters remain page-owned
- Expanded direct helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
- Updated `scripts/run-sdkwork-instances-check.mjs` so those three agent helper tests now run inside `pnpm.cmd check:sdkwork-instances`.
- Updated `scripts/sdkwork-instances-contract.test.ts` so the contract now requires:
  - the page to use `buildOpenClawAgentDialogStateHandlers(...)`
  - the page to use `buildOpenClawAgentMutationHandlers(...)`
  - the page to use `buildOpenClawAgentSkillMutationHandlers(...)`
  - the page to keep only injected runner and service authority
  - the shared helpers to stay free of direct `instanceService`, `agentSkillManagementService`, `toast`, and `loadWorkbench(...)` ownership
- Follow-up regression repaired in the same loop:
  - fresh web lint exposed two incorrect setter names in the page injection to `buildOpenClawAgentSkillMutationHandlers(...)`
  - the page was corrected to pass `setUpdatingAgentSkillKeys` and `setRemovingAgentSkillKeys`

## Boundary Decision

- `openClawAgentPresentation.ts` now owns only agent dialog handler composition:
  - create dialog-state application
  - edit dialog-state application
- `openClawAgentMutationSupport.ts` now owns only page-side agent mutation handler composition:
  - save/delete request routing
  - validation-error forwarding through injected page reporting
  - final delegation into the injected page-owned mutation runner
- `openClawAgentSkillMutationSupport.ts` now owns only page-side skill mutation handler composition:
  - install/toggle/remove request routing
  - final delegation into the injected page-owned skill mutation runner
- `InstanceDetail.tsx` still explicitly owns:
  - all page state containers and setters
  - the real `instanceService.*` and `agentSkillManagementService.*` execution callbacks
  - page-owned `toast.success(...)` / `toast.error(...)`
  - `loadWorkbench(...)`, truth-source routing, readonly gating, dialogs, navigation, and all write-path authority

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

These sources remain the authority for browser-backed OpenClaw workbench persistence, managed channel/config truth, default-agent skill install flows, managed-provider readonly routing, local proxy provider projection, and desktop plugin/runtime registration. This loop only centralizes page-side agent dialog and mutation handler composition around those already-authoritative runtime surfaces.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1160`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.ts`: `358`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.ts`: `187`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentSkillMutationSupport.ts`: `249`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately prior `1220` page baseline from `release-2026-04-09-141`, the current dirty worktree now re-measures `InstanceDetail.tsx` at `1160`. This loop records another verified page-side reduction while moving the remaining agent handler composition into existing shared support layers.

- Fresh build evidence:
  - `InstanceDetail-BJa_XrpF.js`: `177.64 kB`
  - `InstanceConfigWorkbenchPanel-DQEspCaN.js`: `63.32 kB`
  - `InstanceDetailFilesSection-CaTehgZh.js`: `2.38 kB`

## Verification

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.test.ts`
  - failed first because `openClawAgentPresentation.ts` did not yet export `buildOpenClawAgentDialogStateHandlers`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.test.ts`
  - failed first because `buildOpenClawAgentMutationHandlers` was not yet exported
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
  - failed first because `buildOpenClawAgentSkillMutationHandlers` was not yet exported
- FOLLOW-UP regression repaired in the same loop:
  - `pnpm.cmd --filter @sdkwork/clawstudio-web lint`
  - failed after the first page rewire because the skill handler builder injection used the wrong page setter names
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd --filter @sdkwork/clawstudio-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-instances` still prints the existing non-blocking warning about supplemental package `@buape/carbon@0.0.0-beta-20260327000044` using an unstable `<1.0.0` version

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop closes the next remaining agent handler-composition bridge, but Step 07 is still not closed.

## Next Frontier

- Continue shrinking `InstanceDetail.tsx` through the next remaining page-side orchestration hotspot after the agent dialog and mutation handler cluster.
- The most likely remaining candidates are:
  - lifecycle / console launch handler composition
  - managed-channel selection and draft-change bridging
  - the remaining small page-owned navigation and delete-confirmation wrappers

