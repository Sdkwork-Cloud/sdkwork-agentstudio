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

async function loadInstanceLifecycleActionSupportModule() {
  const moduleUrl = new URL('./instanceLifecycleActionSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceLifecycleActionSupport.ts to exist',
  );

  return import('./instanceLifecycleActionSupport.ts');
}

await runTest(
  'createInstanceLifecycleActionRunner executes the injected restart action, reports success, and reloads the workbench through page-owned callbacks',
  async () => {
    const { createInstanceLifecycleActionRunner } =
      await loadInstanceLifecycleActionSupportModule();
    const callLog: string[] = [];

    const runLifecycleAction = createInstanceLifecycleActionRunner({
      reloadWorkbench: async (instanceId) => {
        callLog.push(`reload:${instanceId}`);
      },
      reportSuccess: (message) => {
        callLog.push(`success:${message}`);
      },
      reportError: (message) => {
        callLog.push(`error:${message}`);
      },
      t: (key: string) => `translated:${key}`,
    });

    await runLifecycleAction({
      instanceId: 'instance-01',
      execute: async (instanceId) => {
        callLog.push(`restart:${instanceId}`);
      },
      successKey: 'instances.detail.toasts.restarted',
      failureKey: 'instances.detail.toasts.failedToRestart',
    });

    assert.deepEqual(callLog, [
      'restart:instance-01',
      'success:translated:instances.detail.toasts.restarted',
      'reload:instance-01',
    ]);
  },
);

await runTest(
  'createInstanceLifecycleActionRunner writes fallback errors through the injected page reporter',
  async () => {
    const { createInstanceLifecycleActionRunner } =
      await loadInstanceLifecycleActionSupportModule();
    const callLog: string[] = [];

    const runLifecycleAction = createInstanceLifecycleActionRunner({
      reloadWorkbench: async (instanceId) => {
        callLog.push(`reload:${instanceId}`);
      },
      reportSuccess: () => undefined,
      reportError: (message) => {
        callLog.push(`error:${message}`);
      },
      t: (key: string) => `translated:${key}`,
    });

    await runLifecycleAction({
      instanceId: 'instance-01',
      execute: async () => {
        throw new Error('');
      },
      successKey: 'instances.detail.toasts.started',
      failureKey: 'instances.detail.toasts.failedToStart',
    });

    assert.deepEqual(callLog, [
      'error:translated:instances.detail.toasts.failedToStart',
      'reload:instance-01',
    ]);
  },
);

await runTest(
  'buildInstanceLifecycleActionHandlers packages restart, stop, and start requests through the injected page-owned lifecycle runner',
  async () => {
    const { buildInstanceLifecycleActionHandlers } =
      await loadInstanceLifecycleActionSupportModule();
    const lifecycleRequests: any[] = [];
    const lifecycleExecutions: string[] = [];

    const handlers = buildInstanceLifecycleActionHandlers({
      instanceId: 'instance-01',
      runLifecycleAction: async (request) => {
        lifecycleRequests.push(request);
      },
      executeRestart: async (instanceId) => {
        lifecycleExecutions.push(`restart:${instanceId}`);
      },
      executeStop: async (instanceId) => {
        lifecycleExecutions.push(`stop:${instanceId}`);
      },
      executeStart: async (instanceId) => {
        lifecycleExecutions.push(`start:${instanceId}`);
      },
    });

    await handlers.onRestart();
    await handlers.onStop();
    await handlers.onStart();

    assert.equal(lifecycleRequests.length, 3);
    assert.deepEqual(
      lifecycleRequests.map((request) => ({
        instanceId: request.instanceId,
        successKey: request.successKey,
        failureKey: request.failureKey,
      })),
      [
        {
          instanceId: 'instance-01',
          successKey: 'instances.detail.toasts.restarted',
          failureKey: 'instances.detail.toasts.failedToRestart',
        },
        {
          instanceId: 'instance-01',
          successKey: 'instances.detail.toasts.stopped',
          failureKey: 'instances.detail.toasts.failedToStop',
        },
        {
          instanceId: 'instance-01',
          successKey: 'instances.detail.toasts.started',
          failureKey: 'instances.detail.toasts.failedToStart',
        },
      ],
    );

    await lifecycleRequests[0].execute(lifecycleRequests[0].instanceId);
    await lifecycleRequests[1].execute(lifecycleRequests[1].instanceId);
    await lifecycleRequests[2].execute(lifecycleRequests[2].instanceId);

    assert.deepEqual(lifecycleExecutions, [
      'restart:instance-01',
      'stop:instance-01',
      'start:instance-01',
    ]);

    const skippedHandlers = buildInstanceLifecycleActionHandlers({
      instanceId: undefined,
      runLifecycleAction: async (request) => {
        lifecycleRequests.push(request);
      },
      executeRestart: async () => undefined,
      executeStop: async () => undefined,
      executeStart: async () => undefined,
    });

    await skippedHandlers.onRestart();
    await skippedHandlers.onStop();
    await skippedHandlers.onStart();

    assert.equal(lifecycleRequests.length, 3);
  },
);

