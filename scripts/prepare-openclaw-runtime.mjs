import { spawn, spawnSync } from 'node:child_process';
import {
  cp,
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createWriteStream, existsSync, readFileSync, realpathSync, symlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';

import { resolveDesktopReleaseTarget } from './release/desktop-targets.mjs';
import {
  DEFAULT_NODE_VERSION,
  DEFAULT_OPENCLAW_PACKAGE,
  DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGE_EXCEPTIONS,
  DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  DEFAULT_OPENCLAW_VERSION,
} from './openclaw-release.mjs';
import { assertNoUnsupportedOpenClawRuntimeLayout } from './assert-openclaw-runtime-layout.mjs';
export {
  DEFAULT_NODE_VERSION,
  DEFAULT_OPENCLAW_PACKAGE,
  DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGE_EXCEPTIONS,
  DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  DEFAULT_OPENCLAW_VERSION,
} from './openclaw-release.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const DEFAULT_DIRECTORY_CLEANUP_RETRY_COUNT = 3;
const DEFAULT_DIRECTORY_CLEANUP_RETRY_DELAY_MS = 500;
const DEFAULT_OPENCLAW_RUNTIME_OPERATION_RETRY_COUNT = 3;
const DEFAULT_OPENCLAW_RUNTIME_OPERATION_RETRY_DELAY_MS = 1000;
const PREPARED_RUNTIME_MANIFEST_KEYS = [
  'schemaVersion',
  'runtimeId',
  'openclawVersion',
  'requiredExternalRuntimes',
  'requiredExternalRuntimeVersions',
  'platform',
  'arch',
  'cliRelativePath',
];
const PREPARED_RUNTIME_SIDECAR_MANIFEST_FILENAME = '.sdkwork-openclaw-runtime.json';
const CACHED_NODE_RUNTIME_SIDECAR_MANIFEST_FILENAME = '.sdkwork-node-runtime.json';
const PREPARED_RESOURCE_RETAINED_ENTRY_NAMES = new Set(['.gitkeep']);
export const BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME = 'runtime.zip';
const REQUIRED_OPENCLAW_EXTERNAL_RUNTIMES = Object.freeze(['nodejs']);
const OPENCLAW_DISABLE_BUNDLED_PLUGIN_POSTINSTALL_ENV =
  'OPENCLAW_DISABLE_BUNDLED_PLUGIN_POSTINSTALL';
const OPENCLAW_RUNTIME_INSTALL_CACHE_DIRNAME = 'npm-cache';
const OPENCLAW_RUNTIME_INSTALL_TEMP_DIRNAME = 'tmp';
const WINDOWS_MIRROR_BASE_STATE_FILENAME = 'windows-mirror-base-dir.json';
const WINDOWS_DRIVE_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_PATTERN = /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/;

export const DEFAULT_RESOURCE_DIR = path.join(
  rootDir,
  'packages',
  'sdkwork-agentstudio-pc-desktop',
  'src-tauri',
  'resources',
  'openclaw',
);
export const DEFAULT_PREPARE_CACHE_DIR = resolveDefaultOpenClawPrepareCacheDir();

export function resolveOpenClawRuntimeSystemCommand(
  command,
  platform = process.platform,
  env = process.env,
) {
  const normalizedCommand = String(command ?? '').trim();
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  if (
    !normalizedCommand
    || normalizedPlatform !== 'win32'
    || path.extname(normalizedCommand)
    || normalizedCommand.includes('/')
    || normalizedCommand.includes('\\')
  ) {
    return normalizedCommand;
  }

  const systemRoot =
    String(env.SystemRoot ?? env.WINDIR ?? '').trim() || 'C:\\Windows';

  if (normalizedCommand === 'tar') {
    const tarPath = path.win32.join(systemRoot, 'System32', 'tar.exe');
    return existsSync(tarPath) ? tarPath : 'tar.exe';
  }

  if (normalizedCommand === 'powershell') {
    const powershellPath = path.win32.join(
      systemRoot,
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe',
    );
    return existsSync(powershellPath) ? powershellPath : 'powershell.exe';
  }

  if (normalizedCommand === 'robocopy') {
    const robocopyPath = path.win32.join(systemRoot, 'System32', 'robocopy.exe');
    return existsSync(robocopyPath) ? robocopyPath : 'robocopy.exe';
  }

  return normalizedCommand;
}

function resolveWindowsMirrorBaseDirStatePath(workspaceRootDir = rootDir) {
  return path.join(
    workspaceRootDir,
    'packages',
    'sdkwork-agentstudio-pc-desktop',
    'src-tauri',
    'generated',
    'release',
    WINDOWS_MIRROR_BASE_STATE_FILENAME,
  );
}

function isWindowsDriveAbsolutePath(value = '') {
  return WINDOWS_DRIVE_ABSOLUTE_PATH_PATTERN.test(String(value ?? '').trim());
}

function isWindowsUncPath(value = '') {
  return WINDOWS_UNC_PATH_PATTERN.test(String(value ?? '').trim());
}

export function resolveBundledResourceFsPathApi(
  candidatePath = '',
  platform = process.platform,
) {
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  if (normalizedPlatform !== 'win32') {
    return path;
  }

  const normalizedPath = String(candidatePath ?? '').trim();
  return isWindowsDriveAbsolutePath(normalizedPath) || isWindowsUncPath(normalizedPath)
    ? path.win32
    : path.posix;
}

function normalizeBundledResourceComparablePath(value, platform = 'win32') {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return '';
  }

  const pathApi = resolveBundledResourceFsPathApi(normalizedValue, platform);
  const normalizedPath = pathApi.normalize(normalizedValue);
  return pathApi === path.win32 ? normalizedPath.toLowerCase() : normalizedPath;
}

function persistedWindowsMirrorBaseDirIsValid(
  workspaceRootDir = rootDir,
  mirrorBaseDir = '',
  platform = 'win32',
) {
  const normalizedMirrorBaseDir = normalizeBundledResourceComparablePath(
    mirrorBaseDir,
    platform,
  );
  if (!normalizedMirrorBaseDir) {
    return false;
  }

  const allowedMirrorBaseDirs = new Set([
    normalizeBundledResourceComparablePath(
      resolveDefaultBundledResourceMirrorBaseDir(workspaceRootDir, platform),
      platform,
    ),
    normalizeBundledResourceComparablePath(
      resolveBundledResourceMirrorFallbackBaseDir(workspaceRootDir, platform),
      platform,
    ),
  ]);

  return allowedMirrorBaseDirs.has(normalizedMirrorBaseDir);
}

function readPersistedWindowsMirrorBaseDir(workspaceRootDir = rootDir, platform = 'win32') {
  const statePath = resolveWindowsMirrorBaseDirStatePath(workspaceRootDir);
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    const persistedMirrorBaseDir = String(state?.mirrorBaseDir ?? '').trim();
    if (!persistedWindowsMirrorBaseDirIsValid(workspaceRootDir, persistedMirrorBaseDir, platform)) {
      return '';
    }

    const pathApi = resolveBundledResourceFsPathApi(persistedMirrorBaseDir, platform);
    return persistedMirrorBaseDir ? pathApi.normalize(persistedMirrorBaseDir) : '';
  } catch {
    return '';
  }
}

function resolveDefaultBundledResourceMirrorBaseDir(
  workspaceRootDir = rootDir,
  platform = 'win32',
) {
  const pathApi = resolveBundledResourceFsPathApi(workspaceRootDir, platform);
  if (pathApi === path.win32) {
    return path.win32.join(
      path.win32.parse(workspaceRootDir).root,
      '.sdkwork-bc',
      path.win32.basename(workspaceRootDir),
    );
  }

  return pathApi.join(workspaceRootDir, '.cache', 'short-mirrors');
}

export function resolveBundledResourceMirrorBaseDir(
  workspaceRootDir = rootDir,
  env = process.env,
  platform = process.platform,
) {
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  if (normalizedPlatform !== 'win32') {
    return '';
  }

  const configuredMirrorBaseDir = env.SDKWORK_WINDOWS_MIRROR_BASE_DIR;
  if (typeof configuredMirrorBaseDir === 'string' && configuredMirrorBaseDir.trim().length > 0) {
    const pathApi = resolveBundledResourceFsPathApi(configuredMirrorBaseDir, normalizedPlatform);
    return pathApi.normalize(configuredMirrorBaseDir.trim());
  }

  const persistedMirrorBaseDir = readPersistedWindowsMirrorBaseDir(
    workspaceRootDir,
    normalizedPlatform,
  );
  if (persistedMirrorBaseDir) {
    return persistedMirrorBaseDir;
  }

  return resolveDefaultBundledResourceMirrorBaseDir(workspaceRootDir, normalizedPlatform);
}

function resolveBundledResourceMirrorFallbackBaseDir(
  workspaceRootDir = rootDir,
  platform = process.platform,
) {
  if (platform !== 'win32' && platform !== 'windows') {
    return '';
  }

  const pathApi = resolveBundledResourceFsPathApi(workspaceRootDir, platform);
  return pathApi.join(workspaceRootDir, '.cache', 'short-mirrors');
}

async function persistBundledResourceMirrorBaseDir(
  workspaceRootDir = rootDir,
  mirrorBaseDir,
  {
    env = process.env,
    platform = process.platform,
    mkdirImpl = mkdir,
    writeFileImpl = writeFile,
  } = {},
) {
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  if (normalizedPlatform !== 'win32') {
    return;
  }

  const configuredMirrorBaseDir = env.SDKWORK_WINDOWS_MIRROR_BASE_DIR;
  if (typeof configuredMirrorBaseDir === 'string' && configuredMirrorBaseDir.trim().length > 0) {
    return;
  }

  const normalizedMirrorBaseDir = String(mirrorBaseDir ?? '').trim();
  if (!normalizedMirrorBaseDir) {
    return;
  }

  const pathApi = resolveBundledResourceFsPathApi(normalizedMirrorBaseDir, normalizedPlatform);

  const statePath = resolveWindowsMirrorBaseDirStatePath(workspaceRootDir);
  await mkdirImpl(path.dirname(statePath), { recursive: true });
  await writeFileImpl(
    statePath,
    `${JSON.stringify({ mirrorBaseDir: pathApi.normalize(normalizedMirrorBaseDir) }, null, 2)}\n`,
    'utf8',
  );
}

export function resolveBundledResourceMirrorRoot(
  workspaceRootDir = rootDir,
  resourceId = 'openclaw',
  platform = process.platform,
  windowsMirrorBaseDir = resolveBundledResourceMirrorBaseDir(
    workspaceRootDir,
    process.env,
    platform,
  ),
) {
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  if (normalizedPlatform !== 'win32') {
    return path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-agentstudio-pc-desktop',
      'src-tauri',
      'resources',
      resourceId,
    );
  }

  const pathApi = resolveBundledResourceFsPathApi(windowsMirrorBaseDir, normalizedPlatform);
  return pathApi.join(windowsMirrorBaseDir, resourceId);
}

export function resolvePackagedOpenClawResourceDir(
  workspaceRootDir = rootDir,
  _platform = process.platform,
) {
  return path.join(
    workspaceRootDir,
    'packages',
    'sdkwork-agentstudio-pc-desktop',
    'src-tauri',
    'generated',
    'release',
    'openclaw-resource',
  );
}

export function resolvePackagedOpenClawInstallRootLayoutDir(
  workspaceRootDir = rootDir,
  _platform = process.platform,
) {
  return path.join(
    workspaceRootDir,
    'packages',
    'sdkwork-agentstudio-pc-desktop',
    'src-tauri',
    'generated',
    'release',
    'macos-install-root',
  );
}

export async function syncWindowsPackagedOpenClawAliasRoot({
  workspaceRootDir = rootDir,
  packagedResourceDir = resolvePackagedOpenClawResourceDir(workspaceRootDir, 'windows'),
  resourceId = 'openclaw',
  platform = process.platform,
  mkdirImpl = mkdir,
  cleanupImpl = removeDirectoryWithRetries,
  symlinkImpl = symlinkSync,
  resolvePathTargetImpl = resolveExistingPathTarget,
  repairArchiveOnlyBundledResourceRootInPlaceImpl = repairArchiveOnlyBundledResourceRootInPlace,
} = {}) {
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  if (normalizedPlatform !== 'win32') {
    return null;
  }

  const pathApi = path.win32;
  const aliasRoot = resolveBundledResourceMirrorRoot(
    workspaceRootDir,
    resourceId,
    normalizedPlatform,
  );
  const normalizedAliasRoot = pathApi.normalize(aliasRoot);
  const normalizedPackagedResourceDir = pathApi.normalize(packagedResourceDir);

  // Already pointing at the correct location — nothing to do.
  if (normalizedAliasRoot === normalizedPackagedResourceDir) {
    return aliasRoot;
  }

  const resolvedAliasTarget =
    typeof resolvePathTargetImpl === 'function' ? resolvePathTargetImpl(aliasRoot) : null;
  if (
    typeof resolvedAliasTarget === 'string'
    && pathApi.normalize(resolvedAliasTarget) === normalizedPackagedResourceDir
  ) {
    return aliasRoot;
  }

  // Read manifest for reusability checks and repair fallbacks.
  let expectedManifest = null;
  try {
    expectedManifest = JSON.parse(
      await readFile(pathApi.join(packagedResourceDir, 'manifest.json'), 'utf8'),
    );
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
      throw error;
    }
  }

  // Reuse existing mirror if it matches the expected manifest.
  if (
    expectedManifest
    && await bundledResourceArchiveMirrorIsReusable({
      mirrorRoot: aliasRoot,
      expectedManifest,
    })
  ) {
    await persistBundledResourceMirrorBaseDir(workspaceRootDir, pathApi.dirname(aliasRoot), {
      platform: normalizedPlatform,
    });
    return aliasRoot;
  }

  // Try to create or repair the alias root at the primary mirror path.
  const primaryResult = await tryCreateOrRepairAliasRoot({
    aliasRoot,
    packagedResourceDir,
    expectedManifest,
    normalizedPlatform,
    workspaceRootDir,
    pathApi,
    mkdirImpl,
    cleanupImpl,
    symlinkImpl,
    repairImpl: repairArchiveOnlyBundledResourceRootInPlaceImpl,
  });
  if (primaryResult !== null) {
    return primaryResult;
  }

  // Fallback to the secondary mirror base dir.
  const fallbackMirrorBaseDir = resolveBundledResourceMirrorFallbackBaseDir(
    workspaceRootDir,
    normalizedPlatform,
  );
  const normalizedFallbackMirrorBaseDir = pathApi.normalize(fallbackMirrorBaseDir);
  if (
    !normalizedFallbackMirrorBaseDir
    || normalizedFallbackMirrorBaseDir === pathApi.dirname(aliasRoot)
  ) {
    // No distinct fallback available — the primary error has already been thrown
    // by tryCreateOrRepairAliasRoot.
    throw new Error(
      `Failed to create Windows mirror alias at ${aliasRoot} and no fallback available`,
    );
  }

  const fallbackAliasRoot = resolveBundledResourceMirrorRoot(
    workspaceRootDir,
    resourceId,
    normalizedPlatform,
    normalizedFallbackMirrorBaseDir,
  );
  const repairedFallbackAliasRoot = await repairArchiveOnlyBundledResourceRootInPlaceImpl({
    sourceRoot: packagedResourceDir,
    mirrorRoot: fallbackAliasRoot,
    expectedManifest,
    platform: normalizedPlatform,
  });
  await persistBundledResourceMirrorBaseDir(
    workspaceRootDir,
    normalizedFallbackMirrorBaseDir,
    { platform: normalizedPlatform },
  );
  return repairedFallbackAliasRoot;
}

/**
 * Attempts to create a symlink alias at `aliasRoot` pointing to `packagedResourceDir`.
 * On cleanup failure, tries to repair in-place using the archive-only strategy.
 * Returns the alias root path on success, or null if repair is not possible.
 */
async function tryCreateOrRepairAliasRoot({
  aliasRoot,
  packagedResourceDir,
  expectedManifest,
  normalizedPlatform,
  workspaceRootDir,
  pathApi,
  mkdirImpl = mkdir,
  cleanupImpl = removeDirectoryWithRetries,
  symlinkImpl = symlinkSync,
  repairImpl = repairArchiveOnlyBundledResourceRootInPlace,
} = {}) {
  try {
    await cleanupImpl(aliasRoot);
    await mkdirImpl(pathApi.dirname(aliasRoot), { recursive: true });
    symlinkImpl(packagedResourceDir, aliasRoot, 'junction');
    if (expectedManifest) {
      await persistBundledResourceMirrorBaseDir(workspaceRootDir, pathApi.dirname(aliasRoot), {
        platform: normalizedPlatform,
      });
    }
    return aliasRoot;
  } catch (error) {
    if (!shouldRetryDirectoryCleanup(error)) {
      throw error;
    }

    if (!expectedManifest) {
      throw error;
    }

    try {
      const repairedAliasRoot = await repairImpl({
        sourceRoot: packagedResourceDir,
        mirrorRoot: aliasRoot,
        expectedManifest,
        platform: normalizedPlatform,
      });
      await persistBundledResourceMirrorBaseDir(
        workspaceRootDir,
        pathApi.dirname(repairedAliasRoot),
        { platform: normalizedPlatform },
      );
      return repairedAliasRoot;
    } catch {
      return null;
    }
  }
}

export function resolveOpenClawTarget(platform = process.platform, arch = process.arch) {
  const normalizedPlatform = String(platform ?? '').trim().toLowerCase();
  const platformId =
    normalizedPlatform === 'win32' || normalizedPlatform === 'windows'
      ? 'windows'
      : normalizedPlatform === 'darwin' || normalizedPlatform === 'macos'
        ? 'macos'
        : normalizedPlatform === 'linux'
          ? 'linux'
          : normalizedPlatform;
  const archId = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : arch;

  if (!['windows', 'macos', 'linux'].includes(platformId)) {
    throw new Error(`Unsupported platform for packaged OpenClaw runtime: ${platform}`);
  }

  if (!['x64', 'arm64'].includes(archId)) {
    throw new Error(`Unsupported architecture for packaged OpenClaw runtime: ${arch}`);
  }

  if (platformId === 'windows') {
    return {
      platformId,
      archId,
      nodeArchiveExt: 'zip',
      nodeArchiveName(version) {
        return `node-v${version}-win-${archId}.zip`;
      },
      nodeDownloadName(version) {
        return `node-v${version}-win-${archId}`;
      },
      nodeBinaryRelativePath: 'runtime/node/node.exe',
      cliRelativePath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
    };
  }

  return {
    platformId,
    archId,
    nodeArchiveExt: 'tar.xz',
    nodeArchiveName(version) {
      const platformSlug = platformId === 'macos' ? 'darwin' : 'linux';
      return `node-v${version}-${platformSlug}-${archId}.tar.xz`;
    },
    nodeDownloadName(version) {
      const platformSlug = platformId === 'macos' ? 'darwin' : 'linux';
      return `node-v${version}-${platformSlug}-${archId}`;
    },
    nodeBinaryRelativePath: 'runtime/node/bin/node',
    cliRelativePath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
  };
}

export function resolveRequestedOpenClawTarget({
  env = process.env,
} = {}) {
  const target = resolveDesktopReleaseTarget({ env });
  return resolveOpenClawTarget(target.platform, target.arch);
}

export function resolveNodeRuntimeNpmCommand(nodeRuntimeDir, platform = process.platform) {
  const normalizedPlatform =
    platform === 'win32' || platform === 'windows'
      ? 'windows'
      : platform === 'darwin' || platform === 'macos'
        ? 'macos'
        : 'linux';

  if (normalizedPlatform === 'windows') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', path.win32.join(nodeRuntimeDir, 'npm.cmd')],
    };
  }

  return {
    command: path.join(nodeRuntimeDir, 'bin', 'npm'),
    args: [],
  };
}

