# 2026-04-06 OpenClaw Global Notification Gateway Warmup Hardening

## Scope

This iteration closes a launched-session gap between the globally mounted chat
notification runtime and the route policy used by OpenClaw gateway warmup.

The gap affected authenticated workspace routes outside `/chat`:

- cron notifications were mounted globally through `ChatRuntimeWarmers`
- the OpenClaw gateway preconnect runtime only warmed on `/chat`
- that meant launched sessions outside the chat page could keep the
  notification runtime alive without a live OpenClaw session feed

## Root Cause

The system had a policy split between producer and consumer:

1. `MainLayout` mounted `ChatRuntimeWarmers` on authenticated workspace routes
   such as `/dashboard`, `/tasks`, `/nodes`, and `/settings`
2. `ChatRuntimeWarmers` always mounted:
   - `OpenClawGatewayConnections`
   - `ChatCronActivityNotifications`
3. `ChatCronActivityNotifications` subscribed globally to `useChatStore`
4. `OpenClawGatewayConnections`, however, only warmed when
   `shouldWarmOpenClawGatewayConnections(pathname)` returned `true`
5. pre-fix, that helper returned `true` only for `/chat`

Result:

- on non-chat workspace routes, the cron notification runtime existed
- but it had no guaranteed live OpenClaw gateway session source unless the user
  had already visited `/chat`
- launched-session notification correctness therefore depended on navigation
  history instead of current runtime truth

## Failing Evidence

Regression coverage was written first in:

- `packages/sdkwork-agentstudio-pc-chat/src/runtime/openClawGatewayConnectionsPolicy.test.ts`

The test encoded the required runtime contract:

1. `/chat` must warm the directory plus the active instance
2. non-chat workspace routes must keep the active instance warm even without
   directory-wide refresh
3. auth and install routes must stay cold

Observed pre-fix failure:

- `shouldWarmOpenClawGatewayConnections('/tasks')` returned `false`
- no route-aware warm plan existed for active-instance-only preconnect
- the new test failed before implementation because the runtime could not
  express the required non-chat workspace behavior

## Changes Landed

### 1. Added a dedicated warm-plan resolver

File:

- `packages/sdkwork-agentstudio-pc-chat/src/runtime/openClawGatewayConnectionsPolicy.ts`

Change:

- introduced `resolveOpenClawGatewayWarmPlan(...)`
- the helper now resolves three runtime shapes:
  - auth/install routes: cold
  - `/chat`: directory refresh plus active-instance inclusion
  - other authenticated workspace routes: active-instance-only warmup

Result:

- route policy is now explicit instead of being hidden behind a single
  `/chat` boolean
- the runtime can keep global notifications truthful without paying the full
  directory-refresh cost on every workspace screen

### 2. Switched `OpenClawGatewayConnections` onto the warm plan

File:

- `packages/sdkwork-agentstudio-pc-chat/src/runtime/OpenClawGatewayConnections.tsx`

Change:

- directory polling now runs only when the warm plan requires it
- non-chat workspace routes now preconnect only the currently active instance
- install/auth cold routes remain disabled

Result:

- global cron/notification runtime now has a live chat-store feed for the
  active OpenClaw instance outside `/chat`
- directory-wide polling remains limited to the real chat surface

### 3. Added regression coverage to the chat gate

Files:

- `packages/sdkwork-agentstudio-pc-chat/src/runtime/openClawGatewayConnectionsPolicy.test.ts`
- `scripts/run-sdkwork-chat-check.mjs`

Change:

- added focused route-policy coverage
- included the new test in the standard `sdkwork-chat` gate

## Verification Evidence

The following commands were run after the fix:

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-chat/src/runtime/openClawGatewayConnectionsPolicy.test.ts`
- `node scripts/run-sdkwork-chat-check.mjs`
- `pnpm.cmd lint`

All passed.

## Impact

This closes an important launched-session correctness gap:

1. cron/notification runtime no longer depends on whether the user has already
   visited the chat page in the current session
2. active built-in OpenClaw sessions can keep producing notification-worthy
   updates on other authenticated workspace routes
3. the performance cost stays bounded because directory-wide polling still
   happens only on `/chat`
4. install/auth route isolation remains intact

## Remaining Gaps

This iteration fixes the runtime feed mismatch, but some higher-level evidence
is still open:

1. live launched-session validation that the active built-in instance reaches
   `online` and then delivers real cron/chat updates through the shared runtime
2. upward validation for instance-detail behavior and OpenClaw console-open
   flows on top of the corrected runtime warm plan
3. packaged desktop installer smoke on Windows/Linux/macOS outside synthetic
   contract checks
