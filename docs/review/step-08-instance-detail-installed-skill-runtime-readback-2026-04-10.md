# Step 08 Instance Detail Installed Skill Runtime Readback - 2026-04-10

## Scope

- Step: `08`
- Wave: `B`
- Checkpoint focus:
  - `CP08-3`
  - `CP08-4`
- Current loop goal:
  - preserve installed-skill runtime metadata all the way into the instance workbench snapshot
  - surface the same runtime truth in `Instance Detail -> Skills`
  - close the remaining three-surface readback gap across `My Skills`, `Skill Detail`, and `Instance Detail`

## Root Cause

- The prior Step 08 loops already preserved installed-skill runtime metadata in `mySkillService`, and the Market UI consumed it.
- The instance workbench skill projection still dropped that runtime truth when `instanceWorkbenchServiceCore` shaped `gateway.skills.status` through `buildOpenClawSkills`.
- As a result, `Instance Detail` rendered skill catalog facts only:
  - name
  - category
  - description
  - version/downloads/rating
- That kept the workbench-side readback behind the Market-side readback, which left `CP08-4` incomplete.

## Implemented Fix

- Extended `StudioWorkbenchSkillRecord` with optional `instanceAsset` metadata so the workbench type chain can preserve runtime truth without widening unrelated snapshot surfaces.
- Updated `packages/sdkwork-agentstudio-pc-instances/src/services/openClawSkillWorkbenchSupport.ts` so `buildOpenClawSkills()` now preserves:
  - `source`
  - `scope`
  - `status`
  - `compatibility`
  - `bundled`
  - `filePath`
  - `baseDir`
  - `missingRequirementCount`
- Added direct RED/GREEN coverage in:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawSkillWorkbenchSupport.test.ts`
  - `packages/sdkwork-agentstudio-pc-instances/src/components/instanceInstalledSkillPresentation.test.ts`
- Added `packages/sdkwork-agentstudio-pc-instances/src/components/instanceInstalledSkillPresentation.ts` as the focused presentation helper for instance-detail installed-skill runtime metadata.
- Updated `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSkillsSection.tsx` so the skills surface now reads back:
  - compatibility
  - runtime status
  - source
  - scope
  - missing requirements
- Added localized instance-detail runtime copy in:
  - `packages/sdkwork-agentstudio-pc-i18n/src/locales/en.json`
  - `packages/sdkwork-agentstudio-pc-i18n/src/locales/zh.json`

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

No transport or bootstrap authority changed in this loop. The preserved truth path stays:

- `gateway.skills.status`
- `buildOpenClawSkills()`
- `InstanceWorkbenchSnapshot.skills[].instanceAsset`
- `InstanceDetailSkillsSection`

The existing install/uninstall and channel-management authorities remain unchanged.

## Fresh Evidence

- Direct runtime metadata preservation:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawSkillWorkbenchSupport.test.ts`
- Direct instance-detail presentation coverage:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/components/instanceInstalledSkillPresentation.test.ts`
- Existing Market-side installed-skill truth still green:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-market/src/pages/marketInstalledSkillPresentation.test.ts`
- Cross-package contract gates:
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd check:sdkwork-market`
  - `pnpm.cmd check:sdkwork-channels`
  - `pnpm.cmd check:sdkwork-agent`
- Final compile/build evidence:
  - `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm.cmd build`

Relevant build outputs from this loop:

- `dist/assets/InstanceDetail-BAoqBeqa.js`: `179.73 kB`
- `dist/assets/mySkillService-Dxin63hQ.js`: `8.19 kB`
- `dist/assets/Market-DFaFWtgV.js`: `30.48 kB`
- `dist/assets/SkillDetail-D5EHwygp.js`: `24.06 kB`
- `dist/assets/marketInstalledSkillPresentation-CCh3j-9g.js`: `1.97 kB`

## Verification

- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawSkillWorkbenchSupport.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/components/instanceInstalledSkillPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-market/src/pages/marketInstalledSkillPresentation.test.ts`
  - `pnpm.cmd check:sdkwork-instances`
  - `pnpm.cmd check:sdkwork-market`
  - `pnpm.cmd check:sdkwork-channels`
  - `pnpm.cmd check:sdkwork-agent`
  - `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd build` still prints the non-blocking Rolldown plugin timing warning while exiting successfully
  - the PowerShell profile policy warning still prints before command output, but exit codes remain green and the warning is unrelated to repository behavior

## Closure Status

- `CP08-1`: green
  - skill install/uninstall authority remains instance-centered and default-agent-scoped
  - Market and workbench removal semantics remain aligned with `agentSkillManagementService`
- `CP08-2`: green
  - channel management contract remains green through the instance-aware channels bridge
- `CP08-3`: green
  - installed-skill runtime metadata is now preserved in both Market and instance workbench readback
- `CP08-4`: green
  - `My Skills`, `Skill Detail`, and `Instance Detail` now consume the same installed-skill runtime truth path
- `Step 08`: closed

Step 08 is now closed at the current repository state. The remaining pack-level compatibility question stays explicitly outside this step because the repo still lacks a truthful aggregated pack runtime source and this loop did not fabricate one.
