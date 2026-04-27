import type { StudioConversationAttachment } from '@sdkwork/claw-types';
import type { KernelChatMessage } from '@sdkwork/claw-types';
import {
  resolveKernelChatMessageState,
  type KernelChatMessageState,
} from './kernelChatMessageState.ts';
import { normalizeChatMessageTextEncoding } from './chatTextEncoding.ts';

export const DEFAULT_CHAT_SESSION_TITLE = 'New Conversation';

const DEFAULT_MAX_TITLE_LENGTH = 300;
const GENERIC_CHAT_SESSION_TITLE_PATTERN =
  /^(?:assistant|cli|claw-studio|default|main|openclaw|openclaw[-_/ ](?:cli|gateway|studio|tui|web)|studio-web|system|tui)$/i;
const TECHNICAL_CHAT_IDENTIFIER_PATTERN =
  /^(?:msg|message|session|thread|conversation)((?:[-_:][a-z0-9]+)+)$/i;

export type ChatSessionTitleMessageLike = {
  role?: string;
  content?: string;
  attachments?: StudioConversationAttachment[];
  kernelMessage?: KernelChatMessage | null;
};

export type ChatSessionTitleSource = 'default' | 'preview' | 'explicit' | 'firstUser';

type ChatSessionTitleSessionLike = {
  id?: string;
  title?: string;
  titleSource?: ChatSessionTitleSource;
  messages?: ChatSessionTitleMessageLike[];
  lastMessagePreview?: string;
  transport?: string | null;
  kernelSession?: {
    ref?: {
      kernelId?: string | null;
    } | null;
  } | null;
};

function collapseChatSessionTitleWhitespace(value: string | null | undefined) {
  return typeof value === 'string'
    ? normalizeChatMessageTextEncoding(value).replace(/\s+/g, ' ').trim()
    : '';
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

function isDateLikeChatSessionTitle(value: string) {
  const normalized = value
    .replace(/[\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return false;
  }

  return (
    /^\d{8}(?:\d{2}(?:\d{2}){0,2})?$/.test(normalized) ||
    /^\d{10,13}$/.test(normalized) ||
    /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:\s?(?:Z|[+-]\d{2}:?\d{2}))?)?$/i.test(normalized) ||
    /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}(?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?)?$/.test(normalized) ||
    /^\d{1,2}[-/.]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.test(normalized) ||
    /^\d{4}\u5e74\d{1,2}\u6708\d{1,2}\u65e5?(?:\s*\d{1,2}:\d{2}(?::\d{2})?)?$/.test(normalized) ||
    /^\d{1,2}\u6708\d{1,2}\u65e5?(?:\s*\d{1,2}:\d{2}(?::\d{2})?)?$/.test(normalized) ||
    /^\d{1,2}:\d{2}(?::\d{2})?$/.test(normalized)
  );
}

function hasDateLikeChatSessionTitleFragment(value: string) {
  const fragments = [
    ...Array.from(value.matchAll(/\(([^)]{1,64})\)/g), (match) => match[1] ?? ''),
    ...Array.from(
      value.matchAll(
        /\b(?:\d{8}(?:\d{2}(?:\d{2}){0,2})?|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?|\d{1,2}:\d{2}(?::\d{2})?)\b/g,
      ),
      (match) => match[0] ?? '',
    ),
  ];

  return fragments.some((fragment) => isDateLikeChatSessionTitle(fragment));
}

