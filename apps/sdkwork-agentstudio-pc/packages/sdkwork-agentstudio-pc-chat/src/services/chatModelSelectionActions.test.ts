import assert from 'node:assert/strict';

import { createChatModelSelectionActions } from './chatModelSelectionActions.ts';

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
  'createChatModelSelectionActions selects a channel and syncs its default model when the instance scope is active',
  () => {
    const mutations: Array<{ type: string; value: string }> = [];
    const actions = createChatModelSelectionActions({
      activeInstanceId: 'instance-a',
      activeChannelId: 'channel-a',
      channels: [
        {
          id: 'channel-a',
          defaultModelId: 'provider/model-a',
          models: [{ id: 'provider/model-a' }],
        },
        {
          id: 'channel-b',
          defaultModelId: 'provider/model-b',
          models: [{ id: 'provider/model-b' }],
        },
      ],
      setActiveChannel(instanceId, channelId) {
        mutations.push({ type: `channel:${instanceId}`, value: channelId });
      },
      setActiveModel(instanceId, modelId) {
        mutations.push({ type: `model:${instanceId}`, value: modelId });
      },
      sessionControlActions: {
        syncChannelModel(model) {
          mutations.push({ type: 'sync-channel-model', value: model ?? 'null' });
        },
        syncExplicitModel() {},
      },
    });

    actions.selectChannel('channel-b');

    assert.deepEqual(mutations, [
      { type: 'channel:instance-a', value: 'channel-b' },
      { type: 'model:instance-a', value: 'provider/model-b' },
      { type: 'sync-channel-model', value: 'provider/model-b' },
    ]);
  },
);

await runTest(
  'createChatModelSelectionActions switches the active channel during explicit model selection and keeps gateway model sync centralized',
  () => {
    const mutations: Array<{ type: string; value: string }> = [];
    const actions = createChatModelSelectionActions({
      activeInstanceId: 'instance-a',
      activeChannelId: 'channel-a',
      channels: [
        {
          id: 'channel-a',
          defaultModelId: 'provider/model-a',
          models: [{ id: 'provider/model-a' }],
        },
      ],
      setActiveChannel(instanceId, channelId) {
        mutations.push({ type: `channel:${instanceId}`, value: channelId });
      },
      setActiveModel(instanceId, modelId) {
        mutations.push({ type: `model:${instanceId}`, value: modelId });
      },
      sessionControlActions: {
        syncChannelModel() {},
        syncExplicitModel(model) {
          mutations.push({ type: 'sync-explicit-model', value: model ?? 'null' });
        },
      },
    });

    actions.selectModel('channel-b', 'provider/model-b');

    assert.deepEqual(mutations, [
      { type: 'channel:instance-a', value: 'channel-b' },
      { type: 'model:instance-a', value: 'provider/model-b' },
      { type: 'sync-explicit-model', value: 'provider/model-b' },
    ]);
  },
);

await runTest(
  'createChatModelSelectionActions stays idle when there is no active instance or the selected channel is unknown',
  () => {
    const mutations: string[] = [];
    const inactiveActions = createChatModelSelectionActions({
      activeInstanceId: null,
      activeChannelId: 'channel-a',
      channels: [
        {
          id: 'channel-a',
          defaultModelId: 'provider/model-a',
          models: [{ id: 'provider/model-a' }],
        },
      ],
      setActiveChannel() {
        mutations.push('channel');
      },
      setActiveModel() {
        mutations.push('model');
      },
      sessionControlActions: {
        syncChannelModel() {
          mutations.push('sync-channel');
        },
        syncExplicitModel() {
          mutations.push('sync-explicit');
        },
      },
    });

    inactiveActions.selectChannel('channel-a');

    const unknownChannelActions = createChatModelSelectionActions({
      activeInstanceId: 'instance-a',
      activeChannelId: 'channel-a',
      channels: [
        {
          id: 'channel-a',
          defaultModelId: 'provider/model-a',
          models: [{ id: 'provider/model-a' }],
        },
      ],
      setActiveChannel() {
        mutations.push('channel');
      },
      setActiveModel() {
        mutations.push('model');
      },
      sessionControlActions: {
        syncChannelModel() {
          mutations.push('sync-channel');
        },
        syncExplicitModel() {
          mutations.push('sync-explicit');
        },
      },
    });

    unknownChannelActions.selectChannel('channel-missing');

    assert.deepEqual(mutations, []);
  },
);
