import assert from 'node:assert/strict';
import {
  createKernelChatAuthority,
  createKernelChatSessionRef,
  type KernelChatAgentProfile,
  type KernelChatMessage,
  type KernelChatRun,
  type KernelChatSession,
} from '@sdkwork/clawstudio-types';
import { createHermesKernelChatAdapter } from './hermesKernelChatAdapter.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
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

await runTest('hermes kernel chat adapter stays unsupported until authoritative Hermes dependencies are wired', () => {
  const adapter = createHermesKernelChatAdapter();
  const capabilities = adapter.getCapabilities();

  assert.deepEqual(capabilities, {
    adapterId: 'hermes',
    authorityKind: 'sqlite',
    supported: false,
    durable: true,
    writable: false,
    supportsStreaming: false,
    supportsRuns: false,
    supportsAgentProfiles: false,
    supportsSessionMutation: false,
    capabilitySet: {
      supportsAgentProfiles: false,
      supportsSessionMutation: false,
      supportsStreaming: false,
      supportsRuns: false,
      supportsRunAbort: false,
      supportsModelSelection: false,
      supportsReasoningControl: false,
      supportsThinkingLevel: false,
      supportsFastMode: false,
      supportsVerboseLevel: false,
      supportsAttachments: false,
    },
    reason: 'Hermes chat transport is not wired yet.',
  });
  assert.equal(typeof adapter.listAgentProfiles, 'function');
  assert.equal(typeof adapter.listSessions, 'function');
  assert.equal(typeof adapter.getSession, 'function');
  assert.equal(typeof adapter.createSession, 'function');
  assert.equal(typeof adapter.loadMessages, 'function');
  assert.equal(typeof adapter.startRun, 'function');
  assert.equal(typeof adapter.abortRun, 'function');
  assert.equal(typeof adapter.listRuns, 'function');
  assert.equal(typeof adapter.getRun, 'function');
});

await runTest('hermes kernel chat adapter reports partial Hermes wiring truthfully', () => {
  const adapter = createHermesKernelChatAdapter({
    async listSessions() {
      return [];
    },
    async getSession() {
      return null;
    },
    async loadMessages() {
      return [];
    },
  });

  const capabilities = adapter.getCapabilities();

  assert.equal(capabilities.supported, false);
  assert.equal(capabilities.writable, false);
  assert.equal(capabilities.supportsStreaming, false);
  assert.equal(capabilities.supportsRuns, false);
  assert.equal(capabilities.supportsAgentProfiles, false);
  assert.equal(capabilities.supportsSessionMutation, false);
  assert.equal(capabilities.capabilitySet.supportsRunAbort, false);
  assert.match(capabilities.reason ?? '', /createSession/i);
  assert.match(capabilities.reason ?? '', /startRun/i);
});

await runTest(
  'hermes kernel chat adapter defaults to non-streaming and non-abortable runs unless explicitly declared',
  () => {
    const adapter = createHermesKernelChatAdapter({
      async listSessions() {
        return [];
      },
      async getSession() {
        return null;
      },
      async createSession() {
        throw new Error('not needed');
      },
      async startRun() {
        throw new Error('not needed');
      },
      async abortRun() {
        return false;
      },
      async loadMessages() {
        return [];
      },
    });

    const capabilities = adapter.getCapabilities();

    assert.equal(capabilities.supportsRuns, true);
    assert.equal(capabilities.supportsStreaming, false);
    assert.equal(capabilities.capabilitySet.supportsStreaming, false);
    assert.equal(capabilities.capabilitySet.supportsRunAbort, false);
  },
);

