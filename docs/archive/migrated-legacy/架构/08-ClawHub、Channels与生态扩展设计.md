# 08-ClawHub、Channels与生态扩展设计

## 1. 目标

OpenClaw Studio 不只管理实例，还要管理实例“能接什么、能扩什么、能装什么”。因此 `ClawHub + Channels + Extensions` 共同构成生态扩展层。

## 2. 当前事实

### 2.1 ClawHub / Market

当前 `Market` 已具备：

- 分类、列表、详情
- 搜索与筛选
- 技能安装
- 技能包安装
- 我的技能视图

### 2.2 ClawHub 安装落点

- 安装目标不是应用全局目录，而是实例内默认 Agent 工作区。
- 安装流程依赖实例工作台定位默认 Agent。
- 若默认 Agent 缺失，安装会失败并返回明确错误。

这说明生态资产当前已经是“实例运行时资产”，而不是单纯前端素材。

### 2.3 Channels

当前 Channels 已支持：

- 按实例加载渠道列表
- 渠道配置表单
- 渠道启停
- 配置保存与删除
- 渠道状态识别

### 2.4 双路径治理

Channels 当前采用双路径治理：

- 配置快照路径：优先通过 `openClawConfigService` 读取配置与渠道定义。
- 工作台桥接路径：通过 `setInstanceChannelEnabled`、`saveInstanceChannelConfig`、`deleteInstanceChannelConfig` 写回运行治理面。

## 3. 架构标准

### 3.1 生态资产定位

- 技能、技能包、扩展、模板、渠道都必须作为“实例相关资产”治理。
- 生态资产安装、升级、禁用、卸载必须能映射到实例或 Agent。

### 3.2 与实例工作台的关系

- ClawHub 的安装结果必须能在 Instance Detail 中被感知。
- Channels 不应是孤立设置页，而应是实例运行面的一部分。
- 扩展能力必须与 Agent、Skill、Provider、Task 形成闭环。

### 3.3 商业化标准

- 生态资产需要版本、兼容、来源、签名、审计标准。
- 安装、升级、回滚、冲突处理必须可追踪。

## 4. 当前优势

- ClawHub 已与实例和 Agent 形成真实安装闭环。
- Channels 已与配置治理和工作台治理形成双入口协同。
- 生态入口不止一个，已有向平台化演进的基础。

## 5. 关键差距

- 扩展协议、版本兼容、依赖冲突仍需标准化。
- 渠道测试、风控、审计能力仍需加强。
- 生态资产的签名、来源验证和发布规范仍需收口。

## 6. 行业领先目标

- 生态资产有统一元数据与兼容标准。
- 安装、升级、回滚、禁用、卸载形成完整生命周期。
- 所有生态资产都能按实例、Agent、环境范围治理。
- 生态资产可审计、可签名、可验证、可追踪。

## 7. 评估标准

| 评估项 | 合格线 | 领先线 | 当前判断 |
| --- | --- | --- | --- |
| ClawHub 集成度 | 技能/包可安装到实例 | 支持版本、依赖、回滚、审计与兼容矩阵 | `L3.5` |
| Channels 治理 | 可配置、可启停、可保存 | 可测试、可回滚、可审计、可批量治理 | `L3.5` |
| 生态扩展性 | 有多个生态入口 | 有统一生态协议、签名与发布标准 | `L3` |
| 与实例闭环 | 安装/配置能落到实例 | 所有生态资产都以实例为中心治理 | `L4` |

## 8. 结论

生态扩展层已经具备真实产品价值。下一步不是继续堆入口，而是把生态协议、版本兼容、实例闭环和安全治理标准统一收口。

## 9. 2026-04-10 已装技能实例资产回读补充

- `mySkillService` 现在把“我的技能”中的已安装技能视为实例内生态资产回读面，而不是普通目录项；读回时保留 `source`、`scope`、`status`、`compatibility`、`bundled`、`filePath`、`baseDir`、`missingRequirementCount`。
- 这条回读链的事实源不是 ClawHub 目录元数据，而是 `agentWorkbenchService.getAgentWorkbench()` 投影出来的技能状态；其上游仍然是 `gateway.skills.status`。
- 安装权威保持不变：`marketService -> agentSkillManagementService.installSkill -> gateway.skills.install`；卸载/禁用权威也保持在 `agentSkillManagementService.removeSkill` / `setSkillEnabled`，避免 Market 自行拼装删除逻辑。
- 这一轮只冻结“已安装技能”回读语义，没有给目录页或技能包详情页补齐真实兼容矩阵，因此 `CP08-3` 有进展，但 Step 08 仍未闭环。

## 10. 2026-04-10 已装技能运行态 UI 回读补充

- `Market` 的“我的技能”卡片和 `SkillDetail` 信息面板现在直接消费 `Skill.instanceAsset`，把运行态 `status`、`compatibility`、`source`、`scope`、`missingRequirementCount` 回读给用户，而不是继续一律显示静态兼容文案。
- 这意味着已安装技能在 UI 上也遵守同一条事实链：`mySkillService -> agentWorkbenchService.getAgentWorkbench() -> gateway.skills.status`。
- 当前仍然明确不做两件事：
  - 不把技能包详情页伪装成拥有真实兼容矩阵
  - 不在没有运行态证据时生成目录侧“兼容/阻塞”判断
- 因此 Step 08 的 UI 回读语义更一致了，但真正的三面闭环仍未完成。

## 11. 2026-04-10 Instance Detail installed-skill runtime closure

- `Instance Detail -> Skills` now consumes the same installed-skill runtime truth that already drove `My Skills` and `Skill Detail`.
- The instance workbench path is now:
  - `gateway.skills.status`
  - `buildOpenClawSkills()`
  - `InstanceWorkbenchSnapshot.skills[].instanceAsset`
  - `InstanceDetailSkillsSection`
- This closes the previous workbench-side metadata loss without changing any installation or removal authority:
  - install authority still stays in `marketService -> agentSkillManagementService.installSkill -> gateway.skills.install`
  - uninstall/disable authority still stays in `agentSkillManagementService.removeSkill` / `setSkillEnabled`
  - channel authority still stays on the instance-aware channels bridge and its managed-config/workbench dual readback path
- `StudioWorkbenchSkillRecord` now preserves optional `instanceAsset` metadata so runtime readback can cross the shared workbench boundary without forcing unrelated surfaces to fabricate missing runtime facts.
- Pack-level compatibility remains intentionally static because the repository still has no truthful aggregated pack runtime source.
- With Market, My Skills, Skill Detail, Instance Detail, channels, and agent install gates all green in the current repository state, Step 08 now closes as an instance-centered ecosystem asset lifecycle step.
