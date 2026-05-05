import { useEffect, useMemo } from 'react';
import type { InstanceChatRouteMode } from '../services';
import { resolveChatBootstrapMutation } from '../services';
import type {
  ChatPageSelectableSessionRef,
  ChatPageSendMode,
  ChatPageSyncState,
} from './chatPageContracts';

export interface UseChatBootstrapSynchronizationInput {
  activeInstanceId: string | null | undefined;
  routeMode: InstanceChatRouteMode | undefined;
  syncState: ChatPageSyncState;
  hasActiveModel: boolean;
  sendMode: ChatPageSendMode;
  effectiveActiveSessionId: string | null;
  selectedAgentId: string | null | undefined;
  isSelectionTransitionPending: boolean;
  selectableInstanceSessions: ChatPageSelectableSessionRef[];
  newSessionModel?: string;
  createSession: (
    model?: string,
    instanceId?: string,
    options?: {
      agentId?: string | null;
      sessionId?: string | null;
    },
  ) => Promise<string>;
  setActiveSession: (sessionId: string, instanceId?: string | null) => Promise<void> | void;
}

export function useChatBootstrapSynchronization({
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
}: UseChatBootstrapSynchronizationInput) {
  const selectableSessionIds = useMemo(
    () => selectableInstanceSessions.map((session) => session.id),
    [selectableInstanceSessions],
  );

  useEffect(() => {
    if (isSelectionTransitionPending) {
      return;
    }

    const bootstrapMutation = resolveChatBootstrapMutation({
      activeInstanceId,
      routeMode,
      sendMode,
      syncState,
      hasActiveModel,
      activeSessionId: effectiveActiveSessionId,
      sessionIds: selectableSessionIds,
      selectedAgentId,
      newSessionModel,
    });

    if (bootstrapMutation?.type === 'createSession') {
      void createSession(
        bootstrapMutation.model,
        bootstrapMutation.instanceId,
      );
      return;
    }

    if (bootstrapMutation?.type === 'selectSession') {
      void setActiveSession(bootstrapMutation.sessionId, bootstrapMutation.instanceId);
    }
  }, [
    activeInstanceId,
    createSession,
    effectiveActiveSessionId,
    hasActiveModel,
    isSelectionTransitionPending,
    newSessionModel,
    routeMode,
    selectableSessionIds,
    selectedAgentId,
    sendMode,
    setActiveSession,
    syncState,
  ]);
}
