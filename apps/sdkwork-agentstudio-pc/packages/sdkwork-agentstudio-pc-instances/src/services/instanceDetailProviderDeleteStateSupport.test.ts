import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

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

async function loadInstanceDetailProviderDeleteStateSupportModule() {
  const moduleUrl = new URL('./instanceDetailProviderDeleteStateSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailProviderDeleteStateSupport.ts to exist',
  );

  return import('./instanceDetailProviderDeleteStateSupport.ts');
}

await runTest(
  'createInstanceDetailProviderDeleteStateBindings routes request and clear handlers through the injected page-owned setters',
  async () => {
    const { createInstanceDetailProviderDeleteStateBindings } =
      await loadInstanceDetailProviderDeleteStateSupportModule();
    const calls: string[] = [];

    const bindings = createInstanceDetailProviderDeleteStateBindings({
      setProviderDeleteId: (value) => {
        calls.push(`provider:${value}`);
      },
      setProviderModelDeleteId: (value) => {
        calls.push(`provider-model:${value}`);
      },
    });

    bindings.setProviderDeleteId('provider-161');
    bindings.setProviderModelDeleteId('model-161');
    bindings.clearProviderDeleteId();
    bindings.clearProviderModelDeleteId();

    assert.deepEqual(calls, [
      'provider:provider-161',
      'provider-model:model-161',
      'provider:null',
      'provider-model:null',
    ]);
  },
);
