#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { withRustToolchainPath } from './ensure-tauri-rust-toolchain.mjs';
import { normalizeViteMode } from './run-vite-host.mjs';
import { withSupportedWindowsCmakeGenerator } from './desktop-build-helpers.mjs';
import { resolveExistingDesktopBundleRoot } from './release/package-release-assets.mjs';
import {
  buildDesktopReleaseEnv,
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  parseDesktopTargetTriple,
} from './release/desktop-targets.mjs';
import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
  resolveDesktopBundleTargets,
  serializeBundleTargets,
} from './release/release-profiles.mjs';
import {
  DEFAULT_KERNEL_PACKAGE_PROFILE_ID,
  resolveKernelPackageProfile,
} from './release/kernel-package-profiles.mjs';
import { buildDesktopCargoTargetEnv } from './desktop-cargo-target.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const desktopSrcTauriDir = path.join('packages', 'sdkwork-claw-desktop', 'src-tauri');
const desktopTauriBundleOverlayConfig = path.join(
  'packages',
  'sdkwork-claw-desktop',
  'src-tauri',
  'generated',
  'tauri.bundle.overlay.json',
);
const desktopPackageName = '@sdkwork/claw-desktop';

export function resolveSpawnCommand(command, platform = process.platform) {
  if (platform !== 'win32') {
    return command;
  }

  if (path.extname(command)) {
    return command;
  }

  if (command === 'pnpm') {
    return 'pnpm.cmd';
  }

  return command;
}

