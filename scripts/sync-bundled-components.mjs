import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withRustToolchainPath } from './ensure-native-rust-toolchain.mjs';
import { buildNonInteractiveInstallEnv, shouldUseWindowsCommandShell } from './desktop-build-helpers.mjs';
import { DEFAULT_OPENCLAW_VERSION } from './openclaw-release.mjs';
import {
  buildOpenClawRuntimeInstallEnv,
  DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  DEFAULT_NODE_VERSION,
  DEFAULT_PREPARE_CACHE_DIR,
  installMissingBundledPluginRuntimeDeps,
  inspectCachedNodeRuntimeDir,
  inspectPreparedOpenClawRuntime,
  prepareOpenClawRuntime,
  resolvePackagedOpenClawResourceDir,
  resolveBundledResourceMirrorBaseDir as resolveSharedBundledResourceMirrorBaseDir,
  resolveOpenClawRuntimeInstallSpecs,
  resolveOpenClawPrepareCachePaths,
  resolveRequestedOpenClawTarget,
  syncWindowsPackagedOpenClawAliasRoot,
  validatePreparedOpenClawPackageTree,
} from './prepare-openclaw-runtime.mjs';
import {
  DEFAULT_KERNEL_PACKAGE_PROFILE_ID,
  resolveKernelPackageProfile,
} from './release/kernel-package-profiles.mjs';
import { listKernelDefinitions } from './release/kernel-definitions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const desktopSrcTauriPathSegments = ['packages', 'sdkwork-agentstudio-pc-desktop', 'src-tauri'];
const cacheRoot = path.join(rootDir, '.cache', 'bundled-components');
const upstreamRoot = path.join(cacheRoot, 'upstreams');
const buildRoot = path.join(cacheRoot, 'build');
const generatedRoot = path.join(
  rootDir,
  'packages',
  'sdkwork-agentstudio-pc-desktop',
  'src-tauri',
  'generated',
);
const bundledLinkRoot = path.join(generatedRoot, 'bundled');
const bundledMirrorRunId = createBundledMirrorRunId();
const bundledRoot = resolveBundledBuildRoot(rootDir, process.platform);
const tauriBundleOverlayConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-agentstudio-pc-desktop',
  'src-tauri',
  'generated',
  'tauri.bundle.overlay.json',
);
const openClawRuntimeBundleSourceRoot = resolveBundledResourceMirrorRoot(
  rootDir,
  'openclaw',
  process.platform,
);
const desktopWebDistBundleSourceRoot = path.join(
  rootDir,
  'packages',
  'sdkwork-agentstudio-pc-desktop',
  'dist',
);
const sourceFoundationDir = path.join(
  rootDir,
  'packages',
  'sdkwork-agentstudio-pc-desktop',
  'src-tauri',
  'foundation',
  'components',
);

const argvTokens = process.argv.slice(2);
const args = new Set(argvTokens);
const devMode = args.has('--dev');
const noFetch = args.has('--no-fetch');
const releaseMode = args.has('--release');
const skipOpenClaw = args.has('--skip-openclaw');
const requestedPackageProfileId = resolveRequestedPackageProfileId(argvTokens, process.env);
const windowsTauriBundleBridgeRoots = {
  bundled: ['generated', 'br', 'b'],
  'web-dist': ['generated', 'br', 'w'],
  openclaw: ['generated', 'br', 'o'],
};

const gitCmd = process.platform === 'win32' ? 'git.exe' : 'git';
const cargoCmd = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const commandEnv = createCommandEnv();
const DEFAULT_DIRECTORY_CLEANUP_RETRY_COUNT = 5;
const DEFAULT_DIRECTORY_CLEANUP_RETRY_DELAY_MS = 500;
const DEFAULT_WINDOWS_BUNDLED_MIRROR_RETENTION_COUNT = 3;
const MAX_LOCK_REUSE_LOG_LINES = 20;
let lockedBundledFileReuseLogCount = 0;
const KNOWN_KERNEL_IDS = new Set(
  listKernelDefinitions().map((definition) => String(definition?.kernelId ?? '').trim()).filter(Boolean),
);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function resolveRequestedPackageProfileId(argv, env = process.env) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--package-profile') {
      continue;
    }

    return readOptionValue(argv, index, '--package-profile');
  }

  const envPackageProfileId = String(env.SDKWORK_KERNEL_PACKAGE_PROFILE_ID ?? '').trim();
  return envPackageProfileId || DEFAULT_KERNEL_PACKAGE_PROFILE_ID;
}

export function createBundleManifest({
  packageProfileId = requestedPackageProfileId,
  generatedAt = new Date().toISOString(),
} = {}) {
  const kernelPackageProfile = resolveKernelPackageProfile(packageProfileId);
  return {
    version: 1,
    generatedAt,
    packageProfileId: kernelPackageProfile.profileId,
    includedKernelIds: [...kernelPackageProfile.includedKernelIds],
    defaultEnabledKernelIds: [...kernelPackageProfile.defaultEnabledKernelIds],
    requiredExternalRuntimes: [...kernelPackageProfile.requiredExternalRuntimes],
    optionalExternalRuntimes: [...kernelPackageProfile.optionalExternalRuntimes],
    launcherKinds: [...kernelPackageProfile.launcherKinds],
    kernelPlatformSupport: Object.fromEntries(
      Object.entries(kernelPackageProfile.kernelPlatformSupport).map(([kernelId, platformSupport]) => [
        kernelId,
        {
          ...platformSupport,
        },
      ]),
    ),
    components: [],
    kernelBundles: [],
    runtimeVersions: {},
  };
}

export function resolvePinnedOpenClawVersion() {
  return DEFAULT_OPENCLAW_VERSION;
}

