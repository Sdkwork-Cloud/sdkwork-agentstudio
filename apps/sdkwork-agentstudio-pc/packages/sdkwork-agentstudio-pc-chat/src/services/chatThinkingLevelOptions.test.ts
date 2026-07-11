import assert from 'node:assert/strict';
import {
  resolveChatThinkingLevelDefaultOption,
  resolveChatThinkingLevelOptions,
} from './chatThinkingLevelOptions.ts';

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
  'resolveChatThinkingLevelOptions returns the provider-aware general selector levels for most OpenClaw models',
  () => {
    assert.deepEqual(
      resolveChatThinkingLevelOptions('openai/gpt-5.1'),
      ['off', 'minimal', 'low', 'medium', 'high', 'adaptive'],
    );
    assert.deepEqual(
      resolveChatThinkingLevelOptions('anthropic/claude-sonnet-4-6'),
      ['off', 'minimal', 'low', 'medium', 'high', 'adaptive'],
    );
  },
);

await runTest(
  'resolveChatThinkingLevelOptions uses the binary z.ai selector when the active model is backed by z.ai',
  () => {
    assert.deepEqual(resolveChatThinkingLevelOptions('zai/glm-4.6'), ['off', 'on']);
  },
);

await runTest(
  'resolveChatThinkingLevelOptions hides the selector until an active gateway model is known',
  () => {
    assert.deepEqual(resolveChatThinkingLevelOptions(null), []);
    assert.deepEqual(resolveChatThinkingLevelOptions(''), []);
  },
);

await runTest(
  'resolveChatThinkingLevelDefaultOption mirrors the upstream adaptive fallback for Claude 4.6 on Anthropic and Bedrock',
  () => {
    assert.equal(
      resolveChatThinkingLevelDefaultOption('anthropic/claude-sonnet-4-6'),
      'adaptive',
    );
    assert.equal(
      resolveChatThinkingLevelDefaultOption('amazon-bedrock/anthropic.claude-opus-4-6'),
      'adaptive',
    );
  },
);

await runTest(
  'resolveChatThinkingLevelDefaultOption resolves low for other reasoning-capable models and off otherwise',
  () => {
    assert.equal(resolveChatThinkingLevelDefaultOption('openai/o4-mini'), 'low');
    assert.equal(resolveChatThinkingLevelDefaultOption('openai/gpt-4.1'), 'off');
  },
);

await runTest(
  'resolveChatThinkingLevelDefaultOption maps reasoning-capable z.ai defaults onto the binary provider picker',
  () => {
    assert.equal(resolveChatThinkingLevelDefaultOption('zai/glm-4.6'), 'on');
    assert.equal(resolveChatThinkingLevelDefaultOption('zai/basic-chat'), 'off');
  },
);
