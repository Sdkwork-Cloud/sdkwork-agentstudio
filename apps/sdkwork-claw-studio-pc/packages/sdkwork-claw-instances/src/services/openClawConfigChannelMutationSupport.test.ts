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

async function loadConfigChannelMutationSupportModule() {
  const moduleUrl = new URL('./openClawConfigChannelMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected openClawConfigChannelMutationSupport.ts to exist',
  );

  return import('./openClawConfigChannelMutationSupport.ts');
}

function createConfigChannelFixture() {
  return {
    id: 'telegram',
    name: 'Telegram',
    description: 'Telegram bridge',
    status: 'connected',
    enabled: true,
    configurationMode: 'required',
    fieldCount: 2,
    configuredFieldCount: 1,
    setupSteps: ['Configure bot'],
    values: {
      botToken: 'baseline-token',
      webhookUrl: '',
    },
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        placeholder: '123456:AA...',
        required: true,
      },
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://example.com/telegram/webhook',
        required: true,
      },
    ],
  } as any;
}

await runTest(
  'applyOpenClawConfigChannelDraftChange patches the selected channel draft while preserving sibling values',
  async () => {
    const { applyOpenClawConfigChannelDraftChange } =
      await loadConfigChannelMutationSupportModule();
    const channel = createConfigChannelFixture();

    const nextDrafts = applyOpenClawConfigChannelDraftChange({
      drafts: {
        telegram: {
          botToken: 'current-token',
          webhookUrl: '',
        },
      },
      channel,
      fieldKey: 'webhookUrl',
      value: 'https://example.com/telegram/webhook',
    });

    assert.deepEqual(nextDrafts, {
      telegram: {
        botToken: 'current-token',
        webhookUrl: 'https://example.com/telegram/webhook',
      },
    });
  },
);

await runTest(
  'buildOpenClawConfigChannelSaveMutationRequest returns required-field validation errors before the page runner executes',
  async () => {
    const { buildOpenClawConfigChannelSaveMutationRequest } =
      await loadConfigChannelMutationSupportModule();
    const setSaving = (value: boolean) => value;
    const setError = (value: string | null) => value;

    const result = buildOpenClawConfigChannelSaveMutationRequest({
      instanceId: 'instance-01',
      channel: createConfigChannelFixture(),
      draft: {
        botToken: 'configured-token',
        webhookUrl: '   ',
      },
      setSaving,
      setError,
      afterSuccess: () => undefined,
    });

    assert.deepEqual(result, {
      kind: 'error',
      errorMessage: 'Webhook URL is required.',
    });
  },
);

await runTest(
  'buildOpenClawConfigChannelSaveMutationRequest packages save-config request metadata for the page shell',
  async () => {
    const { buildOpenClawConfigChannelSaveMutationRequest } =
      await loadConfigChannelMutationSupportModule();
    const channel = createConfigChannelFixture();
    const setSaving = (value: boolean) => value;
    const setError = (value: string | null) => value;
    const afterSuccess = () => undefined;

    const result = buildOpenClawConfigChannelSaveMutationRequest({
      instanceId: 'instance-01',
      channel,
      draft: {
        botToken: 'configured-token',
        webhookUrl: 'https://example.com/telegram/webhook',
      },
      setSaving,
      setError,
      afterSuccess,
    });

    assert.equal(result.kind, 'mutation');
    assert.equal(result.request.setSaving, setSaving);
    assert.equal(result.request.setError, setError);
    assert.equal(result.request.afterSuccess, afterSuccess);
    assert.equal(result.request.successMessage, 'Telegram configuration saved.');
    assert.equal(result.request.failureMessage, 'Failed to save Telegram.');
    assert.deepEqual(result.request.mutationPlan, {
      kind: 'saveConfig',
      instanceId: 'instance-01',
      channelId: 'telegram',
      values: {
        botToken: 'configured-token',
        webhookUrl: 'https://example.com/telegram/webhook',
      },
    });
  },
);

await runTest(
  'config channel toggle and delete requests preserve page-owned lifecycle metadata and empty-value shaping',
  async () => {
    const {
      buildOpenClawConfigChannelDeleteMutationRequest,
      buildOpenClawConfigChannelToggleMutationRequest,
    } = await loadConfigChannelMutationSupportModule();
    const channel = createConfigChannelFixture();
    const clearSelection = () => undefined;

    const toggleResult = buildOpenClawConfigChannelToggleMutationRequest({
      instanceId: 'instance-01',
      channel,
      nextEnabled: false,
    });

    assert.equal(toggleResult.kind, 'mutation');
    assert.equal(toggleResult.request.successMessage, 'Telegram disabled.');
    assert.equal(toggleResult.request.failureMessage, 'Failed to update Telegram.');
    assert.deepEqual(toggleResult.request.mutationPlan, {
      kind: 'toggleEnabled',
      instanceId: 'instance-01',
      channelId: 'telegram',
      nextEnabled: false,
    });

    const deleteResult = buildOpenClawConfigChannelDeleteMutationRequest({
      instanceId: 'instance-01',
      channel,
      setSaving: (value: boolean) => value,
      setError: (value: string | null) => value,
      afterSuccess: clearSelection,
    });

    assert.equal(deleteResult.kind, 'mutation');
    assert.equal(deleteResult.request.afterSuccess, clearSelection);
    assert.equal(deleteResult.request.successMessage, 'Telegram configuration removed.');
    assert.equal(deleteResult.request.failureMessage, 'Failed to delete Telegram configuration.');
    assert.deepEqual(deleteResult.request.mutationPlan, {
      kind: 'deleteConfig',
      instanceId: 'instance-01',
      channelId: 'telegram',
      emptyValues: {
        botToken: '',
        webhookUrl: '',
      },
    });
  },
);

