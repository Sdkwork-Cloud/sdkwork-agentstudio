#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  resolveDesktopReleaseTarget,
} from './desktop-targets.mjs';
import {
  resolveExistingDesktopBundleRoot,
} from './package-release-assets.mjs';
import {
  readDesktopReleaseAssetManifest,
} from './smoke-desktop-installers.mjs';
import {
  smokeDesktopStartupEvidence,
} from './smoke-desktop-startup-evidence.mjs';
import {
  resolveCliPath,
} from './path-inputs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release');
const DESKTOP_PACKAGED_LAUNCH_SMOKE_ROOT_PREFIX = 'claw-desktop-packaged-launch-';
// Fresh packaged first launch can spend multiple minutes converging runtime readiness.
const DEFAULT_WAIT_TIMEOUT_MS = 300_000;
const DEFAULT_WAIT_INTERVAL_MS = 250;
const DEFAULT_CLEANUP_RETRY_COUNT = 10;
const DEFAULT_CLEANUP_RETRY_DELAY_MS = 250;

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function delayWithAbort(milliseconds, abortSignal) {
  if (!abortSignal) {
    return delay(milliseconds);
  }
  if (abortSignal.aborted) {
    throw new Error('Desktop startup evidence wait was cancelled.');
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      abortSignal.removeEventListener('abort', abortHandler);
      resolve();
    }, milliseconds);
    const abortHandler = () => {
      clearTimeout(timer);
      reject(new Error('Desktop startup evidence wait was cancelled.'));
    };
    abortSignal.addEventListener('abort', abortHandler, { once: true });
  });
}

function shouldRetryDirectoryCleanup(error) {
  const code = String(error?.code ?? '').trim().toUpperCase();
  return code === 'EBUSY' || code === 'EPERM';
}

export async function removeDirectoryWithRetries(directoryPath, {
  rmSyncFn = rmSync,
  delayFn = delay,
  maxRetries = DEFAULT_CLEANUP_RETRY_COUNT,
  retryDelayMs = DEFAULT_CLEANUP_RETRY_DELAY_MS,
} = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      rmSyncFn(directoryPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (!shouldRetryDirectoryCleanup(error) || attempt + 1 >= maxRetries) {
        throw error;
      }

      await delayFn(retryDelayMs);
    }
  }

  if (lastError) {
    throw lastError;
  }
}

function normalizeArtifactRelativePath(relativePath) {
  return String(relativePath ?? '').trim().replaceAll('\\', '/');
}

