# 发布与部署

## 总览

Claw Studio 现在发布的是统一的 multi-family release，而不是只有桌面端安装包。

当前发布系统会产出：

- `desktop` 桌面安装器与应用包
- `server` 原生 Rust Server 归档
- `container` 面向 Docker 的部署包
- `kubernetes` Helm 兼容部署包
- `web` 浏览器与 docs 静态归档

容器镜像的规范入口也已经收敛到 `app/bin/claw-server`，不再通过可选 shell wrapper 作为启动链路。

## 本地校验与打包

```bash
pnpm check:multi-mode
pnpm check:desktop
pnpm check:desktop-openclaw-runtime
pnpm check:server
pnpm check:sdkwork-host-runtime
pnpm check:automation
pnpm release:plan
pnpm release:package:desktop
pnpm release:package:server
pnpm release:package:container
pnpm release:package:kubernetes
pnpm release:package:web
pnpm release:smoke:desktop
pnpm release:smoke:desktop-packaged-launch -- --platform <platform> --arch <arch> --target <target>
pnpm release:smoke:desktop-startup -- --platform <platform> --arch <arch> --startup-evidence-path <path-to-desktop-startup-evidence.json>
pnpm release:smoke:server
pnpm release:smoke:container
pnpm release:smoke:kubernetes
```

这些命令会把对应产物收集到 `artifacts/release` 中，便于本地审阅或后续统一归并。

本地前置条件说明：

- `pnpm release:package:desktop` 只负责收集已经构建完成的桌面安装器和应用包，需要先执行 `pnpm release:desktop` 或 `pnpm tauri:build`。
- `pnpm release:smoke:desktop` 会重新执行桌面安装器 smoke，并为同一目标补齐 launched-session 启动证据与 `desktop-startup-smoke-report.json`。
- `pnpm release:smoke:desktop-packaged-launch` 会启动标准打包桌面端产物并捕获隔离的启动证据；在 Linux 无桌面显示时会自动尝试 `xvfb-run`。
- `pnpm release:smoke:desktop-startup` 只校验已捕获的桌面端启动证据，并把结果写回标准 release 资产路径。
- `pnpm release:package:server` 在使用根级本地 wrapper 时，会先刷新对应 target 的原生 Server release 二进制再归档。这个步骤仍然是增量构建，但不会再依赖旧 target 目录中遗留的历史产物。
- `pnpm release:smoke:server` 只对现有 Server 打包产物重新执行 bundle 运行态 smoke，不会重复打包。
- `pnpm release:package:container` 需要匹配架构的 Linux Server 二进制。根级本地 wrapper 现在会先对对应 target 执行一次增量构建，确保容器 bundle 使用的是最新 Linux 产物；在 Windows 上，`pnpm server:build -- --target x86_64-unknown-linux-gnu` 会优先自动桥接到已安装的 WSL 发行版；在 macOS 等非 Linux 主机上，这条回退路径仍然依赖显式准备好的 cross-build toolchain。
- `pnpm release:smoke:container` 会对当前打包的 Docker deployment bundle 重新执行 deployment smoke；当主机缺少 Docker 或 Docker Compose 时，会生成结构化 `skipped` 证据而不是伪造通过。
- `pnpm release:package:kubernetes` 只打包 chart 与 release values，不依赖本地 Server 二进制。
- `pnpm release:smoke:kubernetes` 会重新渲染 chart、校验镜像引用与持久化约束；当主机缺少 Helm 时，会生成结构化 `skipped` 证据。

本地 wrapper 默认把 `release:plan`、`release:package:*` 和 `release:finalize` 指向 `artifacts/release`。GitHub workflow 中仍然使用 `release-assets/` 作为聚合目录；如需覆盖本地默认值，可使用 `SDKWORK_RELEASE_OUTPUT_DIR`、`SDKWORK_RELEASE_ASSETS_DIR`、`SDKWORK_RELEASE_TARGET`、`SDKWORK_RELEASE_PLATFORM`、`SDKWORK_RELEASE_ARCH`、`SDKWORK_RELEASE_ACCELERATOR`、`SDKWORK_RELEASE_IMAGE_REPOSITORY`、`SDKWORK_RELEASE_IMAGE_TAG`、`SDKWORK_RELEASE_IMAGE_DIGEST`、`SDKWORK_RELEASE_TAG`、`SDKWORK_RELEASE_REPOSITORY` 等环境变量。

如果没有显式提供 `SDKWORK_RELEASE_REPOSITORY`，本地 wrapper 会继续回退到 `GITHUB_REPOSITORY`，再回退到本地 `git remote origin` 推断仓库标识，这样本地执行 `pnpm release:finalize` 时生成的 `release-manifest.json` 也会带上稳定的 `repository` 字段。

## Release Finalize 与清单契约

`pnpm release:finalize` 会在当前 release 聚合目录中归并所有 family manifest、生成 `SHA256SUMS.txt`，并输出最终的 `release-manifest.json`。

其中 `release-manifest.json` 不只是文件列表，还会保留顶层发布元数据，例如 `profileId`、`productName`、`releaseTag`、`generatedAt`、`checksumFileName` 和 `repository`，供下载门户、部署自动化和发布校验直接消费。

对于 `container` 和 `kubernetes` 产物，finalizer 只接受两类部署 smoke 结果：

- `status=passed`
- `status=skipped`，且必须同时携带非空 `skippedReason`

如果 smoke 阶段还探测到了主机能力，诸如 Docker、Docker Compose、Helm、`kubectl` 等信息也会保留到 `deploymentSmoke.capabilities`。这意味着本地主机缺少 Docker daemon、Docker Compose 或 Helm 时，部署 smoke 不会被伪装成通过，也不会因为能力缺失而丢失结构化证据；最终的 `release-manifest.json` 会原样保留 `deploymentSmoke.status`、`deploymentSmoke.skippedReason` 和 `deploymentSmoke.capabilities`。

## GitHub Workflow

发布入口在 `.github/workflows/release.yml`，它会调用 `.github/workflows/release-reusable.yml`。

当前工作流会构建：

- Windows、Linux、macOS 的桌面端产物
- Windows、Linux、macOS 的 Server 归档
- Linux `x64` 与 `arm64` 的 container bundle
- Linux `x64` 与 `arm64` 的 kubernetes bundle
- CPU、NVIDIA CUDA、AMD ROCm 等 accelerator profile
- 最终的 `release-manifest.json` 和 `SHA256SUMS.txt`

## 使用建议

- 选择 `desktop`：本地 GUI 优先安装
- 选择 `server`：Windows / Linux / macOS 上的原生服务端部署
- 选择 `container`：Docker / Compose 环境
- 选择 `kubernetes`：集群环境与 ingress 管理
- 选择 `web`：只需要浏览器静态资源和文档站
