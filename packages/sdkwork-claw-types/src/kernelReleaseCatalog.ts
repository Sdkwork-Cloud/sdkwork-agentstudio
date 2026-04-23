import openclawRelease from '../../../config/kernel-releases/openclaw.json' with { type: 'json' };
import hermesRelease from '../../../config/kernel-releases/hermes.json' with { type: 'json' };

export interface KernelReleaseSupplementalPackageException {
  spec: string;
  reason: string;
  reviewedAt: string;
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
  compatibility?: Record<string, unknown>;
  releaseSource?: Record<string, unknown>;
  releaseVerification?: Record<string, unknown>;
}

function cloneJsonValue<T>(value: T): T {
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

  return {
    ...cloneJsonValue(config),
    kernelId,
    stableVersion,
    supportedChannels,
    defaultChannel,
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
