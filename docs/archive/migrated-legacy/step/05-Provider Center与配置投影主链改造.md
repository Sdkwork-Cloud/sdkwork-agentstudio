# Step 05 - Provider Center 与配置投影主链改造

## 1. Step Card

| 项 | 内容 |
| --- | --- |
| 执行模式 | 波次内并行 |
| 前置 | `03` `04` |
| 主写入范围 | `packages/sdkwork-claw-core/src/services/localAiProxyRouteService.ts` `packages/sdkwork-claw-core/src/services/openClawLocalProxyProjectionService.ts` `packages/sdkwork-claw-core/src/services/openClawConfigService.ts` `packages/sdkwork-claw-settings/src` `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` |
| 执行输入 | `05`、`09`、`16`、`17` 架构文档；现有 Provider Center / Kernel Center / ApiSettings 逻辑 |
| 本步非目标 | 不做聊天 UI 体验增强；不做 ClawHub 生态能力 |
| 最小输出 | `Provider Route -> Proxy -> Projection -> OpenClaw Config -> Agent` 的唯一主链 |

## 2. 设计

- 对托管 OpenClaw，Provider Center 是唯一控制面；Instance Detail 不得形成第二控制面。
- Local Proxy 负责协议归一、默认路由、日志、消息捕获；OpenClaw Config 负责最终投影和 Agent 模型引用。
- Provider 保存、测试、应用、回读必须构成闭环。

## 3. 实施落地规划

1. 收口路由记录、默认路由、协议映射、模型映射和 apply target 规则。
2. 收口本地代理投影：默认模型、推理模型、Embedding 模型、API Key、Base URL、运行参数。
3. 让 `ProviderConfigCenter`、`KernelCenter`、`ApiSettings` 共用同一 Runtime/Route/Log 真相源。
4. 补齐消息捕获、请求日志、路由测试、错误提示和回读验证。
5. 把 Agent 应用与 Instance 应用做成显式选择，不再隐式污染配置。

## 4. 测试计划

- `pnpm.cmd check:sdkwork-settings`
- `pnpm.cmd check:desktop`
- `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-channels/src/services/channelService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `node scripts/desktop-local-ai-proxy-contract.test.mjs`

## 5. 结果验证

- 新建/更新/删除 Provider 后，Kernel Center 和 ApiSettings 能立刻读回结果。
- Apply 到实例/Agent 后，Instance Detail 与 Chat 主链路能看到同一模型结果。
- 路由测试、默认路由、日志捕获可以定位问题而不需看底层文件。

## 6. 检查点

- `CP05-1`：Route Catalog 与 Projection 规则冻结。
- `CP05-2`：Provider Center/Kernel Center/API Settings 真相源统一。
- `CP05-3`：Apply 到 Instance/Agent 的回读闭环完成。
- `CP05-4`：日志、消息捕获、路由测试齐备。

### 6.1 推荐并行车道

- `05-A`：Route/Projection/Core Service
- `05-B`：Settings UI 与可观测面
- `05-C`：桌面 Local Proxy Runtime/Observability
- 收口要求：Projection schema 和 default route 只能由一条车道主定义

### 6.2 完成后必须回写的架构文档

- `docs/架构/05-功能架构与核心业务流程.md`
- `docs/架构/09-数据、状态与配置治理设计.md`
- `docs/架构/10-性能、可靠性与可观测性设计.md`

### 6.3 推荐 review 产物

- `docs/review/step-05-执行卡-YYYY-MM-DD.md`
- `docs/review/step-05-provider-route与projection矩阵-YYYY-MM-DD.md`
- `docs/review/step-05-apply目标与回读闭环-YYYY-MM-DD.md`

### 6.4 架构能力闭环判定

- Provider Center、Kernel Center、API Settings 共用同一真相源，且托管模型访问统一经 Local Proxy。
- `channelService.ts`、`webStudio.ts/webStudio.test.ts` 中的 enable/save/delete/readback 语义，与托管 Provider 投影行为保持一致。
- 若 Apply 后无法从实例、Agent、聊天侧读回同一结果，或仍存在第二控制面，本 step 不算闭环。

### 6.5 快速完整执行建议

- 先冻结 route catalog、projection schema、apply target 规则，再并行推进 Core Service、Settings UI、桌面代理观测三车道。
- 每天以“保存、测试、应用、回读”四步 smoke 收口，不先做 UI 细修。

## 7. 风险与回滚

- 风险：Provider 控制面分叉会污染 OpenClaw 托管模型链。
- 回滚：保留旧读接口，统一写接口先收口到单链。

## 8. 完成定义

- Provider 相关能力都能回到单一配置链和单一可观测面。

## 9. 下一步准入条件

- Chat 和 Instance Detail 可以在稳定投影主链上继续改造。
