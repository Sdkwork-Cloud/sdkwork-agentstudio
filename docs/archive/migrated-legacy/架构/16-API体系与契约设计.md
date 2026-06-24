# 16-API体系与契约设计

## 1. 目标

API 体系必须同时解决五件事：对外发布、宿主管理、运行编排、实例治理、模型协议兼容。禁止把全部能力揉成单一 API 面。

## 2. API 分层总览

| 层级 | 基路径/入口 | 主要调用方 | 暴露级别 | 定位 |
| --- | --- | --- | --- | --- |
| Health API | `/claw/health/*` | 探针、安装验证、发布检查 | 可发布 | 存活与就绪 |
| Public / Studio API | `/claw/api/v1/*` | Shell、Hosted Browser、未来 SDK | 可发布 | 对外产品资源与实例治理 |
| OpenAPI API | `/claw/openapi/*` | SDK、文档、测试工具 | 可发布 | 契约发现与文档发布 |
| Internal API | `/claw/internal/v1/*` | Host Runtime、Kernel、Bridge | 内部 | 运行协调、会话与期望状态 |
| Manage API | `/claw/manage/v1/*` | Operator、Kernel Center、运维工具 | 受控发布 | 宿主管理、Rollout、OpenClaw Runtime/Gateway 投影 |
| Desktop Bridge API | `runtime/studio/kernel` 平台契约 | Web Host、Desktop Host、Feature Service | 本地 | UI 到宿主能力的统一桥 |
| OpenClaw Gateway API | `<instance-endpoint>/tools/invoke`、Gateway WebSocket | Chat、Instance Detail、Skill/Agent 管理 | 实例内/本地 | OpenClaw 运行态控制面 |
| Local Proxy API | `/health`、`/v1/*`、`/v1beta/*` | OpenClaw Runtime、路由测试、兼容客户端 | 本地 Loopback | 模型协议归一与上游适配 |
| Upstream Provider API | OpenAI/Anthropic/Gemini/Ollama 等供应商原生协议 | Local Proxy | 不直出给 UI | 上游供应商边界 |

## 3. 对外 API 设计

### 3.1 基线路径

- 原生 Host API 统一挂载在 `/claw/*`。
- 当前已落地五类族：`health`、`api`、`openapi`、`internal`、`manage`。
- `v1` 采用路径版本化；桌面与 `desktopCombined` 模式通过 `browserBaseUrl` 暴露托管 HTTP 面。

### 3.1.1 模式发布矩阵

- `desktopCombined`：发布 `health/api/openapi/internal/manage`，但不发布 `/claw/manage/v1/service*`；通过嵌入式 loopback host 暴露。
- `server`：发布完整 `health/api/openapi/internal/manage`；是 `docker/k8s` 的唯一 API 主体。
- `docker`：沿用 `server` 路由族与鉴权规则，只改变镜像、compose/profile、部署边界。
- `k8s`：沿用 `server` 路由族与鉴权规则，只改变 chart/ingress/secret/pvc 等交付与运维编排。

模式切换不得改变路由语义、资源模型、错误契约和鉴权语义；只允许改变暴露位置、启动 owner 与发布包装。

### 3.2 Studio 对外资源面

当前 UI 契约已消费以下 `/claw/api/v1/studio/*` 子资源：

- `/studio/instances`
- `/studio/instances/{id}`
- `/studio/instances/{id}:start|stop|restart`
- `/studio/instances/{id}/detail`
- `/studio/instances/{id}/config`
- `/studio/instances/{id}/logs`
- `/studio/instances/{id}/gateway/invoke`
- `/studio/instances/{id}/tasks`、`/tasks/{taskId}`、`:clone`、`:run`、`/executions`、`:status`
- `/studio/instances/{id}/files/{fileId}`
- `/studio/instances/{id}/llm-providers/{providerId}`
- `/studio/instances/{id}/conversations`
- `/studio/conversations/{conversationId}`

