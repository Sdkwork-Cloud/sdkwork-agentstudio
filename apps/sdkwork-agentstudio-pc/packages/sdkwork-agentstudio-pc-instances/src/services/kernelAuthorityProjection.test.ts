import assert from 'node:assert/strict';

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

let kernelAuthorityProjectionModule:
  | typeof import('./kernelAuthorityProjection.ts')
  | undefined;

try {
  kernelAuthorityProjectionModule = await import('./kernelAuthorityProjection.ts');
} catch {
  kernelAuthorityProjectionModule = undefined;
}

await runTest('buildKernelAuthorityProjection keeps config control separate from deployment mode', () => {
  assert.ok(
    kernelAuthorityProjectionModule,
    'Expected kernelAuthorityProjection.ts to exist',
  );

  const authority = kernelAuthorityProjectionModule?.buildKernelAuthorityProjection({
    instance: {
      runtimeKind: 'openclaw',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      isBuiltIn: false,
      status: 'online',
    },
    lifecycle: {
      owner: 'remoteService',
      configWritable: true,
      startStopSupported: false,
      notes: [],
    },
  } as any);

  assert.deepEqual(authority, {
    owner: 'remoteManaged',
    controlPlane: 'remoteApi',
    lifecycleControl: false,
    configControl: true,
    upgradeControl: false,
    doctorSupport: true,
    migrationSupport: false,
    observable: true,
    writable: true,
  });
});

await runTest('buildKernelAuthorityProjection marks built-in app managed kernels as desktop-host controlled', () => {
  assert.ok(
    kernelAuthorityProjectionModule,
    'Expected kernelAuthorityProjection.ts to exist',
  );

  const authority = kernelAuthorityProjectionModule?.buildKernelAuthorityProjection({
    instance: {
      runtimeKind: 'openclaw',
      deploymentMode: 'local-managed',
      transportKind: 'openclawGatewayWs',
      isBuiltIn: true,
      status: 'offline',
    },
    lifecycle: {
      owner: 'appManaged',
      configWritable: true,
      startStopSupported: true,
      lifecycleControllable: true,
      endpointObserved: true,
      notes: [],
    },
  } as any);

  assert.deepEqual(authority, {
    owner: 'appManaged',
    controlPlane: 'desktopHost',
    lifecycleControl: true,
    configControl: true,
    upgradeControl: true,
    doctorSupport: true,
    migrationSupport: true,
    observable: true,
    writable: true,
  });
});
