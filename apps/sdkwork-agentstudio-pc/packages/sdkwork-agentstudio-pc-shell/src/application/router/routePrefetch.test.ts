import assert from 'node:assert/strict';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('route prefetch controller de-duplicates immediate prefetches for the same route prefix', async () => {
  const { createSidebarRoutePrefetchController } = await import('./routePrefetch.ts');

  const loadedPrefixes: string[] = [];
  const controller = createSidebarRoutePrefetchController({
    routePrefetchers: [
      ['/agents', async () => {
        loadedPrefixes.push('/agents');
      }],
    ],
  });

  controller.prefetch('/agents');
  controller.prefetch('/agents?tab=featured');
  await Promise.resolve();

  assert.deepEqual(loadedPrefixes, ['/agents']);
});

await runTest('route prefetch controller schedules hover prefetches and supports cancellation', async () => {
  const { createSidebarRoutePrefetchController } = await import('./routePrefetch.ts');

  const loadedPrefixes: string[] = [];
  const scheduledCallbacks = new Map<number, () => void>();
  let nextHandle = 1;

  const controller = createSidebarRoutePrefetchController({
    routePrefetchers: [
      ['/instances', async () => {
        loadedPrefixes.push('/instances');
      }],
    ],
    scheduleDelayMs: 120,
    schedule(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      scheduledCallbacks.set(handle, callback);
      return handle;
    },
    clearScheduled(handle) {
      scheduledCallbacks.delete(handle as number);
    },
  });

  controller.schedule('/instances');
  controller.schedule('/instances/abc');
  assert.equal(scheduledCallbacks.size, 1);

  controller.cancel('/instances');
  assert.equal(scheduledCallbacks.size, 0);

  controller.schedule('/instances');
  const callback = scheduledCallbacks.values().next().value as (() => void) | undefined;
  assert.equal(typeof callback, 'function');
  callback?.();
  await Promise.resolve();

  assert.deepEqual(loadedPrefixes, ['/instances']);
});

await runTest('route prefetch helpers resolve the startup route and batch-prefetch unique sidebar prefixes', async () => {
  const {
    createSidebarRoutePrefetchController,
    prefetchSidebarRoutes,
    resolveSidebarStartupRoute,
  } = await import('./routePrefetch.ts');

  assert.equal(resolveSidebarStartupRoute('/'), '/chat');
  assert.equal(resolveSidebarStartupRoute('/chat?tab=history'), '/chat');
  assert.equal(resolveSidebarStartupRoute('/instances/abc'), '/instances/abc');

  const loadedPrefixes: string[] = [];
  const controller = createSidebarRoutePrefetchController({
    routePrefetchers: [
      ['/chat', async () => {
        loadedPrefixes.push('/chat');
      }],
      ['/settings', async () => {
        loadedPrefixes.push('/settings');
      }],
    ],
  });

  prefetchSidebarRoutes(
    ['/', '/chat?tab=history', '/settings?tab=api', '/settings'],
    controller.prefetch,
  );
  await Promise.resolve();

  assert.deepEqual(loadedPrefixes, ['/chat', '/settings']);
});
