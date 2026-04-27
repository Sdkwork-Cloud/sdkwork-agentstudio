#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  resolveDesktopCargoTargetDir,
} from '../desktop-cargo-target.mjs';
import {
  normalizeDesktopArch,
  resolveDesktopReleaseTarget,
} from './desktop-targets.mjs';
import {
  readDesktopOpenClawInstallerContract,
} from './desktop-openclaw-installer-contract.mjs';
import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import {
  DEFAULT_KERNEL_PACKAGE_PROFILE_ID,
  resolveKernelPackageProfile,
} from './kernel-package-profiles.mjs';
import {
  normalizeKernelInstallContracts,
  writeKernelInstallContract,
} from './kernel-install-contracts.mjs';
import {
  resolveCliPath,
} from './path-inputs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const webDistDir = path.join(rootDir, 'packages', 'sdkwork-claw-web', 'dist');
const docsDistDir = path.join(rootDir, 'docs', '.vitepress', 'dist');
const serverPackageDir = path.join(rootDir, 'packages', 'sdkwork-claw-server');
const serverTargetDir = path.join(serverPackageDir, 'src-host', 'target');
const serverEnvExamplePath = path.join(serverPackageDir, '.env.example');
const desktopTargetDir = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'target',
);
const desktopTauriConfigPath = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'tauri.conf.json',
);
const dockerDeploymentDir = path.join(rootDir, 'deploy', 'docker');
const kubernetesDeploymentDir = path.join(rootDir, 'deploy', 'kubernetes');
const DEFAULT_SERVER_BINARY_NAME = 'claw-server';
const DEFAULT_DEPLOYMENT_ACCELERATOR = 'cpu';
const DEFAULT_KUBERNETES_IMAGE_REPOSITORY = 'claw-studio-server';
const SUPPORTED_DEPLOYMENT_ACCELERATORS = new Set([
  'cpu',
  'nvidia-cuda',
  'amd-rocm',
]);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

const desktopBundleRules = {
  windows: {
    directories: new Set(['msi', 'nsis']),
    suffixes: ['.msi', '.exe'],
  },
  linux: {
    directories: new Set(['appimage', 'deb', 'rpm']),
    suffixes: ['.appimage', '.deb', '.rpm'],
  },
  macos: {
    directories: new Set(['dmg', 'macos']),
    suffixes: ['.dmg', '.app.tar.gz', '.app.zip', '.zip'],
  },
};

function removeLegacyDesktopOutputPaths({
  outputDir,
  platformId,
}) {
  const desktopBundleRule = desktopBundleRules[platformId];
  if (!desktopBundleRule) {
    return;
  }

  const legacyPlatformOutputDir = path.join(outputDir, 'desktop', platformId);
  for (const bundleDirectory of desktopBundleRule.directories) {
    rmSync(path.join(legacyPlatformOutputDir, bundleDirectory), { recursive: true, force: true });
  }
  rmSync(path.join(legacyPlatformOutputDir, 'release-asset-manifest.json'), { force: true });
}

export function normalizePlatformId(platform = process.platform) {
  if (platform === 'win32' || platform === 'windows') {
    return 'windows';
  }
  if (platform === 'darwin' || platform === 'macos') {
    return 'macos';
  }
  if (platform === 'linux') {
    return 'linux';
  }

  throw new Error(`Unsupported release platform: ${platform}`);
}

export function normalizeDeploymentAccelerator(accelerator = DEFAULT_DEPLOYMENT_ACCELERATOR) {
  const normalizedAccelerator = String(accelerator ?? '')
    .trim()
    .toLowerCase() || DEFAULT_DEPLOYMENT_ACCELERATOR;

  if (!SUPPORTED_DEPLOYMENT_ACCELERATORS.has(normalizedAccelerator)) {
    throw new Error(`Unsupported deployment accelerator: ${accelerator}`);
  }

  return normalizedAccelerator;
}

function resolveEffectiveKernelPackageProfile({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  packageProfileId = '',
} = {}) {
  const releaseProfile = resolveReleaseProfile(profileId);
  return resolveKernelPackageProfile(
    String(packageProfileId ?? '').trim()
      || releaseProfile.defaultPackageProfileId
      || DEFAULT_KERNEL_PACKAGE_PROFILE_ID,
  );
}

export function buildServerArchiveBaseName({
  releaseTag,
  platform,
  arch,
} = {}) {
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const normalizedPlatform = normalizePlatformId(platform);
  const normalizedArch = normalizeDesktopArch(arch);

  if (!normalizedReleaseTag) {
    throw new Error('releaseTag is required to package server release assets.');
  }

  return `claw-studio-server-${normalizedReleaseTag}-${normalizedPlatform}-${normalizedArch}`;
}

export function buildDeploymentBundleBaseName({
  family,
  releaseTag,
  platform = 'linux',
  arch,
  accelerator = DEFAULT_DEPLOYMENT_ACCELERATOR,
} = {}) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const normalizedPlatform = normalizePlatformId(platform);
  const normalizedArch = normalizeDesktopArch(arch);
  const normalizedAccelerator = normalizeDeploymentAccelerator(accelerator);

  if (!normalizedReleaseTag) {
    throw new Error('releaseTag is required to package deployment release assets.');
  }
  if (normalizedFamily !== 'container' && normalizedFamily !== 'kubernetes') {
    throw new Error(`Unsupported deployment family: ${family}`);
  }

  return `claw-studio-${normalizedFamily}-bundle-${normalizedReleaseTag}-${normalizedPlatform}-${normalizedArch}-${normalizedAccelerator}`;
}

