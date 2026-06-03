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

async function loadInstanceDetailConfigChannelMutationSupportModule() {
  const moduleUrl = new URL('./instanceDetailConfigChannelMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailConfigChannelMutationSupport.ts to exist',
  );

  return import('./instanceDetailConfigChannelMutationSupport.ts');
}

await runTest(
  'createInstanceDetailConfigChannelMutationExecutors routes save and toggle through the injected instance service surface',
  async () => {
    const { createInstanceDetailConfigChannelMutationExecutors } =
      await loadInstanceDetailConfigChannelMutationSupportModule();
    const calls: string[] = [];

    const executors = createInstanceDetailConfigChannelMutationExecutors({
      instanceService: {
        saveOpenClawChannelConfig: async (instanceId, channelId, values) => {
          calls.push(`save:${instanceId}:${channelId}:${values.botToken}`);
        },
        setOpenClawChannelEnabled: async (instanceId, channelId, enabled) => {
          calls.push(`toggle:${instanceId}:${channelId}:${enabled}`);
        },
      },
    });

    await executors.executeSaveConfig('instance-156', 'telegram', {
      botToken: '123456:telegram-token',
    });
    await executors.executeToggleEnabled('instance-156', 'telegram', true);

    assert.deepEqual(calls, [
      'save:instance-156:telegram:123456:telegram-token',
      'toggle:instance-156:telegram:true',
    ]);
  },
);
