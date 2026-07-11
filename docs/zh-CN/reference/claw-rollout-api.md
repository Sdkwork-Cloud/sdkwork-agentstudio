# Claw Rollout API

## 目的

本文记录当前 Agent Studio 已经实现的 rollout control plane 接口面，它在桌面端 combined mode、平台桥接层和 Server 模式之间共享同一套逻辑契约。

## 当前接口

- `GET /claw/manage/v1/rollouts`
- `GET /claw/manage/v1/rollouts/{rolloutId}`
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets`
- `GET /claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}`
- `GET /claw/manage/v1/rollouts/{rolloutId}/waves`
- `POST /claw/manage/v1/rollouts/{rolloutId}:preview`
- `POST /claw/manage/v1/rollouts/{rolloutId}:start`

## 关键行为

- `list` 返回当前持久化 rollout 列表
- `targets` 返回 preview 推导出的 target 视图
- `waves` 返回按 `waveId` 聚合后的 wave 摘要
- `preview` 负责预演 rollout 并返回当前计算结果
- `start` 负责在已有 preview 基础上推进 rollout

## 桌面端与服务端对齐

桌面端 combined mode 不直接走独立 Server HTTP 壳，但会通过 Tauri command 暴露同一套逻辑接口。Server 模式则通过同源 `/claw/manage/v1/*` 对外提供相同能力。

## 当前边界

当前已经实现：

- rollout 列表、详情、targets、waves、preview、start
- 与 internal host-platform / node-session 的联动读取
- preview 推导出的 target 与 wave 读模型
- host-platform `stateStore` 投影中的 `projectionMode` 语义，用于明确标识 runtime-backed 条目与 metadata-only 条目

当前仍然延后：

- approval、pause、resume、retry、rollback 等后续动作
- 更细粒度的 wave item 操作
- 对外公开的 `/claw/api/v1/*` rollout 资源面
