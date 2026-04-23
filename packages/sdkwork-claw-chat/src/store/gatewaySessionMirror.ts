import type { KernelChatAuthorityKind } from '@sdkwork/claw-types';
import { resolveGatewayAuthoritativeKernelChat } from '../services/index.ts';

export interface GatewayMirrorSessionLike {
  id: string;
  transport?: string | null;
  kernelSession?: {
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

export function resolveGatewayMirrorScopeSessions<T extends GatewayMirrorSessionLike>(
  input: ResolveGatewayMirrorScopeSessionsInput<T>,
) {
  const nextGatewaySessions = filterGatewayMirrorSessions(input.snapshotSessions);
  if (nextGatewaySessions.length > 0 || input.syncState === 'idle') {
    return nextGatewaySessions;
  }

  return filterGatewayMirrorSessions(input.existingSessions);
}

export async function syncGatewayMirrorSessions<T extends GatewayMirrorSessionLike>(
  input: SyncGatewayMirrorSessionsInput<T>,
) {
  const nextSessions = filterGatewayMirrorSessions(input.snapshotSessions);
  const persistedSessions = filterGatewayMirrorSessions(
    await input.listPersistedSessions(input.instanceId),
  );
  const nextSessionIds = new Set(nextSessions.map((session) => session.id));

  for (const session of nextSessions) {
    await input.putPersistedSession(session);
  }

  for (const session of persistedSessions) {
    if (!nextSessionIds.has(session.id)) {
      await input.deletePersistedSession(session.id);
    }
  }
}
