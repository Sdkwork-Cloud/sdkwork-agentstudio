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

let providerConfigPatchModule:
  | typeof import('./openClawProviderConfigPatch.ts')
  | undefined;

try {
  providerConfigPatchModule = await import('./openClawProviderConfigPatch.ts');
} catch {
  providerConfigPatchModule = undefined;
}

await runTest(
  'openClawProviderConfigPatch exposes dedicated request-override and remote provider patch builders',
  () => {
    assert.ok(providerConfigPatchModule, 'Expected openClawProviderConfigPatch.ts to exist');
    assert.equal(
      typeof providerConfigPatchModule?.buildOpenClawRequestOverridesPatch,
      'function',
    );
    assert.equal(
      typeof providerConfigPatchModule?.buildRemoteOpenClawProviderConfigPatch,
      'function',
    );
  },
);

await runTest(
  'buildOpenClawRequestOverridesPatch trims headers and tls/auth/proxy fields before patching',
  () => {
    assert.deepEqual(
      providerConfigPatchModule?.buildOpenClawRequestOverridesPatch({
        headers: {
          ' Authorization ': ' Bearer test-token ',
          ' ': 'ignored',
        },
        auth: {
          mode: 'header',
          headerName: ' X-Auth ',
          value: ' token-123 ',
          prefix: ' Bearer ',
        },
        proxy: {
          mode: 'explicit-proxy',
          url: ' https://proxy.example.com ',
          tls: {
            ca: ' ca-cert ',
            cert: ' client-cert ',
            key: ' client-key ',
            passphrase: ' secret ',
            serverName: ' proxy.internal ',
            insecureSkipVerify: true,
          },
        },
        tls: {
          ca: ' root-ca ',
          cert: ' upstream-cert ',
          key: ' upstream-key ',
          passphrase: ' upstream-secret ',
          serverName: ' upstream.internal ',
          insecureSkipVerify: false,
        },
      }),
      {
        headers: {
          Authorization: 'Bearer test-token',
        },
        auth: {
          mode: 'header',
          headerName: 'X-Auth',
          value: 'token-123',
          prefix: 'Bearer',
        },
        proxy: {
          mode: 'explicit-proxy',
          url: 'https://proxy.example.com',
          tls: {
            ca: 'ca-cert',
            cert: 'client-cert',
            key: 'client-key',
            passphrase: 'secret',
            serverName: 'proxy.internal',
            insecureSkipVerify: true,
          },
        },
        tls: {
          ca: 'root-ca',
          cert: 'upstream-cert',
          key: 'upstream-key',
          passphrase: 'upstream-secret',
          serverName: 'upstream.internal',
          insecureSkipVerify: false,
        },
      },
    );
  },
);

await runTest(
  'buildRemoteOpenClawProviderConfigPatch builds provider defaults and per-model streaming metadata',
  () => {
    assert.deepEqual(
      providerConfigPatchModule?.buildRemoteOpenClawProviderConfigPatch(
        {
          models: {
            providers: {
              openai: {
                baseUrl: 'https://api.openai.example/v1',
                apiKey: '${OPENAI_API_KEY}',
                models: [
                  {
                    id: 'gpt-5.4',
                    name: 'GPT-5.4',
                  },
                  {
                    id: 'o4-mini',
                    name: 'o4-mini',
                  },
                  {
                    id: 'text-embedding-3-small',
                    name: 'text-embedding-3-small',
                    role: 'embedding',
                  },
                ],
              },
            },
          },
        },
        ' openai ',
        {
          endpoint: ' https://api.openai.example/v1 ',
          apiKeySource: ' env:OPENAI_API_KEY ',
          defaultModelId: ' gpt-5.4 ',
          reasoningModelId: ' o4-mini ',
          embeddingModelId: ' text-embedding-3-small ',
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
                  name: 'GPT-5.4',
                  role: 'primary',
                },
                {
                  id: 'o4-mini',
                  name: 'o4-mini',
                  role: 'reasoning',
                },
                {
                  id: 'text-embedding-3-small',
                  name: 'text-embedding-3-small',
                  role: 'embedding',
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
                alias: 'GPT-5.4',
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
              'openai/text-embedding-3-small': {
                alias: 'text-embedding-3-small',
                streaming: false,
              },
            },
          },
        },
      },
    );
  },
);
