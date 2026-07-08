#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assessOpenClawUpgradeReadiness,
} from './openclaw-upgrade-readiness.mjs';
import {
  DEFAULT_RESOURCE_DIR,
  inspectPreparedOpenClawRuntime,
  resolveRequestedOpenClawTarget,
} from './prepare-openclaw-runtime.mjs';
import {
  verifyDesktopOpenClawReleaseAssets,
} from './verify-desktop-openclaw-release-assets.mjs';
import {
  resolveKernelReleaseConfigPath,
} from './release/kernel-releases.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function normalizeVersion(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function tryReadJsonFile(filePath, readJsonFileFn) {
  try {
    return await readJsonFileFn(filePath);
  } catch {
    return null;
  }
}

function createPhase(id, status, detail, extra = {}) {
  return {
    id,
    status,
    detail,
    ...extra,
  };
}

function pushRollbackBlocker(blockers, message) {
  if (!blockers.includes(message)) {
    blockers.push(message);
  }
}

function resolveEvidencePaths(workspaceRootDir) {
  return {
    releaseConfigPath: resolveKernelReleaseConfigPath('openclaw', { workspaceRootDir }),
    bundledManifestPath: path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-clawstudio-desktop',
      'src-tauri',
      'resources',
      'openclaw',
      'manifest.json',
    ),
    packagedManifestPath: path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-clawstudio-desktop',
      'src-tauri',
      'generated',
      'release',
      'openclaw-resource',
      'manifest.json',
    ),
  };
}

