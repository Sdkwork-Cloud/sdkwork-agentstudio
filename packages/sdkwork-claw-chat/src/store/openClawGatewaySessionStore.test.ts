import assert from 'node:assert/strict';
import {
  OpenClawGatewaySessionStore,
  type OpenClawGatewayClientLike,
} from './openClawGatewaySessionStore.ts';
import { OpenClawGatewayRequestError } from '../services/openclaw/gatewayProtocol.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

async function waitFor(check: () => boolean, timeoutMs = 1_000) {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition.');
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

type ListenerRegistry = {
  agent: Array<(payload: Record<string, unknown>) => void>;
  chat: Array<(payload: Record<string, unknown>) => void>;
  connection: Array<(payload: Record<string, unknown>) => void>;
  gap: Array<(payload: { expected: number; received: number }) => void>;
  'session.message': Array<(payload: Record<string, unknown>) => void>;
  'sessions.changed': Array<(payload: unknown) => void>;
};

class MockGatewayClient implements OpenClawGatewayClientLike {
  readonly listeners: ListenerRegistry = {
    agent: [],
    chat: [],
    connection: [],
    gap: [],
    'session.message': [],
    'sessions.changed': [],
  };
  readonly historyCalls: string[] = [];
  readonly historyRequestParams: Array<Record<string, unknown>> = [];
  readonly listSessionsCalls: Array<Record<string, unknown>> = [];
  readonly modelsListCalls: Array<Record<string, unknown>> = [];
  readonly patchCalls: Array<Record<string, unknown>> = [];
  readonly sendCalls: Array<Record<string, unknown>> = [];
  readonly deleteCalls: Array<Record<string, unknown>> = [];
  readonly resetCalls: Array<Record<string, unknown>> = [];
  readonly subscribeSessionMessagesCalls: string[] = [];
  readonly unsubscribeSessionMessagesCalls: string[] = [];
  subscribeCount = 0;
  disconnectCount = 0;
  sendError: Error | null = null;
  abortError: Error | null = null;
  subscribeError: Error | null = null;
  subscribeSessionMessagesError: Error | null = null;
  unsubscribeSessionMessagesError: Error | null = null;
  shouldFailDelete = false;
  shouldFailReset = false;
  private connectHello: {
    type: 'hello-ok';
    protocol: number;
    features?: {
      methods?: string[];
      events?: string[];
    };
  } = {
    type: 'hello-ok',
    protocol: 3,
  };
  private sessionsResult: {
    ts: number;
    path: string;
    count: number;
    defaults: {
      modelProvider: string | null;
      model: string | null;
      contextTokens: number | null;
    };
    sessions: Array<Record<string, unknown>>;
  };
  private histories: Record<
    string,
    {
      thinkingLevel?: string | null;
      messages?: Array<Record<string, unknown>>;
    }
  >;
  private deferredHistories = new Map<
    string,
    {
      promise: Promise<{ thinkingLevel?: string | null; messages?: Array<Record<string, unknown>> }>;
      resolve: (value: { thinkingLevel?: string | null; messages?: Array<Record<string, unknown>> }) => void;
    }
  >();
  private historyErrors = new Map<string, Error>();

  constructor(
    sessionsResult: {
      ts: number;
      path: string;
      count: number;
      defaults: {
        modelProvider: string | null;
        model: string | null;
        contextTokens: number | null;
      };
      sessions: Array<Record<string, unknown>>;
    },
    histories: Record<
      string,
      {
        thinkingLevel?: string | null;
        messages?: Array<Record<string, unknown>>;
      }
    >,
  ) {
    this.sessionsResult = sessionsResult;
    this.histories = histories;
  }

  async connect() {
    return this.connectHello;
  }

  on(event: keyof ListenerRegistry, listener: any) {
    this.listeners[event].push(listener);
    return () => {
      this.listeners[event] = this.listeners[event].filter((entry) => entry !== listener) as any;
    };
  }

  async subscribeSessions() {
    this.subscribeCount += 1;
    if (this.subscribeError) {
      throw this.subscribeError;
    }
    return { ok: true };
  }

  async subscribeSessionMessages(params: { key: string }) {
    this.subscribeSessionMessagesCalls.push(params.key);
    if (this.subscribeSessionMessagesError) {
      throw this.subscribeSessionMessagesError;
    }
    return {
      subscribed: true,
      key: params.key,
    };
  }

  async unsubscribeSessionMessages(params: { key: string }) {
    this.unsubscribeSessionMessagesCalls.push(params.key);
    if (this.unsubscribeSessionMessagesError) {
      throw this.unsubscribeSessionMessagesError;
    }
    return {
      subscribed: false,
      key: params.key,
    };
  }

  async listSessions(params?: Record<string, unknown>) {
    this.listSessionsCalls.push(params ?? {});
    return this.sessionsResult;
  }

  async getChatHistory(params: { sessionKey: string; limit?: number; maxChars?: number }) {
    this.historyCalls.push(params.sessionKey);
    this.historyRequestParams.push({ ...params });
    const historyError = this.historyErrors.get(params.sessionKey);
    if (historyError) {
      throw historyError;
    }
    const deferred = this.deferredHistories.get(params.sessionKey);
    if (deferred) {
      return deferred.promise;
    }
    return this.histories[params.sessionKey] ?? { messages: [], thinkingLevel: null };
  }

  async listModels(params?: Record<string, unknown>) {
    this.modelsListCalls.push(params ?? {});
    return {
      models: [
        {
          id: 'openai/gpt-4.1',
          name: 'GPT-4.1',
          provider: 'openai',
        },
      ],
    };
  }

  async patchSession(params: Record<string, unknown>) {
    this.patchCalls.push(params);
    return {
      ok: true,
    };
  }

  async sendChatMessage(params: Record<string, unknown>) {
    this.sendCalls.push(params);
    if (this.sendError) {
      throw this.sendError;
    }
    return {
      runId: 'run-1',
    };
  }

  async abortChatRun() {
    if (this.abortError) {
      throw this.abortError;
    }
    return { aborted: true };
  }

  async resetSession(params: Record<string, unknown>) {
    this.resetCalls.push(params);
    if (this.shouldFailReset) {
      throw new Error('reset failed');
    }
    return { ok: true };
  }

  async deleteSession(params: Record<string, unknown>) {
    this.deleteCalls.push(params);
    if (this.shouldFailDelete) {
      throw new Error('delete failed');
    }
    return { ok: true };
  }

  disconnect() {
    this.disconnectCount += 1;
  }

  emitChat(payload: Record<string, unknown>) {
    for (const listener of this.listeners.chat) {
      listener(payload);
    }
  }

  emitAgent(payload: Record<string, unknown>) {
    for (const listener of this.listeners.agent) {
      listener(payload);
    }
  }

  emitSessionsChanged(payload: unknown) {
    for (const listener of this.listeners['sessions.changed']) {
      listener(payload);
    }
  }

  emitConnection(payload: Record<string, unknown>) {
    for (const listener of this.listeners.connection) {
      listener(payload);
    }
  }

  emitGap(payload: { expected: number; received: number }) {
    for (const listener of this.listeners.gap) {
      listener(payload);
    }
  }

  emitSessionMessage(payload: Record<string, unknown>) {
    for (const listener of this.listeners['session.message']) {
      listener(payload);
    }
  }

  replaceSessions(
    sessions: Array<Record<string, unknown>>,
    count = sessions.length,
  ) {
    this.sessionsResult = {
      ...this.sessionsResult,
      count,
      sessions,
    };
  }

  setHistory(
    sessionKey: string,
    history: { thinkingLevel?: string | null; messages?: Array<Record<string, unknown>> },
  ) {
    this.histories[sessionKey] = history;
    this.historyErrors.delete(sessionKey);
  }

  setHistoryError(sessionKey: string, error: Error | null) {
    if (error) {
      this.historyErrors.set(sessionKey, error);
      return;
    }

    this.historyErrors.delete(sessionKey);
  }

  deferHistory(sessionKey: string) {
    let resolve!: (value: {
      thinkingLevel?: string | null;
      messages?: Array<Record<string, unknown>>;
    }) => void;
    const promise = new Promise<{
      thinkingLevel?: string | null;
      messages?: Array<Record<string, unknown>>;
    }>((res) => {
      resolve = res;
    });
    this.deferredHistories.set(sessionKey, {
      promise,
      resolve,
    });
    return {
      resolve: (value: {
        thinkingLevel?: string | null;
        messages?: Array<Record<string, unknown>>;
      }) => {
        this.deferredHistories.delete(sessionKey);
        this.histories[sessionKey] = value;
        resolve(value);
      },
    };
  }

  setConnectHello(value: {
    type: 'hello-ok';
    protocol: number;
    features?: {
      methods?: string[];
      events?: string[];
    };
  }) {
    this.connectHello = value;
  }
}

await runTest(
  'openclaw gateway session store streams agent tool events into a single live tool card message',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 900,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-agent-tools`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'search for gateway docs',
      model: 'OpenClaw A',
    });

    client.emitAgent({
      sessionKey: draft.id,
      runId: 'run-1',
      stream: 'tool',
      data: {
        phase: 'start',
        toolCallId: 'tool-web-search',
        name: 'web_search',
        args: {
          query: 'openclaw gateway docs',
        },
      },
    });

    let session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
        runId: message.runId ?? null,
        toolCards:
          message.toolCards?.map((toolCard) => ({
            kind: toolCard.kind,
            name: toolCard.name,
            toolCallId: toolCard.toolCallId ?? null,
            argumentsText: toolCard.argumentsText ?? null,
            text: toolCard.text ?? null,
            isError: toolCard.isError ?? null,
            detail: toolCard.detail ?? null,
            preview: toolCard.preview ?? null,
          })) ?? [],
      })),
      [
        {
          role: 'user',
          content: 'search for gateway docs',
          runId: null,
          toolCards: [],
        },
        {
          role: 'tool',
          content: '',
          runId: 'run-1',
          toolCards: [
            {
              kind: 'call',
              name: 'web_search',
              toolCallId: 'tool-web-search',
              argumentsText: '{"query":"openclaw gateway docs"}',
              text: null,
              isError: null,
              detail: 'openclaw gateway docs',
              preview: null,
            },
          ],
        },
      ],
    );

    client.emitAgent({
      sessionKey: draft.id,
      runId: 'run-1',
      stream: 'tool',
      data: {
        phase: 'update',
        toolCallId: 'tool-web-search',
        name: 'web_search',
        partialResult: 'docs.openclaw.ai/tools/web',
      },
    });

    session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.at(-1)?.toolCards?.map((toolCard) => ({
        kind: toolCard.kind,
        name: toolCard.name,
        toolCallId: toolCard.toolCallId ?? null,
        argumentsText: toolCard.argumentsText ?? null,
        text: toolCard.text ?? null,
        isError: toolCard.isError ?? null,
        detail: toolCard.detail ?? null,
        preview: toolCard.preview ?? null,
      })),
      [
        {
          kind: 'call',
          name: 'web_search',
          toolCallId: 'tool-web-search',
          argumentsText: '{"query":"openclaw gateway docs"}',
          text: null,
          isError: null,
          detail: 'openclaw gateway docs',
          preview: null,
        },
        {
          kind: 'result',
          name: 'web_search',
          toolCallId: 'tool-web-search',
          argumentsText: null,
          text: 'docs.openclaw.ai/tools/web',
          isError: false,
          detail: null,
          preview: 'docs.openclaw.ai/tools/web',
        },
      ],
    );

    client.emitAgent({
      sessionKey: draft.id,
      runId: 'run-1',
      stream: 'tool',
      data: {
        phase: 'result',
        toolCallId: 'tool-web-search',
        name: 'web_search',
        result: 'Found docs.openclaw.ai/tools/web',
      },
    });

    session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
        preview:
          message.toolCards?.map((toolCard) => toolCard.preview ?? toolCard.detail ?? null) ?? [],
      })),
      [
        {
          role: 'user',
          content: 'search for gateway docs',
          preview: [],
        },
        {
          role: 'tool',
          content: '',
          preview: ['openclaw gateway docs', 'Found docs.openclaw.ai/tools/web'],
        },
      ],
    );
    assert.equal(session?.lastMessagePreview, 'Found docs.openclaw.ai/tools/web');
  },
);

await runTest(
  'openclaw gateway session store emits catalog refresh notifications for agent mutation events',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 950,
    });
    const catalogEvents: Array<{ instanceId: string; name: string | null }> = [];
    const lifecycleEvents: Array<{
      instanceId: string;
      kernelId: string;
      type: string;
      agentId: string | null;
    }> = [];
    const unsubscribe = store.subscribeAgentCatalogChanged((event) => {
      const data =
        event.payload.data && typeof event.payload.data === 'object'
          ? (event.payload.data as Record<string, unknown>)
          : null;
      catalogEvents.push({
        instanceId: event.instanceId,
        name: typeof data?.name === 'string' ? data.name : null,
      });
    });
    const unsubscribeLifecycle = store.subscribeAgentLifecycle((event) => {
      lifecycleEvents.push({
        instanceId: event.instanceId,
        kernelId: event.kernelId,
        type: event.type,
        agentId: event.agentId,
      });
    });

    await store.hydrateInstance('instance-a');

    client.emitAgent({
      sessionKey: 'thread:agent-creator',
      runId: 'run-1',
      stream: 'tool',
      data: {
        phase: 'start',
        toolCallId: 'tool-create-agent',
        name: 'agents.create',
      },
    });
    client.emitAgent({
      sessionKey: 'thread:agent-creator',
      runId: 'run-1',
      stream: 'tool',
      data: {
        phase: 'result',
        toolCallId: 'tool-search',
        name: 'web_search',
        result: 'docs',
      },
    });
    assert.deepEqual(catalogEvents, []);
    assert.deepEqual(lifecycleEvents, []);

    client.emitAgent({
      sessionKey: 'thread:agent-creator',
      runId: 'run-1',
      stream: 'tool',
      data: {
        phase: 'result',
        toolCallId: 'tool-create-agent',
        name: 'agents.create',
        result: {
          agentId: 'research',
        },
      },
    });
    client.emitAgent({
      stream: 'agent.catalog',
      action: 'created',
      agentId: 'ops',
    });
    client.emitAgent({
      sessionKey: 'thread:agent-creator',
      runId: 'run-1',
      stream: 'tool',
      data: {
        phase: 'result',
        toolCallId: 'tool-config-patch',
        name: 'gateway',
        args: {
          method: 'config.patch',
          params: {
            raw: {
              agents: {
                list: [
                  {
                    id: 'writer',
                  },
                ],
              },
            },
          },
        },
      },
    });

    assert.deepEqual(catalogEvents, [
      {
        instanceId: 'instance-a',
        name: 'agents.create',
      },
      {
        instanceId: 'instance-a',
        name: null,
      },
      {
        instanceId: 'instance-a',
        name: 'gateway',
      },
    ]);
    assert.deepEqual(lifecycleEvents, [
      {
        instanceId: 'instance-a',
        kernelId: 'openclaw',
        type: 'created',
        agentId: 'research',
      },
      {
        instanceId: 'instance-a',
        kernelId: 'openclaw',
        type: 'created',
        agentId: 'ops',
      },
      {
        instanceId: 'instance-a',
        kernelId: 'openclaw',
        type: 'catalogChanged',
        agentId: 'writer',
      },
    ]);

    unsubscribe();
    unsubscribeLifecycle();
    client.emitAgent({
      sessionKey: 'thread:agent-creator',
      runId: 'run-1',
      stream: 'tool',
      data: {
        phase: 'result',
        toolCallId: 'tool-update-agent',
        name: 'agents.update',
      },
    });

    assert.equal(catalogEvents.length, 3);
    assert.equal(lifecycleEvents.length, 3);
  },
);

await runTest(
  'openclaw gateway session store ignores delta events from another run while a session is still streaming',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 410,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-streaming`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'user message',
      model: 'OpenClaw A',
    });

    client.emitChat({
      runId: 'run-announce',
      sessionKey: draft.id,
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'sub-agent partial' }],
      },
    });

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.equal(session?.runId, 'run-1');
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'user', content: 'user message' }],
    );
    assert.deepEqual(client.historyCalls, []);
  },
);

