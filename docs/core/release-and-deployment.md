# Release And Deployment

## Overview

Claw Studio now publishes a unified multi-family release instead of a desktop-only artifact set.

The release flow produces:

- `desktop` installers and native application bundles
- `server` native Rust server archives with embedded web assets
- `container` deployment bundles for Docker-oriented environments
- `kubernetes` deployment bundles with Helm-compatible chart assets
- `web` static web/docs archives

This keeps one tag and one workflow while still giving desktop users, server operators, and platform teams the release shape they actually need.

## Local Verification And Packaging

When a change touches cross-mode runtime authority or delivery behavior and you
need one decisive gate instead of a manual checklist, run the unified multi-mode
verification command from the workspace root:

```bash
pnpm check:multi-mode
```

`pnpm check:multi-mode` chains the current desktop runtime contract, native
server contract, unified host-runtime authority smoke contract, bundled
OpenClaw readiness checks, and release-flow packaging contracts. Treat it as
the highest-signal local gate for "desktop + server + docker/kubernetes release
surfaces still close correctly together".

Before changing desktop embedded-host bootstrap, desktop hosted browser
authority, or packaged startup behavior, verify the current desktop runtime
contract from the workspace root:

```bash
pnpm check:desktop
```

`pnpm check:desktop` now enforces both the renderer-side desktop hosted-runtime
regression suite and focused Rust embedded-host bootstrap regressions for the
structured browser bootstrap descriptor plus canonical hosted route families.

Before attempting to upgrade the bundled desktop OpenClaw runtime to a newer
upstream tag, verify upgrade readiness from the workspace root:

```bash
pnpm check:desktop-openclaw-runtime
pnpm exec node scripts/openclaw-upgrade-readiness.mjs <target-version>
```

Interpret the readiness output before touching `config/openclaw-release.json` or
the packaged OpenClaw manifest files:

- `versionSourcesAligned: true` means the configured release source, packaged
  manifest, generated manifest, prepared runtime, and local upstream checkout
  all agree on the same OpenClaw version baseline.
- `readyToUpgrade: true` means the local checkout, local tag, and local offline
  asset inputs are present for a real upgrade attempt.
- `readyToUpgrade: false` means do not change packaged OpenClaw runtime version sources
  yet.
- `versionSourcesAligned: true` and `readyToUpgrade: false` can both be correct
  at the same time. That state means the current packaged baseline is internally
  consistent, but the workspace is not prepared for a future retargeting step
  yet.
- If `localUpstreamDirtyCheck` is `unavailable` in the Node diagnostic, run
  `git -C .cache/bundled-components/upstreams/openclaw status --short`
  separately before refreshing the upstream checkout.

Before changing native server behavior, deployment bundles, or release metadata, verify the current server runtime contract from the workspace root:

```bash
pnpm check:server
```

Before finalizing a release that changes desktop/server/container/kubernetes runtime authority, readiness, built-in OpenClaw ownership, or hosted/browser bridge behavior, re-run the unified host runtime smoke contract:

```bash
pnpm check:sdkwork-host-runtime
```

The persisted unified host runtime smoke report lives at `docs/reports/2026-04-05-unified-rust-host-runtime-hardening-smoke.md`. Treat that report as release evidence, not as optional notes. It records the automated verification batch and the remaining manual runtime checklist for desktop packaged startup, hosted parity, docker, and singleton-kubernetes flows.

The persisted deployment bootstrap smoke report lives at `docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md`. Treat that deployment bootstrap smoke report as release evidence as well. It records the automated verification batch plus the required packaged container image startup, docker compose startup, and singleton-k8s readiness commands that still need live execution outside this sandbox.

Before changing GitHub workflows, release packaging scripts, or asset finalization behavior, validate the release automation contracts:

```bash
pnpm check:automation
```

Before pushing a release tag after shared SDK changes, compare the configured
GitHub release sources against the local source-of-truth package roots:

```bash
pnpm check:shared-sdk-release-parity
```

