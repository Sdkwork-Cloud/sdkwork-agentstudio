#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  closeSync,
  openSync,
  readdirSync,
  readSync,
  readFileSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  resolveReleaseProfile,
} from './release-profiles.mjs';
import {
  buildArtifactPresentTargets,
  buildArtifactsOutsideReleaseProfile,
  buildDuplicateReleaseTargetEntries,
  buildRequiredReleaseCoverageIds,
} from './release-coverage.mjs';
import {
  assertSafeReleaseRelativePath,
  normalizeReleaseRelativePath,
} from './release-paths.mjs';
import {
  normalizeReleaseSmokeChecks,
  normalizeReleaseSmokeRelativePathArray,
} from './release-smoke-contract.mjs';
import {
  normalizeDesktopStartupSmokeChecks,
  normalizeDesktopStartupSmokeLocalAiProxyRuntime,
  normalizeDesktopStartupSmokePackageContext,
} from './desktop-startup-smoke-contract.mjs';
import {
  readTarGzEntries,
  readZipArchiveEntries,
} from './archive-entry-safety.mjs';

const __filename = fileURLToPath(import.meta.url);
const SHA256_READ_BUFFER_SIZE = 1024 * 1024;
const RELEASE_NOTES_FILE_NAME = 'release-notes.md';
const SMOKE_EVIDENCE_PATH_FIELDS = Object.freeze([
  'reportRelativePath',
  'manifestRelativePath',
  'capturedEvidenceRelativePath',
]);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
}

function listFilesRecursively(sourceDir, relativePrefix = '') {
  const entries = readdirSync(sourceDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativePrefix, entry.name);
    const absolutePath = path.join(sourceDir, entry.name);
    const canonicalRelativePath = relativePath.replaceAll('\\', '/');

    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile()) {
      files.push({
        absolutePath,
        relativePath: canonicalRelativePath,
      });
      continue;
    }

    files.push({
      absolutePath,
      relativePath: canonicalRelativePath,
      unsupported: true,
    });
  }

  return files;
}

function computeSha256(filePath) {
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(SHA256_READ_BUFFER_SIZE);
  const fileDescriptor = openSync(filePath, 'r');

  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(fileDescriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    closeSync(fileDescriptor);
  }

  return hash.digest('hex');
}

function readJsonFile(filePath, contextLabel) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to parse ${contextLabel}: ${filePath}. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readChecksumManifest(checksumPath) {
  const entries = new Map();
  const lines = readFileSync(checksumPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
    if (!match) {
      throw new Error(`Invalid checksum manifest line in ${checksumPath}: ${line}`);
    }

    const [, checksum, relativePath] = match;
    const normalizedRelativePath = normalizeReleaseRelativePath(relativePath);
    assertSafeReleaseRelativePath(
      normalizedRelativePath,
      {
        contextLabel: `Checksum manifest in ${checksumPath}`,
        artifactPathLabel: 'checksum manifest artifact path',
      },
    );
    if (entries.has(normalizedRelativePath)) {
      throw new Error(`Duplicate checksum manifest entry for ${normalizedRelativePath} in ${checksumPath}`);
    }

    entries.set(normalizedRelativePath, String(checksum).toLowerCase());
  }

  return entries;
}

function readSingleFileChecksumSidecar({
  sidecarPath,
  expectedFileName,
  label,
}) {
  const lines = readFileSync(sidecarPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length !== 1) {
    throw new Error(`${label} must contain exactly one checksum entry: ${sidecarPath}`);
  }

  const match = lines[0].match(/^([a-f0-9]{64})\s{2}(.+)$/i);
  if (!match) {
    throw new Error(`Invalid ${label} line in ${sidecarPath}: ${lines[0]}`);
  }

  const [, checksum, fileName] = match;
  if (fileName !== expectedFileName) {
    throw new Error(
      `${label} must reference ${expectedFileName}, received ${fileName || 'missing'}.`,
    );
  }

  return String(checksum).toLowerCase();
}

function assertReleaseManifestChecksumSidecar({
  manifestPath,
  manifestFileName,
  manifestChecksumPath,
}) {
  if (!existsSync(manifestChecksumPath)) {
    throw new Error(`Missing finalized release manifest checksum sidecar: ${manifestChecksumPath}`);
  }

  const manifestChecksumStat = statSync(manifestChecksumPath);
  if (!manifestChecksumStat.isFile()) {
    throw new Error(
      `Finalized release manifest checksum sidecar is not a file: ${manifestChecksumPath}`,
    );
  }

  const expectedSha256 = readSingleFileChecksumSidecar({
    sidecarPath: manifestChecksumPath,
    expectedFileName: manifestFileName,
    label: 'Release manifest checksum sidecar',
  });
  const actualSha256 = computeSha256(manifestPath);

  if (expectedSha256 !== actualSha256) {
    throw new Error(
      `Release manifest checksum sidecar mismatch: sidecar=${expectedSha256} actual=${actualSha256}.`,
    );
  }
}

function assertReleaseCoverageReady({
  manifest,
  profile,
}) {
  const coverage = manifest?.releaseCoverage;
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) {
    throw new Error('Release manifest is missing releaseCoverage.');
  }

  const profileRequiredTargets = buildRequiredReleaseCoverageIds(profile);
  const requiredTargets = normalizeStringArray(coverage.requiredTargets);
  const presentTargets = normalizeStringArray(coverage.presentTargets);
  const missingTargets = normalizeStringArray(coverage.missingTargets);

  if (
    profileRequiredTargets.length !== requiredTargets.length
    || profileRequiredTargets.some((target, index) => target !== requiredTargets[index])
  ) {
    throw new Error(
      'Release manifest coverage does not match profile: releaseCoverage.requiredTargets must exactly match the active release profile.',
    );
  }

  if (String(coverage.status ?? '').trim() !== 'complete') {
    throw new Error(
      `Release manifest is not publish-ready: releaseCoverage.status=${coverage.status ?? 'unknown'}. Missing targets: ${missingTargets.join(', ') || 'unknown'}`,
    );
  }

  if (Boolean(coverage.allowPartialRelease)) {
    throw new Error(
      'Release manifest was finalized with --allow-partial-release and must not be published.',
    );
  }

  if (requiredTargets.length === 0) {
    throw new Error('Release manifest releaseCoverage.requiredTargets must not be empty.');
  }

  if (missingTargets.length > 0) {
    throw new Error(
      `Release manifest is not publish-ready: releaseCoverage.missingTargets is not empty (${missingTargets.join(', ')}).`,
    );
  }

  if (
    requiredTargets.length !== presentTargets.length
    || requiredTargets.some((target, index) => target !== presentTargets[index])
  ) {
    throw new Error(
      'Release manifest is not publish-ready: releaseCoverage.presentTargets must exactly match requiredTargets.',
    );
  }

  return {
    requiredTargets,
    presentTargets,
    missingTargets,
  };
}

function assertArtifactCoverageMatchesManifest({
  artifacts,
  coverage,
  profile,
}) {
  const artifactPresentTargets = buildArtifactPresentTargets({
    profile,
    artifacts,
  });
  const manifestPresentTargets = coverage.presentTargets;

  if (
    artifactPresentTargets.length !== manifestPresentTargets.length
    || artifactPresentTargets.some((target, index) => target !== manifestPresentTargets[index])
  ) {
    throw new Error(
      `Release manifest artifact coverage does not match releaseCoverage.presentTargets: artifactTargets=${artifactPresentTargets.join(', ') || 'none'} manifestTargets=${manifestPresentTargets.join(', ') || 'none'}`,
    );
  }
}

