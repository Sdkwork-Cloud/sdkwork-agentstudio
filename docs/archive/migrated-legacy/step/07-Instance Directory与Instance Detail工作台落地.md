# Step 07 - Instance Directory 与 Instance Detail 工作台落地

## 1. Step Card

| 项 | 内容 |
| --- | --- |
| 执行模式 | 波次内并行 |
| 前置 | `04` `05` `06` |
| 主写入范围 | `packages/sdkwork-claw-instances/src` `packages/sdkwork-claw-core/src/services/openClawConfigService.ts` `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts` |
| 执行输入 | `07`、`15`、`17` 架构文档；现有实例目录、详情、工作台、配置服务 |
| 本步非目标 | 不做发布链和商业化链；不直接扩展外部供应商协议 |
| 最小输出 | 统一实例目录、统一实例详情骨架、十个分区的完整运行治理工作台 |

## 2. 设计

- Instance Detail 必须是运行治理工作台，不是只读详情页。
- 读链以 `studioApi + openClawGatewayClient + openClawConfigService` 三类真相源分层；写链必须单点收口。
- 对托管 Provider，工作台只展示和回读，不另起第二控制面。
- OpenClaw 对齐基线以 `InstanceDetail.tsx` 十分区、`webStudio.ts/webStudio.test.ts` 的 workbench 持久化、`openClawConfigSchemaSupport.test.ts` 的 Control UI section 顺序、`openClawManagementCapabilities.ts` 的治理权限判定为准。

## 3. 实施落地规划

1. 优先治理热点：
   `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`、
   `instanceWorkbenchServiceCore.ts`、
   `instanceServiceCore.ts`。
2. 按分区拆分工作台：`overview`、`channels`、`cronTasks`、`llmProviders`、`agents`、`skills`、`files`、`memory`、`tools`、`config`。
3. 建立分区级服务切片和懒加载边界，避免继续放大单页面/单服务文件。
4. 让配置写入统一走 Gateway / Hosted Studio / Config Service 既定路径。
5. 以 `15-Instance Detail 功能一致性基线与验收矩阵` 与上述 OpenClaw 真相文件为标准建立长期回归清单。

## 4. 测试计划

- `pnpm.cmd check:sdkwork-instances`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`

## 5. 结果验证

- 实例列表、详情骨架、活动实例切换、生命周期操作一致。
- 十个分区都能独立加载、独立回读、独立提示错误。
- Channels 与受管插件配置面保持 Control UI section 顺序和 OpenClaw 写入语义。
- OpenClaw/Control UI 的关键治理能力在工作台中可见、可操作、可验收。

## 6. 检查点

- `CP07-1`：实例目录与详情骨架统一。
- `CP07-2`：十个分区的读写真相源明确。
- `CP07-3`：热点大文件完成分区化拆分。
- `CP07-4`：一致性矩阵与回归清单建立。

### 6.1 推荐并行车道

- `07-A`：`overview/files/config`
- `07-B`：`channels/cronTasks`
- `07-C`：`llmProviders/agents/skills`
- `07-D`：`memory/tools`
- 收口要求：实例详情骨架、活动实例状态、配置写链由 `07-Owner` 统一

### 6.2 完成后必须回写的架构文档

- `docs/架构/07-实例治理与实例工作台设计.md`
- `docs/架构/15-Instance Detail 功能一致性基线与验收矩阵.md`
- `docs/架构/17-能力到API调用矩阵.md`

### 6.3 推荐 review 产物

- `docs/review/step-07-执行卡-YYYY-MM-DD.md`
- `docs/review/step-07-instance-detail分区一致性-YYYY-MM-DD.md`
- `docs/review/step-07-工作台写链与真相源决议-YYYY-MM-DD.md`

### 6.4 架构能力闭环判定

- 十个分区都具备明确读写真相源、独立加载、独立错误反馈，并达到 OpenClaw / Control UI 关键能力一致性。
- `channels`、`plugins.entries.xai.xSearch`、`plugins.entries.firecrawl.webFetch`、`plugins.entries.memory-core.dreaming` 等受管插件能力，必须与当前源码和 Control UI section 顺序一致。
- 若 `InstanceDetail.tsx` 仍是单体页面或配置写链分叉，本 step 不算闭环。

### 6.5 快速完整执行建议

- 先冻结详情骨架、活动实例状态和配置写链，再按分区组并行拆分服务和页面。
- 推荐 `overview/files/config`、`channels/cronTasks`、`llmProviders/agents/skills`、`memory/tools` 四组并行，统一由 `07-Owner` 收口。
- 每次合并前强制对照 `webStudio.test.ts`、`openClawConfigSchemaSupport.test.ts` 和 `InstanceDetail.tsx` 的分区/配置语义做一次差异校对。

## 7. 风险与回滚

- 风险：页面和服务同时拆分，容易让 section state 与配置写链脱节。
- 回滚：先拆内部模块，保留稳定页面路由与外部服务 facade。

## 8. 完成定义

- Instance Detail 达到“分区完整、真相源清晰、可持续回归”的工作台标准。

## 9. 下一步准入条件

- Channels、ClawHub、技能生态可以复用实例工作台和 Agent 工作区真相源继续落地。
