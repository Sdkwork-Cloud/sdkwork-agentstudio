# Claw Server 运行时参考

本文记录当前 `packages/sdkwork-claw-server` 的内置宿主运行时，以及被桌面嵌入式宿主复用的同一套路由契约。

## 目标

当前运行时已经完成这些事情：

1. 启动原生 Axum Web Server。
2. 把内置宿主端口作为唯一的外部 HTTP 入口。
3. 在 `/claw/*` 下发布平台原生 API。
4. 在 `local-ai-proxy` 激活时，把 root-native 本地 AI 兼容接口挂到同一个端口上。
5. 在受管 OpenClaw gateway HTTP 能力激活时，把 `/claw/gateway/openclaw/*` 代理接口挂到同一个端口上。
6. 用同一个宿主对外提供浏览器前端静态资源。
7. 通过 host-core 存储层持久化 rollout 与 node-session 状态。
8. 基于真实挂载路由集合发布实时 OpenAPI 3.1 discovery 和分文档 schema。
9. 启动时把运行时 OpenAPI 快照写入 `<runtime_data_dir>/openapi/`。
10. 启动时输出一份机器可读的 catalog JSON，列出当前文档 URL 与 API gateway 端点。
11. 在 `server` 模式下继续暴露 service 生命周期 CLI 与对应的 HTTP manage 接口。

## 原生命令

当前 Rust 入口已经提供真实 CLI：

```bash
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- run
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- print-config
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service print-manifest --platform linux
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service status
```

当前命令说明：

- CLI 逻辑命令面是 `claw-server run`、`claw-server print-config`、`claw-server service print-manifest --platform <linux|macos|windows>` 与 `claw-server service <install|start|stop|restart|status>`
- 当前打包后的 release bundle 会把同一套命令面暴露在原生二进制 `bin/claw-server` 或 `bin/claw-server.exe` 上；这个原生二进制就是打包后的规范启动入口，在 bundle 布局完整时会自动解析 `CLAW_SERVER_WEB_DIST` 与 `CLAW_SERVER_DATA_DIR` 的包内默认值，而 `start-claw-server.sh`、`start-claw-server.cmd` 继续作为围绕同一原生二进制的可选便捷包装层
- `run` 是默认命令
- `print-config` 会输出当前生效的运行时配置
- `service print-manifest` 会输出跨平台服务清单元数据，以及对应平台的单元内容
- `service install/start/stop/restart/status` 全部复用同一套运行时配置解析逻辑

## 服务清单与生命周期

当前服务清单投影：

- Linux 使用 `systemd`，目标路径为 `/etc/systemd/system/claw-server.service`
- macOS 使用 `launchd`，目标路径为 `/Library/LaunchDaemons/ai.sdkwork.claw.server.plist`
- Windows 使用 `windowsService`，目标路径为 `<CLAW_SERVER_DATA_DIR>/service/windows-service.json`
- 当 `CLAW_SERVER_CONFIG` 与 `--config` 都未提供时，默认配置文件路径为 `<CLAW_SERVER_DATA_DIR>/claw-server.config.json`

当前服务生命周期说明：

- Linux 通过 `systemctl`
- macOS 通过 `launchctl`
- Windows 通过 `sc.exe`
- `GET /claw/manage/v1/service` 与 `POST /claw/manage/v1/service:install|start|stop|restart` 复用与 CLI 相同的 service control plane

## 环境变量

当前 server shell 读取：

```bash
CLAW_SERVER_CONFIG=
CLAW_SERVER_HOST=127.0.0.1
CLAW_SERVER_PORT=18797
CLAW_SERVER_DATA_DIR=.claw-server
CLAW_SERVER_STATE_STORE_DRIVER=sqlite
CLAW_SERVER_STATE_STORE_SQLITE_PATH=
CLAW_SERVER_STATE_STORE_POSTGRES_URL=
CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA=
CLAW_SERVER_WEB_DIST=../sdkwork-claw-web/dist
CLAW_SERVER_MANAGE_USERNAME=
CLAW_SERVER_MANAGE_PASSWORD=
CLAW_SERVER_INTERNAL_USERNAME=
CLAW_SERVER_INTERNAL_PASSWORD=
CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false
```

当前行为说明：

