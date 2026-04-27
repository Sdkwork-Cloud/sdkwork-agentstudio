#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveDesktopCargoTargetDir } from './desktop-cargo-target.mjs';
import { withRustToolchainPath } from './ensure-tauri-rust-toolchain.mjs';
import { buildDesktopReleaseEnv, parseDesktopTargetTriple } from './release/desktop-targets.mjs';
import { createTauriCliPlan } from './run-tauri-cli.mjs';
import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveDesktopBundleTargets,
  serializeBundleTargets,
} from './release/release-profiles.mjs';
import {
  resolveBundledResourceMirrorBaseDir,
  resolvePackagedOpenClawResourceDir,
  syncWindowsPackagedOpenClawAliasRoot,
} from './prepare-openclaw-runtime.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const desktopPackageDir = path.join(rootDir, 'packages', 'sdkwork-claw-desktop');
const desktopSrcTauriDir = path.join(desktopPackageDir, 'src-tauri');
const defaultBundleOverlayConfig = path.join(
  desktopPackageDir,
  'src-tauri',
  'generated',
  'tauri.bundle.overlay.json',
);
const defaultWindowsConfigPath = path.join(
  desktopPackageDir,
  'src-tauri',
  'tauri.windows.conf.json',
);
const defaultWindowsRuntimeOverlayConfigPath = path.join(
  desktopPackageDir,
  'src-tauri',
  'generated',
  'tauri.windows.runtime.overlay.json',
);
const defaultWindowsBeforeBuildScriptPath = path.join(
  desktopPackageDir,
  'src-tauri',
  'generated',
  'tauri.windows.before-build.cmd',
);
const desktopTauriConfig = JSON.parse(
  fs.readFileSync(path.join(desktopSrcTauriDir, 'tauri.conf.json'), 'utf8'),
);
const commandEnv = withRustToolchainPath(process.env);
const WINDOWS_NSIS_RETRY_TARGET_SOFT_LIMIT = 240;
const windowsNsisShortSourceSpecs = [
  ['generated', 'bundled', ['generated', 'bundled'], true],
  ['bridge-bundled', 'bundled', ['generated', 'br', 'b'], true],
  ['openclaw', 'openclaw', ['resources', 'openclaw'], false],
  ['web-dist', 'web-dist', ['..', 'dist'], false],
  ['bridge-web-dist', 'web-dist', ['generated', 'br', 'w'], true],
  ['bridge-openclaw', 'openclaw', ['generated', 'br', 'o'], false],
];

function buildWindowsBeforeBuildScriptContent({
  workspaceRootDir = rootDir,
  nodeExecutable = process.execPath,
  viteMode = String(process.env.SDKWORK_VITE_MODE ?? '').trim() || 'production',
} = {}) {
  const normalizedViteMode = String(viteMode ?? '').trim().toLowerCase() || 'production';
  const nodeCommand = `"${nodeExecutable}"`;
  const prepareScriptPath = path.join(workspaceRootDir, 'scripts', 'prepare-shared-sdk-packages.mjs');
  const viteScriptPath = path.join(workspaceRootDir, 'scripts', 'run-vite-host.mjs');
  const verifyScriptPath = path.join(workspaceRootDir, 'scripts', 'verify-desktop-build-assets.mjs');
  const viteModeArgs = normalizedViteMode === 'production' ? '' : ` --mode ${normalizedViteMode}`;

  return [
    '@echo off',
    `${nodeCommand} "${prepareScriptPath}"`,
    'if errorlevel 1 exit /b %errorlevel%',
    `${nodeCommand} "${viteScriptPath}" build${viteModeArgs}`,
    'if errorlevel 1 exit /b %errorlevel%',
    `${nodeCommand} "${verifyScriptPath}"`,
    'if errorlevel 1 exit /b %errorlevel%',
  ].join('\r\n');
}