await runTest('hermes kernel chat adapter derives capabilities from injected dependencies and delegates calls', async () => {
  const sessionRef = createKernelChatSessionRef({
    kernelId: 'hermes',
    instanceId: 'instance-hermes',
    sessionId: 'session-1',
    agentId: 'agent-hermes',
  });
  const session: KernelChatSession = {
    ref: sessionRef,
    authority: createKernelChatAuthority({
      kind: 'sqlite',
    }),
    lifecycle: 'ready',
    title: 'Hermes Session',
    createdAt: 1,
    updatedAt: 2,
    messageCount: 1,
    activeRunId: 'run-1',
  };
  const run: KernelChatRun = {
    id: 'run-1',
    sessionRef,
    status: 'running',
    createdAt: 3,
    updatedAt: 4,
    abortable: true,
  };
  const message: KernelChatMessage = {
    id: 'message-1',
    sessionRef,
    role: 'assistant',
    status: 'complete',
    createdAt: 5,
    updatedAt: 6,
    text: 'hello from hermes',
    parts: [
      {
        kind: 'text',
        text: 'hello from hermes',
      },
    ],
    runId: run.id,
  };
  const profile: KernelChatAgentProfile = {
    kernelId: 'hermes',
    instanceId: 'instance-hermes',
    agentId: 'agent-hermes',
    label: 'Hermes Agent',
    description: 'Kernel profile',
    source: 'kernelCatalog',
  };
  const deleted: string[] = [];

  const adapter = createHermesKernelChatAdapter({
    authorityKind: 'http',
    supportsStreaming: true,
    supportsRunAbort: true,
    async listAgentProfiles(instanceId) {
      assert.equal(instanceId, 'instance-hermes');
      return [profile];
    },
    async listSessions(instanceId) {
      assert.equal(instanceId, 'instance-hermes');
      return [session];
    },
    async getSession(instanceId, sessionId) {
      assert.equal(instanceId, 'instance-hermes');
      assert.equal(sessionId, 'session-1');
      return session;
    },
    async createSession(input) {
      assert.equal(input.instanceId, 'instance-hermes');
      return session;
    },
    async patchSession(input) {
      assert.equal(input.sessionId, 'session-1');
      return {
        ...session,
        title: input.title ?? session.title,
      };
    },
    async deleteSession(instanceId, sessionId) {
      assert.equal(instanceId, 'instance-hermes');
      deleted.push(sessionId);
    },
    async startRun(input) {
      assert.equal(input.sessionId, 'session-1');
      return run;
    },
    async listRuns(instanceId, sessionId) {
      assert.equal(instanceId, 'instance-hermes');
      assert.equal(sessionId, 'session-1');
      return [run];
    },
    async getRun(instanceId, sessionId, runId) {
      assert.equal(instanceId, 'instance-hermes');
      assert.equal(sessionId, 'session-1');
      assert.equal(runId, 'run-1');
      return run;
    },
    async abortRun(instanceId, sessionId, runId) {
      assert.equal(instanceId, 'instance-hermes');
      assert.equal(sessionId, 'session-1');
      assert.equal(runId, 'run-1');
      return true;
    },
    async loadMessages(instanceId, sessionId) {
      assert.equal(instanceId, 'instance-hermes');
      assert.equal(sessionId, 'session-1');
      return [message];
    },
  });

  assert.deepEqual(adapter.getCapabilities(), {
    adapterId: 'hermes',
    authorityKind: 'http',
    supported: true,
    durable: true,
    writable: true,
    supportsStreaming: true,
    supportsRuns: true,
    supportsAgentProfiles: true,
    supportsSessionMutation: true,
    capabilitySet: {
      supportsAgentProfiles: true,
      supportsSessionMutation: true,
      supportsStreaming: true,
      supportsRuns: true,
      supportsRunAbort: true,
      supportsModelSelection: true,
      supportsReasoningControl: true,
      supportsThinkingLevel: true,
      supportsFastMode: true,
      supportsVerboseLevel: true,
      supportsAttachments: false,
    },
    reason: null,
  });

  assert.deepEqual(await adapter.listAgentProfiles?.('instance-hermes'), [profile]);
  assert.deepEqual(await adapter.listSessions?.('instance-hermes'), [session]);
  assert.equal(await adapter.getSession?.('instance-hermes', 'session-1'), session);
  assert.equal(
    await adapter.createSession?.({
      instanceId: 'instance-hermes',
      title: 'Hermes Session',
    }),
    session,
  );
  assert.equal(
    (
      await adapter.patchSession?.({
        instanceId: 'instance-hermes',
        sessionId: 'session-1',
        title: 'Renamed Hermes Session',
      })
    )?.title,
    'Renamed Hermes Session',
  );
  assert.equal(
    await adapter.startRun?.({
      instanceId: 'instance-hermes',
      sessionId: 'session-1',
      content: 'hello',
    }),
    run,
  );
  assert.deepEqual(await adapter.listRuns?.('instance-hermes', 'session-1'), [run]);
  assert.equal(await adapter.getRun?.('instance-hermes', 'session-1', 'run-1'), run);
  assert.equal(await adapter.abortRun?.('instance-hermes', 'session-1', 'run-1'), true);
  assert.deepEqual(await adapter.loadMessages?.('instance-hermes', 'session-1'), [message]);
  await adapter.deleteSession?.('instance-hermes', 'session-1');
  assert.deepEqual(deleted, ['session-1']);
});

await runTest(
  'hermes kernel chat adapter advertises authoritative session override controls whenever patchSession is available',
  () => {
    const adapter = createHermesKernelChatAdapter({
      async listSessions() {
        return [];
      },
      async getSession() {
        return null;
      },
      async createSession() {
        throw new Error('not needed');
      },
      async patchSession() {
        throw new Error('not needed');
      },
      async startRun() {
        throw new Error('not needed');
      },
      async loadMessages() {
        return [];
      },
    });

    const capabilities = adapter.getCapabilities();

    assert.equal(capabilities.capabilitySet.supportsModelSelection, true);
    assert.equal(capabilities.capabilitySet.supportsThinkingLevel, true);
    assert.equal(capabilities.capabilitySet.supportsFastMode, true);
    assert.equal(capabilities.capabilitySet.supportsVerboseLevel, true);
    assert.equal(capabilities.capabilitySet.supportsReasoningControl, true);
  },
);
