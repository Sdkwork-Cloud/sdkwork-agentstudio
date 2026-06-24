> Migrated from `docs/review/step-03-openclaw升级与回滚-2026-04-07.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 OpenClaw 升级与回滚 - 2026-04-07

## 1. 升级标准

- 单一版本源：`config/openclaw-release.json`
- 单一元数据：runtime `manifest` + release metadata
- 单一主链：`readiness -> prepare -> sync -> target clean -> verify -> smoke`
- 单一回读面：Host Runtime Contract + Kernel `openClawRuntime` + release reports

## 2. 多模式统一要求

- `desktop` 负责内置 Runtime 打包与首启。
- `server/container/k8s` 复用同一 Host Core、同一 API 面、同一 release metadata；`container/k8s` 只是交付封装。
- 只要启用托管 OpenClaw，模型访问都必须继续经 Local Proxy 契约，不允许模式分叉。

## 3. 本轮收口

- Kernel 已输出专用 `openClawRuntime` 快照，可回读版本、目录、启动链与 Provider 投影。
- Kernel Center 已改为优先使用该快照展示 provenance。
- Install Bootstrap 已改为优先使用该快照定位 `openclaw.json`。

## 4. 仍需补齐

- 真实 desktop packaged launch 证据
- 真实 container 启动证据
- 真实 k8s 就绪证据
- 升级失败后的 repair / rollback 执行级报告

