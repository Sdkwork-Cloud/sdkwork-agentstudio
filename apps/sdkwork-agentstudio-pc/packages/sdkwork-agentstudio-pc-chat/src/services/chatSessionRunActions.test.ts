import assert from 'node:assert/strict';

import {
  canStopChatKernelRun,
  createChatSessionRunActions,
  resolveChatKernelDraftSessionOptions,
  resolveChatKernelRunDispatchMode,
  resolveChatKernelStopTarget,
  resolveChatKernelRunTarget,
} from './chatSessionRunActions.ts';

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
  'canStopChatKernelRun only reports true for stoppable kernel run paths',
  () => {
    assert.equal(
      canStopChatKernelRun({
        activeInstanceId: 'instance-openclaw',
        sendMode: 'gateway',
        runBinding: {
          sessionId: 'session-openclaw',
          runId: 'run-openclaw',
          isActive: true,
        },
      }),
      true,
    );
    assert.equal(
      canStopChatKernelRun({
        activeInstanceId: 'instance-hermes',
        sendMode: 'local',
        dispatchMode: 'authoritative',
        supportsRunAbort: false,
        runBinding: {
          sessionId: 'session-hermes',
          runId: 'run-hermes',
          isActive: true,
        },
      }),
      false,
    );
    assert.equal(
      canStopChatKernelRun({
        activeInstanceId: 'instance-hermes',
        sendMode: 'local',
        dispatchMode: 'authoritative',
        supportsRunAbort: true,
        runBinding: {
          sessionId: 'session-hermes',
          runId: 'run-hermes',
          isActive: true,
        },
      }),
      true,
    );
    assert.equal(
      canStopChatKernelRun({
        activeInstanceId: 'instance-hermes',
        sendMode: 'local',
        dispatchMode: 'authoritative',
        supportsRunAbort: true,
        runBinding: {
          sessionId: 'session-hermes',
          runId: null,
          isActive: false,
        },
      }),
      false,
    );
  },
);

await runTest(
  'resolveChatKernelStopTarget only exposes active gateway stop targets from run bindings',
  () => {
    assert.equal(
      resolveChatKernelStopTarget({
        activeInstanceId: 'instance-a',
        sendMode: 'gateway',
        runBinding: null,
      }),
      null,
    );
    assert.equal(
      resolveChatKernelStopTarget({
        activeInstanceId: 'instance-a',
        sendMode: 'gateway',
        runBinding: {
          sessionId: 'session-a',
          runId: null,
          isActive: false,
        },
      }),
      null,
    );
    assert.equal(
      resolveChatKernelStopTarget({
        activeInstanceId: 'instance-a',
        sendMode: 'local',
        runBinding: {
          sessionId: 'session-a',
          runId: 'run-a',
          isActive: true,
        },
      }),
      null,
    );
    assert.deepEqual(
      resolveChatKernelStopTarget({
        activeInstanceId: 'instance-a',
        sendMode: 'gateway',
        runBinding: {
          sessionId: 'session-a',
          runId: 'run-a',
          isActive: true,
        },
      }),
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
      },
    );
  },
);

await runTest(
  'resolveChatKernelRunTarget only exposes a kernel run target when sendMode and runtime scope are valid',
  () => {
    assert.equal(
      resolveChatKernelRunTarget({
        activeInstanceId: null,
        sessionId: 'session-a',
        sendMode: 'gateway',
      }),
      null,
    );
    assert.equal(
      resolveChatKernelRunTarget({
        activeInstanceId: 'instance-a',
        sessionId: null,
        sendMode: 'gateway',
      }),
      null,
    );
    assert.equal(
      resolveChatKernelRunTarget({
        activeInstanceId: 'instance-a',
        sessionId: 'session-a',
        sendMode: 'local',
      }),
      null,
    );
    assert.deepEqual(
      resolveChatKernelRunTarget({
        activeInstanceId: 'instance-a',
        sessionId: 'session-a',
        sendMode: 'gateway',
        dispatchMode: 'gateway',
      }),
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
      },
    );
    assert.deepEqual(
      resolveChatKernelRunTarget({
        activeInstanceId: 'instance-a',
        sessionId: 'session-a',
        sendMode: 'local',
        dispatchMode: 'authoritative',
      }),
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
      },
    );
  },
);

