> Migrated from `docs/review/2026-04-06-desktop-hosted-runtime-identity-readiness-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Desktop Hosted Runtime Identity Readiness Hardening

## Scope

This iteration closed a contract drift inside the desktop hosted runtime
readiness probe.

The readiness evidence model already encoded that the managed OpenClaw runtime
and the managed OpenClaw gateway must agree on more than just URLs. They also
must agree on:

- `endpointId`
- `activePort`

The bug was that startup enforcement did not actually reject those drift cases,
so the probe could return success while `evidence.ready` was already `false`.

That was a real correctness gap for the desktop combined host because
runtime/gateway identity drift is exactly the kind of condition that later
shows up as:

- built-in OpenClaw websocket refusal
- instance projection inconsistency
- false "host is ready" startup logs
- follow-on 503 failures against hosted built-in instance routes

## Root Cause

`buildDesktopHostedRuntimeReadinessEvidence(...)` already tracked all of the
required invariants:

- `runtimeAndGatewayEndpointIdMatch`
- `runtimeAndGatewayActivePortMatch`

and included both flags in `evidence.ready`.

However, `assertDesktopHostedRuntimeReady(...)` only enforced:

- lifecycle readiness
- published URLs
- URL equality between runtime and gateway
- built-in instance URL alignment

It never asserted endpoint-id or active-port equality between the managed
runtime and the managed gateway.

As a result, the readiness probe had a split-brain contract:

1. the evidence object said "not ready"
2. the probe still returned a successful snapshot

That mismatch would let desktop bootstrap continue past a broken authority
projection.

## Changes Landed

### 1. Readiness enforcement now matches the evidence contract

File:

- `packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.ts`

Behavior change:

- `assertDesktopHostedRuntimeReady(...)` now rejects when:
  - managed OpenClaw runtime and gateway `endpointId` values drift
  - managed OpenClaw runtime and gateway `activePort` values drift

This brings the hard-fail readiness path back into alignment with
`DesktopHostedRuntimeReadinessEvidence.ready`.

### 2. Regression coverage now locks both identity-drift failure modes

File:

- `packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.test.ts`

New regressions:

- `desktop hosted bridge readiness probe rejects when managed OpenClaw runtime and gateway endpoint ids drift`
- `desktop hosted bridge readiness probe rejects when managed OpenClaw runtime and gateway active ports drift`

These tests reproduce the exact failure class that previously slipped through:

- identical URLs
- healthy lifecycle
- built-in instance published
- but mismatched runtime/gateway identity metadata

The probe is now required to reject those states.

## Verification Evidence

The following commands were executed after the fix:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

All of the above passed in this iteration.

## Impact

This hardening closes a subtle but high-value correctness gap:

1. desktop startup can no longer accept a split-brain managed runtime/gateway
   projection just because the URLs happen to match
2. readiness evidence and readiness enforcement now describe the same contract
3. later chat, gateway invoke, websocket, and built-in instance behavior
   review work now starts from a stricter and more truthful readiness baseline

## Remaining Gaps

This iteration still does not replace the missing live launched-session smoke.
The main remaining gaps are:

1. real launched-app evidence that built-in OpenClaw becomes online, publishes
   its gateway, and exposes the same websocket authority consumed by chat
2. end-to-end verification of chat, file list, notification, cron, and
   instance-detail flows against the built-in hosted runtime
3. real packaged installer smoke across Windows, Linux, and macOS outside the
   current synthetic contract checks

## Next Iteration

1. keep moving upward from contract correctness into launched-session evidence
   for built-in OpenClaw startup, websocket reachability, and instance truth
2. use the stricter readiness contract as the baseline for chat and
   gateway-invoke regression review
3. continue closing shared-runtime review findings for desktop, server, docker,
   and k8s with behavior-level evidence instead of route-only checks

