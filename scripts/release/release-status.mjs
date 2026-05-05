import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import {
  buildArtifactsOutsideReleaseProfile,
  buildDuplicateReleaseTargetEntries,
  buildReleaseCoverage,
} from './release-coverage.mjs';
import {
  createReleasePlan,
} from './resolve-release-plan.mjs';
import {
  assertSafeReleaseRelativePath,
  normalizeReleaseRelativePath,
} from './release-paths.mjs';

function listFilesRecursively(sourceDir, relativePrefix = '', issues = []) {
  const entries = readdirSync(sourceDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativePrefix, entry.name).replaceAll('\\', '/');
    const absolutePath = path.join(sourceDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(absolutePath, relativePath, issues));
      continue;
    }

    if (entry.isFile()) {
      files.push({
        absolutePath,
        relativePath,
      });
      continue;
    }

    issues.push({
      code: 'unsupported-filesystem-entry',
      path: relativePath,
      message: `Release status ignored unsupported filesystem entry: ${relativePath}`,
    });
  }

  return files;
}

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function normalizeArtifactRecord(artifact, relativePath) {
  return {
    ...artifact,
    relativePath,
    family: String(artifact?.family ?? '').trim() || inferFamily(relativePath),
    platform: String(artifact?.platform ?? '').trim() || inferPlatformId(relativePath),
    arch: String(artifact?.arch ?? '').trim() || inferArchId(relativePath),
    accelerator: String(artifact?.accelerator ?? '').trim() || inferAccelerator(relativePath),
    kind: String(artifact?.kind ?? '').trim() || inferArtifactKind(relativePath),
  };
}

function inferFamily(relativePath) {
  const [family] = String(relativePath ?? '').split('/');
  if (
    family === 'desktop'
    || family === 'web'
    || family === 'server'
    || family === 'container'
    || family === 'kubernetes'
  ) {
    return family;
  }
  return undefined;
}

function inferPlatformId(relativePath) {
  const segments = String(relativePath ?? '').split('/');
  if (segments[0] === 'desktop' && segments.length >= 3) {
    return segments[1];
  }
  if (segments[0] === 'server' && segments.length >= 3) {
    return segments[1];
  }
  if ((segments[0] === 'container' || segments[0] === 'kubernetes') && segments.length >= 4) {
    return segments[1];
  }
  if (segments[0] === 'web') {
    return 'web';
  }
  return undefined;
}

function inferArchId(relativePath) {
  const segments = String(relativePath ?? '').split('/');
  if (segments[0] === 'desktop' && segments.length >= 3) {
    return segments[2];
  }
  if (segments[0] === 'server' && segments.length >= 3) {
    return segments[2];
  }
  if ((segments[0] === 'container' || segments[0] === 'kubernetes') && segments.length >= 4) {
    return segments[2];
  }
  if (segments[0] === 'web') {
    return 'any';
  }
  return undefined;
}

function inferAccelerator(relativePath) {
  const segments = String(relativePath ?? '').split('/');
  if ((segments[0] === 'container' || segments[0] === 'kubernetes') && segments.length >= 5) {
    return segments[3];
  }
  return undefined;
}

function inferArtifactKind(relativePath) {
  const lowerCasePath = String(relativePath ?? '').toLowerCase();
  if (lowerCasePath.endsWith('.exe') || lowerCasePath.endsWith('.msi') || lowerCasePath.endsWith('.dmg')) {
    return 'installer';
  }
  if (lowerCasePath.endsWith('.deb') || lowerCasePath.endsWith('.rpm') || lowerCasePath.endsWith('.appimage')) {
    return 'package';
  }
  return 'archive';
}