export function resolveDefaultOpenClawPrepareCacheDir({
  workspaceRootDir = rootDir,
  platform = process.platform,
  env = process.env,
  localAppData = process.env.LOCALAPPDATA,
  xdgCacheHome = process.env.XDG_CACHE_HOME,
  homeDir = os.homedir(),
} = {}) {
  const configuredCacheDir = String(env?.OPENCLAW_PREPARE_CACHE_DIR ?? '').trim();
  if (configuredCacheDir) {
    return path.resolve(configuredCacheDir);
  }

  if (platform === 'win32') {
    const workspaceName = sanitizePathSegment(path.win32.basename(workspaceRootDir)) || 'workspace';
    const driveRoot = path.win32.parse(workspaceRootDir).root || path.win32.parse(localAppData ?? '').root;

    if (driveRoot) {
      return path.win32.join(driveRoot, '.sdkwork-bc', workspaceName, 'openclaw-cache');
    }

    if (localAppData) {
      return path.join(localAppData, 'sdkwork-claw', 'openclaw-runtime-cache');
    }
  }

  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Caches', 'sdkwork-claw', 'openclaw-runtime-cache');
  }

  if (xdgCacheHome) {
    return path.join(xdgCacheHome, 'sdkwork-claw', 'openclaw-runtime-cache');
  }

  return path.join(homeDir, '.cache', 'sdkwork-claw', 'openclaw-runtime-cache');
}

export function resolveOpenClawPrepareCachePaths({
  cacheDir = DEFAULT_PREPARE_CACHE_DIR,
  openclawVersion,
  nodeVersion,
  target,
}) {
  const nodeCacheKey = `${target.platformId}-${target.archId}-node-v${nodeVersion}`;
  const packageCacheKey = `${target.platformId}-${target.archId}-openclaw-v${openclawVersion}`;

  return {
    cacheDir,
    cachedArchivePath: path.join(cacheDir, 'archives', target.nodeArchiveName(nodeVersion)),
    nodeCacheDir: path.join(cacheDir, 'node', nodeCacheKey),
    packageCacheDir: path.join(cacheDir, 'package', packageCacheKey),
  };
}

function normalizeOpenClawRuntimeSupplementalPackages(runtimeSupplementalPackages) {
  if (!Array.isArray(runtimeSupplementalPackages)) {
    return [];
  }

  return runtimeSupplementalPackages
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
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

export function resolveOpenClawRuntimeInstallSpecs({
  openclawInstallSpec = null,
  openclawPackage = DEFAULT_OPENCLAW_PACKAGE,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
} = {}) {
  const primaryInstallSpec =
    typeof openclawInstallSpec === 'string' && openclawInstallSpec.trim().length > 0
      ? openclawInstallSpec.trim()
      : `${openclawPackage}@${openclawVersion}`;
  const supplementalSpecs = normalizeOpenClawRuntimeSupplementalPackages(
    runtimeSupplementalPackages,
  );

  return [primaryInstallSpec, ...supplementalSpecs];
}

export function resolveOpenClawRuntimeInstallPaths({
  cacheDir = DEFAULT_PREPARE_CACHE_DIR,
  platform = process.platform,
} = {}) {
  const pathApi = platform === 'win32' || platform === 'windows' ? path.win32 : path;
  return {
    npmCacheDir: pathApi.join(cacheDir, OPENCLAW_RUNTIME_INSTALL_CACHE_DIRNAME),
    tempDir: pathApi.join(cacheDir, OPENCLAW_RUNTIME_INSTALL_TEMP_DIRNAME),
  };
}

export function buildOpenClawRuntimeInstallEnv(
  baseEnv = process.env,
  {
    cacheDir = DEFAULT_PREPARE_CACHE_DIR,
    platform = process.platform,
  } = {},
) {
  const nextEnv = {
    ...baseEnv,
    [OPENCLAW_DISABLE_BUNDLED_PLUGIN_POSTINSTALL_ENV]: '1',
  };
  const installPaths = resolveOpenClawRuntimeInstallPaths({ cacheDir, platform });
  const isWindows = platform === 'win32' || platform === 'windows';

  if (!nextEnv.npm_config_cache) {
    nextEnv.npm_config_cache = installPaths.npmCacheDir;
  }

  if (isWindows || !nextEnv.TEMP) {
    nextEnv.TEMP = installPaths.tempDir;
  }
  if (isWindows || !nextEnv.TMP) {
    nextEnv.TMP = installPaths.tempDir;
  }
  if (!nextEnv.TMPDIR) {
    nextEnv.TMPDIR = installPaths.tempDir;
  }

  return nextEnv;
}

function resolveOpenClawRuntimeSupplementalPackagePathsFromModulesRoot({
  modulesRoot,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
} = {}) {
  return normalizeOpenClawRuntimeSupplementalPackages(runtimeSupplementalPackages)
    .map((installSpec) => resolvePackageNameFromInstallSpec(installSpec))
    .filter(Boolean)
    .map((packageName) => path.join(modulesRoot, ...packageName.split('/')));
}

function resolveOpenClawRuntimeSupplementalPackagePaths({
  packageSourceDir,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
} = {}) {
  return resolveOpenClawRuntimeSupplementalPackagePathsFromModulesRoot({
    modulesRoot: path.join(packageSourceDir, 'node_modules'),
    runtimeSupplementalPackages,
  });
}

function createNestedOpenClawRuntimeInstallEnv(env = process.env) {
  const nextEnv = { ...env };
  delete nextEnv.npm_config_global;
  delete nextEnv.npm_config_location;
  delete nextEnv.npm_config_prefix;
  return nextEnv;
}

function collectPackageDependencyEntries(packageJson) {
  if (!packageJson || typeof packageJson !== 'object') {
    return {};
  }

  return {
    ...(packageJson.dependencies && typeof packageJson.dependencies === 'object'
      ? packageJson.dependencies
      : {}),
    ...(packageJson.optionalDependencies && typeof packageJson.optionalDependencies === 'object'
      ? packageJson.optionalDependencies
      : {}),
  };
}

function normalizePackageList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
}

const SUPPORTED_BUNDLED_PLUGIN_RUNTIME_HYDRATION_TARGETS = Object.freeze({
  '@whiskeysockets/baileys': Object.freeze({
    gitDependencies: Object.freeze({
      libsignal: Object.freeze({
        cloneUrl: 'https://github.com/whiskeysockets/libsignal-node.git',
        defaultCloneRef: 'master',
      }),
    }),
  }),
});

const SUPPORTED_DOWNLOADED_NATIVE_RUNTIME_ASSET_TARGETS = Object.freeze({
  '@discordjs/opus': Object.freeze({
    resolver: 'node-pre-gyp-prebuild',
  }),
  '@matrix-org/matrix-sdk-crypto-nodejs': Object.freeze({
    releaseBaseUrl: 'https://github.com/matrix-org/matrix-rust-sdk-crypto-nodejs/releases/download',
  }),
});

function isGitDependencySpec(versionSpec) {
  const normalized = String(versionSpec ?? '').trim().toLowerCase();
  return (
    normalized.startsWith('git+')
    || normalized.startsWith('git://')
    || normalized.includes('github.com/')
  );
}

function normalizeGitDependencyCloneSource(versionSpec) {
  const normalized = String(versionSpec ?? '').trim();
  if (!normalized) {
    return null;
  }

  const withoutProtocolPrefix = normalized.startsWith('git+')
    ? normalized.slice(4)
    : normalized;
  const hashIndex = withoutProtocolPrefix.indexOf('#');
  const cloneUrlBase =
    hashIndex >= 0 ? withoutProtocolPrefix.slice(0, hashIndex) : withoutProtocolPrefix;
  const requestedRef =
    hashIndex >= 0 ? withoutProtocolPrefix.slice(hashIndex + 1).trim() : '';
  const trimmedCloneUrlBase = cloneUrlBase.replace(/\/+$/u, '');
  const cloneUrl = trimmedCloneUrlBase.endsWith('.git')
    ? trimmedCloneUrlBase
    : `${trimmedCloneUrlBase}.git`;

  return {
    cloneUrl,
    requestedRef,
  };
}

function resolveNapiBinaryTargetSuffix(platform = process.platform, arch = process.arch) {
  const normalizedPlatform =
    platform === 'windows' ? 'win32' : String(platform ?? '').trim().toLowerCase();
  const normalizedArch =
    arch === 'amd64' ? 'x64' : String(arch ?? '').trim().toLowerCase();

  if (normalizedPlatform === 'win32') {
    if (normalizedArch === 'x64' || normalizedArch === 'arm64') {
      return `win32-${normalizedArch}-msvc`;
    }
    return null;
  }

  if (normalizedPlatform === 'darwin') {
    if (normalizedArch === 'x64' || normalizedArch === 'arm64') {
      return `darwin-${normalizedArch}`;
    }
    return null;
  }

  if (normalizedPlatform === 'linux') {
    if (normalizedArch === 'x64' || normalizedArch === 'arm64') {
      return `linux-${normalizedArch}-gnu`;
    }
    return null;
  }

  return null;
}

export function resolveNapiPackageBinaryInstallSpec({
  packageJson,
  platform = process.platform,
  arch = process.arch,
}) {
  const packageName = String(packageJson?.name ?? '').trim();
  const packageVersion = String(packageJson?.version ?? '').trim();
  if (!packageName || !packageVersion || !packageJson?.napi) {
    return null;
  }

  const binaryTargetSuffix = resolveNapiBinaryTargetSuffix(platform, arch);
  if (!binaryTargetSuffix) {
    return null;
  }

  return `${packageName}-${binaryTargetSuffix}@${packageVersion}`;
}

function resolveTlonSkillCompanionPackageName({
  platform = process.platform,
  arch = process.arch,
}) {
  const normalizedPlatform = normalizeRuntimeTargetPlatform(platform);
  const normalizedArch = normalizeRuntimeTargetArch(arch);
  const targetKey = `${normalizedPlatform}-${normalizedArch}`;

  switch (targetKey) {
    case 'darwin-arm64':
      return '@tloncorp/tlon-skill-darwin-arm64';
    case 'darwin-x64':
      return '@tloncorp/tlon-skill-darwin-x64';
    case 'linux-arm64':
      return '@tloncorp/tlon-skill-linux-arm64';
    case 'linux-x64':
      return '@tloncorp/tlon-skill-linux-x64';
    default:
      return null;
  }
}

export function resolveScriptCompanionPackageInstallSpec({
  packageJson,
  platform = process.platform,
  arch = process.arch,
}) {
  const packageName = String(packageJson?.name ?? '').trim();
  if (packageName !== '@tloncorp/tlon-skill') {
    return null;
  }

  const companionPackageName = resolveTlonSkillCompanionPackageName({
    platform,
    arch,
  });
  if (!companionPackageName) {
    return null;
  }

  const optionalDependencies =
    packageJson?.optionalDependencies && typeof packageJson.optionalDependencies === 'object'
      ? packageJson.optionalDependencies
      : {};
  const companionVersion = String(optionalDependencies[companionPackageName] ?? '').trim();
  if (!companionVersion) {
    return null;
  }

  return `${companionPackageName}@${companionVersion}`;
}

export function resolveRuntimePackageCompanionInstallSpecs({
  packageJson,
  platform = process.platform,
  arch = process.arch,
}) {
  const installSpecs = new Set();
  const packageName = String(packageJson?.name ?? '').trim();
  if (!SUPPORTED_DOWNLOADED_NATIVE_RUNTIME_ASSET_TARGETS[packageName]) {
    const napiInstallSpec = resolveNapiPackageBinaryInstallSpec({
      packageJson,
      platform,
      arch,
    });
    if (napiInstallSpec) {
      installSpecs.add(napiInstallSpec);
    }
  }

  const scriptCompanionInstallSpec = resolveScriptCompanionPackageInstallSpec({
    packageJson,
    platform,
    arch,
  });
  if (scriptCompanionInstallSpec) {
    installSpecs.add(scriptCompanionInstallSpec);
  }

  return [...installSpecs].toSorted((left, right) => left.localeCompare(right));
}

function normalizeRuntimeTargetPlatform(platform = process.platform) {
  const normalizedPlatform = String(platform ?? '').trim().toLowerCase();
  if (normalizedPlatform === 'windows') {
    return 'win32';
  }
  if (normalizedPlatform === 'macos') {
    return 'darwin';
  }
  return normalizedPlatform;
}

function normalizeRuntimeTargetArch(arch = process.arch) {
  const normalizedArch = String(arch ?? '').trim().toLowerCase();
  if (normalizedArch === 'amd64') {
    return 'x64';
  }
  return normalizedArch;
}

function resolveLinuxRuntimeLibc({
  platform = process.platform,
  env = process.env,
} = {}) {
  if (normalizeRuntimeTargetPlatform(platform) !== 'linux') {
    return null;
  }

  const explicitLibc = String(
    env.OPENCLAW_TARGET_LIBC
      ?? env.npm_config_target_libc
      ?? env.npm_config_libc
      ?? '',
  )
    .trim()
    .toLowerCase();
  if (explicitLibc === 'gnu' || explicitLibc === 'musl') {
    return explicitLibc;
  }

  if (process.platform !== 'linux') {
    return 'gnu';
  }

  const report = process.report?.getReport?.();
  const glibcVersionRuntime = report?.header?.glibcVersionRuntime;
  return glibcVersionRuntime ? 'gnu' : 'musl';
}

function resolveMatrixSdkCryptoNativeBinaryFileName({
  platform = process.platform,
  arch = process.arch,
  linuxLibc = resolveLinuxRuntimeLibc({ platform }),
}) {
  const normalizedPlatform = normalizeRuntimeTargetPlatform(platform);
  const normalizedArch = normalizeRuntimeTargetArch(arch);

  if (normalizedPlatform === 'win32') {
    if (normalizedArch === 'x64' || normalizedArch === 'ia32' || normalizedArch === 'arm64') {
      return `matrix-sdk-crypto.win32-${normalizedArch}-msvc.node`;
    }
    return null;
  }

  if (normalizedPlatform === 'darwin') {
    if (normalizedArch === 'x64' || normalizedArch === 'arm64') {
      return `matrix-sdk-crypto.darwin-${normalizedArch}.node`;
    }
    return null;
  }

  if (normalizedPlatform === 'linux') {
    if (normalizedArch === 'x64') {
      return `matrix-sdk-crypto.linux-x64-${linuxLibc === 'musl' ? 'musl' : 'gnu'}.node`;
    }
    if (normalizedArch === 'arm64') {
      if (linuxLibc === 'musl') {
        return null;
      }
      return 'matrix-sdk-crypto.linux-arm64-gnu.node';
    }
    if (normalizedArch === 'arm') {
      return 'matrix-sdk-crypto.linux-arm-gnueabihf.node';
    }
    if (normalizedArch === 's390x') {
      return 'matrix-sdk-crypto.linux-s390x-gnu.node';
    }
  }

  return null;
}

function resolveRuntimeNodeAbiLabel(versions = process.versions) {
  const nodeAbi = String(versions?.modules ?? '').trim();
  if (!nodeAbi) {
    return null;
  }

  return `node-v${nodeAbi}`;
}

function resolveBestSupportedNapiBuildVersion(packageJson, versions = process.versions) {
  const napiVersions = Array.isArray(packageJson?.binary?.napi_versions)
    ? packageJson.binary.napi_versions
        .map((value) => Number.parseInt(String(value ?? '').trim(), 10))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];
  if (napiVersions.length === 0) {
    return null;
  }

  const supportedNapiVersion = Number.parseInt(String(versions?.napi ?? '').trim(), 10);
  if (!Number.isInteger(supportedNapiVersion) || supportedNapiVersion <= 0) {
    return napiVersions.toSorted((left, right) => right - left)[0] ?? null;
  }

  let bestVersion = null;
  for (const napiVersion of napiVersions) {
    if (napiVersion > supportedNapiVersion) {
      continue;
    }
    if (bestVersion === null || napiVersion > bestVersion) {
      bestVersion = napiVersion;
    }
  }

  return bestVersion;
}

function resolveNodePreGypRuntimeLibcValues({
  platform = process.platform,
} = {}) {
  if (normalizeRuntimeTargetPlatform(platform) !== 'linux') {
    return {
      libc: 'unknown',
      libcVersion: 'unknown',
    };
  }

  const report = process.report?.getReport?.();
  const glibcVersionRuntime = String(report?.header?.glibcVersionRuntime ?? '').trim();
  if (glibcVersionRuntime) {
    return {
      libc: 'glibc',
      libcVersion: glibcVersionRuntime,
    };
  }

  return {
    libc: 'unknown',
    libcVersion: 'unknown',
  };
}

function applyRuntimeAssetTemplate(template, templateValues) {
  return String(template ?? '').replace(/\{([^}]+)\}/gu, (_match, key) => {
    const normalizedKey = String(key ?? '').trim();
    return String(templateValues[normalizedKey] ?? '');
  });
}

function buildDownloadedArchiveRuntimeAsset({
  packageJson,
  packageVersion,
  packageDir = null,
  binaryHost,
  binaryModuleName,
  binaryModulePath,
  binaryRemotePath,
  binaryPackageName,
  templateValues,
}) {
  const interpolatedModulePath = applyRuntimeAssetTemplate(binaryModulePath, templateValues)
    .replace(/^[.][/\\]/u, '')
    .replace(/[\\/]+$/u, '');
  if (!interpolatedModulePath) {
    return null;
  }

  const normalizedModulePath = path.normalize(interpolatedModulePath);
  const moduleFileName = `${binaryModuleName}.node`;
  const assetFileName = applyRuntimeAssetTemplate(binaryPackageName, templateValues).trim();
  if (!assetFileName) {
    return null;
  }

  const remotePath = applyRuntimeAssetTemplate(binaryRemotePath, templateValues)
    .trim()
    .replace(/^\/+/u, '')
    .replace(/\/+$/u, '');
  const downloadUrl = remotePath
    ? `${binaryHost.replace(/\/+$/u, '')}/${remotePath}/${assetFileName}`
    : `${binaryHost.replace(/\/+$/u, '')}/${assetFileName}`;
  const destinationRelativePath = path.join(normalizedModulePath, moduleFileName);
  return {
    packageName: String(packageJson?.name ?? '').trim(),
    packageVersion,
    assetFileName,
    destinationRelativePath,
    downloadUrl,
    archiveFormat: 'tar.gz',
    archiveExtractRootRelativePath: path.dirname(normalizedModulePath),
  };
}

function resolveNodePreGypDownloadedNativeRuntimeAssetFromLocalToolchain({
  packageJson,
  packageDir,
  platform = process.platform,
  arch = process.arch,
}) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  const requireFromPackage = createRequire(packageJsonPath);
  const versioning = requireFromPackage('@discordjs/node-pre-gyp/lib/util/versioning.js');
  const napi = requireFromPackage('@discordjs/node-pre-gyp/lib/util/napi.js');
  const napiBuildVersion = napi.get_best_napi_build_version(packageJson, {});
  if (!napiBuildVersion) {
    return null;
  }

  const evaluation = versioning.evaluate(
    packageJson,
    {
      module_root: packageDir,
      target_platform: normalizeRuntimeTargetPlatform(platform),
      target_arch: normalizeRuntimeTargetArch(arch),
    },
    napiBuildVersion,
  );
  const packageVersion = String(packageJson?.version ?? '').trim();
  return {
    packageName: String(packageJson?.name ?? '').trim(),
    packageVersion,
    assetFileName: String(evaluation.package_name ?? '').trim(),
    destinationRelativePath: path.relative(packageDir, evaluation.module),
    downloadUrl: String(evaluation.hosted_tarball ?? '').trim(),
    archiveFormat: 'tar.gz',
    archiveExtractRootRelativePath: path.dirname(path.relative(packageDir, evaluation.module_path)),
  };
}

