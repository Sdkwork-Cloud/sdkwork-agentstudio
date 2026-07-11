import assert from 'node:assert/strict';
import { storage, studio } from '@sdkwork/agentstudio-pc-infrastructure';
import { llmService } from './llmService.ts';
import {
  PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
  providerRoutingCatalogService,
} from '../services/providerRoutingCatalogService.ts';
import { instanceStore } from '../stores/instanceStore.ts';

const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('llmService requires an active instance instead of direct Gemini credentials', async () => {
  const initialState = instanceStore.getState();

  try {
    instanceStore.setState({
      ...initialState,
      activeInstanceId: null,
    });

    await assert.rejects(
      () =>
        llmService.generateContent({
          prompt: 'hello',
        }),
      /Select or start an AI-compatible instance/,
    );
  } finally {
    instanceStore.setState(initialState, true);
  }
});

await runTest(
  'llmService resolves the request model from the shared provider routing catalog',
  async () => {
    const initialState = instanceStore.getState();
    const originalGetStorageInfo = storage.getStorageInfo;
    const originalListKeys = storage.listKeys;
    const originalGetText = storage.getText;
    const originalGetInstance = studio.getInstance;
    const originalListProviderRoutingRecords =
      providerRoutingCatalogService.listProviderRoutingRecords;
    const originalFetch = globalThis.fetch;
    const requestTargets: { url: string | null; model: string | null } = {
      url: null,
      model: null,
    };

    try {
      instanceStore.setState({
        ...initialState,
        activeInstanceId: BUILT_IN_INSTANCE_ID,
      });

      storage.getStorageInfo = async () => null;
      storage.listKeys = async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        keys: [],
      });
      storage.getText = async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key: 'unused',
        value: null,
      });

      studio.getInstance = async () =>
        ({
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          baseUrl: 'http://127.0.0.1:21280',
          config: {
            authToken: 'test-token',
            baseUrl: 'http://127.0.0.1:21280',
          },
        }) as any;

      providerRoutingCatalogService.listProviderRoutingRecords = async () => [
        {
          id: 'provider-config-openai-primary',
          schemaVersion: 1,
          name: 'Primary OpenAI',
          enabled: true,
          isDefault: true,
          managedBy: 'user',
          clientProtocol: 'openai-compatible',
          upstreamProtocol: 'openai-compatible',
          providerId: 'openai',
          upstreamBaseUrl: 'https://api.openai.com/v1',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-live-secret',
          defaultModelId: 'gpt-5.4',
          reasoningModelId: 'o4-mini',
          embeddingModelId: 'text-embedding-3-large',
          models: [
            { id: 'gpt-5.4', name: 'GPT-5.4' },
            { id: 'o4-mini', name: 'o4-mini' },
            { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
          ],
          notes: undefined,
          exposeTo: ['openclaw'],
          config: {
            temperature: 0.2,
            topP: 1,
            maxTokens: 8192,
            timeoutMs: 60000,
            streaming: true,
          },
          createdAt: 1,
          updatedAt: 1,
        },
      ];

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requestTargets.url = String(input);
        const body =
          typeof init?.body === 'string' ? JSON.parse(init.body) : (init?.body as Record<string, unknown>);
        requestTargets.model = typeof body?.model === 'string' ? body.model : null;

        return new Response(JSON.stringify({ content: 'catalog-driven text' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }) as typeof fetch;

      const result = await llmService.generateContent({
        prompt: 'hello',
      });

      assert.equal(requestTargets.url, 'http://127.0.0.1:21280/v1/chat/completions');
      assert.equal(requestTargets.model, 'gpt-5.4');
      assert.equal(result, 'catalog-driven text');
    } finally {
      storage.getStorageInfo = originalGetStorageInfo;
      storage.listKeys = originalListKeys;
      storage.getText = originalGetText;
      studio.getInstance = originalGetInstance;
      providerRoutingCatalogService.listProviderRoutingRecords =
        originalListProviderRoutingRecords;
      globalThis.fetch = originalFetch;
      instanceStore.setState(initialState, true);
    }
  },
);

await runTest(
  'llmService aborts a generation request using the provider routing timeout',
  async () => {
    const initialState = instanceStore.getState();
    const originalGetStorageInfo = storage.getStorageInfo;
    const originalListKeys = storage.listKeys;
    const originalGetText = storage.getText;
    const originalGetInstance = studio.getInstance;
    const originalListProviderRoutingRecords =
      providerRoutingCatalogService.listProviderRoutingRecords;
    const originalFetch = globalThis.fetch;
    let sawAbortSignal = false;

    try {
      instanceStore.setState({
        ...initialState,
        activeInstanceId: BUILT_IN_INSTANCE_ID,
      });

      storage.getStorageInfo = async () => null;
      storage.listKeys = async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        keys: [],
      });
      storage.getText = async () => ({
        profileId: 'default-sqlite',
        namespace: PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
        key: 'unused',
        value: null,
      });

      studio.getInstance = async () =>
        ({
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          baseUrl: 'http://127.0.0.1:21280',
          config: {
            authToken: 'test-token',
            baseUrl: 'http://127.0.0.1:21280',
          },
        }) as any;

      providerRoutingCatalogService.listProviderRoutingRecords = async () => [
        {
          id: 'provider-config-openai-primary',
          schemaVersion: 1,
          name: 'Primary OpenAI',
          enabled: true,
          isDefault: true,
          managedBy: 'user',
          clientProtocol: 'openai-compatible',
          upstreamProtocol: 'openai-compatible',
          providerId: 'openai',
          upstreamBaseUrl: 'https://api.openai.com/v1',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-live-secret',
          defaultModelId: 'gpt-5.4',
          reasoningModelId: 'o4-mini',
          embeddingModelId: 'text-embedding-3-large',
          models: [
            { id: 'gpt-5.4', name: 'GPT-5.4' },
          ],
          notes: undefined,
          exposeTo: ['openclaw'],
          config: {
            temperature: 0.2,
            topP: 1,
            maxTokens: 8192,
            timeoutMs: 10,
            streaming: true,
          },
          createdAt: 1,
          updatedAt: 1,
        },
      ];

      globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal;
        sawAbortSignal = Boolean(signal);

        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(
              signal.reason instanceof Error
                ? signal.reason
                : new Error('AI generation request aborted.'),
            );
          });
        });
      }) as typeof fetch;

      const result = await Promise.race([
        llmService.generateContent({ prompt: 'hello' }).then(
          () => 'resolved',
          (error: unknown) => (error instanceof Error ? error.message : String(error)),
        ),
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('hung'), 50);
        }),
      ]);

      assert.match(result, /timed out/i);
      assert.equal(sawAbortSignal, true);
    } finally {
      storage.getStorageInfo = originalGetStorageInfo;
      storage.listKeys = originalListKeys;
      storage.getText = originalGetText;
      studio.getInstance = originalGetInstance;
      providerRoutingCatalogService.listProviderRoutingRecords =
        originalListProviderRoutingRecords;
      globalThis.fetch = originalFetch;
      instanceStore.setState(initialState, true);
    }
  },
);
