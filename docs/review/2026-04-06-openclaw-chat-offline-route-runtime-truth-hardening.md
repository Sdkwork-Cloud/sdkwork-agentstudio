# 2026-04-06 OpenClaw Chat Offline Route Runtime Truth Hardening

## Scope

This iteration closes the next runtime-truth drift above the shared hosted
runtime and instance-detail layers: offline OpenClaw instances were still
published to chat as connectable gateway WebSocket targets.

The bug affected OpenClaw instances across:

- built-in desktop warmup follow-up flows
- local-external OpenClaw registry records
- remote OpenClaw registry records

## Root Cause

`packages/sdkwork-clawstudio-chat/src/services/instanceChatRouteService.ts`
enforced runtime truth only for built-in managed OpenClaw:

- `deploymentMode === 'local-managed' && status !== 'online'` returned
  `mode: 'unsupported'`
- `deploymentMode === 'local-external'` and `deploymentMode === 'remote'`
  skipped that guard entirely
- if either `baseUrl` or `websocketUrl` existed, chat still returned
  `mode: 'instanceOpenClawGatewayWs'`

That meant the chat stack still treated "URL exists" as stronger authority than
"runtime is offline" for external and remote OpenClaw instances.

Downstream impact:

- `connectGatewayInstancesBestEffort(...)` still hydrated gateway instances
- `OpenClawGatewayConnections.tsx` warmup could still trigger offline WebSocket
  attempts
- chat/notification/cron flows still drifted away from the runtime-truth rules
  already enforced for console access and hosted readiness

## Changes

### 1. Unified Offline Gating In Chat Route Resolution

Updated `resolveInstanceChatRoute(...)` so **all** OpenClaw instances now
require `status === 'online'` before publishing a gateway route.

Behavior after the fix:

- built-in `local-managed` OpenClaw stays blocked until online
- `local-external` OpenClaw stays blocked until online
- `remote` OpenClaw stays blocked until online
- online OpenClaw instances still publish the existing gateway route behavior

### 2. Kept User-Facing Reason Strings Useful

Added a small reason helper so the offline route response still distinguishes:

- built-in managed OpenClaw offline state
- generic external/remote OpenClaw offline state

This preserves useful diagnostics without reintroducing deployment-specific
behavior splits in the route contract itself.

### 3. Locked The Regression In Both Levels

The fix is now covered in two places:

- focused service regression
- broader chat contract regression

This prevents the route service from drifting again while the chat contract
still passes by accident.

## Files Changed

- `packages/sdkwork-clawstudio-chat/src/services/instanceChatRouteService.ts`

## Verification

Red evidence captured before implementation:

- focused TypeScript check for
  `packages/sdkwork-clawstudio-chat/src/services/instanceChatRouteService.test.ts`
- focused TypeScript check for `scripts/sdkwork-chat-contract.test.ts`

Green evidence after implementation:

- focused TypeScript check for
  `packages/sdkwork-clawstudio-chat/src/services/instanceChatRouteService.test.ts`
- focused TypeScript check for `scripts/sdkwork-chat-contract.test.ts`
- `node scripts/run-sdkwork-chat-check.mjs`
- `pnpm.cmd lint`

## Remaining Follow-Up

The next adjacent runtime-truth slice remains:

- launched-session evidence for built-in OpenClaw `online` convergence
- websocket reachability and proxy-router proof on top of converged runtime
  truth
- upward validation for chat, notification, cron, and instance-detail behavior
  once a real managed runtime session is live