function resolveNodePreGypDownloadedNativeRuntimeAssetFromPackageJson({
  packageJson,
  platform = process.platform,
  arch = process.arch,
}) {
  const packageVersion = String(packageJson?.version ?? '').trim();
  const binary = packageJson?.binary;
  const binaryHost = String(binary?.host ?? '').trim();
  const binaryModuleName = String(binary?.module_name ?? '').trim();
  const binaryModulePath = String(binary?.module_path ?? '').trim();
  const binaryRemotePath = String(binary?.remote_path ?? '').trim();
  const binaryPackageName = String(binary?.package_name ?? '').trim();
  const nodeAbi = resolveRuntimeNodeAbiLabel();
  const napiBuildVersion = resolveBestSupportedNapiBuildVersion(packageJson);
  if (
    !packageVersion
    || !binary
    || !binaryHost
    || !binaryModuleName
    || !binaryModulePath
    || !binaryPackageName
    || !nodeAbi
    || !napiBuildVersion
  ) {
    return null;
  }

  const normalizedPlatform = normalizeRuntimeTargetPlatform(platform);
  const normalizedArch = normalizeRuntimeTargetArch(arch);
  const runtimeLibcValues = resolveNodePreGypRuntimeLibcValues({ platform });
  return buildDownloadedArchiveRuntimeAsset({
    packageJson,
    packageVersion,
    binaryHost,
    binaryModuleName,
    binaryModulePath,
    binaryRemotePath,
    binaryPackageName,
    templateValues: {
      version: packageVersion,
      module_name: binaryModuleName,
      node_abi: nodeAbi,
      napi_build_version: String(napiBuildVersion),
      platform: normalizedPlatform,
      arch: normalizedArch,
      libc: runtimeLibcValues.libc,
      libc_version: runtimeLibcValues.libcVersion,
    },
  });
}

function resolveDiscordJsOpusDownloadedNativeRuntimeAsset({
  packageJson,
  packageDir = null,
  platform = process.platform,
  arch = process.arch,
}) {
  if (packageDir) {
    try {
      const resolvedFromToolchain = resolveNodePreGypDownloadedNativeRuntimeAssetFromLocalToolchain({
        packageJson,
        packageDir,
        platform,
        arch,
      });
      if (resolvedFromToolchain) {
        return resolvedFromToolchain;
      }
    } catch {
      // Fall through to the template-based resolver when the package-local toolchain is unavailable.
    }
  }

  return resolveNodePreGypDownloadedNativeRuntimeAssetFromPackageJson({
    packageJson,
    platform,
    arch,
  });
}

export function resolveDownloadedNativeRuntimeAsset({
  packageJson,
  packageDir = null,
  platform = process.platform,
  arch = process.arch,
  env = process.env,
}) {
  const packageName = String(packageJson?.name ?? '').trim();
  const packageVersion = String(packageJson?.version ?? '').trim();
  if (!packageName || !packageVersion) {
    return null;
  }

  const supportedTarget = SUPPORTED_DOWNLOADED_NATIVE_RUNTIME_ASSET_TARGETS[packageName];
  if (!supportedTarget) {
    return null;
  }

  if (packageName === '@matrix-org/matrix-sdk-crypto-nodejs') {
    const assetFileName = resolveMatrixSdkCryptoNativeBinaryFileName({
      platform,
      arch,
      linuxLibc: resolveLinuxRuntimeLibc({ platform, env }),
    });
    if (!assetFileName) {
      return null;
    }

    return {
      packageName,
      packageVersion,
      assetFileName,
      destinationRelativePath: assetFileName,
      downloadUrl: `${supportedTarget.releaseBaseUrl}/v${packageVersion}/${assetFileName}`,
    };
  }

  if (packageName === '@discordjs/opus') {
    return resolveDiscordJsOpusDownloadedNativeRuntimeAsset({
      packageJson,
      packageDir,
      platform,
      arch,
      env,
    });
  }

  return null;
}

function resolveInstallSpecVersion(installSpec) {
  const normalized = String(installSpec ?? '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('@')) {
    const versionSeparatorIndex = normalized.lastIndexOf('@');
    return versionSeparatorIndex > 0 ? normalized.slice(versionSeparatorIndex + 1).trim() : '';
  }

  const versionSeparatorIndex = normalized.indexOf('@');
  return versionSeparatorIndex >= 0 ? normalized.slice(versionSeparatorIndex + 1).trim() : '';
}

function resolveDownloadedNativeRuntimeAssetDestinationPath(packageDir, runtimeAsset) {
  const destinationRelativePath = String(runtimeAsset?.destinationRelativePath ?? '').trim();
  return destinationRelativePath ? path.join(packageDir, destinationRelativePath) : '';
}

function isOptionalOpenClawRuntimeDependency(packageName, openclawPackageJson) {
  const normalizedPackageName = String(packageName ?? '').trim();
  if (!normalizedPackageName || !openclawPackageJson || typeof openclawPackageJson !== 'object') {
    return false;
  }

  const optionalDependencies =
    openclawPackageJson.optionalDependencies
    && typeof openclawPackageJson.optionalDependencies === 'object'
      ? openclawPackageJson.optionalDependencies
      : {};
  return typeof optionalDependencies[normalizedPackageName] === 'string';
}

async function loadOpenClawRuntimePackageJson(modulesRoot) {
  const openclawPackageJsonPath = path.join(modulesRoot, 'openclaw', 'package.json');
  try {
    return JSON.parse(await readFile(openclawPackageJsonPath, 'utf8'));
  } catch {
    return null;
  }
}

function shouldSkipOptionalDownloadedNativeRuntimePackage({
  packageName,
  packageDir,
  packageJson,
  openclawPackageJson,
  platform = process.platform,
  arch = process.arch,
  env = process.env,
  pathExists = existsSync,
}) {
  if (!isOptionalOpenClawRuntimeDependency(packageName, openclawPackageJson)) {
    return false;
  }

  const runtimeAsset = resolveDownloadedNativeRuntimeAsset({
    packageJson,
    packageDir,
    platform,
    arch,
    env,
  });
  if (!runtimeAsset) {
    return false;
  }

  const destinationPath = resolveDownloadedNativeRuntimeAssetDestinationPath(
    packageDir,
    runtimeAsset,
  );
  return destinationPath ? !pathExists(destinationPath) : false;
}

async function rebuildDownloadedNativeRuntimeAssetFromSource({
  packageInstallRoot,
  runtimeAsset,
  runtimeNpm,
  installEnv = process.env,
  runCommandImpl = runCommand,
}) {
  if (
    runtimeAsset?.packageName !== '@discordjs/opus'
    || !runtimeNpm
    || typeof runtimeNpm.command !== 'string'
    || runtimeNpm.command.trim().length === 0
  ) {
    return null;
  }

  await runCommandImpl(runtimeNpm.command, [
    ...runtimeNpm.args,
    'rebuild',
    runtimeAsset.packageName,
    '--foreground-scripts',
  ], {
    cwd: packageInstallRoot,
    env: installEnv,
  });

  return {
    built: true,
    strategy: 'npm-rebuild',
  };
}

export function resolveBundledPluginRuntimeHydrationTarget({
  installSpec,
  packageJson,
}) {
  const packageName = resolvePackageNameFromInstallSpec(
    typeof installSpec === 'string' && installSpec.trim().length > 0
      ? installSpec
      : packageJson?.name,
  );
  const supportedTarget = SUPPORTED_BUNDLED_PLUGIN_RUNTIME_HYDRATION_TARGETS[packageName];
  if (!supportedTarget || !packageJson || typeof packageJson !== 'object') {
    return null;
  }

  const registryDependencyInstallSpecs = [];
  const gitDependencies = [];

  for (const [dependencyName, dependencyVersion] of Object.entries(
    collectPackageDependencyEntries(packageJson),
  )) {
    const normalizedDependencyName = String(dependencyName ?? '').trim();
    const normalizedDependencyVersion = String(dependencyVersion ?? '').trim();
    if (!normalizedDependencyName || !normalizedDependencyVersion) {
      continue;
    }

    if (!isGitDependencySpec(normalizedDependencyVersion)) {
      registryDependencyInstallSpecs.push(
        `${normalizedDependencyName}@${normalizedDependencyVersion}`,
      );
      continue;
    }

    const supportedGitDependency = supportedTarget.gitDependencies?.[normalizedDependencyName];
    const normalizedCloneSource = normalizeGitDependencyCloneSource(normalizedDependencyVersion);
    if (!supportedGitDependency || !normalizedCloneSource) {
      return null;
    }

    if (normalizedCloneSource.cloneUrl !== supportedGitDependency.cloneUrl) {
      return null;
    }

    gitDependencies.push({
      name: normalizedDependencyName,
      cloneUrl: supportedGitDependency.cloneUrl,
      cloneRef: normalizedCloneSource.requestedRef || supportedGitDependency.defaultCloneRef,
      versionSpec: normalizedDependencyVersion,
    });
  }

  if (gitDependencies.length === 0) {
    return null;
  }

  return {
    installSpec: typeof installSpec === 'string' ? installSpec.trim() : `${packageName}@${packageJson.version ?? ''}`.trim(),
    packageName,
    registryDependencyInstallSpecs: registryDependencyInstallSpecs.toSorted((left, right) =>
      left.localeCompare(right),
    ),
    gitDependencies: gitDependencies.toSorted((left, right) => left.name.localeCompare(right.name)),
  };
}

function resolveRegistryDependencyInstallSpecsFromPackageJson(packageJson) {
  return Object.entries(collectPackageDependencyEntries(packageJson))
    .filter(([, version]) => !isGitDependencySpec(version))
    .map(([name, version]) => `${name}@${version}`)
    .toSorted((left, right) => left.localeCompare(right));
}

function resolveGitDependencyEntriesFromPackageJson(packageJson) {
  return Object.entries(collectPackageDependencyEntries(packageJson))
    .filter(([, version]) => isGitDependencySpec(version))
    .map(([name, version]) => ({
      name: String(name ?? '').trim(),
      versionSpec: String(version ?? '').trim(),
    }))
    .filter((entry) => entry.name && entry.versionSpec)
    .toSorted((left, right) => left.name.localeCompare(right.name));
}

async function installPreparedRuntimePackageDependencies({
  packageDir,
  installSpecs,
  runtimeNpm,
  env,
  runCommandImpl = runCommand,
}) {
  if (!Array.isArray(installSpecs) || installSpecs.length === 0) {
    return [];
  }

  await runCommandImpl(runtimeNpm.command, [
    ...runtimeNpm.args,
    'install',
    '--omit=dev',
    '--no-save',
    '--package-lock=false',
    '--ignore-scripts',
    ...installSpecs,
  ], {
    cwd: packageDir,
    env,
  });

  return installSpecs;
}

async function withHydrationInstallPackageJson(packageDir, callback) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  let originalPackageJson;
  try {
    originalPackageJson = await readFile(packageJsonPath, 'utf8');
  } catch {
    return await callback();
  }

  const parsedPackageJson = JSON.parse(originalPackageJson);
  const sanitizedPackageJson = { ...parsedPackageJson };
  delete sanitizedPackageJson.dependencies;
  delete sanitizedPackageJson.optionalDependencies;
  await writeFile(packageJsonPath, `${JSON.stringify(sanitizedPackageJson, null, 2)}\n`, 'utf8');

  try {
    return await callback();
  } finally {
    await writeFile(packageJsonPath, originalPackageJson, 'utf8');
  }
}

async function stagePreparedRuntimeRegistryPackage({
  installSpec,
  packageInstallRoot,
  tempDir,
  runtimeNpm,
  env,
  platform = process.platform,
  runCommandImpl = runCommand,
}) {
  const packDir = await mkdtemp(path.join(tempDir, 'prepared-runtime-pack-'));
  await runCommandImpl(runtimeNpm.command, [
    ...runtimeNpm.args,
    'pack',
    installSpec,
    '--ignore-scripts',
    '--pack-destination',
    packDir,
  ], {
    cwd: packageInstallRoot,
    env,
  });

  const packedEntries = await readdir(packDir, { withFileTypes: true });
  const packedArchive = packedEntries.find((entry) => entry.isFile() && entry.name.endsWith('.tgz'));
  if (!packedArchive) {
    throw new Error(`Failed to stage prepared runtime package ${installSpec}: npm pack produced no tarball in ${packDir}`);
  }

  const extractRoot = await mkdtemp(path.join(tempDir, 'prepared-runtime-extract-'));
  await runCommandImpl(
    resolveOpenClawRuntimeSystemCommand('tar', platform, env),
    ['-xf', path.join(packDir, packedArchive.name), '-C', extractRoot],
    {
      cwd: packageInstallRoot,
      env,
    },
  );

  const extractedEntries = await readdir(extractRoot, { withFileTypes: true });
  const packageEntry =
    extractedEntries.find((entry) => entry.isDirectory() && entry.name === 'package')
    ?? extractedEntries.find((entry) => entry.isDirectory());
  if (!packageEntry) {
    throw new Error(
      `Failed to stage prepared runtime package ${installSpec}: extracted tarball did not contain a package directory in ${extractRoot}`,
    );
  }

  return path.join(extractRoot, packageEntry.name);
}

async function clonePreparedRuntimeGitDependency({
  gitDependency,
  tempDir,
  runCommandImpl = runCommand,
}) {
  const cloneRoot = await mkdtemp(path.join(tempDir, 'prepared-runtime-git-'));
  const cloneDir = path.join(cloneRoot, 'package');
  const cloneArgs = ['clone', '--depth', '1'];
  if (gitDependency.cloneRef) {
    cloneArgs.push('--branch', gitDependency.cloneRef);
  }
  cloneArgs.push(gitDependency.cloneUrl, cloneDir);
  await runCommandImpl('git', cloneArgs);
  await removeDirectoryWithRetries(path.join(cloneDir, '.git'));
  return cloneDir;
}

export async function hydrateBundledPluginRuntimeDependency({
  hydrationTarget,
  packageInstallRoot,
  runtimeNpm,
  baseEnv = process.env,
  cacheDir = DEFAULT_PREPARE_CACHE_DIR,
  platform = process.platform,
  runCommandImpl = runCommand,
  stageRegistryPackageImpl = stagePreparedRuntimeRegistryPackage,
  cloneGitDependencyImpl = clonePreparedRuntimeGitDependency,
  installPackageDependenciesImpl = installPreparedRuntimePackageDependencies,
}) {
  const requestedInstallSpec = String(hydrationTarget?.installSpec ?? '').trim();
  const requestedPackageName =
    String(hydrationTarget?.packageName ?? resolvePackageNameFromInstallSpec(requestedInstallSpec)).trim();
  if (!requestedInstallSpec || !requestedPackageName) {
    throw new Error('Bundled runtime hydration requires an installSpec and packageName');
  }

  const nestedEnv = createNestedOpenClawRuntimeInstallEnv(
    buildOpenClawRuntimeInstallEnv(baseEnv, {
      cacheDir,
      platform,
    }),
  );
  const installPaths = resolveOpenClawRuntimeInstallPaths({ cacheDir, platform });
  await mkdir(installPaths.tempDir, { recursive: true });

  const stagedPackageDir = await stageRegistryPackageImpl({
    hydrationTarget,
    installSpec: requestedInstallSpec,
    packageName: requestedPackageName,
    packageInstallRoot,
    tempDir: installPaths.tempDir,
    runtimeNpm,
    env: nestedEnv,
    platform,
    runCommandImpl,
  });
  const stagedPackageJson = JSON.parse(
    await readFile(path.join(stagedPackageDir, 'package.json'), 'utf8'),
  );
  const resolvedHydrationTarget =
    resolveBundledPluginRuntimeHydrationTarget({
      installSpec: requestedInstallSpec,
      packageJson: stagedPackageJson,
    });
  if (!resolvedHydrationTarget) {
    throw new Error(
      `Bundled runtime hydration is not supported for ${requestedInstallSpec} after staging ${requestedPackageName}`,
    );
  }

  await withHydrationInstallPackageJson(stagedPackageDir, async () => {
    await installPackageDependenciesImpl({
      packageDir: stagedPackageDir,
      installSpecs: resolvedHydrationTarget.registryDependencyInstallSpecs,
      runtimeNpm,
      env: nestedEnv,
      runCommandImpl,
    });
  });

  for (const gitDependency of resolvedHydrationTarget.gitDependencies) {
    const stagedGitDependencyDir = await cloneGitDependencyImpl({
      hydrationTarget: resolvedHydrationTarget,
      gitDependency,
      packageInstallRoot,
      tempDir: installPaths.tempDir,
      runtimeNpm,
      env: nestedEnv,
      runCommandImpl,
    });
    const stagedGitDependencyPackageJson = JSON.parse(
      await readFile(path.join(stagedGitDependencyDir, 'package.json'), 'utf8'),
    );
    const nestedGitDependencies = resolveGitDependencyEntriesFromPackageJson(
      stagedGitDependencyPackageJson,
    );
    if (nestedGitDependencies.length > 0) {
      throw new Error(
        `Bundled runtime hydration does not support nested git dependencies for ${gitDependency.name}: ${nestedGitDependencies.map((entry) => `${entry.name}@${entry.versionSpec}`).join(', ')}`,
      );
    }

    await withHydrationInstallPackageJson(stagedGitDependencyDir, async () => {
      await installPackageDependenciesImpl({
        packageDir: stagedGitDependencyDir,
        installSpecs: resolveRegistryDependencyInstallSpecsFromPackageJson(
          stagedGitDependencyPackageJson,
        ),
        runtimeNpm,
        env: nestedEnv,
        runCommandImpl,
      });
    });

    const stagedGitDependencyDestinationDir = path.join(
      stagedPackageDir,
      'node_modules',
      ...gitDependency.name.split('/'),
    );
    await removeDirectoryWithRetries(stagedGitDependencyDestinationDir);
    await mkdir(path.dirname(stagedGitDependencyDestinationDir), { recursive: true });
    await copyDirectoryContents(stagedGitDependencyDir, stagedGitDependencyDestinationDir);
  }

  const finalPackageDir = path.join(
    packageInstallRoot,
    'node_modules',
    ...resolvedHydrationTarget.packageName.split('/'),
  );
  await removeDirectoryWithRetries(finalPackageDir);
  await mkdir(path.dirname(finalPackageDir), { recursive: true });
  await copyDirectoryContents(stagedPackageDir, finalPackageDir);

  return resolvedHydrationTarget;
}

export async function resolveMissingRuntimeCompanionInstallSpecs({
  packageInstallRoot,
  installSpecs,
  platform = process.platform,
  arch = process.arch,
  pathExists = existsSync,
}) {
  const missingCompanionSpecs = new Set();

  for (const installSpec of installSpecs) {
    const packageName = resolvePackageNameFromInstallSpec(installSpec);
    if (!packageName) {
      continue;
    }

    const packageJsonPath = path.join(
      packageInstallRoot,
      'node_modules',
      ...packageName.split('/'),
      'package.json',
    );
    if (!pathExists(packageJsonPath)) {
      continue;
    }

    let packageJson;
    try {
      packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    } catch {
      continue;
    }

    for (const companionInstallSpec of resolveRuntimePackageCompanionInstallSpecs({
      packageJson,
      platform,
      arch,
    })) {
      const companionPackageName = resolvePackageNameFromInstallSpec(companionInstallSpec);
      if (!companionPackageName) {
        continue;
      }

      const companionSentinelPath = path.join(
        packageInstallRoot,
        'node_modules',
        ...companionPackageName.split('/'),
        'package.json',
      );
      if (pathExists(companionSentinelPath)) {
        continue;
      }

      missingCompanionSpecs.add(companionInstallSpec);
    }
  }

  return [...missingCompanionSpecs].toSorted((left, right) => left.localeCompare(right));
}

