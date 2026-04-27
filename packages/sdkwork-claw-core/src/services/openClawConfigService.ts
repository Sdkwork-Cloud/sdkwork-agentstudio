import { getPlatformBridge, platform } from '@sdkwork/claw-infrastructure';
import {
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
  normalizeLocalApiProxyLegacyProviderModelRef as normalizeLegacyProviderModelRef,
  parseJson5,
  stringifyJson5,
  type LocalApiProxyProviderRuntimeConfig,
} from '@sdkwork/local-api-proxy';
import {
  type OpenClawLocalProxyProjection,
} from './openClawLocalProxyProjectionService.ts';
import {
  buildOpenClawProviderSnapshotsFromConfigRoot as buildOpenClawProviderSnapshotsFromConfigRootDelegate,
  type OpenClawProviderSnapshot,
} from './openClawProviderSnapshotService.ts';
import {
  canonicalizeManagedLocalProxyProvidersInConfigRoot,
  writeOpenClawProviderConfigToConfigRoot,
} from './openClawProviderDocumentService.ts';
import {
  createOpenClawProviderModelInConfigRoot,
  deleteOpenClawProviderFromConfigRoot,
  deleteOpenClawProviderModelFromConfigRoot,
  pruneOpenClawProviderModelReferencesInConfigRoot,
  reconcileOpenClawProviderModelCatalogInConfigRoot,
  updateOpenClawProviderModelInConfigRoot,
} from './openClawProviderCatalogDocumentService.ts';
import {
  deleteOpenClawAgentFromConfigRoot,
  listOpenClawAgentEntries,
  normalizeOpenClawAgentId,
  type OpenClawAgentDocumentInput,
  type OpenClawAgentModelConfig,
  type OpenClawAgentParamValue,
  readOpenClawAgentModelConfig,
  readOpenClawAgentParams,
  saveOpenClawAgentToConfigRoot,
  writeOpenClawAgentModelConfig,
  writeOpenClawAgentParams,
} from './openClawAgentDocumentService.ts';
import { canonicalizeOpenClawAgentPathsInConfigRoot } from './openClawAgentPathStandardizationService.ts';
import {
  buildOpenClawAgentSnapshotsFromConfigRoot,
  resolveOpenClawAgentPathsFromConfigRoot,
  type OpenClawAgentParamSource,
  type OpenClawAgentSnapshot,
  type OpenClawResolvedAgentPaths,
} from './openClawAgentSnapshotService.ts';
import {
  buildConfigDocumentPreview as buildConfigDocumentPreviewDelegate,
  truncateConfigDocumentPreview as truncateConfigDocumentPreviewDelegate,
  analyzeOpenClawConfigDocument as analyzeOpenClawConfigDocumentDelegate,
  mutateOpenClawConfigDocument as mutateOpenClawConfigDocumentDelegate,
  parseOpenClawConfigDocument as parseOpenClawConfigDocumentDelegate,
  serializeOpenClawConfigDocument as serializeOpenClawConfigDocumentDelegate,
} from './openClawConfigDocumentService.ts';
import type {
  JsonArray,
  JsonObject,
  JsonValue,
  OpenClawConfigDocumentAnalysis,
  OpenClawParsedConfigDocument,
} from './openClawConfigDocumentService.ts';
import {
  buildOpenClawChannelSnapshotsFromConfigRoot,
  listOpenClawChannelDefinitions,
  saveOpenClawChannelConfigurationToConfigRoot,
  type OpenClawChannelSnapshot,
  type SaveOpenClawChannelConfigurationDocumentInput,
} from './openClawChannelConfigService.ts';
import {
  buildOpenClawWebSearchConfigSnapshot,
  saveOpenClawWebSearchConfigurationToConfigRoot,
  type OpenClawWebSearchConfigSnapshot,
  type OpenClawWebSearchProviderSnapshot,
  type SaveOpenClawWebSearchConfigurationDocumentInput,
} from './openClawWebSearchConfigService.ts';
import {
  buildOpenClawWebFetchConfigSnapshot,
  buildOpenClawWebSearchNativeCodexConfigSnapshot,
  buildOpenClawXSearchConfigSnapshot,
  saveOpenClawWebFetchConfigurationToConfigRoot,
  saveOpenClawWebSearchNativeCodexConfigurationToConfigRoot,
  saveOpenClawXSearchConfigurationToConfigRoot,
  type OpenClawWebFetchConfigSnapshot,
  type OpenClawWebFetchFallbackProviderSnapshot,
  type OpenClawWebSearchNativeCodexConfigSnapshot,
  type OpenClawWebSearchNativeCodexUserLocationSnapshot,
  type OpenClawXSearchConfigSnapshot,
  type SaveOpenClawWebFetchConfigurationDocumentInput,
  type SaveOpenClawWebSearchNativeCodexConfigurationDocumentInput,
  type SaveOpenClawXSearchConfigurationDocumentInput,
} from './openClawWebToolConfigService.ts';
import {
  configureOpenClawMultiAgentSupportInConfigRoot,
  type ConfigureOpenClawMultiAgentSupportDocumentInput,
} from './openClawMultiAgentDocumentService.ts';
import {
  resolveAttachedKernelConfig,
  type KernelConfigBackedDetail,
} from './kernelConfigAttachmentService.ts';

export type {
  OpenClawAgentModelConfig,
  OpenClawAgentParamValue,
} from './openClawAgentDocumentService.ts';

export type {
  OpenClawAgentParamSource,
  OpenClawAgentSnapshot,
  OpenClawResolvedAgentPaths,
} from './openClawAgentSnapshotService.ts';

