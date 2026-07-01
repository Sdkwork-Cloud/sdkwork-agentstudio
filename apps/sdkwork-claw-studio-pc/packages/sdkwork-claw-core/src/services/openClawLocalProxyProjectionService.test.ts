import assert from 'node:assert/strict';
import {
  OPENCLAW_LOCAL_PROXY_PROVIDER_ID,
  createOpenClawLocalProxyProjection,
} from './openClawLocalProxyProjectionService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('projects the effective default openai-compatible route into the managed local proxy provider', () => {
  const projection = createOpenClawLocalProxyProjection({
    routes: [
      {
        id: 'route-openai-default',
        schemaVersion: 1,
        name: 'OpenAI Default',
        enabled: true,
        isDefault: true,
        managedBy: 'user',
        clientProtocol: 'openai-compatible',
        upstreamProtocol: 'openai-compatible',
        providerId: 'openai',
        upstreamBaseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
        models: [
          { id: 'gpt-5.4', name: 'GPT-5.4' },
          { id: 'o4-mini', name: 'o4-mini' },
          { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
        ],
        exposeTo: ['openclaw'],
      },
    ],
    proxyBaseUrl: 'http://127.0.0.1:21280/v1',
    proxyApiKey: '${SDKWORK_LOCAL_PROXY_TOKEN}',
  });

  assert.equal(projection.provider.id, OPENCLAW_LOCAL_PROXY_PROVIDER_ID);
  assert.equal(projection.provider.channelId, 'openai-compatible');
  assert.equal(projection.provider.baseUrl, 'http://127.0.0.1:21280/v1');
  assert.equal(projection.provider.apiKey, '${SDKWORK_LOCAL_PROXY_TOKEN}');
  assert.equal(projection.provider.config?.streaming, true);
  assert.deepEqual(
    projection.provider.models.map((model) => model.id),
    ['gpt-5.4', 'o4-mini', 'text-embedding-3-large'],
  );
  assert.deepEqual(projection.selection, {
    defaultModelId: 'gpt-5.4',
    reasoningModelId: 'o4-mini',
    embeddingModelId: 'text-embedding-3-large',
  });
});

