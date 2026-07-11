# 2026-04-06 Config-Backed OpenClaw Gateway Readiness Authority Alignment Hardening

## Problem

The shared OpenClaw management capability layer still treated
`detail.instance.status === 'online'` as the only proof that a config-backed
OpenClaw gateway was ready.

That was too narrow for config-backed `local-external` OpenClaw instances,
because instance-detail already carries more authoritative runtime evidence:

- `detail.health.status`
- `detail.lifecycle.endpointObserved`

When the instance status snapshot lagged behind runtime truth, the system could
still incorrectly reject live gateway management paths as "offline".

## Root Cause

This was another snapshot-vs-runtime authority split:

- built-in managed OpenClaw already had a special escape hatch through
  `isBuiltInManagedOpenClawProbeCandidate(...)`
- but the shared `hasReadyOpenClawGateway(...)` helper still reduced all other
  OpenClaw readiness decisions to raw `instance.status`
- config-backed OpenClaw service flows such as
  `applyManagedOpenClawConfigDocument(...)` and gateway-backed config reads
  depended on that helper

Result:

- if a config-backed OpenClaw gateway had already been observed and detail
  health was non-offline
- but `instance.status` was still stale
- management paths could refuse to use the live gateway or report the instance
  as offline too early

## Implemented Fix

Implemented contract:

- a gateway is ready if either:
  - `detail.instance.status === 'online'`, or
  - runtime observation has already confirmed the endpoint and
    `detail.health.status !== 'offline'`

Code change:

- updated `hasReadyOpenClawGateway(...)` in
  `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
  to accept the second runtime-observed readiness path

This keeps existing online behavior intact while letting config-backed
OpenClaw management paths follow the richer runtime truth already exposed by
instance detail.

## Regression Coverage

Added and expanded coverage in:

- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.test.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`

The new regressions freeze:

- `hasReadyOpenClawGateway(...)` returns true when endpoint observation and
  non-offline health prove readiness despite stale `instance.status`
- `shouldProbeOpenClawGateway(...)` keeps probing observed config-backed
  OpenClaw gateways in that state
- `applyManagedOpenClawConfigDocument(...)` still uses the gateway apply bridge
  for config-backed OpenClaw when runtime observation proves readiness

## Verification

Executed in this iteration:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.test.ts','packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts']))"`

## Outcome

Closed for this slice:

- config-backed OpenClaw gateway readiness is no longer blocked solely by stale
  `instance.status`
- management paths now follow the richer runtime truth already carried in
  instance detail
- the shared capability helper is aligned with the existing built-in readiness
  hardening direction instead of keeping a second narrower rule

Still open after this slice:

- launched-session validation for notification, proxy router, and instance
  detail behavior on top of the aligned config-backed gateway readiness rule
- packaged desktop startup smoke with a live built-in OpenClaw runtime outside
  the current contract/source-test environment
