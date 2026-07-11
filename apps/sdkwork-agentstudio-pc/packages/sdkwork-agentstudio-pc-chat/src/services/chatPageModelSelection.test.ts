import assert from 'node:assert/strict';
import { resolveChatPageModelSelection } from './chatPageModelSelection.ts';

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

await runTest(
  'resolveChatPageModelSelection synthesizes a fallback gateway channel from the active session model',
  () => {
    assert.deepEqual(
      resolveChatPageModelSelection({
        catalogChannels: [],
        sessionSelectedModelId: 'anthropic/claude-sonnet-4',
        activeChannelId: '',
        activeModelId: '',
      }),
      {
        channels: [
          {
            id: 'anthropic',
            name: 'Anthropic',
            provider: 'anthropic',
            baseUrl: '',
            apiKey: '',
            icon: 'AI',
            defaultModelId: 'anthropic/claude-sonnet-4',
            models: [
              {
                id: 'anthropic/claude-sonnet-4',
                name: 'claude-sonnet-4',
              },
            ],
          },
        ],
        activeChannel: {
          id: 'anthropic',
          name: 'Anthropic',
          provider: 'anthropic',
          baseUrl: '',
          apiKey: '',
          icon: 'AI',
          defaultModelId: 'anthropic/claude-sonnet-4',
          models: [
            {
              id: 'anthropic/claude-sonnet-4',
              name: 'claude-sonnet-4',
            },
          ],
        },
        activeModel: {
          id: 'anthropic/claude-sonnet-4',
          name: 'claude-sonnet-4',
        },
      },
    );
  },
);

await runTest(
  'resolveChatPageModelSelection prefers the channel containing the preferred model over stale persisted channel ids',
  () => {
    const result = resolveChatPageModelSelection({
      catalogChannels: [
        {
          id: 'openai',
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: '',
          apiKey: '',
          icon: 'AI',
          defaultModelId: 'openai/gpt-4.1',
          models: [
            {
              id: 'openai/gpt-4.1',
              name: 'GPT-4.1',
            },
          ],
        },
        {
          id: 'anthropic',
          name: 'Anthropic',
          provider: 'anthropic',
          baseUrl: '',
          apiKey: '',
          icon: 'AI',
          defaultModelId: 'anthropic/claude-sonnet-4',
          models: [
            {
              id: 'anthropic/claude-sonnet-4',
              name: 'Claude Sonnet 4',
            },
          ],
        },
      ],
      sessionSelectedModelId: 'anthropic/claude-sonnet-4',
      activeChannelId: 'openai',
      activeModelId: 'openai/gpt-4.1',
    });

    assert.equal(result.activeChannel?.id, 'anthropic');
    assert.equal(result.activeModel?.id, 'anthropic/claude-sonnet-4');
  },
);

await runTest(
  'resolveChatPageModelSelection falls back to the stored channel and model when no session-specific model is pinned',
  () => {
    const result = resolveChatPageModelSelection({
      catalogChannels: [
        {
          id: 'openai',
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: '',
          apiKey: '',
          icon: 'AI',
          defaultModelId: 'openai/gpt-4.1',
          models: [
            {
              id: 'openai/gpt-4.1',
              name: 'GPT-4.1',
            },
            {
              id: 'openai/gpt-4.1-mini',
              name: 'GPT-4.1 mini',
            },
          ],
        },
      ],
      sessionSelectedModelId: null,
      activeChannelId: 'openai',
      activeModelId: 'openai/gpt-4.1-mini',
    });

    assert.equal(result.activeChannel?.id, 'openai');
    assert.equal(result.activeModel?.id, 'openai/gpt-4.1-mini');
  },
);

await runTest(
  'resolveChatPageModelSelection falls back to the first available model when persisted ids are missing',
  () => {
    const result = resolveChatPageModelSelection({
      catalogChannels: [
        {
          id: 'sdkwork',
          name: 'Sdkwork Chat',
          provider: 'sdkwork',
          baseUrl: '',
          apiKey: '',
          icon: 'AI',
          models: [
            {
              id: 'sdkwork/default',
              name: 'Default',
            },
          ],
        },
      ],
      sessionSelectedModelId: null,
      activeChannelId: '',
      activeModelId: '',
    });

    assert.equal(result.activeChannel?.id, 'sdkwork');
    assert.equal(result.activeModel?.id, 'sdkwork/default');
  },
);
