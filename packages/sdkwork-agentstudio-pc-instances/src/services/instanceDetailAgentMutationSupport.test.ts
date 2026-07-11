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

async function loadInstanceDetailAgentMutationSupportModule() {
  const moduleUrl = new URL('./instanceDetailAgentMutationSupport.ts', import.meta.url);

  assert.ok(existsSync(moduleUrl), 'expected instanceDetailAgentMutationSupport.ts to exist');

  return import('./instanceDetailAgentMutationSupport.ts');
}

await runTest(
  'createInstanceDetailAgentMutationExecutors routes create, update, and delete through the injected instance service surface',
  async () => {
    const { createInstanceDetailAgentMutationExecutors } =
      await loadInstanceDetailAgentMutationSupportModule();
    const calls: string[] = [];

    const executors = createInstanceDetailAgentMutationExecutors({
      instanceService: {
        createOpenClawAgent: async (instanceId, agent) => {
          calls.push(`create:${instanceId}:${agent.id}`);
        },
        updateOpenClawAgent: async (instanceId, agent) => {
          calls.push(`update:${instanceId}:${agent.id}`);
        },
        deleteOpenClawAgent: async (instanceId, agentId) => {
          calls.push(`delete:${instanceId}:${agentId}`);
        },
      },
    });

    await executors.executeCreate('instance-155', { id: 'ops-create' } as any);
    await executors.executeUpdate('instance-155', { id: 'ops-update' } as any);
    await executors.executeDelete('instance-155', 'ops-delete');

    assert.deepEqual(calls, [
      'create:instance-155:ops-create',
      'update:instance-155:ops-update',
      'delete:instance-155:ops-delete',
    ]);
  },
);
