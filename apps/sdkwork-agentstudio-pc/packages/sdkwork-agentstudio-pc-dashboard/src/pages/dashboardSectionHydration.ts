export interface DashboardDeferredSectionState {
  revenueAnalytics: boolean;
  tokenAnalytics: boolean;
  activityWorkbench: boolean;
}

export type DashboardDeferredSection = keyof DashboardDeferredSectionState;

export const DASHBOARD_DEFERRED_SECTION_BATCHES: readonly DashboardDeferredSection[][] = [
  ['revenueAnalytics'],
  ['tokenAnalytics'],
  ['activityWorkbench'],
];

export function createInitialDashboardDeferredSections(): DashboardDeferredSectionState {
  return {
    revenueAnalytics: false,
    tokenAnalytics: false,
    activityWorkbench: false,
  };
}

export function mergeDashboardDeferredSections(
  current: DashboardDeferredSectionState,
  patch: Partial<DashboardDeferredSectionState>,
): DashboardDeferredSectionState {
  return {
    ...current,
    ...patch,
  };
}

function createDashboardDeferredSectionPatch(
  sections: readonly DashboardDeferredSection[],
): DashboardDeferredSectionState {
  return mergeDashboardDeferredSections(
    createInitialDashboardDeferredSections(),
    Object.fromEntries(sections.map((section) => [section, true] as const)),
  );
}

export function scheduleDashboardSectionHydration(input: {
  onBatchReady: (patch: DashboardDeferredSectionState) => void;
  startDelayMs?: number;
  batchDelayMs?: number;
  scheduleTimeout?: (callback: () => void, delay: number) => number;
  clearScheduledTimeout?: (handle: number) => void;
}) {
  const {
    onBatchReady,
    startDelayMs = 80,
    batchDelayMs = 120,
    scheduleTimeout = (callback, delay) => window.setTimeout(callback, delay),
    clearScheduledTimeout = (handle) => window.clearTimeout(handle),
  } = input;

  let cancelled = false;
  let nextIndex = 0;
  let scheduledHandle: number | null = null;

  const runNextBatch = () => {
    scheduledHandle = null;
    if (cancelled || nextIndex >= DASHBOARD_DEFERRED_SECTION_BATCHES.length) {
      return;
    }

    const batch = DASHBOARD_DEFERRED_SECTION_BATCHES[nextIndex];
    nextIndex += 1;
    onBatchReady(createDashboardDeferredSectionPatch(batch));

    if (cancelled || nextIndex >= DASHBOARD_DEFERRED_SECTION_BATCHES.length) {
      return;
    }

    scheduledHandle = scheduleTimeout(runNextBatch, batchDelayMs);
  };

  scheduledHandle = scheduleTimeout(runNextBatch, startDelayMs);

  return () => {
    cancelled = true;
    if (scheduledHandle !== null) {
      clearScheduledTimeout(scheduledHandle);
      scheduledHandle = null;
    }
  };
}
