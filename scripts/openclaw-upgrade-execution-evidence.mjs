#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  ensureTauriTargetClean,
  inspectTauriTarget,
} from './ensure-tauri-target-clean.mjs';
import {
  resolveOpenClawTarget,
} from './prepare-openclaw-runtime.mjs';
import {
  buildDesktopTargetTriple,
  normalizeDesktopArch,
  normalizeDesktopPlatform,
} from './release/desktop-targets.mjs';
import {
  createDesktopReleaseBuildPlan,
  buildDesktopReleaseBuildPreflightPlan,
} from './run-desktop-release-build.mjs';
import {
  createComponentExecutionPlan,
} from './sync-bundled-components.mjs';
import {
  verifyDesktopOpenClawReleaseAssets,
} from './verify-desktop-openclaw-release-assets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const DEFAULT_SRC_TAURI_DIR = path.join(
  rootDir,
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
);
const DEFAULT_TARGET_CLEAN_DIR_NAME = 'check-desktop-openclaw-runtime';

function createPhase(id, status, detail, extra = {}) {
  return {
    id,
    status,
    detail,
    ...extra,
  };
}

function pushBlocker(blockers, message) {
  if (!blockers.includes(message)) {
    blockers.push(message);
  }
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function summarizePlan(plan) {
  return {
    command: plan?.command ?? null,
    args: Array.isArray(plan?.args) ? [...plan.args] : [],
  };
}

function summarizeTargetInspection(inspection) {
  return {
    targetDir: inspection?.targetDir ?? null,
    targetDirs: Array.isArray(inspection?.targetDirs) ? [...inspection.targetDirs] : [],
    removedTarget: inspection?.removedTarget === true,
    removedTargetDirs: Array.isArray(inspection?.removedTargetDirs)
      ? [...inspection.removedTargetDirs]
      : [],
    staleEntries: Array.isArray(inspection?.staleEntries) ? [...inspection.staleEntries] : [],
    bundledOpenClawIssues: Array.isArray(inspection?.bundledOpenClawIssues)
      ? [...inspection.bundledOpenClawIssues]
      : [],
    stale: inspection?.stale === true,
  };
}

function buildTargetCleanEnv({
  workspaceRootDir = rootDir,
  env = process.env,
} = {}) {
  return {
    ...env,
    CARGO_TARGET_DIR: path.join(
      path.resolve(workspaceRootDir),
      'target',
      DEFAULT_TARGET_CLEAN_DIR_NAME,
    ),
  };
}

function normalizeTargetInput({
  platform = process.platform,
  arch = process.arch,
  targetTriple = '',
} = {}) {
  const normalizedPlatform = normalizeDesktopPlatform(platform);
  const normalizedArch = normalizeDesktopArch(arch);
  const normalizedTargetTriple = String(targetTriple ?? '').trim()
    || buildDesktopTargetTriple({
      platform: normalizedPlatform,
      arch: normalizedArch,
    });

  return {
    platform: normalizedPlatform,
    arch: normalizedArch,
    targetTriple: normalizedTargetTriple,
    target: resolveOpenClawTarget(normalizedPlatform, normalizedArch),
  };
}

export async function buildOpenClawUpgradeExecutionEvidence({
  workspaceRootDir = rootDir,
  platform = process.platform,
  arch = process.arch,
  targetTriple = '',
  srcTauriDir = path.join(
    workspaceRootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
  ),
  createDesktopReleaseBuildPlanFn = createDesktopReleaseBuildPlan,
  buildDesktopReleaseBuildPreflightPlanFn = buildDesktopReleaseBuildPreflightPlan,
  createComponentExecutionPlanFn = createComponentExecutionPlan,
  ensureTauriTargetCleanFn = ensureTauriTargetClean,
  inspectTauriTargetFn = inspectTauriTarget,
  verifyDesktopOpenClawReleaseAssetsFn = verifyDesktopOpenClawReleaseAssets,
} = {}) {
  const blockers = [];
  const phases = [];
  const targetCleanEnv = buildTargetCleanEnv({ workspaceRootDir });
  const normalizedTarget = normalizeTargetInput({
    platform,
    arch,
    targetTriple,
  });

  const syncPlan = createDesktopReleaseBuildPlanFn({
    platform: normalizedTarget.platform,
    hostArch: normalizedTarget.arch,
    targetTriple: normalizedTarget.targetTriple,
    phase: 'sync',
    releaseMode: true,
  });
  const syncPlanCommand = Array.isArray(syncPlan?.args) ? syncPlan.args.join(' ') : '';
  const syncExecutionPlan = createComponentExecutionPlanFn({
    componentId: 'openclaw',
    devMode: false,
    releaseMode: true,
  });
  const syncPlanReady =
    /sync-bundled-components\.mjs/u.test(syncPlanCommand)
    && /--no-fetch/u.test(syncPlanCommand)
    && /--release/u.test(syncPlanCommand)
    && syncExecutionPlan?.shouldBuild === false
    && syncExecutionPlan?.shouldStage === false;
  if (!syncPlanReady) {
    pushBlocker(
      blockers,
      'Desktop release sync no longer routes OpenClaw through the dedicated release sync contract.',
    );
  }
  phases.push(
    createPhase(
      'sync-plan',
      syncPlanReady ? 'passed' : 'failed',
      syncPlanReady
        ? 'release sync still routes through sync-bundled-components and defers OpenClaw build/stage to the dedicated prepare phase'
        : 'release sync drifted away from the expected OpenClaw release-sync contract',
      {
        plan: summarizePlan(syncPlan),
        syncExecutionPlan,
      },
    ),
  );

  let targetCleanInspection = null;
  try {
    const ensuredTarget = ensureTauriTargetCleanFn(srcTauriDir, { env: targetCleanEnv });
    const removedResourceDirs = Array.isArray(ensuredTarget?.removedResourceDirs)
      ? ensuredTarget.removedResourceDirs
      : [];
    const targetCleanMutated =
      ensuredTarget?.removedTarget === true || removedResourceDirs.length > 0;
    const finalInspection =
      targetCleanMutated
        ? inspectTauriTargetFn(srcTauriDir, { env: targetCleanEnv })
        : ensuredTarget;
    targetCleanInspection = {
      ensuredTarget: summarizeTargetInspection(ensuredTarget),
      finalInspection: summarizeTargetInspection(finalInspection),
    };

    if (finalInspection?.stale === true) {
      pushBlocker(
        blockers,
        'Tauri target cache still contains stale packaged OpenClaw or permission references after cleanup.',
      );
      phases.push(
        createPhase(
          'target-clean',
          'failed',
          'tauri target cleanup did not converge to a clean target cache',
          targetCleanInspection,
        ),
      );
    } else {
      phases.push(
        createPhase(
          'target-clean',
          'passed',
          targetCleanMutated
            ? 'tauri target cleanup removed stale cache entries and re-inspection is now clean'
            : 'tauri target cache is already clean for the desktop upgrade path',
          targetCleanInspection,
        ),
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushBlocker(blockers, `Tauri target cleanup failed: ${message}`);
    phases.push(
      createPhase(
        'target-clean',
        'failed',
        'tauri target cleanup failed before upgrade execution evidence could be proven',
        {
          error: message,
        },
      ),
    );
  }

  const preparePlan = createDesktopReleaseBuildPlanFn({
    platform: normalizedTarget.platform,
    hostArch: normalizedTarget.arch,
    targetTriple: normalizedTarget.targetTriple,
    phase: 'prepare-openclaw',
  });
  const preparePlanCommand = Array.isArray(preparePlan?.args) ? preparePlan.args.join(' ') : '';
  const preparePlanReady = /prepare-openclaw-runtime\.mjs/u.test(preparePlanCommand);
  if (!preparePlanReady) {
    pushBlocker(
      blockers,
      'Desktop release prepare phase no longer routes through prepare-openclaw-runtime.',
    );
  }
  phases.push(
    createPhase(
      'prepare-plan',
      preparePlanReady ? 'passed' : 'failed',
      preparePlanReady
        ? 'release prepare phase still routes through prepare-openclaw-runtime'
        : 'release prepare phase drifted away from prepare-openclaw-runtime',
      {
        plan: summarizePlan(preparePlan),
      },
    ),
  );

  const verifyPlan = buildDesktopReleaseBuildPreflightPlanFn({
    platform: normalizedTarget.platform,
    hostArch: normalizedTarget.arch,
    targetTriple: normalizedTarget.targetTriple,
    phase: 'bundle',
  });
  const verifyPlanCommand = Array.isArray(verifyPlan?.args) ? verifyPlan.args.join(' ') : '';

  let releaseVerification = null;
  try {
    releaseVerification = await verifyDesktopOpenClawReleaseAssetsFn({
      workspaceRootDir,
      target: normalizedTarget.target,
    });
    const verifyPlanReady = /verify-desktop-openclaw-release-assets\.mjs/u.test(verifyPlanCommand);
    if (!verifyPlanReady) {
      pushBlocker(
        blockers,
        'Desktop release verify preflight no longer routes through verify-desktop-openclaw-release-assets.',
      );
    }
    phases.push(
      createPhase(
        'release-verify',
        verifyPlanReady ? 'passed' : 'failed',
        verifyPlanReady
          ? 'desktop OpenClaw release assets still verify before bundle/smoke execution'
          : 'desktop release verify preflight drifted away from verify-desktop-openclaw-release-assets',
        {
          plan: summarizePlan(verifyPlan),
          releaseVerification,
        },
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushBlocker(blockers, message);
    phases.push(
      createPhase(
        'release-verify',
        'failed',
        'desktop OpenClaw release asset verification failed',
        {
          plan: summarizePlan(verifyPlan),
          error: message,
        },
      ),
    );
  }

  const executionReady = blockers.length === 0;
  phases.push(
    createPhase(
      'execution-readiness',
      executionReady ? 'passed' : 'failed',
      executionReady
        ? 'desktop OpenClaw upgrade execution evidence is complete'
        : 'desktop OpenClaw upgrade execution evidence is incomplete',
    ),
  );

  return {
    workspaceRootDir,
    platform: normalizedTarget.platform,
    arch: normalizedTarget.arch,
    targetTriple: normalizedTarget.targetTriple,
    target: normalizedTarget.target,
    srcTauriDir: path.resolve(srcTauriDir),
    executionReady,
    blockers,
    phases,
    syncExecutionPlan,
    targetCleanInspection,
    releaseVerification,
  };
}

export function parseArgs(argv) {
  const options = {
    workspaceRootDir: rootDir,
    platform: process.platform,
    arch: process.arch,
    targetTriple: '',
    srcTauriDir: DEFAULT_SRC_TAURI_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--workspace-root') {
      options.workspaceRootDir = path.resolve(readOptionValue(argv, index, current));
      index += 1;
      continue;
    }
    if (current === '--platform') {
      options.platform = readOptionValue(argv, index, current);
      index += 1;
      continue;
    }
    if (current === '--arch') {
      options.arch = readOptionValue(argv, index, current);
      index += 1;
      continue;
    }
    if (current === '--target') {
      options.targetTriple = readOptionValue(argv, index, current);
      index += 1;
      continue;
    }
    if (current === '--src-tauri-dir') {
      options.srcTauriDir = path.resolve(readOptionValue(argv, index, current));
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${current}`);
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await buildOpenClawUpgradeExecutionEvidence(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.executionReady) {
    process.exitCode = 1;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
