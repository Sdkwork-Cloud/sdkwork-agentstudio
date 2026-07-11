> Migrated from `docs/zh-CN/reference/api-reference.md` on 2026-06-24.
> Owner: SDKWork maintainers

# API 总览

## 范围

本页是当前 Agent Studio 内置宿主对外 HTTP 接口的入口说明。

当前宿主已经统一为一个外部 base URL，并把接口明确分成三类命名空间：

- `/claw/*` 下的原生平台接口
- `/health`、`/v1/*`、`/v1beta/*` 的 root-native 本地 AI 兼容接口
- `/claw/gateway/openclaw/*` 下的受治理 OpenClaw 网关代理接口

静态资源、`/` 与 `/sdkwork-agentstudio-pc-bootstrap.json` 仍然由同一个宿主提供，但它们不属于 OpenAPI 管理范围。

## 统一宿主路由分层

| 接口面 | 基础路径 | 作用 |
| --- | --- | --- |
| 原生平台 | `/claw/*` | 平台自有的 health、public API、OpenAPI、internal、manage 路由 |
| 本地 AI 兼容 | `/health`、`/v1/*`、`/v1beta/*` | 与上游协议保持一致的本地代理接口 |
| OpenClaw 网关代理 | `/claw/gateway/openclaw/*` | 受治理的 OpenClaw gateway 代理接口 |

规则：

- `/claw/*` 继续保留给平台原生 API。
- `local-ai-proxy` 保持 root-native 兼容路径，不存在 `/claw/gateway/local-ai/*` 别名。
- OpenClaw 代理接口统一放在 `/claw/gateway/openclaw/*`，不会去抢占 `/v1/*`。
- OpenAPI 文档由当前真实挂载的路由集合实时生成，因此可选接口面只会在对应运行时能力激活时出现。

## 按运行模式理解 Base URL

统一 HTTP 宿主只在存在 Rust Host 时可用。

| 模式 | 访问方式 | Base URL |
| --- | --- | --- |
| Web 工作区 | preview bridge 或 mock bridge | 不提供正式内置宿主 |
| 桌面端运行时 | 嵌入式 loopback host | 从运行时 `browserBaseUrl` 解析，通常是 `http://127.0.0.1:<dynamic-port>` |
| 原生 Server | 同源宿主 | `http://<host>:<port>` |
| Container | 通过暴露端口访问同源宿主 | `http://<host>:<port>` 或 ingress 地址 |
| Kubernetes | 通过 service 或 ingress 访问同源宿主 | `https://<domain>` 或 service 地址 |

当前打包后的本地 server 默认地址仍然是 `http://127.0.0.1:18797`，除非通过 `CLAW_SERVER_HOST` 或 `CLAW_SERVER_PORT` 覆盖。

## Discovery 与 OpenAPI 文档

当前内置宿主会发布一套 public discovery 和一套实时 OpenAPI discovery。

| 接口 | 作用 |
| --- | --- |
| `GET /claw/api/v1/discovery` | 对外公开的原生发现接口 |
| `GET /claw/openapi/discovery` | 实时 OpenAPI 文档发现接口 |
| `GET /claw/openapi/v1.json` | 原生平台 OpenAPI 3.1 文档 |
| `GET /claw/openapi/local-ai-compat-v1.json` | 本地 AI 兼容 OpenAPI 3.1 文档，仅在 local-ai-proxy 激活时存在 |
| `GET /claw/openapi/openclaw-gateway-v1.json` | OpenClaw gateway 代理 OpenAPI 3.1 文档，仅在受管网关 HTTP 能力激活时存在 |

`GET /claw/openapi/discovery` 当前返回：

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

## 当前接口矩阵

### 原生平台

#### Health

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/claw/health/live` | 存活探针 |
| `GET` | `/claw/health/ready` | 就绪探针 |

#### Public API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/claw/api/v1/discovery` | 对外公开的原生发现与引导信息 |
| `GET` | `/claw/api/v1/studio/instances` | 查看规范化 studio 实例列表 |
| `POST` | `/claw/api/v1/studio/instances` | 创建一个 studio 实例 |
| `GET` | `/claw/api/v1/studio/instances/{id}` | 查看单个 studio 实例 |
| `PUT` | `/claw/api/v1/studio/instances/{id}` | 更新单个 studio 实例 |
| `DELETE` | `/claw/api/v1/studio/instances/{id}` | 删除单个 studio 实例 |
| `POST` | `/claw/api/v1/studio/instances/{id}:start` | 启动实例 |
| `POST` | `/claw/api/v1/studio/instances/{id}:stop` | 停止实例 |
| `POST` | `/claw/api/v1/studio/instances/{id}:restart` | 重启实例 |
| `GET` | `/claw/api/v1/studio/instances/{id}/detail` | 查看实例 detail 投影 |
| `GET` | `/claw/api/v1/studio/instances/{id}/config` | 读取实例配置 |
| `PUT` | `/claw/api/v1/studio/instances/{id}/config` | 更新实例配置 |
| `GET` | `/claw/api/v1/studio/instances/{id}/logs` | 读取实例日志投影 |
| `GET` | `/claw/api/v1/studio/instances/{id}/conversations` | 查看实例会话列表 |
| `PUT` | `/claw/api/v1/studio/conversations/{conversationId}` | 写入或更新单个会话 |
| `DELETE` | `/claw/api/v1/studio/conversations/{conversationId}` | 删除单个会话 |

