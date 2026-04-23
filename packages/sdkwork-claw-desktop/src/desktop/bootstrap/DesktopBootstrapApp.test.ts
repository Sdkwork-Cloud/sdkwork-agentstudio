import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  INITIAL_DESKTOP_STARTUP_MILESTONES,
  runDesktopBootstrapSequence,
  type DesktopBootstrapState,
  type DesktopBootstrapStateActions,
} from './desktopBootstrapRuntime.ts';
import {
  BACKGROUND_RUNTIME_READINESS_TOAST_ID,
  resolveBackgroundRuntimeReadinessToastPlan,
  resolveBackgroundRuntimeReadinessToastResetPlan,
} from './desktopBackgroundRuntimeReadinessToast.ts';
import {
  resolveBackgroundRuntimeReadinessRecoveryToastCopy,
  retryBackgroundRuntimeReadinessRecovery,
} from './desktopBackgroundRuntimeReadinessRecovery.ts';

const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';

function createBootstrapState(): DesktopBootstrapState {
  return {
    milestones: { ...INITIAL_DESKTOP_STARTUP_MILESTONES },
    status: 'booting',
    errorMessage: null,
    shouldRenderShell: false,
    isSplashVisible: true,
  };
}

function createStateActions(state: DesktopBootstrapState): DesktopBootstrapStateActions {
  return {
    updateMilestones(updater) {
      state.milestones = updater(state.milestones);
    },
    setStatus(nextStatus) {
      state.status = nextStatus;
    },
    setErrorMessage(nextMessage) {
      state.errorMessage = nextMessage;
    },
    setShouldRenderShell(nextValue) {
      state.shouldRenderShell = nextValue;
    },
    setIsSplashVisible(nextValue) {
      state.isSplashVisible = nextValue;
    },
  };
}

function createManualTaskScheduler() {
  let nextHandle = 1;
  const queuedTasks = new Map<number, () => void>();

  return {
    schedule(callback: () => void) {
      const handle = nextHandle;
      nextHandle += 1;
      queuedTasks.set(handle, callback);
      return handle;
    },
    clear(handle: number) {
      queuedTasks.delete(handle);
    },
    flushAll() {
      const pending = [...queuedTasks.entries()];
      queuedTasks.clear();
      for (const [, callback] of pending) {
        callback();
      }
    },
    size() {
      return queuedTasks.size;
    },
  };
}

test('desktop bootstrap app defines a next-paint wait helper for startup window reveal sequencing', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, 'DesktopBootstrapApp.tsx'),
    'utf8',
  );

  assert.match(source, /function waitForNextPaint\(\)/);
});

test('desktop bootstrap app resolves passing startup evidence phases from the latest milestone ref inside background readiness callbacks', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, 'DesktopBootstrapApp.tsx'),
    'utf8',
  );

  assert.match(source, /milestonesRef\.current\.hasShellMounted/);
});

test('desktop bootstrap app refreshes local ai proxy startup evidence from a fresh desktop kernel info probe instead of reusing the early bootstrap cache', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, 'DesktopBootstrapApp.tsx'),
    'utf8',
  );

  assert.match(
    source,
    /const captureLocalAiProxyEvidence = async[\s\S]*await getDesktopKernelInfo\(\)/,
  );
});