以上资源在 `desktopCombined/server/docker/k8s` 中必须保持同一语义；差异只能出现在 base URL、认证入口、部署拓扑。

### 3.3 对外 API 原则

- Public API 只暴露“产品资源”和“宿主可安全发布的治理资源”。
- 不向外直接发布供应商兼容路径，避免把宿主 API 与模型兼容 API 混在一起。
- 对外 API 先保证事实准确，再扩展广度；未实现能力不得伪装成已发布契约。

## 4. 管理 API 设计

当前 `Manage API` 已覆盖：

- `rollouts*`
- `host-endpoints`
- `openclaw/runtime`
- `openclaw/gateway`
- `openclaw/gateway/invoke`
- `service*`（仅 `server` 模式）

标准要求：

- 管理 API 面向 Operator，不承载终端聊天流量。
- 宿主生命周期、Rollout、托管 Runtime 投影必须走 Manage API。
- `/claw/manage/v1/service*` 仅允许 `server` 模式发布，桌面 `desktopCombined` 不发布该族。
- `docker/k8s` 不允许定义第二套 Manage API；它们直接复用 `server` 管理面。

## 5. 内部 API 设计

当前 `Internal API` 已覆盖：

- `host-platform`
- `node-sessions`
- `node-sessions:hello|admit|heartbeat|pull-desired-state|ack-desired-state|close`

标准要求：

- Internal API 只服务于运行时协调、租约、期望状态与平台状态同步。
- Feature 页面不允许直接拼接 Internal API；必须经 infrastructure service 转译。
- Internal API 可以支撑 Kernel/诊断视图，但不能成为业务页面的散装数据源。

## 6. OpenClaw Gateway API 设计

`OpenClaw Gateway API` 是实例级运行控制面，不是宿主对外发布面。当前 `openClawGatewayClient` 已覆盖的能力族包括：

- `health`
- `models.list`
- `channels.status/logout`
- `skills.status/bins/install/update`
- `tools.catalog`
- `agents.list/create/update/delete`
- `agents.files.list/get/set`
- `config.get/openFile/schema/schema.lookup/set/patch/apply`
- `cron.list/runs/remove/run/status`
- `doctor.memory.status/dreamDiary`
- `sessions.*`
- `chat.history/send/abort/inject`
- `tts.*`
- `wizard.*`
- `exec.approvals.*`
- `node.*`

标准要求：

- Instance Detail 的运行态工作台能力优先通过 Gateway 获取。
- OpenClaw 聊天优先走 Gateway WebSocket 会话链，HTTP 兼容流只作为非网关实例或兼容路由补充。
- Gateway API 不纳入当前 `/claw/*` OpenAPI 发布面，但必须有契约测试与升级回归。

## 7. Proxy API 设计

### 7.1 代理路径

当前 Local Proxy 已实现：

- `/health`
- `/v1/health`
- `/v1/models`
- `/v1/chat/completions`
- `/v1/responses`
- `/v1/embeddings`
- `/v1/messages`
- `/v1beta/models`
- `/v1beta/models/{model_action}`
- `/v1/models/{model_action}`

### 7.2 协议范围

- 客户端协议：`openai-compatible`、`anthropic`、`gemini`
- 上游协议：`openai-compatible`、`anthropic`、`gemini`、`ollama`、`azure-openai`、`openrouter`、`sdkwork`
- OpenClaw 托管 Provider 投影统一为 `sdkwork-local-proxy`

### 7.3 设计原则

- 对内置 OpenClaw，所有模型调用必须经 Local Proxy。
- `desktop/server/docker/k8s` 中凡存在托管 OpenClaw / Provider 投影，必须复用相同的 Proxy 路由、配置模型、默认路由语义与观测字段。
- Proxy 负责协议归一、模型映射、默认路由、审计、日志与消息捕获。
- Proxy 兼容 API 明确不属于 `/claw/*` 原生 OpenAPI 边界。
- 兼容路径优先保持上游协议行为稳定，诊断信息通过独立日志/观测面提供，不污染兼容响应。

