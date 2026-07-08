> Migrated from `docs/架构/04-技术选型与可插拔策略.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 04-技术选型与可插拔策略

## 1. 选型原则

- 前端高生产力，桌面端高控制力。
- 模型接入统一抽象，避免协议耦合渗透到业务层。
- OpenClaw 升级、打包、发布必须工程化。

## 2. 当前技术选型

| 层级 | 选型 | 作用 |
| --- | --- | --- |
| UI | React + TypeScript | 页面与交互 |
| 宿主 | Vite + Tauri | Web/桌面双宿主 |
| 原生运行时 | Rust | 高可靠宿主服务、OpenClaw 控制、Local Proxy |
| 状态与服务 | Core Services + Store | 共享编排与状态 |
| 文档 | VitePress Docs | 文档、指南、参考 |
| 打包发布 | Node Scripts + Tauri Build | 资源准备、校验、发布 |

## 3. Local Proxy 技术策略

### 3.1 客户端协议

- `openai-compatible`
- `anthropic`
- `gemini`

### 3.2 上游协议

- `openai-compatible`
- `anthropic`
- `gemini`
- `ollama`
- `azure-openai`
- `openrouter`
- `sdkwork`

### 3.3 设计价值

- 对 OpenClaw 暴露统一本地入口。
- 对上游模型供应商做协议归一与封装。
- 对桌面端提供单点配置、单点观测、单点测试。

## 4. OpenClaw Provider 投影策略

- OpenClaw 不直接消费用户散落配置，而消费“本地代理投影”后的托管 Provider。
- 投影结果统一使用 `sdkwork-local-proxy` Provider 标识。
- 投影时必须写入默认模型、推理模型、Embedding 模型与流式配置。
- 对 Anthropic/Gemini 等原生协议，需要根据协议投影不同 OpenClaw Provider API 形态。

## 5. 可插拔策略

### 5.1 Provider 可插拔

- 路由记录标准化
- Provider 预设模板化
- 模型清单可配置
- 应用到实例与 Agent 时统一走投影链

### 5.2 实例接入可插拔

- 内置 OpenClaw
- 本地外部 OpenClaw
- 远程 OpenClaw
- 其他兼容协议实例

### 5.3 交付形态可插拔

- Desktop Dev
- Desktop Production
- Web
- Server
- Container
- Kubernetes

## 6. OpenClaw 升级技术策略

- 统一版本源来自共享 release 元数据。
- `prepare-openclaw-runtime` 负责准备运行时资源。
- `sync-bundled-components` 负责内置组件同步。
- `openclaw-upgrade-readiness` 负责升级前就绪检查。
- `verify-desktop-openclaw-release-assets` 负责升级后资源校验。
- `ensure-tauri-target-clean` 负责防止旧产物污染升级结果。

## 7. 选型优劣评估

### 7.1 优势

- React/Tauri/Rust 组合兼顾效率与控制力。
- Proxy 抽象使模型生态扩展不再侵入业务层。
- 脚本化打包与升级能力已形成工程基础。

### 7.2 风险

- 代理、Gateway、Runtime 三层协作复杂度较高。
- OpenClaw 升级存在版本耦合，需要持续用契约测试守住边界。
- 多协议并存要求更高的测试密度。

## 8. 评估标准

| 评估项 | 合格线 | 领先线 | 当前判断 |
| --- | --- | --- | --- |
| 技术栈适配度 | 满足桌面 AI 工作台需求 | 同时满足治理、升级、商业交付需求 | `L4` |
| Provider 可插拔性 | 新增路由无需改动主 UI | 新增协议主要落在代理与配置中心 | `L4` |
| OpenClaw 升级工程化 | 有统一脚本与版本源 | 有 readiness、verify、repair 全流程 | `L4` |
| 长期演进成本 | 可维护 | 可长期多版本演进且风险可控 | `L3.5` |

## 9. 结论

当前选型合理，重点应继续投入在代理抽象、升级校验与契约测试，而不是更换主技术栈。

## 10. 2026-04-07 工程化补充

- 结构治理不再只靠人工约定，已落地为：
  - `scripts/check-arch-boundaries.mjs`
  - `scripts/check-sdkwork-clawstudio-hosts.mjs`
  - `scripts/sync-feature-packages.mjs`
  - `scripts/sync-feature-packages.test.mjs`
- `check:sdkwork-structure` 已接入 `sync-feature-packages` 回归测试，确保 feature wiring 同步器长期可用。
- `sync-feature-packages` 当前策略已固定为：
  - 可选目录缺失时跳过；
  - host 包不纳入 feature sync；
  - package root 导出优先公开顶层 wrapper 与显式顶层 barrel。
- 该策略为后续 Runtime/API 拆分提供稳定公共面，避免技术栈演进时把目录结构噪声暴露给业务层。

## 11. 2026-04-16 多内核治理补充

- 当前技术选型继续保持 `React + TypeScript + Tauri + Rust` 不变，重点不是更换技术栈，而是在现有技术栈上补齐多内核治理层。
- 正式推荐引入统一的 `Kernel Governance Plane`，详见 `18-多内核治理与升级维护设计.md`。
- `config/kernels/*.json` 继续承担 kernel catalog，`config/kernel-profiles/*.json` 继续承担 package profile，但版本源统一收敛到 `config/kernel-releases/*.json`。
- `config/kernel-releases/openclaw.json` 是 OpenClaw 的唯一版本源；已移除 `config/openclaw-release.json` 过渡入口，Hermes 与未来 kernel 直接走同一 `config/kernel-releases/<kernelId>.json` 标准。
- 编译期版本常量与资源 manifest 只允许作为 build projection，不再作为 kernel 版本主真相源。
- Host 核心层不再接受按某个 kernel id 增长平台级分支。OpenClaw、Hermes 和未来 kernel 的差异必须收敛到 adapter、doctor 与 management transport 边界内。

