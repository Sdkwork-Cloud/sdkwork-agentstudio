# OpenClaw v2026.4.5 Language Label Autonym Cleanup

> Correction on 2026-04-07: the public GitHub Releases baseline re-check showed latest stable
> OpenClaw is `v2026.4.2` released on `2026-04-02`, not `v2026.4.5`. This file is retained only as
> a historical implementation log from a stale audit target. Use
> `docs/step/2026-04-07-openclaw-public-release-baseline-correction.md` as the current baseline
> truth.

## Scope

- Re-check the shared language-label metadata after the language-surface truthfulness landing.
- Close any remaining supported-language labels that still used English exonyms instead of
  native/autonym labels.

## Step 1: Finding from the follow-up review

The previous language-surface loop correctly moved most labels to native names, but a small
metadata inconsistency remained in `packages/sdkwork-claw-i18n/src/config.ts`:

- `pl` still rendered as `Polish`
- `id` still rendered as `Indonesian`

Why this still mattered:

1. The same shared `LANGUAGE_LABELS` map drives the language picker across every host mode.
2. The earlier audit had already claimed native-label improvements, so leaving two English exonyms
   behind weakened that claim.
3. This was a low-risk shared-metadata defect with an obvious, testable correction.

## Step 2: TDD execution

Red phase:

- Added failing assertions to `packages/sdkwork-claw-i18n/src/index.test.ts`:
  - `LANGUAGE_LABELS.pl === 'Polski'`
  - `LANGUAGE_LABELS.id === 'Bahasa Indonesia'`
- Verified the expected failure with:
  - `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
- Failure confirmed the real defect:
  - `'Polish' !== 'Polski'`

Green phase:

- Updated `packages/sdkwork-claw-i18n/src/config.ts`:
  - `pl` -> `Polski`
  - `id` -> `Bahasa Indonesia`

## Step 3: Verification evidence

- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
  - passed
- `pnpm.cmd check:i18n`
  - passed

## Step 4: Status after this cleanup

Improved locally:

1. The supported-language label set now uses native/autonym labels consistently for the current
   surface.
2. The earlier language-surface truthfulness work is now internally self-consistent.

Still unchanged:

1. Dedicated translation-bundle parity is still incomplete; this cleanup only fixed label metadata.
2. Bundled runtime upgrade and live packaged smoke remain the larger outstanding blockers.
