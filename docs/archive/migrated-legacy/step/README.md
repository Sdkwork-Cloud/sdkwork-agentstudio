# Claw Studio 分步实施计划索引

## 1. 文档定位

本目录是 [`/docs/架构/`](../架构/README.md) 的执行层，目标是把“内置 OpenClaw、Local Proxy、统一 API、完整工作台、商业化交付”落成可实施、可检查、可并行编排的 step 体系。

当前目录中已存在的日期型文档仍保留为专项审计、发布或 review 记录；本次新增的 `00-13` 与 `90+` 文档是主执行骨架。

## 2. 适用范围

- `packages/sdkwork-claw-web`
- `packages/sdkwork-claw-desktop`
- `packages/sdkwork-claw-shell`
- `packages/sdkwork-claw-core`
- `packages/sdkwork-claw-infrastructure`
- `packages/sdkwork-claw-types`
- `packages/sdkwork-claw-ui`
- `packages/sdkwork-claw-i18n`
- `packages/sdkwork-claw-chat`
- `packages/sdkwork-claw-instances`
- `packages/sdkwork-claw-settings`
- `packages/sdkwork-claw-market`
- `packages/sdkwork-claw-channels`
- `packages/removed-install-feature`
- `packages/sdkwork-claw-server`
- `packages/sdkwork-claw-distribution`
- `scripts/`
- `config/`
- `docs/release/`

## 3. 关联架构基线

执行时必须优先对齐以下架构文档：

- [`01-产品设计与需求范围`](../架构/01-产品设计与需求范围.md)
- [`02-架构标准与总体设计`](../架构/02-架构标准与总体设计.md)
- [`03-模块规划与边界`](../架构/03-模块规划与边界.md)
- [`05-功能架构与核心业务流程`](../架构/05-功能架构与核心业务流程.md)
- [`06-聊天能力与多实例路由设计`](../架构/06-聊天能力与多实例路由设计.md)
- [`07-实例治理与实例工作台设计`](../架构/07-实例治理与实例工作台设计.md)
- [`08-ClawHub、Channels与生态扩展设计`](../架构/08-ClawHub、Channels与生态扩展设计.md)
- [`09-数据、状态与配置治理设计`](../架构/09-数据、状态与配置治理设计.md)
- [`10-性能、可靠性与可观测性设计`](../架构/10-性能、可靠性与可观测性设计.md)
- [`11-安全、测试与质量治理`](../架构/11-安全、测试与质量治理.md)
- [`12-安装、部署、发布与商业化交付标准`](../架构/12-安装、部署、发布与商业化交付标准.md)
- [`13-演进路线图与阶段评估`](../架构/13-演进路线图与阶段评估.md)
- [`14-综合评估矩阵与优先级清单`](../架构/14-综合评估矩阵与优先级清单.md)
- [`15-Instance Detail 功能一致性基线与验收矩阵`](../架构/15-Instance%20Detail%20功能一致性基线与验收矩阵.md)
- [`16-API体系与契约设计`](../架构/16-API体系与契约设计.md)
- [`17-能力到API调用矩阵`](../架构/17-能力到API调用矩阵.md)

### 3.1 OpenClaw 对齐事实源

以下源码和测试是 step 执行时的强制对齐基线，不能只参考文档口述：

- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts`
- `packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `packages/sdkwork-claw-channels/src/services/channelService.ts`
- `packages/sdkwork-claw-market/src/services/marketService.ts`
- `packages/sdkwork-claw-agent/src/services/agentInstallService.ts`
- `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
- `packages/sdkwork-claw-desktop/src-tauri/src/plugins/mod.rs`

凡涉及全局 channels 配置、instances、ClawHub、插件机制、chat、Instance Detail 的 step，都必须先读这些文件，再宣称“已与 OpenClaw 对齐”。

## 4. 总体执行顺序

| Step | 主题 | 执行模式 | 核心目标 | 前置 |
| --- | --- | --- | --- | --- |
| `00` | 总实施原则与执行门禁 | 强串行 | 冻结规则、门禁、证据口径 | 无 |
| `01` | 现状基线冻结与差距审计 | 强串行 | 冻结当前事实与热点 | `00` |
| `02` | Host、Shell 与 Foundation 边界收口 | 强串行 | 建立稳定分层和包边界 | `01` |
| `03` | Desktop Runtime 与内置 OpenClaw 工程化 | 强串行 | 固化 Runtime/Gateway/Proxy/Upgrade 主链 | `02` |
| `04` | API体系、平台桥与契约统一 | 强串行 | 统一 `/claw/*`、Hosted Studio、Gateway、Proxy 契约 | `02` `03` |
| `05` | Provider Center 与配置投影主链改造 | 波次内并行 | 打通 Provider Route -> Proxy -> Projection -> Agent | `03` `04` |
| `06` | Chat Workspace 与多实例路由重构 | 波次内并行 | 建立统一聊天入口与路由主链 | `04` `05` |
| `07` | Instance Directory 与 Instance Detail 工作台落地 | 波次内并行 | 建立十个分区的完整治理工作台 | `04` `05` `06` |
| `08` | Channels、ClawHub 与技能生态闭环 | 波次内并行 | 让实例、Agent、技能、渠道形成生态闭环 | `05` `07` |
| `09` | 性能、可靠性与可观测性提升 | 波次内并行 | 固化指标、日志、懒加载、容量与恢复基线 | `05` `06` `07` `08` |
| `10` | 安全、测试与质量门禁落地 | 波次内并行 | 建立发布级安全和回归门禁 | `04-09` |
| `11` | 打包、安装、部署、发布与升级工程化 | 波次内并行 | 完成多形态交付与升级/回滚链 | `03` `09` `10` |
| `12` | 商业化能力、权限与运营闭环 | 波次内并行 | 完成商业化能力面和运营支撑面 | `08` `10` `11` |
| `13` | 发布就绪与持续迭代闭环 | 强串行 | 总验收、changelog、证据归档、下一轮计划 | `00-12` |

## 5. 实施波次

- 波次 A：`00-04`
  目标：先把规则、边界、Runtime 和 API 主链定稳。
- 波次 B：`05-08`
  目标：再把配置、聊天、工作台、生态资产真正打通。
- 波次 C：`09-12`
  目标：补齐性能、安全、测试、交付、商业化。
- 波次 D：`13`
  目标：统一收口、发布、复盘、回写架构与 release 文档。

## 6. 辅助治理文档

- [`90-架构能力-Step-目录-证据映射矩阵`](./90-架构能力-Step-目录-证据映射矩阵.md)
- [`91-Step质量审计清单与复盘模板`](./91-Step质量审计清单与复盘模板.md)
- [`92-Step输入输出与阻塞升级规则`](./92-Step输入输出与阻塞升级规则.md)
- [`93-波次里程碑与阶段总验收矩阵`](./93-波次里程碑与阶段总验收矩阵.md)
- [`94-Step并行执行编排与车道拆分建议`](./94-Step并行执行编排与车道拆分建议.md)
- [`95-架构能力闭环验收标准`](./95-架构能力闭环验收标准.md)
- [`96-Step并行执行周计划与排班建议`](./96-Step并行执行周计划与排班建议.md)
- [`97-Step完成后的架构回写与能力兑现清单`](./97-Step完成后的架构回写与能力兑现清单.md)
- [`98-Step并行车道交付包与集成交接标准`](./98-Step并行车道交付包与集成交接标准.md)

## 7. 每个 Step 的硬性内容

每个 step 文档都必须包含：

- Step Card：执行模式、前置、主写入范围、执行输入、本步非目标、最小输出
- 设计
- 实施落地规划
- 测试计划
- 结果验证
- 检查点
- 串并行边界
- 推荐 review 产物
- 架构能力闭环判定
- 快速完整执行建议
- 完成后必须回写的架构文档
- 风险与回滚
- 完成定义
- 下一步准入条件

## 8. 推荐使用顺序

1. 先读 [`00-总实施原则与执行门禁`](./00-总实施原则与执行门禁.md)
2. 再做 [`01-现状基线冻结与差距审计`](./01-现状基线冻结与差距审计.md)
3. 进入具体 step 前，先用 `90/92/94` 冻结能力归属、执行卡和并行车道
4. 若一个波次需要提速，再配合 `96/98` 固化排班和交接包
5. step 完成前，至少用 `91/95/97` 自审一次
6. 波次收尾时，用 `93` 做总验收
7. 最终统一在 `13` 和 `docs/release/` 收口

## 9. 每步完成五件套

每个 step 结束时必须同时交付：

1. 代码或脚本实现已落地
2. 对应测试与 smoke 已通过
3. OpenClaw 对齐事实源已校对
4. `docs/review/` 复盘与架构兑现记录已补齐
5. `docs/架构/` 与 `docs/release/` 的适用回写已完成

缺任一项，都不应宣称 step 已完成。