- 配置优先级是 `CLI 覆盖 -> 配置文件 -> 环境变量 -> 内置默认值`
- `CLAW_SERVER_HOST` 默认是 `127.0.0.1`
- `CLAW_SERVER_PORT` 默认是 `18797`
- `CLAW_SERVER_DATA_DIR` 是 server 运行时数据根目录
- `CLAW_SERVER_STATE_STORE_DRIVER` 当前支持 `json-file` 与 `sqlite`
- 当启用 `sqlite` 且未显式指定路径时，默认使用 `<CLAW_SERVER_DATA_DIR>/host-state.sqlite3`
- `CLAW_SERVER_MANAGE_*` 保护浏览器壳与 `/claw/manage/v1/*`
- `CLAW_SERVER_INTERNAL_*` 保护 `/claw/internal/v1/*`，未配置时回退到 `manage` 凭据
- 如果绑定到非 loopback 地址，默认必须配置控制面凭据；只有显式设置 `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=true` 才允许跳过

## 启动行为

Server 入口位于 `packages/sdkwork-claw-server/src-host/src/main.rs`。

启动流程如下：

1. 解析 CLI 命令。
2. 解析生效运行时配置。
3. 绑定 requested host 与 requested port。
4. 当请求端口被占用且允许动态回退时，分配新的 active port。
5. 构建 `ServerState`。
6. 基于当前状态构建实时 API surface catalog。
7. 把运行时 OpenAPI 快照写入 `<runtime_data_dir>/openapi/`。
8. 基于同一份 catalog 构建启动 catalog JSON。
9. 挂载 Axum Router。
10. 输出当前监听地址。
11. 输出启动 catalog JSON。

关键行为：

- 运行时 OpenAPI 快照写入属于启动关键路径；写入失败会直接导致启动失败
- 启动 catalog JSON 使用 `kind = "sdkworkClawOpenApiCatalog"`
- 桌面嵌入式宿主也会复用同样的快照写入和启动 catalog 输出逻辑，只是 runtime data dir 不同

## 统一宿主路由发布模型

当前内置宿主会在静态资源 fallback 之前挂载这些路由族：

- `/claw/health/*`
- `/claw/api/v1/*`
- `/claw/openapi/*`
- `/claw/internal/v1/*`
- `/claw/manage/v1/*`
- `/claw/gateway/openclaw/*`
- `/health`
- `/v1/*`
- `/v1beta/*`

规则：

- `/claw/*` 保留给平台原生 API
- `/health`、`/v1/*`、`/v1beta/*` 属于 `local-ai-proxy` 的 root-native 兼容路径
- `/claw/gateway/openclaw/*` 属于受治理 OpenClaw gateway 代理命名空间
- 不存在 `/claw/gateway/local-ai/*`
- API 路由会先于浏览器 SPA fallback 挂载，避免 root-native 兼容接口被静态页面吞掉

## 路由族

### 原生平台

当前原生路由族包括：

- `/claw/health/*`
- `/claw/api/v1/*`
- `/claw/openapi/*`
- `/claw/internal/v1/*`
- `/claw/manage/v1/*`

代表性接口：

- `GET /claw/health/live`
- `GET /claw/health/ready`
- `GET /claw/api/v1/discovery`
- `GET /claw/internal/v1/host-platform`
- `GET /claw/manage/v1/rollouts`
- `POST /claw/manage/v1/service:start`
- `GET /claw/manage/v1/openclaw/runtime`
- `GET /claw/manage/v1/openclaw/gateway`
- `POST /claw/manage/v1/openclaw/gateway/invoke`

### 本地 AI 兼容接口

当 `local-ai-proxy` 激活时，宿主还会额外挂载：

- `GET /health`
- `GET /v1/health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/embeddings`
- `POST /v1/messages`
- `GET /v1beta/models`
- `POST /v1beta/models/{modelAction}`
- `POST /v1/models/{modelAction}`

这些路径的设计目标就是保持 provider-compatible，因此调用方只需要替换 `baseURL` 与 `apiKey`。

### 受治理 OpenClaw Gateway 代理

当受管 OpenClaw gateway HTTP 能力激活时，宿主还会额外挂载：

- `POST /claw/gateway/openclaw/tools/invoke`

对外发布路径始终保持在 `/claw/gateway/openclaw/*`，但宿主向上游转发时会去掉这层治理前缀。

## OpenAPI 发布模型

当前内置宿主会发布一个 discovery 接口，以及最多三份实时 OpenAPI 3.1 文档。

### Discovery

- `GET /claw/openapi/discovery`

当前 discovery 字段：

- `family`
- `hostMode`
- `generatedAt`
- `documents[]`

每个 `documents[]` 元素当前包含：

