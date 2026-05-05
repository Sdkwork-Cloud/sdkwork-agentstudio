#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ensureLockedCargoSubcommandArgs } from './cargo-command-standards.mjs';
import { parseDesktopTargetTriple } from './release/desktop-targets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const runCargoScriptPath = path.join(rootDir, 'scripts', 'run-cargo.mjs');
const serverPackageDir = path.join(rootDir, 'packages', 'sdkwork-claw-server');
const serverHostTargetDir = path.join(serverPackageDir, 'src-host', 'target');
const SERVER_BUILD_TARGET_ENV_VAR = 'SDKWORK_SERVER_TARGET';
const SERVER_BUILD_WSL_DISTRO_ENV_VAR = 'SDKWORK_SERVER_BUILD_WSL_DISTRO';
const SERVER_BUILD_DISABLE_WSL_ENV_VAR = 'SDKWORK_SERVER_BUILD_DISABLE_WSL';
const LEGACY_SERVER_BINARY_BASENAME = 'sdkwork-claw-server';
const LEGACY_SERVER_PDB_BASENAME = 'sdkwork_claw_server';
const DEFAULT_WSL_DISTRIBUTION_PREFERENCES = [
  'Ubuntu-24.04',
  'Ubuntu-22.04',
  'Ubuntu',
  'Debian',
];

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
    targetTriple: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--target') {
      options.targetTriple = readOptionValue(argv, index, '--target');
      index += 1;
    }
  }

  return options;
}

export function resolveServerBuildTarget({
  targetTriple = '',
  env = process.env,
} = {}) {
  const explicitTarget = String(targetTriple ?? '').trim();
  if (explicitTarget.length > 0) {
    return explicitTarget;
  }

  return String(env?.[SERVER_BUILD_TARGET_ENV_VAR] ?? '').trim();
}

function isTruthyEnvFlag(value) {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  return normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'yes';
}

function shellEscapeSingleQuoted(value) {
  return `'${String(value ?? '').replaceAll('\'', '\'\"\'\"\'')}'`;
}

function convertWindowsPathToWslPath(pathValue) {
  const normalizedPath = path.resolve(pathValue);
  const driveLetterMatch = normalizedPath.match(/^([A-Za-z]):[\\/](.*)$/);
  if (!driveLetterMatch) {
    return normalizedPath.replaceAll('\\', '/');
  }

  const [, driveLetter, remainder = ''] = driveLetterMatch;
  const normalizedRemainder = remainder.replaceAll('\\', '/');
  return `/mnt/${driveLetter.toLowerCase()}/${normalizedRemainder}`;
}

