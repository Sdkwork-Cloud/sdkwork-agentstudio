import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectGatewayInstancesBestEffort } from './connectGatewayInstances.ts';

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

await runTest(
  'gateway preconnect keeps hydrating healthy instances when one route lookup fails',
  async () => {
    const routeModeById: Record<string, string> = {};
    const hydrated: string[] = [];
    const errors: Array<{ instanceId: string; message: string }> = [];

    await connectGatewayInstancesBestEffort({
      instanceIds: ['instance-a', 'instance-b', 'instance-c'],
      async resolveRouteMode(instanceId) {
        if (instanceId === 'instance-b') {
          throw new Error('connection refused');
        }

        return instanceId === 'instance-c'
          ? 'directLlm'
          : 'instanceOpenClawGatewayWs';
      },
      async hydrateGatewayInstance(instanceId) {
        hydrated.push(instanceId);
      },
      setRouteMode(instanceId, mode) {
        routeModeById[instanceId] = mode;
      },
      onError(instanceId, error) {
        errors.push({
          instanceId,
          message: error instanceof Error ? error.message : String(error),
        });
      },
    });

    assert.deepEqual(hydrated, ['instance-a']);
    assert.deepEqual(routeModeById, {
      'instance-a': 'instanceOpenClawGatewayWs',
      'instance-c': 'directLlm',
    });
    assert.deepEqual(errors, [
      {
        instanceId: 'instance-b',
        message: 'connection refused',
      },
    ]);
  },
);

await runTest(
  'gateway preconnect deduplicates instance ids before resolving routes',
  async () => {
    const resolved: string[] = [];

    await connectGatewayInstancesBestEffort({
      instanceIds: ['instance-a', 'instance-a', '', 'instance-b'],
      async resolveRouteMode(instanceId) {
        resolved.push(instanceId);
        return 'directLlm';
      },
      async hydrateGatewayInstance() {},
      setRouteMode() {},
    });

    assert.deepEqual(resolved, ['instance-a', 'instance-b']);
  },
);

await runTest(
  'gateway preconnect releases stale gateway clients when an instance no longer resolves to the gateway route',
  async () => {
    const released: string[] = [];

    await connectGatewayInstancesBestEffort({
      instanceIds: ['instance-a', 'instance-b'],
      async resolveRouteMode(instanceId) {
        return instanceId === 'instance-a' ? 'instanceOpenClawGatewayWs' : 'directLlm';
      },
      async hydrateGatewayInstance() {},
      async releaseGatewayInstance(instanceId) {
        released.push(instanceId);
      },
      setRouteMode() {},
    });

    assert.deepEqual(released, ['instance-b']);
  },
);

await runTest(
  'gateway preconnect derives gateway hydration from the shared route helper instead of embedding the OpenClaw gateway route literal',
  () => {
    const source = readFileSync(new URL('./connectGatewayInstances.ts', import.meta.url), 'utf8');

    assert.match(source, /isGatewayAuthoritativeRouteMode\(mode\)/);
    assert.doesNotMatch(source, /mode === 'instanceOpenClawGatewayWs'/);
  },
);
