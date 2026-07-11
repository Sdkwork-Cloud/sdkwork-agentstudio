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

let providerPatchServiceModule:
  | typeof import('./openClawProviderPatchService.ts')
  | undefined;

try {
  providerPatchServiceModule = await import('./openClawProviderPatchService.ts');
} catch {
  providerPatchServiceModule = undefined;
}

await runTest(
  'openClawProviderPatchService exposes shared request-override and remote provider patch builders',
  () => {
    assert.ok(providerPatchServiceModule, 'Expected openClawProviderPatchService.ts to exist');
    assert.equal(
      typeof providerPatchServiceModule?.buildOpenClawRequestOverridesPatch,
      'function',
    );
    assert.equal(
      typeof providerPatchServiceModule?.buildRemoteOpenClawProviderConfigPatch,
      'function',
    );
  },
);

await runTest(
  'buildRemoteOpenClawProviderConfigPatch normalizes legacy provider ids through the shared OpenClaw snapshot authority',
  () => {
    assert.deepEqual(
      providerPatchServiceModule?.buildRemoteOpenClawProviderConfigPatch(
        {
          models: {
            providers: {
              'api-router-openai': {
                baseUrl: 'https://router.example.com/v1',
                apiKey: '${OPENAI_API_KEY}',
                models: [
                  {
                    id: 'gpt-4.1',
                    name: 'GPT-4.1',
                    role: 'primary',
                  },
                  {
                    id: 'legacy-fallback',
                    name: 'Legacy Fallback',
                    role: 'fallback',
                  },
                ],
              },
            },
          },
          agents: {
            defaults: {
              model: {
                primary: 'api-router-openai/gpt-4.1',
              },
              models: {
                'api-router-openai/gpt-4.1': {
                  alias: 'GPT-4.1',
                  streaming: true,
                  params: {
                    temperature: 0.2,
                    topP: 1,
                    maxTokens: 4096,
                    timeoutMs: 60000,
                    streaming: true,
                  },
                },
              },
            },
          },
        },
        'openai',
        {
          endpoint: ' https://api.openai.example/v1 ',
          apiKeySource: ' env:OPENAI_API_KEY ',
          defaultModelId: ' gpt-5.4 ',
          reasoningModelId: ' o4-mini ',
          embeddingModelId: undefined,
          config: {
            temperature: 0.3,
            topP: 0.9,
            maxTokens: 4096,
            timeoutMs: 45000,
            streaming: true,
            request: {
              headers: {
                ' OpenAI-Organization ': ' org_live ',
              },
            },
          },
        },
      ),
      {
        models: {
          providers: {
            openai: {
              baseUrl: 'https://api.openai.example/v1',
              apiKey: '${OPENAI_API_KEY}',
              temperature: null,
              topP: null,
              maxTokens: null,
              timeoutMs: null,
              streaming: null,
              request: {
                headers: {
                  'OpenAI-Organization': 'org_live',
                },
              },
              models: [
                {
                  id: 'gpt-5.4',
                  name: 'gpt-5.4',
                  role: 'primary',
                },
                {
                  id: 'o4-mini',
                  name: 'o4-mini',
                  role: 'reasoning',
                },
                {
                  id: 'gpt-4.1',
                  name: 'GPT-4.1',
                  role: 'fallback',
                },
                {
                  id: 'legacy-fallback',
                  name: 'Legacy Fallback',
                  role: 'fallback',
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
                alias: 'gpt-5.4',
                streaming: true,
                params: {
                  temperature: 0.3,
                  topP: 0.9,
                  maxTokens: 4096,
                  timeoutMs: 45000,
                  streaming: true,
                },
              },
              'openai/o4-mini': {
                alias: 'o4-mini',
                streaming: true,
              },
              'openai/gpt-4.1': {
                alias: 'GPT-4.1',
                streaming: true,
              },
              'openai/legacy-fallback': {
                alias: 'Legacy Fallback',
                streaming: true,
              },
            },
          },
        },
      },
    );
  },
);
