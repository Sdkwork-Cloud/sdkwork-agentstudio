import assert from 'node:assert/strict';
import {
  applyOpenClawDraftFieldChange,
  applyOpenClawNullableDraftFieldChange,
  applyOpenClawWebSearchProviderDraftChange,
  buildOpenClawWebSearchProviderSelectionState,
  createOpenClawConfigResetState,
  buildOpenClawAuthCooldownsSaveInput,
  buildOpenClawWebFetchSaveInput,
  buildOpenClawWebSearchNativeCodexSaveInput,
  buildOpenClawWebSearchSaveInput,
  buildOpenClawXSearchSaveInput,
  createOpenClawAuthCooldownsDraft,
  createOpenClawWebFetchDraftState,
  createOpenClawWebFetchFallbackDraft,
  createOpenClawWebFetchSharedDraft,
  createOpenClawWebSearchDraftState,
  createOpenClawWebSearchNativeCodexDraft,
  createOpenClawWebSearchProviderDraft,
  createOpenClawWebSearchSharedDraft,
  createOpenClawXSearchDraft,
} from './openClawConfigDrafts.ts';

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

await runTest('buildOpenClawWebSearchSaveInput trims provider, parses numeric fields, and normalizes env placeholders', () => {
  assert.deepEqual(
    buildOpenClawWebSearchSaveInput({
      sharedDraft: {
        enabled: true,
        provider: '  tavily  ',
        maxResults: '12',
        timeoutSeconds: '45',
        cacheTtlMinutes: '30',
      },
      providerId: 'tavily',
      providerDraft: {
        apiKeySource: ' ${TAVILY_API_KEY} ',
        baseUrl: 'https://api.tavily.example',
        model: 'search-pro',
        advancedConfig: '{"safe":true}',
      },
    }),
    {
      ok: true,
      value: {
        enabled: true,
        provider: 'tavily',
        maxResults: 12,
        timeoutSeconds: 45,
        cacheTtlMinutes: 30,
        providerConfig: {
          providerId: 'tavily',
          apiKeySource: 'env:TAVILY_API_KEY',
          baseUrl: 'https://api.tavily.example',
          model: 'search-pro',
          advancedConfig: '{"safe":true}',
        },
      },
    },
  );
});

await runTest('buildOpenClawWebSearchSaveInput rejects a blank provider', () => {
  assert.deepEqual(
    buildOpenClawWebSearchSaveInput({
      sharedDraft: {
        enabled: true,
        provider: '   ',
        maxResults: '5',
        timeoutSeconds: '30',
        cacheTtlMinutes: '15',
      },
      providerId: 'tavily',
      providerDraft: {
        apiKeySource: '',
        baseUrl: '',
        model: '',
        advancedConfig: '',
      },
    }),
    {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.webSearch.errors.providerRequired',
    },
  );
});

await runTest('buildOpenClawXSearchSaveInput parses numeric fields, preserves inline citations, and normalizes env placeholders', () => {
  assert.deepEqual(
    buildOpenClawXSearchSaveInput({
      enabled: false,
      apiKeySource: ' ${XAI_API_KEY} ',
      model: 'grok-3-search',
      inlineCitations: true,
      maxTurns: '3',
      timeoutSeconds: '20',
      cacheTtlMinutes: '10',
      advancedConfig: '{"region":"global"}',
    }),
    {
      ok: true,
      value: {
        enabled: false,
        apiKeySource: 'env:XAI_API_KEY',
        model: 'grok-3-search',
        inlineCitations: true,
        maxTurns: 3,
        timeoutSeconds: 20,
        cacheTtlMinutes: 10,
        advancedConfig: '{"region":"global"}',
      },
    },
  );
});

await runTest('buildOpenClawWebSearchNativeCodexSaveInput normalizes allowed domains', () => {
  assert.deepEqual(
    buildOpenClawWebSearchNativeCodexSaveInput({
      enabled: true,
      mode: 'cached',
      allowedDomains: 'example.com,\n docs.example.com \nexample.com',
      contextSize: 'medium',
      userLocationCountry: 'CN',
      userLocationCity: 'Shanghai',
      userLocationTimezone: 'Asia/Shanghai',
      advancedConfig: '{"safe":true}',
    }),
    {
      enabled: true,
      mode: 'cached',
      allowedDomains: [
        'example.com',
        'docs.example.com',
      ],
      contextSize: 'medium',
      userLocation: {
        country: 'CN',
        city: 'Shanghai',
        timezone: 'Asia/Shanghai',
      },
      advancedConfig: '{"safe":true}',
    },
  );
});

