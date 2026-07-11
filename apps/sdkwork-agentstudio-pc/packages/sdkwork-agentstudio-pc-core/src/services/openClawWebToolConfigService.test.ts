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

let webToolConfigServiceModule:
  | typeof import('./openClawWebToolConfigService.ts')
  | undefined;

try {
  webToolConfigServiceModule = await import('./openClawWebToolConfigService.ts');
} catch {
  webToolConfigServiceModule = undefined;
}

await runTest(
  'openClawWebToolConfigService exposes x_search, native codex, and web_fetch helpers',
  () => {
    assert.ok(
      webToolConfigServiceModule,
      'Expected openClawWebToolConfigService.ts to exist',
    );
    assert.equal(
      typeof webToolConfigServiceModule?.buildOpenClawXSearchConfigSnapshot,
      'function',
    );
    assert.equal(
      typeof webToolConfigServiceModule?.saveOpenClawXSearchConfigurationToConfigRoot,
      'function',
    );
    assert.equal(
      typeof webToolConfigServiceModule?.buildOpenClawWebSearchNativeCodexConfigSnapshot,
      'function',
    );
    assert.equal(
      typeof webToolConfigServiceModule?.saveOpenClawWebSearchNativeCodexConfigurationToConfigRoot,
      'function',
    );
    assert.equal(
      typeof webToolConfigServiceModule?.buildOpenClawWebFetchConfigSnapshot,
      'function',
    );
    assert.equal(
      typeof webToolConfigServiceModule?.saveOpenClawWebFetchConfigurationToConfigRoot,
      'function',
    );
  },
);

await runTest(
  'openClawWebToolConfigService builds x_search snapshots from xai plugin config together with shared xAI auth',
  () => {
    const snapshot = webToolConfigServiceModule?.buildOpenClawXSearchConfigSnapshot({
      plugins: {
        entries: {
          xai: {
            config: {
              webSearch: {
                apiKey: '${XAI_API_KEY}',
                model: 'grok-4-fast',
              },
              xSearch: {
                enabled: true,
                model: 'grok-4-1-fast-non-reasoning',
                inlineCitations: false,
                maxTurns: 2,
                timeoutSeconds: 30,
                cacheTtlMinutes: 15,
                userTag: 'internal-research',
              },
            },
          },
        },
      },
    });

    assert.equal(snapshot?.enabled, true);
    assert.equal(snapshot?.apiKeySource, 'env:XAI_API_KEY');
    assert.equal(snapshot?.model, 'grok-4-1-fast-non-reasoning');
    assert.equal(snapshot?.inlineCitations, false);
    assert.equal(snapshot?.maxTurns, 2);
    assert.equal(snapshot?.timeoutSeconds, 30);
    assert.equal(snapshot?.cacheTtlMinutes, 15);
    assert.match(snapshot?.advancedConfig || '', /internal-research/);
  },
);

await runTest(
  'openClawWebToolConfigService writes managed x_search settings without clobbering sibling webSearch config',
  () => {
    const root = {
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
                apiKey: '${OLD_XAI_API_KEY}',
                model: 'grok-4-fast',
                inlineCitations: true,
              },
              xSearch: {
                enabled: false,
                model: 'grok-4-fast-mini',
              },
            },
          },
        },
      },
    };

    webToolConfigServiceModule?.saveOpenClawXSearchConfigurationToConfigRoot(root, {
      enabled: true,
      apiKeySource: 'env:XAI_API_KEY',
      model: 'grok-4-1-fast-non-reasoning',
      inlineCitations: false,
      maxTurns: 3,
      timeoutSeconds: 45,
      cacheTtlMinutes: 18,
      advancedConfig: `{
  "userTag": "internal-research"
}`,
    });

    assert.deepEqual(root, {
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
                apiKey: '${XAI_API_KEY}',
                model: 'grok-4-fast',
                inlineCitations: true,
              },
              xSearch: {
                enabled: true,
                model: 'grok-4-1-fast-non-reasoning',
                inlineCitations: false,
                maxTurns: 3,
                timeoutSeconds: 45,
                cacheTtlMinutes: 18,
                userTag: 'internal-research',
              },
            },
          },
        },
      },
    });
  },
);

await runTest(
  'openClawWebToolConfigService builds native Codex web search snapshots from tools.web.search.openaiCodex',
  () => {
    const snapshot = webToolConfigServiceModule?.buildOpenClawWebSearchNativeCodexConfigSnapshot(
      {
        tools: {
          web: {
            search: {
              openaiCodex: {
                enabled: true,
                mode: 'cached',
                allowedDomains: ['example.com', 'openai.com'],
                contextSize: 'high',
                userLocation: {
                  country: 'US',
                  city: 'New York',
                  timezone: 'America/New_York',
                },
                reasoningEffort: 'medium',
              },
            },
          },
        },
      },
    );

    assert.equal(snapshot?.enabled, true);
    assert.equal(snapshot?.mode, 'cached');
    assert.deepEqual(snapshot?.allowedDomains, ['example.com', 'openai.com']);
    assert.equal(snapshot?.contextSize, 'high');
    assert.equal(snapshot?.userLocation.country, 'US');
    assert.equal(snapshot?.userLocation.city, 'New York');
    assert.equal(snapshot?.userLocation.timezone, 'America/New_York');
    assert.match(snapshot?.advancedConfig || '', /reasoningEffort/);
  },
);

