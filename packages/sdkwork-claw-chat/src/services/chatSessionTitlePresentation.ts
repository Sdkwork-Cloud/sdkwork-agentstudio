import type { StudioConversationAttachment } from '@sdkwork/claw-types';
import type { KernelChatMessage } from '@sdkwork/claw-types';
import { resolveKernelChatMessageState } from './kernelChatMessageState.ts';

export const DEFAULT_CHAT_SESSION_TITLE = 'New Conversation';

const DEFAULT_MAX_TITLE_LENGTH = 80;
const GENERIC_CHAT_SESSION_TITLE_PATTERN =
  /^(?:assistant|cli|claw-studio|default|main|openclaw|openclaw[-_/ ](?:cli|gateway|studio|tui|web)|studio-web|system|tui)$/i;
const TECHNICAL_CHAT_IDENTIFIER_PATTERN =
  /^(?:msg|message|session|thread|conversation)((?:[-_:][a-z0-9]+)+)$/i;

type ChatSessionTitleMessageLike = {
  role?: string;
  content?: string;
  attachments?: StudioConversationAttachment[];
  kernelMessage?: KernelChatMessage | null;
};

type ChatSessionTitleSource = 'default' | 'preview' | 'explicit' | 'firstUser';

type ChatSessionTitleSessionLike = {
  id?: string;
  title?: string;
  titleSource?: ChatSessionTitleSource;
  messages?: ChatSessionTitleMessageLike[];
  lastMessagePreview?: string;
};

