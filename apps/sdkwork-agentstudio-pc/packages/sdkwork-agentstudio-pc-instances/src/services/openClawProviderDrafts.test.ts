import assert from 'node:assert/strict';
import {
  applyOpenClawProviderConfigDraftChange,
  applyOpenClawProviderFieldDraftChange,
  applyOpenClawProviderRequestDraftChange,
  buildOpenClawProviderConfigMutationPlan,
  buildOpenClawProviderConfigSaveInput,
  buildOpenClawProviderDialogMutationPlan,
  buildOpenClawProviderDialogSaveInput,
  createOpenClawProviderConfigDraft,
  createOpenClawProviderRequestDraft,
  buildOpenClawProviderDeleteMutationPlan,
  buildOpenClawProviderModelDialogSaveInput,
  buildOpenClawProviderModelDeleteMutationPlan,
  buildOpenClawProviderModelMutationPlan,
  createEmptyOpenClawProviderForm,
  createEmptyOpenClawProviderModelForm,
  createOpenClawProviderModelForm,
  hasPendingOpenClawProviderConfigChanges,
  parseOpenClawProviderModelsText,
} from './openClawProviderDrafts.ts';

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

await runTest(
  'buildOpenClawProviderDialogSaveInput trims fields, falls back default model, and builds provider input',
  () => {
    assert.deepEqual(
      buildOpenClawProviderDialogSaveInput({
        draft: {
          id: '  openai-router  ',
          name: '  Shared OpenAI Router  ',
          endpoint: '  https://router.example.com/v1  ',
          apiKeySource: '  env:OPENAI_API_KEY  ',
          defaultModelId: '  ',
          reasoningModelId: ' o4-mini ',
          embeddingModelId: ' text-embedding-3-small ',
          requestOverridesText: `{
  headers: {
    "OpenAI-Organization": "org_live",
  },
}`,
        },
        models: [
          {
            id: 'gpt-5.4',
            name: 'GPT-5.4',
          },
          {
            id: 'o4-mini',
            name: 'o4-mini',
          },
          {
            id: 'text-embedding-3-small',
            name: 'text-embedding-3-small',
          },
        ],
      }),
      {
        ok: true,
        value: {
          providerId: 'openai-router',
          providerInput: {
            id: 'openai-router',
            channelId: 'openai-router',
            name: 'Shared OpenAI Router',
            apiKey: '${OPENAI_API_KEY}',
            baseUrl: 'https://router.example.com/v1',
            models: [
              {
                id: 'gpt-5.4',
                name: 'GPT-5.4',
              },
              {
                id: 'o4-mini',
                name: 'o4-mini',
              },
              {
                id: 'text-embedding-3-small',
                name: 'text-embedding-3-small',
              },
            ],
            config: {
              temperature: 0.2,
              topP: 1,
              maxTokens: 8192,
              timeoutMs: 60000,
              streaming: true,
              request: {
                headers: {
                  'OpenAI-Organization': 'org_live',
                },
              },
            },
          },
          selection: {
            defaultModelId: 'gpt-5.4',
            reasoningModelId: 'o4-mini',
            embeddingModelId: 'text-embedding-3-small',
          },
        },
      },
    );
  },
);

