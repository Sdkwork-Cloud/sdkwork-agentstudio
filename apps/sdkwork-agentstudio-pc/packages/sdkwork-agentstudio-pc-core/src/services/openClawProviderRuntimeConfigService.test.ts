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

let providerRuntimeConfigServiceModule:
  | typeof import('./openClawProviderRuntimeConfigService.ts')
  | undefined;

try {
  providerRuntimeConfigServiceModule = await import('./openClawProviderRuntimeConfigService.ts');
} catch {
  providerRuntimeConfigServiceModule = undefined;
}

await runTest(
  'openClawProviderRuntimeConfigService exposes normalize and config-root mapping helpers',
  () => {
    assert.ok(
      providerRuntimeConfigServiceModule,
      'Expected openClawProviderRuntimeConfigService.ts to exist',
    );
    assert.equal(
      typeof providerRuntimeConfigServiceModule?.createDefaultOpenClawProviderRuntimeConfig,
      'function',
    );
    assert.equal(
      typeof providerRuntimeConfigServiceModule?.normalizeOpenClawProviderRuntimeConfig,
      'function',
    );
    assert.equal(
      typeof providerRuntimeConfigServiceModule?.readOpenClawProviderRuntimeConfigFromConfigRoot,
      'function',
    );
    assert.equal(
      typeof providerRuntimeConfigServiceModule?.writeOpenClawProviderRuntimeConfigToConfigRoot,
      'function',
    );
  },
);

await runTest(
  'openClawProviderRuntimeConfigService reads canonical model params and request overrides from config root',
  () => {
    const root = {
      models: {
        providers: {
          openai: {
            request: {
              headers: {
                ' OpenAI-Organization ': ' org_live ',
              },
              auth: {
                mode: 'authorization-bearer',
                token: ' ${OPENAI_API_KEY} ',
              },
              proxy: {
                mode: 'explicit-proxy',
                url: ' https://proxy.internal ',
                tls: {
                  serverName: ' proxy.internal ',
                  insecureSkipVerify: true,
                },
              },
              tls: {
                serverName: ' api.openai.internal ',
                insecureSkipVerify: true,
              },
            },
          },
        },
      },
      agents: {
        defaults: {
          models: {
            'openai/gpt-5.4': {
              params: {
                temperature: '0.3',
                topP: '0.9',
                maxTokens: '4096',
                timeoutMs: '45000',
                streaming: 'false',
              },
            },
          },
        },
      },
    };

    const providerRoot = (
      root.models.providers as Record<string, Record<string, unknown>>
    ).openai as Record<string, unknown>;
    const runtimeConfig =
      providerRuntimeConfigServiceModule?.readOpenClawProviderRuntimeConfigFromConfigRoot({
        root,
        providerKey: ' openai ',
        modelId: ' gpt-5.4 ',
        providerRoot,
      });

    assert.deepEqual(runtimeConfig, {
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 4096,
      timeoutMs: 45000,
      streaming: false,
      request: {
        headers: {
          'OpenAI-Organization': 'org_live',
        },
        auth: {
          mode: 'authorization-bearer',
          token: '${OPENAI_API_KEY}',
        },
        proxy: {
          mode: 'explicit-proxy',
          url: 'https://proxy.internal',
          tls: {
            serverName: 'proxy.internal',
            insecureSkipVerify: true,
          },
        },
        tls: {
          serverName: 'api.openai.internal',
          insecureSkipVerify: true,
        },
      },
    });
  },
);

await runTest(
  'openClawProviderRuntimeConfigService writes canonical model params and request overrides back to config root',
  () => {
    const root = {
      models: {
        providers: {
          openai: {},
        },
      },
      agents: {
        defaults: {},
      },
    };

    const providerRoot = (
      root.models.providers as Record<string, Record<string, unknown>>
    ).openai as Record<string, unknown>;
    providerRuntimeConfigServiceModule?.writeOpenClawProviderRuntimeConfigToConfigRoot({
      root,
      providerKey: ' openai ',
      modelId: ' gpt-5.4 ',
      providerRoot,
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
          auth: {
            mode: 'authorization-bearer',
            token: ' ${OPENAI_API_KEY} ',
          },
          proxy: {
            mode: 'env-proxy',
          },
          tls: {
            serverName: ' api.openai.internal ',
            insecureSkipVerify: true,
          },
        },
      },
    });

    assert.deepEqual(root, {
      models: {
        providers: {
          openai: {
            request: {
              headers: {
                'OpenAI-Organization': 'org_live',
              },
              auth: {
                mode: 'authorization-bearer',
                token: '${OPENAI_API_KEY}',
              },
              proxy: {
                mode: 'env-proxy',
              },
              tls: {
                serverName: 'api.openai.internal',
                insecureSkipVerify: true,
              },
            },
          },
        },
      },
      agents: {
        defaults: {
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
  'openClawProviderRuntimeConfigService writes request overrides even when no model id is available',
  () => {
    const root = {
      models: {
        providers: {
          openai: {
            request: {
              headers: {
                Legacy: 'stale',
              },
            },
          },
        },
      },
    };

    const providerRoot = (
      root.models.providers as Record<string, Record<string, unknown>>
    ).openai as Record<string, unknown>;
    providerRuntimeConfigServiceModule?.writeOpenClawProviderRuntimeConfigToConfigRoot({
      root,
      providerKey: 'openai',
      modelId: ' ',
      providerRoot,
      config: {
        request: {
          proxy: {
            mode: 'env-proxy',
          },
        },
      },
    });

    assert.deepEqual(root, {
      models: {
        providers: {
          openai: {
            request: {
              proxy: {
                mode: 'env-proxy',
              },
            },
          },
        },
      },
    });
  },
);
