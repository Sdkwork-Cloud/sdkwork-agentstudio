import assert from 'node:assert/strict';
import {
  parseOpenClawGatewayAgentLifecycleEvent,
} from './kernelAgentLifecycleEvents.ts';

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
  'parseOpenClawGatewayAgentLifecycleEvent emits created events for completed agents.create tool results',
  () => {
    assert.deepEqual(
      parseOpenClawGatewayAgentLifecycleEvent({
        instanceId: 'instance-a',
        payload: {
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
        },
      }),
      {
        instanceId: 'instance-a',
        kernelId: 'openclaw',
        type: 'created',
        agentId: 'research',
        source: 'openclawGateway',
        payload: {
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
        },
      },
    );
  },
);

await runTest(
  'parseOpenClawGatewayAgentLifecycleEvent treats OpenClaw agent catalog events as lifecycle events',
  () => {
    assert.deepEqual(
      parseOpenClawGatewayAgentLifecycleEvent({
        instanceId: 'instance-a',
        payload: {
          stream: 'agent.catalog',
          action: 'created',
          agentId: 'ops',
        },
      }),
      {
        instanceId: 'instance-a',
        kernelId: 'openclaw',
        type: 'created',
        agentId: 'ops',
        source: 'openclawGateway',
        payload: {
          stream: 'agent.catalog',
          action: 'created',
          agentId: 'ops',
        },
      },
    );
  },
);

await runTest(
  'parseOpenClawGatewayAgentLifecycleEvent detects gateway config mutations that modify the agents catalog',
  () => {
    assert.deepEqual(
      parseOpenClawGatewayAgentLifecycleEvent({
        instanceId: 'instance-a',
        payload: {
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
                        id: 'ops',
                      },
                    ],
                  },
                },
              },
            },
            result: {
              ok: true,
            },
          },
        },
      }),
      {
        instanceId: 'instance-a',
        kernelId: 'openclaw',
        type: 'catalogChanged',
        agentId: 'ops',
        source: 'openclawGateway',
        payload: {
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
                        id: 'ops',
                      },
                    ],
                  },
                },
              },
            },
            result: {
              ok: true,
            },
          },
        },
      },
    );
  },
);

await runTest(
  'parseOpenClawGatewayAgentLifecycleEvent ignores ordinary tool and non-catalog lifecycle noise',
  () => {
    assert.equal(
      parseOpenClawGatewayAgentLifecycleEvent({
        instanceId: 'instance-a',
        payload: {
          sessionKey: 'thread:research',
          runId: 'run-1',
          stream: 'tool',
          data: {
            phase: 'result',
            toolCallId: 'tool-search',
            name: 'web_search',
            result: 'docs',
          },
        },
      }),
      null,
    );
    assert.equal(
      parseOpenClawGatewayAgentLifecycleEvent({
        instanceId: 'instance-a',
        payload: {
          sessionKey: 'thread:research',
          runId: 'run-1',
          stream: 'tool',
          data: {
            phase: 'result',
            toolCallId: 'tool-ticket',
            name: 'ticket',
            action: 'created',
            result: {
              id: 'ticket-1',
            },
          },
        },
      }),
      null,
    );
    assert.equal(
      parseOpenClawGatewayAgentLifecycleEvent({
        instanceId: 'instance-a',
        payload: {
          stream: 'agent',
          action: 'heartbeat',
          status: 'running',
        },
      }),
      null,
    );
  },
);
