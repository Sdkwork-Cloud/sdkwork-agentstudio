import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY,
  REMOVED_OPENCLAW_RUNTIME_CLEANUP_SCRIPT_ENTRY,
  resolveRemovedOpenClawWorkspaceEntry,
} from './test-support/openclaw-retired-upgrade-entries.mjs';
import {
  loadKernelReleaseConfigs,
  resolveKernelReleaseConfig as resolveScriptKernelReleaseConfig,
} from './release/kernel-releases.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const retiredOpenClawUpgradeEntryRegistryRelativePath = path.join(
  'scripts',
  'test-support',
  'openclaw-retired-upgrade-entries.mjs',
);
const retiredOpenClawUpgradeEntryRegistryPath = path.join(
  rootDir,
  retiredOpenClawUpgradeEntryRegistryRelativePath,
);
const retiredOpenClawUpgradeEntryConsumerPaths = [
  'scripts/apply-openclaw-upgrade.test.mjs',
  'scripts/assert-openclaw-runtime-layout.test.mjs',
  'scripts/openclaw-release-contract.test.mjs',
];
const releaseConfigPath = path.join(
  rootDir,
  'config',
  'kernel-releases',
  'openclaw.json',
);
const workspacePackageJson = JSON.parse(
  readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
);
const prepareRuntimeSource = readFileSync(
  path.join(rootDir, 'scripts', 'prepare-openclaw-runtime.mjs'),
  'utf8',
);
const openClawReleaseScriptSource = readFileSync(
  path.join(rootDir, 'scripts', 'openclaw-release.mjs'),
  'utf8',
);
const desktopBuildScriptSource = readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'build.rs',
  ),
  'utf8',
);
const syncBundledSource = readFileSync(
  path.join(rootDir, 'scripts', 'sync-bundled-components.mjs'),
  'utf8',
);
const applyUpgradeSource = readFileSync(
  path.join(rootDir, 'scripts', 'apply-openclaw-upgrade.mjs'),
  'utf8',
);
const webStudioSource = readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-claw-infrastructure', 'src', 'platform', 'webStudio.ts'),
  'utf8',
);
const clawTypesIndexSource = readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-claw-types', 'src', 'index.ts'),
  'utf8',
);
const clawTypesKernelReleaseCatalogSource = readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-claw-types', 'src', 'kernelReleaseCatalog.ts'),
  'utf8',
);
const clawTypesOpenClawReleaseSource = readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-claw-types', 'src', 'openclawRelease.ts'),
  'utf8',
);
const desktopOpenClawReleaseBridgeSource = readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'src',
    'framework',
    'openclaw_release.rs',
  ),
  'utf8',
);
const desktopBootstrapSource = readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'src',
    'app',
    'bootstrap.rs',
  ),
  'utf8',
);
const desktopStudioSource = readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'src',
    'framework',
    'services',
    'studio.rs',
  ),
  'utf8',
);
const versionFixtureSourcePaths = [
  'packages/sdkwork-claw-instances/src/services/instanceManagementPresentation.test.ts',
  'packages/sdkwork-claw-instances/src/services/agentWorkbenchService.test.ts',
  'packages/sdkwork-claw-instances/src/services/agentSkillManagementService.test.ts',
  'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts',
  'packages/sdkwork-claw-instances/src/services/instanceService.test.ts',
  'packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts',
  'packages/sdkwork-claw-chat/src/services/chatService.test.ts',
  'packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClientRegistry.test.ts',
  'packages/sdkwork-claw-chat/src/store/chatStoreAuthority.test.ts',
  'packages/sdkwork-claw-core/src/services/openClawMirrorService.test.ts',
  'packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts',
  'packages/sdkwork-claw-dashboard/src/services/usageWorkspaceService.test.ts',
  'packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.test.ts',
  'packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.test.ts',
  'packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts',
  'packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts',
];
const versionFixtureSources = versionFixtureSourcePaths.map((fixturePath) => ({
  fixturePath,
  source: readFileSync(path.join(rootDir, fixturePath), 'utf8'),
}));
const retiredOpenClawVersionLiteralSourcePaths = [
  ...versionFixtureSourcePaths,
  'packages/sdkwork-claw-desktop/src-tauri/src/commands/desktop_kernel.rs',
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/hermes_chat.rs',
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs',
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  'packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts',
  'scripts/ensure-tauri-target-clean.test.mjs',
  'scripts/openclaw-upgrade-execution-evidence.test.mjs',
  'scripts/openclaw-upgrade-rollback-evidence.test.mjs',
  'scripts/prepare-openclaw-runtime.test.mjs',
  'scripts/release/finalize-release-assets.test.mjs',
  'scripts/release/kernel-install-readiness.test.mjs',
  'scripts/release/smoke-desktop-installers.test.mjs',
  'scripts/release/smoke-desktop-startup-evidence.test.mjs',
  'scripts/sync-bundled-components.test.mjs',
];
const retiredOpenClawVersionLiteralSources = retiredOpenClawVersionLiteralSourcePaths.map(
  (fixturePath) => ({
    fixturePath,
    source: readFileSync(path.join(rootDir, fixturePath), 'utf8'),
  }),
);
const retiredOpenClawVersionLiteralPattern =
  /\b2026\.(?:3\.24|4\.(?:2|5|7|8|9|11|20|21|22|23|24|25))(?:[-+][0-9A-Za-z.-]+)?\b/u;
