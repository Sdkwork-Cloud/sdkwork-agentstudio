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

async function loadInstanceDetailAgentMutationStateSupportModule() {
  const moduleUrl = new URL('./instanceDetailAgentMutationStateSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailAgentMutationStateSupport.ts to exist',
  );

  return import('./instanceDetailAgentMutationStateSupport.ts');
}

await runTest(
  'createInstanceDetailAgentMutationStateBindings routes dialog dismissal and agent-delete clearing through the injected page-owned setters',
  async () => {
    const { createInstanceDetailAgentMutationStateBindings } =
      await loadInstanceDetailAgentMutationStateSupportModule();
    const calls: string[] = [];

    const bindings = createInstanceDetailAgentMutationStateBindings({
      setIsAgentCreationWorkflowOpen: (value) => {
        calls.push(`workflow:${value}`);
      },
      setIsAgentDialogOpen: (value) => {
        calls.push(`dialog:${value}`);
      },
      setEditingAgentId: (value) => {
        calls.push(`editing:${value}`);
      },
      setAgentDeleteId: (value) => {
        calls.push(`delete:${value}`);
      },
    });

    bindings.dismissAgentDialog();
    bindings.clearAgentDeleteId();

    assert.deepEqual(calls, ['workflow:false', 'dialog:false', 'editing:null', 'delete:null']);
  },
);
