import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

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

async function loadConfigPresentationModule() {
  const moduleUrl = new URL('./openClawConfigPresentation.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected openClawConfigPresentation.ts to exist',
  );

  return import('./openClawConfigPresentation.ts');
}

function createWebSearchProviderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'firecrawl',
    label: 'Firecrawl',
    apiKeySource: 'env:FIRECRAWL_API_KEY',
    baseUrl: 'https://api.firecrawl.dev',
    model: 'firecrawl-search',
    advancedConfig: '{"timeout":30}',
    ...overrides,
  } as any;
}

await runTest(
  'buildOpenClawConfigDraftChangeHandlers routes web-search shared and provider draft changes through page-owned setters',
  async () => {
    const { buildOpenClawConfigDraftChangeHandlers } =
      await loadConfigPresentationModule();
    let webSearchError: string | null = 'stale web search error';
    let webSearchSharedDraft = {
      enabled: true,
      provider: 'firecrawl',
      maxResults: '5',
      timeoutSeconds: '30',
      cacheTtlMinutes: '15',
    };
    let webSearchProviderDrafts = {
      firecrawl: {
        apiKeySource: 'env:FIRECRAWL_API_KEY',
        baseUrl: 'https://api.firecrawl.dev',
        model: 'firecrawl-search',
        advancedConfig: '{}',
      },
    };

    const handlers = buildOpenClawConfigDraftChangeHandlers({
      selectedWebSearchProvider: createWebSearchProviderFixture(),
      setWebSearchError: (value) => {
        webSearchError = value;
      },
      setWebSearchSharedDraft: (updater) => {
        webSearchSharedDraft = updater(webSearchSharedDraft);
      },
      setWebSearchProviderDrafts: (updater) => {
        webSearchProviderDrafts = updater(webSearchProviderDrafts);
      },
      setXSearchError: () => undefined,
      setXSearchDraft: () => undefined,
      setWebSearchNativeCodexError: () => undefined,
      setWebSearchNativeCodexDraft: () => undefined,
      setWebFetchError: () => undefined,
      setWebFetchSharedDraft: () => undefined,
      setWebFetchFallbackDraft: () => undefined,
      setAuthCooldownsError: () => undefined,
      setAuthCooldownsDraft: () => undefined,
      setDreamingError: () => undefined,
      setDreamingDraft: () => undefined,
    });

    handlers.onWebSearchSharedDraftChange('maxResults', '8');

    assert.equal(webSearchError, null);
    assert.deepEqual(webSearchSharedDraft, {
      enabled: true,
      provider: 'firecrawl',
      maxResults: '8',
      timeoutSeconds: '30',
      cacheTtlMinutes: '15',
    });

    webSearchError = 'stale provider error';
    handlers.onWebSearchProviderDraftChange('model', 'firecrawl-deep-search');

    assert.equal(webSearchError, null);
    assert.deepEqual(webSearchProviderDrafts, {
      firecrawl: {
        apiKeySource: 'env:FIRECRAWL_API_KEY',
        baseUrl: 'https://api.firecrawl.dev',
        model: 'firecrawl-deep-search',
        advancedConfig: '{}',
      },
    });

    const noProviderHandlers = buildOpenClawConfigDraftChangeHandlers({
      selectedWebSearchProvider: null,
      setWebSearchError: (value) => {
        webSearchError = value;
      },
      setWebSearchSharedDraft: (updater) => {
        webSearchSharedDraft = updater(webSearchSharedDraft);
      },
      setWebSearchProviderDrafts: (updater) => {
        webSearchProviderDrafts = updater(webSearchProviderDrafts);
      },
      setXSearchError: () => undefined,
      setXSearchDraft: () => undefined,
      setWebSearchNativeCodexError: () => undefined,
      setWebSearchNativeCodexDraft: () => undefined,
      setWebFetchError: () => undefined,
      setWebFetchSharedDraft: () => undefined,
      setWebFetchFallbackDraft: () => undefined,
      setAuthCooldownsError: () => undefined,
      setAuthCooldownsDraft: () => undefined,
      setDreamingError: () => undefined,
      setDreamingDraft: () => undefined,
    });

    webSearchError = 'provider still missing';
    noProviderHandlers.onWebSearchProviderDraftChange('model', 'ignored');

    assert.equal(webSearchError, 'provider still missing');
    assert.deepEqual(webSearchProviderDrafts, {
      firecrawl: {
        apiKeySource: 'env:FIRECRAWL_API_KEY',
        baseUrl: 'https://api.firecrawl.dev',
        model: 'firecrawl-deep-search',
        advancedConfig: '{}',
      },
    });
  },
);

