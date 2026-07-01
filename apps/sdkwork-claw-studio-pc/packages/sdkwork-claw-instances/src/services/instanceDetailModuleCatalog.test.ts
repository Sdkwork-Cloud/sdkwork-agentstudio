import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

let instanceDetailModuleCatalogModule:
  | typeof import('./instanceDetailModuleCatalog.ts')
  | undefined;
let kernelDetailModuleRegistryModule:
  | typeof import('../../../sdkwork-claw-core/src/services/kernelDetailModuleRegistry.ts')
  | undefined;

try {
  instanceDetailModuleCatalogModule = await import('./instanceDetailModuleCatalog.ts');
} catch {
  instanceDetailModuleCatalogModule = undefined;
}

try {
  kernelDetailModuleRegistryModule = await import(
    '../../../sdkwork-claw-core/src/services/kernelDetailModuleRegistry.ts'
  );
} catch {
  kernelDetailModuleRegistryModule = undefined;
}

await runTest(
  'instanceDetailModuleCatalog exposes the default supported kernel detail modules',
  async () => {
    const catalogSource = await readFile(new URL('./instanceDetailModuleCatalog.ts', import.meta.url), 'utf8');

    assert.match(catalogSource, /from '@sdkwork\/claw-core'/);
    assert.match(catalogSource, /export function listSupportedInstanceDetailModuleKernelIds\(/);
    assert.match(catalogSource, /export function resolveSupportedInstanceDetailModule\(/);

    if (instanceDetailModuleCatalogModule) {
      assert.equal(
        typeof instanceDetailModuleCatalogModule.resolveSupportedInstanceDetailModule,
        'function',
      );
      assert.equal(
        typeof instanceDetailModuleCatalogModule.listSupportedInstanceDetailModuleKernelIds,
        'function',
      );
      return;
    }

    assert.ok(
      kernelDetailModuleRegistryModule,
      'Expected kernelDetailModuleRegistry.ts to be importable for fallback catalog verification',
    );
  },
);

await runTest(
  'instanceDetailModuleCatalog resolves openclaw and hermes through the shared kernel detail registry as renderable modules',
  async () => {
    if (instanceDetailModuleCatalogModule) {
      assert.deepEqual(
        instanceDetailModuleCatalogModule.listSupportedInstanceDetailModuleKernelIds(),
        ['openclaw', 'hermes'],
      );
      const openclawModule =
        instanceDetailModuleCatalogModule.resolveSupportedInstanceDetailModule('openclaw');
      const hermesModule =
        instanceDetailModuleCatalogModule.resolveSupportedInstanceDetailModule('hermes');

      assert.equal(openclawModule?.chrome, 'sharedWorkbench');
      assert.ok(openclawModule?.DetailPage, 'Expected OpenClaw detail module to expose a page');

      assert.equal(hermesModule?.chrome, 'kernelOwned');
      assert.ok(hermesModule?.DetailPage, 'Expected Hermes detail module to expose a page');
      assert.equal(
        instanceDetailModuleCatalogModule.resolveSupportedInstanceDetailModule('custom'),
        null,
      );
      return;
    }

    const registrationsSource = await readFile(
      new URL('./instanceDetailModules/index.ts', import.meta.url),
      'utf8',
    );
    const openclawSource = await readFile(
      new URL('./instanceDetailModules/openClawInstanceDetailModule.ts', import.meta.url),
      'utf8',
    );
    const hermesSource = await readFile(
      new URL('./instanceDetailModules/hermesInstanceDetailModule.ts', import.meta.url),
      'utf8',
    );

    assert.match(registrationsSource, /openClawInstanceDetailModuleRegistration/);
    assert.match(registrationsSource, /hermesInstanceDetailModuleRegistration/);
    assert.match(
      registrationsSource,
      /instanceDetailModuleRegistrations = \[\s*openClawInstanceDetailModuleRegistration,\s*hermesInstanceDetailModuleRegistration,\s*\] as const/,
    );
    assert.match(openclawSource, /kernelId:\s*'openclaw'/);
    assert.match(openclawSource, /chrome:\s*'sharedWorkbench'/);
    assert.match(openclawSource, /OpenClawInstanceDetailPage/);
    assert.match(hermesSource, /kernelId:\s*'hermes'/);
    assert.match(hermesSource, /chrome:\s*'kernelOwned'/);
    assert.match(hermesSource, /HermesInstanceDetailPage/);
  },
);
