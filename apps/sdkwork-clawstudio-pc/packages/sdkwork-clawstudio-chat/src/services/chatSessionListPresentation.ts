import type { KernelChatMessage, StudioConversationAttachment } from '@sdkwork/clawstudio-types';
import type { OpenClawToolCard } from './openClawMessagePresentation.ts';
import { orderChatMessagesForDisplay } from './chatMessageOrdering.ts';
import {
  normalizeChatMessagePreviewText,
  resolveChatMessageAttachmentNamesPreview,
  resolveChatMessageNoticePreview,
  resolveChatMessageToolPreview,
} from './chatMessagePreview.ts';
import {
  getChatSessionDisplayTitle,
  isReadableChatSessionTitle,
  normalizeChatSessionTitle,
} from './chatSessionTitlePresentation.ts';
import {
  resolveKernelChatMessageState,
  type KernelChatMessageState,
} from './kernelChatMessageState.ts';
import { resolveChatRunBinding, type ChatRunBindingSource } from './chatRunBinding.ts';
import { sanitizeChatSessionPreviewText } from './chatSessionPreviewSanitizer.ts';

const DEFAULT_PREVIEW_LENGTH = 96;
const DAY_IN_MS = 86_400_000;

type ChatSessionListMessageLike = {
  role?: string;
  content?: string;
  timestamp?: number;
  seq?: number;
  senderLabel?: string | null;
  attachments?: StudioConversationAttachment[];
  toolCards?: OpenClawToolCard[];
  nativeMetadata?: Record<string, unknown> | null;
  kernelMessage?: KernelChatMessage | null;
};

type ChatSessionListSessionLike = ChatRunBindingSource & {
  id: string;
  title?: string;
  titleSource?: 'default' | 'preview' | 'explicit' | 'firstUser';
  updatedAt: number;
  lastMessagePreview?: string;
  messages?: ChatSessionListMessageLike[];
  kernelSession?: {
    ref?: {
      kernelId?: string | null;
    } | null;
  } | null;
};

export type ChatSessionListItemPresentation = {
  displayTitle: string;
  preview: string | null;
  relativeTimeLabel: string;
  isRunning: boolean;
  isPinned: boolean;
  showDeleteAction: boolean;
};

export type ChatSessionListPreviewLabels = {
  you: string;
  system: string;
  tool: string;
  attachment: string;
  attachments: string;
};

export type ChatSessionListRelativeTimeLabels = {
  yesterday: string;
  daysAgo: (count: number) => string;
};

type PreviewCandidate = {
  text: string;
  semanticText: string;
};

type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

const DEFAULT_PREVIEW_LABELS: ChatSessionListPreviewLabels = {
  you: 'You',
  system: 'System',
  tool: 'Tool',
  attachment: 'Attachment',
  attachments: 'Attachments',
};

const DEFAULT_RELATIVE_TIME_LABELS: ChatSessionListRelativeTimeLabels = {
  yesterday: 'Yesterday',
  daysAgo: (count) => `${count} days ago`,
};

function normalizePreviewCandidate(value: string | null | undefined) {
  return normalizeChatMessagePreviewText(value, DEFAULT_PREVIEW_LENGTH);
}

function createPreviewCandidate(
  text: string | null | undefined,
  semanticText?: string | null | undefined,
): PreviewCandidate | null {
  const normalizedText = normalizePreviewCandidate(text);
  if (!normalizedText) {
    return null;
  }

  return {
    text: normalizedText,
    semanticText: normalizePreviewCandidate(semanticText ?? text) ?? normalizedText,
  };
}

function formatPreviewWithLabel(label: string, value: string) {
  return `${label}: ${value}`;
}

function listAttachmentPreview(params: {
  attachments: StudioConversationAttachment[] | undefined;
  labels: ChatSessionListPreviewLabels;
}) {
  const normalizedNames = resolveChatMessageAttachmentNamesPreview(
    params.attachments,
    DEFAULT_PREVIEW_LENGTH,
  );
  if (!normalizedNames) {
    return null;
  }

  const label =
    (params.attachments?.length ?? 0) > 1 ? params.labels.attachments : params.labels.attachment;
  return createPreviewCandidate(
    formatPreviewWithLabel(label, normalizedNames),
    normalizedNames,
  );
}

