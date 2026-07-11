#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

function resolvePlatformPathModule(platform = process.platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function resolvePathModuleForValue(value, platform = process.platform) {
  const normalizedValue = String(value ?? '').trim();
  if (
    platform === 'win32'
    && normalizedValue.includes('/')
    && !normalizedValue.includes('\\')
  ) {
    return path.posix;
  }

  return resolvePlatformPathModule(platform);
}

function resolvePathDelimiter(platform = process.platform) {
  return platform === 'win32' ? ';' : ':';
}

function resolvePathKey(env = process.env, platform = process.platform) {
  return Object.keys(env).find((key) => key.toUpperCase() === 'PATH')
    ?? (platform === 'win32' ? 'Path' : 'PATH');
}

function normalizePathEntry(entry, platform = process.platform) {
  const pathModule = resolvePlatformPathModule(platform);
  const normalized = pathModule.normalize(String(entry ?? '').trim());

  return platform === 'win32'
    ? normalized.replace(/[\\/]+$/, '').toLowerCase()
    : normalized.replace(/\/+$/, '');
}

function splitPathEntries(pathValue, platform = process.platform) {
  return String(pathValue ?? '')
    .split(resolvePathDelimiter(platform))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function commandExecutableName(command, platform = process.platform) {
  return platform === 'win32' ? `${command}.exe` : command;
}

function uniquePathEntries(entries, platform = process.platform) {
  const dedupedEntries = [];
  const seen = new Set();

  for (const entry of entries) {
    const normalizedEntry = normalizePathEntry(entry, platform);
    if (!normalizedEntry || seen.has(normalizedEntry)) {
      continue;
    }

    seen.add(normalizedEntry);
    dedupedEntries.push(entry);
  }

  return dedupedEntries;
}

function resolveCargoHomeBinDir(cargoHome, platform = process.platform) {
  const trimmedCargoHome = typeof cargoHome === 'string' ? cargoHome.trim() : '';
  if (!trimmedCargoHome) {
    return null;
  }

  const pathModule = resolvePathModuleForValue(trimmedCargoHome, platform);
  return pathModule.basename(trimmedCargoHome).toLowerCase() === 'bin'
    ? trimmedCargoHome
    : pathModule.join(trimmedCargoHome, 'bin');
}

function resolveRustToolchainBinCandidates({
  env = process.env,
  platform = process.platform,
  homeDir = env.HOME ?? os.homedir(),
  userProfileDir = env.USERPROFILE ?? homeDir,
} = {}) {
  const pathModule = resolvePlatformPathModule(platform);
  const candidates = [];
  const cargoHomeBinDir = resolveCargoHomeBinDir(env.CARGO_HOME, platform);

  if (cargoHomeBinDir) {
    candidates.push(cargoHomeBinDir);
  }

  const standardRustHomeDir =
    platform === 'win32'
      ? (typeof userProfileDir === 'string' ? userProfileDir.trim() : '')
      : (typeof homeDir === 'string' ? homeDir.trim() : '');

  if (standardRustHomeDir) {
    const standardRustHomePathModule = resolvePathModuleForValue(standardRustHomeDir, platform);
    candidates.push(standardRustHomePathModule.join(standardRustHomeDir, '.cargo', 'bin'));
  }

  return uniquePathEntries(candidates, platform);
}

function resolveExistingRustToolchainBinDirs({
  env = process.env,
  platform = process.platform,
  requiredCommands = ['cargo', 'rustc'],
  pathExists = existsSync,
} = {}) {
  return resolveRustToolchainBinCandidates({ env, platform }).filter((candidateDir) => {
    return requiredCommands.every((command) => {
      return pathExists(
        resolvePathModuleForValue(candidateDir, platform).join(
          candidateDir,
          commandExecutableName(command, platform),
        ),
      );
    });
  });
}

function normalizeOutput(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatCommandDisplay(command, args = []) {
  return [command, ...args].join(' ').trim();
}

function formatInspectionFailure(inspection) {
  if (inspection.reason === 'not-found') {
    return `command was not found in PATH${inspection.error ? ` (${inspection.error})` : ''}`;
  }

  if (inspection.reason === 'non-zero-exit') {
    return inspection.error || `${formatCommandDisplay(inspection.command, inspection.args)} exited with a non-zero status`;
  }

  if (inspection.error) {
    return inspection.error;
  }

  return 'command inspection failed for an unknown reason';
}

function formatInspectionCommandList(inspections) {
  return inspections.map((inspection) => inspection.command).join(', ');
}

export function inspectCommandAvailability(command, args = ['--version'], options = {}) {
  const platform = options.platform ?? process.platform;
  const env = withRustToolchainPath(options.env ?? process.env, {
    platform,
    requiredCommands: Array.isArray(options.requiredCommands) && options.requiredCommands.length > 0
      ? options.requiredCommands
      : [command],
  });
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    return {
      available: false,
      command,
      args,
      reason: result.error.code === 'ENOENT' ? 'not-found' : 'spawn-error',
      error: result.error.message,
    };
  }

  const stdout = normalizeOutput(result.stdout);
  const stderr = normalizeOutput(result.stderr);
  if (result.status !== 0) {
    return {
      available: false,
      command,
      args,
      reason: 'non-zero-exit',
      error: stderr || stdout || `${formatCommandDisplay(command, args)} exited with status ${result.status ?? 'unknown'}`,
    };
  }

  return {
    available: true,
    command,
    args,
    stdout,
    stderr,
  };
}

export function buildMissingRustToolchainMessage(inspections) {
  return buildMissingRustToolchainMessageWithContext(inspections);
}

function buildMissingRustToolchainMessageWithContext(inspections, options = {}) {
  const failedInspections = Array.isArray(inspections)
    ? inspections.filter((inspection) => inspection && inspection.available === false)
    : [];
  const blockedNodeProcessInspections = Array.isArray(options.blockedNodeProcessInspections)
    ? options.blockedNodeProcessInspections.filter((inspection) => inspection && inspection.available === false)
    : [];
  const missingInspections = failedInspections.filter((inspection) => inspection.reason === 'not-found');
  const blockedInspections = failedInspections.filter((inspection) => inspection.reason === 'spawn-error');
  const unavailableInspections = failedInspections.filter((inspection) => {
    return inspection.reason !== 'not-found' && inspection.reason !== 'spawn-error';
  });
  const detailLines = failedInspections.map((inspection) => {
    return `- ${inspection.command}: ${formatInspectionFailure(inspection)}`;
  });
  const summaryLines = [
    missingInspections.length > 0
      ? `Missing command(s): ${formatInspectionCommandList(missingInspections)}`
      : null,
    blockedInspections.length > 0
      ? `Blocked command(s): ${formatInspectionCommandList(blockedInspections)}`
      : null,
    unavailableInspections.length > 0
      ? `Unavailable command(s): ${formatInspectionCommandList(unavailableInspections)}`
      : null,
    blockedNodeProcessInspections.length > 0
      ? `Node child-process blocker(s): ${formatInspectionCommandList(blockedNodeProcessInspections)}`
      : null,
  ].filter(Boolean);
  const guidanceLines = [];
  const verificationLines = [];

  if (missingInspections.length > 0) {
    guidanceLines.push(
      'Install Rust via rustup: https://rustup.rs/',
    );
    verificationLines.push('Restart the terminal after installation, then verify:');
  }

  if (blockedInspections.length > 0 || unavailableInspections.length > 0) {
    guidanceLines.push(
      'The Rust commands appear to exist but could not be launched by the current Node process.',
      'This usually points to endpoint security, execution policy, or sandbox restrictions rather than a missing Rust install.',
    );
  }

  if (blockedNodeProcessInspections.length > 0) {
    guidanceLines.push(
      'The current Node process also could not launch standard Windows shells.',
      'This is a broader child-process restriction than a Rust toolchain problem.',
      'Agent Studio native commands will keep failing until Node is allowed to spawn Windows executables.',
    );
  }

  if (blockedInspections.length > 0 || unavailableInspections.length > 0) {
    verificationLines.push(
      'Confirm the executable locations with "where.exe cargo" / "where.exe rustc" or "Get-Command cargo" / "Get-Command rustc" on Windows, or "which cargo" / "which rustc" on macOS/Linux.',
      'Then verify in the same terminal:',
    );
  }

  if (guidanceLines.length === 0 && verificationLines.length === 0) {
    verificationLines.push(
      'Then verify in the same terminal:',
    );
  }

  return [
    'Rust/Cargo toolchain is required for Agent Studio native desktop and server development, checks, and builds.',
    ...(summaryLines.length > 0 ? summaryLines : ['Unavailable command(s): cargo, rustc']),
    ...(detailLines.length > 0 ? ['', 'Detected issue(s):', ...detailLines] : []),
    '',
    ...guidanceLines,
    ...verificationLines,
    '- cargo --version',
    '- rustc --version',
    'If you only need the browser host right now, run: pnpm dev',
  ].join('\n');
}

export function withRustToolchainPath(baseEnv = process.env, options = {}) {
  const platform = options.platform ?? process.platform;
  const requiredCommands =
    Array.isArray(options.requiredCommands) && options.requiredCommands.length > 0
      ? options.requiredCommands
      : ['cargo', 'rustc'];
  const env = { ...baseEnv };
  const pathKey = resolvePathKey(env, platform);
  const existingPathValue = env[pathKey] ?? env.PATH ?? env.Path ?? '';
  const pathEntries = splitPathEntries(existingPathValue, platform);

  for (const candidateDir of [...resolveExistingRustToolchainBinDirs({
    env,
    platform,
    requiredCommands,
    pathExists: options.pathExists,
  })].reverse()) {
    const normalizedCandidateDir = normalizePathEntry(candidateDir, platform);
    const alreadyPresent = pathEntries.some((entry) => {
      return normalizePathEntry(entry, platform) === normalizedCandidateDir;
    });
    if (!alreadyPresent) {
      pathEntries.unshift(candidateDir);
    }
  }

  for (const key of Object.keys(env)) {
    if (key !== pathKey && key.toUpperCase() === 'PATH') {
      delete env[key];
    }
  }

  env[pathKey] = uniquePathEntries(pathEntries, platform).join(resolvePathDelimiter(platform));
  return env;
}

export function ensureNativeRustToolchain({
  inspectCommand = inspectCommandAvailability,
  requiredCommands = ['cargo', 'rustc'],
  env = process.env,
  platform = process.platform,
} = {}) {
  const resolvedEnv = withRustToolchainPath(env, {
    platform,
    requiredCommands,
  });
  const inspections = requiredCommands.map((command) => {
    return inspectCommand(command, ['--version'], {
      env: resolvedEnv,
      platform,
      requiredCommands,
    });
  });
  const failedInspections = inspections.filter((inspection) => inspection?.available === false);

  if (failedInspections.length > 0) {
    const blockedNodeProcessInspections =
      platform === 'win32'
      && failedInspections.every((inspection) => inspection?.reason === 'spawn-error')
        ? ['cmd.exe', 'powershell.exe']
          .map((command) => {
            return inspectCommand(
              command,
              command === 'cmd.exe'
                ? ['/d', '/s', '/c', 'echo ok']
                : ['-NoProfile', '-Command', 'Write-Output ok'],
              {
                env: resolvedEnv,
                platform,
                requiredCommands: [command],
              },
            );
          })
          .filter((inspection) => inspection?.available === false && inspection.reason === 'spawn-error')
        : [];
    throw new Error(
      buildMissingRustToolchainMessageWithContext(failedInspections, {
        blockedNodeProcessInspections,
      }),
    );
  }

  return inspections;
}

function main() {
  ensureNativeRustToolchain();
  console.log('ok - native Rust toolchain available');
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