export function buildWindowsBeforeBuildCommand({
  beforeBuildScriptPath = defaultWindowsBeforeBuildScriptPath,
  workspaceRootDir = rootDir,
} = {}) {
  return path.isAbsolute(beforeBuildScriptPath)
    ? beforeBuildScriptPath
    : path.resolve(workspaceRootDir, beforeBuildScriptPath);
}

export function ensureWindowsTauriBuildRuntimeOverlay({
  overlayFilePath = defaultWindowsRuntimeOverlayConfigPath,
  beforeBuildScriptPath = defaultWindowsBeforeBuildScriptPath,
  workspaceRootDir = rootDir,
  nodeExecutable = process.execPath,
  viteMode = String(process.env.SDKWORK_VITE_MODE ?? '').trim() || 'production',
} = {}) {
  const resolvedOverlayFilePath = path.isAbsolute(overlayFilePath)
    ? overlayFilePath
    : path.resolve(workspaceRootDir, overlayFilePath);
  const resolvedBeforeBuildScriptPath = path.isAbsolute(beforeBuildScriptPath)
    ? beforeBuildScriptPath
    : path.resolve(workspaceRootDir, beforeBuildScriptPath);
  fs.mkdirSync(path.dirname(resolvedBeforeBuildScriptPath), { recursive: true });
  fs.writeFileSync(
    resolvedBeforeBuildScriptPath,
    `${buildWindowsBeforeBuildScriptContent({
      workspaceRootDir,
      nodeExecutable,
      viteMode,
    })}\r\n`,
    'utf8',
  );
  const overlayContent = {
    build: {
      beforeBuildCommand: buildWindowsBeforeBuildCommand({
        beforeBuildScriptPath: resolvedBeforeBuildScriptPath,
        workspaceRootDir,
      }),
    },
  };

  fs.mkdirSync(path.dirname(resolvedOverlayFilePath), { recursive: true });
  fs.writeFileSync(resolvedOverlayFilePath, `${JSON.stringify(overlayContent, null, 2)}\n`, 'utf8');
  return resolvedOverlayFilePath;
}

export function buildWindowsTauriBundleCommand({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  configPath = defaultBundleOverlayConfig,
  targetTriple = '',
  bundleTargets = [],
  env = process.env,
  platform = process.platform,
  execPath = process.execPath,
  cwd = desktopPackageDir,
  resolveTauriCliEntrypoint,
  beforeBuildCommandConfigPath = defaultWindowsRuntimeOverlayConfigPath,
} = {}) {
  const resolvedWindowsConfigPath = defaultWindowsConfigPath;
  const resolvedConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(rootDir, configPath);
  const resolvedBeforeBuildCommandConfigPath = path.isAbsolute(beforeBuildCommandConfigPath)
    ? beforeBuildCommandConfigPath
    : path.resolve(rootDir, beforeBuildCommandConfigPath);
  const resolvedBundleTargets = resolveDesktopBundleTargets({
    profileId,
    platform: 'windows',
    targetTriple,
    bundleTargets,
  });
  return createTauriCliPlan({
    argv: [
      'build',
      '--config',
      path.relative(cwd, resolvedWindowsConfigPath).replaceAll('\\', '/'),
      '--config',
      path.relative(cwd, resolvedConfigPath).replaceAll('\\', '/'),
      '--config',
      path.relative(cwd, resolvedBeforeBuildCommandConfigPath).replaceAll('\\', '/'),
      '--bundles',
      serializeBundleTargets(resolvedBundleTargets),
      ...(String(targetTriple ?? '').trim().length > 0 ? ['--target', targetTriple] : []),
    ],
    env,
    platform,
    cwd,
    execPath,
    resolveTauriCliEntrypoint,
  });
}

export function buildWindowsTauriBundlePreflightCommand({
  targetTriple = '',
  env = process.env,
} = {}) {
  const requestedTargetTriple = String(targetTriple ?? '').trim();
  const targetEnv = requestedTargetTriple
    ? buildDesktopReleaseEnv({
        env,
        targetTriple: requestedTargetTriple,
      })
    : buildDesktopReleaseEnv({
        env,
        platform: 'windows',
        arch: resolveWindowsNsisArchDir(requestedTargetTriple),
      });

  return {
    command: process.execPath,
    args: ['scripts/verify-desktop-openclaw-release-assets.mjs'],
    cwd: rootDir,
    env: targetEnv,
  };
}

