import openclawRelease from '../../../config/kernel-releases/openclaw.json' with { type: 'json' };
import hermesRelease from '../../../config/kernel-releases/hermes.json' with { type: 'json' };

export interface KernelReleaseSupplementalPackageException {
  spec: string;
  reason: string;
  reviewedAt: string;
}

export interface KernelReleasePlatformSupport {
  packageProfileIds: string[];
  windows: string;
  macos: string;
  linux: string;
}

export interface KernelReleaseConfig {
  kernelId: string;
  stableVersion: string;
  supportedChannels: string[];
  defaultChannel: string;
  nodeVersion?: string;
  packageName?: string;
  runtimeSupplementalPackages?: string[];
  runtimeSupplementalPackageExceptions?: KernelReleaseSupplementalPackageException[];
  runtimeRequirements?: {
    requiredExternalRuntimes?: string[];
    requiredExternalRuntimeVersions?: Record<string, string>;
    optionalExternalRuntimes?: string[];
    optionalExternalRuntimeVersions?: Record<string, string>;
  };
  platformSupport?: KernelReleasePlatformSupport;
  releaseSource?: Record<string, unknown>;
  releaseVerification?: Record<string, unknown>;
}

function cloneJsonValue<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean),
  )];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeRuntimeVersionMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([runtimeId, version]) => [
        String(runtimeId ?? '').trim(),
        String(version ?? '').trim(),
      ])
      .filter(([runtimeId, version]) => runtimeId && version),
  );
}

function normalizeRequiredString(value: unknown, fieldName: string, kernelId: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error(`Kernel release "${kernelId}" is missing ${fieldName}.`);
  }

  return normalized;
}

function normalizePlatformSupport(
  value: KernelReleasePlatformSupport | null | undefined,
  kernelId: string,
): KernelReleasePlatformSupport {
  if (!isRecord(value)) {
    throw new Error(`Kernel release "${kernelId}" must define platformSupport.`);
  }

  const packageProfileIds = normalizeStringArray(value.packageProfileIds);
  if (packageProfileIds.length === 0) {
    throw new Error(`Kernel release "${kernelId}" must define platformSupport.packageProfileIds.`);
  }

  return {
    packageProfileIds,
    windows: normalizeRequiredString(value.windows, 'platformSupport.windows', kernelId),
    macos: normalizeRequiredString(value.macos, 'platformSupport.macos', kernelId),
    linux: normalizeRequiredString(value.linux, 'platformSupport.linux', kernelId),
  };
}

function deriveRuntimeRequirements(
  config: KernelReleaseConfig,
  kernelId: string,
): KernelReleaseConfig['runtimeRequirements'] {
  if (!isRecord(config.runtimeRequirements)) {
    return cloneJsonValue(config.runtimeRequirements);
  }

  const runtimeRequirements = cloneJsonValue(config.runtimeRequirements);
  if (
    isRecord(runtimeRequirements.requiredExternalRuntimeVersions)
    && Object.hasOwn(runtimeRequirements.requiredExternalRuntimeVersions, 'nodejs')
  ) {
    throw new Error(
      `Kernel release "${kernelId}" must derive runtimeRequirements.requiredExternalRuntimeVersions.nodejs from nodeVersion.`,
    );
  }

  const requiredExternalRuntimes = normalizeStringArray(
    runtimeRequirements.requiredExternalRuntimes,
  );
  const optionalExternalRuntimes = normalizeStringArray(
    runtimeRequirements.optionalExternalRuntimes,
  );
  const nodeVersion = String(config.nodeVersion ?? '').trim();

  runtimeRequirements.requiredExternalRuntimes = requiredExternalRuntimes;
  runtimeRequirements.optionalExternalRuntimes = optionalExternalRuntimes;
  if (nodeVersion && requiredExternalRuntimes.includes('nodejs')) {
    runtimeRequirements.requiredExternalRuntimeVersions = {
      ...normalizeRuntimeVersionMap(runtimeRequirements.requiredExternalRuntimeVersions),
      nodejs: nodeVersion,
    };
  }

  return runtimeRequirements;
}

