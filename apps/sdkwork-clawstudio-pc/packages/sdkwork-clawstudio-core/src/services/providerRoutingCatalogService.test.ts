import assert from 'node:assert/strict';
import {
  PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
  createProviderRoutingCatalogService,
  listKnownProviderRoutingChannels,
  normalizeProviderRoutingDraft,
} from './providerRoutingCatalogService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'provider routing catalog normalizes dirty drafts through the shared legacy route standard contract',
  () => {
    const normalized = normalizeProviderRoutingDraft({
      presetId: ' openai ',
      name: ' OpenAI Alias ',
      providerId: '',
      channelId: ' api-router-openai ',
      apiKey: ' sk-openai ',
      clientProtocol: undefined,
      upstreamProtocol: undefined,
      baseUrl: ' https://api.openai.com/v1/ ',
      defaultModelId: ' gpt-5.4 ',
      reasoningModelId: ' o4-mini ',
      embeddingModelId: ' atlas-index ',
      models: [
        { id: ' gpt-5.4 ', name: ' GPT-5.4 ' },
        { id: ' o4-mini ', name: ' o4-mini ' },
        { id: ' atlas-index ', name: ' Atlas Index ' },
        { id: 'gpt-5.4', name: 'Duplicate GPT-5.4' },
      ],
      exposeTo: [' openclaw ', 'openclaw', ' desktop-clients '],
      notes: ' shared route ',
      config: {
        temperature: 0.35,
        streaming: false,
      },
    } as any);

    assert.equal(normalized.presetId, 'openai');
    assert.equal(normalized.name, 'OpenAI Alias');
    assert.equal(normalized.providerId, 'openai');
    assert.equal(normalized.clientProtocol, 'openai-compatible');
    assert.equal(normalized.upstreamProtocol, 'openai-compatible');
    assert.equal(normalized.upstreamBaseUrl, 'https://api.openai.com/v1');
    assert.equal(normalized.baseUrl, 'https://api.openai.com/v1');
    assert.equal(normalized.apiKey, 'sk-openai');
    assert.equal(normalized.defaultModelId, 'gpt-5.4');
    assert.equal(normalized.reasoningModelId, 'o4-mini');
    assert.equal(normalized.embeddingModelId, 'atlas-index');
    assert.deepEqual(normalized.models, [
      { id: 'gpt-5.4', name: 'Duplicate GPT-5.4' },
      { id: 'o4-mini', name: 'o4-mini' },
      { id: 'atlas-index', name: 'Atlas Index' },
    ]);
    assert.deepEqual(normalized.exposeTo, ['openclaw', 'desktop-clients']);
    assert.equal(normalized.notes, 'shared route');
    assert.deepEqual(normalized.config, {
      temperature: 0.35,
      topP: 1,
      maxTokens: 8192,
      timeoutMs: 60000,
      streaming: false,
    });
  },
);

await runTest(
  'provider routing catalog exposes official Fireworks and Amazon Bedrock Mantle channels',
  () => {
    const channels = listKnownProviderRoutingChannels();
    const fireworksChannel = channels.find((channel) => channel.id === 'fireworks');
    const mantleChannel = channels.find((channel) => channel.id === 'amazon-bedrock-mantle');

    assert.ok(fireworksChannel);
    assert.equal(fireworksChannel?.name, 'Fireworks');
    assert.equal(fireworksChannel?.vendor, 'Fireworks AI');
    assert.match(fireworksChannel?.modelFamily ?? '', /Kimi|Qwen|Gemma/);

    assert.ok(mantleChannel);
    assert.equal(mantleChannel?.name, 'Amazon Bedrock Mantle');
    assert.equal(mantleChannel?.vendor, 'Amazon Web Services');
    assert.match(mantleChannel?.description ?? '', /Mantle/i);
  },
);

