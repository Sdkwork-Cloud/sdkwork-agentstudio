import { createSimpleStore } from '@sdkwork/claw-core';
import type {
  KernelChatMessage,
  KernelChatRun,
  KernelChatSession,
  StudioConversationAttachment,
} from '@sdkwork/claw-types';
import { STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID as BUILT_IN_DIRECT_CONVERSATION_INSTANCE_ID } from '@sdkwork/claw-types';
import {
  buildOpenClawThreadSessionKey,
  buildLocalChatKernelChatMessage,
  composeOutgoingChatText,
  createAuthoritativeKernelChatAdapterRegistry,
  DEFAULT_CHAT_SESSION_TITLE,
  getSharedOpenClawGatewayClient,
  hydrateLocalChatKernelProjection,
  isGatewayAuthoritativeRouteMode,
  orderChatMessagesForDisplay,
  openClawGatewayHistoryConfigService,
  resolveLatestChatMessageForDisplay,
  resolveLatestChatMessageTimestamp,
  type KernelChatAdapter,
  type KernelChatAdapterCapabilities,
  type OpenClawToolCard,
  resolveAuthoritativeInstanceChatRoute,
  resolveInitialChatSessionTitle,
  resolveKernelChatMessageState,
  studioConversationService,
  shouldUseGatewayAuthoritativeSessionStore,
  type InstanceChatRouteMode,
} from '../services/index.ts';
import { connectGatewayInstancesBestEffort } from './connectGatewayInstances.ts';
import {
  filterGatewayMirrorSessions,
  isGatewayMirrorSession,
  resolveGatewayMirrorScopeSessions,
  syncGatewayMirrorSessions,
} from './gatewaySessionMirror.ts';
import {
  buildChatSessionPreferencesKey,
  chatSessionPreferencesStore,
} from './chatSessionPreferencesStore.ts';
import { OpenClawGatewaySessionStore } from './openClawGatewaySessionStore.ts';

export type Role = 'user' | 'assistant' | 'system' | 'tool';
export type SyncState = 'idle' | 'loading' | 'error';
export type GatewayConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  seq?: number;
  senderLabel?: string | null;
  model?: string;
  runId?: string;
  attachments?: StudioConversationAttachment[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
  kernelMessage?: KernelChatMessage | null;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number | null;
  messages: Message[];
  model: string;
  defaultModel?: string | null;
  instanceId?: string;
  transport?: 'local' | 'kernelAdapter' | 'openclawGateway';
  isDraft?: boolean;
  runId?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  lastMessagePreview?: string;
  historyState?: 'idle' | 'loading' | 'ready' | 'error';
  sessionKind?: string | null;
  agentId?: string | null;
  agentLabel?: string | null;
  kernelSession?: KernelChatSession | null;
  kernelRuns?: KernelChatRun[] | null;
}

type ScopeMap<T> = Record<string, T>;

export interface ChatState {
  sessions: ChatSession[];
  activeSessionIdByInstance: ScopeMap<string | null>;
  syncStateByInstance: ScopeMap<SyncState>;
  gatewayConnectionStatusByInstance: ScopeMap<GatewayConnectionStatus | undefined>;
  lastErrorByInstance: ScopeMap<string | undefined>;
  instanceRouteModeById: Record<string, InstanceChatRouteMode | undefined>;
  instanceChatAdapterCapabilitiesById: Record<string, KernelChatAdapterCapabilities | undefined>;
  hydrateInstance: (instanceId: string | null | undefined) => Promise<void>;
  connectGatewayInstances: (instanceIds: string[]) => Promise<void>;
  createSession: (
    model?: string,
    instanceId?: string,
    options?: {
      agentId?: string | null;
      agentLabel?: string | null;
      sessionId?: string | null;
    },
  ) => Promise<string>;
  startNewSession: (
    model?: string,
    instanceId?: string,
    options?: {
      agentId?: string | null;
      agentLabel?: string | null;
    },
  ) => Promise<string | null>;
  deleteSession: (id: string, instanceId?: string) => Promise<void>;
  setActiveSession: (id: string | null, instanceId?: string) => Promise<void>;
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  removeMessages: (sessionId: string, messageIds: string[]) => void;
  clearSession: (id: string, instanceId?: string) => Promise<void>;
  flushSession: (id: string) => Promise<void>;
  setKernelSessionModel: (params: {
    instanceId: string;
    sessionId: string;
    model: string | null;
  }) => Promise<void>;
  setKernelSessionThinkingLevel: (params: {
    instanceId: string;
    sessionId: string;
    thinkingLevel: string | null;
  }) => Promise<void>;
  setKernelSessionFastMode: (params: {
    instanceId: string;
    sessionId: string;
    fastMode: boolean | null;
  }) => Promise<void>;
  setKernelSessionVerboseLevel: (params: {
    instanceId: string;
    sessionId: string;
    verboseLevel: string | null;
  }) => Promise<void>;
  setKernelSessionReasoningLevel: (params: {
    instanceId: string;
    sessionId: string;
    reasoningLevel: string | null;
  }) => Promise<void>;
  sendKernelMessage: (params: {
    instanceId: string;
    sessionId: string;
    content: string;
    model?: string;
    attachments?: StudioConversationAttachment[];
    requestText?: string;
  }) => Promise<{ runId: string }>;
  abortSession: (params: { instanceId: string; sessionId: string }) => Promise<boolean>;
}

const DEFAULT_MODEL = 'Llama-3-8B-Instruct';
const DEFAULT_TITLE = DEFAULT_CHAT_SESSION_TITLE;
const DIRECT_SCOPE_KEY = '__direct__';
const activeSessionSelectionRevisionByInstance = new Map<string, number>();
const authoritativeSessionProjectionRevisionByKey = new Map<string, number>();

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getScopeKey(instanceId: string | null | undefined) {
  return instanceId ?? DIRECT_SCOPE_KEY;
}

function getDirectConversationStoreInstanceId(): string {
  return BUILT_IN_DIRECT_CONVERSATION_INSTANCE_ID;
}

function createLatestOperationToken(
  revisions: Map<string, number>,
  key: string,
) {
  const revision = (revisions.get(key) ?? 0) + 1;
  revisions.set(key, revision);
  return {
    key,
    revision,
  };
}

function isLatestOperationToken(
  revisions: Map<string, number>,
  token: {
    key: string;
    revision: number;
  },
) {
  return revisions.get(token.key) === token.revision;
}

function buildInstanceSessionOperationKey(instanceId: string, sessionId: string) {
  return `${instanceId}::${sessionId}`;
}

