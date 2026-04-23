# 安装与部署

## 先选对产物类型

| 产物家族 | 典型输出 | 支持目标 | 适用场景 |
| --- | --- | --- | --- |
| Desktop | 安装器与应用包 | Windows、Linux、macOS | 需要原生桌面应用 |
| Server | 含内置 Web 资源的原生归档包 | Windows、Linux、macOS | 需要独立浏览器管理型服务 |
| Container | 面向 Docker 的部署包 | Linux `x64` 与 `arm64` | 使用 Docker / Compose 部署 |
| Kubernetes | Helm 兼容部署包 | Linux `x64` 与 `arm64` | 部署到 Kubernetes |
| Web | 静态 Web 与 docs 归档 | web | 只需要静态资源 |

## 基于源码的本地安装

### Web

```bash
pnpm install
pnpm dev
```

### 桌面端

```bash
pnpm install
pnpm tauri:dev
```

### Server

```bash
pnpm install
pnpm build
pnpm server:dev
```

当你希望原生 Server 提供当前构建出的浏览器界面时，先执行 `pnpm build` 再执行 `pnpm server:dev`。

## 默认访问入口

| 模式 | 默认或典型入口 |
| --- | --- |
| Web 工作区 | `http://localhost:3001` |
| 桌面端运行时 | 执行 `pnpm tauri:dev` 后打开原生窗口 |
| 原生 Server | 默认 `http://127.0.0.1:18797` |
| Container | 由部署包映射出的宿主端口 |
| Kubernetes | ingress 域名或 service 地址 |

## 桌面端安装说明

### Windows

桌面端发布产物通常会包含 `.exe` 或 `.msi` 等 Windows 安装器格式。

### Linux

桌面端发布产物通常会包含 `.deb`、`.rpm` 和 `.AppImage`。

### macOS

桌面端发布产物通常会包含 `.dmg` 和归档后的 `.app` 包。

## 原生 Server 安装说明

### Server 包结构

打包后的 Server 归档中包含：

- `bin/` 下的 Rust Server 二进制
- `web/dist/` 下的浏览器应用
- `.env.example`
- 可选启动包装脚本
- 包内 README

### Windows

```powershell
.\bin\claw-server.exe
```

### Linux 与 macOS

```bash
./bin/claw-server
```

当从解压后的 bundle 中直接启动原生二进制时，会默认：

- 将 `CLAW_SERVER_WEB_DIST` 指向包内的 `web/dist`
- 将 `CLAW_SERVER_DATA_DIR` 指向解压目录下的 `.claw-server`

`start-claw-server.cmd` 与 `start-claw-server.sh` 仍然是可选的便捷包装脚本，它们调用的是同一个原生二进制，并保持相同的 bundle 默认值。

## 安装后验证

### Server

检查 readiness：

```bash
curl http://127.0.0.1:18797/claw/health/ready
```

读取 discovery：

```bash
curl http://127.0.0.1:18797/claw/api/v1/discovery
```

下载 OpenAPI 文档：

```bash
curl http://127.0.0.1:18797/claw/openapi/v1.json
```

### 启用 Basic Auth 的 Server

```bash
curl -u operator:manage-secret \
  http://127.0.0.1:18797/claw/manage/v1/rollouts
```

### Desktop

桌面端启动后，至少完成以下检查：

1. 确认窗口正常拉起
2. 打开关键设置或管理页面
3. 确认 provider 或 host 状态数据能正常加载，没有 bridge 错误

## Docker 部署

容器镜像会直接启动规范的 `app/bin/claw-server` 原生二进制，而不是通过可选的 shell wrapper 间接启动。

以下命令需要在解压后的 bundle 根目录执行。Compose 文件会从 `deploy/docker/profiles/*` 解析环境覆盖项，并把 bundle 根目录作为 Docker build context。

基础部署：

```bash
docker compose -f deploy/docker/docker-compose.yml up -d
```

NVIDIA CUDA 覆盖层：

```bash
docker compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.nvidia-cuda.yml up -d
```

AMD ROCm 覆盖层：

```bash
docker compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.amd-rocm.yml up -d
```

## Kubernetes 部署

