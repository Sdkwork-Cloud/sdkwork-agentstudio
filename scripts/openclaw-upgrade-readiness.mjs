import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { inspectUnsupportedOpenClawRuntimeLayout } from './assert-openclaw-runtime-layout.mjs';
import { resolveKernelReleaseConfigPath } from './release/kernel-releases.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function tryReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function tryReadText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function normalizeVersion(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function resolveGitDir(repoDir) {
  const dotGitPath = path.join(repoDir, '.git');
  if (!fs.existsSync(dotGitPath)) {
    return null;
  }

  const stat = fs.statSync(dotGitPath);
  if (stat.isDirectory()) {
    return dotGitPath;
  }

  const pointer = tryReadText(dotGitPath);
  const match = pointer?.match(/^gitdir:\s*(.+)\s*$/im);
  if (!match) {
    return null;
  }

  return path.resolve(repoDir, match[1].trim());
}

function gitTagExists(repoDir, tagName) {
  const gitDir = resolveGitDir(repoDir);
  if (!gitDir || !tagName) {
    return false;
  }

  const looseTagPath = path.join(gitDir, 'refs', 'tags', ...tagName.split('/'));
  if (fs.existsSync(looseTagPath)) {
    return true;
  }

  const packedRefs = tryReadText(path.join(gitDir, 'packed-refs'));
  if (!packedRefs) {
    return false;
  }

  return packedRefs
    .split(/\r?\n/u)
    .some((line) => line.trim().endsWith(` ${tagName}`));
}

function detectDirtyCheckout(repoDir) {
  const fakeStatusPath = path.join(repoDir, '.git', 'status.fake');
  const fakeStatus = tryReadText(fakeStatusPath);
  if (typeof fakeStatus === 'string') {
    return {
      dirty: fakeStatus.trim().length > 0,
      check: 'fixture',
    };
  }

  const gitDir = resolveGitDir(repoDir);
  if (!gitDir) {
    return {
      dirty: null,
      check: 'missing-repo',
    };
  }

  const result = spawnSync('git', ['-C', repoDir, 'status', '--short'], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    return {
      dirty: null,
      check: 'unavailable',
    };
  }

  return {
    dirty: String(result.stdout ?? '').trim().length > 0,
    check: 'git',
  };
}