export type {
  JsonPrimitive,
  OpenClawConfigDocumentAnalysis,
  OpenClawConfigDocumentSection,
  OpenClawParsedConfigDocument,
} from './openClawConfigDocumentService.ts';

export {
  setOpenClawChannelEnabledInDocument,
} from './openClawChannelConfigService.ts';

export type {
  OpenClawChannelDefinition,
  OpenClawChannelFieldDefinition,
  OpenClawChannelSnapshot,
} from './openClawChannelConfigService.ts';

export type {
  OpenClawWebSearchConfigSnapshot,
  OpenClawWebSearchProviderSnapshot,
} from './openClawWebSearchConfigService.ts';

export type {
  OpenClawWebFetchConfigSnapshot,
  OpenClawWebFetchFallbackProviderSnapshot,
  OpenClawWebSearchNativeCodexConfigSnapshot,
  OpenClawWebSearchNativeCodexUserLocationSnapshot,
  OpenClawXSearchConfigSnapshot,
} from './openClawWebToolConfigService.ts';

export type { OpenClawSubagentDefaultsInput } from './openClawMultiAgentDocumentService.ts';

export interface OpenClawProviderModelInput {
  id: string;
  name: string;
}

export interface OpenClawProviderInput {
  id: string;
  channelId: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  models: OpenClawProviderModelInput[];
  notes?: string;
  config?: Partial<OpenClawProviderRuntimeConfig>;
}

export interface OpenClawModelSelection {
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
}

export interface OpenClawAuthCooldownsConfigSnapshot {
  rateLimitedProfileRotations: number | null;
  overloadedProfileRotations: number | null;
  overloadedBackoffMs: number | null;
  billingBackoffHours: number | null;
  billingMaxHours: number | null;
  failureWindowHours: number | null;
}

export interface OpenClawDreamingConfigSnapshot {
  enabled: boolean;
  frequency: string;
}

type OpenClawProviderRuntimeConfig = LocalApiProxyProviderRuntimeConfig;
export type OpenClawAgentInput = OpenClawAgentDocumentInput;

export interface ConfigureOpenClawMultiAgentSupportInput
  extends ConfigureOpenClawMultiAgentSupportDocumentInput {
  configFile: string;
}

export interface OpenClawConfigSnapshot {
  configFile: string;
  providerSnapshots: OpenClawProviderSnapshot[];
  agentSnapshots: OpenClawAgentSnapshot[];
  channelSnapshots: OpenClawChannelSnapshot[];
  webSearchConfig: OpenClawWebSearchConfigSnapshot;
  xSearchConfig: OpenClawXSearchConfigSnapshot;
  webSearchNativeCodexConfig: OpenClawWebSearchNativeCodexConfigSnapshot;
  webFetchConfig: OpenClawWebFetchConfigSnapshot;
  authCooldownsConfig: OpenClawAuthCooldownsConfigSnapshot;
  dreamingConfig: OpenClawDreamingConfigSnapshot;
  root: JsonObject;
}

export interface SaveOpenClawChannelConfigurationInput
  extends SaveOpenClawChannelConfigurationDocumentInput {
  configFile: string;
}

export interface SaveOpenClawSkillEntryInput {
  configFile: string;
  skillKey: string;
  enabled?: boolean;
  apiKey?: string;
  env?: Record<string, string>;
}

export interface DeleteOpenClawSkillEntryInput {
  configFile: string;
  skillKey: string;
}

export interface SaveOpenClawWebSearchConfigurationInput
  extends SaveOpenClawWebSearchConfigurationDocumentInput {
  configFile: string;
}

export interface SaveOpenClawXSearchConfigurationInput
  extends SaveOpenClawXSearchConfigurationDocumentInput {
  configFile: string;
}

export interface SaveOpenClawWebSearchNativeCodexConfigurationInput
  extends SaveOpenClawWebSearchNativeCodexConfigurationDocumentInput {
  configFile: string;
}

export interface SaveOpenClawWebFetchConfigurationInput
  extends SaveOpenClawWebFetchConfigurationDocumentInput {
  configFile: string;
}

export interface SaveOpenClawAuthCooldownsConfigurationInput {
  configFile: string;
  rateLimitedProfileRotations?: number;
  overloadedProfileRotations?: number;
  overloadedBackoffMs?: number;
  billingBackoffHours?: number;
  billingMaxHours?: number;
  failureWindowHours?: number;
}

export interface SaveOpenClawDreamingConfigurationInput {
  configFile: string;
  enabled: boolean;
  frequency?: string;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

function createUnavailableOpenClawConfigDocumentError(configFile: string) {
  return new Error(
    `The attached OpenClaw config file is no longer available on disk. Re-scan or reattach the instance configuration. (${normalizePath(
      configFile,
    )})`,
  );
}

function isUnavailableOpenClawConfigDocumentError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  return /ENOENT|os error 2|not a file|\u7cfb\u7edf\u627e\u4e0d\u5230\u6307\u5b9a\u7684\u6587\u4ef6/i.test(
    message,
  );
}

function wrapUnavailableOpenClawConfigDocumentError(configFile: string, error: unknown): never {
  if (isUnavailableOpenClawConfigDocumentError(error)) {
    throw createUnavailableOpenClawConfigDocumentError(configFile);
  }

  throw error;
}

const OPENCLAW_CONFIG_SNAPSHOT_CACHE_TTL_MS = 2_000;

interface OpenClawConfigSnapshotCacheEntry {
  expiresAt: number;
  value: OpenClawConfigSnapshot;
}

interface OpenClawConfigRootCacheEntry {
  expiresAt: number;
  value: JsonObject;
}

type OpenClawPlatformBridge = ReturnType<typeof getPlatformBridge>;

