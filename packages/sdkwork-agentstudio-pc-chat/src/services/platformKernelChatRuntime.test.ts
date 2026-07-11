import assert from 'node:assert/strict';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/agentstudio-pc-infrastructure';
import {
  createKernelChatAuthority,
  createKernelChatSessionRef,
  type StudioInstanceRecord,
} from '@sdkwork/agentstudio-pc-types';
import { createPlatformHermesKernelChatAdapterDependencies } from './platformKernelChatRuntime.ts';

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

function createHermesInstance(
  input: Partial<StudioInstanceRecord> & Pick<StudioInstanceRecord, 'id'>,
): StudioInstanceRecord {
  return {
    id: input.id,
    name: input.name ?? 'Hermes Runtime',
    description: input.description ?? 'Fixture',
    runtimeKind: 'hermes',
    deploymentMode: input.deploymentMode ?? 'local-managed',
    transportKind: input.transportKind ?? 'customHttp',
    status: input.status ?? 'online',
    isBuiltIn: input.isBuiltIn ?? false,
    isDefault: input.isDefault ?? false,
    iconType: input.iconType ?? 'server',
    version: input.version ?? '0.9.0',
    typeLabel: input.typeLabel ?? 'Hermes Agent',
    host: input.host ?? '127.0.0.1',
    port: input.port ?? 19540,
    baseUrl: input.baseUrl ?? 'http://127.0.0.1:19540',
    websocketUrl: input.websocketUrl ?? null,
    cpu: input.cpu ?? 0,
    memory: input.memory ?? 0,
    totalMemory: input.totalMemory ?? '0 GB',
    uptime: input.uptime ?? '0m',
    capabilities: input.capabilities ?? ['chat'],
    storage: input.storage ?? {
      provider: 'localFile',
      namespace: 'fixture',
    },
    config: input.config ?? {
      port: '19540',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:19540',
      websocketUrl: null,
    },
    createdAt: input.createdAt ?? 1,
    updatedAt: input.updatedAt ?? 1,
    lastSeenAt: input.lastSeenAt ?? 1,
  };
}

