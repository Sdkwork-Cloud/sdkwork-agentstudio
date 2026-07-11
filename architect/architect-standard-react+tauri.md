# 通用应用架构标准 v1.0

## 目录

1. [架构概述](#一架构概述)
2. [核心设计原则](#二核心设计原则)
3. [技术栈规范](#三技术栈规范)
4. [四模式包架构](#四四模式包架构)
5. [标准包结构](#五标准包结构)
6. [分层架构设计](#六分层架构设计)
7. [平台适配层设计](#七平台适配层设计)
8. [状态管理规范](#八状态管理规范)
9. [路由系统设计](#九路由系统设计)
10. [国际化规范](#十国际化规范)
11. [开发规范](#十一开发规范)
12. [构建与发布](#十二构建与发布)
13. [快速启动模板](#十三快速启动模板)
14. [附录](#十四附录)

---


## 一、架构概述

### 1.1 目标

本架构标准旨在提供一套**可复用、可扩展、标准化**的前端应用架构规范，使开发团队能够快速创建高质量的应用程序。适用于：

- ✅ 新建 Web 应用
- ✅ 桌面应用（Tauri/Electron）
- ✅ 移动端应用（Capacitor/React Native）
- ✅ 组件库/SDK 开发
- ✅ 微前端架构

### 1.2 架构特点

| 特点 | 描述 | 价值 |
|------|------|------|
| **四模式统一** | 每个包支持四种使用模式 | 一套代码，多场景复用 |
| **分层模块化** | 基础层 → 核心层 → 服务层 → 业务层 | 职责清晰，易于维护 |
| **平台无关性** | 通过适配层抽象平台差异 | 跨平台部署，无缝切换 |
| **类型安全** | TypeScript 严格模式 | 编译期错误检测，智能提示 |
| **开箱即用** | 标准化模板和工具链 | 快速启动，减少配置 |

### 1.3 四模式使用场景

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              四模式使用场景                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  模式一：独立 Web 应用                                                           │
│  ├── 场景：SaaS 产品、演示环境、测试环境                                        │
│  ├── 部署：CDN、Vercel、Netlify、Docker                                         │
│  └── 更新：热更新、无需用户操作                                                 │
│                                                                                  │
│  模式二：独立桌面应用                                                            │
│  ├── 场景：桌面客户端、离线应用、系统集成                                       │
│  ├── 部署：.msi/.dmg/.deb 安装包                                                │
│  └── 更新：应用内更新、版本控制                                                 │
│                                                                                  │
│  模式三：Node.js 依赖包                                                          │
│  ├── 场景：集成到现有应用、模块化开发                                           │
│  ├── 部署：npm publish、私有仓库                                                │
│  └── 更新：包版本管理、语义化版本                                               │
│                                                                                  │
│  模式四：原生应用依赖包                                                          │
│  ├── 场景：混合应用、原生能力扩展                                               │
│  ├── 部署：npm + 原生模块仓库                                                   │
│  └── 更新：包版本管理、原生模块同步更新                                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、核心设计原则

### 2.1 SOLID 原则

| 原则 | 描述 | 实践方式 |
|------|------|----------|
| **单一职责 (SRP)** | 每个模块只负责一个功能域 | 按功能划分包，每个包职责单一 |
| **开闭原则 (OCP)** | 对扩展开放，对修改关闭 | 接口抽象、策略模式、依赖注入 |
| **里氏替换 (LSP)** | 子类可替换父类 | 接口编程、多态设计 |
| **接口隔离 (ISP)** | 使用多个专用接口而非单一通用接口 | 细粒度接口设计 |
| **依赖倒置 (DIP)** | 依赖抽象而非具体实现 | 依赖注入、控制反转 |

### 2.2 架构分层原则

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              架构分层图                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           应用层 (Application Layer)                     │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  Pages / Layouts / Routes / Providers                           │   │   │
│  │  │  - 页面组装                                                      │   │   │
│  │  │  - 路由配置                                                      │   │   │
│  │  │  - 全局状态提供者                                                │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           业务层 (Business Layer)                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  Components / Services / Stores                                 │   │   │
│  │  │  - UI 组件                                                       │   │   │
│  │  │  - 业务逻辑服务                                                  │   │   │
│  │  │  - 状态管理                                                      │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           领域层 (Domain Layer)                          │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  Entities / Value Objects / Domain Services                     │   │   │
│  │  │  - 核心业务实体                                                  │   │   │
│  │  │  - 值对象                                                        │   │   │
│  │  │  - 领域服务                                                      │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           基础设施层 (Infrastructure Layer)              │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │  │  Platform Adapters / Repositories / Utils                       │   │   │
│  │  │  - 平台适配器                                                    │   │   │
│  │  │  - 数据持久化                                                    │   │   │
│  │  │  - 工具函数                                                      │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  依赖方向：自顶向下，禁止反向依赖                                                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 模块划分原则

| 原则 | 描述 | 检查清单 |
|------|------|----------|
| **高内聚** | 相关功能聚集在同一模块 | 模块内部调用频繁，模块间调用少 |
| **低耦合** | 模块间依赖最小化 | 通过接口通信，减少直接依赖 |
| **边界清晰** | 模块职责明确 | 每个模块有清晰的输入输出 |
| **可测试性** | 模块可独立测试 | 可 Mock 依赖，无副作用 |
| **可替换性** | 模块可独立替换 | 实现可插拔，不影响其他模块 |

---

## 三、技术栈规范

### 3.1 包管理与构建工具（必选）

| 技术 | 版本范围 | 用途 | 说明 |
|------|----------|------|------|
| **pnpm** | ^9.0.0 | 包管理器 | 高效磁盘利用，严格依赖管理，Monorepo 原生支持 |
| **Vite** | ^7.0.0 | 构建工具 | 支持 HMR、代码分割，双模式构建 |

#### pnpm 包管理器

本项目使用 **pnpm** 作为包管理器，具有以下优势：

| 特性 | 描述 |
|------|------|
| **磁盘效率** | 内容寻址存储，全局去重，节省磁盘空间 |
| **严格依赖** | 避免幽灵依赖，只能访问 package.json 中声明的依赖 |
| **Monorepo 支持** | 原生支持 workspace，无需额外工具 |
| **安装速度** | 符号链接机制，安装速度快于 npm/yarn |

```bash
# 安装 pnpm
npm install -g pnpm

# 安装依赖
pnpm install

# 添加依赖
pnpm add <package>

# 添加开发依赖
pnpm add -D <package>

# 按包安装依赖
pnpm --filter <package-name> add <dependency>

# 运行脚本
pnpm --filter <package-name> dev

# 发布包
pnpm publish
```

#### Vite 构建工具

本项目使用 **Vite** 作为构建工具，支持双模式构建：

| 模式 | 配置文件 | 用途 |
|------|----------|------|
| **库模式** | vite.config.ts | 构建 npm 包 |
| **应用模式** | vite.app.config.ts | 构建独立应用 |

### 3.2 核心技术栈（必选）

| 技术 | 版本范围 | 用途 | 说明 |
|------|----------|------|------|
| **React** | ^19.0.0 | UI 框架 | 使用函数组件 + Hooks |
| **TypeScript** | ^5.9.0 | 类型系统 | 严格模式，禁止 any |

### 3.3 状态管理（必选其一）

| 方案 | 版本 | 适用场景 | 说明 |
|------|------|----------|------|
| **Zustand** | ^5.0.0 | 推荐，轻量级 | 简单 API，无样板代码 |
| **Redux Toolkit** | ^2.0.0 | 复杂状态管理 | 完整生态，DevTools |
| **Jotai** | ^2.0.0 | 原子化状态 | 细粒度更新，性能好 |

### 3.3 样式方案（必选其一）

| 方案 | 版本 | 适用场景 | 说明 |
|------|------|----------|------|
| **Tailwind CSS** | ^4.0.0 | 推荐，原子化 | 实用优先，JIT 编译 |
| **CSS Modules** | 内置 | 组件级样式 | 作用域隔离，无冲突 |
| **Styled Components** | ^6.0.0 | CSS-in-JS | 动态样式，主题支持 |

### 3.4 路由系统（按需）

| 方案 | 版本 | 适用场景 | 说明 |
|------|------|----------|------|
| **React Router** | ^7.0.0 | SPA 应用 | 完整路由功能 |
| **TanStack Router** | ^1.0.0 | 类型安全路由 | 完整类型推导 |
| **Wouter** | ^3.0.0 | 轻量级 | 仅 1KB，基础路由 |

### 3.5 桌面/移动端（按需）

| 平台 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **桌面** | Tauri | ^2.0.0 | Rust 后端，体积小 |
| **桌面** | Electron | ^30.0.0 | Chromium 内核，生态好 |
| **移动** | Capacitor | ^6.0.0 | 原生容器，易集成 |
| **移动** | React Native | ^0.75.0 | 原生渲染，性能好 |

### 3.6 工具库（推荐）

```json
{
  "dependencies": {
    "classnames": "^2.5.0",
    "immer": "^11.0.0",
    "date-fns": "^4.0.0",
    "lodash-es": "^4.17.21",
    "uuid": "^11.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

---

## 四、四模式包架构

### 4.1 包结构总览

```
my-package/
├── src/                          # 统一源码
│   ├── index.ts                  # 公共 API 导出
│   ├── components/               # UI 组件
│   ├── pages/                    # 页面组件
│   ├── services/                 # 业务服务
│   ├── store/                    # 状态管理
│   ├── entities/                 # 实体定义
│   ├── types/                    # 类型定义
│   ├── hooks/                    # 自定义 Hooks
│   ├── constants/                # 常量定义
│   ├── utils/                    # 工具函数
│   ├── platform/                 # 平台适配层
│   ├── i18n/                     # 国际化配置
│   └── router/                   # 路由配置
│
├── app/                          # 独立应用入口
│   ├── main.tsx                  # 应用入口
│   ├── App.tsx                   # 根组件
│   └── index.html                # HTML 模板
│
├── src-tauri/                    # Tauri 原生模块（可选）
│   ├── src/
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── dist/                         # 构建产物
├── package.json                  # 包配置
├── tsconfig.json                 # TypeScript 配置
├── vite.config.ts                # Vite 配置（库模式）
├── vite.app.config.ts            # Vite 配置（应用模式）
└── README.md                     # 包文档
```

### 4.2 示例项目目录结构

以下是一个完整的 Monorepo 项目示例，展示多个包的组织方式：

#### 包命名规范

所有包**必须**使用 `@sdkwork` 作用域，遵循以下命名规范：

```
@sdkwork/<package-name>
```

**命名规则**：

1. **必须使用 `@sdkwork` 作用域** - 区分内部包和第三方包
2. **使用 kebab-case**（小写+连字符）- 如 `@sdkwork/react-commons`
3. **遵循技术前缀模式**：
   - React 包：`@sdkwork/react-*`
   - 核心包：`@sdkwork/core-*`
   - 工具包：`@sdkwork/utils-*`

| 层级 | 包名格式 | 示例 |
|------|----------|------|
| Layer 0 | `@sdkwork/react-{name}` | `@sdkwork/react-core` |
| Layer 1 | `@sdkwork/react-{name}` | `@sdkwork/react-commons` |
| Layer 2 | `@sdkwork/react-{name}` | `@sdkwork/react-auth` |
| Layer 3 | `@sdkwork/react-{name}` | `@sdkwork/react-user` |

**正确示例** ✅：
- `@sdkwork/react-video`
- `@sdkwork/react-audio`
- `@sdkwork/react-editor`

**错误示例** ❌：
- `react-video`（缺少作用域）
- `@sdkwork/reactVideo`（使用 camelCase）
- `@sdkwork/VideoEditor`（使用 PascalCase）

**导入规范**：
```typescript
// ✅ 正确 - 使用作用域包名
import { Button } from '@sdkwork/react-commons';
import { useAuthStore } from '@sdkwork/react-auth';

// ❌ 错误 - 不要使用相对路径跨包导入
import { Button } from '../../sdkwork-react-commons/src';
```

```
sdkwork-desktop-monorepo/
├── packages/                         # 所有包目录
│   │
│   ├── @sdkwork/react-core/           # 核心包 (Layer 0)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── router/               # 路由核心
│   │   │   ├── store/                # 状态管理核心
│   │   │   ├── events/               # 事件总线
│   │   │   └── platform/             # 平台抽象
│   │   │       ├── index.ts
│   │   │       ├── types.ts
│   │   │       ├── web.ts            # Web 平台实现
│   │   │       └── tauri.ts          # Tauri 平台实现
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── @sdkwork/react-commons/        # 通用包 (Layer 1)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── components/           # 通用组件
│   │   │   │   ├── Button/
│   │   │   │   ├── Dialog/
│   │   │   │   └── ...
│   │   │   ├── hooks/                # 通用 Hooks
│   │   │   ├── utils/                # 工具函数
│   │   │   ├── types/                # 类型定义
│   │   │   └── constants/            # 常量
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── @sdkwork/react-i18n/           # 国际化包 (Layer 0)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   └── locales/
│   │   │       ├── zh-CN/
│   │   │       └── en-US/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── @sdkwork/react-auth/           # 认证包 (Layer 2)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   ├── router/
│   │   │   │   ├── index.ts
│   │   │   │   ├── routes.ts
│   │   │   │   └── guards.ts
│   │   │   └── i18n/
│   │   │       ├── index.ts
│   │   │       └── locales/
│   │   ├── app/                      # 独立应用入口
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── vite.app.config.ts
│   │
│   ├── @sdkwork/react-user/           # 用户包 (Layer 3)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   │   ├── ProfilePage.tsx
│   │   │   │   └── SettingsPage.tsx
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   ├── entities/
│   │   │   │   └── User.ts
│   │   │   ├── router/
│   │   │   │   ├── index.ts
│   │   │   │   ├── routes.ts
│   │   │   │   └── types.ts
│   │   │   └── i18n/
│   │   │       ├── index.ts
│   │   │       ├── types.ts
│   │   │       └── locales/
│   │   │           ├── zh-CN/
│   │   │           │   ├── index.ts
│   │   │           │   ├── common.ts
│   │   │           │   ├── page.ts
│   │   │           │   └── form.ts
│   │   │           └── en-US/
│   │   │               ├── index.ts
│   │   │               ├── common.ts
│   │   │               ├── page.ts
│   │   │               └── form.ts
│   │   ├── app/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   └── index.html
│   │   ├── src-tauri/                # Tauri 原生模块 (可选)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── vite.app.config.ts
│   │
│   ├── @sdkwork/react-image/          # 图片生成包 (Layer 3)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   │   └── ImagePage.tsx
│   │   │   ├── services/
│   │   │   ├── store/
│   │   │   ├── router/
│   │   │   └── i18n/
│   │   ├── app/
│   │   ├── src-tauri/
│   │   ├── package.json
│   │   └── ...
│   │
│   ├── @sdkwork/react-video/          # 视频生成包 (Layer 3)
│   │   └── ...
│   │
│   ├── @sdkwork/react-audio/          # 音频生成包 (Layer 3)
│   │   └── ...
│   │
│   └── ...                           # 其他业务包
│
├── apps/                             # 独立应用目录 (可选)
│   ├── desktop-app/                  # 桌面应用
│   │   ├── src/
│   │   ├── src-tauri/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── web-app/                      # Web 应用
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
│
├── pnpm-workspace.yaml               # pnpm 工作区配置
├── package.json                      # 根 package.json
├── tsconfig.json                     # 根 TypeScript 配置
├── .npmrc                            # npm 配置
└── README.md                         # 项目文档
```

#### pnpm-workspace.yaml 配置

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

#### 根 package.json 配置

```json
{
  "name": "sdkwork-desktop-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @sdkwork/react-user dev",
    "dev:tauri": "pnpm --filter @sdkwork/react-user tauri:dev",
    "build": "pnpm -r build",
    "build:app": "pnpm -r build:app",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "vite": "^7.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "@tauri-apps/cli": "^2.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

### 4.3 package.json 标准配置

```json
{
  "name": "@sdkwork/my-package",
  "version": "1.0.0",
  "description": "Package description",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./styles": "./dist/style.css",
    "./package.json": "./package.json"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "sideEffects": false,
  "scripts": {
    "dev": "vite --config vite.app.config.ts",
    "build": "vite build && tsc --emitDeclarationOnly",
    "build:app": "vite build --config vite.app.config.ts",
    "preview": "vite preview --config vite.app.config.ts",
    "tauri": "tauri dev",
    "tauri:build": "tauri build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,json}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,css,json}\"",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "prepublishOnly": "pnpm build && pnpm test:run"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "dependencies": {
    "@sdkwork/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.9.0",
    "vite": "^7.0.0"
  },
  "publishConfig": {
    "access": "restricted",
    "registry": "https://registry.npmjs.org/"
  },
  "keywords": ["react", "typescript", "vite", "sdkwork"],
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 4.3 Vite 配置标准

#### 库模式配置 (vite.config.ts)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyPackage',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
    outDir: 'dist',
  },
});
```

#### 应用模式配置 (vite.app.config.ts)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'app',
  publicDir: '../public',
  build: {
    outDir: '../dist-app',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'app/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'app/src'),
      'my-package': resolve(__dirname, 'src/index.ts'),
    },
  },
});
```

---

## 五、标准包结构

### 5.1 入口文件规范

```typescript
// src/index.ts - 公共 API 导出
// 导出组件
export { default as MainComponent } from './components/MainComponent';
export { Button } from './components/Button';
export { Dialog } from './components/Dialog';

// 导出页面
export { default as HomePage } from './pages/HomePage';
export { default as SettingsPage } from './pages/SettingsPage';

// 导出服务
export { ApiService } from './services/ApiService';
export { DataService } from './services/DataService';

// 导出状态管理
export { useStore, createStore } from './store/store';
export type { StoreState } from './store/store';

// 导出实体
export type { User, Product, Order } from './entities';

// 导出类型
export type { ApiResponse, PaginationParams } from './types';

// 导出 Hooks
export { useAsync } from './hooks/useAsync';
export { useDebounce } from './hooks/useDebounce';

// 导出常量
export { API_VERSION, DEFAULT_CONFIG } from './constants';

// 导出平台适配
export { initializePlatform, getPlatformAdapter } from './platform';
export type { PlatformAdapter } from './platform';

// 导出国际化
export { useTranslation, TranslationProvider } from './i18n';
export type { TranslationKey } from './i18n';
```

### 5.2 组件规范

```typescript
// src/components/Button.tsx
import React from 'react';
import classNames from 'classnames';

// Props 接口定义
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否加载状态 */
  loading?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 子元素 */
  children?: React.ReactNode;
}

/**
 * 按钮组件
 * 
 * @example
 * <Button variant="primary" onClick={handleClick}>
 *   点击我
 * </Button>
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const classes = classNames(
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    { 'btn-loading': loading },
    { 'btn-disabled': disabled || loading },
    className
  );

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="btn-spinner" />}
      {children}
    </button>
  );
};

export default Button;
```

### 5.3 服务层规范

```typescript
// src/services/ApiService.ts
import type { ApiResponse, ApiConfig } from '../types';

export interface ApiServiceConfig extends ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class ApiService {
  private baseURL: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(config: ApiServiceConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout ?? 30000;
    this.headers = config.headers ?? {};
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const response = await this.request<T>('GET', url, { params });
    return response;
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.request<T>('POST', url, { data });
    return response;
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.request<T>('PUT', url, { data });
    return response;
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.request<T>('DELETE', url);
    return response;
  }

  private async request<T>(
    method: string,
    url: string,
    options: { params?: Record<string, unknown>; data?: unknown } = {}
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        signal: controller.signal,
        ...(options.params && { params: options.params }),
        ...(options.data && { body: JSON.stringify(options.data) }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

### 5.4 实体定义规范

```typescript
// src/entities/index.ts
/**
 * 用户实体
 */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'user' | 'guest';

/**
 * 产品实体
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  images: string[];
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 订单实体
 */
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress: Address;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}
```

### 5.5 类型定义规范

```typescript
// src/types/index.ts
/**
 * API 响应类型
 */
export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * 分页参数
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 异步状态
 */
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

/**
 * 配置接口
 */
export interface ApiConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
}
```

### 5.6 自定义 Hooks 规范

```typescript
// src/hooks/useAsync.ts
import { useState, useCallback } from 'react';
import type { AsyncState } from '../types';

interface UseAsyncOptions {
  immediate?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: string) => void;
}

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  options: UseAsyncOptions = {}
) {
  const { immediate = false, onSuccess, onError } = options;
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' });

  const execute = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const data = await asyncFn();
      setState({ status: 'success', data });
      onSuccess?.(data);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState({ status: 'error', error: errorMessage });
      onError?.(errorMessage);
      throw error;
    }
  }, [asyncFn, onSuccess, onError]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  if (immediate) {
    execute();
  }

  return { ...state, execute, reset };
}
```

---

## 六、分层架构设计

### 6.1 分层职责定义

| 层级 | 职责 | 依赖方向 | 示例 |
|------|------|----------|------|
| **应用层** | 应用组装、路由、全局状态 | 依赖业务层 | App.tsx, routes.ts |
| **业务层** | 业务逻辑、UI 组件、状态管理 | 依赖领域层 | Components, Services, Stores |
| **领域层** | 核心业务实体、领域服务 | 无依赖 | Entities, Value Objects |
| **基础设施层** | 平台适配、数据持久化、工具 | 被所有层依赖 | Platform Adapters, Utils |

### 6.2 依赖规则

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              依赖规则图                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    应用层 (Application)                                                          │
│         │                                                                        │
│         ▼                                                                        │
│    业务层 (Business)                                                             │
│         │                                                                        │
│         ▼                                                                        │
│    领域层 (Domain)                                                               │
│         │                                                                        │
│         ▼                                                                        │
│    基础设施层 (Infrastructure)                                                   │
│                                                                                  │
│  规则：                                                                           │
│  ✅ 上层可以依赖下层                                                             │
│  ❌ 下层不能依赖上层                                                             │
│  ❌ 禁止跨层依赖                                                                 │
│  ✅ 同层模块可以互相依赖                                                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 跨层通信模式

```typescript
// 使用接口解耦跨层依赖
// 领域层定义接口
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

// 基础设施层实现接口
export class ApiUserRepository implements UserRepository {
  private apiService: ApiService;

  constructor(apiService: ApiService) {
    this.apiService = apiService;
  }

  async findById(id: string): Promise<User | null> {
    const response = await this.apiService.get<User>(`/users/${id}`);
    return response.success ? response.data : null;
  }

  async save(user: User): Promise<void> {
    const response = await this.apiService.post('/users', user);
    if (!response.success) {
      throw new Error(response.error);
    }
  }

  async delete(id: string): Promise<void> {
    const response = await this.apiService.delete(`/users/${id}`);
    if (!response.success) {
      throw new Error(response.error);
    }
  }
}

// 业务层通过依赖注入使用接口
export class UserService {
  constructor(private userRepository: UserRepository) {}

  async getUser(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}
```

---

## 七、平台适配层设计

### 7.1 平台适配器接口

```typescript
// src/platform/types.ts
/**
 * 平台适配器接口
 */
export interface PlatformAdapter {
  // 文件系统
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  
  // 对话框
  showOpenDialog(options: OpenDialogOptions): Promise<string[] | null>;
  showSaveDialog(options: SaveDialogOptions): Promise<string | null>;
  showMessageBox(options: MessageBoxOptions): Promise<number>;
  
  // 系统能力
  notify(title: string, body: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  clipboardRead(): Promise<string>;
  clipboardWrite(text: string): Promise<void>;
  
  // 应用信息
  getAppPath(): Promise<string>;
  getUserDataPath(): Promise<string>;
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
  multiple?: boolean;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
}

export interface MessageBoxOptions {
  type: 'info' | 'warning' | 'error' | 'question';
  title: string;
  message: string;
  buttons?: string[];
}

export interface FileFilter {
  name: string;
  extensions: string[];
}
```

### 7.2 Web 平台实现

```typescript
// src/platform/web.ts
import type { PlatformAdapter, OpenDialogOptions, SaveDialogOptions, MessageBoxOptions } from './types';

export class WebPlatformAdapter implements PlatformAdapter {
  async readFile(path: string): Promise<string> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${path}`);
    }
    return response.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'file';
    a.click();
    URL.revokeObjectURL(url);
  }

  async deleteFile(): Promise<void> {
    throw new Error('File deletion not supported in web platform');
  }

  async fileExists(): Promise<boolean> {
    throw new Error('File exists check not supported in web platform');
  }

  async showOpenDialog(options: OpenDialogOptions): Promise<string[] | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options.multiple || false;
      
      if (options.filters) {
        input.accept = options.filters
          .flatMap(f => f.extensions.map(ext => `.${ext}`))
          .join(',');
      }

      input.onchange = () => {
        const files = Array.from(input.files || []);
        resolve(files.length > 0 ? files.map(f => f.name) : null);
      };

      input.click();
    });
  }

  async showSaveDialog(options: SaveDialogOptions): Promise<string | null> {
    const fileName = prompt('Enter file name:', options.defaultPath);
    return fileName;
  }

  async showMessageBox(options: MessageBoxOptions): Promise<number> {
    const message = `${options.title}\n\n${options.message}`;
    const result = options.type === 'question' 
      ? confirm(message) 
      : alert(message);
    return result ? 0 : 1;
  }

  async notify(title: string, body: string): Promise<void> {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      }
    }
  }

  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async clipboardRead(): Promise<string> {
    return navigator.clipboard.readText();
  }

  async clipboardWrite(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
  }

  async getAppPath(): Promise<string> {
    return window.location.origin;
  }

  async getUserDataPath(): Promise<string> {
    return 'localstorage';
  }
}
```

### 7.3 Tauri 平台实现

```typescript
// src/platform/tauri.ts
import type { PlatformAdapter, OpenDialogOptions, SaveDialogOptions, MessageBoxOptions } from './types';
import { open, save, message } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, remove, exists } from '@tauri-apps/plugin-fs';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { appDataDir } from '@tauri-apps/api/path';

export class TauriPlatformAdapter implements PlatformAdapter {
  async readFile(path: string): Promise<string> {
    return readTextFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeTextFile(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    await remove(path);
  }

  async fileExists(path: string): Promise<boolean> {
    return exists(path);
  }

  async showOpenDialog(options: OpenDialogOptions): Promise<string[] | null> {
    const result = await open({
      multiple: options.multiple,
      filters: options.filters,
      defaultPath: options.defaultPath,
      title: options.title,
    });
    return result ?? null;
  }

  async showSaveDialog(options: SaveDialogOptions): Promise<string | null> {
    const result = await save({
      filters: options.filters,
      defaultPath: options.defaultPath,
      title: options.title,
    });
    return result ?? null;
  }

  async showMessageBox(options: MessageBoxOptions): Promise<number> {
    const result = await message(options.message, {
      title: options.title,
      kind: options.type,
      buttons: options.buttons,
    });
    return result ? 0 : 1;
  }

  async notify(title: string, body: string): Promise<void> {
    sendNotification({ title, body });
  }

  async openExternal(url: string): Promise<void> {
    await openUrl(url);
  }

  async clipboardRead(): Promise<string> {
    return readText();
  }

  async clipboardWrite(text: string): Promise<void> {
    await writeText(text);
  }

  async getAppPath(): Promise<string> {
    return appDataDir();
  }

  async getUserDataPath(): Promise<string> {
    return appDataDir();
  }
}
```

### 7.4 平台初始化

```typescript
// src/platform/index.ts
import type { PlatformAdapter } from './types';

let adapter: PlatformAdapter | null = null;
let initialized = false;

/**
 * 初始化平台适配器
 * 自动检测当前运行环境并选择合适的适配器
 */
export async function initializePlatform(): Promise<void> {
  if (initialized) {
    return;
  }

  if (typeof window === 'undefined') {
    // SSR 环境
    throw new Error('Platform initialization not supported in SSR');
  }

  // 检测是否为 Tauri 环境
  const isTauri = '__TAURI__' in window;

  if (isTauri) {
    const { TauriPlatformAdapter } = await import('./tauri');
    adapter = new TauriPlatformAdapter();
  } else {
    const { WebPlatformAdapter } = await import('./web');
    adapter = new WebPlatformAdapter();
  }

  initialized = true;
}

/**
 * 获取平台适配器实例
 * 必须先调用 initializePlatform
 */
export function getPlatformAdapter(): PlatformAdapter {
  if (!adapter) {
    throw new Error('Platform adapter not initialized. Call initializePlatform() first.');
  }
  return adapter;
}

/**
 * 手动设置平台适配器（用于测试或自定义适配器）
 */
export function setPlatformAdapter(instance: PlatformAdapter): void {
  adapter = instance;
  initialized = true;
}

// 重新导出类型
export type { PlatformAdapter, OpenDialogOptions, SaveDialogOptions, MessageBoxOptions } from './types';
```

---

## 八、状态管理规范

### 8.1 Zustand Store 规范

```typescript
// src/store/store.ts
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

// 状态接口
export interface StoreState {
  // 数据
  items: string[];
  count: number;
  
  // 操作
  addItem: (item: string) => void;
  removeItem: (index: number) => void;
  increment: () => void;
  reset: () => void;
}

// 创建 Store
export const store = createStore<StoreState>((set, get) => ({
  items: [],
  count: 0,
  
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (index) => set((state) => ({ 
    items: state.items.filter((_, i) => i !== index) 
  })),
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ items: [], count: 0 }),
}));

// React Hook
export function useStoreSelector<T>(selector: (state: StoreState) => T): T {
  return useStore(store, selector);
}

export function useStoreActions() {
  return useStore(store, (state) => ({
    addItem: state.addItem,
    removeItem: state.removeItem,
    increment: state.increment,
    reset: state.reset,
  }));
}

export { useStore };
export default store;
```

### 8.2 Store Provider 规范

```typescript
// src/store/StoreProvider.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { StoreApi, useStore } from 'zustand';
import { createStore, StoreState } from './store';

// 创建 Context
interface StoreContextValue {
  store: StoreApi<StoreState>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// Provider 组件
interface StoreProviderProps {
  children: ReactNode;
  initialState?: Partial<StoreState>;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({ 
  children, 
  initialState 
}) => {
  const storeRef = React.useRef<StoreApi<StoreState>>();
  
  if (!storeRef.current) {
    storeRef.current = createStore({
      ...initialState,
    } as StoreState);
  }

  return (
    <StoreContext.Provider value={{ store: storeRef.current }}>
      {children}
    </StoreContext.Provider>
  );
};

// Hook 用于获取 Store
export function useStoreContext<T>(
  selector: (state: StoreState) => T
): T {
  const context = useContext(StoreContext);
  
  if (!context) {
    throw new Error('useStoreContext must be used within StoreProvider');
  }
  
  return useStore(context.store, selector);
}

export function useStoreActionsContext() {
  return useStoreContext((state) => ({
    addItem: state.addItem,
    removeItem: state.removeItem,
    increment: state.increment,
    reset: state.reset,
  }));
}
```

### 8.3 多 Store 组合

Zustand 支持多种状态组织方式，以下是两种推荐方案：

#### 方案一：单一 Store（推荐）

将相关状态组织在单个 Store 中，适合大多数场景：

```typescript
// src/store/appStore.ts
import { createStore } from 'zustand/vanilla';

interface AppState {
  // 用户状态
  user: User | null;
  setUser: (user: User) => void;
  logout: () => void;
  
  // 设置状态
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

export const appStore = createStore<AppState>((set) => ({
  // 用户状态
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
  
  // 设置状态
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ 
    theme: state.theme === 'light' ? 'dark' : 'light' 
  })),
}));
```

#### 方案二：多个独立 Store

将不同领域的状态分离到独立 Store，适合大型应用：

```typescript
// src/store/userStore.ts
import { createStore } from 'zustand/vanilla';

interface UserState {
  user: User | null;
  setUser: (user: User) => void;
  logout: () => void;
}

export const userStore = createStore<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));

// src/store/settingsStore.ts
import { createStore } from 'zustand/vanilla';

interface SettingsState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

export const settingsStore = createStore<SettingsState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
}));

// 在组件中使用
import { userStore } from './userStore';
import { settingsStore } from './settingsStore';

const user = useStore(userStore, (state) => state.user);
const theme = useStore(settingsStore, (state) => state.theme);
```

#### 方案三：Store 组合模式

通过自定义 Hook 组合多个 Store：

```typescript
// src/store/useAppStore.ts
import { useStore } from 'zustand';
import { userStore } from './userStore';
import { settingsStore } from './settingsStore';
import type { User } from '../entities';

export function useAppStore<T>(
  selector: (user: UserState, settings: SettingsState) => T
): T {
  const user = useStore(userStore, (state) => state);
  const settings = useStore(settingsStore, (state) => state);
  return selector(user, settings);
}

// 使用示例
const { user, theme } = useAppStore(
  (user, settings) => ({ user: user.user, theme: settings.theme })
);
```

---

## 九、路由系统设计

### 9.1 路由定义

```typescript
// src/router/routes.ts
import type { RouteObject } from 'react-router-dom';

// 路由路径常量
export const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/products/:id',
  SETTINGS: '/settings',
  PROFILE: '/profile',
  LOGIN: '/login',
  REGISTER: '/register',
  NOT_FOUND: '*',
} as const;

export type RoutePath = typeof ROUTES[keyof typeof ROUTES];

// 路由配置
export const routes: RouteObject[] = [
  {
    path: ROUTES.HOME,
    lazy: () => import('../pages/HomePage'),
  },
  {
    path: ROUTES.ABOUT,
    lazy: () => import('../pages/AboutPage'),
  },
  {
    path: ROUTES.PRODUCTS,
    lazy: () => import('../pages/ProductsPage'),
  },
  {
    path: ROUTES.PRODUCT_DETAIL,
    lazy: () => import('../pages/ProductDetailPage'),
  },
  {
    path: ROUTES.SETTINGS,
    lazy: () => import('../pages/SettingsPage'),
  },
  {
    path: ROUTES.LOGIN,
    lazy: () => import('../pages/LoginPage'),
  },
  {
    path: ROUTES.REGISTER,
    lazy: () => import('../pages/RegisterPage'),
  },
  {
    path: ROUTES.NOT_FOUND,
    lazy: () => import('../pages/NotFoundPage'),
  },
];
```

### 9.2 路由守卫

```typescript
// src/router/guards.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from './routes';
import { useAuthStore } from '../store/authStore';

// 认证守卫
export const AuthGuard: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  
  return <Outlet />;
};

// 访客守卫（已登录用户不能访问）
export const GuestGuard: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  
  return <Outlet />;
};

// 角色守卫
interface RoleGuardProps {
  allowedRoles: string[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles }) => {
  const userRole = useAuthStore((state) => state.user?.role);
  
  if (!userRole || !allowedRoles.includes(userRole)) {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  
  return <Outlet />;
};
```

### 9.3 路由容器

```typescript
// src/router/Router.tsx
import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { routes } from './routes';
import { AuthGuard, GuestGuard } from './guards';
import { MainLayout } from '../layouts/MainLayout';
import { AuthLayout } from '../layouts/AuthLayout';

// 加载组件
const LoadingSpinner: React.FC = () => (
  <div className="loading-spinner">
    <div className="spinner" />
  </div>
);

// 包装懒加载组件
const LazyRouteWrapper = (Component: React.LazyExoticComponent<React.FC>) => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Component />
    </Suspense>
  );
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* 公开路由 */}
        <Route element={<MainLayout />}>
          <Route path="/" lazy={() => import('../pages/HomePage')} />
          <Route path="/about" lazy={() => import('../pages/AboutPage')} />
          <Route path="/products" lazy={() => import('../pages/ProductsPage')} />
          <Route path="/products/:id" lazy={() => import('../pages/ProductDetailPage')} />
        </Route>

        {/* 需要认证的路由 */}
        <Route element={<AuthGuard />}>
          <Route element={<MainLayout />}>
            <Route path="/settings" lazy={() => import('../pages/SettingsPage')} />
            <Route path="/profile" lazy={() => import('../pages/ProfilePage')} />
          </Route>
        </Route>

        {/* 访客路由（登录用户不可见） */}
        <Route element={<GuestGuard />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" lazy={() => import('../pages/LoginPage')} />
            <Route path="/register" lazy={() => import('../pages/RegisterPage')} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" lazy={() => import('../pages/NotFoundPage')} />
      </Routes>
    </BrowserRouter>
  );
};
```

---

## 十、国际化规范

### 10.1 国际化结构

```
src/i18n/
├── index.ts              # 导出入口
├── types.ts              # 类型定义
├── config.ts             # 配置
└── locales/
    ├── zh-CN/
    │   ├── index.ts      # 语言包入口
    │   ├── common.ts     # 通用文案
    │   ├── pages.ts      # 页面文案
    │   ├── components.ts # 组件文案
    │   ├── form.ts       # 表单文案
    │   ├── message.ts    # 消息文案
    │   └── error.ts      # 错误文案
    └── en-US/
        ├── index.ts
        ├── common.ts
        ├── pages.ts
        ├── components.ts
        ├── form.ts
        ├── message.ts
        └── error.ts
```

### 10.2 类型定义

```typescript
// src/i18n/types.ts
export type Locale = 'zh-CN' | 'en-US';

export interface TranslationResource {
  common: {
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    confirm: string;
    back: string;
    next: string;
    previous: string;
    search: string;
    filter: string;
    sort: string;
  };
  pages: {
    home: {
      title: string;
      welcome: string;
    };
    about: {
      title: string;
      description: string;
    };
    // ... 其他页面
  };
  components: {
    button: {
      submit: string;
      reset: string;
    };
    // ... 其他组件
  };
  form: {
    required: string;
    invalid: string;
    // ... 其他表单文案
  };
  message: {
    success: string;
    error: string;
    warning: string;
    info: string;
  };
  error: {
    notFound: string;
    unauthorized: string;
    serverError: string;
    networkError: string;
  };
}

export interface TranslationMap {
  'zh-CN': TranslationResource;
  'en-US': TranslationResource;
}
```

### 10.3 语言包

```typescript
// src/i18n/locales/zh-CN/index.ts
import common from './common';
import pages from './pages';
import components from './components';
import form from './form';
import message from './message';
import error from './error';

export const zhCN = {
  common,
  pages,
  components,
  form,
  message,
  error,
};

export default zhCN;
```

```typescript
// src/i18n/locales/zh-CN/common.ts
export default {
  loading: '加载中...',
  save: '保存',
  cancel: '取消',
  delete: '删除',
  edit: '编辑',
  confirm: '确认',
  back: '返回',
  next: '下一步',
  previous: '上一步',
  search: '搜索',
  filter: '筛选',
  sort: '排序',
} as const;
```

### 10.4 国际化 Hook

```typescript
// src/i18n/useTranslation.ts
import { useState, useCallback, useEffect } from 'react';
import type { Locale, TranslationResource } from './types';
import { translations } from './config';

interface UseTranslationReturn {
  t: (key: string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  resources: TranslationResource;
}

export function useTranslation(defaultLocale: Locale = 'zh-CN'): UseTranslationReturn {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // 从 localStorage 或浏览器设置获取
    const saved = localStorage.getItem('locale') as Locale | null;
    return saved || defaultLocale;
  });

  const resources = translations[locale];

  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let value: unknown = resources;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key; // 找不到返回 key
      }
    }
    
    return typeof value === 'string' ? value : key;
  }, [resources]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return { t, locale, setLocale, resources };
}
```

### 10.5 国际化 Provider

```typescript
// src/i18n/TranslationProvider.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import type { Locale, TranslationResource } from './types';
import { useTranslation } from './useTranslation';

interface TranslationContextValue {
  t: (key: string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  resources: TranslationResource;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

interface TranslationProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({
  children,
  defaultLocale = 'zh-CN',
}) => {
  const translation = useTranslation(defaultLocale);

  return (
    <TranslationContext.Provider value={translation}>
      {children}
    </TranslationContext.Provider>
  );
};

export function useTranslationContext(): TranslationContextValue {
  const context = useContext(TranslationContext);
  
  if (!context) {
    throw new Error('useTranslationContext must be used within TranslationProvider');
  }
  
  return context;
}
```

---

## 十一、开发规范

### 11.1 代码风格

```typescript
// ✅ 推荐
interface Props {
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const MyComponent: React.FC<Props> = ({
  label = 'Default',
  className = '',
  disabled = false,
}) => {
  const classes = classNames('base-class', className, {
    'base-class--disabled': disabled,
  });

  return <div className={classes}>{label}</div>;
};

// ❌ 不推荐
const MyComponent = (props) => {
  return <div className={props.className || ''}>{props.label}</div>;
};
```

### 11.2 命名规范

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 组件 | PascalCase | `UserProfile`, `ButtonGroup` |
| 文件 | PascalCase (组件), camelCase (工具) | `UserProfile.tsx`, `utils.ts` |
| 类型/接口 | PascalCase | `User`, `ApiResponse` |
| 变量/函数 | camelCase | `userName`, `getUserData` |
| 常量 | UPPER_SNAKE_CASE | `API_URL`, `MAX_COUNT` |
| 枚举 | PascalCase | `UserRole`, `OrderStatus` |
| CSS 类 | kebab-case | `user-profile`, `btn-primary` |

### 11.3 注释规范

```typescript
/**
 * 用户服务类
 * 提供用户相关的 CRUD 操作
 * 
 * @example
 * const userService = new UserService(apiService);
 * const user = await userService.getUserById('123');
 */
export class UserService {
  /**
   * 根据 ID 获取用户
   * 
   * @param id - 用户 ID
   * @returns 用户对象，不存在返回 null
   * @throws {Error} 当网络请求失败时
   */
  async getUserById(id: string): Promise<User | null> {
    // ...
  }
}

// 行内注释 - 解释为什么，而不是做什么
// 使用防抖减少 API 请求
const debouncedSearch = debounce(search, 300);
```

### 11.4 错误处理规范

```typescript
// 服务层错误处理
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function handleApiRequest<T>(
  requestFn: () => Promise<ApiResponse<T>>
): Promise<T> {
  try {
    const response = await requestFn();
    
    if (!response.success) {
      throw new ApiError(response.error, 500, 'API_ERROR');
    }
    
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (error instanceof Error) {
      throw new ApiError(error.message, 500, 'UNKNOWN_ERROR');
    }
    
    throw new ApiError('Unknown error', 500, 'UNKNOWN_ERROR');
  }
}

// 组件错误边界
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={() => this.setState({ hasError: false })} />;
    }

    return this.props.children;
  }
}
```

### 11.5 性能优化规范

```typescript
// 使用 React.memo 避免不必要的重渲染
export const ExpensiveComponent = React.memo(({ data }: { data: Data }) => {
  return <div>{/* 复杂渲染 */}</div>;
});

// 使用 useMemo 缓存计算结果
const filteredData = useMemo(() => {
  return data.filter(item => item.active);
}, [data]);

// 使用 useCallback 缓存函数
const handleClick = useCallback(() => {
  // 处理点击
}, [dependencies]);

// 使用虚拟列表处理大数据
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 50,
});
```

---

## 十二、构建与发布

### 12.1 构建流程

```bash
# 开发模式
pnpm dev

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 构建库
pnpm build

# 构建应用
pnpm build:app

# 运行测试
pnpm test

# 构建桌面应用
pnpm build:desktop
```

### 12.2 发布流程

```bash
# 1. 更新版本号
npm version patch  # 或 minor, major

# 2. 构建
pnpm build

# 3. 运行测试
pnpm test:run

# 4. 发布到 npm
pnpm publish

# 5. 推送 git 标签
git push --follow-tags
```

### 12.3 CI/CD 配置

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      
      - run: pnpm typecheck
      
      - run: pnpm lint
      
      - run: pnpm build
      
      - run: pnpm test:run
```

---

## 十三、快速启动模板

### 13.1 创建新包

```bash
# 1. 创建目录结构
mkdir -p my-package/{src/{components,pages,services,store,entities,types,hooks,utils,platform,i18n},app,dist}

# 2. 初始化 package.json
cd my-package
pnpm init

# 3. 安装依赖
pnpm add react react-dom
pnpm add -D typescript @types/react @types/react-dom vite @vitejs/plugin-react

# 4. 创建配置文件
# tsconfig.json, vite.config.ts, vite.app.config.ts

# 5. 创建入口文件
# src/index.ts, app/main.tsx, app/App.tsx, app/index.html
```

### 13.2 最小可运行模板

```typescript
// app/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../src/styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```typescript
// app/App.tsx
import React from 'react';

const App: React.FC = () => {
  return (
    <div className="app">
      <h1>Hello, World!</h1>
    </div>
  );
};

export default App;
```

```html
<!-- app/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Package</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

---

## 十四、附录

### 14.1 检查清单

#### 新包创建检查清单

- [ ] 目录结构完整
- [ ] package.json 配置正确
- [ ] TypeScript 配置完成
- [ ] Vite 配置完成（库模式 + 应用模式）
- [ ] 入口文件导出完整
- [ ] 平台适配层实现
- [ ] 国际化配置（如需要）
- [ ] 路由配置（如需要）
- [ ] 单元测试编写
- [ ] README 文档编写

#### 发布前检查清单

- [ ] 类型检查通过
- [ ] 代码检查通过
- [ ] 测试全部通过
- [ ] 构建成功
- [ ] 版本号已更新
- [ ] CHANGELOG 已更新
- [ ] 文档已更新

### 14.2 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 模块找不到 | 包未构建 | 运行 `pnpm build` |
| 类型错误 | 类型未导出 | 检查 index.ts 导出 |
| 样式丢失 | 样式未引入 | 引入 `dist/style.css` |
| 平台 API 不可用 | 未初始化 | 调用 `initializePlatform()` |

### 14.3 参考资源

- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Vite 官方文档](https://vitejs.dev/)
- [Zustand 官方文档](https://zustand-demo.pmnd.rs/)
- [Tailwind CSS 官方文档](https://tailwindcss.com/)
- [Tauri 官方文档](https://tauri.app/)

---

**文档版本**: v1.0  
**最后更新**: 2026 年 2 月 20 日  
**维护者**: SDKWork Team