function resolveArtifactAbsolutePath(releaseAssetsDir, artifact) {
  const relativePath = String(artifact?.relativePath ?? '').trim();
  if (!relativePath) {
    throw new Error('Desktop release asset manifest contains an artifact without relativePath.');
  }

  const absolutePath = path.resolve(releaseAssetsDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing desktop release artifact at ${absolutePath}`);
  }

  return absolutePath;
}

function stripDesktopArtifactPrefix(relativePath, {
  platform,
  arch,
} = {}) {
  const normalizedRelativePath = normalizeArtifactRelativePath(relativePath);
  const expectedPrefix = normalizeArtifactRelativePath(path.join(
    'desktop',
    normalizeDesktopPlatform(platform),
    normalizeDesktopArch(arch),
  ));

  if (!normalizedRelativePath.startsWith(`${expectedPrefix}/`)) {
    return null;
  }

  return normalizedRelativePath.slice(expectedPrefix.length + 1);
}

export function resolveLocalDesktopBundleArtifactPath({
  artifact,
  platform,
  arch,
  target = '',
  workspaceRootDir = rootDir,
  resolveExistingDesktopBundleRootFn = resolveExistingDesktopBundleRoot,
} = {}) {
  const bundleRoot = resolveExistingDesktopBundleRootFn({
    targetTriple: String(target ?? '').trim(),
    workspaceRootDir,
  });
  if (!bundleRoot || !existsSync(bundleRoot)) {
    return null;
  }

  const bundleRelativePath = stripDesktopArtifactPrefix(artifact?.relativePath, {
    platform,
    arch,
  });
  if (!bundleRelativePath) {
    return null;
  }

  return path.join(bundleRoot, bundleRelativePath);
}

export function assertPackagedDesktopLaunchArtifactFreshness({
  artifact,
  artifactPath,
  platform,
  arch,
  target = '',
  workspaceRootDir = rootDir,
  resolveExistingDesktopBundleRootFn = resolveExistingDesktopBundleRoot,
  fileExistsFn = existsSync,
  statSyncFn = statSync,
} = {}) {
  const packagedArtifactPath = path.resolve(String(artifactPath ?? '').trim());
  if (!packagedArtifactPath || !fileExistsFn(packagedArtifactPath)) {
    return;
  }

  const localBundleArtifactPath = resolveLocalDesktopBundleArtifactPath({
    artifact,
    platform,
    arch,
    target,
    workspaceRootDir,
    resolveExistingDesktopBundleRootFn,
  });
  if (!localBundleArtifactPath || !fileExistsFn(localBundleArtifactPath)) {
    return;
  }

  const packagedArtifactStat = statSyncFn(packagedArtifactPath);
  const localBundleArtifactStat = statSyncFn(localBundleArtifactPath);
  if (localBundleArtifactStat.mtimeMs <= packagedArtifactStat.mtimeMs) {
    return;
  }

  throw new Error(
    `Packaged desktop launch artifact is stale because a newer local desktop bundle artifact exists at ${localBundleArtifactPath}. ` +
    `Packaged asset: ${packagedArtifactPath}. Refresh release assets with "pnpm release:package:desktop" before running packaged desktop launch smoke.`,
  );
}

function selectFirstArtifact(artifacts, predicate) {
  return artifacts.find((artifact) => predicate(normalizeArtifactRelativePath(
    artifact?.relativePath,
  )));
}

export function resolveDesktopPackagedLaunchArtifact({
  platform,
  artifacts = [],
} = {}) {
  const releasePlatform = normalizeDesktopPlatform(platform);
  const desktopArtifacts = Array.isArray(artifacts)
    ? artifacts.filter((artifact) => String(artifact?.relativePath ?? '').trim().length > 0)
    : [];

  if (releasePlatform === 'windows') {
    return selectFirstArtifact(desktopArtifacts, (relativePath) => relativePath.endsWith('/nsis/')
      || relativePath.includes('/nsis/'))
      ?? selectFirstArtifact(
        desktopArtifacts,
        (relativePath) => relativePath.toLowerCase().endsWith('.exe'),
      )
      ?? selectFirstArtifact(
        desktopArtifacts,
        (relativePath) => relativePath.toLowerCase().endsWith('.msi'),
      )
      ?? null;
  }

  if (releasePlatform === 'linux') {
    return selectFirstArtifact(
      desktopArtifacts,
      (relativePath) => relativePath.toLowerCase().endsWith('.deb'),
    )
      ?? selectFirstArtifact(
        desktopArtifacts,
        (relativePath) => relativePath.toLowerCase().endsWith('.rpm'),
      )
      ?? selectFirstArtifact(
        desktopArtifacts,
        (relativePath) => relativePath.toLowerCase().endsWith('.appimage'),
      )
      ?? null;
  }

  return selectFirstArtifact(
    desktopArtifacts,
    (relativePath) => relativePath.toLowerCase().endsWith('.app.zip'),
  )
    ?? selectFirstArtifact(
      desktopArtifacts,
      (relativePath) => relativePath.toLowerCase().endsWith('.app.tar.gz'),
    )
    ?? null;
}

function isReadyDesktopStartupEvidence(document) {
  return document
    && typeof document === 'object'
    && Number(document.version) === 1
    && String(document.status ?? '').trim() === 'passed'
    && String(document.phase ?? '').trim() === 'shell-mounted'
    && document?.readinessEvidence?.ready === true;
}

export async function waitForReadyDesktopStartupEvidence({
  evidencePath,
  timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
  intervalMs = DEFAULT_WAIT_INTERVAL_MS,
  pathExistsFn = existsSync,
  readFileFn = (filePath) => readFileSync(filePath, 'utf8'),
  delayFn = delay,
  abortSignal = null,
} = {}) {
  const normalizedEvidencePath = path.resolve(String(evidencePath ?? '').trim());
  if (!normalizedEvidencePath) {
    throw new Error('evidencePath is required to wait for desktop startup evidence.');
  }

  const startedAt = Date.now();
  let lastDocument = null;
  let lastFailure = '';

  while (Date.now() - startedAt < timeoutMs) {
    if (abortSignal?.aborted) {
      throw new Error('Desktop startup evidence wait was cancelled.');
    }

    if (!pathExistsFn(normalizedEvidencePath)) {
      await (delayFn === delay
        ? delayWithAbort(intervalMs, abortSignal)
        : delayFn(intervalMs));
      continue;
    }

    try {
      const document = JSON.parse(String(readFileFn(normalizedEvidencePath) ?? ''));
      lastDocument = document;
      if (isReadyDesktopStartupEvidence(document)) {
        return document;
      }

      lastFailure = `Startup evidence at ${normalizedEvidencePath} has not reached shell-mounted passed readiness yet.`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await (delayFn === delay
      ? delayWithAbort(intervalMs, abortSignal)
      : delayFn(intervalMs));
  }

  throw new Error(
    `${lastFailure || `Timed out waiting for desktop startup evidence at ${normalizedEvidencePath}.`}${
      lastDocument ? ` Last phase: ${lastDocument.phase ?? 'unknown'}, status: ${lastDocument.status ?? 'unknown'}.` : ''
    }`,
  );
}

function runCommand({
  command,
  args = [],
  cwd,
  env,
  shell = false,
  label = 'Command',
} = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    shell,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    const stdout = String(result.stdout ?? '').trim();
    throw new Error(
      `${label} failed with exit code ${result.status ?? 'unknown'}.${stderr ? `\n${stderr}` : ''}${stdout ? `\n${stdout}` : ''}`,
    );
  }

  return {
    stdout: String(result.stdout ?? ''),
    stderr: String(result.stderr ?? ''),
  };
}

function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    return false;
  }

  return (result.status ?? 1) === 0;
}

function ensureDirectory(directoryPath) {
  mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
}

function resolveExistingPackagedLaunchSmokeRoots({
  tempRootDir = os.tmpdir(),
  smokeRootPrefix = DESKTOP_PACKAGED_LAUNCH_SMOKE_ROOT_PREFIX,
  readdirSyncFn = readdirSync,
  statSyncFn = statSync,
} = {}) {
  const normalizedTempRootDir = path.resolve(String(tempRootDir ?? '').trim());
  if (!normalizedTempRootDir || !existsSync(normalizedTempRootDir)) {
    return [];
  }

  const rootPaths = [];
  const entries = readdirSyncFn(normalizedTempRootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry?.isDirectory?.() || !String(entry.name ?? '').startsWith(smokeRootPrefix)) {
      continue;
    }

    const absolutePath = path.join(normalizedTempRootDir, entry.name);
    try {
      if (statSyncFn(absolutePath).isDirectory()) {
        rootPaths.push(absolutePath);
      }
    } catch {
      // Ignore roots that disappeared while the cleanup inventory was being collected.
    }
  }

  rootPaths.sort((left, right) => left.localeCompare(right));
  return rootPaths;
}

function toPowerShellSingleQuotedLiteral(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function toPowerShellArrayLiteral(values = []) {
  return `@(${values.map((value) => toPowerShellSingleQuotedLiteral(value)).join(', ')})`;
}

function normalizeWindowsCleanupRootPaths(rootPaths) {
  return Array.from(new Set(
    (Array.isArray(rootPaths) ? rootPaths : [rootPaths])
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)
      .map((entry) => path.resolve(entry)),
  ));
}

function terminateWindowsProcessTreesForRoots(rootPaths, {
  spawnSyncFn = spawnSync,
} = {}) {
  const normalizedRootPaths = normalizeWindowsCleanupRootPaths(rootPaths);
  if (normalizedRootPaths.length === 0) {
    return;
  }

  const commandScript = [
    `$rootPaths = ${toPowerShellArrayLiteral(normalizedRootPaths)}`,
    '$matchingProcesses = Get-CimInstance Win32_Process | Where-Object {',
    '  $commandLine = [string]$_.CommandLine',
    '  if ([string]::IsNullOrWhiteSpace($commandLine)) { return $false }',
    '  foreach ($rootPath in $rootPaths) {',
    '    if ($commandLine.IndexOf($rootPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }',
    '  }',
    '  return $false',
    '} | Sort-Object ProcessId -Descending',
    'foreach ($process in $matchingProcesses) {',
    '  $processId = [int]$process.ProcessId',
    '  if ($processId -le 0) { continue }',
    '  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue',
    '}',
    'exit 0',
  ].join('; ');

  const result = spawnSyncFn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    commandScript,
  ], {
    encoding: 'utf8',
    shell: false,
  });

  if (result?.error) {
    throw result.error;
  }
}

async function cleanupWindowsPackagedLaunchSmokeRoots(rootPaths, {
  pathExistsFn = existsSync,
  removeDirectoryWithRetriesFn = removeDirectoryWithRetries,
  spawnSyncFn = spawnSync,
} = {}) {
  const normalizedRootPaths = normalizeWindowsCleanupRootPaths(rootPaths);
  if (normalizedRootPaths.length === 0) {
    return;
  }

  terminateWindowsProcessTreesForRoots(normalizedRootPaths, {
    spawnSyncFn,
  });

  for (const rootPath of normalizedRootPaths) {
    if (!pathExistsFn(rootPath)) {
      continue;
    }
    await removeDirectoryWithRetriesFn(rootPath);
  }
}

export function buildWindowsInstallerLaunchCommand({
  artifactPath,
  installRoot,
} = {}) {
  const normalizedArtifactPath = path.resolve(String(artifactPath ?? '').trim());
  const normalizedInstallRoot = path.resolve(String(installRoot ?? '').trim());

  if (!normalizedArtifactPath) {
    throw new Error('artifactPath is required to build the Windows installer launch command.');
  }
  if (!normalizedInstallRoot) {
    throw new Error('installRoot is required to build the Windows installer launch command.');
  }

  const commandScript = [
    `$installerPath = ${toPowerShellSingleQuotedLiteral(normalizedArtifactPath)}`,
    `$installRoot = ${toPowerShellSingleQuotedLiteral(normalizedInstallRoot)}`,
    "$process = Start-Process -FilePath $installerPath -ArgumentList @('/S', \"/D=$installRoot\") -Wait -PassThru",
    'exit $process.ExitCode',
  ].join('; ');

  return {
    command: 'powershell.exe',
    args: [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      commandScript,
    ],
  };
}

function buildWindowsSmokeEnvironment(smokeRoot, baseEnv = process.env) {
  const homeDir = ensureDirectory(path.join(smokeRoot, 'home'));
  const appDataDir = ensureDirectory(path.join(homeDir, 'AppData', 'Roaming'));
  const localAppDataDir = ensureDirectory(path.join(homeDir, 'AppData', 'Local'));
  const tempDir = ensureDirectory(path.join(smokeRoot, 'tmp'));
  const programDataDir = ensureDirectory(path.join(smokeRoot, 'program-data'));
  const clawUserRoot = ensureDirectory(path.join(homeDir, '.sdkwork', 'crawstudio'));
  const clawMachineRoot = ensureDirectory(path.join(programDataDir, 'SdkWork', 'CrawStudio'));

  return {
    ...baseEnv,
    USERPROFILE: homeDir,
    APPDATA: appDataDir,
    LOCALAPPDATA: localAppDataDir,
    ProgramData: programDataDir,
    SDKWORK_CLAW_USER_ROOT: clawUserRoot,
    SDKWORK_CLAW_MACHINE_ROOT: clawMachineRoot,
    TEMP: tempDir,
    TMP: tempDir,
    TMPDIR: tempDir,
  };
}

function buildPosixSmokeEnvironment({
  platform,
  smokeRoot,
  baseEnv = process.env,
} = {}) {
  const homeDir = ensureDirectory(path.join(smokeRoot, 'home'));
  const tempDir = ensureDirectory(path.join(smokeRoot, 'tmp'));
  const dataHome = ensureDirectory(path.join(homeDir, '.local', 'share'));
  const configHome = ensureDirectory(path.join(homeDir, '.config'));
  const cacheHome = ensureDirectory(path.join(homeDir, '.cache'));
  const clawUserRoot = ensureDirectory(path.join(homeDir, '.sdkwork', 'crawstudio'));
  const clawMachineRoot = ensureDirectory(path.join(smokeRoot, 'app-data', 'machine'));

  return {
    ...baseEnv,
    HOME: homeDir,
    TMPDIR: tempDir,
    SDKWORK_CLAW_USER_ROOT: clawUserRoot,
    SDKWORK_CLAW_MACHINE_ROOT: clawMachineRoot,
    ...(platform === 'linux'
      ? {
        XDG_DATA_HOME: dataHome,
        XDG_CONFIG_HOME: configHome,
        XDG_CACHE_HOME: cacheHome,
      }
      : {}),
  };
}

function resolveDesktopStartupEvidencePathForEnv({
  platform,
  env,
} = {}) {
  const releasePlatform = normalizeDesktopPlatform(platform);
  const explicitUserRoot = String(env?.SDKWORK_CLAW_USER_ROOT ?? '').trim();
  if (explicitUserRoot) {
    return path.join(
      explicitUserRoot,
      'studio',
      'diagnostics',
      'desktop-startup-evidence.json',
    );
  }

  const homeDir = releasePlatform === 'windows'
    ? String(env?.USERPROFILE ?? '').trim()
    : String(env?.HOME ?? '').trim();

  if (!homeDir) {
    throw new Error(`Missing isolated home directory override for ${releasePlatform} desktop smoke.`);
  }

  return path.join(
    homeDir,
    '.sdkwork',
    'crawstudio',
    'studio',
    'diagnostics',
    'desktop-startup-evidence.json',
  );
}

function findFilesRecursively(rootDir, predicate) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const results = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (entry.isFile() && predicate(absolutePath, entry.name)) {
        results.push(absolutePath);
      }
    }
  }

  results.sort((left, right) => left.localeCompare(right));
  return results;
}

function resolveInstallRootFromPackagedManifest(extractRoot) {
  const manifestPaths = findFilesRecursively(
    extractRoot,
    (absolutePath) => normalizeArtifactRelativePath(absolutePath).toLowerCase().endsWith(
      '/resources/openclaw/manifest.json',
    ),
  );
  const manifestPath = manifestPaths[0];
  if (!manifestPath) {
    throw new Error(`Unable to resolve packaged desktop install root from ${extractRoot}.`);
  }

  return path.dirname(path.dirname(path.dirname(manifestPath)));
}

function resolveInstalledDesktopBinaryPath({
  installRoot,
  productName = 'Claw Studio',
  platform,
} = {}) {
  const releasePlatform = normalizeDesktopPlatform(platform);
  if (releasePlatform === 'windows') {
    const preferredRootExecutables = [
      `${productName}.exe`,
      'sdkwork-clawstudio-desktop.exe',
      'claw-studio.exe',
    ];
    for (const executableName of preferredRootExecutables) {
      const productExecutable = path.join(installRoot, executableName);
      if (existsSync(productExecutable)) {
        return productExecutable;
      }
    }

    const rootExecutables = readdirSync(installRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
      .map((entry) => entry.name)
      .filter((entryName) => !entryName.toLowerCase().startsWith('uninstall'))
      .sort((left, right) => left.localeCompare(right));
    if (rootExecutables.length > 0) {
      return path.join(installRoot, rootExecutables[0]);
    }

    const candidates = findFilesRecursively(
      installRoot,
      (absolutePath, fileName) => {
        const normalizedRelativePath = normalizeArtifactRelativePath(
          path.relative(installRoot, absolutePath),
        ).toLowerCase();
        const normalizedFileName = fileName.toLowerCase();

        return (
        fileName.toLowerCase().endsWith('.exe')
        && !normalizedFileName.startsWith('uninstall')
        && normalizedFileName !== 'node.exe'
        && !normalizedRelativePath.startsWith('generated/bundled/')
        );
      },
    );
    if (candidates.length > 0) {
      return candidates[0];
    }
  } else if (releasePlatform === 'linux') {
    const candidates = [
      path.join(installRoot, 'claw-studio'),
      path.join(installRoot, 'sdkwork-clawstudio-desktop'),
      path.join(installRoot, productName),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    }

    const discovered = findFilesRecursively(
      installRoot,
      (absolutePath) => statSync(absolutePath).mode & 0o111,
    );
    if (discovered.length > 0) {
      return discovered[0];
    }
  }

  throw new Error(`Unable to resolve packaged desktop launcher under ${installRoot}.`);
}

function extractLinuxDesktopPackage({
  artifactPath,
  extractRoot,
} = {}) {
  const lowerCaseArtifactPath = String(artifactPath ?? '').trim().toLowerCase();
  ensureDirectory(extractRoot);

  if (lowerCaseArtifactPath.endsWith('.deb')) {
    runCommand({
      command: 'dpkg-deb',
      args: ['-x', artifactPath, extractRoot],
      label: 'Extracting packaged Linux deb desktop artifact',
    });
    return;
  }

  if (lowerCaseArtifactPath.endsWith('.rpm')) {
    if (!commandExists('rpm2cpio', ['--help']) || !commandExists('cpio', ['--help'])) {
      throw new Error('rpm2cpio and cpio are required to extract packaged Linux rpm desktop artifacts.');
    }
    runCommand({
      command: 'bash',
      args: [
        '-lc',
        `cd "${extractRoot.replaceAll('"', '\\"')}" && rpm2cpio "${artifactPath.replaceAll('"', '\\"')}" | cpio -idmu`,
      ],
      label: 'Extracting packaged Linux rpm desktop artifact',
    });
    return;
  }

  throw new Error(`Unsupported packaged Linux desktop artifact: ${artifactPath}`);
}

function extractMacosDesktopArchive({
  artifactPath,
  extractRoot,
} = {}) {
  const lowerCaseArtifactPath = String(artifactPath ?? '').trim().toLowerCase();
  ensureDirectory(extractRoot);

  if (lowerCaseArtifactPath.endsWith('.app.zip')) {
    runCommand({
      command: 'ditto',
      args: ['-x', '-k', artifactPath, extractRoot],
      label: 'Extracting packaged macOS app archive',
    });
    return;
  }

  if (lowerCaseArtifactPath.endsWith('.app.tar.gz')) {
    runCommand({
      command: 'tar',
      args: ['-xzf', artifactPath, '-C', extractRoot],
      label: 'Extracting packaged macOS app archive',
    });
    return;
  }

  throw new Error(`Unsupported packaged macOS desktop artifact: ${artifactPath}`);
}

function resolveMacosAppBundlePath(extractRoot) {
  const appBundles = findFilesRecursively(
    extractRoot,
    (_absolutePath, fileName) => fileName === 'Info.plist',
  )
    .map((infoPlistPath) => path.dirname(path.dirname(infoPlistPath)))
    .filter((candidate) => candidate.endsWith('.app'));

  if (appBundles.length === 0) {
    throw new Error(`Unable to resolve packaged macOS app bundle under ${extractRoot}.`);
  }

  return appBundles[0];
}

function resolveMacosAppExecutablePath(appBundlePath, productName = 'Claw Studio') {
  const macosDir = path.join(appBundlePath, 'Contents', 'MacOS');
  const preferredPath = path.join(macosDir, productName);
  if (existsSync(preferredPath)) {
    return preferredPath;
  }

  const entries = existsSync(macosDir)
    ? readdirSync(macosDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(macosDir, entry.name))
    : [];
  if (entries.length === 0) {
    throw new Error(`Unable to resolve packaged macOS app executable under ${macosDir}.`);
  }

  return entries[0];
}

function resolveLinuxLaunchCommand({
  binaryPath,
  env,
} = {}) {
  const hasDisplay = Boolean(String(env?.DISPLAY ?? '').trim() || String(env?.WAYLAND_DISPLAY ?? '').trim());
  if (hasDisplay) {
    return {
      command: binaryPath,
      args: [],
      cwd: path.dirname(binaryPath),
      env,
    };
  }

  if (!commandExists('xvfb-run', ['--help'])) {
    throw new Error(
      'xvfb-run is required to smoke packaged Linux desktop startup when no DISPLAY or WAYLAND_DISPLAY is available.',
    );
  }

  return {
    command: 'xvfb-run',
    args: ['-a', '-s', '-screen 0 1920x1080x24', binaryPath],
    cwd: path.dirname(binaryPath),
    env,
  };
}

export async function prepareDesktopPackagedLaunch({
  artifactPath,
  artifact,
  releasePlatform,
  productName = 'Claw Studio',
  smokeRoot,
  env = process.env,
  runCommandFn = runCommand,
} = {}) {
  const platformId = normalizeDesktopPlatform(releasePlatform);
  const artifactRelativePath = normalizeArtifactRelativePath(artifact?.relativePath);

  if (platformId === 'windows') {
    const isolatedEnv = buildWindowsSmokeEnvironment(smokeRoot, env);
    const installRoot = path.join(smokeRoot, 'install-root');
    ensureDirectory(path.dirname(installRoot));
    const installerLaunch = buildWindowsInstallerLaunchCommand({
      artifactPath,
      installRoot,
    });
    runCommandFn({
      ...installerLaunch,
      env: isolatedEnv,
      label: `Installing packaged Windows desktop artifact ${artifactRelativePath}`,
    });

    const binaryPath = resolveInstalledDesktopBinaryPath({
      installRoot,
      productName,
      platform: platformId,
    });
    return {
      launcher: {
        command: binaryPath,
        args: [],
        cwd: installRoot,
        env: isolatedEnv,
      },
      evidencePath: resolveDesktopStartupEvidencePathForEnv({
        platform: platformId,
        env: isolatedEnv,
      }),
      cleanup: async () => {},
    };
  }

  if (platformId === 'linux') {
    const isolatedEnv = buildPosixSmokeEnvironment({
      platform: platformId,
      smokeRoot,
      baseEnv: env,
    });
    const extractRoot = path.join(smokeRoot, 'extract');
    extractLinuxDesktopPackage({
      artifactPath,
      extractRoot,
    });
    const installRoot = resolveInstallRootFromPackagedManifest(extractRoot);
    const binaryPath = resolveInstalledDesktopBinaryPath({
      installRoot,
      productName,
      platform: platformId,
    });

    return {
      launcher: resolveLinuxLaunchCommand({
        binaryPath,
        env: isolatedEnv,
      }),
      evidencePath: resolveDesktopStartupEvidencePathForEnv({
        platform: platformId,
        env: isolatedEnv,
      }),
      cleanup: async () => {},
    };
  }

  const isolatedEnv = buildPosixSmokeEnvironment({
    platform: platformId,
    smokeRoot,
    baseEnv: env,
  });
  const extractRoot = path.join(smokeRoot, 'extract');
  extractMacosDesktopArchive({
    artifactPath,
    extractRoot,
  });
  const appBundlePath = resolveMacosAppBundlePath(extractRoot);
  const executablePath = resolveMacosAppExecutablePath(appBundlePath, productName);

  return {
    launcher: {
      command: executablePath,
      args: [],
      cwd: path.dirname(executablePath),
      env: isolatedEnv,
    },
    evidencePath: resolveDesktopStartupEvidencePathForEnv({
      platform: platformId,
      env: isolatedEnv,
    }),
    cleanup: async () => {},
  };
}

function appendLogBuffer(chunks, chunk) {
  if (!chunk) {
    return;
  }

  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  const totalLength = chunks.reduce((sum, entry) => sum + entry.length, 0);
  while (chunks.length > 1 && totalLength > 65536) {
    chunks.shift();
  }
}

export async function launchDesktopPackagedApp({
  command,
  args = [],
  cwd,
  env,
} = {}) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    detached: process.platform !== 'win32',
    windowsHide: true,
  });
  const stdoutChunks = [];
  const stderrChunks = [];

  child.stdout?.on('data', (chunk) => {
    appendLogBuffer(stdoutChunks, chunk);
  });
  child.stderr?.on('data', (chunk) => {
    appendLogBuffer(stderrChunks, chunk);
  });

  return {
    child,
    pid: child.pid,
    command,
    args,
    stdoutChunks,
    stderrChunks,
  };
}

function buildDesktopLaunchFailureDetails(processRecord) {
  const stdout = Buffer.concat(processRecord?.stdoutChunks ?? []).toString('utf8').trim();
  const stderr = Buffer.concat(processRecord?.stderrChunks ?? []).toString('utf8').trim();

  return [
    stdout ? `stdout:\n${stdout}` : '',
    stderr ? `stderr:\n${stderr}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function waitForDesktopProcessExit(processRecord) {
  const child = processRecord?.child;
  if (!child) {
    return new Promise(() => {});
  }

  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({
      exitCode: child.exitCode,
      signalCode: child.signalCode,
    });
  }

  return new Promise((resolve) => {
    child.once('exit', (exitCode, signalCode) => {
      resolve({
        exitCode,
        signalCode,
      });
    });
  });
}

async function waitForReadyDesktopStartupEvidenceWhileProcessRuns({
  processRecord,
  evidencePath,
  waitForReadyDesktopStartupEvidenceFn = waitForReadyDesktopStartupEvidence,
} = {}) {
  const abortController = new AbortController();
  const evidenceWait = Promise.resolve().then(() => waitForReadyDesktopStartupEvidenceFn({
    evidencePath,
    abortSignal: abortController.signal,
  }));
  const processExitWait = waitForDesktopProcessExit(processRecord).then((exitStatus) => {
    const detail = buildDesktopLaunchFailureDetails(processRecord);
    const exitCode = exitStatus?.exitCode ?? processRecord?.child?.exitCode;
    const signalCode = exitStatus?.signalCode ?? processRecord?.child?.signalCode;
    throw new Error(
      `Packaged desktop launch process exited before startup evidence became ready. ` +
      `Exit code: ${exitCode ?? 'unknown'}, signal: ${signalCode ?? 'none'}.${detail ? `\n${detail}` : ''}`,
    );
  });

  try {
    return await Promise.race([
      evidenceWait,
      processExitWait,
    ]);
  } finally {
    abortController.abort();
  }
}

function waitForProcessExit(child, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!child) {
      resolve();
      return;
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }

    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, timeoutMs);

    child.once('exit', () => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function stopDesktopPackagedApp(processRecord) {
  const child = processRecord?.child;
  const pid = Number(processRecord?.pid ?? 0);
  const cleanupRootPaths = normalizeWindowsCleanupRootPaths(processRecord?.cleanupRootPaths);

  if (process.platform === 'win32') {
    if (child && child.exitCode === null && child.signalCode === null && pid > 0) {
      const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      });
      if (result.error) {
        throw result.error;
      }
      await waitForProcessExit(child);
    }

    terminateWindowsProcessTreesForRoots(cleanupRootPaths);
    return;
  }

  if (!child || child.exitCode !== null || child.signalCode !== null || pid <= 0) {
    return;
  }

  try {
    process.kill(-pid, 'SIGTERM');
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }
  await waitForProcessExit(child, 3000);
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }
  await waitForProcessExit(child, 2000);
}

