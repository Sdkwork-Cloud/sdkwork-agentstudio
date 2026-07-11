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

let providerWorkbenchSupportModule:
  | typeof import('./openClawProviderWorkbenchSupport.ts')
  | undefined;

try {
  providerWorkbenchSupportModule = await import('./openClawProviderWorkbenchSupport.ts');
} catch {
  providerWorkbenchSupportModule = undefined;
}

await runTest(
  'openClawProviderWorkbenchSupport exposes shared provider mapping and clone helpers',
  () => {
    assert.ok(
      providerWorkbenchSupportModule,
      'Expected openClawProviderWorkbenchSupport.ts to exist',
    );
    assert.equal(typeof providerWorkbenchSupportModule?.mapConfigBackedProvider, 'function');
    assert.equal(typeof providerWorkbenchSupportModule?.mapLlmProvider, 'function');
    assert.equal(typeof providerWorkbenchSupportModule?.providerMatchesId, 'function');
    assert.equal(typeof providerWorkbenchSupportModule?.buildOpenClawLlmProviders, 'function');
  },
);

await runTest(
  'mapConfigBackedProvider deep-clones config-backed provider snapshots and presents api key sources through the shared formatter',
  () => {
    const mapped = providerWorkbenchSupportModule?.mapConfigBackedProvider({
      id: 'sdkwork-local-proxy',
      providerKey: 'sdkwork-local-proxy',
      name: 'SDKWork Local Proxy',
      provider: 'sdkwork-local-proxy',
      endpoint: 'http://127.0.0.1:21280/v1',
      apiKeySource: ' sk_sdkwork_api_key ',
      status: 'ready',
      defaultModelId: 'gpt-5.4',
      reasoningModelId: 'gpt-5.4',
      embeddingModelId: 'text-embedding-3-large',
      description: 'Config-backed local proxy projection.',
      icon: 'S',
      lastCheckedAt: '2026-04-02T00:00:00.000Z',
      capabilities: ['chat', 'embedding', 'reasoning'],
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
          role: 'primary',
          contextWindow: '200K',
        },
      ],
      config: {
        temperature: 0.2,
        topP: 1,
        maxTokens: 8192,
        timeoutMs: 60000,
        streaming: true,
      },
    } as any);

    assert.equal(mapped?.id, 'sdkwork-local-proxy');
    assert.equal(mapped?.apiKeySource, 'sk_sdkwork_api_key');
    assert.deepEqual(mapped?.capabilities, ['chat', 'embedding', 'reasoning']);
    assert.deepEqual(mapped?.models, [
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
        role: 'primary',
        contextWindow: '200K',
      },
    ]);
    assert.deepEqual(mapped?.config, {
      temperature: 0.2,
      topP: 1,
      maxTokens: 8192,
      timeoutMs: 60000,
      streaming: true,
    });

    mapped?.capabilities.push('vision');
    if (mapped?.models[0]) {
      mapped.models[0].name = 'Changed';
    }
    if (mapped?.config) {
      mapped.config.streaming = false;
    }

    assert.deepEqual(mapped?.capabilities, ['chat', 'embedding', 'reasoning', 'vision']);
    assert.equal(mapped?.models[0]?.name, 'Changed');
    assert.equal(mapped?.config.streaming, false);
  },
);

await runTest(
  'mapLlmProvider deep-clones live workbench providers',
  () => {
    const mapped = providerWorkbenchSupportModule?.mapLlmProvider({
      id: 'openai',
      name: 'OpenAI',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKeySource: 'env:OPENAI_API_KEY',
      status: 'ready',
      defaultModelId: 'gpt-5.4',
      reasoningModelId: 'gpt-5.4',
      embeddingModelId: 'text-embedding-3-large',
      description: 'OpenAI provider',
      icon: 'O',
      lastCheckedAt: '2026-04-09T00:00:00.000Z',
      capabilities: ['chat', 'embedding', 'reasoning'],
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
          role: 'primary',
          contextWindow: '128000 tokens',
        },
      ],
      config: {
        temperature: 0.3,
        topP: 1,
        maxTokens: 4096,
        timeoutMs: 60000,
        streaming: true,
      },
    } as any);

    assert.equal(mapped?.name, 'OpenAI');
    mapped?.capabilities.push('vision');
    if (mapped?.models[0]) {
      mapped.models[0].name = 'Changed';
    }
    if (mapped?.config) {
      mapped.config.maxTokens = 8192;
    }

    assert.deepEqual(mapped?.capabilities, ['chat', 'embedding', 'reasoning', 'vision']);
    assert.equal(mapped?.models[0]?.name, 'Changed');
    assert.equal(mapped?.config.maxTokens, 8192);
  },
);

