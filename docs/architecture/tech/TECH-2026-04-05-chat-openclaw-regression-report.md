> Migrated from `docs/reports/2026-04-05-chat-openclaw-regression-report.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Chat And OpenClaw Regression Report

Date: 2026-04-05

Scope:
- chat session list and sidebar presentation
- free chat routing and effective model catalog selection
- notification and cron-related chat activity services
- instance detail, workbench, files, providers, and task surfaces
- desktop hosted runtime readiness, proxy router, and local AI proxy contracts
- built-in OpenClaw startup and packaged runtime verification contracts

## Summary

This regression pass found seven real regressions in the current tree and closed all seven:

1. `packages/sdkwork-claw-chat/src/services/index.ts` exported the browser-only `clawChatService`, which pulled `react-i18next` into pure Node service tests and broke service-level regression coverage with `EPERM` while loading `react/index.js`.
2. `packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts` still modeled built-in managed OpenClaw instances without `status: 'online'`, which no longer matches the hosted runtime contract after route hardening. That stale fixture caused the service to take the non-gateway fallback path and skip managed/runtime filtering.
3. `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts` could leave chat hydration stuck in `syncState = 'loading'` if the first gateway WebSocket connect attempt failed and immediately transitioned into automatic reconnecting. That left the UI in a spinner/error limbo exactly when built-in OpenClaw startup was still racing.
4. `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts` could also leave the first `hydrateInstance()` promise unresolved forever in that same reconnect path, which meant higher-level chat bootstrap code could hang even after the snapshot had already switched into an error/reconnecting state.
5. `packages/sdkwork-claw-shell/src/components/ChatCronActivityNotifications.tsx` bypassed notification preferences completely, so cron/chat activity could still raise toast and desktop notifications even after the user disabled `newMessages`. The failure got worse when notification settings authentication expired, because the settings service forgot the user's last notification choices and fell back to an all-enabled default.
6. `packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.ts`, `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`, and `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts` handled OpenClaw agent file ids with mixed raw and normalized agent ids. Backend-authored file ids such as `Research Team` no longer matched the normalized agent ids used by the workbench and gateway readers, which could make instance file lists appear empty and route remote file reads to the wrong gateway agent id.
7. `packages/sdkwork-claw-desktop/src/desktop/desktopHostRuntimeResolver.ts` only gave the embedded desktop host 1.2 seconds to publish a complete hosted runtime descriptor. On slower starts, the renderer could treat `browserBaseUrl` as permanently unavailable and fail startup with `studio.resolveHostedBasePath` before the embedded host finished warming up.

## Fixes Applied

- Removed the `clawChatService` re-export from `packages/sdkwork-claw-chat/src/services/index.ts`.
  This keeps the local `services` barrel Node-safe for pure service tests while preserving the package root export for UI consumers that intentionally use the browser-only mock chat helper.

- Added a regression contract in `scripts/sdkwork-chat-contract.test.ts`.
  The chat parity suite now explicitly guards the Node-safe `services` barrel boundary so the browser-only export cannot silently re-enter the service barrel.

- Updated built-in managed OpenClaw fixtures in `packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts` to include `status: 'online'`.
  This aligns the regression suite with the current host contract: local-managed OpenClaw is only gateway-routable when the runtime is explicitly online.

- Hardened `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts` so connection events for `reconnecting` and `disconnected` immediately break the initial loading state instead of waiting forever on a deferred `connect()` promise.
  This keeps the chat UI truthful when OpenClaw is still starting or temporarily refusing the first WebSocket connection.

- Further hardened `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts` so the active initial load cycle interrupts its pending `connect()` wait when the gateway drops into `reconnecting` or `disconnected`.
  This keeps upstream chat bootstrap flows from hanging forever while preserving the background WebSocket client's retry behavior.

- Added regression tests in `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`.
  The suite now locks both sides of the initial-connect race: the snapshot cannot silently stay in `loading`, and the outer `hydrateInstance()` promise cannot silently hang during built-in OpenClaw startup.

- Hardened `packages/sdkwork-claw-core/src/services/settingsService.ts` so the local settings overlay now persists notification preferences alongside general/privacy/security preferences.
  When notification settings authentication expires, the runtime now reuses the cached notification toggles instead of reverting to an all-enabled fallback.

- Extracted `packages/sdkwork-claw-shell/src/components/chatCronActivityNotificationRuntime.ts` and rewired `packages/sdkwork-claw-shell/src/components/ChatCronActivityNotifications.tsx` through it.
  The runtime now gates cron/chat notifications behind `settingsService.getPreferences().notifications.newMessages`, while still keeping system notifications best-effort and visibility-aware.

- Added regression tests in `packages/sdkwork-claw-core/src/services/settingsService.test.ts` and `packages/sdkwork-claw-shell/src/components/chatCronActivityNotificationRuntime.test.ts`.
  The suite now locks both sides of the notification preference path: cached notification toggles survive auth expiry, and runtime delivery respects `newMessages = false`.

- Added `normalizeOpenClawAgentFileId(...)` in `packages/sdkwork-claw-instances/src/services/openClawSupport.ts` and applied it across the instance file stack.
  Backend-authored OpenClaw file ids are now normalized consistently before workbench mapping, agent-scoped file filtering, and gateway file reads/writes. This keeps instance detail file surfaces attached to the correct agent even when backend snapshots still carry legacy raw agent ids.

- Added regression tests in `packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.test.ts`, `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`, and `packages/sdkwork-claw-instances/src/services/instanceService.test.ts`.
  The suite now locks the full file path: normalized agent ids still see backend-authored files, backend workbench snapshots normalize file ids alongside agent ids, and remote OpenClaw file reads normalize gateway agent ids before requesting file bodies.

- Increased the default hosted runtime descriptor retry window in `packages/sdkwork-claw-desktop/src/desktop/desktopHostRuntimeResolver.ts` from 1.2 seconds to 5 seconds.
  This keeps slower embedded-host warmups from being misclassified as permanent hosted-runtime descriptor failures during desktop bootstrap.

- Added a slow-start regression in `packages/sdkwork-claw-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`.
  The resolver now proves it can survive a slow but eventually successful embedded host startup instead of failing early and surfacing `browserBaseUrl`/`resolveHostedBasePath` errors to the renderer.

## Verified Areas

Chat and session behavior:
- `packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.test.ts`
- `packages/sdkwork-claw-chat/src/services/chatSessionListPresentation.test.ts`
- `packages/sdkwork-claw-chat/src/services/chatHeaderPresentation.test.ts`
- `packages/sdkwork-claw-chat/src/services/chatMessageGroupPresentation.test.ts`
- `packages/sdkwork-claw-chat/src/services/chatCronActivityNotifications.test.ts`
- `packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts`
- `packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.test.ts`
- `packages/sdkwork-claw-chat/src/services/openClawGatewayHistoryConfigService.test.ts`
- `packages/sdkwork-claw-chat/src/services/openClawChatAgentCatalogService.test.ts`
- `scripts/sdkwork-chat-contract.test.ts`
- `pnpm.cmd check:sdkwork-chat`

Notification, cron, and instance detail:
- `packages/sdkwork-claw-settings/src/services/settingsService.test.ts`
- `packages/sdkwork-claw-core/src/services/settingsService.test.ts`
- `packages/sdkwork-claw-core/src/services/cronTaskPayload.test.ts`
- `packages/sdkwork-claw-commons/src/components/cronTasksManagerData.test.ts`
- `packages/sdkwork-claw-shell/src/components/chatCronActivityNotificationRuntime.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.test.ts`
- `packages/sdkwork-claw-instances/src/services/agentWorkbenchService.test.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-shell`

Desktop host, hosted mode, proxy router, and OpenClaw packaging:
- `packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`
- `packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.test.ts`
- `packages/sdkwork-claw-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
- `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.test.ts`
- `scripts/sdkwork-host-runtime-contract.test.ts`
- `scripts/desktop-local-ai-proxy-contract.test.mjs`
- `pnpm.cmd check:desktop`

