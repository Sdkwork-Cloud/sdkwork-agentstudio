import assert from 'node:assert/strict';
import type {
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/claw-infrastructure';
import { getSharedOpenClawGatewayClient } from './openClawGatewayClientRegistry.ts';

const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';

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

function createInstance(
  overrides: Partial<StudioInstanceRecord> = {},
): StudioInstanceRecord {
  return {
    id: BUILT_IN_INSTANCE_ID,
    name: 'Local Built-In',
    description: 'Packaged local OpenClaw kernel.',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: '2026.4.2',
    typeLabel: 'Built-In OpenClaw',
    host: '127.0.0.1',
    port: 18797,
    baseUrl: 'http://127.0.0.1:18797/openclaw',
    websocketUrl: 'ws://127.0.0.1:18797/openclaw/ws',
    cpu: 0,
    memory: 0,
    totalMemory: '0 GB',
    uptime: '0m',
    capabilities: ['chat'],
    storage: {
      provider: 'localFile',
      namespace: 'fixture',
    },
    config: {
      port: '18797',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18797/openclaw',
      websocketUrl: 'ws://127.0.0.1:18797/openclaw/ws',
      authToken: 'detail-token',
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
    ...overrides,
  };
}

function createDetail(
  instanceOverrides: Partial<StudioInstanceRecord> = {},
): StudioInstanceDetailRecord {
  const instance = createInstance(instanceOverrides);

  return {
    instance,
    config: {
      ...instance.config,
    },
    logs: '',
    health: {
      score: 100,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'appManaged',
      startStopSupported: true,
      configWritable: true,
      lifecycleControllable: true,
      workbenchManaged: true,
      endpointObserved: true,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: 'fixture',
      durable: true,
      queryable: false,
      transactional: false,
      remote: false,
    },
    connectivity: {
      primaryTransport: 'openclawGatewayWs',
      endpoints: [],
    },
    observability: {
      status: 'ready',
      logAvailable: true,
      logPreview: [],
      metricsSource: 'runtime',
      lastSeenAt: 1,
    },
    dataAccess: {
      routes: [],
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    consoleAccess: {
      kind: 'openclawControlUi',
      available: true,
      url: 'http://127.0.0.1:18797/openclaw/',
      autoLoginUrl:
        'http://127.0.0.1:18797/openclaw/?gatewayUrl=ws%3A%2F%2F127.0.0.1%3A18797%2Fopenclaw#token=detail-token',
      gatewayUrl: 'ws://127.0.0.1:18797/openclaw',
      authMode: 'token',
      authSource: 'configFile',
      installMethod: 'bundled',
      reason: null,
    },
    workbench: null,
  };
}

await runTest(
  'shared OpenClaw gateway client registry prefers live instance detail authority over stale instance snapshot endpoints',
  async () => {
    const originalBridge = getPlatformBridge();
    let client: { disconnect?: () => void } | null = null;

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(instanceId) {
          return createInstance({
            id: instanceId,
            port: 18871,
            baseUrl: 'http://127.0.0.1:18871/openclaw',
            websocketUrl: 'ws://127.0.0.1:18871/openclaw/ws',
            config: {
              ...createInstance().config,
              port: '18871',
              baseUrl: 'http://127.0.0.1:18871/openclaw',
              websocketUrl: 'ws://127.0.0.1:18871/openclaw/ws',
              authToken: 'snapshot-token',
            },
          });
        },
        async getInstanceDetail(instanceId) {
          return createDetail({
            id: instanceId,
          });
        },
      },
    });

    try {
      client = await getSharedOpenClawGatewayClient('authority-instance');
      const options = (client as any).options as {
        url?: string;
        authToken?: string | null;
        instanceId?: string;
      };

      assert.equal(options.instanceId, 'authority-instance');
      assert.equal(options.url, 'ws://127.0.0.1:18797/openclaw');
      assert.equal(options.authToken, 'detail-token');
    } finally {
      client?.disconnect?.();
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'shared OpenClaw gateway client registry falls back to the instance snapshot when detail authority is unavailable',
  async () => {
    const originalBridge = getPlatformBridge();
    let client: { disconnect?: () => void } | null = null;

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstance(instanceId) {
          return createInstance({
            id: instanceId,
            port: 18872,
            baseUrl: 'http://127.0.0.1:18872/openclaw',
            websocketUrl: 'ws://127.0.0.1:18872/openclaw/ws',
            config: {
              ...createInstance().config,
              port: '18872',
              baseUrl: 'http://127.0.0.1:18872/openclaw',
              websocketUrl: 'ws://127.0.0.1:18872/openclaw/ws',
              authToken: 'snapshot-token',
            },
          });
        },
        async getInstanceDetail() {
          return null;
        },
      },
    });

    try {
      client = await getSharedOpenClawGatewayClient('snapshot-fallback-instance');
      const options = (client as any).options as {
        url?: string;
        authToken?: string | null;
        instanceId?: string;
      };

      assert.equal(options.instanceId, 'snapshot-fallback-instance');
      assert.equal(options.url, 'ws://127.0.0.1:18872/openclaw');
      assert.equal(options.authToken, 'snapshot-token');
    } finally {
      client?.disconnect?.();
      configurePlatformBridge(originalBridge);
    }
  },
);