test('desktop bootstrap runtime requests shell render only after the window, runtime, and shell bootstrap all succeed', async () => {
  const state = createBootstrapState();
  const actions = createStateActions(state);
  const scheduler = createManualTaskScheduler();
  const events: string[] = [];

  const result = await runDesktopBootstrapSequence({
    pathname: '/chat',
    runId: 1,
    isRunCurrent: () => true,
    revealStartupWindow: async () => {
      events.push('reveal-window');
      assert.equal(state.milestones.hasWindowPresented, false);
      assert.equal(state.shouldRenderShell, false);
    },
    connectDesktopRuntime: async () => {
      events.push('connect-runtime');
      assert.equal(state.milestones.hasWindowPresented, true);
      assert.equal(state.milestones.hasRuntimeConnected, false);
      assert.equal(state.shouldRenderShell, false);
    },
    bootstrapShellRuntime: async () => {
      events.push('bootstrap-shell');
      assert.equal(state.milestones.hasRuntimeConnected, true);
      assert.equal(state.milestones.hasShellBootstrapped, false);
      assert.equal(state.shouldRenderShell, false);
    },
    resolveSidebarStartupRoute(pathname) {
      events.push(`resolve-startup-route:${pathname}`);
      return '/chat';
    },
    listSidebarRoutePrefetchPaths() {
      events.push('list-prefetch-routes');
      return ['/chat', '/instances', '/settings'];
    },
    prefetchSidebarRoute(pathname) {
      events.push(`prefetch-startup:${pathname}`);
    },
    prefetchSidebarRoutes(paths) {
      events.push(`prefetch-warm:${paths.join(',')}`);
    },
    scheduleTask(callback) {
      events.push('schedule-warm-prefetch');
      return scheduler.schedule(callback);
    },
    clearScheduledTask(handle) {
      events.push(`clear-task:${handle}`);
      scheduler.clear(handle);
    },
    resolveErrorMessage(error) {
      return error instanceof Error ? error.message : String(error);
    },
    log(level, message) {
      events.push(`log:${level}:${message}`);
    },
    actions,
  });

  assert.equal(result, 'launched');
  assert.deepEqual(state.milestones, {
    hasWindowPresented: true,
    hasRuntimeConnected: true,
    hasShellBootstrapped: true,
    hasShellMounted: false,
  });
  assert.equal(state.status, 'launching');
  assert.equal(state.errorMessage, null);
  assert.equal(state.shouldRenderShell, true);
  assert.equal(scheduler.size(), 1);
  assert.equal(
    events.includes('prefetch-warm:/instances,/settings'),
    false,
  );

  scheduler.flushAll();

  assert.equal(
    events.includes('prefetch-warm:/instances,/settings'),
    true,
  );
  assert.deepEqual(events, [
    'reveal-window',
    'connect-runtime',
    'resolve-startup-route:/chat',
    'schedule-warm-prefetch',
    'prefetch-startup:/chat',
    'bootstrap-shell',
    'list-prefetch-routes',
    'prefetch-warm:/instances,/settings',
  ]);
});

test('desktop bootstrap runtime does not gate the initial shell render behind transition scheduling', async () => {
  const state = createBootstrapState();
  const actions = createStateActions(state);

  const result = await runDesktopBootstrapSequence({
    pathname: '/chat',
    runId: 11,
    isRunCurrent: () => true,
    revealStartupWindow: async () => {},
    connectDesktopRuntime: async () => {},
    bootstrapShellRuntime: async () => {},
    resolveSidebarStartupRoute() {
      return '/chat';
    },
    listSidebarRoutePrefetchPaths() {
      return ['/chat'];
    },
    prefetchSidebarRoute() {},
    prefetchSidebarRoutes() {},
    scheduleTask() {
      return 1;
    },
    clearScheduledTask() {},
    resolveErrorMessage(error) {
      return error instanceof Error ? error.message : String(error);
    },
    log() {},
    actions,
  });

  assert.equal(result, 'launched');
  assert.equal(state.shouldRenderShell, true);
  assert.equal(state.status, 'launching');
});

