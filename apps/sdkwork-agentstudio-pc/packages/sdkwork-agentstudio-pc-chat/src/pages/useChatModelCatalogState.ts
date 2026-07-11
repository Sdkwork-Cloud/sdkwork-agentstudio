import { useQuery } from '@tanstack/react-query';
import {
  instanceEffectiveModelCatalogService,
  type InstanceEffectiveModelCatalog,
} from '../services';
import type { ChatPageAgentCatalogMode } from './chatPageContracts';

export interface UseChatModelCatalogStateInput {
  activeInstanceId: string | null | undefined;
  isChatSupportedRoute: boolean;
  effectiveGatewayAgentId: string | null;
  agentCatalogMode: ChatPageAgentCatalogMode;
}

export function useChatModelCatalogState({
  activeInstanceId,
  isChatSupportedRoute,
  effectiveGatewayAgentId,
  agentCatalogMode,
}: UseChatModelCatalogStateInput) {
  const {
    data: modelCatalog,
    error: modelCatalogError,
  } = useQuery<InstanceEffectiveModelCatalog>({
    queryKey: ['chat', 'instance-model-catalog', activeInstanceId, effectiveGatewayAgentId],
    enabled: Boolean(activeInstanceId && isChatSupportedRoute),
    staleTime: 10_000,
    queryFn: async () => {
      if (!activeInstanceId) {
        return { channels: [] };
      }

      return instanceEffectiveModelCatalogService.getCatalog(
        activeInstanceId,
        agentCatalogMode === 'kernelCatalog' ? effectiveGatewayAgentId : undefined,
      );
    },
  });
  const catalogChannels = isChatSupportedRoute ? modelCatalog?.channels ?? [] : [];

  return {
    modelCatalog,
    modelCatalogError,
    catalogChannels,
  };
}
