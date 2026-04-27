#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  normalizeDesktopArch,
  normalizeDesktopPlatform,
  resolveDesktopReleaseTarget,
} from './desktop-targets.mjs';
import {
  CAPTURED_DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH,
  DESKTOP_STARTUP_SMOKE_REPORT_FILENAME,
  normalizeDesktopStartupSmokeLocalAiProxyRuntime,
  normalizeDesktopStartupSmokeChecks,
  resolveCapturedDesktopStartupEvidencePath,
  resolveDesktopStartupSmokeReportPath,
} from './desktop-startup-smoke-contract.mjs';
import {
  readDesktopReleaseAssetManifest,
} from './smoke-desktop-installers.mjs';
import {
  resolveCliPath,
} from './path-inputs.mjs';

export {
  CAPTURED_DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH,
  DESKTOP_STARTUP_SMOKE_REPORT_FILENAME,
  normalizeDesktopStartupSmokeChecks,
  resolveCapturedDesktopStartupEvidencePath,
  resolveDesktopStartupSmokeReportPath,
} from './desktop-startup-smoke-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const DEFAULT_RELEASE_ASSETS_DIR = path.join(rootDir, 'artifacts', 'release');
const CANONICAL_BUILT_IN_OPENCLAW_INSTANCE_ID = 'managed-openclaw-primary';