function buildServerBinaryMissingHint(targetTriple = '') {
  const normalizedTargetTriple = String(targetTriple ?? '').trim();
  if (normalizedTargetTriple.length > 0) {
    return ` Build a matching native server binary first with "pnpm server:build -- --target ${normalizedTargetTriple}".`;
  }

  return ' Build a native server binary first with "pnpm server:build".';
}

function buildDesktopBundleMissingHint() {
  return ' Run "pnpm release:desktop" or "pnpm tauri:build" first. "pnpm release:package:desktop" only collects installers and app bundles that were already produced by the desktop release build.';
}

function resolveServerBinaryFileName(platformId) {
  return normalizePlatformId(platformId) === 'windows'
    ? `${DEFAULT_SERVER_BINARY_NAME}.exe`
    : DEFAULT_SERVER_BINARY_NAME;
}

function buildServerBinaryCandidates({
  targetTriple = '',
  targetDir = serverTargetDir,
  platform = process.platform,
} = {}) {
  const binaryFileName = resolveServerBinaryFileName(platform);
  const normalizedTargetTriple = String(targetTriple ?? '').trim();
  if (normalizedTargetTriple) {
    return [path.join(targetDir, normalizedTargetTriple, 'release', binaryFileName)];
  }

  return [path.join(targetDir, 'release', binaryFileName)];
}

