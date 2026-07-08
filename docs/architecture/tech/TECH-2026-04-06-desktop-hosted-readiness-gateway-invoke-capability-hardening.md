> Migrated from `docs/review/2026-04-06-desktop-hosted-readiness-gateway-invoke-capability-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Desktop Hosted Readiness Gateway Invoke Capability Hardening

## Scope

This iteration closes the next startup-convergence gap in the desktop embedded
host bridge: readiness was still derived from lifecycle and URL projection
alone, without checking whether the host had actually opened the managed
OpenClaw gateway invoke capability.

That gap directly matched the user-visible failure class:

- bootstrap declared the hosted runtime ready
- chat/config/runtime consumers immediately tried gateway invoke or WebSocket
  paths
- the host still reported invoke as unavailable, producing 503 or refused
  follow-up calls

## Root Cause

`packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.ts`
already collected:

- host platform lifecycle
- manage endpoint projection
- managed OpenClaw runtime projection
- managed OpenClaw gateway projection
- built-in instance projection

But it did **not** consume `HostPlatformStatusRecord.availableCapabilityKeys`
or `supportedCapabilityKeys`.

This created a runtime-truth split:

- the host platform had an explicit capability contract for
  `manage.openclaw.gateway.invoke`
- the desktop readiness probe ignored that contract entirely
- the bridge could therefore return `ready: true` while the host itself was
  still saying "gateway invoke is not available yet"

## Changes

### 1. Gateway Invoke Capability Is Now Part Of Desktop Readiness

Extended desktop readiness evidence to track:

- `gatewayInvokeCapabilitySupported`
- `gatewayInvokeCapabilityAvailable`

`ready` now requires the managed OpenClaw gateway invoke capability to be
available whenever the host publishes capability metadata.

### 2. Readiness Failures Now Explain The Real Missing Condition

Added explicit readiness errors for:

- missing support for managed OpenClaw gateway invoke
- gateway invoke not yet available even though other lifecycle/url projections
  look ready

This makes bootstrap failure evidence match the actual runtime gate instead of
failing later in downstream chat/config flows.

### 3. Regression Coverage Locks The Capability Gate

Added a focused desktop hosted bridge regression proving:

- if the host advertises `manage.openclaw.gateway.invoke` as supported
- but omits it from `availableCapabilityKeys`
- the readiness probe must reject instead of returning success

Also updated the shared host-runtime contract so source-level parity checks
require the bridge to reference the gateway invoke capability.

## Files Changed

- `packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.ts`
- `packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.test.ts`
- `scripts/sdkwork-host-runtime-contract.test.ts`

## Verification

Red evidence captured before implementation:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.test.ts`

Green evidence after implementation:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-clawstudio-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

## Remaining Follow-Up

The next adjacent runtime-truth slice remains:

- server/control-plane `gateway_invoke_is_available()` projection should be
  reviewed because the shared host path still looks overly pessimistic
- launched-session proof for built-in OpenClaw `online` convergence and actual
  WebSocket reachability is still needed beyond contract-level readiness
- upward validation for chat, notification, cron, proxy router, and
  instance-detail behavior should continue on top of the stricter readiness
  gate

