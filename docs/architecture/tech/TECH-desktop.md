> Migrated from `docs/core/desktop.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Desktop Runtime

## Overview

Agent Studio ships a Tauri desktop runtime through `@sdkwork/agentstudio-pc-desktop`. It reuses the shared shell and product feature packages while adding native runtime integration, update checks, and packaging commands.

## Important Paths

- `packages/sdkwork-agentstudio-pc-desktop/src/main.tsx`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/createDesktopApp.tsx`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/catalog.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/runtime.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/providers/DesktopProviders.tsx`
- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/`

The template-grade bridge surface is documented in [Desktop Template API](./desktop-template.md).

## Run Desktop Development

```bash
pnpm dev:desktop
```

The desktop package uses a dedicated Vite command for Tauri development on `127.0.0.1:1426`.

## Startup Contract

Desktop startup is intentionally non-blocking for the built-in OpenClaw runtime:

- the Tauri shell window is revealed first
- desktop runtime metadata and shell bootstrap complete before the app is considered launchable
- built-in OpenClaw readiness continues in the background instead of blocking the first window paint
- a built-in OpenClaw readiness failure does not abort desktop launch
- background failures surface through retry and details actions in the desktop UI
- startup evidence is persisted to `diagnostics/desktop-startup-evidence.json`

This avoids the previous failure mode where a slow or temporarily unhealthy built-in OpenClaw gateway prevented the desktop shell from opening at all.

## Build The Desktop App

```bash
pnpm build:desktop
```

Useful supporting commands:

```bash
pnpm check:desktop
```

`pnpm check:desktop` is the main regression gate for desktop packaging, hosted runtime readiness, built-in OpenClaw installation, and startup evidence contracts.

Desktop is now one release family inside the broader packaging system. The GitHub release flow keeps the desktop bundle path stable while adding native server, container, kubernetes, and web artifact families in parallel.

## Environment Model

Desktop runtime behavior relies on typed environment configuration from the infrastructure layer. Common variables include:

- `VITE_API_BASE_URL`
- `VITE_APP_ID`
- `VITE_RELEASE_CHANNEL`
- `VITE_DISTRIBUTION_ID`
- `VITE_PLATFORM`
- `VITE_TIMEOUT`
- `VITE_ENABLE_STARTUP_UPDATE_CHECK`

Desktop shells keep privileged credentials in trusted hosts or host-mediated auth flows rather than injecting root tokens through Vite env.

The root `.env.example` and `packages/sdkwork-agentstudio-pc-desktop/.env.example` document these values.

## Troubleshooting `pnpm dev:desktop`

If `pnpm dev:desktop` fails before Tauri starts, read the Rust preflight output carefully.

When the guard reports:

- `Blocked command(s): cargo, rustc`
- `Node child-process blocker(s): cmd.exe, powershell.exe`

the problem is not the built-in OpenClaw startup path. It means the current `node.exe` process is not allowed to launch Windows executables, so Tauri cannot start at all.

In that situation:

1. Run `cargo --version` and `rustc --version` directly in the same terminal.
2. If those commands work in the shell but `pnpm dev:desktop` still fails, `node.exe` is being blocked from spawning child processes.
3. Confirm the resolved executables with `where.exe cargo`, `where.exe rustc`, `Get-Command cargo`, or `Get-Command rustc`.
4. Check endpoint security, application allowlists, execution policy, WDAC/AppLocker rules, and any sandbox or remote-dev restrictions applied to `node.exe`.
5. Re-run `pnpm dev:desktop` only after Node child-process execution is allowed again.

If desktop startup reaches the UI but the built-in OpenClaw runtime is still unhealthy, inspect the persisted startup evidence at `diagnostics/desktop-startup-evidence.json` and use the in-app retry/details actions from the built-in instance screen.

## Desktop Architecture Notes

- the desktop entry package stays thin
- shell composition remains in `@sdkwork/agentstudio-pc-shell`
- update and configuration logic flow through shared infrastructure and core layers
- native execution and packaging live under `src-tauri`
- the standard desktop bridge now exposes a template API with command catalog, event catalog, grouped domain facades, and a normalized bridge error model

This split matters because the desktop runtime must stay aligned with the same UI and feature surface used by the web application.

