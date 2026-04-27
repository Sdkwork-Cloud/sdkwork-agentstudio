import assert from 'node:assert/strict';
import type { StudioInstanceRecord } from '@sdkwork/claw-types';
import { createUsageWorkspaceService } from './usageWorkspaceService.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
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

function buildInstance(
  overrides: Partial<StudioInstanceRecord> = {},
): StudioInstanceRecord {
  return {
    id: 'openclaw-default',
    name: 'OpenClaw Default',
    runtimeKind: 'openclaw',
    deploymentMode: 'remote',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: false,
    isDefault: true,
    iconType: 'server',
    version: '2026.4.5',
    typeLabel: 'OpenClaw Gateway',
    host: '127.0.0.1',
    port: 21280,
    baseUrl: 'http://127.0.0.1:21280',
    websocketUrl: 'ws://127.0.0.1:21280',
    cpu: 4,
    memory: 16,
    totalMemory: '32 GB',
    uptime: '2d',
    capabilities: ['chat', 'tasks'],
    storage: {
      provider: 'localFile',
      namespace: 'openclaw-default',
    },
    config: {
      port: '21280',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:21280',
      websocketUrl: 'ws://127.0.0.1:21280',
      authToken: 'token',
    },
    createdAt: Date.UTC(2026, 3, 1),
    updatedAt: Date.UTC(2026, 3, 1),
    lastSeenAt: Date.UTC(2026, 3, 1),
    ...overrides,
  };
}

function createStorageMock() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, String(value));
    },
    removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

await runTest(
  'usageWorkspaceService lists gateway-backed usage instances and prefers the default online gateway',
  async () => {
    const service = createUsageWorkspaceService({
      studioApi: {
        listInstances: async () => [
          buildInstance(),
          buildInstance({
            id: 'openclaw-secondary',
            name: 'OpenClaw Secondary',
            isDefault: false,
            status: 'offline',
          }),
          buildInstance({
            id: 'custom-node',
            name: 'Custom Node',
            runtimeKind: 'custom',
            transportKind: 'customHttp',
            typeLabel: 'Custom Runtime',
            baseUrl: null,
            websocketUrl: null,
            isDefault: false,
          }),
        ],
      },
      gatewayApi: {
        getGatewaySessionUsage: async () => ({ sessions: [], totals: {}, aggregates: {} }),
        getUsageCost: async () => ({ daily: [], totals: {} }),
        getGatewaySessionUsageTimeseries: async () => ({ points: [] }),
        getGatewaySessionUsageLogs: async () => ({ logs: [] }),
      },
    });

    const result = await service.listUsageInstances();

    assert.deepEqual(
      result.instances.map((instance) => instance.id),
      ['openclaw-default', 'openclaw-secondary'],
    );
    assert.equal(result.defaultInstanceId, 'openclaw-default');
  },
);

await runTest(
  'usageWorkspaceService includes non-OpenClaw instances when they expose the gateway usage transport',
  async () => {
    const service = createUsageWorkspaceService({
      studioApi: {
        listInstances: async () => [
          buildInstance({
            id: 'gateway-hermes',
            name: 'Hermes Gateway',
            runtimeKind: 'hermes',
            isDefault: true,
            isBuiltIn: true,
            deploymentMode: 'local-managed',
          }),
          buildInstance({
            id: 'openclaw-secondary',
            name: 'OpenClaw Secondary',
            isDefault: false,
            isBuiltIn: false,
          }),
          buildInstance({
            id: 'custom-http',
            name: 'Custom HTTP',
            runtimeKind: 'custom',
            transportKind: 'customHttp',
            baseUrl: null,
            websocketUrl: null,
            isDefault: false,
          }),
        ],
      },
      gatewayApi: {
        getGatewaySessionUsage: async () => ({ sessions: [], totals: {}, aggregates: {} }),
        getUsageCost: async () => ({ daily: [], totals: {} }),
        getGatewaySessionUsageTimeseries: async () => ({ points: [] }),
        getGatewaySessionUsageLogs: async () => ({ logs: [] }),
      },
    });

    const result = await service.listUsageInstances();

    assert.deepEqual(
      result.instances.map((instance) => instance.id),
      ['gateway-hermes', 'openclaw-secondary'],
    );
    assert.equal(result.instances[0]?.runtimeKind, 'hermes');
    assert.equal(result.defaultInstanceId, 'gateway-hermes');
  },
);

