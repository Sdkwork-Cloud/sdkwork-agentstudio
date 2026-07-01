import assert from 'node:assert/strict';

function runTest(name: string, fn: () => void | Promise<void>) {
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

let providerDescriptorServiceModule:
  | typeof import('./openClawProviderDescriptorService.ts')
  | undefined;

try {
  providerDescriptorServiceModule = await import('./openClawProviderDescriptorService.ts');
} catch {
  providerDescriptorServiceModule = undefined;
}

await runTest(
  'openClawProviderDescriptorService exposes title, icon, and adapter helpers',
  () => {
    assert.ok(
      providerDescriptorServiceModule,
      'Expected openClawProviderDescriptorService.ts to exist',
    );
    assert.equal(
      typeof providerDescriptorServiceModule?.titleizeOpenClawProviderKey,
      'function',
    );
    assert.equal(
      typeof providerDescriptorServiceModule?.getOpenClawProviderIcon,
      'function',
    );
    assert.equal(
      typeof providerDescriptorServiceModule?.resolveOpenClawProviderAdapter,
      'function',
    );
  },
);

await runTest(
  'openClawProviderDescriptorService resolves provider titles and adapter metadata consistently',
  () => {
    assert.equal(
      providerDescriptorServiceModule?.titleizeOpenClawProviderKey('tencent-hunyuan'),
      'Tencent Hunyuan',
    );
    assert.equal(
      providerDescriptorServiceModule?.getOpenClawProviderIcon('moonshot'),
      'KI',
    );
    assert.deepEqual(
      providerDescriptorServiceModule?.resolveOpenClawProviderAdapter('anthropic'),
      {
        api: 'anthropic-messages',
        auth: 'api-key',
      },
    );
    assert.deepEqual(
      providerDescriptorServiceModule?.resolveOpenClawProviderAdapter('gemini'),
      {
        api: 'google-generative-ai',
        auth: 'api-key',
      },
    );
    assert.deepEqual(
      providerDescriptorServiceModule?.resolveOpenClawProviderAdapter('openai-compatible'),
      {
        api: 'openai-completions',
        auth: 'api-key',
      },
    );
  },
);
