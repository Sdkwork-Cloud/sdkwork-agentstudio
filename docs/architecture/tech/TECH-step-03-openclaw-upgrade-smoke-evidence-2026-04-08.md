> Migrated from `docs/review/step-03-openclaw-upgrade-smoke-evidence-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Step 03 moved from the now-exhausted `CP03-2` hotspot-splitting frontier into `CP03-3`, and this loop added one explicit desktop upgrade smoke-evidence owner.
- The workspace already had installer smoke, packaged launch smoke, and startup smoke scripts, but they were still fragmented; this loop turned them into one auditable OpenClaw upgrade-smoke evidence surface and wired that contract into `check:desktop-openclaw-runtime`.
- Fresh targeted and gate-level verification stayed green.

## Attempt Outcome

- Root cause:
  - Step 03 already had `smokeDesktopInstallers(...)`, `smokeDesktopPackagedLaunch(...)`, and `smokeDesktopStartupEvidence(...)`, but there was no single owner summarizing those smoke phases for the desktop OpenClaw upgrade chain.
  - `check:desktop-openclaw-runtime` therefore explicitly froze readiness, rollback evidence, preparation, and packaged-release verification, but it did not freeze a dedicated smoke-evidence owner.
- Implemented the narrow repair:
  - added `scripts/openclaw-upgrade-smoke-evidence.mjs` as a dedicated aggregator that runs:
    - desktop installer smoke
    - desktop packaged launch smoke
    - final smoke-readiness projection
  - added `scripts/openclaw-upgrade-smoke-evidence.test.mjs` to freeze:
    - package-level gate integration
    - a passed installer + packaged-launch smoke summary
    - blocker propagation when packaged launch smoke fails
  - updated `package.json` so `check:desktop-openclaw-runtime` now executes the new smoke-evidence test after readiness, rollback, prepare, and packaged-release verification tests
- Actual workspace result:
  - the desktop runtime gate now has one explicit smoke-evidence owner rather than relying on separate release smoke scripts with no Step 03-specific aggregation point
  - `CP03-3` now has explicit contract coverage for `smoke` in addition to readiness / rollback / prepare / verify evidence
  - Step 03 remains open because `sync`, `target clean`, and broader multi-mode upgrade-execution evidence are still not aggregated under one final owner

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - the built-in managed OpenClaw instance still publishes `runtimeKind: 'openclaw'` at lines `466` and `512`, `deploymentMode: 'local-managed'` at lines `467` and `513`, and `transportKind: 'openclawGatewayWs'` at lines `468` and `514`
  - the browser-host truth source still marks the built-in runtime as `configWritable: true` at line `1277`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - built-in projection tests still freeze the `openclaw` / `local-managed` / `openclawGatewayWs` tuple at lines `339-341`, `385-387`, and `434-436`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - the managed OpenClaw editing surface still gates on `detail?.instance.runtimeKind === 'openclaw'` at line `1123` and `detail?.lifecycle.configWritable === true` at line `1125`
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - managed capability logic still keys off `runtimeKind === 'openclaw'` at line `10` and `deploymentMode === 'local-managed'` at line `19`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - provider workspace presentation still rejects non-OpenClaw runtimes at line `13`
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - the instance filter at line `143` still narrows installation flows to `runtimeKind === 'openclaw'`
- `package.json`
  - `check:desktop-openclaw-runtime` now includes `node scripts/openclaw-upgrade-smoke-evidence.test.mjs` at line `59`
  - `check:multi-mode` still delegates to `check:desktop-openclaw-runtime` at line `62`
  - the dedicated desktop smoke commands remain exposed as `release:smoke:desktop`, `release:smoke:desktop-packaged-launch`, and `release:smoke:desktop-startup` at lines `86-88`
- `scripts/openclaw-upgrade-smoke-evidence.mjs`
  - the new owner exports `buildOpenClawUpgradeSmokeEvidence(...)` at line `50`
  - it projects the `installer-smoke` phase at lines `72` and `85`
  - it projects the `packaged-launch-smoke` phase at lines `105` and `118`
  - it closes the chain with `smoke-readiness` at line `131`
  - it exposes CLI parsing and execution at lines `153` and `189`
- `scripts/openclaw-upgrade-smoke-evidence.test.mjs`
  - gate integration is frozen at line `9`
  - the passed aggregate summary is frozen at line `19`
  - blocker propagation for packaged-launch failures is frozen at line `72`
- `scripts/release/smoke-desktop-installers.mjs`
  - installer smoke remains the low-level owner through `smokeDesktopInstallers(...)` at line `385` and writes its report via `writeDesktopInstallerSmokeReport(...)` at line `334`
- `scripts/release/smoke-desktop-packaged-launch.mjs`
  - packaged launch smoke remains the low-level execution owner at line `745`
  - it still delegates captured evidence into startup smoke at line `813`
- `scripts/release/smoke-desktop-startup-evidence.mjs`
  - startup smoke remains the low-level startup-evidence owner through `smokeDesktopStartupEvidence(...)` at line `226`
  - it still writes the startup smoke report via `writeDesktopStartupSmokeReport(...)` at line `181`
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - the plugin module still only performs host plugin registration and single-instance window activation at lines `3-7`, so desktop upgrade smoke evidence still belongs in explicit runtime/release scripts rather than plugin bootstrap

## Verification Focus

- RED: `node scripts/openclaw-upgrade-smoke-evidence.test.mjs`
- GREEN: `node scripts/openclaw-upgrade-smoke-evidence.test.mjs`
- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`

## Remaining Gaps

- `CP03-3` is improved but not fully closed:
  - the desktop smoke evidence owner is now explicit and wired into the desktop runtime gate
  - `sync` and `target clean` are still not aggregated into one final upgrade-execution evidence owner
  - broader multi-mode server / container / kubernetes upgrade-execution evidence is still outside this loop
- `CP03-4` remains open until the desktop evidence surface and Kernel Center / shell-facing runtime views converge under one auditable fact chain.
- Step 03 overall therefore remains open.

## Risks And Rollback

- The new script is an aggregator over existing smoke owners, so the main risk is future drift if installer or packaged-launch smoke contracts change without updating the aggregator.
- This loop intentionally does not re-implement installer or packaged launch logic; it only composes them and hardens the gate.
- Rollback is limited to:
  - `scripts/openclaw-upgrade-smoke-evidence.mjs`
  - `scripts/openclaw-upgrade-smoke-evidence.test.mjs`
  - `package.json`
  - the corresponding review, architecture, execution-card, and release writebacks

