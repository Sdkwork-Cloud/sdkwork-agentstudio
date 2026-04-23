import {
  normalizeLocalApiProxyLegacyProviderModelRef as normalizeLegacyProviderModelRef,
} from '@sdkwork/local-api-proxy';
import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from './openClawConfigDocumentService.ts';
import { normalizeOpenClawLegacyManagedPath } from './openClawAgentPathStandardizationService.ts';

export type OpenClawAgentParamValue = string | number | boolean;

export interface OpenClawAgentModelConfig {
  primary?: string;
  fallbacks?: string[];
}

export interface OpenClawAgentDocumentInput {
  id: string;
  name?: string;
  avatar?: string;
  isDefault?: boolean;
  model?: string | OpenClawAgentModelConfig | null;
  params?: Record<string, OpenClawAgentParamValue | null | undefined>;
  workspace?: string;
  agentDir?: string;
}

export const OPENCLAW_DEFAULT_AGENT_ID = 'main';

const VALID_AGENT_ID_RE = /^[a-z0-9](?:[a-z0-9._-]{0,63})$/;
const INVALID_AGENT_ID_CHARS_RE = /[^a-z0-9._-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

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

function ensureArray(parent: JsonObject, key: string): JsonArray {
  const current = parent[key];
  if (!Array.isArray(current)) {
    parent[key] = [];
  }

  return parent[key] as JsonArray;
}

function deleteIfEmptyObject(parent: JsonObject, key: string) {
  const current = readObject(parent[key]);
  if (current && Object.keys(current).length === 0) {
    delete parent[key];
  }
}

function setOptionalScalar(target: JsonObject, key: string, value: string | undefined) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    delete target[key];
    return;
  }

  target[key] = normalized;
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

export function normalizeOpenClawAgentId(value: string | undefined | null) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return OPENCLAW_DEFAULT_AGENT_ID;
  }

  if (VALID_AGENT_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return (
    trimmed
      .toLowerCase()
      .replace(INVALID_AGENT_ID_CHARS_RE, '-')
      .replace(LEADING_DASH_RE, '')
      .replace(TRAILING_DASH_RE, '')
      .slice(0, 64) || OPENCLAW_DEFAULT_AGENT_ID
  );
}

function normalizeModelRefString(value: string | undefined | null) {
  return normalizeLegacyProviderModelRef(value).trim();
}

export function readOpenClawAgentModelConfig(value: JsonValue | undefined): OpenClawAgentModelConfig {
  if (typeof value === 'string') {
    return {
      primary: normalizeModelRefString(value),
      fallbacks: [],
    };
  }

  if (!isJsonObject(value)) {
    return {
      fallbacks: [],
    };
  }

  const primary = normalizeModelRefString(readScalar(value.primary).trim()) || undefined;
  const fallbacks = readArray(value.fallbacks)
    .map((entry) => normalizeModelRefString(readScalar(entry).trim()))
    .filter(Boolean);

  return {
    primary,
    fallbacks,
  };
}

export function writeOpenClawAgentModelConfig(
  target: JsonObject,
  key: string,
  value: string | OpenClawAgentModelConfig | null | undefined,
) {
  if (value == null) {
    delete target[key];
    return;
  }

  const config = typeof value === 'string' ? { primary: value, fallbacks: [] } : value;
  const primary = normalizeModelRefString(config.primary?.trim()) || '';
  const fallbacks = (config.fallbacks || [])
    .map((entry) => normalizeModelRefString(entry.trim()))
    .filter(Boolean);

  if (!primary && fallbacks.length === 0) {
    delete target[key];
    return;
  }

  const nextConfig: JsonObject = {};
  if (primary) {
    nextConfig.primary = primary;
  }
  if (fallbacks.length > 0) {
    nextConfig.fallbacks = [...new Set(fallbacks)] as JsonArray;
  }

  target[key] = nextConfig;
}

export function readOpenClawAgentParams(
  value: JsonValue | undefined,
): Record<string, OpenClawAgentParamValue> {
  if (!isJsonObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
        ? [[key, entry]]
        : [],
    ),
  );
}