export function resolvePnpmExecutionPlan({
  platform = process.platform,
  env = process.env,
  nodeExecutable = process.execPath,
  pathExists = existsSync,
} = {}) {
  if (platform !== 'win32') {
    return {
      command: resolveSpawnCommand('pnpm', platform),
      argsPrefix: [],
      shell: false,
    };
  }

  const candidatePaths = [
    String(env?.npm_execpath ?? '').trim(),
    path.join(path.dirname(nodeExecutable), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
  ].filter(Boolean);

  const pnpmCliPath = candidatePaths.find((candidate) => pathExists(candidate));
  if (pnpmCliPath) {
    return {
      command: nodeExecutable,
      argsPrefix: [pnpmCliPath],
      shell: false,
    };
  }

  return {
    command: resolveSpawnCommand('pnpm', platform),
    argsPrefix: [],
    shell: false,
  };
}

function shouldRunOpenClawBundlePreflight({
  phase,
  packageProfileId,
} = {}) {
  const normalizedPhase = String(phase ?? 'all').trim().toLowerCase() || 'all';
  if (!(normalizedPhase === 'bundle' || normalizedPhase === 'all')) {
    return false;
  }

  return resolveKernelPackageProfile(packageProfileId).includedKernelIds.includes('openclaw');
}

function resolveDesktopPlatformTauriConfigPath(platform) {
  const normalizedPlatform = normalizeDesktopPlatform(platform);
  if (normalizedPlatform === 'linux') {
    return path.join('src-tauri', 'tauri.linux.conf.json');
  }
  if (normalizedPlatform === 'macos') {
    return path.join('src-tauri', 'tauri.macos.conf.json');
  }

  return null;
}

function resolveReleasePhasePlan({
  profileId,
  packageProfileId,
  phase,
  requestedTargetTriple,
  releaseMode,
  viteMode,
  env,
  platform,
  hostArch,
  bundleTargets,
}) {
  switch (phase) {
    case 'sync':
      return {
        command: process.execPath,
        args: [
          'scripts/sync-bundled-components.mjs',
          '--no-fetch',
          ...(releaseMode ? ['--release'] : []),
          '--package-profile',
          packageProfileId,
        ],
      };
    case 'prepare-target':
      return {
        command: process.execPath,
        args: ['scripts/ensure-tauri-target-clean.mjs', desktopSrcTauriDir],
      };
    case 'prepare-openclaw':
      return {
        command: process.execPath,
        args: ['scripts/prepare-openclaw-runtime.mjs'],
      };
    case 'bundle': {
      const resolvedBundleTargets = resolveDesktopBundleTargets({
        profileId,
        platform,
        targetTriple: requestedTargetTriple,
        arch: normalizeDesktopArch(hostArch),
        bundleTargets,
      });

      if (normalizeDesktopPlatform(platform) === 'windows') {
        return {
          command: process.execPath,
          args: [
            'scripts/run-windows-tauri-bundle.mjs',
            '--profile',
            profileId,
            '--config',
            desktopTauriBundleOverlayConfig,
            '--bundles',
            serializeBundleTargets(resolvedBundleTargets),
            ...(requestedTargetTriple
              && shouldPassExplicitTauriTarget({
                requestedTargetTriple,
                platform,
                hostArch,
              })
              ? ['--target', requestedTargetTriple]
              : []),
          ],
        };
      }

      const args = [
        '--dir',
        path.join('packages', 'sdkwork-claw-desktop'),
        'exec',
        'tauri',
        'build',
      ];
      const platformTauriConfigPath = resolveDesktopPlatformTauriConfigPath(platform);
      if (platformTauriConfigPath) {
        args.push('--config', platformTauriConfigPath);
      }
      args.push(
        '--config',
        path.join('src-tauri', 'generated', 'tauri.bundle.overlay.json'),
      );
      args.push('--bundles', serializeBundleTargets(resolvedBundleTargets));
      if (
        requestedTargetTriple
        && shouldPassExplicitTauriTarget({
          requestedTargetTriple,
          platform,
          hostArch,
        })
      ) {
        args.push('--target', requestedTargetTriple);
      }
      return {
        command: 'pnpm',
        args,
        bundleTargets: resolvedBundleTargets,
      };
    }
    case 'all': {
      const resolvedBundleTargets = resolveDesktopBundleTargets({
        profileId,
        platform,
        targetTriple: requestedTargetTriple,
        arch: normalizeDesktopArch(hostArch),
        bundleTargets,
      });
      const pnpmExecutionPlan = resolvePnpmExecutionPlan({
        platform,
        env,
      });
      const args = [
        ...pnpmExecutionPlan.argsPrefix,
        '--filter',
        desktopPackageName,
        'run',
        'tauri:build',
        '--',
        '--profile',
        profileId,
        '--package-profile',
        packageProfileId,
        '--vite-mode',
        normalizeViteMode(viteMode, 'production'),
        ...(resolvedBundleTargets.length > 0
          ? ['--bundles', serializeBundleTargets(resolvedBundleTargets)]
          : []),
      ];
      if (requestedTargetTriple) {
        args.push('--target', requestedTargetTriple);
      }
      return {
        command: pnpmExecutionPlan.command,
        args,
        shell: pnpmExecutionPlan.shell,
      };
    }
    default:
      throw new Error(`Unsupported desktop release phase: ${phase}`);
  }
}

export function createDesktopReleaseBuildPlan({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  packageProfileId = '',
  platform = process.platform,
  hostArch = process.arch,
  env = process.env,
  targetTriple = '',
  phase = 'all',
  releaseMode = false,
  viteMode = 'production',
  bundleTargets = [],
} = {}) {
  const requestedTargetTriple = String(targetTriple ?? '').trim();
  const resolvedEnv = requestedTargetTriple
    ? buildDesktopReleaseEnv({
        env,
        targetTriple: requestedTargetTriple,
      })
    : { ...env };
  const cargoTargetEnv = buildDesktopCargoTargetEnv({
    workspaceRootDir: rootDir,
    env: resolvedEnv,
    platform,
    cwd: rootDir,
  });
  const rustToolchainEnv = withRustToolchainPath(cargoTargetEnv, { platform });
  rustToolchainEnv.SDKWORK_VITE_MODE = normalizeViteMode(
    viteMode ?? rustToolchainEnv.SDKWORK_VITE_MODE,
    'production',
  );
  const resolvedPackageProfileId = resolveKernelPackageProfile(
    String(packageProfileId ?? '').trim()
      || resolveReleaseProfile(profileId).defaultPackageProfileId
      || DEFAULT_KERNEL_PACKAGE_PROFILE_ID,
  ).profileId;
  rustToolchainEnv.SDKWORK_KERNEL_PACKAGE_PROFILE_ID = resolvedPackageProfileId;

  const normalizedPhase = String(phase ?? 'all').trim().toLowerCase() || 'all';
  const effectiveReleaseMode = releaseMode || normalizedPhase === 'sync';
  const plan = resolveReleasePhasePlan({
    profileId,
    packageProfileId: resolvedPackageProfileId,
    phase: normalizedPhase,
    requestedTargetTriple,
    releaseMode: effectiveReleaseMode,
    viteMode,
    env: rustToolchainEnv,
    platform,
    hostArch,
    bundleTargets,
  });

  return {
    command: resolveSpawnCommand(plan.command, platform),
    args: plan.args,
    cwd: rootDir,
    env: withSupportedWindowsCmakeGenerator(rustToolchainEnv, platform),
    bundleTargets: plan.bundleTargets ?? [],
    shell: plan.shell ?? false,
  };
}

export function buildDesktopReleaseBuildPreflightPlan({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  packageProfileId = '',
  platform = process.platform,
  hostArch = process.arch,
  env = process.env,
  targetTriple = '',
  phase = 'all',
} = {}) {
  const resolvedPackageProfileId = resolveKernelPackageProfile(
    String(packageProfileId ?? '').trim()
      || resolveReleaseProfile(profileId).defaultPackageProfileId
      || DEFAULT_KERNEL_PACKAGE_PROFILE_ID,
  ).profileId;
  const normalizedPhase = String(phase ?? 'all').trim().toLowerCase() || 'all';

  if (!shouldRunOpenClawBundlePreflight({
    phase: normalizedPhase,
    packageProfileId: resolvedPackageProfileId,
  })) {
    return null;
  }

  const requestedTargetTriple = String(targetTriple ?? '').trim();
  const targetEnv = requestedTargetTriple
    ? buildDesktopReleaseEnv({
        env,
        targetTriple: requestedTargetTriple,
      })
    : buildDesktopReleaseEnv({
        env,
        platform: normalizeDesktopPlatform(platform),
        arch: normalizeDesktopArch(hostArch),
      });

  return {
    command: process.execPath,
    args: normalizedPhase === 'all'
      ? ['scripts/prepare-openclaw-runtime.mjs']
      : ['scripts/verify-desktop-openclaw-release-assets.mjs'],
    cwd: rootDir,
    env: withSupportedWindowsCmakeGenerator(
      withRustToolchainPath(targetEnv, { platform }),
      platform,
    ),
    shell: false,
  };
}

function normalizeBundleTargets(bundleTargets) {
  return Array.isArray(bundleTargets)
    ? bundleTargets
      .map((entry) => String(entry ?? '').trim().toLowerCase())
      .filter(Boolean)
    : [];
}

function isTemporaryMacosDmgFileName(fileName) {
  const normalizedFileName = String(fileName ?? '').trim().toLowerCase();
  return normalizedFileName.endsWith('.dmg') && normalizedFileName.startsWith('rw.');
}

function isCompletedMacosDmgFileName(fileName) {
  const normalizedFileName = String(fileName ?? '').trim().toLowerCase();
  return normalizedFileName.endsWith('.dmg') && !isTemporaryMacosDmgFileName(normalizedFileName);
}

function listMacosDmgFiles(bundleRoot, bundleDirectories = ['dmg', 'macos']) {
  if (!bundleRoot || !existsSync(bundleRoot)) {
    return [];
  }

  return bundleDirectories.flatMap((bundleDirectory) => {
    const candidateDirectory = path.join(bundleRoot, bundleDirectory);
    if (!existsSync(candidateDirectory)) {
      return [];
    }

    return readdirSync(candidateDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && String(entry.name ?? '').toLowerCase().endsWith('.dmg'))
      .map((entry) => ({
        name: entry.name,
        absolutePath: path.join(candidateDirectory, entry.name),
        directory: bundleDirectory,
      }));
  });
}

function bundleOutputExists(bundleRoot, bundleTarget) {
  if (!bundleRoot || !existsSync(bundleRoot)) {
    return false;
  }

  if (bundleTarget === 'app') {
    const macosBundleDir = path.join(bundleRoot, 'macos');
    return existsSync(macosBundleDir)
      && readdirSync(macosBundleDir, { withFileTypes: true })
        .some((entry) => entry.isDirectory() && entry.name.endsWith('.app'));
  }

  if (bundleTarget === 'dmg') {
    return listMacosDmgFiles(bundleRoot)
      .some((entry) => isCompletedMacosDmgFileName(entry.name));
  }

  return false;
}

function resolveTemporaryMacosDmgRepairPlan(bundleRoot) {
  const temporaryDmg = listMacosDmgFiles(bundleRoot)
    .find((entry) => isTemporaryMacosDmgFileName(entry.name));
  if (!temporaryDmg) {
    return null;
  }

  const finalFileName = temporaryDmg.name.replace(/^rw\.[^.]+\./i, '');
  if (!isCompletedMacosDmgFileName(finalFileName)) {
    return null;
  }

  return {
    sourcePath: temporaryDmg.absolutePath,
    targetPath: path.join(bundleRoot, 'dmg', finalFileName),
  };
}

export function canRecoverMacosBundleFailure({
  platform = process.platform,
  bundleTargets = [],
  targetTriple = '',
  targetDir = path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'target',
  ),
} = {}) {
  if (normalizeDesktopPlatform(platform) !== 'macos') {
    return false;
  }

  const normalizedBundleTargets = normalizeBundleTargets(bundleTargets);
  if (normalizedBundleTargets.length === 0 || !normalizedBundleTargets.includes('dmg')) {
    return false;
  }

  const bundleRoot = resolveExistingDesktopBundleRoot({
    targetTriple,
    targetDir,
  });

  return normalizedBundleTargets.every((bundleTarget) => (
    bundleOutputExists(bundleRoot, bundleTarget)
  ));
}

