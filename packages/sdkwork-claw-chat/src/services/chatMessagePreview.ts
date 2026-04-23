import type { StudioConversationAttachment } from '@sdkwork/claw-types';
import type { OpenClawToolCard } from './openClawMessagePresentation.ts';
import { normalizeChatSessionTitle } from './chatSessionTitlePresentation.ts';

export interface ChatMessagePreviewNotice {
  code?: string;
  text?: string;
  level?: 'info' | 'warning' | 'error' | null;
}

export interface ChatMessagePreviewSource {
  content?: string;
  attachments?: StudioConversationAttachment[];
  toolCards?: OpenClawToolCard[];
  notices?: ChatMessagePreviewNotice[];
}

export function normalizeChatMessagePreviewText(
  value: string | null | undefined,
  maxLength: number,
) {
  const normalized = normalizeChatSessionTitle(value, maxLength);
  return normalized || null;
}

export function resolveChatMessageAttachmentNamesPreview(
  attachments: StudioConversationAttachment[] | undefined,
  maxLength: number,
) {
  return normalizeChatMessagePreviewText(
    (attachments ?? [])
      .map((attachment) => attachment.name.trim())
      .filter(Boolean)
      .join(', '),
    maxLength,
  );
}

export function resolveChatMessageToolPreview(
  toolCards: OpenClawToolCard[] | undefined,
  maxLength: number,
) {
  const normalizedCards = Array.isArray(toolCards) ? [...toolCards] : [];
  for (let index = normalizedCards.length - 1; index >= 0; index -= 1) {
    const toolCard = normalizedCards[index];
    const candidate =
      normalizeChatMessagePreviewText(toolCard?.preview, maxLength) ??
      normalizeChatMessagePreviewText(toolCard?.detail, maxLength) ??
      normalizeChatMessagePreviewText(toolCard?.text, maxLength) ??
      normalizeChatMessagePreviewText(toolCard?.name, maxLength);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function resolveChatMessageNoticePreview(
  notices: ChatMessagePreviewNotice[] | undefined,
  maxLength: number,
) {
  const normalizedNotices = Array.isArray(notices) ? [...notices] : [];
  for (let index = normalizedNotices.length - 1; index >= 0; index -= 1) {
    const candidate = normalizeChatMessagePreviewText(normalizedNotices[index]?.text, maxLength);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function resolveChatMessagePrimaryPreviewText(
  message: ChatMessagePreviewSource | null | undefined,
  maxLength: number,
) {
  if (!message) {
    return null;
  }

  return (
    normalizeChatMessagePreviewText(message.content, maxLength) ??
    resolveChatMessageNoticePreview(message.notices, maxLength) ??
    resolveChatMessageToolPreview(message.toolCards, maxLength) ??
    resolveChatMessageAttachmentNamesPreview(message.attachments, maxLength)
  );
}
