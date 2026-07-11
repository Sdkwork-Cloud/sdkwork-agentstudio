# 上游运行时集成

## 目标

本文记录当前 `agent-studio` 的运行时集成基线，用来替代早期围绕独立 provider router runtime 的历史设计说明。

## 当前架构

当前有效架构如下：

1. Tauri 与 Rust Host 负责安装、生命周期管理和打包期集成。
2. 桌面组件服务负责软件发现、受管安装记录和安装元数据。
3. OpenClaw 是桌面端本地受管场景中的主运行时。
4. Agent Studio 通过 OpenClaw 兼容配置文件和运行时桥接来读写 provider 与 agent 配置。
5. Web Host 与 Desktop Host 保持轻量，只消费包根暴露的 API。

## 运行时边界

- Rust Host：安装、升级、进程监管、原生命令桥接、事件分发
- 组件服务：软件注册表、包元数据、安装进度
- OpenClaw Runtime：运行时行为、配置权威、agent 工作区、provider 配置
- Feature Packages：只负责 UI 与产品流程

## 实施规则

- 不要在受版本控制的 `.env*` 文件中重新引入 router 专属环境变量
- 不要在桌面端打包逻辑中重新假设存在独立 router runtime
- provider 迁移兼容逻辑应集中在共享 helper 中
- 优先通过 OpenClaw 的配置面和运行时能力完成集成
