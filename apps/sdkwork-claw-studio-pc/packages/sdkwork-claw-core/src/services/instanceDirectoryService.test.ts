import assert from 'node:assert/strict';
import {
  createInstanceDirectoryService,
  resolvePreferredActiveInstanceId,
} from './instanceDirectoryService.ts';

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('instanceDirectoryService deduplicates rapid listInstances calls', async () => {
  let now = 1_000;
  let loadCount = 0;
  const service = createInstanceDirectoryService({
    cacheTtlMs: 1_000,
    now: () => now,
    loadInstances: async () => {
      loadCount += 1;
      return [
        {
          id: 'instance-alpha',
          name: 'Instance Alpha',
          host: '127.0.0.1',
          status: 'online',
          iconType: 'server',
        },
      ];
    },
  });

  const [first, second] = await Promise.all([service.listInstances(), service.listInstances()]);
  const third = await service.listInstances();

  assert.equal(loadCount, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);

  now += 1_500;
  await service.listInstances();

  assert.equal(loadCount, 2);
});

await runTest(
  'instanceDirectoryService refresh publishes the latest directory snapshot to subscribers',
  async () => {
    let version = 0;
    const snapshots: string[][] = [];
    const service = createInstanceDirectoryService({
      loadInstances: async () => {
        version += 1;
        return [
          {
            id: `instance-${version}`,
            name: `Instance ${version}`,
            host: `127.0.0.${version}`,
            status: 'online',
            iconType: 'server',
          },
        ];
      },
    });

    const unsubscribe = service.subscribe((instances) => {
      snapshots.push(instances.map((instance) => instance.id));
    });

    await service.listInstances();
    await service.refresh();
    unsubscribe();

    assert.deepEqual(snapshots, [['instance-1'], ['instance-2']]);
  },
);

await runTest(
  'resolvePreferredActiveInstanceId keeps the current selection, prefers an explicit target, then falls back to online and starting instances',
  async () => {
    const instances = [
      {
        id: 'instance-offline',
        status: 'offline',
      },
      {
        id: 'instance-online',
        status: 'online',
      },
      {
        id: 'instance-syncing',
        status: 'syncing',
      },
    ];

    assert.equal(
      resolvePreferredActiveInstanceId({
        instances,
        activeInstanceId: 'instance-online',
        preferredInstanceId: 'instance-syncing',
      }),
      'instance-syncing',
    );
    assert.equal(
      resolvePreferredActiveInstanceId({
        instances,
        activeInstanceId: 'instance-online',
      }),
      'instance-online',
    );
    assert.equal(
      resolvePreferredActiveInstanceId({
        instances,
        activeInstanceId: 'instance-missing',
        preferredInstanceId: 'instance-syncing',
      }),
      'instance-syncing',
    );
    assert.equal(
      resolvePreferredActiveInstanceId({
        instances,
        activeInstanceId: null,
      }),
      'instance-online',
    );
    assert.equal(
      resolvePreferredActiveInstanceId({
        instances: [
          {
            id: 'instance-starting',
            status: 'starting',
          },
          {
            id: 'instance-offline',
            status: 'offline',
          },
        ],
        activeInstanceId: null,
      }),
      'instance-starting',
    );
    assert.equal(
      resolvePreferredActiveInstanceId({
        instances: [],
        activeInstanceId: null,
      }),
      null,
    );
  },
);
