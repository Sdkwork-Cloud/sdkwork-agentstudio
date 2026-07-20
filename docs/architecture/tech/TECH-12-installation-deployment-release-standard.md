> Migrated from `docs/架构/12-安装、部署、发布与商业化交付标准.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 12-安装、部署、发布与商业化交付标准

## 1. 交付目标

交付体系必须保证：

- 可安装
- 可启动
- 可升级
- 可验证
- 可回滚
- 可商业化发布

## 2. 交付形态

| 形态 | 目标 |
| --- | --- |
| Desktop Dev | 开发与联调 |
| Desktop Production | 桌面安装与生产交付 |
| Web | 预览与文档分发 |
| Server | 服务端控制面交付 |
| Container | 容器化分发 |
| Kubernetes | 集群化部署 |

统一要求：

- `Server/Container/Kubernetes` 共用同一 Rust Host Core、同一 API 面、同一 release metadata。
- `Container/Kubernetes` 是 `Server` 的交付包装，不允许复制业务实现或维护第二套配置语义。
- 只要启用托管 OpenClaw，所有模式都必须复用同一版本源、同一 Proxy 契约、同一 readiness/verify 标准。

## 3. 桌面交付标准

### 3.1 内置 OpenClaw

- 桌面安装包必须携带内置 OpenClaw 资源与 `manifest`。
- `manifest` 必须包含 `openclawVersion` 等关键元数据。
- 当前仓库资源 `manifest` 基线必须从 `config/kernel-releases/openclaw.json` 派生 `openclawVersion` 和 `requiredExternalRuntimeVersions.nodejs`，并固定携带 `runtimeId=openclaw`、`platform`、`arch` 等安装目标事实。
- 安装后必须可查询版本、安装目录、运行目录与默认启动组件。
- Install Bootstrap 必须优先以 Kernel `openClawRuntime.homeDir` 作为 `openclaw.json` 的配置定位事实源；ClawHub package / skill 目录只属于增强面，离线、未登录或 Node-safe 合约场景下允许回退为空列表，不得阻断 `openclaw.json`、托管 Provider 投影与同步实例主链。

### 3.2 本地代理

- 桌面交付必须包含 Local Proxy 运行支持。
- 首次启动必须能自动完成 OpenClaw Gateway 配置、本地代理就绪与托管 Provider 投影。
- 交付结果必须保证 OpenClaw 模型访问链路可用。

## 4. OpenClaw 升级标准

### 4.1 升级前

- 使用统一版本源解析目标版本。
- 当前版本源来自 `config/kernel-releases/openclaw.json`，而不是私有硬编码常量或旧的 OpenClaw 专用兼容投影。
- 运行 readiness 检查，识别版本偏斜、旧产物污染、资源缺失。

### 4.2 升级中

- 准备运行时资源
- 对安装阶段因 `--ignore-scripts` 被跳过的下载型原生依赖，显式补水并落盘必须进入 `prepare-openclaw-runtime` 的职责边界
- 同步内置组件
- 清理旧目标产物
- 生成/更新资源 manifest

### 4.3 升级后

- 校验发布资产
- 校验版本与安装键
- 校验 OpenClaw、Gateway、Local Proxy 可启动
- 校验 Provider 投影与 Chat 主链路

## 5. 安装与部署方式要求

- 开发模式：快速准备内置 Runtime 并保持迭代效率。
- 桌面安装：面向最终用户稳定安装。
- Server/Container/Kubernetes：面向服务化与企业部署场景。
- 每种方式都必须有对应的 smoke/verify 逻辑，而不是只产出文件。
- 发布 profile 必须统一映射到 `RuntimeStartupContext` 与 release manifest，确保 UI、运维、发布系统读取到同一模式事实。

## 6. 商业化交付要求

- 版本、环境、平台、架构信息清晰。
- Release 资产有清单、有校验、有追踪。
- 更新包、安装包、运行时资源之间的版本关系可验证。
- 支持专业的 changelog、版本管理和发布记录。

## 7. 当前事实

- 桌面包已有 OpenClaw 资源 manifest。
- 已有 `prepare-openclaw-runtime`、`sync-bundled-components`、`openclaw-upgrade-readiness`、`verify-desktop-openclaw-release-assets` 等脚本。
- 桌面 `package.json` 已把 OpenClaw 资源准备和组件同步纳入 dev/build 链路。
- 当前 `dev:desktop` / `build:desktop` 链路实际顺序为：Rust 工具链检查 -> OpenClaw Runtime 准备 -> Bundled Components 同步 -> 目标清理/解锁 -> Tauri 启动或打包。
- `Server/Container/Kubernetes` 已按统一 release flow 输出 native server、container、chart/k8s 产物，不再以模式分叉业务逻辑。
- OpenClaw 安装引导链已优先复用 Kernel `openClawRuntime.homeDir` 定位 `openclaw.json`，降低多模式/多入口路径漂移。
- OpenClaw Install Bootstrap 现在把 ClawHub package / skill 目录视为可选增强面；当共享 SDK 目录服务在 Node-safe root 入口、离线或未登录场景下不可用时，仍返回空目录并继续完成本地实例同步与托管 Provider 投影。

## 8. 关键差距

- 需要进一步把升级成功判定和商业发布证据标准固化为流程文档与发布 checklist。
- 需要把工作台可用性检查纳入发布后验收。
- 真实 desktop packaged launch、container 启动、k8s 集群就绪仍需在目标环境补齐最终运行证据。

## 9. 评估标准

| 评估项 | 合格线 | 领先线 | 当前判断 |
| --- | --- | --- | --- |
| 桌面交付完整度 | 安装包可安装可启动 | 内置 OpenClaw、Gateway、Proxy 一次交付完成 | `L4` |
| 升级灵活性 | 可升级 | 有 readiness、verify、repair、污染防护 | `L4` |
| 多形态部署能力 | 支持多种形态 | 每种形态都有标准化验证 | `L4` |
| 多模式统一性 | 共用 Host Core 与 release metadata | 模式差异只在封装与运维层 | `L4` |
| 商业化准备度 | 可发布 | 版本、证据、校验、changelog 全齐 | `L3.5` |

## 10. 结论

当前交付链路已具备行业高水准雏形。下一步应把升级验证、工作台验收和发布证据进一步产品化，形成完整商业交付标准。

## 2026-04-10 Step 11 Loop - Runtime-Backed Release Evidence

- Windows server release bundles现在以真实 `bin/agentstudio-server.exe` 为 smoke 入口，不再只依赖包装脚本。
- Server 模式下，`/claw/health/ready` 现在会在已发布 `claw-manage-http` 且 `studio_public_api` 可用时把 packaged server 视作 ready；默认 manage/OpenClaw runtime 与 gateway 投影仍保持原有 inactive 语义。
- `artifacts/release/server/windows/x64/release-smoke-report.json` 已记录 runtime-backed 的 `health-ready`、`host-endpoints`、`browser-shell` 证据。
- `artifacts/release/kubernetes/linux/x64/cpu/` 已补齐 bundle、manifest、smoke-report 框架；当前主机因缺少 `helm` 只留下 `skipped` 证据，而不是无记录状态。

## 2026-04-10 Step 11 Loop - 当前主机阻塞

- 当前 Windows 沙箱仍不允许 Node 驱动的 desktop installer / packaged app child-process smoke，`smoke-desktop-packaged-launch` 仍以 `EPERM` 失败，因此 fresh desktop startup evidence 尚未补齐。
- 当前 Windows 主机无法产出 linux container bundle：
  - WSL 不可用
  - `x86_64-unknown-linux-gnu` Rust target 未安装
  - `x86_64-linux-gnu-gcc` 缺失
- 当前主机虽有 `kubectl`，但缺少 `helm`，因此 kubernetes chart smoke 只能记为 `skipped`。
## 2026-04-10 Step 09 Loop - Support-Facing Proxy Evidence

- `Kernel Center` is now part of the release/support evidence chain for local proxy observability.
- The following artifact paths are now treated as operator-facing readback fields rather than hidden implementation details:
  - `configPath`
  - `snapshotPath`
  - `logPath`
  - `observabilityDbPath`
- Release and support flows should prefer runtime-truth readback of those fields instead of assuming fixed file locations from packaging alone.
- This slice does not yet add packaged smoke automation for the observability database; it only makes the artifact visible and testable from the product surface.

## 2026-04-10 Step 09 Loop - API Workspace Proxy Evidence

- `ApiSettings` request/message log workspace is now part of the release/support evidence chain for local proxy runtime artifacts.
- Support can now verify proxy lifecycle, `logPath`, `snapshotPath`, and `observabilityDbPath` from the same runtime truth used by `Kernel Center`.
- The logs workspace `Refresh` action now re-reads both paginated log data and runtime evidence so support/release flows can validate artifact paths without leaving the logs surface.
- This slice still does not add packaged smoke automation or repair playbooks for those artifacts; it only makes them readable from a second support-facing surface.

## 2026-04-10 Step 09 Loop - Packaged Startup Smoke Local Proxy Contract

- Packaged desktop launch evidence is now part of the same support/release chain for local proxy runtime artifacts.
- `desktop-startup-evidence.json` preserves a sanitized local proxy runtime block captured from desktop kernel truth during startup.
- `desktop-startup-smoke-report.json` now requires:
  - a running local proxy lifecycle
  - `messageCaptureEnabled`
  - `observabilityDbPath`
  - `snapshotPath`
  - `logPath`
- Aggregated release metadata now exposes the same summary as `desktopStartupSmoke.localAiProxyRuntime`.
- OpenClaw upgrade-smoke evidence now surfaces that summary through `packagedLaunchSmokeSummary`, so packaged support evidence no longer stops at nested smoke-report JSON.

## 2026-04-10 Step 09 Closure - Delivery Baseline

- Desktop delivery now has one continuous truth chain for local proxy runtime evidence:
  - runtime contract
  - support-facing settings surfaces
  - packaged startup evidence
  - packaged startup smoke
  - aggregated release metadata
  - upgrade-smoke summary
- Step 09 therefore closes with:
  - frozen heavy-panel bundle baseline
  - frozen local proxy latency / route-metric / route-probe runtime baseline
  - frozen packaged startup evidence contract for local proxy runtime artifacts
- Later steps should strengthen this baseline into:
  - Step 10 quality gates
  - Step 11 release gates

