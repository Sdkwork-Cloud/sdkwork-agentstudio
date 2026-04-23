import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBuiltInOpenClawInstance } from './builtInOpenClawInstanceSelection.ts';

const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';

test('resolveBuiltInOpenClawInstance prefers the built-in OpenClaw instance that matches the active gateway urls', () => {
  const resolved = resolveBuiltInOpenClawInstance(
    [
      {
        id: 'unexpected-bundled-openclaw-id',
        name: 'Unexpected Bundled OpenClaw Id',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'http://127.0.0.1:19001',
        websocketUrl: 'ws://127.0.0.1:19001',
        isBuiltIn: false,
        isDefault: false,
      },
      {
        id: BUILT_IN_INSTANCE_ID,
        name: 'Built-In OpenClaw Primary',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        isBuiltIn: true,
        isDefault: true,
      },
    ] as any,
    {
      gatewayBaseUrl: 'http://127.0.0.1:18871',
      gatewayWebsocketUrl: 'ws://127.0.0.1:18871',
    },
  );

  assert.equal(resolved?.id, BUILT_IN_INSTANCE_ID);
});

test('resolveBuiltInOpenClawInstance honors an explicit preferred instance id when readiness evidence already resolved it', () => {
  const resolved = resolveBuiltInOpenClawInstance(
    [
      {
        id: BUILT_IN_INSTANCE_ID,
        name: 'Built-In OpenClaw Primary',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        isBuiltIn: true,
        isDefault: true,
      },
      {
        id: 'managed-openclaw-secondary',
        name: 'Built-In OpenClaw Secondary',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'http://127.0.0.1:18872',
        websocketUrl: 'ws://127.0.0.1:18872',
        isBuiltIn: true,
        isDefault: false,
      },
    ] as any,
    {
      preferredInstanceId: 'managed-openclaw-secondary',
      gatewayBaseUrl: 'http://127.0.0.1:18871',
      gatewayWebsocketUrl: 'ws://127.0.0.1:18871',
    },
  );

  assert.equal(resolved?.id, 'managed-openclaw-secondary');
});
