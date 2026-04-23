import type {
  KernelChatMessage,
  StudioConversationAttachment,
} from '@sdkwork/claw-types';
import type { OpenClawToolCard } from './openClawMessagePresentation.ts';
import type { ChatRunBindingSource } from './chatRunBinding.ts';
import type {
  ChatSessionListPreviewLabels,
  ChatSessionListRelativeTimeLabels,
} from './chatSessionListPresentation.ts';
import { presentChatSessionListItem } from './chatSessionListPresentation.ts';
import type { ChatSidebarAgentOption } from './chatSessionOwnerPresentation.ts';
import {
  sortChatSidebarAgentOptionsByActivity,
  resolveChatSessionsForAgent,
  type ChatAgentSessionLike,
} from './chatAgentSessionWorkspace.ts';

const DEFAULT_AGENT_RAIL_EMPTY_PREVIEW_LABEL = 'No conversations yet';

type ChatSidebarAgentRailMessageLike = {
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

type ChatSidebarAgentRailSessionLike = ChatAgentSessionLike &
  ChatRunBindingSource & {
    title?: string;
    lastMessagePreview?: string;
    messages?: ChatSidebarAgentRailMessageLike[];
  };

export interface ChatSidebarAgentRailItemPresentation {
  id: string | null;
  name: string;
  avatarLabel: string | null;
  kernelId?: string | null;
  kernelLabel?: string | null;
  isSelected: boolean;
  isPrimary: boolean;
  sessionCount: number;
  preview: string;
  relativeTimeLabel: string | null;
}

interface ChatSidebarAgentRailSortableItemPresentation
  extends ChatSidebarAgentRailItemPresentation {
  latestActivityAt: number;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function sameAgentId(left: string | null, right: string | null) {
  return normalizeOptionalString(left) === normalizeOptionalString(right);
}

function resolveLatestAgentSession<T extends ChatSidebarAgentRailSessionLike>(sessions: T[]) {
  return [...sessions].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return left.id.localeCompare(right.id);
  })[0] ?? null;
}

function resolveAgentRailLatestSessionPresentation<T extends ChatSidebarAgentRailSessionLike>(params: {
  latestSession: T | null;
  previewLabels?: ChatSessionListPreviewLabels;
  relativeTimeLabels?: ChatSessionListRelativeTimeLabels;
  locale?: string;
  timeZone?: string;
  emptyPreviewLabel?: string;
  now?: number;
}) {
  if (!params.latestSession) {
    return {
      preview: params.emptyPreviewLabel ?? DEFAULT_AGENT_RAIL_EMPTY_PREVIEW_LABEL,
      relativeTimeLabel: null,
    };
  }

  const latestSessionPresentation = presentChatSessionListItem({
    session: params.latestSession,
    now: params.now,
    locale: params.locale,
    timeZone: params.timeZone,
    previewLabels: params.previewLabels,
    relativeTimeLabels: params.relativeTimeLabels,
  });

  return {
    preview:
      latestSessionPresentation.preview ??
      latestSessionPresentation.displayTitle ??
      params.emptyPreviewLabel ??
      DEFAULT_AGENT_RAIL_EMPTY_PREVIEW_LABEL,
    relativeTimeLabel: latestSessionPresentation.relativeTimeLabel,
  };
}

export function resolveChatSidebarAgentRailPresentation<
  T extends ChatSidebarAgentRailSessionLike,
>(params: {
  agentOptions: ChatSidebarAgentOption[];
  sessions: T[];
  activeSessionId: string | null;
  isChatSupported: boolean;
  sessionScopeMode: 'all' | 'agentBound';
  selectedAgentId: string | null;
  primaryAgentId?: string | null;
  previewLabels?: ChatSessionListPreviewLabels;
  relativeTimeLabels?: ChatSessionListRelativeTimeLabels;
  locale?: string;
  timeZone?: string;
  emptyPreviewLabel?: string;
  now?: number;
}) {
  const sortedAgentOptions = sortChatSidebarAgentOptionsByActivity({
    agentOptions: params.agentOptions,
    sessions: params.sessions,
    activeSessionId: params.activeSessionId,
    isChatSupported: params.isChatSupported,
    sessionScopeMode: params.sessionScopeMode,
    primaryAgentId: params.primaryAgentId,
  });
  const items: ChatSidebarAgentRailSortableItemPresentation[] = sortedAgentOptions.map((option) => {
    const optionSessions = resolveChatSessionsForAgent({
      sessions: params.sessions,
      activeSessionId: params.activeSessionId,
      isChatSupported: params.isChatSupported,
      sessionScopeMode: params.sessionScopeMode,
      agentId: option.id,
      agentOptions: params.agentOptions,
    });
    const latestSession = resolveLatestAgentSession(optionSessions);
    const latestSessionPresentation = resolveAgentRailLatestSessionPresentation({
      latestSession,
      previewLabels: params.previewLabels,
      relativeTimeLabels: params.relativeTimeLabels,
      locale: params.locale,
      timeZone: params.timeZone,
      emptyPreviewLabel: params.emptyPreviewLabel,
      now: params.now,
    });
    const latestActivityAt = latestSession?.updatedAt ?? Number.NEGATIVE_INFINITY;

    return {
      id: option.id,
      name: option.name,
      avatarLabel: option.avatarLabel,
      ...(option.kernelId ? { kernelId: option.kernelId } : {}),
      ...(option.kernelLabel ? { kernelLabel: option.kernelLabel } : {}),
      isSelected: sameAgentId(option.id, params.selectedAgentId),
      isPrimary: sameAgentId(option.id, params.primaryAgentId ?? null),
      sessionCount: optionSessions.length,
      preview: latestSessionPresentation.preview,
      relativeTimeLabel: latestSessionPresentation.relativeTimeLabel,
      latestActivityAt,
    } satisfies ChatSidebarAgentRailSortableItemPresentation;
  });

  return {
    selectedAgentId: params.selectedAgentId,
    items: items.map(({ latestActivityAt: _latestActivityAt, ...item }) => item),
  };
}
