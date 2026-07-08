# Step 03 Market Node-safe Root Contract Alignment - 2026-04-08

## 1. 当前问题

- `packages/sdkwork-clawstudio-market/src/services/marketService.ts` 为了适配 `@sdkwork/clawstudio-core` 的 Node-safe 根包约束，已经改成通过 `await import('@sdkwork/clawstudio-core')` 延迟拿到 `clawHubService`。
- 但 `scripts/sdkwork-market-contract.test.ts` 仍然只接受静态字符串 `from '@sdkwork/clawstudio-core'`。
- 结果是生产代码已正确，契约脚本却把正确实现判成失败，直接阻断 `pnpm.cmd check:sdkwork-market`。

## 2. 根因分析

- `@sdkwork/clawstudio-core` 的根包契约强调“通过根包消费”，但不要求所有运行时服务都必须以静态值导入出现。
- 在 `node --experimental-strip-types` 与 Node-safe root 组合场景下，动态 `import('@sdkwork/clawstudio-core')` 是合法且更稳妥的运行时解析方式。
- `sdkwork-clawstudio-market` 的生产实现已经向正确方向收口，真正过时的是市场包契约脚本对源码形态的匹配条件。

## 3. 本轮变更

- `packages/sdkwork-clawstudio-market/src/services/marketService.ts`
  - 保持延迟 `import('@sdkwork/clawstudio-core')` 获取 `clawHubService` 的实现。
- `packages/sdkwork-clawstudio-market/src/index.ts`
  - 保持显式导出 `instanceService`、`marketService`、`mySkillService`，不再走 `./services` 聚合重导出。
- `scripts/sdkwork-market-contract.test.ts`
  - 将根包契约断言更新为同时接受以下两种模式：
    - `from '@sdkwork/clawstudio-core'`
    - `import('@sdkwork/clawstudio-core')`
  - 继续禁止 `@sdkwork/clawstudio-core/services/*` 之类深路径导入。

## 4. 验证结果

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `node --experimental-strip-types scripts/sdkwork-market-contract.test.ts` | 通过 | 市场包契约脚本已接受 Node-safe 动态根包导入。 |
| `node --experimental-strip-types packages/sdkwork-clawstudio-market/src/services/marketService.test.ts` | 通过 | `marketService` 仍然通过共享 `claw-core` / `claw-instances` 能力读写 ClawHub 与安装链路。 |
| `pnpm.cmd check:sdkwork-market` | 通过 | 包级契约检查重新恢复为真实信号，不再被旧断言误伤。 |

## 5. Step 03 / OpenClaw 对齐价值

- 这次修复虽然落点在 `sdkwork-clawstudio-market`，但本质上是在延续 Step 03 的“单一真相源 + 根包契约 + Node-safe 运行时”收口方向。
- 市场页读取 ClawHub 数据的链路现在与 install/bootstrap 一样，不再依赖错误的静态值导入假设。
- 这保证了后续无论是桌面内嵌运行、`strip-types` 本地验证，还是更高层的 release smoke，市场包都不会因为根包源码形态被旧脚本误判。

## 6. 剩余缺口

- 当前闭合的是市场包局部契约红灯，不代表 Step 03 整体完成。
- 下一轮仍需继续跑更高层验证，确认 hosted browser / runtime smoke / broader workspace checks 里是否还有同类“生产已对、脚本仍旧”的漂移点。
