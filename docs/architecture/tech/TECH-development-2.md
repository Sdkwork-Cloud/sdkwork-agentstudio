> Migrated from `docs/zh-CN/guide/development.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 开发流程

## 日常工作流

仓库的常规开发循环是：

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
```

如果修改了文档，也要执行：

```bash
pnpm docs:build
```

## 校验命令

仓库校验是分层设计的：

- `pnpm lint`：Web 区 TypeScript 校验、架构边界校验与 parity 校验
- `pnpm build`：Web 包生产构建
- `pnpm check:arch`：目录结构、依赖分层和包根导入校验
- `pnpm check:parity`：关键行为与 `upgrade/claw-studio-v5` 基线对齐校验
- `pnpm check:desktop`：桌面端平台与 Tauri 命令契约校验
- `pnpm check:server`：原生 Server 结构与 Rust 测试校验

## 包级执行

```bash
pnpm --filter @sdkwork/claw-web build
pnpm --filter @sdkwork/claw-desktop tauri:info
pnpm --filter @sdkwork/claw-market lint
```

## 关键规则

### 入口包必须保持轻量

`@sdkwork/claw-web` 是应用入口，不应继续吸收 store、hooks 或业务服务。`@sdkwork/claw-desktop` 也遵循同样原则。

### 跨包导入必须使用包根

正确方式：

```ts
import { Market } from '@sdkwork/claw-market';
```

错误方式：

```ts
import { Market } from '@sdkwork/claw-market/src/pages/market/Market';
```

### 业务逻辑留在业务包中

页面、组件和服务应当留在各自的 feature package 中。只有在多个功能真实复用时，才提升到 `core`。

## 文档工作流

- 仓库入口变化时，更新 `README.md` 或 `README.zh-CN.md`
- 公共项目文档变化时，更新 `docs/`
- 设计与实施计划继续保留在 `docs/plans/`
- 公共 API 和部署说明应与 [API 总览](/zh-CN/reference/api-reference)、[应用模式](/zh-CN/guide/application-modes) 与 [安装与部署](/zh-CN/guide/install-and-deploy) 保持一致

## 提交 PR 之前

```bash
pnpm lint
pnpm build
pnpm docs:build
```

如果改动涉及桌面端，还应执行：

```bash
pnpm check:desktop
```

如果改动涉及原生 Server、Docker、Kubernetes 或发布自动化，还应执行：

```bash
pnpm check:server
pnpm check:automation
```

