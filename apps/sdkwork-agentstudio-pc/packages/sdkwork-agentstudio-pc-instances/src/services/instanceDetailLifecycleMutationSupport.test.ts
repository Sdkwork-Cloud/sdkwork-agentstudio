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

async function loadInstanceDetailLifecycleMutationSupportModule() {
  const moduleUrl = new URL('./instanceDetailLifecycleMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailLifecycleMutationSupport.ts to exist',
  );

  return import('./instanceDetailLifecycleMutationSupport.ts');
}

await runTest(
  'createInstanceDetailLifecycleMutationExecutors routes restart, stop, and start through the injected instance service surface',
  async () => {
    const { createInstanceDetailLifecycleMutationExecutors } =
      await loadInstanceDetailLifecycleMutationSupportModule();
    const calls: string[] = [];

    const executors = createInstanceDetailLifecycleMutationExecutors({
      instanceService: {
        restartInstance: async (instanceId) => {
          calls.push(`restart:${instanceId}`);
        },
        stopInstance: async (instanceId) => {
          calls.push(`stop:${instanceId}`);
        },
        startInstance: async (instanceId) => {
          calls.push(`start:${instanceId}`);
        },
      },
    });

    await executors.executeRestart('instance-157');
    await executors.executeStop('instance-157');
    await executors.executeStart('instance-157');

    assert.deepEqual(calls, [
      'restart:instance-157',
      'stop:instance-157',
      'start:instance-157',
    ]);
  },
);
