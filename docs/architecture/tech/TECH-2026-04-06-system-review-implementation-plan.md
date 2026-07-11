> Migrated from `docs/review/2026-04-06-system-review-implementation-plan.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Agent Studio System Review Implementation Plan

## Goal

围绕统一 Rust 宿主内核、OpenClaw 内置集成、桌面 hosted runtime、跨平台安装与首启质量，建立“审计 -> 修复 -> 验证 -> 留痕”的持续迭代节奏。

## Iteration 1: Establish Review Baseline

- [x] 汇总现有 `docs/reports/*` 的已完成审计结论
- [x] 复核 hosted runtime、CORS、token log、installer/runtime 关键源码
- [x] 在 `docs/review/` 下新增本轮 findings/design/plan 文档

## Iteration 2: Close Mandatory Regression Gaps

- [x] 新增 `scripts/desktop-hosted-runtime-regression-contract.test.mjs`
- [x] 让契约测试先失败，证明 `check:desktop` 之前缺少关键 hosted runtime 回归
- [x] 把以下测试纳入 `check:desktop`
  - `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
  - `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
  - `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`
- [x] 强制使用 `node --experimental-strip-types` 直接执行，避免 `node --test` 的子进程限制问题

## Iteration 3: Strengthen Startup And Runtime Evidence

- [ ] 为 desktop startup 增加更明确的 runtime provenance/log evidence
- [ ] 把 built-in instance readiness、gateway websocket readiness 纳入启动诊断输出
- [ ] 对运行时 symptom 和源码基线不一致的情况增加“产物漂移”提示

## Iteration 4: Execution-Level Cross-Platform Smoke

- [ ] Windows: 安装后首启 smoke，确认不再二次解压 OpenClaw
- [ ] Linux: package postinstall 执行级 smoke
- [ ] macOS: `.app` / staged runtime 首启 smoke

## Iteration 5: Architecture Convergence

- [ ] 收敛 OpenClaw 专用激活和 bundled activation 双轨
- [ ] 统一 desktop/server/docker/k8s 的 runtime provenance 与 health projection
- [ ] 补齐可运维诊断输出与 operator-facing 文档

## Verification Commands

本轮已执行或计划持续执行的关键命令：

- `node scripts/desktop-hosted-runtime-regression-contract.test.mjs`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`
- `cargo test desktop_combined_hosted_startup_preflight_allows_browser_session_header_for_critical_routes --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml`
- `cargo test desktop_combined_hosted_startup_requests_include_cors_headers_on_successful_responses --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml`

## Next Review Trigger

满足以下任一条件时，必须再开一轮 `/docs/review/` 迭代：

- OpenClaw 版本升级
- 桌面 bootstrap / hosted bridge / CORS / gateway 路径变更
- server/docker/k8s 共核方案调整
- installer/release 流程变更
- 本地 AI 代理 observability 或日志模型变更

## 2026-04-06 Execution Update

Completed in this iteration:

- extracted `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/desktopBootstrapRuntime.ts`
- converted desktop bootstrap verification into behavior-level runtime tests
- fixed deferred warm-prefetch cleanup on bootstrap failure and stale-run cancellation
- fixed `packages/sdkwork-agentstudio-pc-desktop/vite.config.ts` ESM `__dirname` handling
- added loader-backed desktop TypeScript gate execution through `scripts/run-sdkwork-desktop-check.mjs`
- restored `pnpm.cmd check:desktop` to green

Immediate next step:

- continue with bundled OpenClaw version convergence and packaged first-launch smoke coverage

## 2026-04-06 Iteration Update: Install-Ready Layout Evidence

Completed in this iteration:

- [x] centralized the packaged OpenClaw install-ready contract in `scripts/release/desktop-install-ready-layout.mjs`
- [x] upgraded `verify-desktop-openclaw-release-assets.mjs` to emit the full first-launch reuse evidence object
- [x] upgraded `scripts/release/smoke-desktop-installers.mjs` to persist the full normalized evidence into `installer-smoke-report.json`
- [x] upgraded `scripts/release/finalize-release-assets.mjs` to preserve the same evidence in final release metadata
- [x] verified the change with targeted node tests and `pnpm.cmd check:release-flow`

Next step for this workstream:

- execute packaged installer smoke on real Windows/Linux/macOS environments and capture first-launch runtime evidence against the persisted contract

## 2026-04-06 Iteration Update: Local AI Proxy Token Accounting

Completed in this iteration:

- [x] extended `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` to extract OpenAI `responses` cache tokens from `usage.input_tokens_details.cached_tokens`
- [x] restored `usage` projection for translated Anthropic/Gemini OpenAI `responses` payloads
- [x] restored final `usage` projection for translated streaming `response.completed` events
- [x] added request-log and translation regressions for OpenAI `responses` token accounting
- [x] verified the work with targeted cargo tests plus the local-ai-proxy regression sweep

Next step for this workstream:

- validate the same token-accounting fields through desktop chat/bootstrap and built-in OpenClaw gateway end-to-end flows

## 2026-04-06 Iteration Update: Cross-Workspace TypeScript Loader Hardening

Completed in this iteration:

- [x] added a failing regression in `scripts/ts-extension-loader.test.mjs` for `@sdkwork/core-pc-react` root and `/app` source resolution
- [x] extended `scripts/ts-extension-loader.mjs` to resolve the sibling workspace package `@sdkwork/core-pc-react`
- [x] added the exported source subpaths required by the current Agent Studio graph:
  - `./app`
  - `./env`
  - `./hooks`
  - `./im`
  - `./preferences`
  - `./runtime`
- [x] re-ran the previously blocked cross-package checks after the loader fix
- [x] re-ran the desktop hosted runtime/bootstrap regression sweep to confirm the loader hardening did not regress desktop startup verification

Verification executed in this iteration:

- `node scripts/ts-extension-loader.test.mjs`
- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-settings/src/services/localAiProxyLogsService.test.ts','packages/sdkwork-agentstudio-pc-core/src/services/kernelPlatformService.test.ts']))"`
- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.test.ts`

Next step for this workstream:

- use the unblocked TypeScript regression harness to validate desktop chat/bootstrap into the built-in OpenClaw gateway path

## 2026-04-06 Iteration Update: Automation Gate Recovery

Completed in this iteration:

- [x] reproduced the failing `check:automation` gate and isolated the breakage to `scripts/run-workspace-tsc.mjs`
- [x] confirmed the workspace currently uses `typescript@6.0.2` with the CLI entrypoint available at `lib/_tsc.js`
- [x] added a regression expectation in `scripts/run-workspace-tsc.test.mjs` for the TypeScript 6 CLI layout
- [x] hardened `scripts/run-workspace-tsc.mjs` to resolve both legacy `lib/tsc.js` and current `lib/_tsc.js`
- [x] re-ran the full automation gate after the fix

Verification executed in this iteration:

- `node scripts/run-workspace-tsc.test.mjs`
- `pnpm.cmd check:desktop`
- `pnpm.cmd check:server`
- `pnpm.cmd check:release-flow`
- `pnpm.cmd check:automation`

Next step for this workstream:

- move from contract-level verification to live runtime smoke for desktop chat/bootstrap into the built-in OpenClaw gateway with captured runtime evidence

## 2026-04-06 Iteration Update: Lint Recovery Closure

Completed in this iteration:

- [x] migrated the remaining `sdkwork-account` parity entrypoint onto the shared
      Node TypeScript runner
- [x] reproduced the next failing gate inside
      `scripts/sdkwork-host-runtime-contract.test.ts`
- [x] realigned host-runtime contract assertions with the extracted
      `desktopBootstrapRuntime.ts` sequencing logic
- [x] realigned managed OpenClaw config contract assertions with
      `withManagedOpenClawGatewayProbe(...)`
- [x] re-ran the focused contract gate and the full `pnpm.cmd lint` gate

Verification executed in this iteration:

- `node scripts/run-sdkwork-account-check.mjs`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd lint`

Immediate next step:

- continue from restored contract parity into a live runtime evidence loop for
  built-in OpenClaw startup, gateway readiness, websocket readiness, and config
  workbench behavior in a real desktop session

## 2026-04-06 Iteration Update: Canonical Manage Endpoint Hardening

Completed in this iteration:

- [x] reproduced the false-negative hosted readiness failure caused by assuming
      the first published manage endpoint was canonical
- [x] added a regression in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
      for multi-endpoint descriptor-aligned selection
- [x] hardened
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts` to
      resolve the canonical manage endpoint from descriptor id/base URL/active
      port evidence
- [x] switched desktop startup logging in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`
      to canonical readiness evidence instead of `hostEndpoints[0]`
- [x] re-ran the focused bridge regression, host-runtime contract, and
      `check:desktop`

Verification executed in this iteration:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`

Immediate next step:

- continue from canonical endpoint ordering correctness into richer live startup
  evidence for built-in OpenClaw runtime/gateway/websocket/session alignment

## 2026-04-06 Iteration Update: OpenClaw Release Metadata Parity

Completed in this iteration:

- [x] revalidated that `2026.4.2` is still the upstream latest stable OpenClaw
      release on `2026-04-06`, so no production version bump is required
- [x] reproduced the metadata parity gap where
      `packages/sdkwork-agentstudio-pc-types/src/openclawRelease.ts` did not expose
      `runtimeSupplementalPackages`
- [x] extended the OpenClaw release contract to cover:
      - shared supplemental runtime package metadata
      - desktop packaged bundled runtime manifest parity
- [x] updated `packages/sdkwork-agentstudio-pc-types/src/openclawRelease.ts` to export
      `DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES`
- [x] re-ran the focused contract, `check:desktop`, and `lint`

Verification executed in this iteration:

- `node scripts/openclaw-release-contract.test.mjs`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Immediate next step:

- leave the bundled stable version pinned at `2026.4.2` and continue with live
  desktop startup evidence plus end-to-end built-in OpenClaw behavior review

## 2026-04-06 Iteration Update: Hosted Runtime Failure Evidence Hardening

Completed in this iteration:

- [x] reproduced the failure-evidence gap where the hosted readiness bridge
      threw only a plain `Error`
- [x] added a regression in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
      that requires readiness failures to preserve the structured snapshot
- [x] introduced `DesktopHostedRuntimeReadinessSnapshot`,
      `DesktopHostedRuntimeReadinessError`, and the typed guard in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts`
- [x] re-exported the typed failure surface from
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts`
- [x] hardened
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`
      so hosted-readiness failures emit structured bootstrap logs instead of a
      generic opaque failure only
- [x] re-ran the focused regressions, `check:desktop`, and `lint`

Verification executed in this iteration:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Immediate next step:

- use the preserved readiness failure snapshot to drive a launched-session
  desktop smoke for built-in OpenClaw startup and then move upward into chat,
  file list, notification, cron, and instance-detail end-to-end review

## 2026-04-06 Iteration Update: Hosted Runtime Identity Drift Hardening

Completed in this iteration:

- [x] reproduced the readiness contract split where `evidence.ready` could be
      `false` while `probeDesktopHostedRuntimeReadiness(...)` still returned
      success
- [x] added a regression in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
      for managed OpenClaw runtime/gateway `endpointId` drift
- [x] added a regression in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
      for managed OpenClaw runtime/gateway `activePort` drift
- [x] hardened
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts` so
      readiness enforcement now rejects both identity-drift states
- [x] re-ran the focused regression, host-runtime contract, `check:desktop`,
      and `lint`

Verification executed in this iteration:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Immediate next step:

- keep moving from contract-level readiness hardening into launched-session
  evidence for built-in OpenClaw startup, gateway websocket authority, and the
  chat / instance-detail flows that depend on that runtime truth

## 2026-04-06 Iteration Update: Built-In Instance Projection Hardening

Completed in this iteration:

- [x] reproduced the gap where desktop hosted readiness still passed when the
      built-in instance projection drifted on managed OpenClaw identity/status
      fields
- [x] added regressions in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
      for built-in instance:
      - offline status
      - `runtimeKind` drift
      - `deploymentMode` drift
      - `transportKind` drift
- [x] hardened
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts` so
      built-in readiness now requires the projection to be:
      - `openclaw`
      - `local-managed`
      - `openclawGatewayWs`
      - `online`
- [x] updated existing successful hosted bridge fixtures to publish
      `status: "online"` so they model a truthful built-in managed runtime
      projection
- [x] re-ran the focused regression, host-runtime contract, `check:desktop`,
      and `lint`

Verification executed in this iteration:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Immediate next step:

- continue upward into launched-session evidence for the built-in instance
  `online` transition and then validate chat / instance-detail behavior on top
  of that live runtime proof

## 2026-04-06 Iteration Update: Startup Convergence Retry Hardening

Completed in this iteration:

- [x] reproduced the missing convergence window between descriptor readiness
      and hosted runtime readiness
- [x] added retry coverage for transient hosted-runtime startup failures in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
- [x] added a reusable retry helper in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.ts`
- [x] wrapped
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts`
      `probeDesktopHostedRuntimeReadiness(...)` with the retry helper
- [x] upgraded
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx`
      to log transient hosted-readiness convergence attempts
- [x] locked the bridge wiring in
      `scripts/sdkwork-host-runtime-contract.test.ts`

Verification executed in this iteration:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostRuntimeResolver.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Immediate next step:

- continue from startup convergence into post-startup feature validation for
  chat, file list, notification, cron, and instance detail on the converged
  built-in OpenClaw runtime

## 2026-04-06 Iteration Update: Instance Files Visibility Fallback

Completed in this iteration:

- [x] verified the user-visible file-list-empty symptom against the existing
      instance workbench data flow and confirmed that instance-mode rendering
      was stricter than the backend file snapshot contract
- [x] kept the existing `instanceFileWorkbench` regression coverage and added
      the no-agent fallback expectation for file-bearing workbench snapshots
- [x] hardened
      `packages/sdkwork-agentstudio-pc-instances/src/services/instanceFileWorkbench.ts`
      so instance-mode visibility falls back to the known workbench files when
      agent context has not settled yet
- [x] hardened
      `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceFilesWorkspace.tsx`
      so instance-mode agent resolution falls back to the first available agent
      and the tab scope follows that resolved context
- [x] re-ran the focused file-workbench regression plus the canonical
      `sdkwork-instances` contract gate

Verification executed in this iteration:

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceFileWorkbench.test.ts`
- `pnpm.cmd check:sdkwork-instances`

Execution note:

- raw `node --experimental-strip-types` execution of
  `packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts` and
  `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
  is not the canonical entrypoint for this workspace and fails on package
  resolution before product assertions run
- continue to use the package-level `check:sdkwork-instances` gate when
  validating this area unless the shared workspace loader for those higher-level
  suites is explicitly extended

Immediate next step:

- continue from file-list visibility correctness into launched-session
  validation for notification, cron, chat routing, and websocket/gateway
  authority on top of the converged built-in OpenClaw runtime

## 2026-04-06 Iteration Update: OpenClaw Chat Authority Unification

Completed in this iteration:

- [x] reproduced the remaining chat authority split where `chatStore` still
      resolved route mode from `studio.getInstance(...)` while gateway hydration
      already trusted `studio.getInstanceDetail(...)`
- [x] reproduced the matching snapshot-authority gap in
      `packages/sdkwork-agentstudio-pc-chat/src/store/studioConversationGateway.ts`
- [x] added red regressions in:
      - `packages/sdkwork-agentstudio-pc-chat/src/store/chatStoreAuthority.test.ts`
      - `packages/sdkwork-agentstudio-pc-chat/src/store/studioConversationGateway.test.ts`
- [x] introduced the shared authoritative resolver in
      `packages/sdkwork-agentstudio-pc-chat/src/services/store/authoritativeInstanceChatRoute.ts`
- [x] switched `chatStore`, `studioConversationGateway`, and
      `openClawGatewayClientRegistry` onto the same authority path
- [x] updated `scripts/run-sdkwork-chat-check.mjs` and
      `scripts/sdkwork-host-runtime-contract.test.ts` so the new authority
      contract is enforced by the existing automation gates
- [x] re-ran the focused chat gate, host-runtime contract, and full lint gate

Verification executed in this iteration:

- `node scripts/run-sdkwork-chat-check.mjs`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd lint`

Immediate next step:

- continue from unified chat authority into launched-session validation for
  built-in OpenClaw chat, notification, cron, and instance-detail behavior on
  top of a real managed runtime session

## 2026-04-06 Iteration Update: Install Route Chat Warmers Isolation

Completed in this iteration:

- [x] reproduced the shell startup leak where install routes still mounted
      `ChatRuntimeWarmers`
- [x] added focused route-policy coverage in
      `packages/sdkwork-agentstudio-pc-shell/src/application/layouts/chatRuntimeWarmersPolicy.test.ts`
- [x] extracted the shared path gate into
      `packages/sdkwork-agentstudio-pc-shell/src/application/layouts/chatRuntimeWarmersPolicy.ts`
- [x] switched
      `packages/sdkwork-agentstudio-pc-shell/src/application/layouts/MainLayout.tsx`
      onto the dedicated helper so install routes stay cold
- [x] locked the shell contract in
      `scripts/sdkwork-shell-contract.test.ts`
- [x] re-ran the focused shell regression, package gate, and lint gate

Verification executed in this iteration:

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-shell/src/application/layouts/chatRuntimeWarmersPolicy.test.ts`
- `pnpm.cmd check:sdkwork-shell`
- `pnpm.cmd lint`

Immediate next step:

- continue upward from route isolation into launched-session runtime evidence
  for built-in OpenClaw chat, notification, cron, and instance-detail behavior
  under the authenticated workspace

## 2026-04-06 Iteration Update: Global Notification Gateway Warmup

Completed in this iteration:

- [x] reproduced the launched-session policy gap where global chat cron
      notifications could mount on non-chat workspace routes without any active
      OpenClaw gateway warm source
- [x] wrote red regression coverage in
      `packages/sdkwork-agentstudio-pc-chat/src/runtime/openClawGatewayConnectionsPolicy.test.ts`
- [x] added the route-aware warm planner in
      `packages/sdkwork-agentstudio-pc-chat/src/runtime/openClawGatewayConnectionsPolicy.ts`
- [x] switched
      `packages/sdkwork-agentstudio-pc-chat/src/runtime/OpenClawGatewayConnections.tsx`
      to use directory warmup only on `/chat` and active-instance-only warmup on
      other authenticated workspace routes
- [x] upgraded `scripts/run-sdkwork-chat-check.mjs` so the new policy coverage
      is part of the standard chat gate
- [x] re-ran the focused runtime regression, chat gate, and full lint gate

Verification executed in this iteration:

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-chat/src/runtime/openClawGatewayConnectionsPolicy.test.ts`
- `node scripts/run-sdkwork-chat-check.mjs`
- `pnpm.cmd lint`

Immediate next step:

- continue into live launched-session evidence for built-in OpenClaw `online`
  convergence, cron/chat updates, and instance-detail correctness under the
  shared runtime

## 2026-04-06 Iteration Update: OpenClaw TaskService Backend Workbench Routing

Completed in this iteration:

- [x] reproduced the shared-routing bug where `sdkwork-agentstudio-pc-core`
      `taskService` still re-derived OpenClaw task authority from runtime kind
      after tasks had already been loaded from a backend-authored workbench
- [x] added focused task-service regression coverage so backend-authored
      OpenClaw tasks fail red if later actions fall back to gateway cron APIs
- [x] introduced explicit per-task route memory
      `mode: 'backend' | 'gateway'` in
      `packages/sdkwork-agentstudio-pc-core/src/services/taskService.ts`
- [x] switched task follow-up actions onto remembered route mode so backend
      workbench tasks stay on the studio bridge whenever `detail.workbench`
      exists
- [x] re-ran the focused task-service regression, the canonical core gate, and
      the full lint gate

Verification executed in this iteration:

- focused workspace-loaded `taskService.test.ts` regression via
  `scripts/run-node-typescript-check.mjs`
- `node scripts/run-sdkwork-core-check.mjs`
- `pnpm.cmd check:sdkwork-core`
- `pnpm.cmd lint`

Immediate next step:

- continue the same capability-first hardening pass in the instances workbench
  lazy file/memory loaders so backend-authored sections do not fall back to
  live gateway APIs by accident

## 2026-04-06 Iteration Update: OpenClaw Lazy File And Memory Backend Fallback

Completed in this iteration:

- [x] reproduced the lazy file/memory authority split where
      `instanceWorkbenchServiceCore` still routed by agent presence instead of
      backend workbench authority and live gateway readiness
- [x] added focused regressions proving backend-authored OpenClaw files and
      memories must be returned without touching gateway lazy-load APIs
- [x] introduced `getOpenClawLazySectionContext(...)` in
      `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`
- [x] changed `listInstanceFiles(...)` to prefer backend-authored workbench
      files before any gateway fallback
- [x] changed `listInstanceMemories(...)` to prefer backend-authored workbench
      memory before any gateway fallback and to honor
      `shouldProbeOpenClawGateway(detail)` before live probing
- [x] preserved the legacy gateway fallback only for transient detail-fetch
      failures where no fresh detail truth is available
- [x] re-ran the focused instances regression, the canonical instances gate,
      and the full lint gate

Verification executed in this iteration:

- focused workspace-loaded `instanceWorkbenchService.test.ts` regression via
  `scripts/run-node-typescript-check.mjs`
- `pnpm.cmd check:sdkwork-instances`
- `pnpm.cmd lint`

Immediate next step:

- continue upward into launched-session evidence for built-in OpenClaw
  `online` convergence, websocket reachability, instance-detail runtime truth,
  and console-open behavior on top of the now-hardened backend-vs-gateway
  authority rules

## 2026-04-06 Iteration Update: OpenClaw Console Availability Runtime Truth

Completed in this iteration:

- [x] reproduced the shared-runtime truth gap where host-studio and desktop
      still inferred OpenClaw console availability from URL derivation for
      remote/local-external instances
- [x] wrote red Rust regressions proving offline remote/local-external
      OpenClaw instances must not expose console launch
- [x] preserved green coverage for online remote/local-external console
      projection so the fix could not collapse into "always unavailable"
- [x] changed
      `packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs`
      `build_console_access(...)` to require runtime `online` truth before
      exposing console availability
- [x] changed
      `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`
      `build_openclaw_console_access(...)` to require runtime `online` truth
      before exposing console availability / auto-login for external and remote
      OpenClaw instances
- [x] re-ran the focused host-studio and desktop Rust regressions covering both
      offline and online console projection paths

Verification executed in this iteration:

- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-host-studio/src-host/Cargo.toml hides_console_launch_while_runtime_is_offline`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml hides_console_launch_while_runtime_is_offline`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-host-studio/src-host/Cargo.toml console_launch`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-host-studio/src-host/Cargo.toml default_provider_local_external_openclaw_detail_exposes_console_access_without_workbench`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml console_launch`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml local_external_openclaw_detail_reads_install_record_for_console_auto_login`
- `cargo test --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml remote_openclaw_instance_detail_does_not_reuse_built_in_local_workbench`

Immediate next step:

- continue upward into launched-session proof for built-in OpenClaw startup,
  websocket reachability, proxy-router convergence, and chat/notification/cron
  behavior on top of the corrected shared console/runtime truth

## 2026-04-06 Iteration Update: OpenClaw Offline Chat Route Runtime Truth

Completed in this iteration:

- [x] reproduced the chat-route truth gap where offline external/remote
      OpenClaw instances still published `instanceOpenClawGatewayWs`
- [x] added focused red regressions in
      `packages/sdkwork-agentstudio-pc-chat/src/services/instanceChatRouteService.test.ts`
      for offline `local-external` and `remote` OpenClaw instances
- [x] added matching contract assertions in
      `scripts/sdkwork-chat-contract.test.ts`
- [x] changed
      `packages/sdkwork-agentstudio-pc-chat/src/services/instanceChatRouteService.ts`
      so all OpenClaw deployments require `status === 'online'` before
      publishing a gateway WebSocket route
- [x] preserved deployment-specific offline reasons without changing online
      route behavior
- [x] re-ran the focused route regression, the chat contract gate, the full
      chat check, and the full lint gate

Verification executed in this iteration:

- focused TypeScript check for
  `packages/sdkwork-agentstudio-pc-chat/src/services/instanceChatRouteService.test.ts`
- focused TypeScript check for `scripts/sdkwork-chat-contract.test.ts`
- `node scripts/run-sdkwork-chat-check.mjs`
- `pnpm.cmd lint`

Immediate next step:

- continue upward into launched-session proof for built-in OpenClaw startup,
  websocket reachability, proxy-router convergence, and chat/notification/cron
  behavior on top of the now-unified chat/runtime truth

## 2026-04-06 Iteration Update: Desktop Hosted Readiness Gateway Invoke Capability

Completed in this iteration:

- [x] reproduced the hosted-readiness gap where desktop bootstrap could accept
      lifecycle/url projection success even while the host omitted
      `manage.openclaw.gateway.invoke` from `availableCapabilityKeys`
- [x] added a focused red regression in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
      for capability-unavailable managed OpenClaw startup
- [x] extended
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts`
      readiness evidence with gateway invoke capability support/availability
      tracking
- [x] changed desktop readiness so managed OpenClaw startup now requires the
      gateway invoke capability to be available before returning success
- [x] updated `scripts/sdkwork-host-runtime-contract.test.ts` so the bridge is
      contract-locked to the capability-aware readiness path
- [x] re-ran the focused bridge regression, host-runtime contract, desktop
      gate, and full lint gate

Verification executed in this iteration:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Immediate next step:

- continue into server/control-plane capability truth for
  `manage.openclaw.gateway.invoke`, then keep moving upward into launched-session
  built-in OpenClaw startup, websocket reachability, proxy-router convergence,
  and chat/notification/cron behavior

## 2026-04-06 Iteration Update: Server Control-Plane Gateway Invoke Capability Truth

Completed in this iteration:

- [x] reproduced the shared-host capability-truth gap where
      `ControlPlaneManageOpenClawProvider::gateway_invoke_is_available(...)`
      returned a hardcoded `false`
- [x] added a focused red bootstrap regression in
      `packages/sdkwork-agentstudio-pc-server/src-host/src/bootstrap.rs` for the real
      control-plane-backed provider when the managed gateway lifecycle is ready
- [x] added a focused red route regression in
      `packages/sdkwork-agentstudio-pc-server/src-host/src/main.rs` proving
      `/claw/internal/v1/host-platform` must publish
      `manage.openclaw.gateway.invoke` once the real control-plane gateway is
      ready
- [x] changed
      `packages/sdkwork-agentstudio-pc-server/src-host/src/bootstrap.rs` so server
      control-plane invoke availability now follows the projected gateway
      lifecycle truth
- [x] re-ran the focused red-green regressions, full `check:server`,
      shared host-runtime contract, and full lint gate

Verification executed in this iteration:

- `cargo test control_plane_manage_openclaw_provider_reports_gateway_invoke_available_when_gateway_is_ready --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml`
- `cargo test internal_host_platform_route_reports_gateway_invoke_available_when_control_plane_gateway_is_ready --manifest-path packages/sdkwork-agentstudio-pc-server/src-host/Cargo.toml`
- `pnpm.cmd check:server`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd lint`

Immediate next step:

- continue upward into launched-session proof for built-in OpenClaw startup,
  WebSocket reachability, proxy-router convergence, and chat/notification/cron
  behavior on top of the now-aligned shared invoke-capability truth

## 2026-04-06 Iteration Update: OpenClaw WebSocket Base-Path Truth

Completed in this iteration:

- [x] reproduced the desktop built-in OpenClaw websocket drift where live-state
      projection ignored `gateway.controlUi.basePath`
- [x] added a focused Rust red regression in
      `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`
      for built-in detail websocket projection with `/openclaw`
- [x] changed desktop built-in live-state projection to read the managed config
      and reuse the canonical gateway websocket helper while keeping HTTP
      `baseUrl` rooted at `http://127.0.0.1:{port}`
- [x] reproduced the local-external OpenClaw onboarding websocket drift where
      discovery and association ignored `gateway.controlUi.basePath`
- [x] added focused TypeScript red regressions in
      `packages/sdkwork-agentstudio-pc-instances/src/services/instanceOnboardingService.test.ts`
      for discovery and association websocket metadata
- [x] changed
      `packages/sdkwork-agentstudio-pc-instances/src/services/instanceOnboardingService.ts`
      to normalize `controlUi.basePath` and append it to config-derived
      websocket URLs
- [x] re-ran the focused desktop Rust regressions, the focused TypeScript
      onboarding regression, `pnpm.cmd check:desktop`, and `pnpm.cmd lint`

Verification executed in this iteration:

- `cargo test built_in_instance_detail_projects_control_ui_base_path_into_live_gateway_websocket_url --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test built_in_instance_detail_exposes_console_access_with_auto_login_url --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test built_in_instance_detail_hides_live_gateway_endpoints_when_the_gateway_is_not_running --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `pnpm.cmd check:desktop`
- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-instances/src/services/instanceOnboardingService.test.ts']))"`
- `pnpm.cmd lint`

Immediate next step:

- continue into launched-session proof for built-in OpenClaw startup, gateway
  readiness, websocket reachability, browser fallback review, and then the
  remaining chat/notification/cron/proxy-router validation on top of the now
  aligned websocket-authority contract

## 2026-04-06 Iteration Update: Managed Gateway Projection Base-Path Truth

Completed in this iteration:

- [x] reproduced the remaining desktop Rust host drift where
      `managed_openclaw_gateway_endpoint(...)` still projected
      `ws://127.0.0.1:{port}` without `gateway.controlUi.basePath`
- [x] added a focused Rust red regression in
      `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`
      proving host-endpoint, runtime, and gateway projections must publish the
      configured control-ui websocket path
- [x] changed
      `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs`
      so `get_host_endpoints(...)`, `get_openclaw_runtime(...)`, and
      `get_openclaw_gateway(...)` now resolve the managed gateway websocket URL
      through the config-backed control-ui path
- [x] hardened the shared websocket fallback builder so it no longer drops the
      resolved gateway path when only host/port metadata is available
- [x] re-ran the focused Rust regressions, full `pnpm.cmd check:desktop`, and
      full `pnpm.cmd lint`

Verification executed in this iteration:

- `cargo test managed_openclaw_gateway_projection_projects_control_ui_base_path_into_websocket_url --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `cargo test built_in_instance_detail_projects_control_ui_base_path_into_live_gateway_websocket_url --manifest-path packages/sdkwork-agentstudio-pc-desktop/src-tauri/Cargo.toml`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Immediate next step:

- continue from projection truth into live launched-session evidence for actual
  websocket dialability, then keep moving upward into chat, notification, cron,
  proxy-router, and instance-detail validation on top of the now-aligned
  managed OpenClaw host contract

## 2026-04-06 Iteration Update: Desktop Hosted Runtime WebSocket Dialability

Completed in this iteration:

- [x] reproduced the remaining readiness gap where desktop bootstrap still
      treated managed OpenClaw websocket metadata as readiness proof without
      verifying that the socket could actually be dialed
- [x] added focused red-green regression coverage in
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
      for both dial-success and dial-failure readiness paths
- [x] extended
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.ts`
      readiness evidence with:
      - `gatewayWebsocketProbeSupported`
      - `gatewayWebsocketDialable`
- [x] changed hosted readiness enforcement so the managed OpenClaw websocket
      must accept a real connection attempt before desktop startup returns
      success
- [x] kept websocket probing explicit-only and injected the real browser
      `WebSocket` from
      `packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts` so Node-based
      contract tests do not probe ambient runtime sockets by accident
- [x] re-ran the focused bridge regression, host-runtime contract, desktop
      gate, and full lint gate

Verification executed in this iteration:

- `node scripts/run-sdkwork-desktop-check.mjs packages/sdkwork-agentstudio-pc-desktop/src/desktop/desktopHostedBridge.test.ts`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Immediate next step:

- review browser-only hosted fallback normalization in
  `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts` so no
  renderer-side fallback can override the canonical managed runtime truth now
  enforced by the host and desktop readiness bridge

## 2026-04-06 Iteration Update: Desktop Bridge Preservation

Completed in this iteration:

- [x] reproduced the remaining overwrite path where the infrastructure-level
      hosted-browser bridge installers still accepted calls after the desktop
      bridge was already active
- [x] added red regressions in
      `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/serverBrowserBridge.test.ts`
      proving:
      - direct hosted-browser bridge installation must not replace desktop
        authority
      - structured bootstrap descriptor fetches must not run once desktop
        authority is active
- [x] hardened
      `packages/sdkwork-agentstudio-pc-infrastructure/src/platform/serverBrowserBridge.ts`
      so both `configureServerBrowserPlatformBridge(...)` and
      `bootstrapServerBrowserPlatformBridge(...)` short-circuit while the active
      bridge platform is `desktop`
- [x] added `scripts/run-sdkwork-foundation-check.mjs`
- [x] upgraded `check:sdkwork-foundation` in `package.json` so the standard
      verification path now includes the infrastructure source tests in addition
      to the contract test
- [x] re-ran the foundation, shell, and desktop verification gates after the
      lower-level guard was added

Verification executed in this iteration:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-infrastructure/src/platform/serverBrowserBridge.test.ts']))"`
- `node scripts/run-sdkwork-foundation-check.mjs`
- `pnpm.cmd check:sdkwork-foundation`
- `pnpm.cmd check:sdkwork-shell`
- `pnpm.cmd check:desktop`

Immediate next step:

- continue with launched-session and cross-host review for chat, notification,
  cron, proxy router, and instance detail now that both the shell layer and the
  infrastructure layer preserve desktop authority

## 2026-04-06 Iteration Update: Chat Service Authority Alignment

Completed in this iteration:

- [x] reproduced the remaining chat-entry bug where
      `packages/sdkwork-agentstudio-pc-chat/src/services/chatService.ts` still resolved
      route truth from `studio.getInstance(...)` while the rest of the OpenClaw
      chat stack had already moved to authoritative instance detail truth
- [x] added a focused red regression in
      `packages/sdkwork-agentstudio-pc-chat/src/services/chatService.test.ts` proving the
      built-in OpenClaw snapshot/detail mismatch must report "not chat-ready"
      instead of announcing the native gateway route
- [x] changed `packages/sdkwork-agentstudio-pc-chat/src/services/chatService.ts` to use
      `resolveAuthoritativeInstanceChatRoute(...)`
- [x] upgraded `scripts/run-sdkwork-chat-check.mjs` so the new regression is
      part of the standard chat verification gate
- [x] re-ran the focused regression and the full chat check

Verification executed in this iteration:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-chat/src/services/chatService.test.ts']))"`
- `pnpm.cmd check:sdkwork-chat`

Immediate next step:

- continue upward into notification, cron, proxy-router, and instance-detail
  launched-session review so every user-facing OpenClaw path consumes the same
  authoritative runtime truth

## 2026-04-06 Iteration Update: Instance Workbench Task Create/Update Authority

Completed in this iteration:

- [x] reproduced the remaining authority split where
      `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`
      still routed task create/update by raw OpenClaw runtime kind instead of
      backend workbench truth
- [x] added a focused red regression in
      `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
      proving backend-authored built-in OpenClaw workbench sessions must keep
      task create/update on the studio bridge
- [x] added `hasWorkbench(detail)` and changed `createTask(...)` /
      `updateTask(...)` so direct gateway cron writes are used only when the
      backend workbench is absent
- [x] added `scripts/run-sdkwork-instances-check.mjs`
- [x] upgraded `check:sdkwork-instances` in `package.json` so the standard
      verification path now includes focused instances source tests before the
      existing contract test
- [x] re-ran the focused regression, the new instances source-test gate, and
      the full `check:sdkwork-instances` command

Verification executed in this iteration:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts']))"`
- `node scripts/run-sdkwork-instances-check.mjs`
- `pnpm.cmd check:sdkwork-instances`

Immediate next step:

- continue the same authority review upward into notification, proxy-router,
  and instance-detail launched-session behavior so every OpenClaw user path
  consumes one consistent backend-vs-gateway truth

## 2026-04-06 Iteration Update: Active Instance Selection Authority

Completed in this iteration:

- [x] reproduced the rule drift where `Instances.tsx` and `InstanceDetail.tsx`
      hid "set as active" behind `instance.status === 'online'` even though the
      shell switchers and store already accept any known instance id
- [x] added focused red coverage in
      `packages/sdkwork-agentstudio-pc-instances/src/services/instanceActionCapabilities.test.ts`
      proving offline instances must remain selectable as the active context
- [x] extended
      `packages/sdkwork-agentstudio-pc-instances/src/services/instanceActionCapabilities.ts`
      with shared `canSetActive` truth
- [x] rewired the explicit active-instance actions in
      `packages/sdkwork-agentstudio-pc-instances/src/pages/Instances.tsx` and
      `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` to consume
      the shared capability instead of page-local snapshot checks
- [x] re-ran the focused regression and the instances verification gate

Verification executed in this iteration:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-instances/src/services/instanceActionCapabilities.test.ts']))"`
- `node scripts/run-sdkwork-instances-check.mjs`

Immediate next step:

- continue the same authority review upward into notification, proxy-router,
  and instance-detail launched-session behavior so active-instance context,
  runtime truth, and backend-vs-gateway authority stay aligned end to end

## 2026-04-06 Iteration Update: Config-Backed OpenClaw Gateway Readiness

Completed in this iteration:

- [x] reproduced the readiness gap where
      `hasReadyOpenClawGateway(...)` still reduced config-backed OpenClaw
      gateway readiness to `instance.status === 'online'`
- [x] added red regressions in
      `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.test.ts`
      for runtime-observed local-external OpenClaw readiness with stale offline
      status
- [x] added a red service-level regression in
      `packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
      proving `applyManagedOpenClawConfigDocument(...)` must still use the
      gateway apply bridge when runtime observation proves readiness
- [x] changed
      `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.ts`
      so gateway readiness now accepts `endpointObserved === true` plus
      non-offline health as a second authoritative ready path
- [x] re-ran the focused shared-capability and service regressions

Verification executed in this iteration:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.test.ts','packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts']))"`

Immediate next step:

- continue the same authority review upward into notification, proxy-router,
  and instance-detail launched-session behavior so config-backed readiness,
  active-instance context, and backend-vs-gateway truth stay aligned end to end

## 2026-04-06 Iteration Update: Tauri CLI Local Runner Hardening

Completed in this iteration:

- [x] reproduced the desktop CLI launch failure caused by hardcoded
      `tauri.cmd`
- [x] proved that `pnpm exec tauri` was also not a safe fallback in the current
      environment
- [x] added red regressions in `scripts/run-tauri-cli.test.mjs` and
      `scripts/tauri-dev-command-contract.test.mjs`
- [x] hardened `scripts/run-tauri-cli.mjs` to resolve
      `@tauri-apps/cli/tauri.js` locally and launch it through `node`
- [x] rewired desktop `tauri:info` and `tauri:icon` to the shared runner
- [x] re-ran focused tests, real command-path validation, `check:desktop`, and
      `lint`

Verification executed in this iteration:

- `node scripts/run-tauri-cli.test.mjs`
- `node scripts/tauri-dev-command-contract.test.mjs`
- `node scripts/check-desktop-platform-foundation.mjs`
- `node scripts/run-tauri-cli.mjs info`
- `pnpm.cmd --dir packages/sdkwork-agentstudio-pc-desktop tauri:info`
- `pnpm.cmd check:desktop`
- `pnpm.cmd lint`

Immediate next step:

- continue from the repaired desktop CLI launch path into real launched-session
  validation for built-in OpenClaw startup, hosted readiness, proxy routing,
  notification, cron, and instance-detail behavior