const openClawConfigRootCacheByReader = new WeakMap<
  OpenClawPlatformBridge,
  Map<string, OpenClawConfigRootCacheEntry>
>();
const pendingOpenClawConfigRootByReader = new WeakMap<
  OpenClawPlatformBridge,
  Map<string, Promise<JsonObject>>
>();
const openClawConfigSnapshotCacheByReader = new WeakMap<
  OpenClawPlatformBridge,
  Map<string, OpenClawConfigSnapshotCacheEntry>
>();
const pendingOpenClawConfigSnapshotByReader = new WeakMap<
  OpenClawPlatformBridge,
  Map<string, Promise<OpenClawConfigSnapshot>>
>();
const openClawConfigSnapshotVersionByFile = new Map<string, number>();

function getOpenClawConfigRootCache(
  bridge = getPlatformBridge(),
) {
  let cache = openClawConfigRootCacheByReader.get(bridge);
  if (!cache) {
    cache = new Map<string, OpenClawConfigRootCacheEntry>();
    openClawConfigRootCacheByReader.set(bridge, cache);
  }

  return cache;
}

function getPendingOpenClawConfigRoots(
  bridge = getPlatformBridge(),
) {
  let pending = pendingOpenClawConfigRootByReader.get(bridge);
  if (!pending) {
    pending = new Map<string, Promise<JsonObject>>();
    pendingOpenClawConfigRootByReader.set(bridge, pending);
  }

  return pending;
}

function getOpenClawConfigSnapshotCache(
  bridge = getPlatformBridge(),
) {
  let cache = openClawConfigSnapshotCacheByReader.get(bridge);
  if (!cache) {
    cache = new Map<string, OpenClawConfigSnapshotCacheEntry>();
    openClawConfigSnapshotCacheByReader.set(bridge, cache);
  }

  return cache;
}

function getPendingOpenClawConfigSnapshots(
  bridge = getPlatformBridge(),
) {
  let pending = pendingOpenClawConfigSnapshotByReader.get(bridge);
  if (!pending) {
    pending = new Map<string, Promise<OpenClawConfigSnapshot>>();
    pendingOpenClawConfigSnapshotByReader.set(bridge, pending);
  }

  return pending;
}

function getOpenClawConfigSnapshotVersion(configFile: string) {
  return openClawConfigSnapshotVersionByFile.get(configFile) || 0;
}

function invalidateOpenClawConfigSnapshot(configFile: string) {
  const normalizedConfigFile = normalizePath(configFile);
  openClawConfigSnapshotVersionByFile.set(
    normalizedConfigFile,
    getOpenClawConfigSnapshotVersion(normalizedConfigFile) + 1,
  );
  getOpenClawConfigRootCache().delete(normalizedConfigFile);
  getPendingOpenClawConfigRoots().delete(normalizedConfigFile);
  getOpenClawConfigSnapshotCache().delete(normalizedConfigFile);
  getPendingOpenClawConfigSnapshots().delete(normalizedConfigFile);
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    parent[key] = {};
  }

  return parent[key] as JsonObject;
}

function ensureArray(parent: JsonObject, key: string): JsonArray {
  const current = parent[key];
  if (!Array.isArray(current)) {
    parent[key] = [];
  }

  return parent[key] as JsonArray;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cloneJsonObject(value: JsonObject) {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function readObject(value: JsonValue | undefined) {
  return isJsonObject(value) ? value : null;
}

function deleteIfEmptyObject(parent: JsonObject, key: string) {
  const value = parent[key];
  if (!isJsonObject(value) || Object.keys(value).length > 0) {
    return;
  }

  delete parent[key];
}

function readScalar(value: JsonValue | undefined) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function readNumber(value: JsonValue | undefined, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readOptionalNumber(value: JsonValue | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function readBoolean(value: JsonValue | undefined, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }

  return fallback;
}

function setOptionalScalar(target: JsonObject, key: string, value: string | undefined) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    delete target[key];
    return;
  }

  target[key] = normalized;
}

function setOptionalFiniteNumber(target: JsonObject, key: string, value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    delete target[key];
    return;
  }

  target[key] = Math.max(1, Math.round(value));
}

function setOptionalWholeNumber(
  target: JsonObject,
  key: string,
  value: number | undefined,
  options: {
    minimum?: number;
  } = {},
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    delete target[key];
    return;
  }

  const minimum = options.minimum ?? 0;
  target[key] = Math.max(minimum, Math.round(value));
}

function setOptionalBoolean(target: JsonObject, key: string, value: boolean | undefined) {
  if (typeof value !== 'boolean') {
    delete target[key];
    return;
  }

  target[key] = value;
}

function truncateConfigDocumentPreview(value: string, maxLength = 96) {
  return truncateConfigDocumentPreviewDelegate(value, maxLength);
}

function buildConfigDocumentPreview(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'Empty list';
    }

    return truncateConfigDocumentPreview(
      value
        .slice(0, 3)
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          if (isJsonObject(entry as JsonValue | undefined)) {
            return Object.keys(entry as JsonObject)
              .slice(0, 2)
              .join(', ');
          }
          return String(entry);
        })
        .filter(Boolean)
        .join(' - '),
    );
  }

  if (isJsonObject(value as JsonValue | undefined)) {
    const keys = Object.keys(value as JsonObject);
    if (keys.length === 0) {
      return 'Empty object';
    }

    return truncateConfigDocumentPreview(keys.slice(0, 4).join(', '));
  }

  if (value == null) {
    return 'No value';
  }

  if (typeof value === 'string') {
    return truncateConfigDocumentPreview(value || 'Empty string');
  }

  return truncateConfigDocumentPreview(String(value));
}

