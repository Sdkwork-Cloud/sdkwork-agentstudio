# Step 06 - Chat Workspace 与多实例路由重构

## 1. Step Card

| 项 | 内容 |
| --- | --- |
| 执行模式 | 波次内并行 |
| 前置 | `04` `05` |
| 主写入范围 | `packages/sdkwork-claw-chat/src` `packages/sdkwork-claw-core/src/stores` `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts` |
| 执行输入 | `06`、`16`、`17` 架构文档；现有 Chat、Gateway Session、Conversation、Route Service 实现 |
| 本步非目标 | 不做 Instance Detail 十个分区的深度治理 |
| 最小输出 | 统一聊天入口、统一路由决策、统一 OpenClaw Gateway / HTTP 兼容链 |

## 2. 设计

- 用户只面对一个 Chat 入口；底层模式由实例状态和 transport 决定。
- 托管 OpenClaw 聊天优先走 Gateway WebSocket；兼容 HTTP 仅服务非网关实例或直连模式。
- Chat UI 不感知供应商协议差异，只感知实例、Agent、Skill、模型、会话上下文。

## 3. 实施落地规划

1. 收口 `instanceChatRouteService` 的模式解析与错误原因。
2. 收口 `chatService` 的 direct / managed / compatible 三类发送链。
3. 收口 `openClawGatewaySessionStore`、会话持久化、上下文控制位和断线恢复。
4. 把实例、Agent、Skill、模型选择统一回推到权威实例详情与 projection 真相源。
5. 对失败场景提供明确提示：离线、端点缺失、Proxy 不可用、模型未映射。

## 4. 测试计划

- `pnpm.cmd check:sdkwork-chat`
- `node --experimental-strip-types scripts/sdkwork-chat-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/chatService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-chat/src/services/instanceChatRouteService.test.ts`

## 5. 结果验证

- 同一 Chat 页面可稳定切换 direct / OpenClaw Gateway / compatible HTTP。
- 会话历史、发送、中断、恢复与活动实例切换行为一致。
- 托管 OpenClaw 聊天不再绕过 Gateway/Proxy 主链。

## 6. 检查点

- `CP06-1`：聊天路由模式与错误语义冻结。
- `CP06-2`：Gateway WebSocket 会话主链稳定。
- `CP06-3`：会话持久化与上下文控制位一致。
- `CP06-4`：异常恢复提示完整。

### 6.1 推荐并行车道

- `06-A`：Route Service 与 Send Chain
- `06-B`：Gateway Session Store / Conversation
- `06-C`：Chat UI 上下文与错误反馈
- 收口要求：路由模式枚举和会话 key 规则只能单点裁决

### 6.2 完成后必须回写的架构文档

- `docs/架构/05-功能架构与核心业务流程.md`
- `docs/架构/06-聊天能力与多实例路由设计.md`
- `docs/架构/17-能力到API调用矩阵.md`

### 6.3 推荐 review 产物

- `docs/review/step-06-执行卡-YYYY-MM-DD.md`
- `docs/review/step-06-chat路由模式矩阵-YYYY-MM-DD.md`
- `docs/review/step-06-gateway-session恢复与错误语义-YYYY-MM-DD.md`

### 6.4 架构能力闭环判定

- direct、managed、compatible 三模式共用一个 Chat 入口，且托管 OpenClaw 聊天不绕过 Gateway/Proxy。
- 聊天路由输入必须与 `getInstanceDetail` 的 OpenClaw 实例元数据、Gateway 端点和活动实例状态保持同一事实源。
- 若模式切换、断线恢复、活动实例切换仍出现状态漂移，本 step 不算闭环。

### 6.5 快速完整执行建议

- 先冻结 route enum、session key、错误语义，再并行推进发送链、会话存储、UI 错误反馈。
- 每天统一跑多模式切换 smoke，先稳路由和恢复，再做交互细节。

## 7. 风险与回滚

- 风险：聊天链路同时动路由、会话、投影，容易引入状态漂移。
- 回滚：保留稳定 session store facade，先切换内部实现，不一次性重做 UI。

## 8. 完成定义

- 聊天主链在 direct / managed / compatible 三模式下都可解释、可测试、可恢复。

## 9. 下一步准入条件

- Instance Detail 可以直接复用权威聊天/模型/Agent 真相源继续建设。