test('desktop bootstrap runtime enters error state and clears deferred sidebar warmup when shell bootstrap fails', async () => {
  const state = createBootstrapState();
  const actions = createStateActions(state);
  const scheduler = createManualTaskScheduler();
  const events: string[] = [];

  const result = await runDesktopBootstrapSequence({
    pathname: '/settings',
    runId: 2,
    isRunCurrent: () => true,
    revealStartupWindow: async () => {
      events.push('reveal-window');
    },
    connectDesktopRuntime: async () => {
      events.push('connect-runtime');
    },
    bootstrapShellRuntime: async () => {
      events.push('bootstrap-shell');
      throw new Error('shell bootstrap failed');
    },
    resolveSidebarStartupRoute() {
      return '/settings';
    },
    listSidebarRoutePrefetchPaths() {
      return ['/settings', '/instances'];
    },
    prefetchSidebarRoute(pathname) {
      events.push(`prefetch-startup:${pathname}`);
    },
    prefetchSidebarRoutes(paths) {
      events.push(`prefetch-warm:${paths.join(',')}`);
    },
    scheduleTask(callback) {
      return scheduler.schedule(callback);
    },
    clearScheduledTask(handle) {
      events.push(`clear-task:${handle}`);
      scheduler.clear(handle);
    },
    resolveErrorMessage(error) {
      return error instanceof Error ? `resolved:${error.message}` : 'resolved';
    },
    log(level, message) {
      events.push(`log:${level}:${message}`);
    },
    actions,
  });

  assert.equal(result, 'failed');
  assert.deepEqual(state.milestones, {
    hasWindowPresented: true,
    hasRuntimeConnected: true,
    hasShellBootstrapped: false,
    hasShellMounted: false,
  });
  assert.equal(state.status, 'error');
  assert.equal(state.errorMessage, 'resolved:shell bootstrap failed');
  assert.equal(state.shouldRenderShell, false);
  assert.equal(state.isSplashVisible, true);
  assert.equal(scheduler.size(), 0);

  scheduler.flushAll();

  assert.equal(
    events.includes('prefetch-warm:/instances'),
    false,
  );
  assert.equal(
    events.includes('start-transition'),
    false,
  );
  assert.equal(
    events.includes('log:error:Bootstrap failed.'),
    true,
  );
});

test('desktop bootstrap runtime reports the original bootstrap failure so the desktop shell can persist startup evidence', async () => {
  const state = createBootstrapState();
  const actions = createStateActions(state);
  const scheduler = createManualTaskScheduler();
  const reportedFailures: unknown[] = [];
  const bootstrapFailure = new Error('shell bootstrap failed');

  const result = await runDesktopBootstrapSequence({
    pathname: '/chat',
    runId: 21,
    isRunCurrent: () => true,
    revealStartupWindow: async () => {},
    connectDesktopRuntime: async () => {},
    bootstrapShellRuntime: async () => {
      throw bootstrapFailure;
    },
    resolveSidebarStartupRoute() {
      return '/chat';
    },
    listSidebarRoutePrefetchPaths() {
      return ['/chat'];
    },
    prefetchSidebarRoute() {},
    prefetchSidebarRoutes() {},
    scheduleTask(callback) {
      return scheduler.schedule(callback);
    },
    clearScheduledTask(handle) {
      scheduler.clear(handle);
    },
    resolveErrorMessage(error) {
      return error instanceof Error ? error.message : String(error);
    },
    onBootstrapFailed(error) {
      reportedFailures.push(error);
    },
    log() {},
    actions,
  });

  assert.equal(result, 'failed');
  assert.deepEqual(reportedFailures, [bootstrapFailure]);
});

test('desktop bootstrap runtime stops cleanly when the run becomes stale before shell render is requested', async () => {
  const state = createBootstrapState();
  const actions = createStateActions(state);
  const scheduler = createManualTaskScheduler();
  const events: string[] = [];
  let activeRun = true;

  const result = await runDesktopBootstrapSequence({
    pathname: '/instances',
    runId: 3,
    isRunCurrent: () => activeRun,
    revealStartupWindow: async () => {
      events.push('reveal-window');
    },
    connectDesktopRuntime: async () => {
      events.push('connect-runtime');
    },
    bootstrapShellRuntime: async () => {
      events.push('bootstrap-shell');
      activeRun = false;
    },
    resolveSidebarStartupRoute() {
      return '/instances';
    },
    listSidebarRoutePrefetchPaths() {
      return ['/instances', '/settings'];
    },
    prefetchSidebarRoute(pathname) {
      events.push(`prefetch-startup:${pathname}`);
    },
    prefetchSidebarRoutes(paths) {
      events.push(`prefetch-warm:${paths.join(',')}`);
    },
    scheduleTask(callback) {
      return scheduler.schedule(callback);
    },
    clearScheduledTask(handle) {
      events.push(`clear-task:${handle}`);
      scheduler.clear(handle);
    },
    resolveErrorMessage(error) {
      return error instanceof Error ? error.message : String(error);
    },
    log(level, message) {
      events.push(`log:${level}:${message}`);
    },
    actions,
  });

  assert.equal(result, 'cancelled');
  assert.deepEqual(state.milestones, {
    hasWindowPresented: true,
    hasRuntimeConnected: true,
    hasShellBootstrapped: false,
    hasShellMounted: false,
  });
  assert.equal(state.status, 'booting');
  assert.equal(state.shouldRenderShell, false);
  assert.equal(scheduler.size(), 0);

  scheduler.flushAll();

  assert.equal(
    events.includes('prefetch-warm:/settings'),
    false,
  );
  assert.equal(
    events.includes('start-transition'),
    false,
  );
});

