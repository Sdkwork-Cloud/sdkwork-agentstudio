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

async function loadProviderCatalogMutationSupportModule() {
  const moduleUrl = new URL('./openClawProviderCatalogMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected openClawProviderCatalogMutationSupport.ts to exist',
  );

  return import('./openClawProviderCatalogMutationSupport.ts');
}

await runTest(
  'buildOpenClawProviderConfigMutationRequest builds provider-config mutation execution metadata for the page shell',
  async () => {
    const { buildOpenClawProviderConfigMutationRequest } =
      await loadProviderCatalogMutationSupportModule();
    const setSaving = (value: boolean) => value;

    const result = buildOpenClawProviderConfigMutationRequest({
      isReadonly: false,
      instanceId: 'instance-01',
      selectedProvider: {
        id: 'provider-01',
      } as any,
      selectedProviderDraft: {
        endpoint: ' https://router.example.com/v1 ',
        apiKeySource: ' env:OPENAI_API_KEY ',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: '',
        config: {
          temperature: 0.3,
          topP: 0.9,
          maxTokens: 4096,
          timeoutMs: 120000,
          streaming: true,
        },
      },
      requestOverridesText: '{ headers: { "x-trace-id": "trace-1" } }',
      setSaving,
      t: (key: string) => `translated:${key}`,
    });

    assert.equal(result.kind, 'mutation');
    assert.equal(result.request.setSaving, setSaving);
    assert.equal(result.request.withSpinner, true);
    assert.deepEqual(result.request.mutationPlan, {
      kind: 'providerConfigUpdate',
      instanceId: 'instance-01',
      providerId: 'provider-01',
      providerUpdate: {
        endpoint: 'https://router.example.com/v1',
        apiKeySource: 'env:OPENAI_API_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: undefined,
        config: {
          temperature: 0.3,
          topP: 0.9,
          maxTokens: 4096,
          timeoutMs: 120000,
          streaming: true,
          request: {
            headers: {
              'x-trace-id': 'trace-1',
            },
          },
        },
      },
      selectedProviderId: 'provider-01',
      successKey: 'instances.detail.instanceWorkbench.llmProviders.saved',
      failureKey: 'instances.detail.instanceWorkbench.llmProviders.saveFailed',
    });
  },
);

await runTest(
  'buildOpenClawProviderDialogMutationRequest returns translated validation errors and preserves dialog success hooks',
  async () => {
    const { buildOpenClawProviderDialogMutationRequest } =
      await loadProviderCatalogMutationSupportModule();
    const afterSuccess = () => undefined;
    const setSaving = (value: boolean) => value;

    assert.deepEqual(
      buildOpenClawProviderDialogMutationRequest({
        isReadonly: false,
        instanceId: 'instance-01',
        providerDialogDraft: {
          id: '   ',
          name: '',
          endpoint: '',
          apiKeySource: '',
          defaultModelId: '',
          reasoningModelId: '',
          embeddingModelId: '',
          modelsText: '',
          requestOverridesText: '',
        },
        providerDialogModels: [],
        afterSuccess,
        setSaving,
        t: (key: string) => `translated:${key}`,
      }),
      {
        kind: 'error',
        errorMessage:
          'translated:instances.detail.instanceWorkbench.llmProviders.toasts.providerIdRequired',
      },
    );

    const successResult = buildOpenClawProviderDialogMutationRequest({
      isReadonly: false,
      instanceId: 'instance-01',
      providerDialogDraft: {
        id: 'openai-router',
        name: 'Shared Router',
        endpoint: 'https://router.example.com/v1',
        apiKeySource: 'env:OPENAI_API_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: '',
        embeddingModelId: '',
        modelsText: 'gpt-5.4=GPT-5.4',
        requestOverridesText: '',
      },
      providerDialogModels: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
      afterSuccess,
      setSaving,
      t: (key: string) => `translated:${key}`,
    });

    assert.equal(successResult.kind, 'mutation');
    assert.equal(successResult.request.afterSuccess, afterSuccess);
    assert.equal(successResult.request.setSaving, setSaving);
    assert.equal(successResult.request.withSpinner, undefined);
    assert.equal(successResult.request.mutationPlan.kind, 'providerCreate');
  },
);

