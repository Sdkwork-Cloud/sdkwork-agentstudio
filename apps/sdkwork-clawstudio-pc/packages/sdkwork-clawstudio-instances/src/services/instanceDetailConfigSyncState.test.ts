import assert from 'node:assert/strict';
import {
  applyInstanceDetailConfigAuthCooldownsSyncState,
  applyInstanceDetailConfigDreamingSyncState,
  applyInstanceDetailConfigWebFetchSyncState,
  applyInstanceDetailConfigWebSearchNativeCodexSyncState,
  applyInstanceDetailConfigWebSearchSyncState,
  applyInstanceDetailConfigXSearchSyncState,
} from './instanceDetailConfigSyncState.ts';
import {
  createOpenClawAuthCooldownsDraft as createAuthCooldownsFormState,
  createOpenClawWebFetchDraftState,
  createOpenClawWebSearchDraftState,
  createOpenClawWebSearchNativeCodexDraft as createWebSearchNativeCodexFormState,
  createOpenClawXSearchDraft as createXSearchFormState,
} from './openClawConfigDrafts.ts';
import { createOpenClawDreamingFormState } from './instanceMemoryWorkbenchPresentation.ts';

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

await runTest(
  'applyInstanceDetailConfigWebSearchSyncState routes derived draft state and clears the page error',
  () => {
    const config = {
      enabled: true,
      provider: 'tavily',
      maxResults: 8,
      timeoutSeconds: 30,
      cacheTtlMinutes: 10,
      providers: [
        {
          id: 'tavily',
          apiKeySource: 'env:TAVILY_API_KEY',
          baseUrl: 'https://api.tavily.example',
          model: 'search-pro',
          advancedConfig: '',
        },
      ],
    } as any;
    const expected = createOpenClawWebSearchDraftState({
      config,
      currentProviderId: 'tavily',
    });

    const captured = {
      selectedProviderId: 'stale',
      sharedDraft: { enabled: false } as any,
      providerDrafts: { stale: { apiKeySource: 'env:STALE', baseUrl: '', model: '', advancedConfig: '' } },
      error: 'stale-error' as string | null,
    };

    applyInstanceDetailConfigWebSearchSyncState({
      config,
      currentProviderId: 'tavily',
      setSelectedWebSearchProviderId: (value) => {
        captured.selectedProviderId = value;
      },
      setWebSearchSharedDraft: (value) => {
        captured.sharedDraft = value;
      },
      setWebSearchProviderDrafts: (value) => {
        captured.providerDrafts = value;
      },
      setWebSearchError: (value) => {
        captured.error = value;
      },
    });

    assert.deepEqual(captured, {
      selectedProviderId: expected.selectedProviderId,
      sharedDraft: expected.sharedDraft,
      providerDrafts: expected.providerDrafts,
      error: null,
    });
  },
);

await runTest(
  'applyInstanceDetailConfigAuthCooldownsSyncState routes the derived auth-cooldowns draft and clears the page error',
  () => {
    const config = {
      rateLimitedProfileRotations: 5,
      overloadedProfileRotations: null,
      overloadedBackoffMs: 250,
      billingBackoffHours: undefined,
      billingMaxHours: 12,
      failureWindowHours: 24,
    } as any;
    const expectedDraft = createAuthCooldownsFormState(config);
    const captured = {
      draft: { rateLimitedProfileRotations: 'stale' } as any,
      error: 'stale-error' as string | null,
    };

    applyInstanceDetailConfigAuthCooldownsSyncState({
      config,
      setAuthCooldownsDraft: (value) => {
        captured.draft = value;
      },
      setAuthCooldownsError: (value) => {
        captured.error = value;
      },
    });

    assert.deepEqual(captured, {
      draft: expectedDraft,
      error: null,
    });
  },
);

await runTest(
  'applyInstanceDetailConfigDreamingSyncState routes the derived dreaming draft and clears the page error',
  () => {
    const config = {
      enabled: true,
      frequency: 'nightly',
    } as any;
    const expectedDraft = createOpenClawDreamingFormState(config);
    const captured = {
      draft: { enabled: false, frequency: 'stale' } as any,
      error: 'stale-error' as string | null,
    };

    applyInstanceDetailConfigDreamingSyncState({
      config,
      setDreamingDraft: (value) => {
        captured.draft = value;
      },
      setDreamingError: (value) => {
        captured.error = value;
      },
    });

    assert.deepEqual(captured, {
      draft: expectedDraft,
      error: null,
    });
  },
);

await runTest(
  'applyInstanceDetailConfigXSearchSyncState routes the derived x-search draft and clears the page error',
  () => {
    const config = {
      enabled: true,
      apiKeySource: 'env:XAI_API_KEY',
      model: 'grok-3-search',
      inlineCitations: true,
      maxTurns: 3,
      timeoutSeconds: 20,
      cacheTtlMinutes: 10,
      advancedConfig: '{"region":"global"}',
    } as any;
    const expectedDraft = createXSearchFormState(config);
    const captured = {
      draft: { enabled: false } as any,
      error: 'stale-error' as string | null,
    };

    applyInstanceDetailConfigXSearchSyncState({
      config,
      setXSearchDraft: (value) => {
        captured.draft = value;
      },
      setXSearchError: (value) => {
        captured.error = value;
      },
    });

    assert.deepEqual(captured, {
      draft: expectedDraft,
      error: null,
    });
  },
);

await runTest(
  'applyInstanceDetailConfigWebSearchNativeCodexSyncState routes the derived native-codex draft and clears the page error',
  () => {
    const config = {
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
    } as any;
    const expectedDraft = createWebSearchNativeCodexFormState(config);
    const captured = {
      draft: { enabled: false } as any,
      error: 'stale-error' as string | null,
    };

    applyInstanceDetailConfigWebSearchNativeCodexSyncState({
      config,
      setWebSearchNativeCodexDraft: (value) => {
        captured.draft = value;
      },
      setWebSearchNativeCodexError: (value) => {
        captured.error = value;
      },
    });

    assert.deepEqual(captured, {
      draft: expectedDraft,
      error: null,
    });
  },
);

await runTest(
  'applyInstanceDetailConfigWebFetchSyncState routes the derived web-fetch draft state and clears the page error',
  () => {
    const config = {
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
        apiKeySource: 'env:FIRECRAWL_API_KEY',
        baseUrl: 'https://firecrawl.example',
        advancedConfig: '{"cache":true}',
      },
    } as any;
    const expected = createOpenClawWebFetchDraftState(config);
    const captured = {
      sharedDraft: { enabled: false } as any,
      fallbackDraft: {
        apiKeySource: 'env:STALE',
        baseUrl: 'https://stale.example',
        advancedConfig: '',
      },
      error: 'stale-error' as string | null,
    };

    applyInstanceDetailConfigWebFetchSyncState({
      config,
      setWebFetchSharedDraft: (value) => {
        captured.sharedDraft = value;
      },
      setWebFetchFallbackDraft: (value) => {
        captured.fallbackDraft = value;
      },
      setWebFetchError: (value) => {
        captured.error = value;
      },
    });

    assert.deepEqual(captured, {
      sharedDraft: expected.sharedDraft,
      fallbackDraft: expected.fallbackDraft,
      error: null,
    });
  },
);
