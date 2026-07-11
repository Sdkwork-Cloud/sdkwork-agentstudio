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

test('resolveBuiltInOpenClawInstance ignores a preferred id that does not describe a built-in OpenClaw instance', () => {
  const resolved = resolveBuiltInOpenClawInstance(
    [
      {
        id: 'remote-openclaw',
        name: 'Remote OpenClaw',
        runtimeKind: 'openclaw',
        deploymentMode: 'remote',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'https://openclaw.example.com',
        websocketUrl: 'wss://openclaw.example.com',
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
        baseUrl: 'http://127.0.0.1:21280',
        websocketUrl: 'ws://127.0.0.1:21280',
        isBuiltIn: true,
        isDefault: true,
      },
    ] as any,
    {
      preferredInstanceId: 'remote-openclaw',
      gatewayBaseUrl: 'http://127.0.0.1:21280',
      gatewayWebsocketUrl: 'ws://127.0.0.1:21280',
    },
  );

  assert.equal(resolved?.id, BUILT_IN_INSTANCE_ID);
});

test('resolveBuiltInOpenClawInstance returns null instead of treating an arbitrary instance as built-in', () => {
  const resolved = resolveBuiltInOpenClawInstance(
    [
      {
        id: 'remote-openclaw',
        name: 'Remote OpenClaw',
        runtimeKind: 'openclaw',
        deploymentMode: 'remote',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'https://openclaw.example.com',
        websocketUrl: 'wss://openclaw.example.com',
        isBuiltIn: false,
        isDefault: false,
      },
    ] as any,
    {
      gatewayBaseUrl: 'https://openclaw.example.com',
      gatewayWebsocketUrl: 'wss://openclaw.example.com',
    },
  );

  assert.equal(resolved, null);
});

test('resolveBuiltInOpenClawInstance ignores built-in non-OpenClaw kernels', () => {
  const resolved = resolveBuiltInOpenClawInstance(
    [
      {
        id: 'managed-hermes-primary',
        name: 'Built-In Hermes Primary',
        runtimeKind: 'hermes',
        deploymentMode: 'local-managed',
        transportKind: 'nativeService',
        status: 'online',
        baseUrl: 'http://127.0.0.1:24001',
        websocketUrl: null,
        isBuiltIn: true,
        isDefault: true,
      },
      {
        id: BUILT_IN_INSTANCE_ID,
        name: 'Built-In OpenClaw Primary',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'http://127.0.0.1:21280',
        websocketUrl: 'ws://127.0.0.1:21280',
        isBuiltIn: true,
        isDefault: false,
      },
    ] as any,
    {
      preferredInstanceId: 'managed-hermes-primary',
      gatewayBaseUrl: 'http://127.0.0.1:21280',
      gatewayWebsocketUrl: 'ws://127.0.0.1:21280',
    },
  );

  assert.equal(resolved?.id, BUILT_IN_INSTANCE_ID);
});

test('resolveBuiltInOpenClawInstance returns null when the only built-in kernel is not OpenClaw', () => {
  const resolved = resolveBuiltInOpenClawInstance(
    [
      {
        id: 'managed-hermes-primary',
        name: 'Built-In Hermes Primary',
        runtimeKind: 'hermes',
        deploymentMode: 'local-managed',
        transportKind: 'nativeService',
        status: 'online',
        baseUrl: 'http://127.0.0.1:24001',
        websocketUrl: null,
        isBuiltIn: true,
        isDefault: true,
      },
    ] as any,
    {
      preferredInstanceId: 'managed-hermes-primary',
      gatewayBaseUrl: 'http://127.0.0.1:24001',
    },
  );

  assert.equal(resolved, null);
});
