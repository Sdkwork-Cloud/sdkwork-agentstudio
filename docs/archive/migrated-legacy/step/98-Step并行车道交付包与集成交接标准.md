# Step 并行车道交付包与集成交接标准

## 1. 文档定位

本文件规定并行车道在进入集成窗口前，必须提交什么、验证什么、如何升级阻塞。

## 2. 适用范围

适用于全部波次内并行 step，重点是：

- `05-08`
- `09-12`

## 3. 每个车道的最小交付包

### 3.1 边界冻结单

- 车道名称
- 主写入目录
- 禁止写入目录
- 共享边界文件
- 是否改动 API、状态机、真相源、release profile

### 3.2 本轮输入

- 依赖的 step 文档
- 依赖的架构文档
- 依赖的脚本、契约、测试资产

### 3.3 本轮输出

- 已完成代码路径
- 已完成测试路径
- 已完成运行/脚本验证
- 新增 `docs/review/` 或 `docs/release/` 产物

### 3.4 当前阻塞

- 阻塞描述
- 影响范围
- 是否需要回写 `docs/架构/` 或 `docs/step/`
- 升级等级：`P1 / P2 / P3`

### 3.5 合并条件

- 当前 step 检查点通过
- 本车道 smoke 通过
- 与其他车道接口一致
- 已确认是否需要按 `97` 回写

### 3.6 OpenClaw 对齐证明

- 若涉及 channels：附 `channelService.ts/test.ts` 对齐结果
- 若涉及 chat / instances：附 `webStudio.test.ts` 与 `InstanceDetail.tsx` 对齐结果
- 若涉及 plugin config：附 `openClawConfigSchemaSupport.test.ts` 与 `plugins.entries.*` 写入证明
- 若涉及 ClawHub / skills：附 `marketService.ts/test.ts`、`agentInstallService.ts/test.ts` 对齐结果
- 若涉及托管 Provider / workbench 呈现：附 `openClawManagementCapabilities.ts`、`openClawProviderWorkspacePresentation.ts` 对齐结果
- 若涉及内置 Runtime / 升级 / 打包 / 插件注册：附 `local_ai_proxy.rs`、`plugins/mod.rs` 与 packaged smoke / upgrade smoke 证据

## 4. Claw Studio 集成窗口必查项

- 是否破坏 Host/Shell/Foundation 边界
- 是否破坏 Local Proxy 对托管模型的唯一入口
- 是否破坏 API 五分层边界
- 是否破坏 Instance Detail 十分区真相源
- 是否破坏托管 OpenClaw provider/workbench 语义
- 是否破坏 release profile、installer、smoke 链

## 5. 阻塞升级标准

- `P1`：权威字段冲突、API/状态机冲突、两个车道主写同一高风险文件
- `P1`：修改全局 channels、托管 Provider/workbench、runtime bundle、plugin bootstrap，却缺少对应 OpenClaw 事实源对齐证明
- `P2`：测试口径不一致、review 文档缺失、局部 smoke 失败
- `P3`：不影响当前 gate 的优化项和美化项

## 6. 推荐交付频率

- 高频车道：每天至少一次可集成状态
- 中频车道：每 `1-2` 天一次可集成状态
- 验证车道：每次集成窗口前同步更新证据

## 7. 推荐模板

```md
# 车道交付包 - Step XX / Lane YY

## 边界冻结单
- 主写入目录：
- 禁止写入目录：
- 共享边界文件：

## 本轮输入
- 

## 本轮输出
- 代码：
- 测试：
- 运行：
- 文档：

## 当前阻塞
- 

## 合并条件检查
- [ ] 检查点通过
- [ ] smoke 通过
- [ ] 接口一致
- [ ] 架构回写已确认
- [ ] OpenClaw 对齐证明齐全

## 结论
- 可合并 / 不可合并
```

## 8. 结论

并行不是“同时改很多文件”，而是“按统一交付包推进，再按统一集成窗口收口”。
