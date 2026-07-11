import assert from 'node:assert/strict';

import {
  createInitialDashboardDeferredSections,
  DASHBOARD_DEFERRED_SECTION_BATCHES,
  mergeDashboardDeferredSections,
  scheduleDashboardSectionHydration,
  type DashboardDeferredSectionState,
} from './dashboardSectionHydration.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('dashboard section hydration starts with all deferred sections disabled', () => {
  assert.deepEqual(createInitialDashboardDeferredSections(), {
    revenueAnalytics: false,
    tokenAnalytics: false,
    activityWorkbench: false,
  } satisfies DashboardDeferredSectionState);
});

runTest('dashboard section hydration merges only the requested batch', () => {
  const next = mergeDashboardDeferredSections(createInitialDashboardDeferredSections(), {
    tokenAnalytics: true,
  });

  assert.deepEqual(next, {
    revenueAnalytics: false,
    tokenAnalytics: true,
    activityWorkbench: false,
  } satisfies DashboardDeferredSectionState);
});

runTest('dashboard section hydration schedules batches in order and supports cancellation', () => {
  const recordedDelays: number[] = [];
  const queued: Array<() => void> = [];
  const appliedStates: DashboardDeferredSectionState[] = [];
  const cancelledHandles: number[] = [];

  const cancel = scheduleDashboardSectionHydration({
    startDelayMs: 40,
    batchDelayMs: 25,
    scheduleTimeout: (callback, delay) => {
      recordedDelays.push(delay);
      queued.push(callback);
      return recordedDelays.length;
    },
    clearScheduledTimeout: (handle) => {
      cancelledHandles.push(handle);
    },
    onBatchReady: (batch) => {
      appliedStates.push(batch);
    },
  });

  assert.deepEqual(recordedDelays, [40]);

  queued.shift()?.();
  assert.deepEqual(appliedStates, [
    {
      revenueAnalytics: true,
      tokenAnalytics: false,
      activityWorkbench: false,
    },
  ]);
  assert.deepEqual(recordedDelays, [40, 25]);

  queued.shift()?.();
  assert.deepEqual(appliedStates, [
    {
      revenueAnalytics: true,
      tokenAnalytics: false,
      activityWorkbench: false,
    },
    {
      revenueAnalytics: false,
      tokenAnalytics: true,
      activityWorkbench: false,
    },
  ]);
  assert.deepEqual(recordedDelays, [40, 25, 25]);

  cancel();
  assert.deepEqual(cancelledHandles, [3]);

  queued.shift()?.();
  assert.deepEqual(
    appliedStates,
    [
      {
        revenueAnalytics: true,
        tokenAnalytics: false,
        activityWorkbench: false,
      },
      {
        revenueAnalytics: false,
        tokenAnalytics: true,
        activityWorkbench: false,
      },
    ],
  );
});

runTest('dashboard section hydration exposes the intended deferred batch order', () => {
  assert.deepEqual(DASHBOARD_DEFERRED_SECTION_BATCHES, [
    ['revenueAnalytics'],
    ['tokenAnalytics'],
    ['activityWorkbench'],
  ]);
});