export function analyzeOpenClawConfigDocument(raw: string): OpenClawConfigDocumentAnalysis {
  return analyzeOpenClawConfigDocumentDelegate(raw);
}

export function parseOpenClawConfigDocument(raw: string): OpenClawParsedConfigDocument {
  return parseOpenClawConfigDocumentDelegate(raw);
}

export function serializeOpenClawConfigDocument(root: Record<string, unknown>) {
  return serializeOpenClawConfigDocumentDelegate(root);
}

export function mutateOpenClawConfigDocument(
  raw: string,
  mutate: (root: JsonObject) => void,
) {
  return mutateOpenClawConfigDocumentDelegate(raw, mutate);
}

export function saveOpenClawAgentInConfigDocument(raw: string, agent: OpenClawAgentInput) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    saveOpenClawAgentToConfigRoot(root, agent);
    canonicalizeOpenClawAgentPathsInConfigRoot(root);
    pruneOpenClawProviderModelReferencesInConfigRoot(root);
  });
}

export function deleteOpenClawAgentFromConfigDocument(raw: string, agentId: string) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    deleteOpenClawAgentFromConfigRoot(root, agentId);
    pruneOpenClawProviderModelReferencesInConfigRoot(root);
  });
}

export function saveOpenClawChannelConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawChannelConfigurationInput, 'configFile'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    saveOpenClawChannelConfigurationToConfigRoot(root, input);
  });
}

export function saveOpenClawWebSearchConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawWebSearchConfigurationInput, 'configFile'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    saveOpenClawWebSearchConfigurationToConfigRoot(root, input);
  });
}

export function saveOpenClawXSearchConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawXSearchConfigurationInput, 'configFile'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    saveOpenClawXSearchConfigurationToConfigRoot(root, input);
  });
}

export function saveOpenClawWebSearchNativeCodexConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawWebSearchNativeCodexConfigurationInput, 'configFile'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    saveOpenClawWebSearchNativeCodexConfigurationToConfigRoot(root, input);
  });
}

export function saveOpenClawWebFetchConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawWebFetchConfigurationInput, 'configFile'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    saveOpenClawWebFetchConfigurationToConfigRoot(root, input);
  });
}

export function saveOpenClawAuthCooldownsConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawAuthCooldownsConfigurationInput, 'configFile'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    updateAuthCooldownsConfig(root, {
      configFile: '',
      ...input,
    });
  });
}

export function saveOpenClawDreamingConfigInDocument(
  raw: string,
  input: Omit<SaveOpenClawDreamingConfigurationInput, 'configFile'>,
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    updateDreamingConfig(root, {
      configFile: '',
      ...input,
    });
  });
}

function normalizeAgentId(value: string | undefined | null) {
  return normalizeOpenClawAgentId(value);
}

function normalizeProviderKey(providerId: string | undefined | null) {
  return normalizeLegacyProviderId(providerId);
}

function buildProviderKey(providerId: string) {
  return normalizeProviderKey(providerId);
}

function normalizeModelRefString(value: string | undefined | null) {
  return normalizeLegacyProviderModelRef(value);
}

function parseModelRef(value: JsonValue | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeModelRefString(value);
  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0 || slashIndex === normalized.length - 1) {
    return null;
  }

  return {
    providerKey: normalized.slice(0, slashIndex),
    modelId: normalized.slice(slashIndex + 1),
  };
}

