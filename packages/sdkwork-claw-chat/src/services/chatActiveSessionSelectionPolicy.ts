import type { ChatSessionSelectionBinding } from './chatSessionBinding.ts';

export interface ResolveChatActiveSessionSelectionSyncMutationInput {
  isChatSupported: boolean;
  selectedAgentId: string | null | undefined;
  activeSessionBinding: ChatSessionSelectionBinding | null;
  agentOptionIds: Array<string | null>;
}

export interface ChatActiveSessionSelectionSyncMutation {
  nextSelectedAgentId?: string | null;
}

function sameAgentId(left: string | null, right: string | null) {
  return (left ?? null) === (right ?? null);
}

export function resolveChatActiveSessionSelectionSyncMutation(
  params: ResolveChatActiveSessionSelectionSyncMutationInput,
): ChatActiveSessionSelectionSyncMutation | null {
  if (!params.isChatSupported || !params.activeSessionBinding) {
    return null;
  }

  if (params.activeSessionBinding.sessionId === null) {
    return null;
  }

  const activeSessionAgentId = params.activeSessionBinding.agentId;
  const hasMatchingAgentOption = params.agentOptionIds.some((optionId) =>
    sameAgentId(optionId ?? null, activeSessionAgentId),
  );

  if (!hasMatchingAgentOption) {
    return null;
  }

  if (
    params.selectedAgentId !== undefined &&
    sameAgentId(params.selectedAgentId ?? null, activeSessionAgentId)
  ) {
    return null;
  }

  return {
    nextSelectedAgentId: activeSessionAgentId,
  };
}
