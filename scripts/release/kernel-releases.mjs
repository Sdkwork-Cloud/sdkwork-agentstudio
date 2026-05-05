import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const kernelReleaseConfigDir = path.join(rootDir, 'config', 'kernel-releases');

function readJson(filePath, readFileImpl = (targetPath) => readFileSync(targetPath, 'utf8')) {
  return JSON.parse(readFileImpl(filePath));
}

function cloneJsonValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeStringArray(value, fieldName, kernelId) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Kernel release "${kernelId}" must define a non-empty ${fieldName} array.`);
  }

  const normalized = value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);

  if (normalized.length !== value.length) {
    throw new Error(`Kernel release "${kernelId}" contains blank values in ${fieldName}.`);
  }

  return [...new Set(normalized)];
}

function normalizeOptionalStringArray(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return [
    ...new Set(
      value
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean),
    ),
  ];
}

function isPlainRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeRuntimeVersionMap(value) {
  if (!isPlainRecord(value)) {
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

function normalizeRequiredString(value, fieldName, kernelId) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error(`Kernel release "${kernelId}" is missing ${fieldName}.`);
  }

  return normalized;
}

function normalizePlatformSupport(value, kernelId) {
  if (!isPlainRecord(value)) {
    throw new Error(`Kernel release "${kernelId}" must define platformSupport.`);
  }

  const packageProfileIds = normalizeStringArray(
    value.packageProfileIds,
    'platformSupport.packageProfileIds',
    kernelId,
  );

  return Object.freeze({
    packageProfileIds: Object.freeze(packageProfileIds),
    windows: normalizeRequiredString(value.windows, 'platformSupport.windows', kernelId),
    macos: normalizeRequiredString(value.macos, 'platformSupport.macos', kernelId),
    linux: normalizeRequiredString(value.linux, 'platformSupport.linux', kernelId),
  });
}

function deriveRuntimeRequirements(config, kernelId) {
  if (!isPlainRecord(config?.runtimeRequirements)) {
    return cloneJsonValue(config?.runtimeRequirements);
  }

  const runtimeRequirements = cloneJsonValue(config.runtimeRequirements);
  if (
    isPlainRecord(runtimeRequirements.requiredExternalRuntimeVersions)
    && Object.hasOwn(runtimeRequirements.requiredExternalRuntimeVersions, 'nodejs')
  ) {
    throw new Error(
      `Kernel release "${kernelId}" must derive runtimeRequirements.requiredExternalRuntimeVersions.nodejs from nodeVersion.`,
    );
  }

  const requiredExternalRuntimes = normalizeOptionalStringArray(
    runtimeRequirements.requiredExternalRuntimes,
  );
  const optionalExternalRuntimes = normalizeOptionalStringArray(
    runtimeRequirements.optionalExternalRuntimes,
  );
  const nodeVersion = String(config?.nodeVersion ?? '').trim();

  if (requiredExternalRuntimes) {
    runtimeRequirements.requiredExternalRuntimes = requiredExternalRuntimes;
  }
  if (optionalExternalRuntimes) {
    runtimeRequirements.optionalExternalRuntimes = optionalExternalRuntimes;
  }
  if (nodeVersion && requiredExternalRuntimes?.includes('nodejs')) {
    runtimeRequirements.requiredExternalRuntimeVersions = {
      ...normalizeRuntimeVersionMap(runtimeRequirements.requiredExternalRuntimeVersions),
      nodejs: nodeVersion,
    };
  }

  return runtimeRequirements;
}

function deriveReleaseSource(config, stableVersion, kernelId) {
  if (!isPlainRecord(config?.releaseSource)) {
    return cloneJsonValue(config?.releaseSource);
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

function validateKernelReleaseConfig(config, filePath) {
  const kernelId = String(config?.kernelId ?? '').trim();
  const stableVersion = String(config?.stableVersion ?? '').trim();
  const defaultChannel = String(config?.defaultChannel ?? '').trim();

  if (!kernelId) {
    throw new Error(`Kernel release config is missing kernelId: ${filePath}`);
  }
  if (!stableVersion) {
    throw new Error(`Kernel release "${kernelId}" is missing stableVersion: ${filePath}`);
  }

  const supportedChannels = normalizeStringArray(
    config?.supportedChannels,
    'supportedChannels',
    kernelId,
  );
  if (!defaultChannel) {
    throw new Error(`Kernel release "${kernelId}" is missing defaultChannel: ${filePath}`);
  }
  if (!supportedChannels.includes(defaultChannel)) {
    throw new Error(
      `Kernel release "${kernelId}" defaultChannel "${defaultChannel}" must be listed in supportedChannels.`,
    );
  }
  if (Object.hasOwn(config, 'compatibility')) {
    throw new Error(
      `Kernel release "${kernelId}" must use platformSupport instead of compatibility.`,
    );
  }

  const normalizedConfig = cloneJsonValue(config);
  return Object.freeze({
    ...normalizedConfig,
    kernelId,
    stableVersion,
    supportedChannels: Object.freeze(supportedChannels),
    defaultChannel,
    platformSupport: normalizePlatformSupport(normalizedConfig.platformSupport, kernelId),
    runtimeRequirements: deriveRuntimeRequirements(normalizedConfig, kernelId),
    releaseSource: deriveReleaseSource(normalizedConfig, stableVersion, kernelId),
  });
}

function listKernelReleaseConfigFileNames(targetKernelReleaseConfigDir = kernelReleaseConfigDir) {
  return readdirSync(targetKernelReleaseConfigDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function buildKernelReleaseConfigMap(releaseConfigs) {
  const releaseConfigMap = new Map();

  for (const releaseConfig of releaseConfigs) {
    if (releaseConfigMap.has(releaseConfig.kernelId)) {
      throw new Error(`Duplicate kernel release config: ${releaseConfig.kernelId}`);
    }
    releaseConfigMap.set(releaseConfig.kernelId, releaseConfig);
  }

  return releaseConfigMap;
}

function readKernelReleaseConfigs(
  targetKernelReleaseConfigDir = kernelReleaseConfigDir,
  readFileImpl = (targetPath) => readFileSync(targetPath, 'utf8'),
) {
  return listKernelReleaseConfigFileNames(targetKernelReleaseConfigDir)
    .map((fileName) => validateKernelReleaseConfig(
      readJson(path.join(targetKernelReleaseConfigDir, fileName), readFileImpl),
      path.join(targetKernelReleaseConfigDir, fileName),
    ));
}

const cachedKernelReleaseConfigs = Object.freeze(
  readKernelReleaseConfigs(kernelReleaseConfigDir),
);
const cachedKernelReleaseConfigMap = buildKernelReleaseConfigMap(cachedKernelReleaseConfigs);

function cloneKernelReleaseConfig(config) {
  return cloneJsonValue(config);
}

export function resolveKernelReleaseConfigPath(
  kernelId,
  {
    workspaceRootDir = rootDir,
  } = {},
) {
  const normalizedKernelId = String(kernelId ?? '').trim();
  if (!normalizedKernelId) {
    throw new Error('resolveKernelReleaseConfigPath requires a kernelId.');
  }

  return path.join(workspaceRootDir, 'config', 'kernel-releases', `${normalizedKernelId}.json`);
}

export function loadKernelReleaseConfigs({
  workspaceRootDir = rootDir,
  readFileImpl = (targetPath) => readFileSync(targetPath, 'utf8'),
} = {}) {
  const targetKernelReleaseConfigDir = path.join(workspaceRootDir, 'config', 'kernel-releases');
  if (
    path.resolve(targetKernelReleaseConfigDir) === path.resolve(kernelReleaseConfigDir)
    && readFileImpl === readFileSync
  ) {
    return cachedKernelReleaseConfigs.map((config) => cloneKernelReleaseConfig(config));
  }

  return readKernelReleaseConfigs(targetKernelReleaseConfigDir, readFileImpl)
    .map((config) => cloneKernelReleaseConfig(config));
}

export function resolveKernelReleaseConfig(
  kernelId,
  {
    workspaceRootDir = rootDir,
    readFileImpl = (targetPath) => readFileSync(targetPath, 'utf8'),
  } = {},
) {
  const normalizedKernelId = String(kernelId ?? '').trim();
  if (!normalizedKernelId) {
    throw new Error('resolveKernelReleaseConfig requires a kernelId.');
  }

  if (
    path.resolve(workspaceRootDir) === path.resolve(rootDir)
    && readFileImpl === readFileSync
  ) {
    const cachedConfig = cachedKernelReleaseConfigMap.get(normalizedKernelId);
    if (!cachedConfig) {
      throw new Error(`Unsupported kernel release config: ${kernelId}`);
    }
    return cloneKernelReleaseConfig(cachedConfig);
  }

  const filePath = resolveKernelReleaseConfigPath(normalizedKernelId, { workspaceRootDir });
  return cloneKernelReleaseConfig(
    validateKernelReleaseConfig(readJson(filePath, readFileImpl), filePath),
  );
}