function readArray(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function readModelConfig(value: JsonValue | undefined): OpenClawAgentModelConfig {
  return readOpenClawAgentModelConfig(value);
}

function writeModelConfig(
  target: JsonObject,
  key: string,
  value: string | OpenClawAgentModelConfig | null | undefined,
) {
  writeOpenClawAgentModelConfig(target, key, value);
}

function normalizeLegacyProviderLayout(root: JsonObject) {
  const modelsRoot = readObject(root.models);
  const providersRoot = readObject(modelsRoot?.providers);
  if (providersRoot) {
    const nextProviders: JsonObject = {};

    for (const [rawProviderKey, providerValue] of Object.entries(providersRoot)) {
      const normalizedProviderKey = normalizeProviderKey(rawProviderKey);
      if (!normalizedProviderKey) {
        continue;
      }

      if (!(normalizedProviderKey in nextProviders) || rawProviderKey === normalizedProviderKey) {
        nextProviders[normalizedProviderKey] = providerValue;
      }
    }

    modelsRoot!.providers = nextProviders;
  }

  const defaultsRoot = readObject(readObject(root.agents)?.defaults);
  if (defaultsRoot) {
    if (defaultsRoot.model !== undefined) {
      writeModelConfig(defaultsRoot, 'model', readModelConfig(defaultsRoot.model));
    }

    const modelsCatalogRoot = readObject(defaultsRoot.models);
    if (modelsCatalogRoot) {
      const nextModelsCatalogRoot: JsonObject = {};
      for (const [rawModelRef, modelMetadata] of Object.entries(modelsCatalogRoot)) {
        const normalizedModelRef = normalizeModelRefString(rawModelRef);
        if (!normalizedModelRef) {
          continue;
        }

        if (!(normalizedModelRef in nextModelsCatalogRoot) || rawModelRef === normalizedModelRef) {
          nextModelsCatalogRoot[normalizedModelRef] = modelMetadata;
        }
      }

      defaultsRoot.models = nextModelsCatalogRoot;
    }
  }

  for (const entry of getAgentListEntries(root)) {
    if (entry.model !== undefined) {
      writeModelConfig(entry, 'model', readModelConfig(entry.model));
    }
  }

  canonicalizeOpenClawAgentPathsInConfigRoot(root);
}

function readAgentParams(value: JsonValue | undefined): Record<string, OpenClawAgentParamValue> {
  return readOpenClawAgentParams(value);
}

function writeAgentParams(
  target: JsonObject,
  params?: Record<string, OpenClawAgentParamValue | null | undefined>,
) {
  writeOpenClawAgentParams(target, params);
}

function getAgentListEntries(root: JsonObject) {
  return listOpenClawAgentEntries(root);
}

function buildAgentSnapshots(root: JsonObject, configFile: string): OpenClawAgentSnapshot[] {
  return buildOpenClawAgentSnapshotsFromConfigRoot(root, configFile);
}

function buildResolvedAgentPaths(
  root: JsonObject,
  configFile: string,
  agentId: string,
  overrides: {
    workspace?: string | null;
    agentDir?: string | null;
  } = {},
): OpenClawResolvedAgentPaths {
  return resolveOpenClawAgentPathsFromConfigRoot({
    root,
    configFile,
    agentId,
    workspace: overrides.workspace,
    agentDir: overrides.agentDir,
  });
}

function getPluginConfigRoot(root: JsonObject, pluginId: string) {
  return (
    readObject(
      readObject(
        readObject(readObject(root.plugins)?.entries)?.[pluginId],
      )?.config,
    ) || null
  );
}

async function readConfigRoot(configFile: string) {
  const normalizedConfigFile = normalizePath(configFile);
  const rootCache = getOpenClawConfigRootCache();
  const pendingRoots = getPendingOpenClawConfigRoots();
  const currentTime = Date.now();
  const cached = rootCache.get(normalizedConfigFile);
  if (cached && cached.expiresAt > currentTime) {
    return cloneJsonObject(cached.value);
  }

  const pending = pendingRoots.get(normalizedConfigFile);
  if (pending) {
    return pending.then((root) => cloneJsonObject(root));
  }

  const version = getOpenClawConfigSnapshotVersion(normalizedConfigFile);
  const request = platform.readFile(normalizedConfigFile)
    .catch((error) => wrapUnavailableOpenClawConfigDocumentError(normalizedConfigFile, error))
    .then((raw) => {
      const parsed = raw.trim() ? parseJson5<JsonObject>(raw) : {};

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {} as JsonObject;
      }

      const root = parsed as JsonObject;
      normalizeLegacyProviderLayout(root);
      return root;
    })
    .then((root) => {
      const cachedRoot = cloneJsonObject(root);
      if (getOpenClawConfigSnapshotVersion(normalizedConfigFile) === version) {
        rootCache.set(normalizedConfigFile, {
          expiresAt: Date.now() + OPENCLAW_CONFIG_SNAPSHOT_CACHE_TTL_MS,
          value: cachedRoot,
        });
      }

      return cachedRoot;
    })
    .finally(() => {
      if (pendingRoots.get(normalizedConfigFile) === request) {
        pendingRoots.delete(normalizedConfigFile);
      }
    });

  pendingRoots.set(normalizedConfigFile, request);
  return request.then((root) => cloneJsonObject(root));
}

async function writeConfigRoot(configFile: string, root: JsonObject) {
  const normalizedConfigFile = normalizePath(configFile);
  canonicalizeOpenClawAgentPathsInConfigRoot(root);
  const content = `${stringifyJson5(root, 2)}\n`;
  await platform.writeFile(normalizedConfigFile, content);
  invalidateOpenClawConfigSnapshot(normalizedConfigFile);
}

function readAuthCooldownsRoot(root: JsonObject) {
  return readObject(readObject(root.auth)?.cooldowns) || null;
}

function buildAuthCooldownsConfigSnapshot(root: JsonObject): OpenClawAuthCooldownsConfigSnapshot {
  const cooldownsRoot = readAuthCooldownsRoot(root) || {};

  return {
    rateLimitedProfileRotations: readOptionalNumber(cooldownsRoot.rateLimitedProfileRotations),
    overloadedProfileRotations: readOptionalNumber(cooldownsRoot.overloadedProfileRotations),
    overloadedBackoffMs: readOptionalNumber(cooldownsRoot.overloadedBackoffMs),
    billingBackoffHours: readOptionalNumber(cooldownsRoot.billingBackoffHours),
    billingMaxHours: readOptionalNumber(cooldownsRoot.billingMaxHours),
    failureWindowHours: readOptionalNumber(cooldownsRoot.failureWindowHours),
  };
}

function readDreamingRoot(root: JsonObject) {
  return readObject(getPluginConfigRoot(root, 'memory-core')?.dreaming) || null;
}

function buildDreamingConfigSnapshot(root: JsonObject): OpenClawDreamingConfigSnapshot {
  const dreamingRoot = readDreamingRoot(root) || {};

  return {
    enabled: readBoolean(dreamingRoot.enabled, false),
    frequency: readScalar(dreamingRoot.frequency),
  };
}

function buildProviderSnapshots(
  root: JsonObject,
  options: {
    lastCheckedAt?: string;
  } = {},
): OpenClawProviderSnapshot[] {
  return buildOpenClawProviderSnapshotsFromConfigRootDelegate(root, options);
}

function updateProviderConfig(
  root: JsonObject,
  provider: OpenClawProviderInput,
  selection: OpenClawModelSelection,
  options: {
    overwriteDefaults?: boolean;
  } = {},
) {
  writeOpenClawProviderConfigToConfigRoot({
    root,
    provider,
    selection,
    overwriteDefaults: options.overwriteDefaults,
  });
  reconcileOpenClawProviderModelCatalogInConfigRoot(root);
}

function canonicalizeManagedLocalProxyProviders(root: JsonObject, providerId: string) {
  canonicalizeManagedLocalProxyProvidersInConfigRoot(root, providerId);
}

