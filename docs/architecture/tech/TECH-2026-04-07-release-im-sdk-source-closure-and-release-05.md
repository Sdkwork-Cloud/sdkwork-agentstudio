> Migrated from `docs/step/2026-04-07-release-im-sdk-source-closure-and-release-05.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Release IM SDK Source Closure And Release 05

## Objective

- Close the remaining GitHub release blocker after `release-2026-04-07-04` failed.
- Keep local development on relative sibling SDK workspaces while keeping release automation on pinned GitHub refs.
- Verify that the requested channels media-account behavior is already implemented and protected by regression coverage.
- Produce a new release candidate that carries forward every unpublished April 7 change set.

## Problems Found

1. `release-2026-04-07-04` was marked as published in `docs/release/releases.json`, but the actual GitHub workflow run failed and no GitHub Release object existed for that tag.
2. The failed `release-2026-04-07-04` workflow stopped in `Verify release inputs` because the GitHub-backed release workspace did not materialize the IM SDK packages required by `@sdkwork/core-pc-react`.
3. The release documentation still described shared SDK parity as covering only `retired generic app SDK package`, `@sdkwork/sdk-common`, and `@sdkwork/core-pc-react`, even though the release-ready closure now also depends on the IM SDK package roots.
4. The product request for a `媒体账号` tab and the two media-account entries needed to be rechecked against current code so the release notes would not claim an unverified UI state.

## Root Cause Evidence

### Release failure evidence

1. The public GitHub Actions run for `release-2026-04-07-04` is `24067295034`.
2. That run completed with `conclusion=failure` on April 7, 2026.
3. The GitHub Release REST lookup for `release-2026-04-07-04` returned `404 Not Found`, proving that no release object was published for that tag.
4. Earlier failure annotations for that run identified the missing packages:
   - `@sdkwork/im-sdk`
   - `@sdkwork/rtc-sdk`

### Shared SDK parity evidence

1. `node scripts/check-shared-sdk-release-parity.mjs` now passes after the IM SDK source materialization changes and the external `sdkwork-im-sdk` TypeScript release commit `06e92a2e6a2946de05501a4d2785d7e0a4349bb9`.
2. The parity result confirms that the release-relevant package roots match their pinned GitHub refs even though the broader sibling repositories still contain unrelated dirty work outside the release scope.
3. This is the correct release gate because Claw Studio consumes only the package roots listed in `pnpm-workspace.yaml` and `config/shared-sdk-release-sources.json`, not every unrelated file in those external repositories.

### Media-account surface evidence

1. `packages/sdkwork-clawstudio-ui/src/components/ChannelRegionTabs.tsx` already defines the region order as `['domestic', 'global', 'media', 'all']`, so `媒体账号` is already before `全部`.
2. `packages/sdkwork-clawstudio-core/src/services/openClawConfigService.ts` already exposes:
   - `SDKWORK公众号`
   - `微信公众号`
3. `scripts/sdkwork-ui-contract.test.ts` already locks:
   - the `media` tab
   - the `all` tab
   - the tab ordering
   - the `sdkworkchat` and `wehcat` region assignments

## Changes Landed

### Release source closure

- Added GitHub-backed IM SDK source definitions to:
  - `config/shared-sdk-release-sources.json`
  - `scripts/prepare-shared-sdk-git-sources.mjs`
  - `scripts/check-shared-sdk-release-parity.mjs`
- Extended release regression coverage in:
  - `scripts/release-flow-contract.test.mjs`
  - `scripts/sdkwork-core-contract.test.ts`

### Release documentation correction

- Corrected `release-2026-04-07-04` to a failed unpublished attempt.
- Added `release-2026-04-07-05` as the new publishable carried-forward release entry.
- Updated `docs/core/release-and-deployment.md` so the shared SDK parity contract now documents the IM SDK package roots as first-class release inputs.

### Product-state verification

- Reverified that the requested `媒体账号` tab already exists before `全部`.
- Reverified that the media-account set already includes:
  - `SDKWORK公众号` as the built-in default integrated channel
  - `微信公众号`
- Chose not to make redundant UI code changes because the current implementation already satisfies the requested product behavior and is covered by regression contracts.

## Verification

Fresh commands run in this loop:

```bash
node scripts/check-shared-sdk-release-parity.mjs
git -C ../sdkwork-core status --short -- sdkwork-core-pc-react
git -C ../../retired Spring app SDK source tree status --short -- retired generic app SDK TypeScript package
git -C ../../sdk/sdkwork-sdk-commons status --short -- sdkwork-sdk-common-typescript
git -C ../sdkwork-im/sdks/sdkwork-im-sdk status --short -- sdkwork-im-sdk-typescript
git -C ../sdkwork-im/sdks/sdkwork-rtc-sdk status --short -- sdkwork-rtc-sdk-typescript
```

Observed result:

1. Shared SDK release parity passed for all six pinned package roots.
2. The IM SDK release-relevant TypeScript package roots are clean relative to their published GitHub commit.
3. The app SDK and sdk-common repositories still contain broader local work, but the release gate confirms that the package roots consumed by Claw Studio still match the pinned GitHub refs.
4. The media-account tab and channel set were verified from source and existing regression tests, so no additional UI code change was necessary for this requirement.

## Status

- The release metadata is corrected and ready for `release-2026-04-07-05`.
- The remaining work is operational verification, commit, push, tag push, and GitHub release confirmation.

