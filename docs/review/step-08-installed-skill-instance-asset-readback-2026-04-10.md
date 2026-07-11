# Step 08 Installed Skill Instance Asset Readback - 2026-04-10

## Scope

- Step: `08`
- Wave: `B`
- Checkpoint focus:
  - `CP08-3`
  - `CP08-4`
- Current loop goal:
  - preserve installed-skill instance-asset metadata on the Market/My Skills readback path
  - freeze the first Step 08 review, architecture, and release evidence for installed-skill readback
  - keep Step 08 explicitly open until catalog-side compatibility semantics stop being static copy

## Root Cause

- `Step 08` requires ecosystem assets to behave as instance-centered runtime assets, not as detached catalog cards.
- Before this loop, `mySkillService` flattened installed skills into generic `Skill` records and dropped the instance-asset metadata already present in the workbench readback, including:
  - `source`
  - `scope`
  - `disabled`
  - `blockedByAllowlist`
  - `eligible`
  - `bundled`
  - `filePath`
  - `baseDir`
  - missing requirement counts
- That meant Market/My Skills could still uninstall or disable a skill, but could not read back the same installed-skill truth already projected from the OpenClaw workbench.
- Catalog compatibility text in `SkillDetail` / `SkillPackDetail` is still static, so the safest Step 08 move was to freeze real installed-skill readback semantics first instead of fabricating unsupported catalog metadata.

## Implemented Fix

- Extended `@sdkwork/agentstudio-pc-types` `Skill` with optional `instanceAsset` metadata plus explicit:
  - `SkillInstanceAssetScope`
  - `SkillInstanceAssetStatus`
  - `SkillInstanceAssetCompatibility`
  - `SkillInstanceAssetMetadata`
- Updated `packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.ts` so installed skills now preserve:
  - `source`
  - `scope`
  - `status`
  - `compatibility`
  - `bundled`
  - optional `filePath`
  - optional `baseDir`
  - `missingRequirementCount`
- Froze compatibility derivation to the real installed-skill state:
  - `blocked` when `blockedByAllowlist === true` or `eligible === false`
  - `attention` when missing requirements are present
  - `compatible` otherwise
- Froze status derivation to the real installed-skill state:
  - `blocked` when blocked
  - `disabled` when `disabled === true`
  - `enabled` otherwise
- Preserved uninstall authority instead of moving mutation logic into Market:
  - workspace-scoped skills still route through `agentSkillManagementService.removeSkill`
  - non-workspace skills still route through `agentSkillManagementService.setSkillEnabled`
- Added direct helper coverage and contract enforcement in:
  - `packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.test.ts`
  - `scripts/sdkwork-market-contract.test.ts`

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

These checks confirm the surrounding Step 08 authority remains stable:

- `marketService.ts` still installs ClawHub skills into the resolved default OpenClaw agent workspace.
- `agentInstallService.ts` still treats writable OpenClaw config paths and workspaces as the installation authority.
- `channelService.ts` still keeps channel read/write behavior on the existing config/workbench dual path instead of introducing a second control plane.
- `openClawManagementCapabilities.ts` and `openClawProviderWorkspacePresentation.ts` still gate managed OpenClaw workspaces by writable config-route evidence.
- `webStudio.ts` / `webStudio.test.ts`, `local_ai_proxy.rs`, and `plugins/mod.rs` remain unchanged by this loop and continue to define the browser-backed workbench/runtime/plugin baseline around the Step 08 surface.

## Fresh Evidence

- Installed-skill readback now preserves instance-asset metadata from the workbench path instead of dropping it at the Market boundary.
- The authoritative readback source for this loop is the agent workbench projection of `gateway.skills.status`, not static catalog copy.
- Current build evidence from this loop:
  - `dist/assets/mySkillService-p0AIXBiH.js`: `8.19 kB`
  - `dist/assets/Market-mpdJXbDt.js`: `30.41 kB`
  - `dist/assets/SkillDetail-BjMyzjzz.js`: `23.63 kB`
  - `dist/assets/InstanceDetail-BDH_l0ui.js`: `176.52 kB`

## Verification

- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-market-contract.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-market/src/services/marketService.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-channels/src/services/channelService.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-agent/src/services/agentInstallService.test.ts`
  - `pnpm.cmd check:sdkwork-market`
  - `pnpm.cmd check:sdkwork-channels`
  - `pnpm.cmd check:sdkwork-agent`
  - `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `packages/sdkwork-agentstudio-pc-channels/src/services/channelService.test.ts` still prints the existing non-blocking supplemental-package warning for `@buape/carbon@0.0.0-beta-20260327000044`
  - `pnpm.cmd build` still prints the non-blocking Rolldown plugin timing warning while exiting successfully

## Closure Status

- `CP08-1`: yellow
  - install/uninstall service checks stay green, but this loop did not attempt the full lifecycle acceptance writeback
- `CP08-2`: yellow
  - channels checks stay green, but this loop did not close the channels acceptance lane
- `CP08-3`: yellow
  - installed-skill instance-asset readback is now frozen on the real workbench truth path
  - catalog-side compatibility and provenance still are not projected from a real runtime truth source
- `CP08-4`: yellow
  - Market/My Skills semantics improved, but the three-surface ecosystem readback is not yet proven end-to-end
- `Step 08`: open

This loop materially advances `CP08-3`, but it does not close Step 08.

## Next Frontier

- Push the next Step 08 loop into the remaining real-runtime gaps instead of static catalog copy:
  - either project real compatibility/provenance into catalog/detail surfaces
  - or formalize the remaining three-surface convergence evidence across Market, My Skills, and Instance Detail
