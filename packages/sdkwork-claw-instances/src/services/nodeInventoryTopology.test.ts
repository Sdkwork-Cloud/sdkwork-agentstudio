import assert from 'node:assert/strict';
import type { StudioInstanceRecord } from '@sdkwork/claw-types';
import { isBuiltInLocalInstance, mapInstanceNode } from './nodeInventoryTopology.ts';

const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';

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

function createInstance(overrides: Partial<StudioInstanceRecord> = {}): StudioInstanceRecord {
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
    version: '2026.4.5',
    typeLabel: 'OpenClaw Gateway',
    host: '127.0.0.1',
    port: 18845,
    baseUrl: 'http://127.0.0.1:18845',
    websocketUrl: 'ws://127.0.0.1:18845',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '2h',
    capabilities: ['chat'],
    storage: {
      provider: 'localFile',
      namespace: 'claw-studio',
    },
    config: {
      port: '18845',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: 'http://localhost:3001',
      baseUrl: 'http://127.0.0.1:18845',
      websocketUrl: 'ws://127.0.0.1:18845',
    },
    createdAt: 1,
    updatedAt: 1,
    lastSeenAt: 1,
    ...overrides,
  };
}

await runTest('isBuiltInLocalInstance only accepts the default built-in managed runtime', () => {
  assert.equal(isBuiltInLocalInstance(createInstance()), true);
  assert.equal(
    isBuiltInLocalInstance(
      createInstance({
        id: 'local-phoenixclaw',
        name: 'Local PhoenixClaw',
        runtimeKind: 'phoenixclaw',
        transportKind: 'phoenixSocket',
        typeLabel: 'PhoenixClaw Runtime',
      }),
    ),
    true,
  );
  assert.equal(
    isBuiltInLocalInstance(
      createInstance({
        id: 'custom-local-managed',
        isBuiltIn: false,
        isDefault: false,
      }),
    ),
    false,
  );
});

await runTest(
  'mapInstanceNode keeps built-in local managed instances classified as the local primary node',
  () => {
    const node = mapInstanceNode(
      createInstance({
        id: 'local-phoenixclaw',
        name: 'Local PhoenixClaw',
        description: 'Managed future kernel with external runtimes.',
        runtimeKind: 'phoenixclaw',
        transportKind: 'phoenixSocket',
        version: '2026.4.13',
        typeLabel: 'PhoenixClaw Runtime',
        port: 9540,
        baseUrl: 'http://127.0.0.1:9540',
        websocketUrl: null,
      }),
      null,
    );

    assert.equal(node.kind, 'localPrimary');
    assert.equal(node.management, 'managed');
    assert.equal(node.topologyKind, 'localManagedNative');
  },
);

await runTest('mapInstanceNode keeps explicit remote instances attached', () => {
  const node = mapInstanceNode(
    createInstance({
      id: 'remote-attached',
      deploymentMode: 'remote',
      isBuiltIn: false,
      isDefault: false,
      host: 'gateway.example.com',
      baseUrl: 'https://gateway.example.com',
      websocketUrl: 'wss://gateway.example.com',
    }),
    null,
  );

  assert.equal(node.kind, 'attachedRemote');
  assert.equal(node.management, 'attached');
  assert.equal(node.topologyKind, 'remoteAttachedNode');
});

await runTest('mapInstanceNode does not classify custom local-managed metadata runtimes as managed remote', () => {
  const node = mapInstanceNode(
    createInstance({
      id: 'custom-local-managed',
      name: 'Custom Metadata Runtime',
      deploymentMode: 'local-managed',
      isBuiltIn: false,
      isDefault: false,
      host: '10.0.0.8',
      baseUrl: 'http://10.0.0.8:28789',
      websocketUrl: 'ws://10.0.0.8:28789',
    }),
    null,
  );

  assert.equal(node.kind, 'attachedRemote');
  assert.equal(node.management, 'attached');
  assert.equal(node.topologyKind, 'remoteAttachedNode');
});

await runTest('mapInstanceNode keeps loopback local-external instances local', () => {
  const node = mapInstanceNode(
    createInstance({
      id: 'local-external',
      deploymentMode: 'local-external',
      isBuiltIn: false,
      isDefault: false,
      host: '127.0.0.1',
      baseUrl: 'http://127.0.0.1:28790',
      websocketUrl: 'ws://127.0.0.1:28790',
    }),
    null,
  );

  assert.equal(node.kind, 'localExternal');
  assert.equal(node.management, 'attached');
  assert.equal(node.topologyKind, 'localExternal');
});
