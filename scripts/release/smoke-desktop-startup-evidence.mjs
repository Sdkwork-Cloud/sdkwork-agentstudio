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
import {
  normalizeReleaseSmokeRelativePath,
  normalizeReleaseSmokeRelativePathArray,
} from './release-smoke-contract.mjs';

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
const PACKAGED_OPENCLAW_SUPPORTED_CHANNEL_IDS = Object.freeze([
  'qqbot',
  'feishu',
  'imessage',
  'irc',
  'matrix',
  'mattermost',
  'signal',
  'slack',
  'telegram',
]);
const PACKAGED_OPENCLAW_SUPPORTED_CHANNEL_ID_SET = new Set(PACKAGED_OPENCLAW_SUPPORTED_CHANNEL_IDS);
const PACKAGED_OPENCLAW_SUPPORTED_CHANNEL_ORDER = new Map(
  PACKAGED_OPENCLAW_SUPPORTED_CHANNEL_IDS.map((channelId, index) => [channelId, index]),
);

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

function normalizeOpenClawConfigHealthArray(values) {
  return normalizeManifestStringArray(values).sort((left, right) => {
    const leftOrder = PACKAGED_OPENCLAW_SUPPORTED_CHANNEL_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = PACKAGED_OPENCLAW_SUPPORTED_CHANNEL_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.localeCompare(right);
  });
}

function normalizeOpenClawConfigHealth(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return {
    status: normalizeManifestString(value.status),
    valid: value.valid === true,
    runtimeMetadataAvailable: value.runtimeMetadataAvailable === true,
    configReadable: value.configReadable === true,
    supportedChannelIds: normalizeOpenClawConfigHealthArray(value.supportedChannelIds),
    configuredChannelIds: normalizeOpenClawConfigHealthArray(value.configuredChannelIds),
    unknownChannelIds: normalizeOpenClawConfigHealthArray(value.unknownChannelIds),
    malformedChannelIds: normalizeOpenClawConfigHealthArray(value.malformedChannelIds),
    modelByChannelIds: normalizeOpenClawConfigHealthArray(value.modelByChannelIds),
    unknownModelByChannelIds: normalizeOpenClawConfigHealthArray(value.unknownModelByChannelIds),
    invalidModelByChannelIds: normalizeOpenClawConfigHealthArray(value.invalidModelByChannelIds),
  };
}

function findUnsupportedOpenClawChannelIds(values) {
  return normalizeOpenClawConfigHealthArray(values).filter(
    (channelId) => !PACKAGED_OPENCLAW_SUPPORTED_CHANNEL_ID_SET.has(channelId),
  );
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

  if (requiresBuiltInOpenClawEvidence) {
    const openClawConfigHealth = normalizeOpenClawConfigHealth(
      evidence?.openClawConfigHealth,
    );
    if (!openClawConfigHealth) {
      throw new Error(
        `Desktop startup evidence must preserve OpenClaw channel config sanitation evidence at ${evidencePath}.`,
      );
    }
    if (!openClawConfigHealth.runtimeMetadataAvailable) {
      throw new Error(
        `Desktop startup evidence must prove packaged OpenClaw channel metadata was available at ${evidencePath}.`,
      );
    }
    if (!openClawConfigHealth.configReadable) {
      throw new Error(
        `Desktop startup evidence must prove managed OpenClaw config was readable at ${evidencePath}.`,
      );
    }
    if (openClawConfigHealth.supportedChannelIds.length === 0) {
      throw new Error(
        `Desktop startup evidence must preserve packaged OpenClaw supported channel ids at ${evidencePath}.`,
      );
    }
    const unsupportedSupportedChannelIds = findUnsupportedOpenClawChannelIds(
      openClawConfigHealth.supportedChannelIds,
    );
    if (unsupportedSupportedChannelIds.length > 0) {
      throw new Error(
        `Desktop startup evidence contains unsupported OpenClaw channel ids in packaged runtime metadata at ${evidencePath}: ${unsupportedSupportedChannelIds.join(', ')}.`,
      );
    }
    const unsupportedConfiguredChannelIds = findUnsupportedOpenClawChannelIds(
      openClawConfigHealth.configuredChannelIds,
    );
    if (unsupportedConfiguredChannelIds.length > 0) {
      throw new Error(
        `Desktop startup evidence contains unsupported configured OpenClaw channel ids at ${evidencePath}: ${unsupportedConfiguredChannelIds.join(', ')}.`,
      );
    }
    const unsupportedModelByChannelIds = findUnsupportedOpenClawChannelIds(
      openClawConfigHealth.modelByChannelIds,
    );
    if (unsupportedModelByChannelIds.length > 0) {
      throw new Error(
        `Desktop startup evidence contains unsupported OpenClaw modelByChannel ids at ${evidencePath}: ${unsupportedModelByChannelIds.join(', ')}.`,
      );
    }
    if (openClawConfigHealth.unknownChannelIds.length > 0) {
      throw new Error(
        `Desktop startup evidence contains unknown OpenClaw channel ids after sanitation at ${evidencePath}: ${openClawConfigHealth.unknownChannelIds.join(', ')}.`,
      );
    }
    if (openClawConfigHealth.malformedChannelIds.length > 0) {
      throw new Error(
        `Desktop startup evidence contains malformed OpenClaw channel ids after sanitation at ${evidencePath}: ${openClawConfigHealth.malformedChannelIds.join(', ')}.`,
      );
    }
    if (openClawConfigHealth.unknownModelByChannelIds.length > 0) {
      throw new Error(
        `Desktop startup evidence contains unknown OpenClaw modelByChannel ids after sanitation at ${evidencePath}: ${openClawConfigHealth.unknownModelByChannelIds.join(', ')}.`,
      );
    }
    if (openClawConfigHealth.invalidModelByChannelIds.length > 0) {
      throw new Error(
        `Desktop startup evidence contains invalid OpenClaw modelByChannel ids after sanitation at ${evidencePath}: ${openClawConfigHealth.invalidModelByChannelIds.join(', ')}.`,
      );
    }
    if (openClawConfigHealth.status !== 'ready' || !openClawConfigHealth.valid) {
      throw new Error(
        `Desktop startup evidence must prove OpenClaw channel config sanitation is ready and valid at ${evidencePath}.`,
      );
    }
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
    ...(requiresBuiltInOpenClawEvidence
      ? [
        {
          id: 'openclaw-config-health',
          status: 'passed',
          detail: 'desktop startup evidence proved OpenClaw channel config sanitation used packaged runtime metadata',
        },
      ]
      : []),
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
  const capturedEvidenceRelativePath = normalizeReleaseSmokeRelativePath(
    path.relative(
      releaseAssetsDir,
      capturedEvidencePath,
    ),
    {
      contextLabel: 'Desktop startup smoke report',
      pathLabel: 'desktop startup smoke captured evidence path',
    },
  );

  const report = {
    platform: normalizeDesktopPlatform(platform),
    arch: normalizeDesktopArch(arch),
    target: String(target ?? '').trim(),
    status: 'passed',
    phase: 'shell-mounted',
    verifiedAt: new Date().toISOString(),
    manifestPath: path.resolve(manifestPath),
    capturedEvidenceRelativePath,
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
    openClawConfigHealth: normalizeOpenClawConfigHealth(evidence?.openClawConfigHealth),
    localAiProxyRuntime,
    artifactRelativePaths: normalizeReleaseSmokeRelativePathArray(
      artifactRelativePaths,
      {
        contextLabel: 'Desktop startup smoke report',
        pathLabel: 'desktop startup smoke artifact path',
      },
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