export async function stageDownloadedNativeRuntimeAsset({
  packageDir,
  runtimeAsset,
  fetchImpl = globalThis.fetch,
  pathExists = existsSync,
  runCommandImpl = runCommand,
  nativeBuildFallbackImpl = null,
}) {
  const downloadUrl = String(runtimeAsset?.downloadUrl ?? '').trim();
  const destinationRelativePath = String(runtimeAsset?.destinationRelativePath ?? '').trim();
  if (!downloadUrl || !destinationRelativePath) {
    throw new Error('Downloaded native runtime asset staging requires a downloadUrl and destinationRelativePath');
  }

  const destinationPath = resolveDownloadedNativeRuntimeAssetDestinationPath(packageDir, runtimeAsset);
  if (pathExists(destinationPath)) {
    return {
      downloaded: false,
      built: false,
      destinationPath,
    };
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error(
      `Downloaded native runtime asset fetch is unavailable for ${runtimeAsset.packageName ?? destinationRelativePath}`,
    );
  }

  let response;
  try {
    response = await retryOpenClawRuntimeOperation(
      async () => await fetchImpl(downloadUrl),
      {
        description: `OpenClaw native runtime asset download ${runtimeAsset.assetFileName ?? destinationRelativePath}`,
      },
    );
  } catch (error) {
    if (typeof nativeBuildFallbackImpl !== 'function') {
      throw error;
    }

    const fallbackResult = await nativeBuildFallbackImpl({
      packageDir,
      runtimeAsset,
      destinationPath,
      error,
    });
    if (!pathExists(destinationPath)) {
      throw new Error(
        `Downloaded native runtime asset fallback for ${runtimeAsset.packageName ?? destinationRelativePath} completed without materializing ${destinationRelativePath}`,
      );
    }

    return {
      downloaded: false,
      built: fallbackResult?.built !== false,
      destinationPath,
      fallbackStrategy:
        String(fallbackResult?.strategy ?? 'native-build').trim() || 'native-build',
    };
  }
  if (!response.ok || !response.body) {
    throw new Error(
      `Failed to download native runtime asset from ${downloadUrl}: ${response.status} ${response.statusText}`,
    );
  }

  if (runtimeAsset?.archiveFormat === 'tar.gz') {
    if (typeof runCommandImpl !== 'function') {
      throw new Error(
        `Downloaded native runtime asset archive extraction is unavailable for ${runtimeAsset.packageName ?? destinationRelativePath}`,
      );
    }
    if (!commandExistsSync('tar')) {
      throw new Error(
        `Downloaded native runtime asset archive extraction requires tar for ${runtimeAsset.packageName ?? destinationRelativePath}`,
      );
    }

    const archiveExtractRootRelativePath = String(
      runtimeAsset?.archiveExtractRootRelativePath ?? '',
    ).trim();
    const archiveExtractRoot = archiveExtractRootRelativePath
      ? path.join(packageDir, archiveExtractRootRelativePath)
      : packageDir;
    await mkdir(archiveExtractRoot, { recursive: true });
    const archiveTempRoot = await mkdtemp(path.join(os.tmpdir(), 'openclaw-native-runtime-asset-'));
    const archivePath = path.join(
      archiveTempRoot,
      String(runtimeAsset?.assetFileName ?? 'native-runtime-asset.tar.gz').trim() || 'native-runtime-asset.tar.gz',
    );
    try {
      await streamToFile(response.body, archivePath);
      await runCommandImpl('tar', ['-xzf', archivePath, '-C', archiveExtractRoot]);
    } finally {
      await rm(archiveTempRoot, { recursive: true, force: true });
    }

    if (!pathExists(destinationPath)) {
      throw new Error(
        `Downloaded native runtime asset archive ${runtimeAsset.assetFileName ?? archivePath} did not materialize ${destinationRelativePath}`,
      );
    }
    return {
      downloaded: true,
      built: false,
      destinationPath,
    };
  }

  await mkdir(path.dirname(destinationPath), { recursive: true });
  const tempDestinationPath = `${destinationPath}.downloading`;
  await streamToFile(response.body, tempDestinationPath);
  await rm(destinationPath, { force: true });
  await cp(tempDestinationPath, destinationPath);
  await rm(tempDestinationPath, { force: true });
  return {
    downloaded: true,
    built: false,
    destinationPath,
  };
}

