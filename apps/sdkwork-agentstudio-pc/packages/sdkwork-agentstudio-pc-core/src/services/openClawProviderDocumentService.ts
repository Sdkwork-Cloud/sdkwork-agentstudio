import {
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
  normalizeLocalApiProxyLegacyProviderModelRef as normalizeLegacyProviderModelRef,
} from '@sdkwork/local-api-proxy';
import type { JsonObject, JsonValue } from './openClawConfigDocumentService.ts';
import { buildOpenClawProviderModelRef } from './openClawProviderCatalogDocumentService.ts';
import { resolveOpenClawProviderAdapter } from './openClawProviderDescriptorService.ts';
import { serializeOpenClawProviderApiKeySource } from './openClawProviderFormatService.ts';
import { normalizeOpenClawProviderEndpoint } from './openClawProviderFormatService.ts';
import {
  resolveOpenClawProviderDocumentModelCatalogState,
  type OpenClawProviderDocumentModelCatalogState,
} from './openClawProviderModelCatalogService.ts';
import {
  writeOpenClawProviderRuntimeConfigToConfigRoot,
  type OpenClawProviderRuntimeConfig,
} from './openClawProviderRuntimeConfigService.ts';

export interface OpenClawProviderDocumentModelInput {
  id: string;
  name: string;
}

export interface OpenClawProviderDocumentInput {
  id: string;
  channelId: string;
  apiKey: string;
  baseUrl: string;
  models: readonly OpenClawProviderDocumentModelInput[];
  config?: Partial<OpenClawProviderRuntimeConfig> | null;
}

export interface OpenClawProviderDocumentSelection {
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
}

export interface OpenClawProviderDocumentWriteResult {
  providerKey: string;
  providerRoot: JsonObject;
  modelCatalogState: OpenClawProviderDocumentModelCatalogState;
}

interface OpenClawProviderDocumentModelConfig {
  primary?: string;
  fallbacks?: string[];
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (!isJsonObject(current)) {
    parent[key] = {};
  }

  return parent[key] as JsonObject;
}

function normalizeProviderKey(providerId: string | undefined | null) {
  return normalizeLegacyProviderId(providerId).trim();
}

function normalizeModelRefString(value: string | undefined | null) {
  return normalizeLegacyProviderModelRef(value).trim();
}

function writeModelConfig(
  target: JsonObject,
  key: string,
  value: OpenClawProviderDocumentModelConfig | null | undefined,
) {
  if (!value) {
    delete target[key];
    return;
  }

  const primary = normalizeModelRefString(value.primary);
  const fallbacks = (value.fallbacks || [])
    .map((entry) => normalizeModelRefString(entry))
    .filter(Boolean);

  if (!primary && fallbacks.length === 0) {
    delete target[key];
    return;
  }

  const nextModelConfig: JsonObject = {};
  if (primary) {
    nextModelConfig.primary = primary;
  }
  if (fallbacks.length > 0) {
    nextModelConfig.fallbacks = [...new Set(fallbacks)] as JsonValue;
  }

  target[key] = nextModelConfig;
}

export function clearLegacyOpenClawProviderRuntimeConfig(providerRoot: JsonObject) {
  delete providerRoot.temperature;
  delete providerRoot.topP;
  delete providerRoot.maxTokens;
  delete providerRoot.timeoutMs;
  delete providerRoot.streaming;
}

export function canonicalizeManagedLocalProxyProvidersInConfigRoot(
  root: JsonObject,
  providerId: string,
) {
  const providersRoot = ensureObject(ensureObject(root, 'models'), 'providers');
  const managedProviderKey = normalizeProviderKey(providerId);

  for (const providerKey of Object.keys(providersRoot)) {
    if (providerKey !== managedProviderKey) {
      delete providersRoot[providerKey];
    }
  }
}

export function writeOpenClawProviderConfigToConfigRoot(input: {
  root: JsonObject;
  provider: OpenClawProviderDocumentInput;
  selection: OpenClawProviderDocumentSelection;
  overwriteDefaults?: boolean;
}): OpenClawProviderDocumentWriteResult {
  const modelsRoot = ensureObject(input.root, 'models');
  const providersRoot = ensureObject(modelsRoot, 'providers');
  const agentsRoot = ensureObject(input.root, 'agents');
  const defaultsRoot = ensureObject(agentsRoot, 'defaults');
  const providerKey = normalizeProviderKey(input.provider.id);
  const providerRoot = ensureObject(providersRoot, providerKey);
  const adapter = resolveOpenClawProviderAdapter(input.provider.channelId);
  const modelCatalogState = resolveOpenClawProviderDocumentModelCatalogState({
    models: input.provider.models,
    selection: {
      defaultModelId: input.selection.defaultModelId,
      reasoningModelId: input.selection.reasoningModelId,
      embeddingModelId: input.selection.embeddingModelId,
    },
  });

  providerRoot.baseUrl = normalizeOpenClawProviderEndpoint(input.provider.baseUrl);
  providerRoot.apiKey = serializeOpenClawProviderApiKeySource(input.provider.apiKey);
  providerRoot.api = adapter.api;
  providerRoot.auth = adapter.auth;
  clearLegacyOpenClawProviderRuntimeConfig(providerRoot);
  providerRoot.models = modelCatalogState.models.map((model) => ({
    id: model.id,
    name: model.name,
    api: model.api,
    reasoning: model.reasoning,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
  })) as JsonValue;

  if (input.overwriteDefaults !== false) {
    writeModelConfig(defaultsRoot, 'model', {
      primary: buildOpenClawProviderModelRef(
        providerKey,
        modelCatalogState.selection.defaultModelId,
      ),
      fallbacks: modelCatalogState.selection.reasoningModelId
        ? [
            buildOpenClawProviderModelRef(
              providerKey,
              modelCatalogState.selection.reasoningModelId,
            ),
          ]
        : [],
    });
  }

  writeOpenClawProviderRuntimeConfigToConfigRoot({
    root: input.root,
    providerKey,
    modelId: modelCatalogState.selection.defaultModelId,
    providerRoot,
    config: input.provider.config,
  });

  return {
    providerKey,
    providerRoot,
    modelCatalogState,
  };
}
