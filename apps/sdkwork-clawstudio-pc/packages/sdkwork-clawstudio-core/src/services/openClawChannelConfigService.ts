import {
  OPENCLAW_BUNDLED_CHANNEL_IDS,
  OPENCLAW_CHANNEL_CONFIG_META_KEYS,
  findOpenClawChannelDefinition as findSharedOpenClawChannelDefinition,
  listOpenClawChannelDefinitions as listSharedOpenClawChannelDefinitions,
  type OpenClawChannelFieldDefinition,
} from '@sdkwork/clawstudio-types';
import { parseJson5 } from '@sdkwork/local-api-proxy';
import {
  mutateOpenClawConfigDocument,
  type JsonArray,
  type JsonObject,
  type JsonValue,
} from './openClawConfigDocumentService.ts';

export type { OpenClawChannelDefinition, OpenClawChannelFieldDefinition } from '@sdkwork/clawstudio-types';

export const listOpenClawChannelDefinitions = listSharedOpenClawChannelDefinitions;
export const findOpenClawChannelDefinition = findSharedOpenClawChannelDefinition;

export interface OpenClawChannelSnapshot {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  configurationMode: 'required' | 'none';
  fieldCount: number;
  configuredFieldCount: number;
  setupSteps: string[];
  values: Record<string, string>;
  fields: OpenClawChannelFieldDefinition[];
}

export interface SaveOpenClawChannelConfigurationDocumentInput {
  channelId: string;
  values: Record<string, string>;
  enabled?: boolean;
}

const OPENCLAW_CHANNEL_CONFIG_META_KEY_SET = new Set<string>(OPENCLAW_CHANNEL_CONFIG_META_KEYS);
const OPENCLAW_SUPPORTED_CHANNEL_ID_SET = new Set<string>(OPENCLAW_BUNDLED_CHANNEL_IDS);
const LEGACY_QQ_CHANNEL_ID = 'qq';
const CANONICAL_QQBOT_CHANNEL_ID = 'qqbot';

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
  const value = parent[key];
  if (isJsonObject(value) && Object.keys(value).length === 0) {
    delete parent[key];
  }
}

