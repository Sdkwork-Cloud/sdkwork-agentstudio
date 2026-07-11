import assert from 'node:assert/strict';
import { shouldRefreshChatAgentCatalogForGatewayAgentEvent } from './openClawGatewayAgentCatalogRefreshPolicy.ts';

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
  'agent catalog refresh policy refreshes after agent mutation tool results',
  () => {
    assert.equal(
      shouldRefreshChatAgentCatalogForGatewayAgentEvent({
        sessionKey: 'thread:agent-creator',
        runId: 'run-1',
        stream: 'tool',
        data: {
          phase: 'result',
          toolCallId: 'tool-create-agent',
          name: 'agents.create',
          result: {
            agentId: 'research',
          },
        },
      }),
      true,
    );
    assert.equal(
      shouldRefreshChatAgentCatalogForGatewayAgentEvent({
        sessionKey: 'thread:agent-creator',
        runId: 'run-1',
        stream: 'tool',
        data: {
          phase: 'result',
          toolCallId: 'tool-create-agent',
          name: 'agents',
          action: 'create',
        },
      }),
      true,
    );
  },
);

await runTest(
  'agent catalog refresh policy refreshes when gateway config mutations touch the agents catalog',
  () => {
    assert.equal(
      shouldRefreshChatAgentCatalogForGatewayAgentEvent({
        sessionKey: 'thread:agent-creator',
        runId: 'run-1',
        stream: 'tool',
        data: {
          phase: 'result',
          toolCallId: 'tool-config-patch',
          name: 'gateway',
          args: {
            method: 'config.patch',
            params: {
              raw: {
                agents: {
                  list: [
                    {
                      id: 'writer',
                    },
                  ],
                },
              },
            },
          },
        },
      }),
      true,
    );
  },
);

await runTest(
  'agent catalog refresh policy ignores ordinary tool events and in-flight mutation phases',
  () => {
    assert.equal(
      shouldRefreshChatAgentCatalogForGatewayAgentEvent({
        sessionKey: 'thread:research',
        runId: 'run-1',
        stream: 'tool',
        data: {
          phase: 'result',
          toolCallId: 'tool-search',
          name: 'web_search',
          result: 'docs',
        },
      }),
      false,
    );
    assert.equal(
      shouldRefreshChatAgentCatalogForGatewayAgentEvent({
        sessionKey: 'thread:agent-creator',
        runId: 'run-1',
        stream: 'tool',
        data: {
          phase: 'start',
          toolCallId: 'tool-create-agent',
          name: 'agents.create',
        },
      }),
      false,
    );
  },
);

await runTest(
  'agent catalog refresh policy refreshes for direct lifecycle catalog events',
  () => {
    assert.equal(
      shouldRefreshChatAgentCatalogForGatewayAgentEvent({
        stream: 'agent.catalog',
        action: 'created',
        agentId: 'research',
      }),
      true,
    );
    assert.equal(
      shouldRefreshChatAgentCatalogForGatewayAgentEvent({
        action: 'updated',
        subject: 'agent',
        agentId: 'research',
      }),
      true,
    );
  },
);

await runTest(
  'agent catalog refresh policy ignores non-catalog agent lifecycle noise',
  () => {
    assert.equal(
      shouldRefreshChatAgentCatalogForGatewayAgentEvent({
        stream: 'agent',
        action: 'heartbeat',
        status: 'running',
      }),
      false,
    );
    assert.equal(
      shouldRefreshChatAgentCatalogForGatewayAgentEvent({
        stream: 'agents',
        action: 'listed',
      }),
      false,
    );
  },
);
