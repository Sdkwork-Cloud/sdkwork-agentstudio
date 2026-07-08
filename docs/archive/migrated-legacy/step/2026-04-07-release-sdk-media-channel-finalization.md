# Release SDK And Media Channel Finalization

## Objective

- Finalize the April 7 release hardening work before publishing from `main`.
- Keep local development on relative-path shared SDK sources while forcing release automation onto pinned GitHub refs.
- Align the channel workspace with the requested media-account grouping and names.
- Record the root cause and fix for the shared SDK parity false positive that was blocking release readiness on Windows.

## Problems Found

1. `config/shared-sdk-release-sources.json` was still pinned to older shared SDK commits even though the synchronized GitHub refs had already advanced.
2. The shared SDK parity script compared raw file bytes, so Windows `CRLF` local checkouts and GitHub `LF` release checkouts were reported as full-content drift.
3. The media-account tab existed, but the default media channels still surfaced older display names (`Sdkwork Chat` and `Wehcat`) instead of the requested media-account labels for the built-in `sdkworkchat` and `wehcat` entries.
4. The release notes mentioned internal channel ids instead of stable user-facing media-account descriptions.

## Root Cause Evidence

### Shared SDK parity failure

Fresh evidence gathered in this loop:

1. `node scripts/check-shared-sdk-release-parity.mjs` failed against the updated shared SDK refs with 1814 reported differences.
2. A direct package comparison using `git diff --no-index --ignore-cr-at-eol` between the local shared SDK source and the pinned GitHub checkout produced no semantic diff for representative files.
3. The failure pattern was therefore a line-ending-only mismatch, not a real content mismatch.

### Media channel naming gap

Fresh evidence gathered in this loop:

1. `packages/sdkwork-clawstudio-core/src/services/openClawConfigService.ts` still defined the built-in channels as `Sdkwork Chat` and `Wehcat`.
2. A new failing assertion in `packages/sdkwork-clawstudio-core/src/services/openClawConfigService.test.ts` reproduced the gap before the implementation change.

## Changes Landed

### Shared SDK release source alignment

- Updated `config/shared-sdk-release-sources.json` to the synchronized GitHub refs:
  - `retired generic app SDK package`: `0c2bd7feb1da5a0dc5dae3e7db9824404893f202`
  - `@sdkwork/sdk-common`: `892dd2585ebd9e40bc55653d34fd5fb91281bbda`

### Shared SDK parity hardening

- Added exported parity helpers in `scripts/check-shared-sdk-release-parity.mjs`.
- Normalized text-file line endings before hashing so `LF` and `CRLF` variants compare as the same content.
- Added a release-flow regression in `scripts/release-flow-contract.test.mjs` to lock that behavior.

### Media-account naming alignment

- Updated the built-in channel definitions in `packages/sdkwork-clawstudio-core/src/services/openClawConfigService.ts` so the media-account defaults now surface as the requested `sdkworkchat` and `wehcat` labels.
- Tightened `packages/sdkwork-clawstudio-core/src/services/openClawConfigService.test.ts` to keep those names under regression coverage.

### Release docs alignment

- Updated `docs/release/release-2026-04-07-03.md` to describe the media-account channels with stable rendered names and to mention the parity hardening.
- Updated `docs/core/release-and-deployment.md` to document that shared SDK parity normalizes line endings before comparing release refs to local sources.

## Verification

Fresh commands run in this loop:

```bash
node scripts/ci-flow-contract.test.mjs
node scripts/release-flow-contract.test.mjs
node --experimental-strip-types scripts/sdkwork-core-contract.test.ts
node --experimental-strip-types scripts/sdkwork-ui-contract.test.ts
node --experimental-strip-types scripts/sdkwork-channels-contract.test.ts
node --experimental-strip-types packages/sdkwork-clawstudio-ui/src/components/channelCatalogMeta.test.ts
node --experimental-strip-types packages/sdkwork-clawstudio-core/src/services/openClawConfigService.test.ts
node scripts/check-shared-sdk-release-parity.mjs
node scripts/release/render-release-notes.mjs --release-tag release-2026-04-07-03
pnpm lint
pnpm build
```

Observed result:

1. CI workflow contract passed.
2. Release workflow contract passed, including the new `LF` vs `CRLF` parity regression.
3. Core, UI, and channel parity contracts passed.
4. The new media-account naming assertions passed.
5. Shared SDK release parity passed against the pinned GitHub refs.
6. Release notes rendered successfully from `docs/release`.
7. Workspace lint passed.
8. Production web build passed.

## Status

- The repository is release-ready from a local verification perspective.
- The remaining steps are operational: commit on `main`, push, publish the `release-2026-04-07-03` tag, and confirm the GitHub Release completes successfully.
