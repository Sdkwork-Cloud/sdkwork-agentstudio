# 15-Instance Detail 功能一致性基线与验收矩阵

## 1. 文档目标

本文件用于把 `Instance Detail` 从“做得很丰富”提升到“可持续验收”。基线原则是：以 OpenClaw 源码和 Control UI 的可治理能力为参考面，以当前 Studio 实现为事实面，以后续验收清单为落地面。

## 2. 当前事实矩阵

| 领域 | 当前已实现事实 | 验收要求 |
| --- | --- | --- |
| 页面动作 | 设为活动实例、打开 OpenClaw Console、启动、停止、重启、卸载 | 关键动作状态明确、失败可解释 |
| Overview | 身份、生命周期、版本、存储、健康、连接、能力、数据访问、工件、日志预览 | 运行事实完整、路径与状态可信 |
| Channels | 列表、状态、配置编辑、保存、删除 | 渠道变更可回写、可验证 |
| Cron Tasks | 列表、历史、克隆、立即执行、启停、删除 | 任务可观测、可追踪 |
| LLM Providers | Provider CRUD、模型 CRUD、默认/推理/Embedding 配置、Request Overrides | Provider 管理完整、模型选择可验证 |
| 搜索与抓取 | Managed Web Search、Web Fetch、Native Codex、X Search | 搜索/抓取策略可治理 |
| 运行策略 | Auth Cooldowns、Dreaming 配置 | 运行策略可见、可改、可保存 |
| Agents | Agent CRUD、主模型、回退模型、技能安装/启停/删除 | Agent 运行能力可治理 |
| Skills | 技能安装与状态联动 | 与 Agent/实例有闭环 |
| Files | 网关配置与工作区文件可见 | 文件与配置关系清晰 |
| Memory | 记忆、Dream Diary、来源、保留策略 | 记忆来源与状态可信 |
| Tools | 工具清单、类别、访问方式、最后使用时间 | 工具治理可用 |
| Config | 配置工作台可编辑 | 配置可写状态明确 |

## 3. 一致性标准

### 3.1 能力一致

- Studio 不得低于 OpenClaw/Control UI 的核心治理范围。
- 若短期未对齐，必须在文档中明确标记为差距，不允许伪装为已完成。

### 3.2 交互领先

- 信息层级更清晰
- 批量操作更高效
- 变更影响更明确
- 失败定位更直接
- 配置差异与回滚提示更直观

### 3.3 运行一致

- 页面显示内容必须可追溯到实例快照、配置文件或运行态。
- 升级后必须复验 Instance Detail 关键能力不回退。

## 4. 发布前最小验收集

- 能打开目标实例详情并正确加载十个分区。
- 能查看托管实例版本、健康、连接和关键路径。
- 能编辑至少一个 Provider 并保存。
- 能编辑至少一个 Channel 配置并保存。
- 能查看 Task 历史。
- 能查看 Agent、Skill、Files、Memory、Tools、Config。
- 能对内置 OpenClaw 实例打开 OpenClaw Console。
- 升级后上述能力不失效。

## 5. 评估标准

| 评估项 | 合格线 | 领先线 | 当前判断 |
| --- | --- | --- | --- |
| 功能覆盖 | 十个分区与关键动作完整 | 形成完整治理矩阵与持续回归 | `L4` |
| 事实准确性 | 页面信息能映射到真实运行态 | 全部关键字段可追溯 | `L4` |
| 一致性治理 | 与 OpenClaw/Control UI 主要能力对齐 | 建立长期差距台账和回归标准 | `L3.5` |
| 交互质量 | 比基础控制台更易用 | 在不减能力前提下显著领先 | `L4` |

## 6. 结论

`Instance Detail` 已经具备强工作台基础。下一步关键不是继续堆区块，而是把“一致性矩阵 + 发布前验收 + 升级后回归”固化为长期工程制度。
## 7. 2026-04-10 Step 10 quality-gate promotion writeback

## 7. 2026-04-10 Step 10 quality-gate promotion writeback

- Step 10 promotes the Instance Detail consistency baseline into formal quality gates.

### 7.1 Formal gate ownership

- `pnpm.cmd check:sdkwork-instances` is now the main parity owner for Instance Detail and managed OpenClaw workbench consistency.
- `scripts/sdkwork-instances-contract.test.ts` remains the package-level contract owner for Instance Detail boundary and behavior assertions.
- `pnpm.cmd check:desktop` and `pnpm.cmd lint` remain release-blocking supersets that catch desktop-hosted regressions and wider parity drift affecting Instance Detail.

### 7.2 Minimum required fact-source coverage

- The formal instance gate now includes the current OpenClaw truth-chain tests that matter for this matrix:
  - `openClawConfigSchemaSupport.test.ts`
  - `openClawManagementCapabilities.test.ts`
  - `openClawProviderWorkspacePresentation.test.ts`
- The same runner also includes the broader Instance Detail service regressions around:
  - lifecycle mutations
  - managed channel/config mutations
  - provider catalog/delete flows
  - workbench loader and section availability support
  - agent and skill workbench state

### 7.3 Acceptance consequence

- Instance Detail consistency is no longer closed by review notes alone.
- A Step 10-compliant release now requires the formal instance lane to stay green inside the parity gate graph.
- This satisfies the Step 10 checkpoint that Instance Detail consistency and upgrade-sensitive regressions must be part of the official quality gate, not a sidecar verification path.
