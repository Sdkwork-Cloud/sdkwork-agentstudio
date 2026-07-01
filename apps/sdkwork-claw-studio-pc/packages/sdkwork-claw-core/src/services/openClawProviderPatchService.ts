import {
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
  resolveLocalApiProxyProjectedProviderModelCatalog,
} from '@sdkwork/local-api-proxy';
import type { StudioWorkbenchLLMProviderRequestOverridesRecord } from '@sdkwork/claw-types';
import type {
  OpenClawProviderRuntimeConfig,
} from './openClawProviderRuntimeConfigService.ts';
import {
  normalizeOpenClawProviderEndpoint,
  serializeOpenClawProviderApiKeySource,
} from './openClawProviderFormatService.ts';
import { buildOpenClawProviderSnapshotsFromConfigRoot } from './openClawProviderSnapshotService.ts';
import {
  normalizeOpenClawProviderRequestOverrides,
  normalizeOpenClawProviderRuntimeConfig,
} from './openClawProviderRuntimeConfigService.ts';

export interface OpenClawProviderConfigPatchInput {
  endpoint: string;
  apiKeySource: string;
  defaultModelId: string;
  reasoningModelId?: string;
  embeddingModelId?: string;
  config: Partial<OpenClawProviderRuntimeConfig>;
}

function normalizeProviderId(providerId: string) {
  return normalizeLegacyProviderId(providerId).trim();
}

function buildModelRef(providerId: string, modelId: string) {
  return `${providerId}/${modelId}`;
}

function mapProjectedProviderModelRoleToOpenClaw(
  role: 'default' | 'reasoning' | 'embedding' | 'fallback',
) {
  switch (role) {
    case 'default':
      return 'primary';
    case 'reasoning':
      return 'reasoning';
    case 'embedding':
      return 'embedding';
    default:
      return 'fallback';
  }
}

export function buildOpenClawRequestOverridesPatch(
  request: StudioWorkbenchLLMProviderRequestOverridesRecord | undefined | null,
) {
  return normalizeOpenClawProviderRequestOverrides(request) || null;
}

export function buildRemoteOpenClawProviderConfigPatch(
  root: unknown,
  providerId: string,
  update: OpenClawProviderConfigPatchInput,
) {
  const normalizedProviderId = normalizeProviderId(providerId);
  if (!normalizedProviderId) {
    throw new Error('OpenClaw provider id is required.');
  }

  const providerSnapshots = buildOpenClawProviderSnapshotsFromConfigRoot(root);
  const existingProvider = providerSnapshots.find((entry) => entry.id === normalizedProviderId);
  const defaultModelId = update.defaultModelId.trim() || existingProvider?.defaultModelId?.trim() || '';
  if (!defaultModelId) {
    throw new Error('OpenClaw provider default model id is required.');
  }

  const selection = {
    defaultModelId,
    reasoningModelId: update.reasoningModelId?.trim() || undefined,
    embeddingModelId: update.embeddingModelId?.trim() || undefined,
  };
  const normalizedProjectedProviderModelCatalog =
    resolveLocalApiProxyProjectedProviderModelCatalog({
      existingModels: existingProvider?.models,
      selection,
    });
  const normalizedModelCatalogState = {
    selection: normalizedProjectedProviderModelCatalog.selection,
    models: normalizedProjectedProviderModelCatalog.models.map((model) => ({
      id: model.id,
      name: model.name,
    })),
  };
  const normalizedRuntimeConfig = normalizeOpenClawProviderRuntimeConfig(update.config);

  return {
    models: {
      providers: {
        [normalizedProviderId]: {
          baseUrl: normalizeOpenClawProviderEndpoint(update.endpoint),
          apiKey: serializeOpenClawProviderApiKeySource(update.apiKeySource) || null,
          temperature: null,
          topP: null,
          maxTokens: null,
          timeoutMs: null,
          streaming: null,
          request: buildOpenClawRequestOverridesPatch(normalizedRuntimeConfig.request),
          models: normalizedProjectedProviderModelCatalog.models.map((model) => ({
            id: model.id,
            name: model.name,
            role: mapProjectedProviderModelRoleToOpenClaw(model.role),
          })),
        },
      },
    },
    agents: {
      defaults: {
        model: {
          primary: buildModelRef(
            normalizedProviderId,
            normalizedModelCatalogState.selection.defaultModelId,
          ),
          ...(normalizedModelCatalogState.selection.reasoningModelId
            ? {
                fallbacks: [
                  buildModelRef(
                    normalizedProviderId,
                    normalizedModelCatalogState.selection.reasoningModelId,
                  ),
                ],
              }
            : {}),
        },
        models: Object.fromEntries(
          normalizedProjectedProviderModelCatalog.models.map((model) => {
            const entry: Record<string, unknown> = {
              alias: model.name,
              streaming: model.streaming,
            };

            if (model.id === normalizedProjectedProviderModelCatalog.selection.defaultModelId) {
              entry.params = {
                temperature: normalizedRuntimeConfig.temperature,
                topP: normalizedRuntimeConfig.topP,
                maxTokens: normalizedRuntimeConfig.maxTokens,
                timeoutMs: normalizedRuntimeConfig.timeoutMs,
                streaming: normalizedRuntimeConfig.streaming,
              };
            }

            return [buildModelRef(normalizedProviderId, model.id), entry];
          }),
        ),
      },
    },
  };
}
