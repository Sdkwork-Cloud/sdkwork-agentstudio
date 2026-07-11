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

async function loadInstanceDetailConfigMutationSupportModule() {
  const moduleUrl = new URL('./instanceDetailConfigMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailConfigMutationSupport.ts to exist',
  );

  return import('./instanceDetailConfigMutationSupport.ts');
}

await runTest(
  'createInstanceDetailConfigMutationExecutors routes all config save executors through the injected instance service surface',
  async () => {
    const { createInstanceDetailConfigMutationExecutors } =
      await loadInstanceDetailConfigMutationSupportModule();
    const calls: string[] = [];

    const executors = createInstanceDetailConfigMutationExecutors({
      instanceService: {
        saveOpenClawWebSearchConfig: async (instanceId, input) => {
          calls.push(`webSearch:${instanceId}:${input.provider}`);
        },
        saveOpenClawXSearchConfig: async (instanceId, input) => {
          calls.push(`xSearch:${instanceId}:${input.apiKeySource}`);
        },
        saveOpenClawWebSearchNativeCodexConfig: async (instanceId, input) => {
          calls.push(`nativeCodex:${instanceId}:${input.provider}`);
        },
        saveOpenClawWebFetchConfig: async (instanceId, input) => {
          calls.push(`webFetch:${instanceId}:${input.strategy}`);
        },
        saveOpenClawAuthCooldownsConfig: async (instanceId, input) => {
          calls.push(`authCooldowns:${instanceId}:${input.cooldownSeconds}`);
        },
        saveOpenClawDreamingConfig: async (instanceId, input) => {
          calls.push(`dreaming:${instanceId}:${input.enabled}`);
        },
      },
    });

    await executors.webSearch.executeSave('instance-158', { provider: 'searxng' } as any);
    await executors.xSearch.executeSave('instance-158', { apiKeySource: 'env' } as any);
    await executors.webSearchNativeCodex.executeSave(
      'instance-158',
      { provider: 'native-codex' } as any,
    );
    await executors.webFetch.executeSave('instance-158', { strategy: 'requests' } as any);
    await executors.authCooldowns.executeSave(
      'instance-158',
      { cooldownSeconds: 30 } as any,
    );
    await executors.dreaming.executeSave('instance-158', { enabled: true } as any);

    assert.deepEqual(calls, [
      'webSearch:instance-158:searxng',
      'xSearch:instance-158:env',
      'nativeCodex:instance-158:native-codex',
      'webFetch:instance-158:requests',
      'authCooldowns:instance-158:30',
      'dreaming:instance-158:true',
    ]);
  },
);
