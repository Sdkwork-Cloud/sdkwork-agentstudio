type ChatMessageOrderLike = {
  seq?: number | null;
  timestamp?: number | null;
  createdAt?: number | null;
  updatedAt?: number | null;
};

function normalizeOrderNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function resolveComparableTimestamp(message: ChatMessageOrderLike) {
  return (
    normalizeOrderNumber(message.timestamp) ??
    normalizeOrderNumber(message.updatedAt) ??
    normalizeOrderNumber(message.createdAt)
  );
}

export function compareChatMessagesForDisplay(
  left: ChatMessageOrderLike,
  right: ChatMessageOrderLike,
) {
  const leftSeq = normalizeOrderNumber(left.seq);
  const rightSeq = normalizeOrderNumber(right.seq);
  if (leftSeq !== null && rightSeq !== null && leftSeq !== rightSeq) {
    return leftSeq - rightSeq;
  }

  const leftTimestamp = resolveComparableTimestamp(left);
  const rightTimestamp = resolveComparableTimestamp(right);
  if (
    leftTimestamp !== null &&
    rightTimestamp !== null &&
    leftTimestamp !== rightTimestamp
  ) {
    return leftTimestamp - rightTimestamp;
  }

  if (leftTimestamp !== null && rightTimestamp === null) {
    return -1;
  }

  if (leftTimestamp === null && rightTimestamp !== null) {
    return 1;
  }

  if (leftSeq !== null && rightSeq === null && rightTimestamp === null) {
    return -1;
  }

  if (leftSeq === null && rightSeq !== null && leftTimestamp === null) {
    return 1;
  }

  return 0;
}

export function orderChatMessagesForDisplay<T extends ChatMessageOrderLike>(
  messages: T[],
): T[] {
  return messages
    .map((message, index) => ({
      index,
      message,
    }))
    .sort(
      (left, right) =>
        compareChatMessagesForDisplay(left.message, right.message) ||
        left.index - right.index,
    )
    .map((entry) => entry.message);
}

export function resolveLatestChatMessageForDisplay<T extends ChatMessageOrderLike>(
  messages: T[],
) {
  return orderChatMessagesForDisplay(messages).at(-1) ?? null;
}

export function resolveLatestChatMessageTimestamp<T extends ChatMessageOrderLike>(
  messages: T[],
) {
  const timestamps = messages
    .map((message) => resolveComparableTimestamp(message))
    .filter((timestamp): timestamp is number => timestamp !== null);

  if (timestamps.length === 0) {
    return null;
  }

  return Math.max(...timestamps);
}
