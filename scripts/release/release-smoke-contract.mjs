import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  normalizeDesktopArch,
  normalizeDesktopPlatform,
} from './desktop-targets.mjs';
import {
  assertSafeReleaseRelativePath,
  normalizeReleaseRelativePath,
} from './release-paths.mjs';

export const RELEASE_SMOKE_REPORT_FILENAME = 'release-smoke-report.json';

const SUPPORTED_RELEASE_SMOKE_FAMILIES = new Set([
  'web',
  'server',
  'container',
  'kubernetes',
]);
const SUPPORTED_RELEASE_SMOKE_STATUSES = new Set([
  'passed',
  'failed',
  'skipped',
]);
const SUPPORTED_DEPLOYMENT_ACCELERATORS = new Set([
  'cpu',
  'nvidia-cuda',
  'amd-rocm',
]);

function normalizeStringArray(values) {
  return Array.isArray(values)
    ? values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
}

export function normalizeReleaseSmokeRelativePath(value, {
  contextLabel,
  pathLabel,
  allowEmpty = false,
} = {}) {
  const relativePath = normalizeReleaseRelativePath(value);
  if (!relativePath && allowEmpty) {
    return '';
  }

  assertSafeReleaseRelativePath(relativePath, {
    contextLabel,
    artifactPathLabel: pathLabel,
  });

  return relativePath;
}

export function normalizeReleaseSmokeRelativePathArray(values, {
  contextLabel,
  pathLabel,
} = {}) {
  return Array.isArray(values)
    ? values
      .map((value) => normalizeReleaseSmokeRelativePath(value, {
        contextLabel,
        pathLabel,
      }))
      .sort((left, right) => left.localeCompare(right))
    : [];
}

export function normalizeReleaseSmokeFamily(family) {
  const normalizedFamily = String(family ?? '').trim().toLowerCase();
  if (!SUPPORTED_RELEASE_SMOKE_FAMILIES.has(normalizedFamily)) {
    throw new Error(`Unsupported release smoke family: ${family}`);
  }

  return normalizedFamily;
}

export function normalizeReleaseSmokeStatus(status) {
  const normalizedStatus = String(status ?? '').trim().toLowerCase();
  if (!SUPPORTED_RELEASE_SMOKE_STATUSES.has(normalizedStatus)) {
    throw new Error(`Unsupported release smoke status: ${status}`);
  }

  return normalizedStatus;
}

export function normalizeReleaseSmokeAccelerator(accelerator, family) {
  const normalizedFamily = normalizeReleaseSmokeFamily(family);
  if (normalizedFamily === 'web' || normalizedFamily === 'server') {
    return '';
  }

  const normalizedAccelerator = String(accelerator ?? '').trim().toLowerCase() || 'cpu';
  if (!SUPPORTED_DEPLOYMENT_ACCELERATORS.has(normalizedAccelerator)) {
    throw new Error(`Unsupported deployment accelerator for release smoke: ${accelerator}`);
  }

  return normalizedAccelerator;
}

function normalizeReleaseSmokePlatform(platform, family) {
  const normalizedFamily = normalizeReleaseSmokeFamily(family);
  if (normalizedFamily === 'web') {
    return 'web';
  }

  return normalizeDesktopPlatform(platform);
}

function normalizeReleaseSmokeArch(arch, family) {
  const normalizedFamily = normalizeReleaseSmokeFamily(family);
  if (normalizedFamily === 'web') {
    return 'any';
  }

  return normalizeDesktopArch(arch);
}

export function normalizeReleaseSmokeChecks(values) {
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

export function resolveReleaseSmokeReportPath({
  releaseAssetsDir,
  family,
  platform,
  arch,
  accelerator = '',
} = {}) {
  const normalizedFamily = normalizeReleaseSmokeFamily(family);
  const normalizedPlatform = normalizeReleaseSmokePlatform(platform, normalizedFamily);
  const normalizedArch = normalizeReleaseSmokeArch(arch, normalizedFamily);

  if (normalizedFamily === 'web') {
    return path.join(
      releaseAssetsDir,
      normalizedFamily,
      RELEASE_SMOKE_REPORT_FILENAME,
    );
  }

  if (normalizedFamily === 'server') {
    return path.join(
      releaseAssetsDir,
      normalizedFamily,
      normalizedPlatform,
      normalizedArch,
      RELEASE_SMOKE_REPORT_FILENAME,
    );
  }

  return path.join(
    releaseAssetsDir,
    normalizedFamily,
    normalizedPlatform,
    normalizedArch,
    normalizeReleaseSmokeAccelerator(accelerator, normalizedFamily),
    RELEASE_SMOKE_REPORT_FILENAME,
  );
}

export function buildReleaseSmokeReport({
  family,
  platform,
  arch,
  accelerator = '',
  target = '',
  smokeKind = '',
  status,
  manifestPath = '',
  artifactRelativePaths = [],
  launcherRelativePath = '',
  runtimeBaseUrl = '',
  skippedReason = '',
  capabilities = undefined,
  checks = [],
  verifiedAt = new Date().toISOString(),
} = {}) {
  const normalizedFamily = normalizeReleaseSmokeFamily(family);
  const report = {
    family: normalizedFamily,
    platform: normalizeReleaseSmokePlatform(platform, normalizedFamily),
    arch: normalizeReleaseSmokeArch(arch, normalizedFamily),
    target: String(target ?? '').trim(),
    smokeKind: String(smokeKind ?? '').trim(),
    status: normalizeReleaseSmokeStatus(status),
    verifiedAt: String(verifiedAt ?? '').trim() || new Date().toISOString(),
    manifestPath: String(manifestPath ?? '').trim().length > 0
      ? path.resolve(manifestPath)
      : '',
    artifactRelativePaths: normalizeReleaseSmokeRelativePathArray(artifactRelativePaths, {
      contextLabel: 'Release smoke report',
      pathLabel: 'release smoke artifact path',
    }),
    launcherRelativePath: normalizeReleaseSmokeRelativePath(launcherRelativePath, {
      contextLabel: 'Release smoke report',
      pathLabel: 'release smoke launcher path',
      allowEmpty: true,
    }),
    runtimeBaseUrl: String(runtimeBaseUrl ?? '').trim(),
    checks: normalizeReleaseSmokeChecks(checks),
  };

  if (normalizedFamily !== 'web' && normalizedFamily !== 'server') {
    report.accelerator = normalizeReleaseSmokeAccelerator(accelerator, normalizedFamily);
  }
  if (String(skippedReason ?? '').trim().length > 0) {
    report.skippedReason = String(skippedReason).trim();
  }
  if (capabilities && typeof capabilities === 'object' && !Array.isArray(capabilities)) {
    report.capabilities = capabilities;
  }

  return report;
}

export function writeReleaseSmokeReport({
  releaseAssetsDir,
  ...reportOptions
} = {}) {
  const report = buildReleaseSmokeReport(reportOptions);
  const reportPath = resolveReleaseSmokeReportPath({
    releaseAssetsDir,
    family: report.family,
    platform: report.platform,
    arch: report.arch,
    accelerator: report.accelerator,
  });
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return {
    reportPath,
    report,
  };
}

export function readReleaseSmokeReport(reportPath) {
  if (!existsSync(reportPath)) {
    throw new Error(`Missing release smoke report: ${reportPath}`);
  }

  return JSON.parse(readFileSync(reportPath, 'utf8'));
}
