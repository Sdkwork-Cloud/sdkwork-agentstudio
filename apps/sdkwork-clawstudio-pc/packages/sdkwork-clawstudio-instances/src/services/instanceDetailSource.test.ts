import assert from 'node:assert/strict';
import { DEFAULT_BUNDLED_OPENCLAW_VERSION } from '@sdkwork/clawstudio-types';

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

let instanceDetailSourceModule:
  | typeof import('./instanceDetailSource.ts')
  | undefined;

try {
  instanceDetailSourceModule = await import('./instanceDetailSource.ts');
} catch {
  instanceDetailSourceModule = undefined;
}

await runTest(
  'instanceDetailSource exposes a stable structured source factory for kernel detail modules',
  async () => {
    assert.ok(instanceDetailSourceModule, 'Expected instanceDetailSource.ts to exist');
    assert.equal(typeof instanceDetailSourceModule?.createInstanceDetailSource, 'function');
  },
);

await runTest(
  'createInstanceDetailSource preserves instance identity, kernel metadata, and delegated shared loaders',
  async () => {
    const loadBaseDetailCalls: string[] = [];
    const loadModulePayloadCalls: string[] = [];
    const fakeInstance = {
      id: 'instance-hermes',
      name: 'Hermes Kernel',
      type: 'hermes',
      iconType: 'server',
      status: 'online',
      version: '1.0.0',
      uptime: '1m',
      ip: '127.0.0.1',
      cpu: 0,
      memory: 0,
      totalMemory: '0 GB',
    } as never;
    const fakeBaseDetail = {
      instance: {
        kernelId: 'hermes',
        instanceId: 'instance-hermes',
      },
    } as never;
    const fakeModulePayload = {
      kernelId: 'hermes',
      moduleType: 'hermes-runtime',
      navigation: [],
      sections: {},
      diagnostics: [],
      managementActions: [],
    } as never;
    const source = instanceDetailSourceModule?.createInstanceDetailSource({
      instanceId: 'instance-hermes',
      kernelId: 'hermes',
      chrome: 'kernelOwned',
      instance: fakeInstance,
      loadBaseDetail: async (instanceId: string) => {
        loadBaseDetailCalls.push(instanceId);
        return fakeBaseDetail;
      },
      loadModulePayload: async (instanceId: string) => {
        loadModulePayloadCalls.push(instanceId);
        return fakeModulePayload;
      },
    });

    assert.equal(source?.instanceId, 'instance-hermes');
    assert.equal(source?.kernelId, 'hermes');
    assert.equal(source?.chrome, 'kernelOwned');
    assert.equal(source?.instance, fakeInstance);
    assert.equal(await source?.loadBaseDetail(), fakeBaseDetail);
    assert.equal(await source?.loadModulePayload(), fakeModulePayload);
    assert.deepEqual(loadBaseDetailCalls, ['instance-hermes']);
    assert.deepEqual(loadModulePayloadCalls, ['instance-hermes']);
    assert.equal('loadWorkbench' in (source || {}), false);
  },
);

await runTest(
  'createInstanceDetailSource does not carry OpenClaw-specific workbench extensions',
  async () => {
    const fakeInstance = {
      id: 'instance-openclaw',
      name: 'OpenClaw Kernel',
      type: 'openclaw',
      iconType: 'server',
      status: 'online',
      version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      uptime: '1m',
      ip: '127.0.0.1',
      cpu: 0,
      memory: 0,
      totalMemory: '0 GB',
    } as never;
    const source = instanceDetailSourceModule?.createInstanceDetailSource({
      instanceId: 'instance-openclaw',
      kernelId: 'openclaw',
      chrome: 'sharedWorkbench',
      instance: fakeInstance,
      loadBaseDetail: async () => null,
      loadModulePayload: async () => null,
    });

    assert.equal(typeof instanceDetailSourceModule?.getOpenClawInstanceDetailSourceExtension, 'undefined');
    assert.equal('extensions' in (source || {}), false);
    assert.equal('loadWorkbench' in (source || {}), false);
  },
);