test('resolveBackgroundRuntimeReadinessToastPlan returns localized toast copy for the current launching shell run', () => {
  const plan = resolveBackgroundRuntimeReadinessToastPlan({
    language: 'zh',
    status: 'launching',
    shouldRenderShell: true,
    currentRunId: 8,
    lastShownSignature: '',
    notification: {
      runId: 8,
      message: 'gateway timed out',
    },
  });

  assert.ok(plan);
  assert.equal(plan.signature, '8:gateway timed out');
  assert.equal(plan.toastId, BACKGROUND_RUNTIME_READINESS_TOAST_ID);
  assert.equal(plan.title, '内置 OpenClaw 尚未就绪');
  assert.equal(plan.retryActionLabel, '立即重试');
  assert.equal(plan.detailsActionLabel, '查看详情');
  assert.match(plan.description, /Claw Studio 已打开/);
  assert.match(plan.description, /gateway timed out/);
});

test('resolveBackgroundRuntimeReadinessToastPlan returns generic runtime copy when built-in OpenClaw recovery is unavailable', () => {
  const plan = resolveBackgroundRuntimeReadinessToastPlan({
    language: 'en',
    status: 'launching',
    shouldRenderShell: true,
    currentRunId: 10,
    lastShownSignature: '',
    notification: {
      runId: 10,
      message: 'manage endpoint unavailable',
      recoveryMode: 'generic-hosted-runtime',
    },
  });

  assert.ok(plan);
  assert.equal(plan.signature, '10:manage endpoint unavailable');
  assert.equal(plan.toastId, BACKGROUND_RUNTIME_READINESS_TOAST_ID);
  assert.equal(plan.title, 'Desktop runtime is not ready yet');
  assert.equal(plan.retryActionLabel, 'Retry check');
  assert.equal(plan.detailsActionLabel, 'View instances');
  assert.match(plan.description, /desktop runtime/i);
  assert.match(plan.description, /manage endpoint unavailable/);
  assert.doesNotMatch(plan.description, /OpenClaw/i);
});

test('resolveBackgroundRuntimeReadinessToastResetPlan requests dismissal of the shared toast channel once a failure notification has been shown', () => {
  assert.deepEqual(
    resolveBackgroundRuntimeReadinessToastResetPlan('8:gateway timed out'),
    {
      nextSignature: '',
      dismissToastId: BACKGROUND_RUNTIME_READINESS_TOAST_ID,
    },
  );

  assert.equal(resolveBackgroundRuntimeReadinessToastResetPlan(''), null);
});

test('resolveBackgroundRuntimeReadinessToastResetPlan can clear the failure signature without dismissing the active retry toast', () => {
  assert.deepEqual(
    resolveBackgroundRuntimeReadinessToastResetPlan('8:gateway timed out', {
      dismissToast: false,
    }),
    {
      nextSignature: '',
      dismissToastId: null,
    },
  );
});

test('resolveBackgroundRuntimeReadinessToastPlan suppresses stale, hidden, fatal, and duplicate notifications', () => {
  assert.equal(
    resolveBackgroundRuntimeReadinessToastPlan({
      language: 'en',
      status: 'launching',
      shouldRenderShell: true,
      currentRunId: 9,
      lastShownSignature: '',
      notification: {
        runId: 8,
        message: 'runtime failed',
      },
    }),
    null,
  );

  assert.equal(
    resolveBackgroundRuntimeReadinessToastPlan({
      language: 'en',
      status: 'launching',
      shouldRenderShell: false,
      currentRunId: 9,
      lastShownSignature: '',
      notification: {
        runId: 9,
        message: 'runtime failed',
      },
    }),
    null,
  );

  assert.equal(
    resolveBackgroundRuntimeReadinessToastPlan({
      language: 'en',
      status: 'error',
      shouldRenderShell: true,
      currentRunId: 9,
      lastShownSignature: '',
      notification: {
        runId: 9,
        message: 'runtime failed',
      },
    }),
    null,
  );

  assert.equal(
    resolveBackgroundRuntimeReadinessToastPlan({
      language: 'en',
      status: 'launching',
      shouldRenderShell: true,
      currentRunId: 9,
      lastShownSignature: '9:runtime failed',
      notification: {
        runId: 9,
        message: 'runtime failed',
      },
    }),
    null,
  );
});