await runTest(
  'buildBundledStartupRecoveryHandler retries bundled OpenClaw startup through the lifecycle runner and prefers restart when available',
  async () => {
    const { buildBundledStartupRecoveryHandler } =
      await loadInstanceLifecycleActionSupportModule();
    const lifecycleRequests: any[] = [];
    const executions: string[] = [];

    const onRetryViaStart = buildBundledStartupRecoveryHandler({
      instanceId: 'instance-01',
      canRetryBundledStartup: true,
      preferRestart: false,
      runLifecycleAction: async (request) => {
        lifecycleRequests.push(request);
      },
      executeRestart: async (instanceId) => {
        executions.push(`restart:${instanceId}`);
      },
      executeStart: async (instanceId) => {
        executions.push(`start:${instanceId}`);
      },
    });

    await onRetryViaStart();

    assert.equal(lifecycleRequests.length, 1);
    assert.deepEqual(
      {
        instanceId: lifecycleRequests[0].instanceId,
        successKey: lifecycleRequests[0].successKey,
        failureKey: lifecycleRequests[0].failureKey,
      },
      {
        instanceId: 'instance-01',
        successKey: 'instances.detail.toasts.retriedBundledStartup',
        failureKey: 'instances.detail.toasts.failedToRetryBundledStartup',
      },
    );

    await lifecycleRequests[0].execute(lifecycleRequests[0].instanceId);

    assert.deepEqual(executions, ['start:instance-01']);

    const onRetryViaRestart = buildBundledStartupRecoveryHandler({
      instanceId: 'instance-01',
      canRetryBundledStartup: true,
      preferRestart: true,
      runLifecycleAction: async (request) => {
        lifecycleRequests.push(request);
      },
      executeRestart: async (instanceId) => {
        executions.push(`restart:${instanceId}`);
      },
      executeStart: async (instanceId) => {
        executions.push(`start:${instanceId}`);
      },
    });

    await onRetryViaRestart();
    await lifecycleRequests[1].execute(lifecycleRequests[1].instanceId);

    assert.deepEqual(executions, ['start:instance-01', 'restart:instance-01']);

    const skipped = buildBundledStartupRecoveryHandler({
      instanceId: 'instance-01',
      canRetryBundledStartup: false,
      preferRestart: false,
      runLifecycleAction: async (request) => {
        lifecycleRequests.push(request);
      },
      executeRestart: async () => undefined,
      executeStart: async () => undefined,
    });

    await skipped();

    assert.equal(lifecycleRequests.length, 2);
  },
);

await runTest(
  'buildInstanceConsoleHandlers opens resolved console targets, reports manual-login hints, and passes official links through unchanged',
  async () => {
    const { buildInstanceConsoleHandlers } = await loadInstanceLifecycleActionSupportModule();
    const openedUrls: string[] = [];
    const infoMessages: string[] = [];
    const errorMessages: string[] = [];

    const handlers = buildInstanceConsoleHandlers({
      consoleTarget: {
        url: 'https://console.example.com',
        autoLoginUrl: null,
        reason: 'OpenClaw requires manual sign-in.',
      },
      openExternalLink: async (href) => {
        openedUrls.push(href);
      },
      reportInfo: (message) => {
        infoMessages.push(message);
      },
      reportError: (message) => {
        errorMessages.push(message);
      },
      t: (key: string) => `translated:${key}`,
    });

    await handlers.onOpenControlPage();
    await handlers.onOpenOfficialLink('https://docs.example.com/openclaw');

    assert.deepEqual(openedUrls, [
      'https://console.example.com',
      'https://docs.example.com/openclaw',
    ]);
    assert.deepEqual(infoMessages, ['OpenClaw requires manual sign-in.']);
    assert.deepEqual(errorMessages, []);
  },
);