export function repairMacosDmgBundleOutput({
  platform = process.platform,
  bundleTargets = [],
  targetTriple = '',
  targetDir = path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src-tauri',
    'target',
  ),
  spawnSyncImpl = spawnSync,
} = {}) {
  if (normalizeDesktopPlatform(platform) !== 'macos') {
    return false;
  }

  const normalizedBundleTargets = normalizeBundleTargets(bundleTargets);
  if (!normalizedBundleTargets.includes('dmg')) {
    return false;
  }

  const bundleRoot = resolveExistingDesktopBundleRoot({
    targetTriple,
    targetDir,
  });
  const repairPlan = resolveTemporaryMacosDmgRepairPlan(bundleRoot);
  if (!repairPlan) {
    return false;
  }

  mkdirSync(path.dirname(repairPlan.targetPath), { recursive: true });
  rmSync(repairPlan.targetPath, { force: true });

  const repairResult = spawnSyncImpl(
    'hdiutil',
    [
      'convert',
      repairPlan.sourcePath,
      '-format',
      'UDZO',
      '-o',
      repairPlan.targetPath,
    ],
      {
        stdio: 'inherit',
        windowsHide: true,
      },
    );

  if (repairResult?.error) {
    console.error(`[run-desktop-release-build] failed to repair macOS dmg output: ${repairResult.error.message}`);
    return false;
  }
  if ((repairResult?.status ?? 1) !== 0) {
    console.error(
      `[run-desktop-release-build] failed to repair macOS dmg output: hdiutil exited with code ${repairResult?.status ?? 'unknown'}`,
    );
    return false;
  }

  return bundleOutputExists(bundleRoot, 'dmg');
}

