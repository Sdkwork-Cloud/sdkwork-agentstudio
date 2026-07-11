# Step 11 Installer Smoke And Upgrade Evidence - 2026-04-10

## Desktop Evidence

### What remained available

- Existing installer asset manifest:
  - `artifacts/release/desktop/windows/x64/release-asset-manifest.json`
- Existing installer smoke report:
  - `artifacts/release/desktop/windows/x64/installer-smoke-report.json`

These prove that the current NSIS installer artifact still exists and that the earlier installer-layout smoke had already been captured.

### What did not refresh

The packaged desktop startup evidence chain did not refresh in this pass.

- missing:
  - `artifacts/release/desktop/windows/x64/diagnostics/desktop-startup-evidence.json`
  - `artifacts/release/desktop/windows/x64/desktop-startup-smoke-report.json`
- failing command:
  - `node scripts/release/smoke-desktop-packaged-launch.mjs --platform windows --arch x64`
- concrete error:
  - `spawnSync ... Agent Studio_0.1.0_x64-setup.exe EPERM`

The blocker is therefore not that the desktop artifact disappeared; it is that this host still does not permit the Node-driven packaged-launch runner to execute the installer/app chain and capture fresh startup evidence.

Additional manual probing on the same host narrowed the remaining gap further:

- direct shell launch of `artifacts/release/desktop/windows/x64/.sim-install-root2/sdkwork-agentstudio-pc-desktop.exe` could create isolated `AppData` / `Crashpad` side effects, but still did not emit `desktop-startup-evidence.json`
- earlier probe directories `artifacts/release/desktop/windows/x64/.release-exe-smoke/` and `artifacts/release/desktop/windows/x64/.release-exe-smoke-gpuoff/` preserve `program-data/SdkWork/CrawStudio/logs/app/app.log` records showing:
  - `desktop embedded host bootstrapped`
  - `managed desktop state initialized`
- the code path in `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx` only persists the startup evidence after runtime readiness and the first shell paints complete, so the remaining failure is now narrowed to the packaged browser-shell mount / evidence-persist phase rather than to installer layout or embedded-host bootstrapping alone

## Server Evidence

The Windows packaged server bundle moved from contract-only confidence to runtime-backed evidence in this pass.

- manifest:
  - `artifacts/release/server/windows/x64/release-asset-manifest.json`
- smoke report:
  - `artifacts/release/server/windows/x64/release-smoke-report.json`
- status:
  - `passed`
- runtime checks captured:
  - `/claw/health/ready returned 200`
  - `/claw/manage/v1/host-endpoints returned canonical endpoints`
  - `/ returned 200`

This smoke is materially stronger than the earlier state because it now validates the shipped `bin/sdkwork-agentstudio-pc-server.exe` bundle binary and the truthful server-mode readiness contract exposed by `/claw/health/ready`.

## Deployment Evidence

### Container

No runtime evidence could be emitted for the container family on this host.

- failing command:
  - `pnpm.cmd release:package:container`
- root failure:
  - missing Rust linux target:
    - `the x86_64-unknown-linux-gnu target may not be installed`
  - missing linker:
    - `failed to find tool "x86_64-linux-gnu-gcc"`

This means the host never reached live docker smoke. The first blocker is still the linux runtime build prerequisite.

### Kubernetes

The kubernetes bundle emitted release evidence, but smoke was skipped on this host.

- manifest:
  - `artifacts/release/kubernetes/linux/x64/cpu/release-asset-manifest.json`
- smoke report:
  - `artifacts/release/kubernetes/linux/x64/cpu/release-smoke-report.json`
- status:
  - `skipped`
- skip reason:
  - `helm is unavailable on this host`

## Upgrade-Evidence Implication

Step 09 and Step 10 had already frozen the desktop local-proxy / packaged-startup evidence contract as the approved upgrade truth chain. This Step 11 pass did not invalidate that contract, but it also did not refresh it with a new packaged desktop launch on the current host.

What did improve in Step 11 is the packaged server availability proof:

- the default server state still keeps manage/OpenClaw runtime and gateway projections inactive unless they are actually ready
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/routes/health.rs` now treats bundled server mode as ready when `claw-manage-http` is published with a reachable endpoint and `studio_public_api` is available
- the packaged bundle smoke now proves server availability through that `/claw/health/ready` contract without falsifying control-plane projections

## Red / Yellow / Green

| Area | Status | Notes |
| --- | --- | --- |
| Desktop installer layout evidence | `GREEN` | Existing installer artifact + installer smoke report still exist. |
| Desktop packaged startup evidence | `RED` | Fresh startup evidence could not be captured because the Node launch runner still hits `EPERM`. |
| Windows server packaged runtime evidence | `GREEN` | Real bundled server binary now passes readiness, host-endpoint, and browser-shell smoke. |
| Container deployment evidence | `RED` | The host cannot build the required linux server runtime bundle. |
| Kubernetes deployment evidence | `YELLOW` | Bundle emitted, but chart smoke stayed skipped without `helm`. |
