# OpenClaw 升级流程

本文档说明如何把项目中的 OpenClaw 运行时升级到新的发布版本。

## 单一版本源

OpenClaw 版本信息只允许维护在 `config/kernel-releases/openclaw.json` 中。测试、显示代码、构建脚本和发布脚本都必须从该文件或 `@sdkwork/agentstudio-pc-types` 暴露的共享常量读取版本信息，不要新增第二份配置文件，也不要在业务代码或测试 fixture 中写死当前 OpenClaw 基线版本。

已移除的旧入口 `config/openclaw-release.json` 不再兼容。

## 升级步骤

### 1. 更新版本配置

编辑 `config/kernel-releases/openclaw.json`：

```json
{
  "kernelId": "openclaw",
  "stableVersion": "<新版本号>",
  "nodeVersion": "<对应 Node 版本>",
  "packageName": "openclaw",
  "runtimeSupplementalPackages": [],
  "platformSupport": {
    "packageProfileIds": ["openclaw-only", "dual-kernel"],
    "windows": "native",
    "macos": "native",
    "linux": "native"
  },
  "runtimeRequirements": {
    "requiredExternalRuntimes": ["nodejs"]
  },
  "releaseSource": {
    "kind": "githubRelease",
    "repositoryUrl": "https://github.com/openclaw/openclaw",
    "tagPrefix": "v"
  }
}
```

默认保持 `runtimeSupplementalPackages` 为空。只有 OpenClaw 在稳定依赖图之外确实需要额外 npm 包时，才在这里显式加入精确版本。
`runtimeRequirements.requiredExternalRuntimeVersions.nodejs` 由 `nodeVersion` 派生，`releaseSource.releaseUrl` 由 `repositoryUrl`、`tagPrefix` 和 `stableVersion` 派生，不要把这些派生字段写回 JSON。
平台支持信息统一写在 `platformSupport`，加载器会拒绝旧的顶层 `compatibility` 字段。

也可以使用升级入口更新配置和产物：

```bash
pnpm sdk:openclaw-upgrade:apply -- <新版本号>
```

### 2. 重新准备运行时资源

```bash
node scripts/prepare-openclaw-runtime.mjs
```

脚本会下载目标版本的 OpenClaw 包，按配置准备运行时，校验完整性并写入桌面资源 manifest。

### 3. 验证资源和契约

```bash
node scripts/openclaw-release-contract.test.mjs
node scripts/apply-openclaw-upgrade.test.mjs
node scripts/verify-desktop-openclaw-release-assets.test.mjs
pnpm check:desktop-openclaw-runtime
pnpm lint
pnpm build
```

如果本次升级涉及桌面发布产物，还需要运行对应的 Tauri 和 release smoke 检查。

## 版本命名规则

- `stableVersion`: 使用 `YYYY.M.P` 格式；如果 upstream npm `latest` 使用稳定热修复后缀，也允许 `YYYY.M.P-N`。实际值以 `config/kernel-releases/openclaw.json` 为准。
- `releaseSource.releaseUrl`: 由加载器从 `releaseSource.repositoryUrl`、`releaseSource.tagPrefix` 和 `stableVersion` 派生，配置文件中不要手写。
- `runtimeSupplementalPackages`: 只在确有额外补充依赖时填写，使用 npm 包全名加精确版本。

## 单一版本源约束

OpenClaw 版本、外部 Node.js 版本和 npm 包名不支持环境变量覆盖。升级必须修改 `config/kernel-releases/openclaw.json`，随后执行准备、校验和构建命令，确保脚本、测试、显示代码和桌面资源都从同一份配置派生。

## 常见问题

### 构建时出现 unstable version 警告

默认配置不再把 `@buape/carbon` 作为 supplemental package。如果仍然看到此类警告，通常说明本地或分支中的 `runtimeSupplementalPackages` 被改成了包含 `0.x.x` 依赖的自定义配置。将其改回空数组，或为确需保留的不稳定补充依赖添加明确例外。

### 升级后桌面端启动失败

确保运行 `pnpm dev:desktop` 前已经重新准备运行时资源。检查 `packages/sdkwork-agentstudio-pc-desktop/src-tauri/resources/openclaw/manifest.json` 中的 `openclawVersion` 是否与 `config/kernel-releases/openclaw.json` 一致。

### 如何回退版本

将 `config/kernel-releases/openclaw.json` 中的 `stableVersion` 改回目标版本；如 Node 要求也需要回退，再同步修改 `nodeVersion`。随后重新执行运行时准备和验证命令。
