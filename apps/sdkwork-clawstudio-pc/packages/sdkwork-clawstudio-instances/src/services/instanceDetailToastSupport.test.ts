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

async function loadInstanceDetailToastSupportModule() {
  const moduleUrl = new URL('./instanceDetailToastSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailToastSupport.ts to exist',
  );

  return import('./instanceDetailToastSupport.ts');
}

await runTest(
  'createInstanceDetailToastReporters routes success, error, and info messages through the injected toast surface',
  async () => {
    const { createInstanceDetailToastReporters } = await loadInstanceDetailToastSupportModule();
    const calls: string[] = [];

    const toastReporters = createInstanceDetailToastReporters({
      toast: {
        success: (message) => {
          calls.push(`success:${message}`);
        },
        error: (message) => {
          calls.push(`error:${message}`);
        },
        info: (message) => {
          calls.push(`info:${message}`);
        },
      },
    });

    toastReporters.reportSuccess('saved');
    toastReporters.reportError('failed');
    toastReporters.reportInfo('opened');

    assert.deepEqual(calls, ['success:saved', 'error:failed', 'info:opened']);
  },
);