function updateAuthCooldownsConfig(root: JsonObject, input: SaveOpenClawAuthCooldownsConfigurationInput) {
  const authRoot = ensureObject(root, 'auth');
  const cooldownsRoot = ensureObject(authRoot, 'cooldowns');

  setOptionalWholeNumber(cooldownsRoot, 'rateLimitedProfileRotations', input.rateLimitedProfileRotations);
  setOptionalWholeNumber(cooldownsRoot, 'overloadedProfileRotations', input.overloadedProfileRotations);
  setOptionalWholeNumber(cooldownsRoot, 'overloadedBackoffMs', input.overloadedBackoffMs);
  setOptionalWholeNumber(cooldownsRoot, 'billingBackoffHours', input.billingBackoffHours);
  setOptionalWholeNumber(cooldownsRoot, 'billingMaxHours', input.billingMaxHours);
  setOptionalWholeNumber(cooldownsRoot, 'failureWindowHours', input.failureWindowHours);

  deleteIfEmptyObject(authRoot, 'cooldowns');
  deleteIfEmptyObject(root, 'auth');
}

function updateDreamingConfig(root: JsonObject, input: SaveOpenClawDreamingConfigurationInput) {
  const pluginsRoot = ensureObject(root, 'plugins');
  const entriesRoot = ensureObject(pluginsRoot, 'entries');
  const entryRoot = ensureObject(entriesRoot, 'memory-core');
  const configRoot = ensureObject(entryRoot, 'config');
  const dreamingRoot = ensureObject(configRoot, 'dreaming');

  for (const key of Object.keys(dreamingRoot)) {
    delete dreamingRoot[key];
  }

  dreamingRoot.enabled = input.enabled;
  setOptionalScalar(dreamingRoot, 'frequency', input.frequency?.trim() || '');

  deleteIfEmptyObject(configRoot, 'dreaming');
  deleteIfEmptyObject(entryRoot, 'config');
  deleteIfEmptyObject(entriesRoot, 'memory-core');
  deleteIfEmptyObject(pluginsRoot, 'entries');
  deleteIfEmptyObject(root, 'plugins');
}

function updateSkillEntry(root: JsonObject, input: SaveOpenClawSkillEntryInput) {
  const skillKey = input.skillKey.trim();
  if (!skillKey) {
    throw new Error('OpenClaw skill key is required.');
  }

  const skillsRoot = ensureObject(root, 'skills');
  const entriesRoot = ensureObject(skillsRoot, 'entries');
  const current = readObject(entriesRoot[skillKey]) || {};

  if (typeof input.enabled === 'boolean') {
    if (input.enabled) {
      delete current.enabled;
    } else {
      current.enabled = false;
    }
  }

  if (input.apiKey !== undefined) {
    const normalizedApiKey = input.apiKey.trim();
    if (normalizedApiKey) {
      current.apiKey = normalizedApiKey;
    } else {
      delete current.apiKey;
    }
  }

  if (input.env) {
    const nextEnv = readObject(current.env) || {};

    for (const [rawKey, rawValue] of Object.entries(input.env)) {
      const key = rawKey.trim();
      if (!key) {
        continue;
      }

      const value = rawValue.trim();
      if (value) {
        nextEnv[key] = value;
      } else {
        delete nextEnv[key];
      }
    }

    if (Object.keys(nextEnv).length > 0) {
      current.env = nextEnv;
    } else {
      delete current.env;
    }
  }

  if (Object.keys(current).length > 0) {
    entriesRoot[skillKey] = current;
  } else {
    delete entriesRoot[skillKey];
  }

  deleteIfEmptyObject(skillsRoot, 'entries');
  deleteIfEmptyObject(root, 'skills');
}

function deleteSkillEntry(root: JsonObject, skillKey: string) {
  const normalizedSkillKey = skillKey.trim();
  if (!normalizedSkillKey) {
    throw new Error('OpenClaw skill key is required.');
  }

  const skillsRoot = ensureObject(root, 'skills');
  const entriesRoot = ensureObject(skillsRoot, 'entries');
  delete entriesRoot[normalizedSkillKey];

  deleteIfEmptyObject(skillsRoot, 'entries');
  deleteIfEmptyObject(root, 'skills');
}

function saveAgentConfig(root: JsonObject, input: OpenClawAgentInput) {
  saveOpenClawAgentToConfigRoot(root, input);
  canonicalizeOpenClawAgentPathsInConfigRoot(root);
  pruneOpenClawProviderModelReferencesInConfigRoot(root);
}

function deleteAgentConfig(root: JsonObject, agentId: string) {
  deleteOpenClawAgentFromConfigRoot(root, agentId);
  pruneOpenClawProviderModelReferencesInConfigRoot(root);
}

class OpenClawConfigService {
  getChannelDefinitions() {
    return listOpenClawChannelDefinitions();
  }

  resolveInstanceConfigPath(
    detail: KernelConfigBackedDetail | null | undefined,
    options: {
      requireWritable?: boolean;
    } = {},
  ) {
    const kernelConfig = resolveAttachedKernelConfig(detail);
    if (!kernelConfig || kernelConfig.runtimeKind !== 'openclaw') {
      return null;
    }

    if (options.requireWritable && !kernelConfig.writable) {
      return null;
    }

    return kernelConfig.configFile;
  }

  async getConfigDocumentPathInfo(configFile: string) {
    return platform.getPathInfo(normalizePath(configFile));
  }