This check clones the pinned refs from `config/shared-sdk-release-sources.json`
and compares them with the local sibling SDK package roots that development
still uses through relative workspace paths, including `@sdkwork/app-sdk`,
`@sdkwork/sdk-common`, `@sdkwork/core-pc-react`,
`@sdkwork/im-sdk`, and `@sdkwork/rtc-sdk`. The comparison normalizes text-file
line endings so Windows `CRLF` checkouts and GitHub `LF` checkouts do not raise
false drift. Shared SDK package scripts must resolve `vite`, `tsc`, and other
build tools from package-local workspace metadata rather than hard-coded
cross-repository `../../../node_modules/*` paths; otherwise clean-room release
workspaces can pass parity and still fail during `Verify release inputs`. If
this check fails, do not push a release tag yet.

Before collecting artifacts, inspect the current multi-family release matrices:

```bash
pnpm release:plan
```

Local family packagers remain available when you need to validate one slice without waiting for the full GitHub workflow:

```bash
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:smoke:desktop
pnpm release:smoke:desktop-packaged-launch -- --platform <platform> --arch <arch> --target <target>
pnpm release:smoke:desktop-startup -- --platform <platform> --arch <arch> --startup-evidence-path <path-to-desktop-startup-evidence.json>
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
```

These commands collect family-specific assets into `artifacts/release` so they can be reviewed locally or aggregated for final release processing.

When you need to switch desktop kernel packaging without editing scripts, pass an explicit package profile through the local wrapper:

```bash
pnpm release:package:desktop -- --package-profile dual-kernel
pnpm release:smoke:desktop -- --package-profile hermes-only
```

The same local wrapper also accepts `SDKWORK_RELEASE_PACKAGE_PROFILE` so repeated local verification can stay pinned to `openclaw-only`, `hermes-only`, or `dual-kernel` without rewriting each command line.

Local prerequisite notes:

- `pnpm release:package:desktop` only collects installers and app bundles that already exist; run `pnpm release:desktop` or `pnpm tauri:build` first.
- `pnpm release:package:desktop` now also runs the same desktop installer smoke contract used by release finalization, so each packaged desktop target persists an `installer-smoke-report.json` beside its `release-asset-manifest.json`.
- `pnpm release:smoke:desktop` now re-runs the packaged desktop installer smoke and then closes the launched-session check for the same target. When `--startup-evidence-path` is omitted it launches the canonical packaged desktop artifact for that platform, waits until `desktop-startup-evidence.json` reaches `status=passed` and `phase=shell-mounted`, requires the captured evidence to preserve a running `localAiProxyRuntime`, and then writes `desktop-startup-smoke-report.json`. When `--startup-evidence-path` is provided it imports that external evidence instead of launching the package.
- `pnpm release:smoke:desktop-packaged-launch` launches the canonical packaged desktop artifact for the requested target, captures isolated packaged-session startup evidence, and forwards that evidence into the canonical startup smoke report writer. On Linux it automatically falls back to `xvfb-run` when no desktop display is available.
- `pnpm release:smoke:desktop-startup` validates only the captured launched-session startup evidence and copies that evidence into the canonical release asset path when you provide `--startup-evidence-path`. The resulting smoke report must preserve `localAiProxyRuntime.lifecycle`, `messageCaptureEnabled`, `observabilityDbPath`, `snapshotPath`, and `logPath`.
- `pnpm release:package:server` now refreshes the matching native server release binary before packaging when you invoke the root local wrapper. The build remains incremental, but packaging no longer depends on whatever prior target output happens to exist.
- `pnpm release:package:server` now also runs packaged bundle-runtime smoke and persists a `release-smoke-report.json` beside the server `release-asset-manifest.json`.
- `pnpm release:package:container` packages Docker deployment assets around a Linux server binary. The root local wrapper refreshes that target binary first through an incremental build. On Windows, `pnpm server:build -- --target x86_64-unknown-linux-gnu` bridges into an installed WSL distro automatically. On macOS and other non-Linux hosts, the same fallback still depends on a working Linux target toolchain.
- `pnpm release:package:kubernetes` packages chart assets and release values, so it does not require a locally built server binary.
- `pnpm release:smoke:server` re-runs only the packaged server bundle smoke stage when you want fresh runtime evidence for an existing server artifact set without rebuilding it.
- `pnpm release:smoke:container` now extracts the packaged deployment bundle, verifies that the packaged runtime profile keeps `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false` and `CLAW_SERVER_DATA_DIR=/var/lib/claw-server`, verifies that the packaged Docker Compose layout requires explicit manage credentials and persists `/var/lib/claw-server`, runs Docker Compose against that packaged layout, requires Docker to report the packaged services healthy, and then verifies `/claw/health/ready`, `/claw/manage/v1/host-endpoints`, and the bundled browser shell before persisting `release-smoke-report.json`. When Docker and/or Docker Compose are unavailable on the current host, it emits machine-readable skipped evidence instead of hanging or silently succeeding.
- `pnpm release:smoke:kubernetes` now renders the packaged chart with `helm template`, requires immutable image metadata from `release-metadata.json`, verifies the rendered readiness, Secret-backed credential wiring, and `/var/lib/claw-server` PersistentVolumeClaim contract, and uses `kubectl apply --dry-run=client` when `kubectl` is available. When Helm is unavailable, it still emits machine-readable skipped evidence instead of silently succeeding.

