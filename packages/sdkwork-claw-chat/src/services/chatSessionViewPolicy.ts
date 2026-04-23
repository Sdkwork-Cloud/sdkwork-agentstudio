import {
  buildOpenClawMainSessionKey,
  filterUserFacingOpenClawSessionsByAgent,
  resolveOpenClawVisibleActiveSessionId,
  shouldKeepHiddenOpenClawSessionVisible,
} from './chatSessionBootstrap.ts';
import { resolveChatRunBinding, type ChatRunBindingSource } from './chatRunBinding.ts';

type ChatSessionLike = {
  id: string;
  sessionKind?: string | null;
};

type ChatRunningSessionLike = ChatRunBindingSource & {
  id: string;
};

export function resolveChatSessionViewState<T extends ChatSessionLike>(params: {
  sessions: T[];
  activeSessionId: string | null;
  isChatSupported?: boolean;
  sessionScopeMode: 'all' | 'agentBound';
  sessionScopeAgentId?: string | null;
}) {
  if (params.isChatSupported === false) {
    return {
      visibleSessions: [],
      selectableSessions: [],
      effectiveActiveSessionId: null,
    };
  }

  const isAgentBoundScope = params.sessionScopeMode === 'agentBound';
  const baseVisibleSessions = isAgentBoundScope
    ? filterUserFacingOpenClawSessionsByAgent(params.sessions, params.sessionScopeAgentId)
    : params.sessions;
  const hiddenActiveSession =
    isAgentBoundScope && params.activeSessionId
      ? params.sessions.find((session) => session.id === params.activeSessionId)
      : undefined;
  const visibleSessions =
    isAgentBoundScope &&
    shouldKeepHiddenOpenClawSessionVisible(hiddenActiveSession) &&
    hiddenActiveSession &&
    !baseVisibleSessions.some((session) => session.id === hiddenActiveSession.id)
      ? [...baseVisibleSessions, hiddenActiveSession]
      : baseVisibleSessions;

  return {
    visibleSessions,
    selectableSessions: isAgentBoundScope ? visibleSessions : params.sessions,
    effectiveActiveSessionId: isAgentBoundScope
      ? params.activeSessionId === null
        ? null
        : resolveOpenClawVisibleActiveSessionId(
            params.activeSessionId,
            visibleSessions.map((session) => session.id),
          )
      : params.activeSessionId,
  };
}

export function resolveChatSendSessionId(params: {
  selectedSessionId: string | null;
  displaySessionId: string | null;
  sendMode: 'local' | 'gateway';
}) {
  return params.selectedSessionId;
}

export function isExplicitBlankChatWorkspace(params: {
  activeSessionId: string | null;
  selectedAgentId?: string | null | undefined;
}) {
  return params.activeSessionId === null && params.selectedAgentId !== undefined;
}

export function resolveChatRunningRunBinding<T extends ChatRunningSessionLike>(params: {
  sendMode: 'local' | 'gateway';
  selectableSessions: T[];
}) {
  if (params.sendMode !== 'gateway') {
    return null;
  }

  for (const session of params.selectableSessions) {
    const runBinding = resolveChatRunBinding(session);
    if (runBinding.isActive) {
      return runBinding;
    }
  }

  return null;
}

export function resolveChatRunningSessionId<T extends ChatRunningSessionLike>(params: {
  sendMode: 'local' | 'gateway';
  selectableSessions: T[];
}) {
  return resolveChatRunningRunBinding(params)?.sessionId ?? null;
}

export function resolveGatewayVisibleSessionSyncTarget(params: {
  supportsVisibleSessionSync: boolean;
  activeSessionId: string | null;
  effectiveActiveSessionId: string | null;
  selectedAgentId?: string | null | undefined;
}) {
  if (!params.supportsVisibleSessionSync || !params.effectiveActiveSessionId) {
    return null;
  }

  if (
    isExplicitBlankChatWorkspace({
      activeSessionId: params.activeSessionId,
      selectedAgentId: params.selectedAgentId,
    })
  ) {
    return null;
  }

  if (params.activeSessionId) {
    return null;
  }

  return params.effectiveActiveSessionId;
}

export function resolveNewChatSessionModel(params: {
  newSessionModelMode: 'modelName' | 'modelId';
  activeModelId?: string | null;
  activeModelName?: string | null;
}) {
  const modelValue =
    params.newSessionModelMode === 'modelId'
      ? params.activeModelId
      : params.activeModelName;
  const normalizedModel = modelValue?.trim();
  return normalizedModel || undefined;
}

export function resolveOpenClawDraftSessionId(params: {
  sessionScopeMode: 'all' | 'agentBound';
  sessionScopeAgentId?: string | null;
}) {
  if (params.sessionScopeMode !== 'agentBound') {
    return undefined;
  }

  return buildOpenClawMainSessionKey(params.sessionScopeAgentId);
}
