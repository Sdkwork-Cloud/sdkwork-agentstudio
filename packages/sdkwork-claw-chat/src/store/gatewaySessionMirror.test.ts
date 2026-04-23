import assert from 'node:assert/strict';
import {
  filterGatewayMirrorSessions,
  resolveGatewayMirrorScopeSessions,
  syncGatewayMirrorSessions,
} from './gatewaySessionMirror.ts';

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

function createSession(input: {
  id: string;
  authorityKind?: 'gateway' | 'http' | 'sqlite' | 'localProjection';
  transport?: 'openclawGateway' | 'kernelAdapter' | 'local';
  updatedAt?: number;
}) {
  return {
    id: input.id,
    updatedAt: input.updatedAt ?? 1,
    transport: input.transport,
    kernelSession: input.authorityKind
      ? {
          authority: {
            kind: input.authorityKind,
          },
        }
      : null,
  };
}

await runTest(
  'gatewaySessionMirror preserves the existing gateway cache while a live gateway refresh is still loading with no sessions yet',
  () => {
    const existingSessions = [
      createSession({
        id: 'agent:research:main',
        authorityKind: 'gateway',
        transport: 'openclawGateway',
        updatedAt: 40,
      }),
    ];

    const resolvedSessions = resolveGatewayMirrorScopeSessions({
      existingSessions,
      snapshotSessions: [],
      syncState: 'loading',
    });

    assert.deepEqual(resolvedSessions, existingSessions);
  },
);

await runTest(
  'gatewaySessionMirror uses the live gateway truth when an idle snapshot reports no remaining sessions',
  () => {
    const existingSessions = [
      createSession({
        id: 'agent:research:main',
        authorityKind: 'gateway',
        transport: 'openclawGateway',
        updatedAt: 40,
      }),
    ];

    const resolvedSessions = resolveGatewayMirrorScopeSessions({
      existingSessions,
      snapshotSessions: [],
      syncState: 'idle',
    });

    assert.deepEqual(resolvedSessions, []);
  },
);

await runTest(
  'gatewaySessionMirror synchronizes the latest gateway sessions into local mirrors and deletes stale mirrored sessions only',
  async () => {
    const putCalls: string[] = [];
    const deleteCalls: string[] = [];

    await syncGatewayMirrorSessions({
      instanceId: 'instance-openclaw-1',
      snapshotSessions: [
        createSession({
          id: 'agent:research:main',
          authorityKind: 'gateway',
          transport: 'openclawGateway',
          updatedAt: 80,
        }),
        createSession({
          id: 'transport-session',
          authorityKind: 'http',
          transport: 'kernelAdapter',
          updatedAt: 20,
        }),
      ],
      listPersistedSessions: async () => [
        createSession({
          id: 'agent:research:main',
          authorityKind: 'gateway',
          transport: 'openclawGateway',
          updatedAt: 30,
        }),
        createSession({
          id: 'agent:ops:main',
          authorityKind: 'gateway',
          transport: 'openclawGateway',
          updatedAt: 10,
        }),
        createSession({
          id: 'transport-session',
          authorityKind: 'http',
          transport: 'kernelAdapter',
          updatedAt: 5,
        }),
      ],
      putPersistedSession: async (session) => {
        putCalls.push(session.id);
      },
      deletePersistedSession: async (sessionId) => {
        deleteCalls.push(sessionId);
      },
    });

    assert.deepEqual(filterGatewayMirrorSessions([
      createSession({
        id: 'agent:research:main',
        authorityKind: 'gateway',
        transport: 'openclawGateway',
      }),
      createSession({
        id: 'transport-session',
        authorityKind: 'http',
        transport: 'kernelAdapter',
      }),
    ]).map((session) => session.id), ['agent:research:main']);
    assert.deepEqual(putCalls, ['agent:research:main']);
    assert.deepEqual(deleteCalls, ['agent:ops:main']);
  },
);