await runTest(
  'buildOpenClawProviderModelMutationRequest translates save failures and preserves model-dialog lifecycle metadata',
  async () => {
    const { buildOpenClawProviderModelMutationRequest } =
      await loadProviderCatalogMutationSupportModule();
    const afterSuccess = () => undefined;
    const setSaving = (value: boolean) => value;

    assert.deepEqual(
      buildOpenClawProviderModelMutationRequest({
        isReadonly: false,
        instanceId: 'instance-01',
        selectedProvider: {
          id: 'provider-01',
        } as any,
        providerModelDialogDraft: {
          id: '   ',
          name: '',
        },
        afterSuccess,
        setSaving,
        t: (key: string) => `translated:${key}`,
      }),
      {
        kind: 'error',
        errorMessage:
          'translated:instances.detail.instanceWorkbench.llmProviders.toasts.modelIdRequired',
      },
    );

    const successResult = buildOpenClawProviderModelMutationRequest({
      isReadonly: false,
      instanceId: 'instance-01',
      selectedProvider: {
        id: 'provider-01',
      } as any,
      providerModelDialogDraft: {
        originalId: 'o4-mini',
        id: 'o4-mini-high',
        name: 'o4-mini High',
      },
      afterSuccess,
      setSaving,
      t: (key: string) => `translated:${key}`,
    });

    assert.equal(successResult.kind, 'mutation');
    assert.equal(successResult.request.afterSuccess, afterSuccess);
    assert.equal(successResult.request.setSaving, setSaving);
    assert.deepEqual(successResult.request.mutationPlan, {
      kind: 'providerModelUpdate',
      instanceId: 'instance-01',
      providerId: 'provider-01',
      originalId: 'o4-mini',
      model: {
        id: 'o4-mini-high',
        name: 'o4-mini High',
      },
      selectedProviderId: 'provider-01',
      successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelUpdated',
      failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelSaveFailed',
    });
  },
);

await runTest(
  'provider delete mutation requests skip missing prerequisites and preserve after-success cleanup hooks',
  async () => {
    const {
      buildOpenClawProviderDeleteMutationRequest,
      buildOpenClawProviderModelDeleteMutationRequest,
    } = await loadProviderCatalogMutationSupportModule();
    const clearProviderDeleteId = () => undefined;
    const clearProviderModelDeleteId = () => undefined;

    assert.deepEqual(
      buildOpenClawProviderDeleteMutationRequest({
        isReadonly: false,
        instanceId: undefined,
        providerDeleteId: 'provider-01',
        afterSuccess: clearProviderDeleteId,
      }),
      {
        kind: 'skip',
      },
    );

    const providerDeleteResult = buildOpenClawProviderDeleteMutationRequest({
      isReadonly: false,
      instanceId: 'instance-01',
      providerDeleteId: 'provider-01',
      afterSuccess: clearProviderDeleteId,
    });

    assert.equal(providerDeleteResult.kind, 'mutation');
    assert.equal(providerDeleteResult.request.afterSuccess, clearProviderDeleteId);
    assert.deepEqual(providerDeleteResult.request.mutationPlan, {
      kind: 'providerDelete',
      instanceId: 'instance-01',
      providerId: 'provider-01',
      selectedProviderId: null,
      successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerRemoved',
      failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerDeleteFailed',
    });

    const providerModelDeleteResult = buildOpenClawProviderModelDeleteMutationRequest({
      isReadonly: false,
      instanceId: 'instance-01',
      selectedProvider: {
        id: 'provider-01',
      } as any,
      providerModelDeleteId: 'o4-mini',
      afterSuccess: clearProviderModelDeleteId,
    });

    assert.equal(providerModelDeleteResult.kind, 'mutation');
    assert.equal(providerModelDeleteResult.request.afterSuccess, clearProviderModelDeleteId);
    assert.deepEqual(providerModelDeleteResult.request.mutationPlan, {
      kind: 'providerModelDelete',
      instanceId: 'instance-01',
      providerId: 'provider-01',
      modelId: 'o4-mini',
      selectedProviderId: 'provider-01',
      successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelRemoved',
      failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelDeleteFailed',
    });
  },
);