function listPartialManifestRecords({
  releaseAssetsDir,
  partialManifestFileName,
  profile,
  issues,
}) {
  const releaseAssetsDirExists = existsSync(releaseAssetsDir);
  if (!releaseAssetsDirExists) {
    return {
      releaseAssetsDirExists: false,
      releaseAssetsDirIsDirectory: false,
      records: [],
      files: [],
    };
  }

  const releaseAssetsDirStat = statSync(releaseAssetsDir);
  if (!releaseAssetsDirStat.isDirectory()) {
    issues.push({
      code: 'release-assets-dir-not-directory',
      path: releaseAssetsDir,
      message: `Release assets path is not a directory: ${releaseAssetsDir}`,
    });
    return {
      releaseAssetsDirExists: true,
      releaseAssetsDirIsDirectory: false,
      records: [],
      files: [],
    };
  }

  const files = listFilesRecursively(releaseAssetsDir, '', issues);
  const records = files
    .filter((file) => (
      file.relativePath.endsWith(`/${partialManifestFileName}`)
      || file.relativePath === partialManifestFileName
    ))
    .map((file) => {
      try {
        const manifest = readJsonFile(file.absolutePath);
        const manifestProfileId = String(manifest?.profileId ?? '').trim();
        if (manifestProfileId !== profile.id) {
          issues.push({
            code: 'profile-mismatch',
            path: file.relativePath,
            message: `Partial release asset manifest profile mismatch: expected ${profile.id}, received ${manifestProfileId || 'missing'}.`,
          });
          return null;
        }

        return {
          file,
          manifest,
        };
      } catch (error) {
        issues.push({
          code: 'partial-manifest-read-failed',
          path: file.relativePath,
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    })
    .filter(Boolean);

  return {
    releaseAssetsDirExists: true,
    releaseAssetsDirIsDirectory: true,
    records,
    files,
  };
}

function collectArtifactsFromPartialManifests({
  releaseAssetsDir,
  releaseTag,
  records,
  issues,
}) {
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const hasTaggedManifest = normalizedReleaseTag.length > 0
    && records.some((record) => String(record.manifest?.releaseTag ?? '').trim().length > 0);
  const artifacts = [];
  let declaredArtifactCount = 0;
  let skippedManifestCount = 0;

  for (const record of records) {
    const manifestReleaseTag = String(record.manifest?.releaseTag ?? '').trim();
    if (hasTaggedManifest && manifestReleaseTag !== normalizedReleaseTag) {
      skippedManifestCount += 1;
      issues.push({
        code: 'release-tag-mismatch',
        path: record.file.relativePath,
        message: `Partial release asset manifest skipped because releaseTag=${manifestReleaseTag || 'missing'} does not match ${normalizedReleaseTag}.`,
      });
      continue;
    }

    for (const artifact of record.manifest?.artifacts ?? []) {
      declaredArtifactCount += 1;
      const relativePath = normalizeReleaseRelativePath(artifact?.relativePath);

      try {
        assertSafeReleaseRelativePath(relativePath, {
          contextLabel: `Partial release asset manifest ${record.file.relativePath}`,
          artifactPathLabel: 'release artifact path',
        });
      } catch (error) {
        issues.push({
          code: 'unsafe-artifact-path',
          path: record.file.relativePath,
          artifactPath: relativePath,
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      const artifactPath = path.join(releaseAssetsDir, relativePath);
      if (!existsSync(artifactPath)) {
        issues.push({
          code: 'declared-artifact-missing',
          path: record.file.relativePath,
          artifactPath: relativePath,
          message: `Partial release asset manifest declares a missing artifact: ${relativePath}`,
        });
        continue;
      }

      const artifactStat = statSync(artifactPath);
      if (!artifactStat.isFile()) {
        issues.push({
          code: 'declared-artifact-not-file',
          path: record.file.relativePath,
          artifactPath: relativePath,
          message: `Partial release asset manifest declares a non-file artifact: ${relativePath}`,
        });
        continue;
      }

      artifacts.push(normalizeArtifactRecord(artifact, relativePath));
    }
  }

  return {
    artifacts: artifacts.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    declaredArtifactCount,
    skippedManifestCount,
  };
}

function resolveMatrixEntry(plan, family, platform, arch, accelerator = '') {
  const matrix = plan?.[`${family}Matrix`] ?? [];
  return matrix.find((entry) => (
    String(entry?.platform ?? '') === platform
    && String(entry?.arch ?? '') === arch
    && (
      !accelerator
      || String(entry?.accelerator ?? '') === accelerator
    )
  ));
}

function addNextCommand(commandsByCommand, entry) {
  const existing = commandsByCommand.get(entry.command);
  if (existing) {
    existing.targetIds.push(entry.targetId);
    existing.targetIds.sort((left, right) => left.localeCompare(right));
    return;
  }

  commandsByCommand.set(entry.command, {
    family: entry.family,
    command: entry.command,
    targetIds: [entry.targetId],
    ...(entry.platform ? { platform: entry.platform } : {}),
    ...(entry.arch ? { arch: entry.arch } : {}),
    ...(entry.target ? { target: entry.target } : {}),
    ...(entry.accelerator ? { accelerator: entry.accelerator } : {}),
  });
}

export function buildMissingReleaseCommands({
  missingTargets = [],
  releasePlan,
} = {}) {
  const commandsByCommand = new Map();

  for (const missingTarget of missingTargets) {
    const [family, platform, arch, fourthSegment] = String(missingTarget ?? '').split('/');

    if (family === 'web') {
      addNextCommand(commandsByCommand, {
        family,
        targetId: missingTarget,
        command: 'pnpm release:package:web',
      });
      continue;
    }

    if (family === 'desktop') {
      const matrixEntry = resolveMatrixEntry(releasePlan, family, platform, arch);
      const target = String(matrixEntry?.target ?? '').trim();
      const command = target
        ? `pnpm release:package:desktop -- --platform ${platform} --arch ${arch} --target ${target}`
        : `pnpm release:package:desktop -- --platform ${platform} --arch ${arch}`;
      addNextCommand(commandsByCommand, {
        family,
        platform,
        arch,
        target,
        targetId: missingTarget,
        command,
      });
      continue;
    }

    if (family === 'server') {
      const matrixEntry = resolveMatrixEntry(releasePlan, family, platform, arch);
      const target = String(matrixEntry?.target ?? '').trim();
      const command = target
        ? `pnpm release:package:server -- --platform ${platform} --arch ${arch} --target ${target}`
        : `pnpm release:package:server -- --platform ${platform} --arch ${arch}`;
      addNextCommand(commandsByCommand, {
        family,
        platform,
        arch,
        target,
        targetId: missingTarget,
        command,
      });
      continue;
    }

    if (family === 'container' || family === 'kubernetes') {
      const accelerator = String(fourthSegment ?? '').trim();
      const matrixEntry = resolveMatrixEntry(releasePlan, family, platform, arch, accelerator);
      const target = String(matrixEntry?.target ?? '').trim();
      const command = target
        ? `pnpm release:package:${family} -- --platform ${platform} --arch ${arch} --target ${target} --accelerator ${accelerator}`
        : `pnpm release:package:${family} -- --platform ${platform} --arch ${arch} --accelerator ${accelerator}`;
      addNextCommand(commandsByCommand, {
        family,
        platform,
        arch,
        accelerator,
        target,
        targetId: missingTarget,
        command,
      });
      continue;
    }

    addNextCommand(commandsByCommand, {
      family: family || 'unknown',
      targetId: missingTarget,
      command: `pnpm release:package:${family || 'unknown'}`,
    });
  }

  return [...commandsByCommand.values()].sort((left, right) => {
    const familyComparison = left.family.localeCompare(right.family);
    if (familyComparison !== 0) {
      return familyComparison;
    }
    return left.command.localeCompare(right.command);
  });
}

const releaseIssueMetadataByCode = new Map([
  ['unsupported-filesystem-entry', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Remove unsupported filesystem entries from the release asset directory, then rerun release:status.',
  }],
  ['release-assets-dir-not-directory', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Point --release-assets-dir at a directory, or remove the file at that path and rerun the release packaging commands.',
  }],
  ['profile-mismatch', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Remove stale partial manifests for other release profiles, or rerun packaging with the active release profile.',
  }],
  ['partial-manifest-read-failed', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Fix or remove the unreadable partial release asset manifest, then rerun the matching release:package:* command.',
  }],
  ['release-tag-mismatch', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Remove stale partial manifests from other release tags, or rerun release:status with the matching --release-tag.',
  }],
  ['unsafe-artifact-path', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Regenerate the partial manifest so every artifact path is a safe canonical relative path inside the release asset directory.',
  }],
  ['declared-artifact-missing', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Rerun the matching release:package:* command so the declared artifact exists, or remove the stale manifest entry.',
  }],
  ['declared-artifact-not-file', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Replace the declared artifact path with an ordinary file by rerunning the matching release:package:* command.',
  }],
  ['artifacts-outside-release-profile', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Remove artifacts that are outside the active release profile, or switch to a profile that explicitly owns them, then rerun release:status.',
  }],
  ['duplicate-release-target-artifacts', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Remove stale duplicate artifacts so each release target is satisfied by exactly one artifact, then rerun the matching release:package:* command if needed.',
  }],
  ['release-plan-target-count-mismatch', {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Fix release plan/profile drift so requiredTargetCount matches the shared release coverage target set before packaging.',
  }],
]);

