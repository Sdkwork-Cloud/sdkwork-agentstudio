import assert from 'node:assert/strict';

import { createChatComposerSendActions } from './chatComposerSendActions.ts';

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
  'createChatComposerSendActions stays idle when the composer runtime is blocked or the payload is empty',
  async () => {
    let createSessionCallCount = 0;
    const actions = createChatComposerSendActions({
      activeInstanceId: null,
      activeSessionId: null,
      effectiveActiveSessionId: null,
      sendMode: 'local',
      hasActiveChannel: false,
      isChatSupportedRoute: true,
      isBusy: false,
      hasPendingInstanceRoute: false,
      activeModel: null,
      activeSkill: null,
      activeAgent: null,
      sessionScopeMode: 'all',
      sessionScopeAgentId: null,
      newSessionModel: undefined,
      async createSession() {
        createSessionCallCount += 1;
        return 'session-a';
      },
      sessionRunActions: {
        getKernelDraftSessionOptions() {
          return undefined;
        },
        async sendKernelRun() {
          return false;
        },
        async stopActiveRun() {
          return false;
        },
      },
      directRunActions: {
        async sendLocalRun() {
          return true;
        },
        stopActiveRun() {
          return false;
        },
      },
    });

    assert.equal(await actions.submit({ text: 'hello', attachments: [] }), false);
    assert.equal(await actions.submit({ text: '   ', attachments: [] }), false);
    assert.equal(createSessionCallCount, 0);
  },
);

await runTest(
  'createChatComposerSendActions creates agent-scoped gateway drafts and dispatches them through session run actions',
  async () => {
    const createSessionCalls: Array<{
      model: string | undefined;
      instanceId: string;
      options: Record<string, unknown> | undefined;
    }> = [];
    const gatewayRunCalls: Array<Record<string, unknown>> = [];
    let localRunCallCount = 0;
    const actions = createChatComposerSendActions({
      activeInstanceId: 'instance-a',
      activeSessionId: null,
      effectiveActiveSessionId: null,
      sendMode: 'gateway',
      hasActiveChannel: true,
      isChatSupportedRoute: true,
      isBusy: false,
      hasPendingInstanceRoute: false,
      activeModel: {
        id: 'provider/model-a',
        name: 'Model A',
        provider: 'provider',
        icon: 'spark',
      },
      activeSkill: null,
      activeAgent: null,
      sessionScopeMode: 'agentBound',
      sessionScopeAgentId: 'research',
      newSessionModel: 'provider/model-a',
      async createSession(model, instanceId, options) {
        createSessionCalls.push({ model, instanceId: instanceId!, options });
        return 'session-a';
      },
      sessionRunActions: {
        getKernelDraftSessionOptions(params) {
          return {
            agentId: params.agentId,
            sessionId: 'agent:research:main',
          };
        },
        async sendKernelRun(params) {
          gatewayRunCalls.push(params);
          return true;
        },
        async stopActiveRun() {
          return false;
        },
      },
      directRunActions: {
        async sendLocalRun() {
          localRunCallCount += 1;
          return true;
        },
        stopActiveRun() {
          return false;
        },
      },
    });

    assert.equal(await actions.submit({ text: 'hello', attachments: [] }), true);
    assert.deepEqual(createSessionCalls, [
      {
        model: 'provider/model-a',
        instanceId: 'instance-a',
        options: {
          agentId: 'research',
          sessionId: 'agent:research:main',
        },
      },
    ]);
    assert.deepEqual(gatewayRunCalls, [
      {
        sessionId: 'session-a',
        content: 'hello',
        model: 'provider/model-a',
        attachments: [],
        requestText: 'hello',
      },
    ]);
    assert.equal(localRunCallCount, 0);
  },
);

