> Migrated from `docs/review/2026-04-06-system-review-findings.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Agent Studio System Review Findings

## Scope

本轮 review 面向以下目标做一次统一审计：

- `desktop`、`server`、`docker`、`k8s` 共用 Rust 宿主内核的落地质量
- OpenClaw 内置集成、安装期预热、启动期复用、代理路由、会话/实例/配置链路
- 性能、功能正确性、安全、可运维性、可扩展性、组件边界与高可用风险

本次结论同时参考了现有审计文档：

- `docs/reports/2026-04-04-openclaw-installer-and-runtime-report.md`
- `docs/reports/2026-04-05-unified-deployment-architecture-current-review.md`
- `docs/reports/2026-04-05-unified-rust-host-kernel-review-continuation.md`
- `docs/reports/2026-04-05-chat-openclaw-regression-report.md`

## Current Baseline

当前源码已经具备一些关键改进，不应再被当作“未修复”问题重复处理：

- 安装期 OpenClaw 预热、跨平台打包资源、Linux postinstall、macOS staged install-root 已有实现和契约校验。
- 桌面嵌入式 host 已支持 `browserSessionToken`，并且服务端已有 loopback CORS 中间件。
- 本地 AI 代理 Rust 侧已经覆盖 `prompt_tokens`、`completion_tokens`、`total_tokens`、`cache_tokens` 的提取与持久化单测。
- instances config workbench 的 i18n 结构性损坏已经被修复，并增加了契约检查。

## Verified Evidence

本轮新增复核到的直接证据：

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
  - 通过
- `cargo test desktop_combined_hosted_startup_preflight_allows_browser_session_header_for_critical_routes --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml`
  - 通过
- `cargo test desktop_combined_hosted_startup_requests_include_cors_headers_on_successful_responses --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml`
  - 通过
- `node scripts/desktop-hosted-runtime-regression-contract.test.mjs`
  - 初始失败，证明 `check:desktop` 之前并未强制执行桌面 hosted runtime 相关回归

## Findings

### P0: 运行时症状与源码基线仍可能漂移，当前缺少“源码 -> 构建产物 -> 安装产物 -> 首启行为”的闭环证据

现象：

- 用户仍报告 `CORS`、`resolveHostedBasePath`、`browserBaseUrl unavailable`、OpenClaw 503、WebSocket refused 等问题。
- 但当前源码里：
  - `packages/sdkwork-agentstudio-pc-server/src-host/src/http/router.rs` 已带 `host_control_plane_cors`
  - `packages/sdkwork-agentstudio-pc-server/src-host/src/main.rs` 已有桌面 browser-session CORS 预检与响应测试
  - `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts` 已有 hosted runtime descriptor、session token、base path 逻辑

判断：

- 这些用户侧报错不能再简单归因为“源码没写”。
- 更大概率是旧安装包、旧桌面产物、旧运行目录、旧数据库/日志数据、或桌面与 Rust 产物不一致导致的运行时漂移。

影响：

- 会导致团队反复修改错误位置，修复效率低。
- 发布后仍可能出现“源码已修复，用户机器仍复现”的假阴性。

建议：

- 引入更强的安装后/首启后 smoke 证据，至少保留构建指纹、资源 manifest、host runtime snapshot、OpenClaw runtime snapshot。
- 把“首启 host 就绪 + built-in instance 可用 + gateway websocket 可连接”纳入发布闭环。

### P1: 桌面 hosted runtime 关键回归测试已经存在，但此前没有纳入 `check:desktop`

现象：

- 以下关键回归原本存在，却未进入强制桌面验证链路：
  - `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
  - `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
  - `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`

影响：

- 桌面 hosted runtime 的 base path、session token、bootstrap readiness 变更可以悄悄回归，而 `check:desktop` 不会报警。
- 这直接削弱了桌面宿主统一架构的可信度。

结论：

- 这是本轮最适合立即落地修复的问题，因为改动小、收益高、风险低。

### P1: 统一 Rust 宿主内核仍然存在“运行时激活层双轨制”

现象：

- OpenClaw 专用运行时准备路径与 `generated/bundled` 泛化组件同步路径仍同时存在。
- 已有报告已把打包资源根统一到 `generated/release/openclaw-resource/`，但激活层仍未完全收口。

影响：

- 容易出现版本、路径、完整性检查、启动责任边界不一致。
- 对 desktop/server/docker/k8s 共核方案来说，理解成本和维护成本依然偏高。

建议：

- 下一阶段继续把“专用 OpenClaw runtime ownership”和“泛化 bundled activation”进一步收敛到同一套 provenance 和 health 模型。

### P1: 跨操作系统仍缺真实安装执行级 smoke，当前更偏结构级校验

现象：

- 目前已有打包结构、release assets、installer plan smoke。
- 但仍缺：
  - Windows 真安装后首启验证
  - Linux package install 后 postinstall 真实执行验证
  - macOS `.app`/`.dmg` 落地后的真实运行验证

影响：

- “安装期已经解压、启动期不再二次处理”这一核心诉求，当前仍无法在所有目标系统上通过自动化证据完全证明。

### P2: `DesktopBootstrapApp.test.ts` 仍然只是源码契约测试，不是行为级测试

现象：

- 当前测试只检查源码里存在 `probeDesktopHostedRuntimeReadiness()` 等关键语句。

影响：

- 能防止删除关键调用，但不能证明：
  - 成功时里程碑推进顺序正确
  - 失败时错误态正确
  - shell 只在 runtime ready 后挂载

建议：

- 后续增加最小 React 行为测试或抽离 bootstrap state machine 后做纯逻辑测试。

### P2: 本地 AI 代理 token 统计的核心链路基本正确，但运行期“看不到 token”仍需从构建/数据版本排查

现象：

- Rust、kernel service、settings service、presentation 层都已有 token 字段测试。
- 因此若用户运行中仍缺少 `prompt_tokens/completion_tokens/cache_tokens`，更像是：
  - 旧桌面产物
  - 旧数据库记录
  - 旧 UI 数据源
  - 旧日志记录未重算

建议：

- 不再盲改 Rust token 提取逻辑。
- 下一轮重点排查运行时数据源、历史记录兼容与 UI 详情页的数据刷新链路。

## Priority Order

1. 把桌面 hosted runtime 回归接入 `check:desktop`
2. 增加发布/安装后首启闭环证据
3. 收敛 OpenClaw 专用激活与 bundled activation 双轨
4. 补行为级 bootstrap 测试
5. 补运行时 token/日志/实例数据诊断工具
## 2026-04-06 Latest Remediation Update

Closed in this iteration:

- desktop bootstrap sequencing is now covered by behavior tests instead of string-presence tests
- desktop bootstrap failure and stale-run paths now explicitly clear deferred sidebar warmup work
- the desktop Vite build failure caused by ESM `__dirname` misuse is fixed
- `check:desktop` no longer depends on raw Node resolution for workspace packages and now runs through a loader-backed TypeScript gate

Still open:

- bundled OpenClaw latest-version convergence
- packaged first-launch smoke across Windows/Linux/macOS
- chat/proxy/token accounting review

## 2026-04-06 Iteration Update: Install-Ready Evidence Gap Closed

Closed in this iteration:

- the desktop release verifier, installer smoke report, and release finalizer now preserve the full `installReadyLayout` evidence object instead of truncating it to `{ mode, installKey }`
- release metadata can now explicitly prove `reuseOnFirstLaunch=true` and `requiresArchiveExtractionOnFirstLaunch=false`
- the canonical install-root manifest path, runtime sidecar path, bundled Node entrypoint, and OpenClaw CLI entrypoint now survive all release pipeline stages

Still open for this area:

- real packaged installer execution on Windows/Linux/macOS
- first-launch runtime log capture that proves no archive extraction path is triggered outside the synthetic contract tests

## 2026-04-06 Iteration Update: Local AI Proxy Token Accounting Closed

Closed in this iteration:

- OpenAI `responses` cache tokens are now extracted from `usage.input_tokens_details.cached_tokens`
- local AI proxy request logs now retain cache-token visibility for OpenAI `responses` traffic
- translated Anthropic and Gemini OpenAI `responses` payloads now preserve `usage`
- translated streaming `response.completed` events now preserve final token accounting

Still open for this area:

- end-to-end verification through desktop chat/bootstrap and built-in OpenClaw gateway flows
- broader cross-host review for how server/docker/k8s modes surface the same token-accounting contract

## 2026-04-06 Iteration Update: Cross-Workspace TypeScript Loader Gap Closed

Closed in this iteration:

- the Node TypeScript regression loader now resolves the sibling workspace package `@sdkwork/core-pc-react`
- the loader now resolves the exported subpaths used by Agent Studio:
  - `@sdkwork/core-pc-react/app`
  - `@sdkwork/core-pc-react/env`
  - `@sdkwork/core-pc-react/runtime`
  - plus the remaining declared source subpaths
- regression coverage now explicitly fails if the loader stops resolving the sibling workspace root or app entry
- the previously blocked cross-package checks now execute product logic instead of failing on module resolution

Fresh evidence:

- `node scripts/ts-extension-loader.test.mjs`
- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-settings/src/services/localAiProxyLogsService.test.ts','packages/sdkwork-agentstudio-pc-core/src/services/kernelPlatformService.test.ts']))"`
- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`

Still open for this area:

- end-to-end desktop chat to built-in OpenClaw gateway verification
- cross-host validation that desktop/server/docker/k8s consume the same request-log and hosted-runtime contracts where intended

## 2026-04-06 Iteration Update: Automation Gate Restored

Closed in this iteration:

- `check:automation` no longer fails on a stale TypeScript CLI path assumption
- the workspace TypeScript runner now supports the current `typescript@6.0.2` CLI entrypoint layout
- the automated verification chain is green again across:
  - workspace TSC runner guard
  - TypeScript loader guard
  - desktop checks
  - server checks
  - release-flow checks
  - CI-flow checks

Fresh evidence:

- `node scripts/run-workspace-tsc.test.mjs`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:server`
- `pnpm.cmd check:release-flow`
- `pnpm.cmd check:automation`

