import { resolveChatSessionViewState } from './chatSessionViewPolicy.ts';
import { resolveChatSessionBinding, type ChatSessionBindingSource } from './chatSessionBinding.ts';
import {
  findChatSidebarAgentOption,
  matchesChatSidebarAgentOption,
  resolveChatSessionAgentId,
  type ChatSidebarAgentOption,
} from './chatSessionOwnerPresentation.ts';

export type ChatAgentSessionLike = ChatSessionBindingSource & {
  id: string;
  updatedAt: number;
};

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

export function resolveChatSessionsForAgent<T extends ChatAgentSessionLike>(params: {
  sessions: T[];
  activeSessionId: string | null;
  isChatSupported: boolean;
  sessionScopeMode: 'all' | 'agentBound';
  agentId: string | null;
  agentOptions?: ChatSidebarAgentOption[];
}) {
  if (params.sessionScopeMode === 'agentBound') {
    return resolveChatSessionViewState({
      sessions: params.sessions,
      activeSessionId: params.activeSessionId,
      isChatSupported: params.isChatSupported,
      sessionScopeMode: 'agentBound',
      sessionScopeAgentId: params.agentId,
    }).visibleSessions;
  }

  if (!params.isChatSupported) {
    return [];
  }

  const selectedAgentOption = params.agentOptions
    ? findChatSidebarAgentOption(params.agentOptions, params.agentId)
    : null;

  return params.sessions.filter((session) =>
    selectedAgentOption
      ? matchesChatSidebarAgentOption(
          selectedAgentOption,
          resolveChatSessionAgentId(session),
        )
      : sameAgentId(resolveChatSessionAgentId(session), params.agentId),
  );
}

export function filterChatSessionsByAgentOption<T extends ChatAgentSessionLike>(params: {
  sessions: T[];
  agentId: string | null;
  agentOptions?: ChatSidebarAgentOption[];
}) {
  const selectedAgentOption = params.agentOptions
    ? findChatSidebarAgentOption(params.agentOptions, params.agentId)
    : null;

  return params.sessions.filter((session) =>
    selectedAgentOption
      ? matchesChatSidebarAgentOption(
          selectedAgentOption,
          resolveChatSessionAgentId(session),
        )
      : sameAgentId(resolveChatSessionAgentId(session), params.agentId),
  );
}

export function resolveChatAgentTargetSessionId<T extends ChatAgentSessionLike>(params: {
  sessions: T[];
  agentId: string | null;
  agentOptions?: ChatSidebarAgentOption[];
}) {
  const selectedAgentOption = params.agentOptions
    ? findChatSidebarAgentOption(params.agentOptions, params.agentId)
    : null;
  const mainSession = params.sessions.find((session) =>
    params.agentId || selectedAgentOption
      ? (() => {
          const binding = resolveChatSessionBinding(session);
          return (
            binding.isMainAgentSession &&
            (selectedAgentOption
              ? matchesChatSidebarAgentOption(selectedAgentOption, binding.agentId)
              : sameAgentId(binding.agentId, params.agentId))
          );
        })()
      : false,
  );
  if (mainSession) {
    return mainSession.id;
  }

  return [...params.sessions]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .find(() => true)?.id ?? null;
}

function resolveChatAgentLatestActivityAt<T extends ChatAgentSessionLike>(params: {
  sessions: T[];
  activeSessionId: string | null;
  isChatSupported: boolean;
  sessionScopeMode: 'all' | 'agentBound';
  agentId: string | null;
  agentOptions?: ChatSidebarAgentOption[];
}) {
  return resolveChatSessionsForAgent(params).reduce(
    (latest, session) => Math.max(latest, session.updatedAt),
    Number.NEGATIVE_INFINITY,
  );
}

