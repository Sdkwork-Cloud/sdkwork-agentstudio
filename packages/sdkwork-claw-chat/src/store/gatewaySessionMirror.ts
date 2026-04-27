import type { KernelChatAuthorityKind } from '@sdkwork/claw-types';
import {
  getChatSessionDisplayTitle,
  isReadableChatSessionTitle,
  normalizeChatSessionTitle,
  resolveGatewayAuthoritativeKernelChat,
  type ChatSessionTitleMessageLike,
  type ChatSessionTitleSource,
} from '../services/index.ts';

export interface GatewayMirrorSessionLike {
  id: string;
  title?: string;
  titleSource?: ChatSessionTitleSource;
  updatedAt?: number;
  lastSeenAt?: number | null;
  messages?: ChatSessionTitleMessageLike[];
  lastMessagePreview?: string;
  historyState?: string | null;
  transport?: string | null;
  kernelSession?: {
    ref?: {
      kernelId?: string | null;
    } | null;
    title?: string | null;
    updatedAt?: number;
    messageCount?: number;
    lastMessagePreview?: string | null;
    authority?: {
      kind?: KernelChatAuthorityKind | null;
    } | null;
  } | null;
}

export interface ResolveGatewayMirrorScopeSessionsInput<T extends GatewayMirrorSessionLike> {
  existingSessions: T[];
  snapshotSessions: T[];
  syncState: 'idle' | 'loading' | 'error';
}

export interface SyncGatewayMirrorSessionsInput<T extends GatewayMirrorSessionLike> {
  instanceId: string;
  snapshotSessions: T[];
  persistedSessions?: T[];
  listPersistedSessions: (instanceId: string) => Promise<T[]>;
  putPersistedSession: (session: T) => Promise<unknown>;
  deletePersistedSession: (sessionId: string) => Promise<unknown>;
}

export function isGatewayMirrorSession<T extends GatewayMirrorSessionLike>(
  session: T | null | undefined,
) {
  return (
    resolveGatewayAuthoritativeKernelChat({
      sessionAuthorityKind: session?.kernelSession?.authority?.kind ?? null,
    }) || session?.transport === 'openclawGateway'
  );
}

export function filterGatewayMirrorSessions<T extends GatewayMirrorSessionLike>(sessions: T[]) {
  return sessions.filter((session) => isGatewayMirrorSession(session));
}

function hasMessages(session: GatewayMirrorSessionLike | null | undefined) {
  return Array.isArray(session?.messages) && session.messages.length > 0;
}

function resolveGatewayMirrorDisplayTitleState(
  session: GatewayMirrorSessionLike | null | undefined,
): { title: string; titleSource: ChatSessionTitleSource } | null {
  if (!session) {
    return null;
  }

  const displayTitle = getChatSessionDisplayTitle(session);
  if (!isReadableChatSessionTitle(displayTitle)) {
    return null;
  }

  const normalizedStoredTitle = normalizeChatSessionTitle(session.title);
  if (session.titleSource === 'explicit' && normalizedStoredTitle === displayTitle) {
    return {
      title: displayTitle,
      titleSource: 'explicit',
    };
  }

  if (session.titleSource === 'firstUser') {
    return {
      title: displayTitle,
      titleSource: 'firstUser',
    };
  }

  return {
    title: displayTitle,
    titleSource: hasMessages(session) ? 'firstUser' : 'explicit',
  };
}

function shouldPreservePersistedGatewayMirrorTitle<T extends GatewayMirrorSessionLike>(
  snapshotSession: T,
  persistedSession: T | undefined,
) {
  const persistedTitleState = resolveGatewayMirrorDisplayTitleState(persistedSession);
  if (!persistedTitleState) {
    return false;
  }

  const snapshotTitleState = resolveGatewayMirrorDisplayTitleState(snapshotSession);
  if (!snapshotTitleState) {
    return true;
  }

  if (snapshotSession.titleSource === 'explicit') {
    return false;
  }

  return persistedSession?.titleSource === 'explicit' || persistedSession?.titleSource === 'firstUser';
}

