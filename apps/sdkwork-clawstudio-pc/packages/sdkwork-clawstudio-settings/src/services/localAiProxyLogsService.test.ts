import assert from 'node:assert/strict';
import type {
  LocalAiProxyMessageLogsQuery,
  LocalAiProxyRequestLogsQuery,
  PaginatedResult,
} from '@sdkwork/clawstudio-types';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('localAiProxyLogsService normalizes request and message log queries before delegating to the kernel bridge', async () => {
  const { createLocalAiProxyLogsService } = await import('./localAiProxyLogsService.ts');

  const calls: Array<{
    kind: string;
    query: LocalAiProxyRequestLogsQuery | LocalAiProxyMessageLogsQuery;
  }> = [];
  const emptyPage: PaginatedResult<any> = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
  };

  const service = createLocalAiProxyLogsService({
    kernelPlatformService: {
      listLocalAiProxyRequestLogs: async (query: LocalAiProxyRequestLogsQuery) => {
        calls.push({ kind: 'requests', query });
        return emptyPage;
      },
      listLocalAiProxyMessageLogs: async (query: LocalAiProxyMessageLogsQuery) => {
        calls.push({ kind: 'messages', query });
        return emptyPage;
      },
      updateLocalAiProxyMessageCapture: async (enabled: boolean) => ({
        enabled,
        updatedAt: 1743512000000,
      }),
      getInfo: async () =>
        ({
          localAiProxy: {
            messageCaptureEnabled: false,
          },
        }) as any,
    } as any,
  });

  await service.listRequestLogs({
    page: 0,
    page_size: 999,
    q: '  openai  ',
    providerId: ' openai ',
    status: 'all',
  });
  await service.listMessageLogs({
    page: -1,
    page_size: 0,
    q: '  summarize  ',
    providerId: ' openai ',
  });
  const settings = await service.getMessageCaptureSettings();
  const updated = await service.updateMessageCaptureSettings(true);

  assert.deepEqual(calls, [
    {
      kind: 'requests',
      query: {
        page: 1,
        page_size: 100,
        q: 'openai',
        providerId: 'openai',
      },
    },
    {
      kind: 'messages',
      query: {
        page: 1,
        page_size: 20,
        q: 'summarize',
        providerId: 'openai',
      },
    },
  ]);
  assert.deepEqual(settings, {
    enabled: false,
    updatedAt: null,
  });
  assert.deepEqual(updated, {
    enabled: true,
    updatedAt: 1743512000000,
  });
});

await runTest('localAiProxyLogsService preserves prompt, completion, and cache token aliases from kernel request logs', async () => {
  const { createLocalAiProxyLogsService } = await import('./localAiProxyLogsService.ts');

  const service = createLocalAiProxyLogsService({
    kernelPlatformService: {
      listLocalAiProxyRequestLogs: async (_query: LocalAiProxyRequestLogsQuery) => ({
        items: [
          {
            id: 'req_usage_1',
            createdAt: 1743513000000,
            routeId: 'provider-config-openai',
            routeName: 'OpenAI',
            providerId: 'openai',
            clientProtocol: 'openai-compatible',
            upstreamProtocol: 'openai-compatible',
            endpoint: '/v1/chat/completions',
            status: 'succeeded',
            modelId: 'gpt-5.4',
            baseUrl: 'https://api.openai.com/v1',
            totalDurationMs: 810,
            totalTokens: 12_313,
            promptTokens: 12_307,
            completionTokens: 6,
            inputTokens: 12_307,
            outputTokens: 6,
            cacheTokens: 4_096,
            requestMessageCount: 1,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
      }),
      listLocalAiProxyMessageLogs: async (_query: LocalAiProxyMessageLogsQuery) => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      }),
      updateLocalAiProxyMessageCapture: async (enabled: boolean) => ({
        enabled,
        updatedAt: 1743512000000,
      }),
      getInfo: async () =>
        ({
          localAiProxy: {
            messageCaptureEnabled: false,
          },
        }) as any,
    } as any,
  });

  const result = await service.listRequestLogs({});
  const record = result.items[0];

  assert.equal(record?.totalTokens, 12_313);
  assert.equal(record?.promptTokens, 12_307);
  assert.equal(record?.completionTokens, 6);
  assert.equal(record?.inputTokens, 12_307);
  assert.equal(record?.outputTokens, 6);
  assert.equal(record?.cacheTokens, 4_096);
});

await runTest('localAiProxyLogsService exposes local proxy runtime evidence for the API logs workspace', async () => {
  const { createLocalAiProxyLogsService } = await import('./localAiProxyLogsService.ts');

  const service = createLocalAiProxyLogsService({
    kernelPlatformService: {
      listLocalAiProxyRequestLogs: async (_query: LocalAiProxyRequestLogsQuery) => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      }),
      listLocalAiProxyMessageLogs: async (_query: LocalAiProxyMessageLogsQuery) => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      }),
      updateLocalAiProxyMessageCapture: async (enabled: boolean) => ({
        enabled,
        updatedAt: 1743512000000,
      }),
      getInfo: async () =>
        ({
          localAiProxy: {
            lifecycle: 'running',
            messageCaptureEnabled: true,
            observabilityDbPath:
              'C:/ProgramData/SdkWork/ClawStudio/state/local-ai-proxy-observability.sqlite',
            snapshotPath:
              'C:/ProgramData/SdkWork/ClawStudio/runtime/state/local-ai-proxy.snapshot.json',
            logPath: 'C:/ProgramData/SdkWork/ClawStudio/logs/app/local-ai-proxy.log',
          },
        }) as any,
    } as any,
  });

  const summary = await service.getRuntimeSummary();
  const captureSettings = await service.getMessageCaptureSettings();

  assert.deepEqual(summary, {
    lifecycle: 'running',
    observabilityDbPath:
      'C:/ProgramData/SdkWork/ClawStudio/state/local-ai-proxy-observability.sqlite',
    snapshotPath:
      'C:/ProgramData/SdkWork/ClawStudio/runtime/state/local-ai-proxy.snapshot.json',
    logPath: 'C:/ProgramData/SdkWork/ClawStudio/logs/app/local-ai-proxy.log',
  });
  assert.deepEqual(captureSettings, {
    enabled: true,
    updatedAt: null,
  });
});