export async function buildOpenClawUpgradeRollbackEvidence({
  workspaceRootDir = rootDir,
  targetVersion = '',
  rollbackVersion = '',
  target = resolveRequestedOpenClawTarget(),
  readJsonFileFn = readJsonFile,
  assessOpenClawUpgradeReadinessFn = assessOpenClawUpgradeReadiness,
  inspectPreparedOpenClawRuntimeFn = inspectPreparedOpenClawRuntime,
  verifyDesktopOpenClawReleaseAssetsFn = verifyDesktopOpenClawReleaseAssets,
} = {}) {
  const normalizedTargetVersion = normalizeVersion(targetVersion);
  const normalizedRollbackVersion = normalizeVersion(rollbackVersion);
  const paths = resolveEvidencePaths(workspaceRootDir);

  const releaseConfig = await tryReadJsonFile(paths.releaseConfigPath, readJsonFileFn);
  const bundledManifest = await tryReadJsonFile(paths.bundledManifestPath, readJsonFileFn);
  const packagedManifest = await tryReadJsonFile(paths.packagedManifestPath, readJsonFileFn);

  const baselineVersion =
    normalizedRollbackVersion
    ?? normalizeVersion(releaseConfig?.stableVersion)
    ?? normalizeVersion(bundledManifest?.openclawVersion)
    ?? normalizeVersion(packagedManifest?.openclawVersion);

  const blockers = {
    upgrade: [],
    rollback: [],
  };
  const phases = [];

  const baselineAlignmentChecks = [
    ['release config stableVersion', normalizeVersion(releaseConfig?.stableVersion)],
    ['packaged OpenClaw manifest', normalizeVersion(bundledManifest?.openclawVersion)],
    ['packaged release manifest', normalizeVersion(packagedManifest?.openclawVersion)],
  ];

  if (!baselineVersion) {
    pushRollbackBlocker(
      blockers.rollback,
      'Unable to resolve an OpenClaw rollback baseline version from config/kernel-releases/openclaw.json or desktop manifests.',
    );
  } else {
    for (const [label, version] of baselineAlignmentChecks) {
      if (!version) {
        pushRollbackBlocker(
          blockers.rollback,
          `${label} is missing the OpenClaw version required for rollback evidence.`,
        );
        continue;
      }

      if (version !== baselineVersion) {
        pushRollbackBlocker(
          blockers.rollback,
          `${label} is pinned to ${version} instead of rollback baseline ${baselineVersion}.`,
        );
      }
    }
  }

  phases.push(
    createPhase(
      'baseline-alignment',
      blockers.rollback.length === 0 ? 'passed' : 'failed',
      blockers.rollback.length === 0
        ? `rollback baseline ${baselineVersion} is aligned across config and desktop manifests`
        : 'rollback baseline is not aligned across config and desktop manifests',
      {
        baselineVersion,
      },
    ),
  );

  const resourceDir = path.join(
    workspaceRootDir,
    'packages',
    'sdkwork-clawstudio-desktop',
    'src-tauri',
    'resources',
    'openclaw',
  );

  let preparedRuntimeInspection = null;
  if (!bundledManifest) {
    pushRollbackBlocker(
      blockers.rollback,
      `Missing packaged OpenClaw manifest at ${paths.bundledManifestPath}.`,
    );
    phases.push(
      createPhase(
        'prepared-runtime',
        'failed',
        'packaged OpenClaw manifest is unavailable, so prepared runtime rollback evidence cannot be inspected',
      ),
    );
  } else {
    try {
      preparedRuntimeInspection = await inspectPreparedOpenClawRuntimeFn({
        resourceDir: resourceDir === DEFAULT_RESOURCE_DIR ? undefined : resourceDir,
        manifest: bundledManifest,
      });
      if (!preparedRuntimeInspection?.reusable) {
        pushRollbackBlocker(
          blockers.rollback,
          `Prepared OpenClaw runtime is not reusable: ${preparedRuntimeInspection?.reason ?? 'unknown'}.`,
        );
      }
      phases.push(
        createPhase(
          'prepared-runtime',
          preparedRuntimeInspection?.reusable ? 'passed' : 'failed',
          preparedRuntimeInspection?.reusable
            ? `prepared runtime is reusable (${preparedRuntimeInspection.reason ?? 'ready'})`
            : `prepared runtime is not reusable (${preparedRuntimeInspection?.reason ?? 'unknown'})`,
          {
            inspection: preparedRuntimeInspection,
          },
        ),
      );
    } catch (error) {
      pushRollbackBlocker(
        blockers.rollback,
        `Prepared OpenClaw runtime inspection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      phases.push(
        createPhase(
          'prepared-runtime',
          'failed',
          'prepared runtime inspection failed before rollback evidence could be proven',
          {
            error: error instanceof Error ? error.message : String(error),
          },
        ),
      );
    }
  }

  let packagedReleaseVerification = null;
  try {
    packagedReleaseVerification = await verifyDesktopOpenClawReleaseAssetsFn({
      workspaceRootDir,
      resourceDir: resourceDir === DEFAULT_RESOURCE_DIR ? undefined : resourceDir,
      target,
    });

    const packagedVersion = normalizeVersion(packagedReleaseVerification?.manifest?.openclawVersion);
    if (baselineVersion && packagedVersion !== baselineVersion) {
      pushRollbackBlocker(
        blockers.rollback,
        `Packaged OpenClaw release manifest is pinned to ${packagedVersion ?? 'unknown'} instead of rollback baseline ${baselineVersion}.`,
      );
    }

    phases.push(
      createPhase(
        'packaged-release-verify',
        blockers.rollback.some((entry) => entry.startsWith('Packaged OpenClaw release manifest'))
          ? 'failed'
          : 'passed',
        blockers.rollback.some((entry) => entry.startsWith('Packaged OpenClaw release manifest'))
          ? 'packaged OpenClaw release assets do not match the rollback baseline'
          : 'packaged OpenClaw release assets verified successfully',
        {
          verification: packagedReleaseVerification,
        },
      ),
    );
  } catch (error) {
    pushRollbackBlocker(
      blockers.rollback,
      `Packaged OpenClaw release assets could not be verified: ${error instanceof Error ? error.message : String(error)}`,
    );
    phases.push(
      createPhase(
        'packaged-release-verify',
        'failed',
        'packaged OpenClaw release assets could not be verified',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      ),
    );
  }

  let upgradeReadiness = null;
  if (normalizedTargetVersion) {
    upgradeReadiness = await assessOpenClawUpgradeReadinessFn({
      workspaceRootDir,
      targetVersion: normalizedTargetVersion,
    });
    blockers.upgrade.push(...(upgradeReadiness?.blockers ?? []));
    phases.push(
      createPhase(
        'upgrade-readiness',
        upgradeReadiness?.readyToUpgrade ? 'passed' : 'failed',
        upgradeReadiness?.readyToUpgrade
          ? `upgrade prerequisites are ready for ${normalizedTargetVersion}`
          : `upgrade prerequisites are blocked for ${normalizedTargetVersion}`,
        {
          readiness: upgradeReadiness,
        },
      ),
    );
  }

  const rollbackReady = blockers.rollback.length === 0;
  phases.push(
    createPhase(
      'rollback-readiness',
      rollbackReady ? 'passed' : 'failed',
      rollbackReady
        ? `rollback baseline ${baselineVersion} is backed by prepared runtime and verified packaged release assets`
        : 'rollback baseline is missing prepared runtime or packaged release evidence',
      {
        baselineVersion,
        blockers: [...blockers.rollback],
      },
    ),
  );

  return {
    workspaceRootDir,
    baselineVersion,
    targetVersion: normalizedTargetVersion,
    target: {
      platformId: target?.platformId ?? null,
      archId: target?.archId ?? null,
    },
    upgradeReady: normalizedTargetVersion ? blockers.upgrade.length === 0 : null,
    rollbackReady,
    blockers,
    phases,
    sources: {
      releaseConfigPath: paths.releaseConfigPath,
      bundledManifestPath: paths.bundledManifestPath,
      packagedManifestPath: paths.packagedManifestPath,
    },
    releaseConfig,
    bundledManifest,
    packagedManifest,
    preparedRuntimeInspection,
    packagedReleaseVerification,
    upgradeReadiness,
  };
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
    targetVersion: '',
    rollbackVersion: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--target-version') {
      options.targetVersion = readOptionValue(argv, index, '--target-version');
      index += 1;
      continue;
    }

    if (token === '--rollback-version') {
      options.rollbackVersion = readOptionValue(argv, index, '--rollback-version');
      index += 1;
      continue;
    }

    if (!options.targetVersion) {
      options.targetVersion = token;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await buildOpenClawUpgradeRollbackEvidence(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