export async function ensureWindowsBundleOpenClawAliasRoot({
  workspaceRootDir = rootDir,
  platform = process.platform,
  resolvePackagedOpenClawResourceDirImpl = resolvePackagedOpenClawResourceDir,
  syncWindowsPackagedOpenClawAliasRootImpl = syncWindowsPackagedOpenClawAliasRoot,
} = {}) {
  const normalizedPlatform = platform === 'windows' ? 'win32' : platform;
  if (normalizedPlatform !== 'win32') {
    return null;
  }

  const packagedResourceDir = resolvePackagedOpenClawResourceDirImpl(
    workspaceRootDir,
    'windows',
  );
  return await syncWindowsPackagedOpenClawAliasRootImpl({
    workspaceRootDir,
    packagedResourceDir,
    platform: normalizedPlatform,
  });
}

function resolveExistingPathTarget(candidatePath) {
  try {
    return fs.realpathSync.native(candidatePath);
  } catch {
    return null;
  }
}

function resolveWindowsMirrorBaseDir(workspaceRootDir, env = process.env) {
  return resolveBundledResourceMirrorBaseDir(workspaceRootDir, env, 'win32');
}

function normalizeWindowsComparablePath(value = '') {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return '';
  }

  return path.win32.normalize(normalizedValue).replace(/[\\/]+$/, '').toLowerCase();
}

function normalizeWindowsTargetRoot(value = '') {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return '';
  }

  return path.win32.normalize(normalizedValue).replace(/[\\/]+$/, '');
}