await runTest(
  'createOpenClawProviderCatalogMutationRunner executes injected provider mutations, reloads the workbench, and preserves page-owned selection hooks',
  async () => {
    const { createOpenClawProviderCatalogMutationRunner } =
      await loadProviderCatalogMutationSupportModule();
    const savingStates: boolean[] = [];
    const selectedProviderIds: Array<string | null> = [];
    const callLog: string[] = [];

    const runProviderCatalogMutation = createOpenClawProviderCatalogMutationRunner({
      executeProviderConfigUpdate: async (instanceId, providerId, providerUpdate) => {
        callLog.push(
          `config:${instanceId}:${providerId}:${providerUpdate.endpoint}:${providerUpdate.defaultModelId}`,
        );
      },
      executeProviderCreate: async () => undefined,
      executeProviderModelUpdate: async () => undefined,
      executeProviderModelCreate: async () => undefined,
      executeProviderModelDelete: async () => undefined,
      executeProviderDelete: async () => undefined,
      reloadWorkbench: async (instanceId, options) => {
        callLog.push(`reload:${instanceId}:${options.withSpinner}`);
      },
      setSelectedProviderId: (providerId) => {
        selectedProviderIds.push(providerId);
      },
      reportSuccess: (message) => {
        callLog.push(`success:${message}`);
      },
      reportError: (message) => {
        callLog.push(`error:${message}`);
      },
      t: (key: string) => `translated:${key}`,
    });

    await runProviderCatalogMutation({
      mutationPlan: {
        kind: 'providerConfigUpdate',
        instanceId: 'instance-01',
        providerId: 'provider-01',
        providerUpdate: {
          endpoint: 'https://router.example.com/v1',
          apiKeySource: 'env:OPENAI_API_KEY',
          defaultModelId: 'gpt-5.4',
        } as any,
        selectedProviderId: 'provider-01',
        successKey: 'instances.detail.instanceWorkbench.llmProviders.saved',
        failureKey: 'instances.detail.instanceWorkbench.llmProviders.saveFailed',
      },
      setSaving: (value: boolean) => {
        savingStates.push(value);
      },
      afterSuccess: () => {
        callLog.push('afterSuccess');
      },
      withSpinner: true,
    });

    assert.deepEqual(savingStates, [true, false]);
    assert.deepEqual(selectedProviderIds, ['provider-01']);
    assert.deepEqual(callLog, [
      'config:instance-01:provider-01:https://router.example.com/v1:gpt-5.4',
      'success:translated:instances.detail.instanceWorkbench.llmProviders.saved',
      'afterSuccess',
      'reload:instance-01:true',
    ]);
  },
);

await runTest(
  'createOpenClawProviderCatalogMutationRunner reports translated failures when injected provider mutations throw',
  async () => {
    const { createOpenClawProviderCatalogMutationRunner } =
      await loadProviderCatalogMutationSupportModule();
    const reportedErrors: string[] = [];

    const runProviderCatalogMutation = createOpenClawProviderCatalogMutationRunner({
      executeProviderConfigUpdate: async () => undefined,
      executeProviderCreate: async () => {
        throw new Error('');
      },
      executeProviderModelUpdate: async () => undefined,
      executeProviderModelCreate: async () => undefined,
      executeProviderModelDelete: async () => undefined,
      executeProviderDelete: async () => undefined,
      reloadWorkbench: async () => undefined,
      setSelectedProviderId: () => undefined,
      reportSuccess: () => undefined,
      reportError: (message) => {
        reportedErrors.push(message);
      },
      t: (key: string) => `translated:${key}`,
    });

    await runProviderCatalogMutation({
      mutationPlan: {
        kind: 'providerCreate',
        instanceId: 'instance-01',
        providerInput: {
          id: 'provider-01',
          name: 'Provider 01',
          endpoint: 'https://router.example.com/v1',
          apiKeySource: 'env:OPENAI_API_KEY',
          models: [],
        },
        selection: undefined,
        selectedProviderId: 'provider-01',
        successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerCreated',
        failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerCreateFailed',
      },
    });

    assert.deepEqual(reportedErrors, [
      'translated:instances.detail.instanceWorkbench.llmProviders.toasts.providerCreateFailed',
    ]);
  },
);

await runTest(
  'runOpenClawProviderCatalogMutationBuildResult routes skip, error, and mutation results without taking page-owned error authority',
  async () => {
    const { runOpenClawProviderCatalogMutationBuildResult } =
      await loadProviderCatalogMutationSupportModule();
    const callLog: string[] = [];

    await runOpenClawProviderCatalogMutationBuildResult({
      mutationResult: {
        kind: 'skip',
      },
      executeMutation: async () => {
        callLog.push('mutation');
      },
      reportError: (message) => {
        callLog.push(`error:${message}`);
      },
    });

    await runOpenClawProviderCatalogMutationBuildResult({
      mutationResult: {
        kind: 'error',
        errorMessage: 'bad-request',
      },
      executeMutation: async () => {
        callLog.push('mutation');
      },
      reportError: (message) => {
        callLog.push(`error:${message}`);
      },
    });

    await runOpenClawProviderCatalogMutationBuildResult({
      mutationResult: {
        kind: 'mutation',
        request: {
          mutationPlan: {
            kind: 'providerDelete',
            instanceId: 'instance-01',
            providerId: 'provider-01',
            selectedProviderId: null,
            successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerRemoved',
            failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerDeleteFailed',
          },
        },
      },
      executeMutation: async () => {
        callLog.push('mutation');
      },
      reportError: (message) => {
        callLog.push(`error:${message}`);
      },
    });

    assert.deepEqual(callLog, ['error:bad-request', 'mutation']);
  },
);