Still open at the system level:

- live packaged installer execution on real Windows/Linux/macOS environments
- live desktop chat/bootstrap to built-in OpenClaw gateway runtime smoke inside a real launched application session

## 2026-04-06 Iteration Update: Lint Gate Fully Restored

Closed in this iteration:

- `check:sdkwork-account` now runs through the shared Node TypeScript parity
  runner instead of a raw strip-types path
- `sdkwork-host-runtime` contract assertions now target the extracted desktop
  bootstrap runtime and the unified managed OpenClaw gateway probe helper
- `pnpm.cmd lint` is green again after realigning the stale contract layer with
  the current desktop/runtime architecture

Fresh evidence:

- `node scripts/run-sdkwork-account-check.mjs`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd lint`

Still open after this iteration:

- live desktop startup evidence that proves the built-in OpenClaw process,
  gateway, websocket, and config workbench all become ready in one launched
  session
- real packaged installer smoke on Windows/Linux/macOS outside synthetic
  contract tests

## 2026-04-06 Iteration Update: Canonical Manage Endpoint Selection Closed

Closed in this iteration:

- desktop hosted readiness no longer assumes `hostEndpoints[0]` is the
  canonical manage endpoint
- readiness evidence now resolves the canonical manage endpoint against the
  hosted runtime descriptor using endpoint id, browser base URL, and active port
  before falling back to the first published endpoint
- desktop startup logs now emit canonical manage endpoint details from
  readiness evidence instead of logging the first raw endpoint entry
- the multi-endpoint false-negative startup failure mode is now covered by a
  targeted desktop hosted bridge regression

Fresh evidence:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`

