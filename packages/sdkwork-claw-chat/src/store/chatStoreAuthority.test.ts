import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type {
  ChatSession,
  Message,
} from './chatStore.ts';
import {
  createKernelChatAuthority,
  createKernelChatSessionRef,
  DEFAULT_BUNDLED_OPENCLAW_VERSION,
} from '@sdkwork/claw-types';
import type {
  KernelChatRun,
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/claw-infrastructure';
import { chatStore } from './chatStore.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

async function withCapturedConsoleError<T>(
  callback: (calls: unknown[][]) => Promise<T> | T,
): Promise<T> {
  const calls: unknown[][] = [];
  const originalConsoleError = console.error;

  console.error = ((...args: unknown[]) => {
    calls.push(args);
  }) as typeof console.error;

  try {
    return await callback(calls);
  } finally {
    console.error = originalConsoleError;
  }
}

function createGatewaySnapshotInstance(instanceId: string): StudioInstanceRecord {
  return {
    id: instanceId,
    name: 'Local Built-In Snapshot',
    description: 'Stale snapshot authority.',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
    typeLabel: 'Built-In OpenClaw',
    host: '127.0.0.1',
    port: 18797,
    baseUrl: 'http://127.0.0.1:18797/openclaw',
    websocketUrl: 'ws://127.0.0.1:18797/openclaw/ws',
    cpu: 0,
    memory: 0,
    totalMemory: '0 GB',
    uptime: '0m',
    capabilities: ['chat'],
    storage: {
      provider: 'localFile',
      namespace: 'fixture',
    },
    config: {
      port: '18797',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18797/openclaw',
      websocketUrl: 'ws://127.0.0.1:18797/openclaw/ws',
      authToken: 'snapshot-token',
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
  };
}

function createStartingDetail(instanceId: string): StudioInstanceDetailRecord {
  return {
    instance: {
      ...createGatewaySnapshotInstance(instanceId),
      status: 'starting',
      baseUrl: null,
      websocketUrl: null,
      config: {
        ...createGatewaySnapshotInstance(instanceId).config,
        baseUrl: null,
        websocketUrl: null,
        authToken: 'detail-token',
      },
    },
    config: {
      ...createGatewaySnapshotInstance(instanceId).config,
      baseUrl: null,
      websocketUrl: null,
      authToken: 'detail-token',
    },
    logs: '',
    health: {
      score: 50,
      status: 'degraded',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'appManaged',
      startStopSupported: true,
      configWritable: true,
      lifecycleControllable: true,
      workbenchManaged: true,
      endpointObserved: false,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: 'fixture',
      durable: true,
      queryable: false,
      transactional: false,
      remote: false,
    },
    connectivity: {
      primaryTransport: 'openclawGatewayWs',
      endpoints: [],
    },
    observability: {
      status: 'limited',
      logAvailable: true,
      logPreview: [],
      metricsSource: 'runtime',
      lastSeenAt: 1,
    },
    dataAccess: {
      routes: [],
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    consoleAccess: null,
    workbench: null,
  };
}

function createUnsupportedWsInstance(instanceId: string): StudioInstanceRecord {
  return {
    ...createGatewaySnapshotInstance(instanceId),
    name: 'Unsupported Gateway Snapshot',
    runtimeKind: 'custom',
    deploymentMode: 'remote',
    transportKind: 'customWs',
    status: 'online',
    baseUrl: null,
    websocketUrl: null,
    config: {
      ...createGatewaySnapshotInstance(instanceId).config,
      baseUrl: null,
      websocketUrl: null,
      authToken: undefined,
    },
  };
}

function createSupportedHttpInstance(instanceId: string): StudioInstanceRecord {
  return {
    ...createGatewaySnapshotInstance(instanceId),
    name: 'Supported HTTP Instance',
    runtimeKind: 'custom',
    deploymentMode: 'remote',
    transportKind: 'customHttp',
    status: 'online',
    baseUrl: 'https://chat.example.com',
    websocketUrl: null,
    config: {
      ...createGatewaySnapshotInstance(instanceId).config,
      baseUrl: 'https://chat.example.com',
      websocketUrl: null,
      authToken: undefined,
    },
  };
}

function createSupportedHermesHttpInstance(instanceId: string): StudioInstanceRecord {
  return {
    ...createSupportedHttpInstance(instanceId),
    name: 'Supported Hermes HTTP Instance',
    runtimeKind: 'hermes',
    typeLabel: 'Hermes Agent',
  };
}

function createLocalManagedHermesInstance(instanceId: string): StudioInstanceRecord {
  return {
    ...createSupportedHermesHttpInstance(instanceId),
    name: 'Local Managed Hermes Instance',
    deploymentMode: 'local-managed',
    baseUrl: 'http://127.0.0.1:19540',
    config: {
      ...createSupportedHermesHttpInstance(instanceId).config,
      baseUrl: 'http://127.0.0.1:19540',
    },
  };
}

function createAuthoritativeHermesKernelSession(input: {
  instanceId: string;
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessagePreview?: string | null;
}) {
  return {
    ref: createKernelChatSessionRef({
      kernelId: 'hermes',
      instanceId: input.instanceId,
      sessionId: input.sessionId,
    }),
    authority: createKernelChatAuthority({
      kind: 'sqlite',
    }),
    lifecycle: input.messageCount > 0 ? ('ready' as const) : ('draft' as const),
    title: input.title,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    messageCount: input.messageCount,
    lastMessagePreview: input.lastMessagePreview ?? null,
    sessionKind: 'authoritative',
  };
}

function createAuthoritativeHermesKernelMessage(input: {
  sessionRef: ReturnType<typeof createKernelChatSessionRef>;
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}) {
  return {
    id: input.id,
    sessionRef: input.sessionRef,
    role: input.role,
    status: 'complete' as const,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    text: input.text,
    parts: [
      {
        kind: 'text' as const,
        text: input.text,
      },
    ],
  };
}

function createAuthoritativeHermesKernelRun(input: {
  sessionRef: ReturnType<typeof createKernelChatSessionRef>;
  id: string;
  status: KernelChatRun['status'];
  createdAt: number;
  updatedAt?: number;
}) {
  return {
    id: input.id,
    sessionRef: input.sessionRef,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    abortable: input.status === 'running',
  };
}

function createTransportBackedSession(input: {
  id: string;
  instanceId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model?: string;
  messages?: Message[];
}): ChatSession {
  const messages = input.messages ?? [];
  const model = input.model ?? 'gpt-4.1';

  return {
    id: input.id,
    title: input.title,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    messages,
    model,
    instanceId: input.instanceId,
    transport: 'kernelAdapter',
    kernelSession: {
      ref: createKernelChatSessionRef({
        kernelId: 'custom',
        instanceId: input.instanceId,
        sessionId: input.id,
      }),
      authority: createKernelChatAuthority({
        kind: 'http',
        durable: false,
      }),
      lifecycle: messages.length === 0 ? 'draft' : 'ready',
      title: input.title,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      messageCount: messages.length,
      sessionKind: 'transport',
      modelBinding: {
        model,
        defaultModel: model,
      },
      activeRunId: null,
    },
  };
}

await runTest(
  'chatStore gateway authority branching does not depend on the openclawGateway adapter id literal',
  () => {
    const chatStoreSource = readFileSync(new URL('./chatStore.ts', import.meta.url), 'utf8');

    assert.match(chatStoreSource, /shouldUseGatewayAuthoritativeSessionStore/);
    assert.doesNotMatch(chatStoreSource, /adapterId === 'openclawGateway'/);
  },
);

await runTest(
  'chatStore clearSession re-resolves authoritative chat context and delegates gateway resets through authority semantics instead of raw route literals',
  () => {
    const chatStoreSource = readFileSync(new URL('./chatStore.ts', import.meta.url), 'utf8');

    assert.match(
      chatStoreSource,
      /async clearSession\(id, instanceId\) \{[\s\S]*const resolvedContext = await resolveInstanceChatContext\(resolvedInstanceId\);/s,
    );
    assert.doesNotMatch(
      chatStoreSource,
      /async clearSession\(id, instanceId\) \{[\s\S]*const resolvedRoute = await resolveInstanceRouteMode\(resolvedInstanceId\);/s,
    );
    assert.doesNotMatch(
      chatStoreSource,
      /async clearSession\(id, instanceId\) \{[\s\S]*if \(routeMode === 'instanceOpenClawGatewayWs'\) \{/s,
    );
  },
);

await runTest(
  'chatStore deleteSession delegates non-gateway session deletion through the shared authority helper instead of raw route inequality checks',
  () => {
    const chatStoreSource = readFileSync(new URL('./chatStore.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(
      chatStoreSource,
      /async deleteSession\(id, instanceId\) \{[\s\S]*if \(routeMode !== 'instanceOpenClawGatewayWs'\) \{/s,
    );
  },
);

await runTest(
  'chatStore session mutation guards route gateway-authoritative sessions through a shared helper instead of direct transport string checks',
  () => {
    const chatStoreSource = readFileSync(new URL('./chatStore.ts', import.meta.url), 'utf8');

    assert.match(chatStoreSource, /function isGatewayAuthoritativeStoredSession\(/);
    assert.doesNotMatch(
      chatStoreSource,
      /addMessage\(sessionId, message(?:, instanceId)?\) \{[\s\S]*session\.transport === 'openclawGateway'/s,
    );
    assert.doesNotMatch(
      chatStoreSource,
      /updateMessage\(sessionId, messageId, content(?:, instanceId(?:, options)?)?\) \{[\s\S]*session\.transport !== 'openclawGateway'/s,
    );
    assert.doesNotMatch(
      chatStoreSource,
      /async flushSession\(id(?:, instanceId)?\) \{[\s\S]*session\.transport === 'openclawGateway'/s,
    );
  },
);

await runTest(
  'chatStore connectGatewayInstances derives gateway route state transitions through the shared route helper instead of embedding the gateway route literal',
  () => {
    const chatStoreSource = readFileSync(new URL('./chatStore.ts', import.meta.url), 'utf8');

    assert.match(chatStoreSource, /isGatewayAuthoritativeRouteMode\(mode\)/);
    assert.doesNotMatch(
      chatStoreSource,
      /setRouteMode\(instanceId, mode\) \{[\s\S]*mode === 'instanceOpenClawGatewayWs'/s,
    );
  },
);

function resetChatStore() {
  chatStore.setState((state) => ({
    ...state,
    sessions: [],
    activeSessionIdByInstance: {},
    syncStateByInstance: {},
    gatewayConnectionStatusByInstance: {},
    lastErrorByInstance: {},
    instanceRouteModeById: {},
  }));
}

async function flushAsyncTasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

await runTest(
  'chatStore connectGatewayInstances uses instance detail authority before hydrating the built-in OpenClaw gateway',
  async () => {
    const instanceId = 'authority-mismatch-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createGatewaySnapshotInstance(requestedInstanceId);
        },
        async getInstanceDetail(requestedInstanceId) {
          return createStartingDetail(requestedInstanceId);
        },
      },
    });

    try {
      await chatStore.getState().connectGatewayInstances([instanceId]);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore createSession refuses unsupported instance routes instead of creating a fake local chat session',
  async () => {
    const instanceId = 'unsupported-chat-session-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().createSession(undefined, instanceId);
      const state = chatStore.getState();

      assert.equal(sessionId, '');
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.match(state.lastErrorByInstance[instanceId] ?? '', /supported chat route/i);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore hydrateInstance blocks unsupported instance routes from hydrating or retaining hidden local conversation snapshots',
  async () => {
    const instanceId = 'unsupported-chat-hydrate-instance';
    const originalBridge = getPlatformBridge();
    const listCalls: string[] = [];
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: 'stale-session-1',
          title: 'Stale hidden conversation',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: 'stale-session-1',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listConversations(requestedInstanceId) {
          listCalls.push(requestedInstanceId);
          return [
            {
              id: 'unexpected-session-1',
              title: 'Unexpected unsupported conversation',
              createdAt: 1,
              updatedAt: 1,
              model: 'gpt-4.1',
              messages: [],
              instanceId: requestedInstanceId,
            },
          ];
        },
      },
    });

    try {
      await chatStore.getState().hydrateInstance(instanceId);
      const state = chatStore.getState();

      assert.deepEqual(listCalls, []);
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId] ?? null, null);
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore hydrateInstance clears stale authoritative previews when kernel session metadata explicitly reports no preview',
  async () => {
    const instanceId = 'local-hermes-hydrate-empty-preview-instance';
    const sessionId = 'hermes-session-hydrate-empty-preview';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Authoritative Hermes Empty Preview Session',
      createdAt: 10,
      updatedAt: 40,
      messageCount: 0,
      lastMessagePreview: null,
    });
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Authoritative Hermes Empty Preview Session',
          createdAt: 10,
          updatedAt: 25,
          messages: [
            {
              id: 'projected-assistant-stale-1',
              role: 'assistant',
              content: 'stale cached reply',
              timestamp: 25,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: {
            ...kernelSession,
            updatedAt: 25,
            messageCount: 1,
            lastMessagePreview: 'stale cached reply',
          },
          lastMessagePreview: 'stale cached reply',
          historyState: 'ready',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: null,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listConversations() {
          throw new Error('listConversations is not a function');
        },
        async listKernelChatSessions(requestedInstanceId) {
          assert.equal(requestedInstanceId, instanceId);
          return [kernelSession];
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async startKernelChatRun() {
          return {
            id: 'hermes-run-hydrate-empty-preview-1',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 40,
            updatedAt: 40,
            abortable: false,
          };
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return [];
        },
      },
    });

    try {
      await chatStore.getState().hydrateInstance(instanceId);

      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
      assert.ok(session);
      assert.equal(session?.lastMessagePreview, undefined);
      assert.equal(session?.kernelSession?.lastMessagePreview ?? null, null);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore createSession clears stale unsupported scope sessions instead of returning a hidden active session id',
  async () => {
    const instanceId = 'unsupported-chat-create-stale-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: 'stale-session-create-1',
          title: 'Hidden stale conversation',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: 'stale-session-create-1',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().createSession(undefined, instanceId);
      const state = chatStore.getState();

      assert.equal(sessionId, '');
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId] ?? null, null);
      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.match(state.lastErrorByInstance[instanceId] ?? '', /supported chat route/i);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore startNewSession clears stale unsupported scope sessions instead of leaving hidden state behind',
  async () => {
    const instanceId = 'unsupported-chat-start-new-stale-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: 'stale-session-start-new-1',
          title: 'Hidden stale conversation',
          createdAt: 1,
          updatedAt: 1,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: 'stale-session-start-new-1',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().startNewSession(undefined, instanceId);
      const state = chatStore.getState();

      assert.equal(sessionId, null);
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId] ?? null, null);
      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.match(state.lastErrorByInstance[instanceId] ?? '', /supported chat route/i);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore createSession re-resolves authoritative routes instead of trusting a stale unsupported cache entry',
  async () => {
    const instanceId = 'stale-unsupported-create-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      instanceRouteModeById: {
        [instanceId]: 'unsupported',
      },
      lastErrorByInstance: {
        [instanceId]: 'This instance does not expose a supported chat route yet.',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().createSession('gpt-4.1', instanceId);
      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.ok(sessionId);
      assert.ok(session);
      assert.equal(session?.instanceId, instanceId);
      assert.equal(session?.transport, 'kernelAdapter');
      assert.equal(session?.kernelSession?.authority.kind, 'http');
      assert.equal(session?.kernelSession?.authority.durable, false);
      assert.equal(session?.kernelSession?.authority.source, 'kernel');
      assert.equal(session?.kernelSession?.ref.instanceId, instanceId);
      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore createSession on transport-backed routes drops stale gateway sessions while creating a new authoritative kernel adapter session',
  async () => {
    const instanceId = 'local-create-stale-gateway-scope-instance';
    const staleGatewaySessionId = 'gateway-session-create-stale';
    const existingLocalSessionId = 'local-session-existing';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        createTransportBackedSession({
          id: existingLocalSessionId,
          instanceId,
          title: 'Existing Local Session',
          createdAt: 1,
          updatedAt: 1,
        }),
      ],
      activeSessionIdByInstance: {
        [instanceId]: existingLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().createSession('gpt-4.1', instanceId);
      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);

      assert.ok(sessionId);
      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [
          { id: sessionId, transport: 'kernelAdapter' },
          { id: existingLocalSessionId, transport: 'kernelAdapter' },
        ],
      );
      const createdSession = scopedSessions.find((session) => session.id === sessionId);
      assert.ok(createdSession?.kernelSession);
      assert.equal(createdSession?.kernelSession?.authority.kind, 'http');
      assert.equal(createdSession?.kernelSession?.authority.source, 'kernel');
      assert.equal(createdSession?.kernelSession?.authority.durable, false);
      assert.equal(createdSession?.kernelSession?.ref.instanceId, instanceId);
      assert.equal(createdSession?.kernelSession?.ref.instanceId, instanceId);
      assert.equal(createdSession?.kernelSession?.lifecycle, 'draft');
      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore startNewSession re-resolves authoritative routes instead of trusting a stale unsupported cache entry',
  async () => {
    const instanceId = 'stale-unsupported-start-new-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      instanceRouteModeById: {
        [instanceId]: 'unsupported',
      },
      lastErrorByInstance: {
        [instanceId]: 'This instance does not expose a supported chat route yet.',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().startNewSession('gpt-4.1', instanceId);
      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.ok(sessionId);
      assert.ok(session);
      assert.equal(session?.instanceId, instanceId);
      assert.equal(session?.transport, 'kernelAdapter');
      assert.equal(session?.kernelSession?.authority.kind, 'http');
      assert.equal(session?.kernelSession?.authority.durable, false);
      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore createSession keeps Hermes HTTP runtimes chat-usable by projecting them through the transport-backed kernel adapter',
  async () => {
    const instanceId = 'supported-hermes-http-create-instance';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHermesHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      const sessionId = await chatStore.getState().createSession('gpt-4.1', instanceId);
      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.ok(sessionId);
      assert.ok(session);
      assert.equal(session?.instanceId, instanceId);
      assert.equal(session?.transport, 'kernelAdapter');
      assert.equal(session?.kernelSession?.ref.kernelId, 'hermes');
      assert.equal(session?.kernelSession?.authority.kind, 'http');
      assert.equal(session?.kernelSession?.authority.durable, false);
      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession re-resolves authoritative routes instead of trusting a stale gateway cache entry',
  async () => {
    const instanceId = 'stale-gateway-active-session-instance';
    const sessionId = 'local-session-1';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        createTransportBackedSession({
          id: sessionId,
          instanceId,
          title: 'Recovered HTTP Session',
          createdAt: 1,
          updatedAt: 2,
        }),
      ],
      activeSessionIdByInstance: {
        [instanceId]: null,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenClawGatewayWs',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(sessionId, instanceId);
      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.sessions.length, 1);
      assert.ok(session);
      assert.equal(session?.transport, 'kernelAdapter');
      assert.equal(session?.kernelSession?.authority.kind, 'http');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession preserves an explicit blank workspace for transport-backed instance scopes instead of falling back to a stale active session',
  async () => {
    const instanceId = 'transport-blank-workspace-instance';
    const sessionId = 'transport-session-1';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        createTransportBackedSession({
          id: sessionId,
          instanceId,
          title: 'Transport Session',
          createdAt: 1,
          updatedAt: 2,
        }),
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(null, instanceId);
      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId] ?? null, null);
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
      assert.equal(state.sessions.length, 1);
      assert.ok(session);
      assert.equal(session?.transport, 'kernelAdapter');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession clears stale unsupported scope sessions instead of keeping a hidden active session id',
  async () => {
    const instanceId = 'stale-unsupported-active-session-instance';
    const sessionId = 'local-session-unsupported';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Stale Unsupported Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'local',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: null,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(sessionId, instanceId);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.equal(state.activeSessionIdByInstance[instanceId], null);
      assert.equal(state.sessions.length, 0);
      assert.match(state.lastErrorByInstance[instanceId] ?? '', /supported chat route/i);
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore deleteSession re-resolves authoritative routes instead of deleting stale gateway sessions through the gateway store',
  async () => {
    const instanceId = 'stale-gateway-delete-session-instance';
    const sessionId = 'gateway-session-delete';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenClawGatewayWs',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().deleteSession(sessionId, instanceId);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], null);
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore clearSession re-resolves authoritative routes instead of resetting stale gateway sessions through the gateway store',
  async () => {
    const instanceId = 'stale-gateway-clear-session-instance';
    const sessionId = 'gateway-session-clear';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenClawGatewayWs',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().clearSession(sessionId, instanceId);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], null);
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore deleteSession clears stale unsupported gateway scope instead of failing through the gateway store',
  async () => {
    const instanceId = 'stale-gateway-delete-unsupported-instance';
    const sessionId = 'gateway-session-delete-unsupported';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Unsupported Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenClawGatewayWs',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createUnsupportedWsInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().deleteSession(sessionId, instanceId);
      const state = chatStore.getState();

      assert.equal(state.instanceRouteModeById[instanceId], 'unsupported');
      assert.equal(state.activeSessionIdByInstance[instanceId], null);
      assert.deepEqual(
        state.sessions.filter((session) => session.instanceId === instanceId),
        [],
      );
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.match(state.lastErrorByInstance[instanceId] ?? '', /supported chat route/i);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore deleteSession on transport-backed routes drops stale gateway sessions before choosing the next active kernel adapter session',
  async () => {
    const instanceId = 'local-delete-stale-gateway-fallback-instance';
    const activeLocalSessionId = 'local-session-active';
    const staleGatewaySessionId = 'gateway-session-stale';
    const backupLocalSessionId = 'local-session-backup';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        createTransportBackedSession({
          id: activeLocalSessionId,
          instanceId,
          title: 'Active Local Session',
          createdAt: 1,
          updatedAt: 3,
        }),
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        createTransportBackedSession({
          id: backupLocalSessionId,
          instanceId,
          title: 'Backup Local Session',
          createdAt: 1,
          updatedAt: 1,
        }),
      ],
      activeSessionIdByInstance: {
        [instanceId]: activeLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().deleteSession(activeLocalSessionId, instanceId);
      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], backupLocalSessionId);
      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [{ id: backupLocalSessionId, transport: 'kernelAdapter' }],
      );
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore clearSession on transport-backed routes drops stale gateway sessions while keeping the cleared kernel adapter session active',
  async () => {
    const instanceId = 'local-clear-stale-gateway-scope-instance';
    const activeLocalSessionId = 'local-session-clear-active';
    const staleGatewaySessionId = 'gateway-session-clear-stale';
    const backupLocalSessionId = 'local-session-clear-backup';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        createTransportBackedSession({
          id: activeLocalSessionId,
          instanceId,
          title: 'Active Local Session',
          createdAt: 1,
          updatedAt: 3,
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'hello',
              timestamp: 3,
            },
          ],
        }),
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        createTransportBackedSession({
          id: backupLocalSessionId,
          instanceId,
          title: 'Backup Local Session',
          createdAt: 1,
          updatedAt: 1,
        }),
      ],
      activeSessionIdByInstance: {
        [instanceId]: activeLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().clearSession(activeLocalSessionId, instanceId);
      await flushAsyncTasks();

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);
      const clearedSession = scopedSessions.find((session) => session.id === activeLocalSessionId);

      assert.equal(state.instanceRouteModeById[instanceId], 'instanceOpenAiHttp');
      assert.equal(state.activeSessionIdByInstance[instanceId], activeLocalSessionId);
      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [
          { id: activeLocalSessionId, transport: 'kernelAdapter' },
          { id: backupLocalSessionId, transport: 'kernelAdapter' },
        ],
      );
      assert.equal(clearedSession?.messages.length ?? -1, 0);
      assert.equal(clearedSession?.kernelSession?.authority.kind, 'http');
      assert.equal(clearedSession?.kernelSession?.authority.durable, false);
      assert.equal(state.syncStateByInstance[instanceId] ?? 'idle', 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore flushSession on transport-backed routes drops stale gateway sessions without writing through the studio conversation store',
  async () => {
    const instanceId = 'local-flush-stale-gateway-scope-instance';
    const activeLocalSessionId = 'local-session-flush-active';
    const staleGatewaySessionId = 'gateway-session-flush-stale';
    const backupLocalSessionId = 'local-session-flush-backup';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        createTransportBackedSession({
          id: activeLocalSessionId,
          instanceId,
          title: 'Active Local Session',
          createdAt: 1,
          updatedAt: 3,
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'hello',
              timestamp: 3,
            },
          ],
        }),
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        createTransportBackedSession({
          id: backupLocalSessionId,
          instanceId,
          title: 'Backup Local Session',
          createdAt: 1,
          updatedAt: 1,
        }),
      ],
      activeSessionIdByInstance: {
        [instanceId]: activeLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
      syncStateByInstance: {
        [instanceId]: 'loading',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      await chatStore.getState().flushSession(activeLocalSessionId);

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);

      assert.equal(state.activeSessionIdByInstance[instanceId], activeLocalSessionId);
      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [
          { id: activeLocalSessionId, transport: 'kernelAdapter' },
          { id: backupLocalSessionId, transport: 'kernelAdapter' },
        ],
      );
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.gatewayConnectionStatusByInstance[instanceId], undefined);
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore addMessage on transport-backed routes drops stale gateway sessions while updating the authoritative kernel adapter session',
  async () => {
    const instanceId = 'local-add-message-stale-gateway-scope-instance';
    const activeLocalSessionId = 'local-session-add-message-active';
    const staleGatewaySessionId = 'gateway-session-add-message-stale';
    const backupLocalSessionId = 'local-session-add-message-backup';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        createTransportBackedSession({
          id: activeLocalSessionId,
          instanceId,
          title: 'Untitled',
          createdAt: 1,
          updatedAt: 3,
        }),
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        createTransportBackedSession({
          id: backupLocalSessionId,
          instanceId,
          title: 'Backup Local Session',
          createdAt: 1,
          updatedAt: 1,
        }),
      ],
      activeSessionIdByInstance: {
        [instanceId]: activeLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createSupportedHttpInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      chatStore.getState().addMessage(activeLocalSessionId, {
        role: 'user',
        content: 'hello local scope',
      });

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);
      const activeSession = scopedSessions.find((session) => session.id === activeLocalSessionId);

      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [
          { id: activeLocalSessionId, transport: 'kernelAdapter' },
          { id: backupLocalSessionId, transport: 'kernelAdapter' },
        ],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId], activeLocalSessionId);
      assert.equal(activeSession?.messages.length ?? -1, 1);
      assert.equal(activeSession?.messages[0]?.content, 'hello local scope');
      assert.ok(activeSession?.kernelSession);
      assert.equal(activeSession?.kernelSession?.authority.kind, 'http');
      assert.equal(activeSession?.kernelSession?.authority.durable, false);
      assert.ok(activeSession?.messages[0]?.kernelMessage);
      assert.equal(
        activeSession?.messages[0]?.kernelMessage?.sessionRef.sessionId,
        activeLocalSessionId,
      );
      assert.equal(activeSession?.messages[0]?.kernelMessage?.text, 'hello local scope');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore updateMessage on transport-backed routes drops stale gateway sessions while editing the authoritative kernel adapter session',
  async () => {
    const instanceId = 'local-update-message-stale-gateway-scope-instance';
    const activeLocalSessionId = 'local-session-update-message-active';
    const staleGatewaySessionId = 'gateway-session-update-message-stale';
    const backupLocalSessionId = 'local-session-update-message-backup';
    const originalBridge = getPlatformBridge();
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        createTransportBackedSession({
          id: activeLocalSessionId,
          instanceId,
          title: 'Editable Local Session',
          createdAt: 1,
          updatedAt: 3,
          messages: [
            {
              id: 'msg-edit-1',
              role: 'assistant',
              content: 'draft reply',
              timestamp: 3,
            },
          ],
        }),
        {
          id: staleGatewaySessionId,
          title: 'Stale Gateway Session',
          createdAt: 1,
          updatedAt: 2,
          messages: [],
          model: 'sonnet',
          instanceId,
          transport: 'openclawGateway',
        },
        createTransportBackedSession({
          id: backupLocalSessionId,
          instanceId,
          title: 'Backup Local Session',
          createdAt: 1,
          updatedAt: 1,
        }),
      ],
      activeSessionIdByInstance: {
        [instanceId]: activeLocalSessionId,
      },
      instanceRouteModeById: {
        [instanceId]: 'instanceOpenAiHttp',
      },
    }));

    try {
      chatStore.getState().updateMessage(activeLocalSessionId, 'msg-edit-1', 'final reply');

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);
      const activeSession = scopedSessions.find((session) => session.id === activeLocalSessionId);

      assert.deepEqual(
        scopedSessions.map((session) => ({ id: session.id, transport: session.transport })),
        [
          { id: activeLocalSessionId, transport: 'kernelAdapter' },
          { id: backupLocalSessionId, transport: 'kernelAdapter' },
        ],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId], activeLocalSessionId);
      assert.equal(activeSession?.messages[0]?.content, 'final reply');
      assert.ok(activeSession?.kernelSession);
      assert.equal(activeSession?.kernelSession?.authority.kind, 'http');
      assert.ok(activeSession?.messages[0]?.kernelMessage);
      assert.equal(activeSession?.messages[0]?.kernelMessage?.text, 'final reply');
    } finally {
      resetChatStore();
    }
  },
);

