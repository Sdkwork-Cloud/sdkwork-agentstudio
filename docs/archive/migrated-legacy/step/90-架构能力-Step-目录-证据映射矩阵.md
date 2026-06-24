# 架构能力 - Step - 目录 - 证据映射矩阵

## 1. 目标

把“架构能力、对应 step、主要目录、主要证据”压成一张矩阵，执行前后都能快速核对。

## 2. 总体矩阵

| 能力域 | 核心架构文档 | 对应 Step | 主要目录 | 主要证据 |
| --- | --- | --- | --- | --- |
| 分层与包边界 | `02` `03` `04` | `02` | `packages/sdkwork-claw-web` `desktop` `shell` `core` `infrastructure` | 边界脚本、导出清单、review 记录 |
| 内置 OpenClaw Runtime | `02` `03` `12` | `03` | `packages/sdkwork-claw-desktop/src-tauri` `config` `scripts/prepare-openclaw-runtime.mjs` | bundled runtime、manifest、startup evidence、upgrade smoke |
| 对外/管理/内部/Gateway/Proxy API | `16` `17` | `04` | `packages/sdkwork-claw-server` `packages/sdkwork-claw-host-studio` `packages/sdkwork-claw-infrastructure/src/platform` `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts` | API 契约、OpenAPI、bridge tests、proxy contract |
| Provider/Projection 主链 | `05` `09` `16` `17` | `05` | `packages/sdkwork-claw-core/src/services` `packages/sdkwork-claw-settings/src` `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs` | route test、projection 回读、日志、代理观测、`webStudio.ts/test.ts` 对齐 |
| Chat 主链 | `06` `17` | `06` | `packages/sdkwork-claw-chat` | route tests、gateway session tests、chat smoke |
| Instance Detail 工作台 | `07` `15` `17` | `07` | `packages/sdkwork-claw-instances` | 十分区回归、`InstanceDetail.tsx` 分区校对、Control UI section 顺序、插件配置写链验证 |
| Channels / ClawHub / Skills | `08` `17` | `08` | `packages/sdkwork-claw-market` `packages/sdkwork-claw-channels` `packages/sdkwork-claw-agent` `packages/sdkwork-claw-instances/src/services` | `channelService.ts`、`marketService.ts`、`agentInstallService.ts` 对齐，安装/卸载/渠道回读 |
| 性能与可观测 | `10` | `09` | `chat` `instances` `settings` `desktop` `scripts` | 指标、日志、容量 smoke |
| 安全与质量门禁 | `11` | `10` | `scripts` `package.json` `tests` `server` `desktop` | gate matrix、OpenClaw 事实源测试、回归记录 |
| 打包/发布/升级 | `12` | `11` | `packages/sdkwork-claw-distribution` `packages/removed-install-feature` `scripts/release` `docs/release` | release profile、installer smoke、packaged launch、change log |
| 商业化能力 | `01` `12` `14` | `12` | `packages/sdkwork-claw-account` `packages/sdkwork-claw-dashboard` `packages/sdkwork-claw-mall` `packages/sdkwork-claw-model-purchase` `packages/sdkwork-claw-points` | 权限/权益说明、运营证据、版本说明 |
| 最终收口 | `13` `14` | `13` | 全仓 | 发布准入单、回滚单、下一轮 backlog |

## 3. 使用规则

执行任一 step 前必须确认：

1. 当前能力属于哪一行。
2. 当前 step 是否是该能力的主实现 step。
3. 当前写入目录是否在矩阵允许范围内。
4. 完成后准备把证据写到哪里。

## 4. 结论

如果某项改动既找不到能力行，也找不到 step 归属，就不应开始实施。