await runTest(
  'createOpenClawConfigChannelMutationRunner composes page-owned transport bindings and spinnerless reload behavior',
  async () => {
    const { createOpenClawConfigChannelMutationRunner } =
      await loadConfigChannelMutationSupportModule();
    const savingStates: boolean[] = [];
    const clearedErrors: Array<string | null> = [];
    const callLog: string[] = [];

    const runConfigChannelMutation = createOpenClawConfigChannelMutationRunner({
      executeSaveConfig: async (instanceId: string, channelId: string, values: Record<string, string>) => {
        callLog.push(`save:${instanceId}:${channelId}:${values.botToken}:${values.webhookUrl}`);
      },
      executeToggleEnabled: async (instanceId: string, channelId: string, nextEnabled: boolean) => {
        callLog.push(`toggle:${instanceId}:${channelId}:${nextEnabled}`);
      },
      reloadWorkbench: async (
        instanceId: string,
        options: {
          withSpinner: boolean;
        },
      ) => {
        callLog.push(`reload:${instanceId}:${options.withSpinner}`);
      },
      reportSuccess: (message: string) => {
        callLog.push(`success:${message}`);
      },
      reportError: (message: string) => {
        callLog.push(`error:${message}`);
      },
    });

    await runConfigChannelMutation({
      mutationPlan: {
        kind: 'saveConfig',
        instanceId: 'instance-01',
        channelId: 'telegram',
        values: {
          botToken: 'configured-token',
          webhookUrl: 'https://example.com/telegram/webhook',
        },
      },
      successMessage: 'Telegram configuration saved.',
      failureMessage: 'Failed to save Telegram.',
      setSaving: (value: boolean) => {
        savingStates.push(value);
      },
      setError: (value: string | null) => {
        clearedErrors.push(value);
      },
    });

    assert.deepEqual(savingStates, [true, false]);
    assert.deepEqual(clearedErrors, [null]);
    assert.deepEqual(callLog, [
      'save:instance-01:telegram:configured-token:https://example.com/telegram/webhook',
      'success:Telegram configuration saved.',
      'reload:instance-01:false',
    ]);
  },
);

await runTest(
  'runOpenClawConfigChannelMutation executes injected save/toggle actions, reloads the workbench, and preserves page-owned saving hooks',
  async () => {
    const { runOpenClawConfigChannelMutation } =
      await loadConfigChannelMutationSupportModule();
    const savingStates: boolean[] = [];
    const clearedErrors: Array<string | null> = [];
    const callLog: string[] = [];

    await runOpenClawConfigChannelMutation({
      request: {
        mutationPlan: {
          kind: 'deleteConfig',
          instanceId: 'instance-01',
          channelId: 'telegram',
          emptyValues: {
            botToken: '',
            webhookUrl: '',
          },
        },
        successMessage: 'Telegram configuration removed.',
        failureMessage: 'Failed to delete Telegram configuration.',
        setSaving: (value: boolean) => {
          savingStates.push(value);
        },
        setError: (value: string | null) => {
          clearedErrors.push(value);
        },
        afterSuccess: () => {
          callLog.push('afterSuccess');
        },
      },
      executeSaveConfig: async (instanceId: string, channelId: string, values: Record<string, string>) => {
        callLog.push(`save:${instanceId}:${channelId}:${values.botToken}:${values.webhookUrl}`);
      },
      executeToggleEnabled: async (instanceId: string, channelId: string, nextEnabled: boolean) => {
        callLog.push(`toggle:${instanceId}:${channelId}:${nextEnabled}`);
      },
      reloadWorkbench: async (instanceId: string) => {
        callLog.push(`reload:${instanceId}`);
      },
      reportSuccess: (message: string) => {
        callLog.push(`success:${message}`);
      },
      reportError: (message: string) => {
        callLog.push(`error:${message}`);
      },
    });

    assert.deepEqual(savingStates, [true, false]);
    assert.deepEqual(clearedErrors, [null]);
    assert.deepEqual(callLog, [
      'save:instance-01:telegram::',
      'toggle:instance-01:telegram:false',
      'success:Telegram configuration removed.',
      'afterSuccess',
      'reload:instance-01',
    ]);
  },
);