function resolveToolCardPreview(toolCards: OpenClawToolCard[] | undefined) {
  return resolveChatMessageToolPreview(toolCards, DEFAULT_PREVIEW_LENGTH);
}

function resolveMessagePreviewCandidate(params: {
  message: KernelChatMessageState;
  labels: ChatSessionListPreviewLabels;
}) {
  const contentCandidate = normalizePreviewCandidate(params.message.content);
  const noticeCandidate = resolveChatMessageNoticePreview(
    params.message.notices,
    DEFAULT_PREVIEW_LENGTH,
  );
  const attachmentCandidate = listAttachmentPreview({
    attachments: params.message.attachments,
    labels: params.labels,
  });
  const toolCandidate = normalizePreviewCandidate(resolveToolCardPreview(params.message.toolCards));

  if (params.message.role === 'tool') {
    if (toolCandidate) {
      return createPreviewCandidate(
        formatPreviewWithLabel(params.labels.tool, toolCandidate),
        toolCandidate,
      );
    }

    if (contentCandidate) {
      return createPreviewCandidate(
        formatPreviewWithLabel(params.labels.tool, contentCandidate),
        contentCandidate,
      );
    }

    if (noticeCandidate) {
      return createPreviewCandidate(noticeCandidate, noticeCandidate);
    }

    return attachmentCandidate;
  }

  if (params.message.role === 'user' && contentCandidate) {
    return createPreviewCandidate(
      formatPreviewWithLabel(params.labels.you, contentCandidate),
      contentCandidate,
    );
  }

  if (params.message.role === 'system') {
    if (contentCandidate) {
      return createPreviewCandidate(
        formatPreviewWithLabel(params.labels.system, contentCandidate),
        contentCandidate,
      );
    }

    if (toolCandidate) {
      return createPreviewCandidate(
        formatPreviewWithLabel(params.labels.system, toolCandidate),
        toolCandidate,
      );
    }

    if (attachmentCandidate) {
      return createPreviewCandidate(
        formatPreviewWithLabel(params.labels.system, attachmentCandidate.semanticText),
        attachmentCandidate.semanticText,
      );
    }
  }

  if (contentCandidate) {
    return createPreviewCandidate(contentCandidate, contentCandidate);
  }

  if (noticeCandidate) {
    return createPreviewCandidate(noticeCandidate, noticeCandidate);
  }

  if (toolCandidate) {
    return createPreviewCandidate(
      formatPreviewWithLabel(params.labels.tool, toolCandidate),
      toolCandidate,
    );
  }

  return attachmentCandidate;
}

function collectMessagePreviewCandidates(params: {
  messages: ChatSessionListMessageLike[] | undefined;
  labels: ChatSessionListPreviewLabels;
}) {
  const normalizedMessages = Array.isArray(params.messages)
    ? orderChatMessagesForDisplay(
        params.messages.map((message) => resolveKernelChatMessageState(message)),
      )
    : [];
  const candidates: PreviewCandidate[] = [];

  for (let index = normalizedMessages.length - 1; index >= 0; index -= 1) {
    const candidate = resolveMessagePreviewCandidate({
      message: normalizedMessages[index],
      labels: params.labels,
    });
    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

function resolvePreview(
  session: ChatSessionListSessionLike,
  displayTitle: string,
  labels: ChatSessionListPreviewLabels,
) {
  const normalizedTitle = (normalizePreviewCandidate(displayTitle) ?? '').toLowerCase();
  const sanitizedSessionPreview = sanitizeChatSessionPreviewText({
    text: session.lastMessagePreview,
    kernelId: session.kernelSession?.ref?.kernelId,
  });
  const previewCandidates = [
    ...collectMessagePreviewCandidates({
      messages: session.messages,
      labels,
    }),
    isReadableChatSessionTitle(sanitizedSessionPreview)
      ? createPreviewCandidate(sanitizedSessionPreview)
      : null,
  ];

  for (const candidate of previewCandidates) {
    if (!candidate) {
      continue;
    }

    if (candidate.semanticText.toLowerCase() === normalizedTitle) {
      continue;
    }

    return candidate.text;
  }

  return null;
}

function resolvePreviewLabels(labels: ChatSessionListPreviewLabels | undefined) {
  return {
    ...DEFAULT_PREVIEW_LABELS,
    ...(labels ?? {}),
  };
}

function resolveRelativeTimeLabels(labels: ChatSessionListRelativeTimeLabels | undefined) {
  return labels ?? DEFAULT_RELATIVE_TIME_LABELS;
}

function createDateTimeFormatter(
  locale: string | undefined,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  try {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, options);
    } catch {
      return new Intl.DateTimeFormat(undefined, options);
    }
  }
}