await runTest(
  'openclaw gateway session store forwards an optional history maxChars cap to the gateway client',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-history-cap';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'History Cap',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'history message' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 415,
      historyMaxChars: 4096,
    });

    await store.hydrateInstance('instance-a');

    assert.deepEqual(client.historyRequestParams, [
      {
        sessionKey: sessionId,
        limit: 200,
        maxChars: 4096,
      },
    ]);
  },
);

await runTest(
  'openclaw gateway session store keeps the all-sessions order stable when selecting a session hydrates newer history',
  async () => {
    const sessionA = 'claw-studio:instance-a:session-order-a';
    const sessionB = 'claw-studio:instance-a:session-order-b';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-order-stability.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'Recent Session A',
            updatedAt: 220,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: sessionB,
            label: 'Older Session B',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionA]: {
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'session A history' }],
              timestamp: 220,
            },
          ],
        },
        [sessionB]: {
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'session B selected history' }],
              timestamp: 320,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 500,
    });

    await store.hydrateInstance('instance-a');
    assert.deepEqual(
      store.getSnapshot('instance-a').sessions.map((session) => session.id),
      [sessionA, sessionB],
    );

    await store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: sessionB,
    });

    const snapshot = store.getSnapshot('instance-a');
    const selectedSession = snapshot.sessions.find((session) => session.id === sessionB);

    assert.deepEqual(
      snapshot.sessions.map((session) => session.id),
      [sessionA, sessionB],
    );
    assert.deepEqual(
      selectedSession?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        {
          role: 'assistant',
          content: 'session B selected history',
        },
      ],
    );
    assert.equal(selectedSession?.updatedAt, 210);
  },
);

await runTest(
  'openclaw gateway session store resolves history maxChars per instance when a resolver is provided',
  async () => {
    const sessionA = 'claw-studio:instance-a:session-history-cap';
    const sessionB = 'claw-studio:instance-b:session-history-cap';
    const clientA = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'History Cap A',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionA]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'history message A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );
    const clientB = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-b.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionB,
            label: 'History Cap B',
            updatedAt: 220,
            kind: 'direct',
            model: 'OpenClaw B',
          },
        ],
      },
      {
        [sessionB]: {
          thinkingLevel: 'medium',
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'history message B' }],
              timestamp: 220,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      async getClient(instanceId) {
        return instanceId === 'instance-a' ? clientA : clientB;
      },
      now: () => 415,
      async resolveHistoryMaxChars(instanceId) {
        return instanceId === 'instance-a' ? 4096 : 2048;
      },
    });

    await store.hydrateInstance('instance-a');
    await store.hydrateInstance('instance-b');

    assert.deepEqual(clientA.historyRequestParams, [
      {
        sessionKey: sessionA,
        limit: 200,
        maxChars: 4096,
      },
    ]);
    assert.deepEqual(clientB.historyRequestParams, [
      {
        sessionKey: sessionB,
        limit: 200,
        maxChars: 2048,
      },
    ]);
  },
);

await runTest(
  'openclaw gateway session store clears stale history and shows a targeted operator.read error when chat history is unauthorized',
  async () => {
    const sessionA = 'claw-studio:instance-a:session-history-unauthorized-a';
    const sessionB = 'claw-studio:instance-a:session-history-unauthorized-b';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'Unauthorized A',
            updatedAt: 220,
            kind: 'direct',
            model: 'OpenClaw A',
            thinkingLevel: 'high',
            fastMode: true,
            verboseLevel: 'full',
            reasoningLevel: 'on',
          },
          {
            key: sessionB,
            label: 'Unauthorized B',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
            thinkingLevel: 'low',
            fastMode: false,
            verboseLevel: 'off',
            reasoningLevel: 'off',
          },
        ],
      },
      {
        [sessionA]: {
          thinkingLevel: 'high',
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'cached history that must be cleared' }],
              timestamp: 220,
            },
          ],
        },
        [sessionB]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'session b message' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 420,
    });

    await store.hydrateInstance('instance-a');

    let snapshot = store.getSnapshot('instance-a');
    let session = snapshot.sessions.find((entry) => entry.id === sessionA);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'assistant', content: 'cached history that must be cleared' }],
    );
    assert.equal(session?.thinkingLevel, 'high');

    await store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: sessionB,
    });

    client.setHistoryError(
      sessionA,
      new OpenClawGatewayRequestError({
        code: 'PERMISSION_DENIED',
        message: 'not allowed',
        details: {
          code: 'AUTH_UNAUTHORIZED',
        },
      }),
    );

    await store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: sessionA,
    });

    snapshot = store.getSnapshot('instance-a');
    session = snapshot.sessions.find((entry) => entry.id === sessionA);

    assert.equal(snapshot.activeSessionId, sessionA);
    assert.equal(snapshot.syncState, 'error');
    assert.match(snapshot.lastError ?? '', /operator\.read/);
    assert.deepEqual(session?.messages, []);
    assert.equal(session?.lastMessagePreview, undefined);
    assert.equal(session?.thinkingLevel, 'high');
    assert.equal(session?.fastMode, true);
    assert.equal(session?.verboseLevel, 'full');
    assert.equal(session?.reasoningLevel, 'on');
  },
);

await runTest(
  'openclaw gateway session store formats missing operator.read history errors even when the gateway only returns a message string',
  async () => {
    const sessionA = 'claw-studio:instance-a:session-history-scope-message';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'Scope Message',
            updatedAt: 215,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {},
    );
    client.setHistoryError(
      sessionA,
      new OpenClawGatewayRequestError({
        code: 'PERMISSION_DENIED',
        message: 'missing scope: operator.read',
      }),
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 430,
    });

    await store.hydrateInstance('instance-a');

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === sessionA);
    assert.ok(session);
    assert.equal(snapshot.syncState, 'error');
    assert.match(snapshot.lastError ?? '', /operator\.read/);
    assert.deepEqual(session?.messages, []);
    assert.equal(session?.thinkingLevel, null);
  },
);

await runTest(
  'openclaw gateway session store formats structured non-auth gateway failures for chat send',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );
    client.sendError = new OpenClawGatewayRequestError({
      code: 'INVALID_REQUEST',
      message: 'Fetch failed',
      details: {
        code: 'CONTROL_UI_ORIGIN_NOT_ALLOWED',
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 440,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-send-error`;
      },
    });
    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');

    await assert.rejects(() =>
      store.sendMessage({
        instanceId: 'instance-a',
        sessionId: draft.id,
        content: 'hello',
        model: 'OpenClaw A',
      }),
    );

    const snapshot = store.getSnapshot('instance-a');
    assert.match(snapshot.lastError ?? '', /origin not allowed/i);
  },
);

await runTest(
  'openclaw gateway session store appends an assistant error message when chat send fails',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );
    client.sendError = new OpenClawGatewayRequestError({
      code: 'INVALID_REQUEST',
      message: 'Fetch failed',
      details: {
        code: 'CONTROL_UI_ORIGIN_NOT_ALLOWED',
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 445,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-send-error-message`;
      },
    });
    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');

    await assert.rejects(() =>
      store.sendMessage({
        instanceId: 'instance-a',
        sessionId: draft.id,
        content: 'hello',
        model: 'OpenClaw A',
      }),
    );

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'hello' },
        {
          role: 'assistant',
          content:
            'Error: origin not allowed (open the Control UI from the gateway host or allow it in gateway.controlUi.allowedOrigins)',
        },
      ],
    );
    assert.match(snapshot.lastError ?? '', /origin not allowed/i);
  },
);

await runTest(
  'openclaw gateway session store formats structured non-auth gateway failures for chat abort',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 450,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-abort-error`;
      },
    });
    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'hello',
      model: 'OpenClaw A',
    });

    client.abortError = new OpenClawGatewayRequestError({
      code: 'INVALID_REQUEST',
      message: 'Fetch failed',
      details: {
        code: 'CONTROL_UI_DEVICE_IDENTITY_REQUIRED',
      },
    });

    const result = await store.abortRun({
      instanceId: 'instance-a',
      sessionId: draft.id,
    });

    assert.equal(result, false);
    const snapshot = store.getSnapshot('instance-a');
    assert.match(snapshot.lastError ?? '', /device identity required/i);
  },
);

await runTest(
  'openclaw gateway session store keeps the active run when another run finishes in the same session',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 420,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-other-run`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'user message',
      model: 'OpenClaw A',
    });

    client.emitChat({
      runId: 'run-announce',
      sessionKey: draft.id,
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'sub-agent findings' }],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.equal(session?.runId, 'run-1');
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'user message' },
        { role: 'assistant', content: 'sub-agent findings' },
      ],
    );
    assert.deepEqual(client.historyCalls, []);
  },
);

