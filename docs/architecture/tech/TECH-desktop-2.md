> Migrated from `docs/zh-CN/core/desktop.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 桌面运行时

## 总览

Claw Studio 通过 `@sdkwork/clawstudio-desktop` 提供 Tauri 桌面端运行时。它复用共享 Shell 和业务包，同时补充原生运行时接入、更新检查和桌面端打包能力。

## 重要路径

- `packages/sdkwork-clawstudio-desktop/src/main.tsx`
- `packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/createDesktopApp.tsx`
- `packages/sdkwork-clawstudio-desktop/src/desktop/catalog.ts`
- `packages/sdkwork-clawstudio-desktop/src/desktop/runtime.ts`
- `packages/sdkwork-clawstudio-desktop/src/desktop/providers/DesktopProviders.tsx`
- `packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts`
- `packages/sdkwork-clawstudio-desktop/src-tauri/`

## 启动桌面开发环境

```bash
pnpm tauri:dev
```

桌面端会通过专用的 Vite 命令在 `127.0.0.1:1426` 启动开发服务器，再拉起 Tauri。

## 构建桌面应用

```bash
pnpm tauri:build
```

常用辅助命令：

```bash
pnpm tauri:info
pnpm tauri:icon
pnpm check:desktop
```

桌面端现在已经并入统一 release family，同时和 server、container、kubernetes、web 产物并行发布。

## 环境变量模型

桌面端行为依赖 infrastructure 层中的强类型环境配置。常见变量包括：

- `VITE_API_BASE_URL`
- `VITE_APP_ID`
- `VITE_RELEASE_CHANNEL`
- `VITE_DISTRIBUTION_ID`
- `VITE_PLATFORM`
- `VITE_TIMEOUT`
- `VITE_ENABLE_STARTUP_UPDATE_CHECK`

桌面 Shell 不应通过 Vite env 注入 root access token；有权限的凭据应保留在可信宿主或宿主代理认证链路中。

## 桌面端架构说明

- 桌面入口包应保持轻量
- Shell 组合逻辑应继续放在 `@sdkwork/clawstudio-shell`
- 更新、配置和运行时接入应通过共享 infrastructure 与 core 层完成
- 原生执行与打包逻辑集中在 `src-tauri`
- 当前桌面端 combined mode 使用桌面桥接访问逻辑控制平面，而不是直接复用独立 Server 的同源 HTTP 壳

