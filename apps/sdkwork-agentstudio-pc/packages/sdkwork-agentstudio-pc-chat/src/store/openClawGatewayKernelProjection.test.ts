import assert from 'node:assert/strict';
import {
  OpenClawGatewaySessionStore,
  type OpenClawGatewayClientLike,
} from './openClawGatewaySessionStore.ts';

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

class MinimalGatewayClient implements OpenClawGatewayClientLike {
  async connect() {
    return {
      type: 'hello-ok' as const,
      protocol: 3,
      features: {
        methods: ['sessions.subscribe', 'sessions.messages.subscribe', 'sessions.messages.unsubscribe'],
        events: ['session.message'],
      },
    };
  }

  disconnect() {}

  async subscribeSessions() {
    return { ok: true };
  }

  async subscribeSessionMessages() {
    return { subscribed: true };
  }

  async unsubscribeSessionMessages() {
    return { subscribed: false };
  }

  async listSessions() {
    return {
      ts: 1,
      path: 'sessions.json',
      count: 1,
      defaults: {
        modelProvider: 'openai',
        model: 'gpt-4.1',
        contextTokens: null,
      },
      sessions: [
        {
          key: 'agent:research:main',
          label: 'Research Main',
          updatedAt: 100,
          kind: 'direct',
          modelProvider: 'openai',
          model: 'gpt-4.1',
          lastMessagePreview: 'Kernel metadata should project from gateway sessions',
        },
      ],
    };
  }

  async getChatHistory() {
    return {
      thinkingLevel: 'medium',
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          text: 'Kernel standard response',
          content: [
            {
              type: 'thinking',
              thinking: 'project reasoning separately',
            },
            {
              type: 'tool_call',
              name: 'web.search',
              args: {
                query: 'kernel standard',
              },
            },
            {
              type: 'tool_result',
              name: 'web.search',
              text: 'source results',
            },
          ],
          attachments: [
            {
              id: 'file-1',
              kind: 'file',
              name: 'kernel-chat.md',
            },
          ],
        },
      ],
    };
  }

  async listModels() {
    return {
      models: [],
    };
  }

  async patchSession() {
    return {
      ok: true,
    };
  }

  async sendChatMessage() {
    return {
      runId: 'run-1',
    };
  }

  async abortChatRun() {
    return {
      ok: true,
    };
  }

  async resetSession() {
    return {
      ok: true,
    };
  }

  async deleteSession() {
    return {
      ok: true,
    };
  }

  on() {
    return () => {};
  }
}

await runTest('openclaw gateway snapshots expose kernel-standard session and message metadata', async () => {
  const client = new MinimalGatewayClient();
  const store = new OpenClawGatewaySessionStore({
    getClient: async () => client,
  });

  await store.hydrateInstance('instance-a');
  const snapshot = store.getSnapshot('instance-a');
  const session = snapshot.sessions[0];
  const message = session?.messages[0];

  assert.ok(session?.kernelSession);
  assert.equal(session?.kernelSession?.authority.kind, 'gateway');
  assert.equal(session?.kernelSession?.ref.agentId, 'research');
  assert.equal(session?.kernelSession?.ref.routingKey, 'agent:research:main');
  assert.ok(message?.kernelMessage);
  assert.deepEqual(
    message?.kernelMessage?.parts.map((part) => part.kind),
    ['text', 'reasoning', 'attachment', 'toolCall', 'toolResult'],
  );
});