await runTest(
  'buildOpenClawProviderDialogSaveInput normalizes aliased provider ids, trailing-slash endpoints, and dirty model catalogs through the shared OpenClaw provider standard',
  () => {
    assert.deepEqual(
      buildOpenClawProviderDialogSaveInput({
        draft: {
          id: '  api-router-openai  ',
          name: '   ',
          endpoint: '  https://api.openai.com/v1/  ',
          apiKeySource: '  env:OPENAI_API_KEY  ',
          defaultModelId: ' gpt-5.4 ',
          reasoningModelId: ' o4-mini ',
          embeddingModelId: ' text-embedding-3-large ',
          requestOverridesText: '',
        },
        models: [
          {
            id: ' gpt-5.4 ',
            name: ' GPT-5.4 ',
          },
          {
            id: ' o4-mini ',
            name: ' o4-mini ',
          },
          {
            id: ' text-embedding-3-large ',
            name: ' Text Embedding 3 Large ',
          },
          {
            id: 'gpt-5.4',
            name: 'Duplicate GPT-5.4',
          },
        ],
      }),
      {
        ok: true,
        value: {
          providerId: 'openai',
          providerInput: {
            id: 'openai',
            channelId: 'openai',
            name: 'openai',
            apiKey: '${OPENAI_API_KEY}',
            baseUrl: 'https://api.openai.com/v1',
            models: [
              {
                id: 'gpt-5.4',
                name: 'GPT-5.4',
              },
              {
                id: 'o4-mini',
                name: 'o4-mini',
              },
              {
                id: 'text-embedding-3-large',
                name: 'Text Embedding 3 Large',
              },
            ],
            config: {
              temperature: 0.2,
              topP: 1,
              maxTokens: 8192,
              timeoutMs: 60000,
              streaming: true,
            },
          },
          selection: {
            defaultModelId: 'gpt-5.4',
            reasoningModelId: 'o4-mini',
            embeddingModelId: 'text-embedding-3-large',
          },
        },
      },
    );
  },
);

await runTest('buildOpenClawProviderDialogSaveInput rejects blank provider ids', () => {
  assert.deepEqual(
    buildOpenClawProviderDialogSaveInput({
      draft: {
        id: '   ',
        name: '',
        endpoint: '',
        apiKeySource: '',
        defaultModelId: '',
        reasoningModelId: '',
        embeddingModelId: '',
        requestOverridesText: '',
      },
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
        },
      ],
    }),
    {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerIdRequired',
    },
  );
});

await runTest('buildOpenClawProviderDialogSaveInput rejects empty model lists', () => {
  assert.deepEqual(
    buildOpenClawProviderDialogSaveInput({
      draft: {
        id: 'openai',
        name: '',
        endpoint: '',
        apiKeySource: '',
        defaultModelId: '',
        reasoningModelId: '',
        embeddingModelId: '',
        requestOverridesText: '',
      },
      models: [],
    }),
    {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelsRequired',
    },
  );
});

await runTest(
  'buildOpenClawProviderDialogSaveInput rejects default, reasoning, and embedding selections that are not in the parsed model list',
  () => {
    assert.deepEqual(
      buildOpenClawProviderDialogSaveInput({
        draft: {
          id: 'openai',
          name: '',
          endpoint: '',
          apiKeySource: '',
          defaultModelId: 'missing-primary',
          reasoningModelId: '',
          embeddingModelId: '',
          requestOverridesText: '',
        },
        models: [
          {
            id: 'gpt-5.4',
            name: 'GPT-5.4',
          },
        ],
      }),
      {
        ok: false,
        errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.defaultModelMissing',
      },
    );

    assert.deepEqual(
      buildOpenClawProviderDialogSaveInput({
        draft: {
          id: 'openai',
          name: '',
          endpoint: '',
          apiKeySource: '',
          defaultModelId: 'gpt-5.4',
          reasoningModelId: 'missing-reasoning',
          embeddingModelId: '',
          requestOverridesText: '',
        },
        models: [
          {
            id: 'gpt-5.4',
            name: 'GPT-5.4',
          },
        ],
      }),
      {
        ok: false,
        errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.reasoningModelMissing',
      },
    );

    assert.deepEqual(
      buildOpenClawProviderDialogSaveInput({
        draft: {
          id: 'openai',
          name: '',
          endpoint: '',
          apiKeySource: '',
          defaultModelId: 'gpt-5.4',
          reasoningModelId: '',
          embeddingModelId: 'missing-embedding',
          requestOverridesText: '',
        },
        models: [
          {
            id: 'gpt-5.4',
            name: 'GPT-5.4',
          },
        ],
      }),
      {
        ok: false,
        errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.embeddingModelMissing',
      },
    );
  },
);