await runTest('buildOpenClawWebFetchSaveInput parses numeric limits and normalizes fallback env placeholders', () => {
  assert.deepEqual(
    buildOpenClawWebFetchSaveInput({
      sharedDraft: {
        enabled: true,
        maxChars: '50000',
        maxCharsCap: '80000',
        maxResponseBytes: '2000000',
        timeoutSeconds: '30',
        cacheTtlMinutes: '15',
        maxRedirects: '3',
        readability: true,
        userAgent: 'Claw Studio',
      },
      fallbackDraft: {
        apiKeySource: ' ${FIRECRAWL_API_KEY} ',
        baseUrl: 'https://firecrawl.example',
        advancedConfig: '{"cache":true}',
      },
    }),
    {
      ok: true,
      value: {
        enabled: true,
        maxChars: 50000,
        maxCharsCap: 80000,
        maxResponseBytes: 2000000,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        maxRedirects: 3,
        readability: true,
        userAgent: 'Claw Studio',
        fallbackProviderConfig: {
          providerId: 'firecrawl',
          apiKeySource: 'env:FIRECRAWL_API_KEY',
          baseUrl: 'https://firecrawl.example',
          advancedConfig: '{"cache":true}',
        },
      },
    },
  );
});

await runTest('buildOpenClawAuthCooldownsSaveInput omits blank values and rejects negative drafts', () => {
  assert.deepEqual(
    buildOpenClawAuthCooldownsSaveInput({
      rateLimitedProfileRotations: ' 5 ',
      overloadedProfileRotations: '',
      overloadedBackoffMs: '250',
      billingBackoffHours: '  ',
      billingMaxHours: '12',
      failureWindowHours: '24',
    }),
    {
      ok: true,
      value: {
        rateLimitedProfileRotations: 5,
        overloadedProfileRotations: undefined,
        overloadedBackoffMs: 250,
        billingBackoffHours: undefined,
        billingMaxHours: 12,
        failureWindowHours: 24,
      },
    },
  );

  assert.deepEqual(
    buildOpenClawAuthCooldownsSaveInput({
      rateLimitedProfileRotations: '-1',
      overloadedProfileRotations: '',
      overloadedBackoffMs: '',
      billingBackoffHours: '',
      billingMaxHours: '',
      failureWindowHours: '',
    }),
    {
      ok: false,
      errorKey:
        'instances.detail.instanceWorkbench.authCooldowns.errors.rateLimitedProfileRotationsInvalid',
    },
  );
});

