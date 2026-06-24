# 136-2026-04-09 Agentic Workbench Benchmark Gap Matrix

## Goal

在不破坏 `Local Proxy`、`/claw/*` 五分层 API、包根导出边界、以及 `Instance Detail` 真相源规则的前提下，把 Claw Studio 对齐到当前行业领先 agentic workbench 产品标准。

## Benchmark Matrix

| 能力 | 官方标杆证据 | 当前 Claw Studio 状态 | 差距判定 | 设计动作 |
| --- | --- | --- | --- | --- |
| 异步后台代理 | Cursor Background Agents；GitHub Copilot coding agent | 已有实例任务、Agent、Skill、Workbench，但没有统一后台执行车道与接管界面 | `P1` | 复用任务/实例真相源设计后台代理车道，不新增平行状态机 |
| 自动代码审查 | Cursor Bugbot；GitHub agent/MCP review flow | 现有 `docs/review/` 与契约测试强，但没有产品内 diff review 面板 | `P1` | 建 review workbench，把 findings、证据、修复状态落到 review/task 链 |
| 工作流资产 | Windsurf Workflows | `docs/prompts/` 已存在，但仍是仓库资产，不是产品资产 | `P1` | 建 workflow registry：markdown spec、版本、权限、审计、执行入口 |
| MCP/外部工具治理 | Cursor MCP；GitHub MCP；Windsurf MCP | 已有插件、工具、Provider、Proxy 主链，但没有统一 MCP/server 治理面 | `P1` | 建统一外部工具注册与策略层，保持工具接入不绕过 service/package-root |
| 工作台热点与性能 | `docs/架构/14/15` 的 L5 目标；当前 fresh build 仍有 `InstanceDetail` 大 chunk | `InstanceDetail.tsx` 仍为 `1444` 行，chunk 仍大 | `P0` | 继续 Step 07 热点拆分，随后做 section lazy split 与按需水合 |

## Hard Constraints

- 托管 OpenClaw 的模型访问仍必须统一经本地 `Local Proxy`
- UI 不得直拼 transport，不得跳过 service 层
- 新后台车道不得复制一套任务真相源
- Workflow / MCP / Review 新能力必须进入 `docs/架构/17` 的调用矩阵
- `Instance Detail` 的任何继续拆分都不得把真实写链、`toast`、`loadWorkbench(...)` authority 随意下放

## Execution Order

1. 先完成 `Step 07 / CP07-3`
2. 再做 `Instance Detail` 分区 lazy split
3. 再做 workflow registry
4. 再做 background agent lane
5. 最后做 review automation 与 MCP governance 面

## Conclusion

当前最优策略不是同时铺开所有领先能力，而是先把现有工作台主链做薄、做稳、做可验证，再把 workflow、background agent、review、MCP 治理逐层叠上去。这样才能在性能、功能、安全、运维、可扩展性上一起逼近 `L5`。