function isTechnicalDateCompositeChatSessionTitle(value: string) {
  if (!hasDateLikeChatSessionTitleFragment(value)) {
    return false;
  }

  const withoutDateFragments = value
    .replace(/\([^)]{1,64}\)/g, ' ')
    .replace(
      /\b(?:\d{8}(?:\d{2}(?:\d{2}){0,2})?|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?|\d{1,2}:\d{2}(?::\d{2})?)\b/g,
      ' ',
    )
    .trim();
  if (
    /[a-z0-9]\s+[a-z0-9]/i.test(withoutDateFragments) &&
    !/[:_.-]/.test(withoutDateFragments)
  ) {
    return false;
  }

  const compact = withoutDateFragments.replace(/[^a-z0-9]+/gi, '').toLowerCase();
  if (!compact) {
    return true;
  }

  if (!/\s/.test(withoutDateFragments) && /\d/.test(compact)) {
    return true;
  }

  return (
    compact.includes('clawstudio') ||
    compact.includes('openclaw') ||
    compact.includes('session') ||
    compact.includes('thread') ||
    compact.includes('conversation') ||
    compact.includes('agent') ||
    compact.endsWith('id')
  );
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

  if (
    normalized === 'main' ||
    normalized === 'agent:main:main' ||
    /^agent:[a-z0-9._-]+:main$/i.test(normalized)
  ) {
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

function normalizeChatSessionTitleComparisonValue(value: string | null | undefined) {
  return normalizeChatSessionTitle(value).toLowerCase();
}

function resolveChatSessionTitleMessageStates(
  messages: ChatSessionTitleMessageLike[] | undefined,
) {
  return Array.isArray(messages)
    ? messages.map((message) => resolveKernelChatMessageState(message))
    : [];
}

function isPreviewBackedChatSessionTitleState(params: {
  title: string | null | undefined;
  titleSource?: ChatSessionTitleSource;
  lastMessagePreview?: string | null;
  messageStates: KernelChatMessageState[];
}) {
  if (params.titleSource === 'explicit' || params.titleSource === 'firstUser') {
    return false;
  }

  const normalizedTitle = normalizeChatSessionTitleComparisonValue(params.title);
  if (!normalizedTitle) {
    return false;
  }

  const normalizedPreview = normalizeChatSessionTitleComparisonValue(
    params.lastMessagePreview,
  );
  if (normalizedPreview && normalizedPreview === normalizedTitle) {
    return true;
  }

  const firstUserMessageIndex = params.messageStates.findIndex(
    (message) => message.role === 'user',
  );

  return params.messageStates.some(
    (message, index) =>
      index !== firstUserMessageIndex &&
      normalizeChatSessionTitleComparisonValue(message.content) === normalizedTitle,
  );
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
    isDateLikeChatSessionTitle(normalized) ||
    isTechnicalDateCompositeChatSessionTitle(normalized) ||
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

export function isPreviewBackedChatSessionTitle(params: {
  title: string | null | undefined;
  titleSource?: ChatSessionTitleSource;
  lastMessagePreview?: string | null;
  messages?: ChatSessionTitleMessageLike[];
}) {
  return isPreviewBackedChatSessionTitleState({
    title: params.title,
    titleSource: params.titleSource,
    lastMessagePreview: params.lastMessagePreview,
    messageStates: resolveChatSessionTitleMessageStates(params.messages),
  });
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

function deriveReadableChatSessionTitleFromMessageState(
  messageState: KernelChatMessageState | null | undefined,
) {
  if (!messageState) {
    return null;
  }

  const title = deriveChatSessionTitleFromMessage({
    text: messageState.content,
    attachments: messageState.attachments,
  });
  return title !== DEFAULT_CHAT_SESSION_TITLE ? title : null;
}

function isConversationTitleFallbackMessage(messageState: KernelChatMessageState) {
  return messageState.role !== 'system' && messageState.role !== 'tool';
}

function findFirstReadableChatSessionTitleFromMessageStates(
  messageStates: KernelChatMessageState[],
  predicate: (messageState: KernelChatMessageState) => boolean,
) {
  for (const messageState of messageStates) {
    if (!predicate(messageState)) {
      continue;
    }

    const title = deriveReadableChatSessionTitleFromMessageState(messageState);
    if (title) {
      return title;
    }
  }

  return null;
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
  const messageStates = resolveChatSessionTitleMessageStates(session.messages);
  const typedSessionKey = parseTypedChatSessionTitleSessionKey(session.id);
  const normalizedSessionId = normalizeChatSessionTitle(session.id);
  const explicitTitleMatchesTypedSessionKey =
    Boolean(typedSessionKey.fallbackTitle) &&
    Boolean(normalizedSessionId) &&
    explicitTitle.toLowerCase() === normalizedSessionId.toLowerCase();
  const hasAuthoritativeStoredTitle = session.titleSource !== 'preview';
  const explicitTitleMatchesLegacyPreview = isPreviewBackedChatSessionTitleState({
    title: explicitTitle,
    titleSource: session.titleSource,
    lastMessagePreview: session.lastMessagePreview,
    messageStates,
  });

  if (
    hasAuthoritativeStoredTitle &&
    isReadableChatSessionTitle(explicitTitle) &&
    !explicitTitleMatchesTypedSessionKey &&
    !explicitTitleMatchesLegacyPreview
  ) {
    if (session.titleSource === 'explicit') {
      return applyTypedChatSessionTitlePrefix(explicitTitle, session.id);
    }

    return explicitTitle;
  }

  const firstUserTitle = findFirstReadableChatSessionTitleFromMessageStates(
    messageStates,
    (messageState) => messageState.role === 'user',
  );
  if (firstUserTitle) {
    return firstUserTitle;
  }

  const firstConversationMessageTitle = findFirstReadableChatSessionTitleFromMessageStates(
    messageStates,
    isConversationTitleFallbackMessage,
  );
  if (firstConversationMessageTitle) {
    return firstConversationMessageTitle;
  }

  if (typedSessionKey.fallbackTitle) {
    return typedSessionKey.fallbackTitle;
  }

  return DEFAULT_CHAT_SESSION_TITLE;
}
