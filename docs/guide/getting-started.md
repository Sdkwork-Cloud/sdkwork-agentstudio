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

This starts the Vite development server for `@sdkwork/claw-web` on `http://localhost:3001`.

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
```

Use `pnpm check:automation` to validate release and CI workflow contracts before changing packaging automation, `pnpm release:plan` to inspect the current multi-family release matrices before packaging or CI changes, and `pnpm release:finalize` after aggregating packaged artifacts into the active release asset directory. The local wrapper defaults that directory to `artifacts/release`, while GitHub workflows use `release-assets/`. During local finalization the wrapper now auto-infers `release-manifest.json.repository` from `SDKWORK_RELEASE_REPOSITORY`, `GITHUB_REPOSITORY`, or `git remote origin`, and it preserves structured `status=skipped` deployment smoke evidence for `container` and `kubernetes` targets instead of treating those host-capability gaps as false passes.

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

Desktop-specific examples also exist in `packages/sdkwork-claw-desktop/.env.example`, and server runtime defaults live in `packages/sdkwork-claw-server/.env.example`.

## Recommended Next Steps

- Read [Application Modes](/guide/application-modes) to choose the right host shape
- Read [Install And Deploy](/guide/install-and-deploy) for OS-specific and deployment-specific instructions
- Read [Architecture](/core/architecture) before moving code between packages
- Read [API Overview](/reference/api-reference) before building against the native server surface
- Read [Release And Deployment](/core/release-and-deployment) before planning server, Docker, or Kubernetes installs
- Read [Commands](/reference/commands) for verification and packaging scripts
