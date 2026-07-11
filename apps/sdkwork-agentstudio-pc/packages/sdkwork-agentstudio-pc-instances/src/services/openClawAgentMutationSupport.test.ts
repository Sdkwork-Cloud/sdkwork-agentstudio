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

async function loadAgentMutationSupportModule() {
  const moduleUrl = new URL('./openClawAgentMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected openClawAgentMutationSupport.ts to exist',
  );

  return import('./openClawAgentMutationSupport.ts');
}

async function loadAgentPresentationModule() {
  return import('./openClawAgentPresentation.ts');
}

await runTest(
  'createOpenClawAgentMutationRunner awaits page-owned success follow-up before reloading the workbench',
  async () => {
    const { createOpenClawAgentMutationRunner } = await loadAgentMutationSupportModule();
    const savingStates: boolean[] = [];
    const callLog: string[] = [];

    const runAgentMutation = createOpenClawAgentMutationRunner({
      executeCreate: async (instanceId, agent) => {
        callLog.push(`create:${instanceId}:${agent.id}`);
      },
      executeUpdate: async () => undefined,
      executeDelete: async () => undefined,
      reloadWorkbench: async (instanceId, options) => {
        callLog.push(`reload:${instanceId}:${options.withSpinner}`);
      },
      reportSuccess: (message) => {
        callLog.push(`success:${message}`);
      },
      reportError: (message) => {
        callLog.push(`error:${message}`);
      },
      t: (key: string) => `translated:${key}`,
    });

    await runAgentMutation({
      instanceId: 'instance-01',
      kind: 'create',
      agent: {
        id: 'ops',
      } as any,
      setSaving: (value: boolean) => {
        savingStates.push(value);
      },
      afterSuccess: async () => {
        callLog.push('afterSuccess:create:start');
        await Promise.resolve();
        callLog.push('afterSuccess:create:done');
      },
      successKey: 'instances.detail.instanceWorkbench.agents.toasts.agentCreated',
      failureKey: 'instances.detail.instanceWorkbench.agents.toasts.agentSaveFailed',
    });

    assert.deepEqual(savingStates, [true, false]);
    assert.deepEqual(callLog, [
      'create:instance-01:ops',
      'success:translated:instances.detail.instanceWorkbench.agents.toasts.agentCreated',
      'afterSuccess:create:start',
      'afterSuccess:create:done',
      'reload:instance-01:false',
    ]);
  },
);

await runTest(
  'createOpenClawAgentMutationRunner writes fallback errors through the injected page reporter',
  async () => {
    const { createOpenClawAgentMutationRunner } = await loadAgentMutationSupportModule();
    const reportedErrors: string[] = [];

    const runAgentMutation = createOpenClawAgentMutationRunner({
      executeCreate: async () => undefined,
      executeUpdate: async () => undefined,
      executeDelete: async () => {
        throw new Error('');
      },
      reloadWorkbench: async () => undefined,
      reportSuccess: () => undefined,
      reportError: (message) => {
        reportedErrors.push(message);
      },
      t: (key: string) => `translated:${key}`,
    });

    await runAgentMutation({
      instanceId: 'instance-01',
      kind: 'delete',
      agentId: 'ops',
      successKey: 'instances.detail.instanceWorkbench.agents.toasts.agentRemoved',
      failureKey: 'instances.detail.instanceWorkbench.agents.toasts.agentDeleteFailed',
    });

    assert.deepEqual(reportedErrors, [
      'translated:instances.detail.instanceWorkbench.agents.toasts.agentDeleteFailed',
    ]);
  },
);

await runTest(
  'buildOpenClawAgentSaveMutationRequest returns a translated validation error when the dialog draft has no agent id',
  async () => {
    const { buildOpenClawAgentSaveMutationRequest } = await loadAgentMutationSupportModule();
    const { createOpenClawAgentFormState } = await loadAgentPresentationModule();

    const result = buildOpenClawAgentSaveMutationRequest({
      instanceId: 'instance-01',
      editingAgentId: null,
      agentDialogDraft: createOpenClawAgentFormState(null),
      setSaving: () => undefined,
      afterSuccess: () => undefined,
      t: (key: string) => `translated:${key}`,
    });

    assert.deepEqual(result, {
      kind: 'error',
      errorMessage: 'translated:instances.detail.instanceWorkbench.agents.toasts.agentIdRequired',
    });
  },
);