await runTest(
  'buildOpenClawProviderMutationHandlers composes provider page handlers from shared request builders and mutation dispatch support',
  async () => {
    const { buildOpenClawProviderMutationHandlers } =
      await loadProviderCatalogMutationSupportModule();
    const callLog: string[] = [];

    const handlers = buildOpenClawProviderMutationHandlers({
      isReadonly: false,
      instanceId: 'instance-01',
      selectedProvider: {
        id: 'provider-01',
      } as any,
      selectedProviderDraft: {
        endpoint: 'https://router.example.com/v1',
        apiKeySource: 'env:OPENAI_API_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: undefined,
        embeddingModelId: undefined,
        config: {
          temperature: 0.2,
        },
      },
      selectedProviderRequestDraft: '{ temperature: 0.2 }',
      setSavingProviderConfig: (value: boolean) => {
        callLog.push(`saving-config:${value}`);
      },
      providerDialogDraft: {
        id: 'provider-02',
        name: 'Provider 02',
        endpoint: 'https://provider-02.example.com/v1',
        apiKeySource: 'env:PROVIDER_02_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: '',
        embeddingModelId: '',
        modelsText: 'gpt-5.4=GPT-5.4',
        requestOverridesText: '',
      },
      providerDialogModels: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
      dismissProviderDialog: () => {
        callLog.push('dismiss-provider-dialog');
      },
      setSavingProviderDialog: (value: boolean) => {
        callLog.push(`saving-provider-dialog:${value}`);
      },
      providerModelDialogDraft: {
        id: 'o4-mini',
        name: 'o4-mini',
      },
      dismissProviderModelDialog: () => {
        callLog.push('dismiss-provider-model-dialog');
      },
      setSavingProviderModelDialog: (value: boolean) => {
        callLog.push(`saving-provider-model-dialog:${value}`);
      },
      providerModelDeleteId: 'o4-mini',
      clearProviderModelDeleteId: () => {
        callLog.push('clear-provider-model-delete-id');
      },
      providerDeleteId: 'provider-01',
      clearProviderDeleteId: () => {
        callLog.push('clear-provider-delete-id');
      },
      executeMutation: async (request) => {
        callLog.push(`mutation:${request.mutationPlan.kind}`);
        request.afterSuccess?.();
      },
      reportError: (message) => {
        callLog.push(`error:${message}`);
      },
      t: (key: string) => `translated:${key}`,
    });

    await handlers.onSaveProviderConfig();
    await handlers.onSubmitProviderDialog();
    await handlers.onSubmitProviderModelDialog();
    await handlers.onDeleteProviderModel();
    await handlers.onDeleteProvider();

    const invalidHandlers = buildOpenClawProviderMutationHandlers({
      isReadonly: false,
      instanceId: 'instance-01',
      selectedProvider: {
        id: 'provider-01',
      } as any,
      selectedProviderDraft: null,
      selectedProviderRequestDraft: '',
      setSavingProviderConfig: () => undefined,
      providerDialogDraft: {
        id: '   ',
        name: '',
        endpoint: '',
        apiKeySource: '',
        defaultModelId: '',
        reasoningModelId: '',
        embeddingModelId: '',
        modelsText: '',
        requestOverridesText: '',
      },
      providerDialogModels: [],
      dismissProviderDialog: () => undefined,
      setSavingProviderDialog: () => undefined,
      providerModelDialogDraft: {
        id: '   ',
        name: '',
      },
      dismissProviderModelDialog: () => undefined,
      setSavingProviderModelDialog: () => undefined,
      providerModelDeleteId: null,
      clearProviderModelDeleteId: () => undefined,
      providerDeleteId: null,
      clearProviderDeleteId: () => undefined,
      executeMutation: async () => {
        callLog.push('unexpected-mutation');
      },
      reportError: (message) => {
        callLog.push(`invalid-error:${message}`);
      },
      t: (key: string) => `translated:${key}`,
    });

    await invalidHandlers.onSubmitProviderDialog();
    await invalidHandlers.onSubmitProviderModelDialog();
    await invalidHandlers.onDeleteProviderModel();
    await invalidHandlers.onDeleteProvider();

    assert.deepEqual(callLog, [
      'mutation:providerConfigUpdate',
      'mutation:providerCreate',
      'dismiss-provider-dialog',
      'mutation:providerModelCreate',
      'dismiss-provider-model-dialog',
      'mutation:providerModelDelete',
      'clear-provider-model-delete-id',
      'mutation:providerDelete',
      'clear-provider-delete-id',
      'invalid-error:translated:instances.detail.instanceWorkbench.llmProviders.toasts.providerIdRequired',
      'invalid-error:translated:instances.detail.instanceWorkbench.llmProviders.toasts.modelIdRequired',
    ]);
  },
);
