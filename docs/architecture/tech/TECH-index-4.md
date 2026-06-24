> Migrated from `docs/zh-CN/index.md` on 2026-06-24.
> Owner: SDKWork maintainers

---
layout: home

hero:
  name: Claw Studio
  text: 一个产品外壳，多种运行模式，一套清晰的控制平面文档。
  tagline: Web、桌面端、原生 Server、Docker 与 Kubernetes 现在共享更清晰的架构说明、已发布的原生 `/claw/*` API 面，以及统一的发布体系。
  image:
    src: /logo.svg
    alt: Claw Studio
  actions:
    - theme: brand
      text: 快速开始
      link: /zh-CN/guide/getting-started
    - theme: alt
      text: API 参考
      link: /zh-CN/reference/api-reference

features:
  - title: 多运行模式交付
    details: 同一套产品能力可以运行在 Web 工作区、Tauri 桌面端、独立 Rust Server、Docker 部署包和 Kubernetes 发布包中。
  - title: 原生控制平面
    details: 服务端已经对外发布 `/claw/health/*`、`/claw/api/v1/*`、`/claw/openapi/*`、`/claw/internal/v1/*` 与 `/claw/manage/v1/*` 路由族。
  - title: 分包优先架构
    details: Shell、Core、Infrastructure、UI 与各业务 Feature 包通过显式的依赖边界和导入规则保持低耦合。
  - title: 桌面端与服务端对齐
    details: 桌面端 combined mode 与独立 Server 共享同一套逻辑控制平面契约，只是在传输层上有所区别。
  - title: 统一发布自动化
    details: GitHub Actions 会从同一套 release workflow 打包 desktop、server、container、kubernetes 与 web/docs 产物。
  - title: 面向运维落地
    details: 命令、环境变量、产物结构、安装步骤和部署说明都已经纳入标准文档体系。
---

## 这套文档覆盖什么

这个 VitePress 站点是当前 Claw Studio 公开文档的主入口，重点说明三类内容：

- 如何在 `pnpm` workspace 中进行开发与协作
- 如何以桌面端、原生 Server、Docker、Kubernetes 等方式交付应用
- 当前原生 `/claw/*` API 已实现了哪些能力，以及它们的运行边界是什么

## 推荐阅读顺序

- 从 [快速开始](/zh-CN/guide/getting-started) 开始
- 在 [应用模式](/zh-CN/guide/application-modes) 中选择合适的运行形态
- 在 [安装与部署](/zh-CN/guide/install-and-deploy) 中查看不同操作系统和部署方式的说明
- 在 [架构说明](/zh-CN/core/architecture) 中理解分层和分包边界
- 在 [API 总览](/zh-CN/reference/api-reference) 中查看当前原生接口面
- 在 [发布与部署](/zh-CN/core/release-and-deployment) 中查看打包与发布系统

## 当前 API 发布面

当前原生服务端已经发布：

- `GET /claw/health/live`
- `GET /claw/health/ready`
- `GET /claw/api/v1/discovery`
- `GET /claw/openapi/discovery`
- `GET /claw/openapi/v1.json`
- `/claw/internal/v1/*`
- `/claw/manage/v1/*`

请结合 [API 总览](/zh-CN/reference/api-reference) 查看接口分层，再结合 [Claw Server 运行时](/zh-CN/reference/claw-server-runtime) 查看运行时行为细节。

> `docs/plans` 与 `docs/superpowers` 中的历史计划文档会继续保留，但它们不会进入公开搜索索引。对外文档只应描述当前已实现行为，或明确标注为未来规划的边界。

