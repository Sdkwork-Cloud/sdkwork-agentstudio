import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveDefaultDesktopCargoTargetDir,
  resolveDesktopCargoTargetDir,
} from './desktop-cargo-target.mjs';
import {
  buildOpenClawManifest,
  DEFAULT_NODE_VERSION,
  DEFAULT_OPENCLAW_VERSION,
  resolveRequestedOpenClawTarget,
} from './prepare-openclaw-runtime.mjs';

const BUNDLED_OPENCLAW_MANIFEST_KEYS = [
  'schemaVersion',
  'runtimeId',
  'openclawVersion',
  'requiredExternalRuntimes',
  'requiredExternalRuntimeVersions',
  'platform',
  'arch',
  'cliRelativePath',
];

function sleepSync(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return;
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function shouldRetryDirectoryCleanup(error) {
  const errorCode = typeof error === 'object' && error !== null ? error.code : undefined;
  return errorCode === 'EPERM' || errorCode === 'EBUSY' || errorCode === 'ENOTEMPTY';
}

export function removeDirectoryWithRetriesSync(
  directoryPath,
  {
    removeImpl = (targetPath, options) => rmSync(targetPath, options),
    retryCount = 5,
    retryDelayMs = 250,
    sleepImpl = sleepSync,
    logger = console.warn,
  } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      removeImpl(directoryPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      const canRetry = attempt < retryCount && shouldRetryDirectoryCleanup(error);
      if (!canRetry) {
        throw error;
      }

      if (typeof logger === 'function') {
        logger(
          `[ensure-tauri-target-clean] Retrying cleanup of ${directoryPath} after transient Windows file lock (${attempt}/${retryCount - 1}).`,
        );
      }
      sleepImpl(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

function normalizePermissionPath(filePath) {
  if (process.platform === 'win32' && filePath.startsWith('\\\\?\\')) {
    return filePath.slice(4);
  }

  return filePath;
}

function collectPermissionManifestFiles(targetDir) {
  const manifestFiles = [];
  const pending = [targetDir];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('permission-files')) {
        manifestFiles.push(entryPath);
      }
    }
  }

  return manifestFiles;
}

function readPermissionEntries(manifestPath) {
  const contents = readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(contents);

  if (!Array.isArray(parsed)) {
    throw new Error('permission manifest must be a JSON array');
  }

  return parsed;
}

function readJsonFile(jsonPath) {
  return JSON.parse(readFileSync(jsonPath, 'utf8'));
}

function normalizeRelativePathForMatch(baseDir, candidatePath) {
  return path
    .relative(baseDir, candidatePath)
    .split(path.sep)
    .join('/');
}

function matchesLegacyBundledOpenClawResourceDir(targetDir, candidatePath) {
  return normalizeRelativePathForMatch(targetDir, candidatePath).endsWith('/resources/openclaw-runtime');
}

function resolveBundledOpenClawResourceDirForIssue(targetDir, candidatePath) {
  const normalizedRelativePath = normalizeRelativePathForMatch(targetDir, candidatePath);
  const openclawRuntimeMarker = '/resources/openclaw-runtime';
  const openclawMarker = '/resources/openclaw';

  if (normalizedRelativePath.includes(openclawRuntimeMarker)) {
    const prefix = normalizedRelativePath.slice(
      0,
      normalizedRelativePath.indexOf(openclawRuntimeMarker) + openclawRuntimeMarker.length,
    );
    return path.join(targetDir, ...prefix.split('/'));
  }

  if (normalizedRelativePath.includes(openclawMarker)) {
    const prefix = normalizedRelativePath.slice(
      0,
      normalizedRelativePath.indexOf(openclawMarker) + openclawMarker.length,
    );
    return path.join(targetDir, ...prefix.split('/'));
  }

  return null;
}

function bundledOpenClawManifestKind(targetDir, candidatePath) {
  const normalizedRelativePath = normalizeRelativePathForMatch(targetDir, candidatePath);
  if (normalizedRelativePath.endsWith('/resources/openclaw/manifest.json')) {
    return 'current';
  }

  if (normalizedRelativePath.endsWith('/resources/openclaw-runtime/manifest.json')) {
    return 'legacy';
  }

  return null;
}

function bundledOpenClawManifestMatches(sourceManifest, targetManifest) {
  if (!sourceManifest || !targetManifest || typeof sourceManifest !== 'object' || typeof targetManifest !== 'object') {
    return false;
  }

  return BUNDLED_OPENCLAW_MANIFEST_KEYS.every((key) => sourceManifest[key] === targetManifest[key]);
}

function resolveExpectedBundledOpenClawManifest({
  env = process.env,
} = {}) {
  return buildOpenClawManifest({
    openclawVersion: DEFAULT_OPENCLAW_VERSION,
    nodeVersion: DEFAULT_NODE_VERSION,
    target: resolveRequestedOpenClawTarget({ env }),
  });
}

function inspectBundledOpenClawTargetResources(srcTauriDir, targetDir, { env = process.env } = {}) {
  const sourceManifestPath = path.join(srcTauriDir, 'resources', 'openclaw', 'manifest.json');
  if (!existsSync(targetDir)) {
    return {
      sourceManifestPath,
      issues: [],
    };
  }

  let sourceManifest;
  try {
    sourceManifest = resolveExpectedBundledOpenClawManifest({ env });
  } catch (error) {
    return {
      sourceManifestPath,
      issues: [
        {
          entryPath: sourceManifestPath,
          reason: `failed to resolve expected packaged OpenClaw manifest: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  const issues = [];
  const pending = [targetDir];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (matchesLegacyBundledOpenClawResourceDir(targetDir, entryPath)) {
          issues.push({
            entryPath,
            resourceDir: resolveBundledOpenClawResourceDirForIssue(targetDir, entryPath),
            reason: 'legacy packaged OpenClaw runtime resource directory is still present',
          });
        }
        pending.push(entryPath);
        continue;
      }

      if (!entry.isFile() || entry.name !== 'manifest.json') {
        continue;
      }

      const manifestKind = bundledOpenClawManifestKind(targetDir, entryPath);
      if (!manifestKind) {
        continue;
      }

      let targetManifest;
      try {
        targetManifest = readJsonFile(entryPath);
      } catch (error) {
        issues.push({
          entryPath,
          resourceDir: resolveBundledOpenClawResourceDirForIssue(targetDir, entryPath),
          reason: `failed to parse packaged OpenClaw manifest: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }

      if (manifestKind === 'legacy') {
        issues.push({
          entryPath,
          resourceDir: resolveBundledOpenClawResourceDirForIssue(targetDir, entryPath),
          reason: 'legacy packaged OpenClaw runtime manifest is still present under target resources',
        });
        continue;
      }

      if (!bundledOpenClawManifestMatches(sourceManifest, targetManifest)) {
        issues.push({
          entryPath,
          resourceDir: resolveBundledOpenClawResourceDirForIssue(targetDir, entryPath),
          reason: 'packaged OpenClaw target manifest does not match the expected packaged OpenClaw manifest for the current release target',
        });
      }
    }
  }

  return {
    sourceManifestPath,
    issues,
  };
}

function inspectSingleTauriTarget(resolvedSrcTauriDir, targetDir, { env = process.env } = {}) {
  if (!existsSync(targetDir)) {
    return {
      targetDir,
      manifestFiles: [],
      staleEntries: [],
      bundledOpenClawSourceManifestPath: path.join(
        resolvedSrcTauriDir,
        'resources',
        'openclaw',
        'manifest.json',
      ),
      bundledOpenClawIssues: [],
      stale: false,
    };
  }

  const manifestFiles = collectPermissionManifestFiles(targetDir);
  const staleEntries = [];
  const bundledOpenClawInspection = inspectBundledOpenClawTargetResources(
    resolvedSrcTauriDir,
    targetDir,
    { env },
  );

  for (const manifestPath of manifestFiles) {
    let entries;

    try {
      entries = readPermissionEntries(manifestPath);
    } catch (error) {
      staleEntries.push({
        manifestPath,
        entryPath: '<invalid-manifest>',
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const entryPath of entries) {
      if (typeof entryPath !== 'string' || entryPath.trim().length === 0) {
        staleEntries.push({
          manifestPath,
          entryPath: String(entryPath),
          reason: 'permission entry must be a non-empty string',
        });
        continue;
      }

      const normalizedPath = normalizePermissionPath(entryPath);
      if (!existsSync(normalizedPath)) {
        staleEntries.push({
          manifestPath,
          entryPath,
          reason: 'referenced permission file does not exist',
        });
      }
    }
  }

  return {
    targetDir,
    manifestFiles,
    staleEntries,
    bundledOpenClawSourceManifestPath: bundledOpenClawInspection.sourceManifestPath,
    bundledOpenClawIssues: bundledOpenClawInspection.issues,
    stale: staleEntries.length > 0 || bundledOpenClawInspection.issues.length > 0,
  };
}

function resolveCandidateTargetDirs(resolvedSrcTauriDir, env = process.env) {
  const packageRootDir = path.dirname(resolvedSrcTauriDir);
  const targetDirs = [];
  const configuredTargetDir = String(env?.CARGO_TARGET_DIR ?? '').trim();

  if (configuredTargetDir.length > 0) {
    targetDirs.push(resolveDesktopCargoTargetDir({
      desktopPackageDir: packageRootDir,
      env,
      platform: process.platform,
      cwd: process.cwd(),
    }));
  } else if (path.basename(packageRootDir).toLowerCase() === 'sdkwork-clawstudio-desktop') {
    targetDirs.push(resolveDefaultDesktopCargoTargetDir({
      desktopPackageDir: packageRootDir,
      platform: process.platform,
    }));
  }

  targetDirs.push(path.join(resolvedSrcTauriDir, 'target'));
  const packageTargetDir = path.join(packageRootDir, '.tauri-target');

  if (!targetDirs.includes(packageTargetDir)) {
    targetDirs.push(packageTargetDir);
  }

  return [...new Set(targetDirs)];
}

function cleanupBundledOpenClawTargetResources(targetInspection) {
  const removedResourceDirs = [];
  const resourceDirs = [
    ...new Set(
      (targetInspection.bundledOpenClawIssues ?? [])
        .map((issue) => String(issue.resourceDir ?? '').trim())
        .filter(Boolean),
    ),
  ];

  for (const resourceDir of resourceDirs) {
    if (!existsSync(resourceDir)) {
      continue;
    }

    removeDirectoryWithRetriesSync(resourceDir);
    removedResourceDirs.push(resourceDir);
  }

  return removedResourceDirs;
}

export function inspectTauriTarget(srcTauriDir = 'src-tauri', { env = process.env } = {}) {
  const resolvedSrcTauriDir = path.resolve(srcTauriDir);
  const targetDirs = resolveCandidateTargetDirs(resolvedSrcTauriDir, env);
  const targetInspections = targetDirs.map((targetDir) =>
    inspectSingleTauriTarget(resolvedSrcTauriDir, targetDir, { env }),
  );
  const manifestFiles = targetInspections.flatMap((inspection) => inspection.manifestFiles);
  const staleEntries = targetInspections.flatMap((inspection) =>
    inspection.staleEntries.map((entry) => ({
      targetDir: inspection.targetDir,
      ...entry,
    })),
  );
  const bundledOpenClawIssues = targetInspections.flatMap((inspection) =>
    inspection.bundledOpenClawIssues.map((issue) => ({
      targetDir: inspection.targetDir,
      ...issue,
    })),
  );

  return {
    targetDir: targetDirs[0],
    targetDirs,
    targetInspections,
    manifestFiles,
    staleEntries,
    bundledOpenClawSourceManifestPath:
      targetInspections[0]?.bundledOpenClawSourceManifestPath ??
      path.join(resolvedSrcTauriDir, 'resources', 'openclaw', 'manifest.json'),
    bundledOpenClawIssues,
    stale: targetInspections.some((inspection) => inspection.stale),
  };
}

export function ensureTauriTargetClean(srcTauriDir = 'src-tauri', { env = process.env } = {}) {
  const inspection = inspectTauriTarget(srcTauriDir, { env });
  const removedTargetDirs = [];
  const removedResourceDirs = [];

  for (const targetInspection of inspection.targetInspections) {
    if (!targetInspection.stale || !existsSync(targetInspection.targetDir)) {
      continue;
    }

    if (targetInspection.bundledOpenClawIssues.length > 0) {
      removedResourceDirs.push(...cleanupBundledOpenClawTargetResources(targetInspection));
    }

    if (targetInspection.staleEntries.length > 0) {
      removeDirectoryWithRetriesSync(targetInspection.targetDir);
      removedTargetDirs.push(targetInspection.targetDir);
    }
  }

  return {
    ...inspection,
    removedTarget: removedTargetDirs.length > 0,
    removedTargetDirs,
    removedResourceDirs,
  };
}

function runCli() {
  const srcTauriDir = process.argv[2] ?? 'src-tauri';
  const result = ensureTauriTargetClean(srcTauriDir);

  if (result.removedTarget) {
    const issueParts = [];
    if (result.staleEntries.length > 0) {
      issueParts.push(`${result.staleEntries.length} invalid permission reference${result.staleEntries.length === 1 ? '' : 's'}`);
    }
    if (result.bundledOpenClawIssues.length > 0) {
      issueParts.push(
        `${result.bundledOpenClawIssues.length} stale packaged OpenClaw resource issue${result.bundledOpenClawIssues.length === 1 ? '' : 's'}`,
      );
    }

    console.log(
      `cleaned stale Tauri target cache at ${result.removedTargetDirs.join(', ')} after detecting ${issueParts.join(' and ') || 'stale target issues'}`,
    );
    return;
  }

  if (result.manifestFiles.length === 0) {
    console.log(`no Tauri permission manifests found under ${result.targetDir}; continuing`);
    return;
  }

  console.log(`Tauri target cache is clean: ${result.manifestFiles.length} permission manifests validated`);
}

const invokedScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentModulePath = fileURLToPath(import.meta.url);

if (invokedScriptPath && invokedScriptPath === currentModulePath) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
