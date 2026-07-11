> Migrated from `docs/review/step-02-边界责任矩阵-2026-04-07.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 02 边界责任矩阵 - 2026-04-07

## 1. 责任矩阵

| 层 | 允许职责 | 禁止职责 | 当前证据 | 门禁 |
| --- | --- | --- | --- | --- |
| `web` Host | 挂载 Shell、调用 `bootstrapShellRuntime`、浏览器入口文件 | 业务服务、业务 store、feature 直编排 | `packages/sdkwork-agentstudio-pc-web/src/App.tsx`、`main.tsx` | `check:arch`、`check:sdkwork-hosts` |
| `desktop` Host | 平台桥接、宿主启动、桌面启动屏、Tauri 入口 | feature service/store/pages 下沉到 Host 根 | `packages/sdkwork-agentstudio-pc-desktop/src/main.tsx`、`desktop/bootstrap/createDesktopApp.tsx` | `check:arch`、`check:sdkwork-hosts` |
| `shell` | 路由、布局、全局 Provider、全局框架组件 | `services/store/hooks/platform` 目录沉积 | `packages/sdkwork-agentstudio-pc-shell/src/application/*`、`components/*` | `check:arch`、`check:sdkwork-hosts` |
| Feature 包 | 包根公开面、页面 wrapper、服务 barrel、局部组件 | 直连 Tauri API、跨包内部路径穿透 | `sync:features` 后的 `src/index.ts` / `services/index.ts` / `components/index.ts` | `check:arch`、`check:sdkwork-feature-bridges` |
| Foundation | 共享服务、共享契约、平台桥、类型、通用 UI | Host/Feature 越层反向依赖 | `core`、`infrastructure`、`types`、`ui` 现有结构 | `check:arch` |

## 2. 源码根布局冻结

- `sdkwork-agentstudio-pc-web/src`：仅允许 `App.tsx`、`externalModules.d.ts`、`index.ts`、`main.tsx`、`vite-env.d.ts`。
- `sdkwork-agentstudio-pc-desktop/src`：仅允许 `desktop/`、`index.ts`、`main.tsx`、`vite-env.d.ts`。
- `sdkwork-agentstudio-pc-shell/src`：仅允许 `application/`、`components/`、`styles/`、`index.ts`。

## 3. 导出策略冻结

- 跨包调用继续只允许 package root。
- package root 的公共面继续由顶层 wrapper 文件和显式顶层 barrel 目录组成。
- `pages/`、`components/` 属于实现层，默认不直接暴露为深层导出路径。