function normalizeReleaseIssue(issue) {
  const code = String(issue?.code ?? 'unknown-release-status-issue');
  const metadata = releaseIssueMetadataByCode.get(code) ?? {
    severity: 'error',
    blocking: true,
    recommendedAction: 'Inspect the release status issue, fix the release asset directory, then rerun release:status.',
  };

  return {
    ...issue,
    code,
    severity: issue?.severity ?? metadata.severity,
    blocking: issue?.blocking ?? metadata.blocking,
    recommendedAction: issue?.recommendedAction ?? metadata.recommendedAction,
  };
}

function countIssuesByField(issues, field) {
  return issues.reduce((counts, issue) => {
    const key = String(issue?.[field] ?? '').trim();
    if (!key) {
      return counts;
    }
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function buildIssueActions(issues) {
  const actionsByCode = new Map();

  for (const issue of issues) {
    const code = String(issue?.code ?? '').trim() || 'unknown-release-status-issue';
    const existing = actionsByCode.get(code);

    if (existing) {
      existing.issueCount += 1;
      existing.blocking = existing.blocking || issue.blocking === true;
      existing.priority = Math.min(
        existing.priority,
        issue.blocking === true ? 10 : 50,
      );
      continue;
    }

    actionsByCode.set(code, {
      kind: 'fix-issue',
      priority: issue.blocking === true ? 10 : 50,
      blocking: issue.blocking === true,
      severity: String(issue?.severity ?? '').trim() || 'error',
      code,
      issueCount: 1,
      message: `Fix ${code} release status issue.`,
      recommendedAction: String(issue?.recommendedAction ?? '').trim()
        || 'Inspect the release status issue, fix the release asset directory, then rerun release:status.',
    });
  }

  return [...actionsByCode.values()].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.code.localeCompare(right.code);
  });
}

function buildPackageTargetAction(commandEntry) {
  const targetIds = [...(commandEntry.targetIds ?? [])].sort((left, right) => left.localeCompare(right));
  const family = String(commandEntry.family ?? '').trim() || 'unknown';

  return {
    kind: 'package-target',
    priority: 100,
    blocking: false,
    family,
    command: commandEntry.command,
    targetIds,
    ...(commandEntry.platform ? { platform: commandEntry.platform } : {}),
    ...(commandEntry.arch ? { arch: commandEntry.arch } : {}),
    ...(commandEntry.target ? { target: commandEntry.target } : {}),
    ...(commandEntry.accelerator ? { accelerator: commandEntry.accelerator } : {}),
    message: `Package missing ${family} release targets: ${targetIds.join(', ')}.`,
    recommendedAction: `Run ${commandEntry.command}.`,
  };
}

export function buildReleaseNextActions({
  issues = [],
  nextCommands = [],
} = {}) {
  const issueActions = buildIssueActions(issues);
  const packageTargetActions = nextCommands.map(buildPackageTargetAction);

  return [...issueActions, ...packageTargetActions].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }
    return String(left.code ?? left.command ?? '').localeCompare(String(right.code ?? right.command ?? ''));
  });
}

