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

async function loadInstanceDetailConsoleErrorSupportModule() {
  const moduleUrl = new URL('./instanceDetailConsoleErrorSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailConsoleErrorSupport.ts to exist',
  );

  return import('./instanceDetailConsoleErrorSupport.ts');
}

await runTest(
  'createInstanceDetailConsoleErrorReporters routes workbench, agent, files, and memories failures through the injected console surface',
  async () => {
    const { createInstanceDetailConsoleErrorReporters } =
      await loadInstanceDetailConsoleErrorSupportModule();
    const calls: unknown[][] = [];

    const errorReporters = createInstanceDetailConsoleErrorReporters({
      console: {
        error: (...args) => {
          calls.push(args);
        },
      },
    });

    errorReporters.reportWorkbenchLoadError('workbench-error');
    errorReporters.reportAgentWorkbenchLoadError('agent-error');
    errorReporters.reportInstanceFilesLoadError('files-error');
    errorReporters.reportInstanceMemoriesLoadError('memories-error');

    assert.deepEqual(calls, [
      ['Failed to fetch instance workbench:', 'workbench-error'],
      ['Failed to load agent workbench:', 'agent-error'],
      ['Failed to load instance files:', 'files-error'],
      ['Failed to load instance memories:', 'memories-error'],
    ]);
  },
);