function mergeGatewayMirrorSessionWithPersisted<T extends GatewayMirrorSessionLike>(
  snapshotSession: T,
  persistedSession: T | undefined,
): T {
  if (!persistedSession) {
    return snapshotSession;
  }

  const persistedTitleState = resolveGatewayMirrorDisplayTitleState(persistedSession);
  const preservePersistedTitle = shouldPreservePersistedGatewayMirrorTitle(
    snapshotSession,
    persistedSession,
  );
  const preservePersistedMessages =
    !hasMessages(snapshotSession) &&
    hasMessages(persistedSession) &&
    snapshotSession.historyState !== 'ready';
  const nextTitleState =
    preservePersistedTitle && persistedTitleState ? persistedTitleState : null;
  const nextMessages = preservePersistedMessages
    ? persistedSession.messages
    : snapshotSession.messages;
  const nextLastMessagePreview =
    snapshotSession.lastMessagePreview ?? persistedSession.lastMessagePreview;
  const nextKernelSession =
    snapshotSession.kernelSession || persistedSession.kernelSession
      ? {
          ...(persistedSession.kernelSession ?? {}),
          ...(snapshotSession.kernelSession ?? {}),
          ...(nextTitleState ? { title: nextTitleState.title } : {}),
          ...(nextLastMessagePreview ? { lastMessagePreview: nextLastMessagePreview } : {}),
          ...(typeof snapshotSession.updatedAt === 'number'
            ? { updatedAt: snapshotSession.updatedAt }
            : {}),
          ...(Array.isArray(nextMessages) ? { messageCount: nextMessages.length } : {}),
        }
      : undefined;

  return {
    ...persistedSession,
    ...snapshotSession,
    ...(nextTitleState
      ? {
          title: nextTitleState.title,
          titleSource: nextTitleState.titleSource,
        }
      : {}),
    ...(nextMessages ? { messages: nextMessages } : {}),
    lastSeenAt: snapshotSession.lastSeenAt ?? persistedSession.lastSeenAt ?? null,
    lastMessagePreview: nextLastMessagePreview,
    ...(nextKernelSession ? { kernelSession: nextKernelSession } : {}),
  } as T;
}

function mergeGatewayMirrorSessionsWithPersisted<T extends GatewayMirrorSessionLike>(
  snapshotSessions: T[],
  persistedSessions: T[],
) {
  const persistedById = new Map(persistedSessions.map((session) => [session.id, session]));
  return snapshotSessions.map((session) =>
    mergeGatewayMirrorSessionWithPersisted(session, persistedById.get(session.id)),
  );
}

export function resolveGatewayMirrorScopeSessions<T extends GatewayMirrorSessionLike>(
  input: ResolveGatewayMirrorScopeSessionsInput<T>,
) {
  const nextGatewaySessions = filterGatewayMirrorSessions(input.snapshotSessions);
  if (nextGatewaySessions.length > 0) {
    return mergeGatewayMirrorSessionsWithPersisted(
      nextGatewaySessions,
      filterGatewayMirrorSessions(input.existingSessions),
    );
  }

  if (input.syncState === 'idle') {
    return [];
  }

  return filterGatewayMirrorSessions(input.existingSessions);
}

export async function syncGatewayMirrorSessions<T extends GatewayMirrorSessionLike>(
  input: SyncGatewayMirrorSessionsInput<T>,
) {
  const nextSessions = filterGatewayMirrorSessions(input.snapshotSessions);
  const persistedSessions = filterGatewayMirrorSessions(
    input.persistedSessions ?? (await input.listPersistedSessions(input.instanceId)),
  );
  const mergedSessions = mergeGatewayMirrorSessionsWithPersisted(nextSessions, persistedSessions);
  const nextSessionIds = new Set(mergedSessions.map((session) => session.id));

  for (const session of mergedSessions) {
    await input.putPersistedSession(session);
  }

  for (const session of persistedSessions) {
    if (!nextSessionIds.has(session.id)) {
      await input.deletePersistedSession(session.id);
    }
  }

  return mergedSessions;
}
