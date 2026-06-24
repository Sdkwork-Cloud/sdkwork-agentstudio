> Migrated from `docs/zh-CN/features/overview.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 功能总览

## 产品界面

当前工作区在按职责拆分为业务包的同时，继续保持与 `upgrade/claw-studio-v5` 基本一致的产品界面，并通过共享 Shell 同时服务 Web 与桌面端。

## Workspace 分组

- `dashboard`：面向运营与控制平面的工作区首页
- `auth`：认证入口与登录流程
- `chat`：AI 对话体验
- `channels`：provider 与 channel 视图
- `tasks`：定时任务与任务运行面
- `account`：账户相关页面

## Ecosystem 分组

- `apps`：应用商店视图
- `market`：ClawHub 与技能详情
- `extensions`：扩展与技能包管理
- `community`：社区内容与互动流程
- `github`：GitHub 仓库视图
- `huggingface`：Hugging Face 模型视图

## Setup 分组

- `install`：安装引导流程
- `instances`：实例管理
- `devices`：设备管理
- `claw-center`：Claw Center 页面

## 支撑性功能区

- `settings`：应用配置
- `docs`：应用内文档页面

## 为什么按功能拆包

每个功能包都拥有自己的 `pages`、`components` 与 `services`。这样业务逻辑会始终贴近它服务的 UI 界面，不会重新把 `shell` 或所谓的 `business` 层堆成新的单体。

## 对齐目标

迁移目标是在功能和视觉上尽量与 `upgrade/claw-studio-v5` 保持一致。分包本身是为了提升维护性，而不是为了重做产品设计。

