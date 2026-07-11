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

async function loadConfigMutationSupportModule() {
  const moduleUrl = new URL('./openClawConfigMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected openClawConfigMutationSupport.ts to exist',
  );

  return import('./openClawConfigMutationSupport.ts');
}

await runTest(
  'createOpenClawConfigSaveRunner executes the injected save action, reloads the workbench, and preserves page-owned saving hooks',
  async () => {
    const { createOpenClawConfigSaveRunner } =
      await loadConfigMutationSupportModule();
    const savingStates: boolean[] = [];
    const clearedErrors: Array<string | null> = [];
    const callLog: string[] = [];

    const runConfigSave = createOpenClawConfigSaveRunner({
      reloadWorkbench: async (instanceId, options) => {
        callLog.push(`reload:${instanceId}:${options.withSpinner}`);
      },
      reportSuccess: (message) => {
        callLog.push(`success:${message}`);
      },
      t: (key: string) => `translated:${key}`,
    });

    await runConfigSave({
      instanceId: 'instance-01',
      setSaving: (value: boolean) => {
        savingStates.push(value);
      },
      setError: (value: string | null) => {
        clearedErrors.push(value);
      },
      save: async () => {
        callLog.push('save:webSearch');
      },
      successKey: 'instances.detail.instanceWorkbench.webSearch.toasts.saved',
      failureKey: 'instances.detail.instanceWorkbench.webSearch.toasts.saveFailed',
    });

    assert.deepEqual(savingStates, [true, false]);
    assert.deepEqual(clearedErrors, [null]);
    assert.deepEqual(callLog, [
      'save:webSearch',
      'success:translated:instances.detail.instanceWorkbench.webSearch.toasts.saved',
      'reload:instance-01:false',
    ]);
  },
);

await runTest(
  'createOpenClawConfigSaveRunner writes fallback errors through the page error setter',
  async () => {
    const { createOpenClawConfigSaveRunner } =
      await loadConfigMutationSupportModule();
    const reportedErrors: Array<string | null> = [];

    const runConfigSave = createOpenClawConfigSaveRunner({
      reloadWorkbench: async () => undefined,
      reportSuccess: () => undefined,
      t: (key: string) => `translated:${key}`,
    });

    await runConfigSave({
      instanceId: 'instance-01',
      setSaving: () => undefined,
      setError: (value: string | null) => {
        reportedErrors.push(value);
      },
      save: async () => {
        throw new Error('');
      },
      successKey: 'instances.detail.instanceWorkbench.webFetch.toasts.saved',
      failureKey: 'instances.detail.instanceWorkbench.webFetch.toasts.saveFailed',
    });

    assert.deepEqual(reportedErrors, [
      null,
      'translated:instances.detail.instanceWorkbench.webFetch.toasts.saveFailed',
    ]);
  },
);

