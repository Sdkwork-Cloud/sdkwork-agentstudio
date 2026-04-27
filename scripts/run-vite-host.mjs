#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { repairPnpmFallbackLinks } from './repair-pnpm-fallback-links.mjs';
import { repairRolldownPluginutils } from './repair-rolldown-pluginutils.mjs';
import { repairPnpmStoreFiles } from './repair-pnpm-store-files.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function normalizeViteMode(value, fallback = 'development') {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'dev' || normalized === 'development') {
    return 'development';
  }
  if (normalized === 'prod' || normalized === 'production') {
    return 'production';
  }
  if (normalized === 'test') {
    return 'test';
  }
  return fallback;
}

function resolveDefaultMode(command) {
  return command === 'build' ? 'production' : 'development';
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function stripModeArg(argv) {
  const args = [];
  let explicitMode;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--mode') {
      explicitMode = readOptionValue(argv, index, '--mode');
      index += 1;
      continue;
    }
    args.push(token);
  }

  return {
    args,
    explicitMode,
  };
}

function normalizeConfigLoader(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['bundle', 'runner', 'native'].includes(normalized) ? normalized : null;
}

function stripConfigLoaderArg(argv) {
  const args = [];
  let explicitConfigLoader;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--configLoader') {
      explicitConfigLoader = normalizeConfigLoader(readOptionValue(argv, index, '--configLoader'));
      index += 1;
      continue;
    }
    args.push(token);
  }

  return {
    args,
    explicitConfigLoader,
  };
}