await runTest(
  'createChatComposerSendActions creates direct sessions with the active model name and active agent binding before falling through to local run actions',
  async () => {
    const createSessionCalls: Array<{
      model: string | undefined;
      instanceId: string | undefined;
      options: Record<string, unknown> | undefined;
    }> = [];
    const localRunCalls: Array<Record<string, unknown>> = [];
    let gatewayRunCallCount = 0;
    const actions = createChatComposerSendActions({
      activeInstanceId: null,
      activeSessionId: null,
      effectiveActiveSessionId: null,
      sendMode: 'local',
      hasActiveChannel: true,
      isChatSupportedRoute: true,
      isBusy: false,
      hasPendingInstanceRoute: false,
      activeModel: {
        id: 'provider/model-a',
        name: 'Model A',
        provider: 'provider',
        icon: 'spark',
      },
      activeSkill: { id: 'skill-a', name: 'Skill A', description: 'desc', category: 'tool' },
      activeAgent: { id: 'agent-a', name: 'Agent A', role: 'assistant', systemPrompt: 'prompt' },
      sessionScopeMode: 'all',
      sessionScopeAgentId: null,
      newSessionModel: undefined,
      async createSession(model, instanceId, options) {
        createSessionCalls.push({ model, instanceId, options });
        return 'session-a';
      },
      sessionRunActions: {
        getKernelDraftSessionOptions() {
          return undefined;
        },
        async sendKernelRun() {
          gatewayRunCallCount += 1;
          return false;
        },
        async stopActiveRun() {
          return false;
        },
      },
      directRunActions: {
        async sendLocalRun(params) {
          localRunCalls.push(params);
          return true;
        },
        stopActiveRun() {
          return false;
        },
      },
    });

    assert.equal(await actions.submit({ text: 'hello', attachments: [] }), true);
    assert.deepEqual(createSessionCalls, [
      {
        model: 'Model A',
        instanceId: undefined,
        options: {
          agentId: 'agent-a',
          agentLabel: 'Agent A',
        },
      },
    ]);
    assert.equal(gatewayRunCallCount, 1);
    assert.deepEqual(localRunCalls, [
      {
        sessionId: 'session-a',
        content: 'hello',
        attachments: [],
        requestText: 'hello',
        requestModel: {
          id: 'provider/model-a',
          name: 'Model A',
          provider: 'provider',
          icon: 'spark',
        },
        requestSkill: { id: 'skill-a', name: 'Skill A', description: 'desc', category: 'tool' },
        requestAgent: { id: 'agent-a', name: 'Agent A', role: 'assistant', systemPrompt: 'prompt' },
      },
    ]);
  },
);

await runTest(
  'createChatComposerSendActions does not fall through to local transport when kernel dispatch fails',
  async () => {
    let localRunCallCount = 0;
    const actions = createChatComposerSendActions({
      activeInstanceId: 'instance-hermes',
      activeSessionId: 'session-hermes',
      effectiveActiveSessionId: 'session-hermes',
      sendMode: 'local',
      hasActiveChannel: true,
      isChatSupportedRoute: true,
      isBusy: false,
      hasPendingInstanceRoute: false,
      activeModel: {
        id: 'hermes/model-a',
        name: 'Hermes Model A',
        provider: 'hermes',
        icon: 'spark',
      },
      activeSkill: null,
      activeAgent: null,
      sessionScopeMode: 'all',
      sessionScopeAgentId: null,
      newSessionModel: undefined,
      async createSession() {
        return 'session-hermes';
      },
      sessionRunActions: {
        getKernelDraftSessionOptions() {
          return undefined;
        },
        async sendKernelRun() {
          throw new Error('kernel dispatch failed');
        },
        async stopActiveRun() {
          return false;
        },
      },
      directRunActions: {
        async sendLocalRun() {
          localRunCallCount += 1;
          return true;
        },
        stopActiveRun() {
          return false;
        },
      },
    });

    await assert.rejects(
      () => actions.submit({ text: 'hello hermes', attachments: [] }),
      /kernel dispatch failed/,
    );
    assert.equal(localRunCallCount, 0);
  },
);