  async readConfigDocument(configFile: string) {
    const normalizedConfigFile = normalizePath(configFile);
    const pathInfo = await this.getConfigDocumentPathInfo(normalizedConfigFile).catch(() => null);
    if (pathInfo && (!pathInfo.exists || pathInfo.kind !== 'file')) {
      throw createUnavailableOpenClawConfigDocumentError(normalizedConfigFile);
    }

    return platform
      .readFile(normalizedConfigFile)
      .catch((error) => wrapUnavailableOpenClawConfigDocumentError(normalizedConfigFile, error));
  }

  async writeConfigDocument(configFile: string, raw: string) {
    const normalizedConfigFile = normalizePath(configFile);
    const parsed = raw.trim() ? parseJson5<JsonObject>(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('OpenClaw config document must contain a top-level object.');
    }

    const pathInfo = await this.getConfigDocumentPathInfo(normalizedConfigFile).catch(() => null);
    if (pathInfo && (!pathInfo.exists || pathInfo.kind !== 'file')) {
      throw createUnavailableOpenClawConfigDocumentError(normalizedConfigFile);
    }

    await platform
      .writeFile(normalizedConfigFile, raw)
      .catch((error) => wrapUnavailableOpenClawConfigDocumentError(normalizedConfigFile, error));
    invalidateOpenClawConfigSnapshot(normalizedConfigFile);
  }

  async resolveAgentPaths(input: {
    configFile: string;
    agentId: string;
    workspace?: string | null;
    agentDir?: string | null;
  }) {
    const root = await readConfigRoot(input.configFile);
    return buildResolvedAgentPaths(root, input.configFile, input.agentId, {
      workspace: input.workspace,
      agentDir: input.agentDir,
    });
  }

  async readConfigSnapshot(configFile: string): Promise<OpenClawConfigSnapshot> {
    const normalizedConfigFile = normalizePath(configFile);
    const snapshotCache = getOpenClawConfigSnapshotCache();
    const pendingSnapshots = getPendingOpenClawConfigSnapshots();
    const currentTime = Date.now();
    const cached = snapshotCache.get(normalizedConfigFile);
    if (cached && cached.expiresAt > currentTime) {
      return cached.value;
    }

    const pending = pendingSnapshots.get(normalizedConfigFile);
    if (pending) {
      return pending;
    }

    const version = getOpenClawConfigSnapshotVersion(normalizedConfigFile);
    const request = readConfigRoot(normalizedConfigFile)
      .then((root) => ({
        configFile: normalizedConfigFile,
        providerSnapshots: buildProviderSnapshots(root),
        agentSnapshots: buildAgentSnapshots(root, normalizedConfigFile),
        channelSnapshots: buildOpenClawChannelSnapshotsFromConfigRoot(root),
        webSearchConfig: buildOpenClawWebSearchConfigSnapshot(root),
        xSearchConfig: buildOpenClawXSearchConfigSnapshot(root),
        webSearchNativeCodexConfig: buildOpenClawWebSearchNativeCodexConfigSnapshot(root),
        webFetchConfig: buildOpenClawWebFetchConfigSnapshot(root),
        authCooldownsConfig: buildAuthCooldownsConfigSnapshot(root),
        dreamingConfig: buildDreamingConfigSnapshot(root),
        root,
      }))
      .then((snapshot) => {
        if (getOpenClawConfigSnapshotVersion(normalizedConfigFile) === version) {
          snapshotCache.set(normalizedConfigFile, {
            expiresAt: Date.now() + OPENCLAW_CONFIG_SNAPSHOT_CACHE_TTL_MS,
            value: snapshot,
          });
        }

        return snapshot;
      })
      .finally(() => {
        if (pendingSnapshots.get(normalizedConfigFile) === request) {
          pendingSnapshots.delete(normalizedConfigFile);
        }
      });

    pendingSnapshots.set(normalizedConfigFile, request);
    return request;
  }

  async saveProviderSelection(input: {
    configFile: string;
    provider: OpenClawProviderInput;
    selection: OpenClawModelSelection;
  }) {
    const root = await readConfigRoot(input.configFile);
    updateProviderConfig(root, input.provider, input.selection);
    await writeConfigRoot(input.configFile, root);

    const providerKey = buildProviderKey(input.provider.id);
    return buildProviderSnapshots(root).find((provider) => provider.providerKey === providerKey) || null;
  }

  async saveManagedLocalProxyProjection(input: {
    configFile: string;
    projection: OpenClawLocalProxyProjection;
  }) {
    const root = await readConfigRoot(input.configFile);
    canonicalizeManagedLocalProxyProviders(root, input.projection.provider.id);
    updateProviderConfig(root, input.projection.provider, input.projection.selection, {
      overwriteDefaults: true,
    });
    await writeConfigRoot(input.configFile, root);

    const providerKey = buildProviderKey(input.projection.provider.id);
    return buildProviderSnapshots(root).find((provider) => provider.providerKey === providerKey) || null;
  }

  async createProviderModel(input: {
    configFile: string;
    providerId: string;
    model: OpenClawProviderModelInput;
  }) {
    const root = await readConfigRoot(input.configFile);
    createOpenClawProviderModelInConfigRoot({
      root,
      providerId: input.providerId,
      model: input.model,
    });
    await writeConfigRoot(input.configFile, root);

    return this.readConfigSnapshot(input.configFile);
  }

  async updateProviderModel(input: {
    configFile: string;
    providerId: string;
    modelId: string;
    model: OpenClawProviderModelInput;
  }) {
    const root = await readConfigRoot(input.configFile);
    updateOpenClawProviderModelInConfigRoot({
      root,
      providerId: input.providerId,
      modelId: input.modelId,
      model: input.model,
    });
    await writeConfigRoot(input.configFile, root);

    return this.readConfigSnapshot(input.configFile);
  }