The local wrapper defaults `release:plan`, `release:package:*`, and `release:finalize` to `artifacts/release`. CI still aggregates assets under `release-assets/`. Override the local defaults with environment variables such as:

- `SDKWORK_RELEASE_TAG`
- `SDKWORK_RELEASE_PACKAGE_PROFILE`
- `SDKWORK_RELEASE_OUTPUT_DIR`
- `SDKWORK_RELEASE_ASSETS_DIR`
- `SDKWORK_RELEASE_TARGET`
- `SDKWORK_RELEASE_PLATFORM`
- `SDKWORK_RELEASE_ARCH`
- `SDKWORK_RELEASE_ACCELERATOR`
- `SDKWORK_RELEASE_IMAGE_REPOSITORY`
- `SDKWORK_RELEASE_IMAGE_TAG`
- `SDKWORK_RELEASE_IMAGE_DIGEST`
- `SDKWORK_RELEASE_REPOSITORY`

When `SDKWORK_RELEASE_REPOSITORY` is unset, the local wrapper falls back to `GITHUB_REPOSITORY` and then to the local `git remote origin` so `release-manifest.json.repository` remains populated during local finalization.

## Release Notes Source

GitHub release notes are now repository-owned artifacts instead of auto-generated
platform summaries.

- Release metadata lives in `docs/release/releases.json`
- Per-tag release note documents live under `docs/release/`
- The reusable GitHub release workflow renders notes with `node scripts/release/render-release-notes.mjs --release-tag <tag> --output release-assets/release-notes.md`

When a release attempt fails before GitHub publishes the release, carry the
unpublished change log forward by referencing the earlier failed tags in the
next successful release entry.

## Release Metadata Contract

Each unified release produces two top-level inventory files under the active release asset directory, which is `artifacts/release` for the local wrapper and `release-assets/` inside GitHub workflows:

- `release-manifest.json`
- `SHA256SUMS.txt`

`SHA256SUMS.txt` is the portable checksum surface.

`release-manifest.json` is the machine-readable inventory surface for download portals, deployment automation, and release verification. Its top-level metadata includes `profileId`, `productName`, `releaseTag`, `generatedAt`, `checksumFileName`, and `repository`. The `repository` value resolves from `SDKWORK_RELEASE_REPOSITORY`, then `GITHUB_REPOSITORY`, then the local `git remote origin` when you use the local wrapper without release-specific environment variables.

Each artifact entry carries:

- `family`: one of `desktop`, `web`, `server`, `container`, or `kubernetes`
- `platform`: target platform such as `windows`, `linux`, `macos`, or `web`
- `arch`: target architecture such as `x64`, `arm64`, or `any`
- `accelerator`: deployment-layer accelerator profile when applicable, currently `cpu`, `nvidia-cuda`, or `amd-rocm`
- `kind`: artifact classification such as `installer`, `package`, or `archive`
- `relativePath`: stable path inside the release asset directory
- `sha256`: final artifact checksum
- `size`: final artifact size in bytes

Desktop artifacts carry additional machine-readable metadata because install-time kernel preparation is a release contract whenever a packaged kernel requires it. The current first-party installer contract is OpenClaw:

