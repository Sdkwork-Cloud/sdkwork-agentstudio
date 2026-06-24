> Migrated from `docs/release/release-2026-04-07-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Carried forward every unpublished April 7 change from `release-2026-04-07-01` through `release-2026-04-07-07` into one release candidate.
- Hardened `scripts/openclaw-release-contract.test.mjs` so clean clones validate the desktop OpenClaw release contract without depending on generated runtime artifacts being tracked in git.
- Hardened `scripts/prepare-openclaw-runtime.mjs` so Windows-target OpenClaw packaging uses host-accessible filesystem paths for real file operations while still preserving Windows semantics for real Windows paths.
- Added explicit contract coverage for POSIX mirror roots and host-path selection in `scripts/prepare-openclaw-runtime.test.mjs`.
- Preserved the local relative-path shared SDK development workflow while keeping GitHub release automation pinned to Git-backed shared SDK sources.

## Attempt Outcome

- This candidate did not publish a GitHub Release object.
- GitHub Actions run `24076080749` for tag `release-2026-04-07-08` failed after publication moved beyond the earlier clean-clone release checks.
- The remaining blocker was the desktop release-verification surface:
  - the embedded-host public studio/workbench provider was cloned before the live desktop `manage_openclaw_provider` replaced the server control plane
  - shared detail deserialization still attempted to decode `workbench: null`
  - the mirror-import gateway fixture no longer satisfied the runtime readiness contract
  - two desktop Rust tests still asserted stale offline projection behavior
- The unpublished change log from this attempt is carried forward into `release-2026-04-07-09`.

## Verification Focus

- Confirm the carried-forward release candidate passes:
  - `node scripts/openclaw-release-contract.test.mjs`
  - `node scripts/prepare-openclaw-runtime.test.mjs`
  - `pnpm check:desktop`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm docs:build`
  - `pnpm check:server`
- Confirm `node scripts/release/render-release-notes.mjs --release-tag release-2026-04-07-08` renders one merged release body that includes `release-2026-04-07-01` through `release-2026-04-07-07`.
- Confirm the next release candidate repairs the desktop embedded-host verification drift and publishes the first successful April 7 GitHub Release object.

