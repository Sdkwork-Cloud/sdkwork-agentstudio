# Step 04 - API体系、平台桥与契约统一

## 1. Step Card

| 项 | 内容 |
| --- | --- |
| 执行模式 | 强串行 |
| 前置 | `02` `03` |
| 主写入范围 | `packages/sdkwork-claw-server/src-host` `packages/sdkwork-claw-infrastructure/src/platform` `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts` `docs/reference/api-reference.md` |
| 执行输入 | `16`、`17` 架构文档；现有 `/claw/*`、Hosted Studio、Gateway、Proxy 契约实现 |
| 本步非目标 | 不做 Provider/Chat/Instance 具体 UI 功能完善 |
| 最小输出 | 清晰的对外、管理、内部、Gateway、Proxy 五类 API 边界与唯一调用入口 |

## 2. 设计

- `/claw/*` 是宿主原生 API；Hosted Browser 统一经 `WebHostedStudioPlatform` 类契约进入。
- Gateway 是实例运行控制面；Proxy 是模型兼容面；两者都不应被 Feature 直接拼路径调用。
- 任何页面能力必须先归属 API 面，再实现。

## 3. 实施落地规划

1. 补齐并收紧 `/claw/api/v1/studio/*` 与 `Manage/Internal/OpenAPI` 路由边界。
2. 收口 `serverBrowserBridge`、`webHostedStudio.ts`、`webStudio.ts`、`registry.ts` 的平台桥逻辑。
3. 收口 `openClawGatewayClient.ts` 的实例控制调用契约与错误语义。
4. 明确 Local Proxy 路径不纳入 `/claw/*` OpenAPI 发布边界。
5. 把 API 类型、错误体、鉴权和 observability 文档同步更新。

## 4. 测试计划

- `pnpm.cmd check:sdkwork-host-runtime`
- `pnpm.cmd check:server`
- `pnpm.cmd check:sdkwork-instances`
- `node --experimental-strip-types scripts/sdkwork-host-runtime-contract.test.ts`

## 5. 结果验证

- Feature 不再直接拼 `/claw/*`、`/tools/invoke`、供应商 HTTP。
- Hosted Browser、Desktop Combined、Server 三种模式都能通过统一平台桥访问能力。
- API 错误体、鉴权边界、OpenAPI 口径一致。

## 6. 检查点

- `CP04-1`：五类 API 面与调用边界冻结。
- `CP04-2`：Hosted Studio Platform 成为浏览器唯一宿主入口。
- `CP04-3`：Gateway/Proxy 与 `/claw/*` 边界冻结。
- `CP04-4`：契约测试与参考文档同步完成。

### 6.1 推荐并行车道

- `04-A`：`/claw/*` Native API
- `04-B`：Hosted Studio Platform Bridge
- `04-C`：OpenClaw Gateway Client 契约
- 收口要求：API 基路径、错误模型、鉴权策略统一由 `04-Owner` 裁决

### 6.2 完成后必须回写的架构文档

- `docs/架构/05-功能架构与核心业务流程.md`
- `docs/架构/09-数据、状态与配置治理设计.md`
- `docs/架构/16-API体系与契约设计.md`
- `docs/架构/17-能力到API调用矩阵.md`

### 6.3 推荐 review 产物

- `docs/review/step-04-执行卡-YYYY-MM-DD.md`
- `docs/review/step-04-api边界与错误模型-YYYY-MM-DD.md`
- `docs/review/step-04-gateway-proxy-platform-bridge决议-YYYY-MM-DD.md`

### 6.4 架构能力闭环判定

- 对外、管理、内部、Gateway、Proxy 五类 API 面均有明确入口、错误体、鉴权与调用者。
- 若 Feature 仍直接拼 `/claw/*`、供应商 HTTP 或绕开 Gateway/Platform，本 step 不算闭环。

### 6.5 快速完整执行建议

- 先冻结 API 路由表、错误模型和鉴权策略，再并行推进 Native API、Hosted Platform、Gateway Client 三车道。
- 契约和文档必须同日更新，避免代码先行导致 `16/17` 失真。

## 7. 风险与回滚

- 风险：API 入口不统一会让后续每个 Feature 都长出自己的 transport。
- 回滚：保留旧桥接 facade，但禁止新增新入口。

## 8. 完成定义

- 所有宿主、实例、运行、兼容能力都能归属到明确 API 面。

## 9. 下一步准入条件

- Step 05-08 可以直接在统一 API/平台桥基础上推进业务闭环。
