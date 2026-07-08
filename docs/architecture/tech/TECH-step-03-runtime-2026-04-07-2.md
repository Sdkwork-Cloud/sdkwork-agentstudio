> Migrated from `docs/review/step-03-多模式runtime平台真值-2026-04-07.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 多模式 Runtime 平台真值 - 2026-04-07

## 1. 决议

- Hosted Browser 只是交付形态，不是业务平台语义；`runtime.getRuntimeInfo().platform` 必须反映真实宿主。
- `server -> server`，`desktopCombined -> desktop`，`docker/k8s -> server + deploymentFamily=container|kubernetes`。
- 页面、安装、设置、Kernel Center 不得再把浏览器壳形态误判为 `web` 业务模式。

## 2. 代码证据

- `packages/sdkwork-clawstudio-infrastructure/src/platform/serverBrowserBridge.ts`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/registry.test.ts`

## 3. 验证证据

- `server browser bridge also installs hosted-browser runtime startup metadata for server mode`
- `server browser bridge also installs hosted-browser runtime startup metadata for desktopCombined mode`
- `server browser bridge bootstrap preserves kubernetes hosted runtime metadata`
- `serverBrowserBridge.test.ts + registry.test.ts` 全量通过

## 4. 价值

- 锁定 `desktop/server/docker/k8s` 统一运行时事实源，减少模式猜测分叉。
- 为后续 Host Status、Install、API 发布矩阵、release smoke 提供稳定判据。
- 降低“浏览器承载导致平台被误判为 web-only” 的回归风险。
- 让 `desktopCombined` hosted browser 与桌面能力开关一致，不再把桌面交互误隐藏成纯 web 体验。

## 5. 未闭环项

- 仍需继续把同一语义压实到 Host Status、升级回滚证据与多模式发布 smoke。
- Step 03 仍未完成，Runtime 热点拆分与执行级升级验证仍待推进。

