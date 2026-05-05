import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  realpathSync,
  renameSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_WORKSPACE_ROOT_DIR = path.resolve(__dirname, '..');

function findFirstExistingPath(candidatePaths) {
  for (const candidatePath of candidatePaths) {
    if (candidatePath && existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function realpathOrNull(candidatePath) {
  try {
    return realpathSync(candidatePath);
  } catch {
    return null;
  }
}

function compareVersionLike(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function extractPinnedVersion(specifier) {
  const normalizedSpecifier = String(specifier ?? '').trim();
  const match = normalizedSpecifier.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/u);
  return match ? match[0] : null;
}

function parseSemverTriplet(version) {
  const match = String(version ?? '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/u);
  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function matchesSimpleSemverRange(candidateVersion, specifier) {
  const normalizedSpecifier = String(specifier ?? '').trim();
  const candidateTriplet = parseSemverTriplet(candidateVersion);
  const baseVersion = extractPinnedVersion(normalizedSpecifier);
  const baseTriplet = parseSemverTriplet(baseVersion);

  if (!normalizedSpecifier || !candidateTriplet || !baseTriplet) {
    return false;
  }

  if (compareVersionLike(candidateVersion, baseVersion) < 0) {
    return false;
  }

  if (normalizedSpecifier.startsWith('^')) {
    return candidateTriplet.major === baseTriplet.major;
  }

  if (normalizedSpecifier.startsWith('~')) {
    return (
      candidateTriplet.major === baseTriplet.major
      && candidateTriplet.minor === baseTriplet.minor
    );
  }

  return candidateVersion === baseVersion;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readWorkspaceTypescriptSpecifier(rootDir) {
  const packageJson = readJsonFile(path.join(rootDir, 'package.json'));
  return String(
    packageJson?.devDependencies?.typescript
      ?? packageJson?.dependencies?.typescript
      ?? '',
  ).trim();
}

function resolvePackageCandidateVersion(packageDir, fallbackVersion = '') {
  const packageJson = readJsonFile(path.join(packageDir, 'package.json'));
  return String(packageJson?.version ?? fallbackVersion ?? '').trim();
}

function resolveTypescriptCliFromPackageDir(packageDir) {
  return findFirstExistingPath([
    path.join(packageDir, 'lib', '_tsc.js'),
    path.join(packageDir, 'lib', 'tsc.js'),
    path.join(packageDir, 'bin', 'tsc'),
  ]);
}

function isReadableFile(filePath) {
  try {
    readFileSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function createTypescriptPackageCandidate(packageDir, fallbackVersion = '') {
  const cliPath = resolveTypescriptCliFromPackageDir(packageDir);
  if (
    !cliPath
    || !isReadableFile(cliPath)
    || !isReadableFile(path.join(packageDir, 'lib', 'lib.es2022.d.ts'))
  ) {
    return null;
  }

  return {
    packageDir,
    cliPath,
    version: resolvePackageCandidateVersion(packageDir, fallbackVersion),
  };
}

function collectTypescriptCandidatesFromPnpmStore(pnpmStoreDir) {
  if (!existsSync(pnpmStoreDir)) {
    return [];
  }

  return readdirSync(pnpmStoreDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('typescript@'))
    .map((entry) =>
      createTypescriptPackageCandidate(
        path.join(
          pnpmStoreDir,
          entry.name,
          'node_modules',
          'typescript',
        ),
        entry.name.slice('typescript@'.length),
      ),
    )
    .filter(Boolean);
}

function collectWorkspaceFallbackTypescriptCandidates(rootDir) {
  const worktreesDir = path.join(rootDir, '.worktrees');
  if (!existsSync(worktreesDir)) {
    return [];
  }

  return readdirSync(worktreesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const worktreeRootDir = path.join(worktreesDir, entry.name);
      return [
        createTypescriptPackageCandidate(
          path.join(worktreeRootDir, 'node_modules', 'typescript'),
        ),
        ...collectTypescriptCandidatesFromPnpmStore(
          path.join(worktreeRootDir, 'node_modules', '.pnpm'),
        ),
      ].filter(Boolean);
    });
}

function selectPreferredTypescriptCandidate(candidates, versionSpecifier) {
  const normalizedCandidates = candidates.filter(Boolean);
  if (normalizedCandidates.length === 0) {
    return null;
  }

  const exactVersion = extractPinnedVersion(versionSpecifier);
  const exactMatch = exactVersion
    ? normalizedCandidates.find((candidate) => candidate.version === exactVersion)
    : null;
  if (exactMatch) {
    return exactMatch;
  }

  const rangeMatch = versionSpecifier
    ? normalizedCandidates.find((candidate) => matchesSimpleSemverRange(candidate.version, versionSpecifier))
    : null;
  if (rangeMatch) {
    return rangeMatch;
  }

  return [...normalizedCandidates].sort(
    (left, right) => compareVersionLike(right.version, left.version),
  )[0] ?? null;
}

function hasStableLocalPackageDir(packageDir) {
  const resolvedPath = realpathOrNull(packageDir);
  if (!resolvedPath) {
    return false;
  }

  return path.resolve(packageDir) === path.resolve(resolvedPath);
}

function clearTargetPath(targetPath) {
  if (!existsSync(targetPath)) {
    return;
  }

  try {
    rmSync(targetPath, { recursive: true, force: true });
    return;
  } catch {
    const backupPath = `${targetPath}.bak-${Date.now()}`;
    renameSync(targetPath, backupPath);
  }
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function acquireTypescriptPackageMaterializeLock(targetPackageDir) {
  const lockDir = `${targetPackageDir}.lock`;
  const startedAt = Date.now();
  const timeoutMs = 30_000;

  mkdirSync(path.dirname(lockDir), { recursive: true });

  while (true) {
    try {
      mkdirSync(lockDir);
      return () => {
        try {
          rmdirSync(lockDir);
        } catch {
          // Best-effort cleanup; a later invocation can still detect a stable package.
        }
      };
    } catch (error) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(
          `Timed out waiting for workspace TypeScript package materialization lock at ${lockDir}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      sleepSync(50);
    }
  }
}

function materializeTypescriptPackageForCli(sourcePackageDir, targetPackageDir) {
  mkdirSync(targetPackageDir, { recursive: true });

  const packageJsonPath = path.join(sourcePackageDir, 'package.json');
  if (existsSync(packageJsonPath)) {
    cpSync(packageJsonPath, path.join(targetPackageDir, 'package.json'), {
      dereference: true,
    });
  }

  const sourceLibDir = path.join(sourcePackageDir, 'lib');
  if (!existsSync(sourceLibDir)) {
    throw new Error(`TypeScript package is missing lib/ at ${sourcePackageDir}`);
  }

  cpSync(sourceLibDir, path.join(targetPackageDir, 'lib'), {
    recursive: true,
    dereference: true,
  });
}

function ensureWorkspaceTypescriptPackageDir(rootDir) {
  const directPackageDir = path.join(rootDir, 'node_modules', 'typescript');
  const versionSpecifier = readWorkspaceTypescriptSpecifier(rootDir);
  const preferredCandidate = selectPreferredTypescriptCandidate([
    createTypescriptPackageCandidate(directPackageDir),
    ...collectTypescriptCandidatesFromPnpmStore(
      path.join(rootDir, 'node_modules', '.pnpm'),
    ),
    createTypescriptPackageCandidate(
      path.join(rootDir, 'node_modules', '.ignored', 'typescript'),
    ),
    ...collectWorkspaceFallbackTypescriptCandidates(rootDir),
  ], versionSpecifier);

  if (!preferredCandidate?.packageDir) {
    throw new Error(
      `Unable to resolve a readable workspace TypeScript CLI${versionSpecifier ? ` for ${versionSpecifier}` : ''}. `
      + 'Install the workspace TypeScript dependency locally instead of relying on unreadable worktree fallbacks.',
    );
  }

  if (
    preferredCandidate.packageDir === directPackageDir
    && hasStableLocalPackageDir(directPackageDir)
  ) {
    return directPackageDir;
  }

  const sourcePackageDir = preferredCandidate.packageDir === directPackageDir
    ? realpathOrNull(directPackageDir) ?? preferredCandidate.packageDir
    : preferredCandidate.packageDir;

  const lockRelease = acquireTypescriptPackageMaterializeLock(directPackageDir);
  try {
    if (hasStableLocalPackageDir(directPackageDir)) {
      return directPackageDir;
    }

    mkdirSync(path.dirname(directPackageDir), { recursive: true });
    const stagedPackageDir = `${directPackageDir}.stage-${process.pid}-${Date.now()}`;
    clearTargetPath(stagedPackageDir);
    materializeTypescriptPackageForCli(sourcePackageDir, stagedPackageDir);
    clearTargetPath(directPackageDir);
    renameSync(stagedPackageDir, directPackageDir);
    return directPackageDir;
  } finally {
    lockRelease();
  }
}

function resolveWorkspaceTsc(rootDir = DEFAULT_WORKSPACE_ROOT_DIR) {
  const linkedPackageDir = ensureWorkspaceTypescriptPackageDir(rootDir);
  const resolvedPath = resolveTypescriptCliFromPackageDir(linkedPackageDir);
  if (resolvedPath) {
    return resolvedPath;
  }

  const versionSpecifier = readWorkspaceTypescriptSpecifier(rootDir);
  throw new Error(
    `Unable to resolve a readable workspace TypeScript CLI${versionSpecifier ? ` for ${versionSpecifier}` : ''}. `
    + 'Install the workspace TypeScript dependency locally instead of relying on unreadable worktree fallbacks.',
  );
}

export function createWorkspaceTscPlan({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  execPath = process.execPath,
  rootDir = DEFAULT_WORKSPACE_ROOT_DIR,
} = {}) {
  const tscPath = resolveWorkspaceTsc(rootDir);

  return {
    command: execPath,
    args: [tscPath, ...(Array.isArray(argv) ? argv : [])],
    cwd,
  };
}

export function runWorkspaceTsc({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  execPath = process.execPath,
  rootDir = DEFAULT_WORKSPACE_ROOT_DIR,
  spawnSyncImpl = spawnSync,
} = {}) {
  const plan = createWorkspaceTscPlan({ argv, cwd, execPath, rootDir });
  const result = spawnSyncImpl(plan.command, plan.args, {
    stdio: 'inherit',
    cwd: plan.cwd,
  });

  if (result.error) {
    throw new Error(`Failed to execute workspace TypeScript CLI: ${result.error.message}`);
  }

  if (result.signal) {
    throw new Error(`Workspace TypeScript CLI exited with signal ${result.signal}`);
  }

  if (typeof result.status === 'number') {
    return result.status;
  }

  return 1;
}

function main() {
  process.exit(runWorkspaceTsc());
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
