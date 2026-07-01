import type {
  ChatSessionListPreviewLabels,
  ChatSessionListRelativeTimeLabels,
} from './chatSessionListPresentation.ts';
import {
  findChatSidebarAgentOption,
  type ChatSidebarAgentOption,
} from './chatSessionOwnerPresentation.ts';
import {
  filterChatSessionsByAgentOption,
  resolveChatAgentSessionWorkspace,
  type ChatAgentSessionLike,
} from './chatAgentSessionWorkspace.ts';
import {
  resolveChatSidebarAgentRailPresentation,
  type ChatSidebarAgentRailItemPresentation,
} from './chatSidebarAgentRailPresentation.ts';
import {
  resolveChatSidebarChromePresentation,
  type ChatSidebarChromePresentation,
} from './chatSidebarChromePresentation.ts';
import {
  resolveChatSidebarHistoryPresentation,
  type ChatSidebarHistoryPresentation,
  type ChatSidebarHistorySectionPresentation,
} from './chatSidebarHistoryPresentation.ts';

export type ChatSidebarHistoryViewMode = 'currentAgent' | 'allSessions';

export interface ChatSidebarViewState<TSession extends ChatAgentSessionLike> {
  currentAgentName: string;
  effectiveSelectedAgentId: string | null;
  agentRail: {
    items: ChatSidebarAgentRailItemPresentation[];
  };
  activeSidebarHistory: ChatSidebarHistoryPresentation;
  activeHistorySessions: TSession[];
  sidebarChrome: ChatSidebarChromePresentation<ChatSidebarHistorySectionPresentation>;
  historyTabState: {
    currentAgentCount: number;
    allSessionsCount: number;
  };
}

export function resolveChatSidebarViewState<TSession extends ChatAgentSessionLike>(params: {
  sessions: TSession[];
  activeSessionId: string | null;
  activeInstanceId: string | null;
  isChatSupported: boolean;
  sessionScopeMode: 'all' | 'agentBound';
  sessionScopeAgentId: string | null;
  selectedAgentId: string | null | undefined;
  primaryAgentId?: string | null;
  agentOptions: ChatSidebarAgentOption[];
  historyViewMode: ChatSidebarHistoryViewMode;
  fallbackMainAgentName: string;
  previewLabels: ChatSessionListPreviewLabels;
  relativeTimeLabels: ChatSessionListRelativeTimeLabels;
  sessionPreferencesBySessionKey?: Record<
    string,
    {
      favoriteAt: number | null;
      pinnedAt: number | null;
    }
  >;
  locale?: string;
  timeZone?: string;
}) : ChatSidebarViewState<TSession> {
  const instanceSessions = params.sessions.filter(
    (session) =>
      session.instanceId === params.activeInstanceId ||
      (!session.instanceId && !params.activeInstanceId),
  );
  const {
    selectedAgentId: effectiveSelectedAgentId,
  } = resolveChatAgentSessionWorkspace({
    agentOptions: params.agentOptions,
    sessions: instanceSessions,
    activeSessionId: params.activeSessionId,
    isChatSupported: params.isChatSupported,
    sessionScopeMode: params.sessionScopeMode,
    selectedAgentId: params.selectedAgentId,
    primaryAgentId: params.primaryAgentId,
  });
  const currentAgentHistorySessions = filterChatSessionsByAgentOption({
    sessions: instanceSessions,
    agentId: effectiveSelectedAgentId,
    agentOptions: params.agentOptions,
  });
  const agentRail = resolveChatSidebarAgentRailPresentation({
    agentOptions: params.agentOptions,
    sessions: instanceSessions,
    activeSessionId: params.activeSessionId,
    isChatSupported: params.isChatSupported,
    sessionScopeMode: params.sessionScopeMode,
    selectedAgentId: effectiveSelectedAgentId,
    primaryAgentId: params.primaryAgentId,
  });
  const currentAgentHistory = resolveChatSidebarHistoryPresentation({
    sessions: currentAgentHistorySessions,
    selectedSessionId: currentAgentHistorySessions.some((session) => session.id === params.activeSessionId)
      ? params.activeSessionId
      : null,
    sessionScopeMode: params.sessionScopeMode,
    sessionScopeAgentId: params.sessionScopeAgentId,
    agentOptions: params.agentOptions,
    sessionPreferencesBySessionKey: params.sessionPreferencesBySessionKey,
    fallbackMainAgentName: params.fallbackMainAgentName,
    previewLabels: params.previewLabels,
    relativeTimeLabels: params.relativeTimeLabels,
    locale: params.locale,
    timeZone: params.timeZone,
  });
  const allSessionsHistory = resolveChatSidebarHistoryPresentation({
    sessions: instanceSessions,
    selectedSessionId: params.activeSessionId,
    sessionScopeMode: 'all',
    sessionScopeAgentId: null,
    agentOptions: params.agentOptions,
    sessionPreferencesBySessionKey: params.sessionPreferencesBySessionKey,
    fallbackMainAgentName: params.fallbackMainAgentName,
    previewLabels: params.previewLabels,
    relativeTimeLabels: params.relativeTimeLabels,
    locale: params.locale,
    timeZone: params.timeZone,
  });
  const activeSidebarHistory =
    params.historyViewMode === 'allSessions' ? allSessionsHistory : currentAgentHistory;
  const activeHistorySessions =
    params.historyViewMode === 'allSessions' ? instanceSessions : currentAgentHistorySessions;
  const sidebarChrome = resolveChatSidebarChromePresentation({
    agentRailItemCount: agentRail.items.length,
    historySections: activeSidebarHistory.sections,
    totalHistoryItems: activeSidebarHistory.totalItems,
  });
  const currentAgentName =
    findChatSidebarAgentOption(params.agentOptions, effectiveSelectedAgentId)?.name ??
    params.fallbackMainAgentName;

  return {
    currentAgentName,
    effectiveSelectedAgentId,
    agentRail,
    activeSidebarHistory,
    activeHistorySessions,
    sidebarChrome,
    historyTabState: {
      currentAgentCount: currentAgentHistory.totalItems,
      allSessionsCount: allSessionsHistory.totalItems,
    },
  };
}
