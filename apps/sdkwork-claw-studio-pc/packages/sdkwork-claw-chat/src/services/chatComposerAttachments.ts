import type {
  StudioConversationAttachment,
} from '@sdkwork/claw-types';
import {
  deriveChatSessionTitleFromMessage,
} from './chatSessionTitlePresentation.ts';

export function buildGatewayAttachments(
  attachments: StudioConversationAttachment[],
) {
  return attachments.map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    url: attachment.url,
    previewUrl: attachment.previewUrl,
    objectKey: attachment.objectKey,
  }));
}

function describeAttachment(attachment: StudioConversationAttachment, index: number) {
  const label = attachment.name.trim() || `Attachment ${index + 1}`;
  const typeLabel = attachment.kind.replace(/-/g, ' ');
  const details = [`${index + 1}. [${typeLabel}] ${label}`];

  if (attachment.url?.trim()) {
    details.push(`URL: ${attachment.url.trim()}`);
  }

  if (attachment.originalUrl?.trim()) {
    details.push(`Original URL: ${attachment.originalUrl.trim()}`);
  }

  return details.join('\n');
}

export function composeOutgoingChatText(
  text: string,
  attachments: StudioConversationAttachment[],
) {
  const trimmedText = text.trim();
  if (attachments.length === 0) {
    return trimmedText;
  }

  const summary = attachments
    .map((attachment, index) => describeAttachment(attachment, index))
    .join('\n');
  const prefix = trimmedText || 'The user sent attachments without additional text.';

  return `${prefix}\n\nAttachments:\n${summary}`;
}

export function deriveUserMessageTitle(params: {
  text: string;
  attachments: StudioConversationAttachment[];
}) {
  return deriveChatSessionTitleFromMessage(params);
}