await runTest(
  'resolveChatKernelRunDispatchMode requires a run-capable authoritative adapter before routing local kernels through the kernel-run path',
  () => {
    assert.equal(
      resolveChatKernelRunDispatchMode({
        activeInstanceId: 'instance-no-runs',
        sendMode: 'local',
        adapterCapabilities: {
          authorityKind: 'sqlite',
          durable: true,
          writable: true,
          supported: true,
          supportsRuns: false,
        },
      }),
      'disabled',
    );
    assert.equal(
      resolveChatKernelRunDispatchMode({
        activeInstanceId: 'instance-hermes',
        sendMode: 'local',
        adapterCapabilities: {
          authorityKind: 'sqlite',
          durable: true,
          writable: true,
          supported: true,
          supportsRuns: true,
        },
      }),
      'authoritative',
    );
  },
);

await runTest(
  'resolveChatKernelDraftSessionOptions only emits gateway draft agent metadata and never invents a synthetic session id',
  () => {
    assert.equal(
      resolveChatKernelDraftSessionOptions({
        sendMode: 'local',
        sessionScopeMode: 'all',
        agentId: 'research',
      }),
      undefined,
    );
    assert.deepEqual(
      resolveChatKernelDraftSessionOptions({
        sendMode: 'gateway',
        sessionScopeMode: 'agentBound',
        agentId: 'research',
      }),
      {
        agentId: 'research',
      },
    );
  },
);

await runTest(
  'createChatSessionRunActions sends kernel messages through pending-state orchestration and reports handled state',
  async () => {
    const pendingStates: Array<string | null> = [];
    const sendCalls: Array<{
      instanceId: string;
      sessionId: string;
      content: string;
      model: string;
      attachments: Array<{ id: string }>;
      requestText: string;
    }> = [];
    const actions = createChatSessionRunActions({
      activeInstanceId: 'instance-a',
      sendMode: 'gateway',
      dispatchMode: 'gateway',
      stopRunBinding: {
        sessionId: 'session-a',
        runId: 'run-a',
        isActive: true,
      },
      setPendingSendSessionId(nextState) {
        pendingStates.push(typeof nextState === 'function' ? nextState('session-a') : nextState);
      },
      async sendKernelMessage(params) {
        sendCalls.push(params);
        return { runId: 'run-a' };
      },
      async abortSession() {
        return true;
      },
    });

    const handled = await actions.sendKernelRun({
      sessionId: 'session-a',
      content: 'hello',
      model: 'provider/model-a',
      attachments: [{ id: 'attachment-a' }],
      requestText: 'hello',
    });

    assert.equal(handled, true);
    assert.deepEqual(sendCalls, [
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
        content: 'hello',
        model: 'provider/model-a',
        attachments: [{ id: 'attachment-a' }],
        requestText: 'hello',
      },
    ]);
    assert.deepEqual(pendingStates, ['session-a', null]);
  },
);