function compareVersionLike(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function parseViteStoreVersion(storeName) {
  const match = /^vite@(?<version>[^_]+)(?:_|$)/u.exec(String(storeName ?? ''));
  return String(match?.groups?.version ?? '').trim();
}

function resolvePathDelimiter(platform = process.platform) {
  return platform === 'win32' ? ';' : ':';
}

function normalizePathEntry(entry, platform = process.platform) {
  const normalized = path.normalize(String(entry ?? '').trim());
  return platform === 'win32'
    ? normalized.replace(/[\\/]+$/, '').toLowerCase()
    : normalized.replace(/\/+$/, '');
}

function dedupePathEntries(entries, platform = process.platform) {
  const result = [];
  const seen = new Set();

  for (const entry of entries) {
    const normalizedEntry = normalizePathEntry(entry, platform);
    if (!normalizedEntry || seen.has(normalizedEntry)) {
      continue;
    }
    seen.add(normalizedEntry);
    result.push(entry);
  }

  return result;
}

function resolveWorkspaceRootDir() {
  return path.resolve(__dirname, '..');
}

function resolveInstalledVitePackageRoot({
  cwd = process.cwd(),
  workspaceRootDir = resolveWorkspaceRootDir(),
  pathExists = existsSync,
  listDirEntries = readdirSync,
} = {}) {
  const directCandidates = [
    path.join(cwd, 'node_modules', 'vite'),
    path.join(workspaceRootDir, 'node_modules', 'vite'),
  ];

  for (const candidate of directCandidates) {
    if (pathExists(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  const pnpmStoreDir = path.join(workspaceRootDir, 'node_modules', '.pnpm');
  if (!pathExists(pnpmStoreDir)) {
    return null;
  }

  const storeNames = listDirEntries(pnpmStoreDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('vite@'))
    .map((entry) => entry.name)
    .sort((left, right) => compareVersionLike(parseViteStoreVersion(right), parseViteStoreVersion(left)));

  for (const storeName of storeNames) {
    const candidate = path.join(pnpmStoreDir, storeName, 'node_modules', 'vite');
    if (pathExists(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  return null;
}

export function resolveViteExecutablePlan({
  cwd = process.cwd(),
  workspaceRootDir = resolveWorkspaceRootDir(),
  platform = process.platform,
  nodeExecutable = process.execPath,
  pathExists = existsSync,
  listDirEntries = readdirSync,
  readTextFile = (filePath) => readFileSync(filePath, 'utf8'),
} = {}) {
  const vitePackageRoot = resolveInstalledVitePackageRoot({
    cwd,
    workspaceRootDir,
    pathExists,
    listDirEntries,
  });

  if (!vitePackageRoot) {
    return {
      command: platform === 'win32' ? 'vite.cmd' : 'vite',
      argsPrefix: [],
      shell: platform === 'win32',
    };
  }

  const packageJson = JSON.parse(readTextFile(path.join(vitePackageRoot, 'package.json')));
  const binField = packageJson?.bin;
  const viteBinRelativePath =
    typeof binField === 'string'
      ? binField
      : typeof binField?.vite === 'string'
        ? binField.vite
        : null;
  const configuredCliPath = viteBinRelativePath
    ? path.join(vitePackageRoot, viteBinRelativePath)
    : null;
  const fallbackCliPath = path.join(vitePackageRoot, 'dist', 'node', 'cli.js');
  const resolvedCliPath =
    configuredCliPath && pathExists(configuredCliPath)
      ? configuredCliPath
      : pathExists(fallbackCliPath)
        ? fallbackCliPath
        : configuredCliPath;

  if (!resolvedCliPath) {
    throw new Error(
      `Unable to resolve a runnable vite CLI from ${path.join(vitePackageRoot, 'package.json')}`,
    );
  }

  const viteStoreDir = path.dirname(path.dirname(vitePackageRoot));
  const nodePathEntries = [
    path.join(vitePackageRoot, 'node_modules'),
    path.join(viteStoreDir, 'node_modules'),
    path.join(workspaceRootDir, 'node_modules', '.pnpm', 'node_modules'),
  ].filter((candidate) => pathExists(candidate));

  return {
    command: nodeExecutable,
    argsPrefix: [resolvedCliPath],
    shell: false,
    envPatch: {
      NODE_PATH: dedupePathEntries(nodePathEntries, platform).join(resolvePathDelimiter(platform)),
    },
  };
}

export function createViteHostPlan({
  argv = [],
  env = process.env,
  platform = process.platform,
  cwd = process.cwd(),
  workspaceRootDir = resolveWorkspaceRootDir(),
  resolveViteInvocation = resolveViteExecutablePlan,
} = {}) {
  const inputArgs = Array.isArray(argv) ? [...argv] : [];
  const inferredCommand =
    inputArgs.length === 0 || String(inputArgs[0]).startsWith('-')
      ? 'serve'
      : String(inputArgs.shift());
  const { args: argsWithoutMode, explicitMode } = stripModeArg(inputArgs);
  const { args: sanitizedArgs, explicitConfigLoader } = stripConfigLoaderArg(argsWithoutMode);
  const mode = normalizeViteMode(
    explicitMode ?? env.SDKWORK_VITE_MODE,
    resolveDefaultMode(inferredCommand),
  );
  const configLoader =
    explicitConfigLoader
    ?? normalizeConfigLoader(env.SDKWORK_VITE_CONFIG_LOADER)
    ?? (platform === 'win32' ? 'native' : null);
  const viteInvocation = resolveViteInvocation({
    cwd,
    workspaceRootDir,
    platform,
  });

  return {
    command: viteInvocation.command,
    args: [
      ...viteInvocation.argsPrefix,
      inferredCommand,
      '--mode',
      mode,
      ...sanitizedArgs,
      ...(configLoader ? ['--configLoader', configLoader] : []),
    ],
    cwd,
    env: {
      ...env,
      ...(viteInvocation.envPatch ?? {}),
      SDKWORK_VITE_MODE: mode,
    },
    shell: viteInvocation.shell,
  };
}

export async function prepareViteHostEnvironment({
  workspaceRootDir = resolveWorkspaceRootDir(),
  repairImpl = async ({ workspaceRootDir: resolvedWorkspaceRootDir }) => {
    await repairRolldownPluginutils({
      workspaceRootDir: resolvedWorkspaceRootDir,
    });
    await repairPnpmStoreFiles({
      workspaceRootDir: resolvedWorkspaceRootDir,
    });
    await repairPnpmFallbackLinks({
      workspaceRootDir: resolvedWorkspaceRootDir,
    });
  },
} = {}) {
  await repairImpl({
    workspaceRootDir,
  });
}

async function runCli() {
  await prepareViteHostEnvironment();
  const plan = createViteHostPlan({
    argv: process.argv.slice(2),
  });
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: 'inherit',
    shell: plan.shell,
    windowsHide: true,
  });

  child.on('error', (error) => {
    console.error(`[run-vite-host] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[run-vite-host] process exited with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
