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

let kernelConfigDiscoveryServiceModule:
  | typeof import('./kernelConfigDiscoveryService.ts')
  | undefined;

try {
  kernelConfigDiscoveryServiceModule = await import('./kernelConfigDiscoveryService.ts');
} catch {
  kernelConfigDiscoveryServiceModule = undefined;
}

await runTest(
  'kernelConfigDiscoveryService exposes the shared kernel-config discovery standard from core',
  () => {
    assert.ok(
      kernelConfigDiscoveryServiceModule,
      'Expected kernelConfigDiscoveryService.ts to exist',
    );
    assert.equal(
      typeof kernelConfigDiscoveryServiceModule?.listKernelInstallConfigPathCandidates,
      'function',
    );
    assert.equal(
      typeof kernelConfigDiscoveryServiceModule?.resolveKernelInstallConfigPath,
      'function',
    );
    assert.equal(
      typeof kernelConfigDiscoveryServiceModule?.kernelConfigDiscoveryService?.resolveInstallConfigPath,
      'function',
    );
  },
);
