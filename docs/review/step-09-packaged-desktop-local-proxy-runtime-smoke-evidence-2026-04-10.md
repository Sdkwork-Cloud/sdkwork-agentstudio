# Step 09 Packaged Desktop Local Proxy Runtime Smoke Evidence - 2026-04-10

## Scope

- Step: `09`
- Wave: `C`
- Checkpoint focus:
  - `CP09-3`
  - `CP09-4`
- Current loop goal:
  - carry local AI proxy runtime truth from packaged desktop startup into smoke evidence and release metadata
  - keep one truth source across desktop bootstrap, startup smoke, release finalization, and upgrade-smoke aggregation
  - stop treating proxy lifecycle and artifact paths as support-only UI readback that disappears at package/release time

## Root Cause

- Earlier Step 09 loops made the runtime truth readable in:
  - `Kernel Center`
  - `ApiSettings / Local Proxy Logs`
- Packaged desktop startup smoke still validated:
  - startup status
  - shell-mounted phase
  - readiness
  - built-in instance identity
  - gateway websocket dialability
- It did **not** require the packaged startup evidence to preserve the local proxy runtime artifact facts already published by `kernel.getInfo().localAiProxy`.
- Release finalization therefore could not prove that a launched packaged desktop artifact had preserved:
  - proxy lifecycle
  - message capture state
  - observability database path
  - runtime snapshot path
  - runtime log path

## Implemented Fix

- Desktop bootstrap now captures `getDesktopKernelInfo()?.localAiProxy` during startup and persists a sanitized `localAiProxy` block into `diagnostics/desktop-startup-evidence.json`.
- The persisted startup evidence now preserves:
  - `lifecycle`
  - `messageCaptureEnabled`
  - `observabilityDbPath`
  - `snapshotPath`
  - `logPath`
- `scripts/release/smoke-desktop-startup-evidence.mjs` now:
  - rejects captured evidence that omits those local proxy runtime facts
  - requires `localAiProxy.lifecycle === "running"`
  - writes `localAiProxyRuntime` into `desktop-startup-smoke-report.json`
  - adds the explicit smoke check id `local-ai-proxy-runtime`
- `scripts/release/finalize-release-assets.mjs` now:
  - requires a passing `local-ai-proxy-runtime` startup smoke check
  - compares `desktop-startup-smoke-report.json.localAiProxyRuntime` with the captured startup evidence `localAiProxy`
  - lifts the normalized result into aggregated release metadata as `desktopStartupSmoke.localAiProxyRuntime`
- `scripts/openclaw-upgrade-smoke-evidence.mjs` now lifts a sanitized `packagedLaunchSmokeSummary` so upgrade-smoke evidence exposes the same `localAiProxyRuntime` summary instead of leaving it buried inside the nested startup smoke report.
- `docs/core/release-and-deployment.md` now documents `desktopStartupSmoke.localAiProxyRuntime` as a release contract field and states that finalization rejects drift or omission.

## OpenClaw Fact Sources Re-checked

- `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts`
- `scripts/release/desktop-startup-smoke-contract.mjs`
- `scripts/release/smoke-desktop-startup-evidence.mjs`
- `scripts/release/finalize-release-assets.mjs`
- `scripts/openclaw-upgrade-smoke-evidence.mjs`

The governing rule in this loop is unchanged: packaged smoke may only read and preserve local proxy runtime facts already published by the runtime truth chain. It must not infer proxy health or artifact paths from installer layout guesses.

## Fresh Verification

- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/desktopStartupEvidence.test.ts`
  - `node scripts/release/smoke-desktop-startup-evidence.test.mjs`
  - `node scripts/release/finalize-release-assets.test.mjs`
  - `node scripts/openclaw-upgrade-smoke-evidence.test.mjs`
  - `node scripts/release-flow-contract.test.mjs`
  - `node scripts/check-release-closure.mjs`
- Session-known yellow:
  - release-related checks still print the non-blocking supplemental-package warning for `@buape/carbon@0.0.0-beta-20260327000044`

## Closure Status

- `CP09-3`: green
  - packaged desktop startup smoke now proves the launched artifact preserved local proxy runtime lifecycle and artifact paths
  - upgrade-smoke evidence and aggregated release metadata can now read that proof directly
- `CP09-4`: yellow
  - packaged smoke now freezes the runtime-artifact portion of the support/performance chain
  - final Step 09 closure still depends on freezing the current performance baseline and capacity red lines in the same loop
- `Step 09`: open until the performance-baseline closure writeback completes

## Next Frontier

- Freeze the current Step 09 performance baseline and capacity red lines using:
  - the existing heavy-panel bundle split evidence
  - the local proxy route metric / route probe truth
  - the local proxy first-chunk latency assertions already enforced in Rust