function sleepSync(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return;
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function shouldRetryDirectoryCleanup(error) {
  const errorCode = typeof error === 'object' && error !== null ? error.code : undefined;
  return errorCode === 'EPERM' || errorCode === 'EBUSY' || errorCode === 'ENOTEMPTY';
}

export function removeDirectoryWithRetriesSync(
  directoryPath,
  {
    removeImpl = (targetPath, options) => fs.rmSync(targetPath, options),
    retryCount = DEFAULT_DIRECTORY_CLEANUP_RETRY_COUNT,
    retryDelayMs = DEFAULT_DIRECTORY_CLEANUP_RETRY_DELAY_MS,
    sleepImpl = sleepSync,
    logger = console.warn,
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      removeImpl(directoryPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      const canRetry = attempt < retryCount && shouldRetryDirectoryCleanup(error);
      if (!canRetry) {
        throw error;
      }

      if (typeof logger === 'function') {
        logger(
          `[bundled-components] Retrying cleanup of ${directoryPath} after transient Windows file lock (${attempt}/${retryCount - 1}).`,
        );
      }
      sleepImpl(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

function resolveComponentDesiredVersion(component) {
  if (component?.id === 'openclaw') {
    return resolvePinnedOpenClawVersion();
  }

  return null;
}

function resolveComponentPinnedRef(component, desiredVersion) {
  if (component?.id === 'openclaw' && desiredVersion) {
    return `refs/tags/v${desiredVersion}`;
  }

  return null;
}

export function shouldRefreshComponentRepository({
  componentId,
  noFetch = false,
  releaseMode = false,
  desiredVersion = null,
  currentVersion = null,
  currentTags = [],
} = {}) {
  if (componentId === 'openclaw' && releaseMode) {
    return false;
  }

  if (componentId === 'openclaw' && desiredVersion) {
    if (currentVersion !== desiredVersion) {
      return true;
    }

    if (noFetch) {
      return false;
    }

    const normalizedTags = Array.isArray(currentTags)
      ? currentTags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];
    return !normalizedTags.includes(`v${desiredVersion}`) && !normalizedTags.includes(desiredVersion);
  }

  return !noFetch;
}

export function prepareBundledOutputRootSync(
  bundleRoot,
  {
    cleanupImpl = removeDirectoryWithRetriesSync,
    logger = console.warn,
  } = {},
) {
  try {
    cleanupImpl(bundleRoot, { logger });
  } catch (error) {
    if (!shouldRetryDirectoryCleanup(error)) {
      throw error;
    }

    if (typeof logger === 'function') {
      const message = error instanceof Error ? error.message : String(error);
      logger(
        `[bundled-components] continuing with in-place bundle sync after cleanup fallback: ${message}`,
      );
    }
  }
}

export async function validateStagedOpenClawPackage({
  packageRoot,
  expectedVersion = null,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
} = {}) {
  await validatePreparedOpenClawPackageTree({
    packageRoot,
    expectedOpenClawVersion: expectedVersion,
    runtimeSupplementalPackages,
  });
}

export async function ensureBuildTimeNodeRuntimeCacheReady({
  cacheDir = DEFAULT_PREPARE_CACHE_DIR,
  openclawVersion = resolvePinnedOpenClawVersion(),
  nodeVersion = DEFAULT_NODE_VERSION,
  target = resolveRequestedOpenClawTarget({ env: process.env }),
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  inspectCachedNodeRuntimeDirImpl = inspectCachedNodeRuntimeDir,
  inspectPreparedOpenClawRuntimeImpl = inspectPreparedOpenClawRuntime,
  prepareOpenClawRuntimeImpl = prepareOpenClawRuntime,
} = {}) {
  const cachePaths = resolveOpenClawPrepareCachePaths({
    cacheDir,
    openclawVersion,
    nodeVersion,
    target,
  });

  let inspection = await inspectCachedNodeRuntimeDirImpl({
    nodeSourceDir: cachePaths.nodeCacheDir,
    target,
    nodeVersion,
  });
  let refreshedRuntime = false;
  let prepareResult = null;

  if (!inspection.reusable) {
    prepareResult = await prepareOpenClawRuntimeImpl({
      cacheDir,
      openclawVersion,
      nodeVersion,
      target,
      runtimeSupplementalPackages,
    });

    refreshedRuntime = true;
    inspection = await inspectCachedNodeRuntimeDirImpl({
      nodeSourceDir: cachePaths.nodeCacheDir,
      target,
      nodeVersion,
    });
  }

  if (!inspection.reusable && prepareResult?.resourceDir && prepareResult?.manifest) {
    const preparedInspection = await inspectPreparedOpenClawRuntimeImpl({
      resourceDir: prepareResult.resourceDir,
      manifest: prepareResult.manifest,
      runtimeSupplementalPackages,
    });
    if (!preparedInspection.reusable) {
      inspection = preparedInspection;
    }
  }

  if (!inspection.reusable) {
    const observedVersion =
      typeof inspection.preparedNodeVersion === 'string' && inspection.preparedNodeVersion.trim().length > 0
        ? ` (found ${inspection.preparedNodeVersion.trim()})`
        : '';
    throw new Error(
      `[bundled-components] build-time Node runtime cache is not ready for ${target.platformId}-${target.archId} Node ${nodeVersion}: ${inspection.reason}${observedVersion}`,
    );
  }

  const relativeNodeBinaryPath = target.nodeBinaryRelativePath.replace(/^runtime[\\/]node[\\/]/, '');
  return {
    cachePaths,
    inspection,
    nodeSourceDir: cachePaths.nodeCacheDir,
    nodeBinaryPath: path.join(cachePaths.nodeCacheDir, relativeNodeBinaryPath),
    refreshedRuntime,
    sourceKind: 'cache',
    target,
  };
}

function filesHaveEqualContent(sourcePath, targetPath) {
  try {
    return fs.readFileSync(sourcePath).equals(fs.readFileSync(targetPath));
  } catch {
    return false;
  }
}

function jsonFileMatchesValue(filePath, value) {
  try {
    return JSON.stringify(readJson(filePath)) === JSON.stringify(value);
  } catch {
    return false;
  }
}

function logLockedBundleReuse(message, logger = console.warn) {
  if (typeof logger !== 'function') {
    return;
  }

  if (lockedBundledFileReuseLogCount < MAX_LOCK_REUSE_LOG_LINES) {
    logger(message);
    lockedBundledFileReuseLogCount += 1;

    if (lockedBundledFileReuseLogCount === MAX_LOCK_REUSE_LOG_LINES) {
      logger(
        '[bundled-components] suppressing additional locked bundled file reuse logs after 20 entries',
      );
    }
  }
}

export function copyBundledFileSync(
  sourcePath,
  targetPath,
  {
    copyFileImpl = (fromPath, toPath) => fs.copyFileSync(fromPath, toPath),
    logger = console.warn,
    allowEquivalentExistingOnLock = true,
  } = {},
) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`missing bundled artifact: ${sourcePath}`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  try {
    copyFileImpl(sourcePath, targetPath);
    return { reusedLockedTarget: false };
  } catch (error) {
    const canReuseLockedTarget =
      allowEquivalentExistingOnLock
      && shouldRetryDirectoryCleanup(error)
      && fs.existsSync(targetPath)
      && filesHaveEqualContent(sourcePath, targetPath);

    if (!canReuseLockedTarget) {
      throw error;
    }

    logLockedBundleReuse(
      `[bundled-components] reusing existing locked bundled file ${targetPath} because it already matches the staged source`,
      logger,
    );

    return { reusedLockedTarget: true };
  }
}

export function writeJsonWithWindowsLockFallback(
  filePath,
  value,
  {
    writeFileImpl = (targetPath, content) => fs.writeFileSync(targetPath, content, 'utf8'),
    logger = console.warn,
    allowEquivalentExistingOnLock = false,
    allowAnyLock = false,
  } = {},
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = JSON.stringify(value, null, 2) + '\n';

  try {
    writeFileImpl(filePath, content);
    return { reusedLockedTarget: false };
  } catch (error) {
    const canReuseLockedTarget =
      shouldRetryDirectoryCleanup(error)
      && fs.existsSync(filePath)
      && (
        allowAnyLock
        || (
          allowEquivalentExistingOnLock
          && jsonFileMatchesValue(filePath, value)
        )
      );

    if (!canReuseLockedTarget) {
      throw error;
    }

    logLockedBundleReuse(
      `[bundled-components] reusing existing locked bundled json ${filePath} because it already satisfies the staged metadata contract`,
      logger,
    );

    return { reusedLockedTarget: true };
  }
}

const kernelBundleSources = [
  {
    id: 'openclaw',
    repoUrl: 'https://github.com/openclaw/openclaw.git',
    checkoutDir: 'openclaw',
    buildAttempts: 3,
    resolveVersion(repoDir, sha) {
      const pkg = readJson(path.join(repoDir, 'package.json'));
      return `${pkg.version}+${sha}`;
    },
    build(repoDir) {
      if (skipOpenClaw) {
        return;
      }
      installPnpmWorkspace(repoDir);
      runCommand(pnpmCmd, ['build'], { cwd: repoDir });
    },
    async stage(repoDir, version) {
      if (skipOpenClaw) {
        return;
      }

      const expectedVersion = readJson(path.join(repoDir, 'package.json')).version;
      const expectedCommit = readGitHeadCommit(repoDir);
      const { preparedPackageRoot, preparedModulesDir } = resolvePreparedOpenClawPackageRoots({
        openclawVersion: expectedVersion,
      });
      const preparedPackageInstallRoot = path.dirname(preparedModulesDir);
      const stageVersionDir = path.join(bundledRoot, 'modules', 'openclaw', version);
      const stageDir = path.join(bundledRoot, 'modules', 'openclaw', version, 'app');

      if (devMode) {
        const sourceInspection = inspectOpenClawPackageMetadata({
          packageRoot: repoDir,
          expectedVersion,
          expectedCommit,
          expectedSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
        });

        if (!sourceInspection.fresh) {
          const preparedInspection = await inspectPreparedOpenClawPackageRuntime({
            packageRoot: preparedPackageRoot,
            packageInstallRoot: preparedPackageInstallRoot,
            expectedVersion,
            expectedCommit,
            runtimeSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
          });

          if (preparedInspection.fresh) {
            console.log(
              '[bundled-components] using the prepared OpenClaw package layout as the source of truth for openclaw dev staging',
            );
            prepareBundledOutputRootSync(stageVersionDir, { logger: console.warn });
            fs.mkdirSync(stageDir, { recursive: true });
            copyDirectoryContents(preparedPackageRoot, stageDir, {
              allowEquivalentExistingOnLock: true,
              logger: console.warn,
            });
            copyDirectoryEntries(
              preparedModulesDir,
              path.join(stageDir, 'node_modules'),
              new Set(['openclaw']),
              {
                allowEquivalentExistingOnLock: true,
                logger: console.warn,
              },
            );

            const stagedPreparedInspection = inspectOpenClawPackageMetadata({
              packageRoot: stageDir,
              expectedVersion,
              expectedCommit,
              expectedSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
            });

            if (!stagedPreparedInspection.fresh) {
              throw new Error(
                `staged prepared openclaw package drifted from ${expectedVersion}@${expectedCommit.slice(0, 7)}: ${stagedPreparedInspection.issues.join(', ')}`,
              );
            }

            await validateStagedOpenClawPackage({
              packageRoot: stageDir,
              expectedVersion,
              runtimeSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
            });
            return;
          }

          console.log(
            `[bundled-components] refreshing openclaw dist for dev staging (${[
              ...sourceInspection.issues,
              ...preparedInspection.issues,
            ].join(', ')})`,
          );
          buildComponentWithRetry(this, repoDir);

          const refreshedInspection = inspectOpenClawPackageMetadata({
            packageRoot: repoDir,
            expectedVersion,
            expectedCommit,
          });

          if (!refreshedInspection.fresh) {
            throw new Error(
              `openclaw dist metadata remained stale after rebuild: ${refreshedInspection.issues.join(', ')}`,
            );
          }
        }
      }

      const packedDir = path.join(buildRoot, 'openclaw', version, 'pack');
      const prefixDir = path.join(buildRoot, 'openclaw', version, 'prefix');
      fs.rmSync(packedDir, { recursive: true, force: true });
      fs.rmSync(prefixDir, { recursive: true, force: true });
      fs.mkdirSync(packedDir, { recursive: true });
      fs.mkdirSync(prefixDir, { recursive: true });

      const packOutput = runCommand(
        npmCmd,
        ['pack', '--ignore-scripts', '--json', '--pack-destination', packedDir],
        { cwd: repoDir, captureStdout: true },
      );
      const packResult = JSON.parse(packOutput);
      const tarballName = Array.isArray(packResult)
        ? packResult[0]?.filename
        : packResult?.filename;
      if (!tarballName) {
        throw new Error('failed to resolve openclaw npm pack output');
      }

      const installSpecs = resolveOpenClawRuntimeInstallSpecs({
        openclawInstallSpec: path.join(packedDir, tarballName),
        runtimeSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
      });
      runCommand(
        npmCmd,
        [
          'install',
          '--global',
          '--prefix',
          prefixDir,
          '--ignore-scripts',
          ...installSpecs,
        ],
        {
          cwd: repoDir,
          env: buildOpenClawRuntimeInstallEnv(commandEnv),
        },
      );

      const installedModulesDir = resolveGlobalNodeModulesDir(prefixDir);
      await installMissingBundledPluginRuntimeDeps({
        packageRoot: path.join(installedModulesDir, 'openclaw'),
        packageInstallRoot: prefixDir,
        runtimeNpm: {
          command: npmCmd,
          args: [],
        },
        baseEnv: commandEnv,
        cacheDir: DEFAULT_PREPARE_CACHE_DIR,
        platform: process.platform,
        arch: process.arch,
        runCommandImpl: runCommand,
      });
      if (devMode) {
        prepareBundledOutputRootSync(stageVersionDir, { logger: console.warn });
      } else {
        removeDirectoryWithRetriesSync(stageVersionDir);
      }
      fs.mkdirSync(stageDir, { recursive: true });
      copyDirectoryContents(path.join(installedModulesDir, 'openclaw'), stageDir, {
        allowEquivalentExistingOnLock: devMode,
        logger: console.warn,
      });
      copyDirectoryEntries(
        installedModulesDir,
        path.join(stageDir, 'node_modules'),
        new Set(['openclaw']),
        {
          allowEquivalentExistingOnLock: devMode,
          logger: console.warn,
        },
      );

      const stagedInspection = inspectOpenClawPackageMetadata({
        packageRoot: stageDir,
        expectedVersion,
        expectedCommit,
        expectedSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
      });

      if (!stagedInspection.fresh) {
        throw new Error(
          `staged openclaw package metadata drifted from ${expectedVersion}@${expectedCommit.slice(0, 7)}: ${stagedInspection.issues.join(', ')}`,
        );
      }

      await validateStagedOpenClawPackage({
        packageRoot: stageDir,
        expectedVersion,
        runtimeSupplementalPackages: DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
      });
    },
  },
];

export function createPackageProfileBundleSyncPlan({
  packageProfileId = requestedPackageProfileId,
} = {}) {
  const kernelPackageProfile = resolveKernelPackageProfile(packageProfileId);
  const includedKernelIds = [...kernelPackageProfile.includedKernelIds];
  const availableBundledKernelIds = new Set(
    kernelBundleSources.map((kernelSource) => String(kernelSource?.id ?? '').trim()).filter(Boolean),
  );
  const bundledKernelIds = includedKernelIds.filter((kernelId) => availableBundledKernelIds.has(kernelId));
  const includesOpenClaw = bundledKernelIds.includes('openclaw');

  return {
    packageProfileId: kernelPackageProfile.profileId,
    includedKernelIds,
    bundledKernelIds,
    includesOpenClaw,
    requiresBuildTimeNodeRuntimeCache: includesOpenClaw,
    shouldIncludeOpenClawResources: includesOpenClaw,
  };
}

export function filterPackagedComponentRegistry({
  componentRegistry,
  bundledKernelIds = [],
} = {}) {
  const sourceRegistry =
    componentRegistry && typeof componentRegistry === 'object' ? componentRegistry : {};
  const sourceComponents = Array.isArray(sourceRegistry.components)
    ? sourceRegistry.components
    : [];
  const kernelCatalogIds = new Set(
    [...KNOWN_KERNEL_IDS],
  );
  const includedBundledKernelIds = new Set(
    Array.isArray(bundledKernelIds)
      ? bundledKernelIds.map((kernelId) => String(kernelId ?? '').trim()).filter(Boolean)
      : [],
  );

  return {
    ...sourceRegistry,
    components: sourceComponents.filter((entry) => {
      const componentId = typeof entry?.id === 'string' ? entry.id.trim() : '';
      return !kernelCatalogIds.has(componentId) || includedBundledKernelIds.has(componentId);
    }),
  };
}

async function main() {
  const bundleSyncPlan = createPackageProfileBundleSyncPlan({
    packageProfileId: requestedPackageProfileId,
  });
  fs.mkdirSync(upstreamRoot, { recursive: true });
  fs.mkdirSync(buildRoot, { recursive: true });
  fs.mkdirSync(generatedRoot, { recursive: true });
  prepareBundledOutputRootSync(bundledRoot);
  fs.mkdirSync(path.join(bundledRoot, 'foundation', 'components'), { recursive: true });
  fs.mkdirSync(path.join(bundledRoot, 'modules'), { recursive: true });
  writeTauriBundleOverlayConfig({
    packageProfileId: bundleSyncPlan.packageProfileId,
  });

  const bundleManifest = {
    ...createBundleManifest({
      packageProfileId: requestedPackageProfileId,
    }),
    mode: devMode ? 'dev' : 'build',
  };

  const staticRegistry = filterPackagedComponentRegistry({
    componentRegistry: syncSourceFoundationComponentRegistrySync({
      foundationDir: sourceFoundationDir,
    }),
    bundledKernelIds: bundleSyncPlan.bundledKernelIds,
  });
  const serviceDefaults = readJson(path.join(sourceFoundationDir, 'service-defaults.json'));
  const upgradePolicy = readJson(path.join(sourceFoundationDir, 'upgrade-policy.json'));

  for (const component of kernelBundleSources.filter((entry) => (
    bundleSyncPlan.bundledKernelIds.includes(entry.id)
  ))) {
    const repoDir = ensureRepository(component);
    const fullSha = readGitHeadCommit(repoDir);
    const shortSha = fullSha.slice(0, 12);
    const version = component.resolveVersion(repoDir, shortSha);
    const executionPlan = createComponentExecutionPlan({
      componentId: component.id,
      devMode,
      releaseMode,
    });
    const executionPlanLabel = describeComponentExecutionPlan({
      componentId: component.id,
      devMode,
      releaseMode,
    });

    console.log(
      `[bundled-components] processing ${component.id} ${version} from ${component.repoUrl}`,
    );

    if (executionPlan.shouldBuild) {
      buildComponentWithRetry(component, repoDir);
    } else {
      console.log(
        `[bundled-components] skipping build for ${component.id} (${executionPlanLabel})`,
      );
    }

    if (executionPlan.shouldStage) {
      if (devMode) {
        try {
          await component.stage(repoDir, version);
        } catch (error) {
          console.warn(`[bundled-components] skipped staging ${component.id} in dev mode: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        await component.stage(repoDir, version);
      }
    } else {
      console.log(
        `[bundled-components] skipping staging for ${component.id} (${executionPlanLabel})`,
      );
    }

    bundleManifest.kernelBundles.push({
      id: component.id,
      version,
      commit: fullSha,
      repositoryUrl: component.repoUrl,
      checkoutDir: path.relative(rootDir, repoDir).replaceAll('\\', '/'),
    });

    const registryEntry = staticRegistry.components.find((entry) => entry.id === component.id);
    if (registryEntry) {
      registryEntry.bundledVersion = version;
      registryEntry.commit = fullSha;
      registryEntry.sourceUrl = component.repoUrl;
    }
  }

  writeJson(path.join(bundledRoot, 'foundation', 'components', 'component-registry.json'), staticRegistry, {
    allowEquivalentExistingOnLock: devMode,
    logger: console.warn,
  });
  writeJson(path.join(bundledRoot, 'foundation', 'components', 'service-defaults.json'), serviceDefaults, {
    allowEquivalentExistingOnLock: devMode,
    logger: console.warn,
  });
  writeJson(path.join(bundledRoot, 'foundation', 'components', 'upgrade-policy.json'), upgradePolicy, {
    allowEquivalentExistingOnLock: devMode,
    logger: console.warn,
  });
  writeJson(path.join(bundledRoot, 'foundation', 'components', 'bundle-manifest.json'), bundleManifest, {
    allowEquivalentExistingOnLock: devMode,
    allowAnyLock: devMode,
    logger: console.warn,
  });

  if (bundleSyncPlan.shouldIncludeOpenClawResources) {
    await syncWindowsPackagedOpenClawAliasRoot({
      workspaceRootDir: rootDir,
      packagedResourceDir: resolvePackagedOpenClawResourceDir(rootDir, 'windows'),
      platform: process.platform,
    });
  }
  ensureBundledLinkRoot();
  ensureWindowsTauriBundleBridgeRoots({
    packageProfileId: bundleSyncPlan.packageProfileId,
  });
  pruneWindowsBundledMirrorRoots({
    workspaceRootDir: rootDir,
    platform: process.platform,
    activeBundleRoot: bundledRoot,
  });

  console.log('[bundled-components] generated bundled assets at', path.relative(rootDir, bundledLinkRoot));
}

export function createComponentExecutionPlan({
  componentId,
  devMode = false,
  releaseMode = false,
} = {}) {
  if (devMode) {
    return {
      shouldBuild: false,
      shouldStage: true,
    };
  }

  if (
    releaseMode
    && String(componentId ?? '').trim() === 'openclaw'
  ) {
    return {
      shouldBuild: false,
      shouldStage: false,
    };
  }

  return {
    shouldBuild: true,
    shouldStage: true,
  };
}

function describeComponentExecutionPlan({
  componentId,
  devMode = false,
  releaseMode = false,
} = {}) {
  if (devMode) {
    return 'dev-mode';
  }

  if (
    releaseMode
    && String(componentId ?? '').trim() === 'openclaw'
  ) {
    return 'deferred-to-dedicated-release-phase';
  }

  return releaseMode ? 'release-sync-required' : 'standard-sync';
}

function buildComponentWithRetry(component, repoDir) {
  const maxAttempts = Math.max(1, Number(component.buildAttempts ?? 1));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      component.build(repoDir);
      return;
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[bundled-components] ${component.id} build attempt ${attempt}/${maxAttempts} failed; retrying after cleaning dist: ${message}`,
      );
      fs.rmSync(path.join(repoDir, 'dist'), { recursive: true, force: true });
    }
  }
}

function ensureRepository(component) {
  const repoDir = resolveComponentRepositoryDir({
    component,
    upstreamRootDir: upstreamRoot,
  });

  if (repoDir !== path.join(upstreamRoot, component.checkoutDir)) {
    if (!fs.existsSync(repoDir)) {
      throw new Error(`missing managed component repository: ${repoDir}`);
    }
    if (!fs.existsSync(path.join(repoDir, '.git'))) {
      throw new Error(`managed component repository is not a git checkout: ${repoDir}`);
    }
    return repoDir;
  }

  const desiredVersion = resolveComponentDesiredVersion(component);
  const desiredRef = resolveComponentPinnedRef(component, desiredVersion);

  if (!fs.existsSync(repoDir)) {
    const cloneArgs = desiredVersion
      ? ['clone', '--branch', `v${desiredVersion}`, '--depth', '1', component.repoUrl, repoDir]
      : ['clone', '--depth', '1', component.repoUrl, repoDir];
    runCommand(gitCmd, cloneArgs, { cwd: rootDir });
    return repoDir;
  }

  const currentVersion = readJson(path.join(repoDir, 'package.json')).version;
  const currentTags = desiredVersion && !noFetch
    ? gitOutput(repoDir, ['tag', '--points-at', 'HEAD'])
        .split(/\r?\n/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  if (
    shouldRefreshComponentRepository({
      componentId: component.id,
      noFetch,
      releaseMode,
      desiredVersion,
      currentVersion,
      currentTags,
    })
  ) {
    if (desiredRef) {
      runCommand(gitCmd, ['-C', repoDir, 'fetch', '--depth', '1', 'origin', desiredRef], {
        cwd: rootDir,
      });
    } else {
      runCommand(gitCmd, ['-C', repoDir, 'fetch', '--depth', '1', 'origin'], { cwd: rootDir });
    }
    runCommand(gitCmd, ['-C', repoDir, 'reset', '--hard', 'FETCH_HEAD'], { cwd: rootDir });
  }

  return repoDir;
}

export function resolveComponentRepositoryDir({
  component,
  upstreamRootDir = upstreamRoot,
} = {}) {
  if (typeof component?.repositoryDir === 'string' && component.repositoryDir.trim().length > 0) {
    return path.resolve(component.repositoryDir);
  }

  return path.join(upstreamRootDir, component.checkoutDir);
}

function installPnpmWorkspace(cwd) {
  const installEnv = buildNonInteractiveInstallEnv(commandEnv);
  try {
    runCommand(pnpmCmd, ['install', '--frozen-lockfile'], { cwd, env: installEnv });
  } catch (error) {
    console.warn(
      `[bundled-components] retrying pnpm install without frozen lockfile in ${path.relative(rootDir, cwd) || cwd}`,
    );
    runCommand(pnpmCmd, ['install', '--lockfile=false', '--force'], { cwd, env: installEnv });
  }
}

function runCommand(command, commandArgs, options = {}) {
  const useWindowsShell = shouldUseWindowsCommandShell(command, process.platform);
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? rootDir,
    encoding: 'utf8',
    env: {
      ...commandEnv,
      ...(options.env ?? {}),
    },
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    shell: useWindowsShell,
    stdio: options.captureStdout ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(
      `${command} ${commandArgs.join(' ')} failed: ${result.error.message}`,
    );
  }

  if (result.signal) {
    throw new Error(
      `${command} ${commandArgs.join(' ')} failed with signal ${result.signal}`,
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${commandArgs.join(' ')} failed with exit code ${result.status ?? 'unknown'}`,
    );
  }

  return (result.stdout ?? '').trim();
}

function gitOutput(cwd, commandArgs) {
  return runCommand(gitCmd, ['-C', cwd, ...commandArgs], { cwd: rootDir, captureStdout: true });
}

function readGitHeadCommit(repoDir) {
  const gitDir = resolveGitDir(repoDir);
  const headPath = path.join(gitDir, 'HEAD');
  const headContent = fs.readFileSync(headPath, 'utf8').trim();
  if (!headContent) {
    throw new Error(`git HEAD is empty in ${repoDir}`);
  }

  if (!headContent.startsWith('ref:')) {
    return headContent;
  }

  const refName = headContent.slice('ref:'.length).trim();
  const resolvedRef = readGitRef(gitDir, refName);
  if (!resolvedRef) {
    throw new Error(`failed to resolve git ref ${refName} in ${repoDir}`);
  }
  return resolvedRef;
}

function resolveGitDir(repoDir) {
  const dotGitPath = path.join(repoDir, '.git');
  const stat = fs.statSync(dotGitPath);
  if (stat.isDirectory()) {
    return dotGitPath;
  }

  const pointer = fs.readFileSync(dotGitPath, 'utf8');
  const match = pointer.match(/^gitdir:\s*(.+)\s*$/im);
  if (!match) {
    throw new Error(`unsupported gitdir pointer format in ${dotGitPath}`);
  }

  return path.resolve(repoDir, match[1].trim());
}

function readGitRef(gitDir, refName) {
  const normalizedRef = String(refName ?? '').trim().replaceAll('/', path.sep);
  if (!normalizedRef) {
    return null;
  }

  const looseRefPath = path.join(gitDir, normalizedRef);
  if (fs.existsSync(looseRefPath)) {
    const looseValue = fs.readFileSync(looseRefPath, 'utf8').trim();
    if (looseValue) {
      return looseValue;
    }
  }

  const packedRefsPath = path.join(gitDir, 'packed-refs');
  if (!fs.existsSync(packedRefsPath)) {
    return null;
  }

  const targetRef = refName.replaceAll('\\', '/');
  for (const line of fs.readFileSync(packedRefsPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || line.startsWith('^')) {
      continue;
    }

    const [value, packedRefName] = line.split(' ');
    if (packedRefName === targetRef && value) {
      return value.trim();
    }
  }

  return null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function tryReadJson(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

export function resolvePreparedOpenClawPackageRoots({
  cacheDir = DEFAULT_PREPARE_CACHE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  target = resolveRequestedOpenClawTarget({ env: process.env }),
} = {}) {
  const cachePaths = resolveOpenClawPrepareCachePaths({
    cacheDir,
    openclawVersion,
    nodeVersion,
    target,
  });

  return {
    cachePaths,
    preparedPackageRoot: path.join(cachePaths.packageCacheDir, 'node_modules', 'openclaw'),
    preparedModulesDir: path.join(cachePaths.packageCacheDir, 'node_modules'),
  };
}

export function syncSourceFoundationComponentRegistrySync({
  foundationDir = sourceFoundationDir,
  readJsonImpl = readJson,
} = {}) {
  const componentRegistryPath = path.join(foundationDir, 'component-registry.json');
  const registry = readJsonImpl(componentRegistryPath);
  const registryComponents = Array.isArray(registry?.components)
    ? registry.components
    : [];
  const leakedKernelIds = [...new Set(
    registryComponents
      .map((entry) => (typeof entry?.id === 'string' ? entry.id.trim() : ''))
      .filter((componentId) => KNOWN_KERNEL_IDS.has(componentId)),
  )];

  if (leakedKernelIds.length > 0) {
    throw new Error(
      `source desktop component registry must not contain kernel entries: ${leakedKernelIds.join(', ')}`,
    );
  }

  return registry;
}

export function inspectOpenClawPackageMetadata({
  packageRoot,
  expectedVersion = null,
  expectedCommit = null,
  expectedSupplementalPackages = [],
} = {}) {
  const packageJson = tryReadJson(path.join(packageRoot, 'package.json'));
  const buildInfo = tryReadJson(path.join(packageRoot, 'dist', 'build-info.json'));
  const cliStartupMetadata = tryReadJson(
    path.join(packageRoot, 'dist', 'cli-startup-metadata.json'),
  );
  const rootHelpText =
    typeof cliStartupMetadata?.rootHelpText === 'string'
      ? cliStartupMetadata.rootHelpText
      : '';
  const rootHelpMatch = rootHelpText.match(
    /OpenClaw\s+([0-9A-Za-z.+-]+)\s+\(([0-9a-f]{7,40})\)/i,
  );

  const observed = {
    packageVersion:
      typeof packageJson?.version === 'string' ? packageJson.version.trim() : null,
    buildInfoVersion:
      typeof buildInfo?.version === 'string' ? buildInfo.version.trim() : null,
    buildInfoCommit:
      typeof buildInfo?.commit === 'string' ? buildInfo.commit.trim() : null,
    rootHelpVersion: rootHelpMatch?.[1] ?? null,
    rootHelpCommit: rootHelpMatch?.[2] ?? null,
  };

  const issues = [];
  if (expectedVersion && observed.packageVersion !== expectedVersion) {
    issues.push('package-version-mismatch');
  }
  if (expectedVersion && observed.buildInfoVersion !== expectedVersion) {
    issues.push('build-info-version-mismatch');
  }
  if (expectedCommit && observed.buildInfoCommit !== expectedCommit) {
    issues.push('build-info-commit-mismatch');
  }
  if (expectedVersion && observed.rootHelpVersion !== expectedVersion) {
    issues.push('cli-startup-version-mismatch');
  }
  if (
    expectedCommit
    && observed.rootHelpCommit !== expectedCommit.slice(0, observed.rootHelpCommit?.length ?? 0)
  ) {
    issues.push('cli-startup-commit-mismatch');
  }
  const modulesRoot = path.join(packageRoot, '..');
  for (const installSpec of expectedSupplementalPackages) {
    const packageName = resolvePackageNameFromInstallSpec(installSpec);
    if (!packageName) {
      continue;
    }

    const supplementalPackagePath = path.join(modulesRoot, ...packageName.split('/'));
    if (!fs.existsSync(supplementalPackagePath)) {
      issues.push(`missing-supplemental-package:${packageName}`);
    }
  }

  return {
    fresh: issues.length === 0,
    issues,
    observed,
  };
}

export async function inspectPreparedOpenClawPackageRuntime({
  packageRoot,
  packageInstallRoot = packageRoot,
  expectedVersion = null,
  expectedCommit = null,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
} = {}) {
  const inspection = inspectOpenClawPackageMetadata({
    packageRoot,
    expectedVersion,
    expectedCommit,
    expectedSupplementalPackages: runtimeSupplementalPackages,
  });
  const issues = [...inspection.issues];

  try {
    await validatePreparedOpenClawPackageTree({
      packageRoot,
      packageInstallRoot,
      expectedOpenClawVersion: expectedVersion,
      runtimeSupplementalPackages,
    });
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }

  return {
    fresh: issues.length === 0,
    issues,
    observed: inspection.observed,
  };
}

function readCargoPackageVersion(manifestPath) {
  const content = fs.readFileSync(manifestPath, 'utf8');
  const packageBlock = content.match(/\[package\][\s\S]*?(?=\n\[|$)/);
  if (!packageBlock) {
    return null;
  }
  const versionMatch = packageBlock[0].match(/^\s*version\s*=\s*"([^"]+)"/m);
  return versionMatch?.[1] ?? null;
}

function writeJson(filePath, value, options = {}) {
  return writeJsonWithWindowsLockFallback(filePath, value, options);
}

export function resolveGlobalNodeModulesDir(prefixDir, platform = process.platform) {
  if (platform === 'win32') {
    return path.win32.join(prefixDir, 'node_modules');
  }

  return path.posix.join(prefixDir, 'lib', 'node_modules');
}

function resolvePackageNameFromInstallSpec(installSpec) {
  const normalized = String(installSpec ?? '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('@')) {
    const versionSeparatorIndex = normalized.lastIndexOf('@');
    return versionSeparatorIndex > 0 ? normalized.slice(0, versionSeparatorIndex) : normalized;
  }

  const versionSeparatorIndex = normalized.indexOf('@');
  return versionSeparatorIndex >= 0 ? normalized.slice(0, versionSeparatorIndex) : normalized;
}

function createBundledMirrorRunId({
  env = process.env,
  now = new Date(),
  pid = process.pid,
} = {}) {
  const configuredMirrorRunId = env.SDKWORK_BUNDLED_MIRROR_RUN_ID;
  if (typeof configuredMirrorRunId === 'string' && configuredMirrorRunId.trim().length > 0) {
    return configuredMirrorRunId.trim();
  }

  const timestamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${timestamp}-${pid}`;
}

function resolveWindowsMirrorBaseDir(
  workspaceRootDir,
  {
    env = process.env,
    platform = process.platform,
  } = {},
) {
  return resolveSharedBundledResourceMirrorBaseDir(workspaceRootDir, env, platform);
}

export function resolveBundledBuildRoot(
  workspaceRootDir,
  platform = process.platform,
  mirrorRunId = bundledMirrorRunId,
  windowsMirrorBaseDir = resolveWindowsMirrorBaseDir(workspaceRootDir, { platform }),
) {
  if (platform !== 'win32') {
    return path.join(workspaceRootDir, ...desktopSrcTauriPathSegments, 'generated', 'bundled');
  }

  return path.win32.join(
    windowsMirrorBaseDir,
    'bundled-mirrors',
    `bundled-${sanitizePathSegment(mirrorRunId) || 'current'}`,
  );
}

export function pruneWindowsBundledMirrorRoots({
  workspaceRootDir = rootDir,
  platform = process.platform,
  activeBundleRoot = bundledRoot,
  windowsMirrorBaseDir = resolveWindowsMirrorBaseDir(workspaceRootDir, { platform }),
  retentionCount = DEFAULT_WINDOWS_BUNDLED_MIRROR_RETENTION_COUNT,
  existsImpl = (targetPath) => fs.existsSync(targetPath),
  readdirImpl = (targetPath) => fs.readdirSync(targetPath, { withFileTypes: true }),
  statImpl = (targetPath) => fs.statSync(targetPath),
  cleanupImpl = removeDirectoryWithRetriesSync,
  logger = console.warn,
} = {}) {
  if (platform !== 'win32') {
    return [];
  }

  const mirrorRoot = path.win32.join(windowsMirrorBaseDir, 'bundled-mirrors');
  if (!existsImpl(mirrorRoot)) {
    return [];
  }

  const normalizedRetentionCount = Math.max(1, Number(retentionCount) || 0);
  const normalizedActiveBundleRoot = path.win32.normalize(activeBundleRoot);
  const mirrorEntries = readdirImpl(mirrorRoot)
    .filter((entry) => entry?.isDirectory?.() && /^bundled-/i.test(String(entry.name ?? '').trim()))
    .map((entry) => {
      const absolutePath = path.win32.join(mirrorRoot, entry.name);
      return {
        absolutePath,
        normalizedPath: path.win32.normalize(absolutePath),
        mtimeMs: Number(statImpl(absolutePath)?.mtimeMs ?? 0),
      };
    })
    .sort((left, right) => (
      right.mtimeMs - left.mtimeMs || right.normalizedPath.localeCompare(left.normalizedPath)
    ));

  const retainedMirrorPaths = new Set([normalizedActiveBundleRoot]);
  for (const entry of mirrorEntries) {
    if (retainedMirrorPaths.has(entry.normalizedPath)) {
      continue;
    }
    if (retainedMirrorPaths.size >= normalizedRetentionCount) {
      continue;
    }
    retainedMirrorPaths.add(entry.normalizedPath);
  }

  const removedMirrorPaths = [];
  for (const entry of mirrorEntries) {
    if (retainedMirrorPaths.has(entry.normalizedPath)) {
      continue;
    }

    try {
      cleanupImpl(entry.absolutePath, { logger });
      removedMirrorPaths.push(entry.absolutePath);
    } catch (error) {
      if (typeof logger === 'function') {
        logger(
          `[bundled-components] failed to prune stale bundled mirror ${entry.absolutePath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return removedMirrorPaths;
}

function ensureBundledLinkRoot() {
  ensureDirectoryLinkRoot(bundledLinkRoot, bundledRoot, process.platform);
}

function resolveExistingPathTarget(candidatePath) {
  try {
    return fs.realpathSync.native(candidatePath);
  } catch {
    return null;
  }
}

function writeTauriBundleOverlayConfig({
  packageProfileId = requestedPackageProfileId,
} = {}) {
  writeJson(
    tauriBundleOverlayConfigPath,
    createTauriBundleOverlayConfig({
      workspaceRootDir: rootDir,
      platform: process.platform,
      packageProfileId,
    }),
  );
}

function resolveBundledResourceMirrorRoot(
  workspaceRootDir,
  resourceId,
  platform = process.platform,
  windowsMirrorBaseDir = resolveWindowsMirrorBaseDir(workspaceRootDir, { platform }),
) {
  if (platform !== 'win32') {
    return path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-agentstudio-pc-desktop',
      'src-tauri',
      'resources',
      resourceId,
    );
  }

  return path.win32.join(
    windowsMirrorBaseDir,
    resourceId,
  );
}

function resolveDesktopSrcTauriDir(workspaceRootDir, platform = process.platform) {
  if (platform === 'win32') {
    return path.win32.join(workspaceRootDir, ...desktopSrcTauriPathSegments);
  }

  return path.join(workspaceRootDir, ...desktopSrcTauriPathSegments);
}

function resolveWindowsTauriBundleBridgeDir(
  workspaceRootDir,
  resourceId,
  platform = process.platform,
) {
  const relativeSegments = windowsTauriBundleBridgeRoots[resourceId];
  if (!relativeSegments) {
    throw new Error(`unsupported Windows Tauri bridge resource: ${resourceId}`);
  }

  const pathApi = platform === 'win32' ? path.win32 : path;
  return pathApi.join(resolveDesktopSrcTauriDir(workspaceRootDir, platform), ...relativeSegments);
}

function resolveWindowsTauriBundleBridgeSource(resourceId) {
  const relativeSegments = windowsTauriBundleBridgeRoots[resourceId];
  if (!relativeSegments) {
    throw new Error(`unsupported Windows Tauri bridge resource: ${resourceId}`);
  }

  return `${relativeSegments.join('/')}/`;
}

function ensureWindowsTauriBundleBridgeRoots({
  packageProfileId = requestedPackageProfileId,
} = {}) {
  if (process.platform !== 'win32') {
    return;
  }

  const bundleSyncPlan = createPackageProfileBundleSyncPlan({ packageProfileId });
  ensureDirectoryLinkRoot(
    resolveWindowsTauriBundleBridgeDir(rootDir, 'bundled', process.platform),
    bundledRoot,
    process.platform,
  );
  ensureDirectoryLinkRoot(
    resolveWindowsTauriBundleBridgeDir(rootDir, 'web-dist', process.platform),
    desktopWebDistBundleSourceRoot,
    process.platform,
  );
  if (bundleSyncPlan.shouldIncludeOpenClawResources) {
    ensureDirectoryLinkRoot(
      resolveWindowsTauriBundleBridgeDir(rootDir, 'openclaw', process.platform),
      openClawRuntimeBundleSourceRoot,
      process.platform,
    );
  }
}

export function createTauriBundleOverlayConfig({
  workspaceRootDir = rootDir,
  platform = process.platform,
  packageProfileId = requestedPackageProfileId,
} = {}) {
  if (platform !== 'win32') {
    return {};
  }

  const bundleSyncPlan = createPackageProfileBundleSyncPlan({ packageProfileId });
  const resources = {
    'foundation/components/': 'foundation/components/',
    // Use short in-tree bridge junctions so Windows bundling avoids both
    // lost drive prefixes and MAX_PATH expansion through repo-relative roots.
    [resolveWindowsTauriBundleBridgeSource('bundled')]: 'generated/bundled/',
    [resolveWindowsTauriBundleBridgeSource('web-dist')]: 'dist/',
  };
  if (bundleSyncPlan.shouldIncludeOpenClawResources) {
    resources[resolveWindowsTauriBundleBridgeSource('openclaw')] = 'resources/openclaw/';
  }

  return {
    bundle: {
      resources,
    },
  };
}

function ensureDirectoryLinkRoot(linkRoot, targetRoot, platform = process.platform) {
  if (path.resolve(targetRoot) === path.resolve(linkRoot)) {
    return;
  }

  const existingResolvedPath = resolveExistingPathTarget(linkRoot);
  if (existingResolvedPath && path.resolve(existingResolvedPath) === path.resolve(targetRoot)) {
    return;
  }

  fs.mkdirSync(path.dirname(linkRoot), { recursive: true });
  removeDirectoryWithRetriesSync(linkRoot);
  fs.symlinkSync(
    targetRoot,
    linkRoot,
    platform === 'win32' ? 'junction' : 'dir',
  );
}

function copyFile(sourcePath, targetPath, options = {}) {
  copyBundledFileSync(sourcePath, targetPath, options);
}

function copyDirectoryContents(sourceDir, targetDir, options = {}) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`missing bundled directory: ${sourceDir}`);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath, options);
    } else {
      copyFile(sourcePath, targetPath, options);
    }
  }
}

function copyDirectoryEntries(sourceDir, targetDir, excludedNames = new Set(), options = {}) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`missing bundled directory: ${sourceDir}`);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (excludedNames.has(entry.name)) {
      continue;
    }
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath, options);
    } else {
      copyFile(sourcePath, targetPath, options);
    }
  }
}

function withExe(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function createCommandEnv() {
  const env = withRustToolchainPath(process.env);
  if (process.platform !== 'win32') {
    return env;
  }

  const pathKey = resolvePathKey(env);
  const pathValue = env[pathKey] ?? env.PATH ?? '';
  const pathEntries = pathValue.split(path.delimiter).filter(Boolean);
  const gitRuntimePathEntries = resolveGitRuntimePathEntries(pathEntries);
  for (const entry of [...gitRuntimePathEntries].reverse()) {
    if (!pathEntries.includes(entry)) {
      pathEntries.unshift(entry);
    }
  }
  for (const key of Object.keys(env)) {
    if (key !== pathKey && key.toUpperCase() === 'PATH') {
      delete env[key];
    }
  }
  env[pathKey] = pathEntries.join(path.delimiter);
  return env;
}

function resolvePathKey(env) {
  return Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'Path';
}

function resolveGitRuntimePathEntries(pathEntries) {
  const candidates = [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Git'),
    process.env['ProgramFiles(x86)'] &&
      path.join(process.env['ProgramFiles(x86)'], 'Git'),
    resolveGitRootFromPath(pathEntries),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const runtimeEntries = [path.join(candidate, 'bin'), path.join(candidate, 'usr', 'bin')];
    if (
      runtimeEntries.every((entry) => fs.existsSync(entry)) &&
      fs.existsSync(path.join(candidate, 'bin', 'bash.exe')) &&
      fs.existsSync(path.join(candidate, 'usr', 'bin', 'cp.exe'))
    ) {
      return runtimeEntries;
    }
  }

  return [];
}

function resolveGitRootFromPath(pathEntries) {
  for (const entry of pathEntries) {
    const candidate = path.join(entry, 'git.exe');
    if (!fs.existsSync(candidate)) {
      continue;
    }
    const gitRoot = path.resolve(path.dirname(candidate), '..');
    if (
      fs.existsSync(path.join(gitRoot, 'bin', 'bash.exe')) &&
      fs.existsSync(path.join(gitRoot, 'usr', 'bin', 'cp.exe'))
    ) {
      return gitRoot;
    }
  }
  return null;
}

function sanitizePathSegment(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
}

function rustTargetDir(componentId) {
  return path.join(cacheRoot, 'targets', componentId);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
