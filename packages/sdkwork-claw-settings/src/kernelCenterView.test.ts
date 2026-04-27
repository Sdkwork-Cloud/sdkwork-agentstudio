import assert from 'node:assert/strict';
import type { KernelCenterDashboard } from './services/kernelCenterService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createDashboard(
  endpointOverrides: Partial<KernelCenterDashboard['endpoint']> = {},
): KernelCenterDashboard {
  return {
    snapshot: null,
    info: null,
    statusTone: 'warning',
    statusTitle: 'Unavailable',
    statusSummary: 'Unavailable',
    host: {
      serviceManagerLabel: 'Unknown Host',
      ownershipLabel: 'Unknown Ownership',
      startupModeLabel: 'Manual Start',
      controlSocketLabel: null,
      controlSocketAvailable: false,
      serviceConfigPath: null,
    },
    endpoint: {
      preferredPort: 21280,
      activePort: 18845,
      baseUrl: 'http://127.0.0.1:18845',
      websocketUrl: 'ws://127.0.0.1:18845',
      usesDynamicPort: true,
      ...endpointOverrides,
    },
    localAiProxy: {
      lifecycle: 'Stopped',
      baseUrl: null,
      rootBaseUrl: null,
      openaiCompatibleBaseUrl: null,
      anthropicBaseUrl: null,
      geminiBaseUrl: null,
      activePort: null,
      loopbackOnly: true,
      defaultRouteName: null,
      defaultRoutes: [],
      upstreamBaseUrl: null,
      modelCount: 0,
      routeMetrics: [],
      routeTests: [],
      messageCaptureEnabled: false,
      observabilityDbPath: null,
      configFile: null,
      snapshotPath: null,
      logPath: null,
      lastError: null,
    },
    storage: {
      activeProfileId: null,
      activeProfileLabel: null,
      activeProfilePath: null,
      rootDir: null,
      profileCount: 0,
    },
    capabilities: {
      readyKeys: [],
      plannedKeys: [],
    },
    provenance: {
      installSource: null,
      platformLabel: 'unknown/unknown',
      runtimeVersion: null,
      nodeVersion: null,
      configFile: null,
      runtimeHomeDir: null,
      runtimeInstallDir: null,
    },
  };
}

await runTest('resolveEndpointPortValue returns null when dashboard is missing', async () => {
  const module = await import('./kernelCenterView.ts').catch(() => ({}));
  assert.equal(typeof module.resolveEndpointPortValue, 'function');
  assert.equal(module.resolveEndpointPortValue?.(null, 'preferredPort'), null);
  assert.equal(module.resolveEndpointPortValue?.(null, 'activePort'), null);
});

await runTest('resolveEndpointPortValue returns null when the endpoint port is missing', async () => {
  const module = await import('./kernelCenterView.ts').catch(() => ({}));
  assert.equal(typeof module.resolveEndpointPortValue, 'function');
  const dashboard = createDashboard({ preferredPort: null, activePort: null });

  assert.equal(module.resolveEndpointPortValue?.(dashboard, 'preferredPort'), null);
  assert.equal(module.resolveEndpointPortValue?.(dashboard, 'activePort'), null);
});

await runTest('resolveEndpointPortValue stringifies numeric endpoint ports', async () => {
  const module = await import('./kernelCenterView.ts').catch(() => ({}));
  assert.equal(typeof module.resolveEndpointPortValue, 'function');
  const dashboard = createDashboard({ preferredPort: 21280, activePort: 18845 });

  assert.equal(module.resolveEndpointPortValue?.(dashboard, 'preferredPort'), '21280');
  assert.equal(module.resolveEndpointPortValue?.(dashboard, 'activePort'), '18845');
});

await runTest('resolveLocalAiProxyPortValue returns null when dashboard is missing or the proxy port is absent', async () => {
  const module = await import('./kernelCenterView.ts').catch(() => ({}));
  assert.equal(typeof module.resolveLocalAiProxyPortValue, 'function');
  assert.equal(module.resolveLocalAiProxyPortValue?.(null), null);

  const dashboard = createDashboard();
  dashboard.localAiProxy.activePort = null;

  assert.equal(module.resolveLocalAiProxyPortValue?.(dashboard), null);
});

await runTest('resolveLocalAiProxyPortValue stringifies the active local proxy port', async () => {
  const module = await import('./kernelCenterView.ts').catch(() => ({}));
  assert.equal(typeof module.resolveLocalAiProxyPortValue, 'function');
  const dashboard = createDashboard();
  dashboard.localAiProxy.activePort = 21280;

  assert.equal(module.resolveLocalAiProxyPortValue?.(dashboard), '21280');
});

await runTest(
  'formatLocalAiProxyRouteMetricSummary formats route observability metrics into a stable summary string',
  async () => {
    const module = await import('./kernelCenterView.ts').catch(() => ({}));
    assert.equal(typeof module.formatLocalAiProxyRouteMetricSummary, 'function');

    const summary = module.formatLocalAiProxyRouteMetricSummary?.(
      {
        routeId: 'route-openai',
        clientProtocol: 'openai-compatible',
        upstreamProtocol: 'sdkwork',
        health: 'healthy',
        requestCount: 28,
        successCount: 27,
        failureCount: 1,
        rpm: 3.5,
        totalTokens: 9800,
        inputTokens: 6400,
        outputTokens: 3100,
        cacheTokens: 300,
        averageLatencyMs: 220,
        lastLatencyMs: 180,
        lastUsedAt: 1_743_100_400_000,
        lastError: 'upstream timeout',
      },
      {
        health: 'Healthy',
        requests: 'Requests',
        successes: 'Success',
        failures: 'Failure',
        rpm: 'RPM',
        totalTokens: 'Tokens',
        averageLatency: 'Avg',
        lastLatency: 'Last',
        lastUsedAt: 'Last Used',
        lastError: 'Error',
      },
    );

    assert.equal(
      summary,
      'Healthy | Requests 28 | Success 27 | Failure 1 | RPM 3.5 | Tokens 9800 | Avg 220 ms | Last 180 ms | Last Used 2025-03-27T18:33:20.000Z | Error upstream timeout',
    );
  },
);

await runTest(
  'formatLocalAiProxyRouteTestSummary formats the latest route test record into a stable summary string',
  async () => {
    const module = await import('./kernelCenterView.ts').catch(() => ({}));
    assert.equal(typeof module.formatLocalAiProxyRouteTestSummary, 'function');

    const summary = module.formatLocalAiProxyRouteTestSummary?.(
      {
        routeId: 'route-openai',
        status: 'passed',
        testedAt: 1_743_100_450_000,
        latencyMs: 260,
        checkedCapability: 'chat',
        modelId: 'gpt-4.1-mini',
        error: null,
      },
      {
        status: 'Passed',
        capability: 'Capability',
        testedAt: 'Tested',
        latency: 'Latency',
        model: 'Model',
        error: 'Error',
      },
    );

    assert.equal(
      summary,
      'Passed | Capability chat | Tested 2025-03-27T18:34:10.000Z | Latency 260 ms | Model gpt-4.1-mini',
    );
  },
);