Still open for this area:

- launched-session evidence that proves the selected canonical manage endpoint
  also aligns with live built-in OpenClaw runtime/gateway/websocket readiness
- bundled OpenClaw version convergence beyond the still-reported `2026.4.2`

## 2026-04-06 Iteration Update: OpenClaw Release Metadata Parity Closed

Closed in this iteration:

- the latest-version ambiguity is now explicitly closed for `2026-04-06`:
  upstream latest stable still resolves to `v2026.4.2`
- shared TypeScript OpenClaw release metadata now projects
  `runtimeSupplementalPackages` instead of dropping that field
- the OpenClaw release contract now asserts that the desktop packaged runtime
  manifest stays aligned with the shared stable OpenClaw and Node.js versions

Fresh evidence:

- `node scripts/openclaw-release-contract.test.mjs`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Still open after this iteration:

- live desktop startup evidence for built-in OpenClaw process/runtime/gateway/websocket alignment
- real packaged installer smoke on Windows/Linux/macOS
- chat, file list, notification, cron, and instance-detail end-to-end review

## 2026-04-06 Iteration Update: Hosted Runtime Failure Evidence Closed

Closed in this iteration:

- desktop hosted readiness failures no longer throw away the structured
  readiness snapshot at the exact point where root-cause evidence matters most
- desktop bootstrap now distinguishes typed hosted-readiness failures from
  generic startup failures
- startup logs now emit a dedicated hosted-readiness failure entry with:
  - descriptor authority
  - canonical manage endpoint evidence
  - managed OpenClaw runtime/gateway lifecycle
  - built-in instance projection
  - full `readinessEvidence`
- the failure-evidence contract is now locked by both bridge-level and
  host-runtime contract regressions

Fresh evidence:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Still open after this iteration:

- real launched-session evidence for built-in OpenClaw startup, gateway
  readiness, websocket authority, and built-in instance projection
- chat, file list, notification, cron job, and instance-detail end-to-end
  verification on top of the hosted runtime
- desktop/server/docker/k8s shared-runtime review findings that still need
  live behavior proof beyond contract gates

## 2026-04-06 Iteration Update: Hosted Runtime Identity Drift Closed

Closed in this iteration:

- desktop hosted readiness no longer lets managed OpenClaw runtime/gateway
  `endpointId` drift pass as success when URLs still happen to match
- desktop hosted readiness no longer lets managed OpenClaw runtime/gateway
  `activePort` drift pass as success when the rest of the projection looks
  healthy
- readiness enforcement is now aligned with the already-declared
  `DesktopHostedRuntimeReadinessEvidence.ready` contract instead of enforcing a
  weaker subset
- regression coverage now locks both identity-drift failure modes in the
  desktop hosted bridge test suite

