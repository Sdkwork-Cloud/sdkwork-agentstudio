import {
  type OpenClawConfigSnapshot,
  type LLMChannel,
  type LLMModel,
} from '@sdkwork/claw-core';
import {
  normalizeLocalApiProxyLegacyProviderId as normalizeLegacyProviderId,
} from '@sdkwork/local-api-proxy';
import type { StudioInstanceDetailRecord, StudioInstanceRecord } from '@sdkwork/claw-types';
import { resolveInstanceChatRoute } from './instanceChatRouteService.ts';

type RouterChannelRecord = {
  id: string;
  name: string;
};

type RouterProviderChannelBindingRecord = {
  channel_id: string;
  is_primary: boolean;
};

type RouterProviderRecord = {
  id: string;
  channel_id: string;
  base_url: string;
  default_model_id?: string;
  channel_bindings?: RouterProviderChannelBindingRecord[];
};

type RouterModelRecord = {
  external_name: string;
  provider_id: string;
};

type GatewayModelRecord = {
  id?: string;
  name?: string;
  provider?: string;
  model?: string;
  label?: string;
  title?: string;
};

type GatewayModelsListResult = {
  models: GatewayModelRecord[];
};

type GatewayModelIdentity = {
  providerId: string;
  modelId: string;
  modelRef: string;
  displayName: string;
};

type RouterCatalogModelEntry = {
  channelId: string;
  channelName: string;
  channelProvider: string;
  channelBaseUrl: string;
  channelIcon: string;
  modelId: string;
  modelName: string;
  modelRef: string;
  providerId: string;
  providerDefaultModelId?: string | null;
};

export interface InstanceEffectiveModelCatalog {
  channels: LLMChannel[];
  preferredModelId?: string | null;
}

export interface InstanceEffectiveModelCatalogService {
  getCatalog(instanceId: string, agentId?: string | null): Promise<InstanceEffectiveModelCatalog>;
}

export interface InstanceEffectiveModelCatalogDependencies {
  getInstance: (instanceId: string) => Promise<StudioInstanceRecord | null>;
  getInstanceDetail: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
  listRouterChannels: () => Promise<RouterChannelRecord[]>;
  listRouterProviders: () => Promise<RouterProviderRecord[]>;
  listRouterModels: () => Promise<RouterModelRecord[]>;
  resolveAttachedKernelConfigFile: (
    detail: StudioInstanceDetailRecord | null | undefined,
  ) => string | null;
  readOpenClawConfigSnapshot: (configFile: string) => Promise<OpenClawConfigSnapshot>;
  listGatewayModels: (instanceId: string) => Promise<GatewayModelsListResult>;
}

const CHANNEL_ICON_MAP: Record<string, string> = {
  anthropic: 'AT',
  baidu: 'BD',
  coding: 'CD',
  deepseek: 'DS',
  general: 'AI',
  moonshot: 'KI',
  openai: 'OA',
  qwen: 'QW',
  vision: 'VS',
  zhipu: 'ZP',
};

function resolveProviderChannelId(provider: RouterProviderRecord) {
  return (
    provider.channel_bindings?.find((binding) => binding.is_primary)?.channel_id ||
    provider.channel_id
  );
}

function resolveChannelIcon(channelId: string, providerId: string) {
  return (
    CHANNEL_ICON_MAP[channelId] ||
    CHANNEL_ICON_MAP[providerId] ||
    providerId.slice(0, 2).toUpperCase() ||
    'AI'
  );
}

function normalizePreferredModelId(modelId?: string | null) {
  const trimmed = modelId?.trim();
  return trimmed ? trimmed : null;
}

function trimString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildRouterModelRef(providerId: string, modelId: string) {
  return modelId.includes('/') ? modelId : `${providerId}/${modelId}`;
}

function sortChannels(channels: LLMChannel[]) {
  return [...channels].sort((left, right) => left.name.localeCompare(right.name));
}

function readObjectValue(
  value: unknown,
  key: string,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : null;
}

function readArrayValue(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate) ? candidate : [];
}