- `id`
- `title`
- `version`
- `format`
- `url`
- `apiFamilies`
- `proxyTarget`
- `runtimeCapability`
- `generatedAt`

### 文档

始终存在：

- `GET /claw/openapi/v1.json`

按能力条件存在：

- `GET /claw/openapi/local-ai-compat-v1.json`
- `GET /claw/openapi/openclaw-gateway-v1.json`

当前文档所有权：

- `claw-native-v1` 对应 `/claw/*` 原生平台 API
- `local-ai-compat-v1` 对应 root-native 兼容路径
- `openclaw-gateway-v1` 对应 `/claw/gateway/openclaw/*`

规则：

- 所有文档都使用 `openapi: 3.1.0`
- 任意一个已发布路径只会出现在一份实时文档中
- 可选文档只会在对应运行时能力激活时出现在 discovery 中

## 运行时 OpenAPI 快照文件

启动时，运行时会把当前 schema 集合写入：

- `<runtime_data_dir>/openapi/discovery.json`
- `<runtime_data_dir>/openapi/claw-native-v1.json`

按能力条件追加：

- `<runtime_data_dir>/openapi/local-ai-compat-v1.json`
- `<runtime_data_dir>/openapi/openclaw-gateway-v1.json`

文件写入采用原子方式，避免读取方看到半写入 JSON。

## 启动 Catalog 输出

宿主绑定成功后，会输出一份机器可读 JSON catalog，字段包括：

- `kind`
- `hostMode`
- `hostBaseUrl`
- `openapiDiscoveryUrl`
- `documents[]`
- `gatewayEndpoints[]`

`gatewayEndpoints[]` 来自同一份实时 catalog，包含：

- `/claw/openapi/discovery`
- 当前激活的 OpenAPI 文档 URL
- 当前激活的 root-native 本地 AI 兼容接口
- 当前激活的受治理 OpenClaw 代理接口

示例形状：

```json
{
  "kind": "sdkworkClawOpenApiCatalog",
  "hostMode": "server",
  "hostBaseUrl": "http://127.0.0.1:18797",
  "openapiDiscoveryUrl": "http://127.0.0.1:18797/claw/openapi/discovery",
  "documents": [
    {
      "id": "claw-native-v1",
      "url": "/claw/openapi/v1.json",
      "absoluteUrl": "http://127.0.0.1:18797/claw/openapi/v1.json",
      "proxyTarget": "native-host",
      "runtimeCapability": "always",
      "generatedAt": 1743600000000
    }
  ],
  "gatewayEndpoints": [
    "http://127.0.0.1:18797/claw/openapi/discovery",
    "http://127.0.0.1:18797/claw/openapi/v1.json"
  ]
}
```

## 浏览器资源托管

静态资源托管位于 `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`。

当前行为：

- 当配置了 manage 凭据时，浏览器壳与静态资源共享相同的 Basic Auth challenge
- 先返回真实静态文件，再走 SPA fallback
- 未命中的浏览器路由会回退到 `index.html`
- 返回的 HTML 会注入 `sdkwork-claw-host-mode`、`sdkwork-claw-manage-base-path`、`sdkwork-claw-internal-base-path` 等宿主元数据

## 桌面嵌入式宿主复用

桌面端通过 `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs` 复用同一套路由。

桌面侧的补充说明：

- 运行模式是 `desktopCombined`
- 嵌入式宿主 base URL 通过 `browserBaseUrl` 暴露给前端
- 运行时 OpenAPI 快照写入嵌入式宿主自己的 runtime data dir，当前为 `<machine_state_dir>/desktop-host/openapi/`
- 桌面嵌入式宿主同样会输出相同形状的机器可读启动 catalog JSON
- `/claw/manage/v1/service*` 在桌面模式下保持关闭

## 验证命令

当前这一条运行时实现的聚焦验证：

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap
```

工作区层面仍常用：

```bash
pnpm lint
pnpm check:server
```

## 当前边界

当前已经实现：

- 单一内置宿主端口
- `/claw/*` 原生平台 API
- 同端口发布的 root-native 本地 AI 兼容接口
- 同端口发布的 `/claw/gateway/openclaw/*` 受治理代理接口
- 实时多文档 OpenAPI discovery
- `<runtime_data_dir>/openapi/` 下的运行时 schema 快照
- 机器可读启动 catalog 输出

当前尚未实现：

- 超出当前 `/claw/api/v1/*` 已发布集合之外的更广泛产品域 public API
- 当前已落地接口面之外的更多受治理 OpenClaw 代理路径
- 插件托管的 HTTP 接口面
