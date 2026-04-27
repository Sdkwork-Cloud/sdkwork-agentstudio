import {
  resolveChatSidebarFallbackAgentName,
  type ChatSidebarAgentOption,
} from './chatSessionOwnerPresentation.ts';
import {
  sortChatSidebarAgentOptionsByActivity,
  resolveChatSessionsForAgent,
  type ChatAgentSessionLike,
} from './chatAgentSessionWorkspace.ts';

type ChatSidebarAgentRailSessionLike = ChatAgentSessionLike;

export interface ChatSidebarAgentRailItemPresentation {
  id: string | null;
  name: string;
  avatarLabel: string | null;
  kernelId?: string | null;
  kernelLabel?: string | null;
  isSelected: boolean;
  isPrimary: boolean;
  sessionCount: number;
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

function resolveFallbackAvatarLabel(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function resolveAgentRailItemIdentity(option: ChatSidebarAgentOption) {
  const name = resolveChatSidebarFallbackAgentName({
    agentId: option.id,
    agentLabel: option.name,
    kernelLabel: option.kernelLabel,
  });
  const normalizedOptionName = normalizeOptionalString(option.name);
  const shouldReuseOptionAvatar = normalizedOptionName === name;

  return {
    name,
    avatarLabel: shouldReuseOptionAvatar
      ? option.avatarLabel
      : resolveFallbackAvatarLabel(name),
  };
}

function resolveLatestAgentSession<T extends ChatSidebarAgentRailSessionLike>(sessions: T[]) {
  return [...sessions].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return left.id.localeCompare(right.id);
  })[0] ?? null;
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
    const latestActivityAt = latestSession?.updatedAt ?? Number.NEGATIVE_INFINITY;
    const itemIdentity = resolveAgentRailItemIdentity(option);

    return {
      id: option.id,
      name: itemIdentity.name,
      avatarLabel: itemIdentity.avatarLabel,
      ...(option.kernelId ? { kernelId: option.kernelId } : {}),
      ...(option.kernelLabel ? { kernelLabel: option.kernelLabel } : {}),
      isSelected: sameAgentId(option.id, params.selectedAgentId),
      isPrimary: sameAgentId(option.id, params.primaryAgentId ?? null),
      sessionCount: optionSessions.length,
      latestActivityAt,
    } satisfies ChatSidebarAgentRailSortableItemPresentation;
  });

  return {
    selectedAgentId: params.selectedAgentId,
    items: items.map(({ latestActivityAt: _latestActivityAt, ...item }) => item),
  };
}
