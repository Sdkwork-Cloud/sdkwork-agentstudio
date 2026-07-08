# Step 03 Install Bootstrap 目录降级与内核真相源收口 - 2026-04-08

## 1. 本轮目标

- 让 guided install 的 OpenClaw bootstrap 在 assessment 路径漂移时，继续优先采用 Kernel `openClawRuntime.homeDir` 作为配置定位事实源。
- 让 ClawHub package / skill 目录从“阻断主链的硬依赖”降级为“可选增强面”，避免 node-safe 合约测试、离线或未登录场景把 bootstrap 主链拖死。

## 2. 代码落地

- `packages/removed-install-feature/src/services/openClawBootstrapService.ts`
  - `loadBootstrapData()` 现在在进入配置定位前先读取 `kernelPlatformService.getInfo()`，把 `openClawRuntime.homeDir` 显式注入 `resolveConfigPath()`。
  - 新增 `resolveClawHubCatalogService()` 与 `loadClawHubCatalogSnapshot()`，按需读取 `clawHubService`；当当前运行面只暴露 Node-safe root 入口或目录服务失败时，回退为空目录而不阻断 bootstrap 主链。
  - `resolveSelectedSkills()` 与 `loadBootstrapData()` 统一改用目录快照读取，避免对 `clawHubService` 的静态根导入。

## 3. OpenClaw 对齐事实源

- `packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs`
  - `OPENCLAW_LOCAL_PROXY_PROVIDER_ID` 固定为 `sdkwork-local-proxy`。
  - `project_managed_openclaw_provider()` 与 `write_managed_provider_runtime_config()` 继续把托管 Provider 投影写回 `openclaw.json` 与默认模型参数，这是 bootstrap 应优先保护的主链真相源。
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkspacePresentation.ts`
  - `buildOpenClawProviderWorkspaceState()` 在 provider-center-managed 的 OpenClaw 实例上保持只读治理语义，说明 install/bootstrap 侧必须稳定投影 Provider，而不是依赖临时页面状态兜底。
- `packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.ts`
  - `WebStudioPlatform` 仍通过 `listInstances()`、`getInstanceDetail()` 与本地会话/工作台持久化承接 Studio 侧事实面，说明 bootstrap 应优先确保同步实例与配置链可读回。
- `packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs`
  - 桌面插件注册仍保持纯宿主边界，说明这轮目录降级不应被塞回插件启动链，而应留在 install/bootstrap 聚合层处理。

## 4. 验证证据

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `node --experimental-strip-types scripts/sdkwork-core-contract.test.ts` | 通过 | `@sdkwork/clawstudio-core` 继续保持 Node-safe root 入口，不需要为 install bootstrap 放宽核心包边界。 |
| `node --experimental-strip-types packages/removed-install-feature/src/services/openClawBootstrapService.test.ts` | 通过 | 验证 bootstrap 能优先采用 Kernel `openClawRuntime.homeDir`，并且在目录服务不可用时继续完成主链。 |
| `pnpm.cmd check:sdkwork-install` | 通过 | guided install package root 与 install-local 聚合契约保持一致。 |
| `pnpm.cmd check:desktop-openclaw-runtime` | 通过 | readiness、runtime 准备与桌面发布资产校验链保持通过，证明本轮变更没有破坏 Step 03 既有 OpenClaw 交付基线。 |
| `cargo test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml --target-dir target/step03-proof desktop_kernel_info_exposes_extended_runtime_directories` | 通过 | 桌面 Kernel 仍能稳定输出 `openClawRuntime` 目录与快照事实，Install Bootstrap 对该真相源的消费链具备 Rust 侧证据。 |

## 5. 架构回写

- 已更新 `docs/架构/12-安装、部署、发布与商业化交付标准.md`
  - 明确 Install Bootstrap 必须先以 Kernel `openClawRuntime.homeDir` 为配置定位事实源。
  - 明确 ClawHub package / skill 目录属于增强面，缺失时允许回退为空列表，不得阻断 `openclaw.json`、托管 Provider 投影与同步实例主链。

## 6. 结论

- 这轮把 Step 03 的 Install Bootstrap 从“依赖可选目录服务才能完成”推进为“先保配置与投影主链，再补目录增强面”的更稳结构。
- `CP03-4` 继续推进，但 Step 03 仍未闭环；升级/回滚执行证据、Runtime 热点拆分与多模式 smoke 仍待后续补齐。
