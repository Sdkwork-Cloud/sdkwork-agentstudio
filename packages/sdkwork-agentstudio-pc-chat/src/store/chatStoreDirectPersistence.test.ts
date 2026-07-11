import assert from 'node:assert/strict';

import {
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  createKernelChatAuthority,
  createKernelChatSessionRef,
} from '@sdkwork/agentstudio-pc-types';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/agentstudio-pc-infrastructure';
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

function resetChatStore() {
  chatStore.setState((state) => ({
    ...state,
    sessions: [],
    activeSessionIdByInstance: {},
    syncStateByInstance: {},
    gatewayConnectionStatusByInstance: {},
    lastErrorByInstance: {},
    instanceRouteModeById: {},
    instanceChatAdapterCapabilitiesById: {},
  }));
}

async function flushAsyncTasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createDirectConversationRecord(input: {
  id: string;
  agentId: string | null;
  updatedAt: number;
  model: string;
  title?: string;
  content?: string;
  lastSeenAt?: number | null;
}) {
  return {
    id: input.id,
    title: input.title ?? input.id,
    primaryInstanceId: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
    participantInstanceIds: [STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID],
    createdAt: input.updatedAt - 5,
    updatedAt: input.updatedAt,
    lastSeenAt: input.lastSeenAt ?? null,
    messageCount: 1,
    lastMessagePreview: input.content ?? `message-${input.id}`,
    kernelSession: {
      ref: createKernelChatSessionRef({
        kernelId: 'studio-direct',
        instanceId: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
        sessionId: input.id,
        agentId: input.agentId,
      }),
      authority: createKernelChatAuthority({
        kind: 'localProjection',
      }),
      lifecycle: 'ready',
      title: input.title ?? input.id,
      createdAt: input.updatedAt - 5,
      updatedAt: input.updatedAt,
      messageCount: 1,
      lastMessagePreview: input.content ?? `message-${input.id}`,
      sessionKind: 'direct',
      actorBinding: input.agentId
        ? {
            agentId: input.agentId,
            profileId: null,
            label: null,
          }
        : null,
      modelBinding: {
        model: input.model,
        defaultModel: input.model,
        thinkingLevel: null,
        fastMode: null,
        verboseLevel: null,
        reasoningLevel: null,
      },
      activeRunId: null,
    },
    messages: [
      {
        id: `message-${input.id}`,
        conversationId: input.id,
        role: 'assistant' as const,
        content: input.content ?? `message-${input.id}`,
        createdAt: input.updatedAt,
        updatedAt: input.updatedAt,
        status: 'complete' as const,
      },
    ],
  };
}

