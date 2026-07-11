import type { InstanceChatRouteMode } from './instanceChatRouteService.ts';
import { resolveChatBootstrapAction } from './chatSessionBootstrap.ts';
import {
  isExplicitBlankChatWorkspace,
  resolveGatewayVisibleSessionSyncTarget,
} from './chatSessionViewPolicy.ts';

export type ChatBootstrapMutation =
  | { type: 'createSession'; model: string; instanceId: string }
  | { type: 'selectSession'; sessionId: string; instanceId: string };

type CatalogSelectionChannel = {
  id: string;
  defaultModelId?: string;
  models: Array<{
    id: string;
  }>;
};

type CatalogSelectionModel = {
  id: string;
};

export interface ResolveChatCatalogSelectionSyncMutationInput {
  activeInstanceId: string | null | undefined;
  channels: CatalogSelectionChannel[];
  activeChannel?: CatalogSelectionChannel;
  activeModel?: CatalogSelectionModel;
  activeChannelId: string;
  activeModelId: string;
  sessionSelectedModelId: string | null;
}

export interface ChatCatalogSelectionSyncMutation {
  instanceId: string;
  nextChannelId: string | null;
  nextModelId: string | null;
}

export function resolveChatCatalogSelectionSyncMutation(
  params: ResolveChatCatalogSelectionSyncMutationInput,
): ChatCatalogSelectionSyncMutation | null {
  if (!params.activeInstanceId || params.channels.length === 0 || params.sessionSelectedModelId) {
    return null;
  }

  const effectiveChannel = params.activeChannel || params.channels[0];
  const nextChannelId = effectiveChannel?.id || null;
  const nextModelId =
    params.activeModel?.id ||
    effectiveChannel?.defaultModelId ||
    effectiveChannel?.models[0]?.id ||
    null;

  if (
    nextChannelId === params.activeChannelId &&
    nextModelId === params.activeModelId
  ) {
    return null;
  }

  return {
    instanceId: params.activeInstanceId,
    nextChannelId,
    nextModelId,
  };
}

export interface ResolveChatBootstrapMutationInput {
  activeInstanceId: string | null | undefined;
  routeMode: InstanceChatRouteMode | undefined;
  sendMode: 'local' | 'gateway';
  syncState: 'idle' | 'loading' | 'error';
  hasActiveModel: boolean;
  activeSessionId: string | null;
  sessionIds: string[];
  selectedAgentId?: string | null | undefined;
  newSessionModel?: string;
}

export function resolveChatBootstrapMutation(
  params: ResolveChatBootstrapMutationInput,
): ChatBootstrapMutation | null {
  if (
    isExplicitBlankChatWorkspace({
      activeSessionId: params.activeSessionId,
      selectedAgentId: params.selectedAgentId,
    })
  ) {
    return null;
  }

  const bootstrapAction = resolveChatBootstrapAction({
    activeInstanceId: params.activeInstanceId,
    routeMode: params.routeMode,
    sendMode: params.sendMode,
    syncState: params.syncState,
    hasActiveModel: params.hasActiveModel,
    activeSessionId: params.activeSessionId,
    sessionIds: params.sessionIds,
  });

  if (!params.activeInstanceId) {
    return null;
  }

  if (bootstrapAction.type === 'create' && params.newSessionModel) {
    return {
      type: 'createSession',
      model: params.newSessionModel,
      instanceId: params.activeInstanceId,
    };
  }

  if (bootstrapAction.type === 'select') {
    return {
      type: 'selectSession',
      sessionId: bootstrapAction.sessionId,
      instanceId: params.activeInstanceId,
    };
  }

  return null;
}

export interface ResolveChatVisibleSessionSyncMutationInput {
  activeInstanceId: string | null | undefined;
  supportsVisibleSessionSync: boolean;
  activeSessionId: string | null;
  effectiveActiveSessionId: string | null;
  selectedAgentId?: string | null | undefined;
}

export interface ChatVisibleSessionSyncMutation {
  instanceId: string;
  sessionId: string;
}

export function resolveChatVisibleSessionSyncMutation(
  params: ResolveChatVisibleSessionSyncMutationInput,
): ChatVisibleSessionSyncMutation | null {
  const sessionId = resolveGatewayVisibleSessionSyncTarget({
    supportsVisibleSessionSync: params.supportsVisibleSessionSync,
    activeSessionId: params.activeSessionId,
    effectiveActiveSessionId: params.effectiveActiveSessionId,
    selectedAgentId: params.selectedAgentId,
  });

  if (!params.activeInstanceId || !sessionId) {
    return null;
  }

  return {
    instanceId: params.activeInstanceId,
    sessionId,
  };
}

type PreferredModelSyncChannel = {
  id: string;
  models: Array<{
    id: string;
  }>;
};

export type ChatPreferredModelSyncPlan =
  | { type: 'resetScope' }
  | { type: 'idle' }
  | { type: 'apply'; scopeKey: string; nextChannelId: string; nextModelId: string };

export interface ResolveChatPreferredModelSyncPlanInput {
  newSessionModelMode: 'modelName' | 'modelId';
  activeInstanceId: string | null | undefined;
  sessionSelectedModelId: string | null;
  preferredModelId: string | null;
  catalogChannels: PreferredModelSyncChannel[];
  activeChannelId: string;
  activeModelId: string;
  effectiveGatewayAgentId?: string | null;
  lastAppliedScopeKey: string | null;
}

function buildPreferredModelScopeKey(
  activeInstanceId: string,
  effectiveGatewayAgentId?: string | null,
) {
  return `${activeInstanceId}:${effectiveGatewayAgentId || 'main'}`;
}

export function resolveChatPreferredModelSyncPlan(
  params: ResolveChatPreferredModelSyncPlanInput,
): ChatPreferredModelSyncPlan {
  if (params.newSessionModelMode !== 'modelId' || !params.activeInstanceId) {
    return { type: 'resetScope' };
  }

  if (params.sessionSelectedModelId || !params.preferredModelId) {
    return { type: 'idle' };
  }

  const preferredChannel = params.catalogChannels.find((channel) =>
    channel.models.some((model) => model.id === params.preferredModelId),
  );
  if (!preferredChannel?.id) {
    return { type: 'idle' };
  }

  const scopeKey = buildPreferredModelScopeKey(
    params.activeInstanceId,
    params.effectiveGatewayAgentId,
  );
  if (params.lastAppliedScopeKey === scopeKey) {
    return { type: 'idle' };
  }

  return {
    type: 'apply',
    scopeKey,
    nextChannelId: preferredChannel.id,
    nextModelId: params.preferredModelId,
  };
}
