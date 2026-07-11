> Migrated from `docs/review/2026-04-06-desktop-hosted-runtime-canonical-manage-endpoint-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Desktop Hosted Runtime Canonical Manage Endpoint Hardening

## Scope

This iteration hardened the desktop hosted runtime readiness probe so it no
longer assumes the first published manage endpoint is the canonical desktop
control-plane authority.

The concrete symptom addressed here was subtle but high impact:

- desktop startup readiness could fail even when the correct hosted manage
  endpoint was published
- startup logs could report the wrong host endpoint details
- multi-endpoint host projections could produce false-negative readiness
  failures even when the built-in OpenClaw runtime was healthy

## Root Cause

`buildDesktopHostedRuntimeReadinessEvidence(...)` previously selected the first
`hostEndpoints[]` record that contained a `baseUrl`.

That implementation was too weak for the current architecture because the
desktop host can publish more than one endpoint record over time, and the first
published endpoint is not guaranteed to be the canonical endpoint that matches
the hosted runtime descriptor.

When a non-canonical endpoint appeared before the real desktop manage endpoint,
the readiness probe compared the wrong endpoint against:

- `descriptor.browserBaseUrl`
- `descriptor.endpointId`
- `descriptor.activePort`

The readiness probe then failed with:

- `Desktop hosted runtime descriptor browserBaseUrl does not match the published manage host endpoint baseUrl.`

even though a later endpoint in the same payload actually matched the desktop
descriptor and the runtime was healthy.

## Changes Landed

### 1. Canonical manage endpoint selection is now descriptor-aware

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts`

Behavior change:

- added `resolveDesktopHostedManageEndpoint(...)`
- readiness evidence now selects the canonical manage endpoint using this
  priority:
  1. descriptor `endpointId`
  2. descriptor `browserBaseUrl`
  3. descriptor `activePort`
  4. first published endpoint as a final fallback

This preserves strict mismatch detection while preventing false failures caused
by blindly trusting `hostEndpoints[0]`.

### 2. Startup logs now use canonical readiness evidence

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`

Behavior change:

- desktop startup logs no longer read `hostEndpoints[0]` directly
- the log now emits the canonical manage endpoint fields from
  `hostedRuntimeReadiness.evidence`

This keeps the startup trace aligned with the same endpoint selection logic used
by readiness enforcement.

### 3. Regression coverage now reproduces the real multi-endpoint failure mode

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`

New regression:

- `desktop hosted bridge readiness probe selects the canonical manage endpoint instead of assuming the first published endpoint is authoritative`

The test publishes two manage endpoints:

- a wrong public/non-canonical endpoint first
- the correct descriptor-aligned desktop manage endpoint second

The probe is now required to stay green in that scenario.

## Verification Evidence

The following commands were executed after the fix:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`

All of the above passed in this iteration.

## Impact

This hardening closes a real readiness-evidence correctness gap in the shared
Rust-host architecture:

1. desktop startup no longer fails just because endpoint ordering changes
2. startup logs now describe the same endpoint that readiness enforcement used
3. future multi-endpoint desktop/server convergence work has a stricter,
   more truthful canonical authority selection baseline

## Remaining Gaps

This iteration does not close the broader desktop/OpenClaw review backlog. The
main open items remain:

1. live launched-app evidence for built-in OpenClaw gateway and websocket
   readiness in one real desktop session
2. packaged installer smoke across Windows, Linux, and macOS
3. bundled OpenClaw latest-version convergence, which still reports `2026.4.2`
   in the current desktop check output
4. broader chat / file list / notification / cron / instance-detail end-to-end
   validation on top of the hardened readiness chain

## Next Iteration

1. capture richer launched-session evidence that proves the built-in OpenClaw
   process, runtime, gateway, websocket, and built-in instance projection are
   all aligned in one startup sequence
2. continue tracing the bundled OpenClaw version normalization path so the
   packaged desktop build stops pinning at `2026.4.2`
3. extend the same evidence discipline into chat, file list, and instance
   detail flows that depend on the built-in OpenClaw authority

