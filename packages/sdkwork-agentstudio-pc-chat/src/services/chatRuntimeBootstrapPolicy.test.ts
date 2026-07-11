import assert from 'node:assert/strict';

import {
  resolveChatCatalogSelectionSyncMutation,
  resolveChatBootstrapMutation,
  resolveChatPreferredModelSyncPlan,
  resolveChatVisibleSessionSyncMutation,
} from './chatRuntimeBootstrapPolicy.ts';

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
  'resolveChatBootstrapMutation lifts standardized bootstrap actions into concrete session mutations',
  () => {
    assert.equal(
      resolveChatBootstrapMutation({
        activeInstanceId: 'instance-a',
        routeMode: 'instanceOpenAiHttp',
        sendMode: 'local',
        syncState: 'idle',
        hasActiveModel: false,
        activeSessionId: null,
        sessionIds: [],
        newSessionModel: 'Model A',
      }),
      null,
    );
    assert.deepEqual(
      resolveChatBootstrapMutation({
        activeInstanceId: 'instance-a',
        routeMode: 'instanceOpenAiHttp',
        sendMode: 'local',
        syncState: 'idle',
        hasActiveModel: true,
        activeSessionId: null,
        sessionIds: [],
        newSessionModel: 'Model A',
      }),
      {
        type: 'createSession',
        model: 'Model A',
        instanceId: 'instance-a',
      },
    );
    assert.deepEqual(
      resolveChatBootstrapMutation({
        activeInstanceId: 'instance-a',
        routeMode: 'instanceOpenAiHttp',
        sendMode: 'local',
        syncState: 'idle',
        hasActiveModel: true,
        activeSessionId: 'missing',
        sessionIds: ['session-a'],
        newSessionModel: 'Model A',
      }),
      {
        type: 'selectSession',
        sessionId: 'session-a',
        instanceId: 'instance-a',
      },
    );
  },
);

await runTest(
  'resolveChatCatalogSelectionSyncMutation derives default channel and model mutations from the resolved catalog view',
  () => {
    assert.equal(
      resolveChatCatalogSelectionSyncMutation({
        activeInstanceId: null,
        channels: [
          {
            id: 'channel-a',
            defaultModelId: 'provider/model-a',
            models: [{ id: 'provider/model-a' }],
          },
        ],
        activeChannel: undefined,
        activeModel: undefined,
        activeChannelId: '',
        activeModelId: '',
        sessionSelectedModelId: null,
      }),
      null,
    );
    assert.equal(
      resolveChatCatalogSelectionSyncMutation({
        activeInstanceId: 'instance-a',
        channels: [
          {
            id: 'channel-a',
            defaultModelId: 'provider/model-a',
            models: [{ id: 'provider/model-a' }],
          },
        ],
        activeChannel: undefined,
        activeModel: undefined,
        activeChannelId: '',
        activeModelId: '',
        sessionSelectedModelId: 'provider/model-pinned',
      }),
      null,
    );
    assert.deepEqual(
      resolveChatCatalogSelectionSyncMutation({
        activeInstanceId: 'instance-a',
        channels: [
          {
            id: 'channel-a',
            defaultModelId: 'provider/model-a',
            models: [{ id: 'provider/model-a' }],
          },
        ],
        activeChannel: undefined,
        activeModel: undefined,
        activeChannelId: '',
        activeModelId: '',
        sessionSelectedModelId: null,
      }),
      {
        instanceId: 'instance-a',
        nextChannelId: 'channel-a',
        nextModelId: 'provider/model-a',
      },
    );
    assert.equal(
      resolveChatCatalogSelectionSyncMutation({
        activeInstanceId: 'instance-a',
        channels: [
          {
            id: 'channel-a',
            defaultModelId: 'provider/model-a',
            models: [{ id: 'provider/model-a' }],
          },
        ],
        activeChannel: {
          id: 'channel-a',
          defaultModelId: 'provider/model-a',
          models: [{ id: 'provider/model-a' }],
        },
        activeModel: { id: 'provider/model-a' },
        activeChannelId: 'channel-a',
        activeModelId: 'provider/model-a',
        sessionSelectedModelId: null,
      }),
      null,
    );
  },
);

await runTest(
  'resolveChatVisibleSessionSyncMutation only emits a gateway sync mutation when runtime semantics expose one',
  () => {
    assert.equal(
      resolveChatVisibleSessionSyncMutation({
        activeInstanceId: null,
        supportsVisibleSessionSync: true,
        activeSessionId: null,
        effectiveActiveSessionId: 'session-a',
      }),
      null,
    );
    assert.equal(
      resolveChatVisibleSessionSyncMutation({
        activeInstanceId: 'instance-a',
        supportsVisibleSessionSync: false,
        activeSessionId: null,
        effectiveActiveSessionId: 'session-a',
      }),
      null,
    );
    assert.deepEqual(
      resolveChatVisibleSessionSyncMutation({
        activeInstanceId: 'instance-a',
        supportsVisibleSessionSync: true,
        activeSessionId: null,
        effectiveActiveSessionId: 'session-a',
      }),
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
      },
    );
  },
);

await runTest(
  'resolveChatPreferredModelSyncPlan centralizes preferred gateway model application and scope deduplication',
  () => {
    assert.deepEqual(
      resolveChatPreferredModelSyncPlan({
        newSessionModelMode: 'modelName',
        activeInstanceId: 'instance-a',
        sessionSelectedModelId: null,
        preferredModelId: 'provider/model-a',
        catalogChannels: [],
        activeChannelId: 'channel-a',
        activeModelId: 'provider/model-b',
        effectiveGatewayAgentId: 'research',
        lastAppliedScopeKey: null,
      }),
      { type: 'resetScope' },
    );

    assert.deepEqual(
      resolveChatPreferredModelSyncPlan({
        newSessionModelMode: 'modelId',
        activeInstanceId: 'instance-a',
        sessionSelectedModelId: null,
        preferredModelId: 'provider/model-a',
        catalogChannels: [
          {
            id: 'channel-a',
            models: [{ id: 'provider/model-a' }],
          },
        ],
        activeChannelId: 'channel-b',
        activeModelId: 'provider/model-b',
        effectiveGatewayAgentId: 'research',
        lastAppliedScopeKey: null,
      }),
      {
        type: 'apply',
        scopeKey: 'instance-a:research',
        nextChannelId: 'channel-a',
        nextModelId: 'provider/model-a',
      },
    );

    assert.deepEqual(
      resolveChatPreferredModelSyncPlan({
        newSessionModelMode: 'modelId',
        activeInstanceId: 'instance-a',
        sessionSelectedModelId: null,
        preferredModelId: 'provider/model-a',
        catalogChannels: [
          {
            id: 'channel-a',
            models: [{ id: 'provider/model-a' }],
          },
        ],
        activeChannelId: 'channel-a',
        activeModelId: 'provider/model-a',
        effectiveGatewayAgentId: 'research',
        lastAppliedScopeKey: 'instance-a:research',
      }),
      { type: 'idle' },
    );
  },
);
