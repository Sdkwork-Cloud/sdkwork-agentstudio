import {
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
  normalizeLocalApiProxyLegacyProviderModelRef as normalizeLegacyProviderModelRef,
} from '@sdkwork/local-api-proxy';
import {
  listOpenClawAgentEntries,
  readOpenClawAgentModelConfig,
  writeOpenClawAgentModelConfig,
} from './openClawAgentDocumentService.ts';
import type {
  JsonArray,
  JsonObject,
  JsonValue,
} from './openClawConfigDocumentService.ts';
import { buildOpenClawProviderSnapshotsFromConfigRoot } from './openClawProviderSnapshotService.ts';

export interface OpenClawProviderEntryInConfigRoot {
  providersRoot: JsonObject;
  providerKey: string;
  providerRoot: JsonObject | null;
}

export interface OpenClawProviderCatalogDocumentModelInput {
  id: string;
  name: string;
}

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

function readArray(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function readScalar(value: unknown) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function normalizeProviderKey(providerId: string | undefined | null) {
  return normalizeLegacyProviderId(providerId).trim();
}

function normalizeModelRefString(value: string | undefined | null) {
  return normalizeLegacyProviderModelRef(value).trim();
}

export function buildOpenClawProviderModelRef(providerKey: string, modelId: string) {
  const normalizedProviderKey = normalizeProviderKey(providerKey);
  const normalizedModelRef = normalizeModelRefString(modelId);

  if (!normalizedModelRef) {
    return normalizedModelRef;
  }

  return normalizedModelRef.includes('/')
    ? normalizedModelRef
    : `${normalizedProviderKey}/${normalizedModelRef}`;
}

function updateModelRefInConfig(
  target: JsonObject,
  key: string,
  oldModelRef: string,
  nextModelRef: string,
) {
  const current = readOpenClawAgentModelConfig(target[key] as JsonValue | undefined);
  const nextPrimary = current.primary === oldModelRef ? nextModelRef : current.primary;
  const nextFallbacks = (current.fallbacks || []).map((entry) =>
    entry === oldModelRef ? nextModelRef : entry,
  );
  writeOpenClawAgentModelConfig(target, key, {
    primary: nextPrimary,
    fallbacks: nextFallbacks,
  });
}

function renameModelRefAcrossConfig(root: JsonObject, oldModelRef: string, nextModelRef: string) {
  const defaultsRoot = ensureObject(ensureObject(root, 'agents'), 'defaults');
  const catalogRoot = ensureObject(defaultsRoot, 'models');
  if (catalogRoot[oldModelRef] !== undefined) {
    catalogRoot[nextModelRef] = catalogRoot[oldModelRef];
    delete catalogRoot[oldModelRef];
  }

  updateModelRefInConfig(defaultsRoot, 'model', oldModelRef, nextModelRef);
  for (const entry of listOpenClawAgentEntries(root)) {
    updateModelRefInConfig(entry, 'model', oldModelRef, nextModelRef);
  }
}

function collectAvailableModelEntries(root: JsonObject) {
  const availableEntries = new Map<string, { alias: string; streaming: boolean }>();

  for (const provider of buildOpenClawProviderSnapshotsFromConfigRoot(root)) {
    for (const model of provider.models) {
      availableEntries.set(buildOpenClawProviderModelRef(provider.providerKey, model.id), {
        alias: model.name.trim() || model.id,
        streaming: model.role !== 'embedding',
      });
    }
  }

  return availableEntries;
}

function syncModelCatalog(root: JsonObject) {
  const defaultsRoot = ensureObject(ensureObject(root, 'agents'), 'defaults');
  const catalogRoot = ensureObject(defaultsRoot, 'models');
  const availableEntries = collectAvailableModelEntries(root);

  for (const key of Object.keys(catalogRoot)) {
    if (!availableEntries.has(key)) {
      delete catalogRoot[key];
    }
  }

  for (const [modelRef, metadata] of availableEntries.entries()) {
    const current = readObject(catalogRoot[modelRef]) || {};
    catalogRoot[modelRef] = {
      ...current,
      alias: readScalar(current.alias).trim() || metadata.alias,
      streaming:
        typeof current.streaming === 'boolean' ? current.streaming : metadata.streaming,
    };
  }

  deleteIfEmptyObject(defaultsRoot, 'models');
}

function sanitizeModelConfig(
  value: JsonValue | undefined,
  availableModelRefs: Set<string>,
  fallbackPrimary?: string,
) {
  const modelConfig = readOpenClawAgentModelConfig(value);
  const fallbacks = [...new Set(
    (modelConfig.fallbacks || []).filter((entry) => availableModelRefs.has(entry)),
  )];
  let primary =
    modelConfig.primary && availableModelRefs.has(modelConfig.primary)
      ? modelConfig.primary
      : undefined;

  if (primary) {
    return {
      primary,
      fallbacks: fallbacks.filter((entry) => entry !== primary),
    };
  }

  if (fallbacks.length > 0) {
    primary = fallbacks[0];
    return {
      primary,
      fallbacks: fallbacks.slice(1).filter((entry) => entry !== primary),
    };
  }

  if (fallbackPrimary && availableModelRefs.has(fallbackPrimary)) {
    return {
      primary: fallbackPrimary,
      fallbacks: [],
    };
  }

  return {
    fallbacks: [],
  };
}

function pruneModelReferences(root: JsonObject) {
  const availableModelRefs = new Set(collectAvailableModelEntries(root).keys());
  const agentsRoot = ensureObject(root, 'agents');
  const defaultsRoot = ensureObject(agentsRoot, 'defaults');
  const firstAvailableModelRef = [...availableModelRefs][0];
  const nextDefaultsModel = sanitizeModelConfig(
    defaultsRoot.model,
    availableModelRefs,
    firstAvailableModelRef,
  );

  writeOpenClawAgentModelConfig(defaultsRoot, 'model', nextDefaultsModel);
  const defaultPrimary = nextDefaultsModel.primary;

  for (const entry of listOpenClawAgentEntries(root)) {
    const nextAgentModel = sanitizeModelConfig(entry.model, availableModelRefs, defaultPrimary);
    if (!nextAgentModel.primary && nextAgentModel.fallbacks.length === 0) {
      delete entry.model;
      continue;
    }

    writeOpenClawAgentModelConfig(entry, 'model', nextAgentModel);
  }

  deleteIfEmptyObject(defaultsRoot, 'model');
  deleteIfEmptyObject(agentsRoot, 'defaults');
}

function listProviderModelEntries(providerRoot: JsonObject) {
  return readArray(providerRoot.models).filter((entry): entry is JsonObject => isJsonObject(entry));
}

export function resolveOpenClawProviderEntryInConfigRoot(
  root: JsonObject,
  providerId: string,
): OpenClawProviderEntryInConfigRoot {
  const providersRoot = ensureObject(ensureObject(root, 'models'), 'providers');
  const providerKey = normalizeProviderKey(providerId);
  const providerRoot = readObject(providersRoot[providerKey]);

  return {
    providersRoot,
    providerKey,
    providerRoot,
  };
}

export function listOpenClawProviderModelEntries(providerRoot: JsonObject) {
  return listProviderModelEntries(providerRoot);
}

export function reconcileOpenClawProviderModelCatalogInConfigRoot(root: JsonObject) {
  syncModelCatalog(root);
  pruneModelReferences(root);
}

export function pruneOpenClawProviderModelReferencesInConfigRoot(root: JsonObject) {
  pruneModelReferences(root);
}

export function createOpenClawProviderModelInConfigRoot(input: {
  root: JsonObject;
  providerId: string;
  model: OpenClawProviderCatalogDocumentModelInput;
}) {
  const { providerRoot } = resolveOpenClawProviderEntryInConfigRoot(input.root, input.providerId);
  if (!providerRoot) {
    throw new Error(`OpenClaw provider "${input.providerId}" was not found.`);
  }

  const nextModelId = input.model.id.trim();
  if (listProviderModelEntries(providerRoot).some((entry) => readScalar(entry.id).trim() === nextModelId)) {
    throw new Error(`Model "${input.model.id}" already exists for provider "${input.providerId}".`);
  }

  providerRoot.models = [
    ...listProviderModelEntries(providerRoot),
    {
      id: nextModelId,
      name: input.model.name.trim() || nextModelId,
    },
  ] as JsonArray;
  reconcileOpenClawProviderModelCatalogInConfigRoot(input.root);
}

export function updateOpenClawProviderModelInConfigRoot(input: {
  root: JsonObject;
  providerId: string;
  modelId: string;
  model: OpenClawProviderCatalogDocumentModelInput;
}) {
  const { providerKey, providerRoot } = resolveOpenClawProviderEntryInConfigRoot(
    input.root,
    input.providerId,
  );
  if (!providerRoot) {
    throw new Error(`OpenClaw provider "${input.providerId}" was not found.`);
  }

  const models = listProviderModelEntries(providerRoot);
  const normalizedModelId = input.modelId.trim();
  const target = models.find((entry) => readScalar(entry.id).trim() === normalizedModelId);
  if (!target) {
    throw new Error(`Model "${input.modelId}" was not found for provider "${input.providerId}".`);
  }

  const nextModelId = input.model.id.trim();
  if (
    nextModelId !== normalizedModelId &&
    models.some((entry) => readScalar(entry.id).trim() === nextModelId)
  ) {
    throw new Error(`Model "${nextModelId}" already exists for provider "${input.providerId}".`);
  }

  const previousModelRef = buildOpenClawProviderModelRef(providerKey, normalizedModelId);
  const nextModelRef = buildOpenClawProviderModelRef(providerKey, nextModelId);
  target.id = nextModelId;
  target.name = input.model.name.trim() || nextModelId;

  if (previousModelRef !== nextModelRef) {
    renameModelRefAcrossConfig(input.root, previousModelRef, nextModelRef);
  }

  reconcileOpenClawProviderModelCatalogInConfigRoot(input.root);
  const catalogRoot = readObject(readObject(readObject(input.root.agents)?.defaults)?.models);
  const nextCatalogEntry = readObject(catalogRoot?.[nextModelRef]);
  if (nextCatalogEntry) {
    nextCatalogEntry.alias = target.name;
  }
}

export function deleteOpenClawProviderModelFromConfigRoot(input: {
  root: JsonObject;
  providerId: string;
  modelId: string;
}) {
  const { providerRoot } = resolveOpenClawProviderEntryInConfigRoot(input.root, input.providerId);
  if (!providerRoot) {
    throw new Error(`OpenClaw provider "${input.providerId}" was not found.`);
  }

  providerRoot.models = listProviderModelEntries(providerRoot).filter(
    (entry) => readScalar(entry.id).trim() !== input.modelId.trim(),
  ) as JsonArray;
  reconcileOpenClawProviderModelCatalogInConfigRoot(input.root);
}

export function deleteOpenClawProviderFromConfigRoot(input: {
  root: JsonObject;
  providerId: string;
}) {
  const { providersRoot, providerKey } = resolveOpenClawProviderEntryInConfigRoot(
    input.root,
    input.providerId,
  );
  delete providersRoot[providerKey];
  reconcileOpenClawProviderModelCatalogInConfigRoot(input.root);
}
