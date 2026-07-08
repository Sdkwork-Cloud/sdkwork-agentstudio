# Getting Started

## What You Are Setting Up

This repository contains the package-based Claw Studio workspace. It includes:

- a web entry package
- a Tauri desktop entry package
- a native Rust server package
- a shared shell package
- shared `core`, `types`, `infrastructure`, `i18n`, and `ui` packages
- vertical feature packages such as `chat`, `market`, `settings`, `account`, and `extensions`

## Prerequisites

- Node.js
- `pnpm`
- Rust if you plan to run the native server or desktop builds
- Tauri prerequisites if you plan to run desktop builds

If you are only working on the web shell, Node.js and `pnpm` are enough.

## Install Dependencies

```bash
pnpm install
```

## Run The Main Host Modes

### Web Workspace

```bash
pnpm dev
```

This starts the Vite development server for `@sdkwork/clawstudio-web` on `http://localhost:3001`.

### Desktop Runtime

```bash
pnpm tauri:dev
```

The desktop package serves the shell through Vite on `127.0.0.1:1426` and then launches the Tauri application.

### Native Server

```bash
pnpm server:dev
```

The server package boots the Rust host and serves the browser application through the bundled `/claw/*` route families plus the built web assets.

## Build And Verify

```bash
pnpm build
pnpm check:multi-mode
pnpm check:server
pnpm server:build
pnpm tauri:build
pnpm docs:build
```

Use `pnpm build` for the web shell, `pnpm check:multi-mode` when you need one decisive cross-mode gate for desktop/server/OpenClaw/release surfaces, `pnpm check:server` to validate the native server runtime in isolation, `pnpm server:build` for native server packaging, `pnpm tauri:build` for desktop packaging, and `pnpm docs:build` for the public documentation site.

## Plan And Verify Releases

```bash
pnpm check:automation
pnpm release:plan
pnpm release:finalize
pnpm release:write-attestation-evidence -- --release-assets-dir artifacts/release --repository Sdkwork-Cloud/claw-studio --release-tag release-local
pnpm release:assert-ready
```

Use `pnpm check:automation` to validate release and CI workflow contracts before changing packaging automation, `pnpm release:plan` to inspect the current multi-family release matrices before packaging or CI changes, `pnpm release:finalize` after aggregating packaged artifacts into the active release asset directory, `pnpm release:write-attestation-evidence` after the finalized asset set has GitHub artifact attestations, and `pnpm release:assert-ready` immediately before publishing. The local wrapper defaults that directory to `artifacts/release`, while GitHub workflows use `release-assets/`. Finalization is strict by default: every release-profile target must be present, `release-notes.md` must already be rendered, and the generated manifest records `releaseCoverage` plus `releaseMetadata` so complete and explicitly partial aggregations are machine-identifiable. `pnpm release:finalize` also emits `release-manifest.json.sha256.txt`, a detached checksum for `release-manifest.json`, includes `release-notes.md` in `SHA256SUMS.txt`, and records the `release-attestations.json` evidence contract. `pnpm release:write-attestation-evidence` verifies each artifact and release metadata subject with `gh attestation verify` using `--signer-workflow <owner/repo/.github/workflows/release-reusable.yml>` and records that bound signer as `signerWorkflowIdentity`. `pnpm release:assert-ready` verifies that sidecar before parsing the finalized manifest, re-reads the finalized manifest, `release-attestations.json`, and checksum file, rejects `releaseCoverage.status=partial`, rejects manifests created with `--allow-partial-release`, verifies every listed artifact and `releaseMetadata` checksum and size, requires `release-notes.md` to remain covered by `releaseMetadata`, `SHA256SUMS.txt`, and `release-attestations.json`, requires every release subject to have verified `gh attestation verify` evidence bound to the same sha256/repository/release tag/source ref/predicate/signer workflow identity, and rejects artifacts whose required family-specific smoke metadata is missing, malformed, references smoke evidence files that are no longer present in the release asset directory, has smoke evidence sha256/size bindings that no longer match the referenced files, or no longer matches the referenced smoke report contents. Use `pnpm release:finalize:partial` only for local/debug inspection of an incomplete artifact directory. During local finalization the wrapper auto-infers `release-manifest.json.repository` from `SDKWORK_RELEASE_REPOSITORY`, `GITHUB_REPOSITORY`, or `git remote origin`, and it preserves structured `status=skipped` deployment smoke evidence for `container` and `kubernetes` targets instead of treating those host-capability gaps as false passes.

## Environment Setup

Start from the root `.env.example`.

Important variables:

- AI capabilities require an active OpenClaw-compatible instance and Provider Center configuration
- `VITE_API_BASE_URL`: backend API base URL
- `VITE_APP_ID`: desktop update app id
- `VITE_RELEASE_CHANNEL`: desktop update release channel
- `CLAW_SERVER_HOST`: native server bind host
- `CLAW_SERVER_PORT`: native server listen port
- `CLAW_SERVER_DATA_DIR`: native server state directory

Desktop and browser hosts must not inject root access tokens through Vite env files. Keep privileged credentials inside trusted hosts or host-mediated auth flows.

Desktop-specific examples also exist in `packages/sdkwork-clawstudio-desktop/.env.example`, and server runtime defaults live in `packages/sdkwork-clawstudio-server/.env.example`.

## Recommended Next Steps

- Read [Application Modes](/guide/application-modes) to choose the right host shape
- Read [Install And Deploy](/guide/install-and-deploy) for OS-specific and deployment-specific instructions
- Read [Architecture](/core/architecture) before moving code between packages
- Read [API Overview](/reference/api-reference) before building against the native server surface
- Read [Release And Deployment](/core/release-and-deployment) before planning server, Docker, or Kubernetes installs
- Read [Commands](/reference/commands) for verification and packaging scripts
