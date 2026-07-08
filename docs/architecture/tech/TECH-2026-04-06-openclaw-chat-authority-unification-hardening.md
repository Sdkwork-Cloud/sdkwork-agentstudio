> Migrated from `docs/review/2026-04-06-openclaw-chat-authority-unification-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 OpenClaw Chat Authority Unification Hardening

## Scope

This iteration closes a second OpenClaw authority split inside the chat runtime after the earlier WebSocket registry fix:

- `chatStore` route-mode resolution could still use stale `studio.getInstance(...)` snapshot metadata
- `studioConversationGateway` could still decide whether local snapshot conversations were allowed by the same stale snapshot metadata
- `openClawGatewayClientRegistry` had already been hardened to prefer `studio.getInstanceDetail(...)`

That meant one built-in OpenClaw instance could still be interpreted through two different authorities during the same launched session.

## Root Cause

The system still had split-brain authority inside the chat path:

1. `chatStore.connectGatewayInstances(...)` called `resolveInstanceRouteMode(...)`
   - this still used `studio.getInstance(instanceId)`
   - stale snapshot metadata could say the built-in runtime was already on
     `instanceOpenClawGatewayWs`

2. `connectGatewayInstancesBestEffort(...)` then tried to hydrate the gateway session store
   - gateway hydration delegated to `openClawGatewayClientRegistry`
   - that registry had already been corrected to prefer `studio.getInstanceDetail(instanceId)`

3. if detail authority said the runtime was still `starting` or no longer had a live gateway endpoint:
   - `chatStore` believed the instance was gateway-ready
   - `openClawGatewayClientRegistry` rejected the same instance as not backed by a live gateway WebSocket
   - the user-facing symptom became a false gateway preconnect failure even though the real bug was internal authority disagreement

The same pattern still existed in `studioConversationGateway`:

- the decision to suppress local snapshot conversations for managed built-in OpenClaw still used `studio.getInstance(instanceId)`
- if the snapshot said gateway-ready while detail authority said the built-in runtime was not yet ready, local conversation snapshots could leak into the UI during a runtime-unavailable state

## Failing Evidence

Two regressions were written first and failed before the fix:

### 1. `chatStore` authority mismatch regression

File:

- `packages/sdkwork-clawstudio-chat/src/store/chatStoreAuthority.test.ts`

Reproduction:

- `studio.getInstance(instanceId)` returned a stale built-in snapshot that still looked gateway-ready
- `studio.getInstanceDetail(instanceId)` returned the same built-in instance in `starting` state with no gateway endpoints

Observed pre-fix failure:

- `chatStore.connectGatewayInstances(...)` set `instanceRouteModeById[instanceId]` to `instanceOpenClawGatewayWs`
- gateway hydration then failed inside `openClawGatewayClientRegistry`
- the test failed with:
  - actual route mode: `instanceOpenClawGatewayWs`
  - expected route mode: `unsupported`

### 2. `studioConversationGateway` authority mismatch regression

File:

- `packages/sdkwork-clawstudio-chat/src/store/studioConversationGateway.test.ts`

Reproduction:

- `studio.getInstance(instanceId)` returned a stale gateway-ready built-in snapshot
- `studio.getInstanceDetail(instanceId)` returned the built-in runtime as `starting`
- `studio.listConversations(instanceId)` was instrumented to prove whether local snapshot conversations were still read

Expected behavior:

- local snapshot conversations must stay blocked while the authoritative built-in runtime is unavailable

## Changes Landed

### 1. Added a shared authoritative route resolver for chat

Files:

- `packages/sdkwork-clawstudio-chat/src/services/store/authoritativeInstanceChatRoute.ts`
- `packages/sdkwork-clawstudio-chat/src/services/store/index.ts`

Change:

- introduced `resolveAuthoritativeInstanceChatRoute(instanceId)`
- the helper now resolves authority in this order:
  - `studio.getInstanceDetail(instanceId)` first
  - `detail.instance` as the authoritative runtime projection when available
  - `studio.getInstance(instanceId)` only as a fallback
- the helper returns:
  - authoritative `detail`
  - authoritative/fallback `instance`
  - resolved `route`

This keeps all chat-side route decisions on one authority surface instead of re-implementing the lookup differently in each subsystem.

### 2. Hardened `chatStore` route-mode resolution

File:

- `packages/sdkwork-clawstudio-chat/src/store/chatStore.ts`

Change:

- `resolveInstanceRouteMode(...)` now uses the authoritative resolver
- `hydrateInstance(...)` now also uses the authoritative resolver before deciding whether to hydrate gateway sessions or local snapshot conversations

Result:

- route-mode selection and gateway hydration now agree on the same built-in OpenClaw truth
- stale snapshot gateway projections no longer trigger false gateway hydration attempts

### 3. Hardened snapshot conversation authority blocking

File:

- `packages/sdkwork-clawstudio-chat/src/store/studioConversationGateway.ts`

Change:

- `shouldBlockSnapshotConversationAuthority(...)` now uses the same authoritative resolver

Result:

- built-in OpenClaw local snapshot conversations stay blocked whenever detail authority says the managed runtime is not actually gateway-ready
- the chat UI no longer mixes stale local snapshot data into a launched session whose real built-in runtime is unavailable

### 4. Unified the WebSocket registry on the same helper

File:

- `packages/sdkwork-clawstudio-chat/src/services/openclaw/openClawGatewayClientRegistry.ts`

Change:

- switched the registry to use the same authoritative route helper for route selection
- auth-token preference order remains:
  - `detail.config.authToken`
  - `detail.instance.config.authToken`
  - snapshot `instance.config.authToken`

Result:

- chat route selection, snapshot blocking, and gateway client hydration now all resolve the built-in runtime through the same authority path

## Regression Coverage Added

Files:

- `packages/sdkwork-clawstudio-chat/src/store/chatStoreAuthority.test.ts`
- `packages/sdkwork-clawstudio-chat/src/store/studioConversationGateway.test.ts`
- `scripts/run-sdkwork-chat-check.mjs`

New coverage now locks:

1. `chatStore` must not attempt gateway hydration from a stale snapshot when detail authority says the built-in runtime is not ready
2. `studioConversationGateway` must not expose snapshot conversations when detail authority says the managed runtime is unavailable

## Verification Evidence

The following commands were run after the fix:

- `node scripts/run-sdkwork-chat-check.mjs`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd lint`

All passed.

## Impact

This closes the remaining chat-side authority split discovered after the earlier WebSocket endpoint hardening:

1. built-in OpenClaw route-mode selection, snapshot blocking, and WebSocket hydration now consume one shared authority model
2. stale `studio.getInstance(...)` snapshot metadata can no longer push chat into a gateway path that detail authority rejects
3. local snapshot conversations no longer override the real built-in runtime state during startup or runtime drift
4. the launched-session chat path is now more consistent with the stricter hosted-runtime readiness work already landed on the desktop bootstrap side

## Remaining Gaps

This iteration closes the authority split itself, but several higher-level behavior checks are still open:

1. validate launched-session chat flows end to end against a real built-in OpenClaw runtime, not only unit and contract gates
2. review whether other chat/runtime consumers still derive route truth from stale instance snapshots outside this unified helper
3. continue upward into notification, cron, and instance-detail launched-session validation on top of the now-unified chat authority path

