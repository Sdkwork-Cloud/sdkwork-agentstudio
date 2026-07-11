import assert from 'node:assert/strict';

import {
  createCommandPaletteInstanceLoader,
  filterCommandPaletteCommands,
} from './commandPaletteState.ts';

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

await runTest('command palette search returns commands directly when query is empty', () => {
  const commands = [{ id: 'chat' }, { id: 'instances' }];
  let createSearchCalls = 0;

  const filtered = filterCommandPaletteCommands({
    search: '   ',
    commands,
    createSearch: () => {
      createSearchCalls += 1;
      return {
        search: () => [],
      };
    },
  });

  assert.equal(createSearchCalls, 0);
  assert.equal(filtered, commands);
});

await runTest('command palette search delegates to the search index when query exists', () => {
  const commands = [{ id: 'chat' }, { id: 'instances' }];
  const recordedQueries: string[] = [];

  const filtered = filterCommandPaletteCommands({
    search: 'inst',
    commands,
    createSearch: (input) => ({
      search: (query) => {
        recordedQueries.push(query);
        return input.filter((command) => command.id.includes(query));
      },
    }),
  });

  assert.deepEqual(recordedQueries, ['inst']);
  assert.deepEqual(filtered, [{ id: 'instances' }]);
});

await runTest('command palette instance loader reuses cache within ttl and deduplicates pending loads', async () => {
  let now = 1_000;
  let resolvePending: ((value: string[]) => void) | null = null;
  let loadCalls = 0;

  const loader = createCommandPaletteInstanceLoader({
    cacheTtlMs: 10_000,
    now: () => now,
    loadInstances: () => {
      loadCalls += 1;
      return new Promise<string[]>((resolve) => {
        resolvePending = resolve;
      });
    },
  });

  const first = loader.load();
  const second = loader.load();

  assert.equal(loadCalls, 1);
  assert.equal(first, second);

  resolvePending?.(['instance-a']);

  assert.deepEqual(await first, ['instance-a']);
  assert.deepEqual(await loader.load(), ['instance-a']);
  assert.equal(loadCalls, 1);

  now += 10_001;
  resolvePending = null;

  const third = loader.load();
  assert.equal(loadCalls, 2);
  resolvePending?.(['instance-b']);
  assert.deepEqual(await third, ['instance-b']);
});
