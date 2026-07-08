> Migrated from `docs/review/2026-04-06-lint-parity-contract-realignment.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Lint Parity Contract Realignment

## Scope

This iteration closed the remaining `pnpm.cmd lint` blockers that survived the
earlier loader and TypeScript runner hardening work.

Files updated in this iteration:

- `scripts/sdkwork-host-runtime-contract.test.ts`

Previously prepared and verified as part of the same lint recovery chain:

- `scripts/run-sdkwork-account-check.mjs`
- `scripts/sdkwork-account-contract.test.ts`
- `package.json`

## Problem

`pnpm.cmd lint` was still not trustworthy even after the shared TypeScript
loader recovery because two remaining parity gates were out of sync with the
current codebase:

1. `check:sdkwork-account` had previously been running through a raw
   `node --experimental-strip-types` path that bypassed the shared workspace
   TypeScript loader.
2. `check:sdkwork-host-runtime` still asserted desktop bootstrap sequencing and
   managed OpenClaw config behavior against older file layouts and pre-refactor
   control flow.

The result was a false-negative lint gate: product logic was already aligned,
but the contract layer was still enforcing stale implementation details.

## Root Cause

### 1. Account parity runner drift

The account parity script had not yet been migrated onto the shared
`run-node-typescript-check` entrypoint, so it remained sensitive to the same
workspace-resolution failures that had already been fixed elsewhere.

### 2. Host-runtime contract drift after bootstrap/runtime extraction

Desktop startup sequencing is no longer expressed inline only inside
`DesktopBootstrapApp.tsx`. The sequencing and deferred route warmup now live in:

- `packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/desktopBootstrapRuntime.ts`

Similarly, managed OpenClaw config gateway probing is no longer expressed as
per-method inline `hasReadyOpenClawGateway(...)` checks. The truth now lives in
the shared helper:

- `withManagedOpenClawGatewayProbe(...)`

The old contract test was therefore checking obsolete structure rather than the
current runtime contract.

## Implementation

### 1. Restored the account parity entrypoint

The account parity gate now runs through:

- `node scripts/run-sdkwork-account-check.mjs`

That runner delegates to the shared Node TypeScript harness so account parity
checks use the same cross-workspace module-resolution rules as the rest of the
workspace.

### 2. Realigned host-runtime contract assertions with the current architecture

Updated `scripts/sdkwork-host-runtime-contract.test.ts` so it now verifies:

- `DesktopBootstrapApp.tsx` still delegates startup orchestration through
  `runDesktopBootstrapSequence(...)`
- `DesktopBootstrapApp.tsx` still wires `revealStartupWindow`,
  `connectDesktopRuntime`, `bootstrapShellRuntime`, route prefetch helpers, and
  shell render state into that runtime sequence
- `desktopBootstrapRuntime.ts` owns the actual sequencing contract:
  reveal window -> connect runtime -> resolve startup route -> prefetch startup
  route -> bootstrap shell -> request shell render
- `desktopBootstrapRuntime.ts` still owns deferred sidebar warmup scheduling and
  cleanup
- `instanceServiceCore.ts` still routes managed OpenClaw config reads and writes
  through the unified `withManagedOpenClawGatewayProbe(...)` helper while
  preserving file-backed fallback behavior

This keeps the contract strict about behavior while no longer coupling it to an
obsolete file-local implementation shape.

## Verification

Fresh evidence captured in this iteration:

- `node scripts/run-sdkwork-account-check.mjs`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd lint`

All passed on 2026-04-06.

## Result

The workspace lint gate is green again and now reflects the current desktop
bootstrap and managed OpenClaw architecture truthfully instead of failing on
stale contract expectations.

## Remaining Risk

This iteration restored contract and parity truthfulness, but it does not yet
replace live runtime evidence for:

- desktop chat/bootstrap into a real built-in OpenClaw process
- first-launch packaged behavior on Windows
- postinstall/staged-install behavior on Linux and macOS
- end-to-end token accounting visibility through a real UI session

## Next Iteration

Recommended next step:

1. execute a live desktop runtime smoke focused on built-in OpenClaw startup,
   gateway readiness, and config workbench behavior
2. capture runtime evidence into `docs/review/`
3. use that evidence to drive the next fix loop for real runtime gaps instead
   of contract-only gaps