function assertArtifactsWithinActiveReleaseProfile({
  artifacts,
  profile,
}) {
  const outOfProfileArtifactPaths = buildArtifactsOutsideReleaseProfile({
    profile,
    artifacts,
  });

  if (outOfProfileArtifactPaths.length > 0) {
    throw new Error(
      `Release manifest contains artifacts outside the active release profile: ${outOfProfileArtifactPaths.join(', ')}`,
    );
  }
}

function assertNoDuplicateArtifactsForReleaseTargets({
  artifacts,
  profile,
}) {
  const duplicateTargetEntries = buildDuplicateReleaseTargetEntries({
    profile,
    artifacts,
  });

  if (duplicateTargetEntries.length > 0) {
    throw new Error(
      [
        'Release manifest contains multiple artifacts for the same release target:',
        ...duplicateTargetEntries.map((entry) => `${entry.target}=[${entry.artifactPaths.join(', ')}]`),
      ].join(' '),
    );
  }
}

function getFinalizedArchiveArtifactContext(artifact) {
  const family = String(artifact?.family ?? '').trim();
  const platform = String(artifact?.platform ?? '').trim();
  const relativePath = normalizeReleaseRelativePath(artifact?.relativePath).toLowerCase();

  if (
    family.toLowerCase() === 'desktop'
    && platform.toLowerCase() === 'macos'
    && (
      relativePath.endsWith('.app.zip')
      || relativePath.endsWith('.app.tar.gz')
    )
  ) {
    return 'Finalized macOS desktop app companion';
  }

  if (relativePath.endsWith('.tar.gz')) {
    return `Finalized ${family || 'release'}`;
  }

  if (relativePath.endsWith('.zip')) {
    return `Finalized ${family || 'release'}`;
  }

  return '';
}

function assertFinalizedArchiveArtifactEntriesSafe({
  releaseAssetsDir,
  artifact,
}) {
  const relativePath = normalizeReleaseRelativePath(artifact?.relativePath);
  const normalizedExtensionPath = relativePath.toLowerCase();
  const archivePath = path.join(releaseAssetsDir, relativePath);
  const context = getFinalizedArchiveArtifactContext(artifact);

  if (!context) {
    return;
  }

  if (normalizedExtensionPath.endsWith('.zip')) {
    readZipArchiveEntries(archivePath, { context });
    return;
  }

  readTarGzEntries(archivePath, { context });
}

function assertFinalizedArchiveArtifactsSafe({
  releaseAssetsDir,
  artifacts,
}) {
  for (const artifact of artifacts) {
    assertFinalizedArchiveArtifactEntriesSafe({
      releaseAssetsDir,
      artifact,
    });
  }
}

function assertManifestIdentity({
  manifest,
  profile,
}) {
  const manifestProfileId = String(manifest?.profileId ?? '').trim();
  if (manifestProfileId !== profile.id) {
    throw new Error(
      `Release manifest profile mismatch: expected ${profile.id}, received ${manifestProfileId || 'missing'}.`,
    );
  }

  const checksumFileName = String(manifest?.checksumFileName ?? '').trim();
  if (checksumFileName !== profile.release.globalChecksumsFileName) {
    throw new Error(
      `Release manifest checksum file mismatch: expected ${profile.release.globalChecksumsFileName}, received ${checksumFileName || 'missing'}.`,
    );
  }

  return {
    checksumFileName,
  };
}

function assertReleaseTopLevelFileName(fileName, label) {
  if (
    !fileName
    || fileName === '.'
    || fileName === '..'
    || fileName.includes('\0')
    || fileName.includes(':')
    || fileName.includes('/')
    || fileName.includes('\\')
    || path.posix.isAbsolute(fileName)
    || path.win32.isAbsolute(fileName)
    || path.posix.basename(fileName) !== fileName
    || path.win32.basename(fileName) !== fileName
  ) {
    throw new Error(`Invalid ${label}: ${fileName || 'missing'}`);
  }
}

function assertReleaseChecksumFileName(checksumFileName) {
  assertReleaseTopLevelFileName(checksumFileName, 'release checksum file name');
}

function assertReleaseManifestChecksumFileName(manifestChecksumFileName) {
  assertReleaseTopLevelFileName(
    manifestChecksumFileName,
    'release manifest checksum sidecar file name',
  );
}

function assertReleaseAttestationEvidenceFileName(attestationEvidenceFileName) {
  assertReleaseTopLevelFileName(
    attestationEvidenceFileName,
    'release attestation evidence file name',
  );
}

function assertPlainObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }

  return value;
}

function assertNonEmptyString(value, message) {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    throw new Error(message);
  }

  return normalizedValue;
}

function assertMetadataRelativePath({
  value,
  relativePath,
  metadataName,
  fieldName,
}) {
  const normalizedPath = normalizeReleaseRelativePath(value);
  assertSafeReleaseRelativePath(normalizedPath, {
    contextLabel: `Release manifest ${metadataName} metadata for ${relativePath}`,
    artifactPathLabel: fieldName,
  });

  return normalizedPath;
}

function assertMetadataEvidenceFile({
  releaseAssetsDir,
  value,
  relativePath,
  metadataName,
  fieldName,
}) {
  const normalizedPath = assertMetadataRelativePath({
    value,
    relativePath,
    metadataName,
    fieldName,
  });
  const evidencePath = path.join(releaseAssetsDir, normalizedPath);

  if (!existsSync(evidencePath)) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} references missing ${fieldName}: ${normalizedPath}`,
    );
  }

  const evidenceStat = statSync(evidencePath);
  if (!evidenceStat.isFile()) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} references a non-file ${fieldName}: ${normalizedPath}`,
    );
  }

  return {
    path: evidencePath,
    relativePath: normalizedPath,
    stat: evidenceStat,
  };
}

function assertMetadataEvidenceIntegrity({
  releaseAssetsDir,
  metadata,
  pathFieldName,
  digestFieldName,
  sizeFieldName,
  relativePath,
  metadataName,
}) {
  const evidence = assertMetadataEvidenceFile({
    releaseAssetsDir,
    value: metadata?.[pathFieldName],
    relativePath,
    metadataName,
    fieldName: pathFieldName,
  });
  const expectedSha256 = String(metadata?.[digestFieldName] ?? '').trim().toLowerCase();
  const actualSha256 = computeSha256(evidence.path);
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} is missing ${digestFieldName}.`,
    );
  }
  if (expectedSha256 !== actualSha256) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} ${digestFieldName} mismatch: manifest=${expectedSha256} actual=${actualSha256}.`,
    );
  }

  const expectedSize = metadata?.[sizeFieldName];
  const actualSize = evidence.stat.size;
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 0) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} is missing ${sizeFieldName}.`,
    );
  }
  if (expectedSize !== actualSize) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} ${sizeFieldName} mismatch: manifest=${expectedSize} actual=${actualSize}.`,
    );
  }

  return evidence;
}

function readMetadataEvidenceJson({
  releaseAssetsDir,
  metadata,
  relativePath,
  metadataName,
  fieldName,
  digestFieldName,
  sizeFieldName,
}) {
  const evidence = assertMetadataEvidenceIntegrity({
    releaseAssetsDir,
    metadata,
    pathFieldName: fieldName,
    digestFieldName,
    sizeFieldName,
    relativePath,
    metadataName,
  });

  return {
    relativePath: evidence.relativePath,
    value: readJsonFile(
      evidence.path,
      `Release manifest ${metadataName} ${fieldName} evidence for ${relativePath}`,
    ),
  };
}

