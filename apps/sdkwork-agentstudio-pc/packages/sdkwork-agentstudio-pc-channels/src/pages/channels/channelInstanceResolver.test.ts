import assert from 'node:assert/strict';
import { resolveChannelsPageInstanceId } from './channelInstanceResolver.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'resolveChannelsPageInstanceId keeps the active instance when one is already selected',
  async () => {
    const selectedIds: Array<string | null> = [];
    let loadCount = 0;

    const resolved = await resolveChannelsPageInstanceId({
      activeInstanceId: 'instance-primary',
      listInstances: async () => {
        loadCount += 1;
        return [
          { id: 'instance-primary' },
          { id: 'instance-secondary' },
        ];
      },
      setActiveInstanceId(id) {
        selectedIds.push(id);
      },
    });

    assert.equal(resolved, 'instance-primary');
    assert.equal(loadCount, 0);
    assert.deepEqual(selectedIds, []);
  },
);

await runTest(
  'resolveChannelsPageInstanceId promotes the first available instance when the page boots without an active instance',
  async () => {
    const selectedIds: Array<string | null> = [];

    const resolved = await resolveChannelsPageInstanceId({
      activeInstanceId: null,
      listInstances: async () => [
        { id: 'managed-openclaw' },
        { id: 'remote-openclaw' },
      ],
      setActiveInstanceId(id) {
        selectedIds.push(id);
      },
    });

    assert.equal(resolved, 'managed-openclaw');
    assert.deepEqual(selectedIds, ['managed-openclaw']);
  },
);

await runTest(
  'resolveChannelsPageInstanceId keeps the page empty when there are no instances to resolve',
  async () => {
    const selectedIds: Array<string | null> = [];

    const resolved = await resolveChannelsPageInstanceId({
      activeInstanceId: null,
      listInstances: async () => [],
      setActiveInstanceId(id) {
        selectedIds.push(id);
      },
    });

    assert.equal(resolved, null);
    assert.deepEqual(selectedIds, []);
  },
);
