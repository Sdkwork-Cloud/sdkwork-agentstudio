import assert from 'node:assert/strict';
import {
  buildBuiltInKernelPrimaryInstanceId,
  DEFAULT_BUNDLED_OPENCLAW_VERSION,
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
} from '@sdkwork/clawstudio-types';
import {
  BUILT_IN_OPENCLAW_STARTUP_REFRESH_INTERVAL_MS,
  hasPendingBuiltInOpenClawStartup,
  hasPendingBuiltInOpenClawWorkbenchStartup,
  shouldRefreshInstancesForBuiltInOpenClawStatusChange,
  shouldRefreshWorkbenchForBuiltInOpenClawStatusChange,
} from './instanceStartupRefreshSupport.ts';

const BUILT_IN_PHOENIXCLAW_INSTANCE_ID =
  buildBuiltInKernelPrimaryInstanceId('phoenixclaw') ?? 'managed-phoenixclaw-primary';

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

function createInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
    name: 'Built-In OpenClaw',
    type: 'OpenClaw',
    iconType: 'server',
    status: 'starting',
    version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
    uptime: '0m',
    ip: '127.0.0.1',
    cpu: 0,
    memory: 0,
    totalMemory: '16 GB',
    isBuiltIn: true,
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    ...overrides,
  };
}

function createWorkbench(overrides: Record<string, unknown> = {}) {
  const detail = (overrides.detail as { instance?: ReturnType<typeof createInstance> } | undefined) ?? {
    instance: createInstance(),
  };

  return {
    instance: (overrides.instance as ReturnType<typeof createInstance> | undefined)
      ?? detail.instance
      ?? createInstance(),
    detail,
    ...overrides,
  };
}

function createManagedFutureKernelLikeInstance(overrides: Record<string, unknown> = {}) {
  return createInstance({
    id: BUILT_IN_PHOENIXCLAW_INSTANCE_ID,
    name: 'Managed PhoenixClaw',
    type: 'PhoenixClaw',
    runtimeKind: 'phoenixclaw',
    transportKind: 'phoenixSocket',
    ...overrides,
  });
}

await runTest('instance startup refresh support exposes the built-in polling interval contract', () => {
  assert.equal(BUILT_IN_OPENCLAW_STARTUP_REFRESH_INTERVAL_MS, 1500);
});

await runTest('instance startup refresh support polls the registry while built-in OpenClaw is still starting', () => {
  assert.equal(
    hasPendingBuiltInOpenClawStartup([
      createInstance(),
      createInstance({
        id: 'remote-openclaw',
        isBuiltIn: false,
        deploymentMode: 'remote',
        status: 'online',
      }),
    ] as any),
    true,
  );
});

await runTest('instance startup refresh support does not treat future built-in kernels as OpenClaw startup', () => {
  assert.equal(
    hasPendingBuiltInOpenClawStartup([
      createManagedFutureKernelLikeInstance(),
      createInstance({
        id: 'remote-openclaw',
        isBuiltIn: false,
        deploymentMode: 'remote',
        status: 'online',
      }),
    ] as any),
    false,
  );
});

await runTest('instance startup refresh support ignores non-built-in or settled instances', () => {
  assert.equal(
    hasPendingBuiltInOpenClawStartup([
      createInstance({ isBuiltIn: false }),
      createInstance({ id: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID, status: 'online' }),
      createInstance({ id: 'managed-syncing-primary', status: 'syncing' }),
      createInstance({ id: 'managed-error-primary', status: 'error' }),
    ] as any),
    false,
  );
});

await runTest('instance startup refresh support polls the workbench while the built-in OpenClaw detail is still starting', () => {
  assert.equal(hasPendingBuiltInOpenClawWorkbenchStartup(createWorkbench() as any), true);
  assert.equal(
    hasPendingBuiltInOpenClawWorkbenchStartup(
      createWorkbench({
        detail: {
          instance: createInstance({
            status: 'online',
          }),
        },
      }) as any,
    ),
    false,
  );
});

await runTest('instance startup refresh support does not poll workbench for non-OpenClaw built-in kernels', () => {
  assert.equal(
    hasPendingBuiltInOpenClawWorkbenchStartup(
      createWorkbench({
        detail: {
          instance: createManagedFutureKernelLikeInstance(),
        },
      }) as any,
    ),
    false,
  );
});

await runTest('instance startup refresh support keeps polling the workbench when the normalized snapshot still shows startup while raw detail lags behind in syncing', () => {
  assert.equal(
    hasPendingBuiltInOpenClawWorkbenchStartup(
      createWorkbench({
        instance: createInstance({
          status: 'starting',
        }),
        detail: {
          instance: createInstance({
            status: 'syncing',
          }),
        },
      }) as any,
    ),
    true,
  );
});

await runTest('instance startup refresh support refreshes the list when the built-in OpenClaw changes status in the background', () => {
  assert.equal(
    shouldRefreshInstancesForBuiltInOpenClawStatusChange(
      [
        createInstance(),
        createInstance({
          id: 'remote-openclaw',
          isBuiltIn: false,
          deploymentMode: 'remote',
          status: 'online',
        }),
      ] as any,
      {
        instanceId: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
        status: 'online',
      } as any,
    ),
    true,
  );
  assert.equal(
    shouldRefreshInstancesForBuiltInOpenClawStatusChange(
      [
        createInstance({
          status: 'online',
        }),
      ] as any,
      {
        instanceId: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
        status: 'online',
      } as any,
    ),
    false,
  );
});

await runTest('instance startup refresh support ignores OpenClaw status events for future built-in kernels', () => {
  assert.equal(
    shouldRefreshInstancesForBuiltInOpenClawStatusChange(
      [
        createManagedFutureKernelLikeInstance(),
      ] as any,
      {
        instanceId: BUILT_IN_PHOENIXCLAW_INSTANCE_ID,
        status: 'online',
      } as any,
    ),
    false,
  );
});

await runTest('instance startup refresh support only refreshes the active workbench for the matching built-in OpenClaw event', () => {
  assert.equal(
    shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(
      STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
      createWorkbench() as any,
      {
        instanceId: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
        status: 'error',
      } as any,
    ),
    true,
  );
  assert.equal(
    shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(
      STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
      createWorkbench() as any,
      {
        instanceId: 'another-instance',
        status: 'online',
      } as any,
    ),
    false,
  );
  assert.equal(
    shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(
      'remote-openclaw',
      createWorkbench({
        detail: {
          instance: createInstance({
            id: 'remote-openclaw',
            isBuiltIn: false,
            deploymentMode: 'remote',
          }),
        },
      }) as any,
      {
        instanceId: 'remote-openclaw',
        status: 'online',
      } as any,
    ),
    false,
  );
});

await runTest('instance startup refresh support ignores active workbench refreshes for non-OpenClaw built-in kernels', () => {
  assert.equal(
    shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(
      BUILT_IN_PHOENIXCLAW_INSTANCE_ID,
      createWorkbench({
        detail: {
          instance: createManagedFutureKernelLikeInstance(),
        },
      }) as any,
      {
        instanceId: BUILT_IN_PHOENIXCLAW_INSTANCE_ID,
        status: 'online',
      } as any,
    ),
    false,
  );
});

await runTest('instance startup refresh support refreshes the active workbench when the normalized snapshot remains in startup even if raw detail still says syncing', () => {
  assert.equal(
    shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(
      STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
      createWorkbench({
        instance: createInstance({
          status: 'starting',
        }),
        detail: {
          instance: createInstance({
            status: 'syncing',
          }),
        },
      }) as any,
      {
        instanceId: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
        status: 'online',
      } as any,
    ),
    true,
  );
});
