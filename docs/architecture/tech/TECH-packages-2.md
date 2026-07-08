> Migrated from `docs/zh-CN/core/packages.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 分包布局

## 工作区结构

仓库是一个 `pnpm` workspace，主要包位于 `packages/*` 下。

## 应用与运行时包

| 包名 | 职责 |
| --- | --- |
| `@sdkwork/clawstudio-web` | Web 入口应用与开发服务器 |
| `@sdkwork/clawstudio-desktop` | Tauri 桌面端入口、原生桥接与打包脚本 |
| `@sdkwork/clawstudio-server` | 原生 Rust Server 包与对外服务端打包入口 |
| `@sdkwork/clawstudio-shell` | 路由、布局、provider、sidebar、command palette 与壳层组合 |

## 共享基础包

| 包名 | 职责 |
| --- | --- |
| `@sdkwork/clawstudio-core` | 共享 store、hooks 与跨功能编排 |
| `@sdkwork/clawstudio-types` | 类型、DTO 与共享产品模型 |
| `@sdkwork/clawstudio-infrastructure` | 环境、HTTP、平台适配、运行时桥接与更新辅助 |
| `@sdkwork/clawstudio-i18n` | 国际化引导、语言资源与格式化能力 |
| `@sdkwork/clawstudio-ui` | 多业务复用的视觉基础组件 |

## Feature Packages

当前工作区中的业务包包括但不限于：

- `@sdkwork/clawstudio-account`
- `@sdkwork/clawstudio-apps`
- `@sdkwork/clawstudio-channels`
- `@sdkwork/clawstudio-chat`
- `@sdkwork/clawstudio-center`
- `@sdkwork/clawstudio-community`
- `@sdkwork/clawstudio-devices`
- `@sdkwork/clawstudio-docs`
- `@sdkwork/clawstudio-extensions`
- `@sdkwork/clawstudio-github`
- `@sdkwork/clawstudio-huggingface`
- `removed-install-feature`
- `@sdkwork/clawstudio-instances`
- `@sdkwork/clawstudio-market`
- `@sdkwork/clawstudio-settings`
- `@sdkwork/clawstudio-tasks`

每个 feature package 至少应保持：

```text
src/components
src/pages
src/services
```

## 边界规则

- 入口包依赖 Shell 和共享层
- Feature 包可以依赖 `core`、`types`、`infrastructure`、`i18n` 和 `ui`
- Feature 包不应导入其他 Feature 包的内部实现
- 包根 barrel export 是架构契约的一部分

