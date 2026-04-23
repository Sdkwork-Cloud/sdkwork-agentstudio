import {
  compareChatMessagesForDisplay,
  orderChatMessagesForDisplay,
} from './chatMessageOrdering.ts';

type ChatMessageIdentityLike = {
  id?: string | null;
  seq?: number | null;
  timestamp?: number | null;
  createdAt?: number | null;
  updatedAt?: number | null;
};

function normalizeMessageId(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function dedupeChatMessagesById<T extends ChatMessageIdentityLike>(
  messages: T[],
): T[] {
  if (messages.length <= 1) {
    return orderChatMessagesForDisplay(messages);
  }

  const dedupedMessages: T[] = [];
  const dedupedIndexesById = new Map<string, number>();

  for (const message of messages) {
    const normalizedMessageId = normalizeMessageId(message.id);
    if (!normalizedMessageId) {
      dedupedMessages.push(message);
      continue;
    }

    const existingIndex = dedupedIndexesById.get(normalizedMessageId);
    if (typeof existingIndex !== 'number') {
      dedupedIndexesById.set(normalizedMessageId, dedupedMessages.length);
      dedupedMessages.push(message);
      continue;
    }

    const existingMessage = dedupedMessages[existingIndex];
    if (compareChatMessagesForDisplay(existingMessage, message) <= 0) {
      dedupedMessages[existingIndex] = message;
    }
  }

  return orderChatMessagesForDisplay(dedupedMessages);
}