await runTest(
  'buildOpenClawConfigMutationHandlers exposes shared save handlers for each config surface',
  async () => {
    const { buildOpenClawConfigMutationHandlers } =
      await loadConfigMutationSupportModule();

    const handlers = buildOpenClawConfigMutationHandlers({
      instanceId: 'instance-01',
      executeSaveRequest: async () => undefined,
      t: (key: string) => `translated:${key}`,
      webSearch: {
        sharedDraft: null,
        selectedProvider: null,
        selectedProviderDraft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      xSearch: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      webSearchNativeCodex: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      webFetch: {
        sharedDraft: null,
        fallbackDraft: {
          apiKeySource: '',
          baseUrl: '',
          advancedConfig: '',
        },
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      authCooldowns: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      dreaming: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
    });

    assert.equal(typeof handlers.onSaveWebSearchConfig, 'function');
    assert.equal(typeof handlers.onSaveXSearchConfig, 'function');
    assert.equal(typeof handlers.onSaveWebSearchNativeCodexConfig, 'function');
    assert.equal(typeof handlers.onSaveWebFetchConfig, 'function');
    assert.equal(typeof handlers.onSaveAuthCooldownsConfig, 'function');
    assert.equal(typeof handlers.onSaveDreamingConfig, 'function');
  },
);

await runTest(
  'buildOpenClawConfigMutationHandlers validates webSearch input before invoking the shared save runner',
  async () => {
    const { buildOpenClawConfigMutationHandlers } =
      await loadConfigMutationSupportModule();
    const reportedErrors: Array<string | null> = [];
    const executedRequests: unknown[] = [];

    const handlers = buildOpenClawConfigMutationHandlers({
      instanceId: 'instance-01',
      executeSaveRequest: async (request) => {
        executedRequests.push(request);
      },
      t: (key: string) => `translated:${key}`,
      webSearch: {
        sharedDraft: {
          enabled: true,
          provider: 'searxng',
          maxResults: '0',
          timeoutSeconds: '30',
          cacheTtlMinutes: '15',
        },
        selectedProvider: {
          id: 'searxng',
        },
        selectedProviderDraft: {
          apiKeySource: '',
          baseUrl: '',
          model: '',
          advancedConfig: '{',
        },
        setSaving: () => undefined,
        setError: (value) => {
          reportedErrors.push(value);
        },
        executeSave: async () => undefined,
      },
      xSearch: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      webSearchNativeCodex: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      webFetch: {
        sharedDraft: null,
        fallbackDraft: {
          apiKeySource: '',
          baseUrl: '',
          advancedConfig: '',
        },
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      authCooldowns: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      dreaming: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
    });

    await handlers.onSaveWebSearchConfig();

    assert.deepEqual(reportedErrors, [
      'translated:instances.detail.instanceWorkbench.webSearch.errors.maxResultsInvalid',
    ]);
    assert.deepEqual(executedRequests, []);
  },
);

await runTest(
  'buildOpenClawConfigMutationHandlers packages dreaming saves through the shared save runner while preserving page-owned callbacks',
  async () => {
    const { buildOpenClawConfigMutationHandlers } =
      await loadConfigMutationSupportModule();
    const executedRequests: any[] = [];
    const capturedSaveInputs: any[] = [];
    const setSaving = (value: boolean) => value;
    const setError = (value: string | null) => value;

    const handlers = buildOpenClawConfigMutationHandlers({
      instanceId: 'instance-01',
      executeSaveRequest: async (request) => {
        executedRequests.push(request);
      },
      t: (key: string) => `translated:${key}`,
      webSearch: {
        sharedDraft: null,
        selectedProvider: null,
        selectedProviderDraft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      xSearch: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      webSearchNativeCodex: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      webFetch: {
        sharedDraft: null,
        fallbackDraft: {
          apiKeySource: '',
          baseUrl: '',
          advancedConfig: '',
        },
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      authCooldowns: {
        draft: null,
        setSaving: () => undefined,
        setError: () => undefined,
        executeSave: async () => undefined,
      },
      dreaming: {
        draft: {
          enabled: true,
          frequency: ' 0 3 * * * ',
        },
        setSaving,
        setError,
        executeSave: async (_instanceId, input) => {
          capturedSaveInputs.push(input);
        },
      },
    });

    await handlers.onSaveDreamingConfig();

    assert.equal(executedRequests.length, 1);
    assert.equal(executedRequests[0].instanceId, 'instance-01');
    assert.equal(executedRequests[0].setSaving, setSaving);
    assert.equal(executedRequests[0].setError, setError);
    assert.equal(
      executedRequests[0].successKey,
      'instances.detail.instanceWorkbench.dreaming.toasts.saved',
    );
    assert.equal(
      executedRequests[0].failureKey,
      'instances.detail.instanceWorkbench.dreaming.toasts.saveFailed',
    );

    await executedRequests[0].save();

    assert.deepEqual(capturedSaveInputs, [
      {
        enabled: true,
        frequency: '0 3 * * *',
      },
    ]);
  },
);
