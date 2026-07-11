# Agent Studio

[English](./README.md)

Agent Studio 是面向现代 Agent Studio 应用、共享浏览器 Shell 与 Tauri 桌面运行时的 `pnpm` 分包工作区。当前实现以 `upgrade/agent-studio-v5` 为基线，已经重组为可维护的业务分包结构，并通过根级导入与架构校验持续约束演进方向。

本仓库的主线是 Agent Studio 产品本身。仓库内也包含 `packages/cc-switch` 这一独立包族，但主要脚本、架构与文档仍以 Agent Studio 为中心。

## 项目亮点

- Web 与桌面端共享同一套产品 Shell 与分层架构
- 采用垂直业务分包，覆盖 `chat`、`apps`、`market`、`settings`、`devices`、`account`、`extensions`、`community` 等模块
- 仓库内置严格的依赖分层与根级导入边界校验
- 提供 Tauri 桌面运行时、更新能力与分发基础设施
- 面向开源协作与商业交付同时提供文档入口

## 架构快照

```text
web/desktop -> shell -> feature -> (commons + core + infrastructure + i18n + types + ui)
shell -> (core + i18n + ui + feature)
core -> (infrastructure + i18n + types)
infrastructure -> (i18n + types)
```

核心包职责：

- `@sdkwork/agentstudio-pc-web`：可运行的 Web 应用与 Vite 宿主
- `@sdkwork/agentstudio-pc-desktop`：Tauri 桌面入口与原生桥接
- `@sdkwork/agentstudio-pc-shell`：路由、布局、Provider、侧边栏、命令面板
- `@sdkwork/agentstudio-pc-core`：共享 store 与跨业务编排
- `@sdkwork/agentstudio-pc-types`：纯类型与共享领域模型
- `@sdkwork/agentstudio-pc-infrastructure`：环境配置、HTTP、i18n 与平台适配
- `@sdkwork/agentstudio-pc-*`：垂直业务包，例如 `chat`、`market`、`settings`、`account`、`extensions`

仓库禁止跨包子路径导入。请使用 `@sdkwork/agentstudio-pc-market` 这类包根导入，不要使用 `@sdkwork/agentstudio-pc-market/src/...`。

## 快速开始

```bash
pnpm install
pnpm dev
```

默认 Web 开发服务器通过 Vite 启动 `@sdkwork/agentstudio-pc-web`，地址为 `http://localhost:3001`。

桌面开发与打包命令：

```bash
pnpm dev:desktop
pnpm build:desktop
```

## 常用命令

```bash
pnpm dev           # 启动 Web Shell
pnpm build         # 构建 Web 包
pnpm lint          # TypeScript + 架构 + parity 校验
pnpm check:arch    # 验证分包边界与根级导入
pnpm check:parity  # 校验关键功能与 v5 基线一致
pnpm check:desktop # 校验桌面平台基础能力
pnpm docs:dev      # 启动 VitePress 文档站
pnpm docs:build    # 构建 VitePress 文档站
```

也可以通过 `pnpm --filter` 执行包级脚本，例如：

```bash
pnpm --filter @sdkwork/agentstudio-pc-web build
```

## 环境变量

从 [`.env.example`](./.env.example) 开始。关键变量包括：

- `GEMINI_API_KEY`：Gemini AI 相关能力所需
- `VITE_API_BASE_URL`：类型化客户端与桌面更新检查使用的后端地址
- `SDKWORK_ACCESS_TOKEN`：可选的私有 bootstrap 访问令牌（通过 vite define 注入，禁止 `VITE_*` 凭证 env）
- `VITE_APP_ID`、`VITE_RELEASE_CHANNEL`、`VITE_DISTRIBUTION_ID`、`VITE_PLATFORM`、`VITE_TIMEOUT`：桌面运行时与更新相关配置

桌面端示例可参考 [`packages/sdkwork-agentstudio-pc-desktop/.env.example`](./packages/sdkwork-agentstudio-pc-desktop/.env.example)。

## 开源协议与商业授权

Agent Studio 采用双授权模式：

- 开源授权：[`AGPL-3.0-only`](./LICENSE)
- 商业授权：[`LICENSE-COMMERCIAL.md`](./LICENSE-COMMERCIAL.md)

需要明确的是，标准 AGPL 本身并不直接禁止商业使用。仓库当前采用的对外策略是：

