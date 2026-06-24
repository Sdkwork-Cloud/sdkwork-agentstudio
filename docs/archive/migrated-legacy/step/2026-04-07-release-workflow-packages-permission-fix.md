# Release Workflow Packages Permission Fix

## Objective

- Close the last release blocker after the OpenClaw parity upgrade was already merged to `main`.
- Make GitHub tag-triggered release runs start reliably instead of dying at workflow bootstrap.
- Add an automated contract so the release caller workflow cannot silently lose required permissions again.

## Problem Found

`release-2026-04-07-01` was pushed successfully, but GitHub Actions did not create a release.

Fresh evidence gathered in this loop:

1. the tag existed locally and remotely
2. the GitHub Release endpoint for `release-2026-04-07-01` returned `404`
3. the latest `release.yml` workflow run for that tag finished with `startup_failure`
4. the run had no jobs, which pointed to workflow bootstrap validation rather than a runtime build failure

Root cause from the GitHub run page:

```text
The workflow is not valid.
.github/workflows/release.yml (Line: 23, Col: 13):
The nested job 'release' is requesting 'packages: write', but is only allowed 'packages: none'.
```

## Design Decision

Keep the fix minimal and preventive:

1. add `packages: write` to the caller workflow at `.github/workflows/release.yml`
2. extend the existing release workflow contract test so it explicitly requires that permission on
   the caller workflow too
3. verify the release contract red first, then green, then rerun the full workspace `lint` and
   `build`

## TDD Record

### Red

First, the release workflow contract was tightened in:

- `scripts/release-flow-contract.test.mjs`

New expectation:

1. `.github/workflows/release.yml` must grant `packages: write` before invoking the reusable
   release workflow

Fresh red command:

```bash
node scripts/release-flow-contract.test.mjs
```

Observed failure:

1. the contract failed on the caller workflow because `packages: write` was missing
2. that failure matched the GitHub startup failure exactly

### Green

Then the minimal workflow fix landed in:

- `.github/workflows/release.yml`

Fresh green commands:

```bash
node scripts/release-flow-contract.test.mjs
pnpm.cmd lint
pnpm.cmd build
```

Observed result:

1. release workflow contract passed
2. full workspace lint passed
3. production build passed

## Fix Landed

### 1. Caller workflow now grants the required package publishing permission

Updated:

- `.github/workflows/release.yml`

Change:

1. added `packages: write` beside the existing `contents`, `attestations`, and `id-token`
   permissions

Why this is required:

1. GitHub validates reusable workflow permissions at startup
2. the called `release-reusable.yml` already requests `packages: write`
3. without the caller granting it, the whole release workflow is rejected before jobs even start

### 2. Release workflow contract now guards the caller permission surface

Updated:

- `scripts/release-flow-contract.test.mjs`

Change:

1. added a contract assertion that `release.yml` includes `packages: write`

Impact:

1. future edits that drop the permission will fail locally in `pnpm lint`
2. the regression is caught before another broken release tag is pushed

## Verification

Fresh commands run in this loop:

```bash
git push origin refs/tags/release-2026-04-07-01
curl.exe -s https://api.github.com/repos/Sdkwork-Cloud/claw-studio/actions/workflows/release.yml/runs?per_page=5
node scripts/release-flow-contract.test.mjs
pnpm.cmd lint
pnpm.cmd build
```

Results:

1. the original release tag push succeeded
2. GitHub Actions confirmed the original run failed at startup, not during packaging
3. the tightened release contract failed red before the workflow fix
4. the same contract passed green after the workflow fix
5. lint passed
6. build passed

## Outcome

This loop closed the real release blocker instead of masking it:

1. the failure was traced to GitHub reusable workflow permission inheritance
2. the caller workflow now grants the exact permission the release pipeline needs
3. local automation now guards the same condition before future release tags are published

## Next Step

With the workflow fixed and verified locally, the correct release recovery path is:

1. commit the workflow and contract change to `main`
2. push `main`
3. publish a new release tag so GitHub Actions starts from the fixed workflow revision
4. verify the workflow concludes successfully and the GitHub Release is created
