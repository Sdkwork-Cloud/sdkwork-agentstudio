import { parseJson5, stringifyJson5 } from '@sdkwork/local-api-proxy';
import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from './openClawConfigDocumentService.ts';
import {
  normalizeOpenClawSecretSource,
  serializeOpenClawSecretSource,
} from './openClawSecretFormatService.ts';
import { readOpenClawWebSearchPluginAuthRoot } from './openClawWebSearchConfigService.ts';

export interface OpenClawXSearchConfigSnapshot {
  enabled: boolean;
  apiKeySource: string;
  model: string;
  inlineCitations: boolean;
  maxTurns: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  advancedConfig: string;
}

export interface OpenClawWebSearchNativeCodexUserLocationSnapshot {
  country: string;
  city: string;
  timezone: string;
}

export interface OpenClawWebSearchNativeCodexConfigSnapshot {
  enabled: boolean;
  mode: string;
  allowedDomains: string[];
  contextSize: string;
  userLocation: OpenClawWebSearchNativeCodexUserLocationSnapshot;
  advancedConfig: string;
}

export interface OpenClawWebFetchFallbackProviderSnapshot {
  providerId: 'firecrawl';
  name: string;
  description: string;
  apiKeySource: string;
  baseUrl: string;
  advancedConfig: string;
  supportsApiKey: boolean;
  supportsBaseUrl: boolean;
}

export interface OpenClawWebFetchConfigSnapshot {
  enabled: boolean;
  maxChars: number;
  maxCharsCap: number;
  maxResponseBytes: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  maxRedirects: number;
  readability: boolean;
  userAgent: string;
  fallbackProvider: OpenClawWebFetchFallbackProviderSnapshot;
}

export interface SaveOpenClawXSearchConfigurationDocumentInput {
  enabled: boolean;
  apiKeySource?: string;
  model?: string;
  inlineCitations: boolean;
  maxTurns: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  advancedConfig?: string;
}

export interface SaveOpenClawWebSearchNativeCodexConfigurationDocumentInput {
  enabled: boolean;
  mode?: string;
  allowedDomains: string[];
  contextSize?: string;
  userLocation?: Partial<OpenClawWebSearchNativeCodexUserLocationSnapshot>;
  advancedConfig?: string;
}

export interface SaveOpenClawWebFetchConfigurationDocumentInput {
  enabled: boolean;
  maxChars: number;
  maxCharsCap: number;
  maxResponseBytes: number;
  timeoutSeconds: number;
  cacheTtlMinutes: number;
  maxRedirects: number;
  readability: boolean;
  userAgent?: string;
  fallbackProviderConfig: {
    providerId: 'firecrawl';
    apiKeySource?: string;
    baseUrl?: string;
    advancedConfig?: string;
  };
}

const DEFAULT_X_SEARCH_MAX_TURNS = 2;
const DEFAULT_X_SEARCH_TIMEOUT_SECONDS = 30;
const DEFAULT_X_SEARCH_CACHE_TTL_MINUTES = 15;
const DEFAULT_WEB_SEARCH_NATIVE_CODEX_MODE = 'cached';
const DEFAULT_WEB_FETCH_MAX_CHARS = 50_000;
const DEFAULT_WEB_FETCH_MAX_CHARS_CAP = 50_000;
const DEFAULT_WEB_FETCH_MAX_RESPONSE_BYTES = 2_000_000;
const DEFAULT_WEB_FETCH_TIMEOUT_SECONDS = 30;
const DEFAULT_WEB_FETCH_CACHE_TTL_MINUTES = 15;
const DEFAULT_WEB_FETCH_MAX_REDIRECTS = 3;

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