await runTest(
  'buildOpenClawProviderDialogSaveInput surfaces request-override parser failures as direct messages',
  () => {
    const result = buildOpenClawProviderDialogSaveInput({
      draft: {
        id: 'openai',
        name: '',
        endpoint: '',
        apiKeySource: '',
        defaultModelId: '',
        reasoningModelId: '',
        embeddingModelId: '',
        requestOverridesText: `{
  auth: {
    mode: "basic",
  },
}`,
      },
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
        },
      ],
    });

    assert.equal(result.ok, false);
    assert.match(result.ok ? '' : result.errorMessage || '', /auth\.mode/i);
  },
);

await runTest(
  'buildOpenClawProviderModelDialogSaveInput trims values and distinguishes create vs update payloads',
  () => {
    assert.deepEqual(
      buildOpenClawProviderModelDialogSaveInput({
        originalId: undefined,
        id: '  o4-mini-high  ',
        name: '  o4-mini High  ',
      }),
      {
        ok: true,
        value: {
          mode: 'create',
          modelId: 'o4-mini-high',
          model: {
            id: 'o4-mini-high',
            name: 'o4-mini High',
          },
        },
      },
    );

    assert.deepEqual(
      buildOpenClawProviderModelDialogSaveInput({
        originalId: 'o4-mini',
        id: '  o4-mini-high  ',
        name: '   ',
      }),
      {
        ok: true,
        value: {
          mode: 'update',
          originalId: 'o4-mini',
          modelId: 'o4-mini-high',
          model: {
            id: 'o4-mini-high',
            name: 'o4-mini-high',
          },
        },
      },
    );
  },
);

await runTest('buildOpenClawProviderModelDialogSaveInput rejects blank model ids', () => {
  assert.deepEqual(
    buildOpenClawProviderModelDialogSaveInput({
      originalId: undefined,
      id: '   ',
      name: '',
    }),
    {
      ok: false,
      errorKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelIdRequired',
    },
  );
});

await runTest(
  'buildOpenClawProviderDialogMutationPlan preserves create-provider mutation metadata for the page shell',
  () => {
    const saveInput = buildOpenClawProviderDialogSaveInput({
      draft: {
        id: 'openai-router',
        name: 'Shared OpenAI Router',
        endpoint: 'https://router.example.com/v1',
        apiKeySource: 'env:OPENAI_API_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: '',
        embeddingModelId: '',
        requestOverridesText: '',
      },
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
        },
      ],
    });

    assert.equal(saveInput.ok, true);
    assert.deepEqual(
      buildOpenClawProviderDialogMutationPlan({
        instanceId: 'instance-01',
        saveInput: saveInput.ok ? saveInput.value : undefined!,
      }),
      {
        kind: 'providerCreate',
        instanceId: 'instance-01',
        providerInput: {
          id: 'openai-router',
          channelId: 'openai-router',
          name: 'Shared OpenAI Router',
          apiKey: '${OPENAI_API_KEY}',
          baseUrl: 'https://router.example.com/v1',
          models: [
            {
              id: 'gpt-5.4',
              name: 'GPT-5.4',
            },
          ],
          config: {
            temperature: 0.2,
            topP: 1,
            maxTokens: 8192,
            timeoutMs: 60000,
            streaming: true,
          },
        },
        selection: {
          defaultModelId: 'gpt-5.4',
          reasoningModelId: undefined,
          embeddingModelId: undefined,
        },
        selectedProviderId: 'openai-router',
        successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerSaved',
        failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerSaveFailed',
      },
    );
  },
);

