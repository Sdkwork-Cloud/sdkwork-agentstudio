> Migrated from `docs/release/release-2026-04-07-12.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- 推进 `Step 03`：新增 OpenClaw 专用运行时快照，并让 Kernel 输出面、Kernel Center、Install Bootstrap 开始共用同一套真相源。
- 把 `desktop/server/docker/k8s` 正式收敛为“同核不同封装”架构：共享 Host Runtime Contract、API 五分层、Proxy 契约与 release metadata。
- 修复 `removed-install-feature` package root 导出漂移，恢复 Guided Install 组件的显式公共面并重新通过 install contract。
- 回写架构文档，明确多模式统一、运行时事实源优先级、Proxy/API 边界和发布标准。

## Attempt Outcome

- 本轮不是 Step 03 全量闭环，而是其高价值子切片：运行时真相源从桌面证据面继续推进到了安装引导链。
- OpenClaw 配置定位在 assessment/runtime 路径漂移时，已能优先复用 Kernel `openClawRuntime.homeDir`。
- 架构层已正式冻结 desktop/server/container/k8s 的统一原则，后续实现必须继续对齐该标准。

## Change Scope

- `packages/removed-install-feature/src/services/openClawBootstrapService.ts`
- `packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
- `packages/removed-install-feature/src/index.ts`
- `docs/review/step-03-*`
- `docs/架构/02-架构标准与总体设计.md`
- `docs/架构/10-性能、可靠性与可观测性设计.md`
- `docs/架构/12-安装、部署、发布与商业化交付标准.md`
- `docs/架构/16-API体系与契约设计.md`
- `docs/release/releases.json`

## Verification Focus

- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml desktop_kernel_info_exposes_extended_runtime_directories`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.test.ts`
- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/removed-install-feature/src/services/openClawBootstrapService.test.ts']))"`
- `pnpm.cmd check:sdkwork-install`

## Risks And Rollback

- 风险：若后续 `server/container/k8s` 再次绕开 Host Runtime Contract 或 Local Proxy 契约，会重新引入模式分叉。
- 回退：可只回退本轮 Install Bootstrap 真相源收口与文档/发布记录，不影响既有桌面 Kernel 快照与 Step 02 边界门禁。