await runTest(
  'openclaw gateway session store filters assistant NO_REPLY messages from history while keeping user content',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-no-reply-history';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'History Filter',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: null,
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'NO_REPLY' }],
            },
            {
              role: 'assistant',
              text: '  NO_REPLY  ',
            },
            {
              role: 'user',
              content: [{ type: 'text', text: 'NO_REPLY' }],
            },
            {
              role: 'assistant',
              text: 'real reply',
              content: 'NO_REPLY',
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 430,
    });

    await store.hydrateInstance('instance-a');

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'NO_REPLY' },
        { role: 'assistant', content: 'real reply' },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store filters assistant ANNOUNCE_SKIP and REPLY_SKIP control replies from history while keeping user content',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-control-reply-history';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Control Reply History Filter',
            updatedAt: 211,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: null,
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'ANNOUNCE_SKIP' }],
            },
            {
              role: 'assistant',
              text: ' REPLY_SKIP ',
            },
            {
              role: 'user',
              content: [{ type: 'text', text: 'REPLY_SKIP' }],
            },
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'real reply' }],
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 431,
    });

    await store.hydrateInstance('instance-a');

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'REPLY_SKIP' },
        { role: 'assistant', content: 'real reply' },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store ignores assistant NO_REPLY chat events',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 440,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-no-reply-chat`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'user message',
      model: 'OpenClaw A',
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'NO_REPLY' }],
      },
    });

    let snapshot = store.getSnapshot('instance-a');
    let session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'user', content: 'user message' }],
    );

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'NO_REPLY' }],
      },
    });

    await waitFor(() => client.historyCalls.filter((entry) => entry === draft.id).length === 1);

    snapshot = store.getSnapshot('instance-a');
    session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.equal(session?.runId, null);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'user', content: 'user message' }],
    );
  },
);

await runTest(
  'openclaw gateway session store ignores assistant ANNOUNCE_SKIP and REPLY_SKIP chat events',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 445,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-control-reply-chat`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'user message',
      model: 'OpenClaw A',
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'ANNOUNCE_SKIP' }],
      },
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'REPLY_SKIP' }],
      },
    });

    await waitFor(() => client.historyCalls.filter((entry) => entry === draft.id).length === 1);

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.equal(session?.runId, null);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'user', content: 'user message' }],
    );
  },
);

await runTest(
  'openclaw gateway session store suppresses assistant commentary chat events until the final answer arrives',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 441,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-commentary-phase`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'user message',
      model: 'OpenClaw A',
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'delta',
      message: {
        role: 'assistant',
        phase: 'commentary',
        content: [{ type: 'text', text: 'Planning the next steps before replying.' }],
      },
    });

    let snapshot = store.getSnapshot('instance-a');
    let session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'user', content: 'user message' }],
    );

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'final',
      message: {
        role: 'assistant',
        phase: 'final_answer',
        content: [{ type: 'text', text: 'real reply' }],
      },
    });

    await waitFor(() => client.historyCalls.filter((entry) => entry === draft.id).length === 1);

    snapshot = store.getSnapshot('instance-a');
    session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'user message' },
        { role: 'assistant', content: 'real reply' },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store ignores assistant NO_REPLY transcript updates',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-no-reply-transcript';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Transcript Filter',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: null,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello' }],
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.list',
          'chat.history',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 450,
    });

    await store.hydrateInstance('instance-a');
    await waitFor(() => client.subscribeSessionMessagesCalls.includes(sessionId));

    client.emitSessionMessage({
      sessionKey: sessionId,
      messageId: 'msg-no-reply',
      message: {
        id: 'msg-no-reply',
        role: 'assistant',
        content: [{ type: 'text', text: 'NO_REPLY' }],
      },
    });

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'user', content: 'hello' }],
    );
  },
);