await runTest(
  'buildOpenClawProviderModelMutationPlan preserves create and update mutation metadata for the page shell',
  () => {
    const createSaveInput = buildOpenClawProviderModelDialogSaveInput({
      originalId: undefined,
      id: 'o4-mini-high',
      name: 'o4-mini High',
    });
    const updateSaveInput = buildOpenClawProviderModelDialogSaveInput({
      originalId: 'o4-mini',
      id: 'o4-mini-high',
      name: 'o4-mini High',
    });

    assert.equal(createSaveInput.ok, true);
    assert.equal(updateSaveInput.ok, true);

    assert.deepEqual(
      buildOpenClawProviderModelMutationPlan({
        instanceId: 'instance-01',
        providerId: 'provider-01',
        saveInput: createSaveInput.ok ? createSaveInput.value : undefined!,
      }),
      {
        kind: 'providerModelCreate',
        instanceId: 'instance-01',
        providerId: 'provider-01',
        model: {
          id: 'o4-mini-high',
          name: 'o4-mini High',
        },
        selectedProviderId: 'provider-01',
        successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelAdded',
        failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelSaveFailed',
      },
    );

    assert.deepEqual(
      buildOpenClawProviderModelMutationPlan({
        instanceId: 'instance-01',
        providerId: 'provider-01',
        saveInput: updateSaveInput.ok ? updateSaveInput.value : undefined!,
      }),
      {
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
      },
    );
  },
);

await runTest(
  'provider delete mutation plans preserve page-owned delete action metadata',
  () => {
    assert.deepEqual(
      buildOpenClawProviderModelDeleteMutationPlan({
        instanceId: 'instance-01',
        providerId: 'provider-01',
        modelId: 'o4-mini',
      }),
      {
        kind: 'providerModelDelete',
        instanceId: 'instance-01',
        providerId: 'provider-01',
        modelId: 'o4-mini',
        selectedProviderId: 'provider-01',
        successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelRemoved',
        failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.modelDeleteFailed',
      },
    );

    assert.deepEqual(
      buildOpenClawProviderDeleteMutationPlan({
        instanceId: 'instance-01',
        providerId: 'provider-01',
      }),
      {
        kind: 'providerDelete',
        instanceId: 'instance-01',
        providerId: 'provider-01',
        selectedProviderId: null,
        successKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerRemoved',
        failureKey: 'instances.detail.instanceWorkbench.llmProviders.toasts.providerDeleteFailed',
      },
    );
  },
);

await runTest(
  'provider config save helpers preserve update payload and page-owned mutation metadata',
  () => {
    const saveInput = buildOpenClawProviderConfigSaveInput({
      providerId: 'provider-01',
      draft: {
        endpoint: ' https://router.example.com/v1 ',
        apiKeySource: ' env:OPENAI_API_KEY ',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: '',
        config: {
          temperature: 0.4,
          topP: 0.9,
          maxTokens: 4096,
          timeoutMs: 120000,
          streaming: true,
        },
      },
      requestOverridesText: '{ headers: { \"x-trace-id\": \"abc\" } }',
    });

    assert.equal(saveInput.ok, true);
    assert.deepEqual(
      buildOpenClawProviderConfigMutationPlan({
        instanceId: 'instance-01',
        saveInput: saveInput.ok ? saveInput.value : undefined!,
      }),
      {
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
            temperature: 0.4,
            topP: 0.9,
            maxTokens: 4096,
            timeoutMs: 120000,
            streaming: true,
            request: {
              headers: {
                'x-trace-id': 'abc',
              },
            },
          },
        },
        selectedProviderId: 'provider-01',
        successKey: 'instances.detail.instanceWorkbench.llmProviders.saved',
        failureKey: 'instances.detail.instanceWorkbench.llmProviders.saveFailed',
      },
    );
  },
);

