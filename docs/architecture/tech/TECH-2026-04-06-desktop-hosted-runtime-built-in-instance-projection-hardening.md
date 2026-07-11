> Migrated from `docs/review/2026-04-06-desktop-hosted-runtime-built-in-instance-projection-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Desktop Hosted Runtime Built-In Instance Projection Hardening

## Scope

This iteration hardened the desktop hosted runtime readiness probe so it no
longer treats the built-in instance as ready based only on matching URLs.

That earlier behavior was too weak for the current Agent Studio architecture.
Several downstream paths do not merely require a loopback URL. They require the
built-in instance to be projected as the specific managed OpenClaw shape the
desktop host promises:

- `runtimeKind === "openclaw"`
- `deploymentMode === "local-managed"`
- `transportKind === "openclawGatewayWs"`
- `status === "online"`

If any of those fields drift, later features can break even when startup
appears healthy.

## Root Cause

`buildDesktopHostedRuntimeReadinessEvidence(...)` previously treated the
built-in instance as ready when all of the following were true:

- the built-in record existed
- `baseUrl` and `websocketUrl` were published
- those URLs matched the managed gateway projection

That was insufficient because the rest of the application does not consume the
built-in instance as a generic endpoint record.

Concrete downstream examples:

- `packages/sdkwork-agentstudio-pc-chat/src/services/instanceChatRouteService.ts`
  blocks built-in chat routing unless the managed OpenClaw instance is
  `local-managed` and `online`
- `packages/sdkwork-agentstudio-pc-chat/src/store/studioConversationGateway.ts`
  only suppresses stale snapshot authority when the instance is projected as a
  managed OpenClaw instance
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchHydration.ts`
  uses `runtimeKind === "openclaw"` to decide whether OpenClaw workbench
  sections should hydrate lazily

So the startup probe could previously declare readiness while the same built-in
instance projection would later be treated as:

- offline
- non-managed
- non-OpenClaw
- wrong transport

That was a real contract mismatch between startup truth and runtime feature
truth.

## Changes Landed

### 1. Built-in instance identity and status are now part of readiness evidence

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts`

Added evidence fields:

- `builtInInstanceRuntimeKind`
- `builtInInstanceDeploymentMode`
- `builtInInstanceTransportKind`
- `builtInInstanceStatus`
- `builtInInstanceRuntimeKindMatchesManagedOpenClaw`
- `builtInInstanceDeploymentModeMatchesManagedOpenClaw`
- `builtInInstanceTransportKindMatchesManagedOpenClaw`
- `builtInInstanceOnline`

`builtInInstanceReady` now requires all of those invariants in addition to URL
publication and URL alignment.

### 2. Readiness enforcement now rejects projection drift before startup continues

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts`

`assertDesktopHostedRuntimeReady(...)` now rejects when the built-in instance:

- is not `online`
- is not projected as `runtimeKind: "openclaw"`
- is not projected as `deploymentMode: "local-managed"`
- is not projected as `transportKind: "openclawGatewayWs"`

This aligns startup readiness with the same feature assumptions used by chat
and instance workbench flows.

### 3. Regression coverage now reproduces projection drift cases directly

File:

- `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`

New regressions:

- `desktop hosted bridge readiness probe rejects when the built-in OpenClaw instance is not online yet`
- `desktop hosted bridge readiness probe rejects when the built-in instance runtime kind drifts away from openclaw`
- `desktop hosted bridge readiness probe rejects when the built-in instance deployment mode drifts away from local-managed`
- `desktop hosted bridge readiness probe rejects when the built-in instance transport kind drifts away from the managed OpenClaw gateway transport`

The existing success and non-target failure fixtures were also updated to
publish `status: "online"` so they model a truthful built-in managed runtime
projection.

## Verification Evidence

The following commands were executed after the fix:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

All of the above passed in this iteration.

## Impact

This hardening closes a meaningful startup-to-runtime truth gap:

1. desktop startup can no longer report the built-in OpenClaw runtime as ready
   when the instance projection would later be treated as unsupported or
   offline by chat/workbench flows
2. readiness evidence now reflects the actual managed OpenClaw shape consumed
   by downstream features
3. the next launched-session smoke work can focus on proving real runtime
   convergence instead of compensating for a weaker contract baseline

## Remaining Gaps

This iteration still does not replace live launched-app evidence. The most
important remaining gaps are:

1. launched-session proof that built-in OpenClaw reaches `online` in a real
   desktop startup and stays aligned with the gateway websocket authority
2. end-to-end verification for chat, file list, notification, cron, and
   instance-detail flows on top of the stricter built-in readiness contract
3. packaged installer smoke outside synthetic checks on Windows, Linux, and
   macOS

## Next Iteration

1. move from contract hardening into launched-session evidence capture for the
   built-in instance `online` transition and gateway websocket reachability
2. validate chat and instance-detail behavior against the now-stricter built-in
   readiness contract
3. continue closing desktop/server/docker/k8s shared-runtime findings using
   behavior-level evidence instead of route-only presence checks

