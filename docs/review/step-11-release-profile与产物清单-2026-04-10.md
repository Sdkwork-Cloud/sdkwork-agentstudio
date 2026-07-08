# Step 11 Release Profile And Asset Inventory - 2026-04-10

## Planned Matrix

This loop rechecked the Step 11 release plan through `pnpm.cmd release:plan`.

- Desktop:
  - windows / x64
  - linux / x64
  - macos / arm64
- Server:
  - windows / x64
  - linux / x64
  - macos / arm64
- Container:
  - linux / x64 / cpu
  - linux / x64 / nvidia-cuda
  - linux / x64 / amd-rocm
  - linux / arm64 / cpu
- Kubernetes:
  - linux / x64 / cpu
  - linux / x64 / nvidia-cuda
  - linux / x64 / amd-rocm
  - linux / arm64 / cpu

## Actual Host-Verified Assets In This Pass

| Family | Target | Artifact status | Smoke status | Notes |
| --- | --- | --- | --- | --- |
| Desktop | windows / x64 | Existing manifest and installer smoke report remained present | Packaged launch blocked | `release-asset-manifest.json` and `installer-smoke-report.json` exist, but no fresh startup evidence was captured on this host |
| Server | windows / x64 | Re-emitted | Passed | `claw-studio-server-release-local-windows-x64.zip` and `release-smoke-report.json` both refreshed successfully |
| Container | linux / x64 / cpu | Not emitted | Failed before packaging | linux server binary could not be built on this host |
| Kubernetes | linux / x64 / cpu | Emitted | Skipped | bundle archive and manifest were emitted, chart smoke skipped because `helm` is missing |

## Concrete Artifact Paths

- Desktop / windows / x64:
  - `artifacts/release/desktop/windows/x64/release-asset-manifest.json`
  - `artifacts/release/desktop/windows/x64/installer-smoke-report.json`
- Server / windows / x64:
  - `artifacts/release/server/windows/x64/claw-studio-server-release-local-windows-x64.zip`
  - `artifacts/release/server/windows/x64/claw-studio-server-release-local-windows-x64.zip.sha256.txt`
  - `artifacts/release/server/windows/x64/release-asset-manifest.json`
  - `artifacts/release/server/windows/x64/release-smoke-report.json`
- Kubernetes / linux / x64 / cpu:
  - `artifacts/release/kubernetes/linux/x64/cpu/claw-studio-kubernetes-bundle-release-local-linux-x64-cpu.tar.gz`
  - `artifacts/release/kubernetes/linux/x64/cpu/claw-studio-kubernetes-bundle-release-local-linux-x64-cpu.tar.gz.sha256.txt`
  - `artifacts/release/kubernetes/linux/x64/cpu/release-asset-manifest.json`
  - `artifacts/release/kubernetes/linux/x64/cpu/release-smoke-report.json`

## Server Bundle Inventory

The repaired Windows server bundle now emits one runtime-backed smoke contract:

- `status=passed`
- `launcherRelativePath=bin/sdkwork-clawstudio-server.exe`
- `runtimeBaseUrl=http://127.0.0.1:<dynamic-port>`
- checks:
  - `health-ready`
  - `host-endpoints`
  - `browser-shell`

This matters because the smoke no longer validates a helper script in isolation; it validates the real packaged binary and the default server readiness contract that the release bundle exposes to operators.

## Kubernetes Bundle Inventory

The linux / x64 / cpu kubernetes bundle emitted successfully in this pass:

- archive:
  - `claw-studio-kubernetes-bundle-release-local-linux-x64-cpu.tar.gz`
- smoke contract:
  - `status=skipped`
  - `smokeKind=chart-render`
  - `skippedReason=helm is unavailable on this host`

The skip is host-driven, not bundle-driven. The artifact, manifest, and smoke-report scaffolding are all present.

## Missing Or Blocked Assets

### Desktop startup evidence

The following files are still absent after this pass:

- `artifacts/release/desktop/windows/x64/diagnostics/desktop-startup-evidence.json`
- `artifacts/release/desktop/windows/x64/desktop-startup-smoke-report.json`

The concrete blocker is the packaged-launch command:

- `node scripts/release/smoke-desktop-packaged-launch.mjs --platform windows --arch x64`
- result:
  - `spawnSync ... Claw Studio_0.1.0_x64-setup.exe EPERM`

### Container bundle

No `artifacts/release/container/...` tree was emitted in this pass because the host could not build the required linux server binary.

The concrete blocker command was:

- `pnpm.cmd release:package:container`
- result:
  - `the x86_64-unknown-linux-gnu target may not be installed`
  - `failed to find tool "x86_64-linux-gnu-gcc"`

## Red / Yellow / Green

| Area | Status | Notes |
| --- | --- | --- |
| Release plan and target matrix | `GREEN` | The release plan remains explicit and stable. |
| Windows server asset inventory | `GREEN` | Archive, checksum, manifest, and smoke report are all present. |
| Kubernetes asset inventory | `GREEN` | Archive, checksum, manifest, and skipped smoke report are all present. |
| Desktop packaged startup inventory | `YELLOW` | Installer evidence exists, but startup evidence is still missing. |
| Container asset inventory | `RED` | No bundle could be emitted on this host. |
