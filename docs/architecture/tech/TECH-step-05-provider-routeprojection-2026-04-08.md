> Migrated from `docs/review/step-05-provider-route与projection矩阵-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Fresh `Step 05` full verification confirms the `Provider Route -> Local Proxy -> Projection -> OpenClaw Config` chain is green on the current worktree.
- `Provider Center` save/delete/test/apply all remain on the shared provider-routing control plane, kernel bridge, and `openClawConfigService` instead of writing raw upstream providers.
- `Kernel Center` and `ApiSettings` already consume the same Local Proxy runtime and observability facts, so this loop closes `Step 05` with evidence rather than new production code.

## Attempt Outcome

- Route catalog and runtime sync:
  - `providerConfigCenterService.listProviderConfigs()` merges route records with `kernelInfo.localAiProxy.routeMetrics` and `routeTests`.
  - `saveProviderConfig()` and `deleteProviderConfig()` delegate to the shared routing catalog and immediately `ensureRunning()` the Local Proxy runtime.
  - `testProviderConfigRoute()` delegates to `kernelPlatformService.testLocalAiProxyRoute()`, so route tests run through the canonical kernel bridge instead of a feature-local transport.
- Projection matrix:
  - `resolveOpenClawLocalProxyBaseUrl()` selects protocol-aware loopback endpoints for `openai-compatible` / `anthropic` / `gemini` routes from the published kernel snapshot.
  - `createOpenClawLocalProxyProjection()` validates selected default/reasoning/embedding model IDs, normalizes runtime request overrides, and freezes the canonical projected provider id as `sdkwork-local-proxy`.
  - `openClawConfigService.saveManagedLocalProxyProjection()` canonicalizes managed local proxy providers before overwriting defaults, so the projected provider remains the single managed provider truth.
- Runtime and observability surface:
  - `kernelCenterService` reads `info.localAiProxy.*` directly from the kernel snapshot and exposes default routes, endpoints, config/snapshot/log paths, and last error through the same dashboard model.
  - `localAiProxyLogsService` and `ApiSettings` read request logs, message logs, and capture settings through `kernelPlatformService`, so `ApiSettings` does not create a second observability source.
  - `local_ai_proxy.rs` remains the single runtime owner for route metrics, route tests, request logs, message logs, and message capture settings.
- Actual workspace result:
  - no production code changes were required in this loop
  - this loop writes the formal `Step 05` review evidence, updates the architecture ledger, and advances the frontier to `Step 06`

## OpenClaw Fact Sources

- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - remains the browser-hosted workbench/platform fact source for managed instance and channel persistence semantics.
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
  - keeps the browser workbench persistence contract honest for managed channel configuration and workbench readback.
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
  - remains the shell-facing workbench consumer that must stay on authoritative managed provider and config surfaces.
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
  - continues to freeze config-workbench section ordering and editing behavior on the OpenClaw config truth chain.
- `packages/sdkwork-clawstudio-channels/src/services/channelService.ts`
  - remains the channel workspace service that must route managed reads/writes back to `openClawConfigService`.
- `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
  - keeps skill installation on default-agent workspace resolution instead of introducing provider-side transport shortcuts.
- `packages/sdkwork-clawstudio-agent/src/services/agentInstallService.ts`
  - remains the agent-install fact source for config-path ownership, agent path resolution, and explicit `saveAgent()` writeback.
- `packages/sdkwork-clawstudio-instances/src/services/openClawManagementCapabilities.ts`
  - remains the managed OpenClaw capability gate that prevents provider-center behavior from drifting onto unsupported runtimes.
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - remains the presentation-layer fact source for whether Provider Center is managed and read-only on a given detail surface.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - remains the single Local Proxy runtime and observability truth source for `Step 05`.
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - remains the stable plugin-registration boundary and stayed unchanged through this `Step 05` closure loop.

## Verification Focus

- `pnpm.cmd check:sdkwork-settings`
- `pnpm.cmd check:desktop`
- `node --experimental-strip-types packages/sdkwork-clawstudio-settings/src/services/providerConfigCenterService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-core/src/services/openClawConfigService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-channels/src/services/channelService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node scripts/desktop-local-ai-proxy-contract.test.mjs`

## Architecture Writeback

- `docs/架构/05-功能架构与核心业务流程.md`
  - explicitly records that `Provider Center`、`Kernel Center`、`ApiSettings` share the same Local Proxy runtime and observability truth source.
- `docs/架构/09-数据、状态与配置治理设计.md`
  - explicitly classifies `ApiSettings` request/message logs and message capture as derived state on top of the kernel / Local Proxy fact source.
- `docs/架构/10-性能、可靠性与可观测性设计.md`
  - explicitly records request logs, message logs, and message capture toggles as first-class Local Proxy observability items.

## Remaining Gaps

- `Step 05` route/projection matrix is closed on the current worktree.
- 波次 B 仍未退出；下一真实 frontier 是 `Step 06` 的聊天主链与多实例路由闭环。

## Risks And Rollback

- This loop is documentation and governance evidence only, so rollback is limited to the new review / architecture / release records.
- The primary risk is future status drift if later loops ignore this fresh `Step 05` evidence and keep re-auditing stale `Step 03/04/05` entry probes.