function resolveMaxNestedSourcePathLength(sourceRoot, actualTargetRoot) {
  const normalizedActualTargetRoot = normalizeWindowsTargetRoot(actualTargetRoot);
  if (!normalizedActualTargetRoot || !fs.existsSync(normalizedActualTargetRoot)) {
    return 0;
  }

  const stack = [normalizedActualTargetRoot];
  let maxNestedSourcePathLength = 0;

  while (stack.length > 0) {
    const currentRoot = stack.pop();
    const entries = fs.readdirSync(currentRoot, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.win32.join(currentRoot, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const nestedSourcePathLength = path.win32
        .relative(normalizedActualTargetRoot, absolutePath)
        .length;
      if (nestedSourcePathLength > maxNestedSourcePathLength) {
        maxNestedSourcePathLength = nestedSourcePathLength;
      }
    }
  }

  return maxNestedSourcePathLength;
}

function buildWindowsNsisRetryAliasRoot({
  workspaceRootDir = rootDir,
  mirrorDirName = '',
  actualTargetRoot = '',
} = {}) {
  const normalizedActualTargetRoot = normalizeWindowsTargetRoot(actualTargetRoot);
  if (!normalizedActualTargetRoot) {
    return '';
  }

  const shortWorkspaceRoot = path.win32.join(
    path.win32.parse(workspaceRootDir).root,
    '.sdkwork-bc',
    path.win32.basename(workspaceRootDir),
  );
  const normalizedMirrorDirName = String(mirrorDirName ?? '').trim();
  if (!normalizedMirrorDirName) {
    return normalizedActualTargetRoot;
  }

  const targetLeafName = path.win32.basename(normalizedActualTargetRoot);
  if (
    normalizedMirrorDirName === 'bundled'
    && targetLeafName
    && targetLeafName.toLowerCase().startsWith('bundled-')
  ) {
    return path.win32.join(shortWorkspaceRoot, 'bundled-mirrors', targetLeafName);
  }

  return path.win32.join(shortWorkspaceRoot, normalizedMirrorDirName);
}

function buildProjectedWindowsSourcePathLength(targetRoot, maxNestedSourcePathLength = 0) {
  const normalizedTargetRoot = normalizeWindowsTargetRoot(targetRoot);
  if (!normalizedTargetRoot) {
    return 0;
  }

  const normalizedMaxNestedSourcePathLength = Math.max(
    0,
    Math.trunc(Number(maxNestedSourcePathLength) || 0),
  );
  return normalizedTargetRoot.length + (normalizedMaxNestedSourcePathLength > 0 ? 1 : 0) + normalizedMaxNestedSourcePathLength;
}

function shouldUseWindowsNsisRetryAliasRoot(
  actualTargetRoot,
  aliasTargetRoot,
  maxNestedSourcePathLength = 0,
) {
  const normalizedActualTargetRoot = normalizeWindowsTargetRoot(actualTargetRoot);
  const normalizedAliasTargetRoot = normalizeWindowsTargetRoot(aliasTargetRoot);
  if (!normalizedActualTargetRoot || !normalizedAliasTargetRoot) {
    return false;
  }

  const projectedActualTargetLength = buildProjectedWindowsSourcePathLength(
    normalizedActualTargetRoot,
    maxNestedSourcePathLength,
  );
  const projectedAliasTargetLength = buildProjectedWindowsSourcePathLength(
    normalizedAliasTargetRoot,
    maxNestedSourcePathLength,
  );

  return (
    projectedActualTargetLength > WINDOWS_NSIS_RETRY_TARGET_SOFT_LIMIT
    && projectedAliasTargetLength < projectedActualTargetLength
  );
}

export function resolveWindowsNsisSourceReplacementPlans(
  workspaceRootDir = rootDir,
  {
    env = process.env,
    resolvePathTargetImpl = resolveExistingPathTarget,
    resolveMaxNestedSourcePathLengthImpl = resolveMaxNestedSourcePathLength,
  } = {},
) {
  const windowsMirrorBaseDir = resolveWindowsMirrorBaseDir(workspaceRootDir, env);
  const desktopSrcTauriWinDir = path.win32.join(
    workspaceRootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
  );

  return windowsNsisShortSourceSpecs.map(([
    _,
    mirrorDirName,
    relativeSourceSegments,
    preferResolvedTarget,
  ]) => {
    const sourceRoot = path.win32.join(desktopSrcTauriWinDir, ...relativeSourceSegments);
    const fallbackTargetRoot = path.win32.join(windowsMirrorBaseDir, mirrorDirName);
    const resolvedTargetRoot =
      preferResolvedTarget && typeof resolvePathTargetImpl === 'function'
        ? resolvePathTargetImpl(sourceRoot)
        : null;
    const actualTargetRoot = normalizeWindowsTargetRoot(resolvedTargetRoot || fallbackTargetRoot);
    const aliasTargetRoot = buildWindowsNsisRetryAliasRoot({
      workspaceRootDir,
      mirrorDirName,
      actualTargetRoot,
    });
    const maxNestedSourcePathLength =
      typeof resolveMaxNestedSourcePathLengthImpl === 'function'
        ? resolveMaxNestedSourcePathLengthImpl(sourceRoot, actualTargetRoot)
        : 0;
    const replacementTargetRoot = shouldUseWindowsNsisRetryAliasRoot(
      actualTargetRoot,
      aliasTargetRoot,
      maxNestedSourcePathLength,
    )
      ? aliasTargetRoot
      : actualTargetRoot;

    return {
      mirrorDirName,
      sourceRoot,
      from: `${sourceRoot}\\`,
      to: `${replacementTargetRoot}\\`,
      actualTargetRoot,
    };
  });
}

export function createWindowsNsisSourceReplacements(
  workspaceRootDir = rootDir,
  options = {},
) {
  return resolveWindowsNsisSourceReplacementPlans(workspaceRootDir, options)
    .map(({ from, to }) => ({ from, to }));
}

export const createWindowsNsisBridgeReplacements = createWindowsNsisSourceReplacements;

export function ensureWindowsNsisRetrySourceAliases({
  plans = resolveWindowsNsisSourceReplacementPlans(rootDir),
  pathExistsImpl = (targetPath) => fs.existsSync(targetPath),
  mkdirImpl = (targetPath, options) => fs.mkdirSync(targetPath, options),
  rmImpl = (targetPath, options) => fs.rmSync(targetPath, options),
  symlinkImpl = (targetPath, aliasPath, type) => fs.symlinkSync(targetPath, aliasPath, type),
  resolvePathTargetImpl = resolveExistingPathTarget,
} = {}) {
  const createdAliasRoots = new Set();

  for (const plan of Array.isArray(plans) ? plans : []) {
    const actualTargetRoot = normalizeWindowsTargetRoot(plan?.actualTargetRoot);
    const aliasTargetRoot = normalizeWindowsTargetRoot(plan?.to);
    if (!actualTargetRoot || !aliasTargetRoot) {
      continue;
    }
    if (normalizeWindowsComparablePath(actualTargetRoot) === normalizeWindowsComparablePath(aliasTargetRoot)) {
      continue;
    }
    if (createdAliasRoots.has(normalizeWindowsComparablePath(aliasTargetRoot))) {
      continue;
    }
    if (typeof pathExistsImpl === 'function' && !pathExistsImpl(actualTargetRoot)) {
      continue;
    }

    const resolvedAliasTarget =
      typeof resolvePathTargetImpl === 'function'
        ? resolvePathTargetImpl(aliasTargetRoot)
        : null;
    if (
      normalizeWindowsComparablePath(resolvedAliasTarget)
      === normalizeWindowsComparablePath(actualTargetRoot)
    ) {
      createdAliasRoots.add(normalizeWindowsComparablePath(aliasTargetRoot));
      continue;
    }

    if (typeof pathExistsImpl === 'function' && pathExistsImpl(aliasTargetRoot)) {
      rmImpl(aliasTargetRoot, { recursive: true, force: true });
    }
    mkdirImpl(path.win32.dirname(aliasTargetRoot), { recursive: true });
    symlinkImpl(actualTargetRoot, aliasTargetRoot, 'junction');
    createdAliasRoots.add(normalizeWindowsComparablePath(aliasTargetRoot));
  }
}

export function rewriteNsisSourcePaths(
  installerContent,
  replacements = createWindowsNsisSourceReplacements(),
) {
  let nextContent = String(installerContent ?? '');

  for (const replacement of replacements) {
    nextContent = nextContent.split(replacement.from).join(replacement.to);
  }

  return nextContent;
}

export function prepareWindowsNsisRetryScript({
  installerContent,
  workspaceRootDir = rootDir,
  outputFilePath,
} = {}) {
  let nextContent = rewriteNsisSourcePaths(
    installerContent,
    createWindowsNsisSourceReplacements(workspaceRootDir),
  );

  if (typeof outputFilePath === 'string' && outputFilePath.trim().length > 0) {
    nextContent = nextContent.replace(
      /^!define OUTFILE ".*"$/mu,
      `!define OUTFILE "${outputFilePath.trim()}"`,
    );
  }

  return nextContent;
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    configPath: defaultBundleOverlayConfig,
    targetTriple: String(process.env.SDKWORK_DESKTOP_TARGET ?? '').trim(),
    bundleTargets: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--config') {
      options.configPath = readOptionValue(argv, index, '--config');
      index += 1;
      continue;
    }

    if (token === '--target') {
      options.targetTriple = readOptionValue(argv, index, '--target');
      index += 1;
      continue;
    }

    if (token === '--bundles') {
      options.bundleTargets = readOptionValue(argv, index, '--bundles')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  return options;
}

function runCommand(command, args, options = {}) {
  const useWindowsShell =
    process.platform === 'win32' &&
    ['.cmd', '.bat'].includes(path.extname(command).toLowerCase());

  return spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: {
      ...commandEnv,
      ...(options.env ?? {}),
    },
    shell: options.shell ?? useWindowsShell,
    stdio: 'inherit',
    windowsHide: true,
  });
}

