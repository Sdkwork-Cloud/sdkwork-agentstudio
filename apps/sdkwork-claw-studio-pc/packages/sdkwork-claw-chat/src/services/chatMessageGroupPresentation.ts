type ChatMessageGroupPresentationMessageLike = {
  role?: string | null;
  timestamp?: number | null;
  model?: string | null;
};

export type ChatMessageGroupFooterPresentation = {
  label: string;
  timestamp: number | null;
  modelLabel: string | null;
};

function normalizeLabel(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeModelLabel(value: string | null | undefined) {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return null;
  }

  if (normalized === 'gateway-injected') {
    return null;
  }

  return normalized.includes('/') ? normalized.split('/').pop() || normalized : normalized;
}

export function presentChatMessageGroupFooter(params: {
  role?: string | null;
  senderLabel?: string | null;
  messages?: ChatMessageGroupPresentationMessageLike[] | null;
  assistantLabel?: string | null;
  userLabel?: string | null;
  toolLabel?: string | null;
  systemLabel?: string | null;
}): ChatMessageGroupFooterPresentation {
  const normalizedRole = normalizeLabel(params.role).toLowerCase() || 'assistant';
  const messages = Array.isArray(params.messages) ? params.messages : [];
  const firstTimestamp =
    typeof messages[0]?.timestamp === 'number' ? messages[0]?.timestamp ?? null : null;
  const assistantModelLabel =
    normalizedRole === 'assistant'
      ? normalizeModelLabel(
          [...messages]
            .reverse()
            .find((message) => normalizeModelLabel(message.model))?.model ?? null,
        )
      : null;

  if (normalizedRole === 'user') {
    return {
      label: normalizeLabel(params.senderLabel) || normalizeLabel(params.userLabel) || 'You',
      timestamp: firstTimestamp,
      modelLabel: null,
    };
  }

  if (normalizedRole === 'tool') {
    return {
      label: normalizeLabel(params.toolLabel) || 'Tool',
      timestamp: firstTimestamp,
      modelLabel: null,
    };
  }

  if (normalizedRole === 'system') {
    return {
      label: normalizeLabel(params.systemLabel) || 'System',
      timestamp: firstTimestamp,
      modelLabel: null,
    };
  }

  return {
    label: normalizeLabel(params.assistantLabel) || 'Assistant',
    timestamp: firstTimestamp,
    modelLabel: assistantModelLabel,
  };
}