function resolveCalendarDateParts(params: {
  timestamp: number;
  locale?: string;
  timeZone?: string;
}): CalendarDateParts {
  const formatter = createDateTimeFormatter(params.locale, params.timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(params.timestamp);

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value ?? '0'),
    month: Number(parts.find((part) => part.type === 'month')?.value ?? '1'),
    day: Number(parts.find((part) => part.type === 'day')?.value ?? '1'),
  };
}

function formatChatSessionClockTime(params: {
  timestamp: number;
  locale?: string;
  timeZone?: string;
}) {
  return createDateTimeFormatter(params.locale, params.timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(params.timestamp)
    .replace(/[\u200e\u200f]/g, '');
}

function formatChatSessionDateLabel(params: {
  dateParts: CalendarDateParts;
  includeYear: boolean;
}) {
  const month = `${params.dateParts.month}`.padStart(2, '0');
  const day = `${params.dateParts.day}`.padStart(2, '0');
  if (!params.includeYear) {
    return `${month}-${day}`;
  }

  return `${params.dateParts.year}-${month}-${day}`;
}

export function formatChatSessionRelativeTime(params: {
  updatedAt: number;
  now?: number;
  locale?: string;
  timeZone?: string;
  relativeTimeLabels?: ChatSessionListRelativeTimeLabels;
}) {
  const now = params.now ?? Date.now();
  const updatedAt = Math.min(params.updatedAt, now);
  const relativeTimeLabels = resolveRelativeTimeLabels(params.relativeTimeLabels);
  const nowDateParts = resolveCalendarDateParts({
    timestamp: now,
    locale: params.locale,
    timeZone: params.timeZone,
  });
  const updatedDateParts = resolveCalendarDateParts({
    timestamp: updatedAt,
    locale: params.locale,
    timeZone: params.timeZone,
  });
  const calendarDayDelta = Math.max(
    0,
    Math.floor(
      (Date.UTC(nowDateParts.year, nowDateParts.month - 1, nowDateParts.day) -
        Date.UTC(
          updatedDateParts.year,
          updatedDateParts.month - 1,
          updatedDateParts.day,
        )) /
        DAY_IN_MS,
    ),
  );

  if (calendarDayDelta === 0) {
    return formatChatSessionClockTime({
      timestamp: updatedAt,
      locale: params.locale,
      timeZone: params.timeZone,
    });
  }

  if (calendarDayDelta === 1) {
    return relativeTimeLabels.yesterday;
  }

  if (calendarDayDelta < 7) {
    return relativeTimeLabels.daysAgo(calendarDayDelta);
  }

  return formatChatSessionDateLabel({
    dateParts: updatedDateParts,
    includeYear: updatedDateParts.year !== nowDateParts.year,
  });
}

export function presentChatSessionListItem(params: {
  session: ChatSessionListSessionLike;
  now?: number;
  locale?: string;
  timeZone?: string;
  isGatewayMainSession?: boolean;
  previewLabels?: ChatSessionListPreviewLabels;
  relativeTimeLabels?: ChatSessionListRelativeTimeLabels;
}): ChatSessionListItemPresentation {
  const displayTitle = getChatSessionDisplayTitle(params.session);
  const isPinned = Boolean(params.isGatewayMainSession);
  const runBinding = resolveChatRunBinding(params.session);
  const previewLabels = resolvePreviewLabels(params.previewLabels);

  return {
    displayTitle,
    preview: resolvePreview(params.session, displayTitle, previewLabels),
    relativeTimeLabel: formatChatSessionRelativeTime({
      updatedAt: params.session.updatedAt,
      now: params.now,
      locale: params.locale,
      timeZone: params.timeZone,
      relativeTimeLabels: params.relativeTimeLabels,
    }),
    isRunning: runBinding.isActive,
    isPinned,
    showDeleteAction: !isPinned,
  };
}
