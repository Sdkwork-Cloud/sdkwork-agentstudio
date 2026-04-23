import type {
  ChatPageModel,
  ChatPageModelChannel,
  InstanceChatRouteMode,
} from '../services';
import type {
  ChatPageSelectableSessionRef,
  ChatPageNewSessionModelMode,
  ChatPageSendMode,
  ChatPageSyncState,
} from './chatPageContracts';
import { useChatCatalogSynchronization } from './useChatCatalogSynchronization';
import { useChatBootstrapSynchronization } from './useChatBootstrapSynchronization';
import { useChatContextSelectionSynchronization } from './useChatContextSelectionSynchronization';
import { useChatInstanceHydrationSynchronization } from './useChatInstanceHydrationSynchronization';
import { useChatVisibleSessionSynchronization } from './useChatVisibleSessionSynchronization';

export interface UseChatRuntimeSynchronizationInput {
  activeInstanceId: string | null | undefined;
  routeMode: InstanceChatRouteMode | undefined;
  syncState: ChatPageSyncState;
  hasActiveModel: boolean;
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
  sendMode: ChatPageSendMode;
  supportsSessionScopeSync: boolean;
  activeSessionId: string | null;
  effectiveActiveSessionId: string | null;
  selectableInstanceSessions: ChatPageSelectableSessionRef[];
  newSessionModel?: string;
  selectedAgentId: string | null | undefined;
  selectedSkillId: string | null;
  isSelectionTransitionPending: boolean;
  hasResolvedVisibleAgents: boolean;
  visibleAgentIds: string[];
  isChatSupportedRoute: boolean;
  hydrateInstance: (instanceId: string | null | undefined) => Promise<void> | void;
  setActiveChannel: (instanceId: string, channelId: string) => void;
  setActiveModel: (instanceId: string, modelId: string) => void;
  createSession: (
    model?: string,
    instanceId?: string,
    options?: {
      agentId?: string | null;
      sessionId?: string | null;
    },
  ) => Promise<string>;
  setActiveSession: (sessionId: string, instanceId?: string) => Promise<void> | void;
  setSelectedAgentId: (agentId: string | null | undefined) => void;
  setSelectedSkillId: (skillId: string | null) => void;
}

export function useChatRuntimeSynchronization({
  activeInstanceId,
  routeMode,
  syncState,
  hasActiveModel,
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
  sendMode,
  supportsSessionScopeSync,
  activeSessionId,
  effectiveActiveSessionId,
  selectableInstanceSessions,
  newSessionModel,
  selectedAgentId,
  selectedSkillId,
  isSelectionTransitionPending,
  hasResolvedVisibleAgents,
  visibleAgentIds,
  isChatSupportedRoute,
  hydrateInstance,
  setActiveChannel,
  setActiveModel,
  createSession,
  setActiveSession,
  setSelectedAgentId,
  setSelectedSkillId,
}: UseChatRuntimeSynchronizationInput) {
  useChatContextSelectionSynchronization({
    isChatSupportedRoute,
    isSelectionTransitionPending,
    selectedAgentId,
    selectedSkillId,
    hasResolvedVisibleAgents,
    visibleAgentIds,
    setSelectedAgentId,
    setSelectedSkillId,
  });
  useChatInstanceHydrationSynchronization({
    activeInstanceId,
    routeMode,
    hydrateInstance,
  });
  useChatCatalogSynchronization({
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
  });
  useChatBootstrapSynchronization({
    activeInstanceId,
    routeMode,
    syncState,
    hasActiveModel,
    sendMode,
    effectiveActiveSessionId,
    selectedAgentId,
    isSelectionTransitionPending,
    selectableInstanceSessions,
    newSessionModel,
    createSession,
    setActiveSession,
  });
  useChatVisibleSessionSynchronization({
    activeInstanceId,
    supportsVisibleSessionSync: supportsSessionScopeSync,
    activeSessionId,
    effectiveActiveSessionId,
    selectedAgentId,
    isSelectionTransitionPending,
    setActiveSession,
  });
}