Fresh evidence:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Still open after this iteration:

- real launched-session evidence for built-in OpenClaw process/runtime/gateway/
  websocket convergence in one desktop startup
- chat, file list, notification, cron job, and instance-detail end-to-end
  validation on top of the stricter hosted-runtime readiness contract
- real packaged installer smoke on Windows/Linux/macOS outside the synthetic
  desktop release checks

## 2026-04-06 Iteration Update: Built-In Instance Projection Drift Closed

Closed in this iteration:

- desktop hosted readiness no longer accepts a built-in instance projection
  that only matches gateway URLs while drifting on `runtimeKind`,
  `deploymentMode`, `transportKind`, or `status`
- the built-in instance must now be projected as:
  - `openclaw`
  - `local-managed`
  - `openclawGatewayWs`
  - `online`
- startup readiness is now aligned with the downstream assumptions already used
  by chat routing, snapshot-authority blocking, and OpenClaw workbench
  hydration
- regression coverage now locks the four built-in projection drift classes

Fresh evidence:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Still open after this iteration:

- real launched-session evidence that the built-in OpenClaw instance actually
  reaches `online` in a live desktop startup
- chat, file list, notification, cron job, and instance-detail end-to-end
  validation on top of the stricter built-in runtime contract
- real packaged installer smoke on Windows/Linux/macOS outside the synthetic
  release checks

## 2026-04-06 Iteration Update: Startup Convergence Retry Closed

Closed in this iteration:

- desktop hosted runtime readiness no longer fails permanently on the first
  transient startup miss once the hosted descriptor is available
- desktop startup now retries hosted readiness within a bounded convergence
  window before surfacing a fatal bootstrap failure
- desktop startup logs now expose transient hosted-readiness convergence
  attempts instead of only the final success or final failure
- bridge-level contract coverage now locks the retry wrapper around the hosted
  readiness probe

Fresh evidence:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Still open after this iteration:

- launched-session feature validation for chat, file list, notification, cron,
  and instance detail on top of the converged built-in runtime
- websocket/gateway authority validation after startup, not only during
  bootstrap convergence
- packaged installer smoke on Windows/Linux/macOS outside the synthetic
  release checks

## 2026-04-06 Iteration Update: Instance Files Visibility Fallback Closed

Closed in this iteration:

- instance-detail file explorers no longer collapse to a false-empty state when
  file snapshots arrive before `selectedAgentId` or agent snapshots have fully
  converged
- instance-mode file visibility now keeps the existing agent-scoped behavior
  when agent context is available, but falls back to the already-known
  workbench file list when that context is temporarily unavailable
- backend-authored OpenClaw file ids now stay attached to the correct agent
  after agent-id normalization instead of being filtered out by renderer-side
  drift
- instance-mode file tab scope now follows the resolved fallback agent instead
  of a stale `selectedAgentId` string

Fresh evidence:

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceFileWorkbench.test.ts`
- `pnpm.cmd check:sdkwork-instances`

Verification note:

- direct bare `node --experimental-strip-types` execution of
  `instanceService.test.ts` and `instanceWorkbenchService.test.ts` still fails
  in this workspace because those higher-level suites depend on the workspace
  package-resolution harness instead of raw Node package resolution
- that is an execution-entry mismatch, not a regression in this iteration; the
  canonical package gate for this area remains `pnpm.cmd check:sdkwork-instances`

Still open after this iteration:

- launched-session feature validation for chat, notification, cron, and
  instance detail on top of the now-hardened file visibility behavior
- websocket/gateway authority validation after startup, including built-in
  OpenClaw websocket reachability and console-open flows
- packaged installer smoke on Windows/Linux/macOS outside the synthetic
  release checks

## 2026-04-06 Iteration Update: OpenClaw Chat Authority Split Closed

Closed in this iteration:

- chat route-mode resolution, built-in snapshot-conversation blocking, and the
  shared OpenClaw WebSocket registry now resolve runtime truth through one
  shared authority helper instead of mixing `studio.getInstance(...)` and
  `studio.getInstanceDetail(...)` independently
- stale built-in snapshot metadata no longer drives `chatStore` into a gateway
  hydration attempt that the authoritative detail path immediately rejects
- stale built-in snapshot metadata no longer allows local conversation snapshot
  reads while detail authority says the managed OpenClaw runtime is not ready
- focused regressions now lock both user-visible failure modes:
  - `packages/sdkwork-agentstudio-pc-chat/src/store/chatStoreAuthority.test.ts`
  - `packages/sdkwork-agentstudio-pc-chat/src/store/studioConversationGateway.test.ts`

Fresh evidence:

- `node scripts/run-sdkwork-chat-check.mjs`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd lint`

Still open after this iteration:

- launched-session end-to-end validation for chat on top of a real built-in
  OpenClaw runtime
