# 环境变量

## 配置源

优先从仓库根目录的 `.env.example` 开始。Web、Desktop、Server 等包各自的 `.env.example` 会补充它们特有的运行时说明。

## 核心变量

| 变量 | 是否必需 | 作用 |
| --- | --- | --- |
| `APP_URL` | 取决于部署方式 | 托管环境中的应用访问地址 |
| `VITE_API_BASE_URL` | 推荐 | 共享后端 API 地址 |
| `VITE_APP_ID` | 桌面更新场景 | 更新接口使用的应用 id |
| `VITE_RELEASE_CHANNEL` | 桌面更新场景 | 更新查询使用的发布通道 |
| `VITE_DISTRIBUTION_ID` | 桌面分发场景 | 分发清单选择 |
| `VITE_PLATFORM` | 桌面运行时 | 当前平台标识 |
| `VITE_TIMEOUT` | 可选 | 共享 HTTP 超时 |
| `VITE_ENABLE_STARTUP_UPDATE_CHECK` | 可选 | 是否在桌面启动时检查更新 |
| `CLAW_SERVER_CONFIG` | 可选 | `clawstudio-server` 使用的 JSON 配置文件路径 |
| `CLAW_SERVER_HOST` | Server 运行时 | Rust Server 监听地址，默认 `127.0.0.1` |
| `CLAW_SERVER_PORT` | Server 运行时 | Rust Server 请求监听端口 |
| `CLAW_SERVER_DATA_DIR` | Server 运行时 | rollout 与 node-session 数据目录 |
| `CLAW_SERVER_STATE_STORE_DRIVER` | Server 运行时 | host state-store 驱动，当前支持 `json-file` 或 `sqlite` |
| `CLAW_SERVER_STATE_STORE_SQLITE_PATH` | 可选 | 当使用 `sqlite` 时覆盖默认 SQLite 路径 |
| `CLAW_SERVER_STATE_STORE_POSTGRES_URL` | 可选 | host-platform `stateStore` 投影里的 PostgreSQL 连接元数据；当前 server slice 会把对应 postgres provider 标记为 `projectionMode = metadataOnly`，不会启用 PostgreSQL 运行时驱动 |
| `CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA` | 可选 | host-platform `stateStore` 投影里的 PostgreSQL schema 元数据；当前 server slice 会把对应 postgres profile 标记为 `projectionMode = metadataOnly`，不会启用 PostgreSQL 运行时驱动 |
| `CLAW_SERVER_WEB_DIST` | Server 运行时 | 覆盖 Server 提供的浏览器构建目录 |
| `CLAW_SERVER_MANAGE_USERNAME` | 可选 | 为浏览器壳与 `/claw/manage/v1/*` 开启 Basic Auth |
| `CLAW_SERVER_MANAGE_PASSWORD` | 可选 | 与 `CLAW_SERVER_MANAGE_USERNAME` 配套 |
| `CLAW_SERVER_INTERNAL_USERNAME` | 可选 | 为 `/claw/internal/v1/*` 开启专用 Basic Auth |
| `CLAW_SERVER_INTERNAL_PASSWORD` | 可选 | 与 `CLAW_SERVER_INTERNAL_USERNAME` 配套 |
| `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND` | 可选 | 显式允许在没有 control-plane Basic Auth 的情况下绑定到非 loopback 地址，默认 `false` |
| `SDKWORK_SERVER_BUILD_WSL_DISTRO` | 可选 | 在 Windows 上为 `pnpm server:build -- --target <linux-triple>` 指定自动桥接使用的 WSL 发行版 |
| `SDKWORK_SERVER_BUILD_DISABLE_WSL` | 可选 | 在 Windows 上关闭 Linux target 的自动 WSL 桥接，只保留原生 Cargo 处理 |

## 实践建议

- 不要提交任何密钥。
- 新增变量时同步更新 `.env.example`。
- 在对应包文档和公开文档中记录新变量。
- 桌面端变量应与分发和更新流程保持一致。
- 浏览器和桌面 Vite env 文件不得注入 root access token；高权限凭据必须保留在可信宿主或宿主代理链路中。
- AI 能力现在依赖有效的 OpenClaw 兼容实例与 Provider Center 配置，而不是浏览器侧的 Gemini key。
- `clawstudio-server` 当前的配置优先级是 `CLI 覆盖 -> 配置文件 -> 环境变量 -> 默认值`。
- `clawstudio-server service print-manifest` 会复用同一套解析优先级；如果没有显式配置文件路径，则会默认落到 `<CLAW_SERVER_DATA_DIR>/clawstudio-server.config.json`。
- `clawstudio-server service install`、`start`、`stop`、`restart` 与 `status` 也会复用同一套配置入口，并要求操作者具备平台服务管理器所需的权限。
- `CLAW_SERVER_MANAGE_USERNAME` 与 `CLAW_SERVER_MANAGE_PASSWORD` 同时保护浏览器壳、`/claw/manage/v1/rollouts*` 与 `/claw/manage/v1/service*`，因此浏览器端可以在同源受控前提下管理本机服务生命周期。
- `CLAW_SERVER_CONFIG` 是打包后 server 部署最推荐的稳定配置入口，可以减少对环境变量的依赖。
- 如果没有明确配置网关、认证和网络暴露策略，不要把 `CLAW_SERVER_HOST` 从 `127.0.0.1` 扩大到公网监听。
- 一旦把 `CLAW_SERVER_HOST` 扩大到非 loopback，Rust 宿主现在会强制要求 control-plane 凭据；只有显式设置 `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=true` 才允许跳过这层保护。
- `CLAW_SERVER_STATE_STORE_DRIVER` 当前支持 `json-file` 和 `sqlite`；SQLite 现在是默认的持久化基线，而 JSON 保留为显式启用的引导或开发回退方案。
- `CLAW_SERVER_STATE_STORE_DRIVER=postgres` 当前会被显式拒绝，因为 PostgreSQL 还只是 metadata-only 投影，还不是可激活的运行时驱动。
- `CLAW_SERVER_STATE_STORE_POSTGRES_URL` 与 `CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA` 当前只用于 host-platform `stateStore` 投影，便于操作者看到规划中的 PostgreSQL readiness，并不会启用 PostgreSQL 运行时驱动；返回的 provider 与 profile 会明确带上 `projectionMode = metadataOnly`。
- `CLAW_SERVER_DATA_DIR` 当前会通过 host-core storage SPI 生成 `rollouts.json` 与 `node-sessions.json`，或者生成单个 `host-state.sqlite3` 数据库；后续 PostgreSQL、Redis 与缓存提供者也应走同一边界，而不是绕过它。
- 在 Windows 上，`pnpm server:build -- --target x86_64-unknown-linux-gnu` 会优先复用已安装的 WSL 发行版来完成 Linux release 构建；如果需要固定发行版，可设置 `SDKWORK_SERVER_BUILD_WSL_DISTRO`，如果需要关闭这条桥接路径，可设置 `SDKWORK_SERVER_BUILD_DISABLE_WSL=1`。