export function writeOpenClawAgentParams(
  target: JsonObject,
  params?: Record<string, OpenClawAgentParamValue | null | undefined>,
) {
  if (!params) {
    return;
  }

  const nextParams = Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) =>
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? [[key, value]]
        : [],
    ),
  );

  if (Object.keys(nextParams).length === 0) {
    delete target.params;
    return;
  }

  target.params = nextParams;
}

export function listOpenClawAgentEntries(root: JsonObject) {
  const agentList = readObject(root.agents)?.list;
  return readArray(agentList).filter((entry): entry is JsonObject => isJsonObject(entry));
}

export function resolveOpenClawDefaultAgentId(root: JsonObject) {
  const agentList = listOpenClawAgentEntries(root);
  if (agentList.length === 0) {
    return OPENCLAW_DEFAULT_AGENT_ID;
  }

  const defaultEntry =
    agentList.find((entry) => entry.default === true) || agentList[0];

  return normalizeOpenClawAgentId(readScalar(defaultEntry?.id));
}

export function ensureSingleDefaultOpenClawAgent(root: JsonObject) {
  const agentsRoot = ensureObject(root, 'agents');
  const agentList = ensureArray(agentsRoot, 'list');
  const entries = agentList.filter((entry): entry is JsonObject => isJsonObject(entry));
  if (entries.length === 0) {
    return;
  }

  const defaultIndex = entries.findIndex((entry) => entry.default === true);
  const normalizedDefaultIndex = defaultIndex >= 0 ? defaultIndex : 0;

  entries.forEach((entry, index) => {
    entry.default = index === normalizedDefaultIndex;
  });

  agentList.length = 0;
  for (const entry of entries) {
    agentList.push(entry);
  }
}

export function saveOpenClawAgentToConfigRoot(root: JsonObject, input: OpenClawAgentDocumentInput) {
  const agentList = ensureArray(ensureObject(root, 'agents'), 'list');
  const normalizedId = normalizeOpenClawAgentId(input.id);
  const existingIndex = agentList.findIndex(
    (entry) => isJsonObject(entry) && normalizeOpenClawAgentId(readScalar(entry.id)) === normalizedId,
  );
  const currentEntry =
    existingIndex >= 0 && isJsonObject(agentList[existingIndex])
      ? (agentList[existingIndex] as JsonObject)
      : {};

  currentEntry.id = normalizedId;
  setOptionalScalar(currentEntry, 'name', input.name);
  if (input.workspace !== undefined) {
    setOptionalScalar(currentEntry, 'workspace', normalizeOpenClawLegacyManagedPath(input.workspace));
  }
  if (input.agentDir !== undefined) {
    setOptionalScalar(currentEntry, 'agentDir', normalizeOpenClawLegacyManagedPath(input.agentDir));
  }
  if (input.model !== undefined) {
    writeOpenClawAgentModelConfig(currentEntry, 'model', input.model);
  }
  if (input.params !== undefined) {
    writeOpenClawAgentParams(currentEntry, input.params);
  }
  if (input.avatar !== undefined) {
    const identityRoot = ensureObject(currentEntry, 'identity');
    setOptionalScalar(identityRoot, 'emoji', input.avatar);
    deleteIfEmptyObject(currentEntry, 'identity');
  }
  if (typeof input.isDefault === 'boolean') {
    currentEntry.default = input.isDefault;
  }

  if (existingIndex >= 0) {
    agentList[existingIndex] = currentEntry;
  } else {
    agentList.push(currentEntry);
  }

  if (input.isDefault) {
    for (const entry of listOpenClawAgentEntries(root)) {
      entry.default = normalizeOpenClawAgentId(readScalar(entry.id)) === normalizedId;
    }
  }

  ensureSingleDefaultOpenClawAgent(root);
}

export function deleteOpenClawAgentFromConfigRoot(root: JsonObject, agentId: string) {
  const agentsRoot = ensureObject(root, 'agents');
  const agentList = ensureArray(agentsRoot, 'list');
  const normalizedId = normalizeOpenClawAgentId(agentId);
  const nextEntries = agentList.filter(
    (entry) => !isJsonObject(entry) || normalizeOpenClawAgentId(readScalar(entry.id)) !== normalizedId,
  );

  agentList.length = 0;
  for (const entry of nextEntries) {
    agentList.push(entry);
  }

  ensureSingleDefaultOpenClawAgent(root);
}