await runTest(
  'buildOpenClawProviderConfigSaveInput normalizes aliased provider ids, trims model selections, and canonicalizes runtime config defaults',
  () => {
    assert.deepEqual(
      buildOpenClawProviderConfigSaveInput({
        providerId: ' api-router-openai ',
        draft: {
          endpoint: ' https://api.openai.com/v1/ ',
          apiKeySource: ' env:OPENAI_API_KEY ',
          defaultModelId: ' gpt-5.4 ',
          reasoningModelId: ' o4-mini ',
          embeddingModelId: ' ',
          config: {
            temperature: 0.4,
            topP: 0.9,
            maxTokens: 4096,
            timeoutMs: 120000,
            streaming: true,
          },
        },
        requestOverridesText: '',
      }),
      {
        ok: true,
        value: {
          providerId: 'openai',
          providerUpdate: {
            endpoint: 'https://api.openai.com/v1',
            apiKeySource: 'env:OPENAI_API_KEY',
            defaultModelId: 'gpt-5.4',
            reasoningModelId: 'o4-mini',
            embeddingModelId: undefined,
            config: {
              temperature: 0.4,
              topP: 0.9,
              maxTokens: 4096,
              timeoutMs: 120000,
              streaming: true,
            },
          },
        },
      },
    );
  },
);

await runTest('buildOpenClawProviderConfigSaveInput surfaces request override parser failures', () => {
  const result = buildOpenClawProviderConfigSaveInput({
    providerId: 'provider-01',
    draft: {
      endpoint: '',
      apiKeySource: '',
      defaultModelId: 'gpt-5.4',
      reasoningModelId: '',
      embeddingModelId: '',
      config: {
        temperature: 0.2,
        topP: 1,
        maxTokens: 8192,
        timeoutMs: 60000,
        streaming: true,
      },
    },
    requestOverridesText: '{ headers: ]',
  });

  assert.equal(result.ok, false);
  assert.match(result.errorMessage || '', /Expected a JSON value|invalid character/);
});

await runTest(
  'provider draft update helpers preserve page-owned draft maps while applying field, config, and request changes',
  () => {
    const providerDrafts = {
      'provider-01': {
        endpoint: 'https://router.example.com/v1',
        apiKeySource: 'env:OPENAI_API_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-small',
        config: {
          temperature: 0.2,
          topP: 1,
          maxTokens: 8192,
          timeoutMs: 60000,
          streaming: true,
        },
      },
    };
    const requestDrafts = {
      'provider-01': '{ headers: { "x-trace-id": "baseline" } }',
    };

    const fieldUpdatedDrafts = applyOpenClawProviderFieldDraftChange({
      drafts: providerDrafts,
      providerId: 'provider-01',
      draft: providerDrafts['provider-01'],
      field: 'reasoningModelId',
      value: '',
    });
    const configUpdatedDrafts = applyOpenClawProviderConfigDraftChange({
      drafts: providerDrafts,
      providerId: 'provider-01',
      draft: providerDrafts['provider-01'],
      field: 'temperature',
      value: 0.6,
    });
    const requestUpdatedDrafts = applyOpenClawProviderRequestDraftChange({
      requestDrafts,
      providerId: 'provider-01',
      value: '{ headers: { "x-trace-id": "changed" } }',
    });

    assert.notEqual(fieldUpdatedDrafts, providerDrafts);
    assert.notEqual(fieldUpdatedDrafts['provider-01'], providerDrafts['provider-01']);
    assert.equal(fieldUpdatedDrafts['provider-01']?.reasoningModelId, undefined);
    assert.equal(fieldUpdatedDrafts['provider-01']?.defaultModelId, 'gpt-5.4');

    assert.notEqual(configUpdatedDrafts, providerDrafts);
    assert.notEqual(configUpdatedDrafts['provider-01'], providerDrafts['provider-01']);
    assert.notEqual(
      configUpdatedDrafts['provider-01']?.config,
      providerDrafts['provider-01']?.config,
    );
    assert.equal(configUpdatedDrafts['provider-01']?.config.temperature, 0.6);
    assert.equal(configUpdatedDrafts['provider-01']?.config.streaming, true);

    assert.notEqual(requestUpdatedDrafts, requestDrafts);
    assert.equal(
      requestUpdatedDrafts['provider-01'],
      '{ headers: { "x-trace-id": "changed" } }',
    );
    assert.equal(requestDrafts['provider-01'], '{ headers: { "x-trace-id": "baseline" } }');
  },
);