await runTest(
  'openClawWebToolConfigService writes native Codex web search settings under tools.web.search.openaiCodex without clobbering managed web search settings',
  () => {
    const root = {
      tools: {
        web: {
          search: {
            enabled: true,
            provider: 'searxng',
            maxResults: 10,
            timeoutSeconds: 45,
            cacheTtlMinutes: 20,
            openaiCodex: {
              enabled: false,
              mode: 'off',
            },
          },
        },
      },
    };

    webToolConfigServiceModule?.saveOpenClawWebSearchNativeCodexConfigurationToConfigRoot(root, {
      enabled: true,
      mode: 'cached',
      allowedDomains: ['example.com', 'openai.com'],
      contextSize: 'high',
      userLocation: {
        country: 'US',
        city: 'New York',
        timezone: 'America/New_York',
      },
      advancedConfig: `{
  "reasoningEffort": "medium"
}`,
    });

    assert.deepEqual(root, {
      tools: {
        web: {
          search: {
            enabled: true,
            provider: 'searxng',
            maxResults: 10,
            timeoutSeconds: 45,
            cacheTtlMinutes: 20,
            openaiCodex: {
              enabled: true,
              mode: 'cached',
              allowedDomains: ['example.com', 'openai.com'],
              contextSize: 'high',
              userLocation: {
                country: 'US',
                city: 'New York',
                timezone: 'America/New_York',
              },
              reasoningEffort: 'medium',
            },
          },
        },
      },
    });
  },
);

await runTest(
  'openClawWebToolConfigService builds web_fetch snapshots from shared fetch settings and firecrawl plugin config together',
  () => {
    const snapshot = webToolConfigServiceModule?.buildOpenClawWebFetchConfigSnapshot({
      tools: {
        web: {
          fetch: {
            enabled: true,
            maxChars: 42000,
            maxCharsCap: 60000,
            maxResponseBytes: 2500000,
            timeoutSeconds: 28,
            cacheTtlMinutes: 9,
            maxRedirects: 4,
            readability: false,
            userAgent: 'SDKWork Fetch Bot/1.0',
          },
        },
      },
      plugins: {
        entries: {
          firecrawl: {
            config: {
              webFetch: {
                apiKey: '${FIRECRAWL_API_KEY}',
                baseUrl: 'https://api.firecrawl.dev',
                onlyMainContent: true,
                maxAgeMs: 86400000,
                timeoutSeconds: 60,
              },
              webSearch: {
                apiKey: 'fc-search-live',
              },
            },
          },
        },
      },
    });

    assert.equal(snapshot?.enabled, true);
    assert.equal(snapshot?.maxChars, 42000);
    assert.equal(snapshot?.maxCharsCap, 60000);
    assert.equal(snapshot?.maxResponseBytes, 2500000);
    assert.equal(snapshot?.timeoutSeconds, 28);
    assert.equal(snapshot?.cacheTtlMinutes, 9);
    assert.equal(snapshot?.maxRedirects, 4);
    assert.equal(snapshot?.readability, false);
    assert.equal(snapshot?.userAgent, 'SDKWork Fetch Bot/1.0');
    assert.equal(snapshot?.fallbackProvider.apiKeySource, 'env:FIRECRAWL_API_KEY');
    assert.equal(snapshot?.fallbackProvider.baseUrl, 'https://api.firecrawl.dev');
    assert.match(snapshot?.fallbackProvider.advancedConfig || '', /onlyMainContent/);
    assert.doesNotMatch(snapshot?.fallbackProvider.advancedConfig || '', /fc-search-live/);
  },
);

await runTest(
  'openClawWebToolConfigService writes managed web_fetch settings into the firecrawl webFetch plugin root without clobbering sibling plugin config',
  () => {
    const root = {
      tools: {
        web: {
          fetch: {
            enabled: false,
            maxChars: 50000,
            maxCharsCap: 50000,
            maxResponseBytes: 2000000,
            timeoutSeconds: 30,
            cacheTtlMinutes: 15,
            maxRedirects: 3,
            readability: true,
          },
        },
      },
      plugins: {
        entries: {
          firecrawl: {
            enabled: false,
            metadata: {
              label: 'Firecrawl',
            },
            config: {
              theme: 'dark',
              webSearch: {
                apiKey: 'fc-search-live',
              },
              webFetch: {
                apiKey: '${OLD_FIRECRAWL_API_KEY}',
              },
            },
          },
        },
      },
    };

    webToolConfigServiceModule?.saveOpenClawWebFetchConfigurationToConfigRoot(root, {
      enabled: true,
      maxChars: 42000,
      maxCharsCap: 64000,
      maxResponseBytes: 2500000,
      timeoutSeconds: 28,
      cacheTtlMinutes: 9,
      maxRedirects: 4,
      readability: false,
      userAgent: 'SDKWork Fetch Bot/1.0',
      fallbackProviderConfig: {
        providerId: 'firecrawl',
        apiKeySource: 'env:FIRECRAWL_API_KEY',
        baseUrl: 'https://api.firecrawl.dev',
        advancedConfig: `{
  "onlyMainContent": true,
  "maxAgeMs": 86400000,
  "timeoutSeconds": 60
}`,
      },
    });

    assert.deepEqual(root, {
      tools: {
        web: {
          fetch: {
            enabled: true,
            maxChars: 42000,
            maxCharsCap: 64000,
            maxResponseBytes: 2500000,
            timeoutSeconds: 28,
            cacheTtlMinutes: 9,
            maxRedirects: 4,
            readability: false,
            userAgent: 'SDKWork Fetch Bot/1.0',
          },
        },
      },
      plugins: {
        entries: {
          firecrawl: {
            enabled: false,
            metadata: {
              label: 'Firecrawl',
            },
            config: {
              theme: 'dark',
              webSearch: {
                apiKey: 'fc-search-live',
              },
              webFetch: {
                apiKey: '${FIRECRAWL_API_KEY}',
                baseUrl: 'https://api.firecrawl.dev',
                onlyMainContent: true,
                maxAgeMs: 86400000,
                timeoutSeconds: 60,
              },
            },
          },
        },
      },
    });
  },
);