function resolveWindowsNsisArchDir(targetTriple = '') {
  const requestedTargetTriple = String(targetTriple ?? '').trim();
  if (requestedTargetTriple.length > 0) {
    return parseDesktopTargetTriple(requestedTargetTriple).arch === 'arm64' ? 'arm64' : 'x64';
  }

  return String(process.env.SDKWORK_DESKTOP_TARGET_ARCH ?? '').trim().toLowerCase() === 'arm64'
    ? 'arm64'
    : 'x64';
}

function buildReleaseRootCandidates(targetTriple = '') {
  const requestedTargetTriple = String(targetTriple ?? '').trim();
  const desktopTargetDir = resolveDesktopCargoTargetDir({
    workspaceRootDir: rootDir,
    desktopPackageDir,
    env: process.env,
    platform: process.platform,
    cwd: rootDir,
  });
  const releaseRoots = [];
  if (requestedTargetTriple.length > 0) {
    releaseRoots.push(path.join(desktopTargetDir, requestedTargetTriple, 'release'));
  }
  releaseRoots.push(path.join(desktopTargetDir, 'release'));
  return [...new Set(releaseRoots)];
}

function resolveExistingInstallerScriptPath(targetTriple = '') {
  return resolveWindowsNsisArtifacts(targetTriple).installerScriptPath;
}

