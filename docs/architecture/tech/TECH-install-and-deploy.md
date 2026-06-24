> Migrated from `docs/guide/install-and-deploy.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Install And Deploy

## Choose The Right Artifact Family

| Artifact Family | Typical Output | Supported Targets | Use When |
| --- | --- | --- | --- |
| Desktop | installers and app bundles | Windows, Linux, macOS | you want a native desktop application |
| Server | native archive with embedded web assets | Windows, Linux, macOS | you want a standalone browser-managed server |
| Container | Docker-oriented deployment bundle | Linux `x64` and `arm64` | you deploy with Docker or Compose |
| Kubernetes | Helm-compatible bundle | Linux `x64` and `arm64` | you deploy on Kubernetes |
| Web | static archive with web and docs assets | web | you only need static assets |

## Source-Based Local Installation

### Web

```bash
pnpm install
pnpm dev
```

### Desktop

```bash
pnpm install
pnpm tauri:dev
```

### Server

```bash
pnpm install
pnpm build
pnpm server:dev
```

Use `pnpm build` before `pnpm server:dev` when you want the native server to serve the current built browser bundle.

## Default Access Points

| Mode | Default Or Typical Entry |
| --- | --- |
| Web workspace | `http://localhost:3001` |
| Desktop runtime | native desktop window after `pnpm tauri:dev` |
| Native server | `http://127.0.0.1:18797` by default |
| Container | mapped host port from the deployment bundle |
| Kubernetes | ingress domain or cluster service URL |

## Desktop Installation By Operating System

### Windows

Desktop release assets are packaged as Windows installer outputs such as `.exe` and `.msi`, depending on the bundle format emitted by Tauri.

Typical workflow:

1. Download the Windows desktop release asset from GitHub Releases.
2. Run the installer.
3. Launch Claw Studio from the Start menu or installation directory.

### Linux

Desktop release assets are packaged as `.deb`, `.rpm`, and `.AppImage` outputs.

Typical workflow:

1. Download the package format that matches your distribution.
2. Install it with your system package manager or run the AppImage.
3. Launch the desktop app from the application menu.

### macOS

Desktop release assets are packaged as `.dmg` plus archived `.app` bundles.

Typical workflow:

1. Download the macOS release asset.
2. Mount the `.dmg` or extract the app archive.
3. Move the app into `Applications` if needed and launch it.

## Native Server Installation By Operating System

### Bundle Layout

The packaged server archive contains:

- the Rust server binary under `bin/`
- the built browser app under `web/dist/`
- `.env.example`
- optional launcher wrappers
- a bundle README

### Windows

Extract the archive and start the server with:

```powershell
.\bin\claw-server.exe
```

### Linux And macOS

Extract the archive and start the server with:

```bash
./bin/claw-server
```

When the packaged binary is launched from the extracted bundle, it defaults:

- `CLAW_SERVER_WEB_DIST` to the embedded `web/dist`
- `CLAW_SERVER_DATA_DIR` to `.claw-server` inside the extracted bundle

Optional convenience wrappers `start-claw-server.cmd` and `start-claw-server.sh` invoke the same binary and preserve those bundled defaults.

After startup, open `http://<host>:<port>` in a browser.

## Post-Install Verification

### Server

Check readiness:

```bash
curl http://127.0.0.1:18797/claw/health/ready
```

Read discovery metadata:

```bash
curl http://127.0.0.1:18797/claw/api/v1/discovery
```

Download the OpenAPI document:

```bash
curl http://127.0.0.1:18797/claw/openapi/v1.json
```

### Server With Basic Auth Enabled

```bash
curl -u operator:manage-secret \
  http://127.0.0.1:18797/claw/manage/v1/rollouts
```

### Desktop

After launching the desktop application:

1. confirm the window opens normally
2. open the relevant settings or management screen
3. verify that provider or host status data loads without bridge errors

## Server Configuration

The most important runtime variables are:

- `CLAW_SERVER_HOST`
- `CLAW_SERVER_PORT`
- `CLAW_SERVER_DATA_DIR`
- `CLAW_SERVER_STATE_STORE_DRIVER`
- `CLAW_SERVER_WEB_DIST`
- `CLAW_SERVER_MANAGE_USERNAME`
- `CLAW_SERVER_MANAGE_PASSWORD`
- `CLAW_SERVER_INTERNAL_USERNAME`
- `CLAW_SERVER_INTERNAL_PASSWORD`

See [Environment](/reference/environment) and [Claw Server Runtime](/reference/claw-server-runtime) for the current supported values.

## Common Day-2 Operations

### Restart A Packaged Server Bundle

Windows:

```powershell
taskkill /IM claw-server.exe /F
.\bin\claw-server.exe
```

Linux Or macOS:

```bash
pkill -f claw-server || true
./bin/claw-server
```

These commands are direct process-level examples for the packaged native binary. Optional wrapper scripts remain available for operator convenience, but the `bin/` binary is the canonical packaged entry point. If you install the native server as a system service, prefer `claw-server service start|stop|restart|status` so CLI control, browser management, and projected service manifests stay aligned.

