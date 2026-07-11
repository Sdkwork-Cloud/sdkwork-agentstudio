# Step 03 Market MySkill Node-safe Defaults - 2026-04-08

## 1. 当前问题

- `packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.ts` 在模块顶部直接从 `@sdkwork/agentstudio-pc-instances` 根包拿默认服务。
- 单测 `mySkillService.test.ts` 虽然已经注入了完整 fake dependencies，但模块加载阶段仍会提前触发 `@sdkwork/agentstudio-pc-instances` 根入口解析。
- 这使得 Node `--experimental-strip-types` 场景下，测试会被上游包根入口的非 Node-safe 导出形态拖死，而不是只验证 `mySkillService` 自己的行为。

## 2. 根因分析

- `mySkillService.ts` 与 `marketService.ts` 处在同一类问题上：都需要通过 workspace 根包拿默认实现，但不能在模块求值时强制解析整个上游根入口。
- 对于已经支持依赖注入的服务，正确模式应该是：
  - 类型继续依赖根包契约；
  - 默认实现按需动态 `import('@sdkwork/agentstudio-pc-instances')`；
  - 只有在调用方没有显式注入时才触发默认实现加载。

## 3. 本轮变更

- `packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.ts`
  - 删除模块顶部的值导入；
  - 改为通过 `typeof import('@sdkwork/agentstudio-pc-instances')` 保留类型约束；
  - 新增默认服务解析函数，在方法执行期间按需动态导入根包。
- `scripts/sdkwork-market-contract.test.ts`
  - `mySkillService.ts` 的根包消费断言已放宽为接受：
    - `from '@sdkwork/agentstudio-pc-instances'`
    - `import('@sdkwork/agentstudio-pc-instances')`
- `packages/sdkwork-agentstudio-pc-market/src/services/marketService.test.ts`
  - 使用 `InstallSkillInput[]` 记录安装调用，移除 `Record<string, unknown>` 强转。
- `packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.test.ts`
  - 使用从 `CreateMySkillServiceOptions` 推导出的真实输入类型记录 `removeSkill` / `setSkillEnabled` 调用，移除 `TS2352` 强转。

## 4. 验证结果

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `node --experimental-strip-types packages/sdkwork-agentstudio-pc-market/src/services/mySkillService.test.ts` | 通过 | `mySkillService` 只走注入依赖，不再被 `@sdkwork/agentstudio-pc-instances` 根入口提前拖死。 |
| `node --experimental-strip-types scripts/sdkwork-market-contract.test.ts` | 通过 | market package contract 已接受 Node-safe 动态根包消费模式。 |
| `pnpm.cmd check:sdkwork-market` | 通过 | 市场包契约检查保持绿色。 |

## 5. Step 03 价值

- 这轮继续延伸 Step 03 的 Node-safe 根包消费收口，而不是引入新的架构旁路。
- 市场包现在在 `claw-core` 与 `claw-instances` 两个共享根包上都采用了同一套策略：
  - 默认实现延迟解析；
  - 注入依赖优先；
  - 契约脚本与真实运行时同步。

## 6. 剩余缺口

- 在继续追查 `@sdkwork/agentstudio-pc-instances` 根入口时，`scripts/sdkwork-instances-contract.test.ts` 的下一处红灯已经转移到 `@monaco-editor/react` 依赖断言，不再是最早的 root export 断点。
- workspace `lint` 当前剩余可见的 `TS2352` 主要集中在：
  - `packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
  - `packages/sdkwork-agentstudio-pc-settings/src/services/providerConfigCenterService.test.ts`
