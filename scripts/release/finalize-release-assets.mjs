#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

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
  assertSafeReleaseRelativePath,
  normalizeReleaseRelativePath,
} from './release-paths.mjs';
import {
  resolveKernelDefinition,
} from './kernel-definitions.mjs';
import {
  DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME,
  resolveInstallableArtifactRelativePaths,
} from './smoke-desktop-installers.mjs';
import {
  DESKTOP_STARTUP_SMOKE_REPORT_FILENAME,
  normalizeDesktopStartupSmokePackageContext,
  normalizeDesktopStartupSmokeLocalAiProxyRuntime,
  normalizeDesktopStartupSmokeChecks,
} from './desktop-startup-smoke-contract.mjs';
import {
  RELEASE_SMOKE_REPORT_FILENAME,
  normalizeReleaseSmokeRelativePath,
  normalizeReleaseSmokeRelativePathArray,
  normalizeReleaseSmokeChecks,
  readReleaseSmokeReport,
} from './release-smoke-contract.mjs';
import {
  assertDesktopOpenClawInstallerContract,
  normalizeDesktopOpenClawInstallerContract,
} from './desktop-openclaw-installer-contract.mjs';
import {
  normalizeDesktopInstallReadyLayout as normalizeInstallReadyLayout,
} from './desktop-install-ready-layout.mjs';
import {
  manifestIncludesKernel,
  normalizeKernelInstallContracts,
  readKernelInstallContract,
  writeKernelInstallContract,
} from './kernel-install-contracts.mjs';
import {
  normalizeKernelExternalRuntimePolicy,
  normalizeKernelInstallReadiness,
  readKernelExternalRuntimePolicy,
  readKernelInstallReadyLayout,
  writeKernelExternalRuntimePolicy,
  writeKernelInstallReadiness,
} from './kernel-install-readiness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const supportedDesktopPlatforms = new Set(['windows', 'linux', 'macos']);
const supportedServerPlatforms = new Set(['windows', 'linux', 'macos']);
const supportedDeploymentPlatforms = new Set(['linux']);
const supportedArchIds = new Set(['x64', 'arm64']);
const supportedAccelerators = new Set(['cpu', 'nvidia-cuda', 'amd-rocm']);
const SHA256_READ_BUFFER_SIZE = 1024 * 1024;
const RELEASE_NOTES_FILE_NAME = 'release-notes.md';

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function listFilesRecursively(sourceDir, relativePrefix = '') {
  const entries = readdirSync(sourceDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativePrefix, entry.name);
    const absolutePath = path.join(sourceDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile()) {
      files.push({
        absolutePath,
        relativePath: relativePath.replaceAll('\\', '/'),
      });
    }
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

function buildEvidenceFileMetadata(filePath, prefix) {
  const stat = statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`Release evidence path is not a file: ${filePath}`);
  }

  return {
    [`${prefix}Sha256`]: computeSha256(filePath),
    [`${prefix}Size`]: stat.size,
  };
}

function buildCommonSmokeEvidenceMetadata({
  manifestPath,
  smokeReportPath,
}) {
  return {
    ...buildEvidenceFileMetadata(smokeReportPath, 'report'),
    ...buildEvidenceFileMetadata(manifestPath, 'manifest'),
  };
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseTag: '',
    repository: '',
    releaseAssetsDir: path.resolve('release-assets'),
    allowPartialRelease: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(argv, index, '--release-tag');
      index += 1;
      continue;
    }

    if (token === '--repository') {
      options.repository = readOptionValue(argv, index, '--repository');
      index += 1;
      continue;
    }

    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = path.resolve(
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
      continue;
    }

    if (token === '--allow-partial-release') {
      options.allowPartialRelease = true;
    }
  }

  return options;
}

function readPartialManifest(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
}

function normalizeReleaseSmokePathArray(values) {
  return normalizeReleaseSmokeRelativePathArray(values, {
    contextLabel: 'Release smoke report',
    pathLabel: 'release smoke path',
  });
}

function cloneManifestKernelPlatformSupport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const normalizedEntries = Object.entries(value)
    .map(([kernelId, platformSupport]) => {
      const normalizedKernelId = String(kernelId ?? '').trim();
      if (!normalizedKernelId || !platformSupport || typeof platformSupport !== 'object' || Array.isArray(platformSupport)) {
        return null;
      }

      const windows = String(platformSupport.windows ?? '').trim();
      const macos = String(platformSupport.macos ?? '').trim();
      const linux = String(platformSupport.linux ?? '').trim();
      if (!windows || !macos || !linux) {
        return null;
      }

      return [
        normalizedKernelId,
        {
          windows,
          macos,
          linux,
        },
      ];
    })
    .filter(Boolean);

  return normalizedEntries.length > 0
    ? Object.fromEntries(normalizedEntries)
    : undefined;
}

function buildPackageProfileArtifactMetadata(manifest) {
  const packageProfileId = String(manifest?.packageProfileId ?? '').trim();
  const includedKernelIds = Array.isArray(manifest?.includedKernelIds)
    ? manifest.includedKernelIds.map((value) => String(value ?? '').trim()).filter(Boolean)
    : [];
  const defaultEnabledKernelIds = Array.isArray(manifest?.defaultEnabledKernelIds)
    ? manifest.defaultEnabledKernelIds.map((value) => String(value ?? '').trim()).filter(Boolean)
    : [];
  const requiredExternalRuntimes = Array.isArray(manifest?.requiredExternalRuntimes)
    ? manifest.requiredExternalRuntimes.map((value) => String(value ?? '').trim()).filter(Boolean)
    : [];
  const optionalExternalRuntimes = Array.isArray(manifest?.optionalExternalRuntimes)
    ? manifest.optionalExternalRuntimes.map((value) => String(value ?? '').trim()).filter(Boolean)
    : [];
  const launcherKinds = Array.isArray(manifest?.launcherKinds)
    ? manifest.launcherKinds.map((value) => String(value ?? '').trim()).filter(Boolean)
    : [];
  const kernelPlatformSupport = cloneManifestKernelPlatformSupport(manifest?.kernelPlatformSupport);

  return {
    ...(packageProfileId ? { packageProfileId } : {}),
    ...(includedKernelIds.length > 0 ? { includedKernelIds } : {}),
    ...(defaultEnabledKernelIds.length > 0 ? { defaultEnabledKernelIds } : {}),
    ...(requiredExternalRuntimes.length > 0 ? { requiredExternalRuntimes } : {}),
    ...(Array.isArray(manifest?.optionalExternalRuntimes) ? { optionalExternalRuntimes } : {}),
    ...(launcherKinds.length > 0 ? { launcherKinds } : {}),
    ...(kernelPlatformSupport ? { kernelPlatformSupport } : {}),
  };
}

