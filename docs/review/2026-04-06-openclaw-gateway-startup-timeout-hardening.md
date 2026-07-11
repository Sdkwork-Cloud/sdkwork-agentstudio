# 2026-04-06 OpenClaw Gateway Startup Timeout Hardening

## 背景

桌面宿主在启动 bundled OpenClaw 时，持续报出如下错误：

- `failed to start bundled openclaw gateway: timeout: openclaw gateway did not become invoke-ready on 127.0.0.1:18871 within 30000ms`

同一时间段的真实日志显示 gateway 其实已经成功监听：

- `openclaw-gateway.log` 记录 `gateway listening on ws://127.0.0.1:18871`
- 随后继续记录 `hooks loaded 4 internal hook handlers`

这说明根因不是“进程没起来”，而是“宿主 readiness 判定与真实 upstream gateway ready 语义不一致”。

## 已确认问题

1. 宿主只把 HTTP `POST /tools/invoke` 视为 ready 信号，但 upstream `gateway health` 走的是 WebSocket RPC，才是更接近真实控制面的权威探针。
2. runtime 安装 finalize 失败时，`openclaw_runtime.rs` 之前会吞掉 `remove_dir_all` / `rename` 错误，然后继续从 `.staging-*` 目录激活，并错误写入 `active.json` 的正式版本。
3. managed config 的 `meta.lastTouchedVersion` 没有随着 bundled manifest 同步，导致用户环境里长期残留旧版本元数据，例如 `2026.3.13`。

## 本次落地修复

### 1. Gateway readiness 改为双通道判定

文件：

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/supervisor.rs`

改动：

- 保留现有 HTTP `/tools/invoke` fast path。
- 新增 `gateway health --json` 子进程探针，作为 authority-aligned readiness fallback。
- 启动等待与运行期健康检查统一复用新的 ready 判定。
- timeout / unhealthy 报错会附带最后一次探针细节，而不是只给出空泛的 `invoke-ready timeout`。

效果：

- 真实 gateway 只要 WebSocket control plane 已可用，即使 `/tools/invoke` 兼容面不可用，也不会被宿主误判为启动失败。

### 2. 禁止 staging 假激活

文件：

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

改动：

- `ensure_runtime_installation_from_directory`
- `ensure_runtime_installation_from_archive`
- `resolve_launch_runtime_install_dir`

现在：

- install root 删除失败会直接报错，不再静默成功。
- staging 重命名失败会直接报错，不再继续从 staging 目录伪装成正式安装。
- 只有正式 install root 完整落地后，才允许进入 activation 并写入 active runtime version。

效果：

- 防止 `active.json` 指向 `2026.4.2-windows-x64`，但磁盘上实际只有 `.staging-*` 目录的状态撕裂。

### 3. managed config 版本元数据对齐 bundled manifest

文件：

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

改动：

- activation 写 managed config 时，同时写入：
  - `meta.lastTouchedVersion = bundled manifest.openclawVersion`
  - `meta.lastTouchedAt = 当前 UTC RFC3339 时间`

效果：

- 用户环境里的 managed config 不会继续停留在旧 bundled release 元数据。

## 新增与更新测试

已覆盖：

- `wait_for_gateway_ready_accepts_gateway_health_when_http_tools_invoke_is_unavailable`
- `activation_fails_when_a_blocking_non_directory_already_exists_at_the_final_install_root`
- `installs_bundled_runtime_into_managed_directory_and_activates_it`

同时复跑通过：

- `framework::services::supervisor::tests::`
- `framework::services::openclaw_runtime::tests::`
- `bundled_openclaw_activation_`
- `ensure_desktop_kernel_running`

## 后续建议

1. 在桌面 dev / release 启动路径增加一条结构化日志，直接输出：
   - 当前使用的 ready probe
   - 最后一次 invoke probe 结果
   - 最后一次 gateway health probe 结果
2. 对 Windows `os error 5` / `EPERM` 增加更细粒度路径日志，明确是：
   - 删除旧 install root 失败
   - staging rename 失败
   - managed config 重写失败
3. 给 release smoke 增加安装后冷启动断言：
   - 不允许再次解压 bundled runtime
   - 不允许 active runtime 指向不存在的正式 install root
   - 不允许 managed config 版本元数据落后于 bundled manifest