await runTest(
  'provider routing catalog exposes additional official proxy and gateway providers from the current OpenClaw directory',
  () => {
    const channels = listKnownProviderRoutingChannels();
    const cloudflareChannel = channels.find((channel) => channel.id === 'cloudflare-ai-gateway');
    const groqChannel = channels.find((channel) => channel.id === 'groq');
    const ollamaChannel = channels.find((channel) => channel.id === 'ollama');
    const sglangChannel = channels.find((channel) => channel.id === 'sglang');
    const vercelChannel = channels.find((channel) => channel.id === 'vercel-ai-gateway');
    const togetherChannel = channels.find((channel) => channel.id === 'together');
    const litellmChannel = channels.find((channel) => channel.id === 'litellm');
    const kiloChannel = channels.find((channel) => channel.id === 'kilocode');
    const vllmChannel = channels.find((channel) => channel.id === 'vllm');
    const veniceChannel = channels.find((channel) => channel.id === 'venice');

    assert.ok(cloudflareChannel);
    assert.equal(cloudflareChannel?.vendor, 'Cloudflare');
    assert.match(cloudflareChannel?.description ?? '', /Anthropic|Gateway|header/i);
    assert.match(cloudflareChannel?.modelFamily ?? '', /Claude/i);

    assert.ok(groqChannel);
    assert.equal(groqChannel?.vendor, 'Groq');
    assert.match(groqChannel?.description ?? '', /OpenAI-compatible|LPU|open-source/i);

    assert.ok(ollamaChannel);
    assert.equal(ollamaChannel?.vendor, 'Ollama');
    assert.match(ollamaChannel?.description ?? '', /native API|local|open-source/i);
    assert.match(ollamaChannel?.modelFamily ?? '', /GLM|GPT-OSS|Llama/i);

    assert.ok(sglangChannel);
    assert.equal(sglangChannel?.vendor, 'SGLang');
    assert.match(sglangChannel?.description ?? '', /OpenAI-compatible|self-hosted|local/i);

    assert.ok(vercelChannel);
    assert.equal(vercelChannel?.vendor, 'Vercel');
    assert.match(vercelChannel?.description ?? '', /Anthropic|gateway|models/i);

    assert.ok(togetherChannel);
    assert.equal(togetherChannel?.vendor, 'Together AI');
    assert.match(togetherChannel?.modelFamily ?? '', /Kimi|GLM|Llama/);

    assert.ok(litellmChannel);
    assert.equal(litellmChannel?.vendor, 'LiteLLM');
    assert.match(litellmChannel?.description ?? '', /gateway|routing/i);

    assert.ok(kiloChannel);
    assert.equal(kiloChannel?.vendor, 'Kilo Code');
    assert.match(kiloChannel?.modelFamily ?? '', /Auto|Claude|GPT|Gemini/);

    assert.ok(vllmChannel);
    assert.equal(vllmChannel?.vendor, 'vLLM');
    assert.match(vllmChannel?.description ?? '', /OpenAI-compatible|self-hosted/i);

    assert.ok(veniceChannel);
    assert.equal(veniceChannel?.vendor, 'Venice AI');
    assert.match(veniceChannel?.modelFamily ?? '', /Kimi|Claude|Qwen/);
  },
);