await runTest(
  'openclaw gateway session store isolates sessions per instance and treats gateway state as authoritative',
  async () => {
    const clientA = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: 'claw-studio:instance-a:session-2',
            label: 'A Two',
            updatedAt: 190,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const clientB = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-b.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-b:session-1',
            label: 'B One',
            updatedAt: 150,
            kind: 'direct',
            model: 'OpenClaw B',
          },
        ],
      },
      {
        'claw-studio:instance-b:session-1': {
          thinkingLevel: 'medium',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from B' }],
              timestamp: 150,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient(instanceId) {
        return instanceId === 'instance-a' ? clientA : clientB;
      },
      now: () => 300,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-1`;
      },
    });

    await store.hydrateInstance('instance-a');
    let snapshotA = store.getSnapshot('instance-a');
    assert.deepEqual(
      snapshotA.sessions.map((session) => session.id),
      ['claw-studio:instance-a:session-1', 'claw-studio:instance-a:session-2'],
    );
    assert.equal(snapshotA.activeSessionId, 'claw-studio:instance-a:session-1');
    assert.equal(snapshotA.sessions[0]?.messages[0]?.content, 'hello from A');
    assert.equal(clientA.subscribeCount, 1);

    await store.hydrateInstance('instance-b');
    const snapshotB = store.getSnapshot('instance-b');
    snapshotA = store.getSnapshot('instance-a');
    assert.deepEqual(snapshotB.sessions.map((session) => session.id), [
      'claw-studio:instance-b:session-1',
    ]);
    assert.equal(snapshotB.activeSessionId, 'claw-studio:instance-b:session-1');
    assert.equal(snapshotB.sessions[0]?.messages[0]?.content, 'hello from B');
    assert.deepEqual(
      snapshotA.sessions.map((session) => session.id),
      ['claw-studio:instance-a:session-1', 'claw-studio:instance-a:session-2'],
    );

    const draft = store.createDraftSession('instance-a', 'OpenClaw A');
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'stream to A',
      model: 'OpenClaw A',
    });
    snapshotA = store.getSnapshot('instance-a');
    const draftSessionAfterSend = snapshotA.sessions.find((session) => session.id === draft.id);
    assert.ok(draftSessionAfterSend);
    assert.deepEqual(
      draftSessionAfterSend.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'user', content: 'stream to A' }],
    );
    assert.deepEqual(clientA.sendCalls, [
      {
        sessionKey: 'claw-studio:instance-a:draft-1',
        message: 'stream to A',
        deliver: false,
        idempotencyKey: 'run-1',
      },
    ]);
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:draft-1',
        label: 'stream to A',
      },
    ]);
    clientA.patchCalls.length = 0;

    await store.setSessionModel({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      model: 'openai/gpt-4.1',
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')?.model,
      'openai/gpt-4.1',
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
    ]);

    await store.setSessionModel({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      model: null,
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')?.model,
      'OpenClaw A',
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        model: null,
      },
    ]);

    await store.setSessionThinkingLevel({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      thinkingLevel: 'high',
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')
        ?.thinkingLevel,
      'high',
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        model: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: 'high',
      },
    ]);

    await store.setSessionThinkingLevel({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      thinkingLevel: null,
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')
        ?.thinkingLevel,
      null,
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        model: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: 'high',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: null,
      },
    ]);

    await store.setSessionFastMode({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      fastMode: true,
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')
        ?.fastMode,
      true,
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        model: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: 'high',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: true,
      },
    ]);

    await store.setSessionFastMode({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      fastMode: null,
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')
        ?.fastMode,
      null,
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        model: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: 'high',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: true,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: null,
      },
    ]);

    await store.setSessionVerboseLevel({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      verboseLevel: 'full',
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')
        ?.verboseLevel,
      'full',
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        model: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: 'high',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: true,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        verboseLevel: 'full',
      },
    ]);

    await store.setSessionVerboseLevel({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      verboseLevel: null,
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')
        ?.verboseLevel,
      null,
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        model: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: 'high',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: true,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        verboseLevel: 'full',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        verboseLevel: null,
      },
    ]);

    await store.setSessionReasoningLevel({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      reasoningLevel: 'stream',
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')
        ?.reasoningLevel,
      'stream',
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        model: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: 'high',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: true,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        verboseLevel: 'full',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        verboseLevel: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        reasoningLevel: 'stream',
      },
    ]);

    await store.setSessionReasoningLevel({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      reasoningLevel: null,
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')
        ?.reasoningLevel,
      null,
    );
    assert.deepEqual(clientA.patchCalls, [
      {
        key: 'claw-studio:instance-a:session-1',
        model: 'openai/gpt-4.1',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        model: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: 'high',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        thinkingLevel: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: true,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        fastMode: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        verboseLevel: 'full',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        verboseLevel: null,
      },
      {
        key: 'claw-studio:instance-a:session-1',
        reasoningLevel: 'stream',
      },
      {
        key: 'claw-studio:instance-a:session-1',
        reasoningLevel: null,
      },
    ]);

    clientA.emitChat({
      runId: 'run-1',
      sessionKey: 'claw-studio:instance-a:draft-1',
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'partial reply' }],
      },
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.deepEqual(
      snapshotA.sessions
        .find((session) => session.id === draft.id)
        ?.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      [
        { role: 'user', content: 'stream to A' },
        { role: 'assistant', content: 'partial reply' },
      ],
    );

    clientA.emitChat({
      runId: 'run-1',
      sessionKey: 'claw-studio:instance-a:draft-1',
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'final reply' }],
      },
    });
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === draft.id)?.messages.at(-1)?.content,
      'final reply',
    );

    const remoteSessionId = 'claw-studio:instance-a:session-1';
    const remoteSessionBeforeReset = snapshotA.sessions.find(
      (session) => session.id === remoteSessionId,
    );
    assert.ok(remoteSessionBeforeReset);
    clientA.shouldFailReset = true;
    assert.equal(
      await store.resetSession({ instanceId: 'instance-a', sessionId: remoteSessionId }),
      false,
    );
    snapshotA = store.getSnapshot('instance-a');
    assert.equal(
      snapshotA.sessions.find((session) => session.id === remoteSessionId)?.messages.length,
      remoteSessionBeforeReset.messages.length,
    );

    clientA.shouldFailReset = false;
    clientA.setHistory(remoteSessionId, { messages: [], thinkingLevel: 'off' });
    assert.equal(
      await store.resetSession({ instanceId: 'instance-a', sessionId: remoteSessionId }),
      true,
    );
    snapshotA = store.getSnapshot('instance-a');
    assert.deepEqual(
      snapshotA.sessions.find((session) => session.id === remoteSessionId)?.messages,
      [],
    );
    assert.equal(
      snapshotA.sessions.find((session) => session.id === remoteSessionId)?.lastMessagePreview,
      undefined,
    );

    clientA.shouldFailDelete = true;
    assert.equal(
      await store.deleteSession({ instanceId: 'instance-a', sessionId: remoteSessionId }),
      false,
    );
    snapshotA = store.getSnapshot('instance-a');
    assert.ok(snapshotA.sessions.some((session) => session.id === remoteSessionId));

    clientA.shouldFailDelete = false;
    clientA.replaceSessions([
      {
        key: 'claw-studio:instance-a:draft-1',
        label: 'Draft Promoted',
        updatedAt: 320,
        kind: 'direct',
        model: 'OpenClaw A',
      },
      {
        key: 'claw-studio:instance-a:session-2',
        label: 'A Two',
        updatedAt: 190,
        kind: 'direct',
        model: 'OpenClaw A',
      },
    ]);
    assert.equal(
      await store.deleteSession({ instanceId: 'instance-a', sessionId: remoteSessionId }),
      true,
    );
    snapshotA = store.getSnapshot('instance-a');
    assert.ok(!snapshotA.sessions.some((session) => session.id === remoteSessionId));

    clientB.emitSessionsChanged({ source: 'remote-b' });
    assert.deepEqual(
      store.getSnapshot('instance-a').sessions.map((session) => session.id),
      ['claw-studio:instance-a:draft-1', 'claw-studio:instance-a:session-2'],
    );
  },
);

await runTest(
  'openclaw gateway session store creates a live placeholder session for control-ui chat events before sessions list refresh completes',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-live-sync.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 240,
    });

    await store.hydrateInstance('instance-a');
    assert.equal(store.getSnapshot('instance-a').activeSessionId, null);

    client.emitChat({
      runId: 'control-ui-run-1',
      sessionKey: 'agent:research:main',
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'live reply from control ui' }],
      },
    });

    const snapshot = store.getSnapshot('instance-a');
    const liveSession = snapshot.sessions.find((session) => session.id === 'agent:research:main');
    assert.ok(liveSession);
    assert.equal(snapshot.activeSessionId, 'agent:research:main');
    assert.equal(liveSession?.runId, 'control-ui-run-1');
    assert.equal(liveSession?.messages.at(-1)?.content, 'live reply from control ui');
  },
);

await runTest(
  'openclaw gateway session store normalizes remote model provider references during hydration',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: 'openai',
          model: 'gpt-4.1',
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            modelProvider: 'openai',
            model: 'gpt-4.1',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 500,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');
    assert.equal(snapshot.sessions[0]?.model, 'openai/gpt-4.1');
    assert.equal(snapshot.sessions[0]?.defaultModel, 'openai/gpt-4.1');
  },
);

await runTest(
  'openclaw gateway session store starts a new chat on the selected agent main session and syncs the requested model',
  async () => {
    const researchThreadSessionId = 'agent:research:main:thread:claw-studio:session-1';
    const researchMainSessionId = 'agent:research:main';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: researchThreadSessionId,
            label: 'Research Thread',
            updatedAt: 210,
            kind: 'direct',
            model: 'openai/gpt-4.1',
          },
        ],
      },
      {
        [researchThreadSessionId]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'Investigate the latest gateway session behavior' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 420,
    });

    await store.hydrateInstance('instance-a');
    assert.equal(store.getSnapshot('instance-a').activeSessionId, researchThreadSessionId);

    client.replaceSessions([
      {
        key: researchMainSessionId,
        label: 'Research Main',
        updatedAt: 430,
        kind: 'direct',
        model: 'openai/gpt-4.1',
      },
      {
        key: researchThreadSessionId,
        label: 'Research Thread',
        updatedAt: 210,
        kind: 'direct',
        model: 'openai/gpt-4.1',
      },
    ]);
    client.setHistory(researchMainSessionId, {
      thinkingLevel: 'low',
      messages: [],
    });

    assert.equal(
      await store.startNewSession({
        instanceId: 'instance-a',
        agentId: 'research',
        model: 'anthropic/claude-3-7-sonnet',
      }),
      researchMainSessionId,
    );

    const snapshot = store.getSnapshot('instance-a');
    assert.deepEqual(client.resetCalls.at(-1), {
      key: researchMainSessionId,
      reason: 'new',
    });
    assert.deepEqual(client.patchCalls.at(-1), {
      key: researchMainSessionId,
      model: 'anthropic/claude-3-7-sonnet',
    });
    assert.equal(snapshot.activeSessionId, researchMainSessionId);
    assert.equal(
      snapshot.sessions.find((session) => session.id === researchMainSessionId)?.model,
      'anthropic/claude-3-7-sonnet',
    );
  },
);

await runTest(
  'openclaw gateway session store requests the same readable global session metadata as the openclaw control ui during hydration',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 520,
    });

    await store.hydrateInstance('instance-a');

    assert.deepEqual(client.listSessionsCalls, [
      {
        includeGlobal: true,
        includeUnknown: true,
        includeDerivedTitles: true,
        includeLastMessage: true,
      },
    ]);
  },
);

await runTest(
  'openclaw gateway session store preserves gateway session kinds during hydration so the chat list can mirror control ui visibility rules',
  async () => {
    const directSessionId = 'agent:research:main';
    const globalSessionId = 'global:shared-session';
    const cronSessionId = 'cron:nightly-roundup';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 3,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: directSessionId,
            label: 'Research Main',
            kind: 'direct',
            updatedAt: 220,
            model: 'OpenClaw A',
          },
          {
            key: globalSessionId,
            label: 'Shared Session',
            kind: 'global',
            updatedAt: 210,
            model: 'OpenClaw A',
          },
          {
            key: cronSessionId,
            label: 'Nightly Roundup',
            kind: 'direct',
            updatedAt: 200,
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [directSessionId]: {
          thinkingLevel: 'low',
          messages: [],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 525,
    });

    await store.hydrateInstance('instance-a');

    const snapshot = store.getSnapshot('instance-a');
    assert.deepEqual(
      snapshot.sessions.map((session) => ({
        id: session.id,
        sessionKind: session.sessionKind ?? null,
      })),
      [
        {
          id: directSessionId,
          sessionKind: 'direct',
        },
        {
          id: globalSessionId,
          sessionKind: 'global',
        },
        {
          id: cronSessionId,
          sessionKind: 'direct',
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store prefers an agent main session over child thread sessions during hydration',
  async () => {
    const threadSessionId = 'agent:research:main:thread:claw-studio:session-1';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'agent:research:main',
            label: 'Research Main',
            updatedAt: 220,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: threadSessionId,
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
            lastMessagePreview: 'Thread history should stay visible',
          },
        ],
      },
      {
        'agent:research:main': {
          thinkingLevel: 'low',
          messages: [],
        },
        [threadSessionId]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'thread history should stay visible' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 530,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');

    assert.equal(snapshot.activeSessionId, 'agent:research:main');
    assert.equal(
      snapshot.sessions.find((session) => session.id === threadSessionId)?.lastMessagePreview,
      'Thread history should stay visible',
    );
  },
);

await runTest(
  'openclaw gateway session store uses explicit derived titles but keeps latest message previews out of titles during hydration',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-readable.json',
        count: 3,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'agent:research:main',
            derivedTitle: 'Weekly API Router audit',
            updatedAt: 310,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: 'claw-studio:instance-a:session-2',
            lastMessagePreview: '  Summarize the current install flow issues across macOS and Windows  ',
            updatedAt: 300,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: 'claw-studio:instance-a:session-3',
            updatedAt: 290,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'agent:research:main': {
          thinkingLevel: 'low',
          messages: [],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 510,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');

    assert.deepEqual(
      snapshot.sessions.map((session) => ({
        id: session.id,
        title: session.title,
        titleSource: session.titleSource,
        lastMessagePreview: session.lastMessagePreview ?? null,
      })),
      [
        {
          id: 'agent:research:main',
          title: 'Weekly API Router audit',
          titleSource: 'explicit',
          lastMessagePreview: null,
        },
        {
          id: 'claw-studio:instance-a:session-2',
          title: 'New Conversation',
          titleSource: 'default',
          lastMessagePreview: 'Summarize the current install flow issues across macOS and Windows',
        },
        {
          id: 'claw-studio:instance-a:session-3',
          title: 'New Conversation',
          titleSource: 'default',
          lastMessagePreview: null,
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store ignores weak technical runtime labels and does not promote latest previews during hydration',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-technical-labels.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'thread:claw-studio:install-audit',
            displayName: 'openclaw-tui',
            label: 'main',
            lastMessagePreview:
              '  Use the first user message as a ChatGPT-style title instead of runtime labels  ',
            updatedAt: 315,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'thread:claw-studio:install-audit': {
          thinkingLevel: 'medium',
          messages: [],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 520,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');

    assert.equal(snapshot.sessions[0]?.title, 'New Conversation');
    assert.equal(snapshot.sessions[0]?.titleSource, 'default');
    assert.equal(snapshot.sessions[0]?.lastMessagePreview, undefined);
  },
);

await runTest(
  'openclaw gateway session store treats date and time row labels as metadata instead of conversation titles',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-date-labels.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: '202604261058',
            displayName: '2026-04-26',
            label: '10:58',
            lastMessagePreview:
              '  The first user message should be loaded before a stable title is shown  ',
            updatedAt: 315,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        '202604261058': {
          thinkingLevel: 'medium',
          messages: [],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 520,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');

    assert.equal(snapshot.sessions[0]?.title, 'New Conversation');
    assert.equal(snapshot.sessions[0]?.titleSource, 'default');
    assert.notEqual(snapshot.sessions[0]?.title, '2026-04-26');
    assert.notEqual(snapshot.sessions[0]?.title, '10:58');
  },
);

await runTest(
  'openclaw gateway session store treats id plus date row labels as metadata instead of conversation titles',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-id-date-labels.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-technical-title',
            derivedTitle: 'session-technical-title(2026-04-26)',
            label: 'claw-studio:instance-a:session-technical-title (2026-04-26)',
            updatedAt: 530,
            kind: 'direct',
            model: 'OpenClaw A',
            lastMessagePreview: 'Readable assistant summary that must not become the title',
          },
        ],
      },
      {},
    );
    const store = new OpenClawGatewaySessionStore({
      getClient: () => client,
      now: () => 540,
    });

    await store.hydrateInstance('instance-a');

    const session = store.getSnapshot('instance-a').sessions[0];
    assert.equal(session?.title, 'New Conversation');
    assert.equal(session?.titleSource, 'default');
  },
);

await runTest(
  'openclaw gateway session store persists the first user message title into the gateway session label',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-new-title';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-new-title.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'session-new-title(2026-04-26)',
            updatedAt: 100,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {},
    );
    const store = new OpenClawGatewaySessionStore({
      getClient: () => client,
      now: () => 200,
    });

    await store.hydrateInstance('instance-a');
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId,
      content: 'Fix the session title persistence path before rendering the sidebar',
    });

    assert.deepEqual(
      client.patchCalls.filter((call) => Object.prototype.hasOwnProperty.call(call, 'label')),
      [
        {
          key: sessionId,
          label: 'Fix the session title persistence path before rendering the sidebar',
        },
      ],
    );
    assert.equal(
      store.getSnapshot('instance-a').sessions.find((session) => session.id === sessionId)?.title,
      'Fix the session title persistence path before rendering the sidebar',
    );
  },
);

await runTest(
  'openclaw gateway session store repairs unreadable inactive session titles from first user history during hydration',
  async () => {
    const activeSessionId = 'claw-studio:instance-a:active-readable';
    const inactiveSessionId = 'openclaw7d9f2a';
    const firstUserTitle =
      'Use the first user message as the durable sidebar title before the row is clicked';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-title-repair.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: activeSessionId,
            label: 'Active Planning Session',
            updatedAt: 300,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: inactiveSessionId,
            label: 'openclaw7d9f2a(2026-04-26)',
            updatedAt: 200,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [activeSessionId]: {
          thinkingLevel: 'low',
          messages: [],
        },
        [inactiveSessionId]: {
          thinkingLevel: 'medium',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: firstUserTitle }],
              timestamp: 205,
            },
          ],
        },
      },
    );
    const store = new OpenClawGatewaySessionStore({
      getClient: () => client,
      now: () => 400,
    });

    await store.hydrateInstance('instance-a');
    await waitFor(
      () =>
        store.getSnapshot('instance-a').sessions.find((session) => session.id === inactiveSessionId)?.title ===
        firstUserTitle,
    );

    const inactiveSession = store
      .getSnapshot('instance-a')
      .sessions.find((session) => session.id === inactiveSessionId);
    assert.equal(inactiveSession?.title, firstUserTitle);
    assert.equal(inactiveSession?.titleSource, 'firstUser');
    assert.ok(client.historyCalls.includes(inactiveSessionId));
    assert.deepEqual(
      client.patchCalls.filter((call) => call.key === inactiveSessionId),
      [
        {
          key: inactiveSessionId,
          label: firstUserTitle,
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store repairs unreadable inactive session titles from first readable history message when no user turn exists',
  async () => {
    const activeSessionId = 'claw-studio:instance-a:active-readable';
    const inactiveSessionId = 'openclaw-assistant-title-repair';
    const firstMessageTitle =
      'Recovered title from assistant-only imported OpenClaw history';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-title-repair-assistant.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: activeSessionId,
            label: 'Active Planning Session',
            updatedAt: 300,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: inactiveSessionId,
            label: 'openclaw-assistant-title-repair(2026-04-26)',
            updatedAt: 200,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [activeSessionId]: {
          thinkingLevel: 'low',
          messages: [],
        },
        [inactiveSessionId]: {
          thinkingLevel: 'medium',
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: firstMessageTitle }],
              timestamp: 205,
            },
          ],
        },
      },
    );
    const store = new OpenClawGatewaySessionStore({
      getClient: () => client,
      now: () => 400,
    });

    await store.hydrateInstance('instance-a');
    await waitFor(
      () =>
        store.getSnapshot('instance-a').sessions.find((session) => session.id === inactiveSessionId)?.title ===
        firstMessageTitle,
    );

    const inactiveSession = store
      .getSnapshot('instance-a')
      .sessions.find((session) => session.id === inactiveSessionId);
    assert.equal(inactiveSession?.title, firstMessageTitle);
    assert.equal(inactiveSession?.titleSource, 'firstUser');
    assert.deepEqual(
      client.patchCalls.filter((call) => call.key === inactiveSessionId),
      [
        {
          key: inactiveSessionId,
          label: firstMessageTitle,
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store does not block hydration on inactive title repair history',
  async () => {
    const activeSessionId = 'claw-studio:instance-a:active-readable';
    const inactiveSessionId = 'openclaw-title-repair-slow';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-title-repair-slow.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: activeSessionId,
            label: 'Active Planning Session',
            updatedAt: 300,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: inactiveSessionId,
            label: 'openclaw-title-repair-slow(2026-04-26)',
            updatedAt: 200,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [activeSessionId]: {
          thinkingLevel: 'low',
          messages: [],
        },
      },
    );
    const deferredInactiveHistory = client.deferHistory(inactiveSessionId);
    const store = new OpenClawGatewaySessionStore({
      getClient: () => client,
      now: () => 400,
    });

    let hydrateResolved = false;
    const hydratePromise = store.hydrateInstance('instance-a').then(() => {
      hydrateResolved = true;
    });

    await waitFor(() => client.historyCalls.includes(inactiveSessionId));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(hydrateResolved, true);

    deferredInactiveHistory.resolve({
      thinkingLevel: 'medium',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Slow repaired title' }],
          timestamp: 205,
        },
      ],
    });
    await hydratePromise;
    await waitFor(
      () =>
        store.getSnapshot('instance-a').sessions.find((session) => session.id === inactiveSessionId)?.title ===
        'Slow repaired title',
    );
  },
);

await runTest(
  'openclaw gateway session store keeps first-user titles stable when later session refreshes only expose weak runtime labels',
  async () => {
    const threadSessionId = 'agent:research:main:thread:claw-studio:session-1';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-readable.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: threadSessionId,
            label: 'main',
            updatedAt: 410,
            kind: 'direct',
            model: 'OpenClaw A',
            lastMessagePreview: 'Assistant summary that should not replace the first user title',
          },
          {
            key: 'agent:research:main',
            label: 'Research Main',
            updatedAt: 400,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [threadSessionId]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '  Use the first user request as the stable sidebar title for this conversation  ',
                },
              ],
              timestamp: 405,
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: 'Initial assistant reply',
                },
              ],
              timestamp: 406,
            },
          ],
        },
        'agent:research:main': {
          thinkingLevel: 'low',
          messages: [],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 530,
    });

    await store.hydrateInstance('instance-a');
    await store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: threadSessionId,
    });
    await waitFor(
      () =>
        store.getSnapshot('instance-a').sessions.find((session) => session.id === threadSessionId)?.title ===
        'Use the first user request as the stable sidebar title for this conversation',
    );
    assert.equal(
      store.getSnapshot('instance-a').sessions.find((session) => session.id === threadSessionId)?.title,
      'Use the first user request as the stable sidebar title for this conversation',
    );

    await store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: 'agent:research:main',
    });

    client.replaceSessions([
      {
        key: threadSessionId,
        displayName: 'openclaw-tui',
        label: 'main',
        updatedAt: 520,
        kind: 'direct',
        model: 'OpenClaw A',
        lastMessagePreview: 'Assistant follow-up that should not replace the first user title',
      },
      {
        key: 'agent:research:main',
        label: 'Research Main',
        updatedAt: 400,
        kind: 'direct',
        model: 'OpenClaw A',
      },
    ]);
    client.emitSessionsChanged({ source: 'remote' });

    await waitFor(() => store.getSnapshot('instance-a').syncState === 'idle');

    assert.equal(
      store.getSnapshot('instance-a').sessions.find((session) => session.id === threadSessionId)?.title,
      'Use the first user request as the stable sidebar title for this conversation',
    );
  },
);

await runTest(
  'openclaw gateway session store skips sessions.subscribe when hello capabilities say it is unavailable',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: ['sessions.list', 'chat.history', 'chat.send'],
      },
    });
    client.subscribeError = new Error('subscribe should not be called');

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 410,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');
    assert.equal(client.subscribeCount, 0);
    assert.equal(snapshot.syncState, 'idle');
    assert.equal(snapshot.lastError, undefined);
    assert.deepEqual(snapshot.sessions.map((session) => session.id), [
      'claw-studio:instance-a:session-1',
    ]);
    assert.equal(snapshot.sessions[0]?.messages[0]?.content, 'hello from A');
  },
);

await runTest(
  'openclaw gateway session store tolerates unknown sessions.subscribe errors from older runtimes',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );
    client.subscribeError = new Error('unknown method: sessions.subscribe');

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 420,
    });

    await store.hydrateInstance('instance-a');
    const snapshot = store.getSnapshot('instance-a');
    assert.equal(client.subscribeCount, 1);
    assert.equal(snapshot.syncState, 'idle');
    assert.equal(snapshot.lastError, undefined);
    assert.deepEqual(snapshot.sessions.map((session) => session.id), [
      'claw-studio:instance-a:session-1',
    ]);

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: 'claw-studio:instance-a:session-1',
      content: 'send despite missing subscribe',
      model: 'OpenClaw A',
    });
    assert.deepEqual(client.sendCalls, [
      {
        sessionKey: 'claw-studio:instance-a:session-1',
        message: 'send despite missing subscribe',
        deliver: false,
        idempotencyKey: 'run-1',
      },
    ]);
  },
);

await runTest(
  'openclaw gateway session store does not stay stuck in loading when the initial gateway connect transitions into reconnecting',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    client.connect = async () =>
      new Promise(() => {
        // Keep the initial connect unresolved so the store must react to connection events.
      });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 392,
    });

    void store.hydrateInstance('instance-a');

    await waitFor(() => store.getSnapshot('instance-a').syncState === 'loading');

    client.emitConnection({
      status: 'reconnecting',
      code: 1006,
      reason: 'connection refused',
    });

    await waitFor(() => store.getSnapshot('instance-a').syncState === 'error');

    const snapshot = store.getSnapshot('instance-a');
    assert.equal(snapshot.connectionStatus, 'reconnecting');
    assert.equal(snapshot.syncState, 'error');
    assert.match(snapshot.lastError ?? '', /connection refused/i);
  },
);

await runTest(
  'openclaw gateway session store resolves the initial hydrate call when the first gateway connect drops into reconnecting',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    client.connect = async () =>
      new Promise(() => {
        // Keep the initial connect unresolved so the hydrate promise must be interrupted by reconnecting.
      });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 393,
    });

    const hydratePromise = store.hydrateInstance('instance-a');

    await waitFor(() => store.getSnapshot('instance-a').syncState === 'loading');

    client.emitConnection({
      status: 'reconnecting',
      code: 1006,
      reason: 'connection refused',
    });

    const snapshot = await Promise.race([
      hydratePromise,
      new Promise<symbol>((resolve) => {
        setTimeout(() => resolve(Symbol.for('timeout')), 100);
      }),
    ]);

    assert.notEqual(snapshot, Symbol.for('timeout'));
    assert.equal((snapshot as ReturnType<typeof store.getSnapshot>).syncState, 'error');
    assert.equal(
      (snapshot as ReturnType<typeof store.getSnapshot>).connectionStatus,
      'reconnecting',
    );
  },
);

await runTest(
  'openclaw gateway session store exposes gateway connection status transitions in snapshots',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-1';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 395,
    });

    await store.hydrateInstance('instance-a');

    let snapshot = store.getSnapshot('instance-a');
    assert.equal((snapshot as any).connectionStatus, 'connected');
    assert.equal(snapshot.lastError, undefined);

    client.emitConnection({
      status: 'reconnecting',
      code: 1006,
      reason: 'socket lost',
    });

    snapshot = store.getSnapshot('instance-a');
    assert.equal((snapshot as any).connectionStatus, 'reconnecting');
    assert.match(snapshot.lastError ?? '', /socket lost/i);

    client.emitConnection({
      status: 'disconnected',
      code: 1006,
      reason: 'socket lost',
    });

    snapshot = store.getSnapshot('instance-a');
    assert.equal((snapshot as any).connectionStatus, 'disconnected');
    assert.match(snapshot.lastError ?? '', /socket lost/i);
  },
);

await runTest(
  'openclaw gateway session store re-subscribes session updates after reconnect and refreshes final history from gateway',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: 'claw-studio:instance-a:session-1',
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        'claw-studio:instance-a:session-1': {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 400,
    });

    await store.hydrateInstance('instance-a');
    assert.equal(client.subscribeCount, 1);

    client.emitConnection({
      status: 'connected',
    });
    await waitFor(() => client.subscribeCount === 2);

    client.setHistory('claw-studio:instance-a:session-1', {
      thinkingLevel: 'low',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'hello from A' }],
          timestamp: 210,
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'authoritative final reply' }],
          timestamp: 211,
        },
      ],
    });

    client.emitChat({
      runId: 'run-final',
      sessionKey: 'claw-studio:instance-a:session-1',
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'event-only final reply' }],
      },
    });

    await waitFor(
      () =>
        store
          .getSnapshot('instance-a')
          .sessions.find((session) => session.id === 'claw-studio:instance-a:session-1')
          ?.messages.at(-1)?.content === 'authoritative final reply',
    );
  },
);

await runTest(
  'openclaw gateway session store subscribes to the active session transcript stream when the gateway supports it',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-1';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 405,
    });

    await store.hydrateInstance('instance-a');
    assert.deepEqual(client.subscribeSessionMessagesCalls, [sessionId]);
    assert.deepEqual(client.unsubscribeSessionMessagesCalls, []);
  },
);

await runTest(
  'openclaw gateway session store keeps transcript subscriptions for all known sessions when the active session changes',
  async () => {
    const sessionA = 'claw-studio:instance-a:session-1';
    const sessionB = 'claw-studio:instance-a:session-2';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: sessionB,
            label: 'A Two',
            updatedAt: 205,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionA]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A one' }],
              timestamp: 210,
            },
          ],
        },
        [sessionB]: {
          thinkingLevel: 'medium',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A two' }],
              timestamp: 205,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 410,
    });

    await store.hydrateInstance('instance-a');
    assert.deepEqual(client.subscribeSessionMessagesCalls, [sessionA, sessionB]);
    assert.deepEqual(client.unsubscribeSessionMessagesCalls, []);

    await store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: sessionB,
    });

    assert.deepEqual(client.subscribeSessionMessagesCalls, [sessionA, sessionB]);
    assert.deepEqual(client.unsubscribeSessionMessagesCalls, []);
  },
);

await runTest(
  'openclaw gateway session store applies session.message to any subscribed known session',
  async () => {
    const sessionA = 'claw-studio:instance-a:session-1';
    const sessionB = 'claw-studio:instance-a:session-2';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: sessionB,
            label: 'A Two',
            updatedAt: 205,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionA]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A one' }],
              timestamp: 210,
            },
          ],
        },
        [sessionB]: {
          thinkingLevel: 'medium',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A two' }],
              timestamp: 205,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 420,
    });

    await store.hydrateInstance('instance-a');
    await store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: sessionB,
    });

    const historyCallsBefore = [...client.historyCalls];
    const listSessionsCallsBefore = client.listSessionsCalls.length;

    client.emitSessionMessage({
      sessionKey: sessionA,
      messageId: 'msg-session-a-1',
      messageSeq: 1,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'stale A transcript update' }],
      },
    });

    client.emitSessionMessage({
      sessionKey: sessionB,
      messageId: 'msg-session-b-1',
      messageSeq: 1,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'live B transcript update' }],
      },
    });

    const snapshot = store.getSnapshot('instance-a');
    assert.deepEqual(
      snapshot.sessions.find((session) => session.id === sessionA)?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'hello from A one' },
        { role: 'assistant', content: 'stale A transcript update' },
      ],
    );
    assert.deepEqual(
      snapshot.sessions.find((session) => session.id === sessionB)?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'hello from A two' },
        { role: 'assistant', content: 'live B transcript update' },
      ],
    );
    assert.deepEqual(client.historyCalls, historyCallsBefore);
    assert.equal(client.listSessionsCalls.length, listSessionsCallsBefore);
  },
);

await runTest(
  'openclaw gateway session store does not merge different roles only because session.message seq is reused',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-reused-seq';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Reused Seq',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'low',
          messages: [],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 421,
    });

    await store.hydrateInstance('instance-a');
    await waitFor(() => client.subscribeSessionMessagesCalls.includes(sessionId));

    client.emitSessionMessage({
      sessionKey: sessionId,
      messageSeq: 1,
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'user turn with reused seq' }],
      },
    });
    client.emitSessionMessage({
      sessionKey: sessionId,
      messageSeq: 1,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'assistant turn with reused seq' }],
      },
    });

    const snapshot = store.getSnapshot('instance-a');
    assert.deepEqual(
      snapshot.sessions.find((session) => session.id === sessionId)?.messages.map((message) => ({
        seq: message.seq ?? null,
        role: message.role,
        content: message.content,
      })),
      [
        { seq: 1, role: 'user', content: 'user turn with reused seq' },
        { seq: 1, role: 'assistant', content: 'assistant turn with reused seq' },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store leaves inactive transcript updates unread until the session is selected',
  async () => {
    const sessionA = 'claw-studio:instance-a:session-active';
    const sessionB = 'claw-studio:instance-a:session-inactive';
    let now = 420;
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'Active',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: sessionB,
            label: 'Inactive',
            updatedAt: 205,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionA]: {
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello active' }],
              timestamp: 210,
            },
          ],
        },
        [sessionB]: {
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello inactive' }],
              timestamp: 205,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => now,
    });

    await store.hydrateInstance('instance-a');

    let snapshot = store.getSnapshot('instance-a');
    assert.equal(snapshot.activeSessionId, sessionA);
    assert.equal(
      snapshot.sessions.find((session) => session.id === sessionA)?.lastSeenAt,
      210,
    );
    assert.equal(
      snapshot.sessions.find((session) => session.id === sessionB)?.lastSeenAt ?? null,
      null,
    );

    now = 430;
    client.emitSessionMessage({
      sessionKey: sessionB,
      messageId: 'msg-session-b-1',
      messageSeq: 1,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'inactive unread update' }],
      },
    });

    snapshot = store.getSnapshot('instance-a');
    assert.equal(
      snapshot.sessions.find((session) => session.id === sessionB)?.updatedAt,
      430,
    );
    assert.equal(
      snapshot.sessions.find((session) => session.id === sessionB)?.lastSeenAt ?? null,
      null,
    );

    now = 450;
    await store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: sessionB,
    });

    snapshot = store.getSnapshot('instance-a');
    assert.equal(snapshot.activeSessionId, sessionB);
    assert.equal(
      snapshot.sessions.find((session) => session.id === sessionB)?.lastSeenAt,
      430,
    );
  },
);

await runTest(
  'openclaw gateway session store orders out-of-order transcript updates by authoritative sequence while seen state follows the newest timestamp',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-seq-order';
    let now = 500;
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Seq Order',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          messages: [],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => now,
    });

    await store.hydrateInstance('instance-a');
    await waitFor(() => client.subscribeSessionMessagesCalls.includes(sessionId));

    client.emitSessionMessage({
      sessionKey: sessionId,
      messageId: 'msg-2',
      messageSeq: 2,
      message: {
        id: 'msg-2',
        role: 'assistant',
        content: [{ type: 'text', text: 'assistant second' }],
        timestamp: 300,
      },
    });

    now = 650;
    client.emitSessionMessage({
      sessionKey: sessionId,
      messageId: 'msg-1',
      messageSeq: 1,
      message: {
        id: 'msg-1',
        role: 'user',
        content: [{ type: 'text', text: 'user first newer timestamp' }],
        timestamp: 650,
      },
    });

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        id: message.id,
        seq: message.seq ?? null,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      })),
      [
        {
          id: 'msg-1',
          seq: 1,
          role: 'user',
          content: 'user first newer timestamp',
          timestamp: 650,
        },
        {
          id: 'msg-2',
          seq: 2,
          role: 'assistant',
          content: 'assistant second',
          timestamp: 300,
        },
      ],
    );
    assert.equal(session?.lastMessagePreview, 'assistant second');
    assert.equal(session?.updatedAt, 650);
    assert.equal(session?.lastSeenAt, 650);
  },
);

await runTest(
  'openclaw gateway session store compacts duplicate history message ids before projecting the active session',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-history-dedupe';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-history-dedupe.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'History Dedupe',
            updatedAt: 320,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          messages: [
            {
              id: 'msg-user-1',
              role: 'user',
              content: [{ type: 'text', text: 'hello gateway' }],
              timestamp: 100,
            },
            {
              id: 'msg-assistant-1',
              role: 'assistant',
              content: [{ type: 'text', text: 'partial reply' }],
              timestamp: 140,
            },
            {
              id: 'msg-assistant-1',
              role: 'assistant',
              content: [{ type: 'text', text: 'final reply' }],
              timestamp: 180,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 500,
    });

    await store.hydrateInstance('instance-a');

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.equal(session?.messages.length, 2);
    assert.deepEqual(
      session?.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      })),
      [
        {
          id: 'msg-user-1',
          role: 'user',
          content: 'hello gateway',
          timestamp: 100,
        },
        {
          id: 'msg-assistant-1',
          role: 'assistant',
          content: 'final reply',
          timestamp: 180,
        },
      ],
    );
    assert.equal(session?.lastMessagePreview, 'final reply');
  },
);

await runTest(
  'openclaw gateway session store derives readable titles for externally updated inactive sessions from transcript user turns',
  async () => {
    const sessionA = 'agent:research:main';
    const sessionB = 'claw-studio:instance-a:session-2';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-external-title.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'main',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: sessionB,
            label: 'Current Session',
            updatedAt: 205,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionA]: {
          thinkingLevel: 'low',
          messages: [],
        },
        [sessionB]: {
          thinkingLevel: 'medium',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'keep session B active' }],
              timestamp: 205,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 425,
    });

    await store.hydrateInstance('instance-a');
    await store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: sessionB,
    });

    client.emitSessionMessage({
      sessionKey: sessionA,
      messageId: 'msg-session-a-user-1',
      messageSeq: 1,
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '  Prepare a Control UI parity review for chat sync and titles  ',
          },
        ],
        timestamp: 212,
      },
    });

    const snapshot = store.getSnapshot('instance-a');
    const updatedSession = snapshot.sessions.find((session) => session.id === sessionA);

    assert.equal(snapshot.activeSessionId, sessionB);
    assert.ok(updatedSession);
    assert.equal(updatedSession?.title, 'Prepare a Control UI parity review for chat sync and titles');
    assert.equal(
      updatedSession?.lastMessagePreview,
      'Prepare a Control UI parity review for chat sync and titles',
    );
    assert.deepEqual(
      updatedSession?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'user', content: 'Prepare a Control UI parity review for chat sync and titles' }],
    );
  },
);

await runTest(
  'openclaw gateway session store merges active-run transcript updates into the current assistant stream instead of appending duplicates',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-live-transcript';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Live Transcript',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'low',
          messages: [],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 430,
    });

    await store.hydrateInstance('instance-a');
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId,
      content: 'user message',
      model: 'OpenClaw A',
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: sessionId,
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'live draft reply' }],
      },
    });

    client.emitSessionMessage({
      sessionKey: sessionId,
      messageId: 'msg-live-1',
      messageSeq: 1,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'live draft reply' }],
      },
    });

    client.emitSessionMessage({
      sessionKey: sessionId,
      messageId: 'msg-live-1',
      messageSeq: 1,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'live draft reply expanded' }],
      },
    });

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.equal(session?.runId, 'run-1');
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'user message' },
        { role: 'assistant', content: 'live draft reply expanded' },
      ],
    );
    assert.equal(session?.messages[1]?.id, 'msg-live-1');
    assert.equal(session?.messages[1]?.seq, 1);
    assert.equal(session?.messages[1]?.runId, 'run-1');
  },
);

await runTest(
  'openclaw gateway session store does not append a duplicate assistant message when the final chat payload is echoed by session.message',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-final-transcript-echo';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Final Transcript Echo',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'low',
          messages: [],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 435,
    });

    await store.hydrateInstance('instance-a');
    await waitFor(() => client.subscribeSessionMessagesCalls.includes(sessionId));

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId,
      content: 'user message',
      model: 'OpenClaw A',
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: sessionId,
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'final draft reply' }],
      },
    });

    const deferredHistory = client.deferHistory(sessionId);

    client.emitChat({
      runId: 'run-1',
      sessionKey: sessionId,
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'final draft reply completed' }],
      },
    });

    client.emitSessionMessage({
      sessionKey: sessionId,
      messageId: 'msg-final-1',
      messageSeq: 1,
      message: {
        id: 'msg-final-1',
        role: 'assistant',
        content: [{ type: 'text', text: 'final draft reply completed' }],
        timestamp: 436,
      },
    });

    let session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.equal(session?.runId, null);
    assert.deepEqual(
      session?.messages.map((message) => ({
        id: message.id,
        seq: message.seq ?? null,
        role: message.role,
        content: message.content,
      })),
      [
        {
          id: session?.messages[0]?.id ?? '',
          seq: null,
          role: 'user',
          content: 'user message',
        },
        {
          id: 'msg-final-1',
          seq: 1,
          role: 'assistant',
          content: 'final draft reply completed',
        },
      ],
    );

    deferredHistory.resolve({
      thinkingLevel: 'final-transcript-echo',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'user message' }],
          timestamp: 435,
        },
        {
          id: 'msg-final-1',
          role: 'assistant',
          content: [{ type: 'text', text: 'final draft reply completed' }],
          timestamp: 436,
        },
      ],
    });

    await waitFor(() => {
      const current = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
      return current?.thinkingLevel === 'final-transcript-echo';
    });

    session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        id: message.id,
        seq: message.seq ?? null,
        role: message.role,
        content: message.content,
      })),
      [
        {
          id: session?.messages[0]?.id ?? '',
          seq: null,
          role: 'user',
          content: 'user message',
        },
        {
          id: 'msg-final-1',
          seq: 1,
          role: 'assistant',
          content: 'final draft reply completed',
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store emits the newly selected session immediately before its history refresh completes',
  async () => {
    const sessionA = 'claw-studio:instance-a:session-1';
    const sessionB = 'claw-studio:instance-a:session-2';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: sessionB,
            label: 'A Two',
            updatedAt: 205,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionA]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'history A' }],
              timestamp: 210,
            },
          ],
        },
        [sessionB]: {
          thinkingLevel: 'medium',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'history B' }],
              timestamp: 205,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 425,
    });
    const emittedSnapshots: Array<{
      activeSessionId: string | null;
      visibleMessageText: string[];
      historyState: string | null;
    }> = [];
    store.subscribe((instanceId, snapshot) => {
      if (instanceId !== 'instance-a') {
        return;
      }

      const activeSession = snapshot.sessions.find(
        (session) => session.id === snapshot.activeSessionId,
      );
      emittedSnapshots.push({
        activeSessionId: snapshot.activeSessionId,
        visibleMessageText:
          activeSession?.messages.map((message) => message.content) ?? [],
        historyState: activeSession?.historyState ?? null,
      });
    });

    await store.hydrateInstance('instance-a');
    const deferredHistory = client.deferHistory(sessionB);
    emittedSnapshots.length = 0;

    let selectionResolved = false;
    const selectionPromise = store
      .setActiveSession({
        instanceId: 'instance-a',
        sessionId: sessionB,
      })
      .then(() => {
        selectionResolved = true;
      });

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(selectionResolved, false);
    assert.ok(
      emittedSnapshots.some(
        (snapshot) =>
          snapshot.activeSessionId === sessionB &&
          !snapshot.visibleMessageText.includes('history A') &&
          snapshot.historyState === 'loading',
      ),
    );

    deferredHistory.resolve({
      thinkingLevel: 'medium',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'history B' }],
          timestamp: 205,
        },
      ],
    });
    await selectionPromise;

    assert.ok(
      emittedSnapshots.some(
        (snapshot) =>
          snapshot.activeSessionId === sessionB &&
          snapshot.visibleMessageText.includes('history B') &&
          snapshot.historyState === 'ready',
      ),
    );
  },
);

await runTest(
  'openclaw gateway session store does not full-refresh the active session for sessions.changed transcript notifications',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-1';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 430,
    });

    await store.hydrateInstance('instance-a');
    const listSessionsCallsBefore = client.listSessionsCalls.length;
    const historyCallsBefore = client.historyCalls.length;

    client.emitSessionsChanged({
      sessionKey: sessionId,
      phase: 'message',
      messageId: 'msg-session-a-1',
      messageSeq: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(client.listSessionsCalls.length, listSessionsCallsBefore);
    assert.equal(client.historyCalls.length, historyCallsBefore);
  },
);

await runTest(
  'openclaw gateway session store re-subscribes the active session transcript stream after reconnect',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-1';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 440,
    });

    await store.hydrateInstance('instance-a');
    assert.deepEqual(client.subscribeSessionMessagesCalls, [sessionId]);

    client.emitConnection({
      status: 'connected',
    });

    await waitFor(() => client.subscribeSessionMessagesCalls.length === 2);
    assert.deepEqual(client.subscribeSessionMessagesCalls, [sessionId, sessionId]);
  },
);

await runTest(
  'openclaw gateway session store hydrates session override metadata from sessions.list and preserves it when history omits those fields',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-metadata';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Metadata Session',
            updatedAt: 220,
            kind: 'direct',
            model: 'OpenClaw A',
            thinkingLevel: 'medium',
            fastMode: true,
            verboseLevel: 'full',
            reasoningLevel: 'on',
          },
        ],
      },
      {
        [sessionId]: {
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'history without override echo' }],
              timestamp: 220,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 400,
    });

    await store.hydrateInstance('instance-a');

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.equal(session?.thinkingLevel, 'medium');
    assert.equal(session?.fastMode, true);
    assert.equal(session?.verboseLevel, 'full');
    assert.equal(session?.reasoningLevel, 'on');
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [{ role: 'assistant', content: 'history without override echo' }],
    );
  },
);

await runTest(
  'openclaw gateway session store updates session override metadata from live session.message payloads',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-live-metadata';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Live Metadata Session',
            updatedAt: 220,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          messages: [],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 450,
    });

    await store.hydrateInstance('instance-a');
    await waitFor(() => client.subscribeSessionMessagesCalls.includes(sessionId));

    client.emitSessionMessage({
      sessionKey: sessionId,
      messageId: 'msg-live-metadata',
      thinkingLevel: 'high',
      fastMode: false,
      verboseLevel: 'on',
      reasoningLevel: 'stream',
      message: {
        id: 'msg-live-metadata',
        role: 'assistant',
        content: [{ type: 'text', text: 'live metadata update' }],
      },
    });

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.equal(session?.thinkingLevel, 'high');
    assert.equal(session?.fastMode, false);
    assert.equal(session?.verboseLevel, 'on');
    assert.equal(session?.reasoningLevel, 'stream');
  },
);

await runTest(
  'openclaw gateway session store re-synchronizes the active instance after a gateway event gap',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-1';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'A One',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'low',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'hello from A' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 450,
    });

    await store.hydrateInstance('instance-a');
    assert.equal(client.listSessionsCalls.length, 1);
    assert.deepEqual(client.historyCalls, [sessionId]);

    client.replaceSessions([
      {
        key: sessionId,
        label: 'A One',
        updatedAt: 260,
        kind: 'direct',
        model: 'OpenClaw A',
        lastMessagePreview: 'authoritative final reply',
      },
    ]);
    client.setHistory(sessionId, {
      thinkingLevel: 'medium',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'hello from A' }],
          timestamp: 210,
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'authoritative final reply' }],
          timestamp: 260,
        },
      ],
    });

    client.emitGap({
      expected: 2,
      received: 4,
    });

    await waitFor(() => client.listSessionsCalls.length === 2);
    await waitFor(() => client.historyCalls.filter((entry) => entry === sessionId).length === 2);

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.equal(session?.thinkingLevel, 'medium');
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        {
          role: 'user',
          content: 'hello from A',
        },
        {
          role: 'assistant',
          content: 'authoritative final reply',
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store keeps attachment-only user messages and forwards attachment payloads',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 600,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-attachment`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');
    const attachment = {
      id: 'attachment-1',
      kind: 'screenshot' as const,
      name: 'dashboard-shot.png',
      url: 'https://cdn.example.com/dashboard-shot.png',
      previewUrl: 'https://cdn.example.com/dashboard-shot.png',
      mimeType: 'image/png',
      sizeBytes: 2048,
      objectKey: 'chat/2026/03/22/dashboard-shot.png',
    };

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: '',
      model: 'OpenClaw A',
      requestText: 'The user sent attachments without additional text.',
      attachments: [attachment],
    });

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.equal(session?.title, 'dashboard-shot.png');
    assert.equal(session?.messages.length, 1);
    assert.equal(session?.messages[0]?.role, 'user');
    assert.equal(session?.messages[0]?.content, '');
    assert.equal(session?.messages[0]?.timestamp, 600);
    assert.deepEqual(session?.messages[0]?.attachments, [attachment]);
    assert.deepEqual(
      session?.messages[0]?.kernelMessage?.parts.map((part) => part.kind),
      ['attachment'],
    );
    assert.deepEqual(client.sendCalls, [
      {
        sessionKey: 'claw-studio:instance-a:draft-attachment',
        message: 'The user sent attachments without additional text.',
        deliver: false,
        idempotencyKey: 'run-1',
        attachments: [
          {
            id: 'attachment-1',
            kind: 'screenshot',
            name: 'dashboard-shot.png',
            mimeType: 'image/png',
            sizeBytes: 2048,
            url: 'https://cdn.example.com/dashboard-shot.png',
            previewUrl: 'https://cdn.example.com/dashboard-shot.png',
            objectKey: 'chat/2026/03/22/dashboard-shot.png',
          },
        ],
      },
    ]);
  },
);

