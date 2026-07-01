import type {
  KernelChatMessage,
  StudioConversationAttachment,
} from '@sdkwork/claw-types';
import { buildChatSessionPreferencesKey } from '../store/chatSessionPreferencesStore.ts';
import type { ChatRunBindingSource } from './chatRunBinding.ts';
import type { ChatSessionBindingSource } from './chatSessionBinding.ts';
import { isOpenClawMainSession } from './chatSessionBootstrap.ts';
import { presentChatSessionListItem } from './chatSessionListPresentation.ts';
import type { ChatSidebarSessionPinOrigin } from './chatSidebarSessionActionsPresentation.ts';
import {
  resolveChatSessionAgentId,
  resolveChatSessionOwnerPresentation,
  type ChatSidebarAgentOption,
} from './chatSessionOwnerPresentation.ts';
import type {
  ChatSessionListPreviewLabels,
  ChatSessionListRelativeTimeLabels,
} from './chatSessionListPresentation.ts';

const DAY_IN_MS = 86_400_000;

export type ChatSidebarHistorySectionId =
  | 'today'
  | 'previous7Days'
  | 'older';

type ChatSidebarHistoryMessageLike = {
  role?: string;
  content?: string;
  attachments?: StudioConversationAttachment[];
  kernelMessage?: KernelChatMessage | null;
};

type ChatSidebarHistorySessionLike = ChatRunBindingSource &
  ChatSessionBindingSource & {
    id: string;
    title?: string;
    updatedAt: number;
    lastSeenAt?: number | null;
    lastMessagePreview?: string;
    messages?: ChatSidebarHistoryMessageLike[];
  };

export interface ChatSidebarHistoryItemPresentation {
  sessionId: string;
  sessionAgentId: string | null;
  displayTitle: string;
  preview: string | null;
  relativeTimeLabel: string;
  ownerName: string;
  ownerAvatarLabel: string | null;
  ownerKernelLabel: string | null;
  isRunning: boolean;
  isPinned: boolean;
  pinOrigin: ChatSidebarSessionPinOrigin;
  isFavorited: boolean;
  hasUnread: boolean;
  showStatusDot: boolean;
  showDeleteAction: boolean;
  isSelected: boolean;
}

export interface ChatSidebarHistorySectionPresentation {
  id: ChatSidebarHistorySectionId;
  items: ChatSidebarHistoryItemPresentation[];
}

export interface ChatSidebarHistoryPresentation {
  sections: ChatSidebarHistorySectionPresentation[];
  totalItems: number;
}

const CHAT_SIDEBAR_HISTORY_SECTION_ORDER: ChatSidebarHistorySectionId[] = [
  'today',
  'previous7Days',
  'older',
];