#### OpenAPI

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/claw/openapi/discovery` | 查看实时 OpenAPI 文档集合 |
| `GET` | `/claw/openapi/v1.json` | 下载原生平台 OpenAPI 3.1 文档 |
| `GET` | `/claw/openapi/local-ai-compat-v1.json` | 在 local-ai-proxy 激活时下载兼容接口文档 |
| `GET` | `/claw/openapi/openclaw-gateway-v1.json` | 在 OpenClaw 网关激活时下载代理接口文档 |

#### Internal

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/claw/internal/v1/host-platform` | 读取宿主状态、能力和 state-store 投影 |
| `GET` | `/claw/internal/v1/node-sessions` | 查看 live 与 projected node-session 列表 |
| `POST` | `/claw/internal/v1/node-sessions:hello` | 注册节点运行时并获取 lease proposal |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:admit` | 正式接纳一个 hello 创建的 session |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:heartbeat` | 刷新 lease 并获取 posture hint |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:pull-desired-state` | 拉取当前 desired state |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:ack-desired-state` | 回写 desired state 的应用结果 |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:close` | 优雅关闭 live session |

#### Manage

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/claw/manage/v1/rollouts` | 查看 rollout 列表 |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}` | 查看单个 rollout |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/targets` | 查看 preview 推导出的 target 列表 |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}` | 查看单个 target |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/waves` | 查看 preview 推导出的 wave 摘要 |
| `POST` | `/claw/manage/v1/rollouts/{rolloutId}:preview` | 计算或刷新 rollout preview |
| `POST` | `/claw/manage/v1/rollouts/{rolloutId}:start` | 在 preview 成功后启动 rollout |
| `GET` | `/claw/manage/v1/host-endpoints` | 查看规范化 host endpoint 列表 |
| `GET` | `/claw/manage/v1/openclaw/runtime` | 查看受管 OpenClaw runtime 投影 |
| `GET` | `/claw/manage/v1/openclaw/gateway` | 查看受管 OpenClaw gateway 投影 |
| `POST` | `/claw/manage/v1/openclaw/gateway/invoke` | 通过控制面调用受管 OpenClaw gateway |
| `GET` | `/claw/manage/v1/service` | 查看原生服务状态，仅 `server` 模式提供 |
| `POST` | `/claw/manage/v1/service:install` | 安装原生服务，仅 `server` 模式提供 |
| `POST` | `/claw/manage/v1/service:start` | 启动原生服务，仅 `server` 模式提供 |
| `POST` | `/claw/manage/v1/service:stop` | 停止原生服务，仅 `server` 模式提供 |
| `POST` | `/claw/manage/v1/service:restart` | 重启原生服务，仅 `server` 模式提供 |

重要模式说明：

- `desktopCombined` 会通过嵌入式 loopback host 发布相同的 `api`、`openapi`、`internal` 和非 service 的 `manage` 流程。
- `/claw/manage/v1/service*` 仍然只在 `server` 模式下存在。

### 本地 AI 兼容接口

