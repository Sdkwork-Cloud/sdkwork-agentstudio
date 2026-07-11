# Step 08 Installed Skill Runtime UI Readback - 2026-04-10

## Scope

- Step: `08`
- Wave: `B`
- Checkpoint focus:
  - `CP08-3`
  - `CP08-4`
- Current loop goal:
  - surface the already-preserved installed-skill runtime metadata in the Market UI
  - stop showing a purely static compatibility line on installed skill details when real runtime truth is available
  - keep pack-level compatibility static until a real aggregated truth source exists

## Root Cause

- After the previous Step 08 loop, `mySkillService` already preserved `instanceAsset` metadata from the workbench truth path.
- The Market UI still ignored that data:
  - My Skills cards always showed a generic `Installed` pill
  - `SkillDetail` still rendered the static `OpenClaw gateway 1.0+` compatibility copy even when the active instance had already reported the skill as disabled, blocked, or missing requirements
- That left the service layer aligned while the user-facing readback still masked the real runtime state.

## Implemented Fix

- Added `packages/sdkwork-agentstudio-pc-market/src/pages/marketInstalledSkillPresentation.ts` as a focused presentation helper for installed-skill runtime metadata.
- Added RED/GREEN coverage in `packages/sdkwork-agentstudio-pc-market/src/pages/marketInstalledSkillPresentation.test.ts` for:
  - missing metadata fallback
  - disabled skills with missing requirements
  - enabled skills that still need attention
- Updated `packages/sdkwork-agentstudio-pc-market/src/pages/Market.tsx` so My Skills cards now show runtime-aware status labels derived from `instanceAsset`.
- Updated `packages/sdkwork-agentstudio-pc-market/src/pages/SkillDetail.tsx` so installed skills now read back:
  - compatibility
  - runtime status
  - source
  - scope
  - missing requirement count
- Added localized copy in:
  - `packages/sdkwork-agentstudio-pc-i18n/src/locales/en.json`
  - `packages/sdkwork-agentstudio-pc-i18n/src/locales/zh.json`
- Explicit non-goal in this loop:
  - `SkillPackDetail` still does not fabricate pack-level compatibility from static catalog data

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

The governing fact for this loop is unchanged: UI readback must follow installed-skill runtime truth from the agent workbench projection of `gateway.skills.status`, not static catalog copy.

## Fresh Evidence

- New Market presentation helper bundle:
  - `dist/assets/marketInstalledSkillPresentation-CCh3j-9g.js`: `1.97 kB`
- Updated UI build outputs in this loop:
  - `dist/assets/Market-Btpvg4g0.js`: `30.48 kB`
  - `dist/assets/SkillDetail-BMmOzNBQ.js`: `24.06 kB`
  - `dist/assets/mySkillService-BzWoSJzw.js`: `8.19 kB`

## Verification

- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-market/src/pages/marketInstalledSkillPresentation.test.ts`
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.test.ts`
  - `pnpm.cmd check:sdkwork-market`
  - `pnpm.cmd --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd build` still prints the non-blocking Rolldown plugin timing warning while exiting successfully

## Closure Status

- `CP08-3`: yellow
  - installed-skill runtime metadata is now preserved and surfaced in the Market UI
  - broader workbench-side skill metadata presentation is still not frozen
- `CP08-4`: yellow
  - My Skills and Skill Detail now consume the same installed-skill truth path
  - Skill Pack detail and broader multi-surface convergence are still incomplete
- `Step 08`: open

This loop improves user-facing readback consistency, but Step 08 remains open.

## Next Frontier

- Either project the same runtime metadata into the Instance Detail skills surface
- Or define a truthful aggregation rule for pack-level installed-skill summaries without fabricating compatibility data
