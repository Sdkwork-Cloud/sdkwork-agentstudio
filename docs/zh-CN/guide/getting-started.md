# 快速开始

## 你将要启动什么

这个仓库是 Claw Studio 的分包工作区，包含：

- Web 入口包
- Tauri 桌面端入口包
- 原生 Rust Server 包
- 共享 Shell 包
- 共享 `core`、`types`、`infrastructure`、`i18n` 和 `ui` 包
- `chat`、`market`、`settings`、`account`、`extensions` 等垂直业务包

## 前置条件

- Node.js
- `pnpm`
- 如果需要运行原生 Server 或桌面端构建，还需要 Rust
- 如果需要运行桌面端，还需要安装 Tauri 对应的平台依赖

如果你只处理 Web Shell，Node.js 和 `pnpm` 就足够了。

## 安装依赖

```bash
pnpm install
```

## 启动主要运行模式

### Web 工作区

```bash
pnpm dev
```

这会启动 `@sdkwork/claw-web` 的 Vite 开发服务器，默认地址为 `http://localhost:3001`。

### 桌面端运行时

```bash
pnpm tauri:dev
```

桌面端会先在 `127.0.0.1:1426` 启动 Vite，再拉起 Tauri 应用。

### 原生 Server

```bash
pnpm server:dev
```

Server 包会启动 Rust Host，并通过已实现的 `/claw/*` 路由族对外提供浏览器管理界面与控制平面能力。

## 构建与校验

```bash
pnpm build
pnpm check:multi-mode
pnpm check:server
pnpm server:build
pnpm tauri:build
pnpm docs:build
```

- `pnpm build` 用于构建 Web Shell
- `pnpm check:multi-mode` 用于一次覆盖 desktop、server、统一 host runtime、OpenClaw 就绪度与 release 打包契约的高信号本地门禁
- `pnpm check:server` 用于校验原生 Server 运行时
- `pnpm server:build` 用于构建原生 Server 二进制
- `pnpm tauri:build` 用于构建桌面端安装包
- `pnpm docs:build` 用于构建公开文档站

## 规划与校验发布

```bash
pnpm check:automation
pnpm release:plan
pnpm release:finalize
```

- `pnpm check:automation` 用于校验发布与 CI 自动化契约
- `pnpm release:plan` 用于查看当前 multi-family release 矩阵
- `pnpm release:finalize` 用于在聚合所有发布产物后生成最终清单与校验文件。本地 wrapper 默认聚合目录为 `artifacts/release`，GitHub workflow 使用的是 `release-assets/`。本地执行时会优先读取 `SDKWORK_RELEASE_REPOSITORY`，其次读取 `GITHUB_REPOSITORY`，最后从 `git remote origin` 自动推断 `release-manifest.json.repository`；对于 `container` / `kubernetes`，还会保留结构化的 `status=skipped` deployment smoke 证据，而不是把主机能力缺失伪装成通过

## 环境变量准备

从根目录 `.env.example` 开始。

重点变量包括：

- AI 能力依赖一个可用的 OpenClaw 兼容实例以及 Provider Center 配置
- `VITE_API_BASE_URL`：后端 API 地址
- `VITE_APP_ID`：桌面更新使用的应用 id
- `VITE_RELEASE_CHANNEL`：桌面更新使用的发布通道
- `CLAW_SERVER_HOST`：原生 Server 监听地址
- `CLAW_SERVER_PORT`：原生 Server 监听端口
- `CLAW_SERVER_DATA_DIR`：原生 Server 数据目录

浏览器和桌面 Host 不得通过 Vite env 注入 root access token；高权限凭据应保留在可信宿主或宿主代理认证链路中。

桌面端补充示例见 `packages/sdkwork-claw-desktop/.env.example`，服务端默认变量见 `packages/sdkwork-claw-server/.env.example`。

## 推荐下一步

- 阅读 [应用模式](/zh-CN/guide/application-modes) 选择合适的宿主形态
- 阅读 [安装与部署](/zh-CN/guide/install-and-deploy) 查看不同操作系统与部署方式的说明
- 阅读 [架构说明](/zh-CN/core/architecture) 后再移动包边界
- 阅读 [API 总览](/zh-CN/reference/api-reference) 了解当前原生接口面
- 阅读 [发布与部署](/zh-CN/core/release-and-deployment) 了解 Server、Docker、Kubernetes 的打包逻辑
- 阅读 [命令参考](/zh-CN/reference/commands) 快速查找校验与打包命令