function resolveExistingServerBinaryPath({
  targetTriple = '',
  targetDir = serverTargetDir,
  platform = process.platform,
} = {}) {
  const candidates = buildServerBinaryCandidates({
    targetTriple,
    targetDir,
    platform,
  });
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function buildArchiveExtension(format) {
  return format === 'zip' ? 'zip' : 'tar.gz';
}

function resolveSpawnCommand(command, platform = process.platform) {
  if (platform !== 'win32') {
    return command;
  }

  if (path.extname(command)) {
    return command;
  }

  const systemRoot =
    String(process.env.SystemRoot ?? process.env.WINDIR ?? '').trim() || 'C:\\Windows';

  if (command === 'tar') {
    const tarPath = path.join(systemRoot, 'System32', 'tar.exe');
    return existsSync(tarPath) ? tarPath : 'tar.exe';
  }

  if (command === 'powershell') {
    const powershellPath = path.join(
      systemRoot,
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe',
    );
    return existsSync(powershellPath) ? powershellPath : 'powershell.exe';
  }

  return command;
}

export function createTarArchivePlan({
  archivePath,
  workingDirectory,
  entryName,
  platform = process.platform,
  cwd = rootDir,
} = {}) {
  return {
    command: resolveSpawnCommand('tar', platform),
    args: ['-czf', archivePath, '-C', workingDirectory, entryName],
    cwd,
    stdio: 'inherit',
    shell: false,
  };
}

function createDirectoryArchive({
  sourceDir,
  archivePath,
  format,
}) {
  const archiveFormat = buildArchiveExtension(format);
  if (archiveFormat === 'zip') {
    runZipCommand(archivePath, path.dirname(sourceDir), path.basename(sourceDir));
    return;
  }

  runTarCommand(archivePath, path.dirname(sourceDir), path.basename(sourceDir));
}

function writeServerLauncherScripts(bundleRoot, platformId) {
  const serverBinaryName = resolveServerBinaryFileName(platformId);
  const unixLauncherPath = path.join(bundleRoot, 'start-claw-server.sh');
  const windowsLauncherPath = path.join(bundleRoot, 'start-claw-server.cmd');

  writeFileSync(
    unixLauncherPath,
    [
      '#!/usr/bin/env sh',
      'set -eu',
      'SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"',
      'export CLAW_SERVER_WEB_DIST="${CLAW_SERVER_WEB_DIST:-$SCRIPT_DIR/web/dist}"',
      'export CLAW_SERVER_DATA_DIR="${CLAW_SERVER_DATA_DIR:-$SCRIPT_DIR/.claw-server}"',
      'exec "$SCRIPT_DIR/bin/' + serverBinaryName + '" "$@"',
      '',
    ].join('\n'),
    'utf8',
  );
  writeFileSync(
    windowsLauncherPath,
    [
      '@echo off',
      'setlocal',
      'set "SCRIPT_DIR=%~dp0"',
      'if not defined CLAW_SERVER_WEB_DIST set "CLAW_SERVER_WEB_DIST=%SCRIPT_DIR%web\\dist"',
      'if not defined CLAW_SERVER_DATA_DIR set "CLAW_SERVER_DATA_DIR=%SCRIPT_DIR%.claw-server"',
      `"%SCRIPT_DIR%bin\\${serverBinaryName}" %*`,
      '',
    ].join('\r\n'),
    'utf8',
  );

  if (platformId !== 'windows') {
    chmodSync(unixLauncherPath, 0o755);
  }
}

function writeServerRuntimeReadme({
  bundleRoot,
  releaseTag,
  platformId,
  archId,
}) {
  const canonicalBinaryCommand = platformId === 'windows'
    ? '.\\bin\\claw-server.exe'
    : './bin/claw-server';
  writeFileSync(
    path.join(bundleRoot, 'README.md'),
    [
      '# Claw Studio Server Bundle',
      '',
      `Release: ${releaseTag}`,
      `Platform: ${platformId}`,
      `Architecture: ${archId}`,
      '',
      '## Start',
      '',
      'Run the canonical bundled server binary from the extracted directory root:',
      '',
      '```bash',
      canonicalBinaryCommand,
      '```',
      '',
      'When launched from a packaged bundle, the native binary automatically defaults',
      '`CLAW_SERVER_WEB_DIST` to the bundled `web/dist` folder and',
      '`CLAW_SERVER_DATA_DIR` to `.claw-server` inside the extracted bundle.',
      '`start-claw-server.sh` and `start-claw-server.cmd` remain optional convenience wrappers',
      'around the same native binary.',
      '',
      '## Environment',
      '',
      '- Copy `.env.example` and adjust `CLAW_SERVER_HOST`, `CLAW_SERVER_PORT`, and data paths as needed.',
      '- Override `CLAW_SERVER_WEB_DIST` only if you want the server to serve a different web build.',
      '',
      '## Browser access',
      '',
      'After startup, open `http://<host>:<port>` in a browser to manage the server-hosted application.',
      '',
    ].join('\n'),
    'utf8',
  );
}

function populateServerRuntimeBundle({
  bundleRoot,
  platformId,
  archId,
  releaseTag,
  targetTriple = '',
  serverBuildTargetDir = serverTargetDir,
  serverWebDistDir = webDistDir,
  serverEnvPath = serverEnvExamplePath,
}) {
  const serverBinaryPath = resolveExistingServerBinaryPath({
    targetTriple,
    targetDir: serverBuildTargetDir,
    platform: platformId,
  });
  if (!existsSync(serverBinaryPath)) {
    const candidates = buildServerBinaryCandidates({
      targetTriple,
      targetDir: serverBuildTargetDir,
      platform: platformId,
    }).join(', ');
    throw new Error(
      `Missing server binary output. Checked: ${candidates}.${buildServerBinaryMissingHint(targetTriple)}`,
    );
  }
  if (!existsSync(serverWebDistDir)) {
    throw new Error(`Missing server web dist directory: ${serverWebDistDir}`);
  }
  if (!existsSync(serverEnvPath)) {
    throw new Error(`Missing server env example: ${serverEnvPath}`);
  }

  const binDir = path.join(bundleRoot, 'bin');
  const runtimeWebDir = path.join(bundleRoot, 'web', 'dist');
  ensureDirectory(binDir);
  ensureDirectory(path.dirname(runtimeWebDir));

  const binaryDestinationPath = path.join(binDir, resolveServerBinaryFileName(platformId));
  cpSync(serverBinaryPath, binaryDestinationPath);
  cpSync(serverWebDistDir, runtimeWebDir, { recursive: true });
  cpSync(serverEnvPath, path.join(bundleRoot, '.env.example'));
  writeServerLauncherScripts(bundleRoot, platformId);
  writeServerRuntimeReadme({
    bundleRoot,
    releaseTag,
    platformId,
    archId,
  });

  if (platformId !== 'windows') {
    chmodSync(binaryDestinationPath, 0o755);
  }
}

function writeDeploymentBundleReadme({
  bundleRoot,
  family,
  releaseTag,
  platformId,
  archId,
  accelerator,
  imageRepository = '',
  imageTag = '',
  imageDigest = '',
}) {
  const deploymentCommand = family === 'container'
    ? 'docker compose -f deploy/docker/docker-compose.yml up -d'
    : 'helm upgrade --install claw-studio ./chart -f values.release.yaml';

  writeFileSync(
    path.join(bundleRoot, 'README.md'),
    [
      `# Claw Studio ${family === 'container' ? 'Container' : 'Kubernetes'} Bundle`,
      '',
      `Release: ${releaseTag}`,
      `Platform: ${platformId}`,
      `Architecture: ${archId}`,
      `Accelerator profile: ${accelerator}`,
      '',
      '## Profile model',
      '',
      'The Rust server binary is CPU-neutral. Accelerator variants package deployment overlays',
      'and release metadata for CPU, NVIDIA CUDA, and AMD ROCm-oriented topologies.',
      '',
      '## Default command',
      '',
      '```bash',
      deploymentCommand,
      '```',
      '',
      'See `release-metadata.json` for the selected target architecture and accelerator profile.',
      family === 'kubernetes'
        ? `The generated Helm values pin image tag \`${imageTag}\` for repository \`${imageRepository}\`${
          imageDigest ? ` and also include digest \`${imageDigest}\`` : ''
        }.`
        : 'The generated bundle metadata records the selected deployment family and accelerator profile.',
      '',
    ].join('\n'),
    'utf8',
  );
}

export function shouldIncludeDesktopBundleFile(platformId, relativePath) {
  const normalizedPlatform = normalizePlatformId(platformId);
  const normalizedPath = relativePath.replaceAll('\\', '/');
  const [topLevelDirectory] = normalizedPath.split('/');
  const rule = desktopBundleRules[normalizedPlatform];
  if (!rule.directories.has(topLevelDirectory)) {
    return false;
  }

  const lowerCasePath = normalizedPath.toLowerCase();
  if (
    normalizedPlatform === 'macos'
    && lowerCasePath.endsWith('.dmg')
    && path.posix.basename(normalizedPath).toLowerCase().startsWith('rw.')
  ) {
    return false;
  }

  return rule.suffixes.some((suffix) => lowerCasePath.endsWith(suffix));
}

export function buildWebArchiveBaseName(releaseTag) {
  if (typeof releaseTag !== 'string' || releaseTag.trim().length === 0) {
    throw new Error('releaseTag is required to package web release assets.');
  }

  return `claw-studio-web-assets-${releaseTag.trim()}`;
}

export function buildDesktopBundleRootCandidates({
  targetTriple = '',
  targetDir = '',
  env = process.env,
  hostPlatform = process.platform,
  workspaceRootDir = rootDir,
} = {}) {
  const normalizedTargetTriple = String(targetTriple ?? '').trim();
  const resolvedTargetDir =
    typeof targetDir === 'string' && targetDir.trim().length > 0
      ? path.resolve(targetDir)
      : resolveDesktopCargoTargetDir({
        workspaceRootDir,
        env,
        platform: hostPlatform,
        cwd: workspaceRootDir,
      });
  const candidates = [];

  if (normalizedTargetTriple.length > 0) {
    candidates.push(path.join(resolvedTargetDir, normalizedTargetTriple, 'release', 'bundle'));
  }

  candidates.push(path.join(resolvedTargetDir, 'release', 'bundle'));

  return [...new Set(candidates)];
}

export function resolveDesktopBundleRoot({
  targetTriple = '',
  targetDir = '',
  env = process.env,
  hostPlatform = process.platform,
  workspaceRootDir = rootDir,
} = {}) {
  return buildDesktopBundleRootCandidates({
    targetTriple,
    targetDir,
    env,
    hostPlatform,
    workspaceRootDir,
  })[0];
}

export function resolveExistingDesktopBundleRoot({
  targetTriple = '',
  targetDir = '',
  env = process.env,
  hostPlatform = process.platform,
  workspaceRootDir = rootDir,
} = {}) {
  const candidates = buildDesktopBundleRootCandidates({
    targetTriple,
    targetDir,
    env,
    hostPlatform,
    workspaceRootDir,
  });

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    packageProfileId: '',
    mode,
    platform: process.platform,
    arch: process.arch,
    target: '',
    outputDir: path.join(rootDir, 'artifacts', 'release'),
    releaseTag: '',
    accelerator: DEFAULT_DEPLOYMENT_ACCELERATOR,
    imageRepository: '',
    imageTag: '',
    imageDigest: '',
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(rest, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--platform') {
      options.platform = readOptionValue(rest, index, '--platform');
      index += 1;
      continue;
    }

    if (token === '--package-profile') {
      options.packageProfileId = readOptionValue(rest, index, '--package-profile');
      index += 1;
      continue;
    }

    if (token === '--output-dir') {
      options.outputDir = resolveCliPath(readOptionValue(rest, index, '--output-dir'));
      index += 1;
      continue;
    }

    if (token === '--arch') {
      options.arch = readOptionValue(rest, index, '--arch');
      index += 1;
      continue;
    }

    if (token === '--target') {
      options.target = readOptionValue(rest, index, '--target');
      index += 1;
      continue;
    }

    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(rest, index, '--release-tag');
      index += 1;
      continue;
    }

    if (token === '--accelerator') {
      options.accelerator = readOptionValue(rest, index, '--accelerator');
      index += 1;
      continue;
    }

    if (token === '--image-repository') {
      options.imageRepository = readOptionValue(rest, index, '--image-repository');
      index += 1;
      continue;
    }

    if (token === '--image-tag') {
      options.imageTag = readOptionValue(rest, index, '--image-tag');
      index += 1;
      continue;
    }

    if (token === '--image-digest') {
      options.imageDigest = readOptionValue(rest, index, '--image-digest');
      index += 1;
    }
  }

  return options;
}

function listFilesRecursively(sourceDir, relativePrefix = '') {
  const entries = readdirSync(sourceDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativePrefix, entry.name);
    const absolutePath = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile()) {
      files.push({
        absolutePath,
        relativePath,
      });
    }
  }

  return files;
}

function ensureDirectory(directoryPath) {
  mkdirSync(directoryPath, { recursive: true });
}

function writeSha256File(filePath) {
  const checksum = createHash('sha256').update(readFileSync(filePath)).digest('hex');
  writeFileSync(
    `${filePath}.sha256.txt`,
    `${checksum}  ${path.basename(filePath)}\n`,
    'utf8',
  );
  return checksum;
}

export function readDesktopTauriBundleMetadata(tauriConfigPath = desktopTauriConfigPath) {
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'));
  const productName = String(tauriConfig?.productName ?? '').trim();
  const version = String(tauriConfig?.version ?? '').trim();

  if (!productName) {
    throw new Error(`Missing productName in desktop Tauri config: ${tauriConfigPath}`);
  }
  if (!version) {
    throw new Error(`Missing version in desktop Tauri config: ${tauriConfigPath}`);
  }

  return {
    productName,
    version,
  };
}

export function buildMacosAppArchiveBaseName({ appBundleName, version, arch }) {
  const normalizedAppBundleName = String(appBundleName ?? '').trim().replace(/\.app$/i, '');
  const normalizedVersion = String(version ?? '').trim();
  const normalizedArch = normalizeDesktopArch(arch);

  if (!normalizedAppBundleName) {
    throw new Error('appBundleName is required to archive macOS app bundles.');
  }
  if (!normalizedVersion) {
    throw new Error('version is required to archive macOS app bundles.');
  }

  return `${normalizedAppBundleName}_${normalizedVersion}_${normalizedArch}`;
}

function listMacosAppBundleDirectories(macosBundleRoot) {
  if (!existsSync(macosBundleRoot)) {
    return [];
  }

  return readdirSync(macosBundleRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
    .map((entry) => ({
      name: entry.name,
      absolutePath: path.join(macosBundleRoot, entry.name),
    }));
}

function runZipCommand(archivePath, workingDirectory, entryName) {
  const normalizedEntryName = String(entryName ?? '').trim();
  if (!normalizedEntryName) {
    throw new Error('entryName is required to create a zip archive.');
  }

  const zipResult =
    process.platform === 'win32'
      ? spawnSync(
          resolveSpawnCommand('powershell'),
          [
            '-NoLogo',
            '-NoProfile',
            '-Command',
            'Compress-Archive -LiteralPath $env:SDKWORK_ZIP_SOURCE -DestinationPath $env:SDKWORK_ZIP_DESTINATION -Force',
          ],
          {
            cwd: rootDir,
            stdio: 'inherit',
            env: {
              ...process.env,
              SDKWORK_ZIP_SOURCE: path.join(workingDirectory, normalizedEntryName),
              SDKWORK_ZIP_DESTINATION: archivePath,
            },
            windowsHide: true,
          },
        )
      : spawnSync(
          process.platform === 'darwin' ? 'ditto' : 'zip',
          process.platform === 'darwin'
            ? ['-c', '-k', '--sequesterRsrc', '--keepParent', normalizedEntryName, archivePath]
            : ['-r', '-y', archivePath, normalizedEntryName],
          {
            cwd: workingDirectory,
            stdio: 'inherit',
            windowsHide: true,
          },
        );

  if (zipResult.error) {
    throw new Error(`zip failed while packaging ${archivePath}: ${zipResult.error.message}`);
  }
  if (zipResult.status !== 0) {
    throw new Error(`zip failed while packaging ${archivePath} with exit code ${zipResult.status ?? 'unknown'}`);
  }
}

function packageMacosAppArchives({
  desktopBundleRoot,
  platformOutputDir,
  archId,
  tauriConfigPath = desktopTauriConfigPath,
} = {}) {
  const macosBundleRoot = path.join(desktopBundleRoot, 'macos');
  const appBundles = listMacosAppBundleDirectories(macosBundleRoot);
  if (appBundles.length === 0) {
    return [];
  }

  const { version } = readDesktopTauriBundleMetadata(tauriConfigPath);
  const emittedFiles = [];

  for (const appBundle of appBundles) {
    const archiveBaseName = buildMacosAppArchiveBaseName({
      appBundleName: appBundle.name,
      version,
      arch: archId,
    });
    const archivePath = path.join(platformOutputDir, 'macos', `${archiveBaseName}.app.zip`);
    ensureDirectory(path.dirname(archivePath));
    rmSync(archivePath, { force: true });
    rmSync(`${archivePath}.sha256.txt`, { force: true });
    runZipCommand(archivePath, macosBundleRoot, appBundle.name);
    emittedFiles.push({
      archivePath,
      checksum: writeSha256File(archivePath),
      size: statSync(archivePath).size,
    });
  }

  return emittedFiles;
}

export function packageDesktopAssets({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  packageProfileId = '',
  releaseTag = '',
  platform,
  arch,
  target,
  outputDir,
  targetDir = '',
  tauriConfigPath = desktopTauriConfigPath,
  workspaceRootDir = rootDir,
  env = process.env,
  hostPlatform = process.platform,
}) {
  const releaseProfile = resolveReleaseProfile(profileId);
  const kernelPackageProfile = resolveEffectiveKernelPackageProfile({
    profileId,
    packageProfileId,
  });
  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const platformId = normalizePlatformId(targetSpec.platform);
  const archId = normalizeDesktopArch(targetSpec.arch);
  const kernelInstallContracts = kernelPackageProfile.includedKernelIds.includes('openclaw')
    ? writeKernelInstallContract(
        null,
        'openclaw',
        readDesktopOpenClawInstallerContract({
          workspaceRootDir,
          platform: platformId,
        }),
      )
    : null;
  const desktopBundleRoot = resolveExistingDesktopBundleRoot({
    targetTriple: targetSpec.targetTriple,
    targetDir,
    env,
    hostPlatform,
    workspaceRootDir,
  });

  if (!existsSync(desktopBundleRoot)) {
    const candidateMessage = buildDesktopBundleRootCandidates({
      targetTriple: targetSpec.targetTriple,
      targetDir,
    }).join(', ');
    throw new Error(
      `Missing desktop bundle output directory. Checked: ${candidateMessage}.${buildDesktopBundleMissingHint()}`,
    );
  }

  const bundleFiles = listFilesRecursively(desktopBundleRoot)
    .filter((file) => shouldIncludeDesktopBundleFile(platformId, file.relativePath));

  removeLegacyDesktopOutputPaths({
    outputDir,
    platformId,
  });
  const platformOutputDir = path.join(outputDir, 'desktop', platformId, archId);
  rmSync(platformOutputDir, { recursive: true, force: true });
  ensureDirectory(platformOutputDir);
  const emittedFiles = [];
  const emittedArtifacts = [];

  if (platformId === 'macos') {
    const macosArchives = packageMacosAppArchives({
        desktopBundleRoot,
        platformOutputDir,
        archId,
        tauriConfigPath,
      });
    emittedFiles.push(...macosArchives.map((archive) => archive.archivePath));
    emittedArtifacts.push(
      ...macosArchives.map((archive) => ({
        name: path.basename(archive.archivePath),
        relativePath: path.relative(outputDir, archive.archivePath).replaceAll('\\', '/'),
        family: 'desktop',
        platform: platformId,
        arch: archId,
        kind: 'archive',
        sha256: archive.checksum,
        size: archive.size,
      })),
    );
  }

  for (const bundleFile of bundleFiles) {
    const targetPath = path.join(platformOutputDir, bundleFile.relativePath);
    ensureDirectory(path.dirname(targetPath));
    cpSync(bundleFile.absolutePath, targetPath);
    const checksum = writeSha256File(targetPath);
    emittedFiles.push(targetPath);
    emittedArtifacts.push({
      name: path.basename(targetPath),
      relativePath: path.relative(outputDir, targetPath).replaceAll('\\', '/'),
      family: 'desktop',
      platform: platformId,
      arch: archId,
      kind: buildArtifactKind(platformId, bundleFile.relativePath),
      sha256: checksum,
      size: statSync(targetPath).size,
    });
  }

  if (emittedFiles.length === 0) {
    throw new Error(
      `No desktop release assets matched ${platformId} under ${desktopBundleRoot}`,
    );
  }

  writeReleaseAssetManifest({
    manifestPath: path.join(platformOutputDir, releaseProfile.release.partialManifestFileName),
    profileId: releaseProfile.id,
    productName: releaseProfile.productName,
    releaseTag,
    platform: platformId,
    arch: archId,
    kernelPackageProfile,
    kernelInstallContracts,
    artifacts: emittedArtifacts,
  });
}

export function packageServerAssets({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag,
  platform,
  arch,
  target,
  outputDir,
  serverBuildTargetDir = serverTargetDir,
  serverWebDistDir = webDistDir,
  serverEnvPath = serverEnvExamplePath,
}) {
  const releaseProfile = resolveReleaseProfile(profileId);
  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const platformId = normalizePlatformId(targetSpec.platform);
  const archId = normalizeDesktopArch(targetSpec.arch);
  const archiveBaseName = buildServerArchiveBaseName({
    releaseTag,
    platform: platformId,
    arch: archId,
  });
  const archiveFormat = releaseProfile.server.matrix.find(
    (entry) => entry.platform === platformId && entry.arch === archId,
  )?.archiveFormat ?? (platformId === 'windows' ? 'zip' : 'tar.gz');
  const platformOutputDir = path.join(outputDir, 'server', platformId, archId);

  rmSync(platformOutputDir, { recursive: true, force: true });
  ensureDirectory(platformOutputDir);
  const stagingRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-server-release-'));
  const bundleRoot = path.join(stagingRoot, archiveBaseName);
  const archivePath = path.join(
    platformOutputDir,
    `${archiveBaseName}.${buildArchiveExtension(archiveFormat)}`,
  );

  try {
    ensureDirectory(bundleRoot);
    populateServerRuntimeBundle({
      bundleRoot,
      platformId,
      archId,
      releaseTag,
      targetTriple: targetSpec.targetTriple,
      serverBuildTargetDir,
      serverWebDistDir,
      serverEnvPath,
    });

    rmSync(archivePath, { force: true });
    rmSync(`${archivePath}.sha256.txt`, { force: true });
    createDirectoryArchive({
      sourceDir: bundleRoot,
      archivePath,
      format: archiveFormat,
    });
    const checksum = writeSha256File(archivePath);
    writeReleaseAssetManifest({
      manifestPath: path.join(platformOutputDir, releaseProfile.release.partialManifestFileName),
      profileId: releaseProfile.id,
      productName: releaseProfile.productName,
      releaseTag,
      platform: platformId,
      arch: archId,
      artifacts: [
        {
          name: path.basename(archivePath),
          relativePath: path.relative(outputDir, archivePath).replaceAll('\\', '/'),
          platform: platformId,
          arch: archId,
          family: 'server',
          kind: 'archive',
          sha256: checksum,
          size: statSync(archivePath).size,
        },
      ],
    });
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

export function packageContainerAssets({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag,
  platform,
  arch,
  target,
  accelerator = DEFAULT_DEPLOYMENT_ACCELERATOR,
  outputDir,
  serverBuildTargetDir = serverTargetDir,
  serverWebDistDir = webDistDir,
  serverEnvPath = serverEnvExamplePath,
  deploymentSourceDir = dockerDeploymentDir,
}) {
  const releaseProfile = resolveReleaseProfile(profileId);
  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const platformId = normalizePlatformId(targetSpec.platform);
  const archId = normalizeDesktopArch(targetSpec.arch);
  const acceleratorId = normalizeDeploymentAccelerator(accelerator);
  const archiveBaseName = buildDeploymentBundleBaseName({
    family: 'container',
    releaseTag,
    platform: platformId,
    arch: archId,
    accelerator: acceleratorId,
  });
  const outputFamilyDir = path.join(outputDir, 'container', platformId, archId, acceleratorId);
  const archivePath = path.join(outputFamilyDir, `${archiveBaseName}.tar.gz`);
  const stagingRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-container-release-'));
  const bundleRoot = path.join(stagingRoot, archiveBaseName);

  if (!existsSync(deploymentSourceDir)) {
    throw new Error(`Missing container deployment source directory: ${deploymentSourceDir}`);
  }

  try {
    ensureDirectory(bundleRoot);
    rmSync(outputFamilyDir, { recursive: true, force: true });
    ensureDirectory(outputFamilyDir);
    populateServerRuntimeBundle({
      bundleRoot: path.join(bundleRoot, 'app'),
      platformId,
      archId,
      releaseTag,
      targetTriple: targetSpec.targetTriple,
      serverBuildTargetDir,
      serverWebDistDir,
      serverEnvPath,
    });
    cpSync(deploymentSourceDir, path.join(bundleRoot, 'deploy', 'docker'), { recursive: true });
    if (existsSync(path.join(deploymentSourceDir, '.dockerignore'))) {
      cpSync(
        path.join(deploymentSourceDir, '.dockerignore'),
        path.join(bundleRoot, '.dockerignore'),
      );
    }
    writeFileSync(
      path.join(bundleRoot, 'release-metadata.json'),
      `${JSON.stringify({
        family: 'container',
        releaseTag,
        platform: platformId,
        arch: archId,
        accelerator: acceleratorId,
      }, null, 2)}\n`,
      'utf8',
    );
    writeDeploymentBundleReadme({
      bundleRoot,
      family: 'container',
      releaseTag,
      platformId,
      archId,
      accelerator: acceleratorId,
    });

    rmSync(archivePath, { force: true });
    rmSync(`${archivePath}.sha256.txt`, { force: true });
    createDirectoryArchive({
      sourceDir: bundleRoot,
      archivePath,
      format: releaseProfile.container.bundleFormat,
    });
    const checksum = writeSha256File(archivePath);
    writeReleaseAssetManifest({
      manifestPath: path.join(outputFamilyDir, releaseProfile.release.partialManifestFileName),
      profileId: releaseProfile.id,
      productName: releaseProfile.productName,
      releaseTag,
      platform: platformId,
      arch: archId,
      artifacts: [
        {
          name: path.basename(archivePath),
          relativePath: path.relative(outputDir, archivePath).replaceAll('\\', '/'),
          platform: platformId,
          arch: archId,
          accelerator: acceleratorId,
          family: 'container',
          kind: 'archive',
          sha256: checksum,
          size: statSync(archivePath).size,
        },
      ],
    });
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

export function packageKubernetesAssets({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag,
  platform = 'linux',
  arch,
  accelerator = DEFAULT_DEPLOYMENT_ACCELERATOR,
  outputDir,
  deploymentSourceDir = kubernetesDeploymentDir,
  imageRepository = DEFAULT_KUBERNETES_IMAGE_REPOSITORY,
  imageTag = '',
  imageDigest = '',
}) {
  const releaseProfile = resolveReleaseProfile(profileId);
  const platformId = normalizePlatformId(platform);
  const archId = normalizeDesktopArch(arch);
  const acceleratorId = normalizeDeploymentAccelerator(accelerator);
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const normalizedImageRepository =
    String(imageRepository ?? '').trim() || DEFAULT_KUBERNETES_IMAGE_REPOSITORY;
  const normalizedImageTag = String(imageTag ?? '').trim() || normalizedReleaseTag;
  const normalizedImageDigest = String(imageDigest ?? '').trim();
  const archiveBaseName = buildDeploymentBundleBaseName({
    family: 'kubernetes',
    releaseTag: normalizedReleaseTag,
    platform: platformId,
    arch: archId,
    accelerator: acceleratorId,
  });
  const outputFamilyDir = path.join(outputDir, 'kubernetes', platformId, archId, acceleratorId);
  const archivePath = path.join(outputFamilyDir, `${archiveBaseName}.tar.gz`);
  const stagingRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-kubernetes-release-'));
  const bundleRoot = path.join(stagingRoot, archiveBaseName);

  if (!existsSync(deploymentSourceDir)) {
    throw new Error(`Missing kubernetes deployment source directory: ${deploymentSourceDir}`);
  }

  try {
    ensureDirectory(bundleRoot);
    rmSync(outputFamilyDir, { recursive: true, force: true });
    ensureDirectory(outputFamilyDir);
    cpSync(deploymentSourceDir, path.join(bundleRoot, 'chart'), { recursive: true });
    writeFileSync(
      path.join(bundleRoot, 'values.release.yaml'),
      [
        `targetArchitecture: ${archId}`,
        `acceleratorProfile: ${acceleratorId}`,
        'image:',
        `  repository: ${normalizedImageRepository}`,
        `  tag: ${normalizedImageTag}`,
        `  digest: ${normalizedImageDigest}`,
        '',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      path.join(bundleRoot, 'release-metadata.json'),
      `${JSON.stringify({
        family: 'kubernetes',
        releaseTag,
        platform: platformId,
        arch: archId,
        accelerator: acceleratorId,
        imageRepository: normalizedImageRepository,
        imageTag: normalizedImageTag,
        imageDigest: normalizedImageDigest || null,
      }, null, 2)}\n`,
      'utf8',
    );
    writeDeploymentBundleReadme({
      bundleRoot,
      family: 'kubernetes',
      releaseTag,
      platformId,
      archId,
      accelerator: acceleratorId,
      imageRepository: normalizedImageRepository,
      imageTag: normalizedImageTag,
      imageDigest: normalizedImageDigest,
    });

    rmSync(archivePath, { force: true });
    rmSync(`${archivePath}.sha256.txt`, { force: true });
    createDirectoryArchive({
      sourceDir: bundleRoot,
      archivePath,
      format: releaseProfile.kubernetes.bundleFormat,
    });
    const checksum = writeSha256File(archivePath);
    writeReleaseAssetManifest({
      manifestPath: path.join(outputFamilyDir, releaseProfile.release.partialManifestFileName),
      profileId: releaseProfile.id,
      productName: releaseProfile.productName,
      releaseTag: normalizedReleaseTag,
      platform: platformId,
      arch: archId,
      artifacts: [
        {
          name: path.basename(archivePath),
          relativePath: path.relative(outputDir, archivePath).replaceAll('\\', '/'),
          platform: platformId,
          arch: archId,
          accelerator: acceleratorId,
          family: 'kubernetes',
          kind: 'archive',
          sha256: checksum,
          size: statSync(archivePath).size,
        },
      ],
    });
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

function runTarCommand(archivePath, workingDirectory, entryName) {
  const tarPlan = createTarArchivePlan({
    archivePath,
    workingDirectory,
    entryName,
  });
  const result = spawnSync(tarPlan.command, tarPlan.args, {
    cwd: tarPlan.cwd,
    stdio: tarPlan.stdio,
    shell: tarPlan.shell,
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`tar failed while packaging ${archivePath}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`tar failed while packaging ${archivePath} with exit code ${result.status ?? 'unknown'}`);
  }
}