await runTest(
  'openclaw gateway session store extracts inline image content blocks from gateway history into message attachments',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-inline-image-history';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-inline-image-history.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Inline Image History',
            updatedAt: 910,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'medium',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please review this screenshot.',
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'iVBORw0KGgoAAAANSUhEUgAAAAUA',
                  },
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: 'https://example.com/remote-reference.png',
                  },
                },
              ],
              timestamp: 910,
            },
          ],
        },
      },
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 920,
    });

    await store.hydrateInstance('instance-a');

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
        attachments:
          message.attachments?.map((attachment) => ({
            kind: attachment.kind,
            name: attachment.name,
            previewUrl: attachment.previewUrl,
          })) ?? [],
      })),
      [
        {
          role: 'user',
          content: 'Please review this screenshot.',
          attachments: [
            {
              kind: 'image',
              name: 'Image',
              previewUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
            },
            {
              kind: 'image',
              name: 'remote-reference.png',
              previewUrl: 'https://example.com/remote-reference.png',
            },
          ],
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store preserves the local user turn when final history refresh omits it',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 700,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-preserve-user`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'keep this user message',
      model: 'OpenClaw A',
    });

    client.setHistory(draft.id, {
      thinkingLevel: 'preserved-user-check',
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'remote final reply only' }],
          timestamp: 701,
        },
      ],
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'remote final reply only' }],
      },
    });

    await waitFor(() => {
      const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
      return session?.thinkingLevel === 'preserved-user-check';
    });

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        {
          role: 'user',
          content: 'keep this user message',
        },
        {
          role: 'assistant',
          content: 'remote final reply only',
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store deduplicates echoed user transcript updates against the local optimistic turn',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-user-echo-dedup';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'User Echo Dedup',
            updatedAt: 704,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'echo-dedup-start',
          messages: [],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 705,
    });

    await store.hydrateInstance('instance-a');
    await waitFor(() => client.subscribeSessionMessagesCalls.includes(sessionId));

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId,
      content: 'keep just one local user turn',
      model: 'OpenClaw A',
    });

    client.emitSessionMessage({
      sessionKey: sessionId,
      messageId: 'msg-remote-user-echo',
      senderLabel: 'Iris',
      message: {
        id: 'msg-remote-user-echo',
        role: 'user',
        senderLabel: 'Iris',
        content: [{ type: 'text', text: 'keep just one local user turn' }],
        timestamp: 706,
      },
    });

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        id: message.id,
        role: message.role,
        senderLabel: message.senderLabel ?? null,
        content: message.content,
      })),
      [
        {
          id: 'msg-remote-user-echo',
          role: 'user',
          senderLabel: 'Iris',
          content: 'keep just one local user turn',
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store does not duplicate the optimistic user turn when final history includes the persisted user message',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 715,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-user-history-dedup`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'keep this user once in final history',
      model: 'OpenClaw A',
    });

    client.setHistory(draft.id, {
      thinkingLevel: 'user-history-dedup-check',
      messages: [
        {
          id: 'msg-remote-history-user',
          role: 'user',
          senderLabel: 'Iris',
          content: [{ type: 'text', text: 'keep this user once in final history' }],
          timestamp: 716,
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'remote final reply only once' }],
          timestamp: 717,
        },
      ],
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'remote final reply only once' }],
      },
    });

    await waitFor(() => {
      const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
      return session?.thinkingLevel === 'user-history-dedup-check';
    });

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        id: message.id,
        role: message.role,
        senderLabel: message.senderLabel ?? null,
        content: message.content,
      })),
      [
        {
          id: 'msg-remote-history-user',
          role: 'user',
          senderLabel: 'Iris',
          content: 'keep this user once in final history',
        },
        {
          id: session?.messages[1]?.id ?? '',
          role: 'assistant',
          senderLabel: null,
          content: 'remote final reply only once',
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store prefers the persisted final assistant message over a local terminal placeholder',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 710,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-final-dedup`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'keep this user message',
      model: 'OpenClaw A',
    });

    client.setHistory(draft.id, {
      thinkingLevel: 'final-dedup-check',
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'remote persisted final reply' }],
          timestamp: 712,
        },
      ],
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'local terminal placeholder' }],
      },
    });

    await waitFor(() => {
      const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
      return session?.thinkingLevel === 'final-dedup-check';
    });

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        {
          role: 'user',
          content: 'keep this user message',
        },
        {
          role: 'assistant',
          content: 'remote persisted final reply',
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store does not let a stale session-switch history response clear an in-flight run',
  async () => {
    const sessionA = 'claw-studio:instance-a:session-a';
    const sessionB = 'claw-studio:instance-a:session-b';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'Session A',
            updatedAt: 220,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: sessionB,
            label: 'Session B',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionA]: {
          thinkingLevel: 'session-a-ready',
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'history A' }],
              timestamp: 220,
            },
          ],
        },
        [sessionB]: {
          thinkingLevel: 'session-b-late-history',
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'older history B' }],
              timestamp: 210,
            },
          ],
        },
      },
    );

    let now = 800;
    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => now,
    });

    await store.hydrateInstance('instance-a');

    const deferredHistory = client.deferHistory(sessionB);
    const selectSessionPromise = store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: sessionB,
    });

    await waitFor(() => client.historyCalls.filter((entry) => entry === sessionB).length === 1);

    now = 810;
    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: sessionB,
      content: 'local turn after switch',
      model: 'OpenClaw A',
    });

    let session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionB);
    assert.ok(session);
    assert.equal(session?.runId, 'run-1');
    assert.equal(session?.messages.at(-1)?.role, 'user');
    assert.equal(session?.messages.at(-1)?.content, 'local turn after switch');

    now = 820;
    deferredHistory.resolve({
      thinkingLevel: 'session-b-late-history',
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'older history B' }],
          timestamp: 210,
        },
      ],
    });
    await selectSessionPromise;

    session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionB);
    assert.ok(session);
    assert.equal(session?.runId, 'run-1');
    assert.equal(
      session?.messages.some(
        (message) => message.role === 'user' && message.content === 'local turn after switch',
      ),
      true,
    );
    assert.equal(session?.messages.at(-1)?.role, 'user');
    assert.equal(session?.messages.at(-1)?.content, 'local turn after switch');
  },
);