function collapseChatSessionTitleWhitespace(value: string | null | undefined) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function truncateChatSessionTitle(value: string, maxLength = DEFAULT_MAX_TITLE_LENGTH) {
  if (maxLength <= 0 || value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return '.'.repeat(maxLength);
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function isGenericChatSessionTitle(value: string) {
  return GENERIC_CHAT_SESSION_TITLE_PATTERN.test(value);
}

function isTechnicalChatIdentifier(value: string) {
  const match = value.match(TECHNICAL_CHAT_IDENTIFIER_PATTERN);
  if (!match) {
    return false;
  }

  const suffix = match[1] ?? '';
  const segmentCount = suffix.split(/[-_:]+/g).filter(Boolean).length;
  return /\d/.test(value) || segmentCount >= 2;
}

function escapeChatSessionTitleRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseTypedChatSessionTitleSessionKey(value: string | null | undefined) {
  const normalized = collapseChatSessionTitleWhitespace(value).toLowerCase();
  if (!normalized) {
    return {
      prefix: '',
      fallbackTitle: '',
    };
  }

  if (normalized === 'main' || normalized === 'agent:main:main') {
    return {
      prefix: '',
      fallbackTitle: 'Main Session',
    };
  }

  if (normalized.includes(':subagent:')) {
    return {
      prefix: 'Subagent:',
      fallbackTitle: 'Subagent:',
    };
  }

  if (normalized.startsWith('cron:') || normalized.includes(':cron:')) {
    return {
      prefix: 'Cron:',
      fallbackTitle: 'Cron Job:',
    };
  }

  return {
    prefix: '',
    fallbackTitle: '',
  };
}

function applyTypedChatSessionTitlePrefix(title: string, sessionId: string | null | undefined) {
  const { prefix } = parseTypedChatSessionTitleSessionKey(sessionId);
  if (!prefix) {
    return title;
  }

  const prefixPattern = new RegExp(`^${escapeChatSessionTitleRegex(prefix)}\\s*`, 'i');
  return prefixPattern.test(title) ? title : `${prefix} ${title}`;
}

export function normalizeChatSessionTitle(
  value: string | null | undefined,
  maxLength = DEFAULT_MAX_TITLE_LENGTH,
) {
  const normalized = collapseChatSessionTitleWhitespace(value);
  if (!normalized) {
    return '';
  }

  return truncateChatSessionTitle(normalized, maxLength);
}

export function isOpaqueChatSessionTitle(value: string | null | undefined) {
  const normalized = collapseChatSessionTitleWhitespace(value);
  if (!normalized) {
    return true;
  }

  return (
    isGenericChatSessionTitle(normalized) ||
    isTechnicalChatIdentifier(normalized) ||
    /^claw-studio:/i.test(normalized) ||
    /^thread:/i.test(normalized) ||
    /^agent:[a-z0-9._-]+:[a-z0-9._-]+$/i.test(normalized) ||
    /^agent:[a-z0-9._-]+:(?:[a-z0-9._-]+:)*thread:[a-z0-9._:-]+$/i.test(normalized) ||
    /^[0-9a-f]{16,}$/i.test(normalized) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  );
}

export function isReadableChatSessionTitle(value: string | null | undefined) {
  const normalized = collapseChatSessionTitleWhitespace(value);
  if (!normalized || normalized === DEFAULT_CHAT_SESSION_TITLE) {
    return false;
  }

  return !isOpaqueChatSessionTitle(normalized);
}

export function deriveChatSessionTitleFromMessage(params: {
  text: string;
  attachments?: StudioConversationAttachment[];
  fallback?: string;
  maxLength?: number;
}) {
  const textTitle = normalizeChatSessionTitle(params.text, params.maxLength);
  if (textTitle) {
    return textTitle;
  }

  const attachmentTitle = normalizeChatSessionTitle(
    (params.attachments ?? [])
      .map((attachment) => attachment.name.trim())
      .filter(Boolean)
      .join(', '),
    params.maxLength,
  );

  return attachmentTitle || params.fallback || DEFAULT_CHAT_SESSION_TITLE;
}

export function selectReadableChatSessionTitleCandidates(
  candidates: Array<string | null | undefined>,
  fallback = DEFAULT_CHAT_SESSION_TITLE,
) {
  for (const candidate of candidates) {
    const normalized = normalizeChatSessionTitle(candidate);
    if (!normalized) {
      continue;
    }

    if (isReadableChatSessionTitle(normalized)) {
      return normalized;
    }
  }

  return fallback;
}

export function resolveInitialChatSessionTitle(params: {
  existingTitle?: string;
  text: string;
  attachments?: StudioConversationAttachment[];
  isFirstUserMessage: boolean;
}) {
  const normalizedExistingTitle = normalizeChatSessionTitle(params.existingTitle);
  if (!params.isFirstUserMessage) {
    return normalizedExistingTitle || DEFAULT_CHAT_SESSION_TITLE;
  }

  if (isReadableChatSessionTitle(normalizedExistingTitle)) {
    return normalizedExistingTitle;
  }

  return deriveChatSessionTitleFromMessage({
    text: params.text,
    attachments: params.attachments,
  });
}

export function getChatSessionDisplayTitle(session: ChatSessionTitleSessionLike) {
  const explicitTitle = normalizeChatSessionTitle(session.title);
  const typedSessionKey = parseTypedChatSessionTitleSessionKey(session.id);
  const normalizedSessionId = normalizeChatSessionTitle(session.id);
  const explicitTitleMatchesTypedSessionKey =
    Boolean(typedSessionKey.fallbackTitle) &&
    Boolean(normalizedSessionId) &&
    explicitTitle.toLowerCase() === normalizedSessionId.toLowerCase();

  if (isReadableChatSessionTitle(explicitTitle) && !explicitTitleMatchesTypedSessionKey) {
    if (session.titleSource === 'explicit') {
      return applyTypedChatSessionTitlePrefix(explicitTitle, session.id);
    }

    return explicitTitle;
  }

  const firstUserMessageState = Array.isArray(session.messages)
    ? session.messages
      .map((message) => resolveKernelChatMessageState(message))
      .find((message) => message.role === 'user')
    : undefined;
  if (firstUserMessageState) {
    const firstUserTitle = deriveChatSessionTitleFromMessage({
      text: firstUserMessageState.content,
      attachments: firstUserMessageState.attachments,
    });
    if (firstUserTitle && firstUserTitle !== DEFAULT_CHAT_SESSION_TITLE) {
      return firstUserTitle;
    }
  }

  const previewTitle = normalizeChatSessionTitle(session.lastMessagePreview);
  if (isReadableChatSessionTitle(previewTitle)) {
    return previewTitle;
  }

  if (typedSessionKey.fallbackTitle) {
    return typedSessionKey.fallbackTitle;
  }

  return DEFAULT_CHAT_SESSION_TITLE;
}