- `kernelInstallContracts`: normalized per-kernel install contracts stamped from current source-of-truth installers and persisted from packaging through finalization. Current desktop artifacts use `kernelInstallContracts.openclaw` when the package profile includes OpenClaw.
- `desktopInstallerSmoke`: the aggregated desktop installer smoke summary lifted from `installer-smoke-report.json`
- `desktopInstallerSmoke.kernelInstallReadiness`: normalized per-kernel install-readiness evidence lifted from `installer-smoke-report.json`
- `desktopInstallerSmoke.kernelInstallReadiness.<kernelId>.externalRuntimePolicy`: normalized per-kernel external runtime policy evidence showing that packaged kernels still depend on external language runtimes instead of bundled Node.js, Python, or `uv`
- `desktopInstallerSmoke.kernelInstallReadiness.openclaw.installReadyLayout`: normalized first-launch readiness proof showing how the packaged installer leaves the included OpenClaw payload ready for startup reuse when `kernelInstallContracts.openclaw` is present
- `desktopStartupSmoke`: the aggregated launched-session desktop runtime smoke summary lifted from `desktop-startup-smoke-report.json` when that evidence has been captured for the artifact
- `desktopStartupSmoke.capturedEvidenceRelativePath`: the preserved path of the captured `diagnostics/desktop-startup-evidence.json` launch record inside the release asset directory
- `desktopStartupSmoke.packageProfileId`: the packaged kernel profile asserted by launched-session startup smoke and revalidated against the desktop partial manifest during finalization
- `desktopStartupSmoke.includedKernelIds`: the ordered packaged kernel set asserted by launched-session startup smoke and revalidated against the desktop partial manifest during finalization
- `desktopStartupSmoke.defaultEnabledKernelIds`: the default-enabled packaged kernel set asserted by launched-session startup smoke and revalidated against the desktop partial manifest during finalization
- `desktopStartupSmoke.localAiProxyRuntime`: the normalized local AI proxy runtime summary lifted from launched-session startup smoke, including `lifecycle`, `messageCaptureEnabled`, `observabilityDbPath`, `snapshotPath`, and `logPath`

`desktopInstallerSmoke.kernelInstallReadiness.<kernelId>.externalRuntimePolicy` is shared multi-kernel evidence, not an OpenClaw-only extension. Current first-party expectations are:

- `openclaw`: `runtimeRequirements` includes external `nodejs`
- `hermes`: `runtimeRequirements` includes external `python` and `uv`, with optional external `nodejs`

Server artifacts also carry aggregated runtime evidence because a packaged server bundle is not considered releasable until the extracted archive actually boots:

- `serverBundleSmoke`: the aggregated packaged server runtime smoke summary lifted from `release-smoke-report.json`
- `serverBundleSmoke.checks`: ordered readiness checks proving `/claw/health/ready`, `/claw/manage/v1/host-endpoints`, and the bundled browser shell all respond from the packaged archive

Deployment artifacts also carry aggregated deployment evidence because packaging alone is not sufficient proof that the published bundle can be used safely:

- `deploymentSmoke`: the aggregated deployment smoke summary lifted from `release-smoke-report.json` for `container` and `kubernetes` artifacts
- `deploymentSmoke.checks`: ordered deployment checks proving packaged container runtime-profile, Docker Compose credential and persistence contracts, Compose startup, container health, and runtime readiness for `container`, plus rendered chart image-reference, readiness, Secret wiring, and persistent-storage validation for `kubernetes`

Deployment smoke is allowed to be either `passed` or structurally `skipped`. A skipped deployment report is valid only when it preserves a non-empty `skippedReason`, and it may also persist discovered host `capabilities` such as Docker, Docker Compose, Helm, or `kubectl`. Release finalization lifts that skipped state verbatim into `release-manifest.json` rather than flattening it into a false pass.

The persisted `desktopInstallerSmoke.kernelInstallReadiness.openclaw.installReadyLayout` object is intentionally stronger than `{ mode, installKey }`. It must prove all of the following:

- `reuseOnFirstLaunch` is `true`
- `requiresArchiveExtractionOnFirstLaunch` is `false`
- `manifestRelativePath` is `manifest.json`
- `runtimeSidecarRelativePath` is `runtime/.sdkwork-openclaw-runtime.json`
- `cliEntryRelativePath` matches the packaged manifest's OpenClaw CLI entrypoint

