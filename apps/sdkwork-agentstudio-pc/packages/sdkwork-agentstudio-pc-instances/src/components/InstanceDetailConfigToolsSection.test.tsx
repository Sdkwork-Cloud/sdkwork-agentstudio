import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InstanceDetailConfigToolsSection } from './InstanceDetailConfigToolsSection.tsx';

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
  'InstanceDetailConfigToolsSection composes config tools panels from page-owned state instead of requiring prebuilt JSX nodes',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailConfigToolsSection
        emptyState={<div>empty-tools</div>}
        workbench={{
          tools: [],
        } as any}
        configWebSearch={{
          providers: [{ id: 'provider-1', label: 'Primary Provider' }],
        } as any}
        webSearchSharedDraft={{
          enabled: true,
          provider: 'provider-1',
          maxResults: '5',
          timeoutSeconds: '30',
          cacheTtlMinutes: '10',
        }}
        selectedWebSearchProvider={{
          id: 'provider-1',
          label: 'Primary Provider',
          apiKeySource: 'WEB_SEARCH_KEY',
          baseUrl: 'https://example.com',
          model: 'gpt-5.4',
          advancedConfig: '{}',
        } as any}
        selectedWebSearchProviderDraft={{
          apiKeySource: 'WEB_SEARCH_KEY',
          baseUrl: 'https://example.com',
          model: 'gpt-5.4',
          advancedConfig: '{}',
        }}
        webSearchError={null}
        isSavingWebSearch={false}
        canEditConfigWebSearch
        onSaveWebSearchConfig={() => undefined}
        onWebSearchSharedDraftChange={() => undefined}
        onWebSearchProviderDraftChange={() => undefined}
        onSelectedWebSearchProviderIdChange={() => undefined}
        configWebFetch={null}
        webFetchSharedDraft={null}
        webFetchFallbackDraft={{
          apiKeySource: '',
          baseUrl: '',
          advancedConfig: '',
        }}
        webFetchError={null}
        isSavingWebFetch={false}
        canEditConfigWebFetch={false}
        onSaveWebFetchConfig={() => undefined}
        onWebFetchSharedDraftChange={() => undefined}
        onWebFetchFallbackDraftChange={() => undefined}
        configWebSearchNativeCodex={null}
        webSearchNativeCodexDraft={null}
        webSearchNativeCodexError={null}
        isSavingWebSearchNativeCodex={false}
        canEditConfigWebSearchNativeCodex={false}
        onSaveWebSearchNativeCodexConfig={() => undefined}
        onWebSearchNativeCodexDraftChange={() => undefined}
        configXSearch={null}
        xSearchDraft={null}
        xSearchError={null}
        isSavingXSearch={false}
        canEditConfigXSearch={false}
        onSaveXSearchConfig={() => undefined}
        onXSearchDraftChange={() => undefined}
        configAuthCooldowns={{
          billingMaxHours: 24,
        } as any}
        authCooldownsDraft={{
          rateLimitedProfileRotations: '',
          overloadedProfileRotations: '',
          overloadedBackoffMs: '',
          billingBackoffHours: '',
          billingMaxHours: '24',
          failureWindowHours: '',
        }}
        authCooldownsError={null}
        isSavingAuthCooldowns={false}
        canEditConfigAuthCooldowns
        onSaveAuthCooldownsConfig={() => undefined}
        onAuthCooldownsDraftChange={() => undefined}
        formatWorkbenchLabel={(value) => `label:${value}`}
        getDangerBadge={(status) => `danger:${status}`}
        getStatusBadge={(status) => `status:${status}`}
        t={(key) => key}
      />,
    );

    assert.match(markup, /data-slot="instance-detail-config-web-search"/);
    assert.match(markup, /data-slot="instance-detail-config-auth-cooldowns"/);
    assert.match(markup, /empty-tools/);
  },
);

await runTest(
  'InstanceDetailConfigToolsSection still falls back to the supplied empty state when runtime and config tool surfaces are both absent',
  () => {
    const markup = renderToStaticMarkup(
      <InstanceDetailConfigToolsSection
        emptyState={<div>empty-tools</div>}
        workbench={null}
        configWebSearch={null}
        webSearchSharedDraft={null}
        selectedWebSearchProvider={null}
        selectedWebSearchProviderDraft={null}
        webSearchError={null}
        isSavingWebSearch={false}
        canEditConfigWebSearch={false}
        onSaveWebSearchConfig={() => undefined}
        onWebSearchSharedDraftChange={() => undefined}
        onWebSearchProviderDraftChange={() => undefined}
        onSelectedWebSearchProviderIdChange={() => undefined}
        configWebFetch={null}
        webFetchSharedDraft={null}
        webFetchFallbackDraft={{
          apiKeySource: '',
          baseUrl: '',
          advancedConfig: '',
        }}
        webFetchError={null}
        isSavingWebFetch={false}
        canEditConfigWebFetch={false}
        onSaveWebFetchConfig={() => undefined}
        onWebFetchSharedDraftChange={() => undefined}
        onWebFetchFallbackDraftChange={() => undefined}
        configWebSearchNativeCodex={null}
        webSearchNativeCodexDraft={null}
        webSearchNativeCodexError={null}
        isSavingWebSearchNativeCodex={false}
        canEditConfigWebSearchNativeCodex={false}
        onSaveWebSearchNativeCodexConfig={() => undefined}
        onWebSearchNativeCodexDraftChange={() => undefined}
        configXSearch={null}
        xSearchDraft={null}
        xSearchError={null}
        isSavingXSearch={false}
        canEditConfigXSearch={false}
        onSaveXSearchConfig={() => undefined}
        onXSearchDraftChange={() => undefined}
        configAuthCooldowns={null}
        authCooldownsDraft={null}
        authCooldownsError={null}
        isSavingAuthCooldowns={false}
        canEditConfigAuthCooldowns={false}
        onSaveAuthCooldownsConfig={() => undefined}
        onAuthCooldownsDraftChange={() => undefined}
        formatWorkbenchLabel={(value) => `label:${value}`}
        getDangerBadge={(status) => `danger:${status}`}
        getStatusBadge={(status) => `status:${status}`}
        t={(key) => key}
      />,
    );

    assert.match(markup, /empty-tools/);
  },
);
