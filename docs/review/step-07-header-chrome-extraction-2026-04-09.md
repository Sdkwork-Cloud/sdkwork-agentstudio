# Step 07 Header Chrome Extraction - 2026-04-09

## Scope

- Step: `07`
- Wave: `B`
- Checkpoint focus: `CP07-3`
- Current loop goal:
  - continue shrinking `InstanceDetail.tsx` after the lower workbench chrome extraction
  - move the remaining top header / action chrome into a dedicated presentational boundary without moving page-owned mutation authority
  - re-run fresh verification on the current worktree and keep the unrelated repo-wide lint blocker called out explicitly

## Root Cause

- After the lower workbench chrome moved into `InstanceDetailWorkbenchChrome.tsx`, the next high-yield page-local pure cluster was still the top hero / action chrome:
  - instance name and badges
  - runtime badge and meta row
  - instance-level header action buttons
- This cluster still lived inline in `InstanceDetail.tsx` even though it owned no truth-source routing and no authority-bearing write logic beyond invoking page-provided handlers.

## Implemented Extraction

- Added `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailHeader.tsx` to own:
  - status and runtime badges
  - uptime / type / version chrome
  - instance-level action buttons for:
    - set active
    - open OpenClaw console
    - restart
    - stop
    - start
    - uninstall
- Added `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailHeader.test.tsx` to pin the new header render contract.
- Rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` to render `InstanceDetailHeader` and pass page-owned handlers through props.
- Updated `scripts/sdkwork-instances-contract.test.ts` so:
  - header destructive-action evidence follows the new page -> header boundary
  - lifecycle gating evidence follows the new page -> header boundary instead of assuming the JSX branch must stay in the page file forever

## Boundary Decision

- `InstanceDetailHeader.tsx` owns only header presentation and action-button shell composition.
- `InstanceDetail.tsx` still owns:
  - navigation
  - all handlers
  - all `instanceService.*` and `agentSkillManagementService.*` writes
  - all `toast` / `loadWorkbench(...)` side effects
  - all truth-source selection and readonly gating decisions
- No transport, Provider Center managed classification, Local Proxy routing, or desktop runtime/plugin authority moved in this loop.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
- `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`

These sources still keep OpenClaw authority classification, provider workspace semantics, and desktop runtime boundaries outside the extracted header chrome.

## Fresh Measurements

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`: `1981`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailHeader.tsx`: `159`
- `packages/sdkwork-clawstudio-instances/src/components/InstanceDetailWorkbenchChrome.tsx`: `159`
- `packages/sdkwork-clawstudio-instances/src/components/instanceDetailWorkbenchPresentation.ts`: `273`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `1032`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1274`

Relative to the immediately previous `2073`-line page baseline from the same day, this loop reduces `InstanceDetail.tsx` again to `1981`.

## Verification

- RED:
  - `pnpm exec tsx packages/sdkwork-clawstudio-instances/src/components/InstanceDetailHeader.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - both initially failed because the new header component and the updated contract boundary did not exist yet
- GREEN:
  - `pnpm exec tsx packages/sdkwork-clawstudio-instances/src/components/InstanceDetailHeader.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
- YELLOW:

## Closure Status

- `CP07-1`: green
- `CP07-2`: green
- `CP07-3`: still open
- `CP07-4`: pending final closure writeback

This loop improves the page/component split again, but Step 07 still is not closed.

## Next Frontier

- Continue page-side decomposition in `InstanceDetail.tsx`, now prioritizing the remaining large state/prop orchestration clusters rather than the already-extracted visual chrome.
