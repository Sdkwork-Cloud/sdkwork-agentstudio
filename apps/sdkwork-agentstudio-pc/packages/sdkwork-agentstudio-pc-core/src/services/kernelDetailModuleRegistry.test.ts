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

let kernelDetailModuleRegistryModule:
  | typeof import('./kernelDetailModuleRegistry.ts')
  | undefined;

try {
  kernelDetailModuleRegistryModule = await import('./kernelDetailModuleRegistry.ts');
} catch {
  kernelDetailModuleRegistryModule = undefined;
}

await runTest(
  'kernelDetailModuleRegistry exposes a reusable kernel detail module registry contract',
  () => {
    assert.ok(
      kernelDetailModuleRegistryModule,
      'Expected kernelDetailModuleRegistry.ts to exist',
    );
    assert.equal(
      typeof kernelDetailModuleRegistryModule?.createKernelDetailModuleRegistry,
      'function',
    );
  },
);

await runTest(
  'createKernelDetailModuleRegistry resolves known kernels and returns null for unsupported kernels',
  () => {
    const registry = kernelDetailModuleRegistryModule?.createKernelDetailModuleRegistry([
      {
        kernelId: 'openclaw',
        module: { pageId: 'openclaw' },
      },
      {
        kernelId: 'hermes',
        module: { pageId: 'hermes' },
      },
    ]);

    assert.deepEqual(registry?.listKernelIds(), ['openclaw', 'hermes']);
    assert.deepEqual(registry?.resolve('openclaw'), { pageId: 'openclaw' });
    assert.deepEqual(registry?.resolve('hermes'), { pageId: 'hermes' });
    assert.equal(registry?.resolve('custom'), null);
  },
);

await runTest(
  'createKernelDetailModuleRegistry rejects duplicate kernel registrations',
  () => {
    assert.throws(
      () =>
        kernelDetailModuleRegistryModule?.createKernelDetailModuleRegistry([
          {
            kernelId: 'openclaw',
            module: { pageId: 'openclaw-primary' },
          },
          {
            kernelId: 'openclaw',
            module: { pageId: 'openclaw-duplicate' },
          },
        ]),
      /Duplicate kernel detail module registration: openclaw/,
    );
  },
);
