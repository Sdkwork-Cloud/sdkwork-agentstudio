import type { InstanceChatRouteMode } from './instanceChatRouteService.ts';
import { resolveKernelChatSessionState } from './kernelChatSessionState.ts';

export type ChatBootstrapAction =
  | { type: 'wait' }
  | { type: 'create' }
  | { type: 'select'; sessionId: string }
  | { type: 'idle' };

function normalizeOpenClawAgentId(agentId?: string | null) {
  const normalizedAgentId = agentId?.trim().toLowerCase();
  return normalizedAgentId || 'main';
}

function normalizeOpenClawSessionKey(sessionId: string | null | undefined) {
  const normalizedSessionId = sessionId?.trim().toLowerCase();
  return normalizedSessionId || null;
}

function normalizeOpenClawSessionKind(kind: string | null | undefined) {
  const normalizedKind = kind?.trim().toLowerCase();
  return normalizedKind || null;
}

export function buildOpenClawMainSessionKey(agentId?: string | null) {
  return `agent:${normalizeOpenClawAgentId(agentId)}:main`;
}

export function buildOpenClawThreadSessionKey(
  agentId: string | null | undefined,
  threadKey: string,
) {
  const normalizedThreadKey = threadKey.trim() || 'agent-studio';
  return `${buildOpenClawMainSessionKey(agentId)}:thread:${normalizedThreadKey}`;
}

function parseOpenClawAgentSessionKey(sessionId: string | null | undefined) {
  const raw = normalizeOpenClawSessionKey(sessionId);
  if (!raw || !raw.startsWith('agent:')) {
    return null;
  }

  const parts = raw.split(':').filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  return {
    agentId: parts[1] ?? 'main',
    rest: parts.slice(2).join(':'),
  };
}

export function isOpenClawSessionInAgentScope(
  sessionId: string | null | undefined,
  agentId: string | null | undefined,
) {
  const parsed = parseOpenClawAgentSessionKey(sessionId);
  if (!parsed) {
    return false;
  }

  return parsed.agentId === normalizeOpenClawAgentId(agentId);
}

export function filterOpenClawSessionsByAgent<T extends { id: string }>(
  sessions: T[],
  agentId: string | null | undefined,
) {
  return sessions.filter((session) => isOpenClawSessionInAgentScope(session.id, agentId));
}

export function isOpenClawMainSession(
  sessionId: string | null | undefined,
  agentId: string | null | undefined,
) {
  return normalizeOpenClawSessionKey(sessionId) === buildOpenClawMainSessionKey(agentId);
}

export function isAnyOpenClawMainSession(sessionId: string | null | undefined) {
  const normalizedSessionId = normalizeOpenClawSessionKey(sessionId);
  return normalizedSessionId ? /^agent:[^:]+:main$/.test(normalizedSessionId) : false;
}

function isOpenClawLegacyUserFacingSession(sessionId: string | null | undefined) {
  const normalizedSessionId = normalizeOpenClawSessionKey(sessionId);
  return Boolean(normalizedSessionId) && !normalizedSessionId!.startsWith('agent:');
}

function isOpenClawBackgroundSessionKind(kind: string | null | undefined) {
  const normalizedKind = normalizeOpenClawSessionKind(kind);
  return normalizedKind === 'global' || normalizedKind === 'unknown';
}

export function isOpenClawCronSessionKey(sessionId: string | null | undefined) {
  const normalizedSessionId = normalizeOpenClawSessionKey(sessionId);
  if (!normalizedSessionId) {
    return false;
  }

  if (normalizedSessionId.startsWith('cron:')) {
    return true;
  }

  if (!normalizedSessionId.startsWith('agent:')) {
    return false;
  }

  const parts = normalizedSessionId.split(':').filter(Boolean);
  if (parts.length < 3) {
    return false;
  }

  return parts.slice(2).join(':').startsWith('cron:');
}

function shouldHideOpenClawBackgroundSession(params: {
  sessionId: string | null | undefined;
  sessionKind?: string | null;
}) {
  return (
    isOpenClawBackgroundSessionKind(params.sessionKind) ||
    isOpenClawCronSessionKey(params.sessionId)
  );
}

export function filterUserFacingOpenClawSessionsByAgent<T extends { id: string }>(
  sessions: T[],
  agentId: string | null | undefined,
) {
  return sessions.filter((session) => {
    const sessionKind = resolveKernelChatSessionState(
      session as Parameters<typeof resolveKernelChatSessionState>[0],
    ).sessionKind;
    if (shouldHideOpenClawBackgroundSession({ sessionId: session.id, sessionKind })) {
      return false;
    }

    if (isOpenClawLegacyUserFacingSession(session.id)) {
      return true;
    }

    return isOpenClawSessionInAgentScope(session.id, agentId);
  });
}

export function shouldKeepHiddenOpenClawSessionVisible<T extends { id: string }>(
  session: T | undefined,
) {
  if (!session) {
    return false;
  }

  const sessionKind = resolveKernelChatSessionState(
    session as Parameters<typeof resolveKernelChatSessionState>[0],
  ).sessionKind;
  return shouldHideOpenClawBackgroundSession({
    sessionId: session.id,
    sessionKind,
  });
}

export function resolveOpenClawVisibleActiveSessionId(
  activeSessionId: string | null,
  visibleSessionIds: string[],
) {
  if (activeSessionId && visibleSessionIds.includes(activeSessionId)) {
    return activeSessionId;
  }

  return visibleSessionIds.find((sessionId) => isAnyOpenClawMainSession(sessionId)) ?? visibleSessionIds[0] ?? null;
}

export function resolveChatBootstrapAction(params: {
  activeInstanceId: string | null | undefined;
  routeMode: InstanceChatRouteMode | undefined;
  sendMode?: 'local' | 'gateway';
  syncState: 'idle' | 'loading' | 'error';
  hasActiveModel: boolean;
  activeSessionId: string | null;
  sessionIds: string[];
}): ChatBootstrapAction {
  if (!params.activeInstanceId) {
    return { type: 'idle' };
  }

  if (!params.routeMode || params.syncState === 'loading') {
    return { type: 'wait' };
  }

  if (params.syncState === 'error') {
    return { type: 'idle' };
  }

  if (params.routeMode === 'unsupported') {
    return { type: 'idle' };
  }

  if (!params.sendMode) {
    return { type: 'idle' };
  }

  const sendMode = params.sendMode;
  const isGatewaySendMode = sendMode === 'gateway';
  const hasActiveSession =
    params.activeSessionId !== null && params.sessionIds.includes(params.activeSessionId);

  if (!params.activeSessionId) {
    if (params.sessionIds.length > 0 && !isGatewaySendMode) {
      return { type: 'select', sessionId: params.sessionIds[0] };
    }

    if (params.hasActiveModel && !isGatewaySendMode) {
      return { type: 'create' };
    }

    return { type: 'idle' };
  }

  if (!hasActiveSession) {
    if (params.sessionIds.length > 0 && !isGatewaySendMode) {
      return { type: 'select', sessionId: params.sessionIds[0] };
    }

    if (params.hasActiveModel && !isGatewaySendMode) {
      return { type: 'create' };
    }
  }

  return { type: 'idle' };
}