  async deleteProviderModel(input: {
    configFile: string;
    providerId: string;
    modelId: string;
  }) {
    const root = await readConfigRoot(input.configFile);
    deleteOpenClawProviderModelFromConfigRoot({
      root,
      providerId: input.providerId,
      modelId: input.modelId,
    });
    await writeConfigRoot(input.configFile, root);

    return this.readConfigSnapshot(input.configFile);
  }

  async deleteProvider(input: {
    configFile: string;
    providerId: string;
  }) {
    const root = await readConfigRoot(input.configFile);
    deleteOpenClawProviderFromConfigRoot({
      root,
      providerId: input.providerId,
    });
    await writeConfigRoot(input.configFile, root);

    return this.readConfigSnapshot(input.configFile);
  }

  async saveAgent(input: {
    configFile: string;
    agent: OpenClawAgentInput;
  }) {
    const root = await readConfigRoot(input.configFile);
    const resolvedPaths = buildResolvedAgentPaths(root, input.configFile, input.agent.id);
    saveAgentConfig(root, {
      ...input.agent,
      id: resolvedPaths.id,
      workspace: resolvedPaths.workspace,
      agentDir: resolvedPaths.agentDir,
    });
    await writeConfigRoot(input.configFile, root);

    return buildAgentSnapshots(root, input.configFile).find(
      (agent) => agent.id === resolvedPaths.id,
    ) || null;
  }

  async deleteAgent(input: {
    configFile: string;
    agentId: string;
  }) {
    const root = await readConfigRoot(input.configFile);
    deleteAgentConfig(root, input.agentId);
    await writeConfigRoot(input.configFile, root);

    return buildAgentSnapshots(root, input.configFile);
  }

  async configureMultiAgentSupport(input: ConfigureOpenClawMultiAgentSupportInput) {
    const root = await readConfigRoot(input.configFile);
    configureOpenClawMultiAgentSupportInConfigRoot(root, input);
    await writeConfigRoot(input.configFile, root);

    return this.readConfigSnapshot(input.configFile);
  }

  async saveChannelConfiguration(input: SaveOpenClawChannelConfigurationInput) {
    const root = await readConfigRoot(input.configFile);
    saveOpenClawChannelConfigurationToConfigRoot(root, input);
    await writeConfigRoot(input.configFile, root);

    return (
      buildOpenClawChannelSnapshotsFromConfigRoot(root).find(
        (channel) => channel.id === input.channelId,
      ) || null
    );
  }

  async saveSkillEntry(input: SaveOpenClawSkillEntryInput) {
    const root = await readConfigRoot(input.configFile);
    updateSkillEntry(root, input);
    await writeConfigRoot(input.configFile, root);

    return this.readConfigSnapshot(input.configFile);
  }

  async saveWebSearchConfiguration(input: SaveOpenClawWebSearchConfigurationInput) {
    const root = await readConfigRoot(input.configFile);
    saveOpenClawWebSearchConfigurationToConfigRoot(root, input);
    await writeConfigRoot(input.configFile, root);

    return buildOpenClawWebSearchConfigSnapshot(root);
  }

  async saveXSearchConfiguration(input: SaveOpenClawXSearchConfigurationInput) {
    const root = await readConfigRoot(input.configFile);
    saveOpenClawXSearchConfigurationToConfigRoot(root, input);
    await writeConfigRoot(input.configFile, root);

    return buildOpenClawXSearchConfigSnapshot(root);
  }

  async saveWebSearchNativeCodexConfiguration(
    input: SaveOpenClawWebSearchNativeCodexConfigurationInput,
  ) {
    const root = await readConfigRoot(input.configFile);
    saveOpenClawWebSearchNativeCodexConfigurationToConfigRoot(root, input);
    await writeConfigRoot(input.configFile, root);

    return buildOpenClawWebSearchNativeCodexConfigSnapshot(root);
  }

  async saveWebFetchConfiguration(input: SaveOpenClawWebFetchConfigurationInput) {
    const root = await readConfigRoot(input.configFile);
    saveOpenClawWebFetchConfigurationToConfigRoot(root, input);
    await writeConfigRoot(input.configFile, root);

    return buildOpenClawWebFetchConfigSnapshot(root);
  }

  async saveAuthCooldownsConfiguration(input: SaveOpenClawAuthCooldownsConfigurationInput) {
    const root = await readConfigRoot(input.configFile);
    updateAuthCooldownsConfig(root, input);
    await writeConfigRoot(input.configFile, root);

    return buildAuthCooldownsConfigSnapshot(root);
  }

  async saveDreamingConfiguration(input: SaveOpenClawDreamingConfigurationInput) {
    const root = await readConfigRoot(input.configFile);
    updateDreamingConfig(root, input);
    await writeConfigRoot(input.configFile, root);

    return buildDreamingConfigSnapshot(root);
  }

  async deleteSkillEntry(input: DeleteOpenClawSkillEntryInput) {
    const root = await readConfigRoot(input.configFile);
    deleteSkillEntry(root, input.skillKey);
    await writeConfigRoot(input.configFile, root);

    return this.readConfigSnapshot(input.configFile);
  }

  async setChannelEnabled(input: {
    configFile: string;
    channelId: string;
    enabled: boolean;
  }) {
    const root = await readConfigRoot(input.configFile);
    const channelsRoot = ensureObject(root, 'channels');
    const channelRoot = ensureObject(channelsRoot, input.channelId);
    channelRoot.enabled = input.enabled;
    await writeConfigRoot(input.configFile, root);

    return (
      buildOpenClawChannelSnapshotsFromConfigRoot(root).find(
        (channel) => channel.id === input.channelId,
      ) || null
    );
  }
}

export const openClawConfigService = new OpenClawConfigService();