- upward validation for notification, cron, and instance detail flows that
  depend on the same managed runtime truth
- packaged installer smoke on Windows/Linux/macOS outside the synthetic
  release checks

## 2026-04-06 Iteration Update: Install Route Chat Warmers Isolation Closed

Closed in this iteration:

- `/install` and nested install routes no longer mount `ChatRuntimeWarmers`
  after the delayed `MainLayout` startup timer
- install-mode sessions no longer preconnect OpenClaw chat gateway runtime or
  cron activity notification side effects before the authenticated workspace is
  entered
- shell route-policy coverage now locks auth, OAuth callback, and install-route
  warmer isolation through a dedicated pure helper

Fresh evidence:

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-shell/src/application/layouts/chatRuntimeWarmersPolicy.test.ts`
- `pnpm.cmd check:sdkwork-shell`
- `pnpm.cmd lint`

Still open after this iteration:

- launched-session evidence that authenticated workspace startup mounts chat
  warmers only after the built-in OpenClaw runtime is truly reachable
- live validation for chat, notification, cron, and instance-detail behavior on
  top of the now-isolated install/startup split
- packaged installer smoke on Windows/Linux/macOS outside the synthetic
  release checks

## 2026-04-06 Iteration Update: Global Notification Gateway Warmup Closed

Closed in this iteration:

- non-chat authenticated workspace routes no longer leave
  `ChatCronActivityNotifications` mounted without a corresponding active
  OpenClaw gateway warm source
- `/chat` continues to do directory-level gateway warmup, while other
  authenticated routes now keep only the active instance warm
- auth/install routes remain cold and excluded from OpenClaw gateway warmup

Fresh evidence:

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-chat/src/runtime/openClawGatewayConnectionsPolicy.test.ts`
- `node scripts/run-sdkwork-chat-check.mjs`
- `pnpm.cmd lint`

Still open after this iteration:

- live launched-session evidence for real built-in OpenClaw `online`
  convergence and post-startup chat/cron behavior
- upward validation for instance detail and console-open flows on top of the
  corrected warmup plan
- packaged installer smoke on Windows/Linux/macOS outside the synthetic
  release checks

## 2026-04-06 Iteration Update: OpenClaw TaskService Backend Workbench Routing Closed

Closed in this iteration:

- `sdkwork-agentstudio-pc-core` task routing no longer treats
  `runtimeKind === "openclaw"` as proof that gateway cron APIs are the
  authoritative task surface
- backend-authored OpenClaw workbench tasks now stay on the backend/studio
  task surface whenever `detail.workbench` exists
- follow-up actions now remember task source as
  `mode: 'backend' | 'gateway'` instead of re-guessing from runtime kind

Fresh evidence:

- focused workspace-loaded `taskService.test.ts` regression via
  `scripts/run-node-typescript-check.mjs`
- `node scripts/run-sdkwork-core-check.mjs`
- `pnpm.cmd check:sdkwork-core`
- `pnpm.cmd lint`

Still open after this iteration:

- live launched-session evidence for built-in OpenClaw runtime/gateway
  convergence
- upward validation for instance-detail and console-open behavior on top of the
  now-capability-driven task routing
- remaining OpenClaw lazy file/memory authority drift in the instances
  workbench layer

## 2026-04-06 Iteration Update: OpenClaw Lazy File And Memory Backend Fallback Closed

Closed in this iteration:

- on-demand OpenClaw file loading no longer treats "agents exist" as enough
  evidence to call the live gateway when the backend workbench already carries
  authoritative file data
- on-demand OpenClaw memory loading no longer probes gateway config,
  `MEMORY.md`, doctor-memory, or runtime-search APIs when the backend
  workbench already carries authoritative memory data
- lazy file/memory loaders now consult fresh detail truth before deciding
  whether a live gateway probe is even allowed

Fresh evidence:

- focused workspace-loaded `instanceWorkbenchService.test.ts` regression via
  `scripts/run-node-typescript-check.mjs`
- `pnpm.cmd check:sdkwork-instances`
- `pnpm.cmd lint`

Still open after this iteration:

- launched-session evidence for real built-in OpenClaw `online`
  convergence, websocket reachability, and console-open behavior
- upward validation for notification, cron, and instance-detail behavior on top
  of the corrected lazy section authority rules
- packaged installer smoke on Windows/Linux/macOS outside the synthetic
  release checks

## 2026-04-06 Iteration Update: OpenClaw Console Availability Runtime Truth Closed

Closed in this iteration:

- host-studio no longer marks remote/local-external OpenClaw
  `consoleAccess.available` as true merely because a console URL can be
  derived
- desktop embedded host no longer exposes console launch or auto-login for
  offline remote/local-external OpenClaw instances
- shared Rust host projections now require runtime status truth before instance
  detail exposes "open console" affordances across desktop/server/docker/k8s
  flows

Fresh evidence:

- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-host-studio/src-host/Cargo.toml hides_console_launch_while_runtime_is_offline`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml hides_console_launch_while_runtime_is_offline`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-host-studio/src-host/Cargo.toml console_launch`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-host-studio/src-host/Cargo.toml default_provider_local_external_openclaw_detail_exposes_console_access_without_workbench`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml console_launch`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml local_external_openclaw_detail_reads_install_record_for_console_auto_login`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml remote_openclaw_instance_detail_does_not_reuse_built_in_local_workbench`

Still open after this iteration:

- launched-session evidence for real built-in OpenClaw `online`
  convergence and websocket reachability on top of the corrected console truth
- upward validation for chat, notification, cron, proxy router, and instance
  detail behavior once runtime truth is consistent end-to-end
- packaged installer smoke on Windows/Linux/macOS outside the synthetic
  release checks

## 2026-04-06 Iteration Update: OpenClaw Offline Chat Route Runtime Truth Closed

Closed in this iteration:

- offline `local-external` OpenClaw instances no longer publish
  `instanceOpenClawGatewayWs` merely because URL metadata exists
- offline `remote` OpenClaw instances no longer publish
  `instanceOpenClawGatewayWs` merely because URL metadata exists
- chat gateway warmup/hydration now stays aligned with the same runtime truth
  already enforced for console access and hosted readiness
- online OpenClaw instances keep the existing gateway route behavior, so the
  fix does not collapse into "disable OpenClaw chat routing"

Fresh evidence:

- focused TypeScript check for
  `packages/sdkwork-agentstudio-pc-chat/src/services/instanceChatRouteService.test.ts`
- focused TypeScript check for `scripts/sdkwork-chat-contract.test.ts`
- `node scripts/run-sdkwork-chat-check.mjs`
- `pnpm.cmd lint`

Still open after this iteration:

- launched-session evidence for real built-in OpenClaw `online`
  convergence and post-startup websocket reachability
- upward validation for notification, cron, proxy router, and instance-detail
  behavior once the runtime is live in one managed session
- packaged installer smoke on Windows/Linux/macOS outside the synthetic
  release checks

## 2026-04-06 Iteration Update: Desktop Hosted Readiness Gateway Invoke Capability Closed

Closed in this iteration:

- desktop hosted runtime readiness no longer treats matching lifecycle and URL
  projection as sufficient proof that the managed OpenClaw gateway is callable
- the desktop bridge now consumes host-platform capability truth for
  `manage.openclaw.gateway.invoke`
- startup readiness now rejects the exact state that previously allowed
  bootstrap to continue before the gateway invoke surface was actually
  available
- host-runtime source contracts now lock the capability-aware readiness rule

Fresh evidence:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Still open after this iteration:

- server/control-plane capability truth for `manage.openclaw.gateway.invoke`
  still needs review across server/docker/k8s shared-host projection
- launched-session proof for real built-in OpenClaw `online` convergence and
  websocket reachability is still needed beyond contract-level readiness
- upward validation for chat, notification, cron, proxy router, and
  instance-detail behavior should continue on top of the stricter readiness
  gate

## 2026-04-06 Iteration Update: Server Control-Plane Gateway Invoke Capability Truth Closed

Closed in this iteration:

- shared server/control-plane host projection no longer hardcodes
  `manage.openclaw.gateway.invoke` as unavailable
- `ControlPlaneManageOpenClawProvider` now derives invoke availability from the
  managed gateway lifecycle instead of returning a permanent pessimistic value
- server/docker/k8s host-platform capability truth now matches the desktop
  embedded host rule: gateway ready means invoke capability available
- route-level host-platform projection no longer legalizes the stale capability
  omission when the control-plane gateway is already ready

Fresh evidence:

- `cargo test control_plane_manage_openclaw_provider_reports_gateway_invoke_available_when_gateway_is_ready --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml`
- `cargo test internal_host_platform_route_reports_gateway_invoke_available_when_control_plane_gateway_is_ready --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml`
- `pnpm.cmd check:server`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd lint`

Still open after this iteration:

- launched-session proof for real built-in OpenClaw `online` convergence and
  WebSocket reachability is still needed beyond contract-level capability truth
- upward validation for chat, notification, cron, proxy router, and
  instance-detail behavior should continue on top of the now-aligned shared
  invoke-capability contract
- packaged installer smoke on Windows/Linux/macOS outside the synthetic
  release checks

## 2026-04-06 Iteration Update: OpenClaw WebSocket Base-Path Truth Closed

Closed in this iteration:

- desktop built-in OpenClaw live-state projection no longer hardcodes
  `ws://127.0.0.1:{port}` when the managed config declares
  `gateway.controlUi.basePath`
- built-in instance detail, connectivity, and console projections now share the
  same canonical websocket authority for managed OpenClaw
- local-external OpenClaw discovery and association no longer strip
  `controlUi.basePath` from websocket metadata while creating or updating
  instance records
