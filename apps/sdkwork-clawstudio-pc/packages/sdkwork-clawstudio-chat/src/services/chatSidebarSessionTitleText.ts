import {
  DEFAULT_CHAT_SESSION_TITLE,
  getChatSessionDisplayTitle,
  isReadableChatSessionTitle,
  type ChatSessionTitleMessageLike,
  type ChatSessionTitleSource,
} from './chatSessionTitlePresentation.ts';

export type ChatSidebarSessionTitleTextSession = {
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

function normalizeTitleCandidate(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveReadableTitleCandidate(value: string | null | undefined) {
  const normalized = normalizeTitleCandidate(value);
  return isReadableChatSessionTitle(normalized) ? normalized : null;
}

export function resolveChatSidebarSessionTitleText(params: {
  itemDisplayTitle: string | null | undefined;
  session: ChatSidebarSessionTitleTextSession | null | undefined;
}) {
  const sessionTitle = params.session
    ? resolveReadableTitleCandidate(getChatSessionDisplayTitle(params.session))
    : null;
  if (sessionTitle) {
    return sessionTitle;
  }

  const itemTitle = resolveReadableTitleCandidate(params.itemDisplayTitle);
  if (itemTitle) {
    return itemTitle;
  }

  return DEFAULT_CHAT_SESSION_TITLE;
}
