import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeDesktopPlatform } from './desktop-targets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const WINDOWS_TAURI_CONFIG_PATH = 'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.windows.conf.json';
const WINDOWS_INSTALLER_HOOKS_PATH = 'packages/sdkwork-clawstudio-desktop/src-tauri/installer-hooks.nsh';
const LINUX_TAURI_CONFIG_PATH = 'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.linux.conf.json';
const LINUX_POSTINSTALL_PATH = 'packages/sdkwork-clawstudio-desktop/src-tauri/linux-postinstall-openclaw.sh';
const MACOS_TAURI_CONFIG_PATH = 'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.macos.conf.json';

function readJson(workspaceRootDir, relativePath) {
  return JSON.parse(
    readFileSync(path.join(workspaceRootDir, relativePath), 'utf8'),
  );
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : undefined;
}

function normalizeDesktopOpenClawInstallerContract(contract) {
  if (!contract || typeof contract !== 'object') {
    return contract;
  }

  const normalizedContract = {
    ...contract,
  };

  if ('packageFormats' in normalizedContract) {
    normalizedContract.packageFormats = normalizeStringArray(
      normalizedContract.packageFormats,
    );
  }
  if ('installRootOverrides' in normalizedContract) {
    normalizedContract.installRootOverrides = normalizeStringArray(
      normalizedContract.installRootOverrides,
    );
  }
  if ('requiredExternalRuntimes' in normalizedContract) {
    normalizedContract.requiredExternalRuntimes = normalizeStringArray(
      normalizedContract.requiredExternalRuntimes,
    );
  }

  return normalizedContract;
}

function readWindowsInstallerContract(workspaceRootDir) {
  const tauriConfig = readJson(workspaceRootDir, WINDOWS_TAURI_CONFIG_PATH);

  assert.equal(
    typeof tauriConfig?.bundle?.windows?.nsis?.installerHooks,
    'undefined',
    'Desktop Windows Tauri config must not wire NSIS installer hooks for OpenClaw install-time actions.',
  );
  assert.equal(
    existsSync(path.join(workspaceRootDir, WINDOWS_INSTALLER_HOOKS_PATH)),
    false,
    'Legacy Windows OpenClaw installer hooks must be removed after the external-runtime hard cut.',
  );

  return normalizeDesktopOpenClawInstallerContract({
    version: 2,
    platform: 'windows',
    delivery: 'archive-only-resources',
    installMode: 'first-launch-archive-extract',
    bundledResourceRoot: 'resources/openclaw/',
    runtimeArchive: 'resources/openclaw/runtime.zip',
    sourceConfigPath: WINDOWS_TAURI_CONFIG_PATH,
    requiredExternalRuntimes: ['nodejs'],
  });
}

function readLinuxInstallerContract(workspaceRootDir) {
  const tauriConfig = readJson(workspaceRootDir, LINUX_TAURI_CONFIG_PATH);

  assert.equal(
    typeof tauriConfig?.bundle?.linux?.deb?.postInstallScript,
    'undefined',
    'Desktop Linux deb packaging must not wire an OpenClaw postinstall script after the external-runtime hard cut.',
  );
  assert.equal(
    typeof tauriConfig?.bundle?.linux?.rpm?.postInstallScript,
    'undefined',
    'Desktop Linux rpm packaging must not wire an OpenClaw postinstall script after the external-runtime hard cut.',
  );
  assert.equal(
    existsSync(path.join(workspaceRootDir, LINUX_POSTINSTALL_PATH)),
    false,
    'Legacy Linux OpenClaw postinstall script must be removed after the external-runtime hard cut.',
  );

  return normalizeDesktopOpenClawInstallerContract({
    version: 2,
    platform: 'linux',
    delivery: 'archive-only-resources',
    installMode: 'first-launch-archive-extract',
    bundledResourceRoot: 'resources/openclaw/',
    runtimeArchive: 'resources/openclaw/runtime.zip',
    sourceConfigPath: LINUX_TAURI_CONFIG_PATH,
    requiredExternalRuntimes: ['nodejs'],
    packageFormats: ['deb', 'rpm'],
  });
}

function readMacosInstallerContract(workspaceRootDir) {
  const tauriConfig = readJson(workspaceRootDir, MACOS_TAURI_CONFIG_PATH);

  assert.equal(
    tauriConfig?.bundle?.macOS?.files?.['generated/release/macos-install-root/'],
    'MacOS/',
    'Desktop macOS packaging must project the preexpanded OpenClaw managed runtime layout into Contents/MacOS/.',
  );

  return normalizeDesktopOpenClawInstallerContract({
    version: 2,
    platform: 'macos',
    delivery: 'archive-only-resources',
    installMode: 'preexpanded-managed-layout',
    bundledResourceRoot: 'resources/openclaw/',
    runtimeArchive: 'resources/openclaw/runtime.zip',
    sourceConfigPath: MACOS_TAURI_CONFIG_PATH,
    stagedInstallRootSource: 'generated/release/macos-install-root/',
    stagedInstallRootTarget: 'MacOS/',
    requiredExternalRuntimes: ['nodejs'],
  });
}

export function readDesktopOpenClawInstallerContract({
  workspaceRootDir = rootDir,
  platform,
} = {}) {
  const platformId = normalizeDesktopPlatform(platform);

  if (platformId === 'windows') {
    return readWindowsInstallerContract(workspaceRootDir);
  }
  if (platformId === 'linux') {
    return readLinuxInstallerContract(workspaceRootDir);
  }
  if (platformId === 'macos') {
    return readMacosInstallerContract(workspaceRootDir);
  }

  throw new Error(`Unsupported desktop OpenClaw installer contract platform: ${platform}`);
}

export function assertDesktopOpenClawInstallerContract({
  actualContract,
  workspaceRootDir = rootDir,
  platform,
  contextLabel = 'Desktop OpenClaw installer contract',
} = {}) {
  const expectedContract = readDesktopOpenClawInstallerContract({
    workspaceRootDir,
    platform,
  });

  assert.deepEqual(
    normalizeDesktopOpenClawInstallerContract(actualContract),
    expectedContract,
    `${contextLabel} must match the current desktop OpenClaw installer contract for ${normalizeDesktopPlatform(platform)}.`,
  );

  return expectedContract;
}

export {
  normalizeDesktopOpenClawInstallerContract,
};
