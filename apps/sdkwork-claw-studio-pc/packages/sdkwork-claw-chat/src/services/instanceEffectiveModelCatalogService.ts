import {
  openClawConfigService,
  providerRoutingCatalogService,
  resolveAttachedKernelConfigFile,
} from '@sdkwork/claw-core';
import {
  studio,
} from '@sdkwork/claw-infrastructure';
import { getSharedOpenClawGatewayClient } from './openclaw/openClawGatewayClientRegistry.ts';
export {
  createInstanceEffectiveModelCatalogService,
  type InstanceEffectiveModelCatalog,
  type InstanceEffectiveModelCatalogDependencies,
  type InstanceEffectiveModelCatalogService,
} from './instanceEffectiveModelCatalogCore.ts';
import { createInstanceEffectiveModelCatalogService } from './instanceEffectiveModelCatalogCore.ts';

export const instanceEffectiveModelCatalogService = createInstanceEffectiveModelCatalogService({
  getInstance: (instanceId) => studio.getInstance(instanceId),
  getInstanceDetail: (instanceId) => studio.getInstanceDetail(instanceId),
  listRouterChannels: async () =>
    (await providerRoutingCatalogService.listProviderChannels()).map((channel) => ({
      id: channel.id,
      name: channel.name,
    })),
  listRouterProviders: async () =>
    Array.from(
      new Map(
        (await providerRoutingCatalogService.listConfiguredProviders()).map((provider) => [
          provider.channelId,
          provider,
        ]),
    ).values(),
    ).map((provider) => ({
      id: provider.channelId,
      channel_id: provider.channelId,
      base_url: provider.baseUrl,
      default_model_id: provider.defaultModelId,
      channel_bindings: [{ channel_id: provider.channelId, is_primary: true }],
    })),
  listRouterModels: async () =>
    Array.from(
      new Map(
        (await providerRoutingCatalogService.listConfiguredProviders()).map((provider) => [
          provider.channelId,
          provider,
        ]),
      ).values(),
    ).flatMap((provider) =>
      provider.models.map((model) => ({
        external_name: model.id,
        provider_id: provider.channelId,
      })),
    ),
  resolveAttachedKernelConfigFile: (detail) => resolveAttachedKernelConfigFile(detail),
  readOpenClawConfigSnapshot: (configFile) => openClawConfigService.readConfigSnapshot(configFile),
  listGatewayModels: async (instanceId) => {
    const client = await getSharedOpenClawGatewayClient(instanceId);
    return client.listModels();
  },
});