const retiredOpenClawNodeVersionLiteralSourcePaths = [
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/upgrades.rs',
  'scripts/ensure-tauri-target-clean.test.mjs',
];
const retiredOpenClawNodeVersionLiteralSources =
  retiredOpenClawNodeVersionLiteralSourcePaths.map((fixturePath) => ({
    fixturePath,
    source: readFileSync(path.join(rootDir, fixturePath), 'utf8'),
  }));
const retiredOpenClawNodeVersionLiteralPattern = /\b20\.10\.0\b/u;
function stripRustTestModules(source) {
  return String(source).split(/\n#\[cfg\(test\)\]/u)[0] ?? source;
}

const retiredAuthorityCompatibilityFieldSourcePaths = [
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs',
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs',
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
];
const retiredAuthorityCompatibilityFieldSources =
  retiredAuthorityCompatibilityFieldSourcePaths.map((fixturePath) => ({
    fixturePath,
    source: stripRustTestModules(readFileSync(path.join(rootDir, fixturePath), 'utf8')),
  }));
const retiredAuthorityCompatibilityFieldPattern = /\blegacy(?:_runtime_roots|RuntimeRoots)\b/u;
const retiredDisplayVersionCompatibilitySourcePaths = [
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
];
const retiredDisplayVersionCompatibilitySources =
  retiredDisplayVersionCompatibilitySourcePaths.map((fixturePath) => ({
    fixturePath,
    source: readFileSync(path.join(rootDir, fixturePath), 'utf8'),
  }));
const retiredDisplayVersionCompatibilityPattern = /\bnormalize_legacy_active_version_label\b/u;
const activeStateRuntimeAliasSourcePath =
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs';
const activeStateRuntimeAliasSource = readFileSync(
  path.join(rootDir, activeStateRuntimeAliasSourcePath),
  'utf8',
);
const retiredRuntimeInstallKeyAliasReadPattern =
  /active_runtime_install_key[\s\S]{0,240}\bor\(self\.active_version\.as_deref\(\)\)|fallback_runtime_install_key[\s\S]{0,240}\bor\(self\.fallback_version\.as_deref\(\)\)/u;
const retiredRuntimeInstallKeyAliasWritePattern =
  /self\.active_version\s*=\s*active_install_key|self\.fallback_version\s*=\s*fallback_install_key/u;
const retiredCachedNodeRuntimeCompatibilityPattern =
  /legacy caches without sidecars|inspectCachedNodeRuntimeDir[\s\S]{0,1800}readPreparedNodeVersion/u;
const retiredPreparedRuntimeRepairPattern =
  /repairPreparedOpenClawRuntimeManifest|repaired-existing-manifest|repaired-manifest|repaired-sidecar/u;
const legacyOpenClawMirrorLiteralSourcePaths = [
  'packages/sdkwork-claw-core/src/services/openClawMirrorService.test.ts',
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_export.rs',
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs',
  'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_manifest.rs',
];
const legacyOpenClawMirrorLiteralSources = legacyOpenClawMirrorLiteralSourcePaths.map(
  (fixturePath) => ({
    fixturePath,
    source: readFileSync(path.join(rootDir, fixturePath), 'utf8'),
  }),
);
const legacyOpenClawMirrorLiteralPattern =
  /\b0\.4\.0-windows-x64\b|openclawVersion:\s*['"]0\.4\.0['"]|"openclawVersion"\s*:\s*"0\.4\.0"/u;

const releaseConfig = JSON.parse(readFileSync(releaseConfigPath, 'utf8'));
const normalizedReleaseConfig = resolveScriptKernelReleaseConfig('openclaw');
const activeOpenClawReleaseStandardDocPaths = [
  'docs/guide/openclaw-upgrade.md',
  'docs/架构/README.md',
  'docs/架构/02-架构标准与总体设计.md',
  'docs/架构/12-安装、部署、发布与商业化交付标准.md',
  'docs/step/03-Desktop Runtime与内置OpenClaw工程化.md',
];
const activeOpenClawReleaseStandardDocSources = activeOpenClawReleaseStandardDocPaths.map(
  (fixturePath) => ({
    fixturePath,
    source: readFileSync(path.join(rootDir, fixturePath), 'utf8'),
  }),
);
const removedOpenClawReleaseConfigSourcePattern = new RegExp(
  [
    REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY.slashRelativePathPattern.source,
    REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY.fileNamePattern.source,
  ].join('|'),
  'u',
);
const removedOpenClawReleaseProjectionSourcePattern = new RegExp(
  [
    'resolveLegacyOpenClawReleaseConfigPath',
    'projectLegacyOpenClawReleaseConfig',
    REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY.fileNamePattern.source,
  ].join('|'),
  'u',
);
const removedOpenClawRuntimeCleanupSourcePattern = new RegExp(
  [
    'cleanupLegacyOpenClawSourceRuntimeResidue',
    REMOVED_OPENCLAW_RUNTIME_CLEANUP_SCRIPT_ENTRY.fileNamePattern.source,
  ].join('|'),
  'u',
);
const retiredOpenClawUpgradeEntryConsumerSources =
  retiredOpenClawUpgradeEntryConsumerPaths.map((fixturePath) => ({
    fixturePath,
    source: readFileSync(path.join(rootDir, fixturePath), 'utf8'),
  }));
const sourceComponentRegistry = JSON.parse(
  readFileSync(
    path.join(
      rootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'foundation',
      'components',
      'component-registry.json',
    ),
    'utf8',
  ),
);
const desktopBundledManifestPath = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'openclaw',
  'manifest.json',
);
const desktopBundledManifest = existsSync(desktopBundledManifestPath)
  ? JSON.parse(readFileSync(desktopBundledManifestPath, 'utf8'))
  : null;
const desktopBundledRuntimePackageJsonPath = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'resources',
  'openclaw',
  'runtime',
  'package',
  'package.json',
);
const desktopBundledRuntimePackageJson = existsSync(desktopBundledRuntimePackageJsonPath)
  ? JSON.parse(readFileSync(desktopBundledRuntimePackageJsonPath, 'utf8'))
  : null;