await runTest(
  'openclaw gateway session store preserves partial assistant output and appends an error when a run ends in error',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 830,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-error-stream`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'user message',
      model: 'OpenClaw A',
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'partial reply before error' }],
      },
    });

    let snapshot = store.getSnapshot('instance-a');
    let session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'user message' },
        { role: 'assistant', content: 'partial reply before error' },
      ],
    );

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'error',
      errorMessage: 'gateway exploded',
    });

    snapshot = store.getSnapshot('instance-a');
    session = snapshot.sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.equal(session?.runId, null);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'user message' },
        {
          role: 'assistant',
          content: 'partial reply before error\n\nError: gateway exploded',
        },
      ],
    );
    assert.equal(snapshot.lastError, 'gateway exploded');
  },
);

await runTest(
  'openclaw gateway session store preserves the local partial assistant message when abort history omits it',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 840,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-abort-partial`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'user message',
      model: 'OpenClaw A',
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'partial reply before abort' }],
      },
    });

    client.setHistory(draft.id, {
      thinkingLevel: 'abort-partial',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'user message' }],
          timestamp: 840,
        },
      ],
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'aborted',
    });

    await waitFor(() => {
      const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
      return session?.thinkingLevel === 'abort-partial';
    });

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.equal(session?.runId, null);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'user message' },
        { role: 'assistant', content: 'partial reply before abort' },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store does not overwrite the local assistant message with a non-assistant final payload from the active run',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 845,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-own-run-non-assistant-final`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'user message',
      model: 'OpenClaw A',
    });

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'partial assistant reply' }],
      },
    });

    const deferredHistory = client.deferHistory(draft.id);

    client.emitChat({
      runId: 'run-1',
      sessionKey: draft.id,
      state: 'final',
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'unexpected user final payload' }],
      },
    });

    await waitFor(() => client.historyCalls.filter((entry) => entry === draft.id).length === 1);

    let session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.equal(session?.runId, null);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'user message' },
        { role: 'assistant', content: 'partial assistant reply' },
      ],
    );

    deferredHistory.resolve({
      thinkingLevel: 'own-run-final-reload',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'user message' }],
          timestamp: 845,
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'remote persisted assistant reply' }],
          timestamp: 846,
        },
      ],
    });

    await waitFor(() => {
      const current = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
      return current?.thinkingLevel === 'own-run-final-reload';
    });

    session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'user message' },
        { role: 'assistant', content: 'remote persisted assistant reply' },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store merges deferred session history with transcript updates that arrive during session switching',
  async () => {
    const sessionA = 'claw-studio:instance-a:session-a';
    const sessionB = 'claw-studio:instance-a:session-b';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 2,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionA,
            label: 'Session A',
            updatedAt: 220,
            kind: 'direct',
            model: 'OpenClaw A',
          },
          {
            key: sessionB,
            label: 'Session B',
            updatedAt: 210,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionA]: {
          thinkingLevel: 'session-a-ready',
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'history A' }],
              timestamp: 220,
            },
          ],
        },
        [sessionB]: {
          thinkingLevel: 'session-b-ready',
          messages: [
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'history B' }],
              timestamp: 210,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 850,
    });

    await store.hydrateInstance('instance-a');

    const deferredHistory = client.deferHistory(sessionB);
    const selectSessionPromise = store.setActiveSession({
      instanceId: 'instance-a',
      sessionId: sessionB,
    });

    await waitFor(() => client.historyCalls.filter((entry) => entry === sessionB).length === 1);
    await waitFor(() => client.subscribeSessionMessagesCalls.includes(sessionB));

    client.emitSessionMessage({
      sessionKey: sessionB,
      messageId: 'msg-live',
      message: {
        id: 'msg-live',
        role: 'assistant',
        content: [{ type: 'text', text: 'live delta while loading' }],
        timestamp: 211,
      },
    });

    deferredHistory.resolve({
      thinkingLevel: 'session-b-ready',
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'history B' }],
          timestamp: 210,
        },
        {
          id: 'msg-live',
          role: 'assistant',
          content: [{ type: 'text', text: 'live delta while loading' }],
          timestamp: 211,
        },
      ],
    });

    await selectSessionPromise;

    const snapshot = store.getSnapshot('instance-a');
    const session = snapshot.sessions.find((entry) => entry.id === sessionB);
    assert.ok(session);
    assert.equal(snapshot.activeSessionId, sessionB);
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'assistant', content: 'history B' },
        { role: 'assistant', content: 'live delta while loading' },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store reloads history for another-run final events without a displayable assistant payload',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 860,
      createSessionKey(instanceId) {
        return `claw-studio:${instanceId}:draft-other-run-history-reload`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A');

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'local user turn',
      model: 'OpenClaw A',
    });

    client.setHistory(draft.id, {
      thinkingLevel: 'other-run-reload',
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'background final message' }],
          timestamp: 861,
        },
      ],
    });

    client.emitChat({
      runId: 'run-announce',
      sessionKey: draft.id,
      state: 'final',
      message: {
        role: 'user',
        content: [{ type: 'text', text: 'unexpected non-assistant payload' }],
      },
    });

    await waitFor(() => {
      const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
      return session?.thinkingLevel === 'other-run-reload';
    });

    const session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === draft.id);
    assert.ok(session);
    assert.equal(session?.runId, 'run-1');
    assert.deepEqual(
      session?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      [
        { role: 'user', content: 'local user turn' },
        { role: 'assistant', content: 'background final message' },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store creates agent-scoped thread drafts instead of reusing the agent main session',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const createSessionKeyCalls: Array<{ instanceId: string; agentId?: string | null }> = [];
    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 710,
      createSessionKey(instanceId, agentId) {
        createSessionKeyCalls.push({ instanceId, agentId });
        return `agent:${agentId}:main:thread:claw-studio:draft-1`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A', {
      agentId: 'research',
    });

    assert.equal(draft.id, 'agent:research:main:thread:claw-studio:draft-1');
    assert.deepEqual(createSessionKeyCalls, [
      {
        instanceId: 'instance-a',
        agentId: 'research',
      },
    ]);

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'hello research',
      model: 'anthropic/claude-3-7-sonnet',
    });

    assert.deepEqual(client.sendCalls, [
      {
        sessionKey: 'agent:research:main:thread:claw-studio:draft-1',
        message: 'hello research',
        deliver: false,
        idempotencyKey: 'run-1',
      },
    ]);
  },
);

