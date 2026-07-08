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

async function loadInstanceDetailWorkbenchLoaderSupportModule() {
  const moduleUrl = new URL('./instanceDetailWorkbenchLoaderSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailWorkbenchLoaderSupport.ts to exist',
  );

  return import('./instanceDetailWorkbenchLoaderSupport.ts');
}

await runTest(
  'createInstanceDetailWorkbenchLoaderBindings routes agent, file, and memory loaders through the injected page-owned services',
  async () => {
    const { createInstanceDetailWorkbenchLoaderBindings } =
      await loadInstanceDetailWorkbenchLoaderSupportModule();
    const calls: string[] = [];

    const bindings = createInstanceDetailWorkbenchLoaderBindings({
      agentWorkbenchService: {
        getAgentWorkbench: async (input) => {
          calls.push(`agent:${input.instanceId}:${input.agentId}`);
          return { input } as any;
        },
      },
      instanceWorkbenchService: {
        listInstanceFiles: async (instanceId, agents) => {
          calls.push(`files:${instanceId}:${agents.length}`);
          return [{ id: 'file-162' }] as any;
        },
        listInstanceMemories: async (instanceId, agents) => {
          calls.push(`memory:${instanceId}:${agents.length}`);
          return [{ id: 'memory-162' }] as any;
        },
      },
    });

    const agentResult = await bindings.loadAgentWorkbench({
      instanceId: 'instance-162',
      workbench: { agents: [] } as any,
      agentId: 'agent-162',
    });
    const fileResult = await bindings.loadFiles(
      'instance-162',
      [{ agent: { id: 'agent-162' } }] as any,
    );
    const memoryResult = await bindings.loadMemories(
      'instance-162',
      [{ agent: { id: 'agent-162' } }] as any,
    );

    assert.deepEqual(calls, [
      'agent:instance-162:agent-162',
      'files:instance-162:1',
      'memory:instance-162:1',
    ]);
    assert.deepEqual(agentResult, {
      input: {
        instanceId: 'instance-162',
        workbench: { agents: [] },
        agentId: 'agent-162',
      },
    });
    assert.deepEqual(fileResult, [{ id: 'file-162' }]);
    assert.deepEqual(memoryResult, [{ id: 'memory-162' }]);
  },
);