await runTest(
  'usageWorkspaceService falls back and remembers compatibility when sessions.usage rejects date interpretation params',
  async () => {
    const storage = createStorageMock();
    const usageCalls: Array<{ instanceId: string; args: Record<string, unknown> }> = [];
    const costCalls: Array<{ instanceId: string; args: Record<string, unknown> }> = [];
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;

    Date.prototype.getTimezoneOffset = () => -330;

    try {
      const createService = () =>
        createUsageWorkspaceService({
          storage: storage as unknown as Storage,
          studioApi: {
            listInstances: async () => [buildInstance()],
          },
          gatewayApi: {
            getGatewaySessionUsage: async (instanceId, args = {}) => {
              usageCalls.push({
                instanceId,
                args: args as Record<string, unknown>,
              });

              if ('mode' in args || 'utcOffset' in args) {
                throw new Error(
                  "invalid sessions.usage params: at root: unexpected property 'mode'; at root: unexpected property 'utcOffset'",
                );
              }

              return {
                updatedAt: Date.UTC(2026, 3, 7, 12, 0, 0),
                startDate: '2026-02-16',
                endDate: '2026-02-16',
                sessions: [
                  {
                    key: 'session-1',
                    label: 'Incident review',
                    updatedAt: Date.UTC(2026, 1, 16, 9, 0, 0),
                    usage: {
                      totalTokens: 1280,
                      totalCost: 2.56,
                      input: 640,
                      output: 640,
                      cacheRead: 0,
                      cacheWrite: 0,
                      inputCost: 1.28,
                      outputCost: 1.28,
                      cacheReadCost: 0,
                      cacheWriteCost: 0,
                      missingCostEntries: 0,
                    },
                  },
                ],
                totals: {
                  totalTokens: 1280,
                  totalCost: 2.56,
                  input: 640,
                  output: 640,
                  cacheRead: 0,
                  cacheWrite: 0,
                  inputCost: 1.28,
                  outputCost: 1.28,
                  cacheReadCost: 0,
                  cacheWriteCost: 0,
                  missingCostEntries: 0,
                },
                aggregates: {
                  messages: {
                    total: 4,
                    user: 2,
                    assistant: 2,
                    toolCalls: 0,
                    toolResults: 0,
                    errors: 0,
                  },
                  daily: [],
                  tools: {
                    totalCalls: 0,
                    uniqueTools: 0,
                    tools: [],
                  },
                  byModel: [],
                  byProvider: [],
                  byAgent: [],
                  byChannel: [],
                },
              };
            },
            getUsageCost: async (instanceId, args = {}) => {
              costCalls.push({
                instanceId,
                args: args as Record<string, unknown>,
              });

              return {
                updatedAt: Date.UTC(2026, 3, 7, 12, 0, 0),
                days: 1,
                daily: [
                  {
                    date: '2026-02-16',
                    totalTokens: 1280,
                    totalCost: 2.56,
                    input: 640,
                    output: 640,
                    cacheRead: 0,
                    cacheWrite: 0,
                    inputCost: 1.28,
                    outputCost: 1.28,
                    cacheReadCost: 0,
                    cacheWriteCost: 0,
                    missingCostEntries: 0,
                  },
                ],
                totals: {
                  totalTokens: 1280,
                  totalCost: 2.56,
                  input: 640,
                  output: 640,
                  cacheRead: 0,
                  cacheWrite: 0,
                  inputCost: 1.28,
                  outputCost: 1.28,
                  cacheReadCost: 0,
                  cacheWriteCost: 0,
                  missingCostEntries: 0,
                },
              };
            },
            getGatewaySessionUsageTimeseries: async () => ({ points: [] }),
            getGatewaySessionUsageLogs: async () => ({ logs: [] }),
          },
        });

      const firstService = createService();
      const firstSnapshot = await firstService.loadUsageSnapshot({
        instanceId: 'openclaw-default',
        gatewayUrl: 'ws://127.0.0.1:21280',
        startDate: '2026-02-16',
        endDate: '2026-02-16',
        timeZone: 'local',
      });

      assert.equal(firstSnapshot.compatibilityMode, 'legacy-no-date-interpretation');
      assert.deepEqual(usageCalls[0], {
        instanceId: 'openclaw-default',
        args: {
          startDate: '2026-02-16',
          endDate: '2026-02-16',
          mode: 'specific',
          utcOffset: 'UTC+5:30',
          limit: 1000,
          includeContextWeight: true,
        },
      });
      assert.deepEqual(costCalls[0], {
        instanceId: 'openclaw-default',
        args: {
          startDate: '2026-02-16',
          endDate: '2026-02-16',
          mode: 'specific',
          utcOffset: 'UTC+5:30',
        },
      });
      assert.deepEqual(usageCalls[1], {
        instanceId: 'openclaw-default',
        args: {
          startDate: '2026-02-16',
          endDate: '2026-02-16',
          limit: 1000,
          includeContextWeight: true,
        },
      });
      assert.deepEqual(costCalls[1], {
        instanceId: 'openclaw-default',
        args: {
          startDate: '2026-02-16',
          endDate: '2026-02-16',
        },
      });
      assert.equal(firstSnapshot.sessions.length, 1);

      const secondService = createService();
      const secondSnapshot = await secondService.loadUsageSnapshot({
        instanceId: 'openclaw-default',
        gatewayUrl: 'ws://127.0.0.1:21280',
        startDate: '2026-02-16',
        endDate: '2026-02-16',
        timeZone: 'local',
      });

      assert.equal(secondSnapshot.compatibilityMode, 'legacy-no-date-interpretation');
      assert.deepEqual(usageCalls[2], {
        instanceId: 'openclaw-default',
        args: {
          startDate: '2026-02-16',
          endDate: '2026-02-16',
          limit: 1000,
          includeContextWeight: true,
        },
      });
      assert.deepEqual(costCalls[2], {
        instanceId: 'openclaw-default',
        args: {
          startDate: '2026-02-16',
          endDate: '2026-02-16',
        },
      });
    } finally {
      Date.prototype.getTimezoneOffset = originalGetTimezoneOffset;
    }
  },
);

