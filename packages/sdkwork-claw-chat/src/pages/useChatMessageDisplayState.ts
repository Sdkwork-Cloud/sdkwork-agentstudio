import { useMemo } from 'react';
import type { ChatSession } from '../store/useChatStore';
import {
  groupChatMessagesForDisplay,
  resolveChatConversationBodyState,
  resolveKernelChatMessageState,
  type ChatRuntimeState,
} from '../services';

export interface UseChatMessageDisplayStateInput {
  displaySession: ChatSession | null;
  chatRuntimeState: ChatRuntimeState;
}

export function useChatMessageDisplayState({
  displaySession,
  chatRuntimeState,
}: UseChatMessageDisplayStateInput) {
  void chatRuntimeState;
  const activeMessages = useMemo(
    () => (Array.isArray(displaySession?.messages) ? displaySession.messages : []),
    [displaySession],
  );
  const isHistoryLoading = displaySession?.historyState === 'loading';
  const conversationBodyState = resolveChatConversationBodyState({
    messageCount: activeMessages.length,
    isHistoryLoading,
  });
  const activeMessageStates = useMemo(
    () => activeMessages.map((message) => resolveKernelChatMessageState(message)),
    [activeMessages],
  );
  const activeMessageGroups = useMemo(
    () => groupChatMessagesForDisplay(activeMessageStates),
    [activeMessageStates],
  );

  return {
    activeMessages,
    conversationBodyState,
    activeMessageGroups,
  };
}
