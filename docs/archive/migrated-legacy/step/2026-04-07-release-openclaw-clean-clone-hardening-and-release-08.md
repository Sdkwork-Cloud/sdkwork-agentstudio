# Release OpenClaw Clean-Clone Hardening And Release 08

## Objective

- Investigate why `release-2026-04-07-07` still failed in GitHub Actions after the broader cross-platform release-flow hardening.
- Close the remaining OpenClaw clean-clone verification gaps that only appeared on Linux-hosted release jobs.
- Record the carried-forward release evidence for the next publication candidate.

## Problems Found

1. `release-2026-04-07-07` failed in GitHub Actions run `24073460127` during `release / Verify release inputs`.
2. `scripts/openclaw-release-contract.test.mjs` assumed `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json` already existed in a clean checkout, but that file is generated only after the OpenClaw runtime is prepared.
3. `scripts/prepare-openclaw-runtime.mjs` conflated the requested target platform with the active host filesystem semantics. When Linux-hosted verification exercised `platform: 'win32'`, it used `path.win32` for real filesystem paths under `/tmp/...`, which rewrote host paths into invalid `\\tmp\\...` lookups.
4. The Windows short-mirror resolver normalized explicit POSIX mirror roots into Windows-style paths, which made Linux-hosted verification drift away from the actual host-accessible paths it needed to use.

## Root Cause Evidence

### Clean-clone OpenClaw contract drift

1. The previous release attempt had already shown that the first failing clean-clone assertion came from `scripts/openclaw-release-contract.test.mjs`.
2. The contract read `resources/openclaw/manifest.json` directly from the tracked workspace even though the repository intentionally tracks only `.gitkeep` under `resources/openclaw`.
3. That meant a developer machine with prepared local runtime artifacts could pass while a clean GitHub checkout failed.

### Host-path versus target-path drift

1. `syncArchiveOnlyBundledResourceRoot()` and `repairArchiveOnlyBundledResourceRootInPlace()` selected `path.win32` whenever `platform` was `win32` or `windows`.
2. In Linux-hosted verification, the source and staging roots were real POSIX temp paths under `/tmp/...`, but joining them through `path.win32` produced `\\tmp\\...` paths that did not exist on the host filesystem.
3. The Windows mirror-root resolver also rewrote explicit POSIX mirror roots into Windows-style paths, so the archive-only mirror test could not stay on host-accessible directories when simulating Windows-target packaging from Linux.

## Changes Landed

### OpenClaw clean-clone contract hardening

- Updated `scripts/openclaw-release-contract.test.mjs` so it only reads `resources/openclaw/manifest.json` when that prepared artifact actually exists.
- Strengthened the clean-clone contract around `packages/sdkwork-claw-desktop/src-tauri/build.rs` instead:
  - the desktop build must read `config/openclaw-release.json`
  - the desktop build must export `SDKWORK_BUNDLED_OPENCLAW_VERSION`

### Host-safe packaged-resource path handling

- Added `resolveBundledResourceFsPathApi()` to `scripts/prepare-openclaw-runtime.mjs`.
- Split host filesystem path handling from target-platform semantics when repairing and staging archive-only bundled resource roots.
- Preserved explicit POSIX mirror roots for Linux-hosted verification while still keeping real Windows drive and UNC paths on `path.win32`.
- Changed the default Windows-target mirror root for POSIX workspaces to a host-accessible `.cache/short-mirrors` directory instead of synthesizing an unusable Windows short path.

### Regression coverage

- Extended `scripts/prepare-openclaw-runtime.test.mjs` with contract checks for:
  - POSIX mirror base-dir preservation under `platform: 'win32'`
  - POSIX mirror-root preservation under `platform: 'win32'`
  - host-path API selection for POSIX and Windows-style runtime roots

## Verification

Fresh commands run in this loop:

```bash
node scripts/openclaw-release-contract.test.mjs
node scripts/prepare-openclaw-runtime.test.mjs
pnpm check:desktop
```

Observed result:

1. `scripts/openclaw-release-contract.test.mjs` passes without requiring generated OpenClaw runtime artifacts to be tracked in git.
2. `scripts/prepare-openclaw-runtime.test.mjs` passes with the new POSIX-on-win32 path contracts in place.
3. `pnpm check:desktop` passes end to end, including the OpenClaw release-contract and bundled-runtime preparation suites.

Additional note:

- The local Docker Desktop WSL shell on this machine is too stripped down to serve as a complete Linux clean-room by itself because it lacks a usable Linux Node/corepack userland. The new contract tests therefore lock the exact POSIX-host-path scenario directly in-process, and GitHub Actions remains the authoritative Linux-hosted publication verifier for `release-2026-04-07-08`.

## Status

- `release-2026-04-07-07` is now clearly a failed unpublished attempt and should not remain the active release candidate.
- The next carried-forward candidate is `release-2026-04-07-08`.
- Remaining operational work: run the final workspace verification set, commit the fixes on `main`, push them, create `release-2026-04-07-08`, and confirm the GitHub release workflow publishes successfully.
