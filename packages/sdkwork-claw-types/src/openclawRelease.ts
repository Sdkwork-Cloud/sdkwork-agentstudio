import {
  resolveKernelReleaseConfig,
  type KernelReleaseConfig,
} from './kernelReleaseCatalog.ts';

export interface OpenClawReleaseSupplementalPackageException {
  spec: string;
  reason: string;
  reviewedAt: string;
}

export interface OpenClawReleaseMetadata {
  stableVersion: string;
  nodeVersion: string;
  packageName: string;
  runtimeSupplementalPackages: string[];
  runtimeSupplementalPackageExceptions: OpenClawReleaseSupplementalPackageException[];
}

interface OpenClawKernelReleaseConfig extends KernelReleaseConfig {
  nodeVersion: string;
  packageName: string;
  runtimeSupplementalPackages?: string[];
  runtimeSupplementalPackageExceptions?: OpenClawReleaseSupplementalPackageException[];
}

const metadata = resolveKernelReleaseConfig('openclaw') as OpenClawKernelReleaseConfig;
const releaseConfigPath = 'config/kernel-releases/openclaw.json';

function splitPackageSpec(spec: string): { name: string; version: string } {
  const normalized = String(spec ?? '').trim();
  const versionSeparatorIndex = normalized.lastIndexOf('@');
  if (versionSeparatorIndex <= 0) {
    return {
      name: normalized,
      version: '',
    };
  }

  return {
    name: normalized.slice(0, versionSeparatorIndex),
    version: normalized.slice(versionSeparatorIndex + 1),
  };
}

function normalizeRuntimeSupplementalPackages(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
}

function normalizeRuntimeSupplementalPackageExceptions(
  value: OpenClawReleaseSupplementalPackageException[] | null | undefined,
): OpenClawReleaseSupplementalPackageException[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => ({
      spec: String(entry?.spec ?? '').trim(),
      reason: String(entry?.reason ?? '').trim(),
      reviewedAt: String(entry?.reviewedAt ?? '').trim(),
    }))
    .filter((entry) => entry.spec);
}

function isRuntimeSupplementalPackageUnstable(spec: string): boolean {
  const { version } = splitPackageSpec(spec);
  return /^0\./.test(version) || /(?:^|[-.])(alpha|beta|rc)(?:[-.\d]|$)/i.test(version);
}

function validateRuntimeSupplementalPackageExceptions(
  specs: string[],
  exceptions: OpenClawReleaseSupplementalPackageException[],
): void {
  const configuredSpecs = new Set(specs);
  const exceptionBySpec = new Map<string, OpenClawReleaseSupplementalPackageException>();

  for (const exception of exceptions) {
    if (!exception.reason) {
      throw new Error(
        `[openclaw-release] Supplemental package exception "${exception.spec}" is missing a non-empty reason in ${releaseConfigPath}.`,
      );
    }
    if (!exception.reviewedAt || !/^\d{4}-\d{2}-\d{2}$/u.test(exception.reviewedAt)) {
      throw new Error(
        `[openclaw-release] Supplemental package exception "${exception.spec}" must use reviewedAt in YYYY-MM-DD format in ${releaseConfigPath}.`,
      );
    }
    if (exceptionBySpec.has(exception.spec)) {
      throw new Error(
        `[openclaw-release] Supplemental package exception "${exception.spec}" is duplicated in ${releaseConfigPath}.`,
      );
    }
    exceptionBySpec.set(exception.spec, exception);
  }

  const unapprovedUnstableSpecs = specs.filter(
    (spec) => isRuntimeSupplementalPackageUnstable(spec) && !exceptionBySpec.has(spec),
  );
  if (unapprovedUnstableSpecs.length > 0) {
    throw new Error(
      `[openclaw-release] Unstable supplemental package(s) require explicit exceptions in ${releaseConfigPath}: ${unapprovedUnstableSpecs.join(', ')}`,
    );
  }

  const orphanedExceptions = exceptions
    .map((exception) => exception.spec)
    .filter((spec) => !configuredSpecs.has(spec));
  if (orphanedExceptions.length > 0) {
    throw new Error(
      `[openclaw-release] Supplemental package exception(s) do not match runtimeSupplementalPackages in ${releaseConfigPath}: ${orphanedExceptions.join(', ')}`,
    );
  }
}

const normalizedSupplementalPackages = normalizeRuntimeSupplementalPackages(
  metadata.runtimeSupplementalPackages,
);
const normalizedSupplementalPackageExceptions = normalizeRuntimeSupplementalPackageExceptions(
  metadata.runtimeSupplementalPackageExceptions,
);
validateRuntimeSupplementalPackageExceptions(
  normalizedSupplementalPackages,
  normalizedSupplementalPackageExceptions,
);

export const OPENCLAW_RELEASE: Readonly<OpenClawReleaseMetadata> = Object.freeze({
  stableVersion: metadata.stableVersion,
  nodeVersion: metadata.nodeVersion,
  packageName: metadata.packageName,
  runtimeSupplementalPackages: normalizedSupplementalPackages,
  runtimeSupplementalPackageExceptions: normalizedSupplementalPackageExceptions,
});

/**
 * Shared OpenClaw release constants pinned to the central release config.
 *
 * OpenClaw payload constants use bundled naming because the application ships
 * OpenClaw code assets. Node.js is external-only, so its shared constant uses
 * `DEFAULT_REQUIRED_OPENCLAW_NODE_VERSION`.
 */
export const DEFAULT_BUNDLED_OPENCLAW_VERSION = OPENCLAW_RELEASE.stableVersion;
export const DEFAULT_REQUIRED_OPENCLAW_NODE_VERSION = OPENCLAW_RELEASE.nodeVersion;
export const DEFAULT_BUNDLED_OPENCLAW_PACKAGE_NAME = OPENCLAW_RELEASE.packageName;
export const DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES =
  OPENCLAW_RELEASE.runtimeSupplementalPackages;
export const DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGE_EXCEPTIONS =
  OPENCLAW_RELEASE.runtimeSupplementalPackageExceptions;
