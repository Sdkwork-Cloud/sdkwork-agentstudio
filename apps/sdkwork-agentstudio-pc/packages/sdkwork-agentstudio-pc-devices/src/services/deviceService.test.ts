import assert from 'node:assert/strict';
import { createDeviceService } from './deviceService.ts';

const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('getWorkspaceSnapshot selects the default OpenClaw instance and normalizes pairing records', async () => {
  const calls: Array<{ instanceId: string; method: string; args?: Record<string, unknown> }> = [];
  const service = createDeviceService({
    studioApi: {
      async listInstances() {
        return [
          {
            id: 'custom-http',
            name: 'Custom HTTP',
            runtimeKind: 'custom',
            isDefault: false,
            isBuiltIn: false,
            status: 'online',
          },
          {
            id: BUILT_IN_INSTANCE_ID,
            name: 'Local Built-In',
            runtimeKind: 'openclaw',
            isDefault: true,
            isBuiltIn: true,
            status: 'online',
          },
        ];
      },
    },
    gatewayClient: {
      async listDevicePairings(instanceId: string) {
        calls.push({ instanceId, method: 'listDevicePairings' });
        return {
          pending: [
            {
              requestId: 'req-1',
              deviceId: 'device-1',
              displayName: 'Warehouse iPad',
              role: 'operator',
              scopes: ['operator.read'],
              remoteIp: '10.0.0.10',
              ts: 1700000000000,
            },
          ],
          paired: [
            {
              deviceId: 'device-2',
              displayName: 'Android Node',
              roles: ['node'],
              scopes: ['node.invoke'],
              remoteIp: '10.0.0.20',
              approvedAtMs: 1700000001000,
              tokens: [
                {
                  role: 'node',
                  scopes: ['node.invoke'],
                  rotatedAtMs: 1700000002000,
                },
              ],
            },
          ],
        };
      },
    },
  });

  const snapshot = await service.getWorkspaceSnapshot();

  assert.deepEqual(calls, [{ instanceId: BUILT_IN_INSTANCE_ID, method: 'listDevicePairings' }]);
  assert.equal(snapshot.instance.id, BUILT_IN_INSTANCE_ID);
  assert.equal(snapshot.pending.length, 1);
  assert.equal(snapshot.pending[0]?.requestId, 'req-1');
  assert.equal(snapshot.pending[0]?.name, 'Warehouse iPad');
  assert.deepEqual(snapshot.pending[0]?.roles, ['operator']);
  assert.equal(snapshot.paired.length, 1);
  assert.equal(snapshot.paired[0]?.id, 'device-2');
  assert.equal(snapshot.paired[0]?.name, 'Android Node');
  assert.deepEqual(snapshot.paired[0]?.tokens.map((token) => token.role), ['node']);
});

await runTest('rotateToken delegates to the OpenClaw gateway for the resolved instance', async () => {
  const calls: Array<{ instanceId: string; method: string; args?: Record<string, unknown> }> = [];
  const service = createDeviceService({
    studioApi: {
      async listInstances() {
        return [
          {
            id: BUILT_IN_INSTANCE_ID,
            name: 'Local Built-In',
            runtimeKind: 'openclaw',
            isDefault: true,
            isBuiltIn: true,
            status: 'online',
          },
        ];
      },
    },
    gatewayClient: {
      async listDevicePairings() {
        return { pending: [], paired: [] };
      },
      async rotateDeviceToken(instanceId: string, args: Record<string, unknown>) {
        calls.push({ instanceId, method: 'rotateDeviceToken', args });
        return {
          token: 'tok-123',
          deviceId: args.deviceId,
          role: args.role,
          scopes: args.scopes,
          rotatedAtMs: 1700000003000,
        };
      },
    },
  });

  const result = await service.rotateToken({
    deviceId: 'device-2',
    role: 'operator',
    scopes: ['operator.read', 'operator.write'],
  });

  assert.deepEqual(calls, [
    {
      instanceId: BUILT_IN_INSTANCE_ID,
      method: 'rotateDeviceToken',
      args: {
        deviceId: 'device-2',
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
      },
    },
  ]);
  assert.equal(result.token, 'tok-123');
  assert.deepEqual(result.scopes, ['operator.read', 'operator.write']);
});

await runTest('getWorkspaceSnapshot fails truthfully when no OpenClaw instance is available', async () => {
  const service = createDeviceService({
    studioApi: {
      async listInstances() {
        return [
          {
            id: 'custom-http',
            name: 'Custom HTTP',
            runtimeKind: 'custom',
            isDefault: true,
            isBuiltIn: false,
            status: 'online',
          },
        ];
      },
    },
    gatewayClient: {},
  });

  await assert.rejects(
    () => service.getWorkspaceSnapshot(),
    /No OpenClaw instance is available for device pairing management/,
  );
});
