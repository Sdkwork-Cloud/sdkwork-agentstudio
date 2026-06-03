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
  planBackgroundRuntimeReadinessAutoRecovery,
  planStartupRuntimeReadinessRetryRecovery,
  resolveBackgroundRuntimeReadinessRecoveryMode,
  resolveBackgroundRuntimeReadinessRecoveryToastCopy,
  runStartupRuntimeReadinessRetryRecovery,
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

test('desktop bootstrap app persists fresh OpenClaw config health evidence from desktop kernel info', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, 'DesktopBootstrapApp.tsx'),
    'utf8',
  );

  assert.match(
    source,
    /const captureLocalAiProxyEvidence = async[\s\S]*const openClawRuntime = kernelInfo\?\.openClawRuntime \?\? null;[\s\S]*startupEvidenceContextRef\.current = startupEvidenceContextRef\.current[\s\S]*openClawRuntime,[\s\S]*Fresh desktop kernel info captured OpenClaw config health startup evidence/,
    'fresh kernel info probes must preserve OpenClaw runtime config-health facts in startup evidence context',
  );
  assert.match(
    source,
    /openClawRuntime:\s*startupEvidenceContextRef\.current\?\.openClawRuntime \?\? null,[\s\S]*readinessSnapshot,[\s\S]*localAiProxy,/,
    'startup evidence persistence must forward the captured OpenClaw runtime health alongside readiness snapshots',
  );
});

test('desktop bootstrap app preserves runtime-readiness-failed evidence when background readiness fails during bootstrap', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, 'DesktopBootstrapApp.tsx'),
    'utf8',
  );

  assert.match(
    source,
    /phase:\s*runtimeReadinessFailureRef\.current\s*\?\s*'runtime-readiness-failed'\s*:\s*'bootstrap-failed'/,
  );
});

test('desktop bootstrap app performs runtime readiness recovery before retrying a readiness-failed startup', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, 'DesktopBootstrapApp.tsx'),
    'utf8',
  );

  assert.match(source, /planStartupRuntimeReadinessRetryRecovery\(/);
  assert.match(
    source,
    /await runStartupRuntimeReadinessRetryRecovery\([\s\S]*await runDesktopBootstrapSequence\(/,
  );
});

test('desktop bootstrap app schedules background runtime auto-recovery even when the toast is de-duplicated', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, 'DesktopBootstrapApp.tsx'),
    'utf8',
  );
  const effectStart = source.indexOf('const toastPlan = resolveBackgroundRuntimeReadinessToastPlan({');
  assert.notEqual(effectStart, -1, 'toast planning effect should exist');
  const effectSegment = source.slice(effectStart, source.indexOf('const revealStartupWindow', effectStart));
  const scheduleIndex = effectSegment.indexOf(
    'scheduleBackgroundRuntimeReadinessAutoRecovery(backgroundRuntimeReadinessNotification);',
  );
  const duplicateReturnIndex = effectSegment.indexOf('if (!toastPlan) {');

  assert.notEqual(scheduleIndex, -1, 'auto-recovery should be scheduled from the toast effect');
  assert.notEqual(duplicateReturnIndex, -1, 'toast effect should still de-duplicate toast rendering');
  assert(
    scheduleIndex < duplicateReturnIndex,
    'auto-recovery scheduling must happen before duplicate toast suppression returns',
  );
});

