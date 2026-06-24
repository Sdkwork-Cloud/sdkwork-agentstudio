> Migrated from `docs/zh-CN/contributing/index.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 贡献指南

## Commit 风格

请使用 Conventional Commits：

- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`

## Pull Request 要求

每个 PR 应至少包含：

- 简洁的变更说明
- 受影响的包
- 已执行的校验命令
- 如果改动影响可见界面，附上截图

## 评审前校验

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

