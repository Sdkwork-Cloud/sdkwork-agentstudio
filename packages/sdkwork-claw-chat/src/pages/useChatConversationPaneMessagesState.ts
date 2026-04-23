import { useMemo } from 'react';
import type { ChatConversationPaneProps } from '../components/ChatConversationPane';
import {
  presentChatConversationPaneMessageGroups,
  type ChatMessageGroup,
  type KernelChatMessageState,
} from '../services';
import type { ChatPageTranslate } from './chatPageContracts';

export interface UseChatConversationPaneMessagesStateInput {
  t: ChatPageTranslate;
  effectiveActiveSessionId: string | null;
  activeMessageGroups: ChatMessageGroup<KernelChatMessageState>[];
  messageCount: number;
  isActiveSessionGenerating: boolean;
  groupTimeFormatter: Intl.DateTimeFormat;
}

export interface UseChatConversationPaneMessagesStateResult {
  messageGroups: ChatConversationPaneProps['messageGroups'];
}

export function useChatConversationPaneMessagesState({
  t,
  effectiveActiveSessionId,
  activeMessageGroups,
  messageCount,
  isActiveSessionGenerating,
  groupTimeFormatter,
}: UseChatConversationPaneMessagesStateInput): UseChatConversationPaneMessagesStateResult {
  const messageGroups = useMemo(
    () =>
      presentChatConversationPaneMessageGroups({
        sessionId: effectiveActiveSessionId,
        messageGroups: activeMessageGroups,
        messageCount,
        isActiveSessionGenerating,
        groupTimeFormatter,
        assistantLabel: t('chat.message.assistant'),
        userLabel: t('chat.message.you'),
        toolLabel: t('chat.message.toolOutput'),
        systemLabel: t('chat.message.system'),
      }),
    [
      activeMessageGroups,
      effectiveActiveSessionId,
      groupTimeFormatter,
      isActiveSessionGenerating,
      messageCount,
      t,
    ],
  );

  return {
    messageGroups,
  };
}