test('desktop bootstrap app republishes failed recovery attempts as schedulable readiness notifications', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, 'DesktopBootstrapApp.tsx'),
    'utf8',
  );
  const retryStart = source.indexOf('const retryBackgroundRuntimeReadiness = useEffectEvent(async () => {');
  const catchStart = source.indexOf('} catch (error) {', retryStart);
  const finallyStart = source.indexOf('} finally {', catchStart);

  assert.notEqual(retryStart, -1, 'retryBackgroundRuntimeReadiness should exist');
  assert.notEqual(catchStart, -1, 'retryBackgroundRuntimeReadiness should handle immediate failures');
  assert.notEqual(finallyStart, -1, 'retryBackgroundRuntimeReadiness should have a finally block');

  const catchSegment = source.slice(catchStart, finallyStart);
  assert.match(
    catchSegment,
    /setBackgroundRuntimeReadinessNotification\(\{\s*runId,\s*message: resolveErrorMessage\(error, appearance\.language\),\s*recoveryMode,\s*\}\);/,
    'immediate recovery failures must re-enter the notification pipeline so bounded auto-recovery can use the remaining attempts',
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
      recoveryMode: 'managed-openclaw',
    },
  });

  assert.ok(plan);
  assert.equal(plan.signature, '8:managed-openclaw:gateway timed out');
  assert.equal(plan.toastId, BACKGROUND_RUNTIME_READINESS_TOAST_ID);
  assert.equal(plan.title, '内置 OpenClaw 尚未就绪');
  assert.equal(plan.retryActionLabel, '立即重试');
  assert.equal(plan.detailsActionLabel, '查看详情');
  assert.match(plan.description, /Claw Studio 已打开/);
  assert.match(plan.description, /gateway timed out/);
});