function normalizeInstallPlanSummaries(values) {
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

function resolveExpectedInstallReadyLayoutModeFromInstallerContract(installerContract) {
  const installMode = String(installerContract?.installMode ?? '').trim();
  if (installMode === 'preexpanded-managed-layout') {
    return 'staged-layout';
  }
  if (installMode === 'first-launch-archive-extract') {
    return 'archive-extract-ready';
  }
  return '';
}

function buildDesktopInstallerSmokeMetadata({
  releaseAssetsDir,
  manifestPath,
  smokeReportPath,
  smokeReport,
}) {
  return {
    reportRelativePath: path.relative(releaseAssetsDir, smokeReportPath).replaceAll('\\', '/'),
    manifestRelativePath: path.relative(releaseAssetsDir, manifestPath).replaceAll('\\', '/'),
    ...buildCommonSmokeEvidenceMetadata({ manifestPath, smokeReportPath }),
    verifiedAt: String(smokeReport?.verifiedAt ?? '').trim(),
    target: String(smokeReport?.target ?? '').trim(),
    installableArtifactRelativePaths: normalizeReleaseSmokePathArray(
      smokeReport?.installableArtifactRelativePaths,
    ),
    requiredCompanionArtifactRelativePaths: normalizeReleaseSmokePathArray(
      smokeReport?.requiredCompanionArtifactRelativePaths,
    ),
    ...(normalizeKernelInstallReadiness(smokeReport?.kernelInstallReadiness)
      ? { kernelInstallReadiness: normalizeKernelInstallReadiness(smokeReport?.kernelInstallReadiness) }
      : {}),
    installPlanSummaries: normalizeInstallPlanSummaries(smokeReport?.installPlanSummaries),
  };
}

function buildKernelExternalRuntimePolicy(kernelId) {
  const definition = resolveKernelDefinition(kernelId);
  return normalizeKernelExternalRuntimePolicy({
    packagingPolicy: definition.sourceMetadata.packagingPolicy,
    launcherKinds: definition.launcherKinds,
    platformSupport: definition.platformSupport,
    runtimeRequirements: definition.runtimeRequirements,
    optionalRuntimeRequirements: definition.optionalRuntimeRequirements,
  });
}

function buildDesktopStartupSmokeMetadata({
  releaseAssetsDir,
  manifestPath,
  smokeReportPath,
  smokeReport,
}) {
  const packageContext = normalizeDesktopStartupSmokePackageContext(smokeReport);
  const capturedEvidenceRelativePath = normalizeReleaseSmokeRelativePath(
    smokeReport?.capturedEvidenceRelativePath ?? '',
    {
      contextLabel: 'Release smoke report',
      pathLabel: 'captured evidence path',
    },
  );

  return {
    reportRelativePath: path.relative(releaseAssetsDir, smokeReportPath).replaceAll('\\', '/'),
    manifestRelativePath: path.relative(releaseAssetsDir, manifestPath).replaceAll('\\', '/'),
    capturedEvidenceRelativePath,
    ...buildCommonSmokeEvidenceMetadata({ manifestPath, smokeReportPath }),
    ...buildEvidenceFileMetadata(
      path.join(releaseAssetsDir, capturedEvidenceRelativePath),
      'capturedEvidence',
    ),
    verifiedAt: String(smokeReport?.verifiedAt ?? '').trim(),
    target: String(smokeReport?.target ?? '').trim(),
    status: String(smokeReport?.status ?? '').trim(),
    phase: String(smokeReport?.phase ?? '').trim(),
    ...(packageContext ?? {}),
    descriptorBrowserBaseUrl: String(
      smokeReport?.descriptorBrowserBaseUrl ?? '',
    ).trim(),
    builtInInstanceId: String(smokeReport?.builtInInstanceId ?? '').trim(),
    builtInInstanceStatus: String(smokeReport?.builtInInstanceStatus ?? '').trim(),
    localAiProxyRuntime: normalizeDesktopStartupSmokeLocalAiProxyRuntime(
      smokeReport?.localAiProxyRuntime,
    ),
    artifactRelativePaths: normalizeReleaseSmokePathArray(smokeReport?.artifactRelativePaths),
    checks: normalizeDesktopStartupSmokeChecks(smokeReport?.checks),
  };
}

function normalizeServerBundleSmokeMetadataChecks(values) {
  return Array.isArray(values)
    ? values
      .map((value) => ({
        id: String(value?.id ?? '').trim(),
        status: String(value?.status ?? '').trim().toLowerCase(),
        detail: String(value?.detail ?? '').trim(),
      }))
      .filter((value) => value.id.length > 0)
    : [];
}

function buildServerBundleSmokeMetadata({
  releaseAssetsDir,
  manifestPath,
  smokeReportPath,
  smokeReport,
}) {
  return {
    reportRelativePath: path.relative(releaseAssetsDir, smokeReportPath).replaceAll('\\', '/'),
    manifestRelativePath: path.relative(releaseAssetsDir, manifestPath).replaceAll('\\', '/'),
    ...buildCommonSmokeEvidenceMetadata({ manifestPath, smokeReportPath }),
    verifiedAt: String(smokeReport?.verifiedAt ?? '').trim(),
    target: String(smokeReport?.target ?? '').trim(),
    smokeKind: String(smokeReport?.smokeKind ?? '').trim(),
    status: String(smokeReport?.status ?? '').trim(),
    launcherRelativePath: normalizeReleaseSmokeRelativePath(
      smokeReport?.launcherRelativePath ?? '',
      {
        contextLabel: 'Release smoke report',
        pathLabel: 'launcher path',
      },
    ),
    runtimeBaseUrl: String(smokeReport?.runtimeBaseUrl ?? '').trim(),
    artifactRelativePaths: normalizeReleaseSmokePathArray(smokeReport?.artifactRelativePaths),
    checks: normalizeServerBundleSmokeMetadataChecks(smokeReport?.checks),
  };
}

function buildWebArchiveSmokeMetadata({
  releaseAssetsDir,
  manifestPath,
  smokeReportPath,
  smokeReport,
}) {
  return {
    reportRelativePath: path.relative(releaseAssetsDir, smokeReportPath).replaceAll('\\', '/'),
    manifestRelativePath: path.relative(releaseAssetsDir, manifestPath).replaceAll('\\', '/'),
    ...buildCommonSmokeEvidenceMetadata({ manifestPath, smokeReportPath }),
    verifiedAt: String(smokeReport?.verifiedAt ?? '').trim(),
    target: String(smokeReport?.target ?? '').trim(),
    smokeKind: String(smokeReport?.smokeKind ?? '').trim(),
    status: String(smokeReport?.status ?? '').trim(),
    artifactRelativePaths: normalizeReleaseSmokePathArray(smokeReport?.artifactRelativePaths),
    checks: normalizeServerBundleSmokeMetadataChecks(smokeReport?.checks),
  };
}

function buildDeploymentSmokeMetadata({
  releaseAssetsDir,
  manifestPath,
  smokeReportPath,
  smokeReport,
}) {
  const launcherRelativePath = String(smokeReport?.launcherRelativePath ?? '').trim();
  const runtimeBaseUrl = String(smokeReport?.runtimeBaseUrl ?? '').trim();
  const skippedReason = String(smokeReport?.skippedReason ?? '').trim();
  const rawCapabilities = smokeReport?.capabilities;
  const capabilities = rawCapabilities && typeof rawCapabilities === 'object'
    ? Object.fromEntries(
        Object.entries(rawCapabilities)
          .filter(([key]) => String(key ?? '').trim().length > 0)
          .map(([key, value]) => [String(key).trim(), Boolean(value)]),
      )
    : null;

  return {
    reportRelativePath: path.relative(releaseAssetsDir, smokeReportPath).replaceAll('\\', '/'),
    manifestRelativePath: path.relative(releaseAssetsDir, manifestPath).replaceAll('\\', '/'),
    ...buildCommonSmokeEvidenceMetadata({ manifestPath, smokeReportPath }),
    verifiedAt: String(smokeReport?.verifiedAt ?? '').trim(),
    target: String(smokeReport?.target ?? '').trim(),
    smokeKind: String(smokeReport?.smokeKind ?? '').trim(),
    status: String(smokeReport?.status ?? '').trim(),
    ...(launcherRelativePath.length > 0 ? { launcherRelativePath } : {}),
    ...(runtimeBaseUrl.length > 0 ? { runtimeBaseUrl } : {}),
    artifactRelativePaths: normalizeReleaseSmokePathArray(smokeReport?.artifactRelativePaths),
    checks: normalizeServerBundleSmokeMetadataChecks(smokeReport?.checks),
    ...(skippedReason.length > 0 ? { skippedReason } : {}),
    ...(capabilities && Object.keys(capabilities).length > 0 ? { capabilities } : {}),
  };
}

function validatePartialReleaseAssetManifest({
  manifest,
  manifestPath,
  profile,
}) {
  const manifestProfileId = String(manifest?.profileId ?? '').trim();
  if (manifestProfileId !== profile.id) {
    throw new Error(
      `Partial release asset manifest profile mismatch at ${manifestPath}: expected ${profile.id}, received ${manifestProfileId || 'missing'}.`,
    );
  }

  for (const artifact of manifest?.artifacts ?? []) {
    const relativePath = normalizeReleaseRelativePath(artifact?.relativePath);
    assertSafeReleaseRelativePath(relativePath, {
      contextLabel: `Partial release asset manifest at ${manifestPath}`,
      artifactPathLabel: 'release artifact path',
    });
  }
}

function assertSafeSmokeLauncherRelativePath(smokeReport, smokeReportPath) {
  if (!String(smokeReport?.launcherRelativePath ?? '').trim()) {
    throw new Error(`Release smoke report is missing launcherRelativePath: ${smokeReportPath}`);
  }
  return normalizeReleaseSmokeRelativePath(smokeReport?.launcherRelativePath ?? '', {
    contextLabel: `Release smoke report at ${smokeReportPath}`,
    pathLabel: 'launcher path',
  });
}

function listPartialManifestRecords(releaseAssetsDir, partialManifestFileName, profile) {
  return listFilesRecursively(releaseAssetsDir)
    .filter((file) => (
      file.relativePath.endsWith(`/${partialManifestFileName}`)
      || file.relativePath === partialManifestFileName
    ))
    .map((file) => {
      const manifest = readPartialManifest(file.absolutePath);
      validatePartialReleaseAssetManifest({
        manifest,
        manifestPath: file.absolutePath,
        profile,
      });

      return {
        file,
        manifest,
      };
    });
}

function requireDesktopInstallerSmokeReports({
  workspaceRootDir,
  releaseAssetsDir,
  partialManifestFileName,
  profile,
  releaseTag = '',
} = {}) {
  const desktopInstallerMetadataByManifestPath = new Map();
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const partialManifestRecords = listPartialManifestRecords(
    releaseAssetsDir,
    partialManifestFileName,
    profile,
  );
  const hasTaggedManifest = normalizedReleaseTag.length > 0
    && partialManifestRecords.some((record) => String(record.manifest?.releaseTag ?? '').trim().length > 0);

  for (const record of partialManifestRecords) {
    const manifest = record.manifest;
    const manifestReleaseTag = String(manifest?.releaseTag ?? '').trim();
    if (hasTaggedManifest && manifestReleaseTag !== normalizedReleaseTag) {
      continue;
    }

    const manifestDir = path.dirname(record.file.absolutePath);
    const relativeManifestDir = path.relative(releaseAssetsDir, manifestDir).replaceAll('\\', '/');
    const [family] = relativeManifestDir.split('/');
    if (family !== 'desktop') {
      continue;
    }

    const expectedPlatform = String(manifest?.platform ?? '').trim();
    const expectedArch = String(manifest?.arch ?? '').trim();
    const smokeReportPath = path.join(
      manifestDir,
      DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME,
    );
    const includesOpenClaw = manifestIncludesKernel(manifest, 'openclaw');
    const expectedInstallerContract = includesOpenClaw
      ? assertDesktopOpenClawInstallerContract({
          actualContract: readKernelInstallContract(manifest?.kernelInstallContracts, 'openclaw'),
          workspaceRootDir,
          platform: expectedPlatform,
          contextLabel: `Desktop release asset manifest OpenClaw installer contract at ${record.file.absolutePath}`,
        })
      : null;

    if (!existsSync(smokeReportPath)) {
      throw new Error(`Missing desktop installer smoke report: ${smokeReportPath}`);
    }

    const smokeReport = JSON.parse(readFileSync(smokeReportPath, 'utf8'));
    let propagatedKernelInstallReadiness = null;
    if (String(smokeReport?.platform ?? '').trim() !== expectedPlatform) {
      throw new Error(
        `Desktop installer smoke report platform mismatch at ${smokeReportPath}: expected ${expectedPlatform}, received ${smokeReport?.platform ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.arch ?? '').trim() !== expectedArch) {
      throw new Error(
        `Desktop installer smoke report architecture mismatch at ${smokeReportPath}: expected ${expectedArch}, received ${smokeReport?.arch ?? 'unknown'}`,
      );
    }

    const expectedInstallableArtifactRelativePaths = resolveInstallableArtifactRelativePaths(
      manifest,
      expectedPlatform,
    );
    const reportedInstallableArtifactRelativePaths = normalizeReleaseSmokePathArray(
      smokeReport?.installableArtifactRelativePaths,
    );

    if (
      expectedInstallableArtifactRelativePaths.length !== reportedInstallableArtifactRelativePaths.length
      || expectedInstallableArtifactRelativePaths.some(
        (relativePath, index) => relativePath !== reportedInstallableArtifactRelativePaths[index],
      )
    ) {
      throw new Error(
        `Desktop installer smoke report does not match the current installable artifact set: ${smokeReportPath}`,
      );
    }

    if (expectedInstallerContract) {
      if (
        JSON.stringify(
          normalizeDesktopOpenClawInstallerContract(
            readKernelInstallContract(smokeReport?.kernelInstallContracts, 'openclaw'),
          ),
        )
        !== JSON.stringify(expectedInstallerContract)
      ) {
        throw new Error(
          `Desktop installer smoke report OpenClaw installer contract mismatch at ${smokeReportPath}`,
        );
      }
      const openClawInstallReadyLayout = normalizeInstallReadyLayout(
        readKernelInstallReadyLayout(smokeReport?.kernelInstallReadiness, 'openclaw'),
      );
      if (!openClawInstallReadyLayout) {
        throw new Error(
          `Desktop installer smoke report is missing install-ready layout evidence at ${smokeReportPath}`,
        );
      }
      const expectedInstallReadyLayoutMode = resolveExpectedInstallReadyLayoutModeFromInstallerContract(
        expectedInstallerContract,
      );
      if (
        expectedInstallReadyLayoutMode
        && openClawInstallReadyLayout.mode !== expectedInstallReadyLayoutMode
      ) {
        throw new Error(
          `Desktop installer smoke report installReadyLayout.mode mismatch at ${smokeReportPath}: expected ${expectedInstallReadyLayoutMode}, received ${openClawInstallReadyLayout.mode}`,
        );
      }
      propagatedKernelInstallReadiness = writeKernelInstallReadiness(
        propagatedKernelInstallReadiness,
        'openclaw',
        { installReadyLayout: openClawInstallReadyLayout },
      );
    }

    for (const kernelId of normalizeStringArray(manifest?.includedKernelIds)) {
      const expectedExternalRuntimePolicy = buildKernelExternalRuntimePolicy(kernelId);
      const reportedExternalRuntimePolicy = readKernelExternalRuntimePolicy(
        smokeReport?.kernelInstallReadiness,
        kernelId,
      );

      if (
        JSON.stringify(reportedExternalRuntimePolicy)
        !== JSON.stringify(expectedExternalRuntimePolicy)
      ) {
        const kernelLabel = resolveKernelDefinition(kernelId).displayName;
        throw new Error(
          `Desktop installer smoke report is missing ${kernelLabel} external-runtime readiness evidence at ${smokeReportPath}`,
        );
      }

      propagatedKernelInstallReadiness = writeKernelExternalRuntimePolicy(
        propagatedKernelInstallReadiness,
        kernelId,
        expectedExternalRuntimePolicy,
      );
    }

    desktopInstallerMetadataByManifestPath.set(
      record.file.absolutePath,
      {
        ...(expectedInstallerContract
          ? {
              kernelInstallContracts: writeKernelInstallContract(
                null,
                'openclaw',
                expectedInstallerContract,
              ),
            }
          : {}),
        ...(propagatedKernelInstallReadiness
          ? { kernelInstallReadiness: propagatedKernelInstallReadiness }
          : {}),
        desktopInstallerSmoke: buildDesktopInstallerSmokeMetadata({
          releaseAssetsDir,
          manifestPath: record.file.absolutePath,
          smokeReportPath,
          smokeReport,
        }),
      },
    );
  }

  return desktopInstallerMetadataByManifestPath;
}

function requireDesktopStartupSmokeReports({
  releaseAssetsDir,
  partialManifestFileName,
  profile,
  releaseTag = '',
} = {}) {
  const desktopStartupMetadataByManifestPath = new Map();
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const partialManifestRecords = listPartialManifestRecords(
    releaseAssetsDir,
    partialManifestFileName,
    profile,
  );
  const hasTaggedManifest = normalizedReleaseTag.length > 0
    && partialManifestRecords.some((record) => String(record.manifest?.releaseTag ?? '').trim().length > 0);

  for (const record of partialManifestRecords) {
    const manifest = record.manifest;
    const manifestReleaseTag = String(manifest?.releaseTag ?? '').trim();
    if (hasTaggedManifest && manifestReleaseTag !== normalizedReleaseTag) {
      continue;
    }

    const manifestDir = path.dirname(record.file.absolutePath);
    const relativeManifestDir = path.relative(releaseAssetsDir, manifestDir).replaceAll('\\', '/');
    const [family] = relativeManifestDir.split('/');
    if (family !== 'desktop') {
      continue;
    }

    const smokeReportPath = path.join(
      manifestDir,
      DESKTOP_STARTUP_SMOKE_REPORT_FILENAME,
    );
    if (!existsSync(smokeReportPath)) {
      throw new Error(`Missing desktop startup smoke report: ${smokeReportPath}`);
    }

    const expectedPlatform = String(manifest?.platform ?? '').trim();
    const expectedArch = String(manifest?.arch ?? '').trim();
    const expectedArtifactRelativePaths = normalizeReleaseSmokePathArray(
      Array.isArray(manifest?.artifacts)
        ? manifest.artifacts.map((artifact) => artifact?.relativePath)
        : [],
    );
    const smokeReport = JSON.parse(readFileSync(smokeReportPath, 'utf8'));

    if (String(smokeReport?.platform ?? '').trim() !== expectedPlatform) {
      throw new Error(
        `Desktop startup smoke report platform mismatch at ${smokeReportPath}: expected ${expectedPlatform}, received ${smokeReport?.platform ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.arch ?? '').trim() !== expectedArch) {
      throw new Error(
        `Desktop startup smoke report architecture mismatch at ${smokeReportPath}: expected ${expectedArch}, received ${smokeReport?.arch ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.status ?? '').trim() !== 'passed') {
      throw new Error(
        `Desktop startup smoke report must pass before finalization: ${smokeReportPath}`,
      );
    }
    if (String(smokeReport?.phase ?? '').trim() !== 'shell-mounted') {
      throw new Error(
        `Desktop startup smoke report must record phase shell-mounted before finalization: ${smokeReportPath}`,
      );
    }
    if (
      path.resolve(String(smokeReport?.manifestPath ?? '').trim() || manifestDir)
      !== path.resolve(record.file.absolutePath)
    ) {
      throw new Error(
        `Desktop startup smoke report manifest path mismatch at ${smokeReportPath}`,
      );
    }

    const expectedPackageContext = normalizeDesktopStartupSmokePackageContext({
      packageProfileId: manifest?.packageProfileId,
      includedKernelIds: manifest?.includedKernelIds,
      defaultEnabledKernelIds: manifest?.defaultEnabledKernelIds,
    });
    if (!expectedPackageContext) {
      throw new Error(
        `Desktop release asset manifest is missing packaged kernel context metadata: ${record.file.absolutePath}`,
      );
    }

    const reportedPackageContext = normalizeDesktopStartupSmokePackageContext(smokeReport);
    if (!reportedPackageContext) {
      throw new Error(
        `Desktop startup smoke report is missing packaged kernel context metadata: ${smokeReportPath}`,
      );
    }
    if (reportedPackageContext.packageProfileId !== expectedPackageContext.packageProfileId) {
      throw new Error(
        `Desktop startup smoke report package profile mismatch at ${smokeReportPath}`,
      );
    }
    if (
      JSON.stringify(reportedPackageContext.includedKernelIds)
      !== JSON.stringify(expectedPackageContext.includedKernelIds)
    ) {
      throw new Error(
        `Desktop startup smoke report included kernels mismatch at ${smokeReportPath}`,
      );
    }
    if (
      JSON.stringify(reportedPackageContext.defaultEnabledKernelIds)
      !== JSON.stringify(expectedPackageContext.defaultEnabledKernelIds)
    ) {
      throw new Error(
        `Desktop startup smoke report default enabled kernels mismatch at ${smokeReportPath}`,
      );
    }

    const capturedEvidenceRelativePath = normalizeReleaseSmokeRelativePath(
      smokeReport?.capturedEvidenceRelativePath ?? '',
      {
        contextLabel: `Desktop startup smoke report at ${smokeReportPath}`,
        pathLabel: 'captured evidence path',
      },
    );
    if (!capturedEvidenceRelativePath) {
      throw new Error(
        `Desktop startup smoke report is missing capturedEvidenceRelativePath: ${smokeReportPath}`,
      );
    }
    const capturedEvidencePath = path.resolve(
      releaseAssetsDir,
      capturedEvidenceRelativePath,
    );
    if (!existsSync(capturedEvidencePath)) {
      throw new Error(
        `Desktop startup smoke report references missing captured evidence: ${capturedEvidencePath}`,
      );
    }

    const capturedEvidence = JSON.parse(readFileSync(capturedEvidencePath, 'utf8'));
    if (String(capturedEvidence?.status ?? '').trim() !== 'passed') {
      throw new Error(
        `Captured desktop startup evidence must preserve status passed at ${capturedEvidencePath}`,
      );
    }
    if (String(capturedEvidence?.phase ?? '').trim() !== 'shell-mounted') {
      throw new Error(
        `Captured desktop startup evidence must preserve phase shell-mounted at ${capturedEvidencePath}`,
      );
    }
    if (capturedEvidence?.readinessEvidence?.ready !== true) {
      throw new Error(
        `Captured desktop startup evidence must preserve ready runtime readiness at ${capturedEvidencePath}`,
      );
    }
    const capturedLocalAiProxyRuntime = normalizeDesktopStartupSmokeLocalAiProxyRuntime(
      capturedEvidence?.localAiProxy,
    );
    if (!capturedLocalAiProxyRuntime) {
      throw new Error(
        `Captured desktop startup evidence must preserve local ai proxy runtime artifact facts at ${capturedEvidencePath}`,
      );
    }
    const reportedLocalAiProxyRuntime = normalizeDesktopStartupSmokeLocalAiProxyRuntime(
      smokeReport?.localAiProxyRuntime,
    );
    if (!reportedLocalAiProxyRuntime) {
      throw new Error(
        `Desktop startup smoke report is missing localAiProxyRuntime metadata: ${smokeReportPath}`,
      );
    }
    if (
      JSON.stringify(capturedLocalAiProxyRuntime)
      !== JSON.stringify(reportedLocalAiProxyRuntime)
    ) {
      throw new Error(
        `Desktop startup smoke report local ai proxy runtime metadata mismatch at ${smokeReportPath}`,
      );
    }

    const reportedArtifactRelativePaths = normalizeReleaseSmokePathArray(
      smokeReport?.artifactRelativePaths,
    );
    if (
      expectedArtifactRelativePaths.length !== reportedArtifactRelativePaths.length
      || expectedArtifactRelativePaths.some(
        (relativePath, index) => relativePath !== reportedArtifactRelativePaths[index],
      )
    ) {
      throw new Error(
        `Desktop startup smoke report does not match the current artifact set: ${smokeReportPath}`,
      );
    }

    const checks = normalizeDesktopStartupSmokeChecks(smokeReport?.checks);
    const passedChecks = new Map(
      checks.map((check) => [check.id, check.status]),
    );
    for (const requiredCheckId of [
      'startup-status',
      'startup-phase',
      'runtime-readiness',
      'built-in-instance',
      'gateway-websocket',
      'local-ai-proxy-runtime',
    ]) {
      if (passedChecks.get(requiredCheckId) !== 'passed') {
        throw new Error(
          `Desktop startup smoke report is missing a passing ${requiredCheckId} check: ${smokeReportPath}`,
        );
      }
    }

    desktopStartupMetadataByManifestPath.set(
      record.file.absolutePath,
      {
        desktopStartupSmoke: buildDesktopStartupSmokeMetadata({
          releaseAssetsDir,
          manifestPath: record.file.absolutePath,
          smokeReportPath,
          smokeReport,
        }),
      },
    );
  }

  return desktopStartupMetadataByManifestPath;
}

function requireServerBundleSmokeReports({
  releaseAssetsDir,
  partialManifestFileName,
  profile,
  releaseTag = '',
} = {}) {
  const serverBundleSmokeMetadataByManifestPath = new Map();
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const partialManifestRecords = listPartialManifestRecords(
    releaseAssetsDir,
    partialManifestFileName,
    profile,
  );
  const hasTaggedManifest = normalizedReleaseTag.length > 0
    && partialManifestRecords.some((record) => String(record.manifest?.releaseTag ?? '').trim().length > 0);

  for (const record of partialManifestRecords) {
    const manifest = record.manifest;
    const manifestReleaseTag = String(manifest?.releaseTag ?? '').trim();
    if (hasTaggedManifest && manifestReleaseTag !== normalizedReleaseTag) {
      continue;
    }

    const manifestDir = path.dirname(record.file.absolutePath);
    const relativeManifestDir = path.relative(releaseAssetsDir, manifestDir).replaceAll('\\', '/');
    const [family] = relativeManifestDir.split('/');
    if (family !== 'server') {
      continue;
    }

    const expectedPlatform = String(manifest?.platform ?? '').trim();
    const expectedArch = String(manifest?.arch ?? '').trim();
    const expectedArtifactRelativePaths = normalizeReleaseSmokePathArray(
      Array.isArray(manifest?.artifacts)
        ? manifest.artifacts.map((artifact) => artifact?.relativePath)
        : [],
    );
    const smokeReportPath = path.join(
      manifestDir,
      RELEASE_SMOKE_REPORT_FILENAME,
    );

    if (!existsSync(smokeReportPath)) {
      throw new Error(`Missing server bundle smoke report: ${smokeReportPath}`);
    }

    const smokeReport = readReleaseSmokeReport(smokeReportPath);
    if (String(smokeReport?.family ?? '').trim() !== 'server') {
      throw new Error(
        `Server bundle smoke report family mismatch at ${smokeReportPath}: expected server, received ${smokeReport?.family ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.platform ?? '').trim() !== expectedPlatform) {
      throw new Error(
        `Server bundle smoke report platform mismatch at ${smokeReportPath}: expected ${expectedPlatform}, received ${smokeReport?.platform ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.arch ?? '').trim() !== expectedArch) {
      throw new Error(
        `Server bundle smoke report architecture mismatch at ${smokeReportPath}: expected ${expectedArch}, received ${smokeReport?.arch ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.status ?? '').trim() !== 'passed') {
      throw new Error(
        `Server bundle smoke report must pass before finalization: ${smokeReportPath}`,
      );
    }
    if (String(smokeReport?.smokeKind ?? '').trim() !== 'bundle-runtime') {
      throw new Error(
        `Server bundle smoke report must describe bundle-runtime verification: ${smokeReportPath}`,
      );
    }
    if (
      path.resolve(String(smokeReport?.manifestPath ?? '').trim() || manifestDir)
      !== path.resolve(record.file.absolutePath)
    ) {
      throw new Error(
        `Server bundle smoke report manifest path mismatch at ${smokeReportPath}`,
      );
    }

    const reportedArtifactRelativePaths = normalizeReleaseSmokePathArray(
      smokeReport?.artifactRelativePaths,
    );
    if (
      expectedArtifactRelativePaths.length !== reportedArtifactRelativePaths.length
      || expectedArtifactRelativePaths.some(
        (relativePath, index) => relativePath !== reportedArtifactRelativePaths[index],
      )
    ) {
      throw new Error(
        `Server bundle smoke report does not match the current artifact set: ${smokeReportPath}`,
      );
    }
    assertSafeSmokeLauncherRelativePath(smokeReport, smokeReportPath);
    if (String(smokeReport?.runtimeBaseUrl ?? '').trim().length === 0) {
      throw new Error(
        `Server bundle smoke report is missing runtimeBaseUrl: ${smokeReportPath}`,
      );
    }

    const checks = normalizeReleaseSmokeChecks(smokeReport?.checks);
    const passedChecks = new Map(
      checks.map((check) => [check.id, check.status]),
    );
    for (const requiredCheckId of ['health-ready', 'host-endpoints', 'browser-shell']) {
      if (passedChecks.get(requiredCheckId) !== 'passed') {
        throw new Error(
          `Server bundle smoke report is missing a passing ${requiredCheckId} check: ${smokeReportPath}`,
        );
      }
    }

    serverBundleSmokeMetadataByManifestPath.set(
      record.file.absolutePath,
      {
        serverBundleSmoke: buildServerBundleSmokeMetadata({
          releaseAssetsDir,
          manifestPath: record.file.absolutePath,
          smokeReportPath,
          smokeReport,
        }),
      },
    );
  }

  return serverBundleSmokeMetadataByManifestPath;
}

function requireWebArchiveSmokeReports({
  releaseAssetsDir,
  partialManifestFileName,
  profile,
  releaseTag = '',
} = {}) {
  const webArchiveSmokeMetadataByManifestPath = new Map();
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const partialManifestRecords = listPartialManifestRecords(
    releaseAssetsDir,
    partialManifestFileName,
    profile,
  );
  const hasTaggedManifest = normalizedReleaseTag.length > 0
    && partialManifestRecords.some((record) => String(record.manifest?.releaseTag ?? '').trim().length > 0);

  for (const record of partialManifestRecords) {
    const manifest = record.manifest;
    const manifestReleaseTag = String(manifest?.releaseTag ?? '').trim();
    if (hasTaggedManifest && manifestReleaseTag !== normalizedReleaseTag) {
      continue;
    }

    const manifestDir = path.dirname(record.file.absolutePath);
    const relativeManifestDir = path.relative(releaseAssetsDir, manifestDir).replaceAll('\\', '/');
    const [family] = relativeManifestDir.split('/');
    if (family !== 'web') {
      continue;
    }

    const expectedPlatform = String(manifest?.platform ?? '').trim() || 'web';
    const expectedArch = String(manifest?.arch ?? '').trim() || 'any';
    const expectedArtifactRelativePaths = normalizeReleaseSmokePathArray(
      Array.isArray(manifest?.artifacts)
        ? manifest.artifacts.map((artifact) => artifact?.relativePath)
        : [],
    );
    const smokeReportPath = path.join(
      manifestDir,
      RELEASE_SMOKE_REPORT_FILENAME,
    );

    if (!existsSync(smokeReportPath)) {
      throw new Error(`Missing web archive smoke report: ${smokeReportPath}`);
    }

    const smokeReport = readReleaseSmokeReport(smokeReportPath);
    if (String(smokeReport?.family ?? '').trim() !== 'web') {
      throw new Error(
        `Web archive smoke report family mismatch at ${smokeReportPath}: expected web, received ${smokeReport?.family ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.platform ?? '').trim() !== expectedPlatform) {
      throw new Error(
        `Web archive smoke report platform mismatch at ${smokeReportPath}: expected ${expectedPlatform}, received ${smokeReport?.platform ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.arch ?? '').trim() !== expectedArch) {
      throw new Error(
        `Web archive smoke report architecture mismatch at ${smokeReportPath}: expected ${expectedArch}, received ${smokeReport?.arch ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.status ?? '').trim() !== 'passed') {
      throw new Error(
        `Web archive smoke report must pass before finalization: ${smokeReportPath}`,
      );
    }
    if (String(smokeReport?.smokeKind ?? '').trim() !== 'web-archive-content') {
      throw new Error(
        `Web archive smoke report must describe web-archive-content verification: ${smokeReportPath}`,
      );
    }
    if (
      path.resolve(String(smokeReport?.manifestPath ?? '').trim() || manifestDir)
      !== path.resolve(record.file.absolutePath)
    ) {
      throw new Error(
        `Web archive smoke report manifest path mismatch at ${smokeReportPath}`,
      );
    }

    const reportedArtifactRelativePaths = normalizeReleaseSmokePathArray(
      smokeReport?.artifactRelativePaths,
    );
    if (
      expectedArtifactRelativePaths.length !== reportedArtifactRelativePaths.length
      || expectedArtifactRelativePaths.some(
        (relativePath, index) => relativePath !== reportedArtifactRelativePaths[index],
      )
    ) {
      throw new Error(
        `Web archive smoke report does not match the current artifact set: ${smokeReportPath}`,
      );
    }

    const checks = normalizeReleaseSmokeChecks(smokeReport?.checks);
    const passedChecks = new Map(
      checks.map((check) => [check.id, check.status]),
    );
    for (const requiredCheckId of [
      'artifact-checksum',
      'web-index',
      'web-assets',
      'docs-index',
      'docs-404',
      'docs-search-index',
      'public-doc-boundary',
    ]) {
      if (passedChecks.get(requiredCheckId) !== 'passed') {
        throw new Error(
          `Web archive smoke report is missing a passing ${requiredCheckId} check: ${smokeReportPath}`,
        );
      }
    }

    webArchiveSmokeMetadataByManifestPath.set(
      record.file.absolutePath,
      {
        webArchiveSmoke: buildWebArchiveSmokeMetadata({
          releaseAssetsDir,
          manifestPath: record.file.absolutePath,
          smokeReportPath,
          smokeReport,
        }),
      },
    );
  }

  return webArchiveSmokeMetadataByManifestPath;
}

function titleCaseReleaseFamily(family) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();
  if (!normalizedFamily) {
    return 'Release';
  }

  return `${normalizedFamily[0].toUpperCase()}${normalizedFamily.slice(1)}`;
}

function requireDeploymentSmokeReports({
  releaseAssetsDir,
  partialManifestFileName,
  profile,
  releaseTag = '',
} = {}) {
  const deploymentSmokeMetadataByManifestPath = new Map();
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const partialManifestRecords = listPartialManifestRecords(
    releaseAssetsDir,
    partialManifestFileName,
    profile,
  );
  const hasTaggedManifest = normalizedReleaseTag.length > 0
    && partialManifestRecords.some((record) => String(record.manifest?.releaseTag ?? '').trim().length > 0);

  for (const record of partialManifestRecords) {
    const manifest = record.manifest;
    const manifestReleaseTag = String(manifest?.releaseTag ?? '').trim();
    if (hasTaggedManifest && manifestReleaseTag !== normalizedReleaseTag) {
      continue;
    }

    const manifestDir = path.dirname(record.file.absolutePath);
    const relativeManifestDir = path.relative(releaseAssetsDir, manifestDir).replaceAll('\\', '/');
    const [family] = relativeManifestDir.split('/');
    if (family !== 'container' && family !== 'kubernetes') {
      continue;
    }

    const familyLabel = titleCaseReleaseFamily(family);
    const expectedPlatform = String(manifest?.platform ?? '').trim();
    const expectedArch = String(manifest?.arch ?? '').trim();
    const expectedAccelerator = String(
      manifest?.artifacts?.[0]?.accelerator
      ?? relativeManifestDir.split('/')[3]
      ?? '',
    ).trim();
    const expectedArtifactRelativePaths = normalizeReleaseSmokePathArray(
      Array.isArray(manifest?.artifacts)
        ? manifest.artifacts.map((artifact) => artifact?.relativePath)
        : [],
    );
    const smokeReportPath = path.join(
      manifestDir,
      RELEASE_SMOKE_REPORT_FILENAME,
    );

    if (!existsSync(smokeReportPath)) {
      throw new Error(`Missing ${family} deployment smoke report: ${smokeReportPath}`);
    }

    const smokeReport = readReleaseSmokeReport(smokeReportPath);
    if (String(smokeReport?.family ?? '').trim() !== family) {
      throw new Error(
        `${familyLabel} deployment smoke report family mismatch at ${smokeReportPath}: expected ${family}, received ${smokeReport?.family ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.platform ?? '').trim() !== expectedPlatform) {
      throw new Error(
        `${familyLabel} deployment smoke report platform mismatch at ${smokeReportPath}: expected ${expectedPlatform}, received ${smokeReport?.platform ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.arch ?? '').trim() !== expectedArch) {
      throw new Error(
        `${familyLabel} deployment smoke report architecture mismatch at ${smokeReportPath}: expected ${expectedArch}, received ${smokeReport?.arch ?? 'unknown'}`,
      );
    }
    if (String(smokeReport?.accelerator ?? '').trim() !== expectedAccelerator) {
      throw new Error(
        `${familyLabel} deployment smoke report accelerator mismatch at ${smokeReportPath}: expected ${expectedAccelerator}, received ${smokeReport?.accelerator ?? 'unknown'}`,
      );
    }
    const smokeStatus = String(smokeReport?.status ?? '').trim();
    if (smokeStatus !== 'passed' && smokeStatus !== 'skipped') {
      throw new Error(
        `${familyLabel} deployment smoke report must be passed or skipped before finalization: ${smokeReportPath}`,
      );
    }

    const expectedSmokeKind = family === 'container' ? 'live-deployment' : 'chart-render';
    if (String(smokeReport?.smokeKind ?? '').trim() !== expectedSmokeKind) {
      throw new Error(
        `${familyLabel} deployment smoke report must describe ${expectedSmokeKind} verification: ${smokeReportPath}`,
      );
    }
    if (
      path.resolve(String(smokeReport?.manifestPath ?? '').trim() || manifestDir)
      !== path.resolve(record.file.absolutePath)
    ) {
      throw new Error(
        `${familyLabel} deployment smoke report manifest path mismatch at ${smokeReportPath}`,
      );
    }

    const reportedArtifactRelativePaths = normalizeReleaseSmokePathArray(
      smokeReport?.artifactRelativePaths,
    );
    if (
      expectedArtifactRelativePaths.length !== reportedArtifactRelativePaths.length
      || expectedArtifactRelativePaths.some(
        (relativePath, index) => relativePath !== reportedArtifactRelativePaths[index],
      )
    ) {
      throw new Error(
        `${familyLabel} deployment smoke report does not match the current artifact set: ${smokeReportPath}`,
      );
    }
    if (smokeStatus === 'passed') {
      assertSafeSmokeLauncherRelativePath(smokeReport, smokeReportPath);
      if (
        family === 'container'
        && String(smokeReport?.runtimeBaseUrl ?? '').trim().length === 0
      ) {
        throw new Error(
          `${familyLabel} deployment smoke report is missing runtimeBaseUrl: ${smokeReportPath}`,
        );
      }

      const checks = normalizeReleaseSmokeChecks(smokeReport?.checks);
      const passedChecks = new Map(
        checks.map((check) => [check.id, check.status]),
      );
      const requiredCheckIds = family === 'container'
        ? ['deployment-identity', 'runtime-profile', 'manage-credentials', 'persistent-storage', 'docker-compose-up', 'docker-compose-healthy', 'health-ready', 'host-endpoints', 'browser-shell']
        : ['helm-template', 'deployment-identity', 'image-reference', 'configmap-runtime-identity', 'readiness-probe', 'secret-ref', 'persistent-storage'];
      for (const requiredCheckId of requiredCheckIds) {
        if (passedChecks.get(requiredCheckId) !== 'passed') {
          throw new Error(
            `${familyLabel} deployment smoke report is missing a passing ${requiredCheckId} check: ${smokeReportPath}`,
          );
        }
      }
    } else if (String(smokeReport?.skippedReason ?? '').trim().length === 0) {
      throw new Error(
        `${familyLabel} deployment smoke report must include skippedReason when status=skipped: ${smokeReportPath}`,
      );
    }

    deploymentSmokeMetadataByManifestPath.set(
      record.file.absolutePath,
      {
        deploymentSmoke: buildDeploymentSmokeMetadata({
          releaseAssetsDir,
          manifestPath: record.file.absolutePath,
          smokeReportPath,
          smokeReport,
        }),
      },
    );
  }

  return deploymentSmokeMetadataByManifestPath;
}

function buildArtifactIndex(
  releaseAssetsDir,
  partialManifestFileName,
  profile,
  releaseTag = '',
  artifactMetadataByManifestPath = new Map(),
) {
  const files = listFilesRecursively(releaseAssetsDir);
  const partialManifestFiles = files.filter((file) => file.relativePath.endsWith(`/${partialManifestFileName}`) || file.relativePath === partialManifestFileName);
  const assetFiles = files.filter((file) => (
    !file.relativePath.endsWith(`/${partialManifestFileName}`)
    && file.relativePath !== partialManifestFileName
    && path.posix.basename(file.relativePath) !== DESKTOP_INSTALLER_SMOKE_REPORT_FILENAME
    && path.posix.basename(file.relativePath) !== RELEASE_SMOKE_REPORT_FILENAME
    && !file.relativePath.endsWith('.sha256.txt')
    && path.posix.basename(file.relativePath) !== 'SHA256SUMS.txt'
    && path.posix.basename(file.relativePath) !== 'release-manifest.json'
  ));

  const assetFilesByRelativePath = new Map(
    assetFiles.map((file) => [file.relativePath, file]),
  );
  const partialManifestRecords = partialManifestFiles.map((file) => {
    const manifest = readPartialManifest(file.absolutePath);
    validatePartialReleaseAssetManifest({
      manifest,
      manifestPath: file.absolutePath,
      profile,
    });

    return {
      file,
      manifest,
    };
  });
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const hasTaggedManifest = normalizedReleaseTag.length > 0
    && partialManifestRecords.some((record) => String(record.manifest?.releaseTag ?? '').trim().length > 0);
  const artifacts = [];

  for (const partialManifestRecord of partialManifestRecords) {
    const partialManifest = partialManifestRecord.manifest;
    const partialManifestReleaseTag = String(partialManifest?.releaseTag ?? '').trim();
    if (hasTaggedManifest && partialManifestReleaseTag !== normalizedReleaseTag) {
      for (const artifact of partialManifest.artifacts ?? []) {
        const relativePath = normalizeReleaseRelativePath(artifact?.relativePath);
        if (relativePath.length > 0) {
          assetFilesByRelativePath.delete(relativePath);
        }
      }
      continue;
    }

    for (const artifact of partialManifest.artifacts ?? []) {
      const relativePath = normalizeReleaseRelativePath(artifact?.relativePath);
      const assetFile = assetFilesByRelativePath.get(relativePath);
      if (!assetFile) {
        continue;
      }

      const assetStat = statSync(assetFile.absolutePath);
      const packageProfileArtifactMetadata = buildPackageProfileArtifactMetadata(partialManifest);
      const artifactMetadata = artifactMetadataByManifestPath.get(
        partialManifestRecord.file.absolutePath,
      );
      artifacts.push(normalizeArtifactRecord({
        ...artifact,
        ...packageProfileArtifactMetadata,
        ...(artifactMetadata ?? {}),
        sha256: computeSha256(assetFile.absolutePath),
        size: assetStat.size,
      }, assetFile.relativePath));
      assetFilesByRelativePath.delete(assetFile.relativePath);
    }
  }

  for (const remainingAssetFile of assetFilesByRelativePath.values()) {
    if (!isFallbackArtifactEligible(remainingAssetFile.relativePath, normalizedReleaseTag)) {
      continue;
    }

    const assetStat = statSync(remainingAssetFile.absolutePath);
    artifacts.push(normalizeArtifactRecord({
      name: path.posix.basename(remainingAssetFile.relativePath),
      sha256: computeSha256(remainingAssetFile.absolutePath),
      size: assetStat.size,
    }, remainingAssetFile.relativePath));
  }

  return artifacts.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
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
      `Finalized release would contain artifacts outside the active release profile: ${outOfProfileArtifactPaths.join(', ')}`,
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
        'Finalized release would contain multiple artifacts for the same release target:',
        ...duplicateTargetEntries.map((entry) => `${entry.target}=[${entry.artifactPaths.join(', ')}]`),
      ].join(' '),
    );
  }
}

function normalizeArtifactRecord(artifact, relativePath) {
  const inferredMetadata = inferArtifactMetadata(relativePath);

  return {
    ...artifact,
    relativePath,
    family: artifact.family ?? inferredMetadata.family,
    platform: resolveArtifactPlatform(artifact.platform, inferredMetadata.platform),
    arch: resolveArtifactArch(artifact.arch, inferredMetadata.arch),
    accelerator: artifact.accelerator ?? inferredMetadata.accelerator,
    kind: artifact.kind ?? inferArtifactKind(relativePath),
  };
}

function inferArtifactMetadata(relativePath) {
  return {
    family: inferFamily(relativePath),
    platform: inferPlatformId(relativePath),
    arch: inferArchId(relativePath),
    accelerator: inferAccelerator(relativePath),
  };
}

function resolveArtifactPlatform(platform, inferredPlatform) {
  if (platform === undefined || platform === null || platform === '' || platform === 'unknown') {
    return inferredPlatform;
  }
  return platform;
}

function resolveArtifactArch(arch, inferredArch) {
  if (arch === undefined || arch === null || arch === '') {
    return inferredArch;
  }
  if (arch === 'any' && inferredArch !== 'any') {
    return inferredArch;
  }
  return arch;
}

function inferFamily(relativePath) {
  const [family] = relativePath.split('/');
  if (family === 'desktop' || family === 'web' || family === 'server' || family === 'container' || family === 'kubernetes') {
    return family;
  }
  return undefined;
}

function inferPlatformId(relativePath) {
  const segments = relativePath.split('/');
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
  return 'unknown';
}

function inferArchId(relativePath) {
  const segments = relativePath.split('/');
  if (segments[0] === 'desktop' && segments.length >= 3) {
    return segments[2];
  }
  if (segments[0] === 'server' && segments.length >= 3) {
    return segments[2];
  }
  if ((segments[0] === 'container' || segments[0] === 'kubernetes') && segments.length >= 4) {
    return segments[2];
  }
  return 'any';
}

function inferAccelerator(relativePath) {
  const segments = relativePath.split('/');
  if ((segments[0] === 'container' || segments[0] === 'kubernetes') && segments.length >= 5) {
    return segments[3];
  }
  return undefined;
}

function inferArtifactKind(relativePath) {
  const lowerCasePath = relativePath.toLowerCase();
  if (lowerCasePath.endsWith('.exe') || lowerCasePath.endsWith('.msi') || lowerCasePath.endsWith('.dmg')) {
    return 'installer';
  }
  if (lowerCasePath.endsWith('.deb') || lowerCasePath.endsWith('.rpm') || lowerCasePath.endsWith('.appimage')) {
    return 'package';
  }
  return 'archive';
}

function isFallbackArtifactEligible(relativePath, releaseTag = '') {
  const segments = relativePath.split('/');
  const family = inferFamily(relativePath);
  const normalizedReleaseTag = String(releaseTag ?? '').trim();

  if (!family) {
    return false;
  }
  if (normalizedReleaseTag.length > 0 && !relativePath.includes(normalizedReleaseTag)) {
    return false;
  }

  if (family === 'desktop') {
    return (
      segments.length >= 4
      && supportedDesktopPlatforms.has(segments[1])
      && supportedArchIds.has(segments[2])
    );
  }

  if (family === 'server') {
    return (
      segments.length >= 4
      && supportedServerPlatforms.has(segments[1])
      && supportedArchIds.has(segments[2])
    );
  }

  if (family === 'container' || family === 'kubernetes') {
    return (
      segments.length >= 5
      && supportedDeploymentPlatforms.has(segments[1])
      && supportedArchIds.has(segments[2])
      && supportedAccelerators.has(segments[3])
    );
  }

  if (family === 'web') {
    return segments.length >= 2;
  }

  return false;
}

function assertReleaseCoverageComplete({
  profile,
  releaseCoverage,
}) {
  if (releaseCoverage.status === 'complete') {
    return;
  }

  throw new Error(
    [
      `Incomplete release asset coverage for profile "${profile.id}".`,
      `Missing targets: ${releaseCoverage.missingTargets.join(', ')}`,
      'Run every release matrix packaging job before finalization, or pass --allow-partial-release only for explicit local/debug aggregation.',
    ].join(' '),
  );
}

function writeGlobalChecksumManifest({
  releaseAssetsDir,
  fileName,
  subjects,
}) {
  const outputPath = path.join(releaseAssetsDir, fileName);
  const checksumLines = subjects
    .map((subject) => `${subject.sha256}  ${subject.relativePath}`)
    .join('\n');

  writeFileSync(outputPath, `${checksumLines}\n`, 'utf8');
}

function removePackagingChecksumSidecars({
  releaseAssetsDir,
  subjects,
}) {
  for (const subject of subjects) {
    const relativePath = normalizeReleaseRelativePath(subject?.relativePath);
    if (!relativePath) {
      continue;
    }

    assertSafeReleaseRelativePath(relativePath, {
      contextLabel: 'Release finalizer checksum sidecar cleanup',
      artifactPathLabel: 'release subject path',
    });
    rmSync(path.join(releaseAssetsDir, `${relativePath}.sha256.txt`), { force: true });
  }
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

function buildReleaseMetadata({
  releaseAssetsDir,
}) {
  assertReleaseTopLevelFileName(RELEASE_NOTES_FILE_NAME, 'required release metadata file name');
  const releaseNotesPath = path.join(releaseAssetsDir, RELEASE_NOTES_FILE_NAME);

  if (!existsSync(releaseNotesPath)) {
    throw new Error(`Missing required release metadata file: ${RELEASE_NOTES_FILE_NAME}`);
  }

  const releaseNotesStat = statSync(releaseNotesPath);
  if (!releaseNotesStat.isFile()) {
    throw new Error(`Required release metadata file is not a file: ${RELEASE_NOTES_FILE_NAME}`);
  }

  return [
    {
      kind: 'release-notes',
      purpose: 'github-release-body',
      relativePath: RELEASE_NOTES_FILE_NAME,
      sha256: computeSha256(releaseNotesPath),
      size: releaseNotesStat.size,
      required: true,
    },
  ];
}

function writeFileChecksumSidecar({
  sourcePath,
  sourceFileName,
  sidecarPath,
}) {
  writeFileSync(
    sidecarPath,
    `${computeSha256(sourcePath)}  ${sourceFileName}\n`,
    'utf8',
  );
}

function removeStaleFinalizedReleaseOutputs({
  releaseAssetsDir,
  profile,
}) {
  for (const fileName of [
    profile.release.manifestFileName,
    profile.release.manifestChecksumFileName,
    profile.release.attestationEvidenceFileName,
    profile.release.globalChecksumsFileName,
  ].filter(Boolean)) {
    rmSync(path.join(releaseAssetsDir, fileName), { force: true });
  }
}

function writeReleaseManifest({
  releaseAssetsDir,
  fileName,
  profile,
  releaseTag,
  repository,
  releaseCoverage,
  releaseMetadata,
  artifacts,
}) {
  const outputPath = path.join(releaseAssetsDir, fileName);
  writeFileSync(
    outputPath,
    `${JSON.stringify({
      profileId: profile.id,
      productName: profile.productName,
      releaseTag,
      repository,
      generatedAt: new Date().toISOString(),
      checksumFileName: profile.release.globalChecksumsFileName,
      attestationEnabled: profile.release.enableArtifactAttestations,
      attestationEvidenceFileName: profile.release.attestationEvidenceFileName,
      attestationPredicateType: profile.release.attestationPredicateType,
      releaseCoverage,
      releaseMetadata,
      verification: repository
        ? {
            checksumCommand: `sha256sum -c ${profile.release.globalChecksumsFileName}`,
            attestationCommand: `gh attestation verify <asset-path> -R ${repository}`,
          }
        : undefined,
      artifacts,
    }, null, 2)}\n`,
    'utf8',
  );

  return outputPath;
}

export function finalizeReleaseAssets({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag,
  repository = '',
  releaseAssetsDir = path.resolve('release-assets'),
  workspaceRootDir = rootDir,
  allowPartialRelease = false,
} = {}) {
  const profile = resolveReleaseProfile(profileId);
  const normalizedReleaseTag = String(releaseTag ?? '').trim();

  if (!normalizedReleaseTag) {
    throw new Error('releaseTag is required to finalize release assets.');
  }
  if (!existsSync(releaseAssetsDir)) {
    throw new Error(`Missing release assets directory: ${releaseAssetsDir}`);
  }

  mkdirSync(releaseAssetsDir, { recursive: true });
  removeStaleFinalizedReleaseOutputs({
    releaseAssetsDir,
    profile,
  });
  const desktopInstallerMetadataByManifestPath = requireDesktopInstallerSmokeReports({
    workspaceRootDir,
    releaseAssetsDir,
    partialManifestFileName: profile.release.partialManifestFileName,
    profile,
    releaseTag: normalizedReleaseTag,
  });
  const serverBundleSmokeMetadataByManifestPath = requireServerBundleSmokeReports({
    releaseAssetsDir,
    partialManifestFileName: profile.release.partialManifestFileName,
    profile,
    releaseTag: normalizedReleaseTag,
  });
  const webArchiveSmokeMetadataByManifestPath = requireWebArchiveSmokeReports({
    releaseAssetsDir,
    partialManifestFileName: profile.release.partialManifestFileName,
    profile,
    releaseTag: normalizedReleaseTag,
  });
  const desktopStartupMetadataByManifestPath = requireDesktopStartupSmokeReports({
    releaseAssetsDir,
    partialManifestFileName: profile.release.partialManifestFileName,
    profile,
    releaseTag: normalizedReleaseTag,
  });
  const deploymentSmokeMetadataByManifestPath = requireDeploymentSmokeReports({
    releaseAssetsDir,
    partialManifestFileName: profile.release.partialManifestFileName,
    profile,
    releaseTag: normalizedReleaseTag,
  });
  const artifactMetadataByManifestPath = new Map();
  for (const [manifestPath, metadata] of desktopInstallerMetadataByManifestPath.entries()) {
    artifactMetadataByManifestPath.set(manifestPath, metadata);
  }
  for (const [manifestPath, metadata] of serverBundleSmokeMetadataByManifestPath.entries()) {
    artifactMetadataByManifestPath.set(
      manifestPath,
      {
        ...(artifactMetadataByManifestPath.get(manifestPath) ?? {}),
        ...metadata,
      },
    );
  }
  for (const [manifestPath, metadata] of webArchiveSmokeMetadataByManifestPath.entries()) {
    artifactMetadataByManifestPath.set(
      manifestPath,
      {
        ...(artifactMetadataByManifestPath.get(manifestPath) ?? {}),
        ...metadata,
      },
    );
  }
  for (const [manifestPath, metadata] of desktopStartupMetadataByManifestPath.entries()) {
    artifactMetadataByManifestPath.set(
      manifestPath,
      {
        ...(artifactMetadataByManifestPath.get(manifestPath) ?? {}),
        ...metadata,
      },
    );
  }
  for (const [manifestPath, metadata] of deploymentSmokeMetadataByManifestPath.entries()) {
    artifactMetadataByManifestPath.set(
      manifestPath,
      {
        ...(artifactMetadataByManifestPath.get(manifestPath) ?? {}),
        ...metadata,
      },
    );
  }
  const artifacts = buildArtifactIndex(
    releaseAssetsDir,
    profile.release.partialManifestFileName,
    profile,
    normalizedReleaseTag,
    artifactMetadataByManifestPath,
  );
  if (artifacts.length === 0) {
    throw new Error(`No release assets found under ${releaseAssetsDir}`);
  }
  assertArtifactsWithinActiveReleaseProfile({
    artifacts,
    profile,
  });
  assertNoDuplicateArtifactsForReleaseTargets({
    artifacts,
    profile,
  });
  const releaseCoverage = buildReleaseCoverage({
    profile,
    artifacts,
    allowPartialRelease,
  });
  if (!allowPartialRelease) {
    assertReleaseCoverageComplete({
      profile,
      releaseCoverage,
    });
  }
  const releaseMetadata = buildReleaseMetadata({
    releaseAssetsDir,
  });
  removePackagingChecksumSidecars({
    releaseAssetsDir,
    subjects: [...artifacts, ...releaseMetadata],
  });

  writeGlobalChecksumManifest({
    releaseAssetsDir,
    fileName: profile.release.globalChecksumsFileName,
    subjects: [...artifacts, ...releaseMetadata],
  });
  const manifestPath = writeReleaseManifest({
    releaseAssetsDir,
    fileName: profile.release.manifestFileName,
    profile,
    releaseTag: normalizedReleaseTag,
    repository: String(repository ?? '').trim(),
    releaseCoverage,
    releaseMetadata,
    artifacts,
  });
  writeFileChecksumSidecar({
    sourcePath: manifestPath,
    sourceFileName: profile.release.manifestFileName,
    sidecarPath: path.join(releaseAssetsDir, profile.release.manifestChecksumFileName),
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  finalizeReleaseAssets(options);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