function shouldPassExplicitTauriTarget({
  requestedTargetTriple,
  platform,
  hostArch,
}) {
  if (!requestedTargetTriple) {
    return false;
  }

  const requestedTarget = parseDesktopTargetTriple(requestedTargetTriple);
  const nativePlatform = normalizeDesktopPlatform(platform);
  const nativeArch = normalizeDesktopArch(hostArch);

  return requestedTarget.platform !== nativePlatform || requestedTarget.arch !== nativeArch;
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
    packageProfileId: '',
    targetTriple: '',
    phase: 'all',
    releaseMode: false,
    viteMode: 'production',
    bundleTargets: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--target') {
      options.targetTriple = readOptionValue(argv, index, '--target');
      index += 1;
      continue;
    }

    if (token === '--package-profile') {
      options.packageProfileId = readOptionValue(argv, index, '--package-profile');
      index += 1;
      continue;
    }

    if (token === '--phase') {
      options.phase = readOptionValue(argv, index, '--phase');
      index += 1;
      continue;
    }

    if (token === '--release') {
      options.releaseMode = true;
      continue;
    }

    if (token === '--vite-mode') {
      options.viteMode = readOptionValue(argv, index, '--vite-mode');
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

function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const plan = createDesktopReleaseBuildPlan({
    profileId: options.profileId,
    packageProfileId: options.packageProfileId,
    phase: options.phase,
    targetTriple: options.targetTriple,
    releaseMode: options.releaseMode,
    viteMode: options.viteMode,
    bundleTargets: options.bundleTargets,
  });
  const preflightPlan = buildDesktopReleaseBuildPreflightPlan({
    profileId: options.profileId,
    packageProfileId: options.packageProfileId,
    phase: options.phase,
    targetTriple: options.targetTriple,
    platform: process.platform,
    hostArch: process.arch,
    env: plan.env,
  });
  if (preflightPlan) {
    const preflightResult = spawnSync(preflightPlan.command, preflightPlan.args, {
        cwd: preflightPlan.cwd,
        env: preflightPlan.env,
        stdio: 'inherit',
        shell: preflightPlan.shell,
        windowsHide: true,
      });
    if (preflightResult.error) {
      console.error(
        `[run-desktop-release-build] OpenClaw release-asset preflight failed: ${preflightResult.error.message}`,
      );
      process.exit(1);
    }
    if (preflightResult.signal) {
      console.error(
        `[run-desktop-release-build] OpenClaw release-asset preflight exited with signal ${preflightResult.signal}`,
      );
      process.exit(1);
    }
    if ((preflightResult.status ?? 1) !== 0) {
      process.exit(preflightResult.status ?? 1);
    }
  }
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: 'inherit',
    shell: plan.shell,
    windowsHide: true,
  });

  child.on('error', (error) => {
    console.error(`[run-desktop-release-build] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[run-desktop-release-build] build exited with signal ${signal}`);
      process.exit(1);
    }

    const repairedMacosDmg =
      (code ?? 0) !== 0
      && options.phase === 'bundle'
      && repairMacosDmgBundleOutput({
        platform: process.platform,
        targetTriple: options.targetTriple,
        bundleTargets: plan.bundleTargets,
      });

    if (
      (code ?? 0) !== 0
      && options.phase === 'bundle'
      && canRecoverMacosBundleFailure({
        platform: process.platform,
        targetTriple: options.targetTriple,
        bundleTargets: plan.bundleTargets,
      })
    ) {
      if (repairedMacosDmg) {
        console.warn(
          '[run-desktop-release-build] recovered a macOS bundle failure by converting a temporary rw dmg output into the final dmg artifact.',
        );
      } else {
        console.warn(
          '[run-desktop-release-build] treating non-zero macOS bundle exit as recoverable because the requested .app/.dmg outputs already exist.',
        );
      }
      process.exit(0);
    }

    process.exit(code ?? 0);
  });
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