async function stageKnownDownloadedNativeRuntimeAssets({
  modulesRoot,
  fetchImpl = globalThis.fetch,
  platform = process.platform,
  arch = process.arch,
  env = process.env,
  pathExists = existsSync,
  runtimeNpm = null,
  installEnv = process.env,
  runCommandImpl = runCommand,
}) {
  const stagedAssets = [];
  const packageInstallRoot = path.dirname(modulesRoot);
  const openclawPackageJson = await loadOpenClawRuntimePackageJson(modulesRoot);

  for (const packageName of Object.keys(SUPPORTED_DOWNLOADED_NATIVE_RUNTIME_ASSET_TARGETS)) {
    const packageDir = path.join(modulesRoot, ...packageName.split('/'));
    const packageJsonPath = path.join(packageDir, 'package.json');
    if (!pathExists(packageJsonPath)) {
      continue;
    }

    let packageJson;
    try {
      packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    } catch {
      continue;
    }

    const runtimeAsset = resolveDownloadedNativeRuntimeAsset({
      packageJson,
      packageDir,
      platform,
      arch,
      env,
    });
    if (!runtimeAsset) {
      continue;
    }

    const destinationPath = resolveDownloadedNativeRuntimeAssetDestinationPath(
      packageDir,
      runtimeAsset,
    );

    try {
      stagedAssets.push(
        await stageDownloadedNativeRuntimeAsset({
          packageDir,
          runtimeAsset,
          fetchImpl,
          pathExists,
          runCommandImpl,
          nativeBuildFallbackImpl: async ({ error }) =>
            await rebuildDownloadedNativeRuntimeAssetFromSource({
              packageInstallRoot,
              runtimeAsset,
              runtimeNpm,
              installEnv,
              runCommandImpl,
              error,
            }),
        }),
      );
    } catch (error) {
      if (
        shouldSkipOptionalDownloadedNativeRuntimePackage({
          packageName,
          packageDir,
          packageJson,
          openclawPackageJson,
          platform,
          arch,
          env,
          pathExists,
        })
      ) {
        stagedAssets.push({
          packageName,
          downloaded: false,
          built: false,
          skipped: true,
          destinationPath,
          reason: 'optional-native-runtime-asset-unavailable',
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      throw error;
    }
  }

  return stagedAssets;
}

function createRuntimeDependencyDescriptor({
  name,
  version,
  pluginId,
}) {
  return {
    name,
    version,
    pluginIds: pluginId ? [pluginId] : [],
    sentinelPath: path.join('node_modules', ...name.split('/'), 'package.json'),
  };
}

function normalizeBundledPluginRuntimeDeps(runtimeDeps) {
  if (!Array.isArray(runtimeDeps)) {
    return [];
  }

  return runtimeDeps
    .map((entry) => {
      const name = String(entry?.name ?? '').trim();
      if (!name) {
        return null;
      }

      const pluginIds = Array.isArray(entry?.pluginIds)
        ? entry.pluginIds.map((pluginId) => String(pluginId ?? '').trim()).filter(Boolean)
        : [];
      const sentinelPath =
        typeof entry?.sentinelPath === 'string' && entry.sentinelPath.trim().length > 0
          ? entry.sentinelPath.trim()
          : path.join('node_modules', ...name.split('/'), 'package.json');

      return {
        name,
        version: String(entry?.version ?? '').trim(),
        pluginIds,
        sentinelPath,
      };
    })
    .filter(Boolean)
    .toSorted((left, right) => left.name.localeCompare(right.name));
}

function normalizeOpenClawChannelId(value) {
  return String(value ?? '').trim();
}

function resolveOpenClawChannelIdFromExtensionPackageJson(packageJson) {
  return normalizeOpenClawChannelId(packageJson?.openclaw?.channel?.id);
}

function resolveOpenClawChannelIdFromPluginManifest(pluginManifest) {
  if (Array.isArray(pluginManifest?.channels)) {
    const channelId = pluginManifest.channels
      .map((value) => normalizeOpenClawChannelId(value))
      .find(Boolean);
    if (channelId) {
      return channelId;
    }
  }

  if (pluginManifest?.channelConfigs && typeof pluginManifest.channelConfigs === 'object') {
    const channelId = Object.keys(pluginManifest.channelConfigs)
      .map((value) => normalizeOpenClawChannelId(value))
      .find(Boolean);
    if (channelId) {
      return channelId;
    }
  }

  return '';
}

async function resolveOpenClawChannelIdFromExtensionPackageDir(extensionPackageDir) {
  const packageJson = await readJsonFileIfExists(path.join(extensionPackageDir, 'package.json'));
  const packageJsonChannelId = resolveOpenClawChannelIdFromExtensionPackageJson(packageJson);
  if (packageJsonChannelId) {
    return packageJsonChannelId;
  }

  const pluginManifest = await readJsonFileIfExists(
    path.join(extensionPackageDir, 'openclaw.plugin.json'),
  );
  return resolveOpenClawChannelIdFromPluginManifest(pluginManifest);
}

async function readJsonFileIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function copyOpenClawSupplementalChannelExtensions({
  packageInstallRoot,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
} = {}) {
  const modulesRoot = path.join(packageInstallRoot, 'node_modules');
  const openclawExtensionsDir = path.join(
    modulesRoot,
    'openclaw',
    'dist',
    'extensions',
  );
  const copiedChannelIds = [];

  for (const supplementalPackagePath of resolveOpenClawRuntimeSupplementalPackagePathsFromModulesRoot({
    modulesRoot,
    runtimeSupplementalPackages,
  })) {
    const channelId = await resolveOpenClawChannelIdFromExtensionPackageDir(supplementalPackagePath);
    if (!channelId) {
      continue;
    }

    const targetExtensionDir = path.join(openclawExtensionsDir, channelId);
    await removeDirectoryWithRetries(targetExtensionDir);
    await mkdir(path.dirname(targetExtensionDir), { recursive: true });
    await copyDirectoryWithWindowsFallback(supplementalPackagePath, targetExtensionDir);
    await removeDirectoryWithRetries(path.join(targetExtensionDir, 'node_modules'));
    copiedChannelIds.push(channelId);
  }

  return copiedChannelIds.toSorted((left, right) => left.localeCompare(right));
}

async function scanBundledPluginRuntimeDepsFromExtensionPackages(packageRoot) {
  const extensionsDir = path.join(packageRoot, 'dist', 'extensions');
  let extensionEntries = [];

  try {
    extensionEntries = await readdir(extensionsDir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const runtimeDeps = new Map();

  for (const entry of extensionEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const pluginId = entry.name;
    const packageJsonPath = path.join(extensionsDir, pluginId, 'package.json');
    let packageJson;
    try {
      packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    } catch {
      continue;
    }

    if (!resolveOpenClawChannelIdFromExtensionPackageJson(packageJson)) {
      const pluginManifest = await readJsonFileIfExists(
        path.join(extensionsDir, pluginId, 'openclaw.plugin.json'),
      );
      const channelId = resolveOpenClawChannelIdFromPluginManifest(pluginManifest);
      if (channelId) {
        packageJson = {
          ...packageJson,
          openclaw: {
            ...(packageJson.openclaw && typeof packageJson.openclaw === 'object'
              ? packageJson.openclaw
              : {}),
            channel: {
              id: channelId,
            },
          },
        };
      }
    }

    for (const [name, version] of Object.entries(collectPackageDependencyEntries(packageJson))) {
      const normalizedName = String(name ?? '').trim();
      const normalizedVersion = String(version ?? '').trim();
      if (!normalizedName || !normalizedVersion) {
        continue;
      }

      const existing = runtimeDeps.get(normalizedName);
      if (existing) {
        if (!existing.pluginIds.includes(pluginId)) {
          existing.pluginIds.push(pluginId);
          existing.pluginIds.sort((left, right) => left.localeCompare(right));
        }
        continue;
      }

      runtimeDeps.set(
        normalizedName,
        createRuntimeDependencyDescriptor({
          name: normalizedName,
          version: normalizedVersion,
          pluginId,
        }),
      );
    }
  }

  return [...runtimeDeps.values()].toSorted((left, right) => left.name.localeCompare(right.name));
}

async function loadBundledPluginRuntimeDeps(packageRoot) {
  const postinstallScriptPath = path.join(packageRoot, 'scripts', 'postinstall-bundled-plugins.mjs');
  if (existsSync(postinstallScriptPath)) {
    try {
      const module = await import(`${pathToFileURL(postinstallScriptPath).href}?runtimeValidation=1`);
      if (typeof module.discoverBundledPluginRuntimeDeps === 'function') {
        return normalizeBundledPluginRuntimeDeps(
          module.discoverBundledPluginRuntimeDeps({
            extensionsDir: path.join(packageRoot, 'dist', 'extensions'),
            existsSync,
          }),
        );
      }
    } catch {
      // Fall back to scanning dist/extensions package.json files directly.
    }
  }

  return await scanBundledPluginRuntimeDepsFromExtensionPackages(packageRoot);
}

export async function resolveMissingBundledPluginRuntimeInstallSpecs({
  packageRoot,
  packageInstallRoot = packageRoot,
  pathExists = existsSync,
}) {
  const runtimeDeps = await loadBundledPluginRuntimeDeps(packageRoot);
  return runtimeDeps
    .filter((runtimeDep) => !pathExists(path.join(packageInstallRoot, runtimeDep.sentinelPath)))
    .map((runtimeDep) => `${runtimeDep.name}@${runtimeDep.version}`);
}

export async function installMissingBundledPluginRuntimeDeps({
  packageRoot,
  packageInstallRoot = packageRoot,
  runtimeNpm,
  baseEnv = process.env,
  cacheDir = DEFAULT_PREPARE_CACHE_DIR,
  platform = process.platform,
  arch = process.arch,
  runCommandImpl = runCommand,
}) {
  const missingSpecs = await resolveMissingBundledPluginRuntimeInstallSpecs({
    packageRoot,
    packageInstallRoot,
  });
  if (missingSpecs.length === 0) {
    return [];
  }

  const nestedEnv = createNestedOpenClawRuntimeInstallEnv(
    buildOpenClawRuntimeInstallEnv(baseEnv, {
      cacheDir,
      platform,
    }),
  );
  const directInstallSpecs = [];
  const hydratedInstallSpecs = [];

  for (const missingSpec of missingSpecs) {
    const missingPackageName = resolvePackageNameFromInstallSpec(missingSpec);
    if (SUPPORTED_BUNDLED_PLUGIN_RUNTIME_HYDRATION_TARGETS[missingPackageName]) {
      hydratedInstallSpecs.push(missingSpec);
      continue;
    }

    directInstallSpecs.push(missingSpec);
  }

  await installPreparedRuntimePackageDependencies({
    packageDir: packageInstallRoot,
    installSpecs: directInstallSpecs,
    runtimeNpm,
    env: nestedEnv,
    runCommandImpl,
  });
  const nativeCompanionInstallSpecs = await resolveMissingRuntimeCompanionInstallSpecs({
    packageInstallRoot,
    installSpecs: directInstallSpecs,
    platform,
    arch,
  });
  await installPreparedRuntimePackageDependencies({
    packageDir: packageInstallRoot,
    installSpecs: nativeCompanionInstallSpecs,
    runtimeNpm,
    env: nestedEnv,
    runCommandImpl,
  });

  for (const hydratedInstallSpec of hydratedInstallSpecs) {
    await hydrateBundledPluginRuntimeDependency({
      hydrationTarget: {
        installSpec: hydratedInstallSpec,
        packageName: resolvePackageNameFromInstallSpec(hydratedInstallSpec),
      },
      packageInstallRoot,
      runtimeNpm,
      baseEnv,
      cacheDir,
      platform,
      arch,
      runCommandImpl,
    });
  }

  return missingSpecs;
}

async function validatePreparedOpenClawPackageVersionAtPath({
  packageJsonPath,
  expectedOpenClawVersion = null,
}) {
  const packageVersion = await readPreparedOpenClawPackageVersion(packageJsonPath);

  if (expectedOpenClawVersion && packageVersion !== expectedOpenClawVersion) {
    throw new Error(
      `Prepared OpenClaw package.json version mismatch: expected ${expectedOpenClawVersion}, found ${packageVersion}`,
    );
  }

  return packageVersion;
}

async function validatePreparedBundledPluginRuntimeDependencies({
  packageRoot,
  packageInstallRoot,
}) {
  const runtimeDeps = await loadBundledPluginRuntimeDeps(packageRoot);

  for (const runtimeDep of runtimeDeps) {
    const sentinelPath = path.join(packageInstallRoot, runtimeDep.sentinelPath);
    try {
      await stat(sentinelPath);
    } catch (error) {
      const pluginLabel =
        runtimeDep.pluginIds.length > 0 ? runtimeDep.pluginIds.join(', ') : 'unknown-plugin';
      throw new Error(
        `Prepared OpenClaw runtime is missing bundled-plugin-runtime-dependency ${runtimeDep.name} for ${pluginLabel} at ${sentinelPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function resolvePreparedRuntimeDependencySentinelPath({
  modulesRoot,
  packageName,
}) {
  return path.join(modulesRoot, ...packageName.split('/'), 'package.json');
}

function resolvePreparedRuntimePackageDir({
  modulesRoot,
  packageName,
}) {
  return path.join(modulesRoot, ...packageName.split('/'));
}

function collectPreparedRuntimeSmokeLoadPackageNames({
  modulesRoot,
  openclawPackageJson,
  bundledPluginRuntimeDeps,
}) {
  const rootDependencies = collectPackageDependencyEntries(openclawPackageJson);
  const preparedRuntimeDependencyNames = new Set(
    bundledPluginRuntimeDeps.map((runtimeDep) => runtimeDep.name),
  );
  const candidateNames = new Set([
    ...normalizePackageList(openclawPackageJson?.pnpm?.onlyBuiltDependencies),
    ...normalizePackageList(openclawPackageJson?.pnpm?.ignoredBuiltDependencies),
  ]);
  const smokeLoadPackageNames = [];

  for (const packageName of candidateNames) {
    if (
      rootDependencies[packageName]
      || preparedRuntimeDependencyNames.has(packageName)
      || existsSync(resolvePreparedRuntimeDependencySentinelPath({ modulesRoot, packageName }))
    ) {
      smokeLoadPackageNames.push(packageName);
    }
  }

  return smokeLoadPackageNames.toSorted((left, right) => left.localeCompare(right));
}

function packageHasImportableEntry({
  packageDir,
  packageJson,
  pathExists = existsSync,
}) {
  const mainEntry = String(packageJson?.main ?? '').trim();
  if (mainEntry) {
    return true;
  }

  const exportsField = packageJson?.exports;
  if (
    typeof exportsField === 'string'
    || Array.isArray(exportsField)
    || (exportsField && typeof exportsField === 'object')
  ) {
    return true;
  }

  return [
    'index.js',
    'index.mjs',
    'index.cjs',
    'index.node',
  ].some((candidatePath) => pathExists(path.join(packageDir, candidatePath)));
}

async function shouldSkipPreparedRuntimeSmokeLoadPackage({
  modulesRoot,
  packageName,
  openclawPackageJson = null,
  platform = process.platform,
  arch = process.arch,
  env = process.env,
  pathExists = existsSync,
}) {
  const packageDir = resolvePreparedRuntimePackageDir({
    modulesRoot,
    packageName,
  });
  const packageJsonPath = path.join(packageDir, 'package.json');
  if (!pathExists(packageJsonPath)) {
    return false;
  }

  let packageJson;
  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  } catch {
    return false;
  }

  if (
    shouldSkipOptionalDownloadedNativeRuntimePackage({
      packageName,
      packageDir,
      packageJson,
      openclawPackageJson,
      platform,
      arch,
      env,
      pathExists,
    })
  ) {
    return true;
  }

  return !packageHasImportableEntry({
    packageDir,
    packageJson,
    pathExists,
  });
}

async function importPreparedRuntimeModule(
  requireFromPackage,
  packageName,
  {
    modulesRoot,
    openclawPackageJson,
    platform = process.platform,
    arch = process.arch,
    env = process.env,
  },
) {
  let resolvedEntry;
  try {
    resolvedEntry = requireFromPackage.resolve(packageName);
  } catch (error) {
    if (
      error
      && typeof error === 'object'
      && error.code === 'MODULE_NOT_FOUND'
      && await shouldSkipPreparedRuntimeSmokeLoadPackage({
        modulesRoot,
        packageName,
        openclawPackageJson,
        platform,
        arch,
        env,
      })
    ) {
      return;
    }
    throw error;
  }

  try {
    requireFromPackage(packageName);
  } catch (error) {
    if (
      await shouldSkipPreparedRuntimeSmokeLoadPackage({
        modulesRoot,
        packageName,
        openclawPackageJson,
        platform,
        arch,
        env,
      })
    ) {
      return;
    }
    if (error && typeof error === 'object' && error.code === 'ERR_REQUIRE_ESM') {
      await import(pathToFileURL(resolvedEntry).href);
      return;
    }
    throw error;
  }
}

async function validatePreparedRuntimeSmokeLoads({
  packageRoot,
  modulesRoot,
}) {
  const openclawPackageJsonPath = path.join(packageRoot, 'package.json');
  const openclawPackageJson = JSON.parse(
    await readFile(openclawPackageJsonPath, 'utf8'),
  );
  const bundledPluginRuntimeDeps = await loadBundledPluginRuntimeDeps(packageRoot);
  const requireFromPackage = createRequire(openclawPackageJsonPath);

  for (const packageName of collectPreparedRuntimeSmokeLoadPackageNames({
    modulesRoot,
    openclawPackageJson,
    bundledPluginRuntimeDeps,
  })) {
    try {
      await importPreparedRuntimeModule(requireFromPackage, packageName, {
        modulesRoot,
        openclawPackageJson,
      });
    } catch (error) {
      throw new Error(
        `Prepared OpenClaw runtime smoke load failed for ${packageName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export async function validatePreparedOpenClawPackageTree({
  packageRoot,
  packageInstallRoot = packageRoot,
  modulesRoot = path.join(packageInstallRoot, 'node_modules'),
  expectedOpenClawVersion = null,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
}) {
  for (const supplementalPackagePath of resolveOpenClawRuntimeSupplementalPackagePathsFromModulesRoot({
    modulesRoot,
    runtimeSupplementalPackages,
  })) {
    try {
      await stat(supplementalPackagePath);
    } catch (error) {
      throw new Error(
        `Prepared OpenClaw runtime is missing ${supplementalPackagePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await validatePreparedOpenClawPackageVersionAtPath({
    packageJsonPath: path.join(packageRoot, 'package.json'),
    expectedOpenClawVersion,
  });
  await validatePreparedBundledPluginRuntimeDependencies({
    packageRoot,
    packageInstallRoot,
  });
  await validatePreparedRuntimeSmokeLoads({
    packageRoot,
    modulesRoot,
  });
}

export function buildOpenClawManifest({
  openclawVersion,
  nodeVersion,
  target,
  cliRelativePath = target.cliRelativePath,
}) {
  const manifest = {
    schemaVersion: 2,
    runtimeId: 'openclaw',
    openclawVersion,
    requiredExternalRuntimes: [...REQUIRED_OPENCLAW_EXTERNAL_RUNTIMES],
    requiredExternalRuntimeVersions: {
      nodejs: String(nodeVersion ?? '').trim(),
    },
    platform: target.platformId,
    arch: target.archId,
    cliRelativePath,
  };

  return manifest;
}

function normalizePreparedRuntimeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .toSorted((left, right) => left.localeCompare(right))
    : [];
}

function normalizePreparedRuntimeVersionMap(values) {
  if (!values || typeof values !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values)
      .map(([runtimeId, version]) => [String(runtimeId ?? '').trim(), String(version ?? '').trim()])
      .filter(([runtimeId, version]) => runtimeId.length > 0 && version.length > 0)
      .toSorted(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizePreparedOpenClawManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return null;
  }

  return {
    schemaVersion: Number(manifest.schemaVersion ?? 0),
    runtimeId: String(manifest.runtimeId ?? '').trim(),
    openclawVersion: String(manifest.openclawVersion ?? '').trim(),
    requiredExternalRuntimes: normalizePreparedRuntimeStringArray(
      manifest.requiredExternalRuntimes,
    ),
    requiredExternalRuntimeVersions: normalizePreparedRuntimeVersionMap(
      manifest.requiredExternalRuntimeVersions,
    ),
    platform: String(manifest.platform ?? '').trim(),
    arch: String(manifest.arch ?? '').trim(),
    cliRelativePath: String(manifest.cliRelativePath ?? '').trim(),
  };
}

export function preparedOpenClawManifestMatches(existingManifest, expectedManifest) {
  const normalizedExistingManifest = normalizePreparedOpenClawManifest(existingManifest);
  const normalizedExpectedManifest = normalizePreparedOpenClawManifest(expectedManifest);
  if (!normalizedExistingManifest || !normalizedExpectedManifest) {
    return false;
  }

  return PREPARED_RUNTIME_MANIFEST_KEYS.every(
    (key) => JSON.stringify(normalizedExistingManifest[key]) === JSON.stringify(normalizedExpectedManifest[key]),
  );
}

function preparedRuntimeSidecarManifestHasIntegrity(sidecarManifest) {
  return Boolean(
    sidecarManifest
    && typeof sidecarManifest === 'object'
    && sidecarManifest.runtimeIntegrity
    && typeof sidecarManifest.runtimeIntegrity === 'object'
    && sidecarManifest.runtimeIntegrity.schemaVersion === 1
    && Array.isArray(sidecarManifest.runtimeIntegrity.files)
    && sidecarManifest.runtimeIntegrity.files.length > 0,
  );
}

function preparedRuntimeSidecarManifestMatches(sidecarManifest, expectedManifest) {
  return (
    preparedOpenClawManifestMatches(sidecarManifest, expectedManifest)
    && preparedRuntimeSidecarManifestHasIntegrity(sidecarManifest)
  );
}

export async function inspectPreparedOpenClawRuntime({
  resourceDir = DEFAULT_RESOURCE_DIR,
  manifest,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
} = {}) {
  const manifestPath = path.join(resourceDir, 'manifest.json');

  let existingManifest;
  try {
    existingManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    return {
      reusable: false,
      reason: 'manifest-unreadable',
      manifestPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (manifest && !preparedOpenClawManifestMatches(existingManifest, manifest)) {
    return {
      reusable: false,
      reason: 'manifest-mismatch',
      manifestPath,
      existingManifest,
    };
  }

  try {
    await validatePreparedRuntimeSource(path.join(resourceDir, 'runtime'), manifest ?? existingManifest, {
      runtimeSupplementalPackages,
    });
  } catch (error) {
    return {
      reusable: false,
      reason: 'runtime-invalid',
      manifestPath,
      existingManifest,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const resolvedManifest = manifest ?? existingManifest;
  const runtimeDir = path.join(resourceDir, 'runtime');
  try {
    const preparedSidecarManifest = await readPreparedRuntimeSidecarManifest(runtimeDir);
    if (!preparedRuntimeSidecarManifestMatches(preparedSidecarManifest, resolvedManifest)) {
      return {
        reusable: false,
        reason: 'sidecar-mismatch',
        manifestPath,
        manifest: existingManifest,
        sidecarManifest: preparedSidecarManifest,
      };
    }
  } catch (error) {
    return {
      reusable: false,
      reason: 'sidecar-unreadable',
      manifestPath,
      manifest: existingManifest,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    reusable: true,
    reason: 'ready',
    manifestPath,
    manifest: existingManifest,
  };
}

export function shouldReusePreparedOpenClawRuntime({
  inspection,
  forcePrepare = false,
}) {
  return !forcePrepare && Boolean(inspection?.reusable);
}

function parseBooleanFlag(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

const OPENCLAW_AGENT_PATH_MATERIALIZATION_SENTINEL =
  'function materializeConfigAgentPaths(config, previousConfig)';

const OPENCLAW_AGENT_DIR_SHAPE_GUARD_SENTINEL = 'hasCanonicalAgentDirShape';

const OPENCLAW_AGENT_PATH_MATERIALIZATION_HELPERS = `function cloneConfigForAgentPaths(config) {
\treturn structuredClone(config);
}
function listAgentEntriesForPathMaterialization(config) {
\tconst list = config.agents?.list;
\treturn Array.isArray(list) ? list.filter((entry) => Boolean(entry) && typeof entry === "object") : [];
}
function collectAgentIdsForPathMaterialization(config) {
\tconst ids = new Set();
\tif (!config) return ids;
\tfor (const entry of listAgentEntriesForPathMaterialization(config)) ids.add(normalizeAgentId(readOptionalAgentPathString(entry.id)));
\treturn ids;
}
function readOptionalAgentPathString(value) {
\tif (typeof value === "string") return value;
\tif (typeof value === "number" || typeof value === "boolean") return String(value);
\treturn void 0;
}
function readTrimmedAgentPathString(value) {
\treturn readOptionalAgentPathString(value)?.trim() ?? "";
}
function normalizeAgentPathForComparison(value) {
\tconst normalized = path.normalize(path.resolve(value)).replace(/[\\\\/]+/g, "/");
\treturn process.platform === "win32" || process.platform === "darwin" ? normalized.toLowerCase() : normalized;
}
function splitAgentPathSegments(value) {
\treturn path.normalize(path.resolve(value)).split(/[\\\\/]+/).filter(Boolean).map((part) => part.toLowerCase());
}
function agentPathEquals(left, right) {
\treturn normalizeAgentPathForComparison(left) === normalizeAgentPathForComparison(right);
}
function agentPathEndsWithSegments(value, expectedSegments) {
\tconst segments = splitAgentPathSegments(value);
\tconst expected = expectedSegments.map((segment) => segment.toLowerCase());
\tif (segments.length < expected.length) return false;
\treturn expected.every((segment, index) => segments[segments.length - expected.length + index] === segment);
}
function isAgentPathWithin(parent, child) {
\tconst relative = path.relative(path.resolve(parent), path.resolve(child));
\treturn Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}
function isAbsoluteOrHomeAgentPath(value) {
\treturn path.isAbsolute(value) || path.win32.isAbsolute(value) || value.startsWith("~") || value.startsWith("$HOME") || value.startsWith("$" + "{HOME}") || value.startsWith("%USERPROFILE%");
}
function resolveAgentPathForInspection(rawPath) {
\ttry {
\t\treturn resolveUserPath(rawPath);
\t} catch {
\t\treturn path.resolve(rawPath);
\t}
}
function cloneWithAgentPathRemoved(params) {
\tconst next = cloneConfigForAgentPaths(params.config);
\tconst entry = next.agents?.list?.[params.agentIndex];
\tif (entry && typeof entry === "object") {
\t\tentry.id = params.agentId;
\t\tdelete entry[params.remove];
\t}
\treturn next;
}
function resolveCanonicalWorkspaceForConfigWrite(params) {
\treturn resolveAgentWorkspaceDir(cloneWithAgentPathRemoved({
\t\tconfig: params.config,
\t\tagentIndex: params.agentIndex,
\t\tagentId: params.agentId,
\t\tremove: "workspace"
\t}), params.agentId);
}
function resolveCanonicalAgentDirForConfigWrite(params) {
\treturn resolveAgentDir(cloneWithAgentPathRemoved({
\t\tconfig: params.config,
\t\tagentIndex: params.agentIndex,
\t\tagentId: params.agentId,
\t\tremove: "agentDir"
\t}), params.agentId);
}
function chooseWorkspacePathForConfigWrite(params) {
\tconst rawPath = params.rawPath.trim();
\tif (!rawPath) return {
\t\tvalue: params.canonicalPath,
\t\treplaced: true
\t};
\tconst resolved = resolveAgentPathForInspection(rawPath);
\tconst stateDir = resolveStateDir(process.env);
\tconst shouldReplace = !isAbsoluteOrHomeAgentPath(rawPath) || agentPathEndsWithSegments(resolved, [
\t\t"agents",
\t\tparams.agentId
\t]) || agentPathEndsWithSegments(resolved, [
\t\t"agents",
\t\tparams.agentId,
\t\t"agent"
\t]) || agentPathEndsWithSegments(resolved, [
\t\t"workspace",
\t\tparams.agentId
\t]) || isAgentPathWithin(path.dirname(params.canonicalAgentDir), resolved) || params.isNewAgent && isAgentPathWithin(stateDir, resolved) && !agentPathEquals(resolved, params.canonicalPath);
\treturn shouldReplace ? {
\t\tvalue: params.canonicalPath,
\t\treplaced: true
\t} : {
\t\tvalue: rawPath,
\t\treplaced: false
\t};
}
function chooseAgentDirPathForConfigWrite(params) {
\tconst rawPath = params.rawPath.trim();
\tif (!rawPath) return {
\t\tvalue: params.canonicalPath,
\t\treplaced: true
\t};
\tconst resolved = resolveAgentPathForInspection(rawPath);
\tconst stateDir = resolveStateDir(process.env);
\tconst hasCanonicalAgentDirShape = agentPathEndsWithSegments(resolved, [
\t\t"agents",
\t\tparams.agentId,
\t\t"agent"
\t]);
\tconst shouldReplace = !isAbsoluteOrHomeAgentPath(rawPath) || agentPathEndsWithSegments(resolved, [
\t\t"agents",
\t\tparams.agentId
\t]) || isAgentPathWithin(params.workspaceDir, resolved) || isAgentPathWithin(stateDir, resolved) && !hasCanonicalAgentDirShape || params.isNewAgent && isAgentPathWithin(stateDir, resolved) && !agentPathEquals(resolved, params.canonicalPath);
\treturn shouldReplace ? {
\t\tvalue: params.canonicalPath,
\t\treplaced: true
\t} : {
\t\tvalue: rawPath,
\t\treplaced: false
\t};
}
function pushMaterializedAgentPath(agents, next) {
\tconst duplicate = agents.find((agent) => agent.agentId === next.agentId);
\tif (duplicate) {
\t\tduplicate.workspaceDir = next.workspaceDir;
\t\tduplicate.agentDir = next.agentDir;
\t\treturn;
\t}
\tagents.push(next);
}
function materializeConfigAgentPaths(config, previousConfig) {
\tif (!Array.isArray(config.agents?.list)) return {
\t\tconfig,
\t\tmaterializedAgents: []
\t};
\tconst nextConfig = cloneConfigForAgentPaths(config);
\tconst previousAgentIds = collectAgentIdsForPathMaterialization(previousConfig);
\tconst materializedAgents = [];
\tconst nextList = nextConfig.agents?.list;
\tif (!Array.isArray(nextList)) return {
\t\tconfig: nextConfig,
\t\tmaterializedAgents
\t};
\tnextList.forEach((entry, index) => {
\t\tif (!entry || typeof entry !== "object") return;
\t\tconst agentId = normalizeAgentId(readOptionalAgentPathString(entry.id));
\t\tconst isNewAgent = !previousAgentIds.has(agentId);
\t\tif (entry.id !== agentId) entry.id = agentId;
\t\tconst canonicalWorkspace = resolveCanonicalWorkspaceForConfigWrite({
\t\t\tconfig: nextConfig,
\t\t\tagentIndex: index,
\t\t\tagentId
\t\t});
\t\tconst canonicalAgentDir = resolveCanonicalAgentDirForConfigWrite({
\t\t\tconfig: nextConfig,
\t\t\tagentIndex: index,
\t\t\tagentId
\t\t});
\t\tconst workspace = chooseWorkspacePathForConfigWrite({
\t\t\trawPath: readTrimmedAgentPathString(entry.workspace),
\t\t\tcanonicalPath: canonicalWorkspace,
\t\t\tcanonicalAgentDir,
\t\t\tagentId,
\t\t\tisNewAgent
\t\t});
\t\tentry.workspace = workspace.value;
\t\tconst agentDir = chooseAgentDirPathForConfigWrite({
\t\t\trawPath: readTrimmedAgentPathString(entry.agentDir),
\t\t\tcanonicalPath: canonicalAgentDir,
\t\t\tworkspaceDir: resolveAgentPathForInspection(workspace.value),
\t\t\tagentId,
\t\t\tisNewAgent
\t\t});
\t\tentry.agentDir = agentDir.value;
\t\tif (isNewAgent || workspace.replaced || agentDir.replaced) pushMaterializedAgentPath(materializedAgents, {
\t\t\tagentId,
\t\t\tworkspaceDir: resolveAgentPathForInspection(entry.workspace),
\t\t\tagentDir: resolveAgentPathForInspection(entry.agentDir)
\t\t});
\t});
\treturn {
\t\tconfig: nextConfig,
\t\tmaterializedAgents
\t};
}
async function ensureConfigAgentDirectories(params) {
\tconst skipBootstrap = Boolean(params.config.agents?.defaults?.skipBootstrap);
\tconst seen = new Set();
\tfor (const agent of params.materializedAgents) {
\t\tif (seen.has(agent.agentId)) continue;
\t\tseen.add(agent.agentId);
\t\tawait ensureAgentWorkspace({
\t\t\tdir: agent.workspaceDir,
\t\t\tensureBootstrapFiles: !skipBootstrap
\t\t});
\t\tawait fs$1.mkdir(agent.agentDir, { recursive: true });
\t\tawait fs$1.mkdir(resolveSessionTranscriptsDirForAgent(agent.agentId), { recursive: true });
\t}
}
`;

function replaceOpenClawRuntimeSnippet(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(
      `[openclaw-runtime-patch] Cannot apply agent path materialization patch; missing ${label}.`,
    );
  }

  return source.replace(search, replacement);
}

function applyOpenClawAgentDirShapeGuardPatch(source) {
  if (
    !source.includes(OPENCLAW_AGENT_PATH_MATERIALIZATION_SENTINEL)
    || source.includes(OPENCLAW_AGENT_DIR_SHAPE_GUARD_SENTINEL)
  ) {
    return source;
  }

  const oldSnippet = `\tconst shouldReplace = !isAbsoluteOrHomeAgentPath(rawPath) || agentPathEndsWithSegments(resolved, [
\t\t"agents",
\t\tparams.agentId
\t]) || !agentPathEndsWithSegments(resolved, [
\t\t"agents",
\t\tparams.agentId,
\t\t"agent"
\t]) || isAgentPathWithin(params.workspaceDir, resolved) || params.isNewAgent && isAgentPathWithin(stateDir, resolved) && !agentPathEquals(resolved, params.canonicalPath);`;
  const newSnippet = `\tconst hasCanonicalAgentDirShape = agentPathEndsWithSegments(resolved, [
\t\t"agents",
\t\tparams.agentId,
\t\t"agent"
\t]);
\tconst shouldReplace = !isAbsoluteOrHomeAgentPath(rawPath) || agentPathEndsWithSegments(resolved, [
\t\t"agents",
\t\tparams.agentId
\t]) || isAgentPathWithin(params.workspaceDir, resolved) || isAgentPathWithin(stateDir, resolved) && !hasCanonicalAgentDirShape || params.isNewAgent && isAgentPathWithin(stateDir, resolved) && !agentPathEquals(resolved, params.canonicalPath);`;

  return replaceOpenClawRuntimeSnippet(
    source,
    oldSnippet,
    newSnippet,
    'agentDir shape guard replacement',
  );
}

function applyOpenClawGatewayConfigWriteMaterializationPatch(source) {
  const configSetSnippet = `\t\tif (!parsed) return;
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: parsed.config,
\t\t\trespond
\t\t})) return;
\t\tconst writeResult = await commitGatewayConfigWrite({
\t\t\tsnapshot,
\t\t\twriteOptions,
\t\t\tnextConfig: parsed.config,
\t\t\tcontext
\t\t});`;
  const configSetReplacement = `\t\tif (!parsed) return;
\t\tconst prepared = materializeConfigAgentPaths(parsed.config, snapshot.config);
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: prepared.config,
\t\t\trespond
\t\t})) return;
\t\tawait ensureConfigAgentDirectories(prepared);
\t\tconst writeResult = await commitGatewayConfigWrite({
\t\t\tsnapshot,
\t\t\twriteOptions,
\t\t\tnextConfig: prepared.config,
\t\t\tcontext
\t\t});`;

  let next = replaceOpenClawRuntimeSnippet(
    source,
    configSetSnippet,
    configSetReplacement,
    'config.set materialization via commitGatewayConfigWrite',
  );
  next = next.replace(
    'config: redactConfigObject(parsed.config, parsed.schema.uiHints)',
    'config: redactConfigObject(prepared.config, parsed.schema.uiHints)',
  );

  const configPatchSecretSnippet = `\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: validated.config,
\t\t\trespond
\t\t})) return;
\t\tconst changedPaths = diffConfigPaths(snapshot.config, validated.config);`;
  const configPatchSecretReplacement = `\t\tconst prepared = materializeConfigAgentPaths(validated.config, snapshot.config);
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: prepared.config,
\t\t\trespond
\t\t})) return;
\t\tconst changedPaths = diffConfigPaths(snapshot.config, prepared.config);`;
  next = replaceOpenClawRuntimeSnippet(
    next,
    configPatchSecretSnippet,
    configPatchSecretReplacement,
    'config.patch materialization via commitGatewayConfigWrite',
  );
  next = next
    .replaceAll('config: redactConfigObject(validated.config, schemaPatch.uiHints)', 'config: redactConfigObject(prepared.config, schemaPatch.uiHints)')
    .replaceAll('didSharedGatewayAuthChange(snapshot.config, validated.config)', 'didSharedGatewayAuthChange(snapshot.config, prepared.config)')
    .replaceAll('nextConfig: validated.config', 'nextConfig: prepared.config');

  const configApplySecretSnippet = `\t\tif (!parsed) return;
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: parsed.config,
\t\t\trespond
\t\t})) return;
\t\tconst changedPaths = diffConfigPaths(snapshot.config, parsed.config);`;
  const configApplySecretReplacement = `\t\tif (!parsed) return;
