import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveKernelReleaseConfig,
  resolveKernelReleaseConfigPath,
} from './release/kernel-releases.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const releaseConfigPath = resolveKernelReleaseConfigPath('openclaw', {
  workspaceRootDir: rootDir,
});

export function loadOpenClawReleaseConfig({
  workspaceRootDir = rootDir,
  readFileImpl = (filePath) => fs.readFileSync(filePath, 'utf8'),
} = {}) {
  return resolveKernelReleaseConfig('openclaw', {
    workspaceRootDir,
    readFileImpl,
  });
}

function splitPackageSpec(spec) {
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

function normalizeRuntimeSupplementalPackages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
}

function normalizeRuntimeSupplementalPackageExceptions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const record = entry && typeof entry === 'object' ? entry : {};
      return {
        spec: String(record.spec ?? '').trim(),
        reason: String(record.reason ?? '').trim(),
        reviewedAt: String(record.reviewedAt ?? '').trim(),
      };
    })
    .filter((entry) => entry.spec);
}

function isRuntimeSupplementalPackageUnstable(spec) {
  const { version } = splitPackageSpec(spec);
  return /^0\./.test(version) || /(?:^|[-.])(alpha|beta|rc)(?:[-.\d]|$)/i.test(version);
}

export function validateRuntimeSupplementalPackageExceptions(
  specs,
  exceptions,
  {
    releaseConfigPath: resolvedReleaseConfigPath = releaseConfigPath,
  } = {},
) {
  const configuredSpecs = new Set(specs);
  const exceptionBySpec = new Map();

  for (const exception of exceptions) {
    if (!exception.reason) {
      throw new Error(
        `[openclaw-release] Supplemental package exception "${exception.spec}" is missing a non-empty reason in ${resolvedReleaseConfigPath}.`,
      );
    }
    if (!exception.reviewedAt || !/^\d{4}-\d{2}-\d{2}$/u.test(exception.reviewedAt)) {
      throw new Error(
        `[openclaw-release] Supplemental package exception "${exception.spec}" must use reviewedAt in YYYY-MM-DD format in ${resolvedReleaseConfigPath}.`,
      );
    }
    if (exceptionBySpec.has(exception.spec)) {
      throw new Error(
        `[openclaw-release] Supplemental package exception "${exception.spec}" is duplicated in ${resolvedReleaseConfigPath}.`,
      );
    }
    exceptionBySpec.set(exception.spec, exception);
  }

  const unapprovedUnstableSpecs = specs.filter(
    (spec) => isRuntimeSupplementalPackageUnstable(spec) && !exceptionBySpec.has(spec),
  );
  if (unapprovedUnstableSpecs.length > 0) {
    throw new Error(
      `[openclaw-release] Unstable supplemental package(s) require explicit exceptions in ${resolvedReleaseConfigPath}: ${unapprovedUnstableSpecs.join(', ')}`,
    );
  }

  const orphanedExceptions = exceptions
    .map((exception) => exception.spec)
    .filter((spec) => !configuredSpecs.has(spec));
  if (orphanedExceptions.length > 0) {
    throw new Error(
      `[openclaw-release] Supplemental package exception(s) do not match runtimeSupplementalPackages in ${resolvedReleaseConfigPath}: ${orphanedExceptions.join(', ')}`,
    );
  }
}

const releaseConfig = loadOpenClawReleaseConfig({ workspaceRootDir: rootDir });
const normalizedSupplementalPackages = normalizeRuntimeSupplementalPackages(
  releaseConfig.runtimeSupplementalPackages,
);
const normalizedSupplementalPackageExceptions = normalizeRuntimeSupplementalPackageExceptions(
  releaseConfig.runtimeSupplementalPackageExceptions,
);
validateRuntimeSupplementalPackageExceptions(
  normalizedSupplementalPackages,
  normalizedSupplementalPackageExceptions,
);

export const OPENCLAW_RELEASE = Object.freeze({
  stableVersion: String(releaseConfig.stableVersion ?? '').trim(),
  nodeVersion: String(releaseConfig.nodeVersion ?? '').trim(),
  packageName: String(releaseConfig.packageName ?? '').trim(),
  runtimeSupplementalPackages: normalizedSupplementalPackages,
  runtimeSupplementalPackageExceptions: normalizedSupplementalPackageExceptions,
});

if (!OPENCLAW_RELEASE.stableVersion) {
  throw new Error(`openclaw release config missing stableVersion: ${releaseConfigPath}`);
}
if (!OPENCLAW_RELEASE.nodeVersion) {
  throw new Error(`openclaw release config missing nodeVersion: ${releaseConfigPath}`);
}
if (!OPENCLAW_RELEASE.packageName) {
  throw new Error(`openclaw release config missing packageName: ${releaseConfigPath}`);
}

export const DEFAULT_OPENCLAW_VERSION = OPENCLAW_RELEASE.stableVersion;
export const DEFAULT_NODE_VERSION = OPENCLAW_RELEASE.nodeVersion;
export const DEFAULT_OPENCLAW_PACKAGE = OPENCLAW_RELEASE.packageName;
export const DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES =
  OPENCLAW_RELEASE.runtimeSupplementalPackages;
export const DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGE_EXCEPTIONS =
  OPENCLAW_RELEASE.runtimeSupplementalPackageExceptions;

/**
 * Bundled aliases aligned with packages/sdkwork-claw-types/src/openclawRelease.ts naming.
 * OpenClaw payload constants keep the `BUNDLED_` prefix in script-facing aliases.
 * Node.js uses `DEFAULT_REQUIRED_OPENCLAW_NODE_VERSION` because it is external-only.
 */
export const DEFAULT_BUNDLED_OPENCLAW_VERSION = DEFAULT_OPENCLAW_VERSION;
export const DEFAULT_REQUIRED_OPENCLAW_NODE_VERSION = DEFAULT_NODE_VERSION;
export const DEFAULT_BUNDLED_OPENCLAW_PACKAGE_NAME = DEFAULT_OPENCLAW_PACKAGE;
export const DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES =
  DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGES;
export const DEFAULT_BUNDLED_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGE_EXCEPTIONS =
  DEFAULT_OPENCLAW_RUNTIME_SUPPLEMENTAL_PACKAGE_EXCEPTIONS;
