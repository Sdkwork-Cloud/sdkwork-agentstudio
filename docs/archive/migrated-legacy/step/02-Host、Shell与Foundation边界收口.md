# Step 02 - Host、Shell 与 Foundation 边界收口

## 1. Step Card

| 项 | 内容 |
| --- | --- |
| 执行模式 | 强串行 |
| 前置 | `01` |
| 主写入范围 | `packages/sdkwork-claw-web` `packages/sdkwork-claw-desktop` `packages/sdkwork-claw-shell` `packages/sdkwork-claw-core` `packages/sdkwork-claw-infrastructure` `packages/sdkwork-claw-types` `packages/sdkwork-claw-ui` `scripts/check-arch-boundaries.mjs` |
| 执行输入 | `02/03/04/09/16/17` 架构文档、AGENTS 包边界约束、Step 01 审计结果 |
| 本步非目标 | 不处理具体聊天功能；不处理 Provider/Instance 业务细节 |
| 最小输出 | 清晰分层、稳定导出、热点文件拆分计划、边界脚本收紧 |

## 2. 设计

- 固定依赖方向：`web/desktop -> shell -> feature -> foundation`。
- Host 只保留启动、平台注入、桥接；Shell 只保留路由、布局、全局 Provider。
- Feature 禁止越级直连基础实现；跨包只允许 package root 导出。

## 3. 实施落地规划

1. 清理 `web/desktop` 的业务沉积，把业务编排回推到 `shell/feature/core/infrastructure`。
2. 收紧 `sdkwork-claw-shell` 的路由与全局 Provider 边界，避免继续沉积 feature service。
3. 梳理 `core/infrastructure/types/ui/i18n` 的职责与 package root 导出。
4. 按 Step 01 热点清单，优先拆出超大文件中的“契约/映射/编排/UI”子模块。
5. 强化 `scripts/check-arch-boundaries.mjs` 与相关 contract checks，防止回退。

## 4. 测试计划

- `pnpm.cmd check:arch`
- `pnpm.cmd check:sdkwork-structure`
- `pnpm.cmd check:sdkwork-hosts`
- `pnpm.cmd check:sdkwork-feature-bridges`
- `pnpm.cmd sync:features`

## 5. 结果验证

- Host 文件不再承载业务服务或业务 store。
- Shell 只做路由/布局/Provider。
- 关键功能仍可通过原有 feature 入口工作。
- 新增边界检查能阻止反向依赖和内部路径穿透。

## 6. 检查点

- `CP02-1`：Host/Shell/Feature/Foundation 责任矩阵冻结。
- `CP02-2`：package root 导出与跨包引用收口完成。
- `CP02-3`：边界脚本与 contract check 同步升级。
- `CP02-4`：高风险大文件拆分计划冻结。

### 6.1 推荐并行车道

- `02-A`：Host/Shell 薄化
- `02-B`：Foundation 导出与依赖方向收口
- `02-C`：边界脚本与 contract check 收紧
- 收口要求：涉及依赖方向的最终决策只能由 `02-Owner` 合并

### 6.2 完成后必须回写的架构文档

- `docs/架构/02-架构标准与总体设计.md`
- `docs/架构/03-模块规划与边界.md`
- `docs/架构/04-技术选型与可插拔策略.md`

### 6.3 推荐 review 产物

- `docs/review/step-02-执行卡-YYYY-MM-DD.md`
- `docs/review/step-02-边界责任矩阵-YYYY-MM-DD.md`
- `docs/review/step-02-导出与依赖方向决议-YYYY-MM-DD.md`

### 6.4 架构能力闭环判定

- Host 只剩启动与平台注入，Shell 只剩路由/布局/Provider，跨包调用只走 package root。
- 若仍存在 host 内业务 service、shell 内 feature store 或内部路径穿透，本 step 不算闭环。

### 6.5 快速完整执行建议

- 先冻结责任矩阵与导出边界，再并行推进 Host/Shell 薄化、Foundation 收口、边界脚本升级三条线。
- 以 `pnpm.cmd check:arch` 和 `pnpm.cmd check:sdkwork-feature-bridges` 作为每日收口门禁。

## 7. 风险与回滚

- 风险：边界收口不彻底会导致后续 API 和 Runtime 改造再次返工。
- 回滚：优先保留 facade 与兼容导出，避免一次性删除旧入口。

## 8. 完成定义

- 分层稳定、导出稳定、脚本可卡住越界、热点拆分计划明确。

## 9. 下一步准入条件

- Step 03 和 Step 04 能在稳定边界上继续推进 Runtime 与 API 改造。