function manifestIncludesKernel(manifest, kernelId) {
  const normalizedKernelId = String(kernelId ?? '').trim().toLowerCase();
  if (!normalizedKernelId) {
    return false;
  }

  if (!Array.isArray(manifest?.includedKernelIds)) {
    return normalizedKernelId === 'openclaw';
  }

  return manifest.includedKernelIds.some(
    (value) => String(value ?? '').trim().toLowerCase() === normalizedKernelId,
  );
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function normalizeArtifactRelativePaths(manifest) {
  return Array.isArray(manifest?.artifacts)
    ? manifest.artifacts
      .map((artifact) => String(artifact?.relativePath ?? '').trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
    : [];
}

function normalizeManifestString(value) {
  return String(value ?? '').trim();
}

function normalizeManifestStringArray(values) {
  return Array.isArray(values)
    ? values.map((value) => normalizeManifestString(value)).filter(Boolean)
    : [];
}

function assertDesktopManifestMatchesTarget({
  manifest,
  manifestPath,
  platform,
  arch,
}) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Desktop release asset manifest must be a JSON object: ${manifestPath}`);
  }
  if (!Array.isArray(manifest.artifacts)) {
    throw new Error(`Desktop release asset manifest is missing artifacts[]: ${manifestPath}`);
  }
  if (String(manifest.platform ?? '').trim() !== platform) {
    throw new Error(
      `Desktop release asset manifest platform mismatch at ${manifestPath}: expected ${platform}, received ${manifest.platform ?? 'unknown'}`,
    );
  }
  if (String(manifest.arch ?? '').trim() !== arch) {
    throw new Error(
      `Desktop release asset manifest architecture mismatch at ${manifestPath}: expected ${arch}, received ${manifest.arch ?? 'unknown'}`,
    );
  }
}

function readDesktopStartupEvidence(evidencePath) {
  if (!existsSync(evidencePath)) {
    throw new Error(`Missing desktop startup evidence: ${evidencePath}`);
  }

  try {
    return JSON.parse(readFileSync(evidencePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to read desktop startup evidence at ${evidencePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function validateDesktopStartupEvidence(
  evidence,
  evidencePath,
  {
    requiresBuiltInOpenClawEvidence = true,
    expectedPackageProfileId = '',
    expectedIncludedKernelIds = [],
    expectedDefaultEnabledKernelIds = [],
  } = {},
) {
  if (!evidence || typeof evidence !== 'object') {
    throw new Error(`Desktop startup evidence must be a JSON object: ${evidencePath}`);
  }
  if (Number(evidence.version) !== 1) {
    throw new Error(
      `Desktop startup evidence version mismatch at ${evidencePath}: expected version 1.`,
    );
  }
  if (String(evidence.status ?? '').trim() !== 'passed') {
    throw new Error(
      `Desktop startup evidence must record status "passed" at ${evidencePath}.`,
    );
  }
  if (String(evidence.phase ?? '').trim() !== 'shell-mounted') {
    throw new Error(
      `Desktop startup evidence must record phase "shell-mounted" at ${evidencePath}.`,
    );
  }
  if (evidence?.readinessEvidence?.ready !== true) {
    throw new Error(
      `Desktop startup evidence must preserve ready runtime readiness evidence at ${evidencePath}.`,
    );
  }
  if (
    requiresBuiltInOpenClawEvidence
    && (
    evidence?.readinessEvidence?.gatewayWebsocketProbeSupported === true
    && evidence?.readinessEvidence?.gatewayWebsocketDialable !== true
    )
  ) {
    throw new Error(
      `Desktop startup evidence must prove the OpenClaw gateway websocket is dialable at ${evidencePath}.`,
    );
  }
  if (requiresBuiltInOpenClawEvidence) {
    const builtInInstanceId = String(evidence?.builtInInstance?.id ?? '').trim();
    if (!builtInInstanceId) {
      throw new Error(
        `Desktop startup evidence must preserve the built-in OpenClaw instance identity at ${evidencePath}.`,
      );
    }
    if (builtInInstanceId !== CANONICAL_BUILT_IN_OPENCLAW_INSTANCE_ID) {
      throw new Error(
        `Desktop startup evidence must preserve the canonical managed built-in OpenClaw instance id "${CANONICAL_BUILT_IN_OPENCLAW_INSTANCE_ID}" at ${evidencePath}.`,
      );
    }
    if (String(evidence?.builtInInstance?.runtimeKind ?? '').trim() !== 'openclaw') {
      throw new Error(
        `Desktop startup evidence must preserve the built-in OpenClaw runtime kind at ${evidencePath}.`,
      );
    }
    if (evidence?.builtInInstance?.isBuiltIn !== true) {
      throw new Error(
        `Desktop startup evidence must preserve the managed built-in OpenClaw projection at ${evidencePath}.`,
      );
    }
    if (String(evidence?.builtInInstance?.status ?? '').trim() !== 'online') {
      throw new Error(
        `Desktop startup evidence must preserve the built-in OpenClaw instance online status at ${evidencePath}.`,
      );
    }
  }

  const descriptorBrowserBaseUrl = String(
    evidence?.descriptor?.browserBaseUrl ?? '',
  ).trim();
  if (!descriptorBrowserBaseUrl) {
    throw new Error(
      `Desktop startup evidence must preserve descriptor.browserBaseUrl at ${evidencePath}.`,
    );
  }

  const bundledComponents = evidence?.bundledComponents;
  if (!bundledComponents || typeof bundledComponents !== 'object') {
    throw new Error(
      `Desktop startup evidence must preserve bundled package context at ${evidencePath}.`,
    );
  }

  const packageProfileId = normalizeManifestString(bundledComponents.packageProfileId);
  if (!packageProfileId) {
    throw new Error(
      `Desktop startup evidence must preserve bundledComponents.packageProfileId at ${evidencePath}.`,
    );
  }
  if (packageProfileId !== expectedPackageProfileId) {
    throw new Error(
      `Desktop startup evidence package profile mismatch at ${evidencePath}: expected ${expectedPackageProfileId}, received ${packageProfileId}.`,
    );
  }

  const includedKernelIds = normalizeManifestStringArray(
    bundledComponents.includedKernelIds,
  );
  if (
    JSON.stringify(includedKernelIds)
    !== JSON.stringify(normalizeManifestStringArray(expectedIncludedKernelIds))
  ) {
    throw new Error(
      `Desktop startup evidence included kernels mismatch at ${evidencePath}.`,
    );
  }

  const defaultEnabledKernelIds = normalizeManifestStringArray(
    bundledComponents.defaultEnabledKernelIds,
  );
  if (
    JSON.stringify(defaultEnabledKernelIds)
    !== JSON.stringify(normalizeManifestStringArray(expectedDefaultEnabledKernelIds))
  ) {
    throw new Error(
      `Desktop startup evidence default enabled kernels mismatch at ${evidencePath}.`,
    );
  }
}

function extractLocalAiProxyRuntime(evidence, evidencePath) {
  const localAiProxyRuntime = normalizeDesktopStartupSmokeLocalAiProxyRuntime(
    evidence?.localAiProxy,
  );
  if (!localAiProxyRuntime) {
    throw new Error(
      `Desktop startup evidence must preserve local ai proxy runtime lifecycle and artifact paths at ${evidencePath}.`,
    );
  }
  if (localAiProxyRuntime.lifecycle !== 'running') {
    throw new Error(
      `Desktop startup evidence must preserve a running local ai proxy runtime at ${evidencePath}.`,
    );
  }

  return localAiProxyRuntime;
}

function buildDesktopStartupSmokeChecks({
  requiresBuiltInOpenClawEvidence = true,
} = {}) {
  return [
    {
      id: 'startup-status',
      status: 'passed',
      detail: 'desktop startup evidence recorded a passed launch',
    },
    {
      id: 'startup-phase',
      status: 'passed',
      detail: 'desktop startup evidence recorded shell-mounted phase',
    },
    {
      id: 'runtime-readiness',
      status: 'passed',
      detail: 'desktop startup evidence preserved ready runtime invariants',
    },
    {
      id: 'built-in-instance',
      status: 'passed',
      detail: requiresBuiltInOpenClawEvidence
        ? 'desktop startup evidence preserved the built-in OpenClaw instance projection'
        : 'desktop startup evidence skipped built-in OpenClaw instance checks because package profile excludes openclaw',
    },
    {
      id: 'gateway-websocket',
      status: 'passed',
      detail: requiresBuiltInOpenClawEvidence
        ? 'desktop startup evidence proved the OpenClaw gateway websocket was dialable'
        : 'desktop startup evidence skipped OpenClaw gateway websocket checks because package profile excludes openclaw',
    },
    {
      id: 'local-ai-proxy-runtime',
      status: 'passed',
      detail: 'desktop startup evidence preserved local ai proxy runtime lifecycle and artifact paths',
    },
  ];
}

export function writeDesktopStartupSmokeReport({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform,
  arch,
  target = '',
  manifestPath = '',
  capturedEvidencePath = '',
  evidence,
  localAiProxyRuntime,
  artifactRelativePaths = [],
  requiresBuiltInOpenClawEvidence = true,
} = {}) {
  const reportPath = resolveDesktopStartupSmokeReportPath({
    releaseAssetsDir,
    platform,
    arch,
  });
  mkdirSync(path.dirname(reportPath), { recursive: true });

  const report = {
    platform: normalizeDesktopPlatform(platform),
    arch: normalizeDesktopArch(arch),
    target: String(target ?? '').trim(),
    status: 'passed',
    phase: 'shell-mounted',
    verifiedAt: new Date().toISOString(),
    manifestPath: path.resolve(manifestPath),
    capturedEvidenceRelativePath: path.relative(
      releaseAssetsDir,
      capturedEvidencePath,
    ).replaceAll('\\', '/'),
    packageProfileId: normalizeManifestString(evidence?.bundledComponents?.packageProfileId),
    includedKernelIds: normalizeManifestStringArray(
      evidence?.bundledComponents?.includedKernelIds,
    ),
    defaultEnabledKernelIds: normalizeManifestStringArray(
      evidence?.bundledComponents?.defaultEnabledKernelIds,
    ),
    descriptorBrowserBaseUrl: String(evidence?.descriptor?.browserBaseUrl ?? '').trim(),
    builtInInstanceId: String(evidence?.builtInInstance?.id ?? '').trim(),
    builtInInstanceStatus: String(evidence?.builtInInstance?.status ?? '').trim(),
    localAiProxyRuntime,
    artifactRelativePaths: [...artifactRelativePaths].sort((left, right) =>
      left.localeCompare(right),
    ),
    checks: buildDesktopStartupSmokeChecks({
      requiresBuiltInOpenClawEvidence,
    }),
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return {
    reportPath,
    report,
  };
}

export async function smokeDesktopStartupEvidence({
  releaseAssetsDir = DEFAULT_RELEASE_ASSETS_DIR,
  platform = process.platform,
  arch = process.arch,
  target = '',
  startupEvidencePath = '',
} = {}) {
  const targetSpec = resolveDesktopReleaseTarget({
    targetTriple: target,
    platform,
    arch,
  });
  const releasePlatform = normalizeDesktopPlatform(targetSpec.platform);
  const releaseArch = normalizeDesktopArch(targetSpec.arch);
  const { manifestPath, manifest } = readDesktopReleaseAssetManifest({
    releaseAssetsDir,
    platform: releasePlatform,
    arch: releaseArch,
  });
  const requiresBuiltInOpenClawEvidence = manifestIncludesKernel(manifest, 'openclaw');

  assertDesktopManifestMatchesTarget({
    manifest,
    manifestPath,
    platform: releasePlatform,
    arch: releaseArch,
  });

  const canonicalEvidencePath = resolveCapturedDesktopStartupEvidencePath({
    releaseAssetsDir,
    platform: releasePlatform,
    arch: releaseArch,
  });
  const sourceEvidencePath = String(startupEvidencePath ?? '').trim().length > 0
    ? resolveCliPath(startupEvidencePath)
    : canonicalEvidencePath;
  const evidence = readDesktopStartupEvidence(sourceEvidencePath);
  validateDesktopStartupEvidence(evidence, sourceEvidencePath, {
    requiresBuiltInOpenClawEvidence,
    expectedPackageProfileId: normalizeManifestString(manifest?.packageProfileId),
    expectedIncludedKernelIds: normalizeManifestStringArray(manifest?.includedKernelIds),
    expectedDefaultEnabledKernelIds: normalizeManifestStringArray(
      manifest?.defaultEnabledKernelIds,
    ),
  });
  const localAiProxyRuntime = extractLocalAiProxyRuntime(evidence, sourceEvidencePath);

  if (path.resolve(sourceEvidencePath) !== path.resolve(canonicalEvidencePath)) {
    mkdirSync(path.dirname(canonicalEvidencePath), { recursive: true });
    writeFileSync(
      canonicalEvidencePath,
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    );
  }

  const smokeReport = writeDesktopStartupSmokeReport({
    releaseAssetsDir,
    platform: releasePlatform,
    arch: releaseArch,
    target: targetSpec.targetTriple,
    manifestPath,
    capturedEvidencePath: canonicalEvidencePath,
    evidence,
    localAiProxyRuntime,
    artifactRelativePaths: normalizeArtifactRelativePaths(manifest),
    requiresBuiltInOpenClawEvidence,
  });

  return {
    platform: releasePlatform,
    arch: releaseArch,
    target: targetSpec.targetTriple,
    manifestPath,
    manifest,
    evidencePath: canonicalEvidencePath,
    evidence,
    reportPath: smokeReport.reportPath,
    report: smokeReport.report,
  };
}

export function parseArgs(argv) {
  const options = {
    platform: process.platform,
    arch: process.arch,
    target: '',
    releaseAssetsDir: DEFAULT_RELEASE_ASSETS_DIR,
    startupEvidencePath: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--platform') {
      options.platform = readOptionValue(argv, index, '--platform');
      index += 1;
      continue;
    }
    if (token === '--arch') {
      options.arch = readOptionValue(argv, index, '--arch');
      index += 1;
      continue;
    }
    if (token === '--target') {
      options.target = readOptionValue(argv, index, '--target');
      index += 1;
      continue;
    }
    if (token === '--release-assets-dir') {
      options.releaseAssetsDir = resolveCliPath(
        readOptionValue(argv, index, '--release-assets-dir'),
      );
      index += 1;
      continue;
    }
    if (token === '--startup-evidence-path') {
      options.startupEvidencePath = resolveCliPath(
        readOptionValue(argv, index, '--startup-evidence-path'),
      );
      index += 1;
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const result = await smokeDesktopStartupEvidence(parseArgs(argv));
  console.log(
    `Smoke-verified desktop launched-session evidence for ${result.platform}-${result.arch}.`,
  );
  return result;
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