function createTransportBackedInstance(instanceId: string) {
  return {
    id: instanceId,
    name: 'HTTP Runtime',
    description: 'Fixture',
    runtimeKind: 'zeroclaw' as const,
    deploymentMode: 'remote' as const,
    transportKind: 'openaiHttp' as const,
    status: 'online' as const,
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server' as const,
    version: 'test',
    typeLabel: 'Fixture',
    host: '127.0.0.1',
    port: 18080,
    baseUrl: 'http://127.0.0.1:18080',
    websocketUrl: null,
    cpu: 0,
    memory: 0,
    totalMemory: '0 GB',
    uptime: '0m',
    capabilities: ['chat'] as const,
    storage: {
      provider: 'localFile' as const,
      namespace: 'fixture',
    },
    config: {
      port: '18080',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18080',
      websocketUrl: null,
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
  };
}

function createTransportConversationRecord(input: {
  instanceId: string;
  id: string;
  agentId: string | null;
  updatedAt: number;
  model: string;
  title?: string;
  content?: string;
}) {
  return {
    id: input.id,
    title: input.title ?? input.id,
    primaryInstanceId: input.instanceId,
    participantInstanceIds: [input.instanceId],
    createdAt: input.updatedAt - 5,
    updatedAt: input.updatedAt,
    messageCount: 2,
    lastMessagePreview: input.content ?? `message-${input.id}`,
    kernelSession: {
      ref: createKernelChatSessionRef({
        kernelId: 'zeroclaw',
        instanceId: input.instanceId,
        sessionId: input.id,
        agentId: input.agentId,
      }),
      authority: createKernelChatAuthority({
        kind: 'http',
        durable: false,
      }),
      lifecycle: 'ready',
      title: input.title ?? input.id,
      createdAt: input.updatedAt - 5,
      updatedAt: input.updatedAt,
      messageCount: 2,
      lastMessagePreview: input.content ?? `message-${input.id}`,
      sessionKind: 'transport',
      actorBinding: input.agentId
        ? {
            agentId: input.agentId,
            profileId: null,
            label: 'Ops Agent',
          }
        : null,
      modelBinding: {
        model: input.model,
        defaultModel: input.model,
        thinkingLevel: null,
        fastMode: null,
        verboseLevel: null,
        reasoningLevel: null,
      },
      activeRunId: null,
    },
    messages: [
      {
        id: `message-user-${input.id}`,
        conversationId: input.id,
        role: 'user' as const,
        content: 'hello transport',
        createdAt: input.updatedAt - 3,
        updatedAt: input.updatedAt - 3,
        status: 'complete' as const,
      },
      {
        id: `message-assistant-${input.id}`,
        conversationId: input.id,
        role: 'assistant' as const,
        content: input.content ?? `message-${input.id}`,
        createdAt: input.updatedAt,
        updatedAt: input.updatedAt,
        status: 'complete' as const,
      },
    ],
  };
}

function createGatewayConversationRecord(input: {
  instanceId: string;
  id: string;
  agentId: string | null;
  updatedAt: number;
  model: string;
  title?: string;
  content?: string;
}) {
  return {
    id: input.id,
    title: input.title ?? input.id,
    primaryInstanceId: input.instanceId,
    participantInstanceIds: [input.instanceId],
    createdAt: input.updatedAt - 10,
    updatedAt: input.updatedAt,
    messageCount: 2,
    lastMessagePreview: input.content ?? `message-${input.id}`,
    kernelSession: {
      ref: createKernelChatSessionRef({
        kernelId: 'openclaw',
        instanceId: input.instanceId,
        sessionId: input.id,
        nativeSessionId: input.id,
        routingKey: input.id,
        agentId: input.agentId,
      }),
      authority: createKernelChatAuthority({
        kind: 'gateway',
      }),
      lifecycle: 'ready',
      title: input.title ?? input.id,
      createdAt: input.updatedAt - 10,
      updatedAt: input.updatedAt,
      messageCount: 2,
      lastMessagePreview: input.content ?? `message-${input.id}`,
      sessionKind: 'agent',
      actorBinding: input.agentId
        ? {
            agentId: input.agentId,
            profileId: input.agentId,
            label: 'Research Agent',
          }
        : null,
      modelBinding: {
        model: input.model,
        defaultModel: input.model,
        thinkingLevel: null,
        fastMode: null,
        verboseLevel: null,
        reasoningLevel: null,
      },
      activeRunId: null,
      nativeMetadata: {
        routingKey: input.id,
      },
    },
    messages: [
      {
        id: `message-user-${input.id}`,
        conversationId: input.id,
        role: 'user' as const,
        content: 'gateway prompt',
        createdAt: input.updatedAt - 3,
        updatedAt: input.updatedAt - 3,
        status: 'complete' as const,
      },
      {
        id: `message-assistant-${input.id}`,
        conversationId: input.id,
        role: 'assistant' as const,
        content: input.content ?? `message-${input.id}`,
        createdAt: input.updatedAt,
        updatedAt: input.updatedAt,
        status: 'complete' as const,
      },
    ],
  };
}

await runTest(
  'chatStore hydrateInstance loads direct persisted conversations from the studio store in recent-activity order and restores agent ownership',
  async () => {
    const originalBridge = getPlatformBridge();
    const listCalls: string[] = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async listConversations(instanceId) {
          listCalls.push(instanceId);
          return [
            createDirectConversationRecord({
              id: 'session-older',
              agentId: 'ops',
              updatedAt: 10,
              model: 'openai/gpt-4.1-mini',
            }),
            createDirectConversationRecord({
              id: 'session-latest',
              agentId: 'research',
              updatedAt: 50,
              model: 'openai/gpt-4.1',
            }),
          ];
        },
      },
    });

    try {
      await chatStore.getState().hydrateInstance(undefined);
      const state = chatStore.getState();
      const directSessions = state.sessions.filter((session) => !session.instanceId);

      assert.deepEqual(listCalls, [STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID]);
      assert.deepEqual(
        directSessions.map((session) => session.id),
        ['session-latest', 'session-older'],
      );
      assert.equal(directSessions[0]?.agentId, 'research');
      assert.equal(directSessions[1]?.agentId, 'ops');
      assert.equal(state.activeSessionIdByInstance.__direct__, 'session-latest');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore setActiveSession normalizes direct message display order by authoritative sequence while seen state follows the newest timestamp',
  async () => {
    resetChatStore();

    chatStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: 'session-seq-normalized',
          title: 'Sequence normalized',
          createdAt: 1,
          updatedAt: 1,
          lastSeenAt: null,
          messages: [
            {
              id: 'message-assistant',
              role: 'assistant',
              content: 'assistant reply',
              timestamp: 50,
              seq: 2,
              runId: 'run-direct',
            },
            {
              id: 'message-user',
              role: 'user',
              content: 'user prompt',
              timestamp: 100,
              seq: 1,
            },
          ],
          model: 'openai/gpt-4.1',
          transport: 'local',
          runId: 'run-direct',
          sessionKind: 'direct',
        },
      ],
    }));

    try {
      await chatStore.getState().setActiveSession('session-seq-normalized');

      const session = chatStore.getState().sessions.find(
        (item) => item.id === 'session-seq-normalized',
      );

      assert.ok(session);
      assert.deepEqual(
        session.messages.map((message) => message.id),
        ['message-user', 'message-assistant'],
      );
      assert.deepEqual(
        session.messages.map((message) => message.kernelMessage?.nativeMetadata?.seq ?? null),
        [1, 2],
      );
      assert.equal(session.lastSeenAt, 100);
      assert.equal(chatStore.getState().activeSessionIdByInstance.__direct__, 'session-seq-normalized');
    } finally {
      resetChatStore();
    }
  },
);