await runTest(
  'buildInstanceConsoleHandlers keeps missing-target and failed-open errors in the injected page reporters',
  async () => {
    const { buildInstanceConsoleHandlers } = await loadInstanceLifecycleActionSupportModule();
    const errorMessages: string[] = [];

    const missingTargetHandlers = buildInstanceConsoleHandlers({
      consoleTarget: {
        url: null,
        autoLoginUrl: null,
        reason: null,
      },
      openExternalLink: async () => undefined,
      reportInfo: () => undefined,
      reportError: (message) => {
        errorMessages.push(message);
      },
      t: (key: string) => `translated:${key}`,
    });

    await missingTargetHandlers.onOpenControlPage();

    const failingHandlers = buildInstanceConsoleHandlers({
      consoleTarget: {
        url: 'https://console.example.com',
        autoLoginUrl: 'https://console.example.com/autologin',
        reason: 'unused',
      },
      openExternalLink: async () => {
        throw new Error('Open failed.');
      },
      reportInfo: () => undefined,
      reportError: (message) => {
        errorMessages.push(message);
      },
      t: (key: string) => `translated:${key}`,
    });

    await failingHandlers.onOpenControlPage();

    assert.deepEqual(errorMessages, [
      'translated:instances.detail.toasts.failedToOpenControlPage',
      'Open failed.',
    ]);
  },
);

await runTest(
  'buildInstanceDeleteHandler confirms deletion, executes the injected delete action, clears active state, and navigates through page-owned callbacks',
  async () => {
    const { buildInstanceDeleteHandler } = await loadInstanceLifecycleActionSupportModule();
    const callLog: string[] = [];

    const onDelete = buildInstanceDeleteHandler({
      instanceId: 'instance-01',
      canDelete: true,
      activeInstanceId: 'instance-01',
      confirmDelete: (message) => {
        callLog.push(`confirm:${message}`);
        return true;
      },
      executeDelete: async (instanceId) => {
        callLog.push(`delete:${instanceId}`);
      },
      setActiveInstanceId: (instanceId) => {
        callLog.push(`active:${instanceId}`);
      },
      navigateToInstances: () => {
        callLog.push('navigate:/instances');
      },
      reportSuccess: (message) => {
        callLog.push(`success:${message}`);
      },
      reportError: (message) => {
        callLog.push(`error:${message}`);
      },
      t: (key: string) => `translated:${key}`,
    });

    await onDelete();

    assert.deepEqual(callLog, [
      'confirm:translated:instances.detail.confirmUninstall',
      'delete:instance-01',
      'success:translated:instances.detail.toasts.uninstalled',
      'active:null',
      'navigate:/instances',
    ]);
  },
);

await runTest(
  'buildInstanceDeleteHandler skips missing or declined deletes and reports fallback failures through the injected page reporter',
  async () => {
    const { buildInstanceDeleteHandler } = await loadInstanceLifecycleActionSupportModule();
    const callLog: string[] = [];
    const errorMessages: string[] = [];

    const skippedForMissingId = buildInstanceDeleteHandler({
      instanceId: undefined,
      canDelete: true,
      activeInstanceId: 'instance-01',
      confirmDelete: () => {
        callLog.push('confirm:missing');
        return true;
      },
      executeDelete: async () => {
        callLog.push('delete:missing');
      },
      setActiveInstanceId: () => {
        callLog.push('active:missing');
      },
      navigateToInstances: () => {
        callLog.push('navigate:missing');
      },
      reportSuccess: () => {
        callLog.push('success:missing');
      },
      reportError: (message) => {
        errorMessages.push(message);
      },
      t: (key: string) => `translated:${key}`,
    });

    await skippedForMissingId();

    const skippedForDeclinedConfirm = buildInstanceDeleteHandler({
      instanceId: 'instance-01',
      canDelete: true,
      activeInstanceId: null,
      confirmDelete: (message) => {
        callLog.push(`confirm:${message}`);
        return false;
      },
      executeDelete: async () => {
        callLog.push('delete:declined');
      },
      setActiveInstanceId: () => {
        callLog.push('active:declined');
      },
      navigateToInstances: () => {
        callLog.push('navigate:declined');
      },
      reportSuccess: () => {
        callLog.push('success:declined');
      },
      reportError: (message) => {
        errorMessages.push(message);
      },
      t: (key: string) => `translated:${key}`,
    });

    await skippedForDeclinedConfirm();

    const failingDelete = buildInstanceDeleteHandler({
      instanceId: 'instance-02',
      canDelete: true,
      activeInstanceId: 'instance-01',
      confirmDelete: () => true,
      executeDelete: async () => {
        throw new Error('');
      },
      setActiveInstanceId: () => {
        callLog.push('active:failed');
      },
      navigateToInstances: () => {
        callLog.push('navigate:failed');
      },
      reportSuccess: () => {
        callLog.push('success:failed');
      },
      reportError: (message) => {
        errorMessages.push(message);
      },
      t: (key: string) => `translated:${key}`,
    });

    await failingDelete();

    assert.deepEqual(callLog, [
      'confirm:translated:instances.detail.confirmUninstall',
    ]);
    assert.deepEqual(errorMessages, [
      'translated:instances.detail.toasts.failedToUninstall',
    ]);
  },
);