### Install The Native Server As A Managed Service

Current packaged server bundles ship the native service-capable binary under `bin/` as the canonical runtime entry. `start-claw-server.sh` and `start-claw-server.cmd` remain optional convenience wrappers around that same binary.

Windows:

```powershell
.\bin\claw-server.exe service install
.\bin\claw-server.exe service status
```

Linux Or macOS:

```bash
./bin/claw-server service install
./bin/claw-server service status
```

Use `service print-manifest --platform <linux|macos|windows>` when you need to inspect the projected unit before installing it. Service lifecycle commands default to the current platform, but they still require whatever privileges the host service manager expects.

### Inspect Container Deployment State

```bash
docker compose -f deploy/docker/docker-compose.yml ps
docker compose -f deploy/docker/docker-compose.yml logs --tail=200
```

### Inspect Kubernetes Deployment State

```bash
helm status claw-studio
kubectl get pods
kubectl get svc
```

### Validate Browser Reachability

Use a browser or curl against:

- `/claw/health/ready`
- `/claw/api/v1/discovery`
- `/claw/openapi/v1.json`

## Docker Deployment

The container bundle packages the server runtime under `app/` and ships Docker deployment files under `deploy/`.
Inside the image, Docker starts the canonical bundled binary at `app/bin/claw-server` directly rather than routing through the optional shell wrapper.

Run these commands from the extracted bundle root. The compose files resolve env overlays from `deploy/docker/profiles/*` and use the extracted bundle root as the Docker build context.

Base deployment:

```bash
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

## Kubernetes Deployment

The Kubernetes bundle ships a Helm-compatible chart plus `values.release.yaml`.

Typical deployment:

```bash
helm upgrade --install claw-studio ./chart -f values.release.yaml
```

You can layer additional environment-specific values files on top of the release defaults.

## Web And Docs Archive

The `web` release family packages:

- the built browser app
- the VitePress docs site

Use this family when you only need static assets and do not want the native Rust control plane.

## Verification Before Packaging

Use these commands before publishing or changing deployment logic:

```bash
pnpm check:server
pnpm check:automation
pnpm release:plan
```

Local packaging prerequisites:

- `pnpm release:package:desktop` only packages finished desktop installers and app bundles. Run `pnpm release:desktop` or `pnpm tauri:build` first.
- `pnpm release:package:server` refreshes the matching native server release binary first when you use the root local wrapper. That build remains incremental, but it guarantees the packaged archive uses the current target output instead of a stale prior binary.
- `pnpm release:package:container` refreshes a matching Linux server binary first when you use the root local wrapper. On Windows, `pnpm server:build -- --target x86_64-unknown-linux-gnu` can build that target through WSL automatically when a Linux distro is installed. On macOS, the same fallback still depends on an explicit Linux target toolchain.
- `pnpm release:package:kubernetes` packages chart and values assets only, so it can be prepared locally without building the server binary.
- `pnpm release:finalize` reads packaged assets from the active release asset directory and rejects incomplete release-profile coverage by default. The local wrapper defaults that directory to `artifacts/release`, while GitHub workflows use `release-assets/`. During local finalization, `release-manifest.json.repository` resolves from `SDKWORK_RELEASE_REPOSITORY`, then `GITHUB_REPOSITORY`, then `git remote origin`, `release-manifest.json.releaseCoverage` records required, present, and missing targets, `release-manifest.json.releaseMetadata` records pre-rendered `release-notes.md`, and structured `status=skipped` deployment smoke for `container` and `kubernetes` is preserved instead of being flattened into a false pass. Run `pnpm release:write-attestation-evidence` after the finalized asset set has GitHub artifact attestations, then run `pnpm release:assert-ready` before publishing; readiness rejects partial or `--allow-partial-release` manifests, verifies `release-attestations.json`, `SHA256SUMS.txt`, artifact checksums, artifact sizes, and release metadata checksums/sizes against the finalized manifest, requires `release-notes.md` to remain covered by `releaseMetadata`, `SHA256SUMS.txt`, and `release-attestations.json`, requires every release subject attestation to be bound to the same sha256/repository/release tag/source ref/predicate/signer workflow identity through `gh attestation verify --signer-workflow`, and rejects artifacts whose required family-specific smoke metadata is missing, malformed, references smoke evidence files that are no longer present in the release asset directory, has smoke evidence sha256/size bindings that no longer match the referenced files, or no longer matches the referenced smoke report contents. Use `pnpm release:finalize:partial` only for explicit local/debug aggregation of an incomplete artifact directory.

## Current Service-Manager Boundary

The packaged server archives currently ship the native service-capable server binary as the canonical entry point plus optional convenience wrappers.

That means:

- non-service deployments should start `./bin/claw-server` or `.\bin\claw-server.exe`
- `start-claw-server.sh` and `start-claw-server.cmd` remain optional convenience aliases for local operator startup
- managed installs should run through `./bin/claw-server service *` or `.\bin\claw-server.exe service *`
- `systemd`, `launchd`, and Windows Service lifecycles are still executed through the host platform's own service manager, so installation and control require the corresponding operator privileges

