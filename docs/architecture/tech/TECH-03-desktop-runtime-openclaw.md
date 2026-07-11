> Migrated from `docs/step/03-Desktop Runtime与内置OpenClaw工程化.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 - Desktop Runtime 与内置 OpenClaw 工程化

## 1. Step Card

| 项 | 内容 |
| --- | --- |
| 执行模式 | 强串行 |
| 前置 | `02` |
| 主写入范围 | `packages/sdkwork-agentstudio-pc-desktop/src-tauri` `packages/sdkwork-agentstudio-pc-desktop/src/desktop` `config/kernel-releases/openclaw.json` `scripts/prepare-openclaw-runtime.mjs` `scripts/sync-bundled-components.mjs` `scripts/openclaw-release.mjs` |
| 执行输入 | `02`、`03`、`10`、`12` 架构文档；现有 OpenClaw 版本源、manifest、Runtime 脚本 |
| 本步非目标 | 不做业务 UI 大改；不扩展外部供应商直连逻辑 |
| 最小输出 | 稳定启动链、单一版本源、可升级可回滚的 Runtime 工程链 |

## 2. 设计

- 固化启动顺序：`configure_openclaw_gateway -> ensure_local_ai_proxy_ready -> project_managed_openclaw_provider`。
- OpenClaw、Gateway、Local Proxy、Kernel 是四个独立生命周期面，不允许继续混写成单体服务文件。
- `src-tauri/src/plugins/mod.rs` 只负责宿主插件注册，不承载 OpenClaw 业务生命周期或配置投影逻辑。
- 升级必须以 `config/kernel-releases/openclaw.json` 为单一版本源，以 manifest 与 readiness/verify 脚本为证据。

## 3. 实施落地规划

1. 拆分桌面 Runtime 热点：
   `local_ai_proxy.rs`、`studio.rs`、`openclaw_mirror_import.rs`、`openclaw_runtime.rs`。
2. 固化 Bundled Components、manifest、runtime home、config path、startup evidence 的结构化输出。
3. 固化 Upgrade 流程：`readiness -> prepare -> sync -> target clean -> verify -> smoke`。
4. 让 `Kernel Center` 与桌面证据面共享同一套 Runtime 快照来源。
5. 为后续 API/Provider/Chat/Release 提供稳定桌面基础。

## 4. 测试计划

- `pnpm.cmd check:desktop-openclaw-runtime`
- `pnpm.cmd check:desktop`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `node scripts/openclaw-release-contract.test.mjs`

## 5. 结果验证

- 桌面启动后可稳定看到 OpenClaw 版本、Gateway、Proxy、Kernel 状态。
- 升级前后 manifest、runtime 目录、默认组件、Proxy 投影一致。
- 失败时能定位到 readiness、prepare、sync、verify 中的具体阶段。

## 6. 检查点

- `CP03-1`：单一版本源与 manifest 规则冻结。
- `CP03-2`：启动链和生命周期拆分完成。
- `CP03-3`：升级/验证/回滚链完成。
- `CP03-4`：桌面证据面与 Kernel Center 口径一致。

### 6.1 推荐并行车道

- `03-A`：Runtime/manifest/版本源
- `03-B`：Gateway/Proxy 生命周期
- `03-C`：升级与发布前验证脚本
- 收口要求：最终启动顺序和版本源只允许一个 owner 定义

### 6.2 完成后必须回写的架构文档

- `docs/架构/02-架构标准与总体设计.md`
- `docs/架构/10-性能、可靠性与可观测性设计.md`
- `docs/架构/12-安装、部署、发布与商业化交付标准.md`

### 6.3 推荐 review 产物

- `docs/review/step-03-执行卡-YYYY-MM-DD.md`
- `docs/review/step-03-runtime启动链决议-YYYY-MM-DD.md`
- `docs/review/step-03-openclaw升级与回滚-YYYY-MM-DD.md`

### 6.4 架构能力闭环判定

- 内置 OpenClaw、Gateway、Local Proxy、Manifest、Upgrade smoke 已形成单一版本源和可回滚工程链。
- `local_ai_proxy.rs` 的代理就绪链与 `plugins/mod.rs` 的宿主插件注册边界都已稳定，不再混写业务逻辑。
- 若仍无法证明“模型访问统一经本地代理”或升级后工作台/聊天可用，本 step 不算闭环。

### 6.5 快速完整执行建议

- 第一步先冻结版本源、manifest 和启动顺序；第二步再并行拆 Runtime 生命周期、升级脚本、证据面。
- 在 `pnpm.cmd check:desktop-openclaw-runtime` 通过前，不放开 Provider/API 层改造。

## 7. 风险与回滚

- 风险：Runtime 热点不拆，后续 Provider/API/Release 改造会持续打架。
- 回滚：保留稳定 manifest 与旧启动入口 facade，逐步切换内部实现。

## 8. 完成定义

- Runtime 主链、证据链、升级链、回滚链全部可解释、可测试、可验证。

## 9. 下一步准入条件

- Step 04 能在稳定桌面 Runtime 上统一 API 与平台桥契约。

