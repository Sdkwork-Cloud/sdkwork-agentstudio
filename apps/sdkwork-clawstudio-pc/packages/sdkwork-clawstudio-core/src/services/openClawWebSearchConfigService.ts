import { parseJson5, stringifyJson5 } from '@sdkwork/local-api-proxy';
import type {
  JsonObject,
  JsonValue,
} from './openClawConfigDocumentService.ts';
import {
  normalizeOpenClawSecretSource,
  serializeOpenClawSecretSource,
} from './openClawSecretFormatService.ts';

export interface OpenClawWebSearchProviderSnapshot {
  id: string;
  name: string;
  description: string;
  apiKeySource: string;
  baseUrl: string;
  model: string;
  advancedConfig: string;
  supportsApiKey: boolean;
  supportsBaseUrl: boolean;
  supportsModel: boolean;
}

export interface OpenClawWebSearchConfigSnapshot {
  enabled: boolean;
  provider: string;
  maxResults: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  providers: OpenClawWebSearchProviderSnapshot[];
}

export interface SaveOpenClawWebSearchConfigurationDocumentInput {
  enabled: boolean;
  provider: string;
  maxResults: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  providerConfig: {
    providerId: string;
    apiKeySource?: string;
    baseUrl?: string;
    model?: string;
    advancedConfig?: string;
  };
}

interface OpenClawWebSearchProviderDefinition {
  id: string;
  pluginId: string;
  name: string;
  description: string;
  supportsApiKey: boolean;
  supportsBaseUrl: boolean;
  supportsModel: boolean;
}

const DEFAULT_WEB_SEARCH_MAX_RESULTS = 5;
const DEFAULT_WEB_SEARCH_TIMEOUT_SECONDS = 30;
const DEFAULT_WEB_SEARCH_CACHE_TTL_MINUTES = 15;

const OPENCLAW_WEB_SEARCH_PROVIDER_DEFINITIONS: OpenClawWebSearchProviderDefinition[] = [
  {
    id: 'brave',
    pluginId: 'brave',
    name: 'Brave Search',
    description: 'Use Brave Search as the OpenClaw web search provider.',
    supportsApiKey: true,
    supportsBaseUrl: false,
    supportsModel: false,
  },
  {
    id: 'duckduckgo',
    pluginId: 'duckduckgo',
    name: 'DuckDuckGo Search',
    description: 'Use DuckDuckGo without additional provider credentials.',
    supportsApiKey: false,
    supportsBaseUrl: false,
    supportsModel: false,
  },
  {
    id: 'exa',
    pluginId: 'exa',
    name: 'Exa Search',
    description: 'Use Exa as the active OpenClaw web search provider.',
    supportsApiKey: true,
    supportsBaseUrl: false,
    supportsModel: false,
  },
  {
    id: 'firecrawl',
    pluginId: 'firecrawl',
    name: 'Firecrawl Search',
    description: 'Use Firecrawl search and extraction as the web search provider.',
    supportsApiKey: true,
    supportsBaseUrl: true,
    supportsModel: false,
  },
  {
    id: 'gemini',
    pluginId: 'google',
    name: 'Gemini Search',
    description: 'Use Gemini web search through the official OpenClaw adapter.',
    supportsApiKey: true,
    supportsBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'grok',
    pluginId: 'xai',
    name: 'Grok Search',
    description: 'Use Grok web search through the official OpenClaw adapter.',
    supportsApiKey: true,
    supportsBaseUrl: false,
    supportsModel: true,
  },
  {
    id: 'kimi',
    pluginId: 'moonshot',
    name: 'Kimi Search',
    description: 'Use Kimi as the active OpenClaw web search provider.',
    supportsApiKey: true,
    supportsBaseUrl: true,
    supportsModel: true,
  },
  {
    id: 'perplexity',
    pluginId: 'perplexity',
    name: 'Perplexity Search',
    description: 'Use Perplexity for grounded web-search results.',
    supportsApiKey: true,
    supportsBaseUrl: true,
    supportsModel: true,
  },
  {
    id: 'searxng',
    pluginId: 'searxng',
    name: 'SearXNG',
    description: 'Use a self-hosted SearXNG endpoint as the web search provider.',
    supportsApiKey: false,
    supportsBaseUrl: true,
    supportsModel: false,
  },
  {
    id: 'tavily',
    pluginId: 'tavily',
    name: 'Tavily Search',
    description: 'Use Tavily as the OpenClaw web search provider.',
    supportsApiKey: true,
    supportsBaseUrl: true,
    supportsModel: false,
  },
];

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readObject(value: unknown) {
  return isJsonObject(value) ? value : null;
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (!isJsonObject(current)) {
    parent[key] = {};
  }

  return parent[key] as JsonObject;
}