function readArray(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function readStringArray(value: JsonValue | undefined) {
  return readArray(value)
    .map((entry) => readScalar(entry).trim())
    .filter(Boolean);
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

function setOptionalWholeNumber(target: JsonObject, key: string, value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    delete target[key];
    return;
  }

  target[key] = Math.max(0, Math.floor(value));
}

function setStringArray(target: JsonObject, key: string, values: string[]) {
  const normalizedValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (normalizedValues.length === 0) {
    delete target[key];
    return;
  }

  target[key] = normalizedValues as JsonArray;
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

function readLegacyXSearchRoot(root: JsonObject) {
  return readObject(readObject(readObject(root.tools)?.web)?.x_search) || null;
}

function getPluginXSearchConfigRoot(root: JsonObject) {
  return readObject(getPluginConfigRoot(root, 'xai')?.xSearch) || null;
}

function readXSearchRoot(root: JsonObject) {
  return getPluginXSearchConfigRoot(root) || readLegacyXSearchRoot(root) || null;
}

function buildXSearchAdvancedConfig(root: JsonObject) {
  const nextRoot = cloneJsonObject(root);
  delete nextRoot.enabled;
  delete nextRoot.model;
  delete nextRoot.inlineCitations;
  delete nextRoot.maxTurns;
  delete nextRoot.timeoutSeconds;
  delete nextRoot.cacheTtlMinutes;

  return Object.keys(nextRoot).length > 0 ? stringifyJson5(nextRoot, 2) : '';
}

export function buildOpenClawXSearchConfigSnapshot(root: JsonObject): OpenClawXSearchConfigSnapshot {
  const xSearchRoot = readXSearchRoot(root) || {};
  const xaiWebSearchRoot = readOpenClawWebSearchPluginAuthRoot(root, 'grok') || {};

  return {
    enabled: readBoolean(xSearchRoot.enabled, false),
    apiKeySource: normalizeOpenClawSecretSource(readScalar(xaiWebSearchRoot.apiKey)),
    model: readScalar(xSearchRoot.model),
    inlineCitations: readBoolean(xSearchRoot.inlineCitations, false),
    maxTurns: readNumber(xSearchRoot.maxTurns, DEFAULT_X_SEARCH_MAX_TURNS),
    timeoutSeconds: readNumber(xSearchRoot.timeoutSeconds, DEFAULT_X_SEARCH_TIMEOUT_SECONDS),
    cacheTtlMinutes: readNumber(xSearchRoot.cacheTtlMinutes, DEFAULT_X_SEARCH_CACHE_TTL_MINUTES),
    advancedConfig: buildXSearchAdvancedConfig(xSearchRoot),
  };
}

function getWebSearchNativeCodexRoot(root: JsonObject) {
  const searchRoot = readObject(readObject(readObject(root.tools)?.web)?.search);
  return readObject(searchRoot?.openaiCodex) || null;
}

function buildWebSearchNativeCodexAdvancedConfig(root: JsonObject) {
  const nextRoot = cloneJsonObject(root);
  delete nextRoot.enabled;
  delete nextRoot.mode;
  delete nextRoot.allowedDomains;
  delete nextRoot.contextSize;
  delete nextRoot.userLocation;

  return Object.keys(nextRoot).length > 0 ? stringifyJson5(nextRoot, 2) : '';
}

export function buildOpenClawWebSearchNativeCodexConfigSnapshot(
  root: JsonObject,
): OpenClawWebSearchNativeCodexConfigSnapshot {
  const openaiCodexRoot = getWebSearchNativeCodexRoot(root) || {};
  const userLocationRoot = readObject(openaiCodexRoot.userLocation) || {};

  return {
    enabled: readBoolean(openaiCodexRoot.enabled, false),
    mode: readScalar(openaiCodexRoot.mode) || DEFAULT_WEB_SEARCH_NATIVE_CODEX_MODE,
    allowedDomains: readStringArray(openaiCodexRoot.allowedDomains),
    contextSize: readScalar(openaiCodexRoot.contextSize),
    userLocation: {
      country: readScalar(userLocationRoot.country),
      city: readScalar(userLocationRoot.city),
      timezone: readScalar(userLocationRoot.timezone),
    },
    advancedConfig: buildWebSearchNativeCodexAdvancedConfig(openaiCodexRoot),
  };
}

function readWebFetchRoot(root: JsonObject) {
  return readObject(readObject(readObject(root.tools)?.web)?.fetch) || null;
}

function getPluginWebFetchConfigRoot(root: JsonObject) {
  return readObject(getPluginConfigRoot(root, 'firecrawl')?.webFetch) || null;
}

function buildWebFetchFallbackAdvancedConfig(root: JsonObject) {
  const nextRoot = cloneJsonObject(root);
  delete nextRoot.apiKey;
  delete nextRoot.baseUrl;

  return Object.keys(nextRoot).length > 0 ? stringifyJson5(nextRoot, 2) : '';
}

export function buildOpenClawWebFetchConfigSnapshot(
  root: JsonObject,
): OpenClawWebFetchConfigSnapshot {
  const fetchRoot = readWebFetchRoot(root) || {};
  const firecrawlRoot = getPluginWebFetchConfigRoot(root) || {};

  return {
    enabled: readBoolean(fetchRoot.enabled, true),
    maxChars: readNumber(fetchRoot.maxChars, DEFAULT_WEB_FETCH_MAX_CHARS),
    maxCharsCap: readNumber(fetchRoot.maxCharsCap, DEFAULT_WEB_FETCH_MAX_CHARS_CAP),
    maxResponseBytes: readNumber(
      fetchRoot.maxResponseBytes,
      DEFAULT_WEB_FETCH_MAX_RESPONSE_BYTES,
    ),
    timeoutSeconds: readNumber(fetchRoot.timeoutSeconds, DEFAULT_WEB_FETCH_TIMEOUT_SECONDS),
    cacheTtlMinutes: readNumber(
      fetchRoot.cacheTtlMinutes,
      DEFAULT_WEB_FETCH_CACHE_TTL_MINUTES,
    ),
    maxRedirects: readNumber(fetchRoot.maxRedirects, DEFAULT_WEB_FETCH_MAX_REDIRECTS),
    readability: readBoolean(fetchRoot.readability, true),
    userAgent: readScalar(fetchRoot.userAgent),
    fallbackProvider: {
      providerId: 'firecrawl',
      name: 'Firecrawl Fetch',
      description: 'Use Firecrawl as the OpenClaw web_fetch fallback provider.',
      apiKeySource: normalizeOpenClawSecretSource(readScalar(firecrawlRoot.apiKey)),
      baseUrl: readScalar(firecrawlRoot.baseUrl),
      advancedConfig: buildWebFetchFallbackAdvancedConfig(firecrawlRoot),
      supportsApiKey: true,
      supportsBaseUrl: true,
    },
  };
}

function ensurePluginWebFetchRoots(root: JsonObject) {
  const pluginsRoot = ensureObject(root, 'plugins');
  const entriesRoot = ensureObject(pluginsRoot, 'entries');
  const entryRoot = ensureObject(entriesRoot, 'firecrawl');
  const configRoot = ensureObject(entryRoot, 'config');
  const settingsRootKey = 'webFetch';

  return {
    pluginId: 'firecrawl',
    pluginsRoot,
    entriesRoot,
    entryRoot,
    configRoot,
    settingsRootKey,
    settingsRoot: ensureObject(configRoot, settingsRootKey),
  };
}

export function saveOpenClawXSearchConfigurationToConfigRoot(
  root: JsonObject,
  input: SaveOpenClawXSearchConfigurationDocumentInput,
) {
  const advancedRoot = parseJsonObjectText('Advanced Config', input.advancedConfig);
  const pluginsRoot = ensureObject(root, 'plugins');
  const entriesRoot = ensureObject(pluginsRoot, 'entries');
  const entryRoot = ensureObject(entriesRoot, 'xai');
  const configRoot = ensureObject(entryRoot, 'config');
  const webSearchRoot = ensureObject(configRoot, 'webSearch');
  const xSearchRoot = ensureObject(configRoot, 'xSearch');

  for (const key of Object.keys(xSearchRoot)) {
    delete xSearchRoot[key];
  }

  Object.assign(xSearchRoot, advancedRoot);
  xSearchRoot.enabled = input.enabled;
  xSearchRoot.inlineCitations = input.inlineCitations;
  setOptionalScalar(xSearchRoot, 'model', input.model);
  setOptionalWholeNumber(xSearchRoot, 'maxTurns', input.maxTurns);
  setOptionalFiniteNumber(xSearchRoot, 'timeoutSeconds', input.timeoutSeconds);
  setOptionalFiniteNumber(xSearchRoot, 'cacheTtlMinutes', input.cacheTtlMinutes);
  setOptionalScalar(
    webSearchRoot,
    'apiKey',
    serializeOpenClawSecretSource(input.apiKeySource),
  );

  const toolsRoot = readObject(root.tools);
  const webRoot = toolsRoot ? readObject(toolsRoot.web) : null;
  if (toolsRoot && webRoot) {
    delete webRoot.x_search;
    deleteIfEmptyObject(toolsRoot, 'web');
    deleteIfEmptyObject(root, 'tools');
  }

  deleteIfEmptyObject(configRoot, 'xSearch');
  deleteIfEmptyObject(configRoot, 'webSearch');
  deleteIfEmptyObject(entryRoot, 'config');
  deleteIfEmptyObject(entriesRoot, 'xai');
  deleteIfEmptyObject(pluginsRoot, 'entries');
  deleteIfEmptyObject(root, 'plugins');
}

export function saveOpenClawWebSearchNativeCodexConfigurationToConfigRoot(
  root: JsonObject,
  input: SaveOpenClawWebSearchNativeCodexConfigurationDocumentInput,
) {
  const advancedRoot = parseJsonObjectText('Advanced Config', input.advancedConfig);
  const toolsRoot = ensureObject(root, 'tools');
  const webRoot = ensureObject(toolsRoot, 'web');
  const searchRoot = ensureObject(webRoot, 'search');
  const openaiCodexRoot = ensureObject(searchRoot, 'openaiCodex');

  for (const key of Object.keys(openaiCodexRoot)) {
    delete openaiCodexRoot[key];
  }

  Object.assign(openaiCodexRoot, advancedRoot);
  openaiCodexRoot.enabled = input.enabled;
  setOptionalScalar(
    openaiCodexRoot,
    'mode',
    input.mode?.trim() || DEFAULT_WEB_SEARCH_NATIVE_CODEX_MODE,
  );
  setStringArray(openaiCodexRoot, 'allowedDomains', input.allowedDomains || []);
  setOptionalScalar(openaiCodexRoot, 'contextSize', input.contextSize);

  const userLocationRoot = ensureObject(openaiCodexRoot, 'userLocation');
  setOptionalScalar(userLocationRoot, 'country', input.userLocation?.country);
  setOptionalScalar(userLocationRoot, 'city', input.userLocation?.city);
  setOptionalScalar(userLocationRoot, 'timezone', input.userLocation?.timezone);
  deleteIfEmptyObject(openaiCodexRoot, 'userLocation');

  deleteIfEmptyObject(searchRoot, 'openaiCodex');
  deleteIfEmptyObject(webRoot, 'search');
  deleteIfEmptyObject(toolsRoot, 'web');
  deleteIfEmptyObject(root, 'tools');
}

export function saveOpenClawWebFetchConfigurationToConfigRoot(
  root: JsonObject,
  input: SaveOpenClawWebFetchConfigurationDocumentInput,
) {
  const toolsRoot = ensureObject(root, 'tools');
  const webRoot = ensureObject(toolsRoot, 'web');
  const fetchRoot = ensureObject(webRoot, 'fetch');

  fetchRoot.enabled = input.enabled;
  setOptionalFiniteNumber(fetchRoot, 'maxChars', input.maxChars);
  setOptionalFiniteNumber(fetchRoot, 'maxCharsCap', input.maxCharsCap);
  setOptionalFiniteNumber(fetchRoot, 'maxResponseBytes', input.maxResponseBytes);
  setOptionalFiniteNumber(fetchRoot, 'timeoutSeconds', input.timeoutSeconds);
  setOptionalFiniteNumber(fetchRoot, 'cacheTtlMinutes', input.cacheTtlMinutes);
  setOptionalFiniteNumber(fetchRoot, 'maxRedirects', input.maxRedirects);
  fetchRoot.readability = input.readability;
  setOptionalScalar(fetchRoot, 'userAgent', input.userAgent);

  const providerId = input.fallbackProviderConfig.providerId.trim().toLowerCase();
  if (providerId !== 'firecrawl') {
    throw new Error(
      `Unsupported OpenClaw web fetch fallback provider: ${input.fallbackProviderConfig.providerId}`,
    );
  }

  const advancedRoot = parseJsonObjectText(
    'Advanced Config',
    input.fallbackProviderConfig.advancedConfig,
  );
  const {
    pluginId,
    pluginsRoot,
    entriesRoot,
    entryRoot,
    configRoot,
    settingsRootKey,
    settingsRoot,
  } = ensurePluginWebFetchRoots(root);

  for (const key of Object.keys(settingsRoot)) {
    delete settingsRoot[key];
  }

  Object.assign(settingsRoot, advancedRoot);
  setOptionalScalar(
    settingsRoot,
    'apiKey',
    serializeOpenClawSecretSource(input.fallbackProviderConfig.apiKeySource),
  );
  setOptionalScalar(settingsRoot, 'baseUrl', input.fallbackProviderConfig.baseUrl);

  deleteIfEmptyObject(configRoot, settingsRootKey);
  deleteIfEmptyObject(entryRoot, 'config');
  deleteIfEmptyObject(entriesRoot, pluginId);
  deleteIfEmptyObject(pluginsRoot, 'entries');
  deleteIfEmptyObject(root, 'plugins');
}