\t\tconst prepared = materializeConfigAgentPaths(parsed.config, snapshot.config);
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: prepared.config,
\t\t\trespond
\t\t})) return;
\t\tconst changedPaths = diffConfigPaths(snapshot.config, prepared.config);`;
  next = replaceOpenClawRuntimeSnippet(
    next,
    configApplySecretSnippet,
    configApplySecretReplacement,
    'config.apply materialization via commitGatewayConfigWrite',
  );
  next = next
    .replace('config: redactConfigObject(parsed.config, parsed.schema.uiHints)', 'config: redactConfigObject(prepared.config, parsed.schema.uiHints)')
    .replaceAll('didSharedGatewayAuthChange(snapshot.config, parsed.config)', 'didSharedGatewayAuthChange(snapshot.config, prepared.config)')
    .replaceAll('nextConfig: parsed.config', 'nextConfig: prepared.config');

  return next;
}

function applyOpenClawAgentPathMaterializationPatchToSource(source) {
  if (
    source.includes('async function replaceConfigFile(params)')
    && source.includes('async function mutateConfigFile(params)')
    && source.includes('writeConfigFile')
  ) {
    return {
      source,
      patched: false,
    };
  }

  const withShapeGuard = applyOpenClawAgentDirShapeGuardPatch(source);
  if (withShapeGuard.includes(OPENCLAW_AGENT_PATH_MATERIALIZATION_SENTINEL)) {
    return {
      source: withShapeGuard,
      patched: withShapeGuard !== source,
    };
  }

  const loadSchemaSnippet = `function loadSchemaWithPlugins() {
\treturn loadGatewayRuntimeConfigSchema();
}
`;
  let next = replaceOpenClawRuntimeSnippet(
    withShapeGuard,
    loadSchemaSnippet,
    `${loadSchemaSnippet}${OPENCLAW_AGENT_PATH_MATERIALIZATION_HELPERS}`,
    'loadSchemaWithPlugins anchor',
  );

  if (next.includes('commitGatewayConfigWrite({')) {
    return {
      source: applyOpenClawGatewayConfigWriteMaterializationPatch(next),
      patched: true,
    };
  }

  const configSetSnippet = `\t\tif (!parsed) return;
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: parsed.config,
\t\t\trespond
\t\t})) return;
\t\tawait writeConfigFile(parsed.config, writeOptions);
\t\trespond(true, {
\t\t\tok: true,
\t\t\tpath: createConfigIO().configPath,
\t\t\tconfig: redactConfigObject(parsed.config, parsed.schema.uiHints)
\t\t}, void 0);
\t\tqueueSharedGatewayAuthGenerationRefresh(true, parsed.config, context);`;
  const configSetReplacement = `\t\tif (!parsed) return;
\t\tconst prepared = materializeConfigAgentPaths(parsed.config, snapshot.config);
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: prepared.config,
\t\t\trespond
\t\t})) return;
\t\tawait ensureConfigAgentDirectories(prepared);
\t\tawait writeConfigFile(prepared.config, writeOptions);
\t\trespond(true, {
\t\t\tok: true,
\t\t\tpath: createConfigIO().configPath,
\t\t\tconfig: redactConfigObject(prepared.config, parsed.schema.uiHints)
\t\t}, void 0);
\t\tqueueSharedGatewayAuthGenerationRefresh(true, prepared.config, context);`;
  next = replaceOpenClawRuntimeSnippet(
    next,
    configSetSnippet,
    configSetReplacement,
    'config.set materialization',
  );

  const configPatchSecretSnippet = `\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: validated.config,
\t\t\trespond
\t\t})) return;
\t\tconst changedPaths = diffConfigPaths(snapshot.config, validated.config);`;
  const configPatchSecretReplacement = `\t\tconst prepared = materializeConfigAgentPaths(validated.config, snapshot.config);
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: prepared.config,
\t\t\trespond
\t\t})) return;
\t\tconst changedPaths = diffConfigPaths(snapshot.config, prepared.config);`;
  next = replaceOpenClawRuntimeSnippet(
    next,
    configPatchSecretSnippet,
    configPatchSecretReplacement,
    'config.patch materialization',
  );
  next = next
    .replaceAll('redactConfigObject(validated.config, schemaPatch.uiHints)', 'redactConfigObject(prepared.config, schemaPatch.uiHints)')
    .replaceAll('didSharedGatewayAuthChange(snapshot.config, validated.config)', 'didSharedGatewayAuthChange(snapshot.config, prepared.config)')
    .replaceAll('await writeConfigFile(validated.config, writeOptions);', 'await ensureConfigAgentDirectories(prepared);\n\t\tawait writeConfigFile(prepared.config, writeOptions);')
    .replaceAll('nextConfig: validated.config', 'nextConfig: prepared.config')
    .replaceAll('queueSharedGatewayAuthGenerationRefresh(true, validated.config, context)', 'queueSharedGatewayAuthGenerationRefresh(true, prepared.config, context)');

  const configApplySecretSnippet = `\t\tif (!parsed) return;
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: parsed.config,
\t\t\trespond
\t\t})) return;
\t\tconst changedPaths = diffConfigPaths(snapshot.config, parsed.config);`;
  const configApplySecretReplacement = `\t\tif (!parsed) return;
\t\tconst prepared = materializeConfigAgentPaths(parsed.config, snapshot.config);
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: prepared.config,
\t\t\trespond
\t\t})) return;
\t\tconst changedPaths = diffConfigPaths(snapshot.config, prepared.config);`;
  next = replaceOpenClawRuntimeSnippet(
    next,
    configApplySecretSnippet,
    configApplySecretReplacement,
    'config.apply materialization',
  );
  next = next
    .replaceAll('didSharedGatewayAuthChange(snapshot.config, parsed.config)', 'didSharedGatewayAuthChange(snapshot.config, prepared.config)')
    .replaceAll('await writeConfigFile(parsed.config, writeOptions);', 'await ensureConfigAgentDirectories(prepared);\n\t\tawait writeConfigFile(prepared.config, writeOptions);')
    .replaceAll('nextConfig: parsed.config', 'nextConfig: prepared.config')
    .replaceAll('redactConfigObject(parsed.config, parsed.schema.uiHints)', 'redactConfigObject(prepared.config, parsed.schema.uiHints)')
    .replaceAll('queueSharedGatewayAuthGenerationRefresh(true, parsed.config, context)', 'queueSharedGatewayAuthGenerationRefresh(true, prepared.config, context)');

  return {
    source: next,
    patched: true,
  };
}

async function resolveOpenClawRuntimeServerImplPath(runtimeDir) {
  const distDir = path.join(runtimeDir, 'package', 'node_modules', 'openclaw', 'dist');
  let entries;
  try {
    entries = await readdir(distDir, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `[openclaw-runtime-patch] Cannot inspect OpenClaw runtime dist dir ${distDir}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const matches = entries
    .filter((entry) =>
      entry.isFile()
      && (
        /^server[.]impl-.*[.]js$/u.test(entry.name)
        || /^server-methods-.*[.]js$/u.test(entry.name)
        || /^mutate-.*[.]js$/u.test(entry.name)
      )
    )
    .map((entry) => path.join(distDir, entry.name))
    .sort();

  const centralizedConfigWriterTargets = [];
  const legacyPatchTargets = [];
  for (const match of matches) {
    const source = await readFile(match, 'utf8');
    if (
      source.includes('async function replaceConfigFile(params)')
      && source.includes('async function mutateConfigFile(params)')
      && source.includes('writeConfigFile')
    ) {
      centralizedConfigWriterTargets.push(match);
      continue;
    }

    if (
      source.includes(OPENCLAW_AGENT_PATH_MATERIALIZATION_SENTINEL)
      || source.includes('function loadSchemaWithPlugins()')
    ) {
      legacyPatchTargets.push(match);
    }
  }

  const patchTargets = centralizedConfigWriterTargets.length > 0
    ? centralizedConfigWriterTargets
    : legacyPatchTargets;
  if (patchTargets.length !== 1) {
    throw new Error(
      `[openclaw-runtime-patch] Expected exactly one OpenClaw config method patch target in ${distDir}, found ${patchTargets.length}.`,
    );
  }

  return patchTargets[0];
}

export async function applyOpenClawRuntimeAgentPathMaterializationPatch({
  runtimeDir,
} = {}) {
  const normalizedRuntimeDir = String(runtimeDir ?? '').trim();
  if (!normalizedRuntimeDir) {
    throw new Error('[openclaw-runtime-patch] runtimeDir is required.');
  }

  const serverImplPath = await resolveOpenClawRuntimeServerImplPath(normalizedRuntimeDir);
  const source = await readFile(serverImplPath, 'utf8');
  const patched = applyOpenClawAgentPathMaterializationPatchToSource(source);
  if (!patched.patched) {
    return {
      status: 'already-patched',
      serverImplPath,
    };
  }

  await writeFile(serverImplPath, patched.source, 'utf8');
  return {
    status: 'patched',
    serverImplPath,
  };
}

async function normalizePreparedRuntimeWrapperPackageJson({
  packageDir,
  openclawPackage = DEFAULT_OPENCLAW_PACKAGE,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
} = {}) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  let packageJson;
  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  } catch {
    packageJson = {};
  }

  const dependencies =
    packageJson.dependencies && typeof packageJson.dependencies === 'object'
      ? { ...packageJson.dependencies }
      : {};
  dependencies[openclawPackage] = openclawVersion;
  for (const installSpec of normalizeOpenClawRuntimeSupplementalPackages(runtimeSupplementalPackages)) {
    const packageName = resolvePackageNameFromInstallSpec(installSpec);
    const versionSpec = resolveInstallSpecVersion(installSpec);
    if (packageName && versionSpec) {
      dependencies[packageName] = versionSpec;
    }
  }

  await writeFile(
    packageJsonPath,
    `${JSON.stringify(
      {
        ...packageJson,
        dependencies,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

export async function prepareOpenClawRuntimeFromSource({
  sourceRuntimeDir,
  resourceDir = DEFAULT_RESOURCE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  openclawPackage = DEFAULT_OPENCLAW_PACKAGE,
  target = resolveOpenClawTarget(),
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
}) {
  const manifest = buildOpenClawManifest({ openclawVersion, nodeVersion, target });
  await validatePreparedRuntimeSource(sourceRuntimeDir, manifest, {
    runtimeSupplementalPackages,
  });
  await cleanPreparedOpenClawResourceDir(resourceDir);
  await copyDirectoryWithWindowsFallback(sourceRuntimeDir, path.join(resourceDir, 'runtime'));
  await removePreparedBundledNodeRuntime(path.join(resourceDir, 'runtime'));
  await normalizePreparedRuntimeWrapperPackageJson({
    packageDir: path.join(resourceDir, 'runtime', 'package'),
    openclawPackage,
    openclawVersion,
    runtimeSupplementalPackages,
  });
  await copyOpenClawSupplementalChannelExtensions({
    packageInstallRoot: path.join(resourceDir, 'runtime', 'package'),
    runtimeSupplementalPackages,
  });
  await writePreparedRuntimeSidecarManifest({
    runtimeDir: path.join(resourceDir, 'runtime'),
    manifest,
    runtimeSupplementalPackages,
  });
  await writeFile(
    path.join(resourceDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await applyOpenClawRuntimeAgentPathMaterializationPatch({
    runtimeDir: path.join(resourceDir, 'runtime'),
  });
  await validatePreparedRuntimeSource(path.join(resourceDir, 'runtime'), manifest, {
    runtimeSupplementalPackages,
  });

  return {
    manifest,
    resourceDir,
  };
}

export async function prepareOpenClawRuntimeFromStagedDirs({
  nodeSourceDir,
  packageSourceDir,
  resourceDir = DEFAULT_RESOURCE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  openclawPackage = DEFAULT_OPENCLAW_PACKAGE,
  target = resolveOpenClawTarget(),
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
}) {
  const manifest = buildOpenClawManifest({ openclawVersion, nodeVersion, target });
  await validatePreparedRuntimeArtifacts({
    nodeSourceDir,
    packageSourceDir,
    manifest,
    runtimeSupplementalPackages,
  });
  await cleanPreparedOpenClawResourceDir(resourceDir);
  await mkdir(path.join(resourceDir, 'runtime'), { recursive: true });
  await copyDirectoryWithWindowsFallback(packageSourceDir, path.join(resourceDir, 'runtime', 'package'));
  await normalizePreparedRuntimeWrapperPackageJson({
    packageDir: path.join(resourceDir, 'runtime', 'package'),
    openclawPackage,
    openclawVersion,
    runtimeSupplementalPackages,
  });
  await copyOpenClawSupplementalChannelExtensions({
    packageInstallRoot: path.join(resourceDir, 'runtime', 'package'),
    runtimeSupplementalPackages,
  });
  await writePreparedRuntimeSidecarManifest({
    runtimeDir: path.join(resourceDir, 'runtime'),
    manifest,
    runtimeSupplementalPackages,
  });
  await writeFile(
    path.join(resourceDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await applyOpenClawRuntimeAgentPathMaterializationPatch({
    runtimeDir: path.join(resourceDir, 'runtime'),
  });
  await validatePreparedRuntimeSource(path.join(resourceDir, 'runtime'), manifest, {
    runtimeSupplementalPackages,
  });

  return {
    manifest,
    resourceDir,
  };
}

export async function prepareOpenClawRuntime({
  resourceDir = DEFAULT_RESOURCE_DIR,
  cacheDir = DEFAULT_PREPARE_CACHE_DIR,
  openclawVersion = DEFAULT_OPENCLAW_VERSION,
  nodeVersion = DEFAULT_NODE_VERSION,
  openclawPackage = DEFAULT_OPENCLAW_PACKAGE,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  sourceRuntimeDir = process.env.OPENCLAW_BUNDLED_SOURCE_DIR,
  packageTarball = process.env.OPENCLAW_PACKAGE_TARBALL,
  forcePrepare = parseBooleanFlag(process.env.OPENCLAW_FORCE_PREPARE),
  fetchImpl = globalThis.fetch,
  target = resolveRequestedOpenClawTarget(),
} = {}) {
  const manifest = buildOpenClawManifest({ openclawVersion, nodeVersion, target });
  const canReusePreparedRuntime = !sourceRuntimeDir && !packageTarball;
  const cachePaths = resolveOpenClawPrepareCachePaths({
    cacheDir,
    openclawVersion,
    nodeVersion,
    target,
  });

  if (canReusePreparedRuntime && !forcePrepare) {
    const inspection = await inspectPreparedOpenClawRuntime({
      resourceDir,
      manifest,
      runtimeSupplementalPackages,
    });

    if (shouldReusePreparedOpenClawRuntime({ inspection, forcePrepare })) {
      return await finalizePreparedOpenClawRuntime({
        manifest,
        resourceDir,
        strategy: 'reused-existing',
      });
    }

    const cachedRuntime = await inspectCachedOpenClawRuntimeArtifacts({
      nodeSourceDir: cachePaths.nodeCacheDir,
      packageSourceDir: cachePaths.packageCacheDir,
      manifest,
      runtimeSupplementalPackages,
    });

    if (cachedRuntime.reusable) {
      const result = await prepareOpenClawRuntimeFromStagedDirs({
        nodeSourceDir: cachePaths.nodeCacheDir,
        packageSourceDir: cachePaths.packageCacheDir,
        resourceDir,
        openclawVersion,
        nodeVersion,
        openclawPackage,
        target,
        runtimeSupplementalPackages,
      });

      return await finalizePreparedOpenClawRuntime({
        ...result,
        strategy: 'prepared-cache',
      });
    }
  }

  if (sourceRuntimeDir) {
    const result = await prepareOpenClawRuntimeFromSource({
      sourceRuntimeDir,
      resourceDir,
      openclawVersion,
      nodeVersion,
      openclawPackage,
      target,
      runtimeSupplementalPackages,
    });

    return await finalizePreparedOpenClawRuntime({
      ...result,
      strategy: 'prepared-source',
    });
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is not available and no OPENCLAW_BUNDLED_SOURCE_DIR was provided.');
  }

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'claw-openclaw-runtime-'));
  const packageDir = path.join(stagingRoot, 'runtime-package');

  try {
    const archivePath = await downloadNodeRuntime({
      stagingRoot,
      nodeVersion,
      target,
      fetchImpl,
      cachedArchivePath: cachePaths.cachedArchivePath,
    });
    const extractedNodeDir = await extractNodeRuntimeArchive({
      archivePath,
      stagingRoot,
      target,
      nodeVersion,
      cachedNodeDir: cachePaths.nodeCacheDir,
    });
    await cleanPreparedOpenClawResourceDir(resourceDir);
    await mkdir(path.join(resourceDir, 'runtime'), { recursive: true });

    await mkdir(packageDir, { recursive: true });
    await writeFile(
      path.join(packageDir, 'package.json'),
      `${JSON.stringify({ name: 'bundled-openclaw-runtime', private: true }, null, 2)}\n`,
      'utf8',
    );

    const installSpecs = resolveOpenClawRuntimeInstallSpecs({
      openclawInstallSpec: packageTarball,
      openclawPackage,
      openclawVersion,
      runtimeSupplementalPackages,
    });
    const runtimeNpm = resolveNodeRuntimeNpmCommand(extractedNodeDir, target.platformId);
    const runtimeInstallEnv = buildOpenClawRuntimeInstallEnv(process.env, {
      cacheDir,
      platform: target.platformId,
    });
    await retryOpenClawRuntimeOperation(
      async () => {
        await runCommand(runtimeNpm.command, [
          ...runtimeNpm.args,
          'install',
          '--omit=dev',
          '--no-package-lock',
          '--save-exact',
          '--ignore-scripts',
          ...installSpecs,
        ], {
          cwd: packageDir,
          env: runtimeInstallEnv,
        });
      },
      {
        description: `OpenClaw runtime package install ${openclawVersion}`,
      },
    );
    await retryOpenClawRuntimeOperation(
      async () => {
        await installMissingBundledPluginRuntimeDeps({
          packageRoot: path.join(packageDir, 'node_modules', 'openclaw'),
          packageInstallRoot: packageDir,
          runtimeNpm,
          baseEnv: process.env,
          cacheDir,
          platform: target.platformId,
          arch: target.archId,
        });
      },
      {
        description: `OpenClaw bundled plugin runtime dependency install ${openclawVersion}`,
      },
    );
    await retryOpenClawRuntimeOperation(
      async () => {
        await stageKnownDownloadedNativeRuntimeAssets({
          modulesRoot: path.join(packageDir, 'node_modules'),
          fetchImpl,
          platform: target.platformId,
          arch: target.archId,
          runtimeNpm,
          installEnv: runtimeInstallEnv,
        });
      },
      {
        description: `OpenClaw downloaded native runtime asset staging ${openclawVersion}`,
      },
    );

    await normalizePreparedRuntimeWrapperPackageJson({
      packageDir,
      openclawPackage,
      openclawVersion,
      runtimeSupplementalPackages,
    });
    await copyOpenClawSupplementalChannelExtensions({
      packageInstallRoot: packageDir,
      runtimeSupplementalPackages,
    });
    await copyDirectoryWithWindowsFallback(packageDir, path.join(resourceDir, 'runtime', 'package'));
    await writePreparedRuntimeSidecarManifest({
      runtimeDir: path.join(resourceDir, 'runtime'),
      manifest,
      runtimeSupplementalPackages,
    });
    await writeFile(
      path.join(resourceDir, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    await validatePreparedRuntimeSource(path.join(resourceDir, 'runtime'), manifest, {
      runtimeSupplementalPackages,
    });
    await refreshCachedOpenClawRuntimeArtifacts({
      nodeSourceDir: extractedNodeDir,
      packageSourceDir: packageDir,
      cachePaths,
    });

    return await finalizePreparedOpenClawRuntime({
      manifest,
      resourceDir,
      strategy: 'prepared-download',
    });
  } finally {
    await removeDirectoryWithRetries(stagingRoot);
  }
}

async function finalizePreparedOpenClawRuntime(result) {
  await applyOpenClawRuntimeAgentPathMaterializationPatch({
    runtimeDir: path.join(result.resourceDir, 'runtime'),
  });
  if (shouldSyncBundledResourceMirror({ resourceDir: result.resourceDir })) {
    const packagedArtifacts = await syncPackagedOpenClawReleaseArtifacts({
      resourceDir: result.resourceDir,
      manifest: result.manifest,
      target: resolveRequestedOpenClawTarget(),
    });
    await syncWindowsPackagedOpenClawAliasRoot({
      workspaceRootDir: rootDir,
      packagedResourceDir: packagedArtifacts.packagedResourceDir,
      platform: process.platform,
    });
  }
  return result;
}

export function shouldSyncBundledResourceMirror({
  resourceDir = DEFAULT_RESOURCE_DIR,
  defaultResourceDir = DEFAULT_RESOURCE_DIR,
} = {}) {
  return path.resolve(resourceDir) === path.resolve(defaultResourceDir);
}

async function cleanPreparedOpenClawResourceDir(
  resourceDir,
  {
    retainedEntryNames = PREPARED_RESOURCE_RETAINED_ENTRY_NAMES,
  } = {},
) {
  await mkdir(resourceDir, { recursive: true });
  const entries = await readdir(resourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (retainedEntryNames.has(entry.name)) {
      continue;
    }

    await removeDirectoryWithRetries(path.join(resourceDir, entry.name));
  }
}

async function removePreparedBundledNodeRuntime(runtimeDir) {
  const bundledNodeDir = path.join(runtimeDir, 'node');
  try {
    await stat(bundledNodeDir);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  await removeDirectoryWithRetries(bundledNodeDir);
}

export async function validatePreparedRuntimeSource(
  sourceRuntimeDir,
  manifest,
  {
    runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  } = {},
) {
  const checks = [
    path.join(sourceRuntimeDir, 'package'),
    path.join(sourceRuntimeDir, manifest.cliRelativePath.replace(/^runtime[\\/]/, '')),
    ...resolveOpenClawRuntimeSupplementalPackagePaths({
      packageSourceDir: path.join(sourceRuntimeDir, 'package'),
      runtimeSupplementalPackages,
    }),
  ];

  for (const absolutePath of checks) {
    try {
      await stat(absolutePath);
    } catch (error) {
      throw new Error(`Prepared OpenClaw runtime is missing ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const bundledNodeDir = path.join(sourceRuntimeDir, 'node');
  try {
    await stat(bundledNodeDir);
    throw new Error(
      `Prepared OpenClaw runtime must not retain a bundled Node payload at ${bundledNodeDir}`,
    );
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
      throw error;
    }
  }

  await validatePreparedOpenClawPackageTree({
    packageRoot: path.join(sourceRuntimeDir, 'package', 'node_modules', 'openclaw'),
    packageInstallRoot: path.join(sourceRuntimeDir, 'package'),
    modulesRoot: path.join(sourceRuntimeDir, 'package', 'node_modules'),
    expectedOpenClawVersion: manifest.openclawVersion,
    runtimeSupplementalPackages,
  });
}

