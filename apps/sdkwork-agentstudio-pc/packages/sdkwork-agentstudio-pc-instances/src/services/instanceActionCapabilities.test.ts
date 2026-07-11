import assert from 'node:assert/strict';
import {
  DEFAULT_BUNDLED_OPENCLAW_VERSION,
  type StudioInstanceDetailRecord,
} from '@sdkwork/agentstudio-pc-types';
import type { Instance } from '../types/index.ts';
import {
  buildInstanceActionCapabilities,
  loadInstanceActionCapabilities,
} from './instanceActionCapabilities.ts';

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

function createInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    id: 'remote-openclaw',
    name: 'Remote OpenClaw',
    type: 'OpenClaw Gateway',
    iconType: 'server',
    status: 'offline',
    version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
    uptime: '-',
    ip: '127.0.0.1',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    isBuiltIn: false,
    ...overrides,
  };
}

function createDetail(
  overrides: Partial<StudioInstanceDetailRecord> = {},
): StudioInstanceDetailRecord {
  const lifecycle = {
    owner: 'remoteService' as const,
    startStopSupported: false,
    configWritable: false,
    lifecycleControllable: undefined,
    workbenchManaged: false,
    endpointObserved: false,
    notes: [],
    ...(overrides.lifecycle || {}),
  };

  return {
    instance: {
      id: 'remote-openclaw',
      name: 'Remote OpenClaw',
      runtimeKind: 'openclaw',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      status: 'offline',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      typeLabel: 'OpenClaw Gateway',
      host: '127.0.0.1',
      port: 21280,
      baseUrl: 'http://127.0.0.1:21280',
      websocketUrl: 'ws://127.0.0.1:21280',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: [],
      storage: {
        provider: 'localFile',
        namespace: 'remote-openclaw',
      },
      config: {
        port: '21280',
        sandbox: true,
        autoUpdate: true,
        logLevel: 'info',
        corsOrigins: '*',
      },
      createdAt: 1,
      updatedAt: 1,
      ...(overrides.instance || {}),
    },
    config: {
      port: '21280',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      ...(overrides.config || {}),
    },
    logs: '',
    health: {
      score: 50,
      status: 'offline',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle,
    storage: {
      status: 'planned',
      provider: 'localFile',
      namespace: 'remote-openclaw',
      durable: true,
      queryable: false,
      transactional: false,
      remote: true,
    },
    connectivity: {
      primaryTransport: 'openclawGatewayWs',
      endpoints: [],
    },
    observability: {
      status: 'limited',
      logAvailable: true,
      logPreview: [],
      metricsSource: 'runtime',
      lastSeenAt: null,
    },
    dataAccess: {
      routes: [],
    },
    artifacts: [],
    capabilities: [],
    officialRuntimeNotes: [],
    ...overrides,
  };
}

await runTest('built-in instances are never deletable even if lifecycle control exists', () => {
  const capabilities = buildInstanceActionCapabilities(
    createInstance({
      id: BUILT_IN_INSTANCE_ID,
      status: 'online',
      isBuiltIn: true,
    }),
    createDetail({
      instance: {
        id: BUILT_IN_INSTANCE_ID,
        isBuiltIn: true,
        deploymentMode: 'local-managed',
        status: 'online',
      },
      lifecycle: {
        owner: 'appManaged',
        startStopSupported: true,
        lifecycleControllable: true,
      },
    }),
  );

  assert.equal(capabilities.canDelete, false);
  assert.equal(capabilities.canSetActive, true);
  assert.equal(capabilities.canControlLifecycle, true);
  assert.equal(capabilities.canRestart, true);
  assert.equal(capabilities.canStop, true);
  assert.equal(capabilities.canStart, false);
});

await runTest('offline instances remain selectable as the active context', () => {
  const capabilities = buildInstanceActionCapabilities(
    createInstance({
      status: 'offline',
    }),
    createDetail({
      lifecycle: {
        startStopSupported: false,
        lifecycleControllable: false,
      },
    }),
  );

  assert.equal(capabilities.canDelete, true);
  assert.equal(capabilities.canSetActive, true);
  assert.equal(capabilities.canControlLifecycle, false);
  assert.equal(capabilities.canStart, false);
  assert.equal(capabilities.canStop, false);
  assert.equal(capabilities.canRestart, false);
});

await runTest('explicit lifecycleControllable false disables lifecycle actions', () => {
  const capabilities = buildInstanceActionCapabilities(
    createInstance({
      status: 'offline',
    }),
    createDetail({
      lifecycle: {
        startStopSupported: true,
        lifecycleControllable: false,
      },
    }),
  );

  assert.equal(capabilities.canDelete, true);
  assert.equal(capabilities.canSetActive, true);
  assert.equal(capabilities.canControlLifecycle, false);
  assert.equal(capabilities.canStart, false);
  assert.equal(capabilities.canStop, false);
  assert.equal(capabilities.canRestart, false);
});

await runTest('starting instances surface stop and restart actions instead of incorrectly offering start', () => {
  const capabilities = buildInstanceActionCapabilities(
    createInstance({
      status: 'starting',
    }),
    createDetail({
      instance: {
        status: 'starting',
      },
      lifecycle: {
        startStopSupported: true,
        lifecycleControllable: true,
      },
    }),
  );

  assert.equal(capabilities.canDelete, true);
  assert.equal(capabilities.canSetActive, true);
  assert.equal(capabilities.canControlLifecycle, true);
  assert.equal(capabilities.canStart, false);
  assert.equal(capabilities.canStop, true);
  assert.equal(capabilities.canRestart, true);
});

await runTest('syncing instances keep lifecycle controls in stop/restart mode instead of exposing start again', () => {
  const capabilities = buildInstanceActionCapabilities(
    createInstance({
      status: 'syncing',
    }),
    createDetail({
      instance: {
        status: 'syncing',
      },
      lifecycle: {
        startStopSupported: true,
        lifecycleControllable: true,
      },
    }),
  );

  assert.equal(capabilities.canDelete, true);
  assert.equal(capabilities.canSetActive, true);
  assert.equal(capabilities.canControlLifecycle, true);
  assert.equal(capabilities.canStart, false);
  assert.equal(capabilities.canStop, true);
  assert.equal(capabilities.canRestart, true);
});

await runTest('capability loading tolerates per-instance detail failures', async () => {
  const instances = [
    createInstance({
      id: BUILT_IN_INSTANCE_ID,
      status: 'online',
      isBuiltIn: true,
    }),
    createInstance({
      id: 'remote-openclaw',
      status: 'offline',
      isBuiltIn: false,
    }),
  ];

  const capabilitiesById = await loadInstanceActionCapabilities(instances, async (id) => {
    if (id === BUILT_IN_INSTANCE_ID) {
      return createDetail({
        instance: {
          id: BUILT_IN_INSTANCE_ID,
          isBuiltIn: true,
          deploymentMode: 'local-managed',
          status: 'online',
        },
        lifecycle: {
          owner: 'appManaged',
          startStopSupported: true,
          lifecycleControllable: true,
        },
      });
    }

    throw new Error('detail unavailable');
  });

  assert.deepEqual(capabilitiesById[BUILT_IN_INSTANCE_ID], {
    canDelete: false,
    canSetActive: true,
    canControlLifecycle: true,
    canStart: false,
    canStop: true,
    canRestart: true,
  });
  assert.deepEqual(capabilitiesById['remote-openclaw'], {
    canDelete: true,
    canSetActive: true,
    canControlLifecycle: false,
    canStart: false,
    canStop: false,
    canRestart: false,
  });
});
