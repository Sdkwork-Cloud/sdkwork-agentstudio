import type { ChatMessageGroup } from './chatMessageGroups.ts';
import {
  presentChatMessageGroupFooter,
  type ChatMessageGroupFooterPresentation,
} from './chatMessageGroupPresentation.ts';
import { resolveChatMessageRenderKey } from './chatMessageRenderKey.ts';
import type { KernelChatMessageState } from './kernelChatMessageState.ts';

export interface ChatConversationPaneMessageItemPresentation {
  key: string;
  message: KernelChatMessageState;
  isTyping: boolean;
}

export interface ChatConversationPaneMessageGroupFooterPresentation
  extends ChatMessageGroupFooterPresentation {
  timestampLabel: string | null;
  isVisible: boolean;
}

export interface ChatConversationPaneMessageGroupPresentation {
  key: string;
  role: string;
  items: ChatConversationPaneMessageItemPresentation[];
  footer: ChatConversationPaneMessageGroupFooterPresentation;
}

export function presentChatConversationPaneMessageGroups(params: {
  sessionId: string | null | undefined;
  messageGroups: ChatMessageGroup<KernelChatMessageState>[];
  messageCount: number;
  isActiveSessionGenerating: boolean;
  groupTimeFormatter: Intl.DateTimeFormat;
  assistantLabel: string;
  userLabel: string;
  toolLabel: string;
  systemLabel: string;
}): ChatConversationPaneMessageGroupPresentation[] {
  return params.messageGroups.map((group, groupIndex) => {
    const firstItem = group.items[0];
    const groupKey = firstItem
      ? `group:${groupIndex}:${resolveChatMessageRenderKey({
          sessionId: params.sessionId,
          message: firstItem.message,
          index: firstItem.index,
        })}`
      : `group:${groupIndex}`;
    const footer = presentChatMessageGroupFooter({
      role: group.role,
      senderLabel: group.senderLabel,
      messages: group.items.map((item) => ({
        role: item.message.role,
        timestamp: item.message.timestamp,
        model: item.message.model ?? null,
      })),
      assistantLabel: params.assistantLabel,
      userLabel: params.userLabel,
      toolLabel: params.toolLabel,
      systemLabel: params.systemLabel,
    });
    const timestampLabel =
      typeof footer.timestamp === 'number'
        ? params.groupTimeFormatter.format(new Date(footer.timestamp))
        : null;

    return {
      key: groupKey,
      role: group.role,
      items: group.items.map((item) => ({
        key: resolveChatMessageRenderKey({
          sessionId: params.sessionId,
          message: item.message,
          index: item.index,
        }),
        message: item.message,
        isTyping:
          params.isActiveSessionGenerating &&
          item.index === params.messageCount - 1 &&
          item.message.role === 'assistant',
      })),
      footer: {
        ...footer,
        timestampLabel,
        isVisible:
          Boolean(footer.label) ||
          Boolean(timestampLabel) ||
          Boolean(footer.modelLabel),
      },
    };
  });
}