await runTest(
  'provider draft baseline helpers clone workbench provider state and detect pending changes',
  () => {
    const provider = {
      id: 'provider-01',
      endpoint: 'https://router.example.com/v1',
      apiKeySource: 'env:OPENAI_API_KEY',
      defaultModelId: 'gpt-5.4',
      reasoningModelId: 'o4-mini',
      embeddingModelId: undefined,
      config: {
        temperature: 0.2,
        topP: 1,
        maxTokens: 8192,
        timeoutMs: 60000,
        streaming: true,
        request: {
          headers: {
            'x-trace-id': 'baseline',
          },
        },
      },
    };

    const baselineDraft = createOpenClawProviderConfigDraft(provider as any);
    const baselineRequestDraft = createOpenClawProviderRequestDraft(provider as any);

    assert.deepEqual(baselineDraft, {
      endpoint: 'https://router.example.com/v1',
      apiKeySource: 'env:OPENAI_API_KEY',
      defaultModelId: 'gpt-5.4',
      reasoningModelId: 'o4-mini',
      embeddingModelId: undefined,
      config: {
        temperature: 0.2,
        topP: 1,
        maxTokens: 8192,
        timeoutMs: 60000,
        streaming: true,
        request: {
          headers: {
            'x-trace-id': 'baseline',
          },
        },
      },
    });
    assert.notEqual(baselineDraft.config, provider.config);
    assert.equal(
      hasPendingOpenClawProviderConfigChanges({
        provider: provider as any,
        draft: baselineDraft,
        requestDraft: baselineRequestDraft,
      }),
      false,
    );
    assert.equal(
      hasPendingOpenClawProviderConfigChanges({
        provider: provider as any,
        draft: {
          ...baselineDraft,
          endpoint: 'https://router-2.example.com/v1',
        },
        requestDraft: baselineRequestDraft,
      }),
      true,
    );
    assert.equal(
      hasPendingOpenClawProviderConfigChanges({
        provider: provider as any,
        draft: baselineDraft,
        requestDraft: '{ headers: { \"x-trace-id\": \"changed\" } }',
      }),
      true,
    );
  },
);

await runTest('provider draft factories supply clean page-owned dialog defaults', () => {
  assert.deepEqual(createEmptyOpenClawProviderForm(), {
    id: '',
    name: '',
    endpoint: '',
    apiKeySource: '',
    defaultModelId: '',
    reasoningModelId: '',
    embeddingModelId: '',
    modelsText: '',
    requestOverridesText: '',
  });

  assert.deepEqual(createEmptyOpenClawProviderModelForm(), {
    id: '',
    name: '',
  });

  assert.deepEqual(createOpenClawProviderModelForm(undefined), {
    id: '',
    name: '',
  });

  assert.deepEqual(
    createOpenClawProviderModelForm({
      id: 'o4-mini-high',
      name: 'o4-mini High',
    }),
    {
      originalId: 'o4-mini-high',
      id: 'o4-mini-high',
      name: 'o4-mini High',
    },
  );
});

await runTest(
  'parseOpenClawProviderModelsText normalizes id=name rows, bare ids, and duplicate entries',
  () => {
    assert.deepEqual(
      parseOpenClawProviderModelsText(`
gpt-5.4 = GPT-5.4
o4-mini
gpt-5.4 = GPT-5.4 Duplicate
text-embedding-3-small = 
`),
      [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4 Duplicate',
        },
        {
          id: 'o4-mini',
          name: 'o4-mini',
        },
        {
          id: 'text-embedding-3-small',
          name: 'text-embedding-3-small',
        },
      ],
    );
  },
);
