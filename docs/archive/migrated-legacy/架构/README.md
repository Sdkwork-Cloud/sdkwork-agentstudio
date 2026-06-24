# OpenClaw Studio 架构文档

## 1. 文档定位

本目录用于定义 `claw-studio` 的产品、架构、实现与交付标准。目标不是描述“能跑起来”的应用，而是定义可持续商业化交付的桌面 AI 工作台标准。

## 2. 当前事实快照

- 当前产品是基于 Tauri + React + TypeScript + Rust 的桌面应用，并保留 Web Host 预览能力。
- 桌面版内置 OpenClaw 运行时，`Kernel Center` 可展示 `openclawVersion`、内置组件数量与默认启动组件。
- 当前仓库内置 OpenClaw 基线版本和外部 Node.js 运行时要求都来自 `config/kernel-releases/openclaw.json`，桌面资源基线来自 `src-tauri/resources/openclaw/manifest.json`。
- OpenClaw Gateway 在桌面启动链路中被配置为托管组件，Local AI Proxy 作为独立本地服务被确保就绪。
- 内置 OpenClaw 的所有大模型相关 API 访问必须统一经本地 `Proxy API Gateway`，不允许绕过本地代理直接从 OpenClaw 访问外部模型供应商。
- Rust Host 当前已发布 `/claw/health/*`、`/claw/api/v1/*`、`/claw/openapi/*`、`/claw/internal/v1/*`、`/claw/manage/v1/*` 五类原生 HTTP API 面。
- Hosted Studio 契约当前已消费 `/claw/api/v1/studio/*` 下的实例、详情、配置、日志、会话、任务、文件、LLM Provider 与网关调用子资源。
- Local AI Proxy 已具备 `openai-compatible`、`anthropic`、`gemini` 三类客户端协议入口，并支持 `openai-compatible`、`anthropic`、`gemini`、`ollama`、`azure-openai`、`openrouter`、`sdkwork` 上游协议。
- Local Proxy 兼容 API 与 `/claw/*` 原生 API 明确分离，前者负责模型协议兼容，后者负责宿主、实例与控制平面治理。
- `Provider Center`、`Kernel Center`、`Instance Detail` 已形成配置、运行、治理三类核心管理面。
- `Instance Detail` 当前已覆盖 `overview`、`channels`、`cronTasks`、`llmProviders`、`agents`、`skills`、`files`、`memory`、`tools`、`config` 十个工作台分区。
- OpenClaw 升级链路已具备版本源、打包脚本、升级就绪校验、资源校验与契约测试。
- 当前已具备多内核 catalog 与 package profile 基础，但 kernel 的版本、目录、authority 与升级治理仍然存在 OpenClaw 偏置，需要通过统一的多内核治理标准收敛。

## 3. 架构硬约束

- Host 层只负责启动、桥接、平台注入，不承载业务沉积。
- 所有跨包能力只能从包根导出消费，禁止跨包内部实现穿透。
- 内置 OpenClaw 的模型访问统一走本地 Proxy API Gateway。
- OpenClaw Provider 配置必须以“本地代理投影”作为托管标准，不允许散落写死多套外部直连配置。
- Instance Detail 的功能基线必须完整参考 OpenClaw 源码与 Control UI 的可治理能力，在此基础上做更优交互与视觉设计。
- OpenClaw 升级必须具备版本清单、前置就绪检查、资源校验、失败回滚或修复能力。

## 4. 文档目录

1. `01-产品设计与需求范围.md`
2. `02-架构标准与总体设计.md`
3. `03-模块规划与边界.md`
4. `04-技术选型与可插拔策略.md`
5. `05-功能架构与核心业务流程.md`
6. `06-聊天能力与多实例路由设计.md`
7. `07-实例治理与实例工作台设计.md`
8. `08-ClawHub、Channels与生态扩展设计.md`
9. `09-数据、状态与配置治理设计.md`
10. `10-性能、可靠性与可观测性设计.md`
11. `11-安全、测试与质量治理.md`
12. `12-安装、部署、发布与商业化交付标准.md`
13. `13-演进路线图与阶段评估.md`
14. `14-综合评估矩阵与优先级清单.md`
15. `15-Instance Detail 功能一致性基线与验收矩阵.md`
16. `16-API体系与契约设计.md`
17. `17-能力到API调用矩阵.md`
18. `18-多内核治理与升级维护设计.md`

## 5. 评估方法

- 每章同时给出当前事实、目标标准、评估标准。
- 评分统一采用 `L1-L5`。
- `L3` 表示可用，`L4` 表示高质量产品化，`L5` 表示行业领先且具备规模化交付能力。
- 评估重点覆盖标准、设计、功能、架构、性能、安全、测试、安装、部署、发布、升级、商业化。

## 6. 总体结论

当前仓库已经具备成为行业领先桌面 AI 工作台的骨架，后续重点不是推翻，而是围绕“内置 OpenClaw 托管化、本地 Proxy 网关统一化、Instance Detail 完整化、多内核治理标准化、升级链路工程化、商业交付标准化”持续迭代。
