# 2026-04-06 Desktop Hosted Runtime Failure Evidence Hardening

## Scope

This iteration hardened the desktop hosted runtime readiness failure path so
desktop startup no longer loses the most important evidence when the hosted
control-plane is unhealthy.

The concrete problem addressed here was not the success path. The success path
already logged structured readiness evidence. The gap was the failure path:

- `probeDesktopHostedRuntimeReadiness(...)` threw a plain `Error`
- `DesktopBootstrapApp.tsx` only emitted a generic bootstrap failure log
- descriptor, host endpoint, runtime, gateway, and built-in instance evidence
  became hard to recover during startup failures

That made root-cause analysis unnecessarily slow for issues such as:

- descriptor/manage endpoint drift
- built-in OpenClaw runtime and gateway projection drift
- missing built-in instance projection
- startup failures that only reproduce in real desktop launch order

## Root Cause

The desktop hosted bridge already built a truthful readiness snapshot, but it
discarded that snapshot as soon as `assertDesktopHostedRuntimeReady(...)`
failed.

That meant the code path with the strongest evidence returned the weakest error
shape.

In practice the bootstrap layer received only a generic message string, so it
could not distinguish:

1. a normal transport/runtime failure
2. a structured hosted-readiness failure with rich diagnostic context

This was an observability defect in the desktop host architecture, not a
business-logic defect in OpenClaw itself.

## Changes Landed

### 1. The hosted bridge now preserves the full readiness snapshot on failure

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts`

Behavior change:

- added `DesktopHostedRuntimeReadinessSnapshot`
- added `DesktopHostedRuntimeReadinessError`
- added `isDesktopHostedRuntimeReadinessError(...)`
- `probeDesktopHostedRuntimeReadiness(...)` now constructs the snapshot before
  readiness assertion and throws a typed error that retains the snapshot when
  readiness fails

This keeps the root-cause evidence attached to the failure instead of throwing
it away.

### 2. The desktop bridge now re-exports the failure type for host-local usage

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts`

Behavior change:

- re-exported `DesktopHostedRuntimeReadinessError`
- re-exported `isDesktopHostedRuntimeReadinessError(...)`
- aligned the readiness probe return type with the shared snapshot contract

This keeps the host entrypoint consuming a stable bridge surface instead of
reaching into an internal file directly.

### 3. Desktop bootstrap now logs structured readiness evidence on failure

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`

Behavior change:

- `connectDesktopRuntime` now catches typed readiness failures
- bootstrap logs a dedicated
  `Hosted desktop runtime readiness probe failed.` entry
- the failure log now includes:
  - descriptor authority
  - host lifecycle
  - canonical manage endpoint fields
  - managed OpenClaw runtime lifecycle
  - managed OpenClaw gateway lifecycle
  - built-in instance projection
  - `readinessEvidence`
  - the surfaced error message and cause

This makes launched-session startup failures diagnosable without reproducing
them under a debugger.

### 4. Regression tests now lock the failure-evidence contract

Files:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `scripts/sdkwork-host-runtime-contract.test.ts`

Coverage added:

- the hosted bridge must throw `DesktopHostedRuntimeReadinessError` when the
  canonical manage endpoint drifts from the descriptor
- the typed error must preserve the full readiness snapshot
- desktop bootstrap source contracts now require the typed guard, failure log
  message, and `readinessEvidence` projection

## Verification Evidence

The following commands were executed after the fix:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

All of the above passed in this iteration.

## Impact

This hardening closes a real diagnostic blind spot in the shared Rust-host
architecture:

1. desktop startup failures now preserve canonical hosted-runtime evidence
2. the bootstrap layer can distinguish structured readiness failures from
   generic runtime errors
3. future work on built-in OpenClaw startup, gateway routing, websocket
   authority, and instance-detail correctness now has a trustworthy failure
   trail

## Remaining Gaps

This iteration does not yet prove end-to-end correctness of live launched
desktop behavior. The most important remaining gaps are:

1. a real launched-session smoke proving the built-in OpenClaw process,
   runtime, gateway, websocket, and instance projection all converge
2. end-to-end verification for chat, file list, notification, cron job, and
   instance detail flows on top of the hosted runtime
3. cross-host runtime evidence showing desktop/server/docker/k8s continue to
   honor the same truthful authority contracts where intended

## Next Iteration

1. capture launched-session evidence for built-in OpenClaw startup and gateway
   readiness using the newly preserved readiness failure snapshot
2. review the chat and instance-detail flows against real hosted authority
   assumptions instead of only route availability
3. continue closing desktop/server/docker/k8s shared-runtime review findings
   from the system review backlog
