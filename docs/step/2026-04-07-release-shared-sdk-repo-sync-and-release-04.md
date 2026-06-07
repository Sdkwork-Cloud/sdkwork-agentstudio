# Release Shared SDK Repo Sync And Release 04

## Objective

- Eliminate the GitHub release blocker caused by missing `@sdkwork/core-pc-react` sources in CI.
- Align the GitHub release-source pins with the actual local shared SDK workspaces that Claw Studio consumes.
- Publish a new release tag that carries forward all unpublished April 7 release attempts.

## Problems Found

1. `release-2026-04-07-03` failed before publication because the release verification job could not resolve `@sdkwork/core-pc-react/app`, `@sdkwork/core-pc-react/env`, and `@sdkwork/core-pc-react/runtime`.
2. `scripts/prepare-shared-sdk-git-sources.mjs` only materialized `retired generic app SDK package` and `@sdkwork/sdk-common`, so the release workflow still depended on the local sibling `../sdkwork-core/sdkwork-core-pc-react` path.
3. The public `Sdkwork-Cloud/sdkwork-core` repository existed but was empty, so switching Claw Studio to that GitHub repo would still have failed until the package content was published there.
4. The configured `retired generic app SDK package` release pin no longer matched the local source-of-truth package root, so parity verification failed even after `sdkwork-core` was fixed.

## Root Cause Evidence

### Release failure evidence

1. The failed GitHub Actions run for `release-2026-04-07-03` stopped in `Verify release inputs`.
2. The failing diagnostics reported missing module resolution for:
   - `@sdkwork/core-pc-react/app`
   - `@sdkwork/core-pc-react/env`
   - `@sdkwork/core-pc-react/runtime`
3. Local inspection showed:
   - `pnpm-workspace.yaml` includes `../sdkwork-core/sdkwork-core-pc-react`
   - host `tsconfig.json` files hard-map `@sdkwork/core-pc-react` to that sibling path
   - the release preparation helper did not materialize that package from GitHub

### Shared SDK repo state evidence

1. `https://api.github.com/repos/Sdkwork-Cloud/sdkwork-core/contents/` returned `This repository is empty.` before synchronization.
2. `node scripts/check-shared-sdk-release-parity.mjs` failed after the core fix because `retired generic app SDK package` still drifted from the pinned GitHub commit.
3. Local `sdkwork-sdk-app` inspection showed the workspace had changes beyond the previously pinned ref, so the GitHub repo needed to be advanced before parity could pass.

## Changes Landed

### Claw Studio release-source support

- Added `@sdkwork/core-pc-react` support to `scripts/prepare-shared-sdk-git-sources.mjs`, including:
  - GitHub repo default
  - config-driven ref pinning
  - materialized package root at `../sdkwork-core/sdkwork-core-pc-react`
- Extended `scripts/check-shared-sdk-release-parity.mjs` so parity now covers:
  - `retired generic app SDK package`
  - `@sdkwork/sdk-common`
  - `@sdkwork/core-pc-react`
- Updated `docs/core/release-and-deployment.md` to document the expanded parity scope.

### External shared SDK repo synchronization

- Published the current `sdkwork-core` workspace snapshot to `https://github.com/Sdkwork-Cloud/sdkwork-core.git`.
- Published the current `sdkwork-sdk-app` workspace snapshot to `https://github.com/Sdkwork-Cloud/sdkwork-sdk-app.git`.
- Updated `config/shared-sdk-release-sources.json` to pin:
  - `retired generic app SDK package`: `e7bc761ce45acf142721b96f732b361c77a71e73`
  - `@sdkwork/sdk-common`: `892dd2585ebd9e40bc55653d34fd5fb91281bbda`
  - `@sdkwork/core-pc-react`: `b30bab1f67a696e903a753000282018ace673e13`

### Release documentation alignment

- Marked `release-2026-04-07-03` as a failed unpublished attempt in the registry.
- Added `release-2026-04-07-04` as the carried-forward release candidate that subsumes `01`, `02`, and `03`.
- Updated `release-2026-04-07-03.md` to use stable ASCII descriptions for the media-account defaults to avoid GitHub rendering issues.

## Verification

Fresh commands run in this loop:

```bash
node scripts/release-flow-contract.test.mjs
node --experimental-strip-types scripts/sdkwork-core-contract.test.ts
node scripts/check-shared-sdk-release-parity.mjs
```

Observed result:

1. The release-flow contract passed with the new `core-pc-react` source coverage.
2. The Claw core contract passed with the expanded shared SDK registry assertions.
3. Shared SDK parity passed for all three pinned GitHub refs after the external repo synchronization.

## Status

- The GitHub release blocker for `@sdkwork/core-pc-react` is resolved.
- The GitHub-pinned shared SDK sources now match the local Claw Studio source-of-truth workspaces.
- The next step is to run the full workspace verification, commit the Claw Studio changes, push `main`, publish `release-2026-04-07-04`, and confirm the GitHub release object exists.
