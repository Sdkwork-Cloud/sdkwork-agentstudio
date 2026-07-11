import assert from 'node:assert/strict';

import {
  createChatSessionControlActions,
  resolveChatSessionMutationTarget,
} from './chatSessionControlActions.ts';

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
  'resolveChatSessionMutationTarget exposes a kernel session target whenever the requested session is addressable',
  () => {
    assert.equal(
      resolveChatSessionMutationTarget({
        activeInstanceId: null,
        targetSessionId: 'session-a',
      }),
      null,
    );
    assert.deepEqual(
      resolveChatSessionMutationTarget({
        activeInstanceId: 'instance-a',
        targetSessionId: 'session-a',
      }),
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
      },
    );
    assert.deepEqual(
      resolveChatSessionMutationTarget({
        activeInstanceId: 'instance-a',
        targetSessionId: 'session-a',
      }),
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
      },
    );
  },
);

await runTest(
  'createChatSessionControlActions forwards gateway model sync through the resolved session target',
  async () => {
    const modelCalls: Array<{ instanceId: string; sessionId: string; model: string | null }> = [];
    const actions = createChatSessionControlActions({
      activeInstanceId: 'instance-a',
      targetSessionId: 'session-a',
      supportsModelSelection: true,
      supportsThinkingLevelControl: true,
      supportsFastModeControl: true,
      supportsVerboseLevelControl: true,
      supportsReasoningLevelControl: true,
      async setKernelSessionModel(params) {
        modelCalls.push(params);
      },
      async setKernelSessionThinkingLevel() {},
      async setKernelSessionFastMode() {},
      async setKernelSessionVerboseLevel() {},
      async setKernelSessionReasoningLevel() {},
    });

    actions.syncChannelModel('provider/model-a');
    actions.syncExplicitModel('provider/model-b');
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(modelCalls, [
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
        model: 'provider/model-a',
      },
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
        model: 'provider/model-b',
      },
    ]);
  },
);

await runTest(
  'createChatSessionControlActions forwards authoritative local model sync when the kernel advertises model selection support',
  async () => {
    const modelCalls: Array<{ instanceId: string; sessionId: string; model: string | null }> = [];
    const actions = createChatSessionControlActions({
      activeInstanceId: 'instance-hermes',
      targetSessionId: 'session-hermes',
      supportsModelSelection: true,
      supportsThinkingLevelControl: false,
      supportsFastModeControl: false,
      supportsVerboseLevelControl: false,
      supportsReasoningLevelControl: false,
      async setKernelSessionModel(params) {
        modelCalls.push(params);
      },
      async setKernelSessionThinkingLevel() {},
      async setKernelSessionFastMode() {},
      async setKernelSessionVerboseLevel() {},
      async setKernelSessionReasoningLevel() {},
    });

    actions.syncChannelModel('hermes/research');
    actions.syncExplicitModel('hermes/support');
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(modelCalls, [
      {
        instanceId: 'instance-hermes',
        sessionId: 'session-hermes',
        model: 'hermes/research',
      },
      {
        instanceId: 'instance-hermes',
        sessionId: 'session-hermes',
        model: 'hermes/support',
      },
    ]);
  },
);

await runTest(
  'createChatSessionControlActions maps fast mode and reasoning controls through the active kernel session target',
  async () => {
    const fastModeCalls: Array<{ instanceId: string; sessionId: string; fastMode: boolean | null }> = [];
    const reasoningCalls: Array<{ instanceId: string; sessionId: string; reasoningLevel: string | null }> = [];
    const actions = createChatSessionControlActions({
      activeInstanceId: 'instance-a',
      targetSessionId: 'session-a',
      supportsModelSelection: false,
      supportsThinkingLevelControl: false,
      supportsFastModeControl: true,
      supportsVerboseLevelControl: false,
      supportsReasoningLevelControl: true,
      async setKernelSessionModel() {},
      async setKernelSessionThinkingLevel() {},
      async setKernelSessionFastMode(params) {
        fastModeCalls.push(params);
      },
      async setKernelSessionVerboseLevel() {},
      async setKernelSessionReasoningLevel(params) {
        reasoningCalls.push(params);
      },
    });

    actions.onSelectFastMode?.('on');
    actions.onSelectFastMode?.('off');
    actions.onSelectFastMode?.(null);
    actions.onSelectReasoningLevel?.('stream');
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(fastModeCalls, [
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
        fastMode: true,
      },
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
        fastMode: false,
      },
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
        fastMode: null,
      },
    ]);
    assert.deepEqual(reasoningCalls, [
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
        reasoningLevel: 'stream',
      },
    ]);
    assert.equal(actions.onSelectThinkingLevel, undefined);
    assert.equal(actions.onSelectVerboseLevel, undefined);
  },
);

await runTest(
  'createChatSessionControlActions forwards non-model session controls for authoritative local kernels when the capability set enables them',
  async () => {
    const thinkingCalls: Array<{
      instanceId: string;
      sessionId: string;
      thinkingLevel: string | null;
    }> = [];
    const verboseCalls: Array<{
      instanceId: string;
      sessionId: string;
      verboseLevel: string | null;
    }> = [];
    const actions = createChatSessionControlActions({
      activeInstanceId: 'instance-hermes',
      targetSessionId: 'session-hermes',
      supportsModelSelection: false,
      supportsThinkingLevelControl: true,
      supportsFastModeControl: false,
      supportsVerboseLevelControl: true,
      supportsReasoningLevelControl: false,
      async setKernelSessionModel() {},
      async setKernelSessionThinkingLevel(params) {
        thinkingCalls.push(params);
      },
      async setKernelSessionFastMode() {},
      async setKernelSessionVerboseLevel(params) {
        verboseCalls.push(params);
      },
      async setKernelSessionReasoningLevel() {},
    });

    actions.onSelectThinkingLevel?.('deep');
    actions.onSelectVerboseLevel?.('full');
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(thinkingCalls, [
      {
        instanceId: 'instance-hermes',
        sessionId: 'session-hermes',
        thinkingLevel: 'deep',
      },
    ]);
    assert.deepEqual(verboseCalls, [
      {
        instanceId: 'instance-hermes',
        sessionId: 'session-hermes',
        verboseLevel: 'full',
      },
    ]);
  },
);

await runTest(
  'createChatSessionControlActions degrades to safe no-op handlers when no kernel session target is available',
  async () => {
    let callCount = 0;
    const actions = createChatSessionControlActions({
      activeInstanceId: 'instance-a',
      targetSessionId: null,
      supportsModelSelection: true,
      supportsThinkingLevelControl: true,
      supportsFastModeControl: true,
      supportsVerboseLevelControl: true,
      supportsReasoningLevelControl: true,
      async setKernelSessionModel() {
        callCount++;
      },
      async setKernelSessionThinkingLevel() {
        callCount++;
      },
      async setKernelSessionFastMode() {
        callCount++;
      },
      async setKernelSessionVerboseLevel() {
        callCount++;
      },
      async setKernelSessionReasoningLevel() {
        callCount++;
      },
    });

    actions.syncChannelModel('provider/model-a');
    actions.syncExplicitModel('provider/model-b');
    actions.onSelectThinkingLevel?.('high');
    actions.onSelectFastMode?.('on');
    actions.onSelectVerboseLevel?.('full');
    actions.onSelectReasoningLevel?.('stream');
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(callCount, 0);
  },
);
