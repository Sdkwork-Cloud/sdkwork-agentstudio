> Migrated from `docs/review/step-01-openclaw对齐差距矩阵-2026-04-07.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 01 OpenClaw 对齐差距矩阵 - 2026-04-07

## 1. 能力对齐矩阵

| 能力 | 事实源 | 当前状态 | 主要差距 | 对应 Step |
| --- | --- | --- | --- | --- |
| 内置 OpenClaw Runtime 与 Gateway 托管 | `studio.rs` 中 `configure_openclaw_gateway`、`invoke_managed_openclaw_gateway`、Gateway 端点投影 | 已具备主链 | Runtime、Gateway、Hosted Studio 混在单文件，升级与故障隔离粒度不足 | `03` |
| 所有模型 API 经本地 Proxy | `local_ai_proxy.rs` 覆盖 OpenAI chat/responses/embeddings、Anthropic messages、Gemini native/OpenAI 兼容、Ollama | 已具备核心覆盖 | 还需把 API 注册、管理入口、日志入口和 Provider 投影统一成稳定模块 | `03` `04` |
| 托管 Provider 投影 | `project_managed_openclaw_provider_*` 测试、`openClawProviderWorkspacePresentation.ts` | 已具备基础 | Provider Center、Instance Detail、Agent 默认模型仍需形成单一真相源闭环 | `05` |
| Hosted Studio 实例与会话能力 | `webStudio.ts` / `webStudio.test.ts` 提供 `listInstances`、`getInstanceDetail`、会话读写 | 已具备基础 | `/claw/api/v1`、`/claw/manage/v1`、`/claw/internal/v1` 与 Gateway/Proxy 之间仍需统一证据矩阵 | `04` |
| Instance Detail 十分区工作台 | `InstanceDetail.tsx` 已含 `overview/channels/cronTasks/llmProviders/agents/skills/files/memory/tools/config` | 功能面已较完整 | 页面过大，服务层与视图层未彻底拆开；需在视觉与交互上优于 Control UI | `07` |
| Channels 配置与实例状态 | `channelService.ts` 具备 `updateChannelStatus/saveChannelConfig/deleteChannelConfig` | 已具备基础 | 需继续确保全局 channels 与实例 detail/workbench 回显一致 | `08` |
| ClawHub 与技能安装 | `marketService.ts` 具备 `listCategories/listSkills/listPackages/installSkill/installPackWithSkills` | 已具备基础 | 技能包、实例技能、锁文件、市场“我的技能”一致性仍需验收矩阵 | `08` |
| 插件机制与桌面宿主插件 | `plugins/mod.rs` 注册 dialog/notification/opener/single-instance | 宿主插件基础存在 | 业务插件/技能升级机制、OpenClaw 版本升级联动和灰度验证仍需工程化 | `03` `08` `11` |
| 升级 readiness 与打包资源校验 | `openclaw-upgrade-readiness.test.mjs`、`prepare-openclaw-runtime.test.mjs`、`verify-desktop-openclaw-release-assets.test.mjs` | 本轮校验通过 | 需在重构后继续保持跨平台 ready/repair/rollback 证据不回退 | `03` `11` |

## 2. 结论

- 当前与 OpenClaw 的主要差距不在“有没有功能”，而在“是否以稳定边界、统一真相源、可升级机制和可验证证据”交付这些功能。
- 因此后续 step 要坚持“先主链收口，再业务工作台，再交付与商业化”的顺序，不能反过来。


