import { useEffect } from 'react';
import { resolveChatContextSelectionSyncMutation } from '../services';

export interface UseChatContextSelectionSynchronizationInput {
  isChatSupportedRoute: boolean;
  isSelectionTransitionPending: boolean;
  selectedAgentId: string | null | undefined;
  selectedSkillId: string | null;
  hasResolvedVisibleAgents: boolean;
  visibleAgentIds: string[];
  setSelectedAgentId: (agentId: string | null | undefined) => void;
  setSelectedSkillId: (skillId: string | null) => void;
}

export function useChatContextSelectionSynchronization({
  isChatSupportedRoute,
  isSelectionTransitionPending,
  selectedAgentId,
  selectedSkillId,
  hasResolvedVisibleAgents,
  visibleAgentIds,
  setSelectedAgentId,
  setSelectedSkillId,
}: UseChatContextSelectionSynchronizationInput) {
  const contextSelectionSyncMutation = resolveChatContextSelectionSyncMutation({
    isChatSupported: isChatSupportedRoute,
    selectedAgentId,
    selectedSkillId,
    hasResolvedVisibleAgents,
    visibleAgentIds,
  });

  useEffect(() => {
    if (isSelectionTransitionPending) {
      return;
    }

    if (
      contextSelectionSyncMutation &&
      contextSelectionSyncMutation.nextSelectedAgentId !== selectedAgentId
    ) {
      setSelectedAgentId(contextSelectionSyncMutation.nextSelectedAgentId);
    }
    if (
      contextSelectionSyncMutation?.nextSelectedSkillId !== undefined &&
      contextSelectionSyncMutation.nextSelectedSkillId !== selectedSkillId
    ) {
      setSelectedSkillId(contextSelectionSyncMutation.nextSelectedSkillId);
    }
  }, [
    contextSelectionSyncMutation,
    isSelectionTransitionPending,
    selectedAgentId,
    selectedSkillId,
    setSelectedAgentId,
    setSelectedSkillId,
  ]);
}
