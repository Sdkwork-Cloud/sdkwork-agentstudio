> Migrated from `docs/review/2026-04-06-openclaw-release-metadata-parity-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 OpenClaw Release Metadata Parity Hardening

## Scope

This iteration continued the OpenClaw bundled-version work after the earlier
source audit confirmed that `2026.4.2` is still the latest stable upstream
release as of `2026-04-06`.

The goal here was not to bump the version number again. The goal was to harden
the source-of-truth chain so the shared release metadata projects the full
bundled runtime contract consistently into both:

- desktop packaged runtime assets
- TypeScript runtime/frontend consumers

## Root Cause

The earlier audit proved that the active stable version chain was already
centralized around `config/openclaw-release.json`, but one parity gap still
remained:

- `config/openclaw-release.json` included `runtimeSupplementalPackages`
- `scripts/openclaw-release.mjs` exposed that field
- `packages/sdkwork-claw-types/src/openclawRelease.ts` did not expose it to the
  TypeScript/shared-runtime side

That meant the version source-of-truth was centralized, but the bundled runtime
supplement metadata was still only partially projected across the codebase.

At the same time, the release contract did not yet explicitly assert that the
checked-in desktop bundled runtime manifest under:

- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json`

stayed aligned with the same shared release metadata.

## Changes Landed

### 1. Shared TypeScript release metadata now exposes runtime supplemental packages

File:

- `packages/sdkwork-claw-types/src/openclawRelease.ts`

Behavior change:

- `OpenClawReleaseMetadata` now includes `runtimeSupplementalPackages`
- the field is normalized into a trimmed string array
- the package now exports:
  - `OPENCLAW_RELEASE.runtimeSupplementalPackages`
  - `DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES`

This closes the TS-side metadata parity gap with the Node release helper.

### 2. The OpenClaw release contract now checks packaged manifest parity too

File:

- `scripts/openclaw-release-contract.test.mjs`

Behavior change:

- the contract now asserts:
  - `runtimeSupplementalPackages` stays pinned in `config/openclaw-release.json`
  - `packages/sdkwork-claw-types/src/openclawRelease.ts` projects the field
  - `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json`
    matches the shared `stableVersion`
  - the same manifest matches the shared bundled Node.js version

This means future drift will now break the mandatory desktop gate instead of
silently surviving review.

## Verification Evidence

The following commands were executed on the final code state:

- `node scripts/openclaw-release-contract.test.mjs`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

All of the above passed in this iteration.

## Impact

This pass does not change the shipping OpenClaw version. Instead, it improves
correctness of the bundled-release architecture:

1. the repository now exposes the full OpenClaw bundled runtime supplement
   metadata to TypeScript consumers, not just the version/package/node triple
2. desktop packaged runtime assets are now more tightly guarded against drifting
   away from the shared release metadata
3. future "latest version" reviews have a stricter contract baseline and a
   clearer explanation for why `2026.4.2` is still correct on `2026-04-06`

## Remaining Gaps

The main unresolved items are now outside the version-source question:

1. real launched-session evidence for built-in OpenClaw runtime, gateway,
   websocket, and built-in instance alignment
2. packaged first-launch smoke on real Windows, Linux, and macOS environments
3. chat / file list / notification / cron / instance-detail end-to-end
   validation on top of the hardened runtime authority chain

## Next Iteration

1. move back to live runtime evidence, especially the built-in OpenClaw startup
   path inside an actually launched desktop session
2. continue the system review matrix for chat, files, workbench, proxy router,
   and instance-detail correctness
3. keep the bundled version pinned at `2026.4.2` until the upstream stable
   release actually changes