await runTest(
  'chatStore setActiveSession hydrates authoritative local Hermes messages from the kernel-backed session store',
  async () => {
    const instanceId = 'local-hermes-active-session-instance';
    const sessionId = 'hermes-session-active';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Authoritative Hermes Session',
      createdAt: 10,
      updatedAt: 30,
      messageCount: 2,
      lastMessagePreview: 'authoritative assistant reply',
    });
    const kernelMessages = [
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-message-1',
        role: 'user',
        text: 'authoritative user prompt',
        timestamp: 20,
      }),
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-message-2',
        role: 'assistant',
        text: 'authoritative assistant reply',
        timestamp: 30,
      }),
    ];
    const kernelRuns = [
      createAuthoritativeHermesKernelRun({
        sessionRef: kernelSession.ref,
        id: 'hermes-run-1',
        status: 'completed',
        createdAt: 30,
      }),
    ];
    let loadMessagesCallCount = 0;
    let listRunsCallCount = 0;
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Stale Hermes Session',
          createdAt: 10,
          updatedAt: 11,
          messages: [
            {
              id: 'stale-message-1',
              role: 'assistant',
              content: 'stale local reply',
              timestamp: 11,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession,
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: null,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession() {
          return kernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-run-1',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 30,
            updatedAt: 30,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          loadMessagesCallCount += 1;
          return kernelMessages;
        },
        async listKernelChatRuns(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          listRunsCallCount += 1;
          return kernelRuns;
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(sessionId, instanceId);

      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(loadMessagesCallCount, 1);
      assert.equal(listRunsCallCount, 1);
      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
      assert.equal(session?.kernelSession?.authority.kind, 'sqlite');
      assert.deepEqual(session?.kernelRuns, kernelRuns);
      assert.deepEqual(
        session?.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        })),
        [
          {
            id: 'hermes-message-1',
            role: 'user',
            content: 'authoritative user prompt',
          },
          {
            id: 'hermes-message-2',
            role: 'assistant',
            content: 'authoritative assistant reply',
          },
        ],
      );
      assert.equal(session?.lastMessagePreview, 'authoritative assistant reply');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession keeps stable fallback ids for authoritative kernel messages without upstream ids',
  async () => {
    const instanceId = 'local-hermes-idless-message-instance';
    const sessionId = 'hermes-session-idless-message';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Idless Hermes Session',
      createdAt: 10,
      updatedAt: 30,
      messageCount: 2,
      lastMessagePreview: 'stable idless assistant reply',
    });
    let kernelMessages = [
      {
        sessionRef: kernelSession.ref,
        role: 'user' as const,
        status: 'complete' as const,
        createdAt: 20,
        updatedAt: 20,
        text: 'stable idless user prompt',
        nativeMetadata: { seq: 1 },
        parts: [
          {
            kind: 'text' as const,
            text: 'stable idless user prompt',
          },
        ],
      },
      {
        sessionRef: kernelSession.ref,
        role: 'assistant' as const,
        status: 'complete' as const,
        createdAt: 30,
        updatedAt: 30,
        text: 'stable idless assistant reply',
        nativeMetadata: { seq: 2 },
        parts: [
          {
            kind: 'text' as const,
            text: 'stable idless assistant reply',
          },
        ],
      },
    ];
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Idless Hermes Session',
          createdAt: 10,
          updatedAt: 10,
          messages: [],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession,
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: null,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession() {
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession() {
          return kernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-run-idless-message-1',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 30,
            updatedAt: 30,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages() {
          return kernelMessages;
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(sessionId, instanceId);
      const firstProjectedIds =
        chatStore
          .getState()
          .sessions.find((entry) => entry.id === sessionId)
          ?.messages.map((message) => message.id) ?? [];

      await chatStore.getState().setActiveSession(sessionId, instanceId);
      const secondProjectedIds =
        chatStore
          .getState()
          .sessions.find((entry) => entry.id === sessionId)
          ?.messages.map((message) => message.id) ?? [];

      assert.deepEqual(firstProjectedIds, secondProjectedIds);

      const projectedIdsByContent = new Map(
        chatStore
          .getState()
          .sessions.find((entry) => entry.id === sessionId)
          ?.messages.map((message) => [message.content, message.id] as const) ?? [],
      );
      kernelMessages = [
        {
          sessionRef: kernelSession.ref,
          role: 'user' as const,
          status: 'complete' as const,
          createdAt: 15,
          updatedAt: 15,
          text: 'older idless user prompt',
          nativeMetadata: { seq: 0 },
          parts: [
            {
              kind: 'text' as const,
              text: 'older idless user prompt',
            },
          ],
        },
        ...kernelMessages,
      ];

      await chatStore.getState().setActiveSession(sessionId, instanceId);
      const projectedIdsByContentAfterPrepend = new Map(
        chatStore
          .getState()
          .sessions.find((entry) => entry.id === sessionId)
          ?.messages.map((message) => [message.content, message.id] as const) ?? [],
      );

      assert.equal(
        projectedIdsByContentAfterPrepend.get('stable idless user prompt'),
        projectedIdsByContent.get('stable idless user prompt'),
      );
      assert.equal(
        projectedIdsByContentAfterPrepend.get('stable idless assistant reply'),
        projectedIdsByContent.get('stable idless assistant reply'),
      );
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession keeps all-sessions order stable when authoritative hydration sees newer transcript messages',
  async () => {
    const instanceId = 'local-hermes-stable-order-instance';
    const leadingSessionId = 'hermes-stable-order-leading';
    const selectedSessionId = 'hermes-stable-order-selected';
    const originalBridge = getPlatformBridge();
    const leadingKernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId: leadingSessionId,
      title: 'Leading Hermes Session',
      createdAt: 100,
      updatedAt: 220,
      messageCount: 1,
      lastMessagePreview: 'leading reply',
    });
    const selectedKernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId: selectedSessionId,
      title: 'Selected Hermes Session',
      createdAt: 110,
      updatedAt: 210,
      messageCount: 1,
      lastMessagePreview: 'selected cached reply',
    });
    const selectedKernelMessages = [
      createAuthoritativeHermesKernelMessage({
        sessionRef: selectedKernelSession.ref,
        id: 'hermes-stable-order-message-1',
        role: 'assistant',
        text: 'selected authoritative reply from hydrated transcript',
        timestamp: 320,
      }),
    ];
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: leadingSessionId,
          title: 'Leading Hermes Session',
          createdAt: 100,
          updatedAt: 220,
          messages: [
            {
              id: 'leading-message-1',
              role: 'assistant',
              content: 'leading reply',
              timestamp: 220,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: leadingKernelSession,
          historyState: 'ready',
        },
        {
          id: selectedSessionId,
          title: 'Selected Hermes Session',
          createdAt: 110,
          updatedAt: 210,
          messages: [
            {
              id: 'selected-stale-message-1',
              role: 'assistant',
              content: 'selected cached reply',
              timestamp: 210,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: selectedKernelSession,
          historyState: 'ready',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: null,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [leadingKernelSession, selectedKernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, selectedSessionId);
          return selectedKernelSession;
        },
        async createKernelChatSession() {
          return selectedKernelSession;
        },
        async patchKernelChatSession() {
          return selectedKernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          throw new Error('Not expected in this hydration test.');
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, selectedSessionId);
          return selectedKernelMessages;
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(selectedSessionId, instanceId);

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter(
        (session) => session.instanceId === instanceId,
      );
      const selectedSession = scopedSessions.find(
        (session) => session.id === selectedSessionId,
      );

      assert.deepEqual(
        scopedSessions.map((session) => session.id),
        [leadingSessionId, selectedSessionId],
      );
      assert.equal(state.activeSessionIdByInstance[instanceId], selectedSessionId);
      assert.equal(selectedSession?.messages[0]?.content, 'selected authoritative reply from hydrated transcript');
      assert.equal(selectedSession?.updatedAt, 210);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession replaces date-like kernel titles with the first user message and patches the durable session title',
  async () => {
    const instanceId = 'local-hermes-date-title-instance';
    const sessionId = 'hermes-session-date-title';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: '2026-04-26 10:58',
      createdAt: 10,
      updatedAt: 30,
      messageCount: 2,
      lastMessagePreview: 'authoritative assistant reply',
    });
    const kernelMessages = [
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-date-title-message-1',
        role: 'user',
        text: 'Fix OpenClaw desktop startup so the runtime reaches ready',
        timestamp: 20,
      }),
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-date-title-message-2',
        role: 'assistant',
        text: 'authoritative assistant reply',
        timestamp: 30,
      }),
    ];
    const patchedTitles: Array<string | null | undefined> = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession(input) {
          patchedTitles.push(input.title);
          return {
            ...kernelSession,
            title: input.title ?? kernelSession.title,
          };
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-date-title-run',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 30,
            updatedAt: 30,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelMessages;
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(sessionId, instanceId);
      await flushAsyncTasks();

      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(
        session?.title,
        'Fix OpenClaw desktop startup so the runtime reaches ready',
      );
      assert.equal(
        (session as { titleSource?: string } | undefined)?.titleSource,
        'firstUser',
      );
      assert.equal(
        session?.kernelSession?.title,
        'Fix OpenClaw desktop startup so the runtime reaches ready',
      );
      assert.deepEqual(patchedTitles, [
        'Fix OpenClaw desktop startup so the runtime reaches ready',
      ]);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession repairs legacy preview-backed kernel titles and patches the durable session title',
  async () => {
    const instanceId = 'local-hermes-active-session-preview-title-instance';
    const sessionId = 'hermes-session-preview-title';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'authoritative assistant reply',
      createdAt: 10,
      updatedAt: 30,
      messageCount: 2,
      lastMessagePreview: 'authoritative assistant reply',
    });
    const kernelMessages = [
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-preview-title-message-1',
        role: 'user',
        text: 'Fix OpenClaw desktop startup so the runtime reaches ready',
        timestamp: 20,
      }),
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-preview-title-message-2',
        role: 'assistant',
        text: 'authoritative assistant reply',
        timestamp: 30,
      }),
    ];
    const patchedTitles: Array<string | null | undefined> = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession(input) {
          patchedTitles.push(input.title);
          return {
            ...kernelSession,
            title: input.title ?? kernelSession.title,
          };
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-preview-title-run',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 30,
            updatedAt: 30,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelMessages;
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(sessionId, instanceId);
      await flushAsyncTasks();

      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(
        session?.title,
        'Fix OpenClaw desktop startup so the runtime reaches ready',
      );
      assert.equal(
        (session as { titleSource?: string } | undefined)?.titleSource,
        'firstUser',
      );
      assert.equal(
        session?.kernelSession?.title,
        'Fix OpenClaw desktop startup so the runtime reaches ready',
      );
      assert.deepEqual(patchedTitles, [
        'Fix OpenClaw desktop startup so the runtime reaches ready',
      ]);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession compacts duplicate authoritative kernel message ids before projecting the current conversation',
  async () => {
    const instanceId = 'local-hermes-active-session-dedupe-instance';
    const sessionId = 'hermes-session-active-dedupe';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Authoritative Hermes Deduped Session',
      createdAt: 10,
      updatedAt: 30,
      messageCount: 3,
      lastMessagePreview: 'authoritative assistant reply',
    });
    const kernelMessages = [
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-dedupe-message-1',
        role: 'user',
        text: 'authoritative user prompt',
        timestamp: 20,
      }),
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-dedupe-message-2',
        role: 'assistant',
        text: 'partial authoritative reply',
        timestamp: 24,
      }),
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-dedupe-message-2',
        role: 'assistant',
        text: 'authoritative assistant reply',
        timestamp: 30,
      }),
    ];
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Stale Hermes Deduped Session',
          createdAt: 10,
          updatedAt: 11,
          messages: [
            {
              id: 'stale-message-1',
              role: 'assistant',
              content: 'stale local reply',
              timestamp: 11,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession,
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: null,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession() {
          return kernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-run-dedupe-1',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 30,
            updatedAt: 30,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelMessages;
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(sessionId, instanceId);

      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(session?.messages.length, 2);
      assert.deepEqual(
        session?.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        })),
        [
          {
            id: 'hermes-dedupe-message-1',
            role: 'user',
            content: 'authoritative user prompt',
          },
          {
            id: 'hermes-dedupe-message-2',
            role: 'assistant',
            content: 'authoritative assistant reply',
          },
        ],
      );
      assert.equal(session?.messages[1]?.kernelMessage?.text, 'authoritative assistant reply');
      assert.equal(session?.lastMessagePreview, 'authoritative assistant reply');
      assert.equal(session?.updatedAt, 11);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession preserves notice-only authoritative Hermes messages so current-conversation errors stay visible',
  async () => {
    const instanceId = 'local-hermes-notice-only-instance';
    const sessionId = 'hermes-session-notice-only';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Notice Only Hermes Session',
      createdAt: 10,
      updatedAt: 20,
      messageCount: 1,
      lastMessagePreview: null,
    });
    const noticeOnlyKernelMessage = {
      id: 'hermes-message-notice-only',
      sessionRef: kernelSession.ref,
      role: 'assistant' as const,
      status: 'error' as const,
      createdAt: 20,
      updatedAt: 25,
      text: '',
      parts: [
        {
          kind: 'notice' as const,
          code: 'kernel-error',
          text: 'Hermes kernel execution failed.',
          level: 'error' as const,
        },
      ],
    };
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession() {
          return kernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          throw new Error('Not expected in this hydration test.');
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return [noticeOnlyKernelMessage];
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      await chatStore.getState().setActiveSession(sessionId, instanceId);

      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(state.activeSessionIdByInstance[instanceId], sessionId);
      assert.ok(session);
      assert.equal(session?.messages.length, 1);
      assert.equal(session?.messages[0]?.content, '');
      assert.equal(session?.lastMessagePreview, 'Hermes kernel execution failed.');
      assert.deepEqual(session?.messages[0]?.kernelMessage?.parts, [
        {
          kind: 'notice',
          code: 'kernel-error',
          text: 'Hermes kernel execution failed.',
          level: 'error',
        },
      ]);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession keeps the selected authoritative Hermes session active and marks its history as errored when hydration fails',
  async () => {
    const instanceId = 'local-hermes-active-session-error-instance';
    const activeSessionId = 'hermes-session-active-error';
    const previousSessionId = 'hermes-session-previous';
    const expectedErrorMessage = 'Failed to load authoritative kernel history';
    const originalBridge = getPlatformBridge();
    const selectedKernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId: activeSessionId,
      title: 'Selected Hermes Session',
      createdAt: 10,
      updatedAt: 20,
      messageCount: 1,
      lastMessagePreview: 'stale cached reply',
    });
    const previousKernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId: previousSessionId,
      title: 'Previously Active Hermes Session',
      createdAt: 5,
      updatedAt: 15,
      messageCount: 1,
      lastMessagePreview: 'previous reply',
    });
    let rejectLoadMessages!: (error: Error) => void;
    const loadMessagesPromise = new Promise<never>((_, reject) => {
      rejectLoadMessages = reject;
    });
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: previousSessionId,
          title: 'Previously Active Hermes Session',
          createdAt: 5,
          updatedAt: 15,
          messages: [
            {
              id: 'previous-message-1',
              role: 'assistant',
              content: 'previous reply',
              timestamp: 15,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: previousKernelSession,
          historyState: 'ready',
        },
        {
          id: activeSessionId,
          title: 'Selected Hermes Session',
          createdAt: 10,
          updatedAt: 20,
          messages: [
            {
              id: 'selected-message-stale-1',
              role: 'assistant',
              content: 'stale cached reply',
              timestamp: 20,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: selectedKernelSession,
          historyState: 'ready',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: previousSessionId,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [selectedKernelSession, previousKernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, activeSessionId);
          return selectedKernelSession;
        },
        async createKernelChatSession() {
          return selectedKernelSession;
        },
        async patchKernelChatSession() {
          return selectedKernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-run-error-1',
            sessionRef: selectedKernelSession.ref,
            status: 'completed' as const,
            createdAt: 20,
            updatedAt: 20,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, activeSessionId);
          return loadMessagesPromise;
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      await withCapturedConsoleError(async (consoleErrorCalls) => {
        const setActiveSessionPromise = chatStore
          .getState()
          .setActiveSession(activeSessionId, instanceId);

        await flushAsyncTasks();

        const loadingState = chatStore.getState();
        const loadingSession = loadingState.sessions.find(
          (session) => session.id === activeSessionId && session.instanceId === instanceId,
        );

        assert.equal(loadingState.activeSessionIdByInstance[instanceId], activeSessionId);
        assert.equal(loadingState.syncStateByInstance[instanceId], 'loading');
        assert.equal(loadingState.lastErrorByInstance[instanceId], undefined);
        assert.equal(loadingSession?.historyState, 'loading');
        assert.equal(loadingSession?.messages[0]?.content, 'stale cached reply');

        const expectedError = new Error(expectedErrorMessage);
        rejectLoadMessages(expectedError);
        await setActiveSessionPromise;

        const errorState = chatStore.getState();
        const erroredSession = errorState.sessions.find(
          (session) => session.id === activeSessionId && session.instanceId === instanceId,
        );

        assert.equal(errorState.activeSessionIdByInstance[instanceId], activeSessionId);
        assert.equal(errorState.syncStateByInstance[instanceId], 'error');
        assert.equal(errorState.lastErrorByInstance[instanceId], expectedErrorMessage);
        assert.equal(erroredSession?.historyState, 'error');
        assert.equal(erroredSession?.messages[0]?.content, 'stale cached reply');
        assert.deepEqual(consoleErrorCalls, [
          ['Failed to hydrate authoritative kernel chat session:', expectedError],
        ]);
      });
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession ignores stale authoritative hydration from an earlier session selection',
  async () => {
    const instanceId = 'local-hermes-active-session-race-instance';
    const firstSessionId = 'hermes-session-race-a';
    const secondSessionId = 'hermes-session-race-b';
    const originalBridge = getPlatformBridge();
    const firstKernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId: firstSessionId,
      title: 'First Hermes Session',
      createdAt: 10,
      updatedAt: 20,
      messageCount: 1,
      lastMessagePreview: 'first authoritative reply',
    });
    const secondKernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId: secondSessionId,
      title: 'Second Hermes Session',
      createdAt: 11,
      updatedAt: 21,
      messageCount: 1,
      lastMessagePreview: 'second authoritative reply',
    });
    const firstKernelMessages = [
      createAuthoritativeHermesKernelMessage({
        sessionRef: firstKernelSession.ref,
        id: 'hermes-race-message-a-1',
        role: 'assistant',
        text: 'first authoritative reply',
        timestamp: 20,
      }),
    ];
    const secondKernelMessages = [
      createAuthoritativeHermesKernelMessage({
        sessionRef: secondKernelSession.ref,
        id: 'hermes-race-message-b-1',
        role: 'assistant',
        text: 'second authoritative reply',
        timestamp: 21,
      }),
    ];
    let resolveFirstLoadMessages!: (messages: typeof firstKernelMessages) => void;
    let resolveSecondLoadMessages!: (messages: typeof secondKernelMessages) => void;
    const firstLoadMessagesPromise = new Promise<typeof firstKernelMessages>((resolve) => {
      resolveFirstLoadMessages = resolve;
    });
    const secondLoadMessagesPromise = new Promise<typeof secondKernelMessages>((resolve) => {
      resolveSecondLoadMessages = resolve;
    });
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: firstSessionId,
          title: 'First Hermes Session',
          createdAt: 10,
          updatedAt: 12,
          messages: [
            {
              id: 'stale-race-message-a-1',
              role: 'assistant',
              content: 'stale first reply',
              timestamp: 12,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: firstKernelSession,
          historyState: 'ready',
        },
        {
          id: secondSessionId,
          title: 'Second Hermes Session',
          createdAt: 11,
          updatedAt: 13,
          messages: [
            {
              id: 'stale-race-message-b-1',
              role: 'assistant',
              content: 'stale second reply',
              timestamp: 13,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: secondKernelSession,
          historyState: 'ready',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: null,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [firstKernelSession, secondKernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          if (requestedSessionId === firstSessionId) {
            return firstKernelSession;
          }

          assert.equal(requestedSessionId, secondSessionId);
          return secondKernelSession;
        },
        async createKernelChatSession() {
          return firstKernelSession;
        },
        async patchKernelChatSession() {
          return firstKernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-run-race-1',
            sessionRef: firstKernelSession.ref,
            status: 'completed' as const,
            createdAt: 20,
            updatedAt: 20,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          if (requestedSessionId === firstSessionId) {
            return firstLoadMessagesPromise;
          }

          assert.equal(requestedSessionId, secondSessionId);
          return secondLoadMessagesPromise;
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      const firstSelectionPromise = chatStore
        .getState()
        .setActiveSession(firstSessionId, instanceId);

      await flushAsyncTasks();

      const secondSelectionPromise = chatStore
        .getState()
        .setActiveSession(secondSessionId, instanceId);

      await flushAsyncTasks();

      const loadingState = chatStore.getState();
      assert.equal(loadingState.activeSessionIdByInstance[instanceId], secondSessionId);
      assert.equal(loadingState.syncStateByInstance[instanceId], 'loading');

      resolveSecondLoadMessages(secondKernelMessages);
      await secondSelectionPromise;

      const selectedState = chatStore.getState();
      const selectedSession = selectedState.sessions.find(
        (session) => session.id === secondSessionId && session.instanceId === instanceId,
      );
      assert.equal(selectedState.activeSessionIdByInstance[instanceId], secondSessionId);
      assert.equal(selectedState.syncStateByInstance[instanceId], 'idle');
      assert.equal(selectedSession?.messages[0]?.content, 'second authoritative reply');

      resolveFirstLoadMessages(firstKernelMessages);
      await firstSelectionPromise;

      const finalState = chatStore.getState();
      const firstSession = finalState.sessions.find(
        (session) => session.id === firstSessionId && session.instanceId === instanceId,
      );
      const secondSession = finalState.sessions.find(
        (session) => session.id === secondSessionId && session.instanceId === instanceId,
      );

      assert.equal(finalState.activeSessionIdByInstance[instanceId], secondSessionId);
      assert.equal(finalState.syncStateByInstance[instanceId], 'idle');
      assert.equal(finalState.lastErrorByInstance[instanceId], undefined);
      assert.equal(firstSession?.messages[0]?.content, 'first authoritative reply');
      assert.equal(firstSession?.historyState, 'ready');
      assert.equal(secondSession?.messages[0]?.content, 'second authoritative reply');
      assert.equal(secondSession?.historyState, 'ready');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore flushSession reloads authoritative local Hermes messages instead of keeping projected local assistant content',
  async () => {
    const instanceId = 'local-hermes-flush-session-instance';
    const sessionId = 'hermes-session-flush';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Authoritative Hermes Flush Session',
      createdAt: 10,
      updatedAt: 40,
      messageCount: 2,
      lastMessagePreview: 'kernel authoritative completion',
    });
    const kernelMessages = [
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-flush-message-1',
        role: 'user',
        text: 'hello from projected local send',
        timestamp: 20,
      }),
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSession.ref,
        id: 'hermes-flush-message-2',
        role: 'assistant',
        text: 'kernel authoritative completion',
        timestamp: 40,
      }),
    ];
    let loadMessagesCallCount = 0;
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Projected Hermes Session',
          createdAt: 10,
          updatedAt: 25,
          messages: [
            {
              id: 'projected-user-1',
              role: 'user',
              content: 'hello from projected local send',
              timestamp: 20,
            },
            {
              id: 'projected-assistant-1',
              role: 'assistant',
              content: 'partial projected completion',
              timestamp: 25,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession,
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
      syncStateByInstance: {
        [instanceId]: 'loading',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession() {
          return kernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-run-2',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 40,
            updatedAt: 40,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          loadMessagesCallCount += 1;
          return kernelMessages;
        },
      },
    });

    try {
      await chatStore.getState().flushSession(sessionId);

      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(loadMessagesCallCount, 1);
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
      assert.equal(session?.messages[1]?.content, 'kernel authoritative completion');
      assert.equal(session?.messages[1]?.kernelMessage?.text, 'kernel authoritative completion');
      assert.equal(session?.lastMessagePreview, 'kernel authoritative completion');
      assert.equal(session?.updatedAt, 40);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore flushSession clears stale authoritative previews when the authoritative transcript is empty',
  async () => {
    const instanceId = 'local-hermes-flush-empty-preview-instance';
    const sessionId = 'hermes-session-flush-empty-preview';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Authoritative Hermes Empty Preview Session',
      createdAt: 10,
      updatedAt: 40,
      messageCount: 0,
      lastMessagePreview: 'stale cached reply',
    });
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Authoritative Hermes Empty Preview Session',
          createdAt: 10,
          updatedAt: 25,
          messages: [
            {
              id: 'projected-assistant-stale-1',
              role: 'assistant',
              content: 'stale cached reply',
              timestamp: 25,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession,
          lastMessagePreview: 'stale cached reply',
          historyState: 'ready',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
      syncStateByInstance: {
        [instanceId]: 'loading',
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession() {
          return kernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-run-empty-preview-1',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 40,
            updatedAt: 40,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return [];
        },
      },
    });

    try {
      await chatStore.getState().flushSession(sessionId);

      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
      assert.deepEqual(session?.messages, []);
      assert.equal(session?.lastMessagePreview, undefined);
      assert.equal(session?.kernelSession?.lastMessagePreview ?? null, null);
      assert.equal(session?.historyState, 'ready');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore flushSession marks authoritative Hermes history as loading and error when hydration fails',
  async () => {
    const instanceId = 'local-hermes-flush-session-error-instance';
    const sessionId = 'hermes-session-flush-error';
    const expectedErrorMessage = 'Failed to reload authoritative kernel history';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Authoritative Hermes Flush Error Session',
      createdAt: 10,
      updatedAt: 20,
      messageCount: 1,
      lastMessagePreview: 'stale cached reply',
    });
    let rejectLoadMessages!: (error: Error) => void;
    const loadMessagesPromise = new Promise<never>((_, reject) => {
      rejectLoadMessages = reject;
    });
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Authoritative Hermes Flush Error Session',
          createdAt: 10,
          updatedAt: 20,
          messages: [
            {
              id: 'selected-message-stale-1',
              role: 'assistant',
              content: 'stale cached reply',
              timestamp: 20,
            },
          ],
          model: 'gpt-4.1',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession,
          historyState: 'ready',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession() {
          return kernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-run-flush-error-1',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 20,
            updatedAt: 20,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return loadMessagesPromise;
        },
      },
    });

    try {
      await withCapturedConsoleError(async (consoleErrorCalls) => {
        const flushSessionPromise = chatStore.getState().flushSession(sessionId);

        await flushAsyncTasks();

        const loadingState = chatStore.getState();
        const loadingSession = loadingState.sessions.find(
          (session) => session.id === sessionId && session.instanceId === instanceId,
        );

        assert.equal(loadingState.activeSessionIdByInstance[instanceId], sessionId);
        assert.equal(loadingState.syncStateByInstance[instanceId], 'loading');
        assert.equal(loadingState.lastErrorByInstance[instanceId], undefined);
        assert.equal(loadingSession?.historyState, 'loading');
        assert.equal(loadingSession?.messages[0]?.content, 'stale cached reply');

        const expectedError = new Error(expectedErrorMessage);
        rejectLoadMessages(expectedError);
        await flushSessionPromise;

        const errorState = chatStore.getState();
        const erroredSession = errorState.sessions.find(
          (session) => session.id === sessionId && session.instanceId === instanceId,
        );

        assert.equal(errorState.activeSessionIdByInstance[instanceId], sessionId);
        assert.equal(errorState.syncStateByInstance[instanceId], 'error');
        assert.equal(errorState.lastErrorByInstance[instanceId], expectedErrorMessage);
        assert.equal(erroredSession?.historyState, 'error');
        assert.equal(erroredSession?.messages[0]?.content, 'stale cached reply');
        assert.deepEqual(consoleErrorCalls, [
          ['Failed to flush conversation:', expectedError],
        ]);
      });
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setKernelSessionModel ignores stale authoritative model projections from earlier mutations',
  async () => {
    const instanceId = 'local-hermes-model-race-instance';
    const sessionId = 'hermes-session-model-race';
    const originalBridge = getPlatformBridge();
    const initialKernelSession = {
      ...createAuthoritativeHermesKernelSession({
        instanceId,
        sessionId,
        title: 'Hermes Model Race Session',
        createdAt: 10,
        updatedAt: 10,
        messageCount: 0,
      }),
      modelBinding: {
        model: 'hermes/model-initial',
        defaultModel: 'hermes/model-initial',
      },
    };
    const firstUpdatedKernelSession = {
      ...initialKernelSession,
      updatedAt: 30,
      modelBinding: {
        model: 'hermes/model-a',
        defaultModel: 'hermes/model-a',
      },
    };
    const secondUpdatedKernelSession = {
      ...initialKernelSession,
      updatedAt: 40,
      modelBinding: {
        model: 'hermes/model-b',
        defaultModel: 'hermes/model-b',
      },
    };
    let currentProjectionKernelSession = initialKernelSession;
    let resolveFirstPatch!: () => void;
    let resolveSecondPatch!: () => void;
    const firstPatchPromise = new Promise<typeof firstUpdatedKernelSession>((resolve) => {
      resolveFirstPatch = () => {
        currentProjectionKernelSession = firstUpdatedKernelSession;
        resolve(firstUpdatedKernelSession);
      };
    });
    const secondPatchPromise = new Promise<typeof secondUpdatedKernelSession>((resolve) => {
      resolveSecondPatch = () => {
        currentProjectionKernelSession = secondUpdatedKernelSession;
        resolve(secondUpdatedKernelSession);
      };
    });
    const patchCalls: string[] = [];
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Hermes Model Race Session',
          createdAt: 10,
          updatedAt: 10,
          messages: [],
          model: 'hermes/model-initial',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: initialKernelSession,
          historyState: 'ready',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [currentProjectionKernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return currentProjectionKernelSession;
        },
        async createKernelChatSession() {
          return initialKernelSession;
        },
        async patchKernelChatSession(params) {
          patchCalls.push(params.model ?? 'null');
          if (params.model === 'hermes/model-a') {
            return firstPatchPromise;
          }

          assert.equal(params.model, 'hermes/model-b');
          return secondPatchPromise;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-model-race-run-1',
            sessionRef: initialKernelSession.ref,
            status: 'completed' as const,
            createdAt: 10,
            updatedAt: 10,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages() {
          return [];
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      const firstMutationPromise = chatStore.getState().setKernelSessionModel({
        instanceId,
        sessionId,
        model: 'hermes/model-a',
      });

      await flushAsyncTasks();

      assert.deepEqual(patchCalls, ['hermes/model-a']);

      const secondMutationPromise = chatStore.getState().setKernelSessionModel({
        instanceId,
        sessionId,
        model: 'hermes/model-b',
      });

      await flushAsyncTasks();

      const loadingState = chatStore.getState();
      assert.equal(loadingState.syncStateByInstance[instanceId], 'loading');

      resolveSecondPatch();
      await secondMutationPromise;

      const secondState = chatStore.getState();
      const secondSession = secondState.sessions.find(
        (session) => session.id === sessionId && session.instanceId === instanceId,
      );
      assert.deepEqual(patchCalls, ['hermes/model-a', 'hermes/model-b']);
      assert.equal(secondState.syncStateByInstance[instanceId], 'idle');
      assert.equal(secondSession?.model, 'hermes/model-b');
      assert.equal(secondSession?.kernelSession?.modelBinding?.model, 'hermes/model-b');

      resolveFirstPatch();
      await firstMutationPromise;

      const finalState = chatStore.getState();
      const finalSession = finalState.sessions.find(
        (session) => session.id === sessionId && session.instanceId === instanceId,
      );
      assert.equal(finalState.syncStateByInstance[instanceId], 'idle');
      assert.equal(finalState.lastErrorByInstance[instanceId], undefined);
      assert.equal(finalSession?.model, 'hermes/model-b');
      assert.equal(finalSession?.kernelSession?.modelBinding?.model, 'hermes/model-b');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore authoritative Hermes session controls patch session overrides through the kernel adapter and refresh projection truth',
  async () => {
    const instanceId = 'local-hermes-session-controls-instance';
    const sessionId = 'hermes-session-controls';
    const originalBridge = getPlatformBridge();
    const initialKernelSession = {
      ...createAuthoritativeHermesKernelSession({
        instanceId,
        sessionId,
        title: 'Hermes Session Controls',
        createdAt: 10,
        updatedAt: 10,
        messageCount: 0,
      }),
      modelBinding: {
        model: 'hermes/model-initial',
        defaultModel: 'hermes/model-initial',
      },
    };
    let currentProjectionKernelSession = initialKernelSession;
    const patchCalls: Array<{
      thinkingLevel?: string | null;
      fastMode?: boolean | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    }> = [];
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Hermes Session Controls',
          createdAt: 10,
          updatedAt: 10,
          messages: [],
          model: 'hermes/model-initial',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: initialKernelSession,
          historyState: 'ready',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [currentProjectionKernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return currentProjectionKernelSession;
        },
        async createKernelChatSession() {
          return initialKernelSession;
        },
        async patchKernelChatSession(input) {
          const hasThinkingLevel = Object.prototype.hasOwnProperty.call(input, 'thinkingLevel');
          const hasFastMode = Object.prototype.hasOwnProperty.call(input, 'fastMode');
          const hasVerboseLevel = Object.prototype.hasOwnProperty.call(input, 'verboseLevel');
          const hasReasoningLevel = Object.prototype.hasOwnProperty.call(input, 'reasoningLevel');

          assert.equal(input.instanceId, instanceId);
          assert.equal(input.sessionId, sessionId);
          patchCalls.push({
            ...(hasThinkingLevel ? { thinkingLevel: input.thinkingLevel ?? null } : {}),
            ...(hasFastMode ? { fastMode: input.fastMode ?? null } : {}),
            ...(hasVerboseLevel ? { verboseLevel: input.verboseLevel ?? null } : {}),
            ...(hasReasoningLevel ? { reasoningLevel: input.reasoningLevel ?? null } : {}),
          });

          currentProjectionKernelSession = {
            ...currentProjectionKernelSession,
            updatedAt: currentProjectionKernelSession.updatedAt + 10,
            modelBinding: {
              ...(currentProjectionKernelSession.modelBinding ?? {}),
              model:
                currentProjectionKernelSession.modelBinding?.model ??
                'hermes/model-initial',
              defaultModel:
                currentProjectionKernelSession.modelBinding?.defaultModel ??
                'hermes/model-initial',
              thinkingLevel: hasThinkingLevel
                ? (input.thinkingLevel ?? null)
                : currentProjectionKernelSession.modelBinding?.thinkingLevel,
              fastMode: hasFastMode
                ? (input.fastMode ?? null)
                : currentProjectionKernelSession.modelBinding?.fastMode,
              verboseLevel: hasVerboseLevel
                ? (input.verboseLevel ?? null)
                : currentProjectionKernelSession.modelBinding?.verboseLevel,
              reasoningLevel: hasReasoningLevel
                ? (input.reasoningLevel ?? null)
                : currentProjectionKernelSession.modelBinding?.reasoningLevel,
            },
          };

          return currentProjectionKernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-session-controls-run-1',
            sessionRef: initialKernelSession.ref,
            status: 'completed' as const,
            createdAt: 10,
            updatedAt: 10,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages() {
          return [];
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      await chatStore.getState().setKernelSessionThinkingLevel({
        instanceId,
        sessionId,
        thinkingLevel: 'deep',
      });
      await chatStore.getState().setKernelSessionFastMode({
        instanceId,
        sessionId,
        fastMode: true,
      });
      await chatStore.getState().setKernelSessionVerboseLevel({
        instanceId,
        sessionId,
        verboseLevel: 'full',
      });
      await chatStore.getState().setKernelSessionReasoningLevel({
        instanceId,
        sessionId,
        reasoningLevel: 'stream',
      });

      const state = chatStore.getState();
      const session = state.sessions.find(
        (entry) => entry.id === sessionId && entry.instanceId === instanceId,
      );

      assert.deepEqual(patchCalls, [
        {
          thinkingLevel: 'deep',
        },
        {
          fastMode: true,
        },
        {
          verboseLevel: 'full',
        },
        {
          reasoningLevel: 'stream',
        },
      ]);
      assert.equal(state.syncStateByInstance[instanceId], 'idle');
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
      assert.equal(session?.thinkingLevel, 'deep');
      assert.equal(session?.fastMode, true);
      assert.equal(session?.verboseLevel, 'full');
      assert.equal(session?.reasoningLevel, 'stream');
      assert.equal(session?.kernelSession?.modelBinding?.thinkingLevel, 'deep');
      assert.equal(session?.kernelSession?.modelBinding?.fastMode, true);
      assert.equal(session?.kernelSession?.modelBinding?.verboseLevel, 'full');
      assert.equal(session?.kernelSession?.modelBinding?.reasoningLevel, 'stream');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore flushSession ignores stale authoritative projections after a newer model mutation completes',
  async () => {
    const instanceId = 'local-hermes-flush-model-race-instance';
    const sessionId = 'hermes-session-flush-model-race';
    const originalBridge = getPlatformBridge();
    const initialKernelSession = {
      ...createAuthoritativeHermesKernelSession({
        instanceId,
        sessionId,
        title: 'Hermes Flush Model Race Session',
        createdAt: 10,
        updatedAt: 10,
        messageCount: 0,
      }),
      modelBinding: {
        model: 'hermes/model-initial',
        defaultModel: 'hermes/model-initial',
      },
    };
    const flushedKernelSession = {
      ...initialKernelSession,
      updatedAt: 20,
      modelBinding: {
        model: 'hermes/model-initial',
        defaultModel: 'hermes/model-initial',
      },
    };
    const updatedKernelSession = {
      ...initialKernelSession,
      updatedAt: 40,
      modelBinding: {
        model: 'hermes/model-next',
        defaultModel: 'hermes/model-next',
      },
    };
    let currentProjectionKernelSession = initialKernelSession;
    let resolveFlushLoadMessages!: (messages: KernelChatMessage[]) => void;
    const flushLoadMessagesPromise = new Promise<KernelChatMessage[]>((resolve) => {
      resolveFlushLoadMessages = resolve;
    });
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Hermes Flush Model Race Session',
          createdAt: 10,
          updatedAt: 10,
          messages: [],
          model: 'hermes/model-initial',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: initialKernelSession,
          historyState: 'ready',
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [currentProjectionKernelSession];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          return currentProjectionKernelSession;
        },
        async createKernelChatSession() {
          return initialKernelSession;
        },
        async patchKernelChatSession(input) {
          assert.equal(input.instanceId, instanceId);
          assert.equal(input.sessionId, sessionId);
          assert.equal(input.model, 'hermes/model-next');
          currentProjectionKernelSession = updatedKernelSession;
          return updatedKernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-flush-model-race-run-1',
            sessionRef: initialKernelSession.ref,
            status: 'completed' as const,
            createdAt: 10,
            updatedAt: 10,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          if (currentProjectionKernelSession === initialKernelSession) {
            return flushLoadMessagesPromise;
          }

          return [];
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      const flushPromise = chatStore.getState().flushSession(sessionId);

      await flushAsyncTasks();

      currentProjectionKernelSession = flushedKernelSession;

      const modelMutationPromise = chatStore.getState().setKernelSessionModel({
        instanceId,
        sessionId,
        model: 'hermes/model-next',
      });

      await modelMutationPromise;

      const updatedState = chatStore.getState();
      const updatedSession = updatedState.sessions.find(
        (session) => session.id === sessionId && session.instanceId === instanceId,
      );
      assert.equal(updatedState.syncStateByInstance[instanceId], 'idle');
      assert.equal(updatedSession?.model, 'hermes/model-next');
      assert.equal(updatedSession?.kernelSession?.modelBinding?.model, 'hermes/model-next');

      resolveFlushLoadMessages([]);
      await flushPromise;

      const finalState = chatStore.getState();
      const finalSession = finalState.sessions.find(
        (session) => session.id === sessionId && session.instanceId === instanceId,
      );
      assert.equal(finalState.syncStateByInstance[instanceId], 'idle');
      assert.equal(finalState.lastErrorByInstance[instanceId], undefined);
      assert.equal(finalSession?.model, 'hermes/model-next');
      assert.equal(finalSession?.kernelSession?.modelBinding?.model, 'hermes/model-next');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore sendKernelMessage dispatches managed Hermes runs through the authoritative kernel adapter and refreshes session truth',
  async () => {
    const instanceId = 'local-hermes-send-session-instance';
    const sessionId = 'hermes-session-send';
    const originalBridge = getPlatformBridge();
    const kernelSessionBefore = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Authoritative Hermes Send Session',
      createdAt: 10,
      updatedAt: 10,
      messageCount: 0,
    });
    const kernelSessionAfter = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Authoritative Hermes Send Session',
      createdAt: 10,
      updatedAt: 50,
      messageCount: 2,
      lastMessagePreview: 'authoritative assistant completion',
    });
    const kernelMessages = [
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSessionAfter.ref,
        id: 'hermes-send-message-1',
        role: 'user',
        text: 'hello hermes',
        timestamp: 20,
      }),
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSessionAfter.ref,
        id: 'hermes-send-message-2',
        role: 'assistant',
        text: 'authoritative assistant completion',
        timestamp: 50,
      }),
    ];
    const kernelRuns = [
      createAuthoritativeHermesKernelRun({
        sessionRef: kernelSessionAfter.ref,
        id: 'hermes-run-send-1',
        status: 'completed',
        createdAt: 50,
      }),
    ];
    let startRunCallCount = 0;
    let getSessionCallCount = 0;
    let loadMessagesCallCount = 0;
    let listRunsCallCount = 0;
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Authoritative Hermes Send Session',
          createdAt: 10,
          updatedAt: 10,
          messages: [],
          model: 'Hermes Model',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: kernelSessionBefore,
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSessionAfter];
        },
        async getKernelChatSession(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          getSessionCallCount += 1;
          return kernelSessionAfter;
        },
        async createKernelChatSession() {
          return kernelSessionBefore;
        },
        async patchKernelChatSession() {
          return kernelSessionAfter;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun(input) {
          assert.equal(input.instanceId, instanceId);
          assert.equal(input.sessionId, sessionId);
          assert.equal(input.content, 'hello hermes');
          assert.equal(input.model, 'hermes/model-a');
          startRunCallCount += 1;
          return {
            id: 'hermes-run-send-1',
            sessionRef: kernelSessionAfter.ref,
            status: 'completed' as const,
            createdAt: 50,
            updatedAt: 50,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          loadMessagesCallCount += 1;
          return kernelMessages;
        },
        async listKernelChatRuns(requestedInstanceId, requestedSessionId) {
          assert.equal(requestedInstanceId, instanceId);
          assert.equal(requestedSessionId, sessionId);
          listRunsCallCount += 1;
          return kernelRuns;
        },
      },
    });

    try {
      const result = await chatStore.getState().sendKernelMessage({
        instanceId,
        sessionId,
        content: 'hello hermes',
        model: 'hermes/model-a',
      });

      const state = chatStore.getState();
      const session = state.sessions.find((entry) => entry.id === sessionId);

      assert.equal(result.runId, 'hermes-run-send-1');
      assert.equal(startRunCallCount, 1);
      assert.equal(getSessionCallCount, 1);
      assert.equal(loadMessagesCallCount, 1);
      assert.equal(listRunsCallCount, 1);
      assert.equal(state.syncStateByInstance[instanceId] ?? 'idle', 'idle');
      assert.equal(state.lastErrorByInstance[instanceId], undefined);
      assert.equal(session?.kernelSession?.authority.kind, 'sqlite');
      assert.deepEqual(session?.kernelRuns, kernelRuns);
      assert.equal(session?.updatedAt, 50);
      assert.equal(session?.lastMessagePreview, 'authoritative assistant completion');
      assert.deepEqual(
        session?.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        })),
        [
          {
            id: 'hermes-send-message-1',
            role: 'user',
            content: 'hello hermes',
          },
          {
            id: 'hermes-send-message-2',
            role: 'assistant',
            content: 'authoritative assistant completion',
          },
        ],
      );
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore sendKernelMessage forwards requestText to authoritative kernel runs when the raw content is empty',
  async () => {
    const instanceId = 'local-hermes-request-text-instance';
    const sessionId = 'hermes-session-request-text';
    const requestText =
      'The user sent attachments without additional text.\n\nAttachments:\n1. [file] report.pdf';
    const originalBridge = getPlatformBridge();
    const kernelSessionBefore = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Hermes Request Text Session',
      createdAt: 10,
      updatedAt: 10,
      messageCount: 0,
    });
    const kernelSessionAfter = {
      ...kernelSessionBefore,
      updatedAt: 60,
      messageCount: 2,
      lastMessagePreview: 'attachment-aware assistant completion',
    };
    const kernelMessages = [
      createAuthoritativeHermesKernelMessage({
        instanceId,
        sessionId,
        messageId: 'hermes-request-text-message-1',
        role: 'user',
        text: requestText,
        createdAt: 50,
        updatedAt: 50,
        runId: 'hermes-run-request-text-1',
      }),
      createAuthoritativeHermesKernelMessage({
        instanceId,
        sessionId,
        messageId: 'hermes-request-text-message-2',
        role: 'assistant',
        text: 'attachment-aware assistant completion',
        createdAt: 60,
        updatedAt: 60,
        runId: 'hermes-run-request-text-1',
      }),
    ];
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Hermes Request Text Session',
          createdAt: 10,
          updatedAt: 10,
          messages: [],
          model: 'Hermes Model',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: kernelSessionBefore,
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSessionAfter];
        },
        async getKernelChatSession() {
          return kernelSessionAfter;
        },
        async createKernelChatSession() {
          return kernelSessionBefore;
        },
        async patchKernelChatSession() {
          return kernelSessionAfter;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun(input) {
          assert.equal(input.instanceId, instanceId);
          assert.equal(input.sessionId, sessionId);
          assert.equal(input.content, requestText);
          assert.equal(input.model, 'hermes/model-request-text');
          return {
            id: 'hermes-run-request-text-1',
            sessionRef: kernelSessionAfter.ref,
            status: 'completed' as const,
            createdAt: 50,
            updatedAt: 60,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages() {
          return kernelMessages;
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      const result = await chatStore.getState().sendKernelMessage({
        instanceId,
        sessionId,
        content: '',
        requestText,
        attachments: [
          {
            id: 'attachment-report',
            kind: 'file',
            name: 'report.pdf',
          },
        ],
        model: 'hermes/model-request-text',
      });

      const session = chatStore
        .getState()
        .sessions.find((entry) => entry.id === sessionId && entry.instanceId === instanceId);

      assert.equal(result.runId, 'hermes-run-request-text-1');
      assert.equal(session?.lastMessagePreview, 'attachment-aware assistant completion');
      assert.deepEqual(
        session?.messages.map((message) => message.content),
        [requestText, 'attachment-aware assistant completion'],
      );
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore sendKernelMessage composes attachment-aware request text for authoritative kernel runs when requestText is omitted',
  async () => {
    const instanceId = 'local-hermes-attachment-only-instance';
    const sessionId = 'hermes-session-attachment-only';
    const requestText =
      'The user sent attachments without additional text.\n\nAttachments:\n1. [file] report.pdf';
    const originalBridge = getPlatformBridge();
    const kernelSessionBefore = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Hermes Attachment Session',
      createdAt: 10,
      updatedAt: 10,
      messageCount: 0,
    });
    const kernelSessionAfter = {
      ...kernelSessionBefore,
      updatedAt: 60,
      messageCount: 2,
      lastMessagePreview: 'attachment-aware assistant completion',
    };
    const kernelMessages = [
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSessionAfter.ref,
        id: 'hermes-attachment-message-1',
        role: 'user',
        text: requestText,
        timestamp: 50,
      }),
      createAuthoritativeHermesKernelMessage({
        sessionRef: kernelSessionAfter.ref,
        id: 'hermes-attachment-message-2',
        role: 'assistant',
        text: 'attachment-aware assistant completion',
        timestamp: 60,
      }),
    ];
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Hermes Attachment Session',
          createdAt: 10,
          updatedAt: 10,
          messages: [],
          model: 'Hermes Model',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession: kernelSessionBefore,
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSessionAfter];
        },
        async getKernelChatSession() {
          return kernelSessionAfter;
        },
        async createKernelChatSession() {
          return kernelSessionBefore;
        },
        async patchKernelChatSession() {
          return kernelSessionAfter;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun(input) {
          assert.equal(input.instanceId, instanceId);
          assert.equal(input.sessionId, sessionId);
          assert.equal(input.content, requestText);
          assert.equal(input.model, 'hermes/model-attachment-only');
          return {
            id: 'hermes-run-attachment-only-1',
            sessionRef: kernelSessionAfter.ref,
            status: 'completed' as const,
            createdAt: 50,
            updatedAt: 60,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages() {
          return kernelMessages;
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      const result = await chatStore.getState().sendKernelMessage({
        instanceId,
        sessionId,
        content: '',
        attachments: [
          {
            id: 'attachment-report',
            kind: 'file',
            name: 'report.pdf',
          },
        ],
        model: 'hermes/model-attachment-only',
      });

      const session = chatStore
        .getState()
        .sessions.find((entry) => entry.id === sessionId && entry.instanceId === instanceId);

      assert.equal(result.runId, 'hermes-run-attachment-only-1');
      assert.equal(session?.lastMessagePreview, 'attachment-aware assistant completion');
      assert.deepEqual(
        session?.messages.map((message) => message.content),
        [requestText, 'attachment-aware assistant completion'],
      );
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore sendKernelMessage rejects empty authoritative kernel sends before dispatch',
  async () => {
    const instanceId = 'local-hermes-empty-message-instance';
    const sessionId = 'hermes-session-empty-message';
    const originalBridge = getPlatformBridge();
    const kernelSession = createAuthoritativeHermesKernelSession({
      instanceId,
      sessionId,
      title: 'Hermes Empty Message Session',
      createdAt: 10,
      updatedAt: 10,
      messageCount: 0,
    });
    let startRunCallCount = 0;
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Hermes Empty Message Session',
          createdAt: 10,
          updatedAt: 10,
          messages: [],
          model: 'Hermes Model',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession,
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession() {
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession() {
          return kernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          startRunCallCount += 1;
          return {
            id: 'hermes-run-empty-message-1',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 50,
            updatedAt: 50,
            abortable: false,
          };
        },
        async abortKernelChatRun() {
          return false;
        },
        async loadKernelChatMessages() {
          return [];
        },
        async listKernelChatRuns() {
          return [];
        },
      },
    });

    try {
      await assert.rejects(
        () =>
          chatStore.getState().sendKernelMessage({
            instanceId,
            sessionId,
            content: '   ',
          }),
        /Cannot send an empty chat message\./,
      );
      assert.equal(startRunCallCount, 0);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore abortSession delegates managed Hermes aborts through the authoritative kernel adapter',
  async () => {
    const instanceId = 'local-hermes-abort-session-instance';
    const sessionId = 'hermes-session-abort';
    const originalBridge = getPlatformBridge();
    const kernelSession = {
      ...createAuthoritativeHermesKernelSession({
        instanceId,
        sessionId,
        title: 'Authoritative Hermes Abort Session',
        createdAt: 10,
        updatedAt: 30,
        messageCount: 2,
      }),
      activeRunId: 'hermes-run-abort-1',
    };
    const abortCalls: Array<{
      instanceId: string;
      sessionId: string;
      runId: string | null | undefined;
    }> = [];
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: sessionId,
          title: 'Authoritative Hermes Abort Session',
          createdAt: 10,
          updatedAt: 30,
          messages: [],
          model: 'Hermes Model',
          instanceId,
          transport: 'kernelAdapter',
          kernelSession,
        },
      ],
      activeSessionIdByInstance: {
        [instanceId]: sessionId,
      },
    }));

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          return createLocalManagedHermesInstance(requestedInstanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listKernelChatSessions() {
          return [kernelSession];
        },
        async getKernelChatSession() {
          return kernelSession;
        },
        async createKernelChatSession() {
          return kernelSession;
        },
        async patchKernelChatSession() {
          return kernelSession;
        },
        async deleteKernelChatSession() {},
        async startKernelChatRun() {
          return {
            id: 'hermes-run-abort-1',
            sessionRef: kernelSession.ref,
            status: 'completed' as const,
            createdAt: 30,
            updatedAt: 30,
            abortable: false,
          };
        },
        async abortKernelChatRun(requestedInstanceId, requestedSessionId, requestedRunId) {
          abortCalls.push({
            instanceId: requestedInstanceId,
            sessionId: requestedSessionId,
            runId: requestedRunId,
          });
          return false;
        },
        async loadKernelChatMessages() {
          return [];
        },
      },
    });

    try {
      assert.equal(
        await chatStore.getState().abortSession({
          instanceId,
          sessionId,
        }),
        false,
      );
      assert.deepEqual(abortCalls, [
        {
          instanceId,
          sessionId,
          runId: 'hermes-run-abort-1',
        },
      ]);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);
