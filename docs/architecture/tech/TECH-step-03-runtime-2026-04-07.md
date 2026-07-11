> Migrated from `docs/review/step-03-runtime启动链决议-2026-04-07.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 Runtime 启动链决议 - 2026-04-07

## 1. 决议

1. OpenClaw 标准启动顺序冻结为：`configureOpenClawGateway -> ensureLocalAiProxyReady -> projectManagedOpenClawProvider`。
2. OpenClaw 运行时专用事实源冻结为 Kernel `openClawRuntime`；其优先级高于旧 `provenance` 和路径启发式。
3. `desktop/server/docker/k8s` 共用同一套 Host Runtime Contract；模式差异只体现在 `hostMode/distributionFamily/deploymentFamily/acceleratorProfile`、启动 owner 与交付 profile。
4. Install / Settings / Kernel Center 等消费方必须优先回读 Host/Kernel 快照，不得各自猜测 OpenClaw home、config、endpoint。

## 2. 已落地证据

- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs`
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/commands/desktop_kernel.rs`
- `packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.ts`
- `packages/removed-install-feature/src/services/openClawBootstrapService.ts`

## 3. 后续硬约束

- 新增模式不得复制一套新的 Runtime/Proxy/Provider 状态模型。
- API、观测、发布、升级若涉及 OpenClaw，都必须说明它依赖的是 `RuntimeStartupContext`、`openClawRuntime` 还是两者组合。
- 未提供事实源证据的“模式特例”一律视为架构漂移。

