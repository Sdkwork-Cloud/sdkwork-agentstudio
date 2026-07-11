import type {
  KernelChatAttachment,
  KernelChatMessagePart,
  StudioConversationAttachment,
} from '@sdkwork/agentstudio-pc-types';
import type { OpenClawToolCard } from './openClawMessagePresentation.ts';

export interface KernelChatProjectionNotice {
  code: string;
  text: string;
  level?: 'info' | 'warning' | 'error' | null;
}

export interface KernelChatProjectionPartsSource {
  content: string;
  reasoning?: string | null;
  attachments?: StudioConversationAttachment[];
  toolCards?: OpenClawToolCard[];
  notices?: KernelChatProjectionNotice[];
}

export function trimOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function trimToolDetail(value: string | undefined) {
  const normalized = trimOptionalString(value);
  return normalized ?? undefined;
}

function mapAttachment(attachment: StudioConversationAttachment): KernelChatAttachment {
  return {
    ...attachment,
  };
}

function mapToolCardPart(toolCard: OpenClawToolCard): KernelChatMessagePart {
  if (toolCard.kind === 'call') {
    return {
      kind: 'toolCall',
      toolName: toolCard.name.trim() || 'Tool',
      toolCallId: trimOptionalString(toolCard.toolCallId),
      argumentsText:
        trimToolDetail(toolCard.argumentsText) ?? trimToolDetail(toolCard.detail) ?? null,
      detail: trimToolDetail(toolCard.detail) ?? null,
    };
  }

  return {
    kind: 'toolResult',
    toolName: toolCard.name.trim() || 'Tool',
    toolCallId: trimOptionalString(toolCard.toolCallId),
    text: trimToolDetail(toolCard.text) ?? trimToolDetail(toolCard.preview) ?? null,
    isError: typeof toolCard.isError === 'boolean' ? toolCard.isError : null,
    preview: trimToolDetail(toolCard.preview) ?? null,
  };
}

function normalizeNoticeLevel(
  value: KernelChatProjectionNotice['level'],
): 'info' | 'warning' | 'error' | null {
  switch (value) {
    case 'info':
    case 'warning':
    case 'error':
      return value;
    default:
      return null;
  }
}

function mapNoticePart(notice: KernelChatProjectionNotice): KernelChatMessagePart | null {
  const text = trimOptionalString(notice.text);
  if (!text) {
    return null;
  }

  return {
    kind: 'notice',
    code: trimOptionalString(notice.code) ?? 'notice',
    text,
    level: normalizeNoticeLevel(notice.level),
  };
}

export function buildKernelChatMessageParts(
  message: KernelChatProjectionPartsSource,
): KernelChatMessagePart[] {
  const parts: KernelChatMessagePart[] = [];
  const normalizedText = message.content.trim();
  if (normalizedText) {
    parts.push({
      kind: 'text',
      text: message.content,
    });
  }

  const normalizedReasoning = trimOptionalString(message.reasoning);
  if (normalizedReasoning) {
    parts.push({
      kind: 'reasoning',
      text: normalizedReasoning,
    });
  }

  for (const attachment of message.attachments ?? []) {
    parts.push({
      kind: 'attachment',
      attachment: mapAttachment(attachment),
    });
  }

  for (const toolCard of message.toolCards ?? []) {
    parts.push(mapToolCardPart(toolCard));
  }

  for (const notice of message.notices ?? []) {
    const part = mapNoticePart(notice);
    if (part) {
      parts.push(part);
    }
  }

  return parts;
}