function createSessionId(instanceId?: string) {
  if (instanceId) {
    return `thread:claw-studio:${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  return createId('session');
}

function normalizeMessages(messages: Message[] | undefined) {
  return Array.isArray(messages) ? orderChatMessagesForDisplay(messages) : [];
}

function normalizeKernelRuns(runs: KernelChatRun[] | null | undefined) {
  return Array.isArray(runs) ? [...runs] : null;
}

function normalizeOptionalTimestamp(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function resolveSessionLastMessageTimestamp(
  session: Pick<ChatSession, 'messages'>,
) {
  return resolveLatestChatMessageTimestamp(normalizeMessages(session.messages));
}

function resolveSessionActivityTimestamp(
  session: Pick<ChatSession, 'createdAt' | 'updatedAt' | 'messages' | 'kernelSession'>,
) {
  return Math.max(
    session.createdAt,
    session.updatedAt,
    session.kernelSession?.updatedAt ?? Number.NEGATIVE_INFINITY,
    resolveSessionLastMessageTimestamp(session) ?? Number.NEGATIVE_INFINITY,
  );
}

function setChatSessionLastSeenAt<T extends ChatSession>(
  session: T,
  lastSeenAt: number | null | undefined,
) {
  const normalizedLastSeenAt = normalizeOptionalTimestamp(lastSeenAt);
  if (normalizedLastSeenAt === null) {
    return normalizeSession({
      ...session,
      lastSeenAt: null,
    }) as T;
  }

  const currentLastSeenAt = normalizeOptionalTimestamp(session.lastSeenAt);
  if (currentLastSeenAt !== null && currentLastSeenAt >= normalizedLastSeenAt) {
    return normalizeSession(session) as T;
  }

  return normalizeSession({
    ...session,
    lastSeenAt: normalizedLastSeenAt,
  }) as T;
}

function markChatSessionSeen<T extends ChatSession>(session: T) {
  return setChatSessionLastSeenAt(session, resolveSessionActivityTimestamp(session));
}

function markDirectScopeSessionSeen(
  sessions: ChatSession[],
  sessionId: string | null | undefined,
) {
  if (!sessionId) {
    return sessions.map(normalizeSession);
  }

  return sessions.map((session) => {
    if (session.id !== sessionId || session.instanceId || isGatewayAuthoritativeStoredSession(session)) {
      return normalizeSession(session);
    }

    return markChatSessionSeen(normalizeSession(session));
  });
}

function cloneAttachments(
  attachments: StudioConversationAttachment[] | undefined,
) {
  return attachments?.map((attachment) => ({ ...attachment }));
}

function normalizeSession(session: ChatSession): ChatSession {
  const normalizedSession = {
    ...session,
    transport:
      session.transport ??
      (session.instanceId && session.kernelSession?.authority.kind !== 'localProjection'
        ? 'kernelAdapter'
        : 'local'),
    lastSeenAt: normalizeOptionalTimestamp(session.lastSeenAt),
    messages: normalizeMessages(session.messages),
    kernelRuns: normalizeKernelRuns(session.kernelRuns),
  };

  if (isGatewayAuthoritativeStoredSession(normalizedSession)) {
    return normalizedSession;
  }

  if (!normalizedSession.instanceId) {
    return hydrateLocalChatKernelProjection({
      session: normalizedSession,
    });
  }

  if (normalizedSession.transport === 'kernelAdapter' && normalizedSession.kernelSession) {
    return {
      ...normalizedSession,
      messages: normalizedSession.messages.map((message) => ({
        ...message,
        kernelMessage: buildLocalChatKernelChatMessage({
          sessionRef: normalizedSession.kernelSession!.ref,
          message,
        }),
      })),
    };
  }

  return normalizedSession;
}

function sortSessions(sessions: ChatSession[]) {
  return sessions.map(normalizeSession).sort((left, right) => right.updatedAt - left.updatedAt);
}

function isStudioConversationPersistableSession(
  session: ChatSession | null | undefined,
): session is ChatSession {
  if (!session || isGatewayAuthoritativeStoredSession(session)) {
    return false;
  }

  const authority = session.kernelSession?.authority ?? null;
  if (!session.instanceId) {
    return (authority?.kind ?? 'localProjection') === 'localProjection';
  }

  return authority !== null && authority.kind !== 'gateway' && authority.durable === false;
}

function shouldUseStudioConversationFallbackStore(
  capabilities: KernelChatAdapterCapabilities | null | undefined,
) {
  return Boolean(
    capabilities &&
      capabilities.supported !== false &&
      capabilities.authorityKind !== 'gateway' &&
      capabilities.durable === false,
  );
}

function resolveStudioConversationPersistenceError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Failed to persist conversation';
}

function isMissingStudioConversationStoreMethodError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  return (
    message.includes('listConversations is not a function') ||
    message.includes('putConversation is not a function') ||
    message.includes('deleteConversation is not a function')
  );
}

async function persistStudioConversationSession(params: {
  get: () => ChatState;
  set: (
    partial:
      | ChatState
      | Partial<ChatState>
      | ((state: ChatState) => ChatState | Partial<ChatState>),
    replace?: false,
  ) => void;
  sessionId: string;
}) {
  const session = params.get().sessions.find((candidate) => candidate.id === params.sessionId) ?? null;
  if (!isStudioConversationPersistableSession(session)) {
    return;
  }

  const scopeKey = getScopeKey(session.instanceId);

  try {
    await studioConversationService.putConversation(session);
    params.set((state) => ({
      syncStateByInstance: {
        ...state.syncStateByInstance,
        [scopeKey]: 'idle',
      },
      lastErrorByInstance: {
        ...state.lastErrorByInstance,
        [scopeKey]: undefined,
      },
    }));
  } catch (error) {
    if (session.instanceId && isMissingStudioConversationStoreMethodError(error)) {
      return;
    }

    console.error('Failed to persist conversation:', error);
    params.set((state) => ({
      syncStateByInstance: {
        ...state.syncStateByInstance,
        [scopeKey]: 'error',
      },
      lastErrorByInstance: {
        ...state.lastErrorByInstance,
        [scopeKey]: resolveStudioConversationPersistenceError(error),
      },
    }));
  }
}

async function deleteStudioConversationSession(params: {
  set: (
    partial:
      | ChatState
      | Partial<ChatState>
      | ((state: ChatState) => ChatState | Partial<ChatState>),
    replace?: false,
  ) => void;
  sessionId: string;
  instanceId?: string | null | undefined;
}) {
  const scopeKey = getScopeKey(params.instanceId);

  try {
    await studioConversationService.deleteConversation(params.sessionId);
    params.set((state) => ({
      syncStateByInstance: {
        ...state.syncStateByInstance,
        [scopeKey]: 'idle',
      },
      lastErrorByInstance: {
        ...state.lastErrorByInstance,
        [scopeKey]: undefined,
      },
    }));
  } catch (error) {
    if (params.instanceId && isMissingStudioConversationStoreMethodError(error)) {
      return;
    }

    console.error('Failed to delete conversation:', error);
    params.set((state) => ({
      syncStateByInstance: {
        ...state.syncStateByInstance,
        [scopeKey]: 'error',
      },
      lastErrorByInstance: {
        ...state.lastErrorByInstance,
        [scopeKey]: resolveStudioConversationPersistenceError(error),
      },
    }));
  }
}

function listScopeSessions(sessions: ChatSession[], instanceId: string | null | undefined) {
  return sessions.filter((session) =>
    instanceId ? session.instanceId === instanceId : !session.instanceId,
  );
}

function listScopeAdapterSessions(sessions: ChatSession[], instanceId: string | null | undefined) {
  return listScopeSessions(sessions, instanceId)
    .map(normalizeSession)
    .filter((session) => session.transport === 'kernelAdapter');
}

function replaceInstanceSessions(
  sessions: ChatSession[],
  instanceId: string | null | undefined,
  nextSessions: ChatSession[],
) {
  return [
    ...sessions.filter((session) =>
      instanceId ? session.instanceId !== instanceId : Boolean(session.instanceId),
    ),
    ...nextSessions.map(normalizeSession),
  ].sort((left, right) => right.updatedAt - left.updatedAt);
}

function clearChatInstanceScopeState(
  state: ChatState,
  instanceId: string,
  options: {
    syncState?: SyncState;
    lastError?: string | undefined;
  } = {},
) {
  const scopeKey = getScopeKey(instanceId);

  return {
    sessions: replaceInstanceSessions(state.sessions, instanceId, []),
    activeSessionIdByInstance: {
      ...state.activeSessionIdByInstance,
      [scopeKey]: null,
    },
    syncStateByInstance: {
      ...state.syncStateByInstance,
      [scopeKey]: options.syncState ?? 'idle',
    },
    gatewayConnectionStatusByInstance: {
      ...state.gatewayConnectionStatusByInstance,
      [scopeKey]: undefined,
    },
    lastErrorByInstance: {
      ...state.lastErrorByInstance,
      [scopeKey]: options.lastError,
    },
  } satisfies Partial<ChatState>;
}

function buildUnsupportedChatRouteError(reason?: string) {
  return reason
    ? `This instance does not expose a supported chat route yet. ${reason}`
    : 'This instance does not expose a supported chat route yet.';
}

function clearDeletedChatSessionPreferences(params: {
  sessionId: string;
  instanceId?: string | null | undefined;
}) {
  chatSessionPreferencesStore.getState().clearSessionPreferences(
    buildChatSessionPreferencesKey({
      instanceId: params.instanceId,
      sessionId: params.sessionId,
    }),
  );
}

function resolveScopeActiveSessionId(params: {
  sessions: ChatSession[];
  preferredActiveSessionId?: string | null;
  fallbackActiveSessionId?: string | null;
}) {
  const preferredActiveSessionId = params.preferredActiveSessionId ?? null;
  if (
    preferredActiveSessionId &&
    params.sessions.some((session) => session.id === preferredActiveSessionId)
  ) {
    return preferredActiveSessionId;
  }

  const fallbackActiveSessionId = params.fallbackActiveSessionId ?? null;
  if (
    fallbackActiveSessionId &&
    params.sessions.some((session) => session.id === fallbackActiveSessionId)
  ) {
    return fallbackActiveSessionId;
  }

  return params.sessions[0]?.id ?? null;
}

function applyAdapterInstanceScopeState(
  state: ChatState,
  instanceId: string | undefined,
  options: {
    baseSessions?: ChatSession[];
    preservedAdapterSessions?: ChatSession[];
    preferredActiveSessionId?: string | null;
    lastError?: string | undefined;
    syncState?: SyncState;
  } = {},
) {
  if (!instanceId) {
    return state;
  }

  const scopeKey = getScopeKey(instanceId);
  const baseSessions = options.baseSessions ?? state.sessions;
  const preservedAdapterSessions =
    options.preservedAdapterSessions ?? listScopeAdapterSessions(baseSessions, instanceId);
  const nextActiveSessionId = resolveScopeActiveSessionId({
    sessions: preservedAdapterSessions,
    preferredActiveSessionId: options.preferredActiveSessionId,
    fallbackActiveSessionId: state.activeSessionIdByInstance[scopeKey] ?? null,
  });
  const nextPreservedAdapterSessions = preservedAdapterSessions.map((session) => {
    if (session.id !== nextActiveSessionId) {
      return normalizeSession(session);
    }

    return markChatSessionSeen(normalizeSession(session));
  });

  return {
    sessions: replaceInstanceSessions(baseSessions, instanceId, nextPreservedAdapterSessions),
    activeSessionIdByInstance: {
      ...state.activeSessionIdByInstance,
      [scopeKey]: nextActiveSessionId,
    },
    syncStateByInstance: {
      ...state.syncStateByInstance,
      [scopeKey]: options.syncState ?? 'idle',
    },
    gatewayConnectionStatusByInstance: {
      ...state.gatewayConnectionStatusByInstance,
      [scopeKey]: undefined,
    },
    lastErrorByInstance: {
      ...state.lastErrorByInstance,
      [scopeKey]: options.lastError,
    },
  } satisfies Partial<ChatState>;
}

function appendAssistantErrorMessageToSessionState(
  state: ChatState,
  params: {
    instanceId: string;
    sessionId: string;
    message: string;
    timestamp: number;
    syncState: SyncState;
    lastError: string | undefined;
  },
) {
  let updatedSession: ChatSession | null = null;
  const nextSessions = sortSessions(
    state.sessions.map((session) => {
      if (
        session.id !== params.sessionId ||
        session.instanceId !== params.instanceId ||
        isGatewayAuthoritativeStoredSession(session)
      ) {
        return normalizeSession(session);
      }

      const nextSession = {
        ...normalizeSession(session),
        updatedAt: params.timestamp,
        messages: [
          ...normalizeMessages(session.messages),
          {
            id: createId('msg'),
            role: 'assistant' as const,
            content: params.message,
            timestamp: params.timestamp,
          },
        ],
      } satisfies ChatSession;
      updatedSession =
        state.activeSessionIdByInstance[getScopeKey(params.instanceId)] === params.sessionId
          ? markChatSessionSeen(nextSession)
          : normalizeSession(nextSession);
      return updatedSession;
    }),
  );

  if (!updatedSession) {
    return {
      syncStateByInstance: {
        ...state.syncStateByInstance,
        [getScopeKey(params.instanceId)]: params.syncState,
      },
      lastErrorByInstance: {
        ...state.lastErrorByInstance,
        [getScopeKey(params.instanceId)]: params.lastError,
      },
    } satisfies Partial<ChatState>;
  }

  const nextAdapterSessions = listScopeAdapterSessions(nextSessions, params.instanceId);
  return applyAdapterInstanceScopeState(state, params.instanceId, {
    baseSessions: nextSessions,
    preservedAdapterSessions: nextAdapterSessions,
    preferredActiveSessionId: params.sessionId,
    syncState: params.syncState,
    lastError: params.lastError,
  });
}

async function resolveInstanceRouteMode(instanceId: string | null | undefined) {
  const { instance, route } = await resolveAuthoritativeInstanceChatRoute(instanceId);
  return {
    mode: route.mode,
    reason: route.reason,
    instance,
  };
}

const openClawGatewaySessions = new OpenClawGatewaySessionStore({
  getClient: getSharedOpenClawGatewayClient,
  createSessionKey(_instanceId, agentId) {
    return buildOpenClawThreadSessionKey(agentId, `claw-studio:${createId('session')}`);
  },
  resolveHistoryMaxChars(instanceId) {
    return openClawGatewayHistoryConfigService.getHistoryMaxChars(instanceId);
  },
});

const transportBackedAdaptersByInstance = new Map<
  string,
  KernelChatAdapter
>();

const kernelChatAdapterRegistry = createAuthoritativeKernelChatAdapterRegistry({
  gatewayStore: openClawGatewaySessions,
  transportBackedAdaptersByInstance,
});

async function resolveInstanceChatContext(instanceId: string | null | undefined) {
  const routeResolution = await resolveInstanceRouteMode(instanceId);
  if (!instanceId || !routeResolution.instance) {
    return {
      ...routeResolution,
      adapterResolution: null,
    };
  }

  return {
    ...routeResolution,
    adapterResolution: await kernelChatAdapterRegistry.resolveForInstance(instanceId),
  };
}

function applyInstanceChatRuntimeState(
  state: ChatState,
  input: {
    instanceId: string;
    routeMode: InstanceChatRouteMode | undefined;
    adapterCapabilities?: KernelChatAdapterCapabilities | null;
  },
) {
  return {
    instanceRouteModeById: {
      ...state.instanceRouteModeById,
      [input.instanceId]: input.routeMode,
    },
    instanceChatAdapterCapabilitiesById: {
      ...state.instanceChatAdapterCapabilitiesById,
      [input.instanceId]: input.adapterCapabilities ?? undefined,
    },
  } satisfies Partial<ChatState>;
}

function shouldUseGatewayInstanceSessionStore(input: {
  routeMode: InstanceChatRouteMode | undefined;
  adapterCapabilities?: KernelChatAdapterCapabilities | null;
  session?: ChatSession | null;
}) {
  return shouldUseGatewayAuthoritativeSessionStore({
    routeMode: input.routeMode,
    adapterCapabilities: input.adapterCapabilities,
    sessionAuthorityKind: input.session?.kernelSession?.authority.kind ?? null,
  });
}

type ChatStoreStateSetter = (
  partial:
    | ChatState
    | Partial<ChatState>
    | ((state: ChatState) => ChatState | Partial<ChatState>),
  replace?: boolean,
) => void;

type ChatStoreStateGetter = () => ChatState;

interface AuthoritativeKernelSessionPatch {
  model?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
}

async function mutateAuthoritativeKernelSession(params: {
  set: ChatStoreStateSetter;
  get: ChatStoreStateGetter;
  instanceId: string;
  sessionId: string;
  mutationToken: {
    key: string;
    revision: number;
  };
  patch: AuthoritativeKernelSessionPatch;
  gatewayMutation: () => Promise<void>;
  logErrorMessage: string;
  fallbackErrorMessage: string;
}) {
  const scopeKey = getScopeKey(params.instanceId);
  const resolvedContext = await resolveInstanceChatContext(params.instanceId);
  if (
    !isLatestOperationToken(authoritativeSessionProjectionRevisionByKey, params.mutationToken)
  ) {
    return;
  }

  const routeMode = resolvedContext.mode;
  const session =
    params.get().sessions.find(
      (candidate) =>
        candidate.id === params.sessionId &&
        candidate.instanceId === params.instanceId,
    ) ?? null;

  params.set((state) => ({
    ...applyInstanceChatRuntimeState(state, {
      instanceId: params.instanceId,
      routeMode,
      adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
    }),
  }));

  if (
    shouldUseGatewayInstanceSessionStore({
      routeMode,
      adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
      session,
    })
  ) {
    await params.gatewayMutation();
    return;
  }

  openClawGatewaySessions.releaseInstance(params.instanceId);

  if (
    routeMode === 'unsupported' ||
    !resolvedContext.adapterResolution?.capabilities.supported ||
    !resolvedContext.adapterResolution.adapter.patchSession
  ) {
    return;
  }

  params.set((state) => ({
    syncStateByInstance: {
      ...state.syncStateByInstance,
      [scopeKey]: 'loading',
    },
    lastErrorByInstance: {
      ...state.lastErrorByInstance,
      [scopeKey]: undefined,
    },
  }));

  try {
    const kernelSession = await resolvedContext.adapterResolution.adapter.patchSession({
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      ...params.patch,
    });
    const authoritativeProjection =
      await loadAuthoritativeKernelSessionProjection({
        instanceId: params.instanceId,
        sessionId: params.sessionId,
        adapterResolution: resolvedContext.adapterResolution,
      });
    if (
      !isLatestOperationToken(authoritativeSessionProjectionRevisionByKey, params.mutationToken)
    ) {
      return;
    }

    params.set((state) =>
      applyAuthoritativeKernelSessionProjectionState(state, {
        instanceId: params.instanceId,
        sessionId: params.sessionId,
        kernelSession: authoritativeProjection.kernelSession ?? kernelSession,
        kernelMessages: authoritativeProjection.kernelMessages,
        kernelRuns: authoritativeProjection.kernelRuns,
        syncState: 'idle',
        lastError: undefined,
      }),
    );
  } catch (error: any) {
    if (
      !isLatestOperationToken(authoritativeSessionProjectionRevisionByKey, params.mutationToken)
    ) {
      return;
    }
    console.error(params.logErrorMessage, error);
    params.set((state) => ({
      syncStateByInstance: {
        ...state.syncStateByInstance,
        [scopeKey]: 'error',
      },
      lastErrorByInstance: {
        ...state.lastErrorByInstance,
        [scopeKey]:
          error?.message || params.fallbackErrorMessage,
      },
    }));
    throw error;
  }
}

function isGatewayAuthoritativeStoredSession(session: ChatSession | null | undefined) {
  return isGatewayMirrorSession(session);
}

const gatewayMirrorSyncByInstance = new Map<string, Promise<void>>();

async function hydratePersistedGatewaySessions(params: {
  set: (
    partial:
      | ChatState
      | Partial<ChatState>
      | ((state: ChatState) => ChatState | Partial<ChatState>),
    replace?: false,
  ) => void;
  instanceId: string;
}) {
  try {
    const cachedSessions = filterGatewayMirrorSessions(
      await studioConversationService.listConversations(params.instanceId),
    );
    if (cachedSessions.length === 0) {
      return;
    }

    params.set((state) => {
      const nextSessions = replaceInstanceSessions(
        state.sessions,
        params.instanceId,
        cachedSessions,
      );
      const scopeKey = getScopeKey(params.instanceId);
      const nextScopeSessions = listScopeSessions(nextSessions, params.instanceId);

      return {
        sessions: nextSessions,
        activeSessionIdByInstance: {
          ...state.activeSessionIdByInstance,
          [scopeKey]: resolveScopeActiveSessionId({
            sessions: nextScopeSessions,
            fallbackActiveSessionId: state.activeSessionIdByInstance[scopeKey] ?? null,
          }),
        },
        syncStateByInstance: {
          ...state.syncStateByInstance,
          [scopeKey]: 'loading',
        },
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [scopeKey]: undefined,
        },
      } satisfies Partial<ChatState>;
    });
  } catch (error) {
    if (!isMissingStudioConversationStoreMethodError(error)) {
      console.error('Failed to hydrate cached gateway conversations:', error);
    }
  }
}

function queuePersistGatewaySnapshotMirror(params: {
  instanceId: string;
  snapshot: ReturnType<typeof openClawGatewaySessions.getSnapshot>;
}) {
  if (params.snapshot.syncState !== 'idle') {
    return;
  }

  const previousTask = gatewayMirrorSyncByInstance.get(params.instanceId) ?? Promise.resolve();
  let nextTask!: Promise<void>;
  nextTask = previousTask
    .catch(() => undefined)
    .then(async () => {
      await syncGatewayMirrorSessions({
        instanceId: params.instanceId,
        snapshotSessions: params.snapshot.sessions as ChatSession[],
        listPersistedSessions: (instanceId) => studioConversationService.listConversations(instanceId),
        putPersistedSession: (session) => studioConversationService.putConversation(session),
        deletePersistedSession: (sessionId) => studioConversationService.deleteConversation(sessionId),
      });
    })
    .catch((error) => {
      if (!isMissingStudioConversationStoreMethodError(error)) {
        console.error('Failed to persist gateway conversation mirror:', error);
      }
    })
    .finally(() => {
      if (gatewayMirrorSyncByInstance.get(params.instanceId) === nextTask) {
        gatewayMirrorSyncByInstance.delete(params.instanceId);
      }
    });

  gatewayMirrorSyncByInstance.set(params.instanceId, nextTask);
}

function buildChatSessionFromKernelSession(input: {
  instanceId: string;
  kernelSession: KernelChatSession;
  kernelRuns?: KernelChatRun[] | null;
  existingSession?: ChatSession | null;
}): ChatSession {
  const modelBinding = input.kernelSession.modelBinding ?? null;
  const existingSession = input.existingSession ?? null;

  return normalizeSession({
    id: input.kernelSession.ref.sessionId,
    title: input.kernelSession.title,
    createdAt: input.kernelSession.createdAt,
    updatedAt: input.kernelSession.updatedAt,
    lastSeenAt: existingSession?.lastSeenAt ?? null,
    messages: existingSession?.messages ?? [],
    model: modelBinding?.model ?? existingSession?.model ?? DEFAULT_MODEL,
    defaultModel: modelBinding?.defaultModel ?? existingSession?.defaultModel ?? null,
    instanceId: input.instanceId,
    isDraft: input.kernelSession.lifecycle === 'draft',
    runId: input.kernelSession.activeRunId ?? existingSession?.runId ?? null,
    thinkingLevel: modelBinding?.thinkingLevel ?? existingSession?.thinkingLevel ?? null,
    fastMode:
      typeof modelBinding?.fastMode === 'boolean'
        ? modelBinding.fastMode
        : existingSession?.fastMode ?? null,
    verboseLevel: modelBinding?.verboseLevel ?? existingSession?.verboseLevel ?? null,
    reasoningLevel: modelBinding?.reasoningLevel ?? existingSession?.reasoningLevel ?? null,
    lastMessagePreview:
      input.kernelSession.lastMessagePreview ?? existingSession?.lastMessagePreview ?? undefined,
    historyState: existingSession?.historyState,
    sessionKind: input.kernelSession.sessionKind ?? existingSession?.sessionKind ?? null,
    agentId:
      input.kernelSession.ref.agentId ??
      input.kernelSession.actorBinding?.agentId ??
      existingSession?.agentId ??
      null,
    agentLabel:
      input.kernelSession.actorBinding?.label ??
      existingSession?.agentLabel ??
      null,
    kernelSession: input.kernelSession,
    kernelRuns: normalizeKernelRuns(input.kernelRuns) ?? existingSession?.kernelRuns ?? null,
    transport: 'kernelAdapter',
  });
}

function buildChatMessagesFromKernelMessages(
  kernelMessages: KernelChatMessage[],
): Message[] {
  return orderChatMessagesForDisplay(
    [...kernelMessages].map((kernelMessage) => {
      const resolved = resolveKernelChatMessageState({
        kernelMessage,
      });

        return {
          id: resolved.id ?? createId('msg'),
          role: resolved.role,
          content: resolved.content,
          timestamp: resolved.timestamp,
          ...(typeof resolved.seq === 'number' ? { seq: resolved.seq } : {}),
          ...(resolved.senderLabel ? { senderLabel: resolved.senderLabel } : {}),
          ...(resolved.model ? { model: resolved.model } : {}),
          ...(resolved.runId ? { runId: resolved.runId } : {}),
        ...(resolved.attachments.length > 0 ? { attachments: resolved.attachments } : {}),
        ...(resolved.reasoning ? { reasoning: resolved.reasoning } : {}),
        ...(resolved.toolCards.length > 0 ? { toolCards: resolved.toolCards } : {}),
        kernelMessage,
      } satisfies Message;
    }),
  );
}

function applyAuthoritativeKernelSessionMessages(input: {
  instanceId: string;
  existingSession: ChatSession;
  kernelSession?: KernelChatSession | null;
  kernelMessages: KernelChatMessage[];
  kernelRuns?: KernelChatRun[] | null;
}) {
  const hydratedMessages = buildChatMessagesFromKernelMessages(input.kernelMessages);
  const latestVisibleMessage = resolveLatestChatMessageForDisplay(hydratedMessages);
  const latestMessageTimestamp = resolveLatestChatMessageTimestamp(hydratedMessages);
  const existingKernelSession = input.existingSession.kernelSession ?? null;
  const kernelSession =
    input.kernelSession ??
    (existingKernelSession
      ? {
          ...existingKernelSession,
          messageCount: hydratedMessages.length,
          updatedAt: latestMessageTimestamp ?? existingKernelSession.updatedAt,
          lastMessagePreview:
            latestVisibleMessage?.content ?? existingKernelSession.lastMessagePreview ?? null,
        }
      : null);

  if (!kernelSession) {
    return normalizeSession({
      ...input.existingSession,
      messages: hydratedMessages,
      updatedAt: latestMessageTimestamp ?? input.existingSession.updatedAt,
      lastMessagePreview:
        latestVisibleMessage?.content ?? input.existingSession.lastMessagePreview ?? undefined,
      kernelRuns: normalizeKernelRuns(input.kernelRuns) ?? input.existingSession.kernelRuns ?? null,
      historyState: 'ready',
    });
  }

  return normalizeSession(
    buildChatSessionFromKernelSession({
      instanceId: input.instanceId,
      kernelSession: {
        ...kernelSession,
        messageCount: Math.max(kernelSession.messageCount, hydratedMessages.length),
        updatedAt: latestMessageTimestamp ?? kernelSession.updatedAt,
        lastMessagePreview:
          latestVisibleMessage?.content ?? kernelSession.lastMessagePreview ?? null,
      },
      existingSession: {
        ...input.existingSession,
        messages: hydratedMessages,
        updatedAt: latestMessageTimestamp ?? input.existingSession.updatedAt,
        lastMessagePreview:
          latestVisibleMessage?.content ?? input.existingSession.lastMessagePreview ?? undefined,
        kernelRuns:
          normalizeKernelRuns(input.kernelRuns) ?? input.existingSession.kernelRuns ?? null,
        historyState: 'ready',
      },
      kernelRuns: input.kernelRuns,
    }),
  );
}

async function loadAuthoritativeKernelSessionProjection(params: {
  instanceId: string;
  sessionId: string;
  adapterResolution: NonNullable<Awaited<ReturnType<typeof resolveInstanceChatContext>>['adapterResolution']>;
}) {
  const [kernelSession, kernelMessages, kernelRuns] = await Promise.all([
    params.adapterResolution.adapter.getSession?.(params.instanceId, params.sessionId) ??
      Promise.resolve(null),
    params.adapterResolution.adapter.loadMessages?.(params.instanceId, params.sessionId) ??
      Promise.resolve([]),
    params.adapterResolution.adapter.listRuns?.(params.instanceId, params.sessionId) ??
      Promise.resolve(null),
  ]);

  return {
    kernelSession,
    kernelMessages,
    kernelRuns,
  };
}

function applyAuthoritativeKernelSessionProjectionState(
  state: ChatState,
  input: {
    instanceId: string;
    sessionId: string;
    kernelSession?: KernelChatSession | null;
    kernelMessages: KernelChatMessage[];
    kernelRuns?: KernelChatRun[] | null;
    syncState?: SyncState;
    lastError?: string | undefined;
    preferredActiveSessionId?: string | null;
  },
) {
  const existingSession = state.sessions.find(
    (session) =>
      session.id === input.sessionId && session.instanceId === input.instanceId,
  );

  let nextSessions: ChatSession[];
  if (existingSession) {
    nextSessions = sortSessions(
      state.sessions.map((session) =>
        session.id === input.sessionId && session.instanceId === input.instanceId
          ? applyAuthoritativeKernelSessionMessages({
              instanceId: input.instanceId,
              existingSession: normalizeSession(existingSession),
              kernelSession: input.kernelSession,
              kernelMessages: input.kernelMessages,
              kernelRuns: input.kernelRuns,
            })
          : normalizeSession(session),
      ),
    );
  } else if (input.kernelSession) {
    const projectedSession = applyAuthoritativeKernelSessionMessages({
      instanceId: input.instanceId,
      existingSession: buildChatSessionFromKernelSession({
        instanceId: input.instanceId,
        kernelSession: input.kernelSession,
        kernelRuns: input.kernelRuns,
      }),
      kernelSession: input.kernelSession,
      kernelMessages: input.kernelMessages,
      kernelRuns: input.kernelRuns,
    });
    nextSessions = sortSessions([
      projectedSession,
      ...state.sessions.map(normalizeSession),
    ]);
  } else {
    nextSessions = state.sessions.map(normalizeSession);
  }

  const nextAdapterSessions = listScopeAdapterSessions(nextSessions, input.instanceId);
  return applyAdapterInstanceScopeState(state, input.instanceId, {
    baseSessions: nextSessions,
    preservedAdapterSessions: nextAdapterSessions,
    preferredActiveSessionId: input.preferredActiveSessionId ?? input.sessionId,
    syncState: input.syncState ?? 'idle',
    lastError: input.lastError,
  });
}

function applyAuthoritativeSessionHistoryState(
  state: ChatState,
  input: {
    instanceId: string;
    sessionId: string;
    historyState: ChatSession['historyState'];
    syncState?: SyncState;
    lastError?: string | undefined;
    preferredActiveSessionId?: string | null;
  },
) {
  const nextSessions = sortSessions(
    state.sessions.map((session) => {
      if (session.id !== input.sessionId || session.instanceId !== input.instanceId) {
        return normalizeSession(session);
      }

      return normalizeSession({
        ...normalizeSession(session),
        historyState: input.historyState,
      });
    }),
  );
  const nextAdapterSessions = listScopeAdapterSessions(nextSessions, input.instanceId);

  return applyAdapterInstanceScopeState(state, input.instanceId, {
    baseSessions: nextSessions,
    preservedAdapterSessions: nextAdapterSessions,
    preferredActiveSessionId: input.preferredActiveSessionId ?? input.sessionId,
    syncState: input.syncState ?? 'idle',
    lastError: input.lastError,
  });
}

function resolveGatewaySnapshotActiveSessionId(params: {
  snapshot: ReturnType<typeof openClawGatewaySessions.getSnapshot>;
  resolvedScopeSessions: ChatSession[];
  fallbackActiveSessionId?: string | null;
}) {
  if (params.snapshot.activeSessionId === null) {
    const shouldPreserveFallbackSelection =
      params.snapshot.syncState !== 'idle' &&
      params.snapshot.sessions.length === 0 &&
      params.resolvedScopeSessions.length > 0;

    if (!shouldPreserveFallbackSelection) {
      return null;
    }

    return resolveScopeActiveSessionId({
      sessions: params.resolvedScopeSessions,
      fallbackActiveSessionId: params.fallbackActiveSessionId ?? null,
    });
  }

  return resolveScopeActiveSessionId({
    sessions: params.resolvedScopeSessions,
    preferredActiveSessionId: params.snapshot.activeSessionId,
    fallbackActiveSessionId: params.fallbackActiveSessionId ?? null,
  });
}

function applyOpenClawSnapshot(
  state: ChatState,
  instanceId: string,
  snapshot: ReturnType<typeof openClawGatewaySessions.getSnapshot>,
) {
  const scopeKey = getScopeKey(instanceId);
  const resolvedScopeSessions = resolveGatewayMirrorScopeSessions({
    existingSessions: listScopeSessions(state.sessions, instanceId),
    snapshotSessions: snapshot.sessions as ChatSession[],
    syncState: snapshot.syncState,
  });
  return {
    sessions: replaceInstanceSessions(state.sessions, instanceId, resolvedScopeSessions),
    activeSessionIdByInstance: {
      ...state.activeSessionIdByInstance,
      [scopeKey]: resolveGatewaySnapshotActiveSessionId({
        snapshot,
        resolvedScopeSessions,
        fallbackActiveSessionId: state.activeSessionIdByInstance[scopeKey] ?? null,
      }),
    },
    syncStateByInstance: {
      ...state.syncStateByInstance,
      [scopeKey]: snapshot.syncState,
    },
    gatewayConnectionStatusByInstance: {
      ...state.gatewayConnectionStatusByInstance,
      [scopeKey]: snapshot.connectionStatus,
    },
    lastErrorByInstance: {
      ...state.lastErrorByInstance,
      [scopeKey]: snapshot.lastError,
    },
  } satisfies Partial<ChatState>;
}

export const chatStore = createSimpleStore<ChatState>((set, get) => ({
  sessions: [],
  activeSessionIdByInstance: {},
  syncStateByInstance: {},
  gatewayConnectionStatusByInstance: {},
  lastErrorByInstance: {},
  instanceRouteModeById: {},
  instanceChatAdapterCapabilitiesById: {},
  async hydrateInstance(instanceId) {
    const scopeKey = getScopeKey(instanceId);

    if (!instanceId) {
      set((state) => ({
        syncStateByInstance: {
          ...state.syncStateByInstance,
          [scopeKey]: 'loading',
        },
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [scopeKey]: undefined,
        },
        gatewayConnectionStatusByInstance: {
          ...state.gatewayConnectionStatusByInstance,
          [scopeKey]: undefined,
        },
      }));

      try {
        const directSessions = (
          await studioConversationService.listConversations(
            getDirectConversationStoreInstanceId(),
          )
        ).filter((session) => !session.instanceId);
        set((state) => {
          const nextSessions = replaceInstanceSessions(
            state.sessions,
            undefined,
            directSessions,
          );
          const nextScopeSessions = listScopeSessions(nextSessions, undefined);
          const currentActiveSessionId =
            state.activeSessionIdByInstance[scopeKey] ?? null;
          const nextActiveSessionId = nextScopeSessions.some(
            (session) => session.id === currentActiveSessionId,
          )
            ? currentActiveSessionId
            : nextScopeSessions[0]?.id ?? null;
          const nextDirectSessions = markDirectScopeSessionSeen(
            nextSessions,
            nextActiveSessionId,
          );

          return {
            sessions: nextDirectSessions,
            activeSessionIdByInstance: {
              ...state.activeSessionIdByInstance,
              [scopeKey]: nextActiveSessionId,
            },
            syncStateByInstance: {
              ...state.syncStateByInstance,
              [scopeKey]: 'idle',
            },
            lastErrorByInstance: {
              ...state.lastErrorByInstance,
              [scopeKey]: undefined,
            },
            gatewayConnectionStatusByInstance: {
              ...state.gatewayConnectionStatusByInstance,
              [scopeKey]: undefined,
            },
          };
        });
      } catch (error: any) {
        console.error('Failed to hydrate direct conversations:', error);
        set((state) => ({
          syncStateByInstance: {
            ...state.syncStateByInstance,
            [scopeKey]: 'error',
          },
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [scopeKey]: error?.message || 'Failed to hydrate direct conversations',
          },
          gatewayConnectionStatusByInstance: {
            ...state.gatewayConnectionStatusByInstance,
            [scopeKey]: undefined,
          },
        }));
      }
      return;
    }

    set((state) => ({
      syncStateByInstance: {
        ...state.syncStateByInstance,
        [scopeKey]: 'loading',
      },
      lastErrorByInstance: {
        ...state.lastErrorByInstance,
        [scopeKey]: undefined,
      },
    }));

    try {
      const { mode, adapterResolution } = await resolveInstanceChatContext(instanceId);
      set((state) => ({
        ...applyInstanceChatRuntimeState(state, {
          instanceId,
          routeMode: mode,
          adapterCapabilities: adapterResolution?.capabilities ?? null,
        }),
      }));

      if (
        shouldUseGatewayInstanceSessionStore({
          routeMode: mode,
          adapterCapabilities: adapterResolution?.capabilities ?? null,
        })
      ) {
        await hydratePersistedGatewaySessions({
          set,
          instanceId,
        });
        await openClawGatewaySessions.hydrateInstance(instanceId);
        return;
      }

      if (mode === 'unsupported' || (adapterResolution && !adapterResolution.capabilities.supported)) {
        openClawGatewaySessions.releaseInstance(instanceId);
        set((state) => clearChatInstanceScopeState(state, instanceId));
        return;
      }

      if (shouldUseStudioConversationFallbackStore(adapterResolution?.capabilities ?? null)) {
        openClawGatewaySessions.releaseInstance(instanceId);
        let persistedSessions: ChatSession[];
        try {
          persistedSessions = await studioConversationService.listConversations(instanceId);
        } catch (error) {
          if (!isMissingStudioConversationStoreMethodError(error)) {
            throw error;
          }

          const kernelSessions = (await adapterResolution?.adapter.listSessions?.(instanceId)) ?? [];
          persistedSessions = kernelSessions.map((kernelSession) =>
            buildChatSessionFromKernelSession({
              instanceId,
              kernelSession,
            }),
          );
        }
        set((state) => {
          const nextSessions = replaceInstanceSessions(
            state.sessions,
            instanceId,
            persistedSessions,
          );
          const nextAdapterSessions = listScopeAdapterSessions(nextSessions, instanceId);

          return applyAdapterInstanceScopeState(state, instanceId, {
            baseSessions: nextSessions,
            preservedAdapterSessions: nextAdapterSessions,
            syncState: 'idle',
            lastError: undefined,
          });
        });
        return;
      }

      openClawGatewaySessions.releaseInstance(instanceId);
      const kernelSessions = (await adapterResolution?.adapter.listSessions?.(instanceId)) ?? [];
      set((state) => {
        const existingAdapterSessions = listScopeAdapterSessions(state.sessions, instanceId);
        const existingSessionsById = new Map(existingAdapterSessions.map((session) => [session.id, session]));
        const sessions = kernelSessions.map((kernelSession) =>
          buildChatSessionFromKernelSession({
            instanceId,
            kernelSession,
            existingSession: existingSessionsById.get(kernelSession.ref.sessionId) ?? null,
          }),
        );
        const nextSessions = replaceInstanceSessions(state.sessions, instanceId, sessions);
        const nextAdapterSessions = listScopeAdapterSessions(nextSessions, instanceId);

        return applyAdapterInstanceScopeState(state, instanceId, {
          baseSessions: nextSessions,
          preservedAdapterSessions: nextAdapterSessions,
          syncState: 'idle',
          lastError: undefined,
        });
      });
    } catch (error: any) {
      console.error('Failed to hydrate conversations:', error);
      set((state) => ({
        syncStateByInstance: {
          ...state.syncStateByInstance,
          [scopeKey]: 'error',
        },
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [scopeKey]: error?.message || 'Failed to hydrate conversations',
        },
      }));
    }
  },
  async connectGatewayInstances(instanceIds) {
    await connectGatewayInstancesBestEffort({
      instanceIds,
      async resolveRouteMode(instanceId) {
        return (await resolveInstanceRouteMode(instanceId)).mode;
      },
      async hydrateGatewayInstance(instanceId) {
        await openClawGatewaySessions.hydrateInstance(instanceId);
      },
      releaseGatewayInstance(instanceId) {
        openClawGatewaySessions.releaseInstance(instanceId);
      },
      setRouteMode(instanceId, mode) {
        set((state) => {
          const preservesGatewayRuntimeState = isGatewayAuthoritativeRouteMode(mode);

          return {
            instanceRouteModeById: {
              ...state.instanceRouteModeById,
              [instanceId]: mode,
            },
            lastErrorByInstance: {
              ...state.lastErrorByInstance,
              [getScopeKey(instanceId)]: undefined,
            },
            syncStateByInstance:
              preservesGatewayRuntimeState
                ? state.syncStateByInstance
                : {
                    ...state.syncStateByInstance,
                    [getScopeKey(instanceId)]: 'idle',
                  },
            gatewayConnectionStatusByInstance:
              preservesGatewayRuntimeState
                ? state.gatewayConnectionStatusByInstance
                : {
                    ...state.gatewayConnectionStatusByInstance,
                    [getScopeKey(instanceId)]: undefined,
                  },
          };
        });
      },
      onError(instanceId, error) {
        console.error('Failed to preconnect OpenClaw gateway instance:', error);
        set((state) => ({
          syncStateByInstance: {
            ...state.syncStateByInstance,
            [getScopeKey(instanceId)]: 'error',
          },
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [getScopeKey(instanceId)]:
              error instanceof Error
                ? error.message
                : 'Failed to preconnect OpenClaw gateway instance.',
          },
        }));
      },
    });
  },
  async createSession(model, instanceId, options) {
    const requestedModel = model?.trim() || undefined;
    if (instanceId) {
      const resolvedContext = await resolveInstanceChatContext(instanceId);
      const routeMode = resolvedContext.mode;
      set((state) => ({
        ...applyInstanceChatRuntimeState(state, {
          instanceId,
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        }),
      }));

      if (
        shouldUseGatewayInstanceSessionStore({
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        })
      ) {
        await openClawGatewaySessions.hydrateInstance(instanceId);
        return openClawGatewaySessions.createDraftSession(instanceId, requestedModel, {
          agentId: options?.agentId,
          sessionId: options?.sessionId,
        }).id;
      }

      if (
        routeMode === 'unsupported' ||
        !resolvedContext.adapterResolution?.capabilities.supported ||
        !resolvedContext.adapterResolution.adapter.createSession
      ) {
        const nextError = buildUnsupportedChatRouteError(
          resolvedContext.reason ?? resolvedContext.adapterResolution?.capabilities.reason ?? undefined,
        );
        openClawGatewaySessions.releaseInstance(instanceId);
        set((state) => clearChatInstanceScopeState(state, instanceId, { lastError: nextError }));
        return '';
      }

      openClawGatewaySessions.releaseInstance(instanceId);
      const kernelSession = await resolvedContext.adapterResolution.adapter.createSession({
        instanceId,
        model: requestedModel ?? null,
        agentId: options?.agentId ?? null,
        actorBindingLabel: options?.agentLabel ?? null,
        title: DEFAULT_TITLE,
      });
      const session = setChatSessionLastSeenAt(
        buildChatSessionFromKernelSession({
          instanceId,
          kernelSession,
        }),
        kernelSession.createdAt,
      );

      set((state) => {
        const nextSessions = sortSessions([session, ...state.sessions.map(normalizeSession)]);
        const scopeKey = getScopeKey(instanceId);
        const nextAdapterSessions = listScopeAdapterSessions(nextSessions, instanceId);
        return applyAdapterInstanceScopeState(state, instanceId, {
          baseSessions: nextSessions,
          preservedAdapterSessions: nextAdapterSessions,
          preferredActiveSessionId: session.id,
          syncState: state.syncStateByInstance[scopeKey] ?? 'idle',
          lastError: undefined,
        });
      });

      if (shouldUseStudioConversationFallbackStore(resolvedContext.adapterResolution?.capabilities)) {
        void persistStudioConversationSession({
          get,
          set,
          sessionId: session.id,
        });
      }

      return session.id;
    }

    const resolvedModel = requestedModel || DEFAULT_MODEL;
    const timestamp = Date.now();
    const session: ChatSession = normalizeSession({
      id: createSessionId(instanceId),
      title: DEFAULT_TITLE,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastSeenAt: timestamp,
      messages: [],
      model: resolvedModel,
      instanceId,
      transport: 'local',
      sessionKind: 'direct',
      agentId: options?.agentId ?? null,
      agentLabel: options?.agentLabel ?? null,
    });

    set((state) => {
      const nextSessions = sortSessions([session, ...state.sessions.map(normalizeSession)]);
      if (!instanceId) {
        return {
          sessions: nextSessions,
          activeSessionIdByInstance: {
            ...state.activeSessionIdByInstance,
            [getScopeKey(instanceId)]: session.id,
          },
          lastErrorByInstance: {
            ...state.lastErrorByInstance,
            [getScopeKey(instanceId)]: undefined,
          },
        };
      }

      const scopeKey = getScopeKey(instanceId);
      const nextAdapterSessions = listScopeAdapterSessions(nextSessions, instanceId);
      return applyAdapterInstanceScopeState(state, instanceId, {
        baseSessions: nextSessions,
        preservedAdapterSessions: nextAdapterSessions,
        preferredActiveSessionId: session.id,
        syncState: state.syncStateByInstance[scopeKey] ?? 'idle',
        lastError: undefined,
      });
    });

    void persistStudioConversationSession({
      get,
      set,
      sessionId: session.id,
    });

    return session.id;
  },
  async startNewSession(model, instanceId, options) {
    const requestedModel = model?.trim() || undefined;
    if (instanceId) {
      const resolvedContext = await resolveInstanceChatContext(instanceId);
      const routeMode = resolvedContext.mode;
      set((state) => ({
        ...applyInstanceChatRuntimeState(state, {
          instanceId,
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        }),
      }));

      if (
        shouldUseGatewayInstanceSessionStore({
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        })
      ) {
        return openClawGatewaySessions.startNewSession({
          instanceId,
          agentId: options?.agentId,
          model: requestedModel,
        });
      }

      if (routeMode === 'unsupported' || !resolvedContext.adapterResolution?.capabilities.supported) {
        const nextError = buildUnsupportedChatRouteError(
          resolvedContext.reason ?? resolvedContext.adapterResolution?.capabilities.reason ?? undefined,
        );
        openClawGatewaySessions.releaseInstance(instanceId);
        set((state) => clearChatInstanceScopeState(state, instanceId, { lastError: nextError }));
        return null;
      }

      openClawGatewaySessions.releaseInstance(instanceId);
    }

    return get().createSession(model, instanceId, {
      agentId: options?.agentId,
      agentLabel: options?.agentLabel,
    });
  },
  async deleteSession(id, instanceId) {
    const session = get().sessions.find((item) => item.id === id);
    const resolvedInstanceId = instanceId ?? session?.instanceId;
    const scopeKey = getScopeKey(resolvedInstanceId);

    if (isGatewayAuthoritativeStoredSession(session) && resolvedInstanceId) {
      const resolvedContext = await resolveInstanceChatContext(resolvedInstanceId);
      const routeMode = resolvedContext.mode;
      set((state) => ({
        ...applyInstanceChatRuntimeState(state, {
          instanceId: resolvedInstanceId,
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        }),
      }));

      if (
        shouldUseGatewayInstanceSessionStore({
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
          session,
        })
      ) {
        await openClawGatewaySessions.deleteSession({
          instanceId: resolvedInstanceId,
          sessionId: id,
        });
        clearDeletedChatSessionPreferences({
          sessionId: id,
          instanceId: resolvedInstanceId,
        });
        return;
      }

      openClawGatewaySessions.releaseInstance(resolvedInstanceId);

      if (routeMode === 'unsupported' || !resolvedContext.adapterResolution?.capabilities.supported) {
        set((state) =>
          clearChatInstanceScopeState(state, resolvedInstanceId, {
            lastError: buildUnsupportedChatRouteError(
              resolvedContext.reason ?? resolvedContext.adapterResolution?.capabilities.reason ?? undefined,
            ),
          }),
        );
        return;
      }

      set((state) => applyAdapterInstanceScopeState(state, resolvedInstanceId));
      return;
    }

    if (resolvedInstanceId) {
      const resolvedContext = await resolveInstanceChatContext(resolvedInstanceId);
      const routeMode = resolvedContext.mode;
      set((state) => ({
        ...applyInstanceChatRuntimeState(state, {
          instanceId: resolvedInstanceId,
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        }),
      }));

      if (routeMode === 'unsupported' || !resolvedContext.adapterResolution?.capabilities.supported) {
        openClawGatewaySessions.releaseInstance(resolvedInstanceId);
        set((state) =>
          clearChatInstanceScopeState(state, resolvedInstanceId, {
            lastError: buildUnsupportedChatRouteError(
              resolvedContext.reason ?? resolvedContext.adapterResolution?.capabilities.reason ?? undefined,
            ),
          }),
        );
        return;
      }

      if (
        !shouldUseGatewayInstanceSessionStore({
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        })
      ) {
        openClawGatewaySessions.releaseInstance(resolvedInstanceId);
        if (resolvedContext.adapterResolution.adapter.deleteSession) {
          await resolvedContext.adapterResolution.adapter.deleteSession(
            resolvedInstanceId,
            id,
          );
        }
        set((state) => {
          const nextSessions = state.sessions.filter((item) => item.id !== id);
          const nextAdapterSessions = listScopeAdapterSessions(nextSessions, resolvedInstanceId);
          return applyAdapterInstanceScopeState(state, resolvedInstanceId, {
            baseSessions: nextSessions,
            preservedAdapterSessions: nextAdapterSessions,
          });
        });
        if (isStudioConversationPersistableSession(session)) {
          void deleteStudioConversationSession({
            set,
            sessionId: id,
            instanceId: resolvedInstanceId,
          });
        }
        clearDeletedChatSessionPreferences({
          sessionId: id,
          instanceId: resolvedInstanceId,
        });
        return;
      }
    }

    set((state) => {
      const nextSessions = state.sessions.filter((item) => item.id !== id);
      const nextScopeSessions = listScopeSessions(nextSessions, resolvedInstanceId);
      const currentActiveSessionId = state.activeSessionIdByInstance[scopeKey] ?? null;

      return {
        sessions: nextSessions,
        activeSessionIdByInstance: {
          ...state.activeSessionIdByInstance,
          [scopeKey]:
            currentActiveSessionId === id ? nextScopeSessions[0]?.id ?? null : currentActiveSessionId,
        },
      };
    });

    if (isStudioConversationPersistableSession(session)) {
      void deleteStudioConversationSession({
        set,
        sessionId: id,
        instanceId: resolvedInstanceId,
      });
    }

    clearDeletedChatSessionPreferences({
      sessionId: id,
      instanceId: resolvedInstanceId,
    });
  },
  async setActiveSession(id, instanceId) {
    const resolvedInstanceId =
      instanceId ?? get().sessions.find((session) => session.id === id)?.instanceId ?? null;
    if (resolvedInstanceId) {
      const selectionToken = createLatestOperationToken(
        activeSessionSelectionRevisionByInstance,
        resolvedInstanceId,
      );
      const scopeKey = getScopeKey(resolvedInstanceId);
      const resolvedContext = await resolveInstanceChatContext(resolvedInstanceId);
      if (
        !isLatestOperationToken(activeSessionSelectionRevisionByInstance, selectionToken)
      ) {
        return;
      }
      const routeMode = resolvedContext.mode;
      const preservedAdapterSessions = listScopeAdapterSessions(get().sessions, resolvedInstanceId);

      set((state) => ({
        ...applyInstanceChatRuntimeState(state, {
          instanceId: resolvedInstanceId,
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        }),
      }));

      if (
        shouldUseGatewayInstanceSessionStore({
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        })
      ) {
        await openClawGatewaySessions.setActiveSession({
          instanceId: resolvedInstanceId,
          sessionId: id,
        });
        return;
      }

      openClawGatewaySessions.releaseInstance(resolvedInstanceId);

      if (routeMode === 'unsupported' || !resolvedContext.adapterResolution?.capabilities.supported) {
        set((state) =>
          clearChatInstanceScopeState(state, resolvedInstanceId, {
            lastError: buildUnsupportedChatRouteError(
              resolvedContext.reason ?? resolvedContext.adapterResolution?.capabilities.reason ?? undefined,
            ),
          }),
        );
        return;
      }

      if (id && resolvedContext.adapterResolution.adapter.loadMessages) {
        set((state) =>
          applyAuthoritativeSessionHistoryState(state, {
            instanceId: resolvedInstanceId,
            sessionId: id,
            historyState: 'loading',
            syncState: 'loading',
            lastError: undefined,
          }),
        );

        try {
          const authoritativeProjection =
            await loadAuthoritativeKernelSessionProjection({
              instanceId: resolvedInstanceId,
              sessionId: id,
              adapterResolution: resolvedContext.adapterResolution,
            });
          const isLatestSelection = isLatestOperationToken(
            activeSessionSelectionRevisionByInstance,
            selectionToken,
          );

          set((state) =>
            applyAuthoritativeKernelSessionProjectionState(state, {
              instanceId: resolvedInstanceId,
              sessionId: id,
              kernelSession: authoritativeProjection.kernelSession,
              kernelMessages: authoritativeProjection.kernelMessages,
              kernelRuns: authoritativeProjection.kernelRuns,
              preferredActiveSessionId: isLatestSelection
                ? id
                : state.activeSessionIdByInstance[scopeKey] ?? null,
              syncState: isLatestSelection
                ? 'idle'
                : state.syncStateByInstance[scopeKey] ?? 'idle',
              lastError: isLatestSelection
                ? undefined
                : state.lastErrorByInstance[scopeKey],
            }),
          );
          if (isLatestSelection && id) {
            void persistStudioConversationSession({
              get,
              set,
              sessionId: id,
            });
          }
          return;
        } catch (error: any) {
          const isLatestSelection = isLatestOperationToken(
            activeSessionSelectionRevisionByInstance,
            selectionToken,
          );
          if (isLatestSelection) {
            console.error('Failed to hydrate authoritative kernel chat session:', error);
          }
          set((state) =>
            applyAuthoritativeSessionHistoryState(state, {
              instanceId: resolvedInstanceId,
              sessionId: id,
              historyState: 'error',
              preferredActiveSessionId: isLatestSelection
                ? id
                : state.activeSessionIdByInstance[scopeKey] ?? null,
              syncState: isLatestSelection
                ? 'error'
                : state.syncStateByInstance[scopeKey] ?? 'idle',
              lastError: isLatestSelection
                ? error?.message || 'Failed to hydrate authoritative kernel chat session'
                : state.lastErrorByInstance[scopeKey],
            }),
          );
          return;
        }
      }

      set((state) =>
        applyAdapterInstanceScopeState(state, resolvedInstanceId, {
          preservedAdapterSessions,
          preferredActiveSessionId: id,
        }),
      );
      if (id) {
        void persistStudioConversationSession({
          get,
          set,
          sessionId: id,
        });
      }
      return;
    }

    set((state) => ({
      sessions: markDirectScopeSessionSeen(state.sessions, id),
      activeSessionIdByInstance: {
        ...state.activeSessionIdByInstance,
        [getScopeKey(resolvedInstanceId)]: id,
      },
    }));
    if (id) {
      void persistStudioConversationSession({
        get,
        set,
        sessionId: id,
      });
    }
  },
  addMessage(sessionId, message) {
    let nextSession: ChatSession | undefined;

    set((state) => {
      const timestamp = Date.now();
      const sessions = state.sessions.map((session) => {
        if (session.id !== sessionId) {
          return normalizeSession(session);
        }

        if (isGatewayAuthoritativeStoredSession(session)) {
          return normalizeSession(session);
        }

        const currentMessages = normalizeMessages(session.messages);
        const nextMessage: Message = {
          ...message,
          id: createId('msg'),
          timestamp,
          attachments: cloneAttachments(message.attachments),
        };
        const nextTitle =
          currentMessages.length === 0 && message.role === 'user'
            ? resolveInitialChatSessionTitle({
                existingTitle: session.title,
                text: message.content,
                attachments: message.attachments ?? [],
                isFirstUserMessage: true,
              })
            : session.title;

        nextSession = {
          ...normalizeSession(session),
          title: nextTitle,
          updatedAt: timestamp,
          messages: [...currentMessages, nextMessage],
        };
        nextSession =
          state.activeSessionIdByInstance[getScopeKey(session.instanceId)] === sessionId
            ? markChatSessionSeen(nextSession)
            : normalizeSession(nextSession);

        return nextSession;
      });

      const nextSessions = sortSessions(sessions);
      if (!nextSession?.instanceId) {
        return {
          sessions: nextSessions,
        };
      }

      const scopeKey = getScopeKey(nextSession.instanceId);
      const nextAdapterSessions = listScopeAdapterSessions(nextSessions, nextSession.instanceId);
      return {
        ...applyAdapterInstanceScopeState(state, nextSession.instanceId, {
          baseSessions: nextSessions,
          preservedAdapterSessions: nextAdapterSessions,
          syncState: state.syncStateByInstance[scopeKey] ?? 'idle',
          lastError: state.lastErrorByInstance[scopeKey],
        }),
      };
    });

    if (!nextSession) {
      return;
    }

    void persistStudioConversationSession({
      get,
      set,
      sessionId,
    });
  },
  updateMessage(sessionId, messageId, content) {
    let updatedDirectSession = false;

    set((state) => {
      const timestamp = Date.now();
      let updatedInstanceId: string | null | undefined;
      const sessions = state.sessions.map((session) => {
        if (session.id === sessionId && !isGatewayAuthoritativeStoredSession(session)) {
          updatedInstanceId = session.instanceId;
          updatedDirectSession = !session.instanceId;
          const nextSession = {
            ...normalizeSession(session),
            updatedAt: timestamp,
            messages: normalizeMessages(session.messages).map((message) =>
              message.id === messageId ? { ...message, content, timestamp } : message,
            ),
          } as ChatSession;
          return state.activeSessionIdByInstance[getScopeKey(session.instanceId)] === sessionId
            ? markChatSessionSeen(nextSession)
            : normalizeSession(nextSession);
        }

        return normalizeSession(session);
      });

      const nextSessions = sortSessions(sessions);
      if (!updatedInstanceId) {
        return {
          sessions: nextSessions,
        };
      }

      const scopeKey = getScopeKey(updatedInstanceId);
      const nextAdapterSessions = listScopeAdapterSessions(nextSessions, updatedInstanceId);
      return {
        ...applyAdapterInstanceScopeState(state, updatedInstanceId, {
          baseSessions: nextSessions,
          preservedAdapterSessions: nextAdapterSessions,
          syncState: state.syncStateByInstance[scopeKey] ?? 'idle',
          lastError: state.lastErrorByInstance[scopeKey],
        }),
      };
    });

    if (updatedDirectSession || get().sessions.some((session) => session.id === sessionId)) {
      void persistStudioConversationSession({
        get,
        set,
        sessionId,
      });
    }
  },
  removeMessages(sessionId, messageIds) {
    if (messageIds.length === 0) {
      return;
    }

    const removedMessageIds = new Set(messageIds);
    let updatedDirectSession = false;
    set((state) => {
      const timestamp = Date.now();
      let updatedInstanceId: string | null | undefined;
      const sessions = state.sessions.map((session) => {
        if (session.id !== sessionId || isGatewayAuthoritativeStoredSession(session)) {
          return normalizeSession(session);
        }

        const currentMessages = normalizeMessages(session.messages);
        const nextMessages = currentMessages.filter((message) => !removedMessageIds.has(message.id));
        if (nextMessages.length === currentMessages.length) {
          return normalizeSession(session);
        }

        updatedInstanceId = session.instanceId;
        updatedDirectSession = !session.instanceId;
        const nextSession = {
          ...session,
          title: nextMessages.length === 0 ? DEFAULT_TITLE : session.title,
          updatedAt: timestamp,
          messages: nextMessages,
        } satisfies ChatSession;
        return state.activeSessionIdByInstance[getScopeKey(session.instanceId)] === sessionId
          ? markChatSessionSeen(nextSession)
          : normalizeSession(nextSession);
      });

      const nextSessions = sortSessions(sessions);
      if (!updatedInstanceId) {
        return {
          sessions: nextSessions,
        };
      }

      const scopeKey = getScopeKey(updatedInstanceId);
      const nextAdapterSessions = listScopeAdapterSessions(nextSessions, updatedInstanceId);
      return {
        ...applyAdapterInstanceScopeState(state, updatedInstanceId, {
          baseSessions: nextSessions,
          preservedAdapterSessions: nextAdapterSessions,
          syncState: state.syncStateByInstance[scopeKey] ?? 'idle',
          lastError: state.lastErrorByInstance[scopeKey],
        }),
      };
    });

    if (updatedDirectSession || get().sessions.some((session) => session.id === sessionId)) {
      void persistStudioConversationSession({
        get,
        set,
        sessionId,
      });
    }
  },
  async clearSession(id, instanceId) {
    const session = get().sessions.find((item) => item.id === id);
    const resolvedInstanceId = instanceId ?? session?.instanceId;
    if (isGatewayAuthoritativeStoredSession(session) && resolvedInstanceId) {
      const resolvedContext = await resolveInstanceChatContext(resolvedInstanceId);
      const routeMode = resolvedContext.mode;
      set((state) => ({
        ...applyInstanceChatRuntimeState(state, {
          instanceId: resolvedInstanceId,
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        }),
      }));

      if (
        shouldUseGatewayInstanceSessionStore({
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
          session,
        })
      ) {
        await openClawGatewaySessions.resetSession({
          instanceId: resolvedInstanceId,
          sessionId: id,
        });
        return;
      }

      openClawGatewaySessions.releaseInstance(resolvedInstanceId);

      if (routeMode === 'unsupported' || !resolvedContext.adapterResolution?.capabilities.supported) {
        set((state) =>
          clearChatInstanceScopeState(state, resolvedInstanceId, {
            lastError: buildUnsupportedChatRouteError(
              resolvedContext.reason ??
                resolvedContext.adapterResolution?.capabilities.reason ??
                undefined,
            ),
          }),
        );
        return;
      }

      set((state) => applyAdapterInstanceScopeState(state, resolvedInstanceId));
      return;
    }
    let cleared: ChatSession | undefined;

    set((state) => {
      const nextSessions = state.sessions.map((currentSession) => {
        if (currentSession.id !== id) {
          return normalizeSession(currentSession);
        }

        cleared = {
          ...normalizeSession(currentSession),
          messages: [],
          updatedAt: Date.now(),
          lastMessagePreview: undefined,
        };
        cleared =
          state.activeSessionIdByInstance[getScopeKey(currentSession.instanceId)] === id
            ? markChatSessionSeen(cleared)
            : normalizeSession(cleared);
        return cleared;
      });

      if (!resolvedInstanceId || !cleared) {
        return {
          sessions: nextSessions,
        };
      }

      const localScopeKey = getScopeKey(resolvedInstanceId);
      const nextAdapterSessions = listScopeAdapterSessions(nextSessions, resolvedInstanceId);
      return applyAdapterInstanceScopeState(state, resolvedInstanceId, {
        baseSessions: nextSessions,
        preservedAdapterSessions: nextAdapterSessions,
        preferredActiveSessionId: id,
        syncState: state.syncStateByInstance[localScopeKey] ?? 'idle',
        lastError: state.lastErrorByInstance[localScopeKey],
      });
    });

    if (!cleared) {
      return;
    }

    void persistStudioConversationSession({
      get,
      set,
      sessionId: cleared.id,
    });
  },
  async flushSession(id) {
    const session = get().sessions.find((item) => item.id === id);
    if (!session || isGatewayAuthoritativeStoredSession(session)) {
      return;
    }

    const scopeKey = getScopeKey(session.instanceId);

    if (isStudioConversationPersistableSession(session)) {
      await persistStudioConversationSession({
        get,
        set,
        sessionId: id,
      });
      if (!session.instanceId || shouldUseStudioConversationFallbackStore(get().instanceChatAdapterCapabilitiesById[session.instanceId] ?? null)) {
        return;
      }
    }

    const sessionInstanceId = session.instanceId;
    if (!sessionInstanceId) {
      return;
    }
    const projectionToken = createLatestOperationToken(
      authoritativeSessionProjectionRevisionByKey,
      buildInstanceSessionOperationKey(sessionInstanceId, session.id),
    );

    try {
      const resolvedContext = await resolveInstanceChatContext(sessionInstanceId);
      if (
        !isLatestOperationToken(authoritativeSessionProjectionRevisionByKey, projectionToken)
      ) {
        return;
      }
      const routeMode = resolvedContext.mode;
      set((state) => ({
        ...applyInstanceChatRuntimeState(state, {
          instanceId: sessionInstanceId,
          routeMode,
          adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        }),
      }));

      if (
        routeMode === 'unsupported' ||
        !resolvedContext.adapterResolution?.capabilities.supported
      ) {
        openClawGatewaySessions.releaseInstance(sessionInstanceId);
        set((state) =>
          clearChatInstanceScopeState(state, sessionInstanceId, {
            lastError: buildUnsupportedChatRouteError(
              resolvedContext.reason ??
                resolvedContext.adapterResolution?.capabilities.reason ??
                undefined,
            ),
          }),
        );
        return;
      }

      openClawGatewaySessions.releaseInstance(sessionInstanceId);

      if (resolvedContext.adapterResolution.adapter.loadMessages) {
        set((state) =>
          applyAuthoritativeSessionHistoryState(state, {
            instanceId: sessionInstanceId,
            sessionId: session.id,
            historyState: 'loading',
            syncState: 'loading',
            lastError: undefined,
          }),
        );

        const authoritativeProjection =
          await loadAuthoritativeKernelSessionProjection({
            instanceId: sessionInstanceId,
            sessionId: session.id,
            adapterResolution: resolvedContext.adapterResolution,
          });
        if (
          !isLatestOperationToken(authoritativeSessionProjectionRevisionByKey, projectionToken)
        ) {
          return;
        }

        set((state) => {
          const existingSession = state.sessions.find(
            (candidate) =>
              candidate.id === session.id &&
              candidate.instanceId === sessionInstanceId,
          );
          if (!existingSession) {
            const nextAdapterSessions = listScopeAdapterSessions(
              state.sessions,
              sessionInstanceId,
            );
            return applyAdapterInstanceScopeState(state, sessionInstanceId, {
              preservedAdapterSessions: nextAdapterSessions,
              preferredActiveSessionId: session.id,
              syncState: 'idle',
              lastError: undefined,
            });
          }

          const nextSessions = sortSessions(
            state.sessions.map((candidate) =>
              candidate.id === session.id &&
              candidate.instanceId === sessionInstanceId
                ? applyAuthoritativeKernelSessionMessages({
                    instanceId: sessionInstanceId,
                    existingSession: normalizeSession(existingSession),
                    kernelSession: authoritativeProjection.kernelSession,
                    kernelMessages: authoritativeProjection.kernelMessages,
                    kernelRuns: authoritativeProjection.kernelRuns,
                  })
                : normalizeSession(candidate),
            ),
          );
          const nextAdapterSessions = listScopeAdapterSessions(
            nextSessions,
            sessionInstanceId,
          );

          return applyAdapterInstanceScopeState(state, sessionInstanceId, {
            baseSessions: nextSessions,
            preservedAdapterSessions: nextAdapterSessions,
            preferredActiveSessionId: session.id,
            syncState: 'idle',
            lastError: undefined,
          });
        });
        return;
      }

      set((state) => {
        const nextAdapterSessions = listScopeAdapterSessions(state.sessions, sessionInstanceId);
        return applyAdapterInstanceScopeState(state, sessionInstanceId, {
          preservedAdapterSessions: nextAdapterSessions,
          preferredActiveSessionId: session.id,
          syncState: 'idle',
          lastError: undefined,
        });
      });
    } catch (error: any) {
      if (
        !isLatestOperationToken(authoritativeSessionProjectionRevisionByKey, projectionToken)
      ) {
        return;
      }
      console.error('Failed to flush conversation:', error);
      set((state) =>
        applyAuthoritativeSessionHistoryState(state, {
          instanceId: sessionInstanceId,
          sessionId: session.id,
          historyState: 'error',
          syncState: 'error',
          lastError: error?.message || 'Failed to flush conversation',
        }),
      );
    }
  },
  async setKernelSessionModel(params) {
    const mutationToken = createLatestOperationToken(
      authoritativeSessionProjectionRevisionByKey,
      buildInstanceSessionOperationKey(params.instanceId, params.sessionId),
    );
    await mutateAuthoritativeKernelSession({
      set,
      get,
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      mutationToken,
      patch: {
        model: params.model,
      },
      gatewayMutation: async () => {
        await openClawGatewaySessions.setSessionModel(params);
      },
      logErrorMessage: 'Failed to update kernel chat session model:',
      fallbackErrorMessage: 'Failed to update kernel chat session model',
    });
  },
  async setKernelSessionThinkingLevel(params) {
    const mutationToken = createLatestOperationToken(
      authoritativeSessionProjectionRevisionByKey,
      buildInstanceSessionOperationKey(params.instanceId, params.sessionId),
    );
    await mutateAuthoritativeKernelSession({
      set,
      get,
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      mutationToken,
      patch: {
        thinkingLevel: params.thinkingLevel,
      },
      gatewayMutation: async () => {
        await openClawGatewaySessions.setSessionThinkingLevel(params);
      },
      logErrorMessage: 'Failed to update kernel chat session thinking level:',
      fallbackErrorMessage: 'Failed to update kernel chat session thinking level',
    });
  },
  async setKernelSessionFastMode(params) {
    const mutationToken = createLatestOperationToken(
      authoritativeSessionProjectionRevisionByKey,
      buildInstanceSessionOperationKey(params.instanceId, params.sessionId),
    );
    await mutateAuthoritativeKernelSession({
      set,
      get,
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      mutationToken,
      patch: {
        fastMode: params.fastMode,
      },
      gatewayMutation: async () => {
        await openClawGatewaySessions.setSessionFastMode(params);
      },
      logErrorMessage: 'Failed to update kernel chat session fast mode:',
      fallbackErrorMessage: 'Failed to update kernel chat session fast mode',
    });
  },
  async setKernelSessionVerboseLevel(params) {
    const mutationToken = createLatestOperationToken(
      authoritativeSessionProjectionRevisionByKey,
      buildInstanceSessionOperationKey(params.instanceId, params.sessionId),
    );
    await mutateAuthoritativeKernelSession({
      set,
      get,
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      mutationToken,
      patch: {
        verboseLevel: params.verboseLevel,
      },
      gatewayMutation: async () => {
        await openClawGatewaySessions.setSessionVerboseLevel(params);
      },
      logErrorMessage: 'Failed to update kernel chat session verbose level:',
      fallbackErrorMessage: 'Failed to update kernel chat session verbose level',
    });
  },
  async setKernelSessionReasoningLevel(params) {
    const mutationToken = createLatestOperationToken(
      authoritativeSessionProjectionRevisionByKey,
      buildInstanceSessionOperationKey(params.instanceId, params.sessionId),
    );
    await mutateAuthoritativeKernelSession({
      set,
      get,
      instanceId: params.instanceId,
      sessionId: params.sessionId,
      mutationToken,
      patch: {
        reasoningLevel: params.reasoningLevel,
      },
      gatewayMutation: async () => {
        await openClawGatewaySessions.setSessionReasoningLevel(params);
      },
      logErrorMessage: 'Failed to update kernel chat session reasoning level:',
      fallbackErrorMessage: 'Failed to update kernel chat session reasoning level',
    });
  },
  async sendKernelMessage(params) {
    const scopeKey = getScopeKey(params.instanceId);
    const projectionToken = createLatestOperationToken(
      authoritativeSessionProjectionRevisionByKey,
      buildInstanceSessionOperationKey(params.instanceId, params.sessionId),
    );
    const resolvedContext = await resolveInstanceChatContext(params.instanceId);
    const routeMode = resolvedContext.mode;
    const outgoingAttachments = cloneAttachments(params.attachments) ?? [];
    const explicitRequestText = params.requestText?.trim() || null;
    const outgoingContent =
      explicitRequestText ||
      (outgoingAttachments.length > 0
        ? composeOutgoingChatText(params.content, outgoingAttachments)
        : params.content);
    set((state) => ({
      ...applyInstanceChatRuntimeState(state, {
        instanceId: params.instanceId,
        routeMode,
        adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
      }),
    }));

    if (!outgoingContent.trim()) {
      const errorMessage = 'Cannot send an empty chat message.';
      set((state) => ({
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [scopeKey]: errorMessage,
        },
      }));
      throw new Error(errorMessage);
    }

    if (
      shouldUseGatewayInstanceSessionStore({
        routeMode,
        adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        session:
          get().sessions.find(
            (session) =>
              session.id === params.sessionId && session.instanceId === params.instanceId,
          ) ?? null,
      })
    ) {
      return openClawGatewaySessions.sendMessage({
        ...params,
        attachments: outgoingAttachments,
        ...(explicitRequestText || outgoingAttachments.length > 0
          ? { requestText: outgoingContent }
          : {}),
      });
    }

    openClawGatewaySessions.releaseInstance(params.instanceId);

    if (
      routeMode === 'unsupported' ||
      !resolvedContext.adapterResolution?.capabilities.supported ||
      !resolvedContext.adapterResolution.adapter.startRun
    ) {
      const nextError = buildUnsupportedChatRouteError(
        resolvedContext.reason ?? resolvedContext.adapterResolution?.capabilities.reason ?? undefined,
      );
      const errorTimestamp = Date.now();
      set((state) => ({
        ...appendAssistantErrorMessageToSessionState(state, {
          instanceId: params.instanceId,
          sessionId: params.sessionId,
          message: `Error: ${nextError}`,
          timestamp: errorTimestamp,
          syncState: 'error',
          lastError: nextError,
        }),
      }));
      void persistStudioConversationSession({
        get,
        set,
        sessionId: params.sessionId,
      });
      throw new Error(nextError);
    }

    set((state) => ({
      syncStateByInstance: {
        ...state.syncStateByInstance,
        [scopeKey]: 'loading',
      },
      lastErrorByInstance: {
        ...state.lastErrorByInstance,
        [scopeKey]: undefined,
      },
    }));

    try {
      const kernelRun = await resolvedContext.adapterResolution.adapter.startRun({
        instanceId: params.instanceId,
        sessionId: params.sessionId,
        content: outgoingContent,
        model: params.model ?? null,
      });
      const authoritativeProjection =
        await loadAuthoritativeKernelSessionProjection({
          instanceId: params.instanceId,
          sessionId: params.sessionId,
          adapterResolution: resolvedContext.adapterResolution,
        });
      if (
        !isLatestOperationToken(authoritativeSessionProjectionRevisionByKey, projectionToken)
      ) {
        return {
          runId: kernelRun.id,
        };
      }

      set((state) =>
        applyAuthoritativeKernelSessionProjectionState(state, {
          instanceId: params.instanceId,
          sessionId: params.sessionId,
          kernelSession: authoritativeProjection.kernelSession,
          kernelMessages: authoritativeProjection.kernelMessages,
          kernelRuns: authoritativeProjection.kernelRuns,
          syncState: 'idle',
          lastError: undefined,
        }),
      );

      return {
        runId: kernelRun.id,
      };
    } catch (error: any) {
      if (
        !isLatestOperationToken(authoritativeSessionProjectionRevisionByKey, projectionToken)
      ) {
        throw error;
      }
      const nextError =
        error?.message || 'Failed to send authoritative kernel chat message';
      const errorTimestamp = Date.now();
      console.error('Failed to send authoritative kernel chat message:', error);
      set((state) => ({
        ...appendAssistantErrorMessageToSessionState(state, {
          instanceId: params.instanceId,
          sessionId: params.sessionId,
          message: `Error: ${nextError}`,
          timestamp: errorTimestamp,
          syncState: 'error',
          lastError: nextError,
        }),
      }));
      void persistStudioConversationSession({
        get,
        set,
        sessionId: params.sessionId,
      });
      throw error;
    }
  },
  async abortSession(params) {
    const scopeKey = getScopeKey(params.instanceId);
    const projectionToken = createLatestOperationToken(
      authoritativeSessionProjectionRevisionByKey,
      buildInstanceSessionOperationKey(params.instanceId, params.sessionId),
    );
    const resolvedContext = await resolveInstanceChatContext(params.instanceId);
    const routeMode = resolvedContext.mode;
    const session =
      get().sessions.find(
        (candidate) =>
          candidate.id === params.sessionId &&
          candidate.instanceId === params.instanceId,
      ) ?? null;
    set((state) => ({
      ...applyInstanceChatRuntimeState(state, {
        instanceId: params.instanceId,
        routeMode,
        adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
      }),
    }));

    if (
      shouldUseGatewayInstanceSessionStore({
        routeMode,
        adapterCapabilities: resolvedContext.adapterResolution?.capabilities ?? null,
        session,
      })
    ) {
      return openClawGatewaySessions.abortRun(params);
    }

    openClawGatewaySessions.releaseInstance(params.instanceId);

    if (
      routeMode === 'unsupported' ||
      !resolvedContext.adapterResolution?.capabilities.supported ||
      !resolvedContext.adapterResolution.adapter.abortRun
    ) {
      if (routeMode === 'unsupported' || !resolvedContext.adapterResolution?.capabilities.supported) {
        const nextError = buildUnsupportedChatRouteError(
          resolvedContext.reason ?? resolvedContext.adapterResolution?.capabilities.reason ?? undefined,
        );
        set((state) =>
          clearChatInstanceScopeState(state, params.instanceId, {
            lastError: nextError,
          }),
        );
      }
      return false;
    }

    try {
      const aborted = await resolvedContext.adapterResolution.adapter.abortRun(
        params.instanceId,
        params.sessionId,
        session?.kernelSession?.activeRunId ?? session?.runId ?? null,
      );

      if (!aborted) {
        return false;
      }

      if (
        resolvedContext.adapterResolution.adapter.getSession ||
        resolvedContext.adapterResolution.adapter.loadMessages
      ) {
        const authoritativeProjection =
          await loadAuthoritativeKernelSessionProjection({
            instanceId: params.instanceId,
            sessionId: params.sessionId,
            adapterResolution: resolvedContext.adapterResolution,
          });
        if (
          !isLatestOperationToken(authoritativeSessionProjectionRevisionByKey, projectionToken)
        ) {
          return true;
        }
        set((state) =>
          applyAuthoritativeKernelSessionProjectionState(state, {
            instanceId: params.instanceId,
            sessionId: params.sessionId,
            kernelSession: authoritativeProjection.kernelSession,
            kernelMessages: authoritativeProjection.kernelMessages,
            kernelRuns: authoritativeProjection.kernelRuns,
            syncState: state.syncStateByInstance[scopeKey] ?? 'idle',
            lastError: undefined,
          }),
        );
      }

      return true;
    } catch (error: any) {
      if (
        !isLatestOperationToken(authoritativeSessionProjectionRevisionByKey, projectionToken)
      ) {
        return false;
      }
      console.error('Failed to abort authoritative kernel chat session:', error);
      set((state) => ({
        lastErrorByInstance: {
          ...state.lastErrorByInstance,
          [scopeKey]:
            error?.message || 'Failed to abort authoritative kernel chat session',
        },
      }));
      return false;
    }
  },
}));

openClawGatewaySessions.subscribe((instanceId, snapshot) => {
  chatStore.setState((state) => applyOpenClawSnapshot(state, instanceId, snapshot));
  queuePersistGatewaySnapshotMirror({
    instanceId,
    snapshot,
  });
});