await runTest(
  'createChatSessionRunActions supports authoritative local kernel dispatch without falling back to direct local transport',
  async () => {
    const pendingStates: Array<string | null> = [];
    const sendCalls: Array<{
      instanceId: string;
      sessionId: string;
      content: string;
    }> = [];
    const abortCalls: Array<{ instanceId: string; sessionId: string }> = [];
    const actions = createChatSessionRunActions({
      activeInstanceId: 'instance-hermes',
      sendMode: 'local',
      dispatchMode: 'authoritative',
      stopRunBinding: {
        sessionId: 'session-hermes',
        runId: 'run-hermes',
        isActive: true,
      },
      setPendingSendSessionId(nextState) {
        pendingStates.push(
          typeof nextState === 'function' ? nextState('session-hermes') : nextState,
        );
      },
      async sendKernelMessage(params) {
        sendCalls.push({
          instanceId: params.instanceId,
          sessionId: params.sessionId,
          content: params.content,
        });
        return { runId: 'run-hermes' };
      },
      async abortSession(params) {
        abortCalls.push(params);
        return true;
      },
    });

    assert.equal(
      await actions.sendKernelRun({
        sessionId: 'session-hermes',
        content: 'hello hermes',
      }),
      true,
    );
    assert.equal(await actions.stopActiveRun(), true);
    assert.deepEqual(sendCalls, [
      {
        instanceId: 'instance-hermes',
        sessionId: 'session-hermes',
        content: 'hello hermes',
      },
    ]);
    assert.deepEqual(abortCalls, [
      {
        instanceId: 'instance-hermes',
        sessionId: 'session-hermes',
      },
    ]);
    assert.deepEqual(pendingStates, ['session-hermes', null]);
  },
);

await runTest(
  'createChatSessionRunActions rethrows kernel send failures after clearing pending state',
  async () => {
    const pendingStates: Array<string | null> = [];
    const actions = createChatSessionRunActions({
      activeInstanceId: 'instance-hermes',
      sendMode: 'local',
      dispatchMode: 'authoritative',
      stopRunBinding: null,
      setPendingSendSessionId(nextState) {
        pendingStates.push(
          typeof nextState === 'function' ? nextState('session-hermes') : nextState,
        );
      },
      async sendKernelMessage() {
        throw new Error('kernel send failed');
      },
      async abortSession() {
        return false;
      },
      logError() {},
    });

    await assert.rejects(
      () =>
        actions.sendKernelRun({
          sessionId: 'session-hermes',
          content: 'hello hermes',
        }),
      /kernel send failed/,
    );
    assert.deepEqual(pendingStates, ['session-hermes', null]);
  },
);

await runTest(
  'createChatSessionRunActions stops only active gateway run bindings and stays idle otherwise',
  async () => {
    const abortCalls: Array<{ instanceId: string; sessionId: string }> = [];
    const gatewayActions = createChatSessionRunActions({
      activeInstanceId: 'instance-a',
      sendMode: 'gateway',
      dispatchMode: 'gateway',
      stopRunBinding: {
        sessionId: 'session-a',
        runId: 'run-a',
        isActive: true,
      },
      setPendingSendSessionId() {},
      async sendKernelMessage() {
        return { runId: 'run-a' };
      },
      async abortSession(params) {
        abortCalls.push(params);
        return true;
      },
    });
    const localActions = createChatSessionRunActions({
      activeInstanceId: 'instance-a',
      sendMode: 'local',
      dispatchMode: 'disabled',
      stopRunBinding: {
        sessionId: 'session-a',
        runId: 'run-a',
        isActive: true,
      },
      setPendingSendSessionId() {},
      async sendKernelMessage() {
        return { runId: 'run-a' };
      },
      async abortSession(params) {
        abortCalls.push(params);
        return true;
      },
    });
    const inactiveGatewayActions = createChatSessionRunActions({
      activeInstanceId: 'instance-a',
      sendMode: 'gateway',
      dispatchMode: 'gateway',
      stopRunBinding: {
        sessionId: 'session-a',
        runId: null,
        isActive: false,
      },
      setPendingSendSessionId() {},
      async sendKernelMessage() {
        return { runId: 'run-a' };
      },
      async abortSession(params) {
        abortCalls.push(params);
        return true;
      },
    });

    assert.equal(await gatewayActions.stopActiveRun(), true);
    assert.equal(await localActions.stopActiveRun(), false);
    assert.equal(await inactiveGatewayActions.stopActiveRun(), false);
    assert.deepEqual(abortCalls, [
      {
        instanceId: 'instance-a',
        sessionId: 'session-a',
      },
    ]);
  },
);
