> Migrated from `docs/zh-CN/core/architecture.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 架构说明

## 依赖方向

Claw Studio 遵循严格的依赖流向：

```text
web/desktop -> shell -> feature -> (core + infrastructure + i18n + types + ui)
shell -> (core + i18n + ui + feature)
core -> (infrastructure + i18n + types)
infrastructure -> (i18n + types)
```

这个规则的目标是让入口包保持轻量、功能包保持可迁移，同时避免不相关业务之间出现隐式耦合。

## 各层职责

### Web 与 Desktop

- 负责启动运行时
- 挂载共享 Shell
- 处理平台特有集成

它们不应该持有业务 store、功能服务或页面逻辑。

### Shell

`@sdkwork/clawstudio-shell` 负责组合层能力：

- router
- layouts
- providers
- sidebar
- command palette
- 全局 Shell 交互

Shell 的职责是装配各业务包，而不是重新演化成承载业务服务的新单体。

### Core

`@sdkwork/clawstudio-core` 承载跨功能共享的状态和编排能力，例如全局 store 与共享 hooks，但它不是 feature 私有逻辑的堆放区。

### Types、Infrastructure 与 UI

- `types`：纯共享模型与 DTO
- `infrastructure`：环境读取、HTTP、平台适配、更新辅助与运行时桥接
- `i18n`：语言探测、翻译初始化、格式化等
- `ui`：共享视觉基础组件

### Feature Packages

业务包拥有自己的 `components`、`pages` 与 `services` 目录，例如：

- `@sdkwork/clawstudio-chat`
- `@sdkwork/clawstudio-market`
- `@sdkwork/clawstudio-settings`
- `@sdkwork/clawstudio-account`
- `@sdkwork/clawstudio-extensions`

## 包根导入规则

跨包导入必须指向包根：

```ts
import { Settings } from '@sdkwork/clawstudio-settings';
```

仓库会拒绝任何直接伸入其他包内部文件的导入方式。

## 仓库内置校验

架构校验脚本会验证：

- 必需目录结构
- 允许的依赖方向
- 跨包包根导入规则
- 包导出形态
- Web Shell 边界约束

显式执行：

```bash
pnpm check:arch
```

## 为什么这很重要

当前工作区是从 `upgrade/claw-studio-v5` 迁移而来，后者仍然是功能与视觉基线。新的分包架构在保持产品一致性的同时，让后续维护、部署扩展和多宿主并存更加可控。