export function packageWebAssets({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag,
  outputDir,
  webBuildDir = webDistDir,
  docsBuildDir = docsDistDir,
}) {
  const releaseProfile = resolveReleaseProfile(profileId);
  if (!existsSync(webBuildDir)) {
    throw new Error(`Missing Claw web dist directory: ${webBuildDir}`);
  }
  if (!existsSync(docsBuildDir)) {
    throw new Error(`Missing Claw docs dist directory: ${docsBuildDir}`);
  }

  const archiveBaseName = buildWebArchiveBaseName(releaseTag);
  ensureDirectory(outputDir);

  const stagingRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-studio-release-web-'));
  const archiveRoot = path.join(stagingRoot, archiveBaseName);

  try {
    ensureDirectory(path.join(archiveRoot, 'web'));
    ensureDirectory(path.join(archiveRoot, 'docs'));
    cpSync(webBuildDir, path.join(archiveRoot, 'web', 'dist'), { recursive: true });
    cpSync(docsBuildDir, path.join(archiveRoot, 'docs', 'dist'), { recursive: true });

    const archivePath = path.join(outputDir, `${archiveBaseName}.tar.gz`);
    rmSync(archivePath, { force: true });
    rmSync(`${archivePath}.sha256.txt`, { force: true });
    runTarCommand(archivePath, stagingRoot, archiveBaseName);
    const checksum = writeSha256File(archivePath);
    const webOutputDir = path.join(outputDir, 'web');
    ensureDirectory(webOutputDir);
    writeReleaseAssetManifest({
      manifestPath: path.join(webOutputDir, releaseProfile.release.partialManifestFileName),
      profileId: releaseProfile.id,
      productName: releaseProfile.productName,
      releaseTag,
      platform: 'web',
      arch: 'any',
      artifacts: [
        {
          name: path.basename(archivePath),
          relativePath: path.relative(outputDir, archivePath).replaceAll('\\', '/'),
          family: 'web',
          platform: 'web',
          arch: 'any',
          kind: 'archive',
          sha256: checksum,
          size: statSync(archivePath).size,
        },
      ],
    });
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

function buildArtifactKind(platformId, relativePath) {
  const normalizedPath = relativePath.replaceAll('\\', '/').toLowerCase();
  if (platformId === 'windows' || normalizedPath.endsWith('.dmg')) {
    return 'installer';
  }
  if (normalizedPath.endsWith('.deb') || normalizedPath.endsWith('.rpm') || normalizedPath.endsWith('.appimage')) {
    return 'package';
  }
  return 'archive';
}

function writeReleaseAssetManifest({
  manifestPath,
  profileId,
  productName,
  releaseTag = '',
  platform,
  arch,
  kernelPackageProfile,
  kernelInstallContracts,
  artifacts,
}) {
  writeFileSync(
    manifestPath,
    `${JSON.stringify({
      profileId,
      productName,
      releaseTag: String(releaseTag ?? '').trim(),
      platform,
      arch,
      ...(kernelPackageProfile
        ? {
            packageProfileId: kernelPackageProfile.profileId,
            includedKernelIds: kernelPackageProfile.includedKernelIds,
            defaultEnabledKernelIds: kernelPackageProfile.defaultEnabledKernelIds,
            requiredExternalRuntimes: kernelPackageProfile.requiredExternalRuntimes,
            optionalExternalRuntimes: kernelPackageProfile.optionalExternalRuntimes,
            launcherKinds: kernelPackageProfile.launcherKinds,
            kernelPlatformSupport: kernelPackageProfile.kernelPlatformSupport,
          }
        : {}),
      ...(normalizeKernelInstallContracts(kernelInstallContracts)
        ? { kernelInstallContracts: normalizeKernelInstallContracts(kernelInstallContracts) }
        : {}),
      artifacts,
    }, null, 2)}\n`,
    'utf8',
  );
}

function printUsage() {
  console.error(
    [
      'Usage:',
      '  node scripts/release/package-release-assets.mjs desktop --platform <windows|linux|macos> --arch <x64|arm64> --target <triple> --output-dir <dir>',
      '  node scripts/release/package-release-assets.mjs server --release-tag <tag> --platform <windows|linux|macos> --arch <x64|arm64> --target <triple> --output-dir <dir>',
      '  node scripts/release/package-release-assets.mjs container --release-tag <tag> --platform linux --arch <x64|arm64> --target <triple> --accelerator <cpu|nvidia-cuda|amd-rocm> --output-dir <dir>',
      '  node scripts/release/package-release-assets.mjs kubernetes --release-tag <tag> --platform linux --arch <x64|arm64> --accelerator <cpu|nvidia-cuda|amd-rocm> [--image-repository <name>] [--image-tag <tag>] [--image-digest <digest>] --output-dir <dir>',
      '  node scripts/release/package-release-assets.mjs web --release-tag <tag> --output-dir <dir>',
    ].join('\n'),
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.mode) {
    printUsage();
    process.exit(1);
  }

  ensureDirectory(options.outputDir);

  if (options.mode === 'desktop') {
    packageDesktopAssets(options);
    return;
  }

  if (options.mode === 'server') {
    packageServerAssets(options);
    return;
  }

  if (options.mode === 'container') {
    packageContainerAssets(options);
    return;
  }

  if (options.mode === 'kubernetes') {
    packageKubernetesAssets(options);
    return;
  }

  if (options.mode === 'web') {
    packageWebAssets(options);
    return;
  }

  console.error(`Unsupported packaging mode: ${options.mode}`);
  printUsage();
  process.exit(1);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
