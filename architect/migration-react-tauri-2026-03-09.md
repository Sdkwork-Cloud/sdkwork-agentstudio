# React + Tauri 架构标准迁移记录（Workspace 分包版）

## 目标
- 严格遵循 `architect/architect-standard-react+tauri.md`
- 采用 `pnpm workspace` 分包管理
- 使用 `@sdkwork/clawstudio-studio-xxx` 命名规范
- 保持现有功能、路由、交互与界面样式一致

## 最终分包结构

```text
packages/
├─ claw-studio-web             (@sdkwork/clawstudio-studio-web)
├─ claw-studio-domain          (@sdkwork/clawstudio-studio-domain)
├─ claw-studio-infrastructure  (@sdkwork/clawstudio-studio-infrastructure)
└─ claw-studio-business        (@sdkwork/clawstudio-studio-business)
```

## 分层职责
- `claw-studio-domain`: 领域实体与核心类型
- `claw-studio-infrastructure`: 平台适配与底层能力（HTTP/Platform）
- `claw-studio-business`: services/stores/hooks 业务逻辑
- `claw-studio-web`: 页面、组件、路由、应用装配与服务端入口

## 依赖方向（高内聚、低耦合）
- `web -> business -> (domain + infrastructure)`
- `domain` 与 `infrastructure` 不反向依赖上层

## 兼容策略
- `web/src/services/*`、`web/src/store/*`、`web/src/hooks/*` 保留兼容导出
- 旧页面模块无需整体重写，避免 UI/样式回归

## 根工程规范
- 根 `package.json` 仅负责 workspace 编排脚本
- 根 `pnpm-workspace.yaml` 统一管理 `packages/*`
- 根 `tsconfig.base.json` 统一 TS 编译基线

## 验证结果
- `pnpm lint` 通过
- `pnpm build` 通过
