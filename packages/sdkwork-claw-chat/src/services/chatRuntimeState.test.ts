import assert from 'node:assert/strict';

import { resolveChatRuntimeState } from './chatRuntimeState.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'resolveChatRuntimeState keeps gateway identity from adapter capabilities even when the route is temporarily blocked',
  () => {
    assert.deepEqual(
      resolveChatRuntimeState({
        activeInstanceId: 'instance-openclaw',
        routeMode: 'unsupported',
        adapterCapabilities: {
          adapterId: 'openclawGateway',
          authorityKind: 'gateway',
          supported: true,
          durable: true,
          writable: true,
          supportsStreaming: true,
          supportsRuns: true,
          supportsAgentProfiles: true,
          supportsSessionMutation: true,
          reason: null,
        },
        sessionState: {
          authorityKind: 'gateway',
        },
      }),
      {
        hasResolvedContext: true,
        authorityKind: 'gateway',
        isBlocked: true,
        isChatAvailable: false,
        isGatewayAuthority: true,
        agentCatalogMode: 'kernelCatalog',
        sessionScopeMode: 'agentBound',
        sendMode: 'gateway',
        newSessionModelMode: 'modelId',
        supportsSessionScopeSync: true,
        routeLabelKey: 'chat.page.route.unsupported',
      },
    );
  },
);

await runTest(
  'resolveChatRuntimeState treats transport-backed http kernels as direct chat when the adapter is supported',
  () => {
    assert.deepEqual(
      resolveChatRuntimeState({
        activeInstanceId: 'instance-http',
        routeMode: 'instanceOpenAiHttp',
        adapterCapabilities: {
          adapterId: 'transportBacked',
          authorityKind: 'http',
          supported: true,
          durable: false,
          writable: true,
          supportsStreaming: true,
          supportsRuns: true,
          supportsAgentProfiles: false,
          supportsSessionMutation: true,
          reason: null,
        },
        sessionState: {
          authorityKind: 'http',
        },
      }),
      {
        hasResolvedContext: true,
        authorityKind: 'http',
        isBlocked: false,
        isChatAvailable: true,
        isGatewayAuthority: false,
        agentCatalogMode: 'sharedCatalog',
        sessionScopeMode: 'all',
        sendMode: 'local',
        newSessionModelMode: 'modelName',
        supportsSessionScopeSync: false,
        routeLabelKey: 'chat.page.route.direct',
      },
    );
  },
);

await runTest(
  'resolveChatRuntimeState derives gateway runtime semantics from authority instead of a specific adapter id',
  () => {
    assert.deepEqual(
      resolveChatRuntimeState({
        activeInstanceId: 'instance-gateway-custom',
        routeMode: 'instanceOpenAiHttp',
        adapterCapabilities: {
          adapterId: 'customGatewayBridge',
          authorityKind: 'gateway',
          supported: true,
          durable: true,
          writable: true,
          supportsStreaming: true,
          supportsRuns: true,
          supportsAgentProfiles: true,
          supportsSessionMutation: true,
          reason: null,
        },
        sessionState: {
          authorityKind: 'gateway',
        },
      }),
      {
        hasResolvedContext: true,
        authorityKind: 'gateway',
        isBlocked: false,
        isChatAvailable: true,
        isGatewayAuthority: true,
        agentCatalogMode: 'kernelCatalog',
        sessionScopeMode: 'agentBound',
        sendMode: 'gateway',
        newSessionModelMode: 'modelId',
        supportsSessionScopeSync: true,
        routeLabelKey: 'chat.page.route.gateway',
      },
    );
  },
);
