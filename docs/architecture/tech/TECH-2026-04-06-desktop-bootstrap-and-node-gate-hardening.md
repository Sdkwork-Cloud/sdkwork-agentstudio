> Migrated from `docs/review/2026-04-06-desktop-bootstrap-and-node-gate-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Desktop Bootstrap And Node Gate Hardening

## Scope

This iteration closed two desktop reliability gaps that were blocking trustworthy startup validation:

1. `DesktopBootstrapApp` still kept most launch sequencing inside the React component, and the test only recently moved from string-level assertions to real behavior checks.
2. `pnpm.cmd check:desktop` was not actually stable because its TypeScript test execution path could not resolve workspace packages such as `@sdkwork/claw-infrastructure` when Node ran `.ts` files directly.

The goal of this pass was to make desktop bootstrap behavior testable as a real state machine and to make the desktop validation gate runnable end to end.

## Root Cause

### 1. Bootstrap orchestration was UI-bound

Before this iteration:

- the startup sequence lived inside `DesktopBootstrapApp.tsx`
- warm sidebar prefetch scheduling and cleanup were mixed with React state updates
- stale-run cancellation and failure cleanup were not isolated behind a pure runtime contract

That made it easy to miss lifecycle bugs. One concrete defect was present: if `bootstrapShellRuntime()` failed after the warm prefetch timeout had already been scheduled, the timeout was not cleared.

### 2. Desktop TypeScript gate execution relied on incomplete Node resolution

Before this iteration:

- `check:desktop` launched desktop `.ts` regression suites with raw `node --experimental-strip-types`
- the direct Node execution path had no workspace alias resolution for local `@sdkwork/claw-*` packages
- `desktopHostedBridge.test.ts` therefore failed to import `@sdkwork/claw-infrastructure`

This meant the mandatory desktop gate was not reliably executable even though individual test files were valid.

### 3. Desktop Vite config had drifted from the ESM-safe pattern already used by the web host

During verification, desktop build failed with:

- `ReferenceError: __dirname is not defined`

The desktop `vite.config.ts` was using `__dirname` without the `fileURLToPath(import.meta.url)` bridge that already exists in `packages/sdkwork-claw-web/vite.config.ts`.

## Changes Landed

### 1. Extracted a testable desktop bootstrap runtime module

Files:

- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopBootstrapRuntime.ts`
- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`
- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`

What changed:

- introduced `INITIAL_DESKTOP_STARTUP_MILESTONES`
- introduced a pure `runDesktopBootstrapSequence(...)` runtime orchestrator
- introduced explicit bootstrap state/action contracts for:
  - milestone updates
  - status transitions
  - shell render gating
  - splash visibility error handling

Behavior now locked by tests:

- shell render is requested only after window reveal, runtime connection, and shell bootstrap all succeed
- warm sidebar prefetch is scheduled but not executed until the deferred task is flushed
- warm sidebar prefetch is cleared when shell bootstrap fails
- warm sidebar prefetch is cleared when the bootstrap run becomes stale
- stale runs exit cleanly without requesting shell render

### 2. Fixed the desktop Vite config ESM regression

File:

- `packages/sdkwork-claw-desktop/vite.config.ts`

What changed:

- added `fileURLToPath(import.meta.url)` and `path.dirname(...)`
- restored ESM-safe `__dirname` resolution

This brought the desktop Vite config back into alignment with the web host pattern and unblocked actual desktop production builds.

### 3. Hardened Node TypeScript workspace resolution for local desktop gates

Files:

- `scripts/ts-extension-loader.mjs`
- `scripts/ts-extension-loader.test.mjs`
- `scripts/run-sdkwork-desktop-check.mjs`
- `package.json`

What changed:

- extended the TypeScript loader so it can resolve local workspace packages from `packages/*/src`
- added regression coverage for `@sdkwork/claw-infrastructure` workspace alias resolution
- introduced `run-sdkwork-desktop-check.mjs` so desktop TypeScript suites run through the same loader-backed execution path as other workspace checks
- updated `check:desktop` to use the new runner while keeping the explicit test file paths visible in the script contract

## Verification Evidence

The following commands completed successfully after the changes:

- `node --experimental-transform-types packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`
- `node scripts/desktop-hosted-runtime-regression-contract.test.mjs`
- `pnpm.cmd --filter @sdkwork/claw-desktop build`
- `node scripts/ts-extension-loader.test.mjs`
- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.test.ts packages/sdkwork-claw-desktop/src/desktop/desktopHostRuntimeResolver.test.ts packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`
- `pnpm.cmd check:desktop`

Notable verification outcomes:

- desktop production build now succeeds again
- the mandatory desktop gate now runs green end to end
- `check:desktop` still reports bundled OpenClaw version normalization to `2026.4.2`, confirming version convergence is still an open follow-up rather than silently resolved

## Current Stage

The desktop review/remediation loop is now at a healthier baseline:

- the startup path has a real behavior-level regression harness
- the desktop gate is actually executable in CI/local contract mode
- the desktop web bundle can be produced again

This closes the immediate gap between "tests exist" and "tests can prove the startup/runtime path is correct."

## Remaining Gaps

The following issues are still open after this iteration:

1. Bundled OpenClaw version convergence is still not complete. Validation output still normalizes to `2026.4.2`.
2. Packaged first-launch smoke still needs stronger install-time and first-renderer-time evidence across Windows, Linux, and macOS.
3. The chat/API proxy token accounting review remains open.
4. The broader functional matrix requested by the user still needs deeper passes for:
   - chat session lifecycle
   - notification and cron job behavior
   - instance detail and file list correctness
   - proxy router/runtime startup correctness

## Next Iteration

1. Trace and upgrade the bundled OpenClaw version source of truth so release assets, sync scripts, installer staging, and runtime metadata all converge on the latest version.
2. Add packaged first-launch smoke coverage that proves install-time unpack, host-time startup, and no re-extract-on-first-render behavior.
3. Continue the review loop on chat/proxy/router/token accounting and instance detail correctness on top of the now-stable desktop gate.

