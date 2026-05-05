import { useMemo } from 'react';
import type { ChatSession } from '../store/useChatStore';
import {
  type ChatWorkspaceMode,
  resolveKernelChatSessionState,
  resolveChatRunBinding,
  resolveChatRunningRunBinding,
  resolveChatRuntimeState,
  resolveChatWorkspaceProjection,
  type ChatRunBinding,
  type ChatRuntimeState,
  type InstanceChatRouteMode,
  type KernelChatAdapterCapabilities,
} from '../services';
import type {
  ChatPageKernelSessionState,
  ChatPageSendMode,
  ChatPageSessionScopeMode,
} from './chatPageContracts';

export interface UseChatActiveSessionProjectionStateInput {
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

export interface UseChatActiveSessionProjectionStateResult {
  workspaceMode: ChatWorkspaceMode;
  isExplicitBlankWorkspace: boolean;
  isDisplaySessionFallback: boolean;
  selectableInstanceSessions: ChatSession[];
  selectedSession: ChatSession | null;
  displaySessionId: string | null;
  displaySession: ChatSession | null;
  selectedSessionAgentId: string | null;
  displaySessionAgentId: string | null;
  activeKernelSessionState: ChatPageKernelSessionState;
  activeRunBinding: ChatRunBinding;
  chatRuntimeState: ChatRuntimeState;
  isUnsupportedRoute: boolean;
  runningRunBinding: ChatRunBinding | null;
  sessionSelectedModelId: string | null;
}

export function useChatActiveSessionProjectionState({
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
}: UseChatActiveSessionProjectionStateInput): UseChatActiveSessionProjectionStateResult {
  const instanceSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.instanceId === activeInstanceId || (!session.instanceId && !activeInstanceId),
      ),
    [activeInstanceId, sessions],
  );

  const workspaceProjection = useMemo(
    () =>
      resolveChatWorkspaceProjection({
        sessions: instanceSessions,
        activeSessionId,
        isChatSupported: isChatSupportedRoute,
        sessionScopeMode,
        sessionScopeAgentId: effectiveGatewayAgentId,
        selectedAgentId,
      }),
    [
      activeSessionId,
      effectiveGatewayAgentId,
      instanceSessions,
      isChatSupportedRoute,
      selectedAgentId,
      sessionScopeMode,
    ],
  );
  const selectableInstanceSessions = workspaceProjection.selectableSessions;
  const selectedSession = workspaceProjection.selectedSession;
  const displaySessionId = workspaceProjection.displaySessionId;
  const displaySession = workspaceProjection.displaySession;
  const selectedSessionAgentId = workspaceProjection.selectedSessionAgentId;
  const displaySessionAgentId = workspaceProjection.displaySessionAgentId;
  const activeKernelSessionState = resolveKernelChatSessionState(displaySession);
  const activeRunBinding = resolveChatRunBinding(displaySession);
  const chatRuntimeState = resolveChatRuntimeState({
    activeInstanceId,
    routeMode,
    adapterCapabilities: activeAdapterCapabilities,
    sessionState: activeKernelSessionState,
  });
  const isUnsupportedRoute = chatRuntimeState.isBlocked;
  const runningRunBinding = resolveChatRunningRunBinding({
    sendMode,
    selectableSessions: selectableInstanceSessions,
  });
  const sessionSelectedModelId =
    sendMode === 'gateway' && displaySession
      ? activeKernelSessionState.model || activeKernelSessionState.defaultModel || null
      : null;

  return {
    workspaceMode: workspaceProjection.mode,
    isExplicitBlankWorkspace: workspaceProjection.isExplicitBlankWorkspace,
    isDisplaySessionFallback: workspaceProjection.isDisplaySessionFallback,
    selectableInstanceSessions,
    selectedSession,
    displaySessionId,
    displaySession,
    selectedSessionAgentId,
    displaySessionAgentId,
    activeKernelSessionState,
    activeRunBinding,
    chatRuntimeState,
    isUnsupportedRoute,
    runningRunBinding,
    sessionSelectedModelId,
  };
}