- the websocket-authority rule is now aligned across desktop built-in and
  config-derived local-external OpenClaw onboarding flows

Fresh evidence:

- `cargo test built_in_instance_detail_projects_control_ui_base_path_into_live_gateway_websocket_url --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test built_in_instance_detail_exposes_console_access_with_auto_login_url --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test built_in_instance_detail_hides_live_gateway_endpoints_when_the_gateway_is_not_running --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `pnpm.cmd check:desktop`
- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-instances/src/services/instanceOnboardingService.test.ts']))"`
- `pnpm.cmd lint`

Still open after this iteration:

- launched-session proof for real built-in OpenClaw startup, gateway readiness,
  and websocket reachability is still needed beyond the current contract-level
  coverage
- browser-only fallback normalization in
  `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts` still needs
  targeted review if runtime evidence shows it can override canonical host
  metadata
- upward validation for chat, notification, cron, proxy router, and instance
  detail behavior should continue on top of the corrected websocket authority
  contract

## 2026-04-06 Iteration Update: Managed Gateway Projection Base-Path Truth Closed

Closed in this iteration:

- desktop embedded host manage/runtime/gateway projection no longer hardcodes
  `ws://127.0.0.1:{port}` when the managed OpenClaw config declares
  `gateway.controlUi.basePath`
- desktop host endpoint projection, managed runtime projection, managed gateway
  projection, and built-in instance detail now share the same control-ui
  websocket truth
- the fallback websocket URL builder no longer drops the resolved gateway path
  when only host/port evidence is available
- focused Rust regression coverage now locks the shared truth across:
  - `get_host_endpoints(...)`
  - `get_openclaw_runtime(...)`
  - `get_openclaw_gateway(...)`

Fresh evidence:

- `cargo test managed_openclaw_gateway_projection_projects_control_ui_base_path_into_websocket_url --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test built_in_instance_detail_projects_control_ui_base_path_into_live_gateway_websocket_url --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Still open after this iteration:

- launched-session proof for real built-in OpenClaw startup, websocket
  dialability, and post-startup gateway reachability is still needed beyond the
  now-correct metadata projection
- browser-only fallback normalization in
  `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts` still needs
  targeted review if runtime evidence shows it can override canonical host
  metadata
- upward validation for chat, notification, cron, proxy router, and instance
  detail behavior should continue on top of the fully aligned managed gateway
  projection contract

## 2026-04-06 Iteration Update: Desktop Hosted Runtime WebSocket Dialability Closed

Closed in this iteration:

- desktop hosted readiness no longer treats a published gateway websocket URL
  as proof that the managed OpenClaw websocket is already accepting
  connections
- desktop startup now fails at the hosted-readiness gate when the managed
  OpenClaw websocket still refuses a real connection attempt
- the live desktop runtime injects a real browser `WebSocket` probe while
  Node-based contract tests stay deterministic because the bridge no longer
  implicitly uses `globalThis.WebSocket`
- focused regression and contract coverage now lock both the dial-success and
  dial-failure readiness paths

Fresh evidence:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Still open after this iteration:

- browser-only fallback normalization in
  `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts` still needs
  targeted review if any renderer path can override canonical host-published
  runtime truth
- launched-session validation for chat, notification, cron, proxy router, and
  instance detail should continue on top of the stricter websocket-dialability
  readiness gate
- packaged installer smoke on Windows/Linux/macOS outside the synthetic release
  checks is still outstanding

## 2026-04-06 Iteration Update: Desktop Bridge Preservation Closed

Closed in this iteration:

- the previous shell-bootstrap fix is now reinforced at the infrastructure
  boundary, so `configureServerBrowserPlatformBridge(...)` and
  `bootstrapServerBrowserPlatformBridge(...)` no longer override
  `manage/internal/runtime/studio` surfaces once the active platform bridge is
  already `desktop`
- structured hosted-browser bootstrap descriptor fetches are now skipped while
  desktop authority is active, preventing a second overwrite path after desktop
  startup sequencing has already been corrected
- `check:sdkwork-foundation` now executes the real platform source tests:
  - `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/registry.test.ts`
  - `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/serverBrowserBridge.test.ts`

Fresh evidence:

- `node scripts/run-sdkwork-foundation-check.mjs`
- `pnpm.cmd check:sdkwork-foundation`
- `pnpm.cmd check:sdkwork-shell`
- `pnpm.cmd check:desktop`

Still open after this iteration:

- launched-session validation for chat, notification, cron, proxy router, and
  instance detail still needs to run on top of the now-fully preserved desktop
  authority path
- packaged installer smoke on Windows/Linux/macOS outside the synthetic release
  checks is still outstanding
- renderer/browser fallback normalization review is still open where the risk is
  data-truth drift rather than bridge-install overwrite

## 2026-04-06 Iteration Update: Chat Service Authority Alignment Closed

Closed in this iteration:

- the user-facing chat send/stream path in
  `packages/sdkwork-agentstudio-pc-chat/src/services/chatService.ts` no longer resolves
  OpenClaw route truth from `studio.getInstance(...)` alone
- `chatService` now uses the same authoritative instance-detail route resolver
  already used by chat store hydration, conversation snapshots, and the shared
  OpenClaw gateway client registry
- `check:sdkwork-chat` now includes a regression covering the real
  `chatService.sendMessageStream(...)` path instead of only the surrounding
  store/gateway authority helpers

Fresh evidence:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-chat/src/services/chatService.test.ts']))"`
- `pnpm.cmd check:sdkwork-chat`

