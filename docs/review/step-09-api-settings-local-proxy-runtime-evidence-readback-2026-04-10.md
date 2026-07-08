# Step 09 ApiSettings Local Proxy Runtime Evidence Readback - 2026-04-10

## Scope

- Step: `09`
- Wave: `C`
- Checkpoint focus:
  - `CP09-2`
  - `CP09-4`
- Current loop goal:
  - surface the existing local AI proxy runtime evidence in `ApiSettings`
  - keep the logs workspace aligned with the same runtime truth already used by `Kernel Center`
  - preserve a second support-facing readback surface for artifact paths without inventing any UI-side proxy state

## Root Cause

- The desktop/runtime truth path already exposed:
  - `lifecycle`
  - `observabilityDbPath`
  - `snapshotPath`
  - `logPath`
- `packages/sdkwork-clawstudio-settings/src/services/localAiProxyLogsService.ts` only exposed:
  - request logs
  - message logs
  - message capture settings
- `packages/sdkwork-clawstudio-settings/src/ApiSettings.tsx` therefore showed pagination, log records, and the capture toggle, but it still could not read back the active proxy lifecycle or artifact paths from the local logs workspace.

## Implemented Fix

- Added `getRuntimeSummary()` to `packages/sdkwork-clawstudio-settings/src/services/localAiProxyLogsService.ts`.
  - it reads `kernelPlatformService.getInfo()?.localAiProxy`
  - it forwards runtime truth only
  - it normalizes blank values to null/unavailable fallbacks without fabricating new facts
- Updated `packages/sdkwork-clawstudio-settings/src/ApiSettings.tsx` so the request/message log shell now:
  - loads runtime summary whenever the active logs workspace is entered
  - refreshes runtime summary together with request/message log reloads
  - renders a compact `data-slot="api-log-runtime-summary"` strip for:
    - proxy lifecycle
    - log path
    - snapshot path
    - observability DB path
- Preserved the existing mutable boundary:
  - request/message logs remain read-only evidence
  - message capture toggle remains the only control surface in this workspace
- Fixed the stale package-barrel expectation in `packages/sdkwork-clawstudio-settings/src/apiSettingsShell.test.ts`.
- Added localized runtime evidence copy in:
  - `packages/sdkwork-clawstudio-i18n/src/locales/en/apiLogs.json`
  - `packages/sdkwork-clawstudio-i18n/src/locales/zh/apiLogs.json`
  - `packages/sdkwork-clawstudio-i18n/src/locales/en.json`
  - `packages/sdkwork-clawstudio-i18n/src/locales/zh.json`

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts`
- `packages/sdkwork-clawstudio-types/src/index.ts`
- `packages/sdkwork-clawstudio-settings/src/services/kernelCenterService.ts`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`

The governing fact in this loop is unchanged: `ApiSettings` may only read runtime evidence that is already published by the desktop/runtime contract. It must not infer lifecycle from logs, synthesize paths from packaging assumptions, or rebuild proxy state in the UI.

## Fresh Evidence

- Updated build outputs in this loop:
  - `dist/assets/ApiSettings-B3Q3QgRd.js`: `10.50 kB`
  - `dist/assets/Settings-BQ-37wVc.js`: `16.25 kB`

## Verification

- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-settings/src/services/localAiProxyLogsService.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-settings/src/apiSettingsShell.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-settings-contract.test.ts`
  - `node scripts/run-sdkwork-settings-check.mjs`
  - `pnpm.cmd check:sdkwork-settings`
  - `pnpm.cmd --filter @sdkwork/clawstudio-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd check:sdkwork-settings` still prints the non-blocking supplemental-package warning for `@buape/carbon@0.0.0-beta-20260327000044`
  - `pnpm.cmd build` still prints the non-blocking Rolldown plugin timing warning while exiting successfully
  - PowerShell profile loading warnings still print before command output in this environment and remain unrelated to repository correctness

## Closure Status

- `CP09-2`: yellow
  - `Kernel Center` and `ApiSettings` now both read back local proxy runtime evidence from the shared runtime truth chain
  - broader cross-surface convergence beyond the settings workspace is still incomplete
- `CP09-4`: yellow
  - support-facing readback now includes proxy lifecycle plus artifact paths in both the kernel and logs surfaces
  - packaged smoke and automated support playbooks are still incomplete
- `Step 09`: open

This loop closes a second real Step 09 observability gap, but it does not close Step 09 as a whole.

## Next Frontier

- Either freeze the packaged smoke/support evidence chain for the same proxy/runtime artifacts
- Or advance the next Step 09 slice around runtime repair flows, packaged smoke proof, or support artifact verification
