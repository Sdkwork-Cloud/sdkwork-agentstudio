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

let providerModelCatalogServiceModule:
  | typeof import('./openClawProviderModelCatalogService.ts')
  | undefined;

try {
  providerModelCatalogServiceModule = await import('./openClawProviderModelCatalogService.ts');
} catch {
  providerModelCatalogServiceModule = undefined;
}

await runTest(
  'openClawProviderModelCatalogService exposes the provider model catalog helpers',
  () => {
    assert.ok(
      providerModelCatalogServiceModule,
      'Expected openClawProviderModelCatalogService.ts to exist',
    );
    assert.equal(
      typeof providerModelCatalogServiceModule?.resolveOpenClawProviderSnapshotModelCatalogState,
      'function',
    );
    assert.equal(
      typeof providerModelCatalogServiceModule?.inferOpenClawProviderDocumentContextWindow,
      'function',
    );
    assert.equal(
      typeof providerModelCatalogServiceModule?.inferOpenClawProviderDocumentMaxTokens,
      'function',
    );
  },
);

await runTest(
  'openClawProviderModelCatalogService normalizes snapshot model catalogs with reasoning and embedding heuristics',
  () => {
    const result =
      providerModelCatalogServiceModule?.resolveOpenClawProviderSnapshotModelCatalogState({
        models: [
          { id: ' text-embedding-3-large ', name: ' text-embedding-3-large ' },
          { id: ' gpt-5.4 ', name: ' GPT-5.4 ' },
          { id: 'o4-mini', name: ' o4-mini ' },
          { id: 'gpt-5.4', name: 'Duplicate GPT-5.4' },
        ],
        selection: {
          defaultModelId: 'gpt-5.4',
          reasoningModelId: 'o4-mini',
          embeddingModelId: 'text-embedding-3-large',
        },
      });

    assert.deepEqual(result, {
      selection: {
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
      },
      models: [
        {
          id: 'gpt-5.4',
          name: 'GPT-5.4',
          role: 'primary',
          contextWindow: '128K',
        },
        {
          id: 'o4-mini',
          name: 'o4-mini',
          role: 'reasoning',
          contextWindow: '200K',
        },
        {
          id: 'text-embedding-3-large',
          name: 'text-embedding-3-large',
          role: 'embedding',
          contextWindow: '8K',
        },
      ],
    });
  },
);

await runTest(
  'openClawProviderModelCatalogService derives provider document metadata from projected roles',
  () => {
    assert.equal(
      providerModelCatalogServiceModule?.inferOpenClawProviderDocumentContextWindow('default'),
      128000,
    );
    assert.equal(
      providerModelCatalogServiceModule?.inferOpenClawProviderDocumentContextWindow('reasoning'),
      200000,
    );
    assert.equal(
      providerModelCatalogServiceModule?.inferOpenClawProviderDocumentContextWindow('embedding'),
      8192,
    );
    assert.equal(
      providerModelCatalogServiceModule?.inferOpenClawProviderDocumentMaxTokens('default'),
      32000,
    );
    assert.equal(
      providerModelCatalogServiceModule?.inferOpenClawProviderDocumentMaxTokens('embedding'),
      8192,
    );
  },
);