await runTest(
  'usageWorkspaceService keeps optional session detail calls non-fatal when one endpoint fails',
  async () => {
    const service = createUsageWorkspaceService({
      studioApi: {
        listInstances: async () => [buildInstance()],
      },
      gatewayApi: {
        getGatewaySessionUsage: async () => ({ sessions: [], totals: {}, aggregates: {} }),
        getUsageCost: async () => ({ daily: [], totals: {} }),
        getGatewaySessionUsageTimeseries: async () => {
          throw new Error('timeseries unavailable');
        },
        getGatewaySessionUsageLogs: async () => ({
          logs: [
            {
              timestamp: Date.UTC(2026, 3, 7, 12, 0, 0),
              role: 'assistant',
              content: 'Usage session completed.',
              tokens: 512,
              cost: 0.42,
            },
          ],
        }),
      },
    });

    const detail = await service.loadSessionDetail({
      instanceId: 'openclaw-default',
      sessionKey: 'session-1',
    });

    assert.deepEqual(detail.timeSeries.points, []);
    assert.deepEqual(detail.logs, [
      {
        timestamp: Date.UTC(2026, 3, 7, 12, 0, 0),
        role: 'assistant',
        content: 'Usage session completed.',
        tokens: 512,
        cost: 0.42,
      },
    ]);
  },
);
