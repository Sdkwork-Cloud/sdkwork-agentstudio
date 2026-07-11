import type { StudioConversationAttachment } from '@sdkwork/agentstudio-pc-types';
import type { OpenClawToolCard } from './openClawMessagePresentation.ts';

export interface ChatMessageRenderableSource {
  content?: string | null;
  attachments?: StudioConversationAttachment[] | null;
  toolCards?: OpenClawToolCard[] | null;
  notices?: unknown[] | null;
}

export function hasRenderableChatMessagePayload(
  message: ChatMessageRenderableSource | null | undefined,
) {
  if (!message) {
    return false;
  }

  if (typeof message.content === 'string' && message.content.trim()) {
    return true;
  }

  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return true;
  }

  if (Array.isArray(message.toolCards) && message.toolCards.length > 0) {
    return true;
  }

  if (Array.isArray(message.notices) && message.notices.length > 0) {
    return true;
  }

  return false;
}