async function validatePreparedRuntimeArtifacts({
  packageSourceDir,
  manifest,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
}) {
  const checks = [
    packageSourceDir,
    path.join(packageSourceDir, manifest.cliRelativePath.replace(/^runtime[\\/]package[\\/]/, '')),
    ...resolveOpenClawRuntimeSupplementalPackagePaths({
      packageSourceDir,
      runtimeSupplementalPackages,
    }),
  ];

  for (const absolutePath of checks) {
    try {
      await stat(absolutePath);
    } catch (error) {
      throw new Error(`Prepared OpenClaw staged runtime is missing ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await validatePreparedOpenClawPackageTree({
    packageRoot: path.join(packageSourceDir, 'node_modules', 'openclaw'),
    packageInstallRoot: packageSourceDir,
    modulesRoot: path.join(packageSourceDir, 'node_modules'),
    expectedOpenClawVersion: manifest.openclawVersion,
    runtimeSupplementalPackages,
  });
}

async function inspectCachedOpenClawRuntimeArtifacts({
  nodeSourceDir,
  packageSourceDir,
  manifest,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
}) {
  try {
    await validatePreparedRuntimeArtifacts({
      nodeSourceDir,
      packageSourceDir,
      manifest,
      runtimeSupplementalPackages,
    });
    return {
      reusable: true,
      reason: 'ready',
    };
  } catch (error) {
    return {
      reusable: false,
      reason: 'invalid',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function resolvePreparedRuntimeSidecarManifestPath(runtimeDir) {
  return path.join(runtimeDir, PREPARED_RUNTIME_SIDECAR_MANIFEST_FILENAME);
}

function resolveCachedNodeRuntimeSidecarManifestPath(nodeRuntimeDir) {
  return path.join(nodeRuntimeDir, CACHED_NODE_RUNTIME_SIDECAR_MANIFEST_FILENAME);
}

function buildCachedNodeRuntimeSidecarManifest({
  nodeVersion,
  target,
}) {
  return {
    schemaVersion: 1,
    nodeVersion,
    platform: target.platformId,
    arch: target.archId,
    nodeBinaryRelativePath: target.nodeBinaryRelativePath,
  };
}

function cachedNodeRuntimeSidecarManifestMatches(sidecarManifest, expectedManifest) {
  if (!sidecarManifest || typeof sidecarManifest !== 'object') {
    return false;
  }

  return (
    sidecarManifest.schemaVersion === expectedManifest.schemaVersion
    && sidecarManifest.nodeVersion === expectedManifest.nodeVersion
    && sidecarManifest.platform === expectedManifest.platform
    && sidecarManifest.arch === expectedManifest.arch
    && normalizeRuntimeIntegrityRelativePath(sidecarManifest.nodeBinaryRelativePath)
      === normalizeRuntimeIntegrityRelativePath(expectedManifest.nodeBinaryRelativePath)
  );
}

async function writePreparedRuntimeSidecarManifest({
  runtimeDir,
  manifest,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
}) {
  const sidecarManifest = await buildPreparedRuntimeSidecarManifest({
    runtimeDir,
    manifest,
    runtimeSupplementalPackages,
  });
  await writeFile(
    resolvePreparedRuntimeSidecarManifestPath(runtimeDir),
    `${JSON.stringify(sidecarManifest, null, 2)}\n`,
    'utf8',
  );
}

async function readPreparedRuntimeSidecarManifest(runtimeDir) {
  return JSON.parse(
    await readFile(resolvePreparedRuntimeSidecarManifestPath(runtimeDir), 'utf8'),
  );
}

function normalizeRuntimeIntegrityRelativePath(pathValue) {
  return String(pathValue ?? '')
    .replaceAll('\\', '/')
    .replace(/^\/+/u, '')
    .trim();
}

async function buildPreparedRuntimeSidecarManifest({
  runtimeDir,
  manifest,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
}) {
  const runtimeIntegrityFiles = await collectPreparedRuntimeIntegrityFiles({
    runtimeDir,
    manifest,
    runtimeSupplementalPackages,
  });

  return {
    ...manifest,
    runtimeIntegrity: {
      schemaVersion: 1,
      files: runtimeIntegrityFiles,
    },
  };
}

async function collectPreparedRuntimeIntegrityFiles({
  runtimeDir,
  manifest,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
}) {
  const runtimePackageRoot = path.join(runtimeDir, 'package');
  const openclawPackageRoot = path.join(runtimePackageRoot, 'node_modules', 'openclaw');
  const bundledPluginRuntimeDeps = await loadBundledPluginRuntimeDeps(openclawPackageRoot);
  const relativePathSet = new Set([
    normalizeRuntimeIntegrityRelativePath(
      manifest.cliRelativePath.replace(/^runtime[\\/]/, ''),
    ),
    'package/node_modules/openclaw/package.json',
    ...resolveOpenClawRuntimeSupplementalPackagePaths({
      packageSourceDir: runtimePackageRoot,
      runtimeSupplementalPackages,
    }).map((absolutePath) => normalizeRuntimeIntegrityRelativePath(
      path.relative(runtimeDir, path.join(absolutePath, 'package.json')),
    )),
    ...bundledPluginRuntimeDeps.map((runtimeDep) => normalizeRuntimeIntegrityRelativePath(
      path.relative(runtimeDir, path.join(runtimePackageRoot, runtimeDep.sentinelPath)),
    )),
  ]);

  const files = [];
  for (const relativePath of [...relativePathSet].filter(Boolean).toSorted((left, right) => left.localeCompare(right))) {
    const absolutePath = path.join(runtimeDir, relativePath);
    const content = await readFile(absolutePath);
    files.push({
      relativePath,
      size: content.byteLength,
      sha256: createHash('sha256').update(content).digest('hex'),
    });
  }

  return files;
}

async function writeCachedNodeRuntimeSidecarManifest({
  nodeRuntimeDir,
  nodeVersion,
  target,
}) {
  await writeFile(
    resolveCachedNodeRuntimeSidecarManifestPath(nodeRuntimeDir),
    `${JSON.stringify(buildCachedNodeRuntimeSidecarManifest({ nodeVersion, target }), null, 2)}\n`,
    'utf8',
  );
}

async function readCachedNodeRuntimeSidecarManifest(nodeRuntimeDir) {
  return JSON.parse(
    await readFile(resolveCachedNodeRuntimeSidecarManifestPath(nodeRuntimeDir), 'utf8'),
  );
}

export async function inspectCachedNodeRuntimeDir({
  nodeSourceDir,
  target,
  nodeVersion,
}) {
  try {
    await stat(nodeSourceDir);
    const nodeExecutablePath = path.join(
      nodeSourceDir,
      target.nodeBinaryRelativePath.replace(/^runtime[\\/]node[\\/]/, ''),
    );
    for (const dependencyPath of resolveBundledNodeInstallDependencyPaths(nodeSourceDir, target)) {
      await stat(dependencyPath);
    }
    const expectedSidecarManifest = buildCachedNodeRuntimeSidecarManifest({
      nodeVersion,
      target,
    });

    let sidecarManifest;
    try {
      sidecarManifest = await readCachedNodeRuntimeSidecarManifest(nodeSourceDir);
    } catch (error) {
      return {
        reusable: false,
        reason: 'node-sidecar-missing',
        error: error instanceof Error ? error.message : String(error),
      };
    }

    if (!cachedNodeRuntimeSidecarManifestMatches(sidecarManifest, expectedSidecarManifest)) {
      return {
        reusable: false,
        reason: 'node-sidecar-mismatch',
        preparedNodeVersion:
          typeof sidecarManifest?.nodeVersion === 'string' ? sidecarManifest.nodeVersion : null,
        sidecarVerified: false,
      };
    }

    return {
      reusable: true,
      reason: 'ready',
      preparedNodeVersion: sidecarManifest.nodeVersion,
      sidecarVerified: true,
    };
  } catch (error) {
    return {
      reusable: false,
      reason: 'invalid',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function downloadNodeRuntime({
  stagingRoot,
  nodeVersion,
  target,
  fetchImpl,
  cachedArchivePath,
}) {
  const archiveName = target.nodeArchiveName(nodeVersion);
  const url = `https://nodejs.org/dist/v${nodeVersion}/${archiveName}`;
  const archivePath = cachedArchivePath ?? path.join(stagingRoot, archiveName);

  if (existsSync(archivePath)) {
    return archivePath;
  }

  await mkdir(path.dirname(archivePath), { recursive: true });
  const tempArchivePath = `${archivePath}.downloading`;
  const response = await retryOpenClawRuntimeOperation(
    async () => await fetchImpl(url),
    {
      description: `OpenClaw Node runtime download ${archiveName}`,
    },
  );

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Node runtime from ${url}: ${response.status} ${response.statusText}`);
  }

  await streamToFile(response.body, tempArchivePath);
  await rm(archivePath, { force: true });
  await cp(tempArchivePath, archivePath);
  await rm(tempArchivePath, { force: true });
  return archivePath;
}

export function resolveNodeArchiveExtractionCommand({
  archivePath,
  extractRoot,
  target,
  platform = process.platform,
  hasTarCommand,
}) {
  const tarAvailable =
    typeof hasTarCommand === 'boolean'
      ? hasTarCommand
      : commandExistsSync('tar', { platform });

  if (target.nodeArchiveExt === 'zip') {
    if (tarAvailable) {
      return {
        command: resolveOpenClawRuntimeSystemCommand('tar', platform),
        args: ['-xf', archivePath, '-C', extractRoot],
      };
    }

    return {
      command: resolveOpenClawRuntimeSystemCommand('powershell', platform),
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractRoot.replace(/'/g, "''")}' -Force`,
      ],
    };
  }

  return {
    command: resolveOpenClawRuntimeSystemCommand('tar', platform),
    args: ['-xJf', archivePath, '-C', extractRoot],
  };
}

async function extractNodeRuntimeArchive({ archivePath, stagingRoot, target, nodeVersion, cachedNodeDir }) {
  if (cachedNodeDir) {
    const cachedInspection = await inspectCachedNodeRuntimeDir({
      nodeSourceDir: cachedNodeDir,
      target,
      nodeVersion,
    });
    if (cachedInspection.reusable) {
      return cachedNodeDir;
    }
  }

  const extractRoot = path.join(stagingRoot, 'node-extract');
  await mkdir(extractRoot, { recursive: true });
  const extractor = resolveNodeArchiveExtractionCommand({
    archivePath,
    extractRoot,
    target,
  });
  await runCommand(extractor.command, extractor.args);

  const entries = await readdir(extractRoot, { withFileTypes: true });
  const firstDirectory = entries.find((entry) => entry.isDirectory());
  if (!firstDirectory) {
    throw new Error(`Unable to find extracted Node runtime directory inside ${extractRoot}`);
  }

  const extractedNodeDir = path.join(extractRoot, firstDirectory.name);

  if (cachedNodeDir) {
    await removeDirectoryWithRetries(cachedNodeDir);
    await mkdir(path.dirname(cachedNodeDir), { recursive: true });
    await copyDirectoryContents(extractedNodeDir, cachedNodeDir);
    await writeCachedNodeRuntimeSidecarManifest({
      nodeRuntimeDir: cachedNodeDir,
      nodeVersion,
      target,
    });
    return cachedNodeDir;
  }

  return extractedNodeDir;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function shouldRetryOpenClawRuntimeOperationError(error) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);
  const errorCode = typeof error === 'object' && error !== null ? error.code : undefined;
  const normalizedMessage = message.toLowerCase();

  if (
    errorCode === 'ECONNRESET'
    || errorCode === 'ETIMEDOUT'
    || errorCode === 'ECONNREFUSED'
    || errorCode === 'EAI_AGAIN'
    || errorCode === 'ENOTFOUND'
  ) {
    return true;
  }

  return (
    normalizedMessage.includes('econnreset')
    || normalizedMessage.includes('network aborted')
    || normalizedMessage.includes('fetch failed')
    || normalizedMessage.includes('socket hang up')
    || normalizedMessage.includes('timed out')
    || normalizedMessage.includes('eai_again')
    || normalizedMessage.includes('enotfound')
  );
}