await runTest(
  'provider routing catalog reads configured routes from storage and derives route-aware channel counts',
  async () => {
    const service = createProviderRoutingCatalogService({
      storageApi: {
        getStorageInfo: async () => ({
          provider: 'workspace',
          activeProfileId: 'profile-main',
          profiles: [
            {
              id: 'profile-main',
              provider: 'sqlite',
              label: 'Main',
              active: true,
              readOnly: false,
            },
          ],
        }),
        listKeys: async ({ namespace }) => {
          assert.equal(namespace, PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE);
          return {
            keys: ['provider-config-openai', 'provider-config-anthropic', 'provider-config-custom'],
          };
        },
        getText: async ({ key }) => {
          const records: Record<string, string> = {
            'provider-config-openai': JSON.stringify({
              id: 'provider-config-openai',
              schemaVersion: 1,
              name: 'OpenAI Production',
              enabled: true,
              isDefault: true,
              managedBy: 'user',
              clientProtocol: 'openai-compatible',
              upstreamProtocol: 'openai-compatible',
              providerId: 'openai',
              upstreamBaseUrl: 'https://api.openai.com/v1',
              apiKey: 'sk-openai',
              defaultModelId: 'gpt-5.4',
              exposeTo: ['openclaw'],
              models: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
              updatedAt: 30,
            }),
            'provider-config-anthropic': JSON.stringify({
              id: 'provider-config-anthropic',
              schemaVersion: 1,
              name: 'Anthropic Review',
              enabled: false,
              isDefault: false,
              managedBy: 'user',
              clientProtocol: 'openai-compatible',
              upstreamProtocol: 'anthropic',
              providerId: 'anthropic',
              upstreamBaseUrl: 'https://api.anthropic.com/v1',
              apiKey: 'sk-anthropic',
              defaultModelId: 'claude-sonnet-4-20250514',
              exposeTo: ['openclaw'],
              models: [{ id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' }],
              updatedAt: 20,
            }),
            'provider-config-custom': JSON.stringify({
              id: 'provider-config-custom',
              schemaVersion: 1,
              name: 'Acme Lab',
              enabled: true,
              isDefault: true,
              managedBy: 'user',
              clientProtocol: 'openai-compatible',
              upstreamProtocol: 'openai-compatible',
              providerId: 'acme-lab',
              upstreamBaseUrl: 'https://llm.acme.test/v1',
              apiKey: 'sk-acme',
              defaultModelId: 'acme-reasoner',
              exposeTo: ['desktop-clients'],
              models: [{ id: 'acme-reasoner', name: 'Acme Reasoner' }],
              updatedAt: 10,
            }),
          };

          return {
            value: records[key] || null,
          };
        },
      } as any,
    });

    const providers = await service.listConfiguredProviders();
    const channels = await service.listProviderChannels();

    assert.deepEqual(
      providers.map((provider) => ({
        id: provider.id,
        channelId: provider.channelId,
        status: provider.status,
        clientProtocol: provider.clientProtocol,
        upstreamProtocol: provider.upstreamProtocol,
      })).sort((left, right) => left.id.localeCompare(right.id)),
      [
        {
          id: 'local-ai-proxy-system-default-anthropic',
          channelId: 'sdkwork',
          status: 'active',
          clientProtocol: 'anthropic',
          upstreamProtocol: 'sdkwork',
        },
        {
          id: 'local-ai-proxy-system-default-gemini',
          channelId: 'sdkwork',
          status: 'active',
          clientProtocol: 'gemini',
          upstreamProtocol: 'sdkwork',
        },
        {
          id: 'provider-config-anthropic',
          channelId: 'anthropic',
          status: 'disabled',
          clientProtocol: 'openai-compatible',
          upstreamProtocol: 'anthropic',
        },
        {
          id: 'provider-config-custom',
          channelId: 'acme-lab',
          status: 'active',
          clientProtocol: 'openai-compatible',
          upstreamProtocol: 'openai-compatible',
        },
        {
          id: 'provider-config-openai',
          channelId: 'openai',
          status: 'active',
          clientProtocol: 'openai-compatible',
          upstreamProtocol: 'openai-compatible',
        },
      ],
    );

    const openaiChannel = channels.find((channel) => channel.id === 'openai');
    const anthropicChannel = channels.find((channel) => channel.id === 'anthropic');
    const customChannel = channels.find((channel) => channel.id === 'acme-lab');
    const sdkworkChannel = channels.find((channel) => channel.id === 'sdkwork');

    assert.ok(openaiChannel);
    assert.equal(openaiChannel.providerCount, 1);
    assert.equal(openaiChannel.activeProviderCount, 1);
    assert.equal(openaiChannel.warningProviderCount, 0);

    assert.ok(anthropicChannel);
    assert.equal(anthropicChannel.providerCount, 1);
    assert.equal(anthropicChannel.activeProviderCount, 0);
    assert.equal(anthropicChannel.warningProviderCount, 0);
    assert.equal(anthropicChannel.disabledProviderCount, 1);

    assert.ok(customChannel);
    assert.equal(customChannel?.name, 'Acme Lab');
    assert.equal(customChannel?.providerCount, 1);
    assert.equal(customChannel?.activeProviderCount, 1);
    assert.equal(customChannel?.modelFamily, 'Acme Reasoner');

    assert.ok(sdkworkChannel);
    assert.equal(sdkworkChannel?.providerCount, 2);
    assert.equal(sdkworkChannel?.activeProviderCount, 2);
  },
);

await runTest(
  'provider routing catalog parses stored records through the shared legacy route normalizer contract',
  async () => {
    const service = createProviderRoutingCatalogService({
      storageApi: {
        getStorageInfo: async () => ({
          provider: 'workspace',
          activeProfileId: 'profile-main',
          profiles: [
            {
              id: 'profile-main',
              provider: 'sqlite',
              label: 'Main',
              active: true,
              readOnly: false,
            },
          ],
        }),
        listKeys: async () => ({
          keys: ['provider-config-openai-alias'],
        }),
        getText: async () => ({
          value: JSON.stringify({
            id: 'provider-config-openai-alias',
            schemaVersion: 1,
            name: 'OpenAI Alias',
            enabled: true,
            isDefault: true,
            managedBy: 'user',
            clientProtocol: 'openai-compatible',
            upstreamProtocol: 'openai-compatible',
            channelId: 'api-router-openai',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: ' sk-openai ',
            defaultModelId: 'gpt-5.4',
            models: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
            exposeTo: [' openclaw ', 'openclaw'],
            createdAt: 100,
            updatedAt: 200,
          }),
        }),
      } as any,
    });

    const records = await service.listProviderRoutingRecords();
    const aliasRecord = records.find((record) => record.id === 'provider-config-openai-alias');

    assert.equal(aliasRecord?.providerId, 'openai');
    assert.equal(aliasRecord?.upstreamBaseUrl, 'https://api.openai.com/v1');
    assert.equal(aliasRecord?.apiKey, 'sk-openai');
    assert.deepEqual(aliasRecord?.exposeTo, ['openclaw']);
  },
);

await runTest(
  'provider routing catalog synthesizes the SDKWork system default route when storage is empty',
  async () => {
    const service = createProviderRoutingCatalogService({
      storageApi: {
        getStorageInfo: async () => ({
          provider: 'workspace',
          activeProfileId: 'profile-main',
          profiles: [
            {
              id: 'profile-main',
              provider: 'sqlite',
              label: 'Main',
              active: true,
              readOnly: false,
            },
          ],
        }),
        listKeys: async ({ namespace }) => {
          assert.equal(namespace, PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE);
          return {
            keys: [],
          };
        },
        getText: async () => ({
          value: null,
        }),
      } as any,
    });

    const records = await service.listProviderRoutingRecords();
    const providers = await service.listConfiguredProviders();

    assert.equal(records.length, 3);
    assert.deepEqual(
      records.map((record) => record.clientProtocol).sort(),
      ['anthropic', 'gemini', 'openai-compatible'],
    );
    assert.equal(records.every((record) => record.managedBy === 'system-default'), true);
    assert.equal(records.every((record) => record.providerId === 'sdkwork'), true);
    assert.equal(records.every((record) => record.upstreamBaseUrl === 'https://ai.sdkwork.com'), true);
    assert.equal(records.every((record) => record.apiKey === 'sk_sdkwork_api_key'), true);
    assert.deepEqual(records[0]?.config, {
      temperature: 0.2,
      topP: 1,
      maxTokens: 8192,
      timeoutMs: 60000,
      streaming: true,
    });
    assert.equal(providers.length, 3);
    assert.equal(providers.every((provider) => provider.status === 'active'), true);
    assert.equal(providers.every((provider) => provider.apiKey === 'sk_sdkwork_api_key'), true);
  },
);

await runTest(
  'provider routing catalog saves route configs with runtime config and serves them back as provider records',
  async () => {
    const store = new Map<string, string>();
    const service = createProviderRoutingCatalogService({
      now: () => 1_743_561_600_000,
      storageApi: {
        getStorageInfo: async () => ({
          provider: 'workspace',
          activeProfileId: 'profile-main',
          profiles: [
            {
              id: 'profile-main',
              provider: 'sqlite',
              label: 'Main',
              active: true,
              readOnly: false,
            },
          ],
        }),
        listKeys: async ({ profileId, namespace }) => ({
          profileId: profileId || 'profile-main',
          namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
          keys: [...store.keys()].map((entry) => entry.split(':').slice(1).join(':')),
        }),
        getText: async ({ namespace, key }) => ({
          profileId: 'profile-main',
          namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
          key,
          value: store.get(`${namespace}:${key}`) ?? null,
        }),
        putText: async ({ namespace, key, value }) => {
          store.set(`${namespace}:${key}`, value);
          return {
            profileId: 'profile-main',
            namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
            key,
          };
        },
        delete: async ({ namespace, key }) => {
          const existed = store.delete(`${namespace}:${key}`);
          return {
            profileId: 'profile-main',
            namespace: namespace || PROVIDER_CONFIG_CENTER_STORAGE_NAMESPACE,
            key,
            existed,
          };
        },
      } as any,
    });

    const saved = await service.saveProviderRoutingRecord({
      name: 'Anthropic Review',
      providerId: 'anthropic',
      clientProtocol: 'openai-compatible',
      upstreamProtocol: 'anthropic',
      upstreamBaseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'sk-anthropic',
      enabled: true,
      isDefault: true,
      managedBy: 'user',
      defaultModelId: 'claude-sonnet-4-20250514',
      reasoningModelId: 'claude-opus-4-20250514',
      embeddingModelId: undefined,
      models: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      ],
      exposeTo: ['openclaw'],
      config: {
        temperature: 0.35,
        topP: 0.9,
        maxTokens: 24000,
        timeoutMs: 90000,
        streaming: false,
        request: {
          headers: {
            'cf-aig-authorization': 'Bearer cf-gateway-secret',
            'x-openai-client': 'claw-studio',
          },
        },
      },
    });

    const records = await service.listProviderRoutingRecords();
    const providers = await service.listConfiguredProviders();

    assert.equal(saved.id.startsWith('provider-config-anthropic-'), true);
    assert.equal(saved.baseUrl, 'https://api.anthropic.com/v1');
    assert.deepEqual(saved.config, {
      temperature: 0.35,
      topP: 0.9,
      maxTokens: 24000,
      timeoutMs: 90000,
      streaming: false,
      request: {
        headers: {
          'cf-aig-authorization': 'Bearer cf-gateway-secret',
          'x-openai-client': 'claw-studio',
        },
      },
    });
    assert.equal(records.length, 3);
    assert.equal(records.some((record) => record.id === saved.id), true);
    assert.deepEqual(records.find((record) => record.id === saved.id)?.config, saved.config);
    assert.deepEqual(
      JSON.parse(store.values().next().value as string).config?.request,
      saved.config.request,
    );
    assert.equal(
      records.some(
        (record) => record.clientProtocol === 'anthropic' && record.managedBy === 'system-default',
      ),
      true,
    );
    assert.equal(
      records.some(
        (record) => record.clientProtocol === 'gemini' && record.managedBy === 'system-default',
      ),
      true,
    );
    assert.equal(providers.length, 3);
    assert.equal(providers.some((provider) => provider.id === saved.id), true);
    assert.equal(
      providers.find((provider) => provider.id === saved.id)?.baseUrl,
      'https://api.anthropic.com/v1',
    );
    assert.equal(
      providers.find((provider) => provider.id === saved.id)?.status,
      'active',
    );
  },
);
