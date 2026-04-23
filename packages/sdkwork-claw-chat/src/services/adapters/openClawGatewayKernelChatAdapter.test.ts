import assert from 'node:assert/strict';
import {
  createKernelChatAuthority,
  createKernelChatSessionRef,
  type KernelChatSession,
} from '@sdkwork/claw-types';
import { createOpenClawGatewayKernelChatAdapter } from './openClawGatewayKernelChatAdapter.ts';

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

function createKernelSession(sessionId: string): KernelChatSession {
  return {
    ref: createKernelChatSessionRef({
      kernelId: 'openclaw',
      instanceId: 'instance-openclaw',
      sessionId,
      routingKey: sessionId,
      agentId: 'main',
    }),
    authority: createKernelChatAuthority({
      kind: 'gateway',
    }),
    lifecycle: 'ready',
    title: 'Main session',
    createdAt: 1,
    updatedAt: 2,
    messageCount: 0,
    sessionKind: 'direct',
    activeRunId: null,
  };
}

await runTest('openclaw gateway kernel chat adapter exposes gateway authority and delegates session reads', async () => {
  const calls: string[] = [];
  const adapter = createOpenClawGatewayKernelChatAdapter({
    gatewayStore: {
      async hydrateInstance(instanceId) {
        calls.push(`hydrate:${instanceId}`);
      },
      getSnapshot(instanceId) {
        calls.push(`snapshot:${instanceId}`);
        return {
          sessions: [
            {
              id: 'agent:main:main',
              kernelSession: createKernelSession('agent:main:main'),
            },
          ],
        };
      },
    },
  });

  const sessions = await adapter.listSessions?.('instance-openclaw');
  const capabilities = adapter.getCapabilities();

  assert.equal(capabilities.authorityKind, 'gateway');
  assert.equal(capabilities.durable, true);
  assert.deepEqual(
    sessions?.map((session) => session.ref.sessionId),
    ['agent:main:main'],
  );
  assert.deepEqual(calls, ['hydrate:instance-openclaw', 'snapshot:instance-openclaw']);
});

await runTest(
  'openclaw gateway kernel chat adapter does not overstate message-run capabilities that live outside the adapter surface',
  () => {
    const adapter = createOpenClawGatewayKernelChatAdapter({
      gatewayStore: {
        async hydrateInstance() {},
        getSnapshot() {
          return {
            sessions: [],
          };
        },
      },
    });

    const capabilities = adapter.getCapabilities();

    assert.equal(capabilities.supportsStreaming, false);
    assert.equal(capabilities.supportsRuns, false);
    assert.equal(capabilities.supportsAgentProfiles, false);
    assert.equal(capabilities.capabilitySet.supportsStreaming, false);
    assert.equal(capabilities.capabilitySet.supportsRuns, false);
    assert.equal(capabilities.capabilitySet.supportsAgentProfiles, false);
  },
);
