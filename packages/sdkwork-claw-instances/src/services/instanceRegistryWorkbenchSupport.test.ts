import assert from 'node:assert/strict';
import { DEFAULT_BUNDLED_OPENCLAW_VERSION } from '@sdkwork/claw-types';

const FUTURE_KERNEL_RUNTIME_VERSION = shiftOpenClawVersion(DEFAULT_BUNDLED_OPENCLAW_VERSION, 1);

function shiftOpenClawVersion(version: string, patchOffset: number) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(?:\d+|[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*))?$/u.exec(version);
  assert.ok(match, `Expected numeric OpenClaw test version, received ${version}`);
  const [, year, month, patch] = match;
  const shiftedPatch = Number(patch) + patchOffset;
  assert.ok(shiftedPatch >= 0, `Cannot derive OpenClaw test version before patch 0 from ${version}`);
  return `${year}.${month}.${shiftedPatch}`;
}

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

let registryWorkbenchSupportModule:
  | typeof import('./instanceRegistryWorkbenchSupport.ts')
  | undefined;

try {
  registryWorkbenchSupportModule = await import('./instanceRegistryWorkbenchSupport.ts');
} catch {
  registryWorkbenchSupportModule = undefined;
}

await runTest(
  'instanceRegistryWorkbenchSupport exposes shared registry-backed detail projection helpers',
  () => {
    assert.ok(
      registryWorkbenchSupportModule,
      'Expected instanceRegistryWorkbenchSupport.ts to exist',
    );
    assert.equal(
      typeof registryWorkbenchSupportModule?.buildRegistryBackedDetail,
      'function',
    );
    assert.equal(
      typeof registryWorkbenchSupportModule?.resolveRegistryKernelId,
      'function',
    );
  },
);