await runTest(
  'buildOpenClawConfigDraftChangeHandlers clears per-surface errors and patches the remaining config drafts',
  async () => {
    const { buildOpenClawConfigDraftChangeHandlers } =
      await loadConfigPresentationModule();
    let xSearchError: string | null = 'stale x-search error';
    let xSearchDraft = {
      enabled: true,
      apiKeySource: 'env:XAI_API_KEY',
      model: 'grok-4',
      inlineCitations: false,
      maxTurns: '6',
      timeoutSeconds: '45',
      cacheTtlMinutes: '30',
      advancedConfig: '{}',
    };
    let webSearchNativeCodexError: string | null = 'stale native codex error';
    let webSearchNativeCodexDraft = {
      enabled: true,
      mode: 'balanced',
      allowedDomains: 'openai.com',
      contextSize: 'medium',
      userLocationCountry: 'CN',
      userLocationCity: 'Shanghai',
      userLocationTimezone: 'Asia/Shanghai',
      advancedConfig: '{}',
    };
    let webFetchError: string | null = 'stale web fetch error';
    let webFetchSharedDraft = {
      enabled: true,
      maxChars: '12000',
      maxCharsCap: '24000',
      maxResponseBytes: '512000',
      timeoutSeconds: '30',
      cacheTtlMinutes: '15',
      maxRedirects: '3',
      readability: true,
      userAgent: 'Claw Studio',
    };
    let webFetchFallbackDraft = {
      apiKeySource: '',
      baseUrl: '',
      advancedConfig: '{}',
    };
    let authCooldownsError: string | null = 'stale auth cooldown error';
    let authCooldownsDraft = {
      rateLimitedProfileRotations: '2',
      overloadedProfileRotations: '3',
      overloadedBackoffMs: '60000',
      billingBackoffHours: '12',
      billingMaxHours: '72',
      failureWindowHours: '24',
    };
    let dreamingError: string | null = 'stale dreaming error';
    let dreamingDraft = {
      enabled: false,
      frequency: 'weekly',
      trigger: 'manual',
      prompt: 'baseline',
      advancedConfig: '{}',
    };

    const handlers = buildOpenClawConfigDraftChangeHandlers({
      selectedWebSearchProvider: null,
      setWebSearchError: () => undefined,
      setWebSearchSharedDraft: () => undefined,
      setWebSearchProviderDrafts: () => undefined,
      setXSearchError: (value) => {
        xSearchError = value;
      },
      setXSearchDraft: (updater) => {
        xSearchDraft = updater(xSearchDraft);
      },
      setWebSearchNativeCodexError: (value) => {
        webSearchNativeCodexError = value;
      },
      setWebSearchNativeCodexDraft: (updater) => {
        webSearchNativeCodexDraft = updater(webSearchNativeCodexDraft);
      },
      setWebFetchError: (value) => {
        webFetchError = value;
      },
      setWebFetchSharedDraft: (updater) => {
        webFetchSharedDraft = updater(webFetchSharedDraft);
      },
      setWebFetchFallbackDraft: (updater) => {
        webFetchFallbackDraft = updater(webFetchFallbackDraft);
      },
      setAuthCooldownsError: (value) => {
        authCooldownsError = value;
      },
      setAuthCooldownsDraft: (updater) => {
        authCooldownsDraft = updater(authCooldownsDraft);
      },
      setDreamingError: (value) => {
        dreamingError = value;
      },
      setDreamingDraft: (updater) => {
        dreamingDraft = updater(dreamingDraft);
      },
    });

    handlers.onXSearchDraftChange('inlineCitations', true);
    handlers.onWebSearchNativeCodexDraftChange('allowedDomains', 'openai.com\nsdkwork.dev');
    handlers.onWebFetchSharedDraftChange('readability', false);
    handlers.onWebFetchFallbackDraftChange('baseUrl', 'https://firecrawl.example.com');
    handlers.onAuthCooldownsDraftChange('billingMaxHours', '96');
    handlers.onDreamingDraftChange('prompt', 'updated prompt');

    assert.equal(xSearchError, null);
    assert.equal(xSearchDraft.inlineCitations, true);
    assert.equal(webSearchNativeCodexError, null);
    assert.equal(webSearchNativeCodexDraft.allowedDomains, 'openai.com\nsdkwork.dev');
    assert.equal(webFetchError, null);
    assert.equal(webFetchSharedDraft.readability, false);
    assert.equal(webFetchFallbackDraft.baseUrl, 'https://firecrawl.example.com');
    assert.equal(authCooldownsError, null);
    assert.equal(authCooldownsDraft.billingMaxHours, '96');
    assert.equal(dreamingError, null);
    assert.equal(dreamingDraft.prompt, 'updated prompt');
  },
);