await runTest(
  'runOpenClawConfigChannelMutation surfaces fallback failures through page error state or toast reporter based on request wiring',
  async () => {
    const { runOpenClawConfigChannelMutation } =
      await loadConfigChannelMutationSupportModule();
    const managedErrors: Array<string | null> = [];
    const toastErrors: string[] = [];

    await runOpenClawConfigChannelMutation({
      request: {
        mutationPlan: {
          kind: 'saveConfig',
          instanceId: 'instance-01',
          channelId: 'telegram',
          values: {
            botToken: 'configured-token',
            webhookUrl: 'https://example.com/telegram/webhook',
          },
        },
        successMessage: 'unused',
        failureMessage: 'Failed to save Telegram.',
        setError: (value: string | null) => {
          managedErrors.push(value);
        },
      },
      executeSaveConfig: async () => {
        throw new Error('');
      },
      executeToggleEnabled: async () => undefined,
      reloadWorkbench: async () => undefined,
      reportSuccess: () => undefined,
      reportError: (message: string) => {
        toastErrors.push(message);
      },
    });

    await runOpenClawConfigChannelMutation({
      request: {
        mutationPlan: {
          kind: 'toggleEnabled',
          instanceId: 'instance-01',
          channelId: 'telegram',
          nextEnabled: true,
        },
        successMessage: 'unused',
        failureMessage: 'Failed to update Telegram.',
      },
      executeSaveConfig: async () => undefined,
      executeToggleEnabled: async () => {
        throw new Error('');
      },
      reloadWorkbench: async () => undefined,
      reportSuccess: () => undefined,
      reportError: (message: string) => {
        toastErrors.push(message);
      },
    });

    assert.deepEqual(managedErrors, [null, 'Failed to save Telegram.']);
    assert.deepEqual(toastErrors, ['Failed to update Telegram.']);
  },
);

await runTest(
  'buildOpenClawConfigChannelMutationHandlers routes toggle, save, and delete through injected page-owned mutation execution and draft resets',
  async () => {
    const { buildOpenClawConfigChannelMutationHandlers } =
      await loadConfigChannelMutationSupportModule();
    const channel = createConfigChannelFixture();
    const executedRequests: any[] = [];
    let selectedConfigChannelId: string | null = 'telegram';
    let configChannelDrafts = {
      telegram: {
        botToken: 'configured-token',
        webhookUrl: 'https://example.com/telegram/webhook',
      },
    };
    const reportedErrors: Array<string | null> = [];

    const handlers = buildOpenClawConfigChannelMutationHandlers({
      instanceId: 'instance-01',
      configChannels: [channel],
      selectedConfigChannel: channel,
      selectedConfigChannelDraft: configChannelDrafts.telegram,
      setSavingConfigChannel: () => undefined,
      setConfigChannelError: (value) => {
        reportedErrors.push(value);
      },
      setSelectedConfigChannelId: (value) => {
        selectedConfigChannelId = value;
      },
      setConfigChannelDrafts: (updater) => {
        configChannelDrafts = updater(configChannelDrafts);
      },
      executeMutation: async (request) => {
        executedRequests.push(request);
      },
    });

    await handlers.onToggleConfigChannel('telegram', false);
    await handlers.onSaveConfigChannel();
    await handlers.onDeleteConfigChannelConfiguration();

    assert.equal(executedRequests.length, 3);
    assert.equal(executedRequests[0].mutationPlan.kind, 'toggleEnabled');
    assert.equal(executedRequests[1].mutationPlan.kind, 'saveConfig');
    assert.equal(executedRequests[1].afterSuccess, handlers.clearSelectedConfigChannelId);
    assert.equal(executedRequests[2].mutationPlan.kind, 'deleteConfig');

    executedRequests[2].afterSuccess?.();

    assert.equal(selectedConfigChannelId, null);
    assert.deepEqual(configChannelDrafts, {
      telegram: {
        botToken: '',
        webhookUrl: '',
      },
    });
    assert.deepEqual(reportedErrors, []);
  },
);

await runTest(
  'buildOpenClawConfigChannelMutationHandlers keeps validation errors in the page and skips unresolved toggle targets',
  async () => {
    const { buildOpenClawConfigChannelMutationHandlers } =
      await loadConfigChannelMutationSupportModule();
    const channel = createConfigChannelFixture();
    const executedRequests: any[] = [];
    const reportedErrors: Array<string | null> = [];

    const handlers = buildOpenClawConfigChannelMutationHandlers({
      instanceId: 'instance-01',
      configChannels: [channel],
      selectedConfigChannel: channel,
      selectedConfigChannelDraft: {
        botToken: 'configured-token',
        webhookUrl: '   ',
      },
      setSavingConfigChannel: () => undefined,
      setConfigChannelError: (value) => {
        reportedErrors.push(value);
      },
      setSelectedConfigChannelId: () => undefined,
      setConfigChannelDrafts: () => undefined,
      executeMutation: async (request) => {
        executedRequests.push(request);
      },
    });

    await handlers.onToggleConfigChannel('missing-channel', true);
    await handlers.onSaveConfigChannel();

    assert.deepEqual(executedRequests, []);
    assert.deepEqual(reportedErrors, ['Webhook URL is required.']);
  },
);
