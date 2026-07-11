const HIDDEN_USER_VISIBLE_SENDER_LABELS = new Set([
  'openclaw-control-ui',
]);

function trimOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function normalizeUserVisibleChatSenderLabel(
  value: unknown,
): string | null {
  const normalized = trimOptionalString(value);
  if (!normalized) {
    return null;
  }

  return HIDDEN_USER_VISIBLE_SENDER_LABELS.has(normalized.toLowerCase())
    ? null
    : normalized;
}
