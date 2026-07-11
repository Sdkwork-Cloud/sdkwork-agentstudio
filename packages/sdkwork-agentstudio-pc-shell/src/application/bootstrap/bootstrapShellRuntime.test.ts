import assert from 'node:assert/strict';
import {
  runBootstrapShellRuntime,
  type BootstrapShellRuntimeDependencies,
} from './bootstrapShellRuntime.ts';

function runTest(name: string, callback: () => Promise<void> | void) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createDependencies(
  platform: 'desktop' | 'web',
  events: string[],
): BootstrapShellRuntimeDependencies {
  return {
    getActivePlatform: () => platform,
    bootstrapHostedBrowserBridge: async () => {
      events.push('bootstrap-hosted-browser-bridge');
      return true;
    },
    ensureI18n: async () => {
      events.push('ensure-i18n');
    },
  };
}

await runTest('desktop shell bootstrap preserves the desktop platform bridge instead of reinstalling the hosted browser bridge', async () => {
  const events: string[] = [];

  await runBootstrapShellRuntime(createDependencies('desktop', events));

  assert.deepEqual(events, ['ensure-i18n']);
});

await runTest('web shell bootstrap still installs the hosted browser bridge before i18n', async () => {
  const events: string[] = [];

  await runBootstrapShellRuntime(createDependencies('web', events));

  assert.deepEqual(events, [
    'bootstrap-hosted-browser-bridge',
    'ensure-i18n',
  ]);
});