function installerScriptLooksRecoverable(installerScriptPath, buildStartedAtMs) {
  if (!installerScriptPath || !fs.existsSync(installerScriptPath)) {
    return false;
  }

  const installerStat = fs.statSync(installerScriptPath);
  if (installerStat.mtimeMs < buildStartedAtMs) {
    return false;
  }

  const installerContent = fs.readFileSync(installerScriptPath, 'utf8');
  return createWindowsNsisSourceReplacements(rootDir).some((replacement) =>
    installerContent.includes(replacement.from),
  );
}

function resolveMakensisExecutable() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA ?? '', 'tauri', 'NSIS', 'makensis.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'tauri', 'NSIS', 'Bin', 'makensis.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'electron-builder', 'Cache', 'nsis', 'nsis-3.0.4.1', 'makensis.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'electron-builder', 'Cache', 'nsis', 'nsis-3.0.4.1', 'Bin', 'makensis.exe'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const commandProbe = spawnSync('where.exe', ['makensis'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  if (commandProbe.status === 0) {
    const resolved = String(commandProbe.stdout ?? '')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean);
    if (resolved) {
      return resolved;
    }
  }

  throw new Error('Unable to locate makensis.exe for Windows NSIS retry.');
}

function buildWindowsNsisBundleFileName(archDir) {
  return `${desktopTauriConfig.productName}_${desktopTauriConfig.version}_${archDir}-setup.exe`;
}

function resolveWindowsNsisArtifacts(targetTriple = '') {
  const archDir = resolveWindowsNsisArchDir(targetTriple);
  const releaseRootCandidates = buildReleaseRootCandidates(targetTriple);
  const releaseRoot =
    releaseRootCandidates.find((candidate) =>
      fs.existsSync(path.join(candidate, 'nsis', archDir, 'installer.nsi')),
    ) ?? releaseRootCandidates[0];

  return {
    archDir,
    releaseRoot,
    installerScriptPath: path.join(releaseRoot, 'nsis', archDir, 'installer.nsi'),
    nsisOutputPath: path.join(releaseRoot, 'nsis', archDir, 'nsis-output.exe'),
    bundleOutputPath: path.join(
      releaseRoot,
      'bundle',
      'nsis',
      buildWindowsNsisBundleFileName(archDir),
    ),
  };
}

