import { useEffect, useRef } from 'react';
import {
  resolveChatCatalogSelectionSyncMutation,
  resolveChatPreferredModelSyncPlan,
  type ChatPageModel,
  type ChatPageModelChannel,
} from '../services';
import type { ChatPageNewSessionModelMode } from './chatPageContracts';

export interface UseChatCatalogSynchronizationInput {
  activeInstanceId: string | null | undefined;
  activeChannelId: string;
  activeModelId: string;
  activeChannel?: ChatPageModelChannel;
  activeModel?: ChatPageModel;
  channels: ChatPageModelChannel[];
  sessionSelectedModelId: string | null;
  newSessionModelMode: ChatPageNewSessionModelMode;
  preferredModelId: string | null;
  catalogChannels: ChatPageModelChannel[];
  effectiveGatewayAgentId?: string | null;
  setActiveChannel: (instanceId: string, channelId: string) => void;
  setActiveModel: (instanceId: string, modelId: string) => void;
}

export function useChatCatalogSynchronization({
  activeInstanceId,
  activeChannelId,
  activeModelId,
  activeChannel,
  activeModel,
  channels,
  sessionSelectedModelId,
  newSessionModelMode,
  preferredModelId,
  catalogChannels,
  effectiveGatewayAgentId,
  setActiveChannel,
  setActiveModel,
}: UseChatCatalogSynchronizationInput) {
  const lastOpenClawModelScopeRef = useRef<string | null>(null);

  useEffect(() => {
    const catalogSelectionSyncMutation = resolveChatCatalogSelectionSyncMutation({
      activeInstanceId,
      channels,
      activeChannel,
      activeModel,
      activeChannelId,
      activeModelId,
      sessionSelectedModelId,
    });

    if (catalogSelectionSyncMutation?.nextChannelId && catalogSelectionSyncMutation.nextChannelId !== activeChannelId) {
      setActiveChannel(catalogSelectionSyncMutation.instanceId, catalogSelectionSyncMutation.nextChannelId);
    }
    if (catalogSelectionSyncMutation?.nextModelId && catalogSelectionSyncMutation.nextModelId !== activeModelId) {
      setActiveModel(catalogSelectionSyncMutation.instanceId, catalogSelectionSyncMutation.nextModelId);
    }
  }, [
    activeChannel?.defaultModelId,
    activeChannel?.id,
    activeChannel?.models,
    activeChannelId,
    activeInstanceId,
    activeModel?.id,
    activeModelId,
    channels,
    sessionSelectedModelId,
    setActiveChannel,
    setActiveModel,
  ]);

  useEffect(() => {
    const preferredModelSyncPlan = resolveChatPreferredModelSyncPlan({
      newSessionModelMode,
      activeInstanceId,
      sessionSelectedModelId,
      preferredModelId,
      catalogChannels,
      activeChannelId,
      activeModelId,
      effectiveGatewayAgentId,
      lastAppliedScopeKey: lastOpenClawModelScopeRef.current,
    });

    if (preferredModelSyncPlan.type === 'resetScope') {
      lastOpenClawModelScopeRef.current = null;
      return;
    }

    if (preferredModelSyncPlan.type !== 'apply') {
      return;
    }

    if (!activeInstanceId) {
      return;
    }

    lastOpenClawModelScopeRef.current = preferredModelSyncPlan.scopeKey;

    if (preferredModelSyncPlan.nextChannelId !== activeChannelId) {
      setActiveChannel(activeInstanceId, preferredModelSyncPlan.nextChannelId);
    }
    if (preferredModelSyncPlan.nextModelId !== activeModelId) {
      setActiveModel(activeInstanceId, preferredModelSyncPlan.nextModelId);
    }
  }, [
    activeChannelId,
    activeInstanceId,
    activeModelId,
    catalogChannels,
    effectiveGatewayAgentId,
    newSessionModelMode,
    preferredModelId,
    sessionSelectedModelId,
    setActiveChannel,
    setActiveModel,
  ]);
}
