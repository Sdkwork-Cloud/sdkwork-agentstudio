import { useEffect, useMemo } from 'react';
import type { ChatSessionBindingSource } from '../services';
import {
  resolveChatActiveSessionSelectionSyncMutation,
  resolveChatSessionBinding,
} from '../services';

export interface UseChatActiveSessionSelectionSynchronizationInput {
  isChatSupportedRoute: boolean;
  isSelectionTransitionPending: boolean;
  activeSession: ChatSessionBindingSource | null;
  selectedAgentId: string | null | undefined;
  agentOptionIds: Array<string | null>;
  setSelectedAgentId: (agentId: string | null | undefined) => void;
}

export function useChatActiveSessionSelectionSynchronization({
  isChatSupportedRoute,
  isSelectionTransitionPending,
  activeSession,
  selectedAgentId,
  agentOptionIds,
  setSelectedAgentId,
}: UseChatActiveSessionSelectionSynchronizationInput) {
  const activeSessionBinding = useMemo(
    () => resolveChatSessionBinding(activeSession),
    [activeSession],
  );
  const activeSessionSelectionSyncMutation = useMemo(
    () =>
      resolveChatActiveSessionSelectionSyncMutation({
        isChatSupported: isChatSupportedRoute,
        selectedAgentId,
        activeSessionBinding,
        agentOptionIds,
      }),
    [
      activeSessionBinding,
      agentOptionIds,
      isChatSupportedRoute,
      selectedAgentId,
    ],
  );

  useEffect(() => {
    if (isSelectionTransitionPending) {
      return;
    }

    if (
      activeSessionSelectionSyncMutation &&
      activeSessionSelectionSyncMutation.nextSelectedAgentId !== selectedAgentId
    ) {
      setSelectedAgentId(activeSessionSelectionSyncMutation.nextSelectedAgentId);
    }
  }, [
    activeSessionSelectionSyncMutation,
    isSelectionTransitionPending,
    selectedAgentId,
    setSelectedAgentId,
  ]);
}