test('resolveBackgroundRuntimeReadinessToastPlan defaults to generic runtime copy when recovery mode is unknown', () => {
  const plan = resolveBackgroundRuntimeReadinessToastPlan({
    language: 'en',
    status: 'launching',
    shouldRenderShell: true,
    currentRunId: 11,
    lastShownSignature: '',
    notification: {
      runId: 11,
      message: 'expected lifecycle "ready" but received "degraded"',
    },
  });

  assert.ok(plan);
  assert.equal(
    plan.signature,
    '11:generic-hosted-runtime:expected lifecycle "ready" but received "degraded"',
  );
  assert.equal(plan.title, 'Desktop runtime is not ready yet');
  assert.equal(plan.retryActionLabel, 'Retry check');
  assert.equal(plan.detailsActionLabel, 'View instances');
  assert.doesNotMatch(plan.description, /OpenClaw/i);
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
  assert.equal(plan.signature, '10:generic-hosted-runtime:manage endpoint unavailable');
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
      lastShownSignature: '9:generic-hosted-runtime:runtime failed',
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
    recoveryMode: 'managed-openclaw',
    instanceId: BUILT_IN_INSTANCE_ID,
    clearFailureState: () => {
      events.push('clearFailureState');
    },
    restartInstance: async (instanceId) => {
      events.push(`restartInstance:${instanceId}`);
      return { id: instanceId };
    },
    ensureDesktopKernelRunning: async () => {
      events.push('ensureDesktopKernelRunning');
      return { lifecycle: 'running' };
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

test('retryBackgroundRuntimeReadinessRecovery falls back to desktop kernel ensure when the built-in instance id is unavailable', async () => {
  const events: string[] = [];

  await retryBackgroundRuntimeReadinessRecovery({
    recoveryMode: 'managed-openclaw',
    instanceId: null,
    clearFailureState: () => {
      events.push('clearFailureState');
    },
    restartInstance: async (instanceId) => {
      events.push(`restartInstance:${instanceId}`);
      return { id: instanceId };
    },
    ensureDesktopKernelRunning: async () => {
      events.push('ensureDesktopKernelRunning');
      return { lifecycle: 'running' };
    },
    reconnectHostedRuntimeReadiness: async () => {
      events.push('reconnectHostedRuntimeReadiness');
    },
  });

  assert.deepEqual(events, [
    'clearFailureState',
    'ensureDesktopKernelRunning',
    'reconnectHostedRuntimeReadiness',
  ]);
});

test('retryBackgroundRuntimeReadinessRecovery falls back to desktop kernel ensure when the built-in restart returns no instance', async () => {
  const events: string[] = [];

  await retryBackgroundRuntimeReadinessRecovery({
    recoveryMode: 'managed-openclaw',
    instanceId: BUILT_IN_INSTANCE_ID,
    clearFailureState: () => {
      events.push('clearFailureState');
    },
    restartInstance: async (instanceId) => {
      events.push(`restartInstance:${instanceId}`);
      return null;
    },
    ensureDesktopKernelRunning: async () => {
      events.push('ensureDesktopKernelRunning');
      return { lifecycle: 'running' };
    },
    reconnectHostedRuntimeReadiness: async () => {
      events.push('reconnectHostedRuntimeReadiness');
    },
  });

  assert.deepEqual(events, [
    'clearFailureState',
    `restartInstance:${BUILT_IN_INSTANCE_ID}`,
    'ensureDesktopKernelRunning',
    'reconnectHostedRuntimeReadiness',
  ]);
});

test('retryBackgroundRuntimeReadinessRecovery defaults to generic hosted runtime recovery', async () => {
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
    ensureDesktopKernelRunning: async () => {
      events.push('ensureDesktopKernelRunning');
      return { lifecycle: 'running' };
    },
    reconnectHostedRuntimeReadiness: async () => {
      events.push('reconnectHostedRuntimeReadiness');
    },
  });

  assert.deepEqual(events, [
    'clearFailureState',
    'ensureDesktopKernelRunning',
    'reconnectHostedRuntimeReadiness',
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
    ensureDesktopKernelRunning: async () => {
      events.push('ensureDesktopKernelRunning');
      return { lifecycle: 'running' };
    },
    reconnectHostedRuntimeReadiness: async () => {
      events.push('reconnectHostedRuntimeReadiness');
    },
  });

  assert.deepEqual(events, [
    'clearFailureState',
    'ensureDesktopKernelRunning',
    'reconnectHostedRuntimeReadiness',
  ]);
});

test('runStartupRuntimeReadinessRetryRecovery ensures a generic hosted runtime before the next bootstrap probe', async () => {
  const events: string[] = [];

  const recovered = await runStartupRuntimeReadinessRetryRecovery({
    request: {
      recoveryMode: 'generic-hosted-runtime',
      instanceId: null,
    },
    clearFailureState: () => {
      events.push('clearFailureState');
    },
    restartInstance: async (instanceId) => {
      events.push(`restartInstance:${instanceId}`);
      return { id: instanceId };
    },
    ensureDesktopKernelRunning: async () => {
      events.push('ensureDesktopKernelRunning');
      return { lifecycle: 'running' };
    },
  });

  assert.equal(recovered, true);
  assert.deepEqual(events, [
    'clearFailureState',
    'ensureDesktopKernelRunning',
  ]);
});

test('resolveBackgroundRuntimeReadinessRecoveryMode only uses managed OpenClaw recovery when the kernel list explicitly includes OpenClaw', () => {
  assert.equal(
    resolveBackgroundRuntimeReadinessRecoveryMode([' HERMES ', ' OpenClaw ']),
    'managed-openclaw',
  );
  assert.equal(
    resolveBackgroundRuntimeReadinessRecoveryMode([' hermes ']),
    'generic-hosted-runtime',
  );
  assert.equal(
    resolveBackgroundRuntimeReadinessRecoveryMode([]),
    'generic-hosted-runtime',
  );
  assert.equal(
    resolveBackgroundRuntimeReadinessRecoveryMode(undefined),
    'generic-hosted-runtime',
  );
});

test('planBackgroundRuntimeReadinessAutoRecovery schedules a bounded self-heal after a background readiness failure', () => {
  assert.deepEqual(
    planBackgroundRuntimeReadinessAutoRecovery({
      currentRunId: 4,
      status: 'launching',
      shouldRenderShell: true,
      notification: {
        runId: 4,
        message: 'Desktop hosted runtime is not ready: expected lifecycle "ready" but received "degraded".',
        recoveryMode: 'generic-hosted-runtime',
      },
      recoveryInFlight: false,
      attemptCount: 0,
      pendingSignature: '',
    }),
    {
      signature:
        '4:generic-hosted-runtime:Desktop hosted runtime is not ready: expected lifecycle "ready" but received "degraded".',
      nextAttemptCount: 1,
      delayMs: 1200,
    },
  );

  assert.equal(
    planBackgroundRuntimeReadinessAutoRecovery({
      currentRunId: 4,
      status: 'launching',
      shouldRenderShell: true,
      notification: {
        runId: 4,
        message: 'still degraded',
        recoveryMode: 'generic-hosted-runtime',
      },
      recoveryInFlight: false,
      attemptCount: 2,
      pendingSignature: '',
    }),
    null,
  );

  assert.equal(
    planBackgroundRuntimeReadinessAutoRecovery({
      currentRunId: 4,
      status: 'launching',
      shouldRenderShell: true,
      notification: {
        runId: 4,
        message: 'still degraded',
        recoveryMode: 'managed-openclaw',
      },
      recoveryInFlight: false,
      attemptCount: 0,
      pendingSignature: '4:managed-openclaw:still degraded',
    }),
    null,
  );
});

test('resolveBackgroundRuntimeReadinessToastPlan keeps recovery mode in the duplicate signature', () => {
  const plan = resolveBackgroundRuntimeReadinessToastPlan({
    language: 'en',
    status: 'launching',
    shouldRenderShell: true,
    currentRunId: 9,
    lastShownSignature: '9:generic-hosted-runtime:runtime failed',
    notification: {
      runId: 9,
      message: 'runtime failed',
      recoveryMode: 'managed-openclaw',
    },
  });

  assert.ok(plan);
  assert.equal(plan.signature, '9:managed-openclaw:runtime failed');
  assert.equal(plan.retryActionLabel, 'Retry now');
});

test('planBackgroundRuntimeReadinessAutoRecovery defaults unknown recovery mode to generic hosted runtime', () => {
  assert.deepEqual(
    planBackgroundRuntimeReadinessAutoRecovery({
      currentRunId: 6,
      status: 'launching',
      shouldRenderShell: true,
      notification: {
        runId: 6,
        message: 'still degraded',
      },
      recoveryInFlight: false,
      attemptCount: 0,
      pendingSignature: '',
    }),
    {
      signature: '6:generic-hosted-runtime:still degraded',
      nextAttemptCount: 1,
      delayMs: 1200,
    },
  );
});

test('planBackgroundRuntimeReadinessAutoRecovery can reschedule the same failure after a fired auto-recovery attempt', () => {
  assert.deepEqual(
    planBackgroundRuntimeReadinessAutoRecovery({
      currentRunId: 8,
      status: 'launching',
      shouldRenderShell: true,
      notification: {
        runId: 8,
        message: 'still degraded',
        recoveryMode: 'managed-openclaw',
      },
      recoveryInFlight: false,
      attemptCount: 1,
      pendingSignature: '',
    }),
    {
      signature: '8:managed-openclaw:still degraded',
      nextAttemptCount: 2,
      delayMs: 1200,
    },
  );
});

test('planStartupRuntimeReadinessRetryRecovery only plans recovery after runtime readiness failed during startup', () => {
  assert.equal(
    planStartupRuntimeReadinessRetryRecovery({
      runtimeReadinessFailed: false,
      recoveryMode: 'managed-openclaw',
      instanceId: BUILT_IN_INSTANCE_ID,
    }),
    null,
  );

  assert.deepEqual(
    planStartupRuntimeReadinessRetryRecovery({
      runtimeReadinessFailed: true,
      recoveryMode: 'managed-openclaw',
      instanceId: ` ${BUILT_IN_INSTANCE_ID} `,
    }),
    {
      recoveryMode: 'managed-openclaw',
      instanceId: BUILT_IN_INSTANCE_ID,
    },
  );

  assert.deepEqual(
    planStartupRuntimeReadinessRetryRecovery({
      runtimeReadinessFailed: true,
      recoveryMode: 'managed-openclaw',
      instanceId: '   ',
    }),
    {
      recoveryMode: 'managed-openclaw',
      instanceId: null,
    },
  );
});

test('planStartupRuntimeReadinessRetryRecovery defaults unknown recovery mode to generic hosted runtime', () => {
  assert.deepEqual(
    planStartupRuntimeReadinessRetryRecovery({
      runtimeReadinessFailed: true,
      instanceId: BUILT_IN_INSTANCE_ID,
    }),
    {
      recoveryMode: 'generic-hosted-runtime',
      instanceId: BUILT_IN_INSTANCE_ID,
    },
  );
});

test('runStartupRuntimeReadinessRetryRecovery restarts the built-in runtime before the next bootstrap probe', async () => {
  const events: string[] = [];

  const recovered = await runStartupRuntimeReadinessRetryRecovery({
    request: {
      recoveryMode: 'managed-openclaw',
      instanceId: BUILT_IN_INSTANCE_ID,
    },
    clearFailureState: () => {
      events.push('clearFailureState');
    },
    restartInstance: async (instanceId) => {
      events.push(`restartInstance:${instanceId}`);
      return { id: instanceId };
    },
    ensureDesktopKernelRunning: async () => {
      events.push('ensureDesktopKernelRunning');
      return { lifecycle: 'running' };
    },
  });

  assert.equal(recovered, true);
  assert.deepEqual(events, [
    'clearFailureState',
    `restartInstance:${BUILT_IN_INSTANCE_ID}`,
  ]);
});

test('runStartupRuntimeReadinessRetryRecovery falls back to kernel ensure when startup retry has no instance id', async () => {
  const events: string[] = [];

  const recovered = await runStartupRuntimeReadinessRetryRecovery({
    request: {
      recoveryMode: 'managed-openclaw',
      instanceId: null,
    },
    clearFailureState: () => {
      events.push('clearFailureState');
    },
    restartInstance: async (instanceId) => {
      events.push(`restartInstance:${instanceId}`);
      return { id: instanceId };
    },
    ensureDesktopKernelRunning: async () => {
      events.push('ensureDesktopKernelRunning');
      return { lifecycle: 'running' };
    },
  });

  assert.equal(recovered, true);
  assert.deepEqual(events, [
    'clearFailureState',
    'ensureDesktopKernelRunning',
  ]);
});

test('resolveBackgroundRuntimeReadinessRecoveryToastCopy returns localized retry and success copy', () => {
  const zhCopy = resolveBackgroundRuntimeReadinessRecoveryToastCopy('zh', {
    recoveryMode: 'managed-openclaw',
  });
  assert.equal(zhCopy.retryActionLabel, '立即重试');
  assert.equal(zhCopy.detailsActionLabel, '查看详情');
  assert.match(zhCopy.loadingTitle, /正在重试/);
  assert.match(zhCopy.readyTitle, /已经就绪/);

  const enCopy = resolveBackgroundRuntimeReadinessRecoveryToastCopy('en');
  assert.equal(enCopy.retryActionLabel, 'Retry check');
  assert.equal(enCopy.detailsActionLabel, 'View instances');
  assert.match(enCopy.loadingTitle, /desktop runtime/i);
  assert.match(enCopy.readyTitle, /desktop runtime/i);
  assert.doesNotMatch(enCopy.loadingDescription, /OpenClaw/i);

  const openClawCopy = resolveBackgroundRuntimeReadinessRecoveryToastCopy('en', {
    recoveryMode: 'managed-openclaw',
  });
  assert.equal(openClawCopy.retryActionLabel, 'Retry now');
  assert.equal(openClawCopy.detailsActionLabel, 'View details');
  assert.match(openClawCopy.loadingTitle, /Retrying/);
  assert.match(openClawCopy.readyTitle, /is ready/);

  const genericCopy = resolveBackgroundRuntimeReadinessRecoveryToastCopy('en', {
    recoveryMode: 'generic-hosted-runtime',
  });
  assert.equal(genericCopy.retryActionLabel, 'Retry check');
  assert.equal(genericCopy.detailsActionLabel, 'View instances');
  assert.match(genericCopy.loadingTitle, /desktop runtime/i);
  assert.match(genericCopy.readyTitle, /desktop runtime/i);
  assert.doesNotMatch(genericCopy.loadingDescription, /OpenClaw/i);
});
