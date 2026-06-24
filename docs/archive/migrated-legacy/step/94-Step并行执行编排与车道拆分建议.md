# Step 并行执行编排与车道拆分建议

## 1. 总原则

最快的方式不是“全并行”，而是：

`强串行主脊柱 + 波次内按写入范围并行 + 独立验证车道 + 统一 owner 收口`

## 2. 必须串行的 Step

- `00`：没有规则不能开工
- `01`：没有基线不能拆包
- `02`：没有稳定分层不能做 Runtime/API
- `03`：没有稳定 Runtime 不能压实 Provider/Release
- `04`：没有统一 API 契约不能放开业务闭环
- `13`：最终发布与回写必须最后做

## 3. 适合并行的波次

### 波次 B：`05-08`

- `Lane-B1`：Provider/Proxy/Projection
- `Lane-B2`：Chat Route / Session
- `Lane-B3`：Instance Detail / Workbench
- `Lane-B4`：Channels / Market / Skills

### 波次 C：`09-12`

- `Lane-C1`：Performance / Observability
- `Lane-C2`：Security / Test / Quality Gates
- `Lane-C3`：Packaging / Release / Upgrade
- `Lane-C4`：Commerce / Entitlement / Operations
- `Lane-V`：独立验证车道，只写测试、脚本、review

## 4. 写入边界

| 车道 | 主写入范围 |
| --- | --- |
| Runtime | `packages/sdkwork-claw-desktop/src-tauri` `scripts/prepare-openclaw-runtime.mjs` |
| API/Bridge | `packages/sdkwork-claw-server` `packages/sdkwork-claw-infrastructure/src/platform` |
| Settings/Provider | `packages/sdkwork-claw-settings` `core/services/*proxy*` |
| Chat | `packages/sdkwork-claw-chat` |
| Instances | `packages/sdkwork-claw-instances` |
| Ecosystem | `packages/sdkwork-claw-market` `packages/sdkwork-claw-channels` |
| Release | `scripts/release` `packages/sdkwork-claw-distribution` `docs/release` |
| Commerce | `account` `dashboard` `mall` `model-purchase` `points` |

## 5. 硬约束

- 不允许两个车道主写同一高风险文件。
- 共享契约文件必须先指定单一 owner。
- 验证车道不和实现车道在同一提交里混写核心实现。
- 波次未通过 `93` 总验收，不得进入下一波次。

## 6. 最快完整执行打法

### 6.1 先冻结的共享边界

- `02`：Host/Shell/Foundation 责任矩阵
- `03`：OpenClaw Runtime 启动顺序、版本源、Local Proxy 主链
- `04`：对外/管理/内部/Gateway/Proxy 五类 API 面
- `07`：Instance Detail 十分区骨架、Control UI section 顺序、受管插件配置语义
- `08`：默认 Agent 工作区安装规则、全局 channels 配置桥接

### 6.2 波次 B 最快车道

- `Lane-B1`：Provider / Proxy / Projection / 全局 channels
- `Lane-B2`：Chat Route / Session / Multi-instance
- `Lane-B3`：Instance Detail / Workbench / 插件配置
- `Lane-B4`：ClawHub / Skills / Agent workspace install
- `Lane-V`：`webStudio.test.ts` `openClawConfigSchemaSupport.test.ts` `channelService.test.ts` `marketService.test.ts` `agentInstallService.test.ts`

### 6.3 波次 C 最快车道

- `Lane-C1`：性能与观测
- `Lane-C2`：安全与正式 gate
- `Lane-C3`：打包、安装、发布、升级
- `Lane-C4`：商业化、权限、运营
- `Lane-V`：多形态 smoke、release 证据、架构兑现 review

## 7. 结论

并行的核心不是人多，而是写入边界清晰、依赖顺序稳定、收口 owner 明确。
