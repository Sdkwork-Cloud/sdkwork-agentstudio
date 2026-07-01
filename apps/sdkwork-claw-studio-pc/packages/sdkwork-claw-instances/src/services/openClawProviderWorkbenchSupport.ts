import {
  buildOpenClawProviderSnapshotsFromConfigRoot,
  presentOpenClawProviderApiKeySource,
  type OpenClawConfigSnapshot,
} from '@sdkwork/claw-core';
import {
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
} from '@sdkwork/local-api-proxy';
import type {
  OpenClawConfigSnapshot as GatewayOpenClawConfigSnapshot,
  OpenClawModelRecord,
} from '@sdkwork/claw-infrastructure';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import type { InstanceWorkbenchLLMProvider } from '../types/index.ts';
import {
  getStringValue,
  inferProviderCapabilities,
  mapOpenClawProviderModels,
} from './openClawSupport.ts';

export function mapConfigBackedProvider(
  provider: OpenClawConfigSnapshot['providerSnapshots'][number],
): InstanceWorkbenchLLMProvider {
  return {
    id: provider.id,
    name: provider.name,
    provider: provider.provider,
    endpoint: provider.endpoint,
    apiKeySource: presentOpenClawProviderApiKeySource(provider.apiKeySource),
    status: provider.status,
    defaultModelId: provider.defaultModelId,
    reasoningModelId: provider.reasoningModelId,
    embeddingModelId: provider.embeddingModelId,
    description: provider.description,
    icon: provider.icon,
    lastCheckedAt: provider.lastCheckedAt,
    capabilities: [...provider.capabilities],
    models: provider.models.map((model) => ({ ...model })),
    config: { ...provider.config },
  };
}

export function mapLlmProvider(
  provider: InstanceWorkbenchLLMProvider,
): InstanceWorkbenchLLMProvider {
  return {
    ...provider,
    capabilities: [...provider.capabilities],
    models: provider.models.map((model) => ({ ...model })),
    config: { ...provider.config },
  };
}

export function providerMatchesId(model: OpenClawModelRecord, providerId: string) {
  const candidates = [
    typeof model.provider === 'string' ? model.provider : undefined,
    typeof model.providerId === 'string' ? model.providerId : undefined,
  ]
    .filter(Boolean)
    .map((value) => normalizeLegacyProviderId(value).toLowerCase());

  return candidates.includes(normalizeLegacyProviderId(providerId).toLowerCase());
}

export function buildOpenClawLlmProviders(
  configSnapshot: GatewayOpenClawConfigSnapshot | null,
  liveModels: OpenClawModelRecord[],
  detail: StudioInstanceDetailRecord,
): InstanceWorkbenchLLMProvider[] {
  const lastCheckedAt =
    getStringValue(configSnapshot?.config, ['meta', 'lastTouchedAt']) ||
    (detail.observability.lastSeenAt
      ? new Date(detail.observability.lastSeenAt).toISOString()
      : 'Unknown');

  return buildOpenClawProviderSnapshotsFromConfigRoot(configSnapshot?.config, { lastCheckedAt })
    .map((providerSnapshot) => {
      const providerModels = liveModels.filter((model) =>
        providerMatchesId(model, providerSnapshot.providerKey),
      );
      if (providerModels.length === 0) {
        return mapConfigBackedProvider(providerSnapshot);
      }

      const models = mapOpenClawProviderModels(providerModels);
      const defaultModelId = models.find((model) => model.role === 'primary')?.id || models[0]?.id || '';

      return {
        ...mapConfigBackedProvider(providerSnapshot),
        status: defaultModelId ? 'ready' : 'configurationRequired',
        defaultModelId,
        reasoningModelId: models.find((model) => model.role === 'reasoning')?.id,
        embeddingModelId: models.find((model) => model.role === 'embedding')?.id,
        capabilities: inferProviderCapabilities(providerModels),
        models,
      } satisfies InstanceWorkbenchLLMProvider;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
