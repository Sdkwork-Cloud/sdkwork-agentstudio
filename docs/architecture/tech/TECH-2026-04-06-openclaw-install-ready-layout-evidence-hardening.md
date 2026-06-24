> Migrated from `docs/review/2026-04-06-openclaw-install-ready-layout-evidence-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 OpenClaw Install-Ready Layout Evidence Hardening

## Scope

This iteration hardened the packaged OpenClaw first-launch contract across the desktop release pipeline:

- `scripts/verify-desktop-openclaw-release-assets.mjs`
- `scripts/release/smoke-desktop-installers.mjs`
- `scripts/release/finalize-release-assets.mjs`

The target was narrow and intentional: prove, in persisted release evidence, that installer-time preparation leaves OpenClaw ready for first launch reuse so startup does not need to perform archive extraction again.

## Problem

Before this change, the release pipeline only persisted a truncated `installReadyLayout` object:

```json
{
  "mode": "simulated-prewarm",
  "installKey": "2026.4.2-windows-x64"
}
```

That object was not enough to prove the actual startup contract. It lost the fields that answer the critical operational question:

- does first launch reuse install-time output?
- is archive extraction still required on first launch?
- which manifest, runtime sidecar, Node entrypoint, and CLI entrypoint are expected inside the install root?

As a result, packaging checks could pass while the final release metadata still lacked machine-readable evidence for "install during setup, reuse on startup".

## Root Cause

The verifier already proved most of the runtime shape indirectly, but the release pipeline collapsed that proof at two later boundaries:

1. `verify-desktop-openclaw-release-assets.mjs` returned only `{ mode, installKey }`
2. `smoke-desktop-installers.mjs` normalized the object down to the same two fields
3. `finalize-release-assets.mjs` normalized it down again before writing `release-manifest.json`

This made the public release evidence weaker than the actual implementation.

## Implementation

### 1. Centralized the install-ready contract

Added [desktop-install-ready-layout.mjs](/<workspace-root>/claw-studio/scripts/release/desktop-install-ready-layout.mjs) as the single source for:

- install key derivation from the bundled OpenClaw manifest
- canonical path constants for `manifest.json` and `.sdkwork-openclaw-runtime.json`
- normalization and validation of the persisted install-ready object
- construction of the full evidence object from the bundled manifest

### 2. Strengthened verifier output

Updated [verify-desktop-openclaw-release-assets.mjs](/<workspace-root>/claw-studio/scripts/verify-desktop-openclaw-release-assets.mjs) so both archive-prewarm and staged-layout paths now return the full normalized evidence object:

- `mode`
- `installKey`
- `reuseOnFirstLaunch: true`
- `requiresArchiveExtractionOnFirstLaunch: false`
- `manifestRelativePath: "manifest.json"`
- `runtimeSidecarRelativePath: "runtime/.sdkwork-openclaw-runtime.json"`
- `nodeEntryRelativePath`
- `cliEntryRelativePath`

### 3. Preserved evidence through smoke reports

Updated [smoke-desktop-installers.mjs](/<workspace-root>/claw-studio/scripts/release/smoke-desktop-installers.mjs) so the smoke report now persists the full normalized object instead of dropping the path and boolean fields.

### 4. Preserved evidence through final release metadata

Updated [finalize-release-assets.mjs](/<workspace-root>/claw-studio/scripts/release/finalize-release-assets.mjs) so `desktopInstallerSmoke.installReadyLayout` is carried into final release metadata without losing the readiness proof.

## Verification

Verified in this iteration:

- `node scripts/verify-desktop-openclaw-release-assets.test.mjs`
- `node scripts/release/smoke-desktop-installers.test.mjs`
- `node scripts/release/finalize-release-assets.test.mjs`
- `pnpm.cmd check:release-flow`

All passed on 2026-04-06.

## Result

The release pipeline now records explicit evidence that:

- installer-time preparation is intended for reuse on first launch
- first launch must not require archive extraction
- the canonical install-root manifest and runtime sidecar paths are fixed and validated
- the bundled Node and OpenClaw CLI entrypoints are persisted through verifier, smoke, and final manifest stages

This closes the evidence gap that previously made "install during setup, no re-extract on startup" difficult to audit from packaged artifacts alone.

## Remaining Risk

The pipeline contract is now explicit and covered by automated tests, but one important gap still remains outside this sandbox:

- live packaged installer execution on Windows, Linux, and macOS still needs end-to-end runtime evidence from real install roots and first launch logs

In other words, the release metadata is now trustworthy, but packaged runtime smoke still needs to be executed on real target environments to complete the operational proof.

## Next Iteration

Recommended next step:

1. run real packaged installer smoke on Windows, Linux, and macOS
2. capture the actual install root and startup provenance snapshots
3. compare first-launch logs against `installReadyLayout` so any unexpected archive extraction is treated as a release blocker