await runTest(
  'createChatComposerSendActions suppresses re-entrant submits while a send is already in flight and allows later retries once the send settles',
  async () => {
    const kernelRunCalls: Array<Record<string, unknown>> = [];
    let resolveSend!: (value: boolean) => void;
    const firstSendPromise = new Promise<boolean>((resolve) => {
      resolveSend = resolve;
    });
    const actions = createChatComposerSendActions({
      activeInstanceId: 'instance-hermes',
      selectedSessionId: 'session-hermes',
      sendMode: 'local',
      hasActiveChannel: true,
      isChatSupportedRoute: true,
      isBusy: false,
      hasPendingInstanceRoute: false,
      activeModel: {
        id: 'hermes/model-a',
        name: 'Hermes Model A',
        provider: 'hermes',
        icon: 'spark',
      },
      activeSkill: null,
      activeAgent: null,
      sessionScopeMode: 'all',
      sessionScopeAgentId: null,
      newSessionModel: undefined,
      async createSession() {
        return 'session-hermes';
      },
      sessionRunActions: {
        getKernelDraftSessionOptions() {
          return undefined;
        },
        async sendKernelRun(params) {
          kernelRunCalls.push(params);
          if (kernelRunCalls.length === 1) {
            return firstSendPromise;
          }
          return true;
        },
      },
      directRunActions: {
        async sendLocalRun() {
          return true;
        },
      },
    });

    const pendingSubmit = actions.submit({ text: 'hello hermes', attachments: [] });
    const duplicateSubmitResult = await actions.submit({
      text: 'hello hermes',
      attachments: [],
    });

    assert.equal(duplicateSubmitResult, false);
    assert.equal(kernelRunCalls.length, 1);

    resolveSend(true);
    assert.equal(await pendingSubmit, true);

    assert.equal(
      await actions.submit({ text: 'hello hermes again', attachments: [] }),
      true,
    );
    assert.equal(kernelRunCalls.length, 2);
  },
);

await runTest(
  'createChatComposerSendActions preserves the in-flight submit lock across recreated action instances when they share the same lock ref',
  async () => {
    const kernelRunCalls: Array<Record<string, unknown>> = [];
    let resolveSend!: (value: boolean) => void;
    const firstSendPromise = new Promise<boolean>((resolve) => {
      resolveSend = resolve;
    });
    const sharedSubmitLockRef: { current: Promise<boolean> | null } = {
      current: null,
    };
    const createActions = () =>
      createChatComposerSendActions({
        activeInstanceId: 'instance-hermes',
        selectedSessionId: 'session-hermes',
        sendMode: 'local',
        hasActiveChannel: true,
        isChatSupportedRoute: true,
        isBusy: false,
        hasPendingInstanceRoute: false,
        activeModel: {
          id: 'hermes/model-a',
          name: 'Hermes Model A',
          provider: 'hermes',
          icon: 'spark',
        },
        activeSkill: null,
        activeAgent: null,
        sessionScopeMode: 'all',
        sessionScopeAgentId: null,
        newSessionModel: undefined,
        inFlightSubmitRef: sharedSubmitLockRef,
        async createSession() {
          return 'session-hermes';
        },
        sessionRunActions: {
          getKernelDraftSessionOptions() {
            return undefined;
          },
          async sendKernelRun(params) {
            kernelRunCalls.push(params);
            if (kernelRunCalls.length === 1) {
              return firstSendPromise;
            }
            return true;
          },
        },
        directRunActions: {
          async sendLocalRun() {
            return true;
          },
        },
      });

    const firstActions = createActions();
    const pendingSubmit = firstActions.submit({
      text: 'hello hermes',
      attachments: [],
    });

    const recreatedActions = createActions();
    const duplicateSubmitResult = await recreatedActions.submit({
      text: 'hello hermes after rerender',
      attachments: [],
    });

    assert.equal(duplicateSubmitResult, false);
    assert.equal(kernelRunCalls.length, 1);

    resolveSend(true);
    assert.equal(await pendingSubmit, true);
    assert.equal(sharedSubmitLockRef.current, null);
  },
);
