# OpenClaw Public Release Baseline Correction

## Scope

- Correct the OpenClaw public-release baseline used by the current `docs/step` audit trail.
- Distinguish the real current bundled-runtime state from the hypothetical `v2026.4.5` upgrade path.
- Record a fresh local verification loop so later review work does not continue from a stale target version.

## Public Baseline Re-check

Review date:

- 2026-04-07

Fresh public-source correction:

1. The publicly visible GitHub Releases baseline checked on 2026-04-07 is `v2026.4.2`, released on
   2026-04-02.
2. A fresh public search for `v2026.4.5` did not produce a corresponding public releases/tag page
   for OpenClaw.
3. That means the earlier `docs/step/2026-04-07-openclaw-v2026-4-5-*.md` audit trail was built on a
   stale or incorrect external baseline assumption and must no longer be treated as release-truth
   evidence.

Public sources rechecked:

- `https://github.com/openclaw/openclaw/releases`
- `https://github.com/openclaw/openclaw/releases/tag/v2026.4.2`

## Local Workspace Baseline Re-check

Current bundled-runtime version sources still agree on `2026.4.2`:

- `config/openclaw-release.json`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json`
- `packages/sdkwork-claw-desktop/src-tauri/generated/release/openclaw-resource/manifest.json`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/runtime/package/node_modules/openclaw/package.json`
- `.cache/bundled-components/upstreams/openclaw/package.json`

Interpretation:

1. The local bundled runtime is not behind the current public stable release baseline.
2. The previous `v2026.4.5` storyline described a hypothetical future-upgrade target, not an actual
   public latest-version gap.

## Readiness Script Correction

Problem found in the previous loop:

- `scripts/openclaw-upgrade-readiness.mjs` was strict about future upgrade provenance, but it did
  not explicitly tell the operator whether the current bundled runtime version sources were already
  internally aligned.
- That made `targetVersion = 2026.4.2` look too similar to `targetVersion = 2026.4.5`, even though
  the two situations are materially different.

Local fix landed:

- Added `versionSourcesAligned` to the readiness result.

Meaning:

1. `versionSourcesAligned: true` means the configured release source, bundled manifest, generated
   manifest, prepared runtime package, and local upstream package all agree on the requested target
   version.
2. `readyToUpgrade: false` can still be correct at the same time when the workspace lacks other
   upgrade-provenance inputs such as a local upstream git tag or a tarball.

## Fresh Local Evidence

Command:

```bash
node scripts/openclaw-upgrade-readiness.mjs 2026.4.2
```

Result summary:

- `versionSourcesAligned: true`
- `readyToUpgrade: false`
- only remaining blocker: missing local upstream git tag `v2026.4.2`

Interpretation:

1. The current bundled runtime baseline is internally aligned on `2026.4.2`.
2. The workspace is not prepared to prove a new upgrade transaction from local upstream git
   metadata alone, because the local upstream checkout does not contain tag `v2026.4.2`.
3. That is a provenance gap for future upgrade workflows, not evidence that the shipped bundled
   runtime is behind the public latest stable release.

Command:

```bash
node scripts/openclaw-upgrade-readiness.mjs 2026.4.5
```

Result summary:

- `versionSourcesAligned: false`
- `readyToUpgrade: false`
- blockers remain:
  - bundled upstream checkout still `2026.4.2`
  - no local tag `v2026.4.5`
  - no local `openclaw-2026.4.5.tgz`

Interpretation:

- `v2026.4.5` remains an unlanded hypothetical upgrade target in the current offline workspace.

## Code Review Result

Fresh local search result:

- Production source does not gate current runtime behavior on `2026.4.5`.
- Remaining `2026.4.5` references outside docs are limited to:
  - hypothetical upgrade-readiness tests
  - test fixtures using a sample OpenClaw version string

Conclusion:

- The main correctness issue was the audit narrative, not a production runtime-version fork.

## Action Taken On Historical Audit Files

All existing `docs/step/2026-04-07-openclaw-v2026-4-5-*.md` files are now marked as historical
implementation logs from a stale target label.

Rule going forward:

1. Do not use those files as authoritative evidence for the current public latest-version baseline.
2. Use this correction log plus fresh local verification for future OpenClaw parity review.

## Remaining Real Gaps After Correction

1. The local upstream checkout still lacks public tag `v2026.4.2`, which weakens offline
   provenance proof for future bundled-runtime refreshes.
2. The upstream checkout remains dirty and must not be hard-reset in place.
3. Desktop/server/docker/k8s validation is still strongest at source-contract scope inside this
   sandbox; real packaged launch and live environment smoke remain environment-bound.

## Verification

- `node scripts/openclaw-upgrade-readiness.test.mjs`
  - passed
- `node scripts/openclaw-upgrade-readiness.mjs 2026.4.2`
  - `versionSourcesAligned: true`
  - `readyToUpgrade: false`
- `node scripts/openclaw-upgrade-readiness.mjs 2026.4.5`
  - `versionSourcesAligned: false`
  - `readyToUpgrade: false`
- `pnpm.cmd check:desktop-openclaw-runtime`
  - passed
- `git -C .cache/bundled-components/upstreams/openclaw tag --list "v2026*"`
  - local tags observed: `v2026.3.28`, `v2026.3.31`, `v2026.4.1`

## Net Result

This loop corrected a material audit-truth defect:

1. As of 2026-04-07, the public latest stable OpenClaw release baseline is `v2026.4.2`, not
   `v2026.4.5`.
2. The local bundled runtime is already aligned with that public stable baseline at the version
   source level.
3. Future upgrade-readiness checks now report current version-source alignment explicitly, which
   prevents the current baseline from being misclassified as the same state as a missing future
   upgrade.