await runTest(
  'openclaw gateway session store leaves the draft model empty when a new thread is created before model selection is resolved',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 715,
      createSessionKey(instanceId, agentId) {
        return `agent:${agentId}:main:thread:claw-studio:${instanceId}:draft-empty-model`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', undefined, {
      agentId: 'research',
    });

    assert.equal(draft.id, 'agent:research:main:thread:claw-studio:instance-a:draft-empty-model');
    assert.equal(draft.model, '');
  },
);

await runTest(
  'openclaw gateway session store accepts explicit upstream agent main session ids for new drafts',
  async () => {
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 0,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [],
      },
      {},
    );

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 720,
      createSessionKey(instanceId, _agentId) {
        return `claw-studio:${instanceId}:should-not-be-used`;
      },
    });

    await store.hydrateInstance('instance-a');
    const draft = store.createDraftSession('instance-a', 'OpenClaw A', {
      sessionId: 'agent:research:main',
    });
    assert.equal(draft.id, 'agent:research:main');

    await store.sendMessage({
      instanceId: 'instance-a',
      sessionId: draft.id,
      content: 'hello research',
      model: 'anthropic/claude-3-7-sonnet',
    });

    assert.deepEqual(client.sendCalls, [
      {
        sessionKey: 'agent:research:main',
        message: 'hello research',
        deliver: false,
        idempotencyKey: 'run-1',
      },
    ]);
  },
);