export async function smokeDesktopPackagedLaunch({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform = process.platform,
  arch = process.arch,
  target = '',
  hostPlatform = process.platform,
  readDesktopReleaseAssetManifestFn = readDesktopReleaseAssetManifest,
  resolveDesktopPackagedLaunchArtifactFn = resolveDesktopPackagedLaunchArtifact,
  prepareDesktopPackagedLaunchFn = prepareDesktopPackagedLaunch,
  launchDesktopPackagedAppFn = launchDesktopPackagedApp,
  waitForReadyDesktopStartupEvidenceFn = waitForReadyDesktopStartupEvidence,
  stopDesktopPackagedAppFn = stopDesktopPackagedApp,
  smokeDesktopStartupEvidenceFn = smokeDesktopStartupEvidence,
  resolveExistingPackagedLaunchSmokeRootsFn = resolveExistingPackagedLaunchSmokeRoots,
  cleanupWindowsPackagedLaunchSmokeRootsFn = cleanupWindowsPackagedLaunchSmokeRoots,
} = {}) {
  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const releasePlatform = normalizeDesktopPlatform(targetSpec.platform);
  const releaseArch = normalizeDesktopArch(targetSpec.arch);
  const hostPlatformId = normalizeDesktopPlatform(hostPlatform);

  if (releasePlatform !== hostPlatformId) {
    throw new Error(
      `Packaged desktop launch smoke for ${releasePlatform}-${releaseArch} must run on a matching native ${releasePlatform} host, received ${hostPlatformId}.`,
    );
  }

  const { manifestPath, manifest } = readDesktopReleaseAssetManifestFn({
    releaseAssetsDir,
    platform: releasePlatform,
    arch: releaseArch,
  });
  const artifact = resolveDesktopPackagedLaunchArtifactFn({
    platform: releasePlatform,
    artifacts: manifest?.artifacts ?? [],
  });
  if (!artifact) {
    throw new Error(
      `Unable to resolve a packaged desktop launch artifact for ${releasePlatform}-${releaseArch} from ${manifestPath}.`,
    );
  }

  const artifactPath = resolveArtifactAbsolutePath(releaseAssetsDir, artifact);
  assertPackagedDesktopLaunchArtifactFreshness({
    artifact,
    artifactPath,
    platform: releasePlatform,
    arch: releaseArch,
    target: targetSpec.targetTriple,
  });
  if (releasePlatform === 'windows') {
    await cleanupWindowsPackagedLaunchSmokeRootsFn(
      resolveExistingPackagedLaunchSmokeRootsFn(),
    );
  }
  const smokeRoot = mkdtempSync(path.join(os.tmpdir(), DESKTOP_PACKAGED_LAUNCH_SMOKE_ROOT_PREFIX));
  let processRecord = null;
  let preparedLaunch = null;

  try {
    preparedLaunch = await prepareDesktopPackagedLaunchFn({
      releaseAssetsDir,
      releasePlatform,
      releaseArch,
      target: targetSpec.targetTriple,
      manifestPath,
      manifest,
      artifact,
      artifactPath,
      productName: String(manifest?.productName ?? 'Claw Studio').trim() || 'Claw Studio',
      smokeRoot,
    });
    processRecord = {
      ...await launchDesktopPackagedAppFn(preparedLaunch.launcher),
      cleanupRootPaths: [smokeRoot],
    };
    await waitForReadyDesktopStartupEvidenceWhileProcessRuns({
      processRecord,
      evidencePath: preparedLaunch.evidencePath,
      waitForReadyDesktopStartupEvidenceFn,
    });
    await stopDesktopPackagedAppFn(processRecord);
    processRecord = null;
    const smokeResult = await smokeDesktopStartupEvidenceFn({
      releaseAssetsDir,
      platform: releasePlatform,
      arch: releaseArch,
      target: targetSpec.targetTriple,
      startupEvidencePath: preparedLaunch.evidencePath,
    });

    return {
      platform: releasePlatform,
      arch: releaseArch,
      target: targetSpec.targetTriple,
      manifestPath,
      artifact,
      artifactPath,
      capturedEvidencePath: preparedLaunch.evidencePath,
      smokeResult,
    };
  } catch (error) {
    const launcherLogs = processRecord ? buildDesktopLaunchFailureDetails(processRecord) : '';
    const details = launcherLogs ? `\n${launcherLogs}` : '';
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}${details}`,
    );
  } finally {
    if (processRecord) {
      try {
        await stopDesktopPackagedAppFn(processRecord);
      } catch {
        // Preserve the original failure while still attempting teardown.
      }
    }
    if (preparedLaunch && typeof preparedLaunch.cleanup === 'function') {
      try {
        await preparedLaunch.cleanup();
      } catch {
        // Preserve the original failure while still attempting cleanup.
      }
    }
    if (releasePlatform === 'windows') {
      try {
        await cleanupWindowsPackagedLaunchSmokeRootsFn([smokeRoot]);
      } catch {
        // Preserve the original failure while still attempting cleanup.
      }
    }
    await removeDirectoryWithRetries(smokeRoot);
  }
}

export function parseArgs(argv) {
  const options = {
    platform: process.platform,
    arch: process.arch,
    target: '',
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--platform') {
      options.platform = readOptionValue(argv, index, '--platform');
      index += 1;
      continue;
    }
    if (token === '--arch') {
      options.arch = readOptionValue(argv, index, '--arch');
      index += 1;
      continue;
    }
    if (token === '--target') {
      options.target = readOptionValue(argv, index, '--target');
      index += 1;
      continue;
    }
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = resolveCliPath(
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const result = await smokeDesktopPackagedLaunch(parseArgs(argv));
  console.log(
    `Smoke-verified packaged desktop launch for ${result.platform}-${result.arch}.`,
  );
  return result;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