export async function retryOpenClawRuntimeOperation(
  operation,
  {
    retries = DEFAULT_OPENCLAW_RUNTIME_OPERATION_RETRY_COUNT,
    retryDelayMs = DEFAULT_OPENCLAW_RUNTIME_OPERATION_RETRY_DELAY_MS,
    logger = console.warn,
    description = 'OpenClaw runtime operation',
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < retries && shouldRetryOpenClawRuntimeOperationError(error);
      if (!canRetry) {
        throw error;
      }

      if (typeof logger === 'function') {
        logger(
          `[prepare-openclaw-runtime] Retrying ${description} after transient failure (${attempt}/${retries - 1}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

export function shouldRetryDirectoryCleanup(error) {
  const errorCode = typeof error === 'object' && error !== null ? error.code : undefined;
  return errorCode === 'EPERM' || errorCode === 'EBUSY' || errorCode === 'ENOTEMPTY';
}

export async function removeDirectoryWithRetries(
  directoryPath,
  {
    removeImpl = rm,
    retryCount = DEFAULT_DIRECTORY_CLEANUP_RETRY_COUNT,
    retryDelayMs = DEFAULT_DIRECTORY_CLEANUP_RETRY_DELAY_MS,
    logger = console.warn,
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      await removeImpl(directoryPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      const canRetry = attempt < retryCount && shouldRetryDirectoryCleanup(error);
      if (!canRetry) {
        throw error;
      }

      if (typeof logger === 'function') {
        logger(
          `[prepare-openclaw-runtime] Retrying cleanup of ${directoryPath} after transient Windows file lock (${attempt}/${retryCount - 1}).`,
        );
      }
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

function shouldUseWindowsDirectoryCopyFallback(error, platform = process.platform) {
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  if (normalizedPlatform !== 'win32') {
    return false;
  }

  const errorCode = typeof error === 'object' && error !== null ? error.code : undefined;
  return errorCode === 'ENOENT' || errorCode === 'ENAMETOOLONG' || errorCode === 'EPERM';
}

export async function copyDirectoryWithWindowsFallback(
  sourceDir,
  targetDir,
  {
    copyImpl = cp,
    robocopyImpl = runRobocopyCopy,
    copyOptions = {
      recursive: true,
      // Preserve relative symlink targets from Unix Node runtimes so staged shims
      // like bin/corepack do not get rewritten to deleted temp directories.
      verbatimSymlinks: true,
    },
    platform = process.platform,
  } = {},
) {
  try {
    await copyImpl(sourceDir, targetDir, copyOptions);
  } catch (error) {
    if (!shouldUseWindowsDirectoryCopyFallback(error, platform)) {
      throw error;
    }

    console.warn(
      `[prepare-openclaw-runtime] Falling back to robocopy for ${sourceDir} -> ${targetDir} after fs.cp failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    await robocopyImpl(sourceDir, targetDir);
  }
}

async function runRobocopyCopy(sourceDir, targetDir) {
  await mkdir(path.dirname(targetDir), { recursive: true });
  await new Promise((resolve, reject) => {
    const resolvedRobocopyCommand = resolveOpenClawRuntimeSystemCommand('robocopy');
    const child = spawn(resolvedRobocopyCommand, [
      sourceDir,
      targetDir,
      '/E',
      '/NFL',
      '/NDL',
      '/NJH',
      '/NJS',
      '/NP',
      '/R:2',
      '/W:1',
    ], {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
      shell: false,
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (typeof code === 'number' && code >= 0 && code <= 7) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Command failed: ${resolvedRobocopyCommand} ${sourceDir} ${targetDir} (exit ${code ?? 'unknown'})`,
        ),
      );
    });
  });
}

async function streamToFile(body, destinationPath) {
  await pipeline(Readable.fromWeb(body), createWriteStream(destinationPath));
}

function resolveBundledNodeInstallDependencyPaths(nodeSourceDir, target) {
  if (target.platformId === 'windows') {
    return [
      path.join(nodeSourceDir, 'npm.cmd'),
      path.join(nodeSourceDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      path.join(nodeSourceDir, 'node_modules', 'npm', 'bin', 'npm-prefix.js'),
    ];
  }

  return [path.join(nodeSourceDir, 'bin', 'npm')];
}

async function ensureBundledResourceMirror({
  resourceDir,
  resourceId,
  workspaceRootDir = rootDir,
  platform = process.platform,
}) {
  return await syncBundledResourceMirror({
    resourceDir,
    resourceId,
    workspaceRootDir,
    platform,
  });
}

function findZipEndOfCentralDirectory(buffer) {
  const minimumRecordSize = 22;
  const maxCommentLength = 0xffff;
  const startOffset = Math.max(0, buffer.length - minimumRecordSize - maxCommentLength);

  for (let offset = buffer.length - minimumRecordSize; offset >= startOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function readZipEntriesFromBuffer(buffer) {
  const eocdOffset = findZipEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    throw new Error('missing-end-of-central-directory');
  }

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > buffer.length) {
    throw new Error('invalid-central-directory-bounds');
  }

  const entries = [];
  let offset = centralDirectoryOffset;
  while (offset < centralDirectoryEnd) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('invalid-central-directory-entry');
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);

    entries.push({
      fileName,
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function readZipEntryContent(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error('invalid-local-header');
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraFieldLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraFieldLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) {
    throw new Error('entry-exceeds-archive-bounds');
  }

  const rawContent = buffer.subarray(dataStart, dataEnd);
  if (entry.compressionMethod === 0) {
    return rawContent;
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(rawContent);
  }

  throw new Error(`unsupported-compression-method:${entry.compressionMethod}`);
}

async function bundledResourceArchiveMirrorIsReusable({
  mirrorRoot,
  expectedManifest,
  archiveFileName = BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME,
}) {
  try {
    const mirrorManifest = JSON.parse(
      await readFile(path.join(mirrorRoot, 'manifest.json'), 'utf8'),
    );
    const archivePath = path.join(mirrorRoot, archiveFileName);
    const archiveBuffer = await readFile(archivePath);
    const archiveEntries = readZipEntriesFromBuffer(archiveBuffer);
    const archiveEntryNames = new Set(archiveEntries.map((entry) => entry.fileName));
    if (
      !preparedOpenClawManifestMatches(mirrorManifest, expectedManifest)
      || !archiveEntryNames.has(`runtime/${PREPARED_RUNTIME_SIDECAR_MANIFEST_FILENAME}`)
      || !archiveEntryNames.has(expectedManifest.cliRelativePath)
      || archiveEntryNamesContainBundledNodePayload(archiveEntryNames)
    ) {
      return false;
    }

    const runtimeSidecarEntry = archiveEntries.find(
      (entry) => entry.fileName === `runtime/${PREPARED_RUNTIME_SIDECAR_MANIFEST_FILENAME}`,
    );
    const runtimeSidecarManifest = JSON.parse(
      readZipEntryContent(archiveBuffer, runtimeSidecarEntry).toString('utf8'),
    );

    return preparedRuntimeSidecarManifestMatches(runtimeSidecarManifest, expectedManifest);
  } catch {
    return false;
  }
}

function archiveEntryNamesContainBundledNodePayload(entryNames) {
  for (const entryName of entryNames) {
    if (String(entryName ?? '').replaceAll('\\', '/').startsWith('runtime/node/')) {
      return true;
    }
  }

  return false;
}

async function repairArchiveOnlyBundledResourceRootInPlace({
  sourceRoot,
  mirrorRoot,
  expectedManifest,
  archiveFileName = BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME,
  platform = process.platform,
  mkdirImpl = mkdir,
  copyImpl = cp,
} = {}) {
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  const sourcePathApi = resolveBundledResourceFsPathApi(sourceRoot, normalizedPlatform);
  const mirrorPathApi = resolveBundledResourceFsPathApi(mirrorRoot, normalizedPlatform);
  const runtimeDir = mirrorPathApi.join(mirrorRoot, 'runtime');

  await mkdirImpl(mirrorRoot, { recursive: true });
  try {
    await stat(runtimeDir);
    await removeDirectoryWithRetries(runtimeDir);
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'ENOENT')) {
      throw error;
    }
  }

  let mirrorManifestMatches = false;
  try {
    const mirrorManifest = JSON.parse(
      await readFile(mirrorPathApi.join(mirrorRoot, 'manifest.json'), 'utf8'),
    );
    mirrorManifestMatches = preparedOpenClawManifestMatches(mirrorManifest, expectedManifest);
  } catch {
    mirrorManifestMatches = false;
  }

  if (!mirrorManifestMatches) {
    await copyImpl(
      sourcePathApi.join(sourceRoot, 'manifest.json'),
      mirrorPathApi.join(mirrorRoot, 'manifest.json'),
      { force: true },
    );
  }

  await copyImpl(
    sourcePathApi.join(sourceRoot, archiveFileName),
    mirrorPathApi.join(mirrorRoot, archiveFileName),
    { force: true },
  );

  if (await bundledResourceArchiveMirrorIsReusable({
    mirrorRoot,
    expectedManifest,
    archiveFileName,
  })) {
    return mirrorRoot;
  }

  throw new Error(
    `Unable to repair archive-only packaged OpenClaw resource root in place at ${mirrorRoot}.`,
  );
}

function escapePowerShellLiteral(value) {
  return String(value ?? '').replace(/'/g, "''");
}

async function createBundledResourceRuntimeArchive({
  sourceRoot,
  archivePath,
  platform = process.platform,
  runCommandImpl = runCommand,
}) {
  const runtimeSourceDir = path.join(sourceRoot, 'runtime');
  await stat(runtimeSourceDir);

  if (platform === 'win32' || platform === 'windows') {
    if (commandExistsSync('tar', { platform })) {
      await runCommandImpl(
        resolveOpenClawRuntimeSystemCommand('tar', platform),
        ['-acf', archivePath, 'runtime'],
        { cwd: sourceRoot },
      );
      return archivePath;
    }

    const archiveDestination = escapePowerShellLiteral(archivePath);
    const runtimePath = escapePowerShellLiteral(runtimeSourceDir);
    await runCommandImpl(resolveOpenClawRuntimeSystemCommand('powershell', platform), [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$ErrorActionPreference = 'Stop'; if (Test-Path -LiteralPath '${archiveDestination}') { Remove-Item -LiteralPath '${archiveDestination}' -Force }; Compress-Archive -Path '${runtimePath}' -DestinationPath '${archiveDestination}' -Force`,
    ]);
    return archivePath;
  }

  await runCommandImpl(
    'zip',
    ['-q', '-r', archivePath, 'runtime'],
    { cwd: sourceRoot },
  );
  return archivePath;
}

function resolveOpenClawInstallKey(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Expected a packaged OpenClaw manifest object.');
  }

  const openclawVersion = String(manifest.openclawVersion ?? '').trim();
  const platformId = String(manifest.platform ?? '').trim();
  const archId = String(manifest.arch ?? '').trim();
  if (!openclawVersion || !platformId || !archId) {
    throw new Error('Packaged OpenClaw manifest is missing install key fields.');
  }

  return `${openclawVersion}-${platformId}-${archId}`;
}

async function syncArchiveOnlyBundledResourceRoot({
  sourceRoot,
  mirrorRoot,
  manifest,
  archiveFileName = BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME,
  createArchiveImpl = createBundledResourceRuntimeArchive,
  platform = process.platform,
}) {
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  const sourcePathApi = resolveBundledResourceFsPathApi(sourceRoot, normalizedPlatform);
  const mirrorPathApi = resolveBundledResourceFsPathApi(mirrorRoot, normalizedPlatform);
  if (await bundledResourceArchiveMirrorIsReusable({
    mirrorRoot,
    expectedManifest: manifest,
    archiveFileName,
  })) {
    return mirrorRoot;
  }

  await mkdir(mirrorPathApi.dirname(mirrorRoot), { recursive: true });
  const stagingRoot = await mkdtemp(
    mirrorPathApi.join(mirrorPathApi.dirname(mirrorRoot), 'openclaw-release-staging-'),
  );

  try {
    await cp(
      sourcePathApi.join(sourceRoot, 'manifest.json'),
      mirrorPathApi.join(stagingRoot, 'manifest.json'),
    );
    await createArchiveImpl({
      sourceRoot,
      archivePath: mirrorPathApi.join(stagingRoot, archiveFileName),
      platform,
    });
    await removeDirectoryWithRetries(mirrorRoot);
    await mkdir(mirrorPathApi.dirname(mirrorRoot), { recursive: true });
    await rename(stagingRoot, mirrorRoot);
    return mirrorRoot;
  } catch (error) {
    const errorCode = typeof error === 'object' && error !== null ? error.code : undefined;
    const canRepairInPlace =
      normalizedPlatform === 'win32'
      && (shouldRetryDirectoryCleanup(error) || errorCode === 'EEXIST');
    if (!canRepairInPlace) {
      throw error;
    }

    return await repairArchiveOnlyBundledResourceRootInPlace({
      sourceRoot: stagingRoot,
      mirrorRoot,
      expectedManifest: manifest,
      archiveFileName,
      platform: normalizedPlatform,
    });
  } finally {
    await removeDirectoryWithRetries(stagingRoot);
  }
}

async function stagePackagedOpenClawInstallRootLayout({
  resourceDir,
  installRootLayoutDir,
  manifest,
}) {
  const installKey = resolveOpenClawInstallKey(manifest);
  const installDir = path.join(
    installRootLayoutDir,
    'runtimes',
    'openclaw',
    installKey,
  );
  await removeDirectoryWithRetries(installRootLayoutDir);
  await mkdir(installDir, { recursive: true });
  await copyDirectoryWithWindowsFallback(
    path.join(resourceDir, 'runtime'),
    path.join(installDir, 'runtime'),
  );
  await writeFile(
    path.join(installDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return installDir;
}

export async function syncPackagedOpenClawReleaseArtifacts({
  resourceDir = DEFAULT_RESOURCE_DIR,
  workspaceRootDir = rootDir,
  target = resolveRequestedOpenClawTarget(),
  manifest = null,
  archiveFileName = BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME,
  createArchiveImpl = createBundledResourceRuntimeArchive,
  runtimeSupplementalPackages = DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES,
  archivePlatform = process.platform,
} = {}) {
  await assertNoUnsupportedOpenClawRuntimeLayout({ workspaceRootDir });

  const resolvedManifest = manifest ?? JSON.parse(
    await readFile(path.join(resourceDir, 'manifest.json'), 'utf8'),
  );
  await validatePreparedRuntimeSource(path.join(resourceDir, 'runtime'), resolvedManifest, {
    runtimeSupplementalPackages,
  });

  const packagedResourceDir = resolvePackagedOpenClawResourceDir(
    workspaceRootDir,
    target.platformId,
  );
  await syncArchiveOnlyBundledResourceRoot({
    sourceRoot: resourceDir,
    mirrorRoot: packagedResourceDir,
    manifest: resolvedManifest,
    archiveFileName,
    createArchiveImpl,
    platform: archivePlatform,
  });

  let packagedInstallRootLayoutDir = null;
  if (target.platformId === 'macos') {
    packagedInstallRootLayoutDir = resolvePackagedOpenClawInstallRootLayoutDir(
      workspaceRootDir,
      target.platformId,
    );
    await stagePackagedOpenClawInstallRootLayout({
      resourceDir,
      installRootLayoutDir: packagedInstallRootLayoutDir,
      manifest: resolvedManifest,
    });
  }

  return {
    packagedResourceDir,
    packagedInstallRootLayoutDir,
  };
}

export async function syncBundledResourceMirror({
  resourceDir,
  resourceId,
  workspaceRootDir = rootDir,
  platform = process.platform,
  archiveFileName = BUNDLED_RESOURCE_RUNTIME_ARCHIVE_FILENAME,
  createArchiveImpl = createBundledResourceRuntimeArchive,
}) {
  const mirrorRoot = resolveBundledResourceMirrorRoot(workspaceRootDir, resourceId, platform);
  if (path.resolve(mirrorRoot) === path.resolve(resourceDir)) {
    return mirrorRoot;
  }

  const existingResolvedPath = resolveExistingPathTarget(mirrorRoot);
  if (
    platform !== 'win32'
    && platform !== 'windows'
    && existingResolvedPath
    && path.resolve(existingResolvedPath) === path.resolve(resourceDir)
  ) {
    return mirrorRoot;
  }

  if (platform === 'win32' || platform === 'windows') {
    const sourceManifest = JSON.parse(
      await readFile(path.join(resourceDir, 'manifest.json'), 'utf8'),
    );
    return await syncArchiveOnlyBundledResourceRoot({
      sourceRoot: resourceDir,
      mirrorRoot,
      manifest: sourceManifest,
      archiveFileName,
      createArchiveImpl,
      platform,
    });
  }

  await removeDirectoryWithRetries(mirrorRoot);
  await mkdir(path.dirname(mirrorRoot), { recursive: true });
  symlinkSync(resourceDir, mirrorRoot, platform === 'win32' ? 'junction' : 'dir');
  return mirrorRoot;
}

function resolveExistingPathTarget(candidatePath) {
  try {
    return realpathSync.native(candidatePath);
  } catch {
    return null;
  }
}

function sanitizePathSegment(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
}

export async function refreshCachedOpenClawRuntimeArtifacts({
  nodeSourceDir,
  packageSourceDir,
  cachePaths,
}) {
  const refreshNodeCache = path.resolve(nodeSourceDir) !== path.resolve(cachePaths.nodeCacheDir);
  const refreshPackageCache = path.resolve(packageSourceDir) !== path.resolve(cachePaths.packageCacheDir);

  if (refreshNodeCache) {
    await removeDirectoryWithRetries(cachePaths.nodeCacheDir);
    await mkdir(path.dirname(cachePaths.nodeCacheDir), { recursive: true });
    await copyDirectoryContents(nodeSourceDir, cachePaths.nodeCacheDir);
  }

  if (refreshPackageCache) {
    await removeDirectoryWithRetries(cachePaths.packageCacheDir);
    await mkdir(path.dirname(cachePaths.packageCacheDir), { recursive: true });
    await copyDirectoryContents(packageSourceDir, cachePaths.packageCacheDir);
  }
}

async function copyDirectoryContents(sourceDir, destinationDir) {
  await mkdir(destinationDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    await copyDirectoryWithWindowsFallback(
      path.join(sourceDir, entry.name),
      path.join(destinationDir, entry.name),
    );
  }
}

async function readPreparedNodeVersion(nodeExecutablePath) {
  const { stdout } = await runCommandCapture(nodeExecutablePath, ['--version']);
  return stdout.trim().replace(/^v/i, '');
}

async function readPreparedOpenClawPackageVersion(packageJsonPath) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  if (!packageJson || typeof packageJson.version !== 'string' || packageJson.version.trim().length === 0) {
    throw new Error(`Prepared OpenClaw package.json is missing a version: ${packageJsonPath}`);
  }

  return packageJson.version.trim();
}

async function runCommand(command, args, options = {}) {
  const resolvedEnv = options.env ?? process.env;
  const resolvedPlatform = options.platform ?? process.platform;
  const resolvedCommand = resolveOpenClawRuntimeSystemCommand(
    command,
    resolvedPlatform,
    resolvedEnv,
  );

  await new Promise((resolve, reject) => {
    const child = spawn(resolvedCommand, args, {
      cwd: options.cwd ?? rootDir,
      stdio: 'inherit',
      env: resolvedEnv,
      shell: false,
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${resolvedCommand} ${args.join(' ')} (exit ${code ?? 'unknown'})`));
    });
  });
}

function commandExistsSync(command, { platform = process.platform, env = process.env } = {}) {
  const resolvedCommand = resolveOpenClawRuntimeSystemCommand(command, platform, env);
  const result = spawnSync(resolvedCommand, ['--version'], {
    stdio: 'ignore',
    env,
    shell: false,
    windowsHide: true,
  });

  return !result.error && (result.status === 0 || result.status === 1);
}

async function runCommandCapture(command, args, options = {}) {
  const resolvedEnv = options.env ?? process.env;
  const resolvedPlatform = options.platform ?? process.platform;
  const resolvedCommand = resolveOpenClawRuntimeSystemCommand(
    command,
    resolvedPlatform,
    resolvedEnv,
  );

  return await new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn(resolvedCommand, args, {
      cwd: options.cwd ?? rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: resolvedEnv,
      shell: false,
      windowsHide: true,
    });

    child.stdout?.on('data', (chunk) => {
      stdoutChunks.push(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderrChunks.push(chunk);
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
        });
        return;
      }

      reject(
        new Error(
          `Command failed: ${resolvedCommand} ${args.join(' ')} (exit ${code ?? 'unknown'})\n${Buffer.concat(stderrChunks).toString('utf8')}`,
        ),
      );
    });
  });
}

async function main() {
  const forcePrepare = process.argv.includes('--force');
  const result = await prepareOpenClawRuntime({ forcePrepare });
  const { verifyDesktopOpenClawReleaseAssets } = await import('./verify-desktop-openclaw-release-assets.mjs');
  await verifyDesktopOpenClawReleaseAssets({
    resourceDir: result.resourceDir,
    target: resolveRequestedOpenClawTarget(),
  });
  const action = result.strategy === 'reused-existing' ? 'Reused' : 'Prepared';
  console.log(
    `${action} packaged OpenClaw runtime ${result.manifest.openclawVersion} for ${result.manifest.platform}-${result.manifest.arch} at ${result.resourceDir} (${result.strategy})`,
  );
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
