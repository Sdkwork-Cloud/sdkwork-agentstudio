import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { repairPnpmFallbackLinks } from './repair-pnpm-fallback-links.mjs';

function realpathOrNull(candidate) {
  try {
    return fs.realpathSync(candidate);
  } catch {
    return null;
  }
}

export function isUsableVitepressPackageDir(candidate) {
  if (!fs.existsSync(path.join(candidate, 'package.json'))) {
    return false;
  }

  const resolvedDir = realpathOrNull(candidate);
  if (!resolvedDir) {
    return false;
  }

  return path.basename(resolvedDir) === 'vitepress';
}

function findExistingPath(candidates) {
  return candidates.find((candidate) => isUsableVitepressPackageDir(candidate)) ?? null;
}

function collectVitepressCandidatesFromPnpmStore(pnpmStoreDir) {
  if (!fs.existsSync(pnpmStoreDir)) {
    return [];
  }

  return fs
    .readdirSync(pnpmStoreDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('vitepress@'))
    .map((entry) =>
      path.join(pnpmStoreDir, entry.name, 'node_modules', 'vitepress'),
    );
}

function collectWorkspaceFallbackVitepressCandidates(rootDir) {
  const worktreesDir = path.join(rootDir, '.worktrees');
  if (!fs.existsSync(worktreesDir)) {
    return [];
  }

  return fs
    .readdirSync(worktreesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const worktreeRootDir = path.join(worktreesDir, entry.name);
      return [
        path.join(worktreeRootDir, 'node_modules', 'vitepress'),
        ...collectVitepressCandidatesFromPnpmStore(
          path.join(worktreeRootDir, 'node_modules', '.pnpm'),
        ),
      ];
    });
}

export function resolveVitepressPackageDir(rootDir = process.cwd()) {
  const directPackageDir = path.join(rootDir, 'node_modules', 'vitepress');
  if (isUsableVitepressPackageDir(directPackageDir)) {
    return directPackageDir;
  }

  const resolvedPackageDir = findExistingPath([
    ...collectVitepressCandidatesFromPnpmStore(
      path.join(rootDir, 'node_modules', '.pnpm'),
    ),
    ...collectWorkspaceFallbackVitepressCandidates(rootDir),
  ]);
  if (!resolvedPackageDir) {
    throw new Error('Unable to resolve VitePress package from workspace or fallback store entries.');
  }

  return resolvedPackageDir;
}

export function resolveVitepressCli(rootDir = process.cwd()) {
  return path.join(ensureVitepressPackageLink(rootDir), 'bin', 'vitepress.js');
}

export function ensureVitepressPackageLink(rootDir = process.cwd()) {
  const packageDir = resolveVitepressPackageDir(rootDir);
  const packageLinkPath = path.join(rootDir, 'node_modules', 'vitepress');

  if (isUsableVitepressPackageDir(packageLinkPath)) {
    return packageLinkPath;
  }

  fs.mkdirSync(path.dirname(packageLinkPath), { recursive: true });

  if (fs.existsSync(packageLinkPath)) {
    fs.rmSync(packageLinkPath, { recursive: true, force: true });
  }

  fs.symlinkSync(
    packageDir,
    packageLinkPath,
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  return packageLinkPath;
}

export function maybeCleanVitepressDist(rootDir = process.cwd(), cliArgs = process.argv.slice(2)) {
  const [command, siteDir] = cliArgs;
  if (command !== 'build' || !siteDir) {
    return null;
  }

  const distDir = path.join(rootDir, siteDir, '.vitepress', 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  return distDir;
}

export async function prepareVitepressEnvironment(rootDir = process.cwd()) {
  await repairPnpmFallbackLinks({
    workspaceRootDir: rootDir,
  });
  ensureVitepressPackageLink(rootDir);
}

async function main() {
  const rootDir = process.cwd();
  await prepareVitepressEnvironment(rootDir);
  maybeCleanVitepressDist(rootDir, process.argv.slice(2));
  const vitepressCli = resolveVitepressCli(rootDir);
  const child = spawn(process.execPath, [vitepressCli, ...process.argv.slice(2)], {
    cwd: rootDir,
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('error', (error) => {
    console.error(`[run-vitepress] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;

if (entryUrl === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
