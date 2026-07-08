import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_WORKSPACE_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_PACKAGE_NAME = '@sdkwork/clawstudio-workspace';
const WORKTREE_SEGMENT = `${path.sep}.worktrees${path.sep}`;

function isWorkspaceRootDir(candidateDir) {
  const packageJsonPath = path.join(candidateDir, 'package.json');
  const workspaceManifestPath = path.join(candidateDir, 'pnpm-workspace.yaml');

  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(workspaceManifestPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson?.name === WORKSPACE_PACKAGE_NAME;
  } catch {
    return false;
  }
}

export function resolveWorkspaceRootDir(
  currentWorkingDir = process.cwd(),
  fallbackRoot = DEFAULT_WORKSPACE_ROOT,
) {
  let candidateDir = path.resolve(currentWorkingDir);

  while (true) {
    if (isWorkspaceRootDir(candidateDir)) {
      return candidateDir;
    }

    const parentDir = path.dirname(candidateDir);
    if (parentDir === candidateDir) {
      break;
    }

    candidateDir = parentDir;
  }

  return fallbackRoot;
}

export function resolveCanonicalWorkspaceRootDir(
  currentWorkingDir = process.cwd(),
  fallbackRoot = DEFAULT_WORKSPACE_ROOT,
) {
  const workspaceRoot = resolveWorkspaceRootDir(currentWorkingDir, fallbackRoot);
  const markerIndex = workspaceRoot.indexOf(WORKTREE_SEGMENT);

  if (markerIndex < 0) {
    return workspaceRoot;
  }

  return workspaceRoot.slice(0, markerIndex);
}