function deriveReleaseSource(
  config: KernelReleaseConfig,
  stableVersion: string,
  kernelId: string,
): KernelReleaseConfig['releaseSource'] {
  if (!isRecord(config.releaseSource)) {
    return cloneJsonValue(config.releaseSource);
  }

  const releaseSource = cloneJsonValue(config.releaseSource);
  const repositoryUrl = String(releaseSource.repositoryUrl ?? '').trim();

  if (releaseSource.kind === 'githubRelease' && Object.hasOwn(releaseSource, 'releaseUrl')) {
    throw new Error(
      `Kernel release "${kernelId}" must derive releaseSource.releaseUrl from releaseSource and stableVersion.`,
    );
  }

  if (releaseSource.kind === 'githubRelease' && repositoryUrl) {
    const tagPrefix = String(releaseSource.tagPrefix ?? '').trim();
    releaseSource.releaseUrl = `${repositoryUrl.replace(/\/+$/u, '')}/releases/tag/${tagPrefix}${stableVersion}`;
  }

  return releaseSource;
}

function normalizeKernelReleaseConfig(config: KernelReleaseConfig): KernelReleaseConfig {
  const kernelId = String(config?.kernelId ?? '').trim();
  const stableVersion = String(config?.stableVersion ?? '').trim();
  const supportedChannels = normalizeStringArray(config?.supportedChannels);
  const defaultChannel = String(config?.defaultChannel ?? '').trim();

  if (!kernelId) {
    throw new Error('Kernel release config is missing kernelId.');
  }
  if (!stableVersion) {
    throw new Error(`Kernel release "${kernelId}" is missing stableVersion.`);
  }
  if (supportedChannels.length === 0) {
    throw new Error(`Kernel release "${kernelId}" is missing supportedChannels.`);
  }
  if (!defaultChannel || !supportedChannels.includes(defaultChannel)) {
    throw new Error(
      `Kernel release "${kernelId}" must define defaultChannel inside supportedChannels.`,
    );
  }
  if (Object.hasOwn(config, 'compatibility')) {
    throw new Error(
      `Kernel release "${kernelId}" must use platformSupport instead of compatibility.`,
    );
  }

  return {
    ...cloneJsonValue(config),
    kernelId,
    stableVersion,
    supportedChannels,
    defaultChannel,
    platformSupport: normalizePlatformSupport(config.platformSupport, kernelId),
    runtimeRequirements: deriveRuntimeRequirements(config, kernelId),
    releaseSource: deriveReleaseSource(config, stableVersion, kernelId),
  };
}

const rawKernelReleaseCatalog = {
  openclaw: {
    ...(openclawRelease as KernelReleaseConfig),
    kernelId: 'openclaw',
  },
  hermes: {
    ...(hermesRelease as KernelReleaseConfig),
    kernelId: 'hermes',
  },
} satisfies Record<string, KernelReleaseConfig>;

const kernelReleaseCatalog = Object.freeze(
  Object.fromEntries(
    Object.entries(rawKernelReleaseCatalog).map(([kernelId, config]) => [
      kernelId,
      Object.freeze(normalizeKernelReleaseConfig(config)),
    ]),
  ) as Record<string, Readonly<KernelReleaseConfig>>,
);

function cloneKernelReleaseConfig(config: Readonly<KernelReleaseConfig>): KernelReleaseConfig {
  return cloneJsonValue(config);
}

export function listKernelReleaseConfigs(): KernelReleaseConfig[] {
  return Object.values(kernelReleaseCatalog).map((config) => cloneKernelReleaseConfig(config));
}

export function resolveKernelReleaseConfig(kernelId: string): KernelReleaseConfig {
  const normalizedKernelId = String(kernelId ?? '').trim();
  const config = kernelReleaseCatalog[normalizedKernelId];
  if (!config) {
    throw new Error(`Unsupported kernel release config: ${kernelId}`);
  }

  return cloneKernelReleaseConfig(config);
}