function normalizeSmokeArtifactPathArray({
  values,
  relativePath,
  metadataName,
  fieldName,
}) {
  return normalizeReleaseSmokeRelativePathArray(values, {
    contextLabel: `Release manifest ${metadataName} metadata for ${relativePath}`,
    pathLabel: fieldName,
  });
}

function assertSmokeArtifactPathsInclude({
  metadata,
  artifactRelativePath,
  metadataName,
  fieldName = 'artifactRelativePaths',
}) {
  const artifactRelativePaths = normalizeSmokeArtifactPathArray({
    values: metadata?.[fieldName],
    relativePath: artifactRelativePath,
    metadataName,
    fieldName,
  });
  if (!artifactRelativePaths.includes(artifactRelativePath)) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${artifactRelativePath} does not reference its artifact in ${fieldName}.`,
    );
  }

  return artifactRelativePaths;
}

function assertRequiredSmokeMetadata({
  artifact,
  relativePath,
  family,
  propertyName,
}) {
  return assertPlainObject(
    artifact?.[propertyName],
    `Release manifest ${family} artifact is missing ${propertyName}: ${relativePath}`,
  );
}

function assertSmokeMetadataCore({
  releaseAssetsDir,
  metadata,
  relativePath,
  metadataName,
  requireTarget = true,
}) {
  const smokeReport = readMetadataEvidenceJson({
    releaseAssetsDir,
    metadata,
    relativePath,
    metadataName,
    fieldName: 'reportRelativePath',
    digestFieldName: 'reportSha256',
    sizeFieldName: 'reportSize',
  }).value;
  assertMetadataEvidenceIntegrity({
    releaseAssetsDir,
    metadata,
    pathFieldName: 'manifestRelativePath',
    digestFieldName: 'manifestSha256',
    sizeFieldName: 'manifestSize',
    relativePath,
    metadataName,
  });
  assertNonEmptyString(
    metadata.verifiedAt,
    `Release manifest ${metadataName} metadata for ${relativePath} is missing verifiedAt.`,
  );
  if (requireTarget) {
    assertNonEmptyString(
      metadata.target,
      `Release manifest ${metadataName} metadata for ${relativePath} is missing target.`,
    );
  }

  return smokeReport;
}

function assertSmokeKind({
  metadata,
  relativePath,
  metadataName,
  expectedSmokeKind,
}) {
  const actualSmokeKind = String(metadata?.smokeKind ?? '').trim();
  if (actualSmokeKind !== expectedSmokeKind) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} must describe ${expectedSmokeKind} verification.`,
    );
  }
}

function assertSmokeStatus({
  metadata,
  relativePath,
  metadataName,
  expectedStatus,
}) {
  const actualStatus = String(metadata?.status ?? '').trim();
  if (actualStatus !== expectedStatus) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} must have status=${expectedStatus}.`,
    );
  }
}

function assertPassingChecks({
  checks,
  requiredCheckIds,
  relativePath,
  metadataName,
  normalizeChecks = normalizeReleaseSmokeChecks,
}) {
  const passedChecks = new Map(
    normalizeChecks(checks).map((check) => [check.id, check.status]),
  );
  for (const requiredCheckId of requiredCheckIds) {
    if (passedChecks.get(requiredCheckId) !== 'passed') {
      throw new Error(
        `Release manifest ${metadataName} metadata for ${relativePath} is missing a passing ${requiredCheckId} check.`,
      );
    }
  }
}

function assertMetadataFieldMatchesReport({
  metadata,
  smokeReport,
  relativePath,
  metadataName,
  fieldName,
  normalize = (value) => String(value ?? '').trim(),
}) {
  const expectedValue = normalize(metadata?.[fieldName]);
  const actualValue = normalize(smokeReport?.[fieldName]);
  if (actualValue !== expectedValue) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} does not match report ${fieldName}: expected ${expectedValue || 'empty'}, received ${actualValue || 'empty'}.`,
    );
  }
}

function assertMetadataArrayMatchesReport({
  metadata,
  smokeReport,
  relativePath,
  metadataName,
  fieldName,
  normalizeValues = (values) => normalizeSmokeArtifactPathArray({
    values,
    relativePath,
    metadataName,
    fieldName,
  }),
}) {
  const expectedValues = normalizeValues(metadata?.[fieldName]);
  const actualValues = normalizeValues(smokeReport?.[fieldName]);

  if (
    expectedValues.length !== actualValues.length
    || expectedValues.some((value, index) => value !== actualValues[index])
  ) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} does not match report ${fieldName}.`,
    );
  }
}

function normalizeCheckSignature(values, normalizeChecks) {
  return normalizeChecks(values)
    .map((check) => ({
      id: check.id,
      status: check.status,
      detail: String(check.detail ?? '').trim(),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeInstallPlanSummarySignature(values) {
  return Array.isArray(values)
    ? values
      .map((value) => ({
        relativePath: String(value?.relativePath ?? '').trim(),
        format: String(value?.format ?? '').trim(),
        platform: String(value?.platform ?? '').trim(),
        stepCount: Number.isFinite(value?.stepCount) ? value.stepCount : 0,
      }))
      .filter((value) => value.relativePath.length > 0)
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    : [];
}

function assertInstallPlanSummariesMatchReport({
  metadata,
  smokeReport,
  relativePath,
  metadataName,
}) {
  const expectedSummaries = normalizeInstallPlanSummarySignature(metadata?.installPlanSummaries);
  const actualSummaries = normalizeInstallPlanSummarySignature(smokeReport?.installPlanSummaries);
  if (JSON.stringify(expectedSummaries) !== JSON.stringify(actualSummaries)) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} does not match report installPlanSummaries.`,
    );
  }
}

