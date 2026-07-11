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

async function loadInstanceDetailProviderCatalogMutationSupportModule() {
  const moduleUrl = new URL('./instanceDetailProviderCatalogMutationSupport.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected instanceDetailProviderCatalogMutationSupport.ts to exist',
  );

  return import('./instanceDetailProviderCatalogMutationSupport.ts');
}

await runTest(
  'createInstanceDetailProviderCatalogMutationExecutors routes provider catalog mutations through the injected instance service surface',
  async () => {
    const { createInstanceDetailProviderCatalogMutationExecutors } =
      await loadInstanceDetailProviderCatalogMutationSupportModule();
    const calls: string[] = [];

    const executors = createInstanceDetailProviderCatalogMutationExecutors({
      instanceService: {
        updateInstanceLlmProviderConfig: async (instanceId, providerId) => {
          calls.push(`config:${instanceId}:${providerId}`);
        },
        createInstanceLlmProvider: async (instanceId, providerInput, selection) => {
          calls.push(`create:${instanceId}:${providerInput.id}:${selection.providerId}`);
        },
        updateInstanceLlmProviderModel: async (instanceId, providerId, originalId, model) => {
          calls.push(`model-update:${instanceId}:${providerId}:${originalId}:${model.id}`);
        },
        createInstanceLlmProviderModel: async (instanceId, providerId, model) => {
          calls.push(`model-create:${instanceId}:${providerId}:${model.id}`);
        },
        deleteInstanceLlmProviderModel: async (instanceId, providerId, modelId) => {
          calls.push(`model-delete:${instanceId}:${providerId}:${modelId}`);
        },
        deleteInstanceLlmProvider: async (instanceId, providerId) => {
          calls.push(`provider-delete:${instanceId}:${providerId}`);
        },
      },
    });

    await executors.executeProviderConfigUpdate('instance-153', 'provider-a', {} as any);
    await executors.executeProviderCreate(
      'instance-153',
      { id: 'provider-b' } as any,
      { providerId: 'provider-b' } as any,
    );
    await executors.executeProviderModelUpdate(
      'instance-153',
      'provider-a',
      'model-old',
      { id: 'model-new' } as any,
    );
    await executors.executeProviderModelCreate(
      'instance-153',
      'provider-a',
      { id: 'model-created' } as any,
    );
    await executors.executeProviderModelDelete('instance-153', 'provider-a', 'model-drop');
    await executors.executeProviderDelete('instance-153', 'provider-a');

    assert.deepEqual(calls, [
      'config:instance-153:provider-a',
      'create:instance-153:provider-b:provider-b',
      'model-update:instance-153:provider-a:model-old:model-new',
      'model-create:instance-153:provider-a:model-created',
      'model-delete:instance-153:provider-a:model-drop',
      'provider-delete:instance-153:provider-a',
    ]);
  },
);