await runTest(
  'openclaw gateway session store preserves sender labels from history and transcript updates',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-sender-labels';
    const client = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Sender Labels',
            updatedAt: 420,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: 'medium',
          messages: [
            {
              id: 'msg-history-user',
              role: 'user',
              senderLabel: 'Iris',
              content: [{ type: 'text', text: 'history user message' }],
              timestamp: 420,
            },
          ],
        },
      },
    );
    client.setConnectHello({
      type: 'hello-ok',
      protocol: 3,
      features: {
        methods: [
          'sessions.subscribe',
          'sessions.list',
          'chat.history',
          'chat.send',
          'sessions.messages.subscribe',
          'sessions.messages.unsubscribe',
        ],
        events: ['chat', 'sessions.changed', 'session.message'],
      },
    });

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return client;
      },
      now: () => 430,
    });

    await store.hydrateInstance('instance-a');
    await waitFor(() => client.subscribeSessionMessagesCalls.includes(sessionId));

    let session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        id: message.id,
        role: message.role,
        senderLabel: message.senderLabel ?? null,
        content: message.content,
      })),
      [
        {
          id: 'msg-history-user',
          role: 'user',
          senderLabel: 'Iris',
          content: 'history user message',
        },
      ],
    );

    client.emitSessionMessage({
      sessionKey: sessionId,
      messageId: 'msg-live-user',
      message: {
        id: 'msg-live-user',
        role: 'user',
        senderLabel: 'Joaquin De Rojas',
        content: [{ type: 'text', text: 'live user message' }],
        timestamp: 431,
      },
    });

    session = store.getSnapshot('instance-a').sessions.find((entry) => entry.id === sessionId);
    assert.ok(session);
    assert.deepEqual(
      session?.messages.map((message) => ({
        id: message.id,
        role: message.role,
        senderLabel: message.senderLabel ?? null,
        content: message.content,
      })),
      [
        {
          id: 'msg-history-user',
          role: 'user',
          senderLabel: 'Iris',
          content: 'history user message',
        },
        {
          id: 'msg-live-user',
          role: 'user',
          senderLabel: 'Joaquin De Rojas',
          content: 'live user message',
        },
      ],
    );
  },
);

await runTest(
  'openclaw gateway session store releases a stale instance client and recreates state with a fresh client on the next hydrate',
  async () => {
    const sessionId = 'claw-studio:instance-a:session-release';
    const clientA = new MockGatewayClient(
      {
        ts: 1,
        path: 'sessions-a.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Release Me',
            updatedAt: 100,
            kind: 'direct',
            model: 'OpenClaw A',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: null,
          messages: [],
        },
      },
    );
    const clientB = new MockGatewayClient(
      {
        ts: 2,
        path: 'sessions-b.json',
        count: 1,
        defaults: {
          modelProvider: null,
          model: null,
          contextTokens: null,
        },
        sessions: [
          {
            key: sessionId,
            label: 'Reconnected',
            updatedAt: 200,
            kind: 'direct',
            model: 'OpenClaw B',
          },
        ],
      },
      {
        [sessionId]: {
          thinkingLevel: null,
          messages: [],
        },
      },
    );
    const clients = [clientA, clientB];
    let clientIndex = 0;

    const store = new OpenClawGatewaySessionStore({
      getClient() {
        return clients[Math.min(clientIndex++, clients.length - 1)];
      },
      now: () => 300,
    });

    await store.hydrateInstance('instance-a');
    assert.equal(clientA.subscribeCount, 1);
    assert.equal(clientA.disconnectCount, 0);

    store.releaseInstance('instance-a');
    assert.equal(clientA.disconnectCount, 1);
    assert.deepEqual(store.getSnapshot('instance-a').sessions, []);
    assert.equal(store.getSnapshot('instance-a').connectionStatus, 'disconnected');

    await store.hydrateInstance('instance-a');
    assert.equal(clientB.subscribeCount, 1);
    assert.equal(clientB.disconnectCount, 0);
    assert.equal(store.getSnapshot('instance-a').sessions[0]?.title, 'Reconnected');
  },
);