await runTest(
  'config draft factories map snapshot values into editable page drafts and normalize env placeholders',
  () => {
    assert.deepEqual(
      createOpenClawWebSearchDraftState({
        config: {
          enabled: true,
          provider: 'tavily',
          maxResults: 12,
          timeoutSeconds: 45,
          cacheTtlMinutes: 30,
          providers: [
            {
              id: 'tavily',
              apiKeySource: '${TAVILY_API_KEY}',
              baseUrl: 'https://api.tavily.example',
              model: 'search-pro',
              advancedConfig: '{"safe":true}',
            },
            {
              id: 'exa',
              apiKeySource: '${EXA_API_KEY}',
              baseUrl: 'https://api.exa.example',
              model: 'exa-search',
              advancedConfig: '',
            },
          ],
        } as any,
        currentProviderId: 'exa',
      }),
      {
        selectedProviderId: 'exa',
        sharedDraft: {
          enabled: true,
          provider: 'tavily',
          maxResults: '12',
          timeoutSeconds: '45',
          cacheTtlMinutes: '30',
        },
        providerDrafts: {},
      },
    );

    assert.deepEqual(
      createOpenClawWebSearchSharedDraft({
        enabled: true,
        provider: 'tavily',
        maxResults: 12,
        timeoutSeconds: 45,
        cacheTtlMinutes: 30,
      } as any),
      {
        enabled: true,
        provider: 'tavily',
        maxResults: '12',
        timeoutSeconds: '45',
        cacheTtlMinutes: '30',
      },
    );

    assert.deepEqual(
      createOpenClawWebSearchProviderDraft({
        apiKeySource: '${TAVILY_API_KEY}',
        baseUrl: 'https://api.tavily.example',
        model: 'search-pro',
        advancedConfig: '{"safe":true}',
      } as any),
      {
        apiKeySource: 'env:TAVILY_API_KEY',
        baseUrl: 'https://api.tavily.example',
        model: 'search-pro',
        advancedConfig: '{"safe":true}',
      },
    );

    const webSearchProviderSelectionState = buildOpenClawWebSearchProviderSelectionState({
      config: {
        enabled: true,
        provider: 'tavily',
        maxResults: 12,
        timeoutSeconds: 45,
        cacheTtlMinutes: 30,
        providers: [
          {
            id: 'tavily',
            apiKeySource: '${TAVILY_API_KEY}',
            baseUrl: 'https://api.tavily.example',
            model: 'search-pro',
            advancedConfig: '{"safe":true}',
          },
        ],
      } as any,
      selectedProviderId: 'tavily',
      providerDrafts: {},
    });
    assert.equal(webSearchProviderSelectionState.selectedProvider?.id, 'tavily');
    assert.deepEqual(webSearchProviderSelectionState.selectedProviderDraft, {
      apiKeySource: 'env:TAVILY_API_KEY',
      baseUrl: 'https://api.tavily.example',
      model: 'search-pro',
      advancedConfig: '{"safe":true}',
    });

    assert.deepEqual(
      applyOpenClawWebSearchProviderDraftChange({
        currentDrafts: {},
        selectedProvider: webSearchProviderSelectionState.selectedProvider,
        key: 'model',
        value: 'search-plus',
      }),
      {
        tavily: {
          apiKeySource: 'env:TAVILY_API_KEY',
          baseUrl: 'https://api.tavily.example',
          model: 'search-plus',
          advancedConfig: '{"safe":true}',
        },
      },
    );
    assert.deepEqual(
      applyOpenClawNullableDraftFieldChange(
        {
          enabled: false,
          model: 'grok-3-search',
        },
        'model',
        'grok-3-reasoning',
      ),
      {
        enabled: false,
        model: 'grok-3-reasoning',
      },
    );
    assert.deepEqual(
      applyOpenClawDraftFieldChange(
        {
          apiKeySource: 'env:FIRECRAWL_API_KEY',
          baseUrl: 'https://firecrawl.example',
          advancedConfig: '',
        },
        'baseUrl',
        'https://firecrawl-next.example',
      ),
      {
        apiKeySource: 'env:FIRECRAWL_API_KEY',
        baseUrl: 'https://firecrawl-next.example',
        advancedConfig: '',
      },
    );

    assert.deepEqual(
      createOpenClawXSearchDraft({
        enabled: false,
        apiKeySource: '${XAI_API_KEY}',
        model: 'grok-3-search',
        inlineCitations: true,
        maxTurns: 3,
        timeoutSeconds: 20,
        cacheTtlMinutes: 10,
        advancedConfig: '{"region":"global"}',
      } as any),
      {
        enabled: false,
        apiKeySource: 'env:XAI_API_KEY',
        model: 'grok-3-search',
        inlineCitations: true,
        maxTurns: '3',
        timeoutSeconds: '20',
        cacheTtlMinutes: '10',
        advancedConfig: '{"region":"global"}',
      },
    );

    assert.deepEqual(
      createOpenClawWebSearchNativeCodexDraft({
        enabled: true,
        mode: 'cached',
        allowedDomains: ['example.com', 'docs.example.com'],
        contextSize: 'medium',
        userLocation: {
          country: 'CN',
          city: 'Shanghai',
          timezone: 'Asia/Shanghai',
        },
        advancedConfig: '{"safe":true}',
      } as any),
      {
        enabled: true,
        mode: 'cached',
        allowedDomains: 'example.com\ndocs.example.com',
        contextSize: 'medium',
        userLocationCountry: 'CN',
        userLocationCity: 'Shanghai',
        userLocationTimezone: 'Asia/Shanghai',
        advancedConfig: '{"safe":true}',
      },
    );

    assert.deepEqual(
      createOpenClawWebFetchSharedDraft({
        enabled: true,
        maxChars: 50000,
        maxCharsCap: 80000,
        maxResponseBytes: 2000000,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        maxRedirects: 3,
        readability: true,
        userAgent: 'Claw Studio',
      } as any),
      {
        enabled: true,
        maxChars: '50000',
        maxCharsCap: '80000',
        maxResponseBytes: '2000000',
        timeoutSeconds: '30',
        cacheTtlMinutes: '15',
        maxRedirects: '3',
        readability: true,
        userAgent: 'Claw Studio',
      },
    );

    assert.deepEqual(
      createOpenClawWebFetchFallbackDraft({
        fallbackProvider: {
          apiKeySource: '${FIRECRAWL_API_KEY}',
          baseUrl: 'https://firecrawl.example',
          advancedConfig: '{"cache":true}',
        },
      } as any),
      {
        apiKeySource: 'env:FIRECRAWL_API_KEY',
        baseUrl: 'https://firecrawl.example',
        advancedConfig: '{"cache":true}',
      },
    );

    assert.deepEqual(
      createOpenClawWebFetchDraftState({
        enabled: true,
        maxChars: 50000,
        maxCharsCap: 80000,
        maxResponseBytes: 2000000,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        maxRedirects: 3,
        readability: true,
        userAgent: 'Claw Studio',
        fallbackProvider: {
          apiKeySource: '${FIRECRAWL_API_KEY}',
          baseUrl: 'https://firecrawl.example',
          advancedConfig: '{"cache":true}',
        },
      } as any),
      {
        sharedDraft: {
          enabled: true,
          maxChars: '50000',
          maxCharsCap: '80000',
          maxResponseBytes: '2000000',
          timeoutSeconds: '30',
          cacheTtlMinutes: '15',
          maxRedirects: '3',
          readability: true,
          userAgent: 'Claw Studio',
        },
        fallbackDraft: {
          apiKeySource: 'env:FIRECRAWL_API_KEY',
          baseUrl: 'https://firecrawl.example',
          advancedConfig: '{"cache":true}',
        },
      },
    );

    assert.deepEqual(
      createOpenClawAuthCooldownsDraft({
        rateLimitedProfileRotations: 5,
        overloadedProfileRotations: null,
        overloadedBackoffMs: 250,
        billingBackoffHours: undefined,
        billingMaxHours: 12,
        failureWindowHours: 24,
      } as any),
      {
        rateLimitedProfileRotations: '5',
        overloadedProfileRotations: '',
        overloadedBackoffMs: '250',
        billingBackoffHours: '',
        billingMaxHours: '12',
        failureWindowHours: '24',
      },
    );
  },
);