- 如果你的使用方式能够完整遵循 AGPL 的义务，可以按 AGPL 使用、修改和分发本项目
- 如果你的场景需要闭源、商业豁免、OEM、白标、客户交付、商业采购、发票、SLA 或专属技术支持，则需要另行购买商业授权

如果你无法判断自己的场景是否可以按 AGPL 合规落地，建议在生产使用前先联系 SdkWork 确认。

## 哪些场景建议购买商业授权

| 场景 | 是否建议购买商业授权 | 说明 |
| --- | --- | --- |
| 个人学习、研究、评估 | 否，可按 AGPL 使用 | 前提是你愿意遵循 AGPL 义务 |
| 开源项目二次开发并继续开源 | 否，可按 AGPL 使用 | 保持 AGPL 合规即可 |
| 闭源商业产品 | 是 | 不适合仅依赖 AGPL |
| 商业 SaaS 服务且不希望处理 AGPL 合规义务 | 是 | 建议直接购买商业授权 |
| 内部商业系统、客户私有化交付 | 是 | 通常涉及闭源部署与合同要求 |
| OEM、白标、嵌入式集成、再分发 | 是 | 需要单独的分发与商用授权范围 |
| 需要采购合同、发票、SLA、专属支持 | 是 | 属于标准商业授权能力范围 |

## 商业授权套餐

以下价格为公开参考价，默认按人民币未税年费展示。最终价格、税费、授权范围、交付物与支持承诺，以正式报价单、订单或合同为准。

| 套餐 | 参考价格 | 适用对象 | 授权范围摘要 | 支持摘要 |
| --- | --- | --- | --- | --- |
| 个人开发者商业授权 | `RMB 2,999 / 年` | 个体开发者、独立工作室、PoC 验证 | 1 个主体、1 个商业项目、最多 3 名开发者、1 个生产环境，不含 OEM/白标/再分发 | 社区支持、版本更新 |
| 团队商业授权 | `RMB 12,800 / 年` | 5 到 20 人小团队、单品牌商业项目 | 1 个法人主体、最多 20 名开发者、最多 3 个生产环境，不含 OEM/白标 | 邮件或社群答疑、年度更新 |
| 企业商业授权 | `RMB 49,800 / 年` | 成熟商业团队、正式生产系统 | 1 个法人主体及直属团队、最多 100 名开发者、多个生产环境、单品牌对外商业服务 | 优先支持、补丁与升级说明 |
| OEM / 白标 / 再分发授权 | `RMB 159,000 / 年起` | 私有化交付、贴牌、嵌入式集成、渠道再销售 | 允许再分发、允许客户交付、允许白标或 OEM，具体范围以合同定义 | 商务对接、授权函、交付配套 |
| 私有定制与源码护航 | `RMB 299,000 / 年起` | 集团客户、政企项目、长期合作 | 在商业授权基础上附加定制开发、专项补丁、交付协作与合规支持 | 专属群、SLA、定制支持 |

## 商业购买流程

1. 明确你的部署模型：闭源产品、SaaS、内部系统、私有化交付、OEM 或白标。
2. 统计核心信息：法人主体、开发人数、生产环境数量、是否需要再分发、是否需要发票与 SLA。
3. 根据上表先选择一个最接近的套餐作为起点。
4. 通过 [sales@sdkwork.com](mailto:sales@sdkwork.com) 或下方社群入口发起商务咨询。
5. 双方确认授权范围、支持等级、交付物和采购要求。
6. 完成报价、付款、合同或订单签署后，交付正式商业授权文件。

主销售邮箱：[sales@sdkwork.com](mailto:sales@sdkwork.com)

建议通过该邮箱处理以下事项：

- 商业授权与公开报价咨询
- OEM、白标、再分发与私有化交付
- 企业采购、发票与合同沟通
- 定制开发、专项支持与长期合作洽谈

销售响应目标：`2 个工作日内首响`

建议邮件标题：

- `Agent Studio 商业授权咨询`

建议首封邮件附带以下信息：

- 公司名称或个人主体名称
- 计划购买的套餐档位
- 部署模型：SaaS、闭源产品、内部系统、私有化交付、OEM 或白标
- 预计开发席位数量
- 预计生产环境数量
- 是否需要发票、SLA、再分发权限或定制开发

在官网购买页或专门销售二维码补充前，当前仓库建议优先通过销售邮箱或社区入口进行首轮沟通。