export function sortChatSidebarAgentOptionsByActivity<T extends ChatSidebarAgentOption>(params: {
  agentOptions: T[];
  sessions: ChatAgentSessionLike[];
  activeSessionId: string | null;
  isChatSupported: boolean;
  sessionScopeMode: 'all' | 'agentBound';
  primaryAgentId?: string | null;
}) {
  return [...params.agentOptions].sort((left, right) => {
    const leftLatestActivityAt = resolveChatAgentLatestActivityAt({
      sessions: params.sessions,
      activeSessionId: params.activeSessionId,
      isChatSupported: params.isChatSupported,
      sessionScopeMode: params.sessionScopeMode,
      agentId: left.id,
      agentOptions: params.agentOptions,
    });
    const rightLatestActivityAt = resolveChatAgentLatestActivityAt({
      sessions: params.sessions,
      activeSessionId: params.activeSessionId,
      isChatSupported: params.isChatSupported,
      sessionScopeMode: params.sessionScopeMode,
      agentId: right.id,
      agentOptions: params.agentOptions,
    });

    if (leftLatestActivityAt !== rightLatestActivityAt) {
      return rightLatestActivityAt - leftLatestActivityAt;
    }

    const leftIsPrimary = sameAgentId(left.id, params.primaryAgentId ?? null);
    const rightIsPrimary = sameAgentId(right.id, params.primaryAgentId ?? null);
    if (leftIsPrimary !== rightIsPrimary) {
      return leftIsPrimary ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function resolveChatEffectiveSelectedAgentId(params: {
  agentOptions: ChatSidebarAgentOption[];
  selectedAgentId: string | null | undefined;
  activeSessionId: string | null;
  sessions: ChatAgentSessionLike[];
  primaryAgentId?: string | null;
}): string | null {
  if (params.selectedAgentId !== undefined) {
    const matchingSelectedAgentOption = findChatSidebarAgentOption(
      params.agentOptions,
      params.selectedAgentId ?? null,
    );
    if (matchingSelectedAgentOption) {
      return matchingSelectedAgentOption.id;
    }
  }

  const activeSession = params.sessions.find((session) => session.id === params.activeSessionId);
  const activeSessionAgentId = activeSession ? resolveChatSessionAgentId(activeSession) : null;
  if (activeSession) {
    const matchingActiveSessionAgentOption = findChatSidebarAgentOption(
      params.agentOptions,
      activeSessionAgentId ?? null,
    );
    if (matchingActiveSessionAgentOption) {
      return matchingActiveSessionAgentOption.id;
    }
  }

  const matchingPrimaryAgentOption = findChatSidebarAgentOption(
    params.agentOptions,
    params.primaryAgentId ?? null,
  );
  if (matchingPrimaryAgentOption) {
    return matchingPrimaryAgentOption.id;
  }

  return params.agentOptions[0]?.id ?? null;
}

export function resolveChatAgentSessionWorkspace<T extends ChatAgentSessionLike>(params: {
  agentOptions: ChatSidebarAgentOption[];
  sessions: T[];
  activeSessionId: string | null;
  isChatSupported: boolean;
  sessionScopeMode: 'all' | 'agentBound';
  selectedAgentId: string | null | undefined;
  primaryAgentId?: string | null;
}) {
  const rankedAgentOptions = sortChatSidebarAgentOptionsByActivity({
    agentOptions: params.agentOptions,
    sessions: params.sessions,
    activeSessionId: params.activeSessionId,
    isChatSupported: params.isChatSupported,
    sessionScopeMode: params.sessionScopeMode,
    primaryAgentId: params.primaryAgentId,
  });
  const selectedAgentId = resolveChatEffectiveSelectedAgentId({
    agentOptions: rankedAgentOptions,
    selectedAgentId: params.selectedAgentId,
    activeSessionId: params.activeSessionId,
    sessions: params.sessions,
    primaryAgentId: params.primaryAgentId,
  });
  const visibleSessions = resolveChatSessionsForAgent({
    sessions: params.sessions,
    activeSessionId: params.activeSessionId,
    isChatSupported: params.isChatSupported,
    sessionScopeMode: params.sessionScopeMode,
    agentId: selectedAgentId,
    agentOptions: rankedAgentOptions,
  });
  const targetSessionId = resolveChatAgentTargetSessionId({
    sessions: visibleSessions,
    agentId: selectedAgentId,
    agentOptions: rankedAgentOptions,
  });
  const effectiveActiveSessionId =
    params.activeSessionId === null
      ? null
      : visibleSessions.some((session) => session.id === params.activeSessionId)
        ? params.activeSessionId
        : targetSessionId;

  return {
    selectedAgentId,
    effectiveActiveSessionId,
    visibleSessions,
  };
}