test('retryBackgroundRuntimeReadinessRecovery clears prior failure state, restarts the built-in instance, and reconnects readiness probing', async () => {
  const events: string[] = [];

  await retryBackgroundRuntimeReadinessRecovery({
    instanceId: BUILT_IN_INSTANCE_ID,
    clearFailureState: () => {
      events.push('clearFailureState');
    },
    restartInstance: async (instanceId) => {
      events.push(`restartInstance:${instanceId}`);
      return { id: instanceId };
    },
    reconnectHostedRuntimeReadiness: async () => {
      events.push('reconnectHostedRuntimeReadiness');
    },
  });

  assert.deepEqual(events, [
    'clearFailureState',
    `restartInstance:${BUILT_IN_INSTANCE_ID}`,
    'reconnectHostedRuntimeReadiness',
  ]);
});

test('retryBackgroundRuntimeReadinessRecovery stops before reconnect when the built-in restart request cannot resolve an instance', async () => {
  const events: string[] = [];

  await assert.rejects(
    () =>
      retryBackgroundRuntimeReadinessRecovery({
        instanceId: BUILT_IN_INSTANCE_ID,
        clearFailureState: () => {
          events.push('clearFailureState');
        },
        restartInstance: async (instanceId) => {
          events.push(`restartInstance:${instanceId}`);
          return null;
        },
        reconnectHostedRuntimeReadiness: async () => {
          events.push('reconnectHostedRuntimeReadiness');
        },
      }),
    /could not be resolved/i,
  );

  assert.deepEqual(events, [
    'clearFailureState',
    `restartInstance:${BUILT_IN_INSTANCE_ID}`,
  ]);
});

test('retryBackgroundRuntimeReadinessRecovery can retry generic hosted runtime readiness without restarting a managed instance', async () => {
  const events: string[] = [];

  await retryBackgroundRuntimeReadinessRecovery({
    recoveryMode: 'generic-hosted-runtime',
    clearFailureState: () => {
      events.push('clearFailureState');
    },
    restartInstance: async (instanceId) => {
      events.push(`restartInstance:${instanceId}`);
      return { id: instanceId };
    },
    reconnectHostedRuntimeReadiness: async () => {
      events.push('reconnectHostedRuntimeReadiness');
    },
  });

  assert.deepEqual(events, [
    'clearFailureState',
    'reconnectHostedRuntimeReadiness',
  ]);
});

test('resolveBackgroundRuntimeReadinessRecoveryToastCopy returns localized retry and success copy', () => {
  const zhCopy = resolveBackgroundRuntimeReadinessRecoveryToastCopy('zh');
  assert.equal(zhCopy.retryActionLabel, '立即重试');
  assert.equal(zhCopy.detailsActionLabel, '查看详情');
  assert.match(zhCopy.loadingTitle, /正在重试/);
  assert.match(zhCopy.readyTitle, /已经就绪/);

  const enCopy = resolveBackgroundRuntimeReadinessRecoveryToastCopy('en');
  assert.equal(enCopy.retryActionLabel, 'Retry now');
  assert.equal(enCopy.detailsActionLabel, 'View details');
  assert.match(enCopy.loadingTitle, /Retrying/);
  assert.match(enCopy.readyTitle, /is ready/);

  const genericCopy = resolveBackgroundRuntimeReadinessRecoveryToastCopy('en', {
    recoveryMode: 'generic-hosted-runtime',
  });
  assert.equal(genericCopy.retryActionLabel, 'Retry check');
  assert.equal(genericCopy.detailsActionLabel, 'View instances');
  assert.match(genericCopy.loadingTitle, /desktop runtime/i);
  assert.match(genericCopy.readyTitle, /desktop runtime/i);
  assert.doesNotMatch(genericCopy.loadingDescription, /OpenClaw/i);
});
