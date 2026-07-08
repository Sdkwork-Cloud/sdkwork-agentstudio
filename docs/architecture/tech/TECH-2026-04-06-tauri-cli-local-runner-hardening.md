> Migrated from `docs/review/2026-04-06-tauri-cli-local-runner-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Tauri CLI Local Runner Hardening

## Problem

Desktop development failed before Tauri startup with:

- `'tauri.cmd' is not recognized as an internal or external command`
- `ELIFECYCLE Command failed with exit code 1`

The failure happened after the OpenClaw preparation and bundled-resource steps,
so the regression was in the desktop CLI launch path rather than in OpenClaw
runtime preparation itself.

## Root Cause

The desktop runner hardcoded the Windows command name to `tauri.cmd` in
`scripts/run-tauri-cli.mjs`.

That created an unstable dependency on shell `PATH` / `.bin` injection:

- `run-tauri-cli.mjs` used `tauri.cmd` on Windows and `tauri` on Unix.
- the current workspace did have `node_modules/@tauri-apps/cli/tauri.js`
  available locally.
- the current workspace did not expose a usable `node_modules/.bin/tauri`
  path from the executed shell.
- `pnpm exec tauri --version` also failed in this environment, so replacing
  `tauri.cmd` with `pnpm exec tauri` would not have fixed the real problem.

In short: the CLI dependency existed, but the runner depended on shell
discovery instead of explicit local resolution.

## Options Considered

### Option 1: keep using `tauri(.cmd)`

Rejected.

It depends on global PATH or package-manager-generated shims, which is exactly
what failed.

### Option 2: switch to `pnpm exec tauri`

Rejected.

It is better than hardcoded `tauri.cmd`, but it still depends on pnpm bin
resolution being healthy in the current execution context. In this workspace
that path also failed.

### Option 3: resolve `@tauri-apps/cli/tauri.js` locally and run it with Node

Accepted.

This is the most stable path because it:

- uses the installed workspace dependency directly
- avoids shell-specific command lookup
- works across `tauri:dev`, `tauri:info`, and `tauri:icon`
- keeps behavior consistent on Windows, Linux, and macOS

## Implemented Changes

### 1. Hardened `scripts/run-tauri-cli.mjs`

Added explicit local CLI resolution:

- resolve `@tauri-apps/cli/package.json` and `@tauri-apps/cli/tauri.js`
  through Node resolution
- fall back to the workspace `node_modules/@tauri-apps/cli/tauri.js` path
- fail fast with a clear error when the local CLI entrypoint cannot be found

Changed execution strategy:

- command is now `process.execPath`
- first argument is the resolved local `tauri.js` entrypoint
- `shell` is now always `false`

This removes the dependency on `tauri.cmd`, `tauri`, and shell PATH lookup.

### 2. Unified desktop package CLI entrypoints

Updated `packages/sdkwork-clawstudio-desktop/package.json`:

- `tauri:icon` now runs `node ../../scripts/run-tauri-cli.mjs icon src-tauri/app-icon.svg`
- `tauri:info` now runs `node ../../scripts/run-tauri-cli.mjs info`

This prevents the same PATH regression from reappearing through non-dev
desktop scripts.

### 3. Added and updated regression coverage

Updated tests:

- `scripts/run-tauri-cli.test.mjs`
- `scripts/tauri-dev-command-contract.test.mjs`

The new assertions lock:

- local `@tauri-apps/cli/tauri.js` resolution
- Node-based execution instead of `tauri(.cmd)`
- `shell: false`
- desktop `tauri:info` / `tauri:icon` using the shared runner

## Verification

Focused regression and contract verification:

- `node scripts/run-tauri-cli.test.mjs`
- `node scripts/tauri-dev-command-contract.test.mjs`
- `node scripts/check-desktop-platform-foundation.mjs`

Real command-path verification:

- `node scripts/run-tauri-cli.mjs info`
- `pnpm.cmd --dir packages/sdkwork-clawstudio-desktop tauri:info`
- `pnpm.cmd tauri:info`

Broader regression sweep:

- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

## Result

The original startup failure caused by missing `tauri.cmd` is closed.

The desktop Tauri command chain now uses a deterministic local CLI path and no
longer depends on:

- global Tauri installation
- shell PATH mutation
- pnpm `.bin` exposure
- Windows-only `.cmd` lookup behavior

## Remaining Follow-Up

This fix closes the command-launch regression only. It does not by itself
upgrade all Tauri package versions.

Current observations from `tauri info` in this workspace:

- Rust-side `tauri` reported `2.10.3`
- JavaScript `@tauri-apps/cli` reported `2.10.1`

That version skew should be reviewed in a separate iteration if the goal is to
fully converge the entire Tauri toolchain to one target version with release
validation across desktop packaging flows.

