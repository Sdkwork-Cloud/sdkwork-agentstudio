> Migrated from `docs/zh-CN/guide/application-modes.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 应用模式

## 总览

Agent Studio 现在不是单一的桌面端应用，而是一套可以运行在多种宿主与部署形态上的产品系统。不同模式共享相同的产品能力，但在传输方式、打包结果和运维方式上有所区别。

## 模式矩阵

| 模式 | 主要宿主 | 运维访问方式 | 适用场景 | 主要入口 |
| --- | --- | --- | --- | --- |
| Web 工作区 | Vite 开发服务器 | 浏览器 | 日常前端开发与联调 | `pnpm dev` |
| 桌面端运行时 | Tauri + Rust Host | 原生桌面窗口 | 本地 GUI 优先安装与本地受管运行时 | `pnpm dev:desktop` |
| 原生 Server | Axum + Rust Host | 浏览器同源访问 | 独立 Server 安装与浏览器管理 | `pnpm dev:server` |
| Container | Rust Server 容器化部署 | 浏览器通过容器端口访问 | Docker / Compose 环境 | 发布产物中的 container bundle |
| Kubernetes | Rust Server + Chart | 浏览器通过 ingress 或 service 访问 | 集群部署与平台运维 | 发布产物中的 kubernetes bundle |
| Web/docs 归档 | 纯静态资源 | 静态站点 | 只发布浏览器静态资源和文档 | 发布产物中的 web archive |

## Web 工作区

Web 工作区是日常 UI 开发最快的路径，适合：

- 调整 React 页面与样式
- 验证 package 边界和架构约束
- 在不进入原生打包链路的前提下处理浏览器界面

## 桌面端运行时

桌面端通过 Tauri 打包同一套产品 Shell，并将本地原生能力接入到共享业务包中。

当前桌面端特征：

- 浏览器承载的 `studio`、`manage`、`internal`、`openapi` 等规范化流程，会通过嵌入式 Rust Host 以 `desktopCombined` 方式提供
- Tauri command 仍然保留给不属于规范 `/claw/*` 宿主接口面的原生能力
- `/claw/manage/v1/service*` 明确保持为 server-only，不会在 desktop combined mode 中发布
- 本地运行时集成、安装和打包由 Rust Host 与桌面端打包链路负责
- 桌面端已经并入统一 release family，而不是独立产品线

## 原生 Server

Server 模式会启动 Rust Axum Host，并同时对外提供：

- 浏览器应用静态资源
- 已发布的原生 `/claw/*` 控制平面路由

当前 Server 特征：

- 浏览器 UI 与原生控制平面同源提供
- OpenAPI 发现面位于 `/claw/openapi/*`
- 运行时与管理面位于 `/claw/internal/v1/*` 和 `/claw/manage/v1/*`
- 可以通过 HTTP Basic Auth 对浏览器界面和控制平面进行保护

## Container 与 Kubernetes

Container 和 Kubernetes 不是另外两套应用实现，而是围绕同一个 Rust Server 二进制构建出来的部署形态。

关键点：

- Rust Server 本身是 CPU 中立的
- GPU 差异通过部署层的 accelerator profile 表达，例如 `cpu`、`nvidia-cuda`、`amd-rocm`
- Docker 和 Helm 包是在同一应用运行时外层增加部署文件、元数据和覆盖层

## 浏览器传输差异

当前有两种关键访问模式：

- 桌面端 combined mode 对规范化 `/claw/*` 浏览器流程走嵌入式 loopback HTTP，对纯原生能力继续使用 Tauri command
- Server、Container、Kubernetes 通过同源 `/claw/*` HTTP 路由访问原生控制平面

产品层保持一致，但不同宿主模式下传输方式不同，这一点在调试、部署和接口接入时必须明确。

## 各模式的 API 接入方式

| 模式 | 控制平面传输方式 | 推荐接入方式 |
| --- | --- | --- |
| Web 工作区 | preview bridge 或 mock bridge | 通过包级契约开发 UI，不直接依赖 `/claw/*` |
| 桌面端运行时 | 规范 `/claw/*` 流程走嵌入式 loopback HTTP，原生专属能力走 desktop bridge | 优先通过共享 platform bridge 或 `browserBaseUrl` 访问，不要假设 server-only service 生命周期接口存在 |
| 原生 Server | 同源 HTTP | 浏览器、运维脚本或未来 SDK 直接访问 `/claw/*` |
| Container | 映射端口后的同源 HTTP | 通过对外发布的 host 和 port 访问 `/claw/*` |
| Kubernetes | service 或 ingress 背后的同源 HTTP | 通过集群 service 或域名访问 `/claw/*` |

对接方需要抓住一个核心规则：规范 `/claw/*` 契约已经在嵌入式 desktop 和独立 server-backed 模式间收敛，但 service 生命周期接口仍然保持 server-only。

## 如何选择

- 选 `web`：适合包级开发与浏览器快速迭代
- 选 `desktop`：适合本地 GUI 优先使用
- 选 `server`：适合独立服务端部署并通过浏览器管理
- 选 `container`：适合 Docker 与 Compose 场景
- 选 `kubernetes`：适合集群部署与 ingress 管理
- 选 `web/docs`：只需要静态资源与文档站时使用

## 推荐决策顺序

1. 如果你需要原生窗口体验，选择 `desktop`。
2. 如果你需要单机或单台服务器上的浏览器管理能力，选择 `server`。
3. 如果你已经有 Docker 主机场景，选择 `container`。
4. 如果你已经有集群和 ingress，选择 `kubernetes`。
5. 如果你只做 UI 开发或静态资源发布，选择 `web` 或 `web/docs`。

