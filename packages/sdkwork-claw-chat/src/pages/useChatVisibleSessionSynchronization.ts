import { useEffect } from 'react';
import { resolveChatVisibleSessionSyncMutation } from '../services';

export interface UseChatVisibleSessionSynchronizationInput {
  activeInstanceId: string | null | undefined;
  supportsVisibleSessionSync: boolean;
  activeSessionId: string | null;
  effectiveActiveSessionId: string | null;
  selectedAgentId?: string | null | undefined;
  isSelectionTransitionPending: boolean;
  setActiveSession: (sessionId: string, instanceId?: string) => Promise<void> | void;
}

export function useChatVisibleSessionSynchronization({
  activeInstanceId,
  supportsVisibleSessionSync,
  activeSessionId,
  effectiveActiveSessionId,
  selectedAgentId,
  isSelectionTransitionPending,
  setActiveSession,
}: UseChatVisibleSessionSynchronizationInput) {
  useEffect(() => {
    if (isSelectionTransitionPending) {
      return;
    }

    const syncMutation = resolveChatVisibleSessionSyncMutation({
      activeInstanceId,
      supportsVisibleSessionSync,
      activeSessionId,
      effectiveActiveSessionId,
      selectedAgentId,
    });
    if (!syncMutation) {
      return;
    }

    void setActiveSession(syncMutation.sessionId, syncMutation.instanceId);
  }, [
    activeInstanceId,
    activeSessionId,
    effectiveActiveSessionId,
    isSelectionTransitionPending,
    selectedAgentId,
    setActiveSession,
    supportsVisibleSessionSync,
  ]);
}