## 联系销售

- 主销售邮箱：[sales@sdkwork.com](mailto:sales@sdkwork.com)
- 适用事项：商业授权、采购报价、OEM、白标、再分发、私有化交付与定制合作
- 响应目标：`2 个工作日内首响`

为了缩短沟通周期，建议首封邮件补充以下信息：

- 法人主体名称
- 目标套餐档位
- 部署模型
- 是否需要发票、合同评审或专属支持
- 预计上线时间

## 续费与升级

- 个人版、团队版、企业版均可通过销售邮箱办理续费
- 当团队规模扩大、生产环境增加或准备开启再分发前，建议先升级授权档位
- OEM、白标、再分发和定制交付类合作通常按个案续签或重新报价
- 最终续费范围、升级价格与交付条件，以有效报价单、订单或合同为准

## 社区与加群二维码

当前仓库尚未提交真实群二维码素材，因此先提供可替换占位图。你后续只需要将对应 SVG 文件替换为真实二维码图片，即可保持 README 中的展示位置不变。

| 渠道 | 二维码 |
| --- | --- |
| 飞书群 | <img src="./docs/public/community/feishu-qr-placeholder.svg" alt="飞书群二维码占位图" width="180" /> |
| 微信群 | <img src="./docs/public/community/wechat-qr-placeholder.svg" alt="微信群二维码占位图" width="180" /> |
| QQ 群 | <img src="./docs/public/community/qq-qr-placeholder.svg" alt="QQ 群二维码占位图" width="180" /> |
| Sdkwork Chat | <img src="./docs/public/community/sdkwork-chat-qr-placeholder.svg" alt="Sdkwork Chat 二维码占位图" width="180" /> |

建议后续替换方式：

- 将飞书群二维码替换到 `docs/public/community/feishu-qr-placeholder.svg`
- 将微信群二维码替换到 `docs/public/community/wechat-qr-placeholder.svg`
- 将 QQ 群二维码替换到 `docs/public/community/qq-qr-placeholder.svg`
- 将 Sdkwork Chat 二维码替换到 `docs/public/community/sdkwork-chat-qr-placeholder.svg`

如果你后续拿到的是 PNG 或 JPG，而不是 SVG，也建议保持文件名不变并同步更新 README 引用，避免 README 展示失效。

销售联系邮箱：[sales@sdkwork.com](mailto:sales@sdkwork.com)
响应目标：`2 个工作日内首响`

## 常见问题

### 我只是个人研究和试用，需要购买商业授权吗？

不需要。只要你的使用场景能够遵循 [`LICENSE`](./LICENSE) 中的 AGPL 义务，就可以直接按 AGPL 使用。

### 我修改了源码，并且愿意继续按 AGPL 开源，是否可以不购买商业授权？

可以。前提是你的实际使用方式确实满足 AGPL 的要求。

### 我想做闭源 SaaS 或闭源商业产品，是否必须购买商业授权？

是。对于闭源商用、商用豁免、客户交付、OEM、白标或再分发场景，建议直接购买商业授权，而不是仅依赖 AGPL。

### 我们是公司内部商业项目，但不想处理 AGPL 合规流程，怎么办？

直接选择团队版、企业版或更高阶商业授权。这样能更清晰地获得闭源商业使用权与商务交付保障。

### 套餐价格是最终成交价吗？

不是。README 中展示的是公开参考价，用于帮助潜在客户快速判断预算区间。最终价格与条款以正式报价单、订单或合同为准。

## 文档

- [快速开始](./docs/guide/getting-started.md)
- [开发指南](./docs/guide/development.md)
- [架构说明](./docs/core/architecture.md)
- [分包布局](./docs/core/packages.md)
- [桌面运行时](./docs/core/desktop.md)
- [命令参考](./docs/reference/commands.md)
- [贡献指南](./docs/contributing/index.md)

仓库内也保留了 `@sdkwork/agentstudio-pc-docs` 这个应用内文档功能包。`docs/` 下的 VitePress 站点则是面向 GitHub 与开源协作者的公共项目文档。

## 贡献

提交信息遵循 Conventional Commits，例如 `feat:`、`fix:`、`refactor:`、`docs:`。发起 Pull Request 前请至少执行：

```bash
pnpm lint
pnpm build
pnpm docs:build
```

PR 应包含简明说明、影响包列表、验证命令，以及涉及界面变更时的截图。
