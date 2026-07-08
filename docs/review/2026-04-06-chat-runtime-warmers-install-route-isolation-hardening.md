# 2026-04-06 Chat Runtime Warmers Install Route Isolation Hardening

## Scope

This iteration closes a shell-level startup leak where the install flow still
mounted chat runtime warmers even though install is not an authenticated
workspace route.

The affected behavior sat above the earlier OpenClaw authority/runtime fixes:

- the install surface should prepare installers and guided setup only
- it must not preconnect chat gateway sessions
- it must not start cron notification polling
- it must not create misleading runtime side effects before the built-in host is
  actually needed

## Root Cause

`MainLayout.tsx` delayed the mounting of `ChatRuntimeWarmers`, but the gating
logic only treated auth routes as cold-start routes.

Pre-fix path:

1. shell navigated to `/install` or `/install/...`
2. `MainLayout` was not in an auth route, so the shared authenticated chrome
   rendered normally
3. the warmers effect waited 150ms and then mounted `ChatRuntimeWarmers`
4. `ChatRuntimeWarmers` pulled in:
   - OpenClaw gateway preconnect behavior
   - cron activity notification runtime wiring
5. install flow therefore triggered background chat/runtime work that does not
   belong to installer-only sessions

This was not a bootstrap-host failure by itself, but it widened the blast
radius of any transient built-in runtime issue and made install-mode startup
behavior noisier than the product contract allows.

## Failing Evidence

Regression coverage was added first for the route gating policy.

File:

- `packages/sdkwork-clawstudio-shell/src/application/layouts/chatRuntimeWarmersPolicy.test.ts`

Reproduction encoded by the test:

- `/auth`, `/login`, `/register`, `/forgot-password`, and OAuth callback routes
  must keep warmers disabled
- `/install` and `/install/windows` must also keep warmers disabled
- authenticated workspace routes such as `/dashboard`, `/chat`, and `/nodes`
  must keep warmers enabled

Observed pre-fix failure:

- install routes still resolved to `true`
- that allowed the delayed `ChatRuntimeWarmers` mount on installer pages

## Changes Landed

### 1. Extracted route policy into a dedicated helper

File:

- `packages/sdkwork-clawstudio-shell/src/application/layouts/chatRuntimeWarmersPolicy.ts`

Change:

- introduced `shouldRenderChatRuntimeWarmersForPath(pathname)`
- centralized the route allow/deny policy instead of re-encoding it in
  `MainLayout`
- explicitly marks both `/install` and nested install routes as warmer-disabled

Result:

- shell startup policy for chat warmers is now testable as a pure function
- install-route isolation is no longer an implicit side effect hidden in React
  component timing

### 2. Switched `MainLayout` to the shared policy

File:

- `packages/sdkwork-clawstudio-shell/src/application/layouts/MainLayout.tsx`

Change:

- `MainLayout` now asks the dedicated helper whether warmers are allowed for the
  current path before scheduling the delayed mount
- the existing auth-route behavior remains unchanged

Result:

- install routes no longer mount `ChatRuntimeWarmers`
- installer screens stay isolated from chat gateway and cron warmup side effects

### 3. Locked the shell contract

Files:

- `packages/sdkwork-clawstudio-shell/src/application/layouts/chatRuntimeWarmersPolicy.test.ts`
- `scripts/sdkwork-shell-contract.test.ts`
- `package.json`

Change:

- added a focused route-policy regression
- extended the shell contract so automation checks for the dedicated helper and
  install-route coverage
- ensured the focused shell check path includes this coverage

## Verification Evidence

The following commands were run after the fix:

- `node --experimental-strip-types packages/sdkwork-clawstudio-shell/src/application/layouts/chatRuntimeWarmersPolicy.test.ts`
- `pnpm.cmd check:sdkwork-shell`
- `pnpm.cmd lint`

All passed.

## Impact

This closes a startup leak in the shared shell:

1. installer routes no longer trigger chat gateway preconnects or cron
   notification warmers
2. built-in OpenClaw startup symptoms observed during install flow are now less
   likely to be polluted by unrelated chat runtime work
3. the route policy is now explicit, reusable, and contract-tested
4. future shell warmers can reuse the same path-level isolation point instead of
   growing more ad hoc guards inside `MainLayout`

## Remaining Gaps

This iteration isolates install-mode startup, but higher-level launched-session
evidence is still open:

1. validate that authenticated launched sessions mount the warmers only when the
   built-in runtime is actually authoritative and ready
2. verify live startup behavior for chat, notification, cron, and instance
   detail on top of the now-isolated shell routing
3. continue from route isolation into real launched-session runtime correctness,
   not only route-policy and contract coverage