Still open after this iteration:

- launched-session validation for notifications, cron, proxy router, and
  instance detail still needs end-to-end coverage on top of the aligned chat
  runtime truth
- packaged desktop startup smoke with a live built-in OpenClaw runtime remains
  outstanding outside the current contract-level checks

## 2026-04-06 Iteration Update: Instance Workbench Task Create/Update Authority Closed

Closed in this iteration:

- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`
  no longer treats `runtimeKind === "openclaw"` as enough evidence to route
  task creation or task updates through direct gateway cron APIs
- backend-authored OpenClaw workbench sessions now keep task create/update on
  the same backend authority already used for clone, run-now, history, status
  toggle, and delete
- `check:sdkwork-instances` now executes focused instances source tests through
  `scripts/run-sdkwork-instances-check.mjs` before the existing contract test

Fresh evidence:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts']))"`
- `node scripts/run-sdkwork-instances-check.mjs`
- `pnpm.cmd check:sdkwork-instances`

Still open after this iteration:

- launched-session validation for notification, cron UI, proxy router, and
  instance-detail behavior on top of the now-aligned task authority
- packaged installer smoke on Windows/Linux/macOS outside the synthetic release
  checks is still outstanding

## 2026-04-06 Iteration Update: Active Instance Selection Authority Closed

Closed in this iteration:

- explicit "set as active" actions in the instances feature no longer use
  `instance.status === 'online'` as a page-local gate
- active-instance selection is now modeled in
  `packages/sdkwork-agentstudio-pc-instances/src/services/instanceActionCapabilities.ts`
  so instance list and instance detail consume the same shared rule
- offline or startup-converging instances remain selectable as the active shell
  context, matching the existing header/sidebar switcher behavior instead of
  disagreeing with it

Fresh evidence:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-instances/src/services/instanceActionCapabilities.test.ts']))"`
- `node scripts/run-sdkwork-instances-check.mjs`

Still open after this iteration:

- launched-session validation for notification, cron, proxy router, and
  instance-detail behavior on top of the aligned active-instance rule
- packaged installer smoke on Windows/Linux/macOS outside the synthetic release
  checks is still outstanding

## 2026-04-06 Iteration Update: Config-Backed OpenClaw Gateway Readiness Closed

Closed in this iteration:

- shared OpenClaw management readiness no longer treats
  `detail.instance.status === 'online'` as the only proof that a config-backed
  gateway is ready
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
  now accepts runtime-observed readiness when `endpointObserved === true` and
  `detail.health.status !== 'offline'`
- config-backed OpenClaw gateway management paths no longer reject a live
  gateway just because the instance status snapshot is stale

Fresh evidence:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.test.ts','packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts']))"`

Still open after this iteration:

- launched-session validation for notification, proxy router, and instance
  detail behavior on top of the aligned config-backed gateway readiness rule
- packaged installer smoke on Windows/Linux/macOS outside the synthetic release
  checks is still outstanding

## 2026-04-06 Iteration Update: Tauri CLI Local Runner Hardening Closed

Closed in this iteration:

- desktop startup no longer depends on `tauri.cmd` / shell PATH lookup in
  `scripts/run-tauri-cli.mjs`
- the runner now resolves the local `@tauri-apps/cli/tauri.js` entrypoint and
  launches it through `node`
- desktop `tauri:info` and `tauri:icon` now share the same hardened runner, so
  this regression cannot survive in side-entry scripts while `dev:desktop` is
  fixed

Fresh evidence:

- `node scripts/run-tauri-cli.test.mjs`
- `node scripts/tauri-dev-command-contract.test.mjs`
- `node scripts/check-desktop-platform-foundation.mjs`
- `node scripts/run-tauri-cli.mjs info`
- `pnpm.cmd --dir packages/sdkwork-agentstudio-pc-desktop tauri:info`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Still open after this iteration:

- full launched-session `pnpm dev:desktop` evidence in a real GUI session is
  still needed on top of the repaired CLI launch path
- Tauri package-version convergence still needs a separate review because
  `tauri info` currently reports Rust-side `tauri 2.10.3` while
  `@tauri-apps/cli` is `2.10.1`

