# 2026-04-06 Desktop Hosted Runtime Startup Convergence Retry Hardening

## Scope

This iteration hardened desktop startup against transient hosted-runtime
convergence failures.

The desktop bootstrap path already required a truthful hosted runtime snapshot
before rendering the shell. That contract is correct. The gap was that the
frontend only attempted the hosted readiness probe once.

In a real desktop launch, the embedded host descriptor can be available before
the managed OpenClaw runtime, gateway, and built-in instance projection have
fully converged. In that transient window, a single-shot probe produces a false
startup failure even though the managed runtime would become ready moments
later.

## Root Cause

The startup path had two different convergence stories:

1. `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.ts`
   already retried descriptor resolution until the canonical hosted runtime
   descriptor became available.
2. `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts`
   still called `probeStaticDesktopHostedRuntimeReadiness(...)` as a one-shot
   operation once the descriptor existed.

That split was too weak for the real startup lifecycle.

Relevant evidence from the existing architecture:

- Rust startup emits `app://ready` only after bundled OpenClaw activation
  finishes successfully:
  `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/app/bootstrap.rs`
- the frontend had no equivalent convergence window around
  `probeDesktopHostedRuntimeReadiness()`
- `DesktopBootstrapApp.tsx` therefore turned any transient startup probe
  failure directly into a blocking bootstrap error

That means the desktop host could be correct eventually, but startup still
failed because the browser-side bootstrap had no patience for managed OpenClaw
startup convergence.

## Changes Landed

### 1. Added a reusable retry primitive for desktop hosted-runtime startup work

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.ts`

Added:

- `RetryDesktopHostRuntimeOperationRetryContext`
- `RetryDesktopHostRuntimeOperationOptions`
- `retryDesktopHostRuntimeOperation(...)`

This helper retries transient startup operations within a bounded timeout while
preserving the last real error if the convergence window expires.

### 2. Desktop hosted readiness now retries instead of failing on the first transient startup miss

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts`

Behavior change:

- `probeDesktopHostedRuntimeReadiness(...)` now accepts retry options
- the bridge wraps the static readiness probe with
  `retryDesktopHostRuntimeOperation(...)`
- desktop startup now gets a bounded convergence window for:
  - transient host fetch failures
  - transient readiness snapshot failures
  - early built-in OpenClaw `offline` or unpublished gateway states

The bridge still preserves the real final failure when convergence does not
occur before the retry window closes.

### 3. Desktop startup logs now expose transient convergence attempts

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`

Behavior change:

- desktop bootstrap now passes `onRetry` into
  `probeDesktopHostedRuntimeReadiness(...)`
- transient readiness retries now emit structured startup warnings with:
  - retry attempt
  - elapsed time
  - host lifecycle
  - managed OpenClaw runtime/gateway lifecycle
  - built-in instance projection
  - full readiness evidence when available

This closes the previous observability gap where startup logs only showed the
final success or final failure and hid the convergence path in between.

## Regression Coverage

### Targeted retry behavior tests

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`

New regressions:

- `desktop host runtime retry helper retries transient readiness failures until the managed runtime converges`
- `desktop host runtime retry helper rethrows the last startup failure once the retry window expires`

These tests prove the new retry primitive is not a noop and preserves the last
real failure when convergence never happens.

### Contract coverage for desktop bridge wiring

File:

- `scripts/sdkwork-host-runtime-contract.test.ts`

New assertions require:

- `probeDesktopHostedRuntimeReadiness(options?: ...)`
- `retryDesktopHostRuntimeOperation(...)`
- the retry helper to wrap `probeStaticDesktopHostedRuntimeReadiness(...)`

This locks the behavior at the bridge layer so future cleanup cannot silently
drop the convergence window.

## Verification Evidence

The following commands were executed after the change:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

All of the above passed in this iteration.

## Impact

This closes an important startup behavior gap:

1. desktop startup no longer treats a transient managed OpenClaw startup window
   as a fatal hosted-runtime failure
2. hosted-runtime descriptor convergence and hosted-runtime readiness
   convergence now follow the same retry discipline
3. startup logs now show whether the host is still converging or has actually
   failed, which makes real launched-session debugging far less opaque

## Remaining Gaps

This iteration improves launched-session realism, but it does not replace
end-to-end smoke evidence. The main remaining gaps are:

1. launched desktop session proof that chat, file list, notification, cron,
   and instance-detail flows all work on top of the converged built-in runtime
2. live websocket/gateway behavior verification after startup, not only startup
   convergence
3. packaged installer smoke outside synthetic checks on Windows, Linux, and
   macOS

## Next Iteration

1. move upward from startup convergence into post-startup feature validation
   for chat, file list, notification, cron, and instance detail
2. verify that built-in OpenClaw websocket authority remains aligned after the
   shell starts using the runtime, not only during bootstrap
3. continue closing packaged-installer and cross-host review findings with
   live behavior evidence where possible