await runTest(
  'chatStore deleteSession removes only the explicit direct-scope session when another instance reuses the same session id',
  async () => {
    const originalBridge = getPlatformBridge();
    const deletedConversationIds: string[] = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async deleteConversation(sessionId) {
          deletedConversationIds.push(sessionId);
        },
      },
    });

    try {
      chatStore.setState((state) => ({
        ...state,
        sessions: [
          {
            id: 'shared-session',
            title: 'Direct shared session',
            createdAt: 1,
            updatedAt: 20,
            messages: [],
            model: 'direct-model',
            transport: 'local',
          },
          {
            id: 'shared-session',
            title: 'Instance shared session',
            createdAt: 1,
            updatedAt: 10,
            messages: [
              {
                id: 'instance-message',
                role: 'assistant',
                content: 'instance reply should stay',
                timestamp: 10,
              },
            ],
            model: 'instance-model',
            instanceId: 'instance-a',
            transport: 'kernelAdapter',
          },
        ],
        activeSessionIdByInstance: {
          __direct__: 'shared-session',
          'instance-a': 'shared-session',
        },
      }));

      await chatStore.getState().deleteSession('shared-session', null);
      await flushAsyncTasks();

      const state = chatStore.getState();

      assert.deepEqual(
        state.sessions.map((session) => ({
          id: session.id,
          instanceId: session.instanceId ?? null,
          messageCount: session.messages.length,
        })),
        [
          {
            id: 'shared-session',
            instanceId: 'instance-a',
            messageCount: 1,
          },
        ],
      );
      assert.equal(state.activeSessionIdByInstance.__direct__, null);
      assert.equal(state.activeSessionIdByInstance['instance-a'], 'shared-session');
      assert.deepEqual(deletedConversationIds, ['shared-session']);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore clearSession clears only the explicit direct-scope message list when another instance reuses the same session id',
  async () => {
    const originalBridge = getPlatformBridge();
    const savedConversationIds: string[] = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async putConversation(record) {
          savedConversationIds.push(record.id);
          return record;
        },
      },
    });

    try {
      chatStore.setState((state) => ({
        ...state,
        sessions: [
          {
            id: 'shared-session',
            title: 'Direct shared session',
            createdAt: 1,
            updatedAt: 20,
            messages: [
              {
                id: 'direct-message',
                role: 'user',
                content: 'direct prompt to clear',
                timestamp: 20,
              },
            ],
            model: 'direct-model',
            transport: 'local',
          },
          {
            id: 'shared-session',
            title: 'Instance shared session',
            createdAt: 1,
            updatedAt: 10,
            messages: [
              {
                id: 'instance-message',
                role: 'assistant',
                content: 'instance reply should stay',
                timestamp: 10,
              },
            ],
            model: 'instance-model',
            instanceId: 'instance-a',
            transport: 'kernelAdapter',
          },
        ],
        activeSessionIdByInstance: {
          __direct__: 'shared-session',
          'instance-a': 'shared-session',
        },
      }));

      await chatStore.getState().clearSession('shared-session', null);
      await flushAsyncTasks();

      const directSession = chatStore
        .getState()
        .sessions.find((session) => session.id === 'shared-session' && !session.instanceId);
      const instanceSession = chatStore
        .getState()
        .sessions.find((session) => session.id === 'shared-session' && session.instanceId === 'instance-a');

      assert.equal(directSession?.messages.length, 0);
      assert.equal(directSession?.lastMessagePreview, undefined);
      assert.deepEqual(
        instanceSession?.messages.map((message) => message.content),
        ['instance reply should stay'],
      );
      assert.deepEqual(savedConversationIds, ['shared-session']);
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore updateMessage leaves session ordering and persistence untouched when the target message is missing',
  async () => {
    const originalBridge = getPlatformBridge();
    const savedConversationIds: string[] = [];
    const originalNow = Date.now;
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async putConversation(record) {
          savedConversationIds.push(record.id);
          return record;
        },
      },
    });

    try {
      Date.now = () => 500;
      chatStore.setState((state) => ({
        ...state,
        sessions: [
          {
            id: 'direct-session',
            title: 'Direct session',
            createdAt: 1,
            updatedAt: 20,
            messages: [
              {
                id: 'existing-message',
                role: 'assistant',
                content: 'existing reply',
                timestamp: 20,
              },
            ],
            model: 'direct-model',
            transport: 'local',
          },
        ],
      }));

      chatStore.getState().updateMessage(
        'direct-session',
        'missing-message',
        'must not be applied',
        null,
      );
      await flushAsyncTasks();

      const session = chatStore
        .getState()
        .sessions.find((item) => item.id === 'direct-session');

      assert.equal(session?.updatedAt, 20);
      assert.deepEqual(
        session?.messages.map((message) => ({
          id: message.id,
          content: message.content,
          timestamp: message.timestamp,
        })),
        [
          {
            id: 'existing-message',
            content: 'existing reply',
            timestamp: 20,
          },
        ],
      );
      assert.deepEqual(savedConversationIds, []);
    } finally {
      Date.now = originalNow;
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore updateMessage can apply streaming content without writing every intermediate chunk to persistence',
  async () => {
    const originalBridge = getPlatformBridge();
    const savedConversationIds: string[] = [];
    const originalNow = Date.now;
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async putConversation(record) {
          savedConversationIds.push(record.id);
          return record;
        },
      },
    });

    try {
      Date.now = () => 700;
      chatStore.setState((state) => ({
        ...state,
        sessions: [
          {
            id: 'streaming-session',
            title: 'Streaming session',
            createdAt: 1,
            updatedAt: 20,
            messages: [
              {
                id: 'assistant-streaming-message',
                role: 'assistant',
                content: '',
                timestamp: 20,
              },
            ],
            model: 'direct-model',
            transport: 'local',
          },
        ],
      }));

      chatStore.getState().updateMessage(
        'streaming-session',
        'assistant-streaming-message',
        'partial streamed reply',
        null,
        { persist: false },
      );
      await flushAsyncTasks();

      const session = chatStore
        .getState()
        .sessions.find((item) => item.id === 'streaming-session');

      assert.equal(session?.messages[0]?.content, 'partial streamed reply');
      assert.equal(session?.updatedAt, 700);
      assert.deepEqual(savedConversationIds, []);
    } finally {
      Date.now = originalNow;
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore hydrateInstance for the direct scope ignores built-in OpenClaw gateway mirror records that share the same storage namespace',
  async () => {
    const originalBridge = getPlatformBridge();
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async listConversations(instanceId) {
          assert.equal(instanceId, STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID);
          return [
            createDirectConversationRecord({
              id: 'session-direct-main',
              agentId: 'ops',
              updatedAt: 40,
              model: 'openai/gpt-4.1-mini',
              content: 'direct conversation',
            }),
            createGatewayConversationRecord({
              instanceId: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
              id: 'agent:research:main',
              agentId: 'research',
              updatedAt: 80,
              model: 'openai/gpt-4.1',
              content: 'built-in gateway mirror',
            }),
          ];
        },
      },
    });

    try {
      await chatStore.getState().hydrateInstance(undefined);
      const state = chatStore.getState();

      assert.deepEqual(state.sessions.map((session) => session.id), ['session-direct-main']);
      assert.equal(state.sessions[0]?.instanceId, undefined);
      assert.equal(state.activeSessionIdByInstance.__direct__, 'session-direct-main');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore persists direct draft sessions and message activity through the studio conversation store with standardized kernel bindings',
  async () => {
    const originalBridge = getPlatformBridge();
    const savedRecords: any[] = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async putConversation(record) {
          savedRecords.push(record);
          return record;
        },
      },
    });

    const originalNow = Date.now;

    try {
      Date.now = () => 100;
      const sessionId = await chatStore.getState().createSession('openai/gpt-4.1', undefined, {
        agentId: 'research',
        agentLabel: 'Research Agent',
      });
      await flushAsyncTasks();

      assert.equal(sessionId.length > 0, true);
      assert.equal(savedRecords.length > 0, true);
      assert.equal(savedRecords[0]?.kernelSession?.ref?.agentId, 'research');
      assert.equal(
        savedRecords[0]?.kernelSession?.actorBinding?.label,
        'Research Agent',
      );
      assert.equal(savedRecords[0]?.kernelSession?.modelBinding?.model, 'openai/gpt-4.1');
      assert.equal(savedRecords[0]?.updatedAt, 100);

      Date.now = () => 220;
      chatStore.getState().addMessage(sessionId, {
        role: 'assistant',
        content: 'remote reply',
        senderLabel: 'Research Agent',
      });
      await flushAsyncTasks();

      const lastSavedRecord = savedRecords.at(-1);
      assert.equal(lastSavedRecord?.updatedAt, 220);
      assert.equal(lastSavedRecord?.messages?.at(-1)?.kernelMessage?.senderLabel, 'Research Agent');
      assert.equal(
        lastSavedRecord?.messages?.at(-1)?.kernelMessage?.updatedAt,
        220,
      );
      assert.equal(lastSavedRecord?.kernelSession?.ref?.agentId, 'research');
      assert.equal(
        lastSavedRecord?.kernelSession?.actorBinding?.label,
        'Research Agent',
      );
    } finally {
      Date.now = originalNow;
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore keeps direct session unread state in persistent storage until the session becomes active',
  async () => {
    const originalBridge = getPlatformBridge();
    const savedRecords: any[] = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async putConversation(record) {
          savedRecords.push(record);
          return record;
        },
      },
    });

    const originalNow = Date.now;

    try {
      Date.now = () => 100;
      const firstSessionId = await chatStore.getState().createSession('openai/gpt-4.1', undefined, {
        agentId: 'research',
        agentLabel: 'Research Agent',
      });
      await flushAsyncTasks();

      Date.now = () => 140;
      await chatStore.getState().createSession('openai/gpt-4.1-mini', undefined, {
        agentId: 'ops',
        agentLabel: 'Ops Agent',
      });
      await flushAsyncTasks();

      Date.now = () => 200;
      chatStore.getState().addMessage(firstSessionId, {
        role: 'assistant',
        content: 'background update',
        senderLabel: 'Research Agent',
      });
      await flushAsyncTasks();

      const unreadRecord = [...savedRecords]
        .reverse()
        .find((record) => record.id === firstSessionId);
      assert.equal(unreadRecord?.updatedAt, 200);
      assert.equal(unreadRecord?.lastSeenAt, 100);

      await chatStore.getState().setActiveSession(firstSessionId, undefined);
      await flushAsyncTasks();

      const seenRecord = savedRecords.at(-1);
      const directSession = chatStore
        .getState()
        .sessions.find((session) => session.id === firstSessionId);

      assert.equal(seenRecord?.id, firstSessionId);
      assert.equal(seenRecord?.lastSeenAt, 200);
      assert.equal(directSession?.lastSeenAt, 200);
      assert.equal(chatStore.getState().activeSessionIdByInstance.__direct__, firstSessionId);
    } finally {
      Date.now = originalNow;
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore hydrateInstance restores persisted non-durable transport-backed conversations for instance-scoped history',
  async () => {
    const instanceId = 'instance-http-persisted';
    const originalBridge = getPlatformBridge();
    const listCalls: string[] = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          assert.equal(requestedInstanceId, instanceId);
          return createTransportBackedInstance(instanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async listConversations(requestedInstanceId) {
          listCalls.push(requestedInstanceId);
          return [
            createTransportConversationRecord({
              instanceId,
              id: 'transport-session-latest',
              agentId: 'ops',
              updatedAt: 60,
              model: 'openai/gpt-4.1-mini',
              content: 'transport reply',
            }),
          ];
        },
      },
    });

    try {
      await chatStore.getState().hydrateInstance(instanceId);
      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);

      assert.deepEqual(listCalls, [instanceId]);
      assert.deepEqual(scopedSessions.map((session) => session.id), ['transport-session-latest']);
      assert.equal(scopedSessions[0]?.transport, 'kernelAdapter');
      assert.equal(scopedSessions[0]?.messages[1]?.content, 'transport reply');
      assert.equal(state.activeSessionIdByInstance[instanceId], 'transport-session-latest');
    } finally {
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore persists non-durable transport-backed conversations after instance-scoped session creation and message updates',
  async () => {
    const instanceId = 'instance-http-writeback';
    const originalBridge = getPlatformBridge();
    const savedRecords: any[] = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          assert.equal(requestedInstanceId, instanceId);
          return createTransportBackedInstance(instanceId);
        },
        async getInstanceDetail() {
          return null;
        },
        async putConversation(record) {
          savedRecords.push(record);
          return record;
        },
      },
    });

    const originalNow = Date.now;

    try {
      Date.now = () => 100;
      const sessionId = await chatStore.getState().createSession(
        'openai/gpt-4.1-mini',
        instanceId,
        {
          agentId: 'ops',
          agentLabel: 'Ops Agent',
        },
      );
      await flushAsyncTasks();

      Date.now = () => 180;
      chatStore.getState().addMessage(sessionId, {
        role: 'assistant',
        content: 'transport persisted reply',
        senderLabel: 'Ops Agent',
      });
      await flushAsyncTasks();

      const lastSavedRecord = savedRecords.at(-1);

      assert.equal(savedRecords.length > 0, true);
      assert.equal(lastSavedRecord?.primaryInstanceId, instanceId);
      assert.equal(lastSavedRecord?.kernelSession?.authority.kind, 'http');
      assert.equal(lastSavedRecord?.kernelSession?.authority.durable, false);
      assert.equal(lastSavedRecord?.kernelSession?.ref?.agentId, 'ops');
      assert.equal(lastSavedRecord?.kernelSession?.actorBinding?.label, 'Ops Agent');
      assert.equal(lastSavedRecord?.messages?.at(-1)?.kernelMessage?.senderLabel, 'Ops Agent');
      assert.equal(lastSavedRecord?.updatedAt, 180);
    } finally {
      Date.now = originalNow;
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore hydrateInstance restores cached OpenClaw gateway sessions before the live gateway becomes reachable',
  async () => {
    const instanceId = 'instance-openclaw-cached';
    const originalBridge = getPlatformBridge();
    const originalWebSocket = globalThis.WebSocket;
    const listCalls: string[] = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          assert.equal(requestedInstanceId, instanceId);
          return {
            id: instanceId,
            name: 'Cached OpenClaw',
            description: 'Fixture',
            runtimeKind: 'openclaw' as const,
            deploymentMode: 'local-managed' as const,
            transportKind: 'openclawGatewayWs' as const,
            status: 'online' as const,
            isBuiltIn: false,
            isDefault: false,
            iconType: 'server' as const,
            version: 'test',
            typeLabel: 'Fixture',
            host: '127.0.0.1',
            port: 18797,
            baseUrl: 'http://127.0.0.1:18797/openclaw',
            websocketUrl: 'ws://127.0.0.1:18797/openclaw/ws',
            cpu: 0,
            memory: 0,
            totalMemory: '0 GB',
            uptime: '0m',
            capabilities: ['chat'] as const,
            storage: {
              provider: 'localFile' as const,
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
            },
            createdAt: 1,
            updatedAt: 1,
            lastSeenAt: 1,
          };
        },
        async getInstanceDetail(requestedInstanceId) {
          assert.equal(requestedInstanceId, instanceId);
          return null;
        },
        async listConversations(requestedInstanceId) {
          listCalls.push(requestedInstanceId);
          return [
            createGatewayConversationRecord({
              instanceId,
              id: 'agent:research:main',
              agentId: 'research',
              updatedAt: 60,
              model: 'openai/gpt-4.1',
              content: 'cached gateway reply',
            }),
          ];
        },
      },
    });

    try {
      globalThis.WebSocket = class {
        constructor() {
          throw new Error('gateway websocket unavailable in test');
        }
      } as typeof WebSocket;

      await chatStore.getState().hydrateInstance(instanceId);
      await flushAsyncTasks();

      const state = chatStore.getState();
      const scopedSessions = state.sessions.filter((session) => session.instanceId === instanceId);

      assert.deepEqual(listCalls, [instanceId]);
      assert.deepEqual(scopedSessions.map((session) => session.id), ['agent:research:main']);
      assert.equal(scopedSessions[0]?.transport, 'openclawGateway');
      assert.equal(scopedSessions[0]?.kernelSession?.authority.kind, 'gateway');
      assert.equal(scopedSessions[0]?.agentId, 'research');
      assert.equal(scopedSessions[0]?.messages[1]?.content, 'cached gateway reply');
      assert.equal(state.activeSessionIdByInstance[instanceId], 'agent:research:main');
      assert.equal(state.syncStateByInstance[instanceId], 'error');
    } finally {
      globalThis.WebSocket = originalWebSocket;
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'chatStore hydrateInstance keeps cached built-in OpenClaw gateway sessions inside the built-in instance scope instead of reclassifying them as direct conversations',
  async () => {
    const instanceId = STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID;
    const originalBridge = getPlatformBridge();
    const originalWebSocket = globalThis.WebSocket;
    const listCalls: string[] = [];
    resetChatStore();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(requestedInstanceId) {
          assert.equal(requestedInstanceId, instanceId);
          return {
            id: instanceId,
            name: 'Built-in OpenClaw',
            description: 'Fixture',
            runtimeKind: 'openclaw' as const,
            deploymentMode: 'local-managed' as const,
            transportKind: 'openclawGatewayWs' as const,
            status: 'online' as const,
            isBuiltIn: true,
            isDefault: true,
            iconType: 'sparkles' as const,
            version: 'test',
            typeLabel: 'Fixture',
            host: '127.0.0.1',
            port: 18797,
            baseUrl: 'http://127.0.0.1:18797/openclaw',
            websocketUrl: 'ws://127.0.0.1:18797/openclaw/ws',
            cpu: 0,
            memory: 0,
            totalMemory: '0 GB',
            uptime: '0m',
            capabilities: ['chat'] as const,
            storage: {
              provider: 'localFile' as const,
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
            },
            createdAt: 1,
            updatedAt: 1,
            lastSeenAt: 1,
          };
        },
        async getInstanceDetail(requestedInstanceId) {
          assert.equal(requestedInstanceId, instanceId);
          return null;
        },
        async listConversations(requestedInstanceId) {
          listCalls.push(requestedInstanceId);
          return [
            createGatewayConversationRecord({
              instanceId,
              id: 'agent:research:main',
              agentId: 'research',
              updatedAt: 60,
              model: 'openai/gpt-4.1',
              content: 'cached built-in gateway reply',
            }),
          ];
        },
      },
    });

    try {
      globalThis.WebSocket = class {
        constructor() {
          throw new Error('gateway websocket unavailable in test');
        }
      } as typeof WebSocket;

      await chatStore.getState().hydrateInstance(instanceId);
      await flushAsyncTasks();

      const state = chatStore.getState();
      const builtInSessions = state.sessions.filter((session) => session.instanceId === instanceId);
      const directSessions = state.sessions.filter((session) => !session.instanceId);

      assert.deepEqual(listCalls, [instanceId]);
      assert.deepEqual(builtInSessions.map((session) => session.id), ['agent:research:main']);
      assert.equal(builtInSessions[0]?.transport, 'openclawGateway');
      assert.equal(state.activeSessionIdByInstance[instanceId], 'agent:research:main');
      assert.deepEqual(directSessions.map((session) => session.id), []);
    } finally {
      globalThis.WebSocket = originalWebSocket;
      resetChatStore();
      configurePlatformBridge(originalBridge);
    }
  },
);
