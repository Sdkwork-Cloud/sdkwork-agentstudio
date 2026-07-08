> Migrated from `docs/review/2026-04-06-openclaw-chat-service-authority-alignment-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 OpenClaw Chat Service Authority Alignment Hardening

## Problem

The chat runtime already had authoritative-route hardening in these paths:

- `packages/sdkwork-clawstudio-chat/src/store/chatStore.ts`
- `packages/sdkwork-clawstudio-chat/src/store/studioConversationGateway.ts`
- `packages/sdkwork-clawstudio-chat/src/services/openclaw/openClawGatewayClientRegistry.ts`

Those paths use
`packages/sdkwork-clawstudio-chat/src/services/store/authoritativeInstanceChatRoute.ts`
to resolve runtime truth from `studio.getInstanceDetail(...)` before falling
back to the lighter snapshot.

But `packages/sdkwork-clawstudio-chat/src/services/chatService.ts`, which is used by
`packages/sdkwork-clawstudio-chat/src/pages/Chat.tsx` for the direct send/stream
entry, still resolved the active route by calling only:

- `studio.getInstance(activeInstanceId)`
- `resolveInstanceChatRoute(snapshot)`

That reopened the same stale-snapshot bug in a user-visible path.

## Root Cause

The chat module had already centralized authoritative route truth, but
`chatService` kept an older local helper instead of using the shared authority
resolver. This left the codebase in a partially migrated state:

- store path: authoritative
- conversation path: authoritative
- gateway client registry path: authoritative
- direct chat send path: stale snapshot

In practice, a built-in OpenClaw snapshot could still advertise
`openclawGatewayWs` and `status: online` while the authoritative detail already
said the managed runtime was still `starting` or otherwise not ready.

That meant the chat page could report "native OpenClaw Gateway WebSocket flow"
even though runtime truth should have blocked the route as not ready yet.

## Changes

### 1. Align `chatService` with authoritative runtime truth

`packages/sdkwork-clawstudio-chat/src/services/chatService.ts` now resolves the active
instance route through:

- `resolveAuthoritativeInstanceChatRoute(activeInstanceId)`

instead of reimplementing route resolution from `studio.getInstance(...)`
alone.

This makes the chat send/stream entry consistent with the already-hardened chat
store, conversation gateway, and OpenClaw gateway client registry.

### 2. Add a user-path regression

Added:

- `packages/sdkwork-clawstudio-chat/src/services/chatService.test.ts`

The regression proves that when:

- the snapshot says built-in OpenClaw is online
- the authoritative detail says it is still `starting`

`chatService.sendMessageStream(...)` must report the instance as not chat-ready
instead of announcing the native OpenClaw gateway route.

### 3. Wire the regression into the standard chat gate

Updated:

- `scripts/run-sdkwork-chat-check.mjs`

so the new `chatService` authority regression is part of the normal
`pnpm.cmd check:sdkwork-chat` verification path.

## Verification

Executed in this iteration:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-clawstudio-chat/src/services/chatService.test.ts']))"`
- `pnpm.cmd check:sdkwork-chat`

## Outcome

Closed for this slice:

- the chat page send/stream entry no longer bypasses authoritative
  `instanceDetail` runtime truth
- stale built-in OpenClaw snapshots no longer allow `chatService` to announce a
  ready gateway route while detail authority says the runtime is still starting
- the chat verification gate now covers the real user send/stream path in
  addition to store and gateway registry authority checks

Still open after this slice:

- launched-session validation for notifications, cron, proxy router, and
  instance detail on top of the aligned chat truth
- real packaged desktop startup smoke with a live built-in OpenClaw runtime
  outside contract-level verification

