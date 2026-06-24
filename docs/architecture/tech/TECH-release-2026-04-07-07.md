> Migrated from `docs/release/release-2026-04-07-07.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Carried forward every unpublished April 7 change from `release-2026-04-07-01` through `release-2026-04-07-06` into one final release candidate.
- Closed the remaining clean-room release smoke gaps that still existed after the IM SDK portability fixes:
  - tracked Windows Tauri runtime config in the repository
  - portable tar test fixtures for Linux long-path release bundles
  - cross-platform release CLI path parsing that preserves explicit Windows paths on Linux hosts
- Triggered the next GitHub release attempt and exposed the last OpenClaw clean-clone verification gaps that still only existed on Linux-hosted release jobs.
- Preserved the local relative-path shared SDK development model while keeping GitHub release automation pinned to Git-backed shared SDK sources.

## Attempt Outcome

- This candidate did not publish a GitHub Release object.
- GitHub Actions run `24073460127` for tag `release-2026-04-07-07` failed in `release / Verify release inputs`.
- The first clean-clone failure was `scripts/openclaw-release-contract.test.mjs`, which assumed `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json` already existed in a clean checkout even though that runtime manifest is generated during preparation.
- After that contract issue was fixed locally, the next Linux-hosted failure moved into `scripts/prepare-openclaw-runtime.test.mjs`: `syncArchiveOnlyBundledResourceRoot()` used `path.win32` for real filesystem access whenever `platform=win32`, which rewrote POSIX temp paths like `/tmp/...` into invalid `\\tmp\\...` lookups.
- The unpublished change log from this attempt is carried forward into `release-2026-04-07-08`.

## Verification Focus

- Confirm `node scripts/openclaw-release-contract.test.mjs` no longer requires generated runtime output to be tracked in the repository.
- Confirm `node scripts/prepare-openclaw-runtime.test.mjs` preserves POSIX host paths while still exercising Windows-target packaged-resource behavior.
- Confirm `pnpm check:desktop` continues to pass after the OpenClaw clean-clone hardening.
- Confirm the next release candidate completes `release / Verify release inputs` on GitHub and publishes the first successful April 7 GitHub Release object.