Server host, CORS, hosted runtime, and gateway routes:
- `packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.test.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `cargo test desktop_combined_hosted_startup_preflight_allows_browser_session_header_for_critical_routes -- --nocapture`
- `cargo test desktop_combined_hosted_startup_requests_include_cors_headers_on_successful_responses -- --nocapture`
- `pnpm.cmd check:server`
  This passed Rust host tests covering desktop-combined hosted startup CORS preflight, browser-session-token protected hosted routes, canonical `host-platform` / `host-endpoints` surfaces, and `gateway/invoke` unavailable-path behavior.

Workspace integration:
- `pnpm.cmd lint`
- `pnpm.cmd build`

## Findings

### 1. Fixed: Node-safe service regression in chat barrel

Impact:
- Pure service regression tests for chat presentation utilities could fail before executing any assertions.
- The failure was architectural, not behavioral: the wrong dependency graph entered Node-only tests.

Root cause:
- `services/index.ts` mixed pure utility exports with `clawChatService`, which depends on `react-i18next`.

Resolution:
- The browser-only helper was removed from the local service barrel and kept isolated behind the package root export.

### 2. Fixed: stale built-in OpenClaw runtime fixture in model catalog coverage

Impact:
- The regression suite incorrectly modeled built-in managed OpenClaw as gateway-ready without an explicit online status.
- That hid the real intended route behavior of the hardened runtime path.

Root cause:
- Test fixtures were older than the current hosted runtime contract.

Resolution:
- The fixtures now declare `status: 'online'`, which matches the route guard used by the chat catalog service and the desktop/server hosted runtime contracts.

### 3. Fixed: initial gateway reconnect race could leave chat hydration permanently loading

Impact:
- When built-in OpenClaw had not finished accepting WebSocket connections yet, chat hydration could stay in a loading spinner instead of surfacing a recoverable connection error.
- This made first-launch OpenClaw startup races look like empty chat data rather than an explicit reconnecting/unavailable state.

Root cause:
- `refreshInstance(...)` awaited `client.connect()`.
- The gateway client intentionally keeps that promise pending while it auto-retries reconnectable socket failures.
- The session store updated `connectionStatus` and `lastError` from reconnect events, but it did not break `syncState = 'loading'` during that path.

Resolution:
- Reconnecting and disconnected connection events now force the active load cycle out of `loading` and into `error`, while still allowing the background client to continue retrying.
- When the gateway later reconnects successfully, the existing connected-event refresh path still reloads the live session list and history.

### 4. Fixed: initial gateway reconnect race could leave hydrate callers blocked forever

Impact:
- Even after the snapshot correctly switched to `error` and `reconnecting`, higher-level callers awaiting `hydrateInstance()` could still block indefinitely.
- That could stall chat bootstrap helpers that wait on hydration before continuing to session routing, history reloads, or instance-scoped connection fan-out.

Root cause:
- The gateway client intentionally keeps `connect()` pending across recoverable reconnects.
- The session store updated snapshot state from connection events, but it still directly awaited the original `connect()` promise in `refreshInstance(...)`.

Resolution:
- The session store now races the initial `connect()` attempt against an internal interrupt that is triggered by `reconnecting` and `disconnected` connection events during an active load cycle.
- That lets `hydrateInstance()` return the current error/reconnecting snapshot promptly while leaving the gateway client's background auto-retry path intact.

### 5. Fixed: cron/chat notifications bypassed user preferences and forgot cached toggles after auth expiry

Impact:
- Users could still receive cron/chat toast notifications and desktop notifications after disabling `newMessages`.
- If the notification settings endpoint returned an authentication expiry error, the runtime forgot the user's last notification choice and silently reverted to all notifications enabled.

Root cause:
- `ChatCronActivityNotifications.tsx` emitted toast and desktop notifications directly from chat store changes without consulting notification preferences.
- `settingsService` only persisted general/privacy/security values in its local overlay, so notification toggles were lost whenever the remote notification settings endpoint became temporarily unavailable.

Resolution:
- Notification preferences are now cached in the local overlay with the rest of the user preferences.
- The cron/chat notification runtime now resolves `settingsService.getPreferences()` before delivering notifications and suppresses both toast and desktop delivery when `notifications.newMessages` is disabled.
- Auth-expiry fallback now reuses the cached notification toggles instead of fabricating an all-enabled preference set.

### 6. Fixed: backend-authored OpenClaw file ids could detach files from normalized agents and misroute gateway reads

Impact:
- Instance detail could show an empty file explorer even though backend workbench snapshots already contained files.
- Remote OpenClaw file reads could request the wrong agent id from the gateway when legacy backend snapshots still used raw ids such as `Research Team`.

Root cause:
- Workbench agents were normalized to canonical OpenClaw agent ids, but backend-authored workbench files kept their original raw file ids.
- Agent-scoped file filtering compared parsed file agent ids against normalized agent ids without normalizing both sides.
- Gateway file readers also parsed the raw file id directly, so the same legacy id drift could leak into runtime file requests.

Resolution:
- OpenClaw file ids are now normalized centrally before workbench mapping, agent-scoped file filtering, and gateway file reads/writes.
- This keeps legacy backend snapshots compatible with the normalized OpenClaw agent/runtime model already used elsewhere in the instance workbench.

### 7. Fixed: desktop hosted runtime descriptor timeout was too short for slower embedded-host startup

Impact:
- Desktop bootstrap could fail with `studio.resolveHostedBasePath` and `Canonical desktop embedded host runtime descriptor is unavailable` even when the embedded host would have become ready moments later.
- That early failure could cascade into hosted runtime readiness errors and apparent renderer-side CORS/bootstrap breakage during slow local startup.

Root cause:
- The desktop hosted runtime resolver only retried for 1.2 seconds before declaring the descriptor unavailable.
- Embedded host startup can legitimately take longer than that while `browserBaseUrl` and the browser session token are still warming up.

Resolution:
- The default hosted runtime descriptor retry window now allows a slower but valid embedded-host warmup to complete before bootstrap fails.
- Dedicated regression coverage now locks the slow-start path so the resolver cannot regress back to an overly aggressive failure window.

## Current Risk Assessment

Green with strong automated evidence:
- chat session list presentation
- chat header and grouped message presentation
- free dialogue route resolution and managed model filtering
- gateway startup failures now surface as error state instead of hanging the chat store in loading
- initial hydrate callers now resolve promptly when the first gateway connect falls into automatic reconnecting
- notification settings and cron payload mapping
- cron/chat activity notifications now honor the `newMessages` preference, including auth-expiry fallback to cached notification toggles
- instance detail, files, providers, and task workbench paths
- legacy backend-authored OpenClaw file ids now stay attached to normalized workbench agents and gateway file readers
- desktop hosted runtime readiness probe
- slow embedded-host startup no longer gets misclassified as an immediate hosted-runtime descriptor failure
- hosted internal/manage/studio bridge surfaces
- server-hosted browser bridge CORS preflight and browser-session-token startup flow
- canonical `host-platform`, `host-endpoints`, and OpenClaw `gateway/invoke` route contracts on the Rust host
- local AI proxy contract and packaged OpenClaw runtime verification

Still requires out-of-sandbox end-to-end smoke:
- launching the actual packaged desktop app and observing built-in OpenClaw startup from the real installer output
- validating real browser fetch/CORS behavior against the live embedded host process rather than test doubles
- validating live gateway websocket availability against a real spawned OpenClaw runtime instead of mocked readiness contracts

## Recommended Next Steps

1. Run a packaged desktop smoke outside the current sandbox and capture:
   - embedded host start log
   - OpenClaw runtime port allocation
   - `host-platform`, `host-endpoints`, and `studio/instances` live responses
   - gateway websocket handshake success

2. Add one end-to-end desktop smoke that asserts:
   - built-in OpenClaw reaches `status: online`
   - `browserBaseUrl` resolves
   - `gateway/invoke` stops returning `503`
   - the OpenClaw console URL opens from instance detail

3. Add one live hosted smoke for the embedded desktop browser shell that asserts:
   - preflight requests from the real renderer origin receive CORS headers
   - the browser session header is attached on hosted startup calls
   - `host-platform`, `host-endpoints`, and `studio/instances` succeed before chat bootstrap continues

4. Keep expanding contract coverage around runtime readiness to cover:
   - missing `openClawConfigService.readConfigDocument` wiring
   - CORS headers on embedded host preflight routes
   - websocket startup sequencing between embedded host and OpenClaw runtime