function retryNsisBundleWithShortSourcePaths({
  targetTriple = '',
  buildStartedAtMs,
}) {
  const artifacts = resolveWindowsNsisArtifacts(targetTriple);
  if (!installerScriptLooksRecoverable(artifacts.installerScriptPath, buildStartedAtMs)) {
    return false;
  }

  const originalInstaller = fs.readFileSync(artifacts.installerScriptPath, 'utf8');
  const replacementPlans = resolveWindowsNsisSourceReplacementPlans(rootDir);
  ensureWindowsNsisRetrySourceAliases({
    plans: replacementPlans,
  });
  const rewrittenInstaller = prepareWindowsNsisRetryScript({
    installerContent: originalInstaller,
    workspaceRootDir: rootDir,
    outputFilePath: artifacts.bundleOutputPath,
  });

  if (rewrittenInstaller === originalInstaller) {
    return false;
  }

  fs.mkdirSync(path.dirname(artifacts.bundleOutputPath), { recursive: true });
  fs.rmSync(artifacts.nsisOutputPath, { force: true });
  fs.rmSync(artifacts.bundleOutputPath, { force: true });
  fs.writeFileSync(artifacts.installerScriptPath, rewrittenInstaller, 'utf8');

  console.warn(
    '[windows-tauri-bundle] retrying makensis with short absolute OpenClaw bridge source paths',
  );

  const makensisPath = resolveMakensisExecutable();
  const result = runCommand(
    makensisPath,
    [path.basename(artifacts.installerScriptPath)],
    {
      cwd: path.dirname(artifacts.installerScriptPath),
      shell: false,
    },
  );

  return (
    result.status === 0 &&
    !result.error &&
    !result.signal &&
    fs.existsSync(artifacts.bundleOutputPath)
  );
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('run-windows-tauri-bundle.mjs only supports Windows hosts');
  }

  const options = parseArgs(process.argv.slice(2));
  const preflightPlan = buildWindowsTauriBundlePreflightCommand({
    targetTriple: options.targetTriple,
  });
  const preflightResult = runCommand(preflightPlan.command, preflightPlan.args, {
    cwd: preflightPlan.cwd,
    env: preflightPlan.env,
    shell: false,
  });
  if (preflightResult.error) {
    throw preflightResult.error;
  }
  if (preflightResult.signal) {
    console.error(
      `[windows-tauri-bundle] OpenClaw release-asset preflight exited with signal ${preflightResult.signal}`,
    );
    process.exit(1);
  }
  if ((preflightResult.status ?? 1) !== 0) {
    process.exit(preflightResult.status ?? 1);
  }
  await ensureWindowsBundleOpenClawAliasRoot({
    workspaceRootDir: rootDir,
    platform: process.platform,
  });
  const runtimeOverlayConfigPath = ensureWindowsTauriBuildRuntimeOverlay({
    workspaceRootDir: rootDir,
    nodeExecutable: process.execPath,
    viteMode: String(process.env.SDKWORK_VITE_MODE ?? '').trim() || 'production',
  });
  const buildPlan = buildWindowsTauriBundleCommand({
    profileId: options.profileId,
    configPath: options.configPath,
    targetTriple: options.targetTriple,
    bundleTargets: options.bundleTargets,
    beforeBuildCommandConfigPath: runtimeOverlayConfigPath,
  });
  const buildStartedAtMs = Date.now();
  const buildResult = runCommand(buildPlan.command, buildPlan.args, {
    cwd: buildPlan.cwd ?? rootDir,
    shell: buildPlan.shell,
  });

  if (!buildResult.error && !buildResult.signal && buildResult.status === 0) {
    process.exit(0);
  }

  if (
    retryNsisBundleWithShortSourcePaths({
      targetTriple: options.targetTriple,
      buildStartedAtMs,
    })
  ) {
    process.exit(0);
  }

  if (buildResult.error) {
    throw buildResult.error;
  }

  if (buildResult.signal) {
    console.error(`[windows-tauri-bundle] tauri build exited with signal ${buildResult.signal}`);
    process.exit(1);
  }

  process.exit(buildResult.status ?? 1);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
