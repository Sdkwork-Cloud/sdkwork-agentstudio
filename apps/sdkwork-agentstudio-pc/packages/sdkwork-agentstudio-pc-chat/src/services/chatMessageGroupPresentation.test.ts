import assert from 'node:assert/strict';
import * as services from './index.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'presentChatMessageGroupFooter prefers explicit sender labels for grouped external user turns',
  () => {
    assert.equal(typeof (services as any).presentChatMessageGroupFooter, 'function');

    assert.deepEqual(
      (services as any).presentChatMessageGroupFooter({
        role: 'user',
        senderLabel: 'Iris',
        messages: [
          {
            role: 'user',
            timestamp: Date.UTC(2026, 3, 3, 12, 0, 0),
          },
        ],
        assistantLabel: 'Assistant',
        userLabel: 'You',
        toolLabel: 'Tool output',
        systemLabel: 'System',
      }),
      {
        label: 'Iris',
        timestamp: Date.UTC(2026, 3, 3, 12, 0, 0),
        modelLabel: null,
      },
    );
  },
);

await runTest(
  'presentChatMessageGroupFooter condenses assistant model metadata to a single readable footer chip',
  () => {
    assert.equal(typeof (services as any).presentChatMessageGroupFooter, 'function');

    assert.deepEqual(
      (services as any).presentChatMessageGroupFooter({
        role: 'assistant',
        messages: [
          {
            role: 'assistant',
            timestamp: Date.UTC(2026, 3, 3, 12, 5, 0),
            model: 'openai/gpt-5.1',
          },
          {
            role: 'assistant',
            timestamp: Date.UTC(2026, 3, 3, 12, 6, 0),
            model: 'openai/gpt-5.1',
          },
        ],
        assistantLabel: 'Assistant',
        userLabel: 'You',
        toolLabel: 'Tool output',
        systemLabel: 'System',
      }),
      {
        label: 'Assistant',
        timestamp: Date.UTC(2026, 3, 3, 12, 5, 0),
        modelLabel: 'gpt-5.1',
      },
    );
  },
);

await runTest(
  'presentChatMessageGroupFooter ignores gateway-injected placeholder model labels',
  () => {
    assert.equal(typeof (services as any).presentChatMessageGroupFooter, 'function');

    assert.deepEqual(
      (services as any).presentChatMessageGroupFooter({
        role: 'assistant',
        messages: [
          {
            role: 'assistant',
            timestamp: Date.UTC(2026, 3, 3, 12, 8, 0),
            model: 'gateway-injected',
          },
        ],
        assistantLabel: 'Assistant',
        userLabel: 'You',
        toolLabel: 'Tool output',
        systemLabel: 'System',
      }),
      {
        label: 'Assistant',
        timestamp: Date.UTC(2026, 3, 3, 12, 8, 0),
        modelLabel: null,
      },
    );
  },
);
