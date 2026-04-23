import type { ChatSession } from '../store/useChatStore';
import {
  type InstanceChatRouteMode,
  type KernelChatAdapterCapabilities,
} from '../services';
import type {
  ChatPageSendMode,
  ChatPageSessionScopeMode,
} from './chatPageContracts';
import { useChatActiveSessionProjectionState } from './useChatActiveSessionProjectionState';
import { useChatMessageDisplayState } from './useChatMessageDisplayState';

export interface UseChatSessionViewStateInput {
  sessions: ChatSession[];
  activeInstanceId: string | null | undefined;
  activeSessionId: string | null;
  isChatSupportedRoute: boolean;
  sessionScopeMode: ChatPageSessionScopeMode;
  effectiveGatewayAgentId: string | null;
  selectedAgentId: string | null | undefined;
  routeMode: InstanceChatRouteMode | undefined;
  activeAdapterCapabilities: KernelChatAdapterCapabilities | null;
  sendMode: ChatPageSendMode;
}

export function useChatSessionViewState({
  sessions,
  activeInstanceId,
  activeSessionId,
  isChatSupportedRoute,
  sessionScopeMode,
  effectiveGatewayAgentId,
  selectedAgentId,
  routeMode,
  activeAdapterCapabilities,
  sendMode,
}: UseChatSessionViewStateInput) {
  const {
    workspaceMode,
    isExplicitBlankWorkspace,
    isDisplaySessionFallback,
    selectableInstanceSessions,
    selectedSession,
    displaySessionId,
    displaySession,
    activeKernelSessionState,
    activeRunBinding,
    chatRuntimeState,
    isUnsupportedRoute,
    runningRunBinding,
    sessionSelectedModelId,
  } = useChatActiveSessionProjectionState({
    sessions,
    activeInstanceId,
    activeSessionId,
    isChatSupportedRoute,
    sessionScopeMode,
    effectiveGatewayAgentId,
    selectedAgentId,
    routeMode,
    activeAdapterCapabilities,
    sendMode,
  });
  const { activeMessages, conversationBodyState, activeMessageGroups } = useChatMessageDisplayState({
    displaySession,
    chatRuntimeState,
  });

  return {
    workspaceMode,
    isExplicitBlankWorkspace,
    isDisplaySessionFallback,
    selectableInstanceSessions,
    selectedSession,
    displaySessionId,
    displaySession,
    activeKernelSessionState,
    activeRunBinding,
    chatRuntimeState,
    isUnsupportedRoute,
    runningRunBinding,
    sessionSelectedModelId,
    activeMessages,
    conversationBodyState,
    activeMessageGroups,
  };
}
