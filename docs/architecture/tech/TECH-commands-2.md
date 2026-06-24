> Migrated from `docs/zh-CN/reference/commands.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 命令参考

## 工作区命令

| 命令 | 作用 |
| --- | --- |
| `pnpm install` | 安装工作区依赖 |
| `pnpm dev` | 启动 Web 开发服务器 |
| `pnpm build` | 构建 Web 包 |
| `pnpm preview` | 预览 Web 构建产物 |
| `pnpm lint` | 执行 TypeScript、架构与 parity 校验 |
| `pnpm clean` | 清理 Web 构建产物 |

## 架构与对齐校验

| 命令 | 作用 |
| --- | --- |
| `pnpm check:arch` | 校验分包边界、目录结构与包根导入规则 |
| `pnpm check:parity` | 校验关键行为与 `upgrade/claw-studio-v5` 的对齐情况 |
| `pnpm sync:features` | 同步仓库维护的 feature package 接线脚本 |

## 桌面端命令

| 命令 | 作用 |
| --- | --- |
| `pnpm tauri:dev` | 启动桌面端开发环境并拉起 Tauri |
| `pnpm tauri:build` | 构建桌面端安装包与发布产物 |
| `pnpm tauri:icon` | 重新生成桌面端图标资源 |
| `pnpm tauri:info` | 输出 Tauri 环境信息 |
| `pnpm check:desktop` | 校验桌面端运行时与命令契约 |
| `pnpm check:desktop-openclaw-runtime` | 校验内置 OpenClaw 运行时的升级就绪度、打包元数据与 release 资产契约 |
| `pnpm release:desktop` | 执行 CI 使用的桌面端 release 构建入口 |
| `pnpm release:package:desktop` | 将已经构建完成的桌面端安装器与校验文件收集到 `artifacts/release`；需要先执行 `pnpm release:desktop` 或 `pnpm tauri:build` |
| `pnpm release:package:web` | 重新构建、归档、校验并 smoke 真实 Web/docs 产物到 `artifacts/release` |

## Server 与部署命令

| 命令 | 作用 |
| --- | --- |
| `pnpm server:dev` | 以开发模式启动原生 Rust Server |
| `pnpm server:build` | 构建原生 Rust Server 二进制，可追加 `-- --target <triple>` 指定目标三元组；在 Windows 上如果已安装 WSL 发行版，构建 Linux target 时会自动桥接到 WSL |
| `pnpm check:multi-mode` | 运行本地最高信号门禁，一次覆盖 desktop、server、统一 host runtime、OpenClaw 就绪度与 release 打包契约 |
| `pnpm check:server` | 校验 Server 结构并运行 Rust 测试 |
| `pnpm check:sdkwork-host-runtime` | 校验跨 desktop、server、docker、kubernetes 的统一运行时 authority 与 smoke 契约 |
| `pnpm release:plan` | 解析当前 multi-family release 矩阵 |
| `pnpm release:package:server` | 打包原生 Server 归档到 `artifacts/release`；根级本地 wrapper 会先对对应 target 执行一次增量构建，确保打包使用的是最新的原生 Server 二进制 |
| `pnpm release:package:container` | 打包 Docker 部署包到 `artifacts/release`；根级本地 wrapper 会先对匹配 target 的 Linux Server 二进制执行一次增量构建；在 Windows 上这一步可以自动复用 WSL |
| `pnpm release:package:kubernetes` | 打包 Kubernetes 部署包到 `artifacts/release`；只处理 chart 与 values 产物，不要求本地先构建 Server 二进制 |
| `pnpm release:smoke:desktop` | 对已打包的桌面端目标重新执行 installer smoke 与启动态 smoke |
| `pnpm release:smoke:desktop-packaged-launch` | 启动指定目标的标准桌面安装产物并捕获隔离的 packaged-session 启动证据 |
| `pnpm release:smoke:desktop-startup` | 校验已捕获的桌面端启动证据；写入报告前会拒绝不安全或非规范的 `artifactRelativePaths` 与 `capturedEvidenceRelativePath`，然后生成标准化的 `desktop-startup-smoke-report.json` |
| `pnpm release:smoke:server` | 对已打包的 Server 产物重新执行 bundle 运行态 smoke；写入 `release-smoke-report.json` 前会拒绝不安全或非规范的 `artifactRelativePaths` 与 `launcherRelativePath` |
| `pnpm release:smoke:web` | 对已打包的 Web/docs 归档重新执行内容 smoke；写入 `release-smoke-report.json` 前会拒绝不安全或非规范的 `artifactRelativePaths` |
| `pnpm release:smoke:container` | 对已打包的 Docker 部署 bundle 重新执行 deployment smoke |
| `pnpm release:smoke:kubernetes` | 对已打包的 Kubernetes chart bundle 重新执行渲染与就绪性 smoke |
| `pnpm release:finalize` | 严格归并所有 family manifest，要求 `release-notes.md` 已在 active release 资产目录中渲染完成，并写入顶层 `releaseMetadata`；拒绝跨 profile partial manifest，并通过 shared smoke path contract 复核不安全或非规范的 artifact、launcher、captured evidence 路径；只有 release profile 的全部目标都存在时才生成最终 `release-manifest.json`。最终 `SHA256SUMS.txt` 会覆盖 artifact 与 release metadata。本地 wrapper 会依次从 `SDKWORK_RELEASE_REPOSITORY`、`GITHUB_REPOSITORY`、`git remote origin` 推断 `repository` |
| `pnpm release:assert-ready` | 发布前最终门禁：重新读取 `release-manifest.json` 和 `SHA256SUMS.txt`，拒绝 `releaseCoverage.status=partial`、拒绝 `--allow-partial-release` 生成的清单，校验每个 artifact 与 `releaseMetadata` 的 checksum 和 size，要求 `release-notes.md` 同时被 `releaseMetadata`、`SHA256SUMS.txt`、`release-attestations.json` 覆盖，并要求每个 artifact 保留对应家族的 smoke 元数据（`desktopInstallerSmoke`、`desktopStartupSmoke`、`webArchiveSmoke`、`serverBundleSmoke` 或 `deploymentSmoke`），且 `reportRelativePath`、`manifestRelativePath` 与桌面 `capturedEvidenceRelativePath` 指向的证据文件仍然存在，并且与引用的 smoke report 内容一致 |
| `pnpm release:finalize:partial` | 仅用于本地调试不完整 release 资产目录；会传入 `--allow-partial-release`，并把 `release-manifest.json.releaseCoverage.status` 标记为 `partial` |

## 发布与 CI 自动化

| 命令 | 作用 |
| --- | --- |
| `pnpm check:release-flow` | 校验 release workflow、打包和发布清单契约 |
| `pnpm check:ci-flow` | 校验主线 CI workflow 契约 |
| `pnpm check:automation` | 执行完整的发布与 CI 自动化校验套件 |

## 文档命令

| 命令 | 作用 |
| --- | --- |
| `pnpm docs:dev` | 启动 VitePress 文档站 |
| `pnpm docs:build` | 构建 VitePress 文档站 |
| `pnpm docs:preview` | 预览 VitePress 构建结果 |

## 针对单个包执行

```bash
pnpm --filter @sdkwork/claw-web build
pnpm --filter @sdkwork/claw-desktop tauri:info
pnpm --filter @sdkwork/claw-market lint
```
## 发布证据完整性补充

`pnpm release:assert-ready` 会复核 `reportRelativePath`、`manifestRelativePath` 与桌面 `capturedEvidenceRelativePath` 指向的证据文件是否仍在 release 资产目录内，同时要求 `reportSha256`、`manifestSha256`、`capturedEvidenceSha256` 以及对应 sha256/size 绑定仍然匹配，并继续比对引用的 smoke report 内容。

> 顶层 manifest 完整性：`pnpm release:finalize` 会输出 `release-manifest.json.sha256.txt`；`pnpm release:assert-ready` 会先验证该 sidecar 与 `release-manifest.json` 匹配，再继续校验 `SHA256SUMS.txt`、artifact checksum/size、smoke evidence sha256/size 和 smoke report 内容。
## release-attestations.json

`pnpm release:write-attestation-evidence` 会在最终资产完成 GitHub artifact attestation 后运行，对每个 `release-manifest.json` artifact 和每个 `releaseMetadata` 条目（包括 `release-notes.md`）执行 `gh attestation verify`，要求 digest 与 manifest 中的 `sha256` 一致，并写入 `release-attestations.json`。`pnpm release:assert-ready` 会继续校验 `relativePath`、`sha256`、`repository`、`releaseTag`、`sourceRef`、`predicateType`，防止 provenance 证据与最终发布主体漂移。

`pnpm release:write-attestation-evidence` 还必须使用 `gh attestation verify --signer-workflow <owner/repo/.github/workflows/release-reusable.yml>` 绑定发布 reusable workflow，并写入 `signerWorkflow` 与 `signerWorkflowIdentity`。`pnpm release:assert-ready` 会拒绝缺少 signer workflow identity、`--signer-workflow` 命令约束或与最终 `release-manifest.json` 不一致的证明证据。

