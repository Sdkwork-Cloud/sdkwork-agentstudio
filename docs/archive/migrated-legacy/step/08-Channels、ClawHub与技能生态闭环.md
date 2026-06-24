# Step 08 - Channels、ClawHub 与技能生态闭环

## 1. Step Card

| 项 | 内容 |
| --- | --- |
| 执行模式 | 波次内并行 |
| 前置 | `05` `07` |
| 主写入范围 | `packages/sdkwork-claw-market` `packages/sdkwork-claw-channels` `packages/sdkwork-claw-instances/src/services/agentSkillManagementServiceCore.ts` `packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts` |
| 执行输入 | `08`、`17` 架构文档；现有 Market、My Skills、Channels、Skill Install 逻辑 |
| 本步非目标 | 不在本步内做发布形态工程化；不在本步内做性能压测 |
| 最小输出 | 实例级生态资产生命周期：浏览、安装、升级、禁用、卸载、回读、审计 |

## 2. 设计

- 技能、技能包、渠道都视为实例相关资产，不做“全局散装安装”。
- 安装落点优先是实例默认 Agent 工作区；渠道治理落点优先是实例配置与运行态。
- 生态资产必须有版本、来源、兼容、状态、错误回读。
- OpenClaw 对齐基线以 `channelService.ts` 的全局 channels 桥接、`marketService.ts` 的 ClawHub 安装语义、`agentInstallService.ts` 的默认 Agent 工作区安装规则为准。

## 3. 实施落地规划

1. 收口 `ClawHub -> Market -> SkillManagement -> Gateway.skills.install` 主链。
2. 收口技能包安装、我的技能卸载、锁文件追踪和实例内状态回读。
3. 收口渠道配置、启停、删除、状态判断和实例工作台联动。
4. 为后续商业化准备生态元数据：来源、兼容版本、签名/信任位、审计字段。
5. 让工作台、Market、Channels 三面共用同一实例资产语义。

## 4. 测试计划

- `pnpm.cmd check:sdkwork-market`
- `pnpm.cmd check:sdkwork-channels`
- `pnpm.cmd check:sdkwork-agent`
- `node --experimental-strip-types scripts/sdkwork-market-contract.test.ts`
- `node --experimental-strip-types scripts/sdkwork-channels-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-market/src/services/marketService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-channels/src/services/channelService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-agent/src/services/agentInstallService.test.ts`

## 5. 结果验证

- 技能安装后，Market、My Skills、Instance Detail 三面都能读回一致状态。
- 渠道修改后，工作台、运行态、配置快照一致。
- ClawHub 安装落点与默认 Agent 工作区一致，skills/channels 不会漂移到实例外的散装状态。
- 默认 Agent 缺失、兼容不满足、安装失败等场景有明确提示。

## 6. 检查点

- `CP08-1`：技能/技能包安装与卸载闭环完成。
- `CP08-2`：Channels 配置、启停、删除闭环完成。
- `CP08-3`：实例资产元数据与回读规则冻结。
- `CP08-4`：工作台、Market、Channels 三面语义一致。

### 6.1 推荐并行车道

- `08-A`：Skill/Pack 安装与卸载主链
- `08-B`：Channels 配置与工作台联动
- `08-C`：生态元数据、兼容与错误语义
- 收口要求：实例资产模型与默认 Agent 规则只能单点裁决

### 6.2 完成后必须回写的架构文档

- `docs/架构/08-ClawHub、Channels与生态扩展设计.md`
- `docs/架构/17-能力到API调用矩阵.md`

### 6.3 推荐 review 产物

- `docs/review/step-08-执行卡-YYYY-MM-DD.md`
- `docs/review/step-08-实例资产生命周期-YYYY-MM-DD.md`
- `docs/review/step-08-channel与skill兼容元数据-YYYY-MM-DD.md`

### 6.4 架构能力闭环判定

- 技能、技能包、渠道都以实例为中心完成浏览、安装、升级、禁用、卸载、回读、审计闭环。
- ClawHub 技能和技能包必须落到默认 OpenClaw Agent 工作区，channels 配置必须与实例 workbench 和 managed config 双向一致。
- 若 Market、My Skills、Instance Detail 三面状态不一致，或默认 Agent 规则漂移，本 step 不算闭环。

### 6.5 快速完整执行建议

- 先冻结实例资产模型、默认 Agent 规则和兼容元数据，再并行推进技能主链、渠道主链、元数据/错误语义三车道。
- 本步优先保证生命周期闭环，不先扩散新市场玩法。

## 7. 风险与回滚

- 风险：生态资产若不以实例为中心，后续权限与商业化无法收口。
- 回滚：保留旧市场浏览入口，但安装/卸载主链必须先统一。

## 8. 完成定义

- 生态资产形成“实例为中心”的生命周期闭环。

## 9. 下一步准入条件

- 性能、观测、安全和发布链可以围绕稳定的产品能力面继续建设。