Release verification treats any field loss or drift in that object as a release-breaking regression, because it would weaken the audit trail for "prepare during install, reuse on first launch".

The `installReadyLayout.mode` contract is platform-specific and is treated as release-breaking when it drifts:

- Windows and Linux desktop installers must produce `archive-extract-ready`
- macOS desktop installers must produce `staged-layout`

The desktop install contract also anchors installer-time OpenClaw preparation to a platform-specific canonical install root:

- Windows NSIS hooks invoke the embedded OpenClaw prepare and CLI registration actions with `--install-root "$INSTDIR"`
- Linux postinstall resolves the packaged install root from the packaged OpenClaw manifest and forwards it as `--install-root "$install_root"`
- macOS projects a preexpanded managed runtime layout into the app bundle instead of relying on a postinstall extraction hook

Family-specific packagers emit partial manifests first. The finalization step then merges them, recomputes final checksums, and also infers the same `family`, `platform`, `arch`, and `accelerator` metadata from fallback asset paths when a partial family manifest is missing. That keeps `server`, `container`, and `kubernetes` assets machine-readable even under degraded packaging conditions.

## GitHub Workflow

The release entrypoint is `.github/workflows/release.yml`, which delegates to `.github/workflows/release-reusable.yml`.

For a `release-*` tag or a manual dispatch, the reusable workflow now builds:

- desktop assets for Windows, Linux, and macOS
- server assets for Windows, Linux, and macOS
- container bundles for Linux `x64` and `arm64`
- architecture-scoped OCI server images published to `ghcr.io/<owner>/claw-studio-server`
- kubernetes bundles for Linux `x64` and `arm64`
- CPU, NVIDIA CUDA, and AMD ROCm-oriented deployment variants where that difference lives at the deployment layer
- a final `release-manifest.json` plus `SHA256SUMS.txt`

## Artifact Families

### Desktop

Desktop remains the existing Tauri-first path:

- Windows: `nsis`
- Linux: `deb`, `rpm`
- macOS: `.app` archive plus `.dmg`

### Server

Server archives are native per-platform bundles. Each archive contains:

- the canonical Rust server binary under `bin/`
- the built browser app under `web/dist`
- `.env.example`
- optional launcher wrappers

The packaged native binary is the canonical bundled launcher. When the expected bundle layout is present, it auto-resolves `CLAW_SERVER_WEB_DIST` to the extracted `web/dist` directory and `CLAW_SERVER_DATA_DIR` to `.claw-server` inside the bundle. `start-claw-server.sh` and `start-claw-server.cmd` remain optional convenience wrappers around that same binary.

Each packaged server target now also persists `release-smoke-report.json` next to its partial manifest. Release finalization rejects the server artifact if that report is missing, stale, or no longer matches the current archive set.

### Container

Container bundles package:

- the prepared server runtime under `app/`
- Docker build files
- Docker Compose files
- CPU and GPU-oriented env overlays

The packaged Dockerfile launches `app/bin/claw-server` directly so container startup stays aligned
with the canonical bundled server entrypoint instead of routing through the optional shell wrapper.

The source repository keeps the container templates under `deploy/docker/` for review and
packaging input:

- `deploy/docker/docker-compose.yml`
- `deploy/docker/docker-compose.nvidia-cuda.yml`
- `deploy/docker/docker-compose.amd-rocm.yml`
- `deploy/docker/Dockerfile`
- `deploy/docker/profiles/*`

Those source tree paths are not the final runnable release layout. Render the packaged layout
locally with `pnpm release:package:container`, then run Docker Compose from the extracted bundle
root.

Inside the extracted bundle root, the same deployment surface becomes:

- `deploy/docker/docker-compose.yml`
- `deploy/docker/docker-compose.nvidia-cuda.yml`
- `deploy/docker/docker-compose.amd-rocm.yml`
- `deploy/docker/Dockerfile`
- `deploy/docker/profiles/*`

Inside that extracted bundle, `deploy/docker/docker-compose.yml` resolves env overlays from
`deploy/docker/profiles/*` and treats the extracted bundle root as the Docker build context.

