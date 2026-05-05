import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import { rmSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  ensureSharedSdkGitSources,
  SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR,
} from './prepare-shared-sdk-git-sources.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRootDir = path.resolve(__dirname, '..');
const releaseConfigPath = path.resolve(workspaceRootDir, 'config', 'shared-sdk-release-sources.json');

const ignoredDirectoryNames = new Set([
  '.generated',
  '.git',
  '.npm-cache',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'obj',
  'out',
  'target',
]);

const ignoredFileNames = new Set([
  '.DS_Store',
]);

export function shouldIgnoreParityPath(relativePath) {
  const normalizedRelativePath = String(relativePath ?? '').replaceAll('\\', '/');
  return normalizedRelativePath === '.sdkwork/manual-backups'
    || normalizedRelativePath.startsWith('.sdkwork/manual-backups/')
    || normalizedRelativePath.endsWith('/.sdkwork/sdkwork-generator-changes.json')
    || normalizedRelativePath.endsWith('/.sdkwork/sdkwork-generator-manifest.json')
    || normalizedRelativePath.endsWith('/.sdkwork/sdkwork-generator-report.json');
}

export const paritySources = [
  {
    id: 'app-sdk',
    label: '@sdkwork/app-sdk',
    localRoot: path.resolve(
      workspaceRootDir,
      '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript',
    ),
  },
  {
    id: 'sdk-common',
    label: '@sdkwork/sdk-common',
    localRoot: path.resolve(
      workspaceRootDir,
      '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript',
    ),
  },
  {
    id: 'core-pc-react',
    label: '@sdkwork/core-pc-react',
    localRoot: path.resolve(
      workspaceRootDir,
      '../sdkwork-core/sdkwork-core-pc-react',
    ),
  },
  {
    id: 'local-api-proxy',
    label: '@sdkwork/local-api-proxy',
    localRoot: path.resolve(
      workspaceRootDir,
      '../sdkwork-appbase/packages/pc-react/intelligence/sdkwork-local-api-proxy',
    ),
  },
  {
    id: 'im-sdk',
    label: '@sdkwork/im-sdk',
    localRoot: path.resolve(
      workspaceRootDir,
      '../craw-chat/sdks/sdkwork-im-sdk/sdkwork-im-sdk-typescript',
    ),
  },
  {
    id: 'rtc-sdk',
    label: '@sdkwork/rtc-sdk',
    localRoot: path.resolve(
      workspaceRootDir,
      '../craw-chat/sdks/sdkwork-rtc-sdk/sdkwork-rtc-sdk-typescript',
    ),
  },
];

export function normalizeBufferForParity(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return Buffer.from(buffer);
  }

  if (buffer.includes(0)) {
    return buffer;
  }

  return Buffer.from(buffer.toString('utf8').replaceAll('\r\n', '\n'), 'utf8');
}

export function hashBufferForParity(buffer) {
  return createHash('sha256').update(normalizeBufferForParity(buffer)).digest('hex');
}

function hashFile(filePath) {
  return hashBufferForParity(fs.readFileSync(filePath));
}

export function walkSnapshot(rootDir, currentDir = rootDir, snapshot = new Map()) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoredDirectoryNames.has(entry.name) || ignoredFileNames.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath).replaceAll(path.sep, '/');

    if (shouldIgnoreParityPath(relativePath)) {
      continue;
    }

    if (entry.isDirectory() || fs.statSync(absolutePath).isDirectory()) {
      walkSnapshot(rootDir, absolutePath, snapshot);
      continue;
    }

    snapshot.set(relativePath, hashFile(absolutePath));
  }

  return snapshot;
}

function compareSnapshots(label, localRoot, remoteRoot) {
  if (!fs.existsSync(localRoot)) {
    throw new Error(`Missing local source of truth for ${label} at ${localRoot}.`);
  }
  if (!fs.existsSync(remoteRoot)) {
    throw new Error(`Missing configured release checkout for ${label} at ${remoteRoot}.`);
  }

  const localSnapshot = walkSnapshot(localRoot);
  const remoteSnapshot = walkSnapshot(remoteRoot);
  const allRelativePaths = [...new Set([...localSnapshot.keys(), ...remoteSnapshot.keys()])].sort();
  const differences = [];

  for (const relativePath of allRelativePaths) {
    const localHash = localSnapshot.get(relativePath) || '';
    const remoteHash = remoteSnapshot.get(relativePath) || '';

    if (localHash === remoteHash) {
      continue;
    }

    if (!localHash) {
      differences.push(`extra in release source: ${relativePath}`);
      continue;
    }
    if (!remoteHash) {
      differences.push(`missing from release source: ${relativePath}`);
      continue;
    }

    differences.push(`content differs: ${relativePath}`);
  }

  return differences;
}

function main() {
  if (!fs.existsSync(releaseConfigPath)) {
    throw new Error(`Missing shared SDK release config at ${releaseConfigPath}.`);
  }

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-shared-sdk-release-parity-'));
  const tempWorkspaceDir = path.join(tempRoot, 'apps', 'claw-studio');
  fs.mkdirSync(tempWorkspaceDir, { recursive: true });

  try {
    const preparedSources = ensureSharedSdkGitSources({
      workspaceRootDir: tempWorkspaceDir,
      env: {
        ...process.env,
        [SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR]: releaseConfigPath,
      },
      syncExistingRepos: false,
    });

    const allDifferences = [];

    for (const source of paritySources) {
      const preparedSource = preparedSources.find((entry) => entry.id === source.id);
      if (!preparedSource) {
        throw new Error(`Unable to resolve configured release source for ${source.label}.`);
      }

      const differences = compareSnapshots(
        source.label,
        source.localRoot,
        preparedSource.packageRoot,
      );

      if (differences.length === 0) {
        console.log(`[shared-sdk-release-parity] OK ${source.label}`);
        continue;
      }

      console.error(`[shared-sdk-release-parity] MISMATCH ${source.label}`);
      for (const difference of differences.slice(0, 25)) {
        console.error(`  - ${difference}`);
      }
      if (differences.length > 25) {
        console.error(`  - ... ${differences.length - 25} more differences`);
      }
      allDifferences.push(...differences.map((difference) => `${source.label}: ${difference}`));
    }

    if (allDifferences.length > 0) {
      throw new Error(
        `Configured shared SDK release sources do not match the local source of truth. Found ${allDifferences.length} differences.`,
      );
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