```bash
helm upgrade --install claw-studio ./chart -f values.release.yaml
```

## 打包前校验

```bash
pnpm check:server
pnpm check:automation
pnpm release:plan
```

本地打包前置条件：

- `pnpm release:package:desktop` 只会收集已经生成完成的桌面安装器与应用包，需要先执行 `pnpm release:desktop` 或 `pnpm tauri:build`。
- `pnpm release:package:server` 在使用根级本地 wrapper 时会先刷新对应 target 的原生 Server release 二进制。这个构建仍然是增量的，但可以保证打包时使用的是当前 target 的最新产物，而不是之前遗留的旧二进制。
- `pnpm release:package:container` 在使用根级本地 wrapper 时会先刷新匹配目标架构的 Linux Server 二进制。在 Windows 上，如果已经安装 WSL 发行版，`pnpm server:build -- --target x86_64-unknown-linux-gnu` 会自动通过 WSL 构建；在 macOS 上，这条回退路径仍然需要显式准备对应的 Rust target 与 cross-build toolchain。
- `pnpm release:package:kubernetes` 只打包 chart 与 values 资产，因此不依赖本地先构建 Server 二进制。
- `pnpm release:finalize` 会读取当前 release 资产目录中的 family manifest。本地 wrapper 默认目录是 `artifacts/release`，GitHub workflow 使用的是 `release-assets/`。本地执行时，`release-manifest.json.repository` 会依次从 `SDKWORK_RELEASE_REPOSITORY`、`GITHUB_REPOSITORY`、`git remote origin` 推断；对于 `container` / `kubernetes`，结构化的 `status=skipped` deployment smoke 证据也会被原样保留，而不是被错误地视为通过。

## 常见运维操作

### 重启打包后的 Server Bundle

Windows：

```powershell
taskkill /IM claw-server.exe /F
.\bin\claw-server.exe
```

Linux 或 macOS：

```bash
pkill -f claw-server || true
./bin/claw-server
```

这些是针对打包后原生二进制的直接进程操作示例。包装脚本仍可用于本地运维便捷启动，但 `bin/` 下的二进制才是打包交付的规范入口。如果你把原生 Server 安装为系统服务，请优先使用 `claw-server service start|stop|restart|status`，这样 CLI、浏览器管理和服务清单投影会保持一致。

### 安装为受管系统服务

当前打包后的 Server bundle 会在 `bin/` 目录下提供原生 service-capable 二进制，作为规范运行入口；`start-claw-server.sh` 与 `start-claw-server.cmd` 只是围绕同一原生二进制的可选便捷包装层。

Windows：

```powershell
.\bin\claw-server.exe service install
.\bin\claw-server.exe service status
```

Linux 或 macOS：

```bash
./bin/claw-server service install
./bin/claw-server service status
```

如果需要先审阅即将投影出来的服务单元，可以执行 `service print-manifest --platform <linux|macos|windows>`。`service install/start/stop/restart/status` 默认会使用当前平台，但仍然要求操作者具备对应系统服务管理器所需的权限。

### 查看 Container 部署状态

```bash
docker compose -f deploy/docker/docker-compose.yml ps
docker compose -f deploy/docker/docker-compose.yml logs --tail=200
```

### 查看 Kubernetes 部署状态

```bash
helm status claw-studio
kubectl get pods
kubectl get svc
```

### 验证浏览器可访问性

优先检查：

- `/claw/health/ready`
- `/claw/api/v1/discovery`
- `/claw/openapi/v1.json`

## 当前服务管理器边界

当前原生 Server 运行时已经内建 `systemd`、`launchd` 和 `Windows Service` 风格的服务生命周期支持。非 service 安装应优先使用 `./bin/claw-server` 或 `.\bin\claw-server.exe` 作为打包后的规范入口，`start-claw-server.sh` 与 `start-claw-server.cmd` 仅作为本地运维便捷包装脚本存在。`./bin/claw-server service *`、`.\bin\claw-server.exe service *` 与逻辑命令面 `claw-server service *` 共享同一套受管服务入口。真正的安装、启动与停止仍然通过宿主操作系统自己的服务管理器完成，因此需要对应的平台权限。
