#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assessOpenClawUpgradeReadiness } from './openclaw-upgrade-readiness.mjs';
import {
  resolveKernelReleaseConfigPath,
} from './release/kernel-releases.mjs';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(import.meta.dirname, '..');

function normalizeVersion(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJsonFile(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readOpenClawVersionState({
  workspaceRootDir = rootDir,
} = {}) {
  const releaseConfig = await readJsonFile(
    resolveKernelReleaseConfigPath('openclaw', { workspaceRootDir }),
  );
  const bundledManifest = await readJsonFile(
    path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'resources',
      'openclaw',
      'manifest.json',
    ),
  );
  const generatedManifest = await readJsonFile(
    path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'generated',
      'release',
      'openclaw-resource',
      'manifest.json',
    ),
  );
  const preparedRuntimePackageJson = await readJsonFile(
    path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'resources',
      'openclaw',
      'runtime',
      'package',
      'node_modules',
      'openclaw',
      'package.json',
    ),
  );

  return {
    configuredVersion: normalizeVersion(releaseConfig?.stableVersion),
    preparedRuntimeVersion: normalizeVersion(preparedRuntimePackageJson?.version),
    bundledManifestVersion: normalizeVersion(bundledManifest?.openclawVersion),
    generatedManifestVersion: normalizeVersion(generatedManifest?.openclawVersion),
  };
}

export async function runNodeScript({
  workspaceRootDir = rootDir,
  scriptRelativePath,
  args = [],
} = {}) {
  if (!scriptRelativePath) {
    throw new Error('runNodeScript requires a scriptRelativePath.');
  }

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptRelativePath, ...args], {
      cwd: workspaceRootDir,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Command failed: ${process.execPath} ${[scriptRelativePath, ...args].join(' ')} (exit ${code ?? 'unknown'})`,
        ),
      );
    });
  });
}

function formatBlockers(blockers) {
  const normalized = Array.isArray(blockers)
    ? blockers.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    : [];
  return normalized.length > 0 ? normalized.map((entry) => `- ${entry}`).join('\n') : '- unknown';
}

function assertAppliedVersionState(versionState, targetVersion) {
  const expectedFields = [
    ['configuredVersion', versionState.configuredVersion],
    ['preparedRuntimeVersion', versionState.preparedRuntimeVersion],
    ['bundledManifestVersion', versionState.bundledManifestVersion],
    ['generatedManifestVersion', versionState.generatedManifestVersion],
  ];
  const mismatches = expectedFields
    .filter(([, value]) => value !== targetVersion)
    .map(([fieldName, value]) => `${fieldName}=${value ?? 'null'}`);

  if (mismatches.length > 0) {
    throw new Error(
      `Applied OpenClaw version state does not align to ${targetVersion}: ${mismatches.join(', ')}`,
    );
  }
}

function hasUnsupportedRuntimeLayout(readiness) {
  return Boolean(
    readiness?.unsupportedSourceRuntimeDirPresent
      || readiness?.unsupportedBundledNodeRuntimeDirPresent,
  );
}

async function runOpenClawUpgradeVerification({
  workspaceRootDir,
  targetVersion,
  runNodeScriptFn,
}) {
  await runNodeScriptFn({
    workspaceRootDir,
    scriptRelativePath: 'scripts/verify-desktop-openclaw-release-assets.mjs',
    args: [],
  });
  await runNodeScriptFn({
    workspaceRootDir,
    scriptRelativePath: 'scripts/openclaw-upgrade-rollback-evidence.mjs',
    args: ['--target-version', targetVersion],
  });
}

export async function applyOpenClawUpgrade({
  workspaceRootDir = rootDir,
  targetVersion,
  fast = false,
  assessOpenClawUpgradeReadinessFn = assessOpenClawUpgradeReadiness,
  runNodeScriptFn = runNodeScript,
  readVersionStateFn = readOpenClawVersionState,
} = {}) {
  const normalizedTargetVersion = normalizeVersion(targetVersion);
  if (!normalizedTargetVersion) {
    throw new Error('applyOpenClawUpgrade requires a targetVersion.');
  }

  const readiness = await assessOpenClawUpgradeReadinessFn({
    workspaceRootDir,
    targetVersion: normalizedTargetVersion,
  });

  if (fast && readiness?.versionSourcesAligned && !hasUnsupportedRuntimeLayout(readiness)) {
    await runOpenClawUpgradeVerification({
      workspaceRootDir,
      targetVersion: normalizedTargetVersion,
      runNodeScriptFn,
    });
    const versionState = await readVersionStateFn({ workspaceRootDir });
    assertAppliedVersionState(versionState, normalizedTargetVersion);

    return {
      workspaceRootDir,
      targetVersion: normalizedTargetVersion,
      workflowMode: 'fast-already-aligned',
      readiness,
      versionState,
    };
  }

  if (!readiness?.readyToUpgrade) {
    throw new Error(
      `OpenClaw upgrade to ${normalizedTargetVersion} is blocked:\n${formatBlockers(readiness?.blockers)}`,
    );
  }

  const kernelReleaseConfigPath = resolveKernelReleaseConfigPath('openclaw', {
    workspaceRootDir,
  });
  const originalReleaseConfigText = await readFile(kernelReleaseConfigPath, 'utf8');
  const releaseConfig = JSON.parse(originalReleaseConfigText);
  const nextReleaseConfig = {
    ...releaseConfig,
    stableVersion: normalizedTargetVersion,
  };

  await writeJsonFile(kernelReleaseConfigPath, nextReleaseConfig);

  try {
    await runNodeScriptFn({
      workspaceRootDir,
      scriptRelativePath: 'scripts/sync-bundled-components.mjs',
      args: ['--no-fetch', '--release'],
    });
    await runNodeScriptFn({
      workspaceRootDir,
      scriptRelativePath: 'scripts/prepare-openclaw-runtime.mjs',
      args: [],
    });
    await runOpenClawUpgradeVerification({
      workspaceRootDir,
      targetVersion: normalizedTargetVersion,
      runNodeScriptFn,
    });

    const versionState = await readVersionStateFn({ workspaceRootDir });
    assertAppliedVersionState(versionState, normalizedTargetVersion);

    return {
      workspaceRootDir,
      targetVersion: normalizedTargetVersion,
      workflowMode: 'full',
      readiness,
      versionState,
    };
  } catch (error) {
    await writeFile(kernelReleaseConfigPath, originalReleaseConfigText, 'utf8');
    throw new Error(
      `OpenClaw upgrade application failed after restored config/kernel-releases/openclaw.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseCliOptions(argv) {
  const options = {
    fast: false,
    targetVersion: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--fast') {
      options.fast = true;
      continue;
    }

    if (token === '--target-version') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --target-version');
      }
      options.targetVersion = value;
      index += 1;
      continue;
    }

    if (!options.targetVersion && !token.startsWith('--')) {
      options.targetVersion = token;
      continue;
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliOptions(argv);
  if (!options.targetVersion) {
    throw new Error('Usage: node scripts/apply-openclaw-upgrade.mjs [--fast] <target-version>');
  }

  const result = await applyOpenClawUpgrade({
    fast: options.fast,
    targetVersion: options.targetVersion,
  });
  console.log(JSON.stringify(result, null, 2));
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
