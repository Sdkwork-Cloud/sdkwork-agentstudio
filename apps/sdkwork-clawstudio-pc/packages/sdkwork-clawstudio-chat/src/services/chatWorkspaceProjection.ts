import { resolveChatSessionBinding, type ChatSessionBindingSource } from './chatSessionBinding.ts';
import {
  isExplicitBlankChatWorkspace,
  resolveChatSessionViewState,
} from './chatSessionViewPolicy.ts';

export type ChatWorkspaceMode = 'blankAgentWorkspace' | 'selectedSession';

export type ChatWorkspaceSessionLike = ChatSessionBindingSource & {
  id: string;
};

export interface ChatWorkspaceProjection<T extends ChatWorkspaceSessionLike> {
  mode: ChatWorkspaceMode;
  isExplicitBlankWorkspace: boolean;
  selectedSessionId: string | null;
  displaySessionId: string | null;
  selectedSession: T | null;
  displaySession: T | null;
  visibleSessions: T[];
  selectableSessions: T[];
  selectedSessionAgentId: string | null;
  displaySessionAgentId: string | null;
  isDisplaySessionFallback: boolean;
}

function findChatWorkspaceSessionById<T extends { id: string }>(
  sessions: T[],
  sessionId: string | null,
) {
  if (!sessionId) {
    return null;
  }

  return sessions.find((session) => session.id === sessionId) ?? null;
}

export function resolveChatWorkspaceProjection<T extends ChatWorkspaceSessionLike>(params: {
  sessions: T[];
  activeSessionId: string | null;
  isChatSupported?: boolean;
  sessionScopeMode: 'all' | 'agentBound';
  sessionScopeAgentId?: string | null;
  selectedAgentId?: string | null | undefined;
}): ChatWorkspaceProjection<T> {
  const sessionViewState = resolveChatSessionViewState({
    sessions: params.sessions,
    activeSessionId: params.activeSessionId,
    isChatSupported: params.isChatSupported,
    sessionScopeMode: params.sessionScopeMode,
    sessionScopeAgentId: params.sessionScopeAgentId,
  });
  const selectedSession = findChatWorkspaceSessionById(
    params.sessions,
    params.activeSessionId,
  );
  const displaySession = findChatWorkspaceSessionById(
    sessionViewState.selectableSessions,
    sessionViewState.effectiveActiveSessionId,
  );

  return {
    mode: params.activeSessionId ? 'selectedSession' : 'blankAgentWorkspace',
    isExplicitBlankWorkspace: isExplicitBlankChatWorkspace({
      activeSessionId: params.activeSessionId,
      selectedAgentId: params.selectedAgentId,
    }),
    selectedSessionId: params.activeSessionId,
    displaySessionId: sessionViewState.effectiveActiveSessionId,
    selectedSession,
    displaySession,
    visibleSessions: sessionViewState.visibleSessions,
    selectableSessions: sessionViewState.selectableSessions,
    selectedSessionAgentId: resolveChatSessionBinding(selectedSession).agentId,
    displaySessionAgentId: resolveChatSessionBinding(displaySession).agentId,
    isDisplaySessionFallback:
      Boolean(params.activeSessionId) &&
      params.activeSessionId !== sessionViewState.effectiveActiveSessionId,
  };
}
