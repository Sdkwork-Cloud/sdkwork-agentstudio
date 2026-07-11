# 2026-04-06 Agent Studio System Review Remediation Design

## Design Goals

这轮改进不追求零散补丁，而是建立一条可持续的质量闭环：

1. Rust 宿主内核是唯一运行时权威。
2. OpenClaw 安装、预热、启动复用、代理、实例、会话等链路都围绕同一份 runtime ownership 展开。
3. 关键桌面 hosted runtime 行为必须进入强制回归。
4. 发布质量不能只看源码和结构，还要尽量逼近真实安装与首启行为。

## Target Quality Model

### 1. Source Of Truth

统一三类权威来源：

- 版本与资源权威：`config/openclaw-release.json` + release asset manifest
- 运行时权威：Rust host runtime snapshot、OpenClaw runtime snapshot、host endpoint projection
- UI 行为权威：前端只消费桥接层与宿主公开投影，不直接推断本地状态

### 2. Verification Pyramid

验证层次分四层：

- L1: source contract
  - 例如路径、脚本、配置、资源声明、i18n 结构
- L2: logic/unit regression
  - 例如 hosted bridge、resolver、token extraction、instance service
- L3: packaged artifact smoke
  - 例如 installer plan、release asset verification、postinstall wiring
- L4: execution smoke
  - 真实安装、首启、gateway WebSocket、built-in instance readiness

当前系统在 L1/L2 已经开始加强，L3 有进展，但 L4 仍是最大缺口。

### 3. Hosted Runtime Contract

桌面 hosted runtime 需要稳定满足以下约束：

- `browserBaseUrl` 必须来自 Rust host snapshot，而不是前端推断
- `browserSessionToken` 必须在 manage/internal/studio 三条 surface 上一致
- 启动阶段必须先完成 hosted runtime readiness，再允许 shell 进入稳定态
- `/claw/internal/*`、`/claw/manage/*`、`/claw/api/*` 的 loopback CORS 与 browser-session 鉴权必须协同成立

### 4. Release Closure

每次 release 需要保留四类证据：

- OpenClaw 资源指纹
- 桌面 host runtime snapshot
- built-in instance readiness snapshot
- desktop installer smoke/report

如果源码修了但这些证据不一致，应优先判定为构建/安装产物漂移，而不是继续改业务代码。

## Immediate Design Decision

本轮先落地一个高价值、低风险改进：

- 把现有桌面 hosted runtime 回归测试正式接入 `check:desktop`

理由：

- 这些测试已经存在，代表设计已经成形；
- 不接入强制回归，等于没有防线；
- 这是支撑后续 OpenClaw、CORS、bootstrap、instance readiness 改进的基础设施。

## Next-Stage Design

### Stage A: Mandatory Desktop Hosted Runtime Regression

纳入强制回归：

- hosted bridge base path and browser-session token
- runtime resolver retry/invalidation
- DesktopBootstrapApp hosted readiness probe contract

### Stage B: Runtime Evidence Surfacing

在桌面启动日志或诊断页中暴露：

- desktop host lifecycle
- host endpoint count
- built-in instance baseUrl/websocketUrl
- openclaw runtime lifecycle
- gateway lifecycle
- current asset/runtime provenance

### Stage C: Execution Smoke

按平台补齐：

- Windows: 安装后首启证明不再触发 OpenClaw 重解压
- Linux: package install 后 postinstall 真实生效
- macOS: `.app` 内 staged runtime 首启可用

### Stage D: Activation Convergence

继续收敛：

- dedicated OpenClaw runtime activation
- generic bundled activation

目标是让 desktop/server/docker/k8s 共用同一套内核与 runtime provenance 语言。
