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

async function loadInstanceDetailAgentSkillMutationSupportModule() {
  const moduleUrl = new URL('./instanceDetailAgentSkillMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailAgentSkillMutationSupport.ts to exist',
  );

  return import('./instanceDetailAgentSkillMutationSupport.ts');
}

await runTest(
  'createInstanceDetailAgentSkillMutationExecutors routes install, toggle, and remove through the injected agent skill management surface',
  async () => {
    const { createInstanceDetailAgentSkillMutationExecutors } =
      await loadInstanceDetailAgentSkillMutationSupportModule();
    const calls: string[] = [];

    const executors = createInstanceDetailAgentSkillMutationExecutors({
      agentSkillManagementService: {
        installSkill: async (input) => {
          calls.push(`install:${input.slug}`);
        },
        setSkillEnabled: async (input) => {
          calls.push(`toggle:${input.skillKey}:${input.enabled}`);
        },
        removeSkill: async (input) => {
          calls.push(`remove:${input.skillKey}`);
        },
      },
    });

    await executors.executeInstall({ slug: 'calendar' } as any);
    await executors.executeToggle({ skillKey: 'calendar', enabled: true } as any);
    await executors.executeRemove({ skillKey: 'calendar' } as any);

    assert.deepEqual(calls, [
      'install:calendar',
      'toggle:calendar:true',
      'remove:calendar',
    ]);
  },
);