function normalizeOptionalTimestamp(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function hasUnreadSessionActivity(session: ChatSidebarHistorySessionLike) {
  const updatedAt = normalizeOptionalTimestamp(session.updatedAt);
  const lastSeenAt = normalizeOptionalTimestamp(session.lastSeenAt);
  return updatedAt !== null && (lastSeenAt === null || updatedAt > lastSeenAt);
}

function resolveSessionPinOrigin(params: {
  isGatewayMainSession: boolean;
  isUserPinned: boolean;
}): ChatSidebarSessionPinOrigin {
  if (params.isGatewayMainSession) {
    return 'system';
  }

  if (params.isUserPinned) {
    return 'user';
  }

  return 'none';
}

function resolveSidebarHistorySectionId(params: {
  updatedAt: number;
  now: number;
}): ChatSidebarHistorySectionId {
  const updatedAt = Math.min(params.updatedAt, params.now);
  const deltaMs = Math.max(0, params.now - updatedAt);

  if (deltaMs < DAY_IN_MS) {
    return 'today';
  }

  if (deltaMs < 7 * DAY_IN_MS) {
    return 'previous7Days';
  }

  return 'older';
}

export function resolveChatSidebarHistoryPresentation<
  T extends ChatSidebarHistorySessionLike,
>(params: {
  sessions: T[];
  selectedSessionId: string | null;
  sessionScopeMode: 'all' | 'agentBound';
  sessionScopeAgentId: string | null;
  agentOptions: ChatSidebarAgentOption[];
  sessionPreferencesBySessionKey?: Record<
    string,
    {
      favoriteAt: number | null;
      pinnedAt: number | null;
    }
  >;
  fallbackMainAgentName?: string | null;
  previewLabels?: ChatSessionListPreviewLabels;
  relativeTimeLabels?: ChatSessionListRelativeTimeLabels;
  locale?: string;
  timeZone?: string;
  now?: number;
}): ChatSidebarHistoryPresentation {
  const now = params.now ?? Date.now();
  const sortedSessions = params.sessions
    .map((session) => {
      const isGatewayMainSession =
        params.sessionScopeMode === 'agentBound' &&
        isOpenClawMainSession(session.id, params.sessionScopeAgentId);
      const sessionPreferences =
        params.sessionPreferencesBySessionKey?.[
          buildChatSessionPreferencesKey({
            instanceId: session.instanceId,
            sessionId: session.id,
          })
        ];
      const pinOrigin = resolveSessionPinOrigin({
        isGatewayMainSession,
        isUserPinned: Boolean(sessionPreferences?.pinnedAt),
      });

      return {
        session,
        pinOrigin,
        isPinned: pinOrigin !== 'none',
        isFavorited: Boolean(sessionPreferences?.favoriteAt),
      };
    })
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      if (left.session.updatedAt !== right.session.updatedAt) {
        return right.session.updatedAt - left.session.updatedAt;
      }

      return left.session.id.localeCompare(right.session.id);
    });
  const sectionsById = new Map<ChatSidebarHistorySectionId, ChatSidebarHistoryItemPresentation[]>([
    ['today', []],
    ['previous7Days', []],
    ['older', []],
  ]);

  for (const { session, pinOrigin, isPinned, isFavorited } of sortedSessions) {
    const sessionPresentation = presentChatSessionListItem({
      session,
      now,
      locale: params.locale,
      timeZone: params.timeZone,
      isGatewayMainSession: isPinned,
      previewLabels: params.previewLabels,
      relativeTimeLabels: params.relativeTimeLabels,
    });
    const ownerPresentation = resolveChatSessionOwnerPresentation({
      session,
      agentOptions: params.agentOptions,
      fallbackName: params.fallbackMainAgentName,
    });
    const sectionId = resolveSidebarHistorySectionId({
      updatedAt: session.updatedAt,
      now,
    });

    sectionsById.get(sectionId)?.push({
      sessionId: session.id,
      sessionAgentId: resolveChatSessionAgentId(session),
      displayTitle: sessionPresentation.displayTitle,
      preview: sessionPresentation.preview,
      relativeTimeLabel: sessionPresentation.relativeTimeLabel,
      ownerName: ownerPresentation.name,
      ownerAvatarLabel: ownerPresentation.avatarLabel,
      ownerKernelLabel: ownerPresentation.kernelLabel,
      isRunning: sessionPresentation.isRunning,
      isPinned: isPinned,
      pinOrigin,
      isFavorited,
      hasUnread: hasUnreadSessionActivity(session),
      showStatusDot: sessionPresentation.isRunning || isPinned,
      showDeleteAction: sessionPresentation.showDeleteAction,
      isSelected: params.selectedSessionId === session.id,
    });
  }

  const sections: ChatSidebarHistorySectionPresentation[] = CHAT_SIDEBAR_HISTORY_SECTION_ORDER
    .map((id) => ({
      id,
      items: sectionsById.get(id) ?? [],
    }))
    .filter((section) => section.items.length > 0);

  return {
    sections,
    totalItems: sections.reduce((count, section) => count + section.items.length, 0),
  };
}
