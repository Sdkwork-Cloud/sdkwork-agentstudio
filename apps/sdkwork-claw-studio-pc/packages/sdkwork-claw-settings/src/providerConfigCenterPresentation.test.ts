import assert from 'node:assert/strict';
import type { ProviderConfigRecord } from './services/providerConfigCenterService.ts';
import {
  formatLatestTestPresentation,
  formatRouteHealthLabel,
  formatRouteLatency,
  formatRouteUsageSummary,
  resolveProviderRouteHealth,
} from './providerConfigCenterPresentation.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const labels = {
  health: {
    healthy: 'Healthy',
    degraded: 'Degraded',
    failed: 'Failed',
    disabled: 'Disabled',
  },
  states: {
    notTested: 'Not tested',
  },
  table: {
    totalTokensShort: 'Total',
    inputTokensShort: 'In',
    outputTokensShort: 'Out',
    cacheTokensShort: 'Cache',
  },
  testStatus: {
    passed: 'Passed',
    failed: 'Failed',
  },
};

function createRecord(overrides: Partial<ProviderConfigRecord> = {}): ProviderConfigRecord {
  return {
    id: 'route-openai',
    name: 'OpenAI',
    providerId: 'openai',
    clientProtocol: 'openai-compatible',
    upstreamProtocol: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk_sdkwork_api_key',
    enabled: true,
    isDefault: false,
    managedBy: 'user',
    defaultModelId: 'gpt-5.4',
    reasoningModelId: 'o4-mini',
    embeddingModelId: 'text-embedding-3-large',
    models: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
    notes: '',
    exposeTo: ['openclaw'],
    config: {
      temperature: 0.2,
      topP: 1,
      maxTokens: 8192,
      timeoutMs: 60000,
      streaming: true,
    },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

await runTest('provider config center presentation formats usage with translated token labels', () => {
  const summary = formatRouteUsageSummary(
    createRecord({
      runtimeMetrics: {
        routeId: 'route-openai',
        clientProtocol: 'openai-compatible',
        upstreamProtocol: 'openai-compatible',
        health: 'healthy',
        requestCount: 4,
        successCount: 4,
        failureCount: 0,
        rpm: 2,
        totalTokens: 4567,
        inputTokens: 3456,
        outputTokens: 1000,
        cacheTokens: 111,
        averageLatencyMs: 345,
      },
    }),
    labels,
  );

  assert.deepEqual(summary, ['Total 4.6k', 'In 3.5k', 'Out 1.0k', 'Cache 111']);
});

await runTest('provider config center presentation formats latest test without hardcoded locale text', () => {
  const latestTest = formatLatestTestPresentation(
    createRecord({
      latestTest: {
        routeId: 'route-openai',
        status: 'passed',
        testedAt: Date.UTC(2026, 3, 2, 1, 2, 3),
        latencyMs: 212,
        checkedCapability: 'responses',
      },
    }),
    labels,
    {
      formatUpdatedAt: () => '4/2/2026, 9:02:03 AM',
    },
  );

  assert.equal(latestTest.label, 'Passed');
  assert.equal(latestTest.detail, '212 ms / 4/2/2026, 9:02:03 AM');
});

await runTest('provider config center presentation resolves health labels from route state', () => {
  const disabled = createRecord({ enabled: false });
  const degraded = createRecord();

  assert.equal(resolveProviderRouteHealth(disabled), 'disabled');
  assert.equal(resolveProviderRouteHealth(degraded), 'degraded');
  assert.equal(formatRouteHealthLabel('healthy', labels.health), 'Healthy');
  assert.equal(formatRouteLatency(null), '--');
});
