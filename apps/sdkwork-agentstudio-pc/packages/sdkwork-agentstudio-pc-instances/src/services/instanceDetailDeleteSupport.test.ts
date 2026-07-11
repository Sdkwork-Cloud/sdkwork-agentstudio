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

async function loadInstanceDetailDeleteSupportModule() {
  const moduleUrl = new URL('./instanceDetailDeleteSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailDeleteSupport.ts to exist',
  );

  return import('./instanceDetailDeleteSupport.ts');
}

await runTest(
  'createInstanceDetailDeleteHandlerBindings routes confirm, delete, and instance-list navigation through injected page-owned authorities',
  async () => {
    const { createInstanceDetailDeleteHandlerBindings } =
      await loadInstanceDetailDeleteSupportModule();
    const calls: string[] = [];

    const bindings = createInstanceDetailDeleteHandlerBindings({
      confirmDelete: (message) => {
        calls.push(`confirm:${message}`);
        return true;
      },
      navigate: (path) => {
        calls.push(`navigate:${path}`);
      },
      instanceService: {
        deleteInstance: async (instanceId) => {
          calls.push(`delete:${instanceId}`);
        },
      },
    });

    const confirmed = bindings.confirmDelete('Delete instance?');
    await bindings.executeDelete('instance-159');
    bindings.navigateToInstances();

    assert.equal(confirmed, true);
    assert.deepEqual(calls, [
      'confirm:Delete instance?',
      'delete:instance-159',
      'navigate:/instances',
    ]);
  },
);