await runTest(
  'buildOpenClawLlmProviders prefers live models for matching providers and falls back to config models',
  () => {
    const providers = providerWorkbenchSupportModule?.buildOpenClawLlmProviders(
      {
        config: {
          meta: {
            lastTouchedAt: '2026-04-09T00:00:00.000Z',
          },
          models: {
            providers: {
              openai: {
                baseUrl: 'https://api.openai.com/v1',
                apiKey: '${OPENAI_API_KEY}',
                models: [
                  {
                    id: 'gpt-4.1-mini',
                    name: 'GPT-4.1 Mini',
                    role: 'fallback',
                    contextWindow: 128000,
                  },
                ],
              },
              anthropic: {
                baseUrl: 'https://api.anthropic.com',
                apiKey: '${ANTHROPIC_API_KEY}',
                streaming: false,
                models: [
                  {
                    id: 'claude-3-5-sonnet',
                    name: 'Claude 3.5 Sonnet',
                    role: 'primary',
                    contextWindow: 200000,
                  },
                ],
              },
            },
          },
        },
      } as any,
      [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
          provider: 'openai',
          reasoning: true,
          contextWindow: 200000,
        },
        {
          id: 'text-embedding-3-large',
          name: 'Text Embedding 3 Large',
          providerId: 'openai',
          api: 'embedding',
          contextWindow: 8192,
        },
      ] as any,
      {
        observability: {
          lastSeenAt: 1744156800000,
        },
      } as any,
    );

    assert.deepEqual(
      providers?.map((provider) => provider.id),
      ['anthropic', 'openai'],
    );
    assert.equal(providers?.[1]?.defaultModelId, 'gpt-5.4');
    assert.equal(providers?.[1]?.embeddingModelId, 'text-embedding-3-large');
    assert.deepEqual(providers?.[1]?.capabilities, ['chat', 'embedding', 'reasoning']);
    assert.equal(providers?.[1]?.apiKeySource, 'env:OPENAI_API_KEY');
    assert.equal(providers?.[1]?.config.temperature, 0.2);
    assert.equal(providers?.[1]?.lastCheckedAt, '2026-04-09T00:00:00.000Z');

    assert.equal(providers?.[0]?.defaultModelId, 'claude-3-5-sonnet');
    assert.equal(providers?.[0]?.endpoint, 'https://api.anthropic.com');
    assert.equal(providers?.[0]?.apiKeySource, 'env:ANTHROPIC_API_KEY');
    assert.equal(providers?.[0]?.config.streaming, true);
    assert.deepEqual(providers?.[0]?.capabilities, ['chat']);
  },
);

await runTest(
  'buildOpenClawLlmProviders reads canonical runtime config and normalized provider ids from the shared OpenClaw config snapshot builder',
  () => {
    const providers = providerWorkbenchSupportModule?.buildOpenClawLlmProviders(
      {
        config: {
          meta: {
            lastTouchedAt: '2026-04-10T00:00:00.000Z',
          },
          models: {
            providers: {
              'api-router-openai': {
                baseUrl: 'https://api.openai.com/v1/',
                apiKey: '${OPENAI_API_KEY}',
                temperature: 0.95,
                streaming: true,
                models: [
                  {
                    id: ' gpt-5.4 ',
                    name: ' GPT-5.4 ',
                  },
                  {
                    id: ' o4-mini ',
                    name: ' o4-mini ',
                    reasoning: true,
                  },
                ],
              },
            },
          },
          agents: {
            defaults: {
              model: {
                primary: 'openai/gpt-5.4',
                fallbacks: ['openai/o4-mini'],
              },
              models: {
                'openai/gpt-5.4': {
                  params: {
                    temperature: 0.33,
                    topP: 0.85,
                    maxTokens: 16384,
                    timeoutMs: 45000,
                    streaming: false,
                  },
                },
              },
            },
          },
        },
      } as any,
      [],
      {
        observability: {
          lastSeenAt: 1744243200000,
        },
      } as any,
    );

    assert.deepEqual(providers?.map((provider) => provider.id), ['openai']);
    assert.equal(providers?.[0]?.provider, 'openai');
    assert.equal(providers?.[0]?.name, 'Openai');
    assert.equal(providers?.[0]?.endpoint, 'https://api.openai.com/v1');
    assert.equal(providers?.[0]?.apiKeySource, 'env:OPENAI_API_KEY');
    assert.equal(providers?.[0]?.defaultModelId, 'gpt-5.4');
    assert.equal(providers?.[0]?.reasoningModelId, 'o4-mini');
    assert.equal(providers?.[0]?.config.temperature, 0.33);
    assert.equal(providers?.[0]?.config.topP, 0.85);
    assert.equal(providers?.[0]?.config.maxTokens, 16384);
    assert.equal(providers?.[0]?.config.timeoutMs, 45000);
    assert.equal(providers?.[0]?.config.streaming, false);
    assert.equal(providers?.[0]?.lastCheckedAt, '2026-04-10T00:00:00.000Z');
  },
);