Base deployment from the extracted bundle root:

```bash
export CLAW_SERVER_MANAGE_USERNAME=claw-admin
export CLAW_SERVER_MANAGE_PASSWORD='replace-with-a-strong-secret'
docker compose -f deploy/docker/docker-compose.yml up -d
```

NVIDIA CUDA overlay:

```bash
docker compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.nvidia-cuda.yml up -d
```

AMD ROCm overlay:

```bash
docker compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.amd-rocm.yml up -d
```

The base compose file now requires an explicit manage credential pair before it will start the
public control plane, and the default env overlay keeps
`CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false`.

Each packaged container target now also persists `release-smoke-report.json` next to its partial
manifest. Release finalization rejects the container artifact if Docker Compose smoke is missing,
stale, or no longer matches the current packaged bundle.

### Kubernetes

Kubernetes bundles package:

- a Helm-compatible chart under `chart/`
- base `values.yaml`
- accelerator-specific values files
- generated `values.release.yaml`

Typical deployment:

```bash
helm upgrade --install claw-studio ./chart -f values.release.yaml --set auth.manageUsername=claw-admin --set auth.managePassword='replace-with-a-strong-secret'
```

GitHub release automation publishes one OCI image per Linux architecture and then stamps each
Kubernetes bundle with that immutable image reference. `values.release.yaml` pins `image.tag` to
an architecture-qualified release tag such as `release-2026-04-04-01-linux-x64`, and the release
workflow also writes `image.digest` so production clusters can pull by digest without depending on
mutable tags. Override `image.repository` only when you mirror the published image into another
registry, and keep `image.digest` aligned with the mirrored artifact.

The chart also generates or references a Secret-backed control-plane credential set and mounts a
PersistentVolumeClaim at `/var/lib/claw-server` so the SQLite host-state baseline survives Pod
restarts.

Each packaged kubernetes target now also persists `release-smoke-report.json` next to its partial
manifest. Release finalization rejects the kubernetes artifact if packaged chart rendering smoke is
missing, stale, or no longer matches the current bundle.

## Finalization Step

The packaging flow is intentionally split into:

1. family-specific package collection
2. desktop installer smoke verification for packaged desktop targets
3. launched-session desktop startup smoke verification from a real packaged desktop run for every desktop target
4. packaged server and deployment smoke verification for server/container/kubernetes targets
5. global release finalization

The finalization step emits the final inventory and checksums after all family outputs have been aggregated into one release asset directory. Locally that defaults to `artifacts/release`; in GitHub workflows the same step runs against `release-assets/`:

```bash
pnpm release:finalize
```

Finalization now requires `desktop-startup-smoke-report.json` beside every desktop partial manifest. It lifts that launched-session evidence onto the matching desktop artifact as `desktopStartupSmoke` and rejects desktop release assets when the packaged launch report or its captured `diagnostics/desktop-startup-evidence.json` evidence is missing, stale, or no longer matches the current artifact set. The finalizer also requires the packaged kernel context in startup smoke (`packageProfileId`, `includedKernelIds`, and `defaultEnabledKernelIds`) to match the desktop partial manifest, requires the `local-ai-proxy-runtime` startup-smoke check to pass, and requires the emitted `desktopStartupSmoke.localAiProxyRuntime` summary to match the captured launch evidence.

For `container` and `kubernetes` artifacts, finalization accepts deployment smoke only when `status=passed` or when `status=skipped` is paired with a non-empty `skippedReason`. If the current host lacks Docker, Docker Compose, or Helm, the final manifest preserves that skipped deployment status and any captured capability snapshot instead of failing the whole release purely because the local machine could not execute that deployment family.

## GPU Variant Model

The Rust server binary itself is CPU-neutral. GPU variants package deployment overlays and release metadata rather than pretending there are different server binaries.

Profiles:

- `cpu`
- `nvidia-cuda`
- `amd-rocm`

## Recommended Use

- choose `desktop` for local GUI-first installs
- choose `server` for native service-style deployments on Windows, Linux, or macOS
- choose `container` for Docker-based server environments
- choose `kubernetes` for cluster deployment and ingress-managed environments
- choose `web` only when you want the browser and docs static bundle
