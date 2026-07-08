> Migrated from `docs/review/step-09-kernel-center-local-ai-proxy-observability-readback-2026-04-10.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 09 Kernel Center Local AI Proxy Observability Readback - 2026-04-10

## Scope

- Step: `09`
- Wave: `C`
- Checkpoint focus:
  - `CP09-2`
  - `CP09-4`
- Current loop goal:
  - surface the existing local AI proxy observability truth in `Kernel Center`
  - keep runtime facts sourced from the desktop runtime contract instead of rebuilding proxy status in the UI
  - freeze a support-facing readback path that later Step 10 and Step 11 work can rely on

## Root Cause

- The desktop/runtime truth path already exposed:
  - `routeMetrics`
  - `routeTests`
  - `messageCaptureEnabled`
  - `observabilityDbPath`
- `packages/sdkwork-clawstudio-settings/src/services/kernelCenterService.ts` dropped those fields when it shaped `dashboard.localAiProxy`.
- `packages/sdkwork-clawstudio-settings/src/KernelCenter.tsx` therefore only showed lifecycle, URLs, ports, paths, and last error, which meant support and release-readiness work still could not read back route-level proxy observability from the kernel surface.

## Implemented Fix

- Extended `KernelCenterDashboard.localAiProxy` so the dashboard model now carries:
  - `routeMetrics`
  - `routeTests`
  - `messageCaptureEnabled`
  - `observabilityDbPath`
- Added focused RED/GREEN coverage in:
  - `packages/sdkwork-clawstudio-settings/src/services/kernelCenterService.test.ts`
  - `packages/sdkwork-clawstudio-settings/src/kernelCenterView.test.ts`
  - `scripts/sdkwork-settings-contract.test.ts`
- Added pure UI formatting helpers in `packages/sdkwork-clawstudio-settings/src/kernelCenterView.ts` for stable route metric/test summaries.
- Updated `packages/sdkwork-clawstudio-settings/src/KernelCenter.tsx` so `Kernel Center -> Local AI Proxy` now reads back:
  - message capture state
  - observability database path
  - route metric record count
  - route test record count
  - per-route metric summaries
  - per-route latest test summaries
- Added localized copy in:
  - `packages/sdkwork-clawstudio-i18n/src/locales/en/settings.json`
  - `packages/sdkwork-clawstudio-i18n/src/locales/en.json`
  - `packages/sdkwork-clawstudio-i18n/src/locales/zh/settings.json`
  - `packages/sdkwork-clawstudio-i18n/src/locales/zh.json`

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts`
- `packages/sdkwork-clawstudio-types/src/index.ts`
- `packages/sdkwork-clawstudio-settings/src/services/providerConfigCenterService.ts`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/studio.rs`

The governing fact in this loop is unchanged: Kernel Center may only read back local proxy observability already produced by the runtime truth source. It must not invent route health, test status, or log state in the UI layer.

## Fresh Evidence

- Updated build outputs in this loop:
  - `dist/assets/KernelCenter-ueO_eY6A.js`: `38.09 kB`
  - `dist/assets/kernelCenterView-DjkkkLS0.js`: `9.23 kB`
  - `dist/assets/Settings-D0q8711N.js`: `16.25 kB`

## Verification

- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-settings/src/services/kernelCenterService.test.ts`
  - `node --experimental-strip-types packages/sdkwork-clawstudio-settings/src/kernelCenterView.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-settings-contract.test.ts`
  - `pnpm.cmd check:sdkwork-settings`
  - `pnpm.cmd --filter @sdkwork/clawstudio-web lint`
  - `pnpm.cmd build`
- YELLOW:
  - `pnpm.cmd build` still prints the non-blocking Rolldown plugin timing warning while exiting successfully
  - PowerShell profile loading warnings still print before command output in this environment and remain unrelated to repository correctness

## Closure Status

- `CP09-2`: yellow
  - Kernel Center now exposes existing local proxy observability truth from the runtime contract
  - broader cross-surface convergence between Chat, Provider Center, and Kernel Center is still incomplete
- `CP09-4`: yellow
  - support-facing readback now includes route metrics/tests plus observability artifact paths
  - packaged smoke and automated support playbooks are still incomplete
- `Step 09`: open

This loop closes one real Step 09 observability gap, but it does not close Step 09 as a whole.

## Next Frontier

- Either converge the same route observability summaries into additional support-facing surfaces without duplicating truth
- Or move to the next Step 09 slice around packaged smoke, runtime repair flows, or support artifact verification

