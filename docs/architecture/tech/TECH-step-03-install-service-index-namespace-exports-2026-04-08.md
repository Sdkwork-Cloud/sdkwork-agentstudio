> Migrated from `docs/review/step-03-install-service-index-namespace-exports-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 Install Service Index Namespace Exports - 2026-04-08

## 1. 当前问题

- workspace `lint` 中，`GuidedInstallWizard.tsx` 与 `OpenClawGuidedInstallWizard.tsx` 报告无法从 `../services` 获取 `installGuidedWizardService` / `openClawInstallWizardService`。
- 这不是 wizard service 文件缺失，而是 `packages/removed-install-feature/src/services/index.ts` 只做了 `export * from ...`，没有提供组件实际在使用的模块命名空间导出。

## 2. 根因分析

- `GuidedInstallWizard.tsx` 以 `installGuidedWizardService.buildGuidedWizardSteps(...)` 的形式消费服务。
- `OpenClawGuidedInstallWizard.tsx` 更进一步把 `openClawInstallWizardService` 当作模块命名空间使用，同时读取其中的类型导出，例如 `OpenClawWizardStepId`、`OpenClawVerificationSummary`。
- 这种消费方式要求 `services/index.ts` 提供 `export * as ... from './module'` 形式的命名空间根导出，而不只是把模块内部的散装成员扁平 re-export 到 package root。

## 3. 本轮变更

- `scripts/sdkwork-install-contract.test.ts`
  - 新增契约断言，要求 `services/index.ts` 显式包含：
    - `export * as installGuidedWizardService from './installGuidedWizardService'`
    - `export * as openClawInstallWizardService from './openClawInstallWizardService'`
- `packages/removed-install-feature/src/services/index.ts`
  - 补充上述两条 namespace export，同时保留原有 `export * from ...`，不破坏现有散装函数消费者。

## 4. 验证结果

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts` | 通过 | install package contract 已显式锁定 wizard service namespace export。 |
| `pnpm.cmd lint` | 仍失败 | 仍有大量其它 package 类型债。 |
| `pnpm.cmd lint` 过滤 `GuidedInstallWizard.tsx|OpenClawGuidedInstallWizard.tsx|installGuidedWizardService|openClawInstallWizardService` | 无命中 | 说明本轮 install wizard service root contract 红灯已清除。 |

## 5. Step 03 价值

- 这次修复继续服务于 Step 03 的 guided install / OpenClaw bootstrap 主链路。
- 它把 install package root 从“看起来有导出”收口到“真正支持组件按模块命名空间消费”，避免 UI 向导在静态编译阶段断裂。
- 同时，这个契约被写回脚本，后续如果有人删掉 namespace export，`check:sdkwork-install` 会第一时间红灯。

## 6. 剩余缺口

- workspace `lint` 仍有很多历史类型问题，本轮只收口 install wizard service namespace export 漂移。
- 下一轮如果继续留在 Step 03 领域，优先看 `removed-install-feature` / `sdkwork-clawstudio-market` 附近剩余的类型噪声是否还能用同样“小范围高价值”方式继续压缩。

