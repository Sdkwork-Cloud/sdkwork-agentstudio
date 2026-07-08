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

function resolveTypingMessageIndex(params: {
  messageGroups: ChatMessageGroup<KernelChatMessageState>[];
  messageCount: number;
  isActiveSessionGenerating: boolean;
  activeRunId: string | null;
}) {
  if (!params.isActiveSessionGenerating) {
    return null;
  }

  let latestActiveRunAssistantIndex: number | null = null;
  let latestStreamingAssistantIndex: number | null = null;
  let latestPendingAssistantPlaceholderIndex: number | null = null;

  for (const group of params.messageGroups) {
    for (const item of group.items) {
      if (item.message.role !== 'assistant') {
        continue;
      }

      const messageRunId = item.message.runId?.trim() || null;
      const hasVisibleAssistantPayload = Boolean(
        item.message.content.trim().length > 0 ||
        item.message.attachments.length > 0 ||
        item.message.reasoning?.trim() ||
        item.message.toolCards.length > 0 ||
        item.message.notices.length > 0,
      );
      if (params.activeRunId && messageRunId === params.activeRunId) {
        latestActiveRunAssistantIndex = item.index;
      }

      if (
        item.message.status === 'streaming' &&
        (!params.activeRunId || !messageRunId || messageRunId === params.activeRunId)
      ) {
        latestStreamingAssistantIndex = item.index;
      }

      if (
        !hasVisibleAssistantPayload &&
        item.message.status !== 'error' &&
        (!params.activeRunId || !messageRunId || messageRunId === params.activeRunId)
      ) {
        latestPendingAssistantPlaceholderIndex = item.index;
      }
    }
  }

  if (params.activeRunId) {
    if (latestActiveRunAssistantIndex === null) {
      return latestStreamingAssistantIndex ?? latestPendingAssistantPlaceholderIndex;
    }

    if (latestStreamingAssistantIndex === null) {
      return latestActiveRunAssistantIndex;
    }

    return Math.max(latestActiveRunAssistantIndex, latestStreamingAssistantIndex);
  }

  return latestStreamingAssistantIndex ?? latestPendingAssistantPlaceholderIndex;
}

function normalizeSessionKeyScope(sessionId: string | null | undefined) {
  const normalizedSessionId = sessionId?.trim();
  return normalizedSessionId ? `session:${normalizedSessionId}` : 'session:unknown';
}

function resolveTypingPlaceholderKey(params: {
  sessionId: string | null | undefined;
  activeRunId: string | null;
  messageCount: number;
}) {
  const runScope = params.activeRunId?.trim() || 'pending';
  return `${normalizeSessionKeyScope(params.sessionId)}:typing:${runScope}:${params.messageCount}`;
}

function resolveLatestMessageTimestamp(
  messageGroups: ChatMessageGroup<KernelChatMessageState>[],
) {
  let latestTimestamp = 0;

  for (const group of messageGroups) {
    for (const item of group.items) {
      latestTimestamp = Math.max(latestTimestamp, item.message.timestamp);
    }
  }

  return latestTimestamp;
}

function createTypingPlaceholderMessage(params: {
  activeRunId: string | null;
  timestamp: number;
}): KernelChatMessageState {
  return {
    role: 'assistant',
    status: 'streaming',
    content: '',
    timestamp: params.timestamp,
    senderLabel: null,
    ...(params.activeRunId ? { runId: params.activeRunId } : {}),
    nativeMetadata: null,
    attachments: [],
    reasoning: null,
    toolCards: [],
    notices: [],
  };
}

export function presentChatConversationPaneMessageGroups(params: {
  sessionId: string | null | undefined;
  messageGroups: ChatMessageGroup<KernelChatMessageState>[];
  messageCount: number;
  isActiveSessionGenerating: boolean;
  activeRunId?: string | null;
  groupTimeFormatter: Intl.DateTimeFormat;
  assistantLabel: string;
  userLabel: string;
  toolLabel: string;
  systemLabel: string;
}): ChatConversationPaneMessageGroupPresentation[] {
  const activeRunId = params.activeRunId?.trim() || null;
  const typingMessageIndex = resolveTypingMessageIndex({
    messageGroups: params.messageGroups,
    messageCount: params.messageCount,
    isActiveSessionGenerating: params.isActiveSessionGenerating,
    activeRunId,
  });

  const presentedGroups = params.messageGroups.map((group, groupIndex) => {
    const firstItem = group.items[0];
    const groupKey = firstItem
      ? `group:${resolveChatMessageRenderKey({
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
          item.message.role === 'assistant' &&
          item.index === typingMessageIndex,
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

  if (
    params.isActiveSessionGenerating &&
    typingMessageIndex === null &&
    params.messageCount > 0
  ) {
    const placeholderKey = resolveTypingPlaceholderKey({
      sessionId: params.sessionId,
      activeRunId,
      messageCount: params.messageCount,
    });
    presentedGroups.push({
      key: `group:${placeholderKey}`,
      role: 'assistant',
      items: [
        {
          key: placeholderKey,
          message: createTypingPlaceholderMessage({
            activeRunId,
            timestamp: resolveLatestMessageTimestamp(params.messageGroups),
          }),
          isTyping: true,
        },
      ],
      footer: {
        label: params.assistantLabel,
        timestamp: null,
        timestampLabel: null,
        modelLabel: null,
        isVisible: false,
      },
    });
  }

  return presentedGroups;
}
