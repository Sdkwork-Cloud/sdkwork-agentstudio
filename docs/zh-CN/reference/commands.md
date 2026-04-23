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
| `pnpm release:package:web` | 将 Web 与 docs 产物打包到 `artifacts/release` |

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
| `pnpm release:smoke:desktop-startup` | 校验已捕获的桌面端启动证据，并生成标准化的 desktop startup smoke 报告 |
| `pnpm release:smoke:server` | 对已打包的 Server 产物重新执行 bundle 运行态 smoke |
| `pnpm release:smoke:container` | 对已打包的 Docker 部署 bundle 重新执行 deployment smoke |
| `pnpm release:smoke:kubernetes` | 对已打包的 Kubernetes chart bundle 重新执行渲染与就绪性 smoke |
| `pnpm release:finalize` | 归并所有 family manifest、计算校验和并生成最终清单；本地默认输出目录为 `artifacts/release`。本地 wrapper 会依次从 `SDKWORK_RELEASE_REPOSITORY`、`GITHUB_REPOSITORY`、`git remote origin` 推断 `repository`，并保留 `container` / `kubernetes` 的结构化 `skipped` deployment smoke 证据 |

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
