import assert from 'node:assert/strict';

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

let providerCatalogDocumentServiceModule:
  | typeof import('./openClawProviderCatalogDocumentService.ts')
  | undefined;

try {
  providerCatalogDocumentServiceModule = await import('./openClawProviderCatalogDocumentService.ts');
} catch {
  providerCatalogDocumentServiceModule = undefined;
}

await runTest(
  'openClawProviderCatalogDocumentService exposes provider catalog document mutation helpers',
  () => {
    assert.ok(
      providerCatalogDocumentServiceModule,
      'Expected openClawProviderCatalogDocumentService.ts to exist',
    );
    assert.equal(
      typeof providerCatalogDocumentServiceModule?.buildOpenClawProviderModelRef,
      'function',
    );
    assert.equal(
      typeof providerCatalogDocumentServiceModule?.createOpenClawProviderModelInConfigRoot,
      'function',
    );
    assert.equal(
      typeof providerCatalogDocumentServiceModule?.updateOpenClawProviderModelInConfigRoot,
      'function',
    );
    assert.equal(
      typeof providerCatalogDocumentServiceModule?.deleteOpenClawProviderModelFromConfigRoot,
      'function',
    );
    assert.equal(
      typeof providerCatalogDocumentServiceModule?.deleteOpenClawProviderFromConfigRoot,
      'function',
    );
    assert.equal(
      typeof providerCatalogDocumentServiceModule?.reconcileOpenClawProviderModelCatalogInConfigRoot,
      'function',
    );
  },
);

await runTest(
  'openClawProviderCatalogDocumentService creates provider models and reconciles defaults catalog entries',
  () => {
    const root = {
      models: {
        providers: {
          openai: {
            baseUrl: 'https://router.example.com/v1',
            apiKey: '${OPENAI_API_KEY}',
            models: [
              { id: 'gpt-4.1', name: 'GPT-4.1' },
            ],
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: 'openai/gpt-4.1',
          },
          models: {
            'openai/gpt-4.1': {
              alias: 'GPT-4.1',
              streaming: true,
            },
          },
        },
      },
    };

    providerCatalogDocumentServiceModule?.createOpenClawProviderModelInConfigRoot({
      root,
      providerId: ' api-router-openai ',
      model: {
        id: ' text-embedding-3-small ',
        name: ' text-embedding-3-small ',
      },
    });

    assert.deepEqual(root.models.providers.openai.models, [
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'text-embedding-3-small', name: 'text-embedding-3-small' },
    ]);
    assert.deepEqual(root.agents.defaults.models, {
      'openai/gpt-4.1': {
        alias: 'GPT-4.1',
        streaming: true,
      },
      'openai/text-embedding-3-small': {
        alias: 'text-embedding-3-small',
        streaming: false,
      },
    });
  },
);

await runTest(
  'openClawProviderCatalogDocumentService updates provider model ids and rewrites model refs across config',
  () => {
    const root = {
      models: {
        providers: {
          openai: {
            baseUrl: 'https://router.example.com/v1',
            apiKey: '${OPENAI_API_KEY}',
            models: [
              { id: 'gpt-4.1', name: 'GPT-4.1' },
              { id: 'o4-mini', name: 'o4-mini', reasoning: true },
            ],
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: 'openai/gpt-4.1',
            fallbacks: ['openai/o4-mini'],
          },
          models: {
            'openai/gpt-4.1': {
              alias: 'GPT-4.1',
              streaming: true,
            },
            'openai/o4-mini': {
              alias: 'o4-mini',
              streaming: true,
            },
          },
        },
        list: [
          {
            id: 'main',
            default: true,
            model: {
              primary: 'openai/o4-mini',
              fallbacks: ['openai/gpt-4.1'],
            },
          },
        ],
      },
    };

    providerCatalogDocumentServiceModule?.updateOpenClawProviderModelInConfigRoot({
      root,
      providerId: 'openai',
      modelId: ' o4-mini ',
      model: {
        id: ' o4-mini-high ',
        name: ' o4-mini-high ',
      },
    });

    assert.deepEqual(root.models.providers.openai.models, [
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'o4-mini-high', name: 'o4-mini-high', reasoning: true },
    ]);
    assert.deepEqual(root.agents.defaults.model, {
      primary: 'openai/gpt-4.1',
      fallbacks: ['openai/o4-mini-high'],
    });
    assert.deepEqual(root.agents.list[0]?.model, {
      primary: 'openai/o4-mini-high',
      fallbacks: ['openai/gpt-4.1'],
    });
    assert.equal(
      Object.hasOwn(root.agents.defaults.models, 'openai/o4-mini'),
      false,
    );
    assert.deepEqual(root.agents.defaults.models['openai/o4-mini-high'], {
      alias: 'o4-mini-high',
      streaming: true,
    });
  },
);

await runTest(
  'openClawProviderCatalogDocumentService deletes providers and prunes stale refs to remaining catalog entries',
  () => {
    const root = {
      models: {
        providers: {
          openai: {
            baseUrl: 'https://router.example.com/v1',
            apiKey: '${OPENAI_API_KEY}',
            models: [
              { id: 'gpt-4.1', name: 'GPT-4.1' },
              { id: 'o4-mini', name: 'o4-mini', reasoning: true },
            ],
          },
          anthropic: {
            baseUrl: 'https://api.anthropic.com/v1',
            apiKey: '${ANTHROPIC_API_KEY}',
            models: [
              { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
            ],
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: 'openai/gpt-4.1',
            fallbacks: ['openai/o4-mini', 'anthropic/claude-sonnet-4-5'],
          },
          models: {
            'openai/gpt-4.1': {
              alias: 'GPT-4.1',
              streaming: true,
            },
            'openai/o4-mini': {
              alias: 'o4-mini',
              streaming: true,
            },
            'anthropic/claude-sonnet-4-5': {
              alias: 'Claude Sonnet 4.5',
              streaming: true,
            },
          },
        },
        list: [
          {
            id: 'main',
            default: true,
            model: {
              primary: 'openai/o4-mini',
              fallbacks: ['anthropic/claude-sonnet-4-5'],
            },
          },
        ],
      },
    };

    providerCatalogDocumentServiceModule?.deleteOpenClawProviderFromConfigRoot({
      root,
      providerId: 'openai',
    });

    assert.deepEqual(Object.keys(root.models.providers), ['anthropic']);
    assert.deepEqual(root.agents.defaults.model, {
      primary: 'anthropic/claude-sonnet-4-5',
    });
    assert.deepEqual(root.agents.list[0]?.model, {
      primary: 'anthropic/claude-sonnet-4-5',
    });
    assert.deepEqual(root.agents.defaults.models, {
      'anthropic/claude-sonnet-4-5': {
        alias: 'Claude Sonnet 4.5',
        streaming: true,
      },
    });
  },
);