function parseSemver(value) {
  const match = String(value ?? '').trim().match(/^(\d+)\.(\d+)\.(\d+)$/u);
  assert.ok(match, `Expected semantic version, received ${value}`);
  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function compareSemver(left, right) {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

function createKernelReleaseFixture(overrides = {}) {
  return {
    kernelId: 'openclaw',
    stableVersion: releaseConfig.stableVersion,
    supportedChannels: ['stable'],
    defaultChannel: 'stable',
    nodeVersion: releaseConfig.nodeVersion,
    platformSupport: releaseConfig.platformSupport,
    runtimeRequirements: {
      requiredExternalRuntimes: ['nodejs'],
    },
    releaseSource: {
      kind: 'githubRelease',
      repositoryUrl: 'https://github.com/openclaw/openclaw',
      tagPrefix: 'v',
    },
    ...overrides,
  };
}

function assertRejectsKernelReleaseFixture(overrides, expectedErrorPattern, message) {
  const fixtureWorkspaceDir = mkdtempSync(
    path.join(os.tmpdir(), 'sdkwork-kernel-release-contract-'),
  );
  try {
    const fixtureReleaseDir = path.join(
      fixtureWorkspaceDir,
      'config',
      'kernel-releases',
    );
    mkdirSync(fixtureReleaseDir, { recursive: true });
    writeFileSync(
      path.join(fixtureReleaseDir, 'openclaw.json'),
      `${JSON.stringify(createKernelReleaseFixture(overrides), null, 2)}\n`,
    );
    assert.throws(
      () => loadKernelReleaseConfigs({ workspaceRootDir: fixtureWorkspaceDir }),
      expectedErrorPattern,
      message,
    );
  } finally {
    rmSync(fixtureWorkspaceDir, { recursive: true, force: true });
  }
}

assert.equal(
  existsSync(retiredOpenClawUpgradeEntryRegistryPath),
  true,
  'removed OpenClaw release/config entries must be centralized in one test-support registry instead of repeated across contracts',
);
if (existsSync(retiredOpenClawUpgradeEntryRegistryPath)) {
  const retiredOpenClawUpgradeEntryRegistrySource = readFileSync(
    retiredOpenClawUpgradeEntryRegistryPath,
    'utf8',
  );
  assert.match(
    retiredOpenClawUpgradeEntryRegistrySource,
    /REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY/,
    'retired OpenClaw entry registry must name the removed release config entry',
  );
  assert.match(
    retiredOpenClawUpgradeEntryRegistrySource,
    /REMOVED_OPENCLAW_RUNTIME_CLEANUP_SCRIPT_ENTRY/,
    'retired OpenClaw entry registry must name the removed runtime cleanup script entry',
  );
}
for (const { fixturePath, source } of retiredOpenClawUpgradeEntryConsumerSources) {
  assert.match(
    source,
    /from\s+['"]\.\/test-support\/openclaw-retired-upgrade-entries\.mjs['"]/u,
    `${fixturePath} must consume the centralized retired OpenClaw entry registry for removed release/config path assertions`,
  );
  assert.doesNotMatch(
    source,
    /path\.join\([\s\S]{0,200}['"]config['"][\s\S]{0,200}['"]openclaw-release\.json['"][\s\S]{0,200}\)/u,
    `${fixturePath} must not repeat the removed ${REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY.slashRelativePath} path construction inline`,
  );
  assert.doesNotMatch(
    source,
    REMOVED_OPENCLAW_RUNTIME_CLEANUP_SCRIPT_ENTRY.fileNamePattern,
    `${fixturePath} must not repeat the removed OpenClaw runtime cleanup script literal inline`,
  );
}
assert.equal(
  existsSync(
    resolveRemovedOpenClawWorkspaceEntry(rootDir, REMOVED_OPENCLAW_RELEASE_CONFIG_ENTRY),
  ),
  false,
  'OpenClaw release metadata must not keep the removed release config projection',
);
assert.equal(
  existsSync(
    resolveRemovedOpenClawWorkspaceEntry(rootDir, REMOVED_OPENCLAW_RUNTIME_CLEANUP_SCRIPT_ENTRY),
  ),
  false,
  'OpenClaw release tooling must not keep the removed runtime cleanup script; unsupported layouts should fail standard gates',
);
assert.doesNotMatch(
  workspacePackageJson.scripts['check:desktop-openclaw-runtime'],
  REMOVED_OPENCLAW_RUNTIME_CLEANUP_SCRIPT_ENTRY.fileNamePattern,
  'desktop OpenClaw runtime checks must not auto-repair retired runtime layouts',
);
assert.match(
  workspacePackageJson.scripts['check:desktop-openclaw-runtime'],
  /assert-openclaw-runtime-layout\.test\.mjs/,
  'desktop OpenClaw runtime checks must execute the current runtime layout assertion contract',
);
assert.match(
  workspacePackageJson.scripts['check:desktop-openclaw-runtime'],
  /assert-openclaw-runtime-layout\.mjs/,
  'desktop OpenClaw runtime checks must reject unsupported runtime layouts before upgrade probes',
);
assert.match(
  workspacePackageJson.scripts['check:desktop-openclaw-runtime'],
  /openclaw-release-contract\.test\.mjs/,
  'desktop OpenClaw runtime checks must validate the centralized release metadata contract',
);
assert.match(
  workspacePackageJson.scripts['check:desktop-openclaw-runtime'],
  /kernelReleaseCatalog\.test\.ts/,
  'desktop OpenClaw runtime checks must validate frontend kernel release catalog derivation',
);
assert.match(
  releaseConfig.stableVersion,
  /^\d{4}\.\d+\.\d+(?:-(?:\d+|[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*))?$/u,
  'openclaw shared release config must pin the current OpenClaw version in YYYY.M.P, YYYY.M.P-N, or YYYY.M.P-beta.N format',
);
assert.equal(
  releaseConfig.kernelId,
  'openclaw',
  'openclaw kernel release registry must pin kernelId=openclaw',
);
assert.deepEqual(
  releaseConfig.supportedChannels,
  ['stable'],
  'openclaw kernel release registry must expose the supported release channels',
);
assert.equal(
  releaseConfig.defaultChannel,
  'stable',
  'openclaw kernel release registry must expose the default release channel',
);
assert.equal(
  releaseConfig.packageName,
  'openclaw',
  'openclaw shared release config must pin the packaged OpenClaw npm package name',
);
assert.equal(
  Object.hasOwn(releaseConfig, 'compatibility'),
  false,
  'openclaw kernel release registry must not keep compatibility naming for current platform support metadata',
);
assert.deepEqual(
  releaseConfig.platformSupport,
  {
    packageProfileIds: [
      'openclaw-only',
      'dual-kernel',
    ],
    windows: 'native',
    macos: 'native',
    linux: 'native',
  },
  'openclaw kernel release registry must expose current package profiles and OS support under platformSupport',
);
assertRejectsKernelReleaseFixture(
  {
    compatibility: releaseConfig.platformSupport,
  },
  /must use platformSupport instead of compatibility/u,
  'script kernel release loader must fail hard when a release config reintroduces compatibility naming',
);
assertRejectsKernelReleaseFixture(
  {
    runtimeRequirements: {
      requiredExternalRuntimes: ['nodejs'],
      requiredExternalRuntimeVersions: {
        nodejs: releaseConfig.nodeVersion,
      },
    },
  },
  /must derive runtimeRequirements\.requiredExternalRuntimeVersions\.nodejs from nodeVersion/u,
  'script kernel release loader must fail hard when a release config writes derived Node.js runtime versions back into JSON',
);
assertRejectsKernelReleaseFixture(
  {
    releaseSource: {
      kind: 'githubRelease',
      repositoryUrl: 'https://github.com/openclaw/openclaw',
      tagPrefix: 'v',
      releaseUrl: `https://github.com/openclaw/openclaw/releases/tag/v${releaseConfig.stableVersion}`,
    },
  },
  /must derive releaseSource\.releaseUrl from releaseSource and stableVersion/u,
  'script kernel release loader must fail hard when a release config writes derived release URLs back into JSON',
);
assert.equal(
  /^\d+\.\d+\.\d+$/u.test(releaseConfig.nodeVersion),
  true,
  'openclaw shared release config must pin the external Node.js requirement version',
);
assert.equal(
  compareSemver(releaseConfig.nodeVersion, '24.0.0') >= 0,
  true,
  'openclaw shared release config must satisfy the packaged OpenClaw runtime dependency engine floors including @matrix-org/matrix-sdk-crypto-nodejs>=0.5.1 node>=24',
);
for (const { fixturePath, source } of activeOpenClawReleaseStandardDocSources) {
  assert.doesNotMatch(
    source,
    new RegExp(`\\b${releaseConfig.stableVersion.replaceAll('.', '\\.')}\\b`, 'u'),
    `${fixturePath} must not hard-code the current OpenClaw stable version; active standard docs should point to config/kernel-releases/openclaw.json`,
  );
  assert.doesNotMatch(
    source,
    new RegExp(`\\b${releaseConfig.nodeVersion.replaceAll('.', '\\.')}\\b`, 'u'),
    `${fixturePath} must not hard-code the current OpenClaw Node.js requirement; active standard docs should point to config/kernel-releases/openclaw.json`,
  );
}
assert.deepEqual(
  releaseConfig.runtimeSupplementalPackages,
  [],
  'openclaw shared release config must pin the prepared supplemental runtime packages',
);
assert.deepEqual(
  releaseConfig.runtimeSupplementalPackageExceptions,
  [],
  'openclaw shared release config must keep prerelease exception metadata empty while no supplemental runtime packages are bundled',
);
assert.deepEqual(
  releaseConfig.runtimeRequirements?.requiredExternalRuntimes,
  ['nodejs'],
  'openclaw kernel release registry must declare Node.js as the only required external runtime',
);
assert.equal(
  Object.hasOwn(releaseConfig.runtimeRequirements ?? {}, 'requiredExternalRuntimeVersions'),
  false,
  'openclaw kernel release registry JSON must not duplicate requiredExternalRuntimeVersions.nodejs; the loader derives it from nodeVersion',
);
assert.equal(
  normalizedReleaseConfig.runtimeRequirements?.requiredExternalRuntimeVersions?.nodejs,
  releaseConfig.nodeVersion,
  'openclaw kernel release loader must derive requiredExternalRuntimeVersions.nodejs from the shared nodeVersion',
);
assert.equal(
  Object.hasOwn(releaseConfig.releaseSource ?? {}, 'releaseUrl'),
  false,
  'openclaw kernel release registry JSON must not duplicate releaseSource.releaseUrl; the loader derives it from stableVersion',
);
assert.equal(
  normalizedReleaseConfig.releaseSource?.releaseUrl,
  `https://github.com/openclaw/openclaw/releases/tag/v${releaseConfig.stableVersion}`,
  'openclaw kernel release loader must derive releaseSource.releaseUrl from stableVersion',
);
assert.deepEqual(
  sourceComponentRegistry.components,
  [],
  'desktop source component registry must remain a generic support-component catalog and must not carry kernel-specific OpenClaw version metadata',
);
assert.match(
  prepareRuntimeSource,
  /from '\.\/openclaw-release\.mjs'/,
  'prepare-openclaw-runtime must read OpenClaw release metadata from the shared release module',
);
assert.doesNotMatch(
  prepareRuntimeSource,
  removedOpenClawReleaseConfigSourcePattern,
  'prepare-openclaw-runtime must not read the removed legacy OpenClaw release config file',
);
assert.doesNotMatch(
  prepareRuntimeSource,
  removedOpenClawRuntimeCleanupSourcePattern,
  'prepare-openclaw-runtime must not repair unsupported OpenClaw runtime layouts',
);
assert.match(
  prepareRuntimeSource,
  /assertNoUnsupportedOpenClawRuntimeLayout/,
  'prepare-openclaw-runtime must assert the current OpenClaw runtime layout before staging release assets',
);
assert.match(
  prepareRuntimeSource,
  /'--save-exact'/,
  'prepare-openclaw-runtime must install the packaged OpenClaw dependency with --save-exact so generated runtime package manifests do not float away from the shared release version',
);
assert.match(
  desktopBuildScriptSource,
  /OPENCLAW_RELEASE_CONFIG_RELATIVE_PATH:.*config\/kernel-releases\/openclaw\.json/s,
  'desktop build script must read the kernel release registry during clean-clone cargo builds',
);
assert.match(
  desktopBuildScriptSource,
  /SDKWORK_BUNDLED_OPENCLAW_VERSION/,
  'desktop build script must export the built-in OpenClaw version from shared release metadata',
);
assert.match(
  desktopBuildScriptSource,
  /SDKWORK_REQUIRED_OPENCLAW_NODE_VERSION/,
  'desktop build script must export the required OpenClaw Node.js version from shared release metadata',
);
assert.match(
  desktopOpenClawReleaseBridgeSource,
  /REQUIRED_OPENCLAW_NODE_VERSION:.*SDKWORK_REQUIRED_OPENCLAW_NODE_VERSION/s,
  'desktop Rust release bridge must expose the shared required OpenClaw Node.js version',
);
assert.match(
  desktopOpenClawReleaseBridgeSource,
  /required_openclaw_node_version\(\)/,
  'desktop Rust release bridge must provide a required_openclaw_node_version accessor for tests and runtime fixtures',
);
assert.match(
  syncBundledSource,
  /from '\.\/openclaw-release\.mjs'/,
  'sync-bundled-components must read OpenClaw release metadata from the shared release module',
);
assert.doesNotMatch(
  syncBundledSource,
  removedOpenClawReleaseConfigSourcePattern,
  'sync-bundled-components must not read the removed legacy OpenClaw release config file',
);
assert.doesNotMatch(
  applyUpgradeSource,
  removedOpenClawReleaseProjectionSourcePattern,
  'apply-openclaw-upgrade must mutate only config/kernel-releases/openclaw.json and must not maintain a legacy OpenClaw projection',
);
assert.doesNotMatch(
  syncBundledSource,
  /normalized source component registry openclaw version/,
  'sync-bundled-components must not normalize OpenClaw version metadata inside the generic desktop component registry after the multi-kernel hard cut',
);
assert.doesNotMatch(
  prepareRuntimeSource,
  /DEFAULT_OPENCLAW_VERSION\s*=\s*process\.env\.OPENCLAW_VERSION\s*\?\?\s*'2026\.4\.1'/,
  'prepare-openclaw-runtime must not keep a private hard-coded fallback version after release centralization',
);
for (const [envName, fieldName] of [
  ['OPENCLAW_VERSION', 'stableVersion'],
  ['OPENCLAW_NODE_VERSION', 'nodeVersion'],
  ['OPENCLAW_PACKAGE_NAME', 'packageName'],
]) {
  assert.doesNotMatch(
    openClawReleaseScriptSource,
    new RegExp(`process\\.env\\.${envName}`, 'u'),
    `scripts/openclaw-release.mjs must derive ${fieldName} only from config/kernel-releases/openclaw.json, not ${envName}`,
  );
}
assert.doesNotMatch(
  syncBundledSource,
  /\bOPENCLAW_VERSION\b/u,
  'sync-bundled-components must not allow OPENCLAW_VERSION to override the centralized OpenClaw release config',
);
assert.match(
  clawTypesIndexSource,
  /export \* from '\.\/openclawRelease\.ts';/,
  '@sdkwork/claw-types must export the shared OpenClaw release metadata for frontend/runtime consumers',
);
assert.match(
  clawTypesIndexSource,
  /export \* from '\.\/kernelReleaseCatalog\.ts';/,
  '@sdkwork/claw-types must export the shared kernel release registry catalog for frontend/runtime consumers',
);
assert.match(
  clawTypesKernelReleaseCatalogSource,
  /kernelId:\s*'openclaw'/,
  '@sdkwork/claw-types kernel release catalog must register OpenClaw metadata from the shared kernel release registry',
);
assert.match(
  clawTypesKernelReleaseCatalogSource,
  /kernelId:\s*'hermes'/,
  '@sdkwork/claw-types kernel release catalog must register Hermes metadata from the shared kernel release registry',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /runtimeSupplementalPackages:\s*string\[\];/,
  '@sdkwork/claw-types shared OpenClaw release metadata must expose prepared runtime supplemental packages',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /resolveKernelReleaseConfig\('openclaw'\)/,
  '@sdkwork/claw-types OpenClaw release metadata must resolve through the shared kernel release catalog',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /runtimeSupplementalPackages:\s*(normalizeRuntimeSupplementalPackages\(\s*metadata\.runtimeSupplementalPackages\s*,?\s*\)|metadata\.runtimeSupplementalPackages|normalizedSupplementalPackages)/,
  '@sdkwork/claw-types must project prepared runtime supplemental packages from the shared release config, with optional normalization',
);
assert.match(
  clawTypesOpenClawReleaseSource,
  /DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES\s*=\s*OPENCLAW_RELEASE\.runtimeSupplementalPackages/,
  '@sdkwork/claw-types must export the prepared runtime supplemental package list for frontend/runtime consumers',
);
assert.match(
  webStudioSource,
  /DEFAULT_BUNDLED_OPENCLAW_VERSION.*@sdkwork\/claw-types|from '@sdkwork\/claw-types'/,
  'webStudio must consume the shared OpenClaw release metadata instead of a private hard-coded version',
);
assert.doesNotMatch(
  webStudioSource,
  /const DEFAULT_BUNDLED_OPENCLAW_VERSION = '2026\.4\.1';/,
  'webStudio must not keep a private hard-coded legacy built-in OpenClaw version after release centralization',
);
assert.match(
  desktopStudioSource,
  /openclaw_release::bundled_openclaw_version|bundled_openclaw_version\(\)/,
  'desktop Rust services must resolve the built-in OpenClaw version through the shared release metadata bridge',
);
assert.match(
  desktopBootstrapSource,
  /required_openclaw_node_version\(\)/,
  'desktop bootstrap OpenClaw fixture manifests must use the shared required Node.js version instead of a private hard-coded baseline',
);
assert.match(
  desktopStudioSource,
  /required_openclaw_node_version\(\)/,
  'desktop studio OpenClaw fixture manifests must use the shared required Node.js version instead of a private hard-coded baseline',
);
if (desktopBundledManifest) {
  assert.equal(
    desktopBundledManifest.openclawVersion,
    releaseConfig.stableVersion,
    'desktop packaged runtime manifest must carry the shared stable OpenClaw version when prepared runtime resources exist',
  );
  assert.deepEqual(
    desktopBundledManifest.requiredExternalRuntimes,
    ['nodejs'],
    'desktop packaged runtime manifest must declare external Node.js as a required runtime when prepared runtime resources exist',
  );
  assert.equal(
    desktopBundledManifest.requiredExternalRuntimeVersions?.nodejs,
    releaseConfig.nodeVersion,
    'desktop packaged runtime manifest must carry the shared external Node.js requirement version in requiredExternalRuntimeVersions.nodejs when prepared runtime resources exist',
  );
  assert.equal(
    Object.hasOwn(desktopBundledManifest, 'nodeVersion'),
    false,
    'desktop packaged runtime manifest must not expose a legacy top-level nodeVersion field after the external Node hard cut',
  );
  assert.equal(
    Object.hasOwn(desktopBundledManifest, 'nodeRelativePath'),
    false,
    'desktop packaged runtime manifest must not expose a packaged Node entrypoint after the external Node hard cut',
  );
}
if (desktopBundledRuntimePackageJson) {
  assert.equal(
    desktopBundledRuntimePackageJson.dependencies?.[releaseConfig.packageName],
    releaseConfig.stableVersion,
    'desktop packaged runtime package.json must pin the OpenClaw dependency to the shared stable version exactly',
  );
}
assert.equal(
  existsSync(
    path.join(
      rootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'resources',
      'openclaw',
      'runtime',
      'node',
    ),
  ),
  false,
  'desktop source resources must not retain a packaged Node payload after the external Node hard cut',
);
assert.deepEqual(
  readdirSync(rootDir).filter(
    (entry) =>
      /^openclaw-.*\.tgz$/u.test(entry) && entry !== `openclaw-${releaseConfig.stableVersion}.tgz`,
  ),
  [],
  'repository root must not retain stale OpenClaw tarballs after upgrading the packaged runtime baseline',
);

for (const { fixturePath, source } of versionFixtureSources) {
  assert.doesNotMatch(
    source,
    /2026\.3\.13/,
    `${fixturePath} must not keep the retired OpenClaw 2026.3.13 fixture baseline`,
  );
  assert.match(
    source,
    /DEFAULT_BUNDLED_OPENCLAW_VERSION/,
    `${fixturePath} should consume the shared built-in OpenClaw version constant instead of hard-coding a fixture version`,
  );
}

for (const { fixturePath, source } of retiredOpenClawVersionLiteralSources) {
  assert.doesNotMatch(
    source,
    retiredOpenClawVersionLiteralPattern,
    `${fixturePath} must not hard-code retired OpenClaw release labels; use the shared release config or a version derived from it`,
  );
}

for (const { fixturePath, source } of retiredOpenClawNodeVersionLiteralSources) {
  assert.doesNotMatch(
    source,
    retiredOpenClawNodeVersionLiteralPattern,
    `${fixturePath} must not hard-code retired OpenClaw Node.js runtime labels; use the shared release config or a version derived from it`,
  );
}

for (const { fixturePath, source } of retiredAuthorityCompatibilityFieldSources) {
  assert.doesNotMatch(
    source,
    retiredAuthorityCompatibilityFieldPattern,
    `${fixturePath} must not keep the retired legacyRuntimeRoots authority field after the current kernel layout hard cut`,
  );
}

for (const { fixturePath, source } of retiredDisplayVersionCompatibilitySources) {
  assert.doesNotMatch(
    source,
    retiredDisplayVersionCompatibilityPattern,
    `${fixturePath} must not normalize retired active version labels; display versions must come from current authority or manifest metadata`,
  );
}

assert.doesNotMatch(
  activeStateRuntimeAliasSource,
  retiredRuntimeInstallKeyAliasReadPattern,
  `${activeStateRuntimeAliasSourcePath} must not read retired activeVersion/fallbackVersion aliases as runtime install keys`,
);
assert.doesNotMatch(
  activeStateRuntimeAliasSource,
  retiredRuntimeInstallKeyAliasWritePattern,
  `${activeStateRuntimeAliasSourcePath} must not write runtime install keys back into retired activeVersion/fallbackVersion aliases`,
);
assert.doesNotMatch(
  prepareRuntimeSource,
  retiredCachedNodeRuntimeCompatibilityPattern,
  'prepare-openclaw-runtime must require cached Node runtime sidecar metadata instead of probing retired cache layouts',
);
assert.doesNotMatch(
  prepareRuntimeSource,
  retiredPreparedRuntimeRepairPattern,
  'prepare-openclaw-runtime must reject stale prepared runtime metadata instead of repairing retired manifest or sidecar layouts',
);

for (const { fixturePath, source } of legacyOpenClawMirrorLiteralSources) {
  assert.doesNotMatch(
    source,
    legacyOpenClawMirrorLiteralPattern,
    `${fixturePath} must not keep pre-release OpenClaw mirror runtime labels; use the shared release config or a version derived from it`,
  );
}

console.log('ok - openclaw release metadata stays centralized across scripts, frontend, and desktop runtime');
