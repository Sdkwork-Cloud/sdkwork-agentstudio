> Migrated from `docs/release/release-2026-04-07-13.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- 推进 `Step 03`：修复 hosted browser runtime 的平台真值，让 `server` 与 `desktopCombined` 在统一架构下输出真实宿主平台，而不是错误回落到 `web`。
- 补齐 `platform.getPlatform()` 的桌面能力语义，让 `desktopCombined` hosted browser 能正确开启桌面能力，同时不伪装成 native desktop authority。
- 补齐 bootstrap descriptor 场景下的 `deploymentFamily` 语义，确保 `docker/k8s` 继续作为 `server` 的交付包装而不是第二套运行时实现。
- 回写 review 与架构补充文档，正式冻结“浏览器承载形态不等于 web 业务模式”的运行时标准。

## Attempt Outcome

- 本轮关闭了统一运行时契约中的一个关键偏差：hosted browser 现在既保留 `startup.hostedBrowser`，又输出真实 `platform/distributionFamily/deploymentFamily`。
- `desktopCombined` hosted browser 现在还能向业务层暴露 `platform.getPlatform() === 'desktop'`，解决桌面能力开关与 runtime 平台语义不一致的问题。
- 该修复直接降低了 UI、Install、Kernel Center 等消费方基于错误平台字段做模式猜测的风险。
- `Step 03` 仍未闭环；Runtime 热点拆分、升级回滚证据和多模式发布 smoke 仍需继续推进。

## Change Scope

- `packages/sdkwork-clawstudio-infrastructure/src/platform/serverBrowserBridge.ts`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/serverBrowserBridge.test.ts`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/registry.test.ts`
- `docs/review/step-03-执行卡-2026-04-07.md`
- `docs/review/step-03-多模式runtime平台真值-2026-04-07.md`
- `docs/架构/02-架构标准与总体设计.md`
- `docs/架构/16-API体系与契约设计.md`
- `docs/release/releases.json`

## Verification Focus

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-clawstudio-infrastructure/src/platform/registry.test.ts']))"`
- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-clawstudio-infrastructure/src/platform/serverBrowserBridge.test.ts','packages/sdkwork-clawstudio-infrastructure/src/platform/registry.test.ts']))"`

## Risks And Rollback

- 风险：若后续消费方继续把浏览器壳或 meta 信息当成平台事实源，仍可能重新引入模式漂移。
- 回退：可只回退本轮 hosted browser runtime 平台真值实现与对应测试、文档，不影响已落地的 Kernel `openClawRuntime` 真相源收口。