function deleteIfEmptyObject(parent: JsonObject, key: string) {
  const current = readObject(parent[key]);
  if (current && Object.keys(current).length === 0) {
    delete parent[key];
  }
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

function readBoolean(value: JsonValue | undefined, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: JsonValue | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cloneJsonObject(root: JsonObject) {
  return JSON.parse(JSON.stringify(root)) as JsonObject;
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

  target[key] = value;
}

function parseJsonObjectText(label: string, value: string | undefined) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    return {} as JsonObject;
  }

  const parsed = parseJson5<JsonValue>(normalized);
  if (!isJsonObject(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed;
}

export function normalizeOpenClawWebSearchProviderId(providerId: string) {
  const normalizedProviderId = providerId.trim().toLowerCase();
  switch (normalizedProviderId) {
    case 'google':
      return 'gemini';
    case 'xai':
      return 'grok';
    case 'moonshot':
      return 'kimi';
    default:
      return normalizedProviderId;
  }
}

function getWebSearchProviderDefinition(providerId: string) {
  return (
    OPENCLAW_WEB_SEARCH_PROVIDER_DEFINITIONS.find(
      (definition) => definition.id === normalizeOpenClawWebSearchProviderId(providerId),
    ) || null
  );
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

function readWebSearchRoot(root: JsonObject) {
  return readObject(readObject(readObject(root.tools)?.web)?.search) || null;
}

function getPluginEntryConfigRoot(root: JsonObject, providerId: string) {
  const pluginId =
    getWebSearchProviderDefinition(providerId)?.pluginId ??
    normalizeOpenClawWebSearchProviderId(providerId);
  return getPluginConfigRoot(root, pluginId);
}

export function readOpenClawWebSearchPluginAuthRoot(root: JsonObject, providerId: string) {
  return readObject(getPluginEntryConfigRoot(root, providerId)?.webSearch) || null;
}

function getPluginWebSearchSettingsRoot(root: JsonObject, providerId: string) {
  return readObject(getPluginEntryConfigRoot(root, providerId)?.webSearch) || null;
}

function buildWebSearchProviderAdvancedConfig(
  root: JsonObject,
  definition: OpenClawWebSearchProviderDefinition,
) {
  const nextRoot = cloneJsonObject(root);
  delete nextRoot.apiKey;
  if (definition.supportsBaseUrl) {
    delete nextRoot.baseUrl;
  }
  if (definition.supportsModel) {
    delete nextRoot.model;
  }

  return Object.keys(nextRoot).length > 0 ? stringifyJson5(nextRoot, 2) : '';
}

function buildOpenClawWebSearchProviderSnapshotsFromConfigRoot(root: JsonObject) {
  return OPENCLAW_WEB_SEARCH_PROVIDER_DEFINITIONS.map((definition) => {
    const providerAuthRoot = readOpenClawWebSearchPluginAuthRoot(root, definition.id) || {};
    const providerSettingsRoot = getPluginWebSearchSettingsRoot(root, definition.id) || {};

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      apiKeySource: normalizeOpenClawSecretSource(readScalar(providerAuthRoot.apiKey)),
      baseUrl: readScalar(providerSettingsRoot.baseUrl),
      model: readScalar(providerSettingsRoot.model),
      advancedConfig: buildWebSearchProviderAdvancedConfig(providerSettingsRoot, definition),
      supportsApiKey: definition.supportsApiKey,
      supportsBaseUrl: definition.supportsBaseUrl,
      supportsModel: definition.supportsModel,
    };
  });
}

export function buildOpenClawWebSearchConfigSnapshot(
  root: JsonObject,
): OpenClawWebSearchConfigSnapshot {
  const searchRoot = readWebSearchRoot(root) || {};

  return {
    enabled: readBoolean(searchRoot.enabled, true),
    provider: normalizeOpenClawWebSearchProviderId(readScalar(searchRoot.provider)),
    maxResults: readNumber(searchRoot.maxResults, DEFAULT_WEB_SEARCH_MAX_RESULTS),
    timeoutSeconds: readNumber(searchRoot.timeoutSeconds, DEFAULT_WEB_SEARCH_TIMEOUT_SECONDS),
    cacheTtlMinutes: readNumber(searchRoot.cacheTtlMinutes, DEFAULT_WEB_SEARCH_CACHE_TTL_MINUTES),
    providers: buildOpenClawWebSearchProviderSnapshotsFromConfigRoot(root),
  };
}

function ensurePluginWebSearchRoots(root: JsonObject, providerId: string) {
  const definition = getWebSearchProviderDefinition(providerId);
  if (!definition) {
    throw new Error(`Unsupported OpenClaw web search provider: ${providerId}`);
  }

  const pluginsRoot = ensureObject(root, 'plugins');
  const entriesRoot = ensureObject(pluginsRoot, 'entries');
  const entryRoot = ensureObject(entriesRoot, definition.pluginId);
  const configRoot = ensureObject(entryRoot, 'config');
  const settingsRootKey = 'webSearch';
  const authRootKey = 'webSearch';

  return {
    pluginId: definition.pluginId,
    pluginsRoot,
    entriesRoot,
    entryRoot,
    configRoot,
    authRootKey,
    authRoot: ensureObject(configRoot, authRootKey),
    settingsRootKey,
    settingsRoot: ensureObject(configRoot, settingsRootKey),
  };
}

export function saveOpenClawWebSearchConfigurationToConfigRoot(
  root: JsonObject,
  input: SaveOpenClawWebSearchConfigurationDocumentInput,
) {
  const toolsRoot = ensureObject(root, 'tools');
  const webRoot = ensureObject(toolsRoot, 'web');
  const searchRoot = ensureObject(webRoot, 'search');
  const providerId = normalizeOpenClawWebSearchProviderId(input.provider);
  searchRoot.enabled = input.enabled;
  setOptionalScalar(searchRoot, 'provider', providerId);
  setOptionalFiniteNumber(searchRoot, 'maxResults', input.maxResults);
  setOptionalFiniteNumber(searchRoot, 'timeoutSeconds', input.timeoutSeconds);
  setOptionalFiniteNumber(searchRoot, 'cacheTtlMinutes', input.cacheTtlMinutes);

  const providerConfigId = normalizeOpenClawWebSearchProviderId(input.providerConfig.providerId);
  const definition = getWebSearchProviderDefinition(providerConfigId);
  if (!definition) {
    throw new Error(
      `Unsupported OpenClaw web search provider: ${input.providerConfig.providerId}`,
    );
  }

  const advancedRoot = parseJsonObjectText('Advanced Config', input.providerConfig.advancedConfig);
  const {
    pluginId,
    pluginsRoot,
    entriesRoot,
    entryRoot,
    configRoot,
    authRootKey,
    authRoot,
    settingsRootKey,
    settingsRoot,
  } = ensurePluginWebSearchRoots(root, providerConfigId);

  for (const key of Object.keys(settingsRoot)) {
    delete settingsRoot[key];
  }

  Object.assign(settingsRoot, advancedRoot);

  if (definition.supportsApiKey) {
    if (authRoot !== settingsRoot) {
      for (const key of Object.keys(authRoot)) {
        delete authRoot[key];
      }
    }
    setOptionalScalar(
      authRoot,
      'apiKey',
      serializeOpenClawSecretSource(input.providerConfig.apiKeySource),
    );
  }
  if (definition.supportsBaseUrl) {
    setOptionalScalar(settingsRoot, 'baseUrl', input.providerConfig.baseUrl);
  }
  if (definition.supportsModel) {
    setOptionalScalar(settingsRoot, 'model', input.providerConfig.model);
  }

  deleteIfEmptyObject(configRoot, settingsRootKey);
  if (authRootKey !== settingsRootKey) {
    deleteIfEmptyObject(configRoot, authRootKey);
  }
  deleteIfEmptyObject(entryRoot, 'config');
  deleteIfEmptyObject(entriesRoot, pluginId);
  deleteIfEmptyObject(pluginsRoot, 'entries');
  deleteIfEmptyObject(root, 'plugins');
}