function readStringValue(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function readModelPrimary(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return readStringValue(value, 'primary');
}

function resolvePreferredOpenClawModelId(
  configSnapshot: OpenClawConfigSnapshot,
  agentId?: string | null,
) {
  const normalizedAgentId = agentId?.trim() || null;
  const agentSnapshots = Array.isArray(configSnapshot.agentSnapshots)
    ? configSnapshot.agentSnapshots
    : [];
  if (normalizedAgentId) {
    const selectedAgentSnapshot = agentSnapshots.find((agent) => agent.id === normalizedAgentId);
    if (selectedAgentSnapshot?.model?.primary) {
      return normalizePreferredModelId(selectedAgentSnapshot.model.primary);
    }
  }

  const agentsRoot = readObjectValue(configSnapshot.root, 'agents');
  const agentList = readArrayValue(agentsRoot, 'list');
  if (normalizedAgentId) {
    const selectedAgentEntry = agentList.find(
      (entry) => readStringValue(entry, 'id') === normalizedAgentId,
    );
    const selectedAgentModelId = readModelPrimary(readObjectValue(selectedAgentEntry, 'model'));
    if (selectedAgentModelId) {
      return normalizePreferredModelId(selectedAgentModelId);
    }
  }

  const defaultAgentSnapshot =
    agentSnapshots.find((agent) => agent.isDefault) || agentSnapshots[0];
  if (defaultAgentSnapshot?.model?.primary) {
    return normalizePreferredModelId(defaultAgentSnapshot.model.primary);
  }

  const defaultAgentEntry =
    agentList.find((entry) => readStringValue(entry, 'id') && (entry as Record<string, unknown>).default === true) ||
    agentList[0];
  const defaultAgentModelId = readModelPrimary(readObjectValue(defaultAgentEntry, 'model'));
  if (defaultAgentModelId) {
    return normalizePreferredModelId(defaultAgentModelId);
  }

  const defaultsRoot = readObjectValue(agentsRoot, 'defaults');
  return normalizePreferredModelId(readModelPrimary(readObjectValue(defaultsRoot, 'model')));
}

function matchesPreferredModel(modelId: string, preferredModelId?: string | null) {
  if (!preferredModelId) {
    return false;
  }

  if (modelId === preferredModelId) {
    return true;
  }

  return !preferredModelId.includes('/') && modelId.endsWith(`/${preferredModelId}`);
}

function matchesConfiguredDefaultModel(modelId: string, defaultModelId?: string | null) {
  if (!defaultModelId) {
    return false;
  }

  if (modelId === defaultModelId) {
    return true;
  }

  return !defaultModelId.includes('/') && modelId.endsWith(`/${defaultModelId}`);
}

function sortModels(
  models: LLMModel[],
  preferredModelId?: string | null,
  defaultModelId?: string | null,
) {
  return [...models].sort((left, right) => {
    const leftPreferred = matchesPreferredModel(left.id, preferredModelId);
    const rightPreferred = matchesPreferredModel(right.id, preferredModelId);
    if (leftPreferred !== rightPreferred) {
      return leftPreferred ? -1 : 1;
    }

    const leftDefault = matchesConfiguredDefaultModel(left.id, defaultModelId);
    const rightDefault = matchesConfiguredDefaultModel(right.id, defaultModelId);
    if (leftDefault !== rightDefault) {
      return leftDefault ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function resolveGatewayModelIdentity(entry: GatewayModelRecord): GatewayModelIdentity | null {
  const explicitId = trimString(entry.id);
  const explicitModel = trimString(entry.model);
  const explicitName =
    trimString(entry.name) ?? trimString(entry.label) ?? trimString(entry.title);
  let providerId = trimString(entry.provider);
  let modelId = explicitModel ?? explicitId;
  let modelRef = explicitId ?? explicitModel;

  if (explicitId?.includes('/')) {
    const separatorIndex = explicitId.indexOf('/');
    const refProvider = trimString(explicitId.slice(0, separatorIndex));
    const refModel = trimString(explicitId.slice(separatorIndex + 1));
    if (refProvider && !providerId) {
      providerId = refProvider;
    }
    if (refModel) {
      modelId = explicitModel ?? refModel;
      modelRef = explicitId;
    }
  } else if (providerId && modelId) {
    modelRef = `${providerId}/${modelId}`;
  }

  if (!modelId || !modelRef) {
    return null;
  }

  const normalizedProviderId = normalizeLegacyProviderId(
    providerId ?? trimString(modelRef.split('/')[0]) ?? 'openclaw',
  );
  return {
    providerId: normalizedProviderId,
    modelId,
    modelRef,
    displayName: explicitName ?? modelId,
  };
}

function buildRouterCatalog(params: {
  channels: RouterChannelRecord[];
  providers: RouterProviderRecord[];
  models: RouterModelRecord[];
}) {
  const channelById = new Map(params.channels.map((channel) => [channel.id, channel]));
  const providerById = new Map(params.providers.map((provider) => [provider.id, provider]));
  const entries: RouterCatalogModelEntry[] = [];

  for (const model of params.models) {
    const provider = providerById.get(model.provider_id);
    if (!provider) {
      continue;
    }

    const channelId = resolveProviderChannelId(provider);
    const channel = channelById.get(channelId);
    const providerId = normalizeLegacyProviderId(provider.id);
    const modelId = model.external_name.trim();
    if (!modelId) {
      continue;
    }

    entries.push({
      channelId,
      channelName: channel?.name || channelId,
      channelProvider: providerId,
      channelBaseUrl: provider.base_url,
      channelIcon: resolveChannelIcon(channelId, providerId),
      modelId,
      modelName: modelId,
      modelRef: buildRouterModelRef(providerId, modelId),
      providerId,
      providerDefaultModelId: trimString(provider.default_model_id),
    });
  }

  return entries;
}

function groupEntriesToChannels(
  entries: RouterCatalogModelEntry[],
  params: {
    useModelRefAsId: boolean;
    runtimeNameByRef?: Map<string, string>;
    preferredModelId?: string | null;
  },
) {
  const channelMap = new Map<string, LLMChannel>();
  const configuredDefaultModelIds = new Map<string, string>();

  for (const entry of entries) {
    const existing =
      channelMap.get(entry.channelId) ||
      ({
        id: entry.channelId,
        name: entry.channelName,
        provider: entry.channelProvider,
        baseUrl: entry.channelBaseUrl,
        apiKey: '',
        icon: entry.channelIcon,
        models: [],
      } satisfies LLMChannel);
    if (entry.providerDefaultModelId && !configuredDefaultModelIds.has(entry.channelId)) {
      configuredDefaultModelIds.set(entry.channelId, entry.providerDefaultModelId);
    }
    const modelId = params.useModelRefAsId ? entry.modelRef : entry.modelId;
    const modelName = params.runtimeNameByRef?.get(entry.modelRef) || entry.modelName;
    if (!existing.models.some((model) => model.id === modelId)) {
      existing.models.push({
        id: modelId,
        name: modelName,
      });
    }
    channelMap.set(entry.channelId, existing);
  }

  return sortChannels(
    [...channelMap.values()].map((channel) => {
      const configuredDefaultModelId = configuredDefaultModelIds.get(channel.id);
      const models = sortModels(
        channel.models,
        params.preferredModelId,
        configuredDefaultModelId,
      );
      const preferredModel = models.find((model) =>
        matchesPreferredModel(model.id, params.preferredModelId),
      );
      const configuredDefaultModel = models.find((model) =>
        matchesConfiguredDefaultModel(model.id, configuredDefaultModelId),
      );
      return {
        ...channel,
        models,
        defaultModelId: preferredModel?.id || configuredDefaultModel?.id || models[0]?.id,
      };
    }),
  );
}

function buildRuntimeFallbackChannels(
  result: GatewayModelsListResult,
  preferredModelId?: string | null,
) {
  const channelMap = new Map<string, LLMChannel>();

  for (const model of result.models) {
    const identity = resolveGatewayModelIdentity(model);
    if (!identity) {
      continue;
    }

    const providerId = identity.providerId;
    const channel =
      channelMap.get(providerId) ||
      ({
        id: providerId,
        name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
        provider: providerId,
        baseUrl: '',
        apiKey: '',
        icon: resolveChannelIcon(providerId, providerId),
        models: [],
      } satisfies LLMChannel);
    if (!channel.models.some((entry) => entry.id === identity.modelRef)) {
      channel.models.push({
        id: identity.modelRef,
        name: identity.displayName,
      });
    }
    channelMap.set(providerId, channel);
  }

  return sortChannels(
    [...channelMap.values()].map((channel) => {
      const models = sortModels(channel.models, preferredModelId);
      const preferredModel = models.find((model) =>
        matchesPreferredModel(model.id, preferredModelId),
      );
      return {
        ...channel,
        models,
        defaultModelId: preferredModel?.id || models[0]?.id,
      };
    }),
  );
}

class DefaultInstanceEffectiveModelCatalogService
  implements InstanceEffectiveModelCatalogService
{
  private readonly dependencies: InstanceEffectiveModelCatalogDependencies;

  constructor(dependencies: InstanceEffectiveModelCatalogDependencies) {
    this.dependencies = dependencies;
  }

  async getCatalog(instanceId: string, agentId?: string | null) {
    const detail = await this.dependencies.getInstanceDetail(instanceId);
    const instance = detail?.instance ?? (await this.dependencies.getInstance(instanceId));
    if (!instance) {
      return { channels: [] };
    }

    const route = resolveInstanceChatRoute(instance);
    if (route.mode === 'unsupported') {
      return {
        channels: [],
        preferredModelId: null,
      };
    }

    const [routerChannels, routerProviders, routerModels] = await Promise.all([
      this.dependencies.listRouterChannels(),
      this.dependencies.listRouterProviders(),
      this.dependencies.listRouterModels(),
    ]);
    const routerCatalog = buildRouterCatalog({
      channels: routerChannels,
      providers: routerProviders,
      models: routerModels,
    });

    if (route.mode !== 'instanceOpenClawGatewayWs') {
      return {
        channels: groupEntriesToChannels(routerCatalog, {
          useModelRefAsId: false,
        }),
        preferredModelId: null,
      };
    }

    const configPath = this.dependencies.resolveAttachedKernelConfigFile(detail);
    const gatewayModels = await this.dependencies.listGatewayModels(instanceId);
    const runtimeModelEntries = gatewayModels.models
      .map((model) => resolveGatewayModelIdentity(model))
      .filter((model): model is GatewayModelIdentity => model !== null);
    const runtimeModelRefs = new Set(runtimeModelEntries.map((model) => model.modelRef));
    const runtimeNamesByRef = new Map(
      runtimeModelEntries.map((model) => [model.modelRef, model.displayName] as const),
    );

    if (!configPath) {
      return {
        channels: buildRuntimeFallbackChannels(gatewayModels),
        preferredModelId: null,
      };
    }

    const configSnapshot = await this.dependencies.readOpenClawConfigSnapshot(configPath);
    const preferredModelId = resolvePreferredOpenClawModelId(configSnapshot, agentId);
    const configuredProviderIds = new Set(
      configSnapshot.providerSnapshots.map((provider) => normalizeLegacyProviderId(provider.id)),
    );
    const filtered = routerCatalog.filter(
      (entry) =>
        configuredProviderIds.has(entry.providerId) && runtimeModelRefs.has(entry.modelRef),
    );

    return {
      channels:
        filtered.length > 0
          ? groupEntriesToChannels(filtered, {
              useModelRefAsId: true,
              runtimeNameByRef: runtimeNamesByRef,
              preferredModelId,
            })
          : buildRuntimeFallbackChannels(gatewayModels, preferredModelId),
      preferredModelId,
    };
  }
}

export function createInstanceEffectiveModelCatalogService(
  dependencies: InstanceEffectiveModelCatalogDependencies,
) {
  return new DefaultInstanceEffectiveModelCatalogService(dependencies);
}
