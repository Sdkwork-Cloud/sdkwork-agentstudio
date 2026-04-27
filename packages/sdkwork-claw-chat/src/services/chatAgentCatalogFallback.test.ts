import assert from 'node:assert/strict';

import { mergeChatCatalogAgentsWithSessionFallback } from './chatAgentCatalogFallback.ts';

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
  'mergeChatCatalogAgentsWithSessionFallback derives stable fallback agents from persisted session bindings when the catalog is empty',
  () => {
    assert.deepEqual(
      mergeChatCatalogAgentsWithSessionFallback({
        catalogAgents: [],
        sessions: [
          {
            id: 'session-ops',
            updatedAt: 120,
            agentId: 'ops',
            agentLabel: 'Ops Agent',
          },
          {
            id: 'session-research',
            updatedAt: 220,
            kernelSession: {
              ref: {
                agentId: 'research',
              },
              actorBinding: {
                agentId: 'research',
                label: 'Research Agent',
              },
            },
          },
          {
            id: 'session-research-older',
            updatedAt: 100,
            agentId: 'research',
            agentLabel: 'Research Agent',
          },
        ],
      }),
      [
        {
          id: 'research',
          name: 'Research Agent',
          description: '',
          avatar: 'RE',
          systemPrompt: '',
          creator: 'Session',
        },
        {
          id: 'ops',
          name: 'Ops Agent',
          description: '',
          avatar: 'OP',
          systemPrompt: '',
          creator: 'Session',
        },
      ],
    );
  },
);

await runTest(
  'mergeChatCatalogAgentsWithSessionFallback preserves catalog-authoritative agents and only appends missing persisted bindings',
  () => {
    assert.deepEqual(
      mergeChatCatalogAgentsWithSessionFallback({
        catalogAgents: [
          {
            id: 'research',
            name: 'Research Agent',
            description: 'kernel catalog',
            avatar: 'RC',
            systemPrompt: 'kernel',
            creator: 'Kernel',
          },
        ],
        sessions: [
          {
            id: 'session-research',
            updatedAt: 200,
            agentId: 'research',
            agentLabel: 'Research Agent',
          },
          {
            id: 'session-ops',
            updatedAt: 180,
            agentId: 'ops',
            agentLabel: 'Ops Agent',
          },
        ],
      }),
      [
        {
          id: 'research',
          name: 'Research Agent',
          description: 'kernel catalog',
          avatar: 'RC',
          systemPrompt: 'kernel',
          creator: 'Kernel',
        },
        {
          id: 'ops',
          name: 'Ops Agent',
          description: '',
          avatar: 'OP',
          systemPrompt: '',
          creator: 'Session',
        },
      ],
    );
  },
);

await runTest(
  'mergeChatCatalogAgentsWithSessionFallback deduplicates fallback agent bindings case-insensitively',
  () => {
    assert.deepEqual(
      mergeChatCatalogAgentsWithSessionFallback({
        catalogAgents: [
          {
            id: 'main',
            name: 'Main',
            description: 'kernel catalog',
            avatar: 'MA',
            systemPrompt: 'kernel',
            creator: 'Kernel',
          },
        ],
        sessions: [
          {
            id: 'session-planner-latest',
            updatedAt: 300,
            agentId: 'Planner',
            agentLabel: 'Planner',
          },
          {
            id: 'session-planner-older',
            updatedAt: 200,
            agentId: 'planner',
            agentLabel: 'Planner Draft',
          },
          {
            id: 'session-main',
            updatedAt: 100,
            agentId: 'Main',
            agentLabel: 'Main',
          },
        ],
      }),
      [
        {
          id: 'main',
          name: 'Main',
          description: 'kernel catalog',
          avatar: 'MA',
          systemPrompt: 'kernel',
          creator: 'Kernel',
        },
        {
          id: 'Planner',
          name: 'Planner',
          description: '',
          avatar: 'PL',
          systemPrompt: '',
          creator: 'Session',
        },
      ],
    );
  },
);

await runTest(
  'mergeChatCatalogAgentsWithSessionFallback never exposes technical agent ids or date labels as fallback agent names',
  () => {
    assert.deepEqual(
      mergeChatCatalogAgentsWithSessionFallback({
        catalogAgents: [],
        sessions: [
          {
            id: 'agent:2026-04-26:main',
            updatedAt: 300,
            agentId: '2026-04-26',
            agentLabel: '2026-04-26',
            kernelSession: {
              ref: {
                agentId: '2026-04-26',
                kernelId: 'openclaw',
              },
            },
          },
          {
            id: 'agent:research-agent:main',
            updatedAt: 200,
            agentId: 'research-agent',
          },
          {
            id: 'agent:claw-studio:session-123:main',
            updatedAt: 100,
            agentId: 'claw-studio:session-123',
            kernelSession: {
              ref: {
                agentId: 'claw-studio:session-123',
                kernelId: 'hermes',
              },
            },
          },
        ],
      }).map((agent) => ({
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
      })),
      [
        {
          id: '2026-04-26',
          name: 'OpenClaw Agent',
          avatar: 'OP',
        },
        {
          id: 'research-agent',
          name: 'Research Agent',
          avatar: 'RE',
        },
        {
          id: 'claw-studio:session-123',
          name: 'Hermes Agent',
          avatar: 'HE',
        },
      ],
    );
  },
);
