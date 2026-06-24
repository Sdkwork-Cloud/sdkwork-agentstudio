# Step 并行执行周计划与排班建议

## 1. 文档定位

本文件把 [`94-Step并行执行编排与车道拆分建议`](./94-Step并行执行编排与车道拆分建议.md) 的原则继续压实到“按周怎么排、按天怎么收、多人或多 agent 怎么不打架”。

## 2. 执行前提

- 强串行主脊柱固定为：`00 -> 01 -> 02 -> 03 -> 04 -> 13`
- 波次内并行主体为：`05-08` 与 `09-12`
- 主 agent 只做边界冻结、集成裁决、总验收；子 agent 只做单车道、单主写入范围
- 每个车道进入开发前，必须先提交 `98` 交付包

## 3. 推荐周节奏

| 周次 | 目标 | 重点 step | 说明 |
| --- | --- | --- | --- |
| 第 1 周 | 冻结基线与边界 | `00` `01` `02` | 统一规则、差距矩阵、包边界 |
| 第 2 周 | 固化 Runtime 与 API 主链 | `03` `04` | 内置 OpenClaw、Local Proxy、五类 API 面 |
| 第 3 周 | 打通业务主链 | `05` `06` `07` | Provider、Chat、Instance Detail 三主链 |
| 第 4 周 | 打通生态与质量 | `08` `09` `10` | Channels/ClawHub、性能、安全、测试门禁 |
| 第 5 周 | 打通交付与商业化 | `11` `12` | 打包、安装、发布、商业化闭环 |
| 第 6 周 | 总收口 | `13` | 架构回写、release、backlog |

## 4. 波次内推荐车道

### 4.1 波次 B：`05-08`

- `Lane-B1`：Provider / Projection / Local Proxy
- `Lane-B2`：Chat Workspace / Session / Multi-instance Route
- `Lane-B3`：Instance Directory / Instance Detail / Workbench
- `Lane-B4`：Channels / ClawHub / Skills / Market
- `Lane-V`：契约回归、smoke、review 文档

### 4.2 波次 C：`09-12`

- `Lane-C1`：Performance / Observability
- `Lane-C2`：Security / Test / Quality Gates
- `Lane-C3`：Packaging / Installer / Release / Upgrade
- `Lane-C4`：Commerce / Entitlement / Operations
- `Lane-V`：多形态验收、发布证据、复盘

## 5. 角色建议

- `Main Owner`：冻结边界、裁决冲突、合并最终结果
- `Runtime Owner`：`03/11`
- `API Owner`：`04`
- `Product Flow Owners`：`05/06/07/08`
- `Quality Owner`：`09/10`
- `Business Owner`：`12`

## 6. 推荐日节奏

- 上午：同步 step 目标、共享边界、阻塞项
- 下午：各车道推进实现与自测
- 晚间：集成窗口，统一跑当前最小 smoke，并更新 `docs/review/`

## 7. 最快完成原则

- 先冻结共享边界，再放开并行。
- 压缩等待时间，不压缩验证门禁。
- 验证车道独立，不与实现车道长期混写。
- 连续两天无法集成的车道，必须降级并行度先收口。

## 8. 周收口要求

- 周内所有新增能力都必须能映射到 `90`
- 每个车道都必须通过 `91` 与 `95`
- 若有架构偏移，必须按 `97` 回写
- 准备进入下一周前，必须补齐 `docs/release/` 的适用变更说明

## 9. 每周最快闭环模板

- 周一：冻结共享边界、执行卡、车道交付包
- 周二到周三：实现车道推进，验证车道同步补测试与 review
- 周四：统一跑 OpenClaw 事实源测试、业务级 smoke、回读验证
- 周五：统一集成、波次自审、更新 `docs/release/` 与架构回写清单

## 10. 结论

最快的路径不是同时做所有 step，而是：`先做强串行主脊柱，再在波次内按车道并行，并保留独立验证和固定集成窗口。`