function resolveReleaseStatus({
  releaseCoverage,
  issues,
}) {
  return issues.length > 0 ? 'invalid' : releaseCoverage.status;
}

export function collectReleaseStatus({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  packageProfileId = '',
  releaseTag = '',
  gitRef = '',
  repository = '',
  releaseAssetsDir = path.resolve('release-assets'),
  resolveReleaseProfileFn = resolveReleaseProfile,
  createReleasePlanFn = createReleasePlan,
} = {}) {
  const profile = resolveReleaseProfileFn(profileId);
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const releasePlan = createReleasePlanFn({
    profileId: profile.id,
    packageProfileId,
    releaseTag: normalizedReleaseTag,
    gitRef,
  });
  const issues = [];
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);
  const manifestRecords = listPartialManifestRecords({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    partialManifestFileName: profile.release.partialManifestFileName,
    profile,
    issues,
  });
  const artifactCollection = collectArtifactsFromPartialManifests({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    releaseTag: normalizedReleaseTag,
    records: manifestRecords.records,
    issues,
  });
  const releaseCoverage = buildReleaseCoverage({
    profile,
    artifacts: artifactCollection.artifacts,
    allowPartialRelease: false,
  });
  const outOfProfileArtifactPaths = buildArtifactsOutsideReleaseProfile({
    profile,
    artifacts: artifactCollection.artifacts,
  });
  const duplicateTargetEntries = buildDuplicateReleaseTargetEntries({
    profile,
    artifacts: artifactCollection.artifacts,
  });

  if (outOfProfileArtifactPaths.length > 0) {
    issues.push({
      code: 'artifacts-outside-release-profile',
      artifactPaths: outOfProfileArtifactPaths,
      message: `Release assets include artifacts outside the active release profile: ${outOfProfileArtifactPaths.join(', ')}`,
    });
  }
  if (duplicateTargetEntries.length > 0) {
    issues.push({
      code: 'duplicate-release-target-artifacts',
      duplicateTargetEntries,
      message: 'Release assets include duplicate artifacts for at least one release target.',
    });
  }
  if (Number.isInteger(releasePlan.requiredTargetCount) && releasePlan.requiredTargetCount !== releaseCoverage.requiredTargets.length) {
    issues.push({
      code: 'release-plan-target-count-mismatch',
      message: `Release plan requiredTargetCount=${releasePlan.requiredTargetCount} does not match coverage target count=${releaseCoverage.requiredTargets.length}.`,
    });
  }

  const normalizedIssues = issues.map(normalizeReleaseIssue);
  const blockingIssueCount = normalizedIssues.filter((issue) => issue.blocking).length;
  const nextCommands = buildMissingReleaseCommands({
    missingTargets: releaseCoverage.missingTargets,
    releasePlan,
  });
  const status = resolveReleaseStatus({
    releaseCoverage,
    issues: normalizedIssues,
  });

  return {
    profileId: profile.id,
    packageProfileId: releasePlan.packageProfileId,
    releaseTag: normalizedReleaseTag,
    gitRef: releasePlan.gitRef,
    repository: String(repository ?? '').trim(),
    releaseAssetsDir: normalizedReleaseAssetsDir,
    releaseAssetsDirExists: manifestRecords.releaseAssetsDirExists,
    releaseAssetsDirIsDirectory: manifestRecords.releaseAssetsDirIsDirectory,
    status,
    issueCount: normalizedIssues.length,
    blockingIssueCount,
    hasIssues: normalizedIssues.length > 0,
    hasBlockingIssues: blockingIssueCount > 0,
    issueCountsBySeverity: countIssuesByField(normalizedIssues, 'severity'),
    issueCountsByCode: countIssuesByField(normalizedIssues, 'code'),
    familyTargetCounts: releasePlan.familyTargetCounts,
    requiredTargetCount: releasePlan.requiredTargetCount,
    releaseCoverageRequiredTargetCount: releaseCoverage.requiredTargets.length,
    presentTargetCount: releaseCoverage.presentTargets.length,
    missingTargetCount: releaseCoverage.missingTargets.length,
    partialManifestCount: manifestRecords.records.length,
    declaredArtifactCount: artifactCollection.declaredArtifactCount,
    skippedManifestCount: artifactCollection.skippedManifestCount,
    artifactCount: artifactCollection.artifacts.length,
    artifacts: artifactCollection.artifacts,
    outOfProfileArtifactPaths,
    duplicateTargetEntries,
    releaseCoverage,
    nextCommands,
    nextActions: buildReleaseNextActions({
      issues: normalizedIssues,
      nextCommands,
    }),
    issues: normalizedIssues,
  };
}