export async function assessOpenClawUpgradeReadiness({
  workspaceRootDir = rootDir,
  targetVersion,
} = {}) {
  const normalizedTargetVersion = normalizeVersion(targetVersion);
  if (!normalizedTargetVersion) {
    throw new Error('assessOpenClawUpgradeReadiness requires a targetVersion.');
  }

  const releaseConfig = tryReadJson(
    resolveKernelReleaseConfigPath('openclaw', { workspaceRootDir }),
  );
  const bundledManifest = tryReadJson(
    path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-clawstudio-desktop',
      'src-tauri',
      'resources',
      'openclaw',
      'manifest.json',
    ),
  );
  const generatedManifest = tryReadJson(
    path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-clawstudio-desktop',
      'src-tauri',
      'generated',
      'release',
      'openclaw-resource',
      'manifest.json',
    ),
  );
  const preparedRuntimePackageJson = tryReadJson(
    path.join(
      workspaceRootDir,
      'packages',
      'sdkwork-clawstudio-desktop',
      'src-tauri',
      'resources',
      'openclaw',
      'runtime',
      'package',
      'node_modules',
      'openclaw',
      'package.json',
    ),
  );
  const upstreamPackageJson = tryReadJson(
    path.join(
      workspaceRootDir,
      '.cache',
      'bundled-components',
      'upstreams',
      'openclaw',
      'package.json',
    ),
  );
  const upstreamRepoDir = path.join(
    workspaceRootDir,
    '.cache',
    'bundled-components',
    'upstreams',
    'openclaw',
  );
  const unsupportedRuntimeLayout =
    await inspectUnsupportedOpenClawRuntimeLayout({ workspaceRootDir });
  const targetTag = `v${normalizedTargetVersion}`;
  const localTarballPath = path.join(workspaceRootDir, `openclaw-${normalizedTargetVersion}.tgz`);

  const configuredVersion = normalizeVersion(releaseConfig?.stableVersion);
  const bundledManifestVersion = normalizeVersion(bundledManifest?.openclawVersion);
  const generatedManifestVersion = normalizeVersion(generatedManifest?.openclawVersion);
  const localPreparedRuntimeVersion = normalizeVersion(preparedRuntimePackageJson?.version);
  const localUpstreamVersion = normalizeVersion(upstreamPackageJson?.version);
  const localUpstreamHasTargetTag = gitTagExists(upstreamRepoDir, targetTag);
  const { dirty: localUpstreamDirty, check: localUpstreamDirtyCheck } =
    detectDirtyCheckout(upstreamRepoDir);
  const localTarballPresent = fs.existsSync(localTarballPath);
  const hasLocalTargetSource = localTarballPresent || (
    localUpstreamVersion === normalizedTargetVersion && localUpstreamHasTargetTag
  );
  const versionSourcesAligned = [
    configuredVersion,
    bundledManifestVersion,
    generatedManifestVersion,
    localPreparedRuntimeVersion,
  ].every((version) => version === normalizedTargetVersion);

  const blockers = [];

  for (const violation of unsupportedRuntimeLayout.violations) {
    const versionSuffix = violation.version ? ` (detected version ${violation.version})` : '';
    blockers.push(
      `Unsupported OpenClaw runtime layout is present at ${violation.relativePath}${versionSuffix}. Remove retired layout artifacts before upgrading the packaged OpenClaw runtime.`,
    );
  }
  if (!hasLocalTargetSource && localUpstreamVersion !== normalizedTargetVersion) {
    blockers.push(
      `Local OpenClaw upstream checkout is still at ${localUpstreamVersion ?? 'unknown'} instead of ${normalizedTargetVersion}.`,
    );
  }
  if (!hasLocalTargetSource && !localUpstreamHasTargetTag) {
    blockers.push(
      `Local OpenClaw upstream checkout does not contain git tag ${targetTag}.`,
    );
  }
  if (localUpstreamDirty === true) {
    blockers.push(
      'Local OpenClaw upstream checkout has uncommitted changes and should not be hard-reset in place.',
    );
  }
  if (!localTarballPresent && localUpstreamVersion !== normalizedTargetVersion) {
    blockers.push(
      `No local openclaw-${normalizedTargetVersion}.tgz tarball is available for an offline packaged OpenClaw upgrade.`,
    );
  }

  return {
    workspaceRootDir,
    targetVersion: normalizedTargetVersion,
    configuredVersion,
    bundledManifestVersion,
    generatedManifestVersion,
    localPreparedRuntimeVersion,
    localUpstreamVersion,
    versionSourcesAligned,
    unsupportedSourceRuntimeDirPresent: unsupportedRuntimeLayout.sourceRuntimeDirPresent,
    unsupportedSourceRuntimeVersion: unsupportedRuntimeLayout.sourceRuntimeVersion,
    unsupportedBundledNodeRuntimeDirPresent:
      unsupportedRuntimeLayout.bundledNodeRuntimeDirPresent,
    localUpstreamHasTargetTag,
    localUpstreamDirty,
    localUpstreamDirtyCheck,
    localTarballPresent,
    readyToUpgrade: blockers.length === 0,
    blockers,
  };
}

async function main() {
  const targetVersion = process.argv[2]?.trim();
  if (!targetVersion) {
    throw new Error('Usage: node scripts/openclaw-upgrade-readiness.mjs <target-version>');
  }

  const result = await assessOpenClawUpgradeReadiness({ targetVersion });
  console.log(JSON.stringify(result, null, 2));
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