function assertMetadataChecksMatchReport({
  metadata,
  smokeReport,
  relativePath,
  metadataName,
  normalizeChecks = normalizeReleaseSmokeChecks,
}) {
  const expectedChecks = normalizeCheckSignature(metadata?.checks, normalizeChecks);
  const actualChecks = normalizeCheckSignature(smokeReport?.checks, normalizeChecks);

  if (JSON.stringify(expectedChecks) !== JSON.stringify(actualChecks)) {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} does not match report checks.`,
    );
  }
}

function assertSmokeReportCoreMatchesMetadata({
  metadata,
  smokeReport,
  relativePath,
  metadataName,
  checkTarget = true,
  checkSmokeKind = true,
  checkStatus = true,
  artifactFieldName = 'artifactRelativePaths',
  normalizeChecks = normalizeReleaseSmokeChecks,
}) {
  for (const fieldName of ['verifiedAt']) {
    assertMetadataFieldMatchesReport({
      metadata,
      smokeReport,
      relativePath,
      metadataName,
      fieldName,
    });
  }

  if (checkTarget) {
    assertMetadataFieldMatchesReport({
      metadata,
      smokeReport,
      relativePath,
      metadataName,
      fieldName: 'target',
    });
  }

  if (checkSmokeKind) {
    assertMetadataFieldMatchesReport({
      metadata,
      smokeReport,
      relativePath,
      metadataName,
      fieldName: 'smokeKind',
    });
  }

  if (checkStatus) {
    assertMetadataFieldMatchesReport({
      metadata,
      smokeReport,
      relativePath,
      metadataName,
      fieldName: 'status',
    });
  }

  assertMetadataArrayMatchesReport({
    metadata,
    smokeReport,
    relativePath,
    metadataName,
    fieldName: artifactFieldName,
  });
  assertMetadataChecksMatchReport({
    metadata,
    smokeReport,
    relativePath,
    metadataName,
    normalizeChecks,
  });
}

function assertDesktopInstallerSmokeMetadata({
  releaseAssetsDir,
  artifact,
  relativePath,
}) {
  const metadata = assertRequiredSmokeMetadata({
    artifact,
    relativePath,
    family: 'desktop',
    propertyName: 'desktopInstallerSmoke',
  });
  const smokeReport = assertSmokeMetadataCore({
    releaseAssetsDir,
    metadata,
    relativePath,
    metadataName: 'desktopInstallerSmoke',
  });
  assertSmokeArtifactPathsInclude({
    metadata,
    artifactRelativePath: relativePath,
    metadataName: 'desktopInstallerSmoke',
    fieldName: 'installableArtifactRelativePaths',
  });
  normalizeSmokeArtifactPathArray({
    values: metadata.requiredCompanionArtifactRelativePaths,
    relativePath,
    metadataName: 'desktopInstallerSmoke',
    fieldName: 'requiredCompanionArtifactRelativePaths',
  });

  if (!Array.isArray(metadata.installPlanSummaries) || metadata.installPlanSummaries.length === 0) {
    throw new Error(
      `Release manifest desktopInstallerSmoke metadata for ${relativePath} is missing installPlanSummaries.`,
    );
  }

  const installPlanSummary = metadata.installPlanSummaries.find(
    (summary) => normalizeReleaseRelativePath(summary?.relativePath) === relativePath,
  );
  if (!installPlanSummary) {
    throw new Error(
      `Release manifest desktopInstallerSmoke metadata for ${relativePath} is missing an install plan summary for the artifact.`,
    );
  }
  assertNonEmptyString(
    installPlanSummary.format,
    `Release manifest desktopInstallerSmoke metadata for ${relativePath} is missing install plan format.`,
  );
  assertNonEmptyString(
    installPlanSummary.platform,
    `Release manifest desktopInstallerSmoke metadata for ${relativePath} is missing install plan platform.`,
  );
  if (!Number.isFinite(installPlanSummary.stepCount) || installPlanSummary.stepCount <= 0) {
    throw new Error(
      `Release manifest desktopInstallerSmoke metadata for ${relativePath} must include a positive install plan stepCount.`,
    );
  }
  assertSmokeReportCoreMatchesMetadata({
    metadata,
    smokeReport,
    relativePath,
    metadataName: 'desktopInstallerSmoke',
    checkSmokeKind: false,
    checkStatus: false,
    artifactFieldName: 'installableArtifactRelativePaths',
  });
  assertMetadataArrayMatchesReport({
    metadata,
    smokeReport,
    relativePath,
    metadataName: 'desktopInstallerSmoke',
    fieldName: 'requiredCompanionArtifactRelativePaths',
  });
  assertInstallPlanSummariesMatchReport({
    metadata,
    smokeReport,
    relativePath,
    metadataName: 'desktopInstallerSmoke',
  });
}

function assertDesktopStartupSmokeMetadata({
  releaseAssetsDir,
  artifact,
  relativePath,
}) {
  const metadata = assertRequiredSmokeMetadata({
    artifact,
    relativePath,
    family: 'desktop',
    propertyName: 'desktopStartupSmoke',
  });
  const smokeReport = assertSmokeMetadataCore({
    releaseAssetsDir,
    metadata,
    relativePath,
    metadataName: 'desktopStartupSmoke',
  });
  assertSmokeStatus({
    metadata,
    relativePath,
    metadataName: 'desktopStartupSmoke',
    expectedStatus: 'passed',
  });
  if (String(metadata.phase ?? '').trim() !== 'shell-mounted') {
    throw new Error(
      `Release manifest desktopStartupSmoke metadata for ${relativePath} must record phase shell-mounted.`,
    );
  }
  assertMetadataEvidenceIntegrity({
    releaseAssetsDir,
    metadata,
    pathFieldName: 'capturedEvidenceRelativePath',
    digestFieldName: 'capturedEvidenceSha256',
    sizeFieldName: 'capturedEvidenceSize',
    relativePath,
    metadataName: 'desktopStartupSmoke',
  });

  if (!normalizeDesktopStartupSmokePackageContext(metadata)) {
    throw new Error(
      `Release manifest desktopStartupSmoke metadata for ${relativePath} is missing packaged kernel context metadata.`,
    );
  }
  assertNonEmptyString(
    metadata.builtInInstanceId,
    `Release manifest desktopStartupSmoke metadata for ${relativePath} is missing builtInInstanceId.`,
  );
  assertNonEmptyString(
    metadata.builtInInstanceStatus,
    `Release manifest desktopStartupSmoke metadata for ${relativePath} is missing builtInInstanceStatus.`,
  );
  if (!normalizeDesktopStartupSmokeLocalAiProxyRuntime(metadata.localAiProxyRuntime)) {
    throw new Error(
      `Release manifest desktopStartupSmoke metadata for ${relativePath} is missing localAiProxyRuntime metadata.`,
    );
  }
  assertSmokeArtifactPathsInclude({
    metadata,
    artifactRelativePath: relativePath,
    metadataName: 'desktopStartupSmoke',
  });
  assertPassingChecks({
    checks: metadata.checks,
    requiredCheckIds: [
      'startup-status',
      'startup-phase',
      'runtime-readiness',
      'built-in-instance',
      'gateway-websocket',
      'local-ai-proxy-runtime',
    ],
    relativePath,
    metadataName: 'desktopStartupSmoke',
    normalizeChecks: normalizeDesktopStartupSmokeChecks,
  });
  assertSmokeReportCoreMatchesMetadata({
    metadata,
    smokeReport,
    relativePath,
    metadataName: 'desktopStartupSmoke',
    checkSmokeKind: false,
    normalizeChecks: normalizeDesktopStartupSmokeChecks,
  });
  for (const fieldName of [
    'phase',
    'capturedEvidenceRelativePath',
    'packageProfileId',
    'builtInInstanceId',
    'builtInInstanceStatus',
  ]) {
    assertMetadataFieldMatchesReport({
      metadata,
      smokeReport,
      relativePath,
      metadataName: 'desktopStartupSmoke',
      fieldName,
    });
  }
}

function assertWebArchiveSmokeMetadata({
  releaseAssetsDir,
  artifact,
  relativePath,
}) {
  const metadata = assertRequiredSmokeMetadata({
    artifact,
    relativePath,
    family: 'web',
    propertyName: 'webArchiveSmoke',
  });
  const smokeReport = assertSmokeMetadataCore({
    releaseAssetsDir,
    metadata,
    relativePath,
    metadataName: 'webArchiveSmoke',
    requireTarget: false,
  });
  assertSmokeKind({
    metadata,
    relativePath,
    metadataName: 'webArchiveSmoke',
    expectedSmokeKind: 'web-archive-content',
  });
  assertSmokeStatus({
    metadata,
    relativePath,
    metadataName: 'webArchiveSmoke',
    expectedStatus: 'passed',
  });
  assertSmokeArtifactPathsInclude({
    metadata,
    artifactRelativePath: relativePath,
    metadataName: 'webArchiveSmoke',
  });
  assertSmokeReportCoreMatchesMetadata({
    metadata,
    smokeReport,
    relativePath,
    metadataName: 'webArchiveSmoke',
    checkTarget: false,
  });
  assertPassingChecks({
    checks: metadata.checks,
    requiredCheckIds: [
      'artifact-checksum',
      'web-index',
      'web-assets',
      'docs-index',
      'docs-404',
      'docs-search-index',
      'public-doc-boundary',
    ],
    relativePath,
    metadataName: 'webArchiveSmoke',
  });
}

function assertServerBundleSmokeMetadata({
  releaseAssetsDir,
  artifact,
  relativePath,
}) {
  const metadata = assertRequiredSmokeMetadata({
    artifact,
    relativePath,
    family: 'server',
    propertyName: 'serverBundleSmoke',
  });
  const smokeReport = assertSmokeMetadataCore({
    releaseAssetsDir,
    metadata,
    relativePath,
    metadataName: 'serverBundleSmoke',
  });
  assertSmokeKind({
    metadata,
    relativePath,
    metadataName: 'serverBundleSmoke',
    expectedSmokeKind: 'bundle-runtime',
  });
  assertSmokeStatus({
    metadata,
    relativePath,
    metadataName: 'serverBundleSmoke',
    expectedStatus: 'passed',
  });
  assertMetadataRelativePath({
    value: metadata.launcherRelativePath,
    relativePath,
    metadataName: 'serverBundleSmoke',
    fieldName: 'launcherRelativePath',
  });
  assertNonEmptyString(
    metadata.runtimeBaseUrl,
    `Release manifest serverBundleSmoke metadata for ${relativePath} is missing runtimeBaseUrl.`,
  );
  assertSmokeArtifactPathsInclude({
    metadata,
    artifactRelativePath: relativePath,
    metadataName: 'serverBundleSmoke',
  });
  assertPassingChecks({
    checks: metadata.checks,
    requiredCheckIds: [
      'health-ready',
      'host-endpoints',
      'browser-shell',
    ],
    relativePath,
    metadataName: 'serverBundleSmoke',
  });
  assertSmokeReportCoreMatchesMetadata({
    metadata,
    smokeReport,
    relativePath,
    metadataName: 'serverBundleSmoke',
  });
  assertMetadataFieldMatchesReport({
    metadata,
    smokeReport,
    relativePath,
    metadataName: 'serverBundleSmoke',
    fieldName: 'launcherRelativePath',
  });
}

function assertDeploymentSmokeMetadata({
  releaseAssetsDir,
  artifact,
  relativePath,
}) {
  const family = String(artifact?.family ?? '').trim();
  const metadata = assertRequiredSmokeMetadata({
    artifact,
    relativePath,
    family,
    propertyName: 'deploymentSmoke',
  });
  const metadataName = `${family} deploymentSmoke`;
  const expectedSmokeKind = family === 'container' ? 'live-deployment' : 'chart-render';
  const smokeReport = assertSmokeMetadataCore({
    releaseAssetsDir,
    metadata,
    relativePath,
    metadataName,
  });
  assertSmokeKind({
    metadata,
    relativePath,
    metadataName,
    expectedSmokeKind,
  });
  assertSmokeArtifactPathsInclude({
    metadata,
    artifactRelativePath: relativePath,
    metadataName,
  });

  const status = String(metadata.status ?? '').trim();
  if (status !== 'passed' && status !== 'skipped') {
    throw new Error(
      `Release manifest ${metadataName} metadata for ${relativePath} must have status=passed or status=skipped.`,
    );
  }
  if (status === 'skipped') {
    assertNonEmptyString(
      metadata.skippedReason,
      `Release manifest ${metadataName} metadata for ${relativePath} is missing skippedReason.`,
    );
    assertSmokeReportCoreMatchesMetadata({
      metadata,
      smokeReport,
      relativePath,
      metadataName,
    });
    assertMetadataFieldMatchesReport({
      metadata,
      smokeReport,
      relativePath,
      metadataName,
      fieldName: 'skippedReason',
    });
    return;
  }

  assertMetadataRelativePath({
    value: metadata.launcherRelativePath,
    relativePath,
    metadataName,
    fieldName: 'launcherRelativePath',
  });
  if (family === 'container') {
    assertNonEmptyString(
      metadata.runtimeBaseUrl,
      `Release manifest ${metadataName} metadata for ${relativePath} is missing runtimeBaseUrl.`,
    );
  }
  assertPassingChecks({
    checks: metadata.checks,
    requiredCheckIds: family === 'container'
      ? [
          'deployment-identity',
          'runtime-profile',
          'manage-credentials',
          'persistent-storage',
          'docker-compose-up',
          'docker-compose-healthy',
          'health-ready',
          'host-endpoints',
          'browser-shell',
        ]
      : [
          'helm-template',
          'deployment-identity',
          'image-reference',
          'configmap-runtime-identity',
          'readiness-probe',
          'secret-ref',
          'persistent-storage',
        ],
    relativePath,
    metadataName,
  });
  assertSmokeReportCoreMatchesMetadata({
    metadata,
    smokeReport,
    relativePath,
    metadataName,
  });
  assertMetadataFieldMatchesReport({
    metadata,
    smokeReport,
    relativePath,
    metadataName,
    fieldName: 'launcherRelativePath',
  });
}

function assertArtifactSmokeMetadataReady({
  releaseAssetsDir,
  artifact,
}) {
  const relativePath = normalizeReleaseRelativePath(artifact?.relativePath);
  const family = String(artifact?.family ?? '').trim();

  if (family === 'desktop') {
    assertDesktopInstallerSmokeMetadata({ releaseAssetsDir, artifact, relativePath });
    assertDesktopStartupSmokeMetadata({ releaseAssetsDir, artifact, relativePath });
    return;
  }

  if (family === 'web') {
    assertWebArchiveSmokeMetadata({ releaseAssetsDir, artifact, relativePath });
    return;
  }

  if (family === 'server') {
    assertServerBundleSmokeMetadata({ releaseAssetsDir, artifact, relativePath });
    return;
  }

  if (family === 'container' || family === 'kubernetes') {
    assertDeploymentSmokeMetadata({ releaseAssetsDir, artifact, relativePath });
  }
}

function assertArtifactsSmokeMetadataReady({
  releaseAssetsDir,
  artifacts,
}) {
  for (const artifact of artifacts) {
    assertArtifactSmokeMetadataReady({ releaseAssetsDir, artifact });
  }
}

function readReleaseAttestationEvidence({
  releaseAssetsDir,
  profile,
}) {
  assertReleaseAttestationEvidenceFileName(profile.release.attestationEvidenceFileName);
  const attestationEvidencePath = path.join(
    releaseAssetsDir,
    profile.release.attestationEvidenceFileName,
  );
  if (!existsSync(attestationEvidencePath)) {
    throw new Error(`Missing release attestation evidence: ${attestationEvidencePath}`);
  }

  const evidenceStat = statSync(attestationEvidencePath);
  if (!evidenceStat.isFile()) {
    throw new Error(`Release attestation evidence is not a file: ${attestationEvidencePath}`);
  }

  return {
    attestationEvidencePath,
    evidence: readJsonFile(attestationEvidencePath, 'release attestation evidence'),
  };
}

function normalizeAttestationArtifactEntries(evidence) {
  return Array.isArray(evidence?.artifacts)
    ? evidence.artifacts
      .map((entry) => ({
        ...entry,
        relativePath: normalizeReleaseRelativePath(entry?.relativePath),
      }))
      .filter((entry) => entry.relativePath.length > 0)
    : [];
}

function normalizeReleaseMetadataEntries(manifest) {
  return Array.isArray(manifest?.releaseMetadata)
    ? manifest.releaseMetadata
      .map((entry) => ({
        ...entry,
        relativePath: normalizeReleaseRelativePath(entry?.relativePath),
      }))
      .filter((entry) => entry.relativePath.length > 0)
    : [];
}

function assertReleaseMetadataReady({
  releaseAssetsDir,
  manifest,
  checksumEntries,
}) {
  const releaseMetadata = normalizeReleaseMetadataEntries(manifest);
  const releaseNotesEntry = releaseMetadata.find(
    (entry) => entry.relativePath === RELEASE_NOTES_FILE_NAME,
  );

  if (!releaseNotesEntry) {
    throw new Error(`Release manifest is missing required releaseMetadata entry for ${RELEASE_NOTES_FILE_NAME}.`);
  }
  if (String(releaseNotesEntry.kind ?? '').trim() !== 'release-notes') {
    throw new Error(`Release manifest releaseMetadata entry for ${RELEASE_NOTES_FILE_NAME} must have kind=release-notes.`);
  }
  if (String(releaseNotesEntry.purpose ?? '').trim() !== 'github-release-body') {
    throw new Error(`Release manifest releaseMetadata entry for ${RELEASE_NOTES_FILE_NAME} must have purpose=github-release-body.`);
  }
  if (releaseNotesEntry.required !== true) {
    throw new Error(`Release manifest releaseMetadata entry for ${RELEASE_NOTES_FILE_NAME} must be required.`);
  }

  const metadataPaths = new Set();
  for (const metadata of releaseMetadata) {
    const relativePath = normalizeReleaseRelativePath(metadata?.relativePath);
    assertSafeReleaseRelativePath(relativePath, {
      contextLabel: 'Release manifest releaseMetadata',
      artifactPathLabel: 'release metadata path',
    });
    if (metadataPaths.has(relativePath)) {
      throw new Error(`Release manifest contains duplicate releaseMetadata path: ${relativePath}`);
    }
    metadataPaths.add(relativePath);

    const metadataPath = path.join(releaseAssetsDir, relativePath);
    if (!existsSync(metadataPath)) {
      throw new Error(`Missing release metadata file: ${relativePath}`);
    }
    const metadataStat = statSync(metadataPath);
    if (!metadataStat.isFile()) {
      throw new Error(`Release metadata path is not a file: ${relativePath}`);
    }

    const expectedSha256 = String(metadata?.sha256 ?? '').trim().toLowerCase();
    const actualSha256 = computeSha256(metadataPath);
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new Error(`Release manifest releaseMetadata entry is missing sha256 for ${relativePath}.`);
    }
    if (expectedSha256 !== actualSha256) {
      throw new Error(`Release metadata checksum mismatch for ${relativePath}: manifest=${expectedSha256 || 'missing'} actual=${actualSha256}`);
    }

    const checksumManifestSha256 = checksumEntries.get(relativePath);
    if (checksumManifestSha256 !== actualSha256) {
      throw new Error(`Checksum manifest mismatch for ${relativePath}: checksumFile=${checksumManifestSha256 ?? 'missing'} actual=${actualSha256}`);
    }

    if (Number(metadata?.size) !== metadataStat.size) {
      throw new Error(`Release metadata size mismatch for ${relativePath}: manifest=${metadata?.size ?? 'missing'} actual=${metadataStat.size}`);
    }
  }

  return releaseMetadata;
}

function buildAttestedReleaseSubjects({
  artifacts,
  releaseMetadata,
}) {
  return [
    ...artifacts.map((artifact) => ({ ...artifact, attestationKind: 'artifact' })),
    ...releaseMetadata.map((metadata) => ({ ...metadata, attestationKind: 'release-metadata' })),
  ];
}

function addReleaseSubjectPath({
  allowedPaths,
  relativePath,
  contextLabel,
  pathLabel,
}) {
  const normalizedPath = normalizeReleaseRelativePath(relativePath);
  assertSafeReleaseRelativePath(normalizedPath, {
    contextLabel,
    artifactPathLabel: pathLabel,
  });
  allowedPaths.add(normalizedPath);
}

function addSmokeEvidencePaths({
  allowedPaths,
  metadata,
  contextLabel,
}) {
  for (const fieldName of SMOKE_EVIDENCE_PATH_FIELDS) {
    if (!Object.hasOwn(metadata ?? {}, fieldName)) {
      continue;
    }

    addReleaseSubjectPath({
      allowedPaths,
      relativePath: metadata?.[fieldName],
      contextLabel,
      pathLabel: fieldName,
    });
  }
}

function buildDeclaredReleaseFileSet({
  manifest,
  profile,
  artifacts,
  releaseMetadata,
  checksumFileName,
  attestationEvidencePath,
}) {
  const allowedPaths = new Set([
    profile.release.manifestFileName,
    profile.release.manifestChecksumFileName,
    checksumFileName,
  ]);

  if (attestationEvidencePath) {
    allowedPaths.add(profile.release.attestationEvidenceFileName);
  }

  for (const artifact of artifacts) {
    addReleaseSubjectPath({
      allowedPaths,
      relativePath: artifact?.relativePath,
      contextLabel: 'Release manifest',
      pathLabel: 'artifact path',
    });

    for (const [propertyName, metadata] of Object.entries(artifact ?? {})) {
      if (!propertyName.endsWith('Smoke') || !metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        continue;
      }

      addSmokeEvidencePaths({
        allowedPaths,
        metadata,
        contextLabel: `Release manifest ${propertyName} metadata for ${artifact.relativePath}`,
      });
    }
  }

  for (const metadata of releaseMetadata) {
    addReleaseSubjectPath({
      allowedPaths,
      relativePath: metadata?.relativePath,
      contextLabel: 'Release manifest releaseMetadata',
      pathLabel: 'release metadata path',
    });
  }

  const manifestAttestationEvidenceFileName = String(
    manifest?.attestationEvidenceFileName ?? '',
  ).trim();
  if (manifestAttestationEvidenceFileName && manifestAttestationEvidenceFileName !== profile.release.attestationEvidenceFileName) {
    throw new Error(
      `Release manifest attestation evidence file mismatch: expected ${profile.release.attestationEvidenceFileName}, received ${manifestAttestationEvidenceFileName}.`,
    );
  }

  return allowedPaths;
}

function assertReleaseAssetsDirectoryClosed({
  releaseAssetsDir,
  manifest,
  profile,
  artifacts,
  releaseMetadata,
  checksumFileName,
  attestationEvidencePath,
}) {
  const allowedPaths = buildDeclaredReleaseFileSet({
    manifest,
    profile,
    artifacts,
    releaseMetadata,
    checksumFileName,
    attestationEvidencePath,
  });
  const releaseEntries = listFilesRecursively(releaseAssetsDir);
  const unsupportedEntries = releaseEntries
    .filter((file) => file.unsupported)
    .map((file) => file.relativePath)
    .filter((relativePath) => !allowedPaths.has(relativePath))
    .sort((left, right) => left.localeCompare(right));

  if (unsupportedEntries.length > 0) {
    throw new Error(
      `Release assets directory contains unsupported filesystem entries not declared by release-manifest.json: ${unsupportedEntries.join(', ')}`,
    );
  }

  const unexpectedFiles = releaseEntries
    .filter((file) => !file.unsupported)
    .map((file) => file.relativePath)
    .filter((relativePath) => !allowedPaths.has(relativePath))
    .sort((left, right) => left.localeCompare(right));

  if (unexpectedFiles.length > 0) {
    throw new Error(
      `Release assets directory contains files not declared by release-manifest.json: ${unexpectedFiles.join(', ')}`,
    );
  }
}

function buildAttestationSignerWorkflowIdentity({
  repository,
  signerWorkflow,
}) {
  const normalizedRepository = String(repository ?? '').trim();
  const normalizedSignerWorkflow = String(signerWorkflow ?? '').trim().replace(/\\/g, '/');

  if (!normalizedRepository || !normalizedSignerWorkflow) {
    return '';
  }

  return `${normalizedRepository}/${normalizedSignerWorkflow}`;
}

function assertReleaseAttestationEvidenceReady({
  releaseAssetsDir,
  manifest,
  subjects,
  profile,
}) {
  const attestationRequired = Boolean(
    profile.release.enableArtifactAttestations
      || manifest?.attestationEnabled,
  );
  if (!attestationRequired) {
    return null;
  }

  const { attestationEvidencePath, evidence } = readReleaseAttestationEvidence({
    releaseAssetsDir,
    profile,
  });
  const manifestRepository = String(manifest?.repository ?? '').trim();
  const manifestReleaseTag = String(manifest?.releaseTag ?? '').trim();
  const expectedSourceRef = manifestReleaseTag ? `refs/tags/${manifestReleaseTag}` : '';
  const expectedPredicateType = String(
    profile.release.attestationPredicateType ?? manifest?.attestationPredicateType ?? '',
  ).trim();
  const expectedSignerWorkflow = String(
    profile.release.attestationSignerWorkflowPath ?? '',
  ).trim();
  const expectedSignerWorkflowIdentity = buildAttestationSignerWorkflowIdentity({
    repository: manifestRepository,
    signerWorkflow: expectedSignerWorkflow,
  });

  if (String(evidence?.repository ?? '').trim() !== manifestRepository) {
    throw new Error(
      `Release attestation evidence repository mismatch: expected ${manifestRepository || 'missing'}, received ${String(evidence?.repository ?? '').trim() || 'missing'}.`,
    );
  }
  if (String(evidence?.releaseTag ?? '').trim() !== manifestReleaseTag) {
    throw new Error(
      `Release attestation evidence release tag mismatch: expected ${manifestReleaseTag || 'missing'}, received ${String(evidence?.releaseTag ?? '').trim() || 'missing'}.`,
    );
  }
  if (String(evidence?.predicateType ?? '').trim() !== expectedPredicateType) {
    throw new Error(
      `Release attestation evidence predicate type mismatch: expected ${expectedPredicateType || 'missing'}, received ${String(evidence?.predicateType ?? '').trim() || 'missing'}.`,
    );
  }
  if (
    expectedSignerWorkflow
    && String(evidence?.signerWorkflow ?? '').trim() !== expectedSignerWorkflow
  ) {
    throw new Error(
      `Release attestation evidence signer workflow mismatch: expected ${expectedSignerWorkflow}, received ${String(evidence?.signerWorkflow ?? '').trim() || 'missing'}.`,
    );
  }
  if (
    expectedSignerWorkflowIdentity
    && String(evidence?.signerWorkflowIdentity ?? '').trim() !== expectedSignerWorkflowIdentity
  ) {
    throw new Error(
      `Release attestation evidence signer workflow identity mismatch: expected ${expectedSignerWorkflowIdentity}, received ${String(evidence?.signerWorkflowIdentity ?? '').trim() || 'missing'}.`,
    );
  }

  const evidenceByRelativePath = new Map();
  for (const entry of normalizeAttestationArtifactEntries(evidence)) {
    assertSafeReleaseRelativePath(entry.relativePath, {
      contextLabel: 'Release attestation evidence',
      artifactPathLabel: 'attestation subject path',
    });
    if (evidenceByRelativePath.has(entry.relativePath)) {
      throw new Error(
        `Release attestation evidence contains duplicate subject verification for ${entry.relativePath}.`,
      );
    }
    evidenceByRelativePath.set(entry.relativePath, entry);
  }

  for (const subject of subjects) {
    const relativePath = normalizeReleaseRelativePath(subject?.relativePath);
    const evidenceEntry = evidenceByRelativePath.get(relativePath);
    if (!evidenceEntry) {
      const subjectKindLabel = subject.attestationKind === 'artifact' ? 'artifact ' : '';
      throw new Error(
        `Release attestation evidence is missing ${subjectKindLabel}verification for ${relativePath}.`,
      );
    }

    const expectedSha256 = String(subject?.sha256 ?? '').trim().toLowerCase();
    const actualSha256 = String(evidenceEntry?.sha256 ?? '').trim().toLowerCase();
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `Release attestation evidence digest mismatch for ${relativePath}: evidence=${actualSha256 || 'missing'} manifest=${expectedSha256 || 'missing'}.`,
      );
    }
    if (String(evidenceEntry?.repository ?? '').trim() !== manifestRepository) {
      throw new Error(
        `Release attestation evidence repository mismatch for ${relativePath}: expected ${manifestRepository || 'missing'}, received ${String(evidenceEntry?.repository ?? '').trim() || 'missing'}.`,
      );
    }
    if (String(evidenceEntry?.releaseTag ?? '').trim() !== manifestReleaseTag) {
      throw new Error(
        `Release attestation evidence release tag mismatch for ${relativePath}: expected ${manifestReleaseTag || 'missing'}, received ${String(evidenceEntry?.releaseTag ?? '').trim() || 'missing'}.`,
      );
    }
    if (expectedSourceRef && String(evidenceEntry?.sourceRef ?? '').trim() !== expectedSourceRef) {
      throw new Error(
        `Release attestation evidence source ref mismatch for ${relativePath}: expected ${expectedSourceRef}, received ${String(evidenceEntry?.sourceRef ?? '').trim() || 'missing'}.`,
      );
    }
    if (String(evidenceEntry?.predicateType ?? '').trim() !== expectedPredicateType) {
      throw new Error(
        `Release attestation evidence predicate type mismatch for ${relativePath}: expected ${expectedPredicateType || 'missing'}, received ${String(evidenceEntry?.predicateType ?? '').trim() || 'missing'}.`,
      );
    }
    if (
      expectedSignerWorkflow
      && String(evidenceEntry?.signerWorkflow ?? '').trim() !== expectedSignerWorkflow
    ) {
      throw new Error(
        `Release attestation evidence signer workflow mismatch for ${relativePath}: expected ${expectedSignerWorkflow}, received ${String(evidenceEntry?.signerWorkflow ?? '').trim() || 'missing'}.`,
      );
    }
    if (
      expectedSignerWorkflowIdentity
      && String(evidenceEntry?.signerWorkflowIdentity ?? '').trim() !== expectedSignerWorkflowIdentity
    ) {
      throw new Error(
        `Release attestation evidence signer workflow identity mismatch for ${relativePath}: expected ${expectedSignerWorkflowIdentity}, received ${String(evidenceEntry?.signerWorkflowIdentity ?? '').trim() || 'missing'}.`,
      );
    }
    if (evidenceEntry?.verified !== true) {
      throw new Error(
        `Release attestation evidence must be verified for ${relativePath}.`,
      );
    }
    assertNonEmptyString(
      evidenceEntry.verifiedAt,
      `Release attestation evidence for ${relativePath} is missing verifiedAt.`,
    );
    const verificationCommand = assertNonEmptyString(
      evidenceEntry.verificationCommand,
      `Release attestation evidence for ${relativePath} is missing verificationCommand.`,
    );
    if (!verificationCommand.includes('gh attestation verify')) {
      throw new Error(
        `Release attestation evidence for ${relativePath} must record the gh attestation verify command.`,
      );
    }
    if (
      expectedSignerWorkflowIdentity
      && !verificationCommand.includes(`--signer-workflow ${expectedSignerWorkflowIdentity}`)
    ) {
      throw new Error(
        `Release attestation evidence for ${relativePath} must record signer workflow enforcement for ${expectedSignerWorkflowIdentity}.`,
      );
    }
  }

  return {
    attestationEvidencePath,
  };
}

function assertArtifactReady({
  releaseAssetsDir,
  artifact,
  checksumEntries,
}) {
  const relativePath = normalizeReleaseRelativePath(artifact?.relativePath);
  if (!relativePath) {
    throw new Error('Release manifest contains an artifact without relativePath.');
  }
  assertSafeReleaseRelativePath(relativePath, { contextLabel: 'Release manifest' });

  const artifactPath = path.join(releaseAssetsDir, relativePath);
  if (!existsSync(artifactPath)) {
    throw new Error(`Missing release artifact: ${relativePath}`);
  }

  const artifactStat = statSync(artifactPath);
  if (!artifactStat.isFile()) {
    throw new Error(`Release artifact is not a file: ${relativePath}`);
  }

  const actualSha256 = computeSha256(artifactPath);
  const expectedSha256 = String(artifact?.sha256 ?? '').trim().toLowerCase();
  if (expectedSha256 !== actualSha256) {
    throw new Error(
      `Artifact checksum mismatch for ${relativePath}: manifest=${expectedSha256 || 'missing'} actual=${actualSha256}`,
    );
  }

  const checksumManifestSha256 = checksumEntries.get(relativePath);
  if (checksumManifestSha256 !== actualSha256) {
    throw new Error(
      `Checksum manifest mismatch for ${relativePath}: checksumFile=${checksumManifestSha256 ?? 'missing'} actual=${actualSha256}`,
    );
  }

  if (Number(artifact?.size) !== artifactStat.size) {
    throw new Error(
      `Artifact size mismatch for ${relativePath}: manifest=${artifact?.size ?? 'missing'} actual=${artifactStat.size}`,
    );
  }
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseAssetsDir: path.resolve('release-assets'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
    }
  }

  return options;
}

export function assertReleaseReadiness({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseAssetsDir = path.resolve('release-assets'),
  resolveReleaseProfileFn = resolveReleaseProfile,
} = {}) {
  const profile = resolveReleaseProfileFn(profileId);
  const normalizedReleaseAssetsDir = path.resolve(releaseAssetsDir);

  if (!existsSync(normalizedReleaseAssetsDir)) {
    throw new Error(`Missing release assets directory: ${normalizedReleaseAssetsDir}`);
  }

  const manifestPath = path.join(
    normalizedReleaseAssetsDir,
    profile.release.manifestFileName,
  );
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing finalized release manifest: ${manifestPath}`);
  }
  assertReleaseManifestChecksumFileName(profile.release.manifestChecksumFileName);
  const manifestChecksumPath = path.join(
    normalizedReleaseAssetsDir,
    profile.release.manifestChecksumFileName,
  );
  assertReleaseManifestChecksumSidecar({
    manifestPath,
    manifestFileName: profile.release.manifestFileName,
    manifestChecksumPath,
  });

  const manifest = readJsonFile(manifestPath, 'finalized release manifest');
  const manifestIdentity = assertManifestIdentity({
    manifest,
    profile,
  });
  const coverage = assertReleaseCoverageReady({
    manifest,
    profile,
  });
  const checksumFileName = manifestIdentity.checksumFileName;
  assertReleaseChecksumFileName(checksumFileName);

  const checksumPath = path.join(normalizedReleaseAssetsDir, checksumFileName);
  if (!existsSync(checksumPath)) {
    throw new Error(`Missing finalized release checksum manifest: ${checksumPath}`);
  }
  const checksumEntries = readChecksumManifest(checksumPath);

  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : [];
  if (artifacts.length === 0) {
    throw new Error('Release manifest artifacts must not be empty.');
  }

  const artifactPaths = new Set();
  for (const artifact of artifacts) {
    const relativePath = normalizeReleaseRelativePath(artifact?.relativePath);
    if (artifactPaths.has(relativePath)) {
      throw new Error(`Release manifest contains duplicate artifact path: ${relativePath}`);
    }
    artifactPaths.add(relativePath);
    assertArtifactReady({
      releaseAssetsDir: normalizedReleaseAssetsDir,
      artifact,
      checksumEntries,
    });
  }

  const releaseMetadata = assertReleaseMetadataReady({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifest,
    checksumEntries,
  });
  const releaseSubjectPaths = new Set([...artifactPaths]);
  for (const metadata of releaseMetadata) {
    releaseSubjectPaths.add(metadata.relativePath);
  }

  for (const checksumRelativePath of checksumEntries.keys()) {
    if (!releaseSubjectPaths.has(checksumRelativePath)) {
      throw new Error(
        `Checksum manifest contains a release subject not listed in release-manifest.json: ${checksumRelativePath}`,
      );
    }
  }
  assertArtifactCoverageMatchesManifest({
    artifacts,
    coverage,
    profile,
  });
  assertArtifactsWithinActiveReleaseProfile({
    artifacts,
    profile,
  });
  assertNoDuplicateArtifactsForReleaseTargets({
    artifacts,
    profile,
  });
  assertFinalizedArchiveArtifactsSafe({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    artifacts,
  });
  assertArtifactsSmokeMetadataReady({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    artifacts,
  });
  const attestationEvidence = assertReleaseAttestationEvidenceReady({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifest,
    subjects: buildAttestedReleaseSubjects({
      artifacts,
      releaseMetadata,
    }),
    profile,
  });
  assertReleaseAssetsDirectoryClosed({
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifest,
    profile,
    artifacts,
    releaseMetadata,
    checksumFileName,
    attestationEvidencePath: attestationEvidence?.attestationEvidencePath ?? '',
  });

  return {
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifestPath,
    manifestChecksumPath,
    attestationEvidencePath: attestationEvidence?.attestationEvidencePath ?? '',
    checksumPath,
    artifactCount: artifacts.length,
    releaseMetadataCount: releaseMetadata.length,
    requiredTargetCount: coverage.requiredTargets.length,
  };
}

function main() {
  const result = assertReleaseReadiness(parseArgs(process.argv.slice(2)));
  process.stdout.write(
    [
      'Release readiness assertion passed.',
      `releaseAssetsDir=${result.releaseAssetsDir}`,
      `manifest=${result.manifestPath}`,
      `manifestChecksum=${result.manifestChecksumPath}`,
      `attestationEvidence=${result.attestationEvidencePath}`,
      `checksumManifest=${result.checksumPath}`,
      `artifactCount=${result.artifactCount}`,
      `releaseMetadataCount=${result.releaseMetadataCount}`,
      `requiredTargetCount=${result.requiredTargetCount}`,
    ].join('\n'),
  );
  process.stdout.write('\n');
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
