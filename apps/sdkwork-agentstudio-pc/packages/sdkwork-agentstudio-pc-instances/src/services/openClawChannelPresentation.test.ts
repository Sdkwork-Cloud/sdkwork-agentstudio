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

async function loadOpenClawChannelPresentationModule() {
  const moduleUrl = new URL('./openClawChannelPresentation.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected openClawChannelPresentation.ts to exist',
  );

  return import('./openClawChannelPresentation.ts');
}

await runTest(
  'buildReadonlyChannelWorkspaceItems clones setup steps and clears editable fields for summary channels',
  async () => {
    const { buildReadonlyChannelWorkspaceItems } = await loadOpenClawChannelPresentationModule();

    const items = buildReadonlyChannelWorkspaceItems([
      {
        id: 'telegram',
        name: 'Telegram',
        description: 'Runtime channel',
        status: 'connected',
        enabled: true,
        setupSteps: ['Configure bot'],
      },
    ] as any);

    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, 'telegram');
    assert.deepEqual(items[0]?.setupSteps, ['Configure bot']);
    assert.deepEqual(items[0]?.fields, []);
    assert.deepEqual(items[0]?.values, {});
  },
);

await runTest(
  'buildReadonlyChannelWorkspaceItems tolerates missing channels and missing setup steps',
  async () => {
    const { buildReadonlyChannelWorkspaceItems } = await loadOpenClawChannelPresentationModule();

    const items = buildReadonlyChannelWorkspaceItems([
      {
        id: 'slack',
        name: 'Slack',
        description: 'Fallback channel',
        status: 'disconnected',
        enabled: false,
      },
    ] as any);

    assert.equal(items.length, 1);
    assert.deepEqual(items[0]?.setupSteps, []);
    assert.deepEqual(items[0]?.fields, []);
    assert.deepEqual(items[0]?.values, {});
    assert.deepEqual(buildReadonlyChannelWorkspaceItems(null), []);
  },
);