await runTest(
  'buildOpenClawAgentSaveMutationRequest builds an update mutation request with the generated agent input and page-owned hooks',
  async () => {
    const { buildOpenClawAgentSaveMutationRequest } = await loadAgentMutationSupportModule();
    const { createOpenClawAgentFormState } = await loadAgentPresentationModule();
    const draft = createOpenClawAgentFormState(null);
    const setSaving = () => undefined;
    const afterSuccessLog: string[] = [];
    const afterSuccess = (agent: any, kind: 'create' | 'update') => {
      afterSuccessLog.push(`${kind}:${agent.id}`);
    };

    draft.id = 'ops';
    draft.name = 'Ops Team';
    draft.fallbackModelsText = 'openai/gpt-4.1';
    draft.streamingMode = 'enabled';

    const result = buildOpenClawAgentSaveMutationRequest({
      instanceId: 'instance-01',
      editingAgentId: 'ops',
      agentDialogDraft: draft,
      setSaving,
      afterSuccess,
      t: (key: string) => `translated:${key}`,
    });

    assert.equal(result.kind, 'mutation');
    assert.equal(result.request.instanceId, 'instance-01');
    assert.equal(result.request.kind, 'update');
    assert.equal(result.request.setSaving, setSaving);
    assert.equal(
      result.request.successKey,
      'instances.detail.instanceWorkbench.agents.toasts.agentUpdated',
    );
    assert.equal(
      result.request.failureKey,
      'instances.detail.instanceWorkbench.agents.toasts.agentSaveFailed',
    );
    assert.deepEqual(result.request.agent, {
      id: 'ops',
      name: 'Ops Team',
      avatar: '',
      workspace: '',
      agentDir: '',
      isDefault: false,
      model: {
        primary: undefined,
        fallbacks: ['openai/gpt-4.1'],
      },
      params: {
        streaming: true,
      },
    });

    await result.request.afterSuccess?.();
    assert.deepEqual(afterSuccessLog, ['update:ops']);
  },
);

await runTest(
  'buildOpenClawAgentDeleteMutationRequest skips missing targets and returns the delete request when the page has a selected agent',
  async () => {
    const { buildOpenClawAgentDeleteMutationRequest } = await loadAgentMutationSupportModule();
    const afterSuccess = () => undefined;

    assert.deepEqual(
      buildOpenClawAgentDeleteMutationRequest({
        instanceId: undefined,
        agentDeleteId: 'ops',
        afterSuccess,
      }),
      {
        kind: 'skip',
      },
    );

    assert.deepEqual(
      buildOpenClawAgentDeleteMutationRequest({
        instanceId: 'instance-01',
        agentDeleteId: 'ops',
        afterSuccess,
      }),
      {
        kind: 'mutation',
        request: {
          instanceId: 'instance-01',
          kind: 'delete',
          agentId: 'ops',
          afterSuccess,
          successKey: 'instances.detail.instanceWorkbench.agents.toasts.agentRemoved',
          failureKey: 'instances.detail.instanceWorkbench.agents.toasts.agentDeleteFailed',
        },
      },
    );
  },
);

await runTest(
  'buildOpenClawAgentMutationHandlers routes save validation, create follow-up, and delete execution through injected page-owned callbacks',
  async () => {
    const { buildOpenClawAgentMutationHandlers } = await loadAgentMutationSupportModule();
    const { createOpenClawAgentFormState } = await loadAgentPresentationModule();
    const reportedErrors: string[] = [];
    const executedRequests: any[] = [];
    const dismissLog: string[] = [];
    const afterSaveLog: string[] = [];
    const invalidHandlers = buildOpenClawAgentMutationHandlers({
      instanceId: 'instance-01',
      editingAgentId: null,
      agentDialogDraft: createOpenClawAgentFormState(null),
      setSavingAgentDialog: () => undefined,
      dismissAgentDialog: () => {
        dismissLog.push('dismiss-invalid');
      },
      agentDeleteId: null,
      clearAgentDeleteId: () => {
        dismissLog.push('clear-delete-invalid');
      },
      executeMutation: async (request) => {
        executedRequests.push(request);
      },
      afterSaveSuccess: (agent, kind) => {
        afterSaveLog.push(`${kind}:${agent.id}`);
      },
      reportError: (message) => {
        reportedErrors.push(message);
      },
      t: (key: string) => `translated:${key}`,
    });

    await invalidHandlers.onSaveAgentDialog();
    await invalidHandlers.onDeleteAgent();

    assert.deepEqual(reportedErrors, [
      'translated:instances.detail.instanceWorkbench.agents.toasts.agentIdRequired',
    ]);
    assert.deepEqual(executedRequests, []);
    assert.deepEqual(dismissLog, []);

    const validDraft = createOpenClawAgentFormState(null);
    validDraft.id = 'ops';
    validDraft.name = 'Ops';

    const validHandlers = buildOpenClawAgentMutationHandlers({
      instanceId: 'instance-01',
      editingAgentId: null,
      agentDialogDraft: validDraft,
      setSavingAgentDialog: () => undefined,
      dismissAgentDialog: () => {
        dismissLog.push('dismiss-create');
      },
      agentDeleteId: 'ops',
      clearAgentDeleteId: () => {
        dismissLog.push('clear-delete-valid');
      },
      executeMutation: async (request) => {
        executedRequests.push(request);
      },
      afterSaveSuccess: (agent, kind) => {
        afterSaveLog.push(`${kind}:${agent.id}`);
      },
      reportError: (message) => {
        reportedErrors.push(message);
      },
      t: (key: string) => `translated:${key}`,
    });

    await validHandlers.onSaveAgentDialog();
    await validHandlers.onDeleteAgent();

    assert.equal(executedRequests.length, 2);
    assert.equal(executedRequests[0].kind, 'create');
    await executedRequests[0].afterSuccess();
    assert.equal(executedRequests[1].kind, 'delete');
    assert.equal(executedRequests[1].afterSuccess, validHandlers.clearAgentDeleteId);
    assert.deepEqual(afterSaveLog, ['create:ops']);
    assert.deepEqual(dismissLog, ['dismiss-create']);
    assert.deepEqual(reportedErrors, [
      'translated:instances.detail.instanceWorkbench.agents.toasts.agentIdRequired',
    ]);
  },
);