## 8. 鉴权、错误与观测标准

### 8.1 鉴权

- `/claw/manage/v1/*` 支持基于 Basic Auth 的 Operator 认证。
- `/claw/internal/v1/*` 支持独立内部凭证，未单独配置时可回退到 Manage 凭证。
- Gateway 调用依赖实例级访问令牌与端点解析，不允许页面硬编码凭证。
- Local Proxy 默认走本地 Loopback 暴露，并使用本地代理 API Key 与路由密钥。

### 8.2 错误契约

- `/claw/*` 原生 API 统一返回机器可读错误体，并携带 `x-claw-correlation-id`。
- Gateway/Proxy 不强行套用 `/claw/*` 错误格式；前者保持实例控制语义，后者保持兼容协议语义。

### 8.3 可观测

- `/claw/*` 侧重请求追踪、宿主状态、Rollout 和运行态投影。
- Gateway 侧重实例方法调用、配置应用、任务执行与聊天事件。
- Proxy 侧重路由命中、模型调用、请求日志、消息捕获、默认路由健康。

## 9. 约束与演进规则

- Feature 包只能调用 package root 暴露的 service，不直接拼 `/claw/*`、`/tools/invoke` 或外部供应商 HTTP。
- UI、Kernel Center、Install、Settings 对模式的认知必须来自 `RuntimeStartupContext` 与 Host/Kernel 快照，禁止页面本地猜测“当前是 desktop/server/docker/k8s”。
- 新能力接入前必须先判定所属 API 面：对外资源、Operator 管理、运行协调、实例控制、模型兼容，五者不可混用。
- OpenClaw 升级必须回归校验 `Studio API + Gateway API + Local Proxy API` 三条主链。
- 任何新 API 若改变用户可见能力，必须同步更新第 `17` 章调用矩阵与验收标准。

## 10. 评估标准

| 评估项 | 合格线 | 领先线 | 当前判断 |
| --- | --- | --- | --- |
| API 分层清晰度 | 能区分 Public、Manage、Internal、Gateway、Proxy | 每个能力都有唯一主入口与发布边界 | `L4` |
| Studio API 完整度 | 实例与工作台主流程可闭环 | 形成稳定外部契约并可驱动 Hosted Browser | `L4` |
| Gateway 运行控制力 | 覆盖实例核心运行能力 | 覆盖聊天、配置、任务、节点、审批等完整运行面 | `L4` |
| Proxy 协议覆盖 | OpenClaw 主要模型能力统一走代理 | 多协议、全观测、可测试、可投影 | `L4` |
| 多模式 API 一致性 | 同一能力在不同模式走同一路由语义 | 模式变化不生成第二套 API | `L4` |
| 鉴权与错误治理 | 关键面有认证与错误体 | 全面追踪、最小暴露、升级不破契约 | `L3.5` |

## 11. 结论

当前 API 体系已经具备清晰骨架，下一阶段重点不是新增更多入口，而是持续压实“对外资源面、管理面、内部协调面、实例运行面、兼容面”五类边界，确保任何能力只走一条主链。

## 12. 2026-04-07 Hosted Browser 契约补充

- Hosted Browser Bridge 只改变 API 暴露位置，不改写 runtime 平台语义；前端读取 `runtime.getRuntimeInfo()` 时必须看到真实 `platform/distributionFamily/deploymentFamily`。
- 浏览器承载信息只通过 `startup.hostedBrowser` 与 `startup.browserBaseUrl` 表达，禁止再把 `platform=web` 当作托管 `server/desktopCombined` 模式判据。
- `docker/k8s` 继续沿用 `server` 路由族、Manage/Internal/Public API 语义；差异仅体现在 `deploymentFamily`、打包与运维编排。
- 业务层若只需要判断“是否可启用桌面能力”，可使用 `platform.getPlatform()`；但桥接层判断“是否已有原生桌面 authority” 时，必须同时检查原生能力标记，不能把 hosted `desktopCombined` 误当成 native desktop。
