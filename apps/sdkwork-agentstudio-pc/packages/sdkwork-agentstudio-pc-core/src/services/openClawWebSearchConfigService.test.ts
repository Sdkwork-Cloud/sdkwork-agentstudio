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

let webSearchConfigServiceModule:
  | typeof import('./openClawWebSearchConfigService.ts')
  | undefined;

try {
  webSearchConfigServiceModule = await import('./openClawWebSearchConfigService.ts');
} catch {
  webSearchConfigServiceModule = undefined;
}

await runTest(
  'openClawWebSearchConfigService exposes provider normalization, snapshot, and document write helpers',
  () => {
    assert.ok(
      webSearchConfigServiceModule,
      'Expected openClawWebSearchConfigService.ts to exist',
    );
    assert.equal(
      typeof webSearchConfigServiceModule?.normalizeOpenClawWebSearchProviderId,
      'function',
    );
    assert.equal(
      typeof webSearchConfigServiceModule?.buildOpenClawWebSearchConfigSnapshot,
      'function',
    );
    assert.equal(
      typeof webSearchConfigServiceModule?.saveOpenClawWebSearchConfigurationToConfigRoot,
      'function',
    );
  },
);

await runTest(
  'openClawWebSearchConfigService builds canonical provider snapshots from shared search settings and plugin config roots',
  () => {
    const snapshot = webSearchConfigServiceModule?.buildOpenClawWebSearchConfigSnapshot({
      tools: {
        web: {
          search: {
            enabled: true,
            provider: 'xai',
            maxResults: 7,
            timeoutSeconds: 40,
            cacheTtlMinutes: 10,
          },
        },
      },
      plugins: {
        entries: {
          google: {
            config: {
              webSearch: {
                apiKey: '${GEMINI_API_KEY}',
                model: 'gemini-2.5-flash',
              },
            },
          },
          xai: {
            config: {
              webSearch: {
                apiKey: '${XAI_API_KEY}',
                model: 'grok-4-fast',
                inlineCitations: true,
              },
            },
          },
          moonshot: {
            config: {
              webSearch: {
                apiKey: '${MOONSHOT_API_KEY}',
                baseUrl: 'https://api.moonshot.ai/v1',
                model: 'kimi-k2.5',
              },
            },
          },
        },
      },
    });

    const gemini = snapshot?.providers.find((provider) => provider.id === 'gemini');
    const grok = snapshot?.providers.find((provider) => provider.id === 'grok');
    const kimi = snapshot?.providers.find((provider) => provider.id === 'kimi');

    assert.equal(snapshot?.provider, 'grok');
    assert.equal(gemini?.apiKeySource, 'env:GEMINI_API_KEY');
    assert.equal(gemini?.model, 'gemini-2.5-flash');
    assert.equal(grok?.apiKeySource, 'env:XAI_API_KEY');
    assert.equal(grok?.model, 'grok-4-fast');
    assert.match(grok?.advancedConfig || '', /inlineCitations/);
    assert.equal(kimi?.apiKeySource, 'env:MOONSHOT_API_KEY');
    assert.equal(kimi?.baseUrl, 'https://api.moonshot.ai/v1');
    assert.equal(kimi?.model, 'kimi-k2.5');
  },
);

await runTest(
  'openClawWebSearchConfigService writes canonical plugin-root config without clobbering sibling plugin settings',
  () => {
    const root = {
      tools: {
        web: {
          search: {
            enabled: false,
            provider: 'brave',
            maxResults: 5,
            timeoutSeconds: 30,
            cacheTtlMinutes: 15,
          },
        },
      },
      plugins: {
        entries: {
          xai: {
            enabled: false,
            metadata: {
              label: 'xAI Search',
            },
            config: {
              theme: 'dark',
              webSearch: {
                apiKey: 'xai-old',
              },
              xSearch: {
                enabled: true,
              },
            },
          },
        },
      },
    };

    webSearchConfigServiceModule?.saveOpenClawWebSearchConfigurationToConfigRoot(root, {
      enabled: true,
      provider: 'xai',
      maxResults: 11,
      timeoutSeconds: 55,
      cacheTtlMinutes: 18,
      providerConfig: {
        providerId: 'xai',
        apiKeySource: 'env:XAI_API_KEY',
        model: 'grok-4-fast',
        advancedConfig: `{
  "inlineCitations": true
}`,
      },
    });

    const snapshot = webSearchConfigServiceModule?.buildOpenClawWebSearchConfigSnapshot(root);
    const grok = snapshot?.providers.find((provider) => provider.id === 'grok');

    assert.deepEqual(root, {
      tools: {
        web: {
          search: {
            enabled: true,
            provider: 'grok',
            maxResults: 11,
            timeoutSeconds: 55,
            cacheTtlMinutes: 18,
          },
        },
      },
      plugins: {
        entries: {
          xai: {
            enabled: false,
            metadata: {
              label: 'xAI Search',
            },
            config: {
              theme: 'dark',
              webSearch: {
                inlineCitations: true,
                apiKey: '${XAI_API_KEY}',
                model: 'grok-4-fast',
              },
              xSearch: {
                enabled: true,
              },
            },
          },
        },
      },
    });
    assert.equal(snapshot?.provider, 'grok');
    assert.equal(grok?.apiKeySource, 'env:XAI_API_KEY');
    assert.equal(grok?.model, 'grok-4-fast');
    assert.match(grok?.advancedConfig || '', /inlineCitations/);
  },
);