await runTest('ignores disabled default candidates and falls back to the active openai-compatible route', () => {
  const projection = createOpenClawLocalProxyProjection({
    routes: [
      {
        id: 'route-openai-disabled',
        schemaVersion: 1,
        name: 'Disabled Route',
        enabled: false,
        isDefault: true,
        managedBy: 'user',
        clientProtocol: 'openai-compatible',
        upstreamProtocol: 'openai-compatible',
        providerId: 'openai',
        upstreamBaseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-disabled',
        defaultModelId: 'gpt-5.4',
        models: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
        exposeTo: ['openclaw'],
      },
      {
        id: 'route-openai-active',
        schemaVersion: 1,
        name: 'Active Route',
        enabled: true,
        isDefault: false,
        managedBy: 'user',
        clientProtocol: 'openai-compatible',
        upstreamProtocol: 'anthropic',
        providerId: 'anthropic',
        upstreamBaseUrl: 'https://api.anthropic.com/v1',
        apiKey: 'sk-anthropic',
        defaultModelId: 'claude-sonnet-4-20250514',
        models: [{ id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' }],
        exposeTo: ['openclaw'],
      },
    ],
    proxyBaseUrl: 'http://127.0.0.1:21280/v1',
    proxyApiKey: '${SDKWORK_LOCAL_PROXY_TOKEN}',
  });

  assert.equal(projection.sourceRoute.id, 'route-openai-active');
  assert.equal(projection.provider.baseUrl, 'http://127.0.0.1:21280/v1');
  assert.equal(projection.provider.config?.streaming, true);
  assert.equal(projection.provider.notes?.includes('local proxy'), true);
});

await runTest('ignores routes that are not exposed to OpenClaw and falls back to the synthesized system default route', () => {
  const projection = createOpenClawLocalProxyProjection({
    routes: [
      {
        id: 'route-openai-desktop-only',
        schemaVersion: 1,
        name: 'OpenAI Desktop Only',
        enabled: true,
        isDefault: true,
        managedBy: 'user',
        clientProtocol: 'openai-compatible',
        upstreamProtocol: 'openai-compatible',
        providerId: 'openai',
        upstreamBaseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai',
        defaultModelId: 'gpt-5.4',
        models: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
        exposeTo: ['desktop-clients'],
      },
    ],
    proxyBaseUrl: 'http://127.0.0.1:21280/v1',
    proxyApiKey: 'sk_sdkwork_api_key',
  });

  assert.equal(projection.sourceRoute.managedBy, 'system-default');
  assert.equal(projection.sourceRoute.providerId, 'sdkwork');
  assert.equal(projection.selection.defaultModelId, 'sdkwork-chat');
  assert.deepEqual(
    projection.provider.models.map((model) => model.id),
    ['sdkwork-chat', 'sdkwork-reasoning', 'sdkwork-embedding'],
  );
});

await runTest('preserves provider runtime config when projecting the managed local proxy provider', () => {
  const projection = createOpenClawLocalProxyProjection({
    routes: [
      {
        id: 'route-openai-default',
        schemaVersion: 1,
        name: 'OpenAI Default',
        enabled: true,
        isDefault: true,
        managedBy: 'user',
        clientProtocol: 'openai-compatible',
        upstreamProtocol: 'openai-compatible',
        providerId: 'openai',
        upstreamBaseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
        models: [
          { id: 'gpt-5.4', name: 'GPT-5.4' },
          { id: 'o4-mini', name: 'o4-mini' },
          { id: 'text-embedding-3-large', name: 'text-embedding-3-large' },
        ],
        exposeTo: ['openclaw'],
      },
    ],
    proxyBaseUrl: 'http://127.0.0.1:21280/v1',
    proxyApiKey: 'sk_sdkwork_api_key',
    runtimeConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxTokens: 24000,
      timeoutMs: 90000,
      streaming: false,
    },
  });

  assert.deepEqual(projection.provider.config, {
    temperature: 0.35,
    topP: 0.9,
    maxTokens: 24000,
    timeoutMs: 90000,
    streaming: false,
  });
});

await runTest('preserves provider request overrides when projecting the managed local proxy provider', () => {
  const projection = createOpenClawLocalProxyProjection({
    routes: [
      {
        id: 'route-cloudflare-gateway',
        schemaVersion: 1,
        name: 'Cloudflare AI Gateway',
        enabled: true,
        isDefault: true,
        managedBy: 'user',
        clientProtocol: 'anthropic',
        upstreamProtocol: 'anthropic',
        providerId: 'cloudflare-ai-gateway',
        upstreamBaseUrl: 'https://gateway.ai.cloudflare.com/v1/account/gateway/anthropic',
        apiKey: 'cf-gateway-secret',
        defaultModelId: 'claude-sonnet-4-20250514',
        reasoningModelId: 'claude-opus-4-20250514',
        models: [
          { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
          { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
        ],
        exposeTo: ['openclaw'],
      },
    ],
    preferredClientProtocol: 'anthropic',
    proxyBaseUrl: 'http://127.0.0.1:21280/v1',
    proxyApiKey: 'sk_sdkwork_api_key',
    runtimeConfig: {
      temperature: 0.2,
      topP: 1,
      maxTokens: 8192,
      timeoutMs: 60000,
      streaming: true,
      request: {
        headers: {
          'cf-aig-authorization': 'Bearer cf-gateway-secret',
          'x-openai-client': 'claw-studio',
        },
      },
    },
  });

  assert.deepEqual(projection.provider.config, {
    temperature: 0.2,
    topP: 1,
    maxTokens: 8192,
    timeoutMs: 60000,
    streaming: true,
    request: {
      headers: {
        'cf-aig-authorization': 'Bearer cf-gateway-secret',
        'x-openai-client': 'claw-studio',
      },
    },
  });
});

await runTest('projects a native gemini local proxy route when the OpenClaw projection explicitly prefers gemini', () => {
  const projection = createOpenClawLocalProxyProjection({
    routes: [
      {
        id: 'route-gemini-default',
        schemaVersion: 1,
        name: 'Gemini Default',
        enabled: true,
        isDefault: true,
        managedBy: 'user',
        clientProtocol: 'gemini',
        upstreamProtocol: 'gemini',
        providerId: 'google',
        upstreamBaseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'gemini-upstream-secret',
        defaultModelId: 'gemini-2.5-pro',
        reasoningModelId: undefined,
        embeddingModelId: 'text-embedding-004',
        models: [
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          { id: 'text-embedding-004', name: 'text-embedding-004' },
        ],
        exposeTo: ['openclaw'],
      },
    ],
    preferredClientProtocol: 'gemini',
    proxyBaseUrl: 'http://127.0.0.1:21280',
    proxyApiKey: 'sk_sdkwork_api_key',
  });

  assert.equal(projection.sourceRoute.id, 'route-gemini-default');
  assert.equal(projection.provider.channelId, 'gemini');
  assert.equal(projection.provider.baseUrl, 'http://127.0.0.1:21280');
  assert.deepEqual(projection.selection, {
    defaultModelId: 'gemini-2.5-pro',
    reasoningModelId: undefined,
    embeddingModelId: 'text-embedding-004',
  });
});

await runTest('projects the synthesized native anthropic system default when the OpenClaw projection explicitly prefers anthropic', () => {
  const projection = createOpenClawLocalProxyProjection({
    routes: [],
    preferredClientProtocol: 'anthropic',
    proxyBaseUrl: 'http://127.0.0.1:21280/v1',
    proxyApiKey: 'sk_sdkwork_api_key',
  });

  assert.equal(projection.sourceRoute.clientProtocol, 'anthropic');
  assert.equal(projection.sourceRoute.managedBy, 'system-default');
  assert.equal(projection.provider.channelId, 'anthropic');
  assert.equal(projection.selection.defaultModelId, 'sdkwork-chat');
  assert.equal(projection.selection.reasoningModelId, 'sdkwork-reasoning');
});
