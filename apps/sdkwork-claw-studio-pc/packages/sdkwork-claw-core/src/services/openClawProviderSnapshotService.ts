import {
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
  normalizeLocalApiProxyLegacyProviderModelRef as normalizeLegacyProviderModelRef,
} from '@sdkwork/local-api-proxy';
import { readOpenClawAgentModelConfig } from './openClawAgentDocumentService.ts';
import type { JsonObject, JsonValue } from './openClawConfigDocumentService.ts';
import {
  getOpenClawProviderIcon,
  titleizeOpenClawProviderKey,
} from './openClawProviderDescriptorService.ts';
import { normalizeOpenClawProviderEndpoint } from './openClawProviderFormatService.ts';
import {
  resolveOpenClawProviderSnapshotModelCatalogState,
} from './openClawProviderModelCatalogService.ts';
import type { OpenClawProviderRuntimeConfig } from './openClawProviderRuntimeConfigService.ts';
import { readOpenClawProviderRuntimeConfigFromConfigRoot } from './openClawProviderRuntimeConfigService.ts';
import { normalizeOpenClawSecretSource } from './openClawSecretFormatService.ts';

export interface OpenClawProviderSnapshot {
  id: string;
  providerKey: string;
  name: string;
  provider: string;
  endpoint: string;
  apiKeySource: string;
  status: 'ready' | 'degraded' | 'configurationRequired';
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  description: string;
  icon: string;
  lastCheckedAt: string;
  capabilities: string[];
  models: Array<{
    id: string;
    name: string;
    role: 'primary' | 'reasoning' | 'embedding' | 'fallback';
    contextWindow: string;
  }>;
  config: OpenClawProviderRuntimeConfig;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readObject(value: unknown) {
  return isJsonObject(value) ? value : null;
}

function readArray(value: unknown) {
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
  return normalizeLegacyProviderId(providerId);
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

function buildOpenClawProviderSnapshots(
  root: JsonObject,
  options: {
    lastCheckedAt?: string;
  } = {},
): OpenClawProviderSnapshot[] {
  const providersRoot = readObject(readObject(root.models)?.providers) || {};
  const defaultsRoot = readObject(readObject(root.agents)?.defaults) || {};
  const defaultsModel = readOpenClawAgentModelConfig(defaultsRoot.model as JsonValue | undefined);
  const primaryRef = parseModelRef(defaultsModel.primary as JsonValue | undefined);
  const fallbackRefs = (defaultsModel.fallbacks || [])
    .map((entry) => parseModelRef(entry as JsonValue | undefined))
    .filter((entry): entry is { providerKey: string; modelId: string } => Boolean(entry));
  const lastCheckedAt = options.lastCheckedAt || new Date().toISOString();

  return Object.entries(providersRoot).flatMap(([rawProviderKey, rawProvider]) => {
    if (!isJsonObject(rawProvider)) {
      return [];
    }

    const providerKey = normalizeProviderKey(rawProviderKey);
    const rawModels = readArray(rawProvider.models).filter((entry): entry is JsonObject =>
      isJsonObject(entry),
    );
    if (!providerKey || rawModels.length === 0) {
      return [];
    }

    const defaultModelId =
      primaryRef?.providerKey === providerKey ? primaryRef.modelId : readScalar(rawModels[0]?.id);
    const reasoningFallback = fallbackRefs.find((entry) => entry.providerKey === providerKey);
    const normalizedModelCatalogState = resolveOpenClawProviderSnapshotModelCatalogState({
      models: rawModels.map((model) => {
        const modelId = readScalar(model.id);
        return {
          id: modelId,
          name: readScalar(model.name) || modelId,
          explicitReasoning: model.reasoning,
          explicitApi: model.api,
          explicitContextWindow: model.contextWindow,
        };
      }),
      selection: {
        defaultModelId,
        reasoningModelId: reasoningFallback?.modelId,
      },
    });
    const status = readScalar(rawProvider.apiKey).trim() ? 'ready' : 'configurationRequired';
    const config = readOpenClawProviderRuntimeConfigFromConfigRoot({
      root,
      providerKey,
      modelId: normalizedModelCatalogState.selection.defaultModelId,
      providerRoot: rawProvider,
    });

    return [
      {
        id: providerKey,
        providerKey,
        name: titleizeOpenClawProviderKey(providerKey),
        provider: providerKey,
        endpoint: normalizeOpenClawProviderEndpoint(readScalar(rawProvider.baseUrl)),
        apiKeySource: normalizeOpenClawSecretSource(readScalar(rawProvider.apiKey)),
        status,
        defaultModelId: normalizedModelCatalogState.selection.defaultModelId,
        reasoningModelId: normalizedModelCatalogState.selection.reasoningModelId,
        embeddingModelId: normalizedModelCatalogState.selection.embeddingModelId,
        description: `${titleizeOpenClawProviderKey(providerKey)} provider configured through Claw Studio and OpenClaw.`,
        icon: getOpenClawProviderIcon(providerKey.toLowerCase()),
        lastCheckedAt,
        capabilities: [
          'chat',
          ...(normalizedModelCatalogState.selection.reasoningModelId ? ['reasoning'] : []),
          ...(normalizedModelCatalogState.selection.embeddingModelId ? ['embedding'] : []),
        ],
        models: normalizedModelCatalogState.models.map((model) => ({
          id: model.id,
          name: model.name,
          role: model.role,
          contextWindow: model.contextWindow,
        })),
        config,
      },
    ];
  });
}

export function buildOpenClawProviderSnapshotsFromConfigRoot(
  root: unknown,
  options: {
    lastCheckedAt?: string;
  } = {},
): OpenClawProviderSnapshot[] {
  return buildOpenClawProviderSnapshots(isJsonObject(root) ? root : {}, options);
}
