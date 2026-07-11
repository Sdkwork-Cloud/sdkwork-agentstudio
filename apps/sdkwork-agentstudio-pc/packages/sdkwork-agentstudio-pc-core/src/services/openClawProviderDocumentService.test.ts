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

let providerDocumentServiceModule:
  | typeof import('./openClawProviderDocumentService.ts')
  | undefined;

try {
  providerDocumentServiceModule = await import('./openClawProviderDocumentService.ts');
} catch {
  providerDocumentServiceModule = undefined;
}

await runTest(
  'openClawProviderDocumentService exposes provider-document write helpers',
  () => {
    assert.ok(
      providerDocumentServiceModule,
      'Expected openClawProviderDocumentService.ts to exist',
    );
    assert.equal(
      typeof providerDocumentServiceModule?.writeOpenClawProviderConfigToConfigRoot,
      'function',
    );
    assert.equal(
      typeof providerDocumentServiceModule?.canonicalizeManagedLocalProxyProvidersInConfigRoot,
      'function',
    );
  },
);

await runTest(
  'openClawProviderDocumentService writes canonical provider config, defaults selection, and runtime params into config root',
  () => {
    const root = {
      models: {
        providers: {
          openai: {
            temperature: 0.2,
            topP: 0.9,
            maxTokens: 4096,
            timeoutMs: 60000,
            streaming: false,
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: 'anthropic/claude-3.7-sonnet',
          },
        },
      },
    };

    providerDocumentServiceModule?.writeOpenClawProviderConfigToConfigRoot({
      root,
      provider: {
        id: ' api-router-openai ',
        channelId: ' openai ',
        apiKey: ' env:OPENAI_API_KEY ',
        baseUrl: ' https://api.openai.com/v1/ ',
        models: [
          {
            id: ' gpt-5.4 ',
            name: ' GPT-5.4 ',
          },
          {
            id: ' o4-mini ',
            name: ' o4-mini ',
          },
        ],
        config: {
          temperature: 0.4,
          topP: 0.8,
          maxTokens: 16000,
          timeoutMs: 90000,
          streaming: true,
          request: {
            headers: {
              ' OpenAI-Organization ': ' org_live ',
            },
          },
        },
      },
      selection: {
        defaultModelId: ' gpt-5.4 ',
        reasoningModelId: ' o4-mini ',
      },
    });

    assert.deepEqual(root, {
      models: {
        providers: {
          openai: {
            baseUrl: 'https://api.openai.com/v1',
            apiKey: '${OPENAI_API_KEY}',
            api: 'openai-completions',
            auth: 'api-key',
            request: {
              headers: {
                'OpenAI-Organization': 'org_live',
              },
            },
            models: [
              {
                id: 'gpt-5.4',
                name: 'GPT-5.4',
                api: undefined,
                reasoning: false,
                input: ['text'],
                cost: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                contextWindow: 128000,
                maxTokens: 32000,
              },
              {
                id: 'o4-mini',
                name: 'o4-mini',
                api: undefined,
                reasoning: true,
                input: ['text'],
                cost: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                contextWindow: 200000,
                maxTokens: 32000,
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
                temperature: 0.4,
                topP: 0.8,
                maxTokens: 16000,
                timeoutMs: 90000,
                streaming: true,
              },
            },
          },
        },
      },
    });
  },
);

await runTest(
  'openClawProviderDocumentService preserves already-qualified model refs when writing defaults selection',
  () => {
    const root = {
      models: {
        providers: {},
      },
      agents: {
        defaults: {},
      },
    };

    providerDocumentServiceModule?.writeOpenClawProviderConfigToConfigRoot({
      root,
      provider: {
        id: ' openrouter ',
        channelId: ' openrouter ',
        apiKey: ' ${OPENROUTER_API_KEY} ',
        baseUrl: ' https://openrouter.ai/api/v1 ',
        models: [
          {
            id: ' openrouter/meta-llama/llama-3.1-8b-instruct ',
            name: ' Llama 3.1 8B Instruct ',
          },
          {
            id: ' anthropic/claude-3.7-sonnet ',
            name: ' Claude 3.7 Sonnet ',
          },
        ],
      },
      selection: {
        defaultModelId: ' openrouter/meta-llama/llama-3.1-8b-instruct ',
        reasoningModelId: ' anthropic/claude-3.7-sonnet ',
      },
    });

    assert.deepEqual(root.agents.defaults.model, {
      primary: 'openrouter/meta-llama/llama-3.1-8b-instruct',
      fallbacks: ['anthropic/claude-3.7-sonnet'],
    });
    assert.equal(
      Object.hasOwn(
        (root.agents.defaults.models ?? {}) as Record<string, unknown>,
        'openrouter/openrouter/meta-llama/llama-3.1-8b-instruct',
      ),
      false,
    );
    assert.equal(
      Object.hasOwn(
        (root.agents.defaults.models ?? {}) as Record<string, unknown>,
        'openrouter/anthropic/claude-3.7-sonnet',
      ),
      false,
    );
  },
);

await runTest(
  'openClawProviderDocumentService canonicalizes managed provider config roots down to the selected provider',
  () => {
    const root = {
      models: {
        providers: {
          openai: {
            baseUrl: 'https://api.openai.com/v1',
          },
          anthropic: {
            baseUrl: 'https://api.anthropic.com/v1',
          },
          'sdkwork-local-proxy': {
            baseUrl: 'http://127.0.0.1:21280/v1',
          },
        },
      },
    };

    providerDocumentServiceModule?.canonicalizeManagedLocalProxyProvidersInConfigRoot(
      root,
      ' sdkwork-local-proxy ',
    );

    assert.deepEqual(root, {
      models: {
        providers: {
          'sdkwork-local-proxy': {
            baseUrl: 'http://127.0.0.1:21280/v1',
          },
        },
      },
    });
  },
);