await runTest('createPlatformHermesKernelChatAdapterDependencies exposes authoritative kernel chat delegates for local Hermes instances', async () => {
  const originalBridge = getPlatformBridge();
  const session = {
    ref: createKernelChatSessionRef({
      kernelId: 'hermes',
      instanceId: 'instance-hermes-local',
      sessionId: 'session-1',
    }),
    authority: createKernelChatAuthority({
      kind: 'sqlite',
    }),
    lifecycle: 'ready' as const,
    title: 'Hermes Session',
    createdAt: 10,
    updatedAt: 20,
    messageCount: 1,
  };
  const message = {
    id: 'message-1',
    sessionRef: session.ref,
    role: 'assistant' as const,
    status: 'complete' as const,
    createdAt: 10,
    updatedAt: 20,
    text: 'hello from hermes',
    parts: [
      {
        kind: 'text' as const,
        text: 'hello from hermes',
      },
    ],
  };

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async listKernelChatSessions(instanceId) {
        assert.equal(instanceId, 'instance-hermes-local');
        return [session];
      },
      async getKernelChatSession(instanceId, sessionId) {
        assert.equal(instanceId, 'instance-hermes-local');
        assert.equal(sessionId, 'session-1');
        return session;
      },
      async createKernelChatSession(input) {
        assert.equal(input.instanceId, 'instance-hermes-local');
        return session;
      },
      async patchKernelChatSession(input) {
        assert.equal(input.instanceId, 'instance-hermes-local');
        assert.equal(input.sessionId, 'session-1');
        return session;
      },
      async deleteKernelChatSession(instanceId, sessionId) {
        assert.equal(instanceId, 'instance-hermes-local');
        assert.equal(sessionId, 'session-1');
      },
      async startKernelChatRun(input) {
        assert.equal(input.instanceId, 'instance-hermes-local');
        assert.equal(input.sessionId, 'session-1');
        return {
          id: 'run-1',
          sessionRef: session.ref,
          status: 'completed',
          createdAt: 20,
          updatedAt: 21,
          abortable: false,
        };
      },
      async listKernelChatRuns(requestedInstanceId, requestedSessionId) {
        assert.equal(requestedInstanceId, 'instance-hermes-local');
        assert.equal(requestedSessionId, 'session-1');
        return [
          {
            id: 'run-1',
            sessionRef: session.ref,
            status: 'completed',
            createdAt: 20,
            updatedAt: 21,
            abortable: false,
          },
        ];
      },
      async getKernelChatRun(requestedInstanceId, requestedSessionId, requestedRunId) {
        assert.equal(requestedInstanceId, 'instance-hermes-local');
        assert.equal(requestedSessionId, 'session-1');
        assert.equal(requestedRunId, 'run-1');
        return {
          id: 'run-1',
          sessionRef: session.ref,
          status: 'completed',
          createdAt: 20,
          updatedAt: 21,
          abortable: false,
        };
      },
      async abortKernelChatRun(instanceId, sessionId, runId) {
        assert.equal(instanceId, 'instance-hermes-local');
        assert.equal(sessionId, 'session-1');
        assert.equal(runId, 'run-1');
        return false;
      },
      async loadKernelChatMessages(instanceId, sessionId) {
        assert.equal(instanceId, 'instance-hermes-local');
        assert.equal(sessionId, 'session-1');
        return [message];
      },
    },
  });

  try {
    const dependencies = createPlatformHermesKernelChatAdapterDependencies(
      createHermesInstance({
        id: 'instance-hermes-local',
        deploymentMode: 'local-managed',
      }),
    );

    assert.equal(dependencies.authorityKind, 'sqlite');
    assert.equal(dependencies.supportsRunAbort, false);
    assert.equal(typeof dependencies.listSessions, 'function');
    assert.equal(typeof dependencies.createSession, 'function');
    assert.equal(typeof dependencies.startRun, 'function');
    assert.equal(typeof dependencies.listRuns, 'function');
    assert.equal(typeof dependencies.getRun, 'function');
    assert.equal(typeof dependencies.loadMessages, 'function');

    assert.deepEqual(await dependencies.listSessions?.('instance-hermes-local'), [session]);
    assert.equal(
      await dependencies.getSession?.('instance-hermes-local', 'session-1'),
      session,
    );
    assert.deepEqual(
      await dependencies.listRuns?.('instance-hermes-local', 'session-1'),
      [
        {
          id: 'run-1',
          sessionRef: session.ref,
          status: 'completed',
          createdAt: 20,
          updatedAt: 21,
          abortable: false,
        },
      ],
    );
    assert.deepEqual(
      await dependencies.getRun?.('instance-hermes-local', 'session-1', 'run-1'),
      {
        id: 'run-1',
        sessionRef: session.ref,
        status: 'completed',
        createdAt: 20,
        updatedAt: 21,
        abortable: false,
      },
    );
    assert.equal(
      await dependencies.createSession?.({
        instanceId: 'instance-hermes-local',
        title: 'Hermes Session',
      }),
      session,
    );
    assert.equal(
      await dependencies.patchSession?.({
        instanceId: 'instance-hermes-local',
        sessionId: 'session-1',
        title: 'Hermes Session',
      }),
      session,
    );
    assert.deepEqual(
      await dependencies.loadMessages?.('instance-hermes-local', 'session-1'),
      [message],
    );
    assert.equal(
      await dependencies.abortRun?.('instance-hermes-local', 'session-1', 'run-1'),
      false,
    );
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('createPlatformHermesKernelChatAdapterDependencies stays empty when the active platform bridge cannot provide authoritative kernel chat methods', () => {
  const dependencies = createPlatformHermesKernelChatAdapterDependencies(
    createHermesInstance({
      id: 'instance-hermes-remote',
      deploymentMode: 'remote',
    }),
  );

  assert.deepEqual(dependencies, {});
});

await runTest('createPlatformHermesKernelChatAdapterDependencies stays empty for local-external Hermes because desktop authoritative chat only supports managed runtimes', () => {
  const originalBridge = getPlatformBridge();
  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async listKernelChatSessions() {
        return [];
      },
      async getKernelChatSession() {
        return null;
      },
      async createKernelChatSession() {
        throw new Error('should not create session for local-external Hermes');
      },
      async patchKernelChatSession() {
        throw new Error('should not patch session for local-external Hermes');
      },
      async deleteKernelChatSession() {},
      async startKernelChatRun() {
        throw new Error('should not start run for local-external Hermes');
      },
      async loadKernelChatMessages() {
        return [];
      },
    },
  });

  try {
    const dependencies = createPlatformHermesKernelChatAdapterDependencies(
      createHermesInstance({
        id: 'instance-hermes-external',
        deploymentMode: 'local-external',
      }),
    );

    assert.deepEqual(dependencies, {});
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('createPlatformHermesKernelChatAdapterDependencies keeps authoritative Hermes delegates when abort is unavailable', async () => {
  const originalBridge = getPlatformBridge();
  const session = {
    ref: createKernelChatSessionRef({
      kernelId: 'hermes',
      instanceId: 'instance-hermes-local',
      sessionId: 'session-2',
    }),
    authority: createKernelChatAuthority({
      kind: 'sqlite',
    }),
    lifecycle: 'ready' as const,
    title: 'Hermes Session Without Abort',
    createdAt: 30,
    updatedAt: 40,
    messageCount: 0,
  };

  configurePlatformBridge({
    studio: {
      ...originalBridge.studio,
      async listKernelChatSessions(instanceId) {
        assert.equal(instanceId, 'instance-hermes-local');
        return [session];
      },
      async getKernelChatSession(instanceId, sessionId) {
        assert.equal(instanceId, 'instance-hermes-local');
        assert.equal(sessionId, 'session-2');
        return session;
      },
      async createKernelChatSession(input) {
        assert.equal(input.instanceId, 'instance-hermes-local');
        return session;
      },
      async patchKernelChatSession(input) {
        assert.equal(input.instanceId, 'instance-hermes-local');
        assert.equal(input.sessionId, 'session-2');
        return session;
      },
      async deleteKernelChatSession(instanceId, sessionId) {
        assert.equal(instanceId, 'instance-hermes-local');
        assert.equal(sessionId, 'session-2');
      },
      async startKernelChatRun(input) {
        assert.equal(input.instanceId, 'instance-hermes-local');
        assert.equal(input.sessionId, 'session-2');
        return {
          id: 'run-2',
          sessionRef: session.ref,
          status: 'completed' as const,
          createdAt: 40,
          updatedAt: 40,
          abortable: false,
        };
      },
      abortKernelChatRun: undefined,
      async loadKernelChatMessages(instanceId, sessionId) {
        assert.equal(instanceId, 'instance-hermes-local');
        assert.equal(sessionId, 'session-2');
        return [];
      },
    },
  });

  try {
    const dependencies = createPlatformHermesKernelChatAdapterDependencies(
      createHermesInstance({
        id: 'instance-hermes-local',
        deploymentMode: 'local-managed',
      }),
    );

    assert.equal(dependencies.authorityKind, 'sqlite');
    assert.equal(typeof dependencies.listSessions, 'function');
    assert.equal(typeof dependencies.createSession, 'function');
    assert.equal(typeof dependencies.startRun, 'function');
    assert.equal(typeof dependencies.loadMessages, 'function');
    assert.equal(dependencies.abortRun, undefined);
    assert.deepEqual(await dependencies.listSessions?.('instance-hermes-local'), [session]);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest(
  'createPlatformHermesKernelChatAdapterDependencies keeps authoritative Hermes send-receive delegates when optional session management methods are unavailable',
  async () => {
    const originalBridge = getPlatformBridge();
    const session = {
      ref: createKernelChatSessionRef({
        kernelId: 'hermes',
        instanceId: 'instance-hermes-local',
        sessionId: 'session-3',
      }),
      authority: createKernelChatAuthority({
        kind: 'sqlite',
      }),
      lifecycle: 'ready' as const,
      title: 'Hermes Session Minimal Runtime',
      createdAt: 50,
      updatedAt: 60,
      messageCount: 1,
    };
    const message = {
      id: 'message-3',
      sessionRef: session.ref,
      role: 'assistant' as const,
      status: 'complete' as const,
      createdAt: 60,
      updatedAt: 61,
      text: 'hello from minimal hermes runtime',
      parts: [
        {
          kind: 'text' as const,
          text: 'hello from minimal hermes runtime',
        },
      ],
    };

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async listKernelChatSessions(instanceId) {
          assert.equal(instanceId, 'instance-hermes-local');
          return [session];
        },
        getKernelChatSession: undefined,
        async createKernelChatSession(input) {
          assert.equal(input.instanceId, 'instance-hermes-local');
          return session;
        },
        patchKernelChatSession: undefined,
        deleteKernelChatSession: undefined,
        async startKernelChatRun(input) {
          assert.equal(input.instanceId, 'instance-hermes-local');
          assert.equal(input.sessionId, 'session-3');
          return {
            id: 'run-3',
            sessionRef: session.ref,
            status: 'completed' as const,
            createdAt: 61,
            updatedAt: 62,
            abortable: false,
          };
        },
        async loadKernelChatMessages(instanceId, sessionId) {
          assert.equal(instanceId, 'instance-hermes-local');
          assert.equal(sessionId, 'session-3');
          return [message];
        },
      },
    });

    try {
      const dependencies = createPlatformHermesKernelChatAdapterDependencies(
        createHermesInstance({
          id: 'instance-hermes-local',
          deploymentMode: 'local-managed',
        }),
      );

      assert.equal(dependencies.authorityKind, 'sqlite');
      assert.equal(typeof dependencies.listSessions, 'function');
      assert.equal(typeof dependencies.createSession, 'function');
      assert.equal(typeof dependencies.startRun, 'function');
      assert.equal(typeof dependencies.loadMessages, 'function');
      assert.equal(dependencies.getSession, undefined);
      assert.equal(dependencies.patchSession, undefined);
      assert.equal(dependencies.deleteSession, undefined);
      assert.deepEqual(await dependencies.listSessions?.('instance-hermes-local'), [session]);
      assert.equal(
        await dependencies.createSession?.({
          instanceId: 'instance-hermes-local',
          title: 'Hermes Session Minimal Runtime',
        }),
        session,
      );
      assert.deepEqual(
        await dependencies.loadMessages?.('instance-hermes-local', 'session-3'),
        [message],
      );
    } finally {
      configurePlatformBridge(originalBridge);
    }
  },
);