function parseWslDistributionList(output) {
  return String(output ?? '')
    .replaceAll('\u0000', '')
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function listWslDistributions({
  commandRunner = spawnSync,
} = {}) {
  const result = commandRunner('wsl.exe', ['-l', '-q'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error) {
    return [];
  }
  if (result.status !== 0) {
    return [];
  }

  return parseWslDistributionList(result.stdout);
}

function distributionSupportsCargo({
  distribution = '',
  commandRunner = spawnSync,
} = {}) {
  const normalizedDistribution = String(distribution ?? '').trim();
  if (normalizedDistribution.length === 0) {
    return false;
  }

  const result = commandRunner('wsl.exe', [
    '--distribution',
    normalizedDistribution,
    '--',
    'bash',
    '-lc',
    'command -v cargo >/dev/null 2>&1',
  ], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error) {
    return false;
  }

  return result.status === 0;
}

function resolvePreferredWslDistribution({
  env = process.env,
  wslDistributions,
  distributionSupportsCargo: distributionSupportsCargoOverride,
} = {}) {
  const explicitDistribution = String(env?.[SERVER_BUILD_WSL_DISTRO_ENV_VAR] ?? '').trim();
  if (explicitDistribution.length > 0) {
    return explicitDistribution;
  }

  const availableDistributions = Array.isArray(wslDistributions)
    ? wslDistributions
    : listWslDistributions();
  const normalizedDistributions = availableDistributions
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);
  const rankedDistributions = [];

  for (const preferredDistribution of DEFAULT_WSL_DISTRIBUTION_PREFERENCES) {
    if (normalizedDistributions.includes(preferredDistribution)) {
      rankedDistributions.push(preferredDistribution);
    }
  }

  for (const distribution of normalizedDistributions) {
    if (!rankedDistributions.includes(distribution)) {
      rankedDistributions.push(distribution);
    }
  }

  const candidateDistributions = rankedDistributions.filter((value) => value !== 'docker-desktop');
  const cargoProbe = typeof distributionSupportsCargoOverride === 'function'
    ? distributionSupportsCargoOverride
    : (distribution) => distributionSupportsCargo({ distribution });

  for (const distribution of candidateDistributions) {
    if (cargoProbe(distribution)) {
      return distribution;
    }
  }

  return candidateDistributions[0] ?? '';
}

function createCargoBuildArgs(resolvedTargetTriple = '') {
  const args = ['build', '--manifest-path', 'src-host/Cargo.toml', '--release'];
  if (resolvedTargetTriple.length > 0) {
    args.push('--target', resolvedTargetTriple);
  }
  return ensureLockedCargoSubcommandArgs(args);
}

function createTargetEnv(resolvedTargetTriple = '') {
  const nextEnv = {};
  if (resolvedTargetTriple.length === 0) {
    return nextEnv;
  }

  const targetSpec = parseDesktopTargetTriple(resolvedTargetTriple);
  nextEnv.SDKWORK_SERVER_TARGET = resolvedTargetTriple;
  nextEnv.SDKWORK_SERVER_TARGET_PLATFORM = targetSpec.platform;
  nextEnv.SDKWORK_SERVER_TARGET_ARCH = targetSpec.arch;
  return nextEnv;
}

function createNativeServerBuildPlan({
  resolvedTargetTriple = '',
} = {}) {
  return {
    command: process.execPath,
    args: [runCargoScriptPath, ...createCargoBuildArgs(resolvedTargetTriple)],
    cwd: serverPackageDir,
    env: createTargetEnv(resolvedTargetTriple),
    runner: 'run-cargo',
  };
}

function resolveServerBuildReleaseDir(resolvedTargetTriple = '') {
  const normalizedTargetTriple = String(resolvedTargetTriple ?? '').trim();
  return normalizedTargetTriple.length > 0
    ? path.join(serverHostTargetDir, normalizedTargetTriple, 'release')
    : path.join(serverHostTargetDir, 'release');
}

function buildLegacyServerBuildArtifactPaths(resolvedTargetTriple = '') {
  const normalizedTargetTriple = String(resolvedTargetTriple ?? '').trim();
  const releaseDirectories = [
    resolveServerBuildReleaseDir(normalizedTargetTriple),
  ];

  if (normalizedTargetTriple.length > 0) {
    releaseDirectories.push(resolveServerBuildReleaseDir(''));
  }

  return [...new Set(releaseDirectories)].flatMap((releaseDir) => [
    path.join(releaseDir, `${LEGACY_SERVER_BINARY_BASENAME}.exe`),
    path.join(releaseDir, LEGACY_SERVER_BINARY_BASENAME),
    path.join(releaseDir, `${LEGACY_SERVER_BINARY_BASENAME}.d`),
    path.join(releaseDir, `${LEGACY_SERVER_PDB_BASENAME}.pdb`),
  ]);
}

export function removeLegacyServerBuildArtifacts({
  resolvedTargetTriple = '',
  fileSystem = { rmSync },
} = {}) {
  for (const artifactPath of buildLegacyServerBuildArtifactPaths(resolvedTargetTriple)) {
    fileSystem.rmSync(artifactPath, { force: true });
  }
}

function createWslServerBuildPlan({
  resolvedTargetTriple = '',
  wslDistribution = '',
} = {}) {
  const buildEnv = createTargetEnv(resolvedTargetTriple);
  const exportEntries = Object.entries(buildEnv)
    .map(([key, value]) => `${key}=${shellEscapeSingleQuoted(value)}`);
  const buildScriptLines = [
    'set -euo pipefail',
    `cd ${shellEscapeSingleQuoted(convertWindowsPathToWslPath(serverPackageDir))}`,
  ];

  if (exportEntries.length > 0) {
    buildScriptLines.push(`export ${exportEntries.join(' ')}`);
  }

  buildScriptLines.push(`cargo ${createCargoBuildArgs(resolvedTargetTriple).join(' ')}`);

  return {
    command: 'wsl.exe',
    args: [
      '--distribution',
      wslDistribution,
      '--',
      'bash',
      '-lc',
      buildScriptLines.join('\n'),
    ],
    cwd: serverPackageDir,
    env: {},
    runner: 'wsl',
    wslDistribution,
  };
}

export function createServerBuildPlan({
  targetTriple = '',
  env = process.env,
  hostPlatform = process.platform,
  wslDistributions,
  distributionSupportsCargo,
} = {}) {
  const resolvedTargetTriple = resolveServerBuildTarget({
    targetTriple,
    env,
  });

  if (resolvedTargetTriple.length > 0) {
    const targetSpec = parseDesktopTargetTriple(resolvedTargetTriple);
    if (
      hostPlatform === 'win32'
      && targetSpec.platform === 'linux'
      && !isTruthyEnvFlag(env?.[SERVER_BUILD_DISABLE_WSL_ENV_VAR])
    ) {
      const wslDistribution = resolvePreferredWslDistribution({
        env,
        wslDistributions,
        distributionSupportsCargo,
      });
      if (wslDistribution.length > 0) {
        return createWslServerBuildPlan({
          resolvedTargetTriple,
          wslDistribution,
        });
      }
    }
  }

  return createNativeServerBuildPlan({
    resolvedTargetTriple,
  });
}

export function runServerBuild({
  spawnSyncImpl = spawnSync,
  fileSystem = { rmSync },
  ...options
} = {}) {
  const runtimeEnv = options.env ?? process.env;
  const resolvedTargetTriple = resolveServerBuildTarget({
    targetTriple: options.targetTriple,
    env: runtimeEnv,
  });
  const plan = createServerBuildPlan({
    ...options,
    env: runtimeEnv,
  });

  const result = spawnSyncImpl(plan.command, plan.args, {
    cwd: plan.cwd,
    env: {
      ...runtimeEnv,
      ...plan.env,
    },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `server build failed with exit code ${result.status ?? 'unknown'}`,
    );
  }

  removeLegacyServerBuildArtifacts({
    resolvedTargetTriple,
    fileSystem,
  });

  return plan;
}

function main() {
  runServerBuild(parseArgs(process.argv.slice(2)));
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
