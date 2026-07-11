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

async function loadInstanceDetailReloadSupportModule() {
  const moduleUrl = new URL('./instanceDetailReloadSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailReloadSupport.ts to exist',
  );

  return import('./instanceDetailReloadSupport.ts');
}

await runTest(
  'createInstanceDetailWorkbenchReloadHandlers forwards explicit reload requests through the injected workbench loader',
  async () => {
    const { createInstanceDetailWorkbenchReloadHandlers } =
      await loadInstanceDetailReloadSupportModule();
    const calls: Array<{ instanceId: string; options?: { withSpinner?: boolean } }> = [];

    const reloadHandlers = createInstanceDetailWorkbenchReloadHandlers({
      loadWorkbench: (instanceId, options) => {
        calls.push({ instanceId, options });
        return `reloaded:${instanceId}:${String(options?.withSpinner)}`;
      },
    });

    const result = reloadHandlers.reloadWorkbench('instance-150', { withSpinner: false });

    assert.equal(result, 'reloaded:instance-150:false');
    assert.deepEqual(calls, [
      {
        instanceId: 'instance-150',
        options: { withSpinner: false },
      },
    ]);
  },
);

await runTest(
  'createInstanceDetailWorkbenchReloadHandlers exposes a default-spinner reload path for page-owned lifecycle runners',
  async () => {
    const { createInstanceDetailWorkbenchReloadHandlers } =
      await loadInstanceDetailReloadSupportModule();
    const calls: Array<{ instanceId: string; options?: { withSpinner?: boolean } }> = [];

    const reloadHandlers = createInstanceDetailWorkbenchReloadHandlers({
      loadWorkbench: (instanceId, options) => {
        calls.push({ instanceId, options });
      },
    });

    const result = reloadHandlers.reloadWorkbenchImmediately('instance-150');

    assert.equal(result, undefined);
    assert.deepEqual(calls, [
      {
        instanceId: 'instance-150',
        options: undefined,
      },
    ]);
  },
);

await runTest(
  'createInstanceDetailSilentWorkbenchReloadHandler routes the current instance through the injected workbench loader without a spinner',
  async () => {
    const { createInstanceDetailSilentWorkbenchReloadHandler } =
      await loadInstanceDetailReloadSupportModule();
    const calls: Array<{ instanceId: string; options?: { withSpinner?: boolean } }> = [];

    const reloadCurrentWorkbenchSilently = createInstanceDetailSilentWorkbenchReloadHandler({
      instanceId: 'instance-149',
      reloadWorkbench: (instanceId, options) => {
        calls.push({ instanceId, options });
        return 'reloaded';
      },
    });

    const result = reloadCurrentWorkbenchSilently();

    assert.equal(result, 'reloaded');
    assert.deepEqual(calls, [
      {
        instanceId: 'instance-149',
        options: { withSpinner: false },
      },
    ]);
  },
);

await runTest(
  'createInstanceDetailSilentWorkbenchReloadHandler becomes a safe no-op when no current instance id is available',
  async () => {
    const { createInstanceDetailSilentWorkbenchReloadHandler } =
      await loadInstanceDetailReloadSupportModule();
    let calls = 0;

    const reloadCurrentWorkbenchSilently = createInstanceDetailSilentWorkbenchReloadHandler({
      instanceId: null,
      reloadWorkbench: () => {
        calls += 1;
      },
    });

    const result = reloadCurrentWorkbenchSilently();

    assert.equal(result, undefined);
    assert.equal(calls, 0);
  },
);
