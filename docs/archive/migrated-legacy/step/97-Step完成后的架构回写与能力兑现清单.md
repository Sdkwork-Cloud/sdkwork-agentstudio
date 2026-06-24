# Step 完成后的架构回写与能力兑现清单

## 1. 文档定位

本文件用于防止“step 完成了，但架构承诺没有兑现，或兑现了却没回写到 `docs/架构/`”。

## 2. 使用时机

- 当前 step 已完成代码、测试和最小 smoke
- 已形成 `docs/review/step-XX-*`
- 准备进入下一 step 或进入波次总验收前

## 3. 必答问题

### 3.1 对应了哪些架构能力

- 对应的 `docs/架构/*.md`
- 对应的能力域、API 面、工作台分区或发布面

### 3.2 兑现了哪些能力

- 已兑现能力
- 未兑现能力
- 明确不在本步范围的能力

### 3.3 是否出现实现偏移

- `完全一致`
- `实现更具体`
- `实现有偏移`

### 3.4 需要回写哪些文档

- `docs/架构/*`
- `docs/step/*` 的依赖文档
- `docs/release/*` 的版本和 change log

### 3.5 证据是什么

- 代码证据
- 测试证据
- 运行证据
- 文档证据

## 4. Claw Studio 额外核对项

- 若涉及托管模型：是否仍保证全部模型访问统一经 Local Proxy
- 若涉及 API：是否仍满足对外/管理/内部/Gateway/Proxy 五类边界
- 若涉及 Instance Detail：是否仍满足 `15` 的一致性矩阵
- 若涉及 channels / instances / ClawHub / 插件机制 / chat：是否已对照 `webStudio.ts/test.ts`、`InstanceDetail.tsx`、`channelService.ts`、`marketService.ts`、`agentInstallService.ts`、`openClawConfigSchemaSupport.test.ts`
- 若涉及发布：是否已更新 `docs/release/` 和 changelog
- 若涉及 OpenClaw 升级：是否已更新升级证据与回滚口径

## 5. 必须回写的情况

- API、协议、鉴权、状态机、目录边界变化
- OpenClaw Runtime、Local Proxy、升级链变化
- Instance Detail 分区、读写真相源、工作台能力变化
- 打包、安装、部署、发布、商业化口径变化

## 6. 推荐产物

- `docs/review/step-XX-架构兑现-YYYY-MM-DD.md`
- `docs/review/step-XX-架构回写决议-YYYY-MM-DD.md`
- `docs/release/YYYY-MM-DD-release-*.md`

## 7. Step 完成五件套核对

- 代码或脚本实现已落地
- 测试与 smoke 已通过
- OpenClaw 对齐事实源已校对
- `docs/review/` 记录已补齐
- `docs/架构/` 与 `docs/release/` 已回写

## 8. 推荐模板

```md
# Step XX 架构兑现记录

## 对应架构文档
- 

## 已兑现能力
- 

## 未兑现能力
- 

## 偏移判定
- 完全一致 / 实现更具体 / 实现有偏移

## 需回写文档
- docs/架构/
- docs/step/
- docs/release/

## 证据
- 代码：
- 测试：
- 运行：
- 文档：

## 结论
- 是否允许进入下一 step：
```

## 9. 结论

step 只有在“能力兑现清楚、架构回写完成、release 说明同步”后，才算真正完成。