这些路径只会在 `local-ai-proxy` 激活时挂到同一个宿主端口上。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` | `/health` | root health 探针 |
| `GET` | `/v1/health` | OpenAI 风格健康探针 |
| `GET` | `/v1/models` | 查看兼容模型列表 |
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat completions |
| `POST` | `/v1/responses` | OpenAI-compatible responses |
| `POST` | `/v1/embeddings` | OpenAI-compatible embeddings |
| `POST` | `/v1/messages` | Anthropic-compatible messages |
| `GET` | `/v1beta/models` | Gemini-compatible model discovery |
| `POST` | `/v1beta/models/{modelAction}` | Gemini-compatible model action |
| `POST` | `/v1/models/{modelAction}` | Gemini-compatible model action |

兼容性说明：

- 调用方只需要替换 `baseURL` 和 `apiKey`
- 路径前面不会再增加额外宿主前缀
- 宿主会保留 method、body、query string、content type 以及上游所需的请求头

### 受治理 OpenClaw Gateway 代理

这些路径只会在受管 OpenClaw gateway HTTP 能力激活时挂载。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `POST` | `/claw/gateway/openclaw/tools/invoke` | 调用受治理 OpenClaw gateway 代理接口 |

治理说明：

- 它与 `POST /claw/manage/v1/openclaw/gateway/invoke` 控制面接口不是一回事
- 宿主会先去掉外层治理前缀，再转发到上游网关
- `/v1/*` 这种 root-native 兼容路径仍然只属于 `local-ai-proxy`

## 鉴权与代理行为

原生控制面当前仍然是可选 Basic Auth。

| 接口面 | 默认状态 | 可选凭据 |
| --- | --- | --- |
| 浏览器壳 | 默认开放 | `CLAW_SERVER_MANAGE_USERNAME` / `CLAW_SERVER_MANAGE_PASSWORD` |
| `/claw/manage/v1/*` | 默认开放 | `CLAW_SERVER_MANAGE_USERNAME` / `CLAW_SERVER_MANAGE_PASSWORD` |
| `/claw/internal/v1/*` | 默认开放 | `CLAW_SERVER_INTERNAL_USERNAME` / `CLAW_SERVER_INTERNAL_PASSWORD` |

当前行为：

- `internal` 未单独配置凭据时，会回退复用 `manage` 凭据
- 当 `manage` 配置了凭据后，浏览器壳和静态资源会共享相同的 Basic Auth challenge
- 本地 AI 兼容接口会保留 provider-facing 鉴权头，确保上游兼容客户端仍然使用原本的请求形状
- 受治理 OpenClaw gateway 代理会使用宿主管理的上游凭据，而不是把调用方传入的 bearer token 原样转发给受管网关

## 快速示例

先设置本地基础地址：

```bash
export CLAW_BASE_URL=http://127.0.0.1:18797
```

读取 readiness：

```bash
curl -i "$CLAW_BASE_URL/claw/health/ready"
```

读取 OpenAPI discovery：

```bash
curl "$CLAW_BASE_URL/claw/openapi/discovery"
```

通过同一个端口读取本地 AI 模型列表：

```bash
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  "$CLAW_BASE_URL/v1/models"
```

通过同一个端口调用受治理 OpenClaw gateway：

```bash
curl -H "Content-Type: application/json" \
  -X POST \
  -d '{"tool":"ping"}' \
  "$CLAW_BASE_URL/claw/gateway/openclaw/tools/invoke"
```

## 示例响应

原生 public discovery 示例：

```json
{
  "family": "api",
  "version": "v1",
  "basePath": "/claw/api/v1",
  "hostMode": "server",
  "hostVersion": "0.1.0",
  "openapiDocumentUrl": "/claw/openapi/v1.json",
  "healthLiveUrl": "/claw/health/live",
  "healthReadyUrl": "/claw/health/ready",
  "capabilityKeys": ["api.discovery.read"],
  "generatedAt": 1743600000000
}
```

OpenAPI discovery 示例：

```json
{
  "family": "openapi",
  "hostMode": "server",
  "generatedAt": 1743600000000,
  "documents": [
    {
      "id": "claw-native-v1",
      "title": "Claw Native Platform API",
      "version": "v1",
      "format": "openapi+json",
      "url": "/claw/openapi/v1.json",
      "apiFamilies": ["health", "api", "internal", "manage"],
      "proxyTarget": "native-host",
      "runtimeCapability": "always",
      "generatedAt": 1743600000000
    }
  ]
}
```

错误包络示例：

```json
{
  "error": {
    "code": "rollout_not_found",
    "category": "state",
    "message": "The requested rollout was not found.",
    "httpStatus": 404,
    "retryable": false,
    "resolution": "fix_request",
    "correlationId": "claw-1234567890"
  }
}
```

排查问题时，应优先记录 `x-claw-correlation-id` 响应头，它是浏览器诊断、日志对齐和运维支持的主请求追踪 id。

## OpenAPI 所有权边界

当前内置宿主会发布多份实时 OpenAPI 文档：

- `claw-native-v1` 对应 `/claw/*` 原生平台接口
- `local-ai-compat-v1` 对应 root-native 兼容路径
- `openclaw-gateway-v1` 对应 `/claw/gateway/openclaw/*`

边界规则：

- 同一个已发布路径不会同时出现在多份实时文档里
- 可选文档只会在对应运行时能力激活时出现在 discovery 中
- 所有文档都使用 `openapi: 3.1.0`
- 生成的 schema 文件属于运行时产物，不会提交到仓库

运行时 schema 快照和启动 catalog 输出，参见 [Claw Server Runtime](/zh-CN/reference/agentstudio-server-runtime)。

