import assert from 'node:assert/strict';
import { DEFAULT_BUNDLED_OPENCLAW_VERSION } from '@sdkwork/claw-types';
import { resolveInstanceChatRoute } from './instanceChatRouteService.ts';

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

await runTest('openclaw gateway instances prefer the native websocket route even when http metadata exists', () => {
  const route = resolveInstanceChatRoute({
    id: 'openclaw-local',
    name: 'OpenClaw Local',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: 'bundled',
    typeLabel: 'Built-In OpenClaw',
    host: '127.0.0.1',
    port: 21280,
    baseUrl: 'http://127.0.0.1:21280',
    websocketUrl: 'ws://127.0.0.1:21280',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health'],
    storage: {
      provider: 'localFile',
      namespace: 'claw-studio',
    },
    config: {
      port: '21280',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:21280',
      websocketUrl: 'ws://127.0.0.1:21280',
    },
    createdAt: 1,
    updatedAt: 1,
  });

  assert.equal(route.mode, 'instanceOpenClawGatewayWs');
  assert.equal(route.websocketUrl, 'ws://127.0.0.1:21280');
  assert.equal(route.endpoint, undefined);
});

await runTest(
  'built-in OpenClaw instances do not publish a gateway route before the runtime is online',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-local-offline',
      name: 'OpenClaw Local Offline',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-managed',
      transportKind: 'openclawGatewayWs',
      status: 'error',
      isBuiltIn: true,
      isDefault: true,
      iconType: 'server',
      version: 'bundled',
      typeLabel: 'Built-In OpenClaw',
      host: '127.0.0.1',
      port: 18871,
      baseUrl: 'http://127.0.0.1:18871',
      websocketUrl: 'ws://127.0.0.1:18871',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      config: {
        port: '18871',
        sandbox: true,
        autoUpdate: true,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'unsupported');
    assert.match(
      route.reason ?? '',
      /not online|start|running/i,
    );
  },
);

await runTest(
  'openclaw runtime instances still resolve to the gateway websocket route when legacy metadata labels them as customHttp',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-legacy-http',
      name: 'OpenClaw Legacy HTTP',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'customHttp',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '0.6.0',
      typeLabel: 'OpenClaw Legacy',
      host: '127.0.0.1',
      port: 18795,
      baseUrl: 'http://127.0.0.1:18795',
      websocketUrl: null,
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      config: {
        port: '18795',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18795',
        websocketUrl: null,
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'instanceOpenClawGatewayWs');
    assert.equal(route.websocketUrl, 'ws://127.0.0.1:18795');
    assert.equal(route.endpoint, undefined);
  },
);

await runTest(
  'openclaw runtime instances normalize legacy /ws websocket metadata and keep the gateway route even when transportKind is openaiHttp',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-legacy-openai',
      name: 'OpenClaw Legacy OpenAI',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'openaiHttp',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '0.6.0',
      typeLabel: 'OpenClaw Legacy',
      host: '127.0.0.1',
      port: 18796,
      baseUrl: 'http://127.0.0.1:18796/v1/chat/completions',
      websocketUrl: 'ws://127.0.0.1:18796/ws',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      config: {
        port: '18796',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18796/v1/chat/completions',
        websocketUrl: 'ws://127.0.0.1:18796/ws',
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'instanceOpenClawGatewayWs');
    assert.equal(route.websocketUrl, 'ws://127.0.0.1:18796');
    assert.equal(route.endpoint, 'http://127.0.0.1:18796/v1/chat/completions');
  },
);

await runTest(
  'openclaw runtime instances prefer the baseUrl-derived websocket when legacy websocket metadata points at a stale port',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-stale-websocket',
      name: 'OpenClaw Stale WebSocket',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '0.6.0',
      typeLabel: 'OpenClaw Legacy',
      host: '127.0.0.1',
      port: 18795,
      baseUrl: 'http://127.0.0.1:18795/v1/chat/completions',
      websocketUrl: 'ws://127.0.0.1:21280',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      config: {
        port: '18795',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18795/v1/chat/completions',
        websocketUrl: 'ws://127.0.0.1:21280',
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'instanceOpenClawGatewayWs');
    assert.equal(route.websocketUrl, 'ws://127.0.0.1:18795');
    assert.equal(route.endpoint, 'http://127.0.0.1:18795/v1/chat/completions');
  },
);

await runTest(
  'openclaw runtime instances still resolve the gateway route when migrated records omit the nested config object',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-missing-config',
      name: 'OpenClaw Missing Config',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: '0.6.0',
      typeLabel: 'OpenClaw Migrated',
      host: '127.0.0.1',
      port: 18801,
      baseUrl: 'http://127.0.0.1:18801/v1/chat/completions',
      websocketUrl: null,
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      createdAt: 1,
      updatedAt: 1,
    } as any);

    assert.equal(route.mode, 'instanceOpenClawGatewayWs');
    assert.equal(route.websocketUrl, 'ws://127.0.0.1:18801');
    assert.equal(route.endpoint, 'http://127.0.0.1:18801/v1/chat/completions');
  },
);

