> Migrated from `docs/review/step-06-chat路由模式矩阵-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Fresh `Step 06` verification confirms the unified Chat entry now freezes one authoritative route matrix instead of letting pages guess transports.
- Route resolution is anchored to `studio.getInstanceDetail()` first and only falls back to the instance snapshot when detail authority is unavailable.
- Managed OpenClaw chat stays on the `Gateway -> Local Proxy -> Upstream` path and does not silently degrade to local HTTP or browser-direct provider calls.

## Attempt Outcome

- Authoritative route truth:
  - `resolveAuthoritativeInstanceChatRoute()` reads `studio.getInstanceDetail(instanceId)` first, then falls back to `studio.getInstance(instanceId)` before passing the resolved instance into `resolveInstanceChatRoute()`.
  - This keeps the chat route aligned with the same runtime metadata surface consumed by `InstanceDetail`.
- Frozen route enum and decision rules:
  - `instanceChatRouteService.ts` keeps the only supported route modes as `directLlm` / `instanceOpenClawGatewayWs` / `instanceOpenAiHttp` / `instanceSseHttp` / `instanceWebSocket` / `unsupported`.
  - `runtimeKind === 'openclaw'` resolves to `instanceOpenClawGatewayWs` only when the runtime is online and publishes a gateway HTTP or WebSocket endpoint; otherwise it returns `unsupported` with an explicit operator-readable reason.
  - `transportKind === 'openclawGatewayWs'` resolves to the Gateway WebSocket route.
  - `zeroclawHttp`、`openaiHttp`、`customHttp` resolve to `instanceOpenAiHttp`.
  - `ironclawWeb` resolves to `instanceSseHttp`.
  - `customWs` resolves to `instanceWebSocket`.
- Chat execution semantics:
  - `chatService.sendMessageStream()` first resolves the authoritative route before reporting route readiness for the active instance.
  - Managed OpenClaw Gateway sessions are explicitly handed off to the gateway-session chain instead of the generic HTTP stream helper.
  - Compatible HTTP routing stays behind route endpoints and instance headers; the service does not reintroduce browser-direct provider SDK calls or env-key fallbacks.
  - When no active instance exists, the service returns the explicit operator prompt to select or start an OpenClaw-compatible instance instead of fabricating a route.
- Chat page and route bootstrapping:
  - `Chat.tsx` derives `routeMode` from `instanceRouteModeById[activeInstanceId]` and treats `instanceOpenClawGatewayWs` as a first-class mode.
  - `chatStore.hydrateInstance()` and `connectGatewayInstancesBestEffort()` pre-resolve route mode per instance before hydrating gateway state.
  - The contract suite confirms that an unresolved instance route must not fall back to local HTTP while route authority is still pending.

## OpenClaw Fact Sources

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
  - remains the authoritative `getInstanceDetail()` / `getInstance()` source for runtime status, `runtimeKind`, `transportKind`, `baseUrl`, `websocketUrl`, and published connectivity endpoints.
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
  - freezes the built-in OpenClaw endpoint contract so Studio does not fabricate OpenAI HTTP endpoints for gateway metadata and keeps `gateway-http` / `gateway-ws` publication stable.
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
  - remains the shell consumer of the same instance detail truth, so route resolution and workbench rendering stay on one metadata surface.
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
  - remains the managed OpenClaw readiness and capability gate for local-managed detail surfaces.
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - remains the managed provider-workspace presentation authority and stayed aligned with the instance detail truth chain through this loop.
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - remains the only Local Proxy runtime owner behind the managed OpenClaw model path.
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`
  - remains unchanged and continues to define the desktop plugin-registration boundary for the host runtime.

## Verification Focus

- `pnpm.cmd check:sdkwork-chat`
- `node --experimental-strip-types scripts/sdkwork-chat-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts`

## Architecture Writeback

- `docs/架构/05-功能架构与核心业务流程.md`
  - now explicitly freezes authoritative chat route resolution and the split between Gateway-authoritative sessions and compatible/local persistence.
- `docs/架构/06-聊天能力与多实例路由设计.md`
  - now explicitly records the authoritative route source, the no-fallback rule for unresolved managed routes, and the session-authority boundaries.
- `docs/架构/17-能力到API调用矩阵.md`
  - now explicitly records route resolution through `studio.getInstanceDetail()` and the Gateway session recovery chain.

## Remaining Gaps

- `Step 06` route matrix is closed on the current worktree.
- 波次 B 仍未退出；下一真实 frontier 是 `Step 07` 的 Instance Detail 十分区闭环，而不是重复回到 `Step 06` 路由判定。

## Risks And Rollback

- This loop changes review / architecture / release records only.
- The primary future risk is a later implementation reintroducing route fallback heuristics outside `resolveAuthoritativeInstanceChatRoute()` or letting a feature bypass the Gateway path for managed OpenClaw chat.

