import assert from 'node:assert/strict';

import {
  resolveChatSidebarAgentSelectionPlan,
  resolveChatSidebarKnownAgentLinkedInstanceId,
} from './chatSidebarSelection.ts';

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
  'resolveChatSidebarKnownAgentLinkedInstanceId keeps visible current-instance agents on the fast path',
  () => {
    const agentOptions = [
      {
        id: null,
        name: 'Main Agent',
        avatarLabel: null,
        matchAgentIds: ['main'],
      },
      {
        id: 'research',
        name: 'Research Agent',
        avatarLabel: 'RE',
      },
    ];

    assert.equal(
      resolveChatSidebarKnownAgentLinkedInstanceId({
        agentId: 'research',
        currentActiveInstanceId: 'local-instance',
        agentOptions,
      }),
      'local-instance',
    );
    assert.equal(
      resolveChatSidebarKnownAgentLinkedInstanceId({
        agentId: 'main',
        currentActiveInstanceId: 'local-instance',
        agentOptions,
      }),
      'local-instance',
    );
    assert.equal(
      resolveChatSidebarKnownAgentLinkedInstanceId({
        agentId: null,
        currentActiveInstanceId: 'local-instance',
        agentOptions,
      }),
      'local-instance',
    );
    assert.equal(
      resolveChatSidebarKnownAgentLinkedInstanceId({
        agentId: 'remote-only',
        currentActiveInstanceId: 'local-instance',
        agentOptions,
      }),
      undefined,
    );
    assert.equal(
      resolveChatSidebarKnownAgentLinkedInstanceId({
        agentId: 'research',
        currentActiveInstanceId: null,
        agentOptions,
      }),
      undefined,
    );
  },
);

await runTest(
  'resolveChatSidebarAgentSelectionPlan switches visible agents without scheduling redundant current-instance hydration',
  () => {
    assert.deepEqual(
      resolveChatSidebarAgentSelectionPlan({
        selection: { agentId: 'research' },
        currentActiveInstanceId: 'local-instance',
        instances: [
          {
            id: 'local-instance',
            name: 'Local',
            ip: '127.0.0.1',
            status: 'online',
          },
        ],
        linkedInstanceId: 'local-instance',
      }),
      {
        nextInstanceId: 'local-instance',
        shouldHydrateTargetInstance: false,
        shouldSetActiveInstance: false,
        nextSelectedAgentId: 'research',
        nextSessionId: null,
        shouldSetActiveSession: true,
      },
    );
  },
);