await runTest(
  'openclaw runtime instances preserve an explicit responses endpoint while still deriving the gateway websocket root',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-responses',
      name: 'OpenClaw Responses',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      typeLabel: 'OpenClaw Responses',
      host: '127.0.0.1',
      port: 18802,
      baseUrl: 'http://127.0.0.1:18802/v1/responses',
      websocketUrl: null,
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      config: {
        port: '18802',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18802/v1/responses',
        websocketUrl: null,
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'instanceOpenClawGatewayWs');
    assert.equal(route.websocketUrl, 'ws://127.0.0.1:18802');
    assert.equal(route.endpoint, 'http://127.0.0.1:18802/v1/responses');
  },
);

await runTest(
  'offline local-external openclaw instances do not publish a gateway route before runtime readiness converges',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-local-external-offline',
      name: 'OpenClaw Local External Offline',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-external',
      transportKind: 'openclawGatewayWs',
      status: 'offline',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      typeLabel: 'OpenClaw Local External',
      host: '127.0.0.1',
      port: 18811,
      baseUrl: 'http://127.0.0.1:18811',
      websocketUrl: 'ws://127.0.0.1:18811',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'localFile',
        namespace: 'claw-studio',
      },
      config: {
        port: '18811',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'http://127.0.0.1:18811',
        websocketUrl: 'ws://127.0.0.1:18811',
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'unsupported');
    assert.match(route.reason ?? '', /not online|offline|start|running/i);
  },
);

await runTest(
  'offline remote openclaw instances do not publish a gateway route before runtime readiness converges',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'openclaw-remote-offline',
      name: 'OpenClaw Remote Offline',
      runtimeKind: 'openclaw',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      status: 'error',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      typeLabel: 'OpenClaw Remote',
      host: 'openclaw.example.com',
      port: 443,
      baseUrl: 'https://openclaw.example.com',
      websocketUrl: 'wss://openclaw.example.com/ws',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat', 'health'],
      storage: {
        provider: 'remoteApi',
        namespace: 'claw-studio',
      },
      config: {
        port: '443',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'https://openclaw.example.com',
        websocketUrl: 'wss://openclaw.example.com/ws',
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'unsupported');
    assert.match(route.reason ?? '', /not online|offline|start|running/i);
  },
);

await runTest(
  'online custom gateway transport instances resolve to the gateway websocket route without depending on runtimeKind',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'custom-gateway-online',
      name: 'Custom Gateway Online',
      runtimeKind: 'custom',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: 'custom',
      typeLabel: 'Custom Gateway',
      host: 'custom.example.com',
      port: 443,
      baseUrl: 'https://custom.example.com/v1/chat/completions',
      websocketUrl: 'wss://custom.example.com/ws',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat'],
      storage: {
        provider: 'remoteApi',
        namespace: 'claw-studio',
      },
      config: {
        port: '443',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'https://custom.example.com/v1/chat/completions',
        websocketUrl: 'wss://custom.example.com/ws',
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'instanceOpenClawGatewayWs');
    assert.equal(route.endpoint, 'https://custom.example.com/v1/chat/completions');
    assert.equal(route.websocketUrl, 'wss://custom.example.com');
  },
);

await runTest(
  'offline custom gateway transport instances do not publish a gateway route before runtime readiness converges',
  () => {
    const route = resolveInstanceChatRoute({
      id: 'custom-gateway-offline',
      name: 'Custom Gateway Offline',
      runtimeKind: 'custom',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      status: 'offline',
      isBuiltIn: false,
      isDefault: false,
      iconType: 'server',
      version: 'custom',
      typeLabel: 'Custom Gateway',
      host: 'custom.example.com',
      port: 443,
      baseUrl: 'https://custom.example.com',
      websocketUrl: 'wss://custom.example.com/ws',
      cpu: 0,
      memory: 0,
      totalMemory: 'Unknown',
      uptime: '-',
      capabilities: ['chat'],
      storage: {
        provider: 'remoteApi',
        namespace: 'claw-studio',
      },
      config: {
        port: '443',
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        baseUrl: 'https://custom.example.com',
        websocketUrl: 'wss://custom.example.com/ws',
      },
      createdAt: 1,
      updatedAt: 1,
    });

    assert.equal(route.mode, 'unsupported');
    assert.match(route.reason ?? '', /not online|offline|start|running/i);
  },
);