function hasOwn(object: JsonObject, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
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

function parseChannelStringArrayValue(
  field: OpenClawChannelFieldDefinition,
  value: string,
): JsonArray {
  const normalized = value.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.startsWith('[')) {
    const parsed = parseJson5<JsonValue>(normalized);
    if (!Array.isArray(parsed)) {
      throw new Error(`${field.label} must be a JSON array.`);
    }

    return parsed
      .map((entry) => (entry == null ? '' : String(entry).trim()))
      .filter(Boolean);
  }

  return normalized
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseChannelJsonObjectValue(
  field: OpenClawChannelFieldDefinition,
  value: string,
): JsonObject {
  const parsed = parseJson5<JsonValue>(value);
  if (!isJsonObject(parsed)) {
    throw new Error(`${field.label} must be a JSON object.`);
  }

  return parsed;
}

function parseChannelJsonValue(
  field: OpenClawChannelFieldDefinition,
  value: string,
): JsonValue {
  try {
    return parseJson5<JsonValue>(value);
  } catch (error) {
    throw new Error(
      `${field.label} must be valid JSON or JSON5: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function setOptionalChannelField(
  target: JsonObject,
  field: OpenClawChannelFieldDefinition,
  value: string | undefined,
) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    delete target[field.key];
    return;
  }

  if (field.storageFormat === 'stringArray') {
    target[field.key] = parseChannelStringArrayValue(field, normalized);
    return;
  }

  if (field.storageFormat === 'jsonObject') {
    target[field.key] = parseChannelJsonObjectValue(field, normalized);
    return;
  }

  if (field.storageFormat === 'jsonValue') {
    target[field.key] = parseChannelJsonValue(field, normalized);
    return;
  }

  target[field.key] = normalized;
}

function countConfiguredChannelFields(
  channelRoot: JsonObject,
  fields: OpenClawChannelFieldDefinition[],
) {
  return fields.filter((field) => Boolean(readScalar(channelRoot[field.key]).trim())).length;
}

function removeChannelConfigIfEmptyAndDisabled(
  root: JsonObject,
  channelsRoot: JsonObject,
  channelId: string,
) {
  const channelRoot = readObject(channelsRoot[channelId]);
  if (!channelRoot || channelRoot.enabled !== false) {
    return false;
  }

  if (Object.keys(channelRoot).some((key) => key !== 'enabled')) {
    return false;
  }

  delete channelsRoot[channelId];
  deleteIfEmptyObject(root, 'channels');
  return true;
}

function canMigrateLegacyQqChannel() {
  return OPENCLAW_SUPPORTED_CHANNEL_ID_SET.has(CANONICAL_QQBOT_CHANNEL_ID);
}

function migrateLegacyQqChannelRoot(channelsRoot: JsonObject) {
  if (
    !canMigrateLegacyQqChannel() ||
    !hasOwn(channelsRoot, LEGACY_QQ_CHANNEL_ID) ||
    hasOwn(channelsRoot, CANONICAL_QQBOT_CHANNEL_ID)
  ) {
    return false;
  }

  channelsRoot[CANONICAL_QQBOT_CHANNEL_ID] = channelsRoot[LEGACY_QQ_CHANNEL_ID];
  delete channelsRoot[LEGACY_QQ_CHANNEL_ID];
  return true;
}

function migrateLegacyQqModelMapping(modelByChannelRoot: JsonObject) {
  if (
    !canMigrateLegacyQqChannel() ||
    !hasOwn(modelByChannelRoot, LEGACY_QQ_CHANNEL_ID) ||
    hasOwn(modelByChannelRoot, CANONICAL_QQBOT_CHANNEL_ID)
  ) {
    return false;
  }

  modelByChannelRoot[CANONICAL_QQBOT_CHANNEL_ID] = modelByChannelRoot[LEGACY_QQ_CHANNEL_ID];
  delete modelByChannelRoot[LEGACY_QQ_CHANNEL_ID];
  return true;
}

export function pruneRetiredOpenClawChannelConfigFromRoot(root: JsonObject) {
  const channelsRoot = readObject(root.channels);
  if (!channelsRoot) {
    if (hasOwn(root, 'channels')) {
      delete root.channels;
      return true;
    }

    return false;
  }

  let changed = false;
  changed = migrateLegacyQqChannelRoot(channelsRoot) || changed;
  for (const channelId of Object.keys(channelsRoot)) {
    if (OPENCLAW_CHANNEL_CONFIG_META_KEY_SET.has(channelId)) {
      continue;
    }

    if (OPENCLAW_SUPPORTED_CHANNEL_ID_SET.has(channelId) && readObject(channelsRoot[channelId])) {
      continue;
    }

    delete channelsRoot[channelId];
    changed = true;
  }

  const defaultsRoot = readObject(channelsRoot.defaults);
  if (!defaultsRoot && hasOwn(channelsRoot, 'defaults')) {
    delete channelsRoot.defaults;
    changed = true;
  }

  const modelByChannelRoot = readObject(channelsRoot.modelByChannel);
  if (modelByChannelRoot) {
    changed = migrateLegacyQqModelMapping(modelByChannelRoot) || changed;
    for (const channelId of Object.keys(modelByChannelRoot)) {
      if (!OPENCLAW_SUPPORTED_CHANNEL_ID_SET.has(channelId)) {
        delete modelByChannelRoot[channelId];
        changed = true;
        continue;
      }

      const channelModelOverrides = readObject(modelByChannelRoot[channelId]);
      if (!channelModelOverrides) {
        delete modelByChannelRoot[channelId];
        changed = true;
        continue;
      }

      for (const overrideKey of Object.keys(channelModelOverrides)) {
        if (typeof channelModelOverrides[overrideKey] === 'string') {
          continue;
        }

        delete channelModelOverrides[overrideKey];
        changed = true;
      }

      if (Object.keys(channelModelOverrides).length === 0) {
        delete modelByChannelRoot[channelId];
        changed = true;
      }
    }

    if (Object.keys(modelByChannelRoot).length === 0) {
      delete channelsRoot.modelByChannel;
      changed = true;
    }
  } else if (hasOwn(channelsRoot, 'modelByChannel')) {
    delete channelsRoot.modelByChannel;
    changed = true;
  }

  if (Object.keys(channelsRoot).length === 0) {
    delete root.channels;
    changed = true;
  }

  return changed;
}

export function buildOpenClawChannelSnapshotsFromConfigRoot(
  root: JsonObject,
): OpenClawChannelSnapshot[] {
  const channelsRoot =
    root.channels && typeof root.channels === 'object' && !Array.isArray(root.channels)
      ? (root.channels as JsonObject)
      : {};

  return listOpenClawChannelDefinitions().map((definition) => {
    const channelConfig =
      channelsRoot[definition.id] &&
      typeof channelsRoot[definition.id] === 'object' &&
      !Array.isArray(channelsRoot[definition.id])
        ? (channelsRoot[definition.id] as JsonObject)
        : {};
    const configurationMode = definition.configurationMode || 'required';
    const values = Object.fromEntries(
      definition.fields.map((field) => [field.key, readScalar(channelConfig[field.key])]),
    );
    const configuredFieldCount = definition.fields.filter((field) => Boolean(values[field.key])).length;
    const enabled = Boolean(
      channelConfig.enabled ?? (configurationMode === 'none' ? true : configuredFieldCount > 0),
    );
    const status =
      configurationMode === 'none'
        ? enabled
          ? 'connected'
          : 'disconnected'
        : configuredFieldCount === 0
          ? 'not_configured'
          : enabled
            ? 'connected'
            : 'disconnected';

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      status,
      enabled,
      configurationMode,
      fieldCount: definition.fields.length,
      configuredFieldCount,
      setupSteps: [...definition.setupSteps],
      values,
      fields: definition.fields.map((field) => ({ ...field })),
    };
  });
}

export function saveOpenClawChannelConfigurationToConfigRoot(
  root: JsonObject,
  input: SaveOpenClawChannelConfigurationDocumentInput,
) {
  const definition = findOpenClawChannelDefinition(input.channelId);

  if (!definition) {
    throw new Error(`Unsupported OpenClaw channel: ${input.channelId}`);
  }

  const channelsRoot = ensureObject(root, 'channels');
  const channelRoot = ensureObject(channelsRoot, input.channelId);

  for (const field of definition.fields) {
    setOptionalChannelField(channelRoot, field, input.values[field.key]);
  }

  const configuredFieldCount = countConfiguredChannelFields(channelRoot, definition.fields);
  const nextEnabled =
    input.enabled ?? ((definition.configurationMode || 'required') === 'none' ? true : configuredFieldCount > 0);

  channelRoot.enabled = nextEnabled;
  if (removeChannelConfigIfEmptyAndDisabled(root, channelsRoot, input.channelId)) {
    return;
  }
}

export function setOpenClawChannelEnabledInDocument(
  raw: string,
  input: {
    channelId: string;
    enabled: boolean;
  },
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    setOpenClawChannelEnabledInConfigRoot(root, input);
  });
}

export function setOpenClawChannelEnabledInConfigRoot(
  root: JsonObject,
  input: {
    channelId: string;
    enabled: boolean;
  },
) {
  const definition = findOpenClawChannelDefinition(input.channelId);
  if (!definition) {
    throw new Error(`Unsupported OpenClaw channel: ${input.channelId}`);
  }

  const channelsRoot = ensureObject(root, 'channels');
  const channelRoot = ensureObject(channelsRoot, input.channelId);
  channelRoot.enabled = input.enabled;
  removeChannelConfigIfEmptyAndDisabled(root, channelsRoot, input.channelId);
}