await runTest(
  'buildRegistryBackedDetail infers built-in OpenClaw runtime defaults and loopback connectivity from registry metadata',
  () => {
    const detail = registryWorkbenchSupportModule?.buildRegistryBackedDetail(
      {
        id: 'built-in-openclaw',
        name: 'Built-in OpenClaw',
        type: 'Built-in OpenClaw Runtime',
        iconType: 'box',
        status: 'online',
        version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
        uptime: '3h',
        ip: '127.0.0.1',
        cpu: 6,
        memory: 12,
        totalMemory: '32GB',
        isBuiltIn: true,
        baseUrl: 'http://127.0.0.1:17890',
        websocketUrl: 'ws://127.0.0.1:17890',
      } as any,
      {
        port: '17890',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      undefined,
      '',
    );

    assert.equal(detail?.instance.runtimeKind, 'openclaw');
    assert.equal(detail?.instance.deploymentMode, 'local-managed');
    assert.equal(detail?.instance.transportKind, 'openclawGatewayWs');
    assert.equal(detail?.lifecycle.owner, 'appManaged');
    assert.equal(detail?.storage.provider, 'localFile');
    assert.equal(detail?.storage.status, 'ready');
    assert.equal(detail?.storage.remote, false);
    assert.equal(detail?.connectivity.endpoints[0]?.exposure, 'loopback');
    assert.equal(detail?.connectivity.endpoints[0]?.auth, 'unknown');
    assert.deepEqual(detail?.instance.capabilities, [
      'chat',
      'health',
      'files',
      'memory',
      'tasks',
      'tools',
      'models',
    ]);
  },
);

await runTest(
  'buildRegistryBackedDetail preserves explicit remote OpenClaw transport and remote storage truth',
  () => {
    const detail = registryWorkbenchSupportModule?.buildRegistryBackedDetail(
      {
        id: 'remote-openclaw',
        name: 'Remote OpenClaw',
        type: 'Remote OpenClaw',
        iconType: 'server',
        status: 'online',
        version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
        uptime: '10h',
        ip: 'gateway.example.com',
        cpu: 10,
        memory: 22,
        totalMemory: '64GB',
        isBuiltIn: false,
        runtimeKind: 'openclaw',
        deploymentMode: 'remote',
        transportKind: 'openclawGatewayWs',
        baseUrl: 'https://gateway.example.com/claw/api',
        websocketUrl: 'wss://gateway.example.com/claw/ws',
        storage: {
          provider: 'remoteApi',
          namespace: 'gateway.example.com',
          endpoint: 'https://gateway.example.com/claw/api',
        },
      } as any,
      {
        port: '443',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      'remote-token',
      'remote fallback log',
    );

    assert.equal(detail?.instance.runtimeKind, 'openclaw');
    assert.equal(detail?.instance.deploymentMode, 'remote');
    assert.equal(detail?.instance.transportKind, 'openclawGatewayWs');
    assert.equal(detail?.lifecycle.owner, 'remoteService');
    assert.equal(detail?.storage.provider, 'remoteApi');
    assert.equal(detail?.storage.status, 'planned');
    assert.equal(detail?.storage.remote, true);
    assert.equal(detail?.connectivity.endpoints[0]?.exposure, 'remote');
    assert.equal(detail?.connectivity.endpoints[0]?.auth, 'token');
    assert.equal(detail?.observability.logAvailable, true);
    assert.deepEqual(detail?.observability.logPreview, ['remote fallback log']);
  },
);

await runTest(
  'buildRegistryBackedDetail infers Hermes runtime metadata and external-runtime notes from registry metadata',
  () => {
    const detail = registryWorkbenchSupportModule?.buildRegistryBackedDetail(
      {
        id: 'hermes-wsl2',
        name: 'Hermes via WSL2',
        type: 'Hermes Agent',
        iconType: 'server',
        status: 'online',
        version: FUTURE_KERNEL_RUNTIME_VERSION,
        uptime: '1h',
        ip: '127.0.0.1',
        cpu: 8,
        memory: 18,
        totalMemory: '64GB',
        isBuiltIn: false,
        deploymentMode: 'local-external',
        baseUrl: 'http://127.0.0.1:9540',
      } as any,
      {
        port: '9540',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      undefined,
      'hermes fallback log',
    );

    assert.equal(detail?.instance.runtimeKind, 'hermes');
    assert.equal(detail?.instance.transportKind, 'customHttp');
    assert.deepEqual(detail?.instance.capabilities, [
      'chat',
      'health',
      'files',
      'memory',
      'tools',
      'models',
    ]);
    assert.match(detail?.officialRuntimeNotes[0]?.title || '', /WSL2|Linux/i);
    assert.match(detail?.officialRuntimeNotes[1]?.content || '', /Python|uv/i);
  },
);

await runTest(
  'buildRegistryBackedDetail preserves explicit future-kernel runtime and transport identifiers instead of collapsing them to custom defaults',
  () => {
    const detail = registryWorkbenchSupportModule?.buildRegistryBackedDetail(
      {
        id: 'future-kernel',
        name: 'Future Kernel',
        type: 'PhoenixClaw Runtime',
        iconType: 'server',
        status: 'online',
        version: FUTURE_KERNEL_RUNTIME_VERSION,
        uptime: '30m',
        ip: 'future.example.com',
        cpu: 6,
        memory: 14,
        totalMemory: '48GB',
        isBuiltIn: false,
        runtimeKind: 'phoenixclaw',
        deploymentMode: 'remote',
        transportKind: 'phoenixSocket',
        baseUrl: 'https://future.example.com/api',
        websocketUrl: 'wss://future.example.com/ws',
      } as any,
      {
        port: '8443',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      'future-token',
      '',
    );

    assert.equal(detail?.instance.runtimeKind, 'phoenixclaw');
    assert.equal(detail?.instance.transportKind, 'phoenixSocket');
    assert.equal(detail?.instance.deploymentMode, 'remote');
    assert.deepEqual(detail?.instance.capabilities, ['chat', 'health', 'models']);
    assert.equal(detail?.officialRuntimeNotes.length, 0);
  },
);

await runTest(
  'buildRegistryBackedDetail infers future-kernel identity from registry type metadata and preserves websocket-only transport fallback',
  () => {
    const detail = registryWorkbenchSupportModule?.buildRegistryBackedDetail(
      {
        id: 'future-kernel-inferred',
        name: 'Future Kernel Inferred',
        type: 'Phoenix Claw Runtime',
        iconType: 'server',
        status: 'online',
        version: FUTURE_KERNEL_RUNTIME_VERSION,
        uptime: '30m',
        ip: 'future.example.com',
        cpu: 6,
        memory: 14,
        totalMemory: '48GB',
        isBuiltIn: false,
        deploymentMode: 'remote',
        websocketUrl: 'wss://future.example.com/ws',
      } as any,
      {
        port: '8443',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      'future-token',
      '',
    );

    assert.equal(detail?.instance.runtimeKind, 'phoenixclaw');
    assert.equal(detail?.instance.transportKind, 'customWs');
    assert.equal(detail?.connectivity.primaryTransport, 'customWs');
    assert.equal(detail?.connectivity.endpoints[0]?.kind, 'websocket');
    assert.equal(detail?.officialRuntimeNotes.length, 0);
  },
);

await runTest(
  'buildRegistryBackedDetail normalizes syncing registry status into starting so detail startup state matches the shared workbench model',
  () => {
    const detail = registryWorkbenchSupportModule?.buildRegistryBackedDetail(
      {
        id: 'built-in-openclaw-syncing',
        name: 'Built-in OpenClaw Syncing',
        type: 'Built-in OpenClaw Runtime',
        iconType: 'box',
        status: 'syncing',
        version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
        uptime: '30s',
        ip: '127.0.0.1',
        cpu: 6,
        memory: 12,
        totalMemory: '32GB',
        isBuiltIn: true,
        baseUrl: 'http://127.0.0.1:17890',
        websocketUrl: 'ws://127.0.0.1:17890',
      } as any,
      {
        port: '17890',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      undefined,
      '',
    );

    assert.equal(detail?.instance.status, 'starting');
  },
);

await runTest(
  'resolveRegistryKernelId infers a future kernel id from a branded kernel descriptor even when it does not end with claw',
  () => {
    const runtimeKind = registryWorkbenchSupportModule?.resolveRegistryKernelId({
      id: 'future-kernel-generic',
      name: 'Future Kernel Generic',
      type: 'Nova Kernel Runtime',
      iconType: 'server',
      status: 'online',
      version: FUTURE_KERNEL_RUNTIME_VERSION,
      uptime: '10m',
      ip: 'future.example.com',
      cpu: 4,
      memory: 8,
      totalMemory: '16GB',
      isBuiltIn: false,
    } as any);

    assert.equal(runtimeKind, 'nova');
  },
);

await runTest(
  'resolveRegistryKernelId does not misclassify deployment or platform adjectives as a kernel id',
  () => {
    const runtimeKind = registryWorkbenchSupportModule?.resolveRegistryKernelId({
      id: 'future-kernel-unknown',
      name: 'Unknown Runtime',
      type: 'Remote Linux Service',
      iconType: 'server',
      status: 'offline',
      version: FUTURE_KERNEL_RUNTIME_VERSION,
      uptime: '0m',
      ip: 'future.example.com',
      cpu: 0,
      memory: 0,
      totalMemory: '0GB',
      isBuiltIn: false,
    } as any);

    assert.equal(runtimeKind, 'custom');
  },
);
