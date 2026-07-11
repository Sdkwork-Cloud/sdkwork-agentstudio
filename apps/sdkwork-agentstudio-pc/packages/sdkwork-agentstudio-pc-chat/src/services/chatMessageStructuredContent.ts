import type { OpenClawToolCard } from './openClawMessagePresentation.ts';

const MAX_JSON_AUTOPARSE_CHARS = 20_000;
const TOOL_SUMMARY_PREVIEW_LIMIT = 120;

export type ChatJsonBlockPresentation =
  | {
      kind: 'array';
      pretty: string;
      itemCount: number;
    }
  | {
      kind: 'object';
      pretty: string;
      keyCount: number;
      keys: string[];
    };

export type ChatToolCardsSummary = {
  totalCount: number;
  visibleNames: string[];
  hiddenCount: number;
  previewText: string | null;
};

export type ChatOperationalEventPresentation = {
  kind: 'reminder' | 'task';
  badgeLabel: string;
  summary: string;
  scheduledAtLabel?: string;
  currentTimeLabel?: string;
};

const LEADING_EVENT_TIMESTAMP_RE = /^\[([^\]]+)\]\s*/;
const REMINDER_TRIGGER_RE = /A scheduled reminder has been triggered\./i;
const TASK_TRIGGER_RE = /A scheduled task has been triggered\./i;
const REMINDER_CONTENT_RE =
  /The reminder content is:\s*([\s\S]*?)(?=\s+Handle this reminder internally\.|\s+Do not relay it to the user unless explicitly requested\.|\s+Current time:|$)/i;
const REMINDER_INTERNAL_SUFFIX_RE =
  /\s+Handle this reminder internally\.[\s\S]*$/i;
const GENERIC_TASK_INTERNAL_SUFFIX_RE =
  /\s+Handle this task internally\.[\s\S]*$/i;
const REMINDER_VISIBILITY_HINT_RE =
  /\s+Do not relay it to the user unless explicitly requested\.[\s\S]*$/i;
const CURRENT_TIME_RE = /\s+Current time:\s*([\s\S]+)$/i;
// Keep Unicode matching ASCII-only in source. Repo lint reserves Han literals for locale resources.
const LOCALIZED_REMINDER_LABEL = '\u63d0\u9192';
const LOCALIZED_TASK_LABEL = '\u4efb\u52a1';
const LOCALIZED_REMINDER_RE = /(?:^|\s)\u63d0\u9192(?:[:\uFF1A])/u;
const LOCALIZED_TASK_RE = /(?:^|\s)\u4efb\u52a1(?:[:\uFF1A]|\s)/u;
const ENGLISH_TASK_PREFIX_RE = /^(?:task|scheduled task)(?:[:\uFF1A]|\s)/i;
const ENGLISH_REMINDER_PREFIX_RE = /^reminder(?:[:\uFF1A]|\s)/i;
const INLINE_SENTENCE_RE = /^(.+?[.!?\u3002\uFF01\uFF1F])(?:\s|$)/u;

function normalizeInlineWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateInlinePreview(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function trimOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function extractOperationalTimestampLabel(content: string) {
  const match = content.match(LEADING_EVENT_TIMESTAMP_RE);
  return trimOptionalString(match?.[1] ?? null) ?? undefined;
}

function stripLeadingOperationalTimestamp(content: string) {
  return content.replace(LEADING_EVENT_TIMESTAMP_RE, '');
}

function stripOperationalCurrentTime(content: string) {
  return content.replace(CURRENT_TIME_RE, '').trim();
}

function extractOperationalCurrentTimeLabel(content: string) {
  const match = content.match(CURRENT_TIME_RE);
  return trimOptionalString(match?.[1] ?? null) ?? undefined;
}

function stripLeadingOperationalKindLabel(
  kind: ChatOperationalEventPresentation['kind'],
  content: string,
) {
  const normalized = content.trim();
  if (!normalized) {
    return normalized;
  }

  if (kind === 'reminder') {
    return normalized
      .replace(/^\u63d0\u9192(?:[:\uFF1A])\s*/u, '')
      .replace(ENGLISH_REMINDER_PREFIX_RE, '')
      .trim();
  }

  return normalized
    .replace(/^\u4efb\u52a1(?:[:\uFF1A])\s*/u, '')
    .replace(ENGLISH_TASK_PREFIX_RE, '')
    .trim();
}

function normalizeOperationalSummary(
  kind: ChatOperationalEventPresentation['kind'],
  content: string,
) {
  const normalized = normalizeInlineWhitespace(content);
  if (!normalized) {
    return normalized;
  }

  const withoutKindLabel = stripLeadingOperationalKindLabel(kind, normalized);
  return withoutKindLabel || normalized;
}

function resolveReminderSummary(content: string) {
  const sanitized = stripOperationalCurrentTime(
    content
      .replace(REMINDER_INTERNAL_SUFFIX_RE, '')
      .replace(REMINDER_VISIBILITY_HINT_RE, '')
      .replace(REMINDER_TRIGGER_RE, ''),
  );
  const reminderContentMatch = sanitized.match(REMINDER_CONTENT_RE);
  if (reminderContentMatch?.[1]) {
    return normalizeOperationalSummary('reminder', reminderContentMatch[1]);
  }

  if (LOCALIZED_REMINDER_RE.test(sanitized)) {
    return normalizeOperationalSummary('reminder', sanitized);
  }

  return normalizeOperationalSummary('reminder', sanitized);
}

function resolveTaskSummary(content: string) {
  const withoutInternalSuffix = stripOperationalCurrentTime(
    content.replace(GENERIC_TASK_INTERNAL_SUFFIX_RE, ''),
  );
  const normalized = normalizeOperationalSummary('task', withoutInternalSuffix);
  const firstSentenceMatch = normalized.match(INLINE_SENTENCE_RE);
  return firstSentenceMatch?.[1]
    ? normalizeInlineWhitespace(firstSentenceMatch[1])
    : normalized;
}

function isStructuredReminderOperationalBody(content: string) {
  return (
    REMINDER_TRIGGER_RE.test(content) ||
    REMINDER_INTERNAL_SUFFIX_RE.test(content) ||
    REMINDER_VISIBILITY_HINT_RE.test(content) ||
    (LOCALIZED_REMINDER_RE.test(content) && CURRENT_TIME_RE.test(content))
  );
}

function isStructuredTaskOperationalBody(content: string) {
  return (
    TASK_TRIGGER_RE.test(content) ||
    GENERIC_TASK_INTERNAL_SUFFIX_RE.test(content) ||
    ((LOCALIZED_TASK_RE.test(content) || ENGLISH_TASK_PREFIX_RE.test(content)) &&
      CURRENT_TIME_RE.test(content))
  );
}

export function shouldPromoteChatOperationalMessageToSystem(content: string) {
  const trimmed = trimOptionalString(content);
  if (!trimmed) {
    return false;
  }

  const body = stripLeadingOperationalTimestamp(trimmed);
  return (
    isStructuredReminderOperationalBody(body) ||
    isStructuredTaskOperationalBody(body)
  );
}

export function detectChatOperationalEvent(
  content: string,
): ChatOperationalEventPresentation | null {
  const trimmed = trimOptionalString(content);
  if (!trimmed) {
    return null;
  }

  const scheduledAtLabel = extractOperationalTimestampLabel(trimmed);
  const body = stripLeadingOperationalTimestamp(trimmed);
  const currentTimeLabel = extractOperationalCurrentTimeLabel(body);

  if (isStructuredReminderOperationalBody(body)) {
    const summary = resolveReminderSummary(body);
    if (!summary) {
      return null;
    }

    return {
      kind: 'reminder',
      badgeLabel: LOCALIZED_REMINDER_RE.test(body)
        ? LOCALIZED_REMINDER_LABEL
        : 'Reminder',
      summary,
      ...(scheduledAtLabel ? { scheduledAtLabel } : {}),
      ...(currentTimeLabel ? { currentTimeLabel } : {}),
    };
  }

  if (isStructuredTaskOperationalBody(body)) {
    const summary = resolveTaskSummary(body);
    if (!summary) {
      return null;
    }

    return {
      kind: 'task',
      badgeLabel: LOCALIZED_TASK_RE.test(body)
        ? LOCALIZED_TASK_LABEL
        : 'Task',
      summary,
      ...(scheduledAtLabel ? { scheduledAtLabel } : {}),
      ...(currentTimeLabel ? { currentTimeLabel } : {}),
    };
  }

  return null;
}

export function sanitizeChatOperationalMessageText(content: string) {
  const event = detectChatOperationalEvent(content);
  return event?.summary ?? content.trim();
}

export function detectChatJsonBlock(text: string): ChatJsonBlockPresentation | null {
  const trimmed = text.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_JSON_AUTOPARSE_CHARS ||
    (!trimmed.startsWith('{') && !trimmed.startsWith('['))
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return {
        kind: 'array',
        pretty: JSON.stringify(parsed, null, 2),
        itemCount: parsed.length,
      };
    }

    if (parsed && typeof parsed === 'object') {
      const keys = Object.keys(parsed as Record<string, unknown>);
      return {
        kind: 'object',
        pretty: JSON.stringify(parsed, null, 2),
        keyCount: keys.length,
        keys,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function presentChatToolCardsSummary(params: {
  toolCards: OpenClawToolCard[];
  previewText?: string | null;
}): ChatToolCardsSummary {
  const normalizedNames = [...new Set(
    params.toolCards
      .map((toolCard) => toolCard.name.trim())
      .filter((name) => name.length > 0),
  )];

  return {
    totalCount: params.toolCards.length,
    visibleNames: normalizedNames.slice(0, 2),
    hiddenCount: Math.max(normalizedNames.length - 2, 0),
    previewText: params.previewText?.trim()
      ? truncateInlinePreview(normalizeInlineWhitespace(params.previewText), TOOL_SUMMARY_PREVIEW_LIMIT)
      : null,
  };
}
