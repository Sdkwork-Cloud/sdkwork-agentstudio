import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

async function runTest(name: string, callback: () => void | Promise<void>) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

async function loadProviderPresentationModule() {
  const moduleUrl = new URL('./openClawProviderPresentation.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected OpenClaw provider presentation helper module to exist',
  );

  return import('./openClawProviderPresentation.ts');
}

await runTest(
  'createOpenClawProviderCreateDialogState returns a fresh provider dialog draft',
  async () => {
    const { createOpenClawProviderCreateDialogState } = await loadProviderPresentationModule();

    const dialogState = createOpenClawProviderCreateDialogState();

    assert.deepEqual(dialogState, {
      draft: {
        id: '',
        name: '',
        endpoint: '',
        apiKeySource: '',
        defaultModelId: '',
        reasoningModelId: '',
        embeddingModelId: '',
        modelsText: '',
        requestOverridesText: '',
      },
    });
  },
);

await runTest(
  'createOpenClawProviderModelCreateDialogState returns a fresh provider-model draft',
  async () => {
    const { createOpenClawProviderModelCreateDialogState } = await loadProviderPresentationModule();

    const dialogState = createOpenClawProviderModelCreateDialogState();

    assert.deepEqual(dialogState, {
      draft: {
        id: '',
        name: '',
      },
    });
  },
);

await runTest(
  'createOpenClawProviderDialogResetDrafts returns both provider dialog drafts together',
  async () => {
    const { createOpenClawProviderDialogResetDrafts } = await loadProviderPresentationModule();

    const resetDrafts = createOpenClawProviderDialogResetDrafts();

    assert.deepEqual(resetDrafts, {
      providerDialogDraft: {
        id: '',
        name: '',
        endpoint: '',
        apiKeySource: '',
        defaultModelId: '',
        reasoningModelId: '',
        embeddingModelId: '',
        modelsText: '',
        requestOverridesText: '',
      },
      providerModelDialogDraft: {
        id: '',
        name: '',
      },
    });
  },
);

await runTest(
  'createOpenClawProviderWorkspaceResetState returns the full provider reset baseline for instance switches',
  async () => {
    const { createOpenClawProviderWorkspaceResetState } = await loadProviderPresentationModule();

    const resetState = createOpenClawProviderWorkspaceResetState();

    assert.deepEqual(resetState, {
      isProviderDialogOpen: false,
      providerDialogDraft: {
        id: '',
        name: '',
        endpoint: '',
        apiKeySource: '',
        defaultModelId: '',
        reasoningModelId: '',
        embeddingModelId: '',
        modelsText: '',
        requestOverridesText: '',
      },
      providerRequestDrafts: {},
      isProviderModelDialogOpen: false,
      providerModelDialogDraft: {
        id: '',
        name: '',
      },
      providerModelDeleteId: null,
      providerDeleteId: null,
    });
  },
);

await runTest(
  'createOpenClawProviderModelEditDialogState copies the selected model into an editable draft',
  async () => {
    const { createOpenClawProviderModelEditDialogState } = await loadProviderPresentationModule();

    const dialogState = createOpenClawProviderModelEditDialogState({
      id: 'gpt-5.4',
      name: 'GPT-5.4',
    });

    assert.deepEqual(dialogState, {
      draft: {
        originalId: 'gpt-5.4',
        id: 'gpt-5.4',
        name: 'GPT-5.4',
      },
    });
  },
);

await runTest(
  'buildOpenClawProviderDialogPresentation parses provider dialog models and clears request parse errors for valid drafts',
  async () => {
    const { buildOpenClawProviderDialogPresentation } = await loadProviderPresentationModule();

    const presentation = buildOpenClawProviderDialogPresentation({
      draft: {
        id: 'provider-a',
        name: 'Provider A',
        endpoint: 'https://provider-a.example.com',
        apiKeySource: 'PROVIDER_A_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: '',
        embeddingModelId: '',
        modelsText: 'gpt-5.4=GPT-5.4\nembedding-1=Embedding 1\ngpt-5.4=GPT-5.4 duplicate',
        requestOverridesText: '{ temperature: 0.2 }',
      },
      t: (key: string) => key,
    });

    assert.deepEqual(presentation.models, [
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4 duplicate',
      },
      {
        id: 'embedding-1',
        name: 'Embedding 1',
      },
    ]);
    assert.equal(presentation.requestParseError, null);
  },
);

await runTest(
  'buildOpenClawProviderDialogPresentation surfaces translated request parse errors for invalid drafts',
  async () => {
    const { buildOpenClawProviderDialogPresentation } = await loadProviderPresentationModule();

    const presentation = buildOpenClawProviderDialogPresentation({
      draft: {
        id: 'provider-a',
        name: 'Provider A',
        endpoint: 'https://provider-a.example.com',
        apiKeySource: 'PROVIDER_A_KEY',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: '',
        embeddingModelId: '',
        modelsText: '',
        requestOverridesText: '{ temperature: }',
      },
      t: (key: string) => `translated:${key}`,
    });

    assert.deepEqual(presentation.models, []);
    assert.match(
      presentation.requestParseError || '',
      /translated:instances\.detail\.instanceWorkbench\.llmProviders\.requestOverridesInvalid|position/u,
    );
  },
);