await runTest('config draft factories preserve null and empty fallback behavior', () => {
  assert.deepEqual(
    createOpenClawWebSearchDraftState({
      config: {
        enabled: true,
        provider: 'missing',
        maxResults: 5,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        providers: [
          {
            id: 'tavily',
            apiKeySource: 'env:TAVILY_API_KEY',
            baseUrl: 'https://api.tavily.example',
            model: 'search-pro',
            advancedConfig: '',
          },
        ],
      } as any,
      currentProviderId: 'unknown',
    }),
    {
      selectedProviderId: 'tavily',
      sharedDraft: {
        enabled: true,
        provider: 'missing',
        maxResults: '5',
        timeoutSeconds: '30',
        cacheTtlMinutes: '15',
      },
      providerDrafts: {},
    },
  );
  assert.deepEqual(createOpenClawWebSearchDraftState({ config: null, currentProviderId: 'tavily' } as any), {
    selectedProviderId: null,
    sharedDraft: null,
    providerDrafts: {},
  });
  assert.equal(createOpenClawWebSearchSharedDraft(null as any), null);
  assert.equal(createOpenClawXSearchDraft(undefined as any), null);
  assert.equal(createOpenClawWebSearchNativeCodexDraft(null as any), null);
  assert.equal(createOpenClawWebFetchSharedDraft(undefined as any), null);
  assert.equal(createOpenClawAuthCooldownsDraft(null as any), null);

  assert.deepEqual(createOpenClawWebSearchProviderDraft(undefined), {
    apiKeySource: '',
    baseUrl: '',
    model: '',
    advancedConfig: '',
  });
  assert.deepEqual(
    buildOpenClawWebSearchProviderSelectionState({
      config: null,
      selectedProviderId: 'tavily',
      providerDrafts: {},
    } as any),
    {
      selectedProvider: null,
      selectedProviderDraft: null,
    },
  );
  assert.deepEqual(
    applyOpenClawWebSearchProviderDraftChange({
      currentDrafts: {
        existing: {
          apiKeySource: 'env:EXISTING',
          baseUrl: 'https://existing.example',
          model: 'existing-model',
          advancedConfig: '',
        },
      },
      selectedProvider: null,
      key: 'model',
      value: 'ignored',
    }),
    {
      existing: {
        apiKeySource: 'env:EXISTING',
        baseUrl: 'https://existing.example',
        model: 'existing-model',
        advancedConfig: '',
      },
    },
  );
  assert.equal(
    applyOpenClawNullableDraftFieldChange(null, 'model', 'ignored'),
    null,
  );

  assert.deepEqual(createOpenClawWebFetchFallbackDraft(null as any), {
    apiKeySource: '',
    baseUrl: '',
    advancedConfig: '',
  });

  assert.deepEqual(createOpenClawWebFetchDraftState(null as any), {
    sharedDraft: null,
    fallbackDraft: {
      apiKeySource: '',
      baseUrl: '',
      advancedConfig: '',
    },
  });
});

await runTest('config reset state centralizes page reset baselines for all config surfaces', () => {
  assert.deepEqual(createOpenClawConfigResetState(), {
    webSearch: {
      selectedProviderId: null,
      sharedDraft: null,
      providerDrafts: {},
      error: null,
      isSaving: false,
    },
    xSearch: {
      draft: null,
      error: null,
      isSaving: false,
    },
    webSearchNativeCodex: {
      draft: null,
      error: null,
      isSaving: false,
    },
    webFetch: {
      sharedDraft: null,
      fallbackDraft: {
        apiKeySource: '',
        baseUrl: '',
        advancedConfig: '',
      },
      error: null,
      isSaving: false,
    },
    authCooldowns: {
      draft: null,
      error: null,
      isSaving: false,
    },
    dreaming: {
      draft: null,
      error: null,
      isSaving: false,
    },
  });
});
